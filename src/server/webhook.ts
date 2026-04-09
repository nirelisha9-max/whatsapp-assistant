import { Router, Request, Response } from "express";
import { WebhookPayload } from "../types";
import { processMessage } from "../agent/claude";
import logger from "../utils/logger";

export const webhookRouter = Router();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;
const INSTANCE_ID = parseInt(process.env.GREEN_API_INSTANCE!, 10);
const OWNER_PHONE = process.env.OWNER_PHONE!;

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

  // Extract text
  const msgData = payload.messageData;
  let text = msgData?.textMessageData?.textMessage
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
    }
  });
});
