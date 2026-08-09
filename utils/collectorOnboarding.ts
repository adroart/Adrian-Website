export interface BirthPlaceInput {
  label: string;
  lat: number;
  lng: number;
  tzId: string;
}

export interface BirthProfileInputs {
  date: string;
  time: string;
  place: BirthPlaceInput;
}

export type CollectorOnboardingState =
  | { status: 'missing' }
  | { status: 'skipped' }
  | { status: 'current'; inputs: BirthProfileInputs; updatedAt: string; computed?: unknown };

async function onboardingRequest(init?: RequestInit): Promise<CollectorOnboardingState> {
  const response = await fetch('/api/collector/onboarding', {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error ?? 'onboarding_request_failed');
  return body as CollectorOnboardingState;
}

export function loadCollectorOnboarding(): Promise<CollectorOnboardingState> {
  return onboardingRequest();
}

export function saveCollectorBirth(inputs: BirthProfileInputs): Promise<CollectorOnboardingState> {
  return onboardingRequest({
    method: 'POST',
    body: JSON.stringify({ action: 'save', inputs }),
  });
}

export function skipCollectorBirth(): Promise<CollectorOnboardingState> {
  return onboardingRequest({
    method: 'POST',
    body: JSON.stringify({ action: 'skip' }),
  });
}
