import { CONFIG } from './config';
import { formatReminderMessage } from './messages';
import { decideNotifyAction } from './notifyDecision';
import { STATE_FILE } from './paths';
import { loadSecrets } from './secrets';
import { createStateStore } from './state';
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

async function main(): Promise<void> {
  const store = createStateStore(STATE_FILE);
  const action = decideNotifyAction(new Date(), store.readState());

  if (action.kind === 'noop') {
    return;
  }

  const { state } = action;
  const text = formatReminderMessage({
    monthName: monthNameFor(state.month),
    transactionDate: transactionDateFor(state.month),
    rate: state.rate,
    myrRent: CONFIG.amount,
    deductionSgd: CONFIG.deductionSgd,
    transferAmount: state.transferAmount.toFixed(2),
  });

  const { telegramBotToken, telegramChatId } = loadSecrets();
  await sendMessage({
    token: telegramBotToken,
    chatId: telegramChatId,
    text,
    parseMode: 'MarkdownV2',
  });

  store.writeNotifiedAt({
    month: state.month,
    notifiedAt: new Date().toISOString(),
  });
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
