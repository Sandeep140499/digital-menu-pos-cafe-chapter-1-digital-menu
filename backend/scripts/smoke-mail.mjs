import { mailer, getFromAddress, isMailConfigured } from "../dist/config/mailer.js";

const to = process.env.EMAIL_SMTP_TEST_TO || process.env.EMAIL_FROM_ADDRESS;
if (!to) {
  console.error("No recipient configured. Set EMAIL_SMTP_TEST_TO or EMAIL_FROM_ADDRESS.");
  process.exit(1);
}

if (!isMailConfigured()) {
  console.error("Mail is not configured. Set EMAIL_SMTP_* and EMAIL_FROM_ADDRESS in .env.");
  process.exit(1);
}

const fromName =
  process.env.EMAIL_FROM_NAME || "Cafe Chapter 1 Restro Private Limited";
const from = `"${fromName}" <${getFromAddress()}>`;

try {
  const info = await mailer.sendMail({
    to,
    from,
    subject: `Mail test - ${fromName}`,
    text: "SMTP test message",
  });
  console.log("Sent", info?.messageId || "(no messageId)");
} catch (e) {
  console.error("Send failed", e?.code || e?.message || e);
  console.error(e);
  process.exit(1);
}

