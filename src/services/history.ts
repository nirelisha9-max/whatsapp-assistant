import fs from "fs";
import path from "path";
import { ConversationMessage } from "../types";
import logger from "../utils/logger";

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "conversations.json");
const MAX_MESSAGES_PER_CHAT = 20;

// In-memory store: chatId → messages
const store = new Map<string, ConversationMessage[]>();

let flushPending = false;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadHistory(): void {
  ensureDataDir();
  if (!fs.existsSync(HISTORY_FILE)) return;
  try {
    const raw = fs.readFileSync(HISTORY_FILE, "utf-8");
    const data = JSON.parse(raw) as Record<string, ConversationMessage[]>;
    for (const [chatId, messages] of Object.entries(data)) {
      store.set(chatId, messages);
    }
    logger.info(`Loaded conversation history for ${store.size} chats`);
  } catch (err) {
    logger.warn("Could not load conversation history", { err });
  }
}

function flushHistory(): void {
  if (flushPending) return;
  flushPending = true;
  setImmediate(() => {
    try {
      ensureDataDir();
      const data: Record<string, ConversationMessage[]> = {};
      store.forEach((messages, chatId) => {
        data[chatId] = messages;
      });
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
      logger.error("Failed to flush conversation history", { err });
    } finally {
      flushPending = false;
    }
  });
}

export function getHistory(chatId: string): ConversationMessage[] {
  return store.get(chatId) ?? [];
}

export function addMessages(chatId: string, messages: ConversationMessage[]): void {
  const existing = store.get(chatId) ?? [];
  const updated = [...existing, ...messages].slice(-MAX_MESSAGES_PER_CHAT);
  store.set(chatId, updated);
  flushHistory();
}

export function clearHistory(chatId: string): void {
  store.delete(chatId);
  flushHistory();
}
