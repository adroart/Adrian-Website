import {
  CollectorApiNetworkError, getCollectorOnboarding, getCollectorPrivacy,
  saveCollectorBirthProfile, updateCollectorPrivacy,
  type ApiOutcome, type CollectorBirthInputs, type CollectorPersonPrivacy,
} from './api';

export type GatheringStage = 'read' | 'birth' | 'privacy';
export type GatheringOutcome =
  | { kind: 'saved' | 'cancelled' }
  | { kind: 'pending' | 'rejected' | 'network'; stage: GatheringStage; error?: string };

function refusal(outcome: ApiOutcome<unknown>, stage: GatheringStage): GatheringOutcome | null {
  if (!outcome.ok) return { kind: 'rejected', stage, error: 'error' in outcome ? outcome.error : undefined };
  if (outcome.status === 202) return { kind: 'pending', stage };
  return null;
}

function sameBirth(left: CollectorBirthInputs, right: CollectorBirthInputs): boolean {
  return left.date === right.date && left.time === right.time
    && left.place.label === right.place.label && left.place.lat === right.place.lat
    && left.place.lng === right.place.lng && left.place.tzId === right.place.tzId;
}

/** Complete the dependent writes in order. An old account's completion may
 * finish its existing request, but must never start the next one. Read failures
 * cannot be mistaken for an absent profile or permission to overwrite it. */
export async function persistCollectorGathering(input: {
  keeperPieceId: string;
  birth: CollectorBirthInputs | null;
  privacy: { person: CollectorPersonPrivacy; piece?: { keeperPieceId: string; shareCity: boolean; cityId: string | null } };
  isCurrent: () => boolean;
}): Promise<GatheringOutcome> {
  let stage: GatheringStage = 'read';
  try {
    if (!input.isCurrent()) return { kind: 'cancelled' };
    const profile = await getCollectorOnboarding();
    if (!input.isCurrent()) return { kind: 'cancelled' };
    const profileFailure = refusal(profile, stage);
    if (profileFailure) return profileFailure;
    if (!profile.ok || !['missing', 'skipped', 'current'].includes(profile.data?.status)) {
      return { kind: 'rejected', stage, error: 'invalid_onboarding_state' };
    }
    const privacy = await getCollectorPrivacy(input.keeperPieceId);
    if (!input.isCurrent()) return { kind: 'cancelled' };
    const privacyFailure = refusal(privacy, stage);
    if (privacyFailure) return privacyFailure;
    if (!privacy.ok || !privacy.data?.ring1 || !privacy.data?.ring2 || !privacy.data?.ring3 || !privacy.data?.ring4) {
      return { kind: 'rejected', stage, error: 'invalid_privacy_state' };
    }
    if (input.birth) {
      stage = 'birth';
      // Retrying a refused privacy write must not create another birth revision.
      if (profile.data.status !== 'current' || !sameBirth(profile.data.inputs, input.birth)) {
        const saved = await saveCollectorBirthProfile(input.birth);
        if (!input.isCurrent()) return { kind: 'cancelled' };
        const failed = refusal(saved, stage);
        if (failed) return failed;
        if (!saved.ok || saved.data?.status !== 'current') return { kind: 'pending', stage };
      }
    } else if (profile.data.status !== 'current' && (
      Object.values(input.privacy.person).some(Boolean) || input.privacy.piece?.shareCity
    )) {
      return { kind: 'pending', stage: 'privacy', error: 'adult_profile_required' };
    }
    stage = 'privacy';
    const saved = await updateCollectorPrivacy(input.privacy);
    if (!input.isCurrent()) return { kind: 'cancelled' };
    return refusal(saved, stage) ?? { kind: 'saved' };
  } catch (cause) {
    if (!input.isCurrent()) return { kind: 'cancelled' };
    return { kind: cause instanceof CollectorApiNetworkError ? 'network' : 'rejected', stage };
  }
}
