import nodemailer from "nodemailer";

const port = Number(process.env.EMAIL_SMTP_PORT) || 587;
const secure = port === 465;

function normalizePassword(raw: string | undefined): string | undefined {
  if (raw == null || raw === "") return undefined;
  const trimmed = String(raw).trim().replace(/\s/g, "").replace(/^["']|["']$/g, "");
  return trimmed || undefined;
}

export const mailer = nodemailer.createTransport({
  host: (process.env.EMAIL_SMTP_HOST || "").trim() || undefined,
  port,
  secure,
  // Avoid requests hanging forever when SMTP is unreachable/misconfigured
  connectionTimeout: Number(process.env.EMAIL_SMTP_CONNECTION_TIMEOUT_MS) || 10_000,
  greetingTimeout: Number(process.env.EMAIL_SMTP_GREETING_TIMEOUT_MS) || 10_000,
  socketTimeout: Number(process.env.EMAIL_SMTP_SOCKET_TIMEOUT_MS) || 20_000,
  auth: {
    user: (process.env.EMAIL_SMTP_USER || "").trim() || undefined,
    pass: normalizePassword(process.env.EMAIL_SMTP_PASS),
  },
});

/** From address: prefer EMAIL_FROM_ADDRESS, fallback to SMTP user (e.g. Gmail same as sender). Trimmed. */
export function getFromAddress(): string {
  const raw = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_SMTP_USER || "";
  return raw.trim();
}

/** Whether enough env is set to attempt sending (host + user + pass + from) */
export function isMailConfigured(): boolean {
  const from = getFromAddress();
  return !!(
    process.env.EMAIL_SMTP_HOST &&
    process.env.EMAIL_SMTP_USER &&
    process.env.EMAIL_SMTP_PASS &&
    from
  );
}

/** Verify SMTP connection (call on startup to fail fast if Gmail/App Password is wrong). */
export function verifyMailConnection(): Promise<void> {
  return mailer.verify().then(() => {});
}

