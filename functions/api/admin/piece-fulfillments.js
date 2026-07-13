import { jsonResponse, requireAdmin, requireDb } from '../_lib/admin.js';
import { isMissingTableError, migrationNotApplied } from '../_lib/keeper.js';
import { prepareNextLineageEvent } from '../_lib/lineage.js';

const MANUAL_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_./-]{2,127}$/;
const CORRECTION_REASON_MAX = 500;

export async function onRequest({ request, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  try {
    if (request.method === 'GET') return listFulfillmentDesk(env);
    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
    }

    if (body?.action === 'assign') return await assignFulfillment(env, body);
    if (body?.action === 'correct') return await correctFulfillment(env, body);
    if (body?.action === 'ship') return await shipFulfillment(env, body);
    return jsonResponse({ ok: false, error: 'invalid_action' }, 400);
  } catch (error) {
    if (isMissingTableError(error) || /no such column/i.test(String(error?.message || ''))) {
      return migrationNotApplied();
    }
    if (/UNIQUE constraint failed/i.test(String(error?.message || ''))) {
      return jsonResponse({ ok: false, error: 'assignment_conflict' }, 409);
    }
    console.error('[admin/piece-fulfillments] error:', error?.message);
    return jsonResponse({ ok: false, error: 'fulfillment_failed' }, 500);
  }
}

async function listFulfillmentDesk(env) {
  const [platesResult, orderItemsResult, fulfillmentsResult] = await Promise.all([
    env.DB.prepare(
      `SELECT kp.id, kp.piece_id, kp.edition_number, kp.public_code,
              kp.plate_status, kp.backup_status, kp.plate_activated_at
         FROM keeper_pieces kp
         LEFT JOIN piece_fulfillments pf ON pf.keeper_piece_id = kp.id
        WHERE kp.plate_status = 'active'
          AND kp.backup_status = 'verified'
          AND kp.keeper_user_id IS NULL
          AND kp.claimed_at IS NULL
          AND pf.id IS NULL
        ORDER BY kp.plate_activated_at DESC, kp.id`,
    ).all(),
    env.DB.prepare(
      `SELECT oi.id, oi.order_id, oi.product_id, oi.description, oi.quantity,
              oi.amount_subtotal, o.status AS order_status,
              ('order:' || o.id) AS order_reference, o.email AS buyer_email
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         LEFT JOIN piece_fulfillments pf ON pf.order_item_id = oi.id
        WHERE o.status = 'paid' AND oi.quantity = 1 AND pf.id IS NULL
        ORDER BY o.created_at, oi.id`,
    ).all(),
    env.DB.prepare(
      `SELECT pf.id, pf.keeper_piece_id, pf.order_item_id, pf.assignment_type,
              pf.intended_recipient_reference, pf.assigned_at, pf.shipped_at,
              pf.claimed_at, pf.corrected_at, pf.correction_reason,
              kp.piece_id, kp.edition_number, kp.public_code,
              o.email AS buyer_email
         FROM piece_fulfillments pf
         JOIN keeper_pieces kp ON kp.id = pf.keeper_piece_id
         LEFT JOIN order_items oi ON oi.id = pf.order_item_id
         LEFT JOIN orders o ON o.id = oi.order_id
        ORDER BY pf.assigned_at DESC`,
    ).all(),
  ]);

  return jsonResponse({
    ok: true,
    availablePlates: (platesResult.results || []).map(serializePlate),
    availableOrderItems: (orderItemsResult.results || []).map(serializeOrderItem),
    fulfillments: (fulfillmentsResult.results || []).map(serializeFulfillment),
  });
}

function serializePlate(row) {
  return {
    id: row.id,
    pieceId: row.piece_id,
    editionNumber: row.edition_number,
    publicCode: row.public_code,
    plateStatus: row.plate_status,
    backupStatus: row.backup_status,
    plateActivatedAt: row.plate_activated_at || null,
  };
}

function serializeOrderItem(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    orderReference: row.order_reference,
    buyerEmail: row.buyer_email,
    productId: row.product_id,
    description: row.description || null,
    quantity: row.quantity,
    amountSubtotal: row.amount_subtotal,
  };
}

