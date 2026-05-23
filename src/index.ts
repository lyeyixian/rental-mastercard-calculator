import { spawn } from 'node:child_process';

import { computeTransferAmount } from './computeTransfer';
import { formatDate, getFirstDayOfCurrentMonth } from './date';
import { fetchRate } from './fetchRate';

interface Config {
  fromCurrency: string;
  amount: number;
  toCurrency: string;
  bankFee: number;
  deductionSgd: number;
  url: string;
  readinessSelector: string;
}

const CONFIG: Config = {
  fromCurrency: 'MYR',
  amount: 2950,
  toCurrency: 'SGD',
  bankFee: 0,
  deductionSgd: 5,
  url: 'https://www.mastercard.com/global/en/personal/get-support/currency-exchange-rate-converter.html',
  readinessSelector: '#calculate-button',
};

function copyToClipboard(text: string): void {
  try {
    const child = spawn('pbcopy');
    child.on('error', () => {
      // pbcopy unavailable (Linux/Windows) — printed amount is still useful.
    });
    child.stdin.on('error', () => {});
    child.stdin.end(text);
  } catch {
    // Spawn itself failed synchronously — ignore.
  }
}

async function main(): Promise<void> {
  const transactionDate = formatDate(getFirstDayOfCurrentMonth());

  const { conversionRate, crdhldBillAmt } = await fetchRate({
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

  console.log(`Transaction Date: ${transactionDate}`);
  console.log(`Rate: 1 ${CONFIG.fromCurrency} = ${conversionRate.toFixed(4)} ${CONFIG.toCurrency}`);
  console.log(`Transfer Amount: ${CONFIG.toCurrency} ${transferAmountFormatted}`);

  copyToClipboard(transferAmountFormatted);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
