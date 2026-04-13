import { chromium, Page, Response } from 'playwright';

// ── Configuration ──────────────────────────────────────────────────────────────

interface Config {
  fromCurrency: string;
  amount: number;
  toCurrency: string;
  bankFee: number;
  url: string;
}

const CONFIG: Config = {
  fromCurrency: 'MYR',
  amount: 2950,
  toCurrency: 'SGD',
  bankFee: 0,
  url: 'https://www.mastercard.com/global/en/personal/get-support/currency-exchange-rate-converter.html',
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface ConversionData {
  conversionRate: string;
  [key: string]: unknown;
}

interface ApiResponse {
  data?: ConversionData;
  error?: string;
  [key: string]: unknown;
}

interface ConversionResult {
  rate: number;
  convertedAmount: number;
  dateStr: string;
}

// ── Date helpers ───────────────────────────────────────────────────────────────

/** Returns the first day of the current month as a Date object. */
function getFirstDayOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Formats a Date object as YYYY-MM-DD. */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ── Form helpers ───────────────────────────────────────────────────────────────

/**
 * Attempts to interact with the currency converter form on the page.
 * The Mastercard page is a React SPA with custom dropdown components.
 */
async function fillConverterForm(page: Page, dateStr: string): Promise<boolean> {
  // Wait for the page to be interactive
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // ── From Currency ──────────────────────────────────────────────────────────
  const fromFilled = await trySetCurrency(page, 'from', CONFIG.fromCurrency);
  if (fromFilled) console.log(`  ✓ From currency set to ${CONFIG.fromCurrency}`);

  // ── Amount ─────────────────────────────────────────────────────────────────
  const amountFilled = await tryFillAmount(page, CONFIG.amount);
  if (amountFilled) console.log(`  ✓ Amount set to ${CONFIG.amount}`);

  // ── To Currency ────────────────────────────────────────────────────────────
  const toFilled = await trySetCurrency(page, 'to', CONFIG.toCurrency);
  if (toFilled) console.log(`  ✓ To currency set to ${CONFIG.toCurrency}`);

  // ── Bank Fee ───────────────────────────────────────────────────────────────
  const feeFilled = await tryFillBankFee(page, CONFIG.bankFee);
  if (feeFilled) console.log(`  ✓ Bank fee set to ${CONFIG.bankFee}`);

  // ── Date ───────────────────────────────────────────────────────────────────
  const dateFilled = await trySetDate(page, dateStr);
  if (dateFilled) console.log(`  ✓ Date set to ${dateStr}`);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submitted = await trySubmit(page);
  if (submitted) console.log('  ✓ Form submitted');

  return fromFilled && amountFilled && toFilled && dateFilled;
}

async function trySetCurrency(
  page: Page,
  direction: string,
  currencyCode: string,
): Promise<boolean> {
  const selectSelectors = [
    `select[name="${direction}Currency"]`,
    `select#${direction}-currency`,
    `select.${direction}-currency`,
    `[name="${direction}Currency"]`,
  ];

  // Try native select
  for (const sel of selectSelectors) {
    try {
      await page.selectOption(sel, currencyCode, { timeout: 1500 });
      return true;
    } catch (_) { /* continue */ }
  }

  // Try clicking a button/input labelled with the direction, then selecting the option
  const labelPatterns = [
    `[aria-label*="${direction}" i]`,
    `[placeholder*="${direction}" i]`,
    `button:has-text("${direction === 'from' ? 'Transaction' : 'Card'}")`,
  ];

  for (const sel of labelPatterns) {
    try {
      await page.click(sel, { timeout: 1500 });
      await page.waitForTimeout(500);
      // Type the currency code to filter
      await page.keyboard.type(currencyCode);
      await page.waitForTimeout(500);
      // Press first matching option
      const optionSel = `[role="option"]:has-text("${currencyCode}"), li:has-text("${currencyCode}")`;
      await page.click(optionSel, { timeout: 1500 });
      return true;
    } catch (_) { /* continue */ }
  }

  return false;
}

async function tryFillAmount(page: Page, amount: number): Promise<boolean> {
  const selectors = [
    'input[name="amount"]',
    '#amount',
    'input[placeholder*="amount" i]',
    'input[type="number"]',
  ];

  for (const sel of selectors) {
    try {
      await page.fill(sel, String(amount), { timeout: 1500 });
      return true;
    } catch (_) { /* continue */ }
  }
  return false;
}

async function tryFillBankFee(page: Page, fee: number): Promise<boolean> {
  const selectors = [
    'input[name="bankFee"]',
    '#bank-fee',
    'input[placeholder*="fee" i]',
    'input[placeholder*="bank" i]',
  ];

  for (const sel of selectors) {
    try {
      await page.fill(sel, String(fee), { timeout: 1500 });
      return true;
    } catch (_) { /* continue */ }
  }
  return false;
}

async function trySetDate(page: Page, dateStr: string): Promise<boolean> {
  const selectors = [
    'input[type="date"]',
    '#transaction-date',
    'input[name="date"]',
    'input[placeholder*="date" i]',
    '[data-testid*="date"]',
  ];

  for (const sel of selectors) {
    try {
      await page.fill(sel, dateStr, { timeout: 1500 });
      return true;
    } catch (_) { /* continue */ }
  }
  return false;
}

async function trySubmit(page: Page): Promise<boolean> {
  const selectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    '#btn-calculate',
    'button:has-text("Calculate")',
    'button:has-text("convert" i)',
    '[data-testid*="submit"]',
    '[data-testid*="calculate"]',
  ];

  for (const sel of selectors) {
    try {
      await page.click(sel, { timeout: 1500 });
      return true;
    } catch (_) { /* continue */ }
  }
  return false;
}

// ── API helpers ────────────────────────────────────────────────────────────────

/**
 * Makes a direct API call to the Mastercard conversion endpoint using the
 * browser context's cookies (acquired by first visiting the main page).
 */
async function callConversionApiViaPage(
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
async function extractResultFromPage(page: Page): Promise<string | null> {
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

// ── Main ───────────────────────────────────────────────────────────────────────

/**
 * Main entry point – fetches the MYR→SGD conversion for the first day of the
 * current month and prints the result.
 */
async function main(): Promise<ConversionResult | undefined> {
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

main().catch((err: Error) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
