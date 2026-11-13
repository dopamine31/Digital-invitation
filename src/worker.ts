import "dotenv/config";
import { startWorker, retryPendingWebhooks } from "@/server/jobs";
import { logger } from "@/lib/logger";

startWorker();
void retryPendingWebhooks();
setInterval(() => { void retryPendingWebhooks(); }, 60_000).unref();
logger.info("Rasa Undangan worker berjalan", {});
