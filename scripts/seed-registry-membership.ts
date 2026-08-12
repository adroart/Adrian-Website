import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { FULL_ARCHIVE } from '../data/mockData.ts';
import {
  applyCatalogMembership,
  planCatalogMembership,
} from '../functions/api/_lib/registryMembership.js';

type Prepared = {
  sql: string;
  values: SQLInputValue[];
  bind: (...values: SQLInputValue[]) => Prepared;
  all: () => { results: unknown[] };
};

function localD1(database: DatabaseSync) {
  return {
    prepare(sql: string): Prepared {
      let values: SQLInputValue[] = [];
      const statement: Prepared = {
        sql,
        values,
        bind(...bound: SQLInputValue[]) {
          values = bound;
          statement.values = values;
          return statement;
        },
        all() {
          return { results: database.prepare(sql).all(...values) };
        },
      };
      return statement;
    },
    batch(statements: Prepared[]) {
      database.exec('BEGIN IMMEDIATE;');
      try {
        const results = statements.map((statement) => {
          const result = database.prepare(statement.sql).run(...statement.values);
          return { success: true, meta: { changes: Number(result.changes) } };
        });
        database.exec('COMMIT;');
        return results;
      } catch (error) {
        database.exec('ROLLBACK;');
        throw error;
      }
    },
  };
}

function directRun() {
  return Boolean(process.argv[1])
    && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (directRun()) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const positional = args.filter((arg) => arg !== '--write');
  const unknownFlag = args.find((arg) => arg.startsWith('--') && arg !== '--write');
  if (unknownFlag || positional.length !== 1) {
    console.error('Usage: seed-registry-membership <registry-copy.sqlite> [--write]');
    process.exitCode = 2;
  } else {
    const database = new DatabaseSync(positional[0], { readOnly: !write });
    try {
      const env = { DB: localD1(database) };
      const plan = await planCatalogMembership(env, FULL_ARCHIVE);
      if (plan.conflicts.length) {
        console.error(JSON.stringify({
          ok: false,
          mode: write ? 'write' : 'dry-run',
          catalogCount: plan.catalogCount,
          inserts: plan.inserts.length,
          unchanged: plan.unchanged.length,
          conflicts: plan.conflicts,
        }));
        process.exitCode = 1;
      } else if (!write) {
        console.log(JSON.stringify({
          ok: true,
          mode: 'dry-run',
          catalogCount: plan.catalogCount,
          inserts: plan.inserts.length,
          unchanged: plan.unchanged.length,
          conflicts: 0,
        }));
      } else {
        const result = await applyCatalogMembership(env, plan);
        console.log(JSON.stringify({ ok: true, mode: 'write', ...result }));
      }
    } finally {
      database.close();
    }
  }
}