function serializeFulfillment(row) {
  return {
    id: row.id,
    keeperPieceId: row.keeper_piece_id,
    pieceId: row.piece_id,
    editionNumber: row.edition_number,
    publicCode: row.public_code,
    orderItemId: row.order_item_id,
    assignmentType: row.assignment_type,
    intendedRecipientReference: row.intended_recipient_reference,
    buyerEmail: row.buyer_email || null,
    assignedAt: row.assigned_at,
    shippedAt: row.shipped_at || null,
    claimedAt: row.claimed_at || null,
    correctedAt: row.corrected_at || null,
    correctionReason: row.correction_reason || null,
  };
}

async function loadAssignablePiece(env, keeperPieceId) {
  if (typeof keeperPieceId !== 'string' || !keeperPieceId.trim()) return null;
  return env.DB.prepare(
    `SELECT id, piece_id, edition_number, public_code, plate_status,
            backup_status, keeper_user_id, claimed_at, released_at
       FROM keeper_pieces WHERE id = ?1`,
  ).bind(keeperPieceId.trim()).first();
}

function pieceIsAssignable(piece) {
  return Boolean(
    piece &&
    piece.plate_status === 'active' &&
    piece.backup_status === 'verified' &&
    !piece.keeper_user_id &&
    !piece.claimed_at &&
    !piece.released_at
  );
}

async function resolveAssignment(env, body) {
  const hasOrderItem = Number.isSafeInteger(body?.orderItemId) && body.orderItemId > 0;
  const manualReference = typeof body?.manualReference === 'string'
    ? body.manualReference.trim()
    : '';
  if (hasOrderItem === Boolean(manualReference)) {
    return { response: jsonResponse({ ok: false, error: 'choose_exactly_one_assignment_source' }, 400) };
  }

  if (manualReference) {
    if (!MANUAL_REFERENCE_PATTERN.test(manualReference)) {
      return { response: jsonResponse({ ok: false, error: 'invalid_manual_reference' }, 400) };
    }
    return {
      orderItemId: null,
      assignmentType: 'manual',
      reference: manualReference,
    };
  }

  const orderItem = await env.DB.prepare(
    `SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, o.status AS order_status,
            ('order:' || o.id) AS order_reference
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE oi.id = ?1`,
  ).bind(body.orderItemId).first();
  if (!orderItem) {
    return { response: jsonResponse({ ok: false, error: 'order_item_not_found' }, 404) };
  }
  if (orderItem.quantity !== 1) {
    return { response: jsonResponse({ ok: false, error: 'order_item_quantity_must_be_one' }, 400) };
  }
  if (orderItem.order_status !== 'paid') {
    return { response: jsonResponse({ ok: false, error: 'order_not_paid' }, 409) };
  }
  return {
    orderItemId: orderItem.id,
    assignmentType: 'stripe_order',
    reference: orderItem.order_reference,
    productId: orderItem.product_id,
  };
}

async function assignFulfillment(env, body) {
  const piece = await loadAssignablePiece(env, body?.keeperPieceId);
  if (!piece) return jsonResponse({ ok: false, error: 'piece_not_found' }, 404);
  if (!pieceIsAssignable(piece)) {
    return jsonResponse({ ok: false, error: 'piece_not_assignable' }, 409);
  }
  const assignment = await resolveAssignment(env, body);
  if (assignment.response) return assignment.response;
  // order_items.product_id is the canonical artwork id captured from Stripe
  // product metadata.product_id by the webhook. Stripe product/price ids are
  // only legacy fallbacks and therefore cannot be assigned to a physical row.
  if (assignment.assignmentType === 'stripe_order' && assignment.productId !== piece.piece_id) {
    return jsonResponse({ ok: false, error: 'order_item_piece_mismatch' }, 409);
  }

  const id = crypto.randomUUID();
  const assignedAt = new Date().toISOString();
  const mutation = env.DB.prepare(
    `INSERT INTO piece_fulfillments
       (id, keeper_piece_id, order_item_id, assignment_type,
        intended_recipient_reference, assigned_at)
     SELECT ?1, kp.id, ?3, ?4, ?5, ?6
       FROM keeper_pieces kp
      WHERE kp.id = ?2
        AND kp.plate_status = 'active'
        AND kp.backup_status = 'verified'
        AND kp.keeper_user_id IS NULL
        AND kp.claimed_at IS NULL
        AND kp.released_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM piece_fulfillments occupied
           WHERE occupied.keeper_piece_id = kp.id
        )
        AND (
          ?4 = 'manual'
          OR EXISTS (
            SELECT 1 FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.id = ?3 AND oi.quantity = 1 AND o.status = 'paid'
              AND oi.product_id = kp.piece_id
          )
        )`,
  ).bind(
    id,
    piece.id,
    assignment.orderItemId,
    assignment.assignmentType,
    assignment.reference,
    assignedAt,
  );
  const result = await mutateWithAudit(
    env,
    mutation,
    piece.id,
    'fulfillment_assign',
    'assignment_attempt',
    assignedAt,
  );
  if ((result?.meta?.changes ?? 0) === 0) {
    return jsonResponse({ ok: false, error: 'assignment_conflict' }, 409);
  }
  return jsonResponse({ ok: true, fulfillment: { id, keeperPieceId: piece.id, assignedAt } }, 201);
}

