export function computeTransferAmount(crdhldBillAmt: number, deductionSgd: number): number {
  return Math.round((crdhldBillAmt - deductionSgd) * 100) / 100;
}
