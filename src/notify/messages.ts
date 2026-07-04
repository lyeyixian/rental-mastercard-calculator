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

export interface WarningMessageParams {
  monthName: string;
  daysUntilReminder: number;
}

export function formatWarningMessage(params: WarningMessageParams): string {
  const monthName = escapeMarkdownV2(params.monthName);
  const days = escapeMarkdownV2(String(params.daysUntilReminder));
  const dayWord = params.daysUntilReminder === 1 ? 'day' : 'days';
  return [
    `⚠️ *Rent prep — ${monthName}*`,
    '',
    `No Mastercard FX Rate cached yet\\. ${days} ${dayWord} until rent is due\\.`,
    'Run `pnpm start` to retry\\.',
  ].join('\n');
}

export interface LateNoRateMessageParams {
  monthName: string;
}

export function formatLateNoRateMessage(
  params: LateNoRateMessageParams,
): string {
  const monthName = escapeMarkdownV2(params.monthName);
  return [
    `*Rent due today — ${monthName}*`,
    '',
    'No Mastercard FX Rate cached\\. Compute manually using Mastercard\\.',
  ].join('\n');
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
