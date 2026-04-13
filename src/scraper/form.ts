import { Page } from 'playwright';
import { CONFIG } from '../config';

/**
 * Attempts to interact with the currency converter form on the page.
 * The Mastercard page is a React SPA with custom dropdown components.
 */
export async function fillConverterForm(page: Page, dateStr: string): Promise<boolean> {
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
