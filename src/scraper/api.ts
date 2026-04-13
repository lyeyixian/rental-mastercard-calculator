import { Page } from 'playwright';
import { CONFIG } from '../config';
import { ApiResponse } from '../types';

/**
 * Makes a direct API call to the Mastercard conversion endpoint using the
 * browser context's cookies (acquired by first visiting the main page).
 */
export async function callConversionApiViaPage(
  page: Page,
  dateStr: string,
): Promise<ApiResponse | null> {
  const apiUrl =
    'https://www.mastercard.com/marketingservices/public/mccom-services/' +
    'currency-conversions/conversion-rates';

  const params = new URLSearchParams({
    exchange_date: dateStr,
    transaction_currency: CONFIG.fromCurrency,
    cardholder_billing_currency: CONFIG.toCurrency,
    bank_fee: String(CONFIG.bankFee),
    transaction_amount: String(CONFIG.amount),
  });

  const fullUrl = `${apiUrl}?${params.toString()}`;

  const result = await page.evaluate(async (url: string): Promise<ApiResponse> => {
    const resp = await fetch(url, { credentials: 'include' });
    if (!resp.ok) return { error: `HTTP ${resp.status}` };
    return resp.json() as Promise<ApiResponse>;
  }, fullUrl);

  return result;
}

/**
 * Extracts the conversion result from the page DOM after form submission.
 */
export async function extractResultFromPage(page: Page): Promise<string | null> {
  const resultSelectors = [
    '[class*="result"]',
    '[class*="converted"]',
    '[class*="exchange"]',
    '[data-testid*="result"]',
    '.currency-result',
    '#conversion-result',
  ];

  for (const sel of resultSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 2000 });
      const text = await page.$eval(sel, (el: Element) => el.textContent?.trim() ?? '');
      if (text.length > 0) return text;
    } catch (_) { /* continue */ }
  }
  return null;
}
