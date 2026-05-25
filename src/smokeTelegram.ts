import { loadSecrets } from './secrets';
import { sendMessage } from './telegram';

async function main(): Promise<void> {
  const { telegramBotToken, telegramChatId } = loadSecrets();

  const text = `rental-mastercard-calculator smoke test — ${new Date().toISOString()}`;

  await sendMessage({
    token: telegramBotToken,
    chatId: telegramChatId,
    text,
  });

  console.log(`Sent placeholder message to chat ${telegramChatId}.`);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
