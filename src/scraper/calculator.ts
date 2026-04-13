import { chromium, Response } from 'playwright';
import { CONFIG } from '../config';
import { ConversionData, ApiResponse, ConversionResult } from '../types';
import { getFirstDayOfCurrentMonth, formatDate } from '../utils/date';
import { fillConverterForm } from './form';
import { callConversionApiViaPage, extractResultFromPage } from './api';

/**
 * Fetches the MYR→SGD conversion for the first day of the current month,
 * prints the result, and returns the conversion details.
 */
export async function run(): Promise<ConversionResult | undefined> {
  const firstDay = getFirstDayOfCurrentMonth();
  const dateStr = formatDate(firstDay);

  console.log('='.repeat(60));
  console.log(' Rental Mastercard FX Calculator');
  console.log('='.repeat(60));
  console.log(`  Transaction date : ${dateStr} (first day of current month)`);
  console.log(`  From             : ${CONFIG.fromCurrency} ${CONFIG.amount}`);
  console.log(`  To               : ${CONFIG.toCurrency}`);
  console.log(`  Bank fee         : ${CONFIG.bankFee}%`);
  console.log('='.repeat(60));
  console.log('');
  console.log('Launching headless browser…');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  // ── Capture any conversion-rate API responses ──────────────────────────────
  let interceptedData: ConversionData | null = null;
  page.on('response', async (response: Response) => {
    try {
      if (response.url().includes('currency-conversions/conversion-rates')) {
        const json: ApiResponse = await response.json() as ApiResponse;
        if (json?.data) interceptedData = json.data;
      }
    } catch (_) { /* ignore non-JSON */ }
  });

  try {
    // Step 1 – visit the converter page to establish a valid browser session
    console.log('Navigating to Mastercard converter…');
    await page.goto(CONFIG.url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    console.log('  ✓ Page loaded');
    console.log('');

    // Step 2 – try to fill and submit the form
    console.log('Filling in the converter form…');
    await fillConverterForm(page, dateStr);
    console.log('');

    // Step 3 – wait a moment for the result to load
    await page.waitForTimeout(5000);

    // Step 4 – try the direct API call with the page's cookies as fallback
    if (!interceptedData) {
      console.log('Form submission did not yield a network response – trying direct API call…');
      const apiResult = await callConversionApiViaPage(page, dateStr);
      if (apiResult?.data) {
        interceptedData = apiResult.data;
      } else if (apiResult && !apiResult.error) {
        interceptedData = apiResult as unknown as ConversionData;
      }
    }

    // ── Print result ───────────────────────────────────────────────────────
    console.log('='.repeat(60));
    if (interceptedData) {
      const rate = parseFloat(interceptedData.conversionRate);
      const convertedAmount = rate * CONFIG.amount;

      console.log(' RESULT');
      console.log('='.repeat(60));
      console.log(`  Exchange rate      : 1 ${CONFIG.fromCurrency} = ${rate} ${CONFIG.toCurrency}`);
      console.log(`  ${CONFIG.fromCurrency} ${CONFIG.amount} → ${CONFIG.toCurrency} ${convertedAmount.toFixed(2)}`);
      console.log('='.repeat(60));

      return { rate, convertedAmount, dateStr };
    } else {
      // Try reading the result from the page DOM
      const domResult = await extractResultFromPage(page);
      if (domResult) {
        console.log(' RESULT (from page)');
        console.log('='.repeat(60));
        console.log(`  ${domResult}`);
        console.log('='.repeat(60));
      } else {
        console.error(' ERROR: Could not retrieve the exchange rate.');
        console.error(' The Mastercard website may be blocking automated access.');
        console.error(' Please try running the script again or check your network connection.');
        process.exitCode = 1;
      }
    }
  } finally {
    await browser.close();
  }
}
