export interface ParsedRateResponse {
  rate: number;
  crdhldBillAmt: number;
}

export function parseRateResponse(
  raw: unknown,
  expectedDate: string,
  expectedAmount: number,
): ParsedRateResponse {
  const rawJson = JSON.stringify(raw);
  const bail = (msg: string): never => {
    throw new Error(`parseRateResponse: ${msg}. raw=${rawJson}`);
  };

  if (raw === null || typeof raw !== 'object') {
    bail('raw is not an object');
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.crdhldBillAmt !== 'string') {
    bail('missing field crdhldBillAmt');
  }
  if (obj.fxDate !== expectedDate) {
    bail(`fxDate mismatch (expected ${expectedDate}, got ${String(obj.fxDate)})`);
  }
  if (obj.transAmt !== String(expectedAmount)) {
    bail(`transAmt mismatch (expected ${String(expectedAmount)}, got ${String(obj.transAmt)})`);
  }

  const crdhldBillAmt = Number(obj.crdhldBillAmt);
  if (!Number.isFinite(crdhldBillAmt)) {
    bail(`crdhldBillAmt is not a number (got ${String(obj.crdhldBillAmt)})`);
  }
  if (crdhldBillAmt <= 0) {
    bail(`crdhldBillAmt must be positive (got ${String(obj.crdhldBillAmt)})`);
  }

  return {
    rate: Number(obj.conversionRate),
    crdhldBillAmt,
  };
}
