import path from 'node:path';

export interface Secrets {
  telegramBotToken: string;
  telegramChatId: string;
}

export function loadSecrets(): Secrets {
  const envPath = path.join(__dirname, '..', 'local', '.env');
  process.loadEnvFile(envPath);

  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  if (!telegramBotToken) {
    throw new Error(
      `Missing TELEGRAM_BOT_TOKEN in ${envPath}. See local/.env.example.`,
    );
  }
  if (!telegramChatId) {
    throw new Error(
      `Missing TELEGRAM_CHAT_ID in ${envPath}. See local/.env.example.`,
    );
  }

  return { telegramBotToken, telegramChatId };
}
