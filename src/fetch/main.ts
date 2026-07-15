import { CONFIG } from '../config';
import { STATE_FILE } from '../paths';
import {
  formatDate,
  formatMonth,
  getFirstDayOfCurrentMonth,
  isFirstOfMonth,
} from '../shared/date';
import { createLogger } from '../shared/log';
import { createStateStore } from '../shared/state';
import { fetchRate } from './fetchRate';
import { copyToClipboard, printSummary } from './output';

const log = createLogger('fetch');

async function main(): Promise<void> {
  // PRD #7's "from the 2nd" floor: Mastercard may not have published the
  // 1st-of-month rate yet, so don't even try.
  if (isFirstOfMonth()) {
    log.info('Skipping: 1st of the month, Mastercard may not have published the Transaction Date rate yet.');
    return;
  }

  const store = createStateStore(STATE_FILE);
  const firstOfMonth = getFirstDayOfCurrentMonth();
  const month = formatMonth(firstOfMonth);
  const transactionDate = formatDate(firstOfMonth);

  const cached = store.readState();
  if (
    cached?.month === month &&
    cached.rate !== null &&
    cached.transferAmount !== null
  ) {
    const transferAmountFormatted = cached.transferAmount.toFixed(2);
    log.info(
      `Rate for ${month} already cached (fetched ${cached.fetchedAt}); Transfer Amount ${CONFIG.toCurrency} ${transferAmountFormatted}.`,
    );
    printSummary({
      transactionDate,
      fromCurrency: CONFIG.fromCurrency,
      toCurrency: CONFIG.toCurrency,
      rate: Number(cached.rate),
      transferAmountFormatted,
    });
    copyToClipboard(transferAmountFormatted);
    return;
  }

  const { rate, crdhldBillAmt } = await fetchRate({
    url: CONFIG.url,
    readinessSelector: CONFIG.readinessSelector,
    transactionDate,
    fromCurrency: CONFIG.fromCurrency,
    toCurrency: CONFIG.toCurrency,
    bankFee: CONFIG.bankFee,
    amount: CONFIG.amount,
  });

  const transferAmount = crdhldBillAmt - CONFIG.deductionSgd;
  const transferAmountFormatted = transferAmount.toFixed(2);

  log.info(
    `Fetched Mastercard FX Rate for ${transactionDate}: ${rate}; Transfer Amount ${CONFIG.toCurrency} ${transferAmountFormatted}.`,
  );

  store.apply({
    kind: 'rateFetched',
    month,
    rate: String(rate),
    transferAmount,
    fetchedAt: new Date().toISOString(),
  });

  printSummary({
    transactionDate,
    fromCurrency: CONFIG.fromCurrency,
    toCurrency: CONFIG.toCurrency,
    rate,
    transferAmountFormatted,
  });
  copyToClipboard(transferAmountFormatted);
}

main().catch((err: Error) => {
  log.error(err);
  process.exit(1);
});
