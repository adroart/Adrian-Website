import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildAtlasSourceImportSql } from '../utils/atlasSourceImport.ts';

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const inputPath = argument('--input');
const sourceReference = argument('--source-reference');
if (!inputPath || !sourceReference) {
  process.stderr.write(
    'Usage: npm run atlas:import-source -- --input <verified-export.json> '
    + '--source-reference <https-url>\n',
  );
  process.exitCode = 1;
} else {
  try {
    const parsed = JSON.parse(readFileSync(resolve(inputPath), 'utf8'));
    const sql = await buildAtlasSourceImportSql({
      events: parsed.events,
      cities: parsed.cities,
      sourceReference,
    });
    process.stdout.write(sql);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'atlas_source_import_failed'}\n`);
    process.exitCode = 1;
  }
}
