import { CONFIG } from './config';
import {
  formatLateNoRateMessage,
  formatReminderMessage,
  formatWarningMessage,
} from './messages';
import { decideNotifyAction, NotifyAction } from './notifyDecision';
import { STATE_FILE } from './paths';
import { loadSecrets } from './secrets';
import { createStateStore, StateStore } from './state';
import { sendMessage } from './telegram';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function monthNameFor(monthKey: string): string {
  const [year, mm] = monthKey.split('-');
  return `${MONTH_NAMES[Number(mm) - 1]} ${year}`;
}

function transactionDateFor(monthKey: string): string {
  return `${monthKey}-01`;
}

function renderMessage(action: Exclude<NotifyAction, { kind: 'noop' }>): string {
  switch (action.kind) {
    case 'sendReminder': {
      const { state } = action;
      return formatReminderMessage({
        monthName: monthNameFor(state.month),
        transactionDate: transactionDateFor(state.month),
        rate: state.rate,
        myrRent: CONFIG.amount,
        deductionSgd: CONFIG.deductionSgd,
        transferAmount: state.transferAmount.toFixed(2),
      });
    }
    case 'sendWarning':
      return formatWarningMessage({
        monthName: monthNameFor(action.month),
        daysUntilReminder: action.daysUntilReminder,
      });
    case 'sendLateNoRate':
      return formatLateNoRateMessage({
        monthName: monthNameFor(action.month),
      });
  }
}

function persistNotifiedAt(
  store: StateStore,
  action: Exclude<NotifyAction, { kind: 'noop' }>,
  notifiedAt: string,
): void {
  switch (action.kind) {
    case 'sendReminder':
      store.apply({ kind: 'reminderSent', month: action.state.month, notifiedAt });
      return;
    case 'sendLateNoRate':
      store.apply({ kind: 'lateNoRateSent', month: action.month, notifiedAt });
      return;
    case 'sendWarning':
      // Intentional: warning never sets notifiedAt — the reminder must still
      // fire on the 15th if the rate becomes available later (PRD #7, issue #11).
      return;
  }
}

async function main(): Promise<void> {
  const store = createStateStore(STATE_FILE);
  const action = decideNotifyAction(new Date(), store.readState());

  if (action.kind === 'noop') {
    return;
  }

  const text = renderMessage(action);

  const { telegramBotToken, telegramChatId } = loadSecrets();
  await sendMessage({
    token: telegramBotToken,
    chatId: telegramChatId,
    text,
    parseMode: 'MarkdownV2',
  });

  persistNotifiedAt(store, action, new Date().toISOString());
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
