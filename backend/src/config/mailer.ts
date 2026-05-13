import nodemailer from 'nodemailer';
import fs from 'node:fs/promises';

const port = Number(process.env.EMAIL_SMTP_PORT) || 587;
const secure = port === 465;

function normalizePassword(raw: string | undefined): string | undefined {
  if (raw == null || raw === '') return undefined;
  const trimmed = String(raw)
    .trim()
    .replace(/\s/g, '')
    .replace(/^["']|["']$/g, '');
  return trimmed || undefined;
}

export const mailer = nodemailer.createTransport({
  host: (process.env.EMAIL_SMTP_HOST || '').trim() || undefined,
  port,
  secure,
  requireTLS: !secure, // enforce STARTTLS on 587
  // Avoid requests hanging forever when SMTP is unreachable/misconfigured
  connectionTimeout: Number(process.env.EMAIL_SMTP_CONNECTION_TIMEOUT_MS) || 10_000,
  greetingTimeout: Number(process.env.EMAIL_SMTP_GREETING_TIMEOUT_MS) || 10_000,
  socketTimeout: Number(process.env.EMAIL_SMTP_SOCKET_TIMEOUT_MS) || 20_000,
  tls: {
    // Brevo/Gmail require modern TLS; Windows/OpenSSL can default lower without this
    minVersion: 'TLSv1.2',
    servername: (process.env.EMAIL_SMTP_HOST || '').trim() || undefined,
  },
  auth: {
    user: (process.env.EMAIL_SMTP_USER || '').trim() || undefined,
    pass: normalizePassword(process.env.EMAIL_SMTP_PASS),
  },
});

/** From address: prefer EMAIL_FROM_ADDRESS, fallback to SMTP user (e.g. Gmail same as sender). Trimmed. */
export function getFromAddress(): string {
  const raw = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_SMTP_USER || '';
  return raw.trim();
}

/** Whether enough env is set to attempt sending (host + user + pass + from) */
export function isMailConfigured(): boolean {
  const from = getFromAddress();
  const hasBrevoKey = !!(process.env.BREVO_API_KEY && String(process.env.BREVO_API_KEY).trim());
  const hasSmtp =
    !!process.env.EMAIL_SMTP_HOST && !!process.env.EMAIL_SMTP_USER && !!process.env.EMAIL_SMTP_PASS;
  return !!(from && (hasBrevoKey || hasSmtp));
}

/** Verify SMTP connection (call on startup to fail fast if Gmail/App Password is wrong). */
export function verifyMailConnection(): Promise<void> {
  const hasBrevoKey = !!(process.env.BREVO_API_KEY && String(process.env.BREVO_API_KEY).trim());
  if (hasBrevoKey) {
    // Brevo API: validate the key by calling account endpoint
    return fetch('https://api.brevo.com/v3/account', {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'api-key': String(process.env.BREVO_API_KEY).trim(),
      },
    }).then(async res => {
      if (res.ok) return;
      const body = await res.text().catch(() => '');
      throw new Error(`Brevo API verification failed (${res.status}): ${body || res.statusText}`);
    });
  }
  return mailer.verify().then(() => {});
}

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content?: Buffer;
    path?: string;
    contentType?: string;
  }>;
};

function parseRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : String(to).split(/[,\s]+/);
  return list.map(x => String(x).trim()).filter(Boolean);
}

async function sendViaBrevo(input: SendEmailInput): Promise<void> {
  const apiKey = String(process.env.BREVO_API_KEY || '').trim();
  if (!apiKey) throw new Error('BREVO_API_KEY is not set');
  const senderEmail = getFromAddress();
  const senderName = (process.env.EMAIL_FROM_NAME || '').trim() || 'Cafe Chapter 1';
  const recipients = parseRecipients(input.to).map(email => ({ email }));
  if (!senderEmail) throw new Error('EMAIL_FROM_ADDRESS is not set');
  if (!recipients.length) throw new Error('No recipients provided');

  const attachments =
    input.attachments && input.attachments.length
      ? await Promise.all(
          input.attachments.map(async a => {
            const bytes = a.content ?? (a.path ? await fs.readFile(a.path) : Buffer.from(''));
            if (!bytes || bytes.length === 0) {
              throw new Error(`Attachment is empty: ${a.filename}`);
            }
            return {
              name: a.filename,
              content: Buffer.from(bytes).toString('base64'),
            };
          })
        )
      : undefined;

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: recipients,
    subject: input.subject,
    ...(input.html ? { htmlContent: input.html } : {}),
    ...(input.text ? { textContent: input.text } : {}),
    ...(attachments ? { attachment: attachments } : {}),
  };

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    console.log('[mailer] Brevo send success:', data);
    return;
  }
  const body = await res.text().catch(() => '');
  console.error(`[mailer] Brevo send failed (${res.status}):`, body || res.statusText);
  throw new Error(`Brevo send failed (${res.status}): ${body || res.statusText}`);
}

/**
 * Send email using Brevo API when BREVO_API_KEY is set; otherwise fallback to SMTP (Nodemailer).
 * This avoids SMTP timeouts on platforms that block outbound SMTP ports.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const hasBrevoKey = !!(process.env.BREVO_API_KEY && String(process.env.BREVO_API_KEY).trim());
  if (hasBrevoKey) {
    await sendViaBrevo(input);
    return;
  }
  const fromName = (process.env.EMAIL_FROM_NAME || '').trim() || 'Cafe Chapter 1';
  try {
    const info = await mailer.sendMail({
      to: Array.isArray(input.to) ? input.to : input.to,
      from: `"${fromName}" <${getFromAddress()}>`,
      subject: input.subject,
      ...(input.text ? { text: input.text } : {}),
      ...(input.html ? { html: input.html } : {}),
      ...(input.attachments ? { attachments: input.attachments } : {}),
    });
    console.log('[mailer] SMTP send success:', info.messageId);
  } catch (err) {
    console.error('[mailer] SMTP send failed:', err);
    throw err;
  }
}
