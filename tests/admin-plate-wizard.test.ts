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
  it('exposes the four fabrication-only stages in order, with no registration stage', () => {
    assert.deepEqual(
      PLATE_WIZARD_STAGES.map((stage) => stage.key),
      ['fabricate', 'backup', 'recovery', 'activate'],
    );
    // Indices are stable and match the array position.
    assert.equal(plateWizardStageIndex('fabricate'), 0);
    assert.equal(plateWizardStageIndex('activate'), 3);
  });

  it('starts a registered identity with no plate yet at fabricate', () => {
    assert.equal(
      plateWizardStageForPiece({ plateStatus: 'legacy', backupStatus: null, registered: true }),
      'fabricate',
    );
  });

  it('resumes a generated plate at backup until the backup verifies', () => {
    assert.equal(
      plateWizardStageForPiece({ plateStatus: 'generated', backupStatus: 'pending' }),
      'backup',
    );
    assert.equal(
      plateWizardStageForPiece({ plateStatus: 'generated', backupStatus: 'failed' }),
      'backup',
    );
    assert.equal(
      plateWizardStageForPiece({ plateStatus: 'generated', backupStatus: 'verified' }),
      'fabricate',
    );
  });

  it('reopens recovery for an active plate whose copied-file proof is missing or stale', () => {
    assert.equal(
      plateWizardStageForPiece({
        plateStatus: 'active', backupStatus: 'verified', recoveryQualificationStatus: 'current',
      }),
      null,
    );
    assert.equal(
      plateWizardStageForPiece({
        plateStatus: 'active', backupStatus: 'verified', recoveryQualificationStatus: 'stale',
      }),
      'recovery',
    );
    assert.equal(
      plateWizardStageForPiece({
        plateStatus: 'active', backupStatus: 'verified', recoveryQualificationStatus: 'missing',
      }),
      'recovery',
    );
  });

  it('does not offer an unregistered legacy row to the wizard', () => {
    assert.equal(
      plateWizardStageForPiece({ plateStatus: 'legacy', backupStatus: null }),
      null,
    );
    assert.equal(
      plateWizardStageForPiece({ plateStatus: 'legacy', backupStatus: null, registered: false }),
      null,
    );
  });
});

describe('plate wizard component wiring', () => {
  const wizard = source('components/AdminPlateWizard.tsx');

  it('requires an already-registered identity and has no registration path', () => {
    // Keyed on the same keeperPieceId query param the rest of the admin
    // surface already uses to deep-link into an exact registered identity.
    assert.match(wizard, /keeperPieceId/);
    assert.doesNotMatch(wizard, /Add a new piece/);
    assert.doesNotMatch(wizard, /const createPiece/);
    assert.doesNotMatch(wizard, /const saveEditionStructure/);
    assert.doesNotMatch(wizard, /const runIssue/);
    assert.doesNotMatch(wizard, /const beginNewPiece/);
    assert.doesNotMatch(wizard, /issueArtwork|issuanceKey|beginIssuanceAttempt/);
    assert.doesNotMatch(wizard, /Issue permanent identity/);
    assert.doesNotMatch(wizard, /Mint the permanent public QR code/);
  });

  it('shows a quiet chooser pointing to the registration ceremony when there is no eligible piece', () => {
    assert.match(wizard, /Choose a registered artwork to prepare its plate/);
    assert.match(wizard, /\/admin\/register/);
    assert.match(wizard, /Register an artwork/);
  });

  it('drives only the existing admin endpoints and adds no new server surface', () => {
    for (const endpoint of ['/api/admin/registry-unlock', '/api/admin/pieces']) {
      assert.ok(wizard.includes(endpoint), `expected wizard to call ${endpoint}`);
    }
    assert.doesNotMatch(wizard, /piece-fulfillments/);
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
    // Activate is terminal; the activation action finishes the wizard.
    assert.match(wizard, /case 'activate':\s*\n\s*return false;/);
    assert.match(
      wizard,
      /const runActivate[\s\S]*?await refreshPiece\(\);[\s\S]*?resetSensitive\(\);[\s\S]*?setFinished\(true\)/,
    );
  });

  it('uses only persisted copied-file recovery proof and has no staging bypass', () => {
    assert.doesNotMatch(wizard, /recoveryProven|recoveryStagingAck|Staging only/);
    assert.match(wizard, /type="file"/);
    assert.match(wizard, /backupDocument/);
    assert.match(wizard, /piece\?\.recoveryQualification\?\.status === 'current'/);
    assert.match(wizard, /case 'recovery':\s*\n\s*return piece\?\.recoveryQualification\?\.status === 'current';/);
    assert.match(wizard, /Recovery proof is stale/);
  });

  it('lets the operator choose another registered artwork after completion, with no restart-from-scratch path', () => {
    assert.match(wizard, /const goToChoose[\s\S]*?setStarted\(false\);/);
    assert.match(wizard, /Choose another artwork/);
    assert.doesNotMatch(wizard, /piece\?\.plateStatus !== 'active'/);
    assert.match(wizard, /Activating…/);
    assert.match(wizard, /This active identity was repaired/);
    assert.match(wizard, /Confirm repaired identity/);
    assert.doesNotMatch(wizard, /Completing the registry lifecycle/);
  });

  it('refreshes and returns to recovery when activation discovers stale proof', () => {
    assert.match(wizard, /code === 'recovery_qualification_required' \|\| code === 'activation_conflict'/);
    assert.match(wizard, /await refreshPiece\(\)/);
    assert.match(wizard, /setStageIndex\(plateWizardStageIndex\('recovery'\)\)/);
  });

  it('re-locks the flow when the registry unlock expires mid-run', () => {
    assert.match(wizard, /message === 'registry_locked'/);
    assert.match(wizard, /setRegistryUnlocked\(false\)/);
  });
});
