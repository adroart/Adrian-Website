import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CUSTODY_ENVELOPE_MIN_ITERATIONS,
  CUSTODY_ENVELOPE_SCHEMA,
  CUSTODY_ENVELOPE_SCHEMA_VERSION,
  buildCustodyEnvelope,
  openCustodyEnvelope,
  type CustodyEnvelope,
  type CustodyKeys,
} from '../utils/custodyEnvelope';

const PASSPHRASE = 'correct battery horse staple lantern kiln';
const RECOVERY_KEY_B64 = Buffer.alloc(32, 7).toString('base64');
const OWNERSHIP_V1_B64 = Buffer.alloc(32, 9).toString('base64');
const OWNERSHIP_V2_B64 = Buffer.alloc(32, 11).toString('base64');

function fixtureKeys(): CustodyKeys {
  return {
    registryRecoveryExportKeyB64: RECOVERY_KEY_B64,
    registryRecoveryExportKeyId: 'recovery-key-2026',
    ownershipCodeKeys: [
      { version: 2, keyB64: OWNERSHIP_V2_B64 },
      { version: 1, keyB64: OWNERSHIP_V1_B64 },
    ],
    notes: 'Escrowed for succession.',
  };
}

describe('custody envelope', () => {
  it('round-trips the key material under one passphrase', async () => {
    const envelope = await buildCustodyEnvelope({
      passphrase: PASSPHRASE,
      keys: fixtureKeys(),
      createdAt: '2026-08-19T00:00:00.000Z',
    });
    assert.equal(envelope.schema, CUSTODY_ENVELOPE_SCHEMA);
    assert.equal(envelope.schemaVersion, CUSTODY_ENVELOPE_SCHEMA_VERSION);
    assert.equal(envelope.kdf.name, 'PBKDF2-SHA-256');
    assert.equal(envelope.kdf.iterations, CUSTODY_ENVELOPE_MIN_ITERATIONS);
    assert.equal(envelope.createdAt, '2026-08-19T00:00:00.000Z');
    assert.equal(Buffer.from(envelope.kdf.saltB64, 'base64').byteLength, 16);
    assert.equal(Buffer.from(envelope.nonceB64, 'base64').byteLength, 12);

    const opened = await openCustodyEnvelope({ passphrase: PASSPHRASE, envelope });
    assert.deepEqual(opened, {
      registryRecoveryExportKeyB64: RECOVERY_KEY_B64,
      registryRecoveryExportKeyId: 'recovery-key-2026',
      // Ownership keys come back sorted by version.
      ownershipCodeKeys: [
        { version: 1, keyB64: OWNERSHIP_V1_B64 },
        { version: 2, keyB64: OWNERSHIP_V2_B64 },
      ],
      notes: 'Escrowed for succession.',
    });
  });

  it('fails generically on a wrong passphrase, with no oracle detail', async () => {
    const envelope = await buildCustodyEnvelope({
      passphrase: PASSPHRASE, keys: fixtureKeys(),
    });
    await assert.rejects(
      openCustodyEnvelope({ passphrase: 'wrong passphrase entirely here', envelope }),
      (error: Error) => error.message === 'custody_envelope_cannot_open',
    );
  });

  it('fails on tampered ciphertext with the exact same generic error', async () => {
    const envelope = await buildCustodyEnvelope({
      passphrase: PASSPHRASE, keys: fixtureKeys(),
    });
    const ciphertext = Buffer.from(envelope.ciphertextB64, 'base64');
    ciphertext[0] ^= 0xff;
    const tampered = { ...envelope, ciphertextB64: ciphertext.toString('base64') };

    let wrongPassphraseError: Error | null = null;
    let tamperError: Error | null = null;
    await openCustodyEnvelope({ passphrase: 'wrong passphrase entirely here', envelope })
      .catch((error: Error) => { wrongPassphraseError = error; });
    await openCustodyEnvelope({ passphrase: PASSPHRASE, envelope: tampered })
      .catch((error: Error) => { tamperError = error; });
    assert.ok(wrongPassphraseError && tamperError);
    assert.equal(wrongPassphraseError!.message, tamperError!.message);
    assert.equal(tamperError!.message, 'custody_envelope_cannot_open');
  });

  it('fails when the authenticated header is tampered with', async () => {
    const envelope = await buildCustodyEnvelope({
      passphrase: PASSPHRASE, keys: fixtureKeys(), createdAt: '2026-08-19T00:00:00.000Z',
    });
    const redated = { ...envelope, createdAt: '2027-01-01T00:00:00.000Z' };
    await assert.rejects(
      openCustodyEnvelope({ passphrase: PASSPHRASE, envelope: redated }),
      /custody_envelope_cannot_open/,
    );
  });

  it('carries no key material in the envelope plaintext', async () => {
    const keys = fixtureKeys();
    const envelope = await buildCustodyEnvelope({ passphrase: PASSPHRASE, keys });
    const serialized = JSON.stringify(envelope);
    assert.ok(!serialized.includes(keys.registryRecoveryExportKeyB64));
    assert.ok(!serialized.includes(keys.registryRecoveryExportKeyId));
    for (const entry of keys.ownershipCodeKeys ?? []) {
      assert.ok(!serialized.includes(entry.keyB64));
    }
    assert.ok(!serialized.includes('Escrowed'));
    // Only the declared fields exist, nothing extra.
    assert.deepEqual(Object.keys(envelope).sort(), [
      'ciphertextB64', 'createdAt', 'kdf', 'nonceB64', 'schema', 'schemaVersion',
    ]);
    assert.deepEqual(Object.keys(envelope.kdf).sort(), ['iterations', 'name', 'saltB64']);
  });

  it('enforces the iterations floor on build and on open', async () => {
    await assert.rejects(
      buildCustodyEnvelope({
        passphrase: PASSPHRASE, keys: fixtureKeys(), iterations: 100000,
      }),
      /custody_iterations_too_low/,
    );
    const envelope = await buildCustodyEnvelope({
      passphrase: PASSPHRASE, keys: fixtureKeys(),
    });
    const downgraded: CustodyEnvelope = {
      ...envelope,
      kdf: { ...envelope.kdf, iterations: 1000 },
    };
    await assert.rejects(
      openCustodyEnvelope({ passphrase: PASSPHRASE, envelope: downgraded }),
      /custody_iterations_too_low/,
    );
  });

  it('refuses weak passphrases and malformed key material on build', async () => {
    await assert.rejects(
      buildCustodyEnvelope({ passphrase: 'short', keys: fixtureKeys() }),
      /custody_passphrase_too_short/,
    );
    await assert.rejects(
      buildCustodyEnvelope({
        passphrase: PASSPHRASE,
        keys: { ...fixtureKeys(), registryRecoveryExportKeyB64: 'not-a-key' },
      }),
      /custody_recovery_key_invalid/,
    );
    await assert.rejects(
      buildCustodyEnvelope({
        passphrase: PASSPHRASE,
        keys: {
          ...fixtureKeys(),
          ownershipCodeKeys: [
            { version: 1, keyB64: OWNERSHIP_V1_B64 },
            { version: 1, keyB64: OWNERSHIP_V2_B64 },
          ],
        },
      }),
      /custody_ownership_key_version_invalid/,
    );
  });

  it('refuses envelopes with a wrong or reshaped frame', async () => {
    const envelope = await buildCustodyEnvelope({
      passphrase: PASSPHRASE, keys: fixtureKeys(),
    });
    await assert.rejects(
      openCustodyEnvelope({
        passphrase: PASSPHRASE,
        envelope: { ...envelope, schema: 'something-else' },
      }),
      /custody_envelope_unsupported/,
    );
    const { ciphertextB64, ...withoutCiphertext } = envelope;
    await assert.rejects(
      openCustodyEnvelope({ passphrase: PASSPHRASE, envelope: withoutCiphertext }),
      /custody_envelope_shape/,
    );
    await assert.rejects(
      openCustodyEnvelope({
        passphrase: PASSPHRASE,
        envelope: { ...envelope, extra: true },
      }),
      /custody_envelope_shape/,
    );
  });
});
