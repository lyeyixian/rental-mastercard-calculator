import { computeTransferAmount } from './computeTransfer';
import { CONFIG } from './config';
import { formatDate, formatMonth, getFirstDayOfCurrentMonth } from './date';
import { fetchRate } from './fetchRate';
import { copyToClipboard, printSummary } from './output';
import { STATE_FILE } from './paths';
import { createStateStore } from './state';

async function main(): Promise<void> {
  const store = createStateStore(STATE_FILE);
  const firstOfMonth = getFirstDayOfCurrentMonth();
  const month = formatMonth(firstOfMonth);
  const transactionDate = formatDate(firstOfMonth);

  const cached = store.readState();
  if (cached?.month === month) {
    const transferAmountFormatted = cached.transferAmount.toFixed(2);
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

  const transferAmount = computeTransferAmount(crdhldBillAmt, CONFIG.deductionSgd);
  const transferAmountFormatted = transferAmount.toFixed(2);

  store.writeFetchResult({
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
  console.error(err.message);
  process.exit(1);
});
