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

async function main(): Promise<void> {
  const transactionDate = formatDate(getFirstDayOfCurrentMonth());

  const rate = await fetchRate({
    url: CONFIG.url,
    readinessSelector: CONFIG.readinessSelector,
    transactionDate,
    fromCurrency: CONFIG.fromCurrency,
    toCurrency: CONFIG.toCurrency,
    bankFee: CONFIG.bankFee,
    amount: CONFIG.amount,
  });

  console.log(`Transaction Date: ${transactionDate}`);
  console.log(`Rate: 1 ${CONFIG.fromCurrency} = ${rate.toFixed(4)} ${CONFIG.toCurrency}`);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
