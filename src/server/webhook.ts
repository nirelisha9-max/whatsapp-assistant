import { Router, Request, Response } from "express";
import { WebhookPayload } from "../types";
import { processMessage } from "../agent/claude";
import { sendMessage } from "../services/whatsapp";
import logger from "../utils/logger";

export const webhookRouter = Router();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;
const INSTANCE_ID = parseInt(process.env.GREEN_API_INSTANCE!, 10);
const OWNER_PHONE = process.env.OWNER_PHONE!;

// Group chats the bot is allowed to participate in (any member can trigger it there).
// Comma-separated group chat IDs, e.g. "120363023951034197@g.us,120363099999999999@g.us"
const ALLOWED_GROUP_IDS = (process.env.ALLOWED_GROUP_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

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

  const { chatId, sender, senderName } = payload.senderData || {};
  if (!chatId || !sender) return res.sendStatus(200);

  const isGroupChat = chatId.endsWith("@g.us");
  const isAllowedGroup = isGroupChat && ALLOWED_GROUP_IDS.includes(chatId);

  const isSelfMessage =
    payload.typeWebhook === "outgoingMessageReceived" &&
    chatId.replace(/@c\.us$/, "") === OWNER_PHONE;

  // Owner posting inside an allowed group also fires as "outgoing".
  const isOwnerMessageInGroup =
    payload.typeWebhook === "outgoingMessageReceived" && isAllowedGroup;

  const isIncoming = payload.typeWebhook === "incomingMessageReceived";

  if (!isIncoming && !isSelfMessage && !isOwnerMessageInGroup) {
    return res.sendStatus(200);
  }

  if (isIncoming) {
    if (isGroupChat) {
      // Any member may trigger the bot, but only inside an allowed group.
      if (!isAllowedGroup) {
        // Logged at info level (not debug) so the group's chat ID is visible in
        // production logs when setting up ALLOWED_GROUP_IDS for the first time.
        logger.info("Ignoring message from non-allowed group", { chatId, senderName });
        return res.sendStatus(200);
      }
    } else {
      // Private chat: only the owner's own messages.
      const senderPhone = sender.replace(/@c\.us$/, "").replace(/@s\.whatsapp\.net$/, "");
      if (senderPhone !== OWNER_PHONE) {
        logger.debug("Ignoring message from non-owner", { sender });
        return res.sendStatus(200);
      }
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

  // For self-messages: use owner's chatId as destination. Group messages reply into the group.
  const respondTo = isSelfMessage ? `${OWNER_PHONE}@c.us` : chatId;

  // In a group, prefix the sender so Ezra knows who's talking. The owner is tagged
  // explicitly (by phone number, not display name) so the model can reliably tell
  // whether a request came from the owner.
  const senderPhone = sender.replace(/@c\.us$/, "").replace(/@s\.whatsapp\.net$/, "");
  const isOwnerSender = senderPhone === OWNER_PHONE;
  const messageText =
    isGroupChat && !isSelfMessage
      ? `[${isOwnerSender ? "OWNER" : senderName || sender}]: ${text}`
      : text;

  // Respond immediately, process async
  res.sendStatus(200);

  logger.info("Message received", { type: payload.typeWebhook, text: text.substring(0, 80), chatId });

  setImmediate(async () => {
    try {
      await processMessage(respondTo, senderName || "ניר", messageText);
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
