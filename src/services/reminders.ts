import fs from "fs";
import path from "path";
import * as schedule from "node-schedule";
import { v4 as uuidv4 } from "uuid";
import { Reminder } from "../types";
import { sendMessage } from "./whatsapp";
import logger from "../utils/logger";

const DATA_DIR = path.join(process.cwd(), "data");
const REMINDERS_FILE = path.join(DATA_DIR, "reminders.json");

// In-memory store: id → { reminder, job }
const activeJobs = new Map<string, schedule.Job>();
let reminders: Reminder[] = [];

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function saveReminders(): void {
  ensureDataDir();
  fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2));
}

function scheduleJob(reminder: Reminder): void {
  const fireAt = new Date(reminder.scheduledAt);
  if (fireAt <= new Date()) return; // already past

  const job = schedule.scheduleJob(reminder.id, fireAt, async () => {
    logger.info(`Firing reminder ${reminder.id}`, { chatId: reminder.chatId });
    try {
      await sendMessage(reminder.chatId, `⏰ תזכורת: ${reminder.message}`);
    } catch (err) {
      logger.error("Failed to send reminder", { id: reminder.id, err });
    }
    // Mark as fired
    const r = reminders.find((r) => r.id === reminder.id);
    if (r) r.fired = true;
    activeJobs.delete(reminder.id);
    saveReminders();
  });

  if (job) {
    activeJobs.set(reminder.id, job);
  }
}

export function loadReminders(): void {
  ensureDataDir();
  if (!fs.existsSync(REMINDERS_FILE)) return;
  try {
    const raw = fs.readFileSync(REMINDERS_FILE, "utf-8");
    reminders = JSON.parse(raw) as Reminder[];

    let rehydrated = 0;
    let skipped = 0;
    for (const r of reminders) {
      if (!r.fired && !r.cancelled && new Date(r.scheduledAt) > new Date()) {
        scheduleJob(r);
        rehydrated++;
      } else {
        skipped++;
      }
    }
    logger.info(`Reminders loaded: ${rehydrated} scheduled, ${skipped} skipped`);
  } catch (err) {
    logger.warn("Could not load reminders", { err });
    reminders = [];
  }
}

export function setReminder(
  chatId: string,
  message: string,
  scheduledAt: string
): Reminder {
  const reminder: Reminder = {
    id: uuidv4(),
    chatId,
    message,
    scheduledAt,
    createdAt: new Date().toISOString(),
    cancelled: false,
    fired: false,
  };

  reminders.push(reminder);
  scheduleJob(reminder);
  saveReminders();
  logger.info(`Reminder set: ${reminder.id}`, { scheduledAt, message });
  return reminder;
}

export function listReminders(chatId: string): Reminder[] {
  return reminders.filter(
    (r) => r.chatId === chatId && !r.fired && !r.cancelled && new Date(r.scheduledAt) > new Date()
  );
}

export function cancelReminder(chatId: string, reminderId: string): boolean {
  const reminder = reminders.find(
    (r) => r.id === reminderId && r.chatId === chatId && !r.fired && !r.cancelled
  );
  if (!reminder) return false;

  reminder.cancelled = true;
  const job = activeJobs.get(reminderId);
  if (job) {
    job.cancel();
    activeJobs.delete(reminderId);
  }
  saveReminders();
  logger.info(`Reminder cancelled: ${reminderId}`);
  return true;
}
