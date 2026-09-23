import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readR2JsonIndex, updateR2JsonIndex } from '../functions/api/_lib/r2JsonIndex.js';
import { onRequestGet as bookGet } from '../functions/api/book.js';

function bucket(initial: string | null) {
  let text = initial; let version = initial === null ? 0 : 1; let writes = 0;
  return {
    async get() { const snapshot = text; const etag = String(version); return snapshot === null ? null : { etag, text: async () => snapshot }; },
    async put(_key: string, value: string, options: any) {
      writes++;
      if (options.onlyIf.etagDoesNotMatch === '*' ? text !== null : options.onlyIf.etagMatches !== String(version)) return null;
      text = value; version++; return { etag: String(version) };
    },
    state() { return { text, version, writes }; },
  };
}
describe('R2 content index failure boundaries', () => {
  it('merges independent concurrent edits without losing an entry', async () => {
    const store = bucket('[{"id":"existing"}]');
    await Promise.all(['one','two'].map(id => updateR2JsonIndex(store,'index',entries => [...entries,{id}])));
    assert.deepEqual((await readR2JsonIndex(store,'index')).entries.map(x=>x.id).sort(), ['existing','one','two']);
    assert.equal(store.state().version,3);
  });
  it('conditionally creates a missing index under concurrent writes', async () => {
    const store=bucket(null);
    await Promise.all(['one','two'].map(id=>updateR2JsonIndex(store,'index',entries=>[...entries,{id}])));
    assert.equal((await readR2JsonIndex(store,'index')).entries.length,2);
  });
  it('does not overwrite corrupt JSON or a non-array document', async () => {
    for(const text of ['broken','{"id":"surviving"}']){
      const store=bucket(text);
      await assert.rejects(updateR2JsonIndex(store,'index',()=>[]),/index_corrupt/);
      assert.deepEqual(store.state(),{text,version:1,writes:0});
      const response=await bookGet({env:{MUSIC_BUCKET:store},request:new Request('https://example.test/api/book')});
      assert.equal(response.status,503);
      assert.equal((await response.json()).error,'index_corrupt');
    }
  });
  it('bounds contention rather than claiming an unsuccessful save',async()=>{
    const store=bucket('[]');let puts=0;store.put=async()=>{puts++;return null;};
    await assert.rejects(updateR2JsonIndex(store,'index',entries=>entries),/index_conflict/);
    assert.equal(puts,3);
  });
});
