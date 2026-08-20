import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

describe('collector phase two journey integration', () => {
  it('offers the real dream after registration instead of the old placeholder', () => {
    const flow = source('components/collector/legacy/CollectorFlow.tsx');
    assert.match(flow, /import DreamScreen from ['"]\.\/DreamScreen['"]/);
    assert.match(flow, /<DreamScreen[\s\S]*?keeperPieceId=\{keeperPieceId\}/);
    assert.match(flow, /onComplete=\{\(\) => setStage\(['"]complete['"]\)\}/);
    assert.match(flow, /CertificateScreen[\s\S]*?onComplete=\{\(\) => setStage\(['"]dream['"]\)\}/);
    assert.doesNotMatch(flow, /This door opens next|Dreams will arrive in the next phase/);
  });

  it('gives a current keeper one private home for the dream and yearly return', () => {
    const life = source('components/collector/legacy/CollectorLife.tsx');
    const panel = source('components/legacy/KeeperPanel.tsx');
    assert.match(life, /DreamScreen/);
    assert.match(life, /YearlyRitualScreen/);
    assert.match(life, /PieceLetters/);
    assert.match(life, /fetchCollectorLetters/);
    assert.match(life, />\s*Dream\s*</);
    assert.match(life, />\s*Yearly return\s*</);
    assert.match(life, />\s*Letters\s*</);
    assert.match(panel, /<CollectorLife keeperPieceId=\{currentStatus\.keeperPieceId\}/);
  });

  it('mounts public dreams only inside the verified living record', () => {
    const works = source('components/WorksPage.tsx');
    assert.match(works, /import PublicDream from ['"]\.\/collector\/legacy\/PublicDream['"]/);
    assert.match(works, /legacyOn && identity[\s\S]*?<PublicDream publicCode=\{identity\.publicCode\}/);
  });
});
