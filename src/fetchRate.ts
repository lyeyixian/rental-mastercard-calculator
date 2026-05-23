import { chromium } from 'playwright';

import { parseRateResponse, ParsedRateResponse } from './parseResponse';

export interface FetchRateParams {
  url: string;
  readinessSelector: string;
  transactionDate: string;
  fromCurrency: string;
  toCurrency: string;
  bankFee: number;
  amount: number;
}

export type FetchRateResult = ParsedRateResponse;

const API_URL =
  'https://www.mastercard.com/marketingservices/public/mccom-services/' +
  'currency-conversions/conversion-rates';

export async function fetchRate(params: FetchRateParams): Promise<FetchRateResult> {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(params.url, { waitUntil: 'domcontentloaded' });

    try {
      await page.waitForSelector(params.readinessSelector, { timeout: 15000 });
    } catch {
      throw new Error(
        `Timed out waiting for ${params.readinessSelector}. Akamai likely blocked the request — please retry.`,
      );
    }

    const apiUrl = buildApiUrl(params);

    const json = (await page.evaluate(async (url: string) => {
      const resp = await fetch(url, { credentials: 'include' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    }, apiUrl)) as { data?: unknown };

    return parseRateResponse(json.data, params.transactionDate, params.amount);
  } finally {
    await browser.close();
  }
}

function buildApiUrl(params: FetchRateParams): string {
  const qs = new URLSearchParams({
    exchange_date: params.transactionDate,
    transaction_currency: params.fromCurrency,
    cardholder_billing_currency: params.toCurrency,
    bank_fee: String(params.bankFee),
    transaction_amount: String(params.amount),
  });
  return `${API_URL}?${qs.toString()}`;
}
