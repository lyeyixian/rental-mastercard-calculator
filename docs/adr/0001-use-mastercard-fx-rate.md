# Use the Mastercard FX rate, not any other source

The landlord requires the conversion to be computed using Mastercard's published FX rate for the 1st of each month, as part of the rental agreement. We do not use cheaper or easier sources (OANDA, Wise, exchangerate.host, DBS published rate) even though several of them have free, scrape-friendly APIs — a different source would produce a different number and breach the agreement.

This constraint is the root cause of the bot-detection difficulty addressed in [ADR-0002](./0002-local-headed-browser.md), and the reason this project exists at all.
