export type ParseMode = 'MarkdownV2' | 'HTML';

export interface SendMessageParams {
  token: string;
  chatId: string;
  text: string;
  parseMode?: ParseMode;
}

export async function sendMessage({
  token,
  chatId,
  text,
  parseMode,
}: SendMessageParams): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
  };
  if (parseMode) {
    body.parse_mode = parseMode;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(
      `Telegram sendMessage failed: HTTP ${response.status}. body=${responseBody}`,
    );
  }
}
