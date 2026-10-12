export const dutyKinds = ['day', 'waking_night', 'sleep_in', 'live_in', 'wellness'] as const;
export type DutyState = 'planned' | 'present' | 'break' | 'completed' | 'cancelled';
export function nextDutyState(state: DutyState, action: string): DutyState | undefined {
    if (action === 'check_in' && state === 'planned')
        return 'present';
    if (action === 'break' && state === 'present')
        return 'break';
    if (action === 'resume' && state === 'break')
        return 'present';
    if (action === 'check_out' && (state === 'present' || state === 'break'))
        return 'completed';
    if (action === 'cancel' && state === 'planned')
        return 'cancelled';
    return undefined;
}
