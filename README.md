# rental-mastercard-calculator

A Node.js program that uses a headless Chromium browser to fetch the **MYR → SGD** exchange rate from the [Mastercard Currency Exchange Rate Converter](https://www.mastercard.com/global/en/personal/get-support/currency-exchange-rate-converter.html) and calculates the Singapore dollar amount needed to transfer for a Malaysia rent payment.

## What it does

- Visits the Mastercard FX converter with a headless browser
- Looks up the rate for **the first day of the current month** (as required for monthly rent calculations)
- Converts **MYR 2,950** → **SGD** with **0% bank fee**
- Prints the exchange rate and the converted SGD amount

## Requirements

- [Node.js](https://nodejs.org/) ≥ 18
- [npm](https://www.npmjs.com/)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Install the Chromium browser used by Playwright
npx playwright install chromium
```

## Usage

```bash
npm start
```

### Example output

```
============================================================
 Rental Mastercard FX Calculator
============================================================
  Transaction date : 2025-04-01 (first day of current month)
  From             : MYR 2950
  To               : SGD
  Bank fee         : 0%
============================================================

Launching headless browser…
Navigating to Mastercard converter…
  ✓ Page loaded

Filling in the converter form…
  ✓ From currency set to MYR
  ✓ Amount set to 2950
  ✓ To currency set to SGD
  ✓ Bank fee set to 0
  ✓ Date set to 2025-04-01
  ✓ Form submitted

============================================================
 RESULT
============================================================
  Exchange rate      : 1 MYR = 0.2963 SGD
  MYR 2950 → SGD 874.09
============================================================
```

## Configuration

Edit the `CONFIG` object near the top of `index.js` to change the defaults:

| Field          | Default | Description                         |
|----------------|---------|-------------------------------------|
| `fromCurrency` | `MYR`   | Source currency                     |
| `amount`       | `2950`  | Amount to convert                   |
| `toCurrency`   | `SGD`   | Target currency                     |
| `bankFee`      | `0`     | Bank fee percentage                 |

The transaction date is always computed automatically as the **first day of the current month** at runtime.
