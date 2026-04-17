import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { isMailConfigured, sendEmail } from '../../config/mailer.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { getFrontendBaseUrl } from '../../config/frontendUrl.js';

const requestVerifySchema = z.object({
  email: z.string().email(),
});
const requestRemoveSchema = z.object({
  email: z.string().email(),
});

function parseDirectorsEmail(s: string | null): string[] {
  if (!s || !s.trim()) return [];
  return s
    .split(/[,\s]+/)
    .map(e => e.trim())
    .filter(e => e.length > 0);
}

function joinDirectorsEmail(list: string[]): string {
  return list.filter(Boolean).join(', ');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** GET /api/branches/:id/directors – list verified, pending verification, pending removal */
export const directorRouter = Router({ mergeParams: true });

directorRouter.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  const branchId = Number(req.params.id);
  if (!branchId || Number.isNaN(branchId)) {
    return res.status(400).json({ message: 'Invalid branch id' });
  }
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: {
      directorVerifications: true,
      directorRemovalRequests: true,
    },
  });
  if (!branch) return res.status(404).json({ message: 'Branch not found' });

  const verified = parseDirectorsEmail(branch.directorsEmail);
  const pendingVerification = branch.directorVerifications
    .filter(v => v.expiresAt > new Date())
    .map(v => ({ email: v.email, expiresAt: v.expiresAt.toISOString() }));
  const pendingRemoval = branch.directorRemovalRequests
    .filter(r => r.expiresAt > new Date())
    .map(r => ({ email: r.email, expiresAt: r.expiresAt.toISOString() }));

  return res.json({
    verified,
    pendingVerification,
    pendingRemoval,
  });
});

/** POST /api/branches/:id/directors/request-verify – send verification email to director */
directorRouter.post('/request-verify', authenticate, requireRole('ADMIN'), async (req, res) => {
  const branchId = Number(req.params.id);
  const parsed = requestVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }
  const { email } = parsed.data;
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) return res.status(404).json({ message: 'Branch not found' });

  const verified = parseDirectorsEmail(branch.directorsEmail);
  if (verified.includes(email.toLowerCase())) {
    return res.status(400).json({ message: 'This email is already a verified director.' });
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await prisma.directorVerification.upsert({
    where: {
      branchId_email: { branchId, email: email.toLowerCase() },
    },
    create: { branchId, email: email.toLowerCase(), token, expiresAt },
    update: { token, expiresAt },
  });

  if (!isMailConfigured()) {
    return res.status(503).json({ message: 'Email is not configured. Set EMAIL_SMTP_* in .env.' });
  }

  const baseUrl = getFrontendBaseUrl();
  const verifyUrl = `${baseUrl}/api/directors/verify?token=${encodeURIComponent(token)}`;
  const fromName = process.env.EMAIL_FROM_NAME || 'Chapter One Cafe';

  try {
    await sendEmail({
      to: email,
      subject: `Verify your director email – ${branch.name}`,
      text: `You have been added as a director for ${branch.name}.\n\nClick the link below to verify your email. Once verified, you will receive salary slip copies and other notifications.\n\n${verifyUrl}\n\nThis link expires in 24 hours. If you did not request this, ignore this email.`,
      html: `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;"><p>You have been added as a director for <strong>${branch.name}</strong>.</p><p>Click the button below to verify your email. Once verified, you will receive salary slip copies and other notifications.</p><p><a href="${verifyUrl}" style="display:inline-block;background:#047857;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;">Verify my email</a></p><p style="color:#666;font-size:14px;">Or copy this link: ${verifyUrl}</p><p style="color:#999;font-size:12px;">This link expires in 24 hours. If you did not request this, ignore this email.</p></body></html>`,
    });
  } catch (e: unknown) {
    console.error('Director verification email failed:', (e as Error)?.message ?? e);
    return res.status(500).json({ message: 'Failed to send verification email.' });
  }

  return res.json({
    message: 'Verification email sent. Director must click the link to be added.',
  });
});