async function correctFulfillment(env, body) {
  const fulfillmentId = typeof body?.fulfillmentId === 'string' ? body.fulfillmentId.trim() : '';
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (!fulfillmentId || !reason || reason.length > CORRECTION_REASON_MAX) {
    return jsonResponse({ ok: false, error: 'correction_reason_required' }, 400);
  }
  const existing = await env.DB.prepare(
    `SELECT id, keeper_piece_id, order_item_id, assignment_type,
            intended_recipient_reference, assigned_at, shipped_at, claimed_at
       FROM piece_fulfillments WHERE id = ?1`,
  ).bind(fulfillmentId).first();
  if (!existing) return jsonResponse({ ok: false, error: 'fulfillment_not_found' }, 404);
  if (existing.shipped_at) {
    return jsonResponse({ ok: false, error: 'fulfillment_already_shipped' }, 409);
  }
  if (existing.claimed_at) {
    return jsonResponse({ ok: false, error: 'fulfillment_already_claimed' }, 409);
  }

  const piece = await loadAssignablePiece(env, body?.keeperPieceId);
  if (!piece) return jsonResponse({ ok: false, error: 'piece_not_found' }, 404);
  if (!pieceIsAssignable(piece)) {
    return jsonResponse({ ok: false, error: 'piece_not_assignable' }, 409);
  }
  const assignment = await resolveAssignment(env, body);
  if (assignment.response) return assignment.response;
  if (assignment.assignmentType === 'stripe_order' && assignment.productId !== piece.piece_id) {
    return jsonResponse({ ok: false, error: 'order_item_piece_mismatch' }, 409);
  }

  const correctedAt = new Date().toISOString();
  const mutation = env.DB.prepare(
    `UPDATE piece_fulfillments
        SET keeper_piece_id = ?1, order_item_id = ?2, assignment_type = ?3,
            intended_recipient_reference = ?4, corrected_at = ?5,
            correction_reason = ?6
      WHERE id = ?7 AND shipped_at IS NULL AND claimed_at IS NULL
        AND EXISTS (
          SELECT 1 FROM keeper_pieces kp
           WHERE kp.id = ?1
             AND kp.plate_status = 'active'
             AND kp.backup_status = 'verified'
             AND kp.keeper_user_id IS NULL
             AND kp.claimed_at IS NULL
             AND kp.released_at IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM piece_fulfillments occupied
                WHERE occupied.keeper_piece_id = kp.id AND occupied.id <> ?7
             )
             AND (
               ?3 = 'manual'
               OR EXISTS (
                 SELECT 1 FROM order_items oi
                 JOIN orders o ON o.id = oi.order_id
                 WHERE oi.id = ?2 AND oi.quantity = 1 AND o.status = 'paid'
                   AND oi.product_id = kp.piece_id
               )
             )
        )`,
  ).bind(
    piece.id,
    assignment.orderItemId,
    assignment.assignmentType,
    assignment.reference,
    correctedAt,
    reason,
    existing.id,
  );
  const result = await mutateCorrectionWithLineage(env, {
    mutation,
    oldKeeperPieceId: existing.keeper_piece_id,
    newKeeperPieceId: piece.id,
    correctedAt,
  });
  if ((result?.meta?.changes ?? 0) === 0) {
    return jsonResponse({ ok: false, error: 'correction_conflict' }, 409);
  }
  return jsonResponse({ ok: true, fulfillment: { id: existing.id, correctedAt } });
}

