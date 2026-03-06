import { logger } from "@sellsnap/logger";

export async function sendEmail(to: string, subject: string, content: string): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    logger.box({
      title: "EMAIL",
      message: `To: ${to}\nSubject: ${subject}\n\n${content}`,
    });
    return;
  }

  logger.warn(`Email service not configured. Would send to ${to}: "${subject}"`);
}
