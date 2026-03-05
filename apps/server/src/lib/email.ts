export async function sendEmail(to: string, subject: string, content: string): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    console.log("=== EMAIL ===");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content: ${content}`);
    console.log("=============");
    return;
  }

  throw new Error(
    `Email sending is not implemented in production. Tried to send to ${to} with subject "${subject}".`,
  );
}
