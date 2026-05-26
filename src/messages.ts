const MARKDOWN_V2_RESERVED = /[_*[\]()~`>#+\-=|{}.!]/g;

export function escapeMarkdownV2(text: string): string {
  return text.replace(MARKDOWN_V2_RESERVED, (ch) => `\\${ch}`);
}

export interface ReminderMessageParams {
  monthName: string;
  transactionDate: string;
  rate: string;
  myrRent: number;
  deductionSgd: number;
  transferAmount: string;
}

export function formatReminderMessage(params: ReminderMessageParams): string {
  const monthName = escapeMarkdownV2(params.monthName);
  const transactionDate = escapeMarkdownV2(params.transactionDate);
  const rate = escapeMarkdownV2(params.rate);
  const myrRent = escapeMarkdownV2(String(params.myrRent));
  const deductionSgd = escapeMarkdownV2(String(params.deductionSgd));

  return [
    `*Rent due — ${monthName}*`,
    '',
    `\`${params.transferAmount}\``,
    '',
    `Mastercard FX Rate \\(${transactionDate}\\): ${rate}`,
    `MYR Rent: ${myrRent}`,
    `Deduction: ${deductionSgd} SGD`,
  ].join('\n');
}
