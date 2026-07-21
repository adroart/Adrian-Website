import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  PLATE_WIZARD_STAGES,
  plateWizardStageForPiece,
  plateWizardStageIndex,
} from '../utils/plateWizard.ts';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('plate wizard stage logic', () => {
  it('exposes the seven runbook stages in order', () => {
    assert.deepEqual(
      PLATE_WIZARD_STAGES.map((stage) => stage.key),
      ['issue', 'fabricate', 'backup', 'recovery', 'activate', 'assign', 'ship'],
    );
    // Indices are stable and match the array position.
    assert.equal(plateWizardStageIndex('issue'), 0);
    assert.equal(plateWizardStageIndex('ship'), 6);
    assert.equal(plateWizardStageIndex('activate'), 4);
  });

  it('resumes a generated plate at backup until the backup verifies', () => {
    assert.equal(
      plateWizardStageForPiece({ plateStatus: 'generated', backupStatus: 'pending', hasFulfillment: false, shipped: false }),
      'backup',
    );
    assert.equal(
      plateWizardStageForPiece({ plateStatus: 'generated', backupStatus: 'failed', hasFulfillment: false, shipped: false }),
      'backup',
    );
    assert.equal(
      plateWizardStageForPiece({ plateStatus: 'generated', backupStatus: 'verified', hasFulfillment: false, shipped: false }),
      'fabricate',
    );
  });

  it('routes an active plate through assign then ship, and retires a shipped piece', () => {
    assert.equal(
      plateWizardStageForPiece({ plateStatus: 'active', backupStatus: 'verified', hasFulfillment: false, shipped: false }),
      'assign',
    );
    assert.equal(
      plateWizardStageForPiece({ plateStatus: 'active', backupStatus: 'verified', hasFulfillment: true, shipped: false }),
      'ship',
    );
    assert.equal(
      plateWizardStageForPiece({ plateStatus: 'active', backupStatus: 'verified', hasFulfillment: true, shipped: true }),
      null,
    );
  });

  it('does not offer a legacy row to the wizard', () => {
    assert.equal(
      plateWizardStageForPiece({ plateStatus: 'legacy', backupStatus: null, hasFulfillment: false, shipped: false }),
      null,
    );
  });
});

describe('plate wizard component wiring', () => {
  const wizard = source('components/AdminPlateWizard.tsx');

  it('drives only the existing admin endpoints and adds no new server surface', () => {
    for (const endpoint of [
      '/api/admin/registry-unlock',
      '/api/admin/pieces',
      '/api/admin/piece-fulfillments',
    ]) {
      assert.ok(wizard.includes(endpoint), `expected wizard to call ${endpoint}`);
    }
    // Per-piece lifecycle actions are reached by interpolating the piece id.
    assert.match(wizard, /\/api\/admin\/pieces\/\$\{encodeURIComponent\(piece\.id\)\}\/\$\{action\}/);
    assert.match(wizard, /\/api\/admin\/pieces\/\$\{encodeURIComponent\(piece\.id\)\}\/activate/);
  });

  it('never persists the registry secret or sensitive plate material to the browser', () => {
    assert.match(wizard, /JSON\.stringify\(\{ secret:/);
    assert.doesNotMatch(wizard, /localStorage|sessionStorage/);
    // The secret input is cleared immediately after read.
    assert.match(wizard, /input\.value = '';/);
    // Sensitive state is wiped on unmount.
    assert.match(wizard, /useEffect\(\(\) => \(\) => resetSensitive\(\), \[resetSensitive\]\)/);
  });

  it('gates each stage on its safeguard before advancing', () => {
    // Cannot leave backup until it is verified.
    assert.match(wizard, /case 'backup':\s*\n\s*return piece\?\.backupStatus === 'verified';/);
    // Cannot leave activate until the plate is actually locked active.
    assert.match(wizard, /case 'activate':\s*\n\s*return piece\?\.plateStatus === 'active';/);
    // Ship is terminal; advancing past it is not possible — the ship action finishes.
    assert.match(wizard, /case 'ship':\s*\n\s*return false;/);
  });

  it('re-locks the flow when the registry unlock expires mid-run', () => {
    assert.match(wizard, /message === 'registry_locked'/);
    assert.match(wizard, /setRegistryUnlocked\(false\)/);
  });
});
