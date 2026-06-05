const PAYMENT_METHODS = new Set(['wise', 'crypto', 'bank', 'payment_link', 'paypal', 'custom']);
const INVOICE_STATUSES = new Set(['draft', 'sent', 'paid', 'void']);

function cleanString(value, max = 2000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function cleanCurrency(value) {
  const currency = cleanString(value, 8).toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : 'USD';
}

function cleanBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

function cleanInteger(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function cleanCents(value) {
  return Math.max(0, cleanInteger(value, 0));
}

function cleanUrl(value) {
  const url = cleanString(value, 600);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function token() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  }
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function cleanIntegerArray(value) {
  const source = Array.isArray(value) ? value : parseJsonArray(value);
  return [...new Set(source
    .map(item => cleanInteger(item, null))
    .filter(item => Number.isInteger(item) && item > 0))]
    .slice(0, 8);
}

function toIso(unixSeconds) {
  const n = Number(unixSeconds);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
}

export function normalizePaymentPresetInput(input = {}) {
  const method = cleanString(input.method, 40);
  return {
    label: cleanString(input.label, 120),
    method: PAYMENT_METHODS.has(method) ? method : 'custom',
    currency: cleanCurrency(input.currency),
    instructions: cleanString(input.instructions, 1200),
    details: cleanString(input.details, 2000),
    url: cleanUrl(input.url),
    isDefault: cleanBoolean(input.isDefault),
    isActive: cleanBoolean(input.isActive, true),
  };
}

export function validatePaymentPreset(preset) {
  if (!preset.label) return 'label_required';
  if (!preset.instructions && !preset.details && !preset.url) return 'payment_details_required';
  return null;
}

function normalizeLineItems(items) {
  return (Array.isArray(items) ? items : [])
    .map(item => ({
      description: cleanString(item.description, 300),
      terms: cleanString(item.terms, 120),
      amountCents: cleanCents(item.amountCents),
    }))
    .filter(item => item.description && item.amountCents > 0)
    .slice(0, 20);
}

function normalizeSchedule(items) {
  return (Array.isArray(items) ? items : [])
    .map(item => ({
      label: cleanString(item.label, 160),
      description: cleanString(item.description, 360),
      amountCents: cleanCents(item.amountCents),
      dueTiming: cleanString(item.dueTiming, 180),
    }))
    .filter(item => item.label && item.amountCents > 0)
    .slice(0, 8);
}

export function buildPaymentSnapshot(paymentPreset) {
  if (!paymentPreset) return {};
  return {
    id: paymentPreset.id ?? null,
    label: cleanString(paymentPreset.label, 120),
    method: cleanString(paymentPreset.method, 40) || 'custom',
    currency: cleanCurrency(paymentPreset.currency),
    instructions: cleanString(paymentPreset.instructions, 1200),
    details: cleanString(paymentPreset.details, 2000),
    url: cleanUrl(paymentPreset.url),
  };
}

export function normalizePaymentOptions(paymentPresets = []) {
  const source = Array.isArray(paymentPresets) ? paymentPresets : paymentPresets ? [paymentPresets] : [];
  return source
    .map(buildPaymentSnapshot)
    .filter(option => option.label && (option.instructions || option.details || option.url))
    .slice(0, 8);
}

export function normalizeInvoiceInput(input = {}, paymentPresets = []) {
  const lineItems = normalizeLineItems(input.lineItems);
  const paymentSchedule = normalizeSchedule(input.paymentSchedule);
  const paymentOptions = normalizePaymentOptions(paymentPresets);
  const paymentPresetIds = paymentOptions
    .map(option => cleanInteger(option.id, null))
    .filter(id => Number.isInteger(id) && id > 0);
  const fallbackPresetIds = cleanIntegerArray(input.paymentPresetIds);
  const primaryPresetId = cleanInteger(input.paymentPresetId, null) || paymentPresetIds[0] || fallbackPresetIds[0] || null;
  const currentStepIndex = Math.min(
    Math.max(0, cleanInteger(input.currentStepIndex, 0)),
    Math.max(0, paymentSchedule.length - 1),
  );
  const subtotalCents = lineItems.reduce((sum, item) => sum + item.amountCents, 0);
  const totalCents = cleanCents(input.totalCents || subtotalCents);
  const currentStep = paymentSchedule[currentStepIndex] || null;
  const dueTodayCents = cleanCents(input.dueTodayCents || currentStep?.amountCents || totalCents);
  const status = cleanString(input.status, 40);

  return {
    invoiceNumber: cleanString(input.invoiceNumber, 80),
    publicToken: cleanString(input.publicToken, 80) || token(),
    status: INVOICE_STATUSES.has(status) ? status : 'draft',
    clientName: cleanString(input.clientName, 160),
    clientEmail: cleanString(input.clientEmail, 240),
    clientLocation: cleanString(input.clientLocation, 240),
    jobTitle: cleanString(input.jobTitle, 180),
    jobDescription: cleanString(input.jobDescription, 2000),
    currency: cleanCurrency(input.currency),
    lineItems,
    paymentSchedule,
    currentStepIndex,
    currentStep,
    subtotalCents,
    shippingText: cleanString(input.shippingText, 180) || 'To be confirmed',
    totalCents,
    dueTodayCents,
    paymentPresetId: primaryPresetId,
    paymentPresetIds: paymentPresetIds.length ? paymentPresetIds : fallbackPresetIds,
    paymentSnapshot: paymentOptions[0] || {},
    paymentOptions,
    notes: cleanString(input.notes, 2000),
  };
}

export function validateInvoice(invoice) {
  if (!invoice.invoiceNumber) return 'invoice_number_required';
  if (!invoice.clientName) return 'client_name_required';
  if (!invoice.jobTitle) return 'job_title_required';
  if (!invoice.jobDescription) return 'job_description_required';
  if (invoice.lineItems.length === 0) return 'line_items_required';
  if (invoice.paymentSchedule.length === 0) return 'payment_schedule_required';
  if (invoice.paymentOptions.length === 0) return 'payment_options_required';
  if (invoice.dueTodayCents <= 0) return 'due_today_required';
  return null;
}

export function generateInvoiceNumber(previousInvoiceNumber, now = new Date()) {
  const year = String(now.getUTCFullYear());
  const match = /^AR-(\d{4})-(\d{3,})$/.exec(previousInvoiceNumber || '');
  const next = match && match[1] === year ? Number(match[2]) + 1 : 1;
  return `AR-${year}-${String(next).padStart(3, '0')}`;
}

export function serializePaymentPresetRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    method: row.method,
    currency: row.currency,
    instructions: row.instructions,
    details: row.details,
    url: row.url,
    isDefault: Boolean(row.is_default),
    isActive: Boolean(row.is_active),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function serializeInvoiceRow(row) {
  if (!row) return null;
  const paymentSnapshot = parseJsonObject(row.payment_snapshot_json);
  const paymentOptions = parseJsonArray(row.payment_options_json);
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    publicToken: row.public_token,
    publicUrlPath: `/invoice/${row.public_token}`,
    status: row.status,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientLocation: row.client_location,
    jobTitle: row.job_title,
    jobDescription: row.job_description,
    currency: row.currency,
    lineItems: parseJsonArray(row.line_items_json),
    paymentSchedule: parseJsonArray(row.payment_schedule_json),
    currentStepIndex: row.current_step_index,
    subtotalCents: row.subtotal_cents,
    shippingText: row.shipping_text,
    totalCents: row.total_cents,
    dueTodayCents: row.due_today_cents,
    paymentPresetId: row.payment_preset_id,
    paymentPresetIds: parseJsonArray(row.payment_preset_ids_json),
    paymentSnapshot,
    paymentOptions: paymentOptions.length ? paymentOptions : Object.keys(paymentSnapshot).length ? [paymentSnapshot] : [],
    notes: row.notes || '',
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    sentAt: toIso(row.sent_at),
    paidAt: toIso(row.paid_at),
  };
}
