import { spawn } from 'node:child_process';

export interface SummaryParams {
  transactionDate: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  transferAmountFormatted: string;
}

export function printSummary(params: SummaryParams): void {
  if (!process.stdout.isTTY) return;
  console.log(`Transaction Date: ${params.transactionDate}`);
  console.log(
    `Rate: 1 ${params.fromCurrency} = ${params.rate.toFixed(4)} ${params.toCurrency}`,
  );
  console.log(
    `Transfer Amount: ${params.toCurrency} ${params.transferAmountFormatted}`,
  );
}

export function copyToClipboard(text: string): void {
  if (!process.stdout.isTTY) return;
  try {
    const child = spawn('pbcopy');
    child.on('error', () => {});
    child.stdin.on('error', () => {});
    child.stdin.end(text);
  } catch {
    // Spawn itself failed synchronously — ignore.
  }
}
