/**
 * Pure helpers for the Succession desk (components/admin/Succession.tsx,
 * functions/api/admin/succession.js). Kept separate from both so the
 * sanitizing and splicing logic can be tested without a DOM or a Worker
 * runtime.
 */

export type SuccessionFields = {
  passkeySealedAt: string;
  passkeySecondCopyAt: string;
  familyContact: string;
  technicalHelper: string;
};

export const emptySuccessionFields: SuccessionFields = {
  passkeySealedAt: '',
  passkeySecondCopyAt: '',
  familyContact: '',
  technicalHelper: '',
};

const MAX_FIELD_LENGTH = 500;

/** Trim and cap one field. Never throws; unusable input becomes ''. */
export function sanitizeSuccessionField(value: unknown): string {
  if (typeof value !== 'string') return '';
  // Collapse to a single line: these are handwriting-style facts (a place, a
  // name), not free text, and the handbook line they fill is one line long.
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed.slice(0, MAX_FIELD_LENGTH);
}

export function sanitizeSuccessionFields(input: Record<string, unknown> | null | undefined): SuccessionFields {
  const source = input ?? {};
  return {
    passkeySealedAt: sanitizeSuccessionField(source.passkeySealedAt),
    passkeySecondCopyAt: sanitizeSuccessionField(source.passkeySecondCopyAt),
    familyContact: sanitizeSuccessionField(source.familyContact),
    technicalHelper: sanitizeSuccessionField(source.technicalHelper),
  };
}

/**
 * The handbook's own blank lines, matched exactly against the markdown
 * source in functions/api/_lib/successorHandbook.js (generated from
 * docs/registry-custodian-guide.md). If that guide's wording ever changes,
 * these patterns simply stop matching and fillHandbookBlanks leaves the
 * source untouched -- it never guesses at a rewritten line.
 */
const BLANK_RULES: Array<{ pattern: RegExp; label: string; key: keyof SuccessionFields }> = [
  { pattern: /Written and sealed at: _+/, label: 'Written and sealed at', key: 'passkeySealedAt' },
  { pattern: /A second sealed copy at: _+/, label: 'A second sealed copy at', key: 'passkeySecondCopyAt' },
  { pattern: /Family contact for the registry: _+/, label: 'Family contact for the registry', key: 'familyContact' },
  { pattern: /Technical helper who knows this system: _+/, label: 'Technical helper who knows this system', key: 'technicalHelper' },
];

/**
 * Splice Adrian's saved answers into the handbook's blank lines, without
 * touching functions/api/_lib/successorHandbook.js's HANDBOOK_SOURCE on disk
 * (that constant stays the generated mirror of docs/registry-custodian-guide.md,
 * checked byte-for-byte by tests/successor-handbook.test.ts). This returns a
 * new string; an empty field leaves its original blank line exactly as
 * written, so the rendered handbook still visibly asks for whatever is
 * missing rather than silently going quiet about it.
 */
export function fillHandbookBlanks(source: string, fields: SuccessionFields): string {
  return BLANK_RULES.reduce((text, rule) => {
    const value = fields[rule.key];
    if (!value) return text;
    return text.replace(rule.pattern, `${rule.label}: ${value}`);
  }, source);
}

/** Whether every one of the three blanks (four fields) has been filled. */
export function successionFieldsComplete(fields: SuccessionFields): boolean {
  return Boolean(
    fields.passkeySealedAt && fields.passkeySecondCopyAt
    && fields.familyContact && fields.technicalHelper,
  );
}

export type SuccessionReadiness = 'locked' | 'unconfigured' | 'ready';

/**
 * The three states the page renders, named in the spec: not unlocked,
 * unlocked but not configured (the encrypted archive's keys are missing),
 * and ready.
 */
export function successionReadiness(
  unlocked: boolean,
  recoveryExportConfigured: boolean,
): SuccessionReadiness {
  if (!unlocked) return 'locked';
  if (!recoveryExportConfigured) return 'unconfigured';
  return 'ready';
}
