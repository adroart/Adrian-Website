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
  it('exposes the five registry stages in order', () => {
    assert.deepEqual(
      PLATE_WIZARD_STAGES.map((stage) => stage.key),
      ['issue', 'fabricate', 'backup', 'recovery', 'activate'],
    );
    // Indices are stable and match the array position.
    assert.equal(plateWizardStageIndex('issue'), 0);
    assert.equal(plateWizardStageIndex('activate'), 4);
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

  it('treats an active plate as terminal', () => {
    assert.equal(
      plateWizardStageForPiece({ plateStatus: 'active', backupStatus: 'verified' }),
      null,
    );
  });

  it('does not offer a legacy row to the wizard', () => {
    assert.equal(
      plateWizardStageForPiece({ plateStatus: 'legacy', backupStatus: null }),
      null,
    );
  });
});

describe('plate wizard component wiring', () => {
  const wizard = source('components/AdminPlateWizard.tsx');

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

  it('restarts after completion and automatically completes an already-active plate', () => {
    assert.match(
      wizard,
      /const beginNewPiece[\s\S]*?setFinished\(false\);[\s\S]*?setStarted\(true\);/,
    );
    assert.match(
      wizard,
      /useEffect\(\(\) => \{\s*if \(!started \|\| finished \|\| stage\.key !== 'activate' \|\| piece\?\.plateStatus !== 'active'\) return;\s*resetSensitive\(\);\s*setStepNote\([\s\S]*?\);\s*setFinished\(true\);\s*\}, \[/,
    );
    assert.doesNotMatch(wizard, /Plate is active and permanently locked\. You can continue\./);
  });

  it('re-locks the flow when the registry unlock expires mid-run', () => {
    assert.match(wizard, /message === 'registry_locked'/);
    assert.match(wizard, /setRegistryUnlocked\(false\)/);
  });

  it('uses explicit edition identity for draft creation and issuance', () => {
    assert.match(wizard, />Unique</);
    assert.match(wizard, />Numbered</);
    assert.match(wizard, /This is a unique, non-numbered work/);
    assert.match(wizard, /editionKind:\s*newPieceEditionKind/);
    assert.match(wizard, /uniqueConfirmed:\s*newPieceUniqueConfirmed/);
    assert.match(wizard, /editionKind:\s*selectedEditionKind/);
    assert.match(wizard, /editionNumber:\s*selectedEditionKind === 'unique' \? 0 : parsedEdition/);
    assert.doesNotMatch(wizard, /issueEdition\.trim\(\) \? Number\(issueEdition\) : 0/);
    assert.doesNotMatch(wizard, /unique if blank|Edition 0 means/);
    assert.match(wizard, /const saveEditionStructure/);
    assert.match(wizard, /editionSize:/);
    assert.match(wizard, /Save edition structure/);
    assert.doesNotMatch(wizard, /selectedArtwork\?\.editionSize \|\| 9999/);
  });

  it('clears issuance details when draft creation selects the new artwork', () => {
    const selection = wizard.slice(
      wizard.indexOf('setIssueArtwork(data.artwork.id)'),
      wizard.indexOf("setNewPieceId('')", wizard.indexOf('setIssueArtwork(data.artwork.id)')),
    );
    assert.match(selection, /setIssueEdition\(''\)/);
    assert.match(selection, /setIssueUniqueConfirmed\(false\)/);
  });

  it('locks identity controls after an issuance attempt until explicit restart', () => {
    assert.match(wizard, /disabled=\{Boolean\(busy \|\| issuanceKey\)\}/);
    assert.match(wizard, /Start over with a different identity/);
    assert.match(wizard, /const startIssuanceOver[\s\S]*?setIssuanceKey\(null\)/);
  });

  it('does not race draft or overlay completion against issuance identity', () => {
    assert.match(wizard, /disabled=\{Boolean\(busy \|\| addPieceBusy/);
    assert.match(wizard, /issuanceKeyRef\.current/);
    assert.match(wizard, /if \(issuanceKeyRef\.current\)[\s\S]*?return;/);
  });
});
