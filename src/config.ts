export interface Config {
  fromCurrency: string;
  amount: number;
  toCurrency: string;
  bankFee: number;
  url: string;
}

export const CONFIG: Config = {
  fromCurrency: 'MYR',
  amount: 2950,
  toCurrency: 'SGD',
  bankFee: 0,
  url: 'https://www.mastercard.com/global/en/personal/get-support/currency-exchange-rate-converter.html',
};
