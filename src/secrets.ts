import { ENV_FILE } from './paths';

export interface Secrets {
  telegramBotToken: string;
  telegramChatId: string;
}

export function loadSecrets(): Secrets {
  process.loadEnvFile(ENV_FILE);

  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  if (!telegramBotToken) {
    throw new Error(
      `Missing TELEGRAM_BOT_TOKEN in ${ENV_FILE}. See local/.env.example.`,
    );
  }
  if (!telegramChatId) {
    throw new Error(
      `Missing TELEGRAM_CHAT_ID in ${ENV_FILE}. See local/.env.example.`,
    );
  }

  return { telegramBotToken, telegramChatId };
}
