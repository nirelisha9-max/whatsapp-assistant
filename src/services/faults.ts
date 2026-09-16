import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { Fault } from "../types";
import logger from "../utils/logger";

const DATA_DIR = path.join(process.cwd(), "data");
const FAULTS_FILE = path.join(DATA_DIR, "faults.json");

let faults: Fault[] = [];

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function saveFaults(): void {
  ensureDataDir();
  fs.writeFileSync(FAULTS_FILE, JSON.stringify(faults, null, 2));
}

export function loadFaults(): void {
  ensureDataDir();
  if (!fs.existsSync(FAULTS_FILE)) return;
  try {
    const raw = fs.readFileSync(FAULTS_FILE, "utf-8");
    faults = JSON.parse(raw) as Fault[];
    logger.info(`Loaded ${faults.length} logged faults`);
  } catch (err) {
    logger.warn("Could not load faults", { err });
    faults = [];
  }
}

export function logFault(
  chatId: string,
  description: string,
  reporterName: string,
  location?: string
): Fault {
  const fault: Fault = {
    id: uuidv4(),
    chatId,
    description,
    reporterName,
    location,
    createdAt: new Date().toISOString(),
  };
  faults.push(fault);
  saveFaults();
  logger.info(`Fault logged: ${fault.id}`, { chatId, description });
  return fault;
}

export function listFaults(chatId: string): Fault[] {
  return faults.filter((f) => f.chatId === chatId);
}
