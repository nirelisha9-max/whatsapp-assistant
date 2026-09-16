import dotenv from "dotenv";
dotenv.config();

import app from "./server/app";
import { loadReminders } from "./services/reminders";
import { loadHistory } from "./services/history";
import { loadFaults } from "./services/faults";
import logger from "./utils/logger";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main() {
  // Load persisted data
  loadHistory();
  loadReminders();
  loadFaults();

  // Start HTTP server
  app.listen(PORT, () => {
    logger.info(`WhatsApp assistant running on port ${PORT}`);
    logger.info(`Webhook URL: http://localhost:${PORT}/webhook/${process.env.WEBHOOK_SECRET}`);
  });

  process.on("SIGTERM", () => {
    logger.info("Shutting down...");
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error("Fatal error", { err });
  process.exit(1);
});
