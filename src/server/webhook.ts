import { Router, Request, Response } from "express";
import { WebhookPayload } from "../types";
import { processMessage } from "../agent/claude";
import { sendMessage } from "../services/whatsapp";
import logger from "../utils/logger";

export const webhookRouter = Router();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;
const INSTANCE_ID = parseInt(process.env.GREEN_API_INSTANCE!, 10);
const OWNER_PHONE = process.env.OWNER_PHONE!;

// Dedup: track recently processed message IDs to avoid double-processing
// (Green API can fire both outgoing + incoming webhooks for self-chat messages)
const recentlyProcessed = new Set<string>();
function isDuplicate(idMessage: string): boolean {
  if (recentlyProcessed.has(idMessage)) return true;
  recentlyProcessed.add(idMessage);
  // Clean up after 60 seconds to avoid memory leak
  setTimeout(() => recentlyProcessed.delete(idMessage), 60_000);
  return false;
}

webhookRouter.post("/:secret", (req: Request, res: Response) => {
  // Validate path secret
  if (req.params.secret !== WEBHOOK_SECRET) {
    logger.warn("Webhook: invalid secret");
    return res.sendStatus(403);
  }

  const payload = req.body as WebhookPayload;

  // Validate instance
  if (payload?.instanceData?.idInstance !== INSTANCE_ID) {
    return res.sendStatus(200);
  }

  const isSelfMessage =
    payload.typeWebhook === "outgoingMessageReceived" &&
    payload.senderData?.chatId?.replace(/@c\.us$/, "") === OWNER_PHONE;

  const isIncoming = payload.typeWebhook === "incomingMessageReceived";

  if (!isIncoming && !isSelfMessage) {
    return res.sendStatus(200);
  }

  const { chatId, sender, senderName } = payload.senderData || {};
  if (!chatId || !sender) return res.sendStatus(200);

  // For incoming: only from owner. For self-message: always allowed.
  if (isIncoming) {
    const senderPhone = sender.replace(/@c\.us$/, "").replace(/@s\.whatsapp\.net$/, "");
    if (senderPhone !== OWNER_PHONE) {
      logger.debug("Ignoring message from non-owner", { sender });
      return res.sendStatus(200);
    }
  }

  // Dedup: skip if we already processed this message ID
  // (prevents double-processing when both outgoing+incoming webhooks fire for the same self-chat message)
  if (payload.idMessage && isDuplicate(payload.idMessage)) {
    logger.debug("Skipping duplicate message", { idMessage: payload.idMessage });
    return res.sendStatus(200);
  }

  // Extract text
  const msgData = payload.messageData;
  const text = msgData?.textMessageData?.textMessage
    || msgData?.extendedTextMessageData?.text
    || "";

  if (!text.trim()) return res.sendStatus(200);

  // For self-messages: use owner's chatId as destination
  const respondTo = isSelfMessage ? `${OWNER_PHONE}@c.us` : chatId;

  // Respond immediately, process async
  res.sendStatus(200);

  logger.info("Message received", { type: payload.typeWebhook, text: text.substring(0, 80) });

  setImmediate(async () => {
    try {
      await processMessage(respondTo, senderName || "ניר", text);
    } catch (err) {
      logger.error("Error processing message", { err });
      try {
        const detail = err instanceof Error ? err.message : String(err);
        await sendMessage(respondTo, `⚠️ קרתה שגיאה בעיבוד ההודעה:\n${detail}`);
      } catch (notifyErr) {
        logger.error("Failed to notify user of processing error", { notifyErr });
      }
    }
  });
});