async function mutateCorrectionWithLineage(env, {
  mutation, oldKeeperPieceId, newKeeperPieceId, correctedAt,
}) {
  if (typeof env.DB.batch !== 'function') throw new Error('atomic write unavailable');
  const moved = oldKeeperPieceId !== newKeeperPieceId;
  const incoming = await prepareNextLineageEvent(env, {
    keeperPieceId: newKeeperPieceId,
    eventType: moved ? 'fulfillment_correction_in' : 'fulfillment_correct',
    eventAt: correctedAt,
    publicPayload: {},
    onlyIfPreviousChanged: true,
  });
  const statements = [mutation, incoming.statement];
  if (moved) {
    const outgoing = await prepareNextLineageEvent(env, {
      keeperPieceId: oldKeeperPieceId,
      eventType: 'fulfillment_correction_out',
      eventAt: correctedAt,
      publicPayload: {},
      onlyIfPreviousChanged: true,
    });
    statements.push(outgoing.statement);
  }
  statements.push(auditStatement(
    env, newKeeperPieceId, 'fulfillment_correct', 'correction_attempt', correctedAt,
  ));
  const [result] = await env.DB.batch(statements);
  return result;
}

async function shipFulfillment(env, body) {
  const fulfillmentId = typeof body?.fulfillmentId === 'string' ? body.fulfillmentId.trim() : '';
  if (!fulfillmentId) return jsonResponse({ ok: false, error: 'fulfillment_id_required' }, 400);
  const existing = await env.DB.prepare(
    `SELECT id, keeper_piece_id, order_item_id, assignment_type,
            intended_recipient_reference, assigned_at, shipped_at, claimed_at
       FROM piece_fulfillments WHERE id = ?1`,
  ).bind(fulfillmentId).first();
  if (!existing) return jsonResponse({ ok: false, error: 'fulfillment_not_found' }, 404);
  if (existing.shipped_at) {
    return jsonResponse({ ok: true, fulfillment: { id: existing.id, shippedAt: existing.shipped_at } });
  }
  const piece = await loadAssignablePiece(env, existing.keeper_piece_id);
  if (!piece || piece.plate_status !== 'active' || piece.backup_status !== 'verified') {
    return jsonResponse({ ok: false, error: 'plate_not_ready_to_ship' }, 409);
  }

  const shippedAt = new Date().toISOString();
  const mutation = env.DB.prepare(
    `UPDATE piece_fulfillments SET shipped_at = ?1
      WHERE id = ?2 AND shipped_at IS NULL
        AND (
          assignment_type = 'manual'
          OR EXISTS (
            SELECT 1 FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.id = piece_fulfillments.order_item_id AND o.status = 'paid'
          )
        )`,
  ).bind(shippedAt, existing.id);
  const result = await mutateWithAudit(
    env,
    mutation,
    existing.keeper_piece_id,
    'fulfillment_ship',
    'shipment_attempt',
    shippedAt,
  );
  if ((result?.meta?.changes ?? 0) === 0) {
    const current = await env.DB.prepare(
      `SELECT id, keeper_piece_id, order_item_id, assignment_type,
              intended_recipient_reference, assigned_at, shipped_at, claimed_at
         FROM piece_fulfillments WHERE id = ?1`,
    ).bind(existing.id).first();
    if (current?.shipped_at) {
      return jsonResponse({ ok: true, fulfillment: { id: current.id, shippedAt: current.shipped_at } });
    }
    return jsonResponse({ ok: false, error: 'shipment_conflict' }, 409);
  }
  return jsonResponse({ ok: true, fulfillment: { id: existing.id, shippedAt } });
}

function auditStatement(env, keeperPieceId, action, outcome, createdAt) {
  return env.DB.prepare(
    `INSERT INTO ownership_code_audit
       (id, keeper_piece_id, action, request_id, outcome, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  ).bind(
    crypto.randomUUID(),
    keeperPieceId,
    action,
    crypto.randomUUID(),
    outcome,
    createdAt,
  );
}

async function mutateWithAudit(env, mutation, keeperPieceId, action, outcome, createdAt) {
  const audit = auditStatement(env, keeperPieceId, action, outcome, createdAt);
  if (typeof env.DB.batch !== 'function') {
    throw new Error('atomic write unavailable');
  }
  const lineage = await prepareNextLineageEvent(env, {
    keeperPieceId,
    eventType: action.replace('fulfillment_', 'fulfillment_'),
    eventAt: createdAt,
    publicPayload: {},
    onlyIfPreviousChanged: true,
  });
  const [result] = await env.DB.batch([mutation, lineage.statement, audit]);
  return result;
}
