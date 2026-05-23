# rental-mastercard-calculator

A Node.js/TypeScript script that computes the **Transfer Amount** to send to the landlord's DBS account each month for a Malaysian rent payment, using the **Mastercard FX Rate** for the **Transaction Date** (the 1st of the current month).

It fetches the rate, subtracts the agreed **Deduction**, prints the result, and copies the **Transfer Amount** to the clipboard so it can be pasted straight into DBS.

For the precise definitions of these terms, see [`CONTEXT.md`](./CONTEXT.md).

## How it works

Mastercard's converter is protected by Akamai Bot Manager, which blocks vanilla headless requests. So the script:

1. Opens a **visible** Chromium window via Playwright and waits briefly until the converter page has settled (enough to acquire valid Akamai session cookies).
2. Calls Mastercard's `conversion-rates` JSON API **directly** from that browser context — it does not fill in the converter form.
3. Reads `crdhldBillAmt` (Mastercard's pre-multiplied SGD figure) from the response, subtracts the **Deduction**, and prints / copies the result.

The rationale for each of these choices lives in the ADRs:

- [`docs/adr/0001-use-mastercard-fx-rate.md`](./docs/adr/0001-use-mastercard-fx-rate.md) — why Mastercard specifically (the rate source is part of the rental agreement).
- [`docs/adr/0002-local-headed-browser.md`](./docs/adr/0002-local-headed-browser.md) — why a visible local browser, not headless or cloud-scheduled.
- [`docs/adr/0003-skip-form-use-api-directly.md`](./docs/adr/0003-skip-form-use-api-directly.md) — why we call the JSON API directly instead of driving the React form.

## Requirements

- [Node.js](https://nodejs.org/) ≥ 18
- [npm](https://www.npmjs.com/)

## Setup

```bash
npm install
npx playwright install chromium
```

## Usage

```bash
# Fetch the Mastercard FX Rate, compute the Transfer Amount, copy it to the clipboard.
npm start

# Run the unit tests on the pure modules (date, parseResponse, computeTransfer).
npm test
```

On a successful run, the script prints the Transaction Date, the Mastercard FX Rate, and the Transfer Amount, and (on macOS) puts the Transfer Amount on the clipboard ready to paste into DBS.

## Configuration

All knobs live in the `CONFIG` block near the top of [`src/index.ts`](./src/index.ts):

| Field               | Default | Meaning |
|---------------------|---------|---------|
| `fromCurrency`      | `MYR`   | Currency of the **MYR Rent** (source of the conversion). |
| `amount`            | `2950`  | The **MYR Rent** — the fixed monthly amount agreed with the landlord. |
| `toCurrency`        | `SGD`   | Target currency (what gets transferred). |
| `bankFee`           | `0`     | The Mastercard `bank_fee` query parameter — a card-issuer markup the API can model. Always `0` because we want the raw rate. **This is not the landlord Deduction** — see below. |
| `deductionSgd`      | `5`     | The **Deduction**: a flat SGD amount the landlord absorbs, subtracted from the SGD-equivalent rent to produce the **Transfer Amount**. Nothing to do with Mastercard. |
| `url`               | Mastercard converter URL | The page Playwright opens to acquire Akamai cookies. |
| `readinessSelector` | `#calculate-button` | A selector the script waits for before calling the API — proves the page rendered and cookies are valid. |

The Transaction Date is not configurable; it is always computed as the 1st of the current calendar month.

### "Bank fee" ambiguity

`bankFee` (the Mastercard API query parameter) and the **Deduction** are unrelated. The bare phrase "bank fee" is avoided throughout the codebase and docs; see the "Flagged ambiguities" section in [`CONTEXT.md`](./CONTEXT.md).

## Platform note (clipboard)

The clipboard step shells out to `pbcopy`, which is **macOS-only**. On Linux or Windows the spawn fails silently and the script still prints the Transfer Amount to stdout — copy it manually from there.

## Failure modes

- **`Timed out waiting for #calculate-button. Akamai likely blocked the request — please retry.`** — The converter page never rendered the readiness selector within the timeout. Usually transient; just run `npm start` again. If it keeps happening, Akamai may have escalated detection of headed Chromium (see ADR-0002 for the fallback path).
- **`parseRateResponse: <reason>. raw=<json>`** — Mastercard's API returned a 200 but the JSON didn't match the expected shape (see ADR-0003 for the recorded schema). The raw response is included in the error message for debugging; the schema in ADR-0003 is the starting point for re-detection.
- **`HTTP <status>`** — The API call itself failed. Retry; if it persists, check `url` and whether Mastercard has changed the endpoint.
