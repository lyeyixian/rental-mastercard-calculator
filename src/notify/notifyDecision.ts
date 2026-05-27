import { formatMonth } from '../shared/date';
import { State } from '../shared/state';

const REMINDER_DAY = 15;
const WARNING_START_DAY = 10;

export type CachedState = State & {
  rate: string;
  transferAmount: number;
  fetchedAt: string;
};

export type NotifyAction =
  | { kind: 'noop' }
  | { kind: 'sendReminder'; state: CachedState }
  | { kind: 'sendWarning'; month: string; daysUntilReminder: number }
  | { kind: 'sendLateNoRate'; month: string };

export function decideNotifyAction(
  today: Date,
  state: State | null,
): NotifyAction {
  const day = today.getDate();
  const currentMonth = formatMonth(today);

  if (day < WARNING_START_DAY) {
    return { kind: 'noop' };
  }

  const stateForCurrentMonth =
    state !== null && state.month === currentMonth ? state : null;

  if (stateForCurrentMonth?.notifiedAt) {
    return { kind: 'noop' };
  }

  const cached = isCachedState(stateForCurrentMonth)
    ? stateForCurrentMonth
    : null;

  if (day < REMINDER_DAY) {
    if (cached) {
      return { kind: 'noop' };
    }
    return {
      kind: 'sendWarning',
      month: currentMonth,
      daysUntilReminder: REMINDER_DAY - day,
    };
  }

  // day >= REMINDER_DAY
  if (cached) {
    return { kind: 'sendReminder', state: cached };
  }
  return { kind: 'sendLateNoRate', month: currentMonth };
}

function isCachedState(state: State | null): state is CachedState {
  return (
    state !== null &&
    state.rate !== null &&
    state.transferAmount !== null &&
    state.fetchedAt !== null
  );
}
