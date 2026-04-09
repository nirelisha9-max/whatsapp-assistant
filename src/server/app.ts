import express from "express";
import { webhookRouter } from "./webhook";
import logger from "../utils/logger";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use("/webhook", webhookRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Unhandled error", { err: err.message });
  res.status(500).json({ error: "Internal server error" });
});

export default app;
