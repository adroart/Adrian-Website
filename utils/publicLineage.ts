export type PublicLineageValue = string | number | boolean | null;

export interface PublicLineageEvent {
    sequence: number;
    eventType: string;
    eventAt: string;
    previousHash: string | null;
    eventHash: string;
    publicPayload: Record<string, unknown>;
}

export interface PublicLineageResponse {
    ok: true;
    artwork: {
        pieceId: string;
        editionNumber: number;
        publicCode: string;
    };
    events: PublicLineageEvent[];
}

const EVENT_LABELS: Record<string, string> = {
    issued: 'Plate issued',
    activated: 'Plate activated',
    fulfillment_assign: 'Assigned for sale',
    fulfillment_correct: 'Assignment corrected',
    fulfillment_correction_out: 'Assignment corrected',
    fulfillment_correction_in: 'Assignment corrected',
    fulfillment_ship: 'Shipped',
    first_bound: 'First keeper registered',
    migration_baseline: 'Registry history established',
};

const PRIVATE_KEY = /(?:email|ip|user.?agent|ownership|recovery|verifier|cipher|nonce|secret|password|token|key)/i;
const PUBLIC_CODE_PATTERN = /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

export function shouldLoadPublicLineage(
    enabled: boolean,
    publicCode: string | null,
    pieceId: string | undefined,
): boolean {
    return enabled === true
        && typeof publicCode === 'string'
        && PUBLIC_CODE_PATTERN.test(publicCode)
        && typeof pieceId === 'string'
        && pieceId.length > 0;
}

export function formatLineageEventLabel(eventType: string): string {
    return EVENT_LABELS[eventType] || 'Registry event';
}

export function publicLineageDetails(payload: Record<string, unknown>): Array<[string, string]> {
    return Object.entries(payload).flatMap(([key, value]) => {
        if (PRIVATE_KEY.test(key) || value === null || typeof value === 'object' || typeof value === 'undefined') {
            return [];
        }
        const label = key
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .toLowerCase()
            .replace(/^./, (letter) => letter.toUpperCase());
        const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
        return [[label, display]];
    });
}

export function validatePublicLineageResponse(
    value: unknown,
    expectedPublicCode: string,
    expectedPieceId: string,
): PublicLineageResponse | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<PublicLineageResponse>;
    if (
        candidate.ok !== true
        || candidate.artwork?.publicCode !== expectedPublicCode
        || candidate.artwork?.pieceId !== expectedPieceId
        || !Number.isSafeInteger(candidate.artwork?.editionNumber)
        || !Array.isArray(candidate.events)
    ) return null;

    for (let index = 0; index < candidate.events.length; index += 1) {
        const event = candidate.events[index];
        if (
            !event || typeof event !== 'object'
            || event.sequence !== index + 1
            || typeof event.eventType !== 'string'
            || typeof event.eventAt !== 'string'
            || !Number.isFinite(Date.parse(event.eventAt))
            || !/^[a-f0-9]{64}$/.test(event.eventHash)
            || (event.previousHash !== null && !/^[a-f0-9]{64}$/.test(event.previousHash))
            || !event.publicPayload
            || typeof event.publicPayload !== 'object'
            || Array.isArray(event.publicPayload)
        ) return null;
    }
    return candidate as PublicLineageResponse;
}
