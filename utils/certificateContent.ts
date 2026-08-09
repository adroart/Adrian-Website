export type CertificateField =
  | 'materials' | 'makers' | 'origin' | 'techniques' | 'yearWording'
  | 'editionWording' | 'certificateWording' | 'openingWording';

export type CertificateMaker = { name: string; role: string };
export type CertificateFieldValue = string | string[] | CertificateMaker[];
export type CertificateOverride =
  | { mode: 'inherit' }
  | { mode: 'override'; value: CertificateFieldValue }
  | { mode: 'suppress' };

export type EffectiveCertificate = {
  materials?: string[];
  makers?: CertificateMaker[];
  origin?: string;
  techniques?: string[];
  yearWording?: string;
  editionWording?: string;
  certificateWording?: string;
  openingWording?: string;
};

export type CertificateStoredOverride = CertificateOverride & { version: number };
export type CertificateArtworkEditorState = {
  artworkId: string;
  assignment: { templateId: string; version: number } | null;
  overrides: Partial<Record<CertificateField, CertificateStoredOverride>>;
  effective: EffectiveCertificate;
};

const fields: CertificateField[] = [
  'materials', 'makers', 'origin', 'techniques', 'yearWording',
  'editionWording', 'certificateWording', 'openingWording',
];

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

export function projectEffectiveCertificate(value: unknown): EffectiveCertificate {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? ((value as Record<string, unknown>).effective ?? value)
    : {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const record = source as Record<string, unknown>;
  const projected: Record<string, unknown> = {};
  for (const field of fields) {
    const candidate = record[field];
    if (field === 'makers' && Array.isArray(candidate)) {
      const makers = candidate.flatMap((maker) => {
        if (!maker || typeof maker !== 'object' || Array.isArray(maker)) return [];
        const name = text((maker as Record<string, unknown>).name);
        const role = text((maker as Record<string, unknown>).role);
        return name && role ? [{ name, role }] : [];
      });
      if (makers.length) projected[field] = makers;
    } else if ((field === 'materials' || field === 'techniques') && Array.isArray(candidate)) {
      const values = candidate.flatMap((item) => text(item) ? [text(item)!] : []);
      if (values.length) projected[field] = values;
    } else {
      const normalized = text(candidate);
      if (normalized) projected[field] = normalized;
    }
  }
  return projected as EffectiveCertificate;
}

export function buildAssignmentRequest(input: {
  templateId: string;
  artworkIds: string[];
  idempotencyKey: string;
}) {
  return {
    templateId: input.templateId.trim(),
    artworkIds: [...new Set(input.artworkIds.map((id) => id.trim()).filter(Boolean))].sort(),
    idempotencyKey: input.idempotencyKey.trim(),
  };
}

export function buildOverrideRequest(input: {
  artworkId: string;
  field: CertificateField;
  override: CertificateOverride;
  expectedVersion: number;
}) {
  return {
    artworkId: input.artworkId.trim(),
    field: input.field,
    override: input.override,
    expectedVersion: input.expectedVersion,
  };
}

function overrideValueText(value: CertificateFieldValue | undefined): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  if (value.every((item) => typeof item === 'string')) return value.join('\n');
  return (value as CertificateMaker[])
    .map((maker) => `${maker.name} | ${maker.role}`)
    .join('\n');
}

export function overrideEditorDraft(
  state: CertificateArtworkEditorState,
  field: CertificateField,
): { mode: CertificateOverride['mode']; value: string; version: number } {
  const stored = state.overrides[field];
  if (!stored) return { mode: 'inherit', value: '', version: 0 };
  return {
    mode: stored.mode,
    value: stored.mode === 'override' ? overrideValueText(stored.value) : '',
    version: stored.version,
  };
}

async function requestJson(path: string, init: RequestInit) {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error || 'certificate_request_failed');
  return body;
}

export const certificateAdminApi = {
  listTemplates: () => requestJson('/api/admin/certificate-templates', { method: 'GET' }),
  createTemplate: (body: { name: string; content: EffectiveCertificate }) =>
    requestJson('/api/admin/certificate-templates', { method: 'POST', body: JSON.stringify(body) }),
  assignTemplate: (body: ReturnType<typeof buildAssignmentRequest>) =>
    requestJson('/api/admin/certificate-assignments', { method: 'POST', body: JSON.stringify(body) }),
  setOverride: (body: ReturnType<typeof buildOverrideRequest>) =>
    requestJson('/api/admin/certificate-overrides', { method: 'PUT', body: JSON.stringify(body) }),
  getArtworkState: async (artworkId: string): Promise<CertificateArtworkEditorState> => {
    const body = await requestJson(
      `/api/admin/certificate-overrides?artworkId=${encodeURIComponent(artworkId.trim())}`,
      { method: 'GET' },
    ) as { state?: CertificateArtworkEditorState };
    if (!body.state) throw new Error('certificate_state_missing');
    return {
      artworkId: body.state.artworkId,
      assignment: body.state.assignment,
      overrides: body.state.overrides ?? {},
      effective: projectEffectiveCertificate(body.state.effective),
    };
  },
};
