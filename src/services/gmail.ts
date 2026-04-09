import { google } from "googleapis";
import { getGoogleAuth } from "./googleAuth";
import { EmailSummary } from "../types";
import logger from "../utils/logger";

function getGmail() {
  return google.gmail({ version: "v1", auth: getGoogleAuth() });
}

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractBody(payload: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64(payload.body.data).substring(0, 500);
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts as typeof payload[]) {
      const text = extractBody(part);
      if (text) return text;
    }
  }

  return "";
}

function getHeader(headers: { name?: string | null; value?: string | null }[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function readEmails(query = "is:unread", maxResults = 10): Promise<EmailSummary[]> {
  const gmail = getGmail();
  maxResults = Math.min(maxResults, 20);

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  const messages = listRes.data.messages ?? [];
  if (messages.length === 0) return [];

  const summaries: EmailSummary[] = [];

  for (const msg of messages) {
    if (!msg.id) continue;
    try {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      });

      const headers = full.data.payload?.headers ?? [];
      const subject = getHeader(headers, "subject") || "(ללא נושא)";
      const from = getHeader(headers, "from");
      const date = getHeader(headers, "date");
      const snippet = full.data.snippet ?? "";
      const body = extractBody(full.data.payload as Parameters<typeof extractBody>[0] ?? {});

      summaries.push({
        id: msg.id,
        threadId: msg.threadId ?? "",
        subject,
        from,
        date,
        snippet,
        body,
      });
    } catch (err) {
      logger.warn("Failed to fetch email", { id: msg.id, err });
    }
  }

  return summaries;
}

export async function searchEmails(query: string, maxResults = 10): Promise<EmailSummary[]> {
  return readEmails(query, maxResults);
}

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const gmail = getGmail();

  const profileRes = await gmail.users.getProfile({ userId: "me" });
  const from = profileRes.data.emailAddress ?? "me";

  const raw = Buffer.from(
    `From: ${from}\r\nTo: ${to}\r\nSubject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}`
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  logger.info("Email sent", { to, subject });
}
