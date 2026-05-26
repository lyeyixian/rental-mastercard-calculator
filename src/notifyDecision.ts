import { formatMonth } from './date';
import { State } from './state';

export type NotifyAction =
  | { kind: 'noop' }
  | { kind: 'sendReminder'; state: State };

export function decideNotifyAction(
  today: Date,
  state: State | null,
): NotifyAction {
  if (today.getDate() < 15) {
    return { kind: 'noop' };
  }
  const currentMonth = formatMonth(today);
  if (
    state !== null &&
    state.month === currentMonth &&
    state.notifiedAt === null
  ) {
    return { kind: 'sendReminder', state };
  }
  return { kind: 'noop' };
}
