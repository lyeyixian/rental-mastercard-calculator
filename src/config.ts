export interface Config {
  fromCurrency: string;
  amount: number;
  toCurrency: string;
  bankFee: number;
  deductionSgd: number;
  url: string;
  readinessSelector: string;
}

export const CONFIG: Config = {
  fromCurrency: 'MYR',
  amount: 2950,
  toCurrency: 'SGD',
  bankFee: 0,
  deductionSgd: 5,
  url: 'https://www.mastercard.com/global/en/personal/get-support/currency-exchange-rate-converter.html',
  readinessSelector: '#calculate-button',
};
