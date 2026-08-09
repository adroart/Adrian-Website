import { useEffect, useState } from 'react';
import {
  projectEffectiveCertificate,
  type EffectiveCertificate,
} from '../../utils/certificateContent';

type CertificateEdition =
  | { kind: 'unique' }
  | { kind: 'numbered'; number: number; size: number | null };

type InstanceCertificate = EffectiveCertificate & {
  artworkId: string;
  edition: CertificateEdition;
  publicCode: string;
};

function projectInstanceCertificate(
  value: unknown,
  expectedArtworkId: string,
  expectedPublicCode: string,
): InstanceCertificate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('certificate_identity_missing');
  const source = value as Record<string, unknown>;
  if (source.artworkId !== expectedArtworkId || source.publicCode !== expectedPublicCode) {
    throw new Error('certificate_identity_mismatch');
  }
  const rawEdition = source.edition;
  if (!rawEdition || typeof rawEdition !== 'object' || Array.isArray(rawEdition)) {
    throw new Error('certificate_edition_missing');
  }
  const edition = rawEdition as Record<string, unknown>;
  const projectedEdition: CertificateEdition = edition.kind === 'unique'
    ? { kind: 'unique' }
    : edition.kind === 'numbered'
      && Number.isInteger(edition.number)
      && Number(edition.number) > 0
      && (edition.size === null || (Number.isInteger(edition.size) && Number(edition.size) >= Number(edition.number)))
        ? { kind: 'numbered', number: Number(edition.number), size: edition.size === null ? null : Number(edition.size) }
        : (() => { throw new Error('certificate_edition_invalid'); })();
  return {
    ...projectEffectiveCertificate(source),
    artworkId: expectedArtworkId,
    edition: projectedEdition,
    publicCode: expectedPublicCode,
  };
}

function certificateEditionLabel(edition: CertificateEdition) {
  if (edition.kind === 'unique') return 'Unique work';
  return edition.size === null
    ? `Edition ${edition.number}`
    : `Edition ${edition.number} of ${edition.size}`;
}

export function useEffectiveCertificate(artworkId: string, publicCode: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'ready'; certificate: InstanceCertificate } | { status: 'error' }
  >({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetch(`/api/certificates/${encodeURIComponent(artworkId)}?publicCode=${encodeURIComponent(publicCode)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('certificate_unavailable');
        const body = await response.json();
        return projectInstanceCertificate(body?.certificate, artworkId, publicCode);
      })
      .then((certificate) => {
        if (!controller.signal.aborted) setState({ status: 'ready', certificate });
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [artworkId, attempt, publicCode]);

  return { ...state, retry: () => setAttempt((value) => value + 1) };
}

function Fact({ label, children }: { label: string; children: string }) {
  return (
    <div className="collector-certificate-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function CertificateScreen({
  artworkId,
  publicCode,
  title,
  onComplete,
  testId = 'public-certificate',
}: {
  artworkId: string;
  publicCode: string;
  title: string;
  editionLabel?: string;
  onComplete?: () => void;
  testId?: string;
}) {
  const state = useEffectiveCertificate(artworkId, publicCode);
  const { retry } = state;

  return (
    <section className="collector-certificate" data-testid={testId} aria-labelledby={`${testId}-title`}>
      <p className="collector-eyebrow">Certificate of authenticity</p>
      <h3 id={`${testId}-title`} className="collector-title">{title}</h3>
      {state.status === 'loading' && <p className="collector-copy" role="status">Opening the recorded certificate</p>}
      {state.status === 'error' && (
        <>
          <p className="collector-copy" role="status">The certificate could not be verified right now. The artwork record remains available.</p>
          <div className="collector-actions">
            <button type="button" className="collector-button-secondary" onClick={retry}>Try again</button>
            {onComplete && (
              <button type="button" className="collector-button-primary" onClick={onComplete}>Complete registration</button>
            )}
          </div>
        </>
      )}
      {state.status === 'ready' && (
        <>
          <dl className="collector-certificate-facts">
            <Fact label="Identifier">{state.certificate.artworkId}</Fact>
            <Fact label="Edition">{certificateEditionLabel(state.certificate.edition)}</Fact>
            <Fact label="Public code">{state.certificate.publicCode}</Fact>
          </dl>
          {state.certificate.certificateWording && <p className="collector-lede">{state.certificate.certificateWording}</p>}
          <dl className="collector-certificate-facts">
            {state.certificate.materials && <Fact label="Materials">{state.certificate.materials.join(' · ')}</Fact>}
            {state.certificate.makers?.map((maker) => (
              <Fact key={`${maker.name}:${maker.role}`} label="Maker">{`${maker.name} · ${maker.role}`}</Fact>
            ))}
            {state.certificate.origin && <Fact label="Origin">{state.certificate.origin}</Fact>}
            {state.certificate.techniques && <Fact label="Techniques">{state.certificate.techniques.join(' · ')}</Fact>}
            {state.certificate.yearWording && <Fact label="Year">{state.certificate.yearWording}</Fact>}
          </dl>
          {onComplete && (
            <div className="collector-actions">
              <button type="button" className="collector-button-primary" onClick={onComplete}>Complete registration</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