/** POST /api/branches/:id/directors/request-remove – send removal confirmation email to director */
directorRouter.post('/request-remove', authenticate, requireRole('ADMIN'), async (req, res) => {
  const branchId = Number(req.params.id);
  const parsed = requestRemoveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }
  const { email } = parsed.data;
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) return res.status(404).json({ message: 'Branch not found' });

  const verified = parseDirectorsEmail(branch.directorsEmail);
  if (!verified.includes(email.toLowerCase())) {
    return res
      .status(400)
      .json({ message: 'This email is not a verified director for this branch.' });
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.directorRemovalRequest.upsert({
    where: {
      branchId_email: { branchId, email: email.toLowerCase() },
    },
    create: { branchId, email: email.toLowerCase(), token, expiresAt },
    update: { token, expiresAt },
  });

  if (!isMailConfigured()) {
    return res.status(503).json({ message: 'Email is not configured. Set EMAIL_SMTP_* in .env.' });
  }

  const baseUrl = getFrontendBaseUrl();
  const confirmUrl = `${baseUrl}/api/directors/confirm-removal?token=${encodeURIComponent(token)}`;
  const fromName = process.env.EMAIL_FROM_NAME || 'Chapter One Cafe';

  try {
    await sendEmail({
      to: email,
      subject: `Confirm removal as director – ${branch.name}`,
      text: `You have been requested to be removed as a director for ${branch.name}.\n\nIf you want to be removed (you will no longer receive salary slip copies and director notifications), click the link below:\n\n${confirmUrl}\n\nIf you do NOT want to be removed, ignore this email and you will remain a director.\n\nThis link expires in 7 days.`,
      html: `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;"><p>You have been requested to be removed as a director for <strong>${branch.name}</strong>.</p><p>If you want to be removed (you will no longer receive salary slip copies and director notifications), click the button below:</p><p><a href="${confirmUrl}" style="display:inline-block;background:#b91c1c;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;">Yes, remove me as director</a></p><p style="color:#666;font-size:14px;">Or copy this link: ${confirmUrl}</p><p style="color:#999;font-size:12px;">If you do NOT want to be removed, ignore this email and you will remain a director. This link expires in 7 days.</p></body></html>`,
    });
  } catch (e: unknown) {
    console.error('Director removal email failed:', (e as Error)?.message ?? e);
    return res.status(500).json({ message: 'Failed to send removal confirmation email.' });
  }

  return res.json({
    message: 'Removal email sent. Director must click the link to confirm removal.',
  });
});

// ----- Public routes (no auth): director clicks link in email -----

/** GET /api/directors/verify?token=xxx – director verifies email; add to branch.directorsEmail */
export const directorPublicRouter = Router();

directorPublicRouter.get('/verify', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (!token) {
    return res
      .status(400)
      .send(
        "<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem;'><h1>Invalid link</h1><p>Missing token. Use the link from your verification email.</p></body></html>"
      );
  }
  const verification = await prisma.directorVerification.findUnique({
    where: { token },
    include: { branch: true },
  });
  if (!verification || verification.expiresAt < new Date()) {
    return res
      .status(400)
      .send(
        "<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem;'><h1>Link expired or invalid</h1><p>Verification links expire after 24 hours. Ask the admin to send a new verification email.</p></body></html>"
      );
  }
  const current = parseDirectorsEmail(verification.branch.directorsEmail);
  const email = verification.email.toLowerCase();
  if (!current.includes(email)) {
    current.push(email);
    await prisma.branch.update({
      where: { id: verification.branchId },
      data: { directorsEmail: joinDirectorsEmail(current) },
    });
  }
  await prisma.directorVerification.delete({ where: { id: verification.id } });

  const branchName = escapeHtml(verification.branch.name);
  return res.send(
    `<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem;text-align:center;'><h1>Email verified</h1><p>Your email has been verified as a director for <strong>${branchName}</strong>. You will receive salary slip copies and other notifications at this address.</p></body></html>`
  );
});

/** GET /api/directors/confirm-removal?token=xxx – director confirms removal; remove from branch.directorsEmail */
directorPublicRouter.get('/confirm-removal', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (!token) {
    return res
      .status(400)
      .send(
        "<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem;'><h1>Invalid link</h1><p>Missing token. Use the link from your removal email.</p></body></html>"
      );
  }
  const removal = await prisma.directorRemovalRequest.findUnique({
    where: { token },
    include: { branch: true },
  });
  if (!removal || removal.expiresAt < new Date()) {
    return res
      .status(400)
      .send(
        "<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem;'><h1>Link expired or invalid</h1><p>Removal links expire after 7 days. If you still want to be removed, ask the admin to send a new removal email.</p></body></html>"
      );
  }
  const current = parseDirectorsEmail(removal.branch.directorsEmail).filter(
    e => e.toLowerCase() !== removal.email.toLowerCase()
  );
  await prisma.branch.update({
    where: { id: removal.branchId },
    data: { directorsEmail: joinDirectorsEmail(current) },
  });
  await prisma.directorRemovalRequest.delete({ where: { id: removal.id } });

  const branchName = escapeHtml(removal.branch.name);
  return res.send(
    `<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem;text-align:center;'><h1>You have been removed</h1><p>You are no longer a director for <strong>${branchName}</strong>. You will not receive further director notifications at this email.</p></body></html>`
  );
});
