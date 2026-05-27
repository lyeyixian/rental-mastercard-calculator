import fs from 'node:fs';

export interface State {
  month: string;
  rate: string | null;
  transferAmount: number | null;
  fetchedAt: string | null;
  notifiedAt: string | null;
}

export type StateEvent =
  | {
      kind: 'rateFetched';
      month: string;
      rate: string;
      transferAmount: number;
      fetchedAt: string;
    }
  | { kind: 'reminderSent'; month: string; notifiedAt: string }
  | { kind: 'lateNoRateSent'; month: string; notifiedAt: string };

export interface StateStore {
  readState(): State | null;
  apply(event: StateEvent): void;
}

export function createStateStore(filePath: string): StateStore {
  function readState(): State | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as State;
  }

  function writeState(state: State): void {
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  }

  function apply(event: StateEvent): void {
    switch (event.kind) {
      case 'rateFetched':
        writeState({
          month: event.month,
          rate: event.rate,
          transferAmount: event.transferAmount,
          fetchedAt: event.fetchedAt,
          notifiedAt: null,
        });
        return;
      case 'reminderSent': {
        const existing = readState();
        if (existing === null) {
          throw new Error(
            `apply(reminderSent): no existing state at ${filePath}; rateFetched must run first.`,
          );
        }
        if (existing.month !== event.month) {
          throw new Error(
            `apply(reminderSent): month mismatch (state has ${existing.month}, got ${event.month}).`,
          );
        }
        writeState({ ...existing, notifiedAt: event.notifiedAt });
        return;
      }
      case 'lateNoRateSent':
        writeState({
          month: event.month,
          rate: null,
          transferAmount: null,
          fetchedAt: null,
          notifiedAt: event.notifiedAt,
        });
        return;
    }
  }

  return { readState, apply };
}
