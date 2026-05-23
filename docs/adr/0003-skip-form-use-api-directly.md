# Call the conversion-rates API directly, do not drive the converter form

After the page loads — which we need only to acquire valid Akamai session cookies — the script calls `mastercard.com/marketingservices/public/mccom-services/currency-conversions/conversion-rates` directly with query parameters and parses the JSON response. We do not fill in the React form on the converter page and read the result from the DOM.

The form uses custom React dropdowns and a date-picker with no stable selectors; any selector strategy is brittle and breaks on every Mastercard redesign. The API is what the form ends up calling internally — same rate, less surface. The response also includes a pre-multiplied `crdhldBillAmt`, so we use that directly rather than computing `rate × amount` ourselves.

## Empirical response shape

Recorded so we can detect drift later. All values are strings.

```json
{
  "data": {
    "conversionRate": "0.3238726",
    "crdhldBillAmt": "955.4241700",
    "crdhldBillCurr": "SGD",
    "fxDate": "2026-02-01",
    "transAmt": "2950",
    "transCurr": "MYR"
  }
}
```

## Consequences

- The browser is still required for cookie acquisition; we cannot skip Playwright entirely.
- The API endpoint and response shape are not part of any public Mastercard contract. If either changes the script breaks — at which point the recorded schema above is the starting point for re-detection.
