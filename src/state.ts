import fs from 'node:fs';

export interface State {
  month: string;
  rate: string | null;
  transferAmount: number | null;
  fetchedAt: string | null;
  notifiedAt: string | null;
}

export interface FetchResult {
  month: string;
  rate: string;
  transferAmount: number;
  fetchedAt: string;
}

export interface NotifiedUpdate {
  month: string;
  notifiedAt: string;
}

export interface StateStore {
  readState(): State | null;
  writeFetchResult(result: FetchResult): void;
  writeNotifiedAt(update: NotifiedUpdate): void;
  writeLateNoRateNotified(update: NotifiedUpdate): void;
}

export function createStateStore(filePath: string): StateStore {
  return {
    readState(): State | null {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw) as State;
    },
    writeFetchResult(result: FetchResult): void {
      const next: State = { ...result, notifiedAt: null };
      fs.writeFileSync(filePath, JSON.stringify(next, null, 2));
    },
    writeNotifiedAt(update: NotifiedUpdate): void {
      const existing = this.readState();
      if (existing === null) {
        throw new Error(
          `writeNotifiedAt: no existing state at ${filePath}; writeFetchResult must run first.`,
        );
      }
      if (existing.month !== update.month) {
        throw new Error(
          `writeNotifiedAt: month mismatch (state has ${existing.month}, got ${update.month}).`,
        );
      }
      const next: State = { ...existing, notifiedAt: update.notifiedAt };
      fs.writeFileSync(filePath, JSON.stringify(next, null, 2));
    },
    writeLateNoRateNotified(update: NotifiedUpdate): void {
      const next: State = {
        month: update.month,
        rate: null,
        transferAmount: null,
        fetchedAt: null,
        notifiedAt: update.notifiedAt,
      };
      fs.writeFileSync(filePath, JSON.stringify(next, null, 2));
    },
  };
}
