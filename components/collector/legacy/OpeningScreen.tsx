import type { EffectiveCertificate } from '../../../utils/certificateContent';

export const DEFAULT_OPENING_WORDING =
  'This creates a durable, exportable record for your piece.';

export default function OpeningScreen({
  title,
  certificate,
  onContinue,
  onCancel,
}: {
  title: string;
  certificate: EffectiveCertificate;
  onContinue: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="collector-screen" aria-labelledby="collector-opening-title">
      <p className="collector-eyebrow">Your piece</p>
      <h3 id="collector-opening-title" className="collector-title">Register this piece to you</h3>
      <p className="collector-lede">
        You are registering {title} to your account and certifying its authentic artwork identity.
      </p>
      <p className="collector-copy">
        {DEFAULT_OPENING_WORDING}
      </p>
      {certificate.openingWording && certificate.openingWording !== DEFAULT_OPENING_WORDING && (
        <p className="collector-copy">{certificate.openingWording}</p>
      )}
      <p className="collector-copy">
        The Ownership Code remains with the artwork. Whoever holds that code can use it to register the piece, so keep it safe and private.
      </p>
      <p className="collector-copy">
        An attached video is optional. This record never promises permanent hosting for video.
      </p>
      <p className="collector-copy">
        Your private choices begin closed. The public map is optional, and an intention can be added later.
      </p>
      <div className="collector-actions">
        <button type="button" className="collector-button-secondary" onClick={onCancel}>Not now</button>
        <button type="button" className="collector-button-primary" onClick={onContinue}>Continue</button>
      </div>
    </section>
  );
}
