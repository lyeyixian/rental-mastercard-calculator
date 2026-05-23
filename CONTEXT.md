# Rental Mastercard Calculator

A single-purpose tool that calculates the Singapore-dollar amount due each month for the user's Malaysian rent, using the Mastercard FX rate for the 1st of the current month as required by the landlord.

## Language

**Mastercard FX Rate**:
The MYR → SGD rate published by Mastercard's currency converter for a specific Transaction Date. The agreed-upon source between user and landlord; not interchangeable with rates from Wise, OANDA, or DBS.
_Avoid_: "exchange rate" on its own (ambiguous about source).

**Transaction Date**:
The calendar date the Mastercard FX Rate is read for. Always the 1st of the current calendar month. When the 1st is a weekend or public holiday Mastercard returns the previous Friday's rate server-side, so this code does not handle the case explicitly.
_Avoid_: "exchange date", "rate date", "today's date".

**Reminder Date**:
The 15th of the current calendar month — the day rent is due to the landlord and the day the autonomous reminder fires. Distinct from the Transaction Date: the Reminder Date is *when* the user pays, the Transaction Date is the date the rate is read *for*.
_Avoid_: "rent date", "payment date", "due date" — all ambiguous about whether they refer to the rate's date or the rent's date.

**MYR Rent**:
The fixed monthly rent in Malaysian Ringgit, agreed with the landlord. The input to the conversion.
_Avoid_: "rent amount" on its own (does not disambiguate currency).

**Deduction**:
A flat 5 SGD that the landlord agreed to absorb. Subtracted from the SGD-equivalent rent to produce the Transfer Amount. Unrelated to anything Mastercard knows about — see "Flagged ambiguities" below.
_Avoid_: "discount", "fee", "bank fee".

**Transfer Amount**:
The final SGD figure the user transfers to the landlord's Singapore DBS bank account each month. Equal to `Mastercard FX Rate × MYR Rent − Deduction`, rounded to 2 decimal places.
_Avoid_: "rent amount" (ambiguous between MYR and SGD), "SGD amount" (ambiguous about whether the Deduction has been applied).

## Flagged ambiguities

**"Bank fee" is overloaded — never use the bare phrase.**

Two unrelated things have been called "bank fee" in conversation:

- **Mastercard `bank_fee` query parameter** — a percentage Mastercard's API uses to model a card-issuer markup. We always pass `0` because we want the raw rate. Belongs to Mastercard's API.
- **Deduction** — the flat 5 SGD subtracted from the final figure. Belongs to the landlord agreement, has nothing to do with Mastercard.

If you mean the percentage, say "Mastercard `bank_fee`". If you mean the 5 SGD subtraction, say "Deduction". Don't say "bank fee" on its own.

## Example dialogue

> **Dev:** What date does the script query for?
> **You:** The Transaction Date — first of the current month.
> **Dev:** And if the 1st is a Sunday?
> **You:** Mastercard returns Friday's rate server-side. We don't handle it explicitly.
> **Dev:** Then the SGD figure is rate × MYR Rent?
> **You:** Almost. The Transfer Amount is rate × MYR Rent minus the Deduction — 5 SGD the landlord absorbs.
> **Dev:** That's the Mastercard `bank_fee` parameter, right?
> **You:** No — `bank_fee` is a Mastercard API field, always 0. The Deduction is a flat 5 SGD, separate from anything Mastercard knows about.
> **Dev:** And the Telegram reminder fires on the 15th?
> **You:** That's the Reminder Date — when rent is due. Don't confuse it with the Transaction Date, which is the 1st — the date the rate is read for.
