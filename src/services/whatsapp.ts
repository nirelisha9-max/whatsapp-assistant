import { formatChatId } from "../utils/phoneUtils";
import logger from "../utils/logger";

const API_URL = process.env.GREEN_API_URL!;
const INSTANCE_ID = process.env.GREEN_API_INSTANCE!;
const API_TOKEN = process.env.GREEN_API_TOKEN!;

function endpoint(method: string): string {
  return `${API_URL}/waInstance${INSTANCE_ID}/${method}/${API_TOKEN}`;
}

export async function sendMessage(chatId: string, message: string): Promise<void> {
  const url = endpoint("sendMessage");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`sendMessage failed: ${response.status} - ${text}`);
  }

  const result = (await response.json()) as { idMessage: string };
  logger.debug("Message sent", { chatId, idMessage: result.idMessage });
}

export async function sendMessageToPhone(phone: string, message: string): Promise<void> {
  const chatId = formatChatId(phone, false);
  return sendMessage(chatId, message);
}
