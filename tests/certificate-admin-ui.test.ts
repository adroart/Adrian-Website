import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, it, mock } from 'node:test';

import {
  buildAssignmentRequest,
  buildOverrideRequest,
  certificateAdminApi,
  overrideEditorDraft,
  projectEffectiveCertificate,
} from '../utils/certificateContent';

describe('certificate editor contracts', () => {
  afterEach(() => mock.restoreAll());
  it('normalizes selected artworks and keeps retry identity stable', () => {
    assert.deepEqual(buildAssignmentRequest({
      templateId: 'template-one',
      artworkIds: ['SIG-101', 'SIG-100', 'SIG-101'],
      idempotencyKey: 'assignment-retry',
    }), {
      templateId: 'template-one',
      artworkIds: ['SIG-100', 'SIG-101'],
      idempotencyKey: 'assignment-retry',
    });
  });

  it('builds exact per-field optimistic override requests', () => {
    assert.deepEqual(buildOverrideRequest({
      artworkId: 'SIG-100', field: 'materials',
      override: { mode: 'override', value: ['Birch', 'Pigment'] }, expectedVersion: 4,
    }), {
      artworkId: 'SIG-100', field: 'materials',
      override: { mode: 'override', value: ['Birch', 'Pigment'] }, expectedVersion: 4,
    });
  });

  it('projects only effective public values and omits editor metadata', () => {
    assert.deepEqual(projectEffectiveCertificate({
      effective: { origin: 'Bali', materials: [], openingWording: '  Welcome.  ' },
      templateId: 'private-template', version: 8, modes: { origin: 'inherit' }, history: ['private'],
    }), { origin: 'Bali', openingWording: 'Welcome.' });
  });

  it('loads an authenticated artwork editing state and hydrates each field version and value', async () => {
    const requests: string[] = [];
    mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
      requests.push(String(input));
      return new Response(JSON.stringify({
        ok: true,
        state: {
          artworkId: 'SIG-100',
          assignment: { templateId: 'template-one', version: 3 },
          overrides: {
            origin: { mode: 'override', value: 'Bali', version: 4 },
            materials: { mode: 'suppress', version: 2 },
          },
          effective: { origin: 'Bali', openingWording: 'Welcome.' },
        },
      }), { status: 200 });
    });

    const state = await certificateAdminApi.getArtworkState('SIG-100');
    assert.equal(requests[0], '/api/admin/certificate-overrides?artworkId=SIG-100');
    assert.deepEqual(overrideEditorDraft(state, 'origin'), {
      mode: 'override', value: 'Bali', version: 4,
    });
    assert.deepEqual(overrideEditorDraft(state, 'materials'), {
      mode: 'suppress', value: '', version: 2,
    });
    assert.deepEqual(overrideEditorDraft(state, 'techniques'), {
      mode: 'inherit', value: '', version: 0,
    });
  });

  it('offers creation, bulk selection, all override modes, and effective preview', () => {
    const source = readFileSync(
      new URL('../components/admin/CertificateEditor.tsx', import.meta.url), 'utf8',
    );
    for (const phrase of [
      'Create template', 'Assign to selected artwork', 'Inherit', 'Override', 'Suppress',
      'Effective preview', 'Materials', 'Makers and roles', 'Origin', 'Techniques',
      'Certificate wording', 'Opening wording',
      'getArtworkState', 'artworkState.effective',
    ]) assert.match(source, new RegExp(phrase));
    assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
  });
});
