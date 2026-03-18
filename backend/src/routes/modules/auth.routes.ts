import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { jwtConfig } from "../../config/auth.js";
import { isMailConfigured, sendEmail } from "../../config/mailer.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import {
  clearAuthCookies,
  generateCsrfToken,
  generateOpaqueToken,
  hashRefreshToken,
  requireCsrfDoubleSubmit,
  setAuthCookies,
} from "../../utils/authTokens.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  loginAs: z.enum(["admin", "employee"]).optional(), // when "employee", try employee first (same email can exist as both)
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getAdminPasswordChangeNotificationContent(
  newPassword: string,
  fromName: string,
): { html: string; text: string } {
  const pass = escapeHtml(newPassword);
  const brand = escapeHtml(fromName);

  const text = [
    "Admin dashboard password updated",
    "",
    "The administrator has changed the dashboard login password. Please store these credentials securely.",
    "",
    `New password: ${newPassword}`,
    "",
    "Use this password to sign in to the admin dashboard.",
    "",
    `— ${fromName}`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin password updated – ${brand}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;">
    <tr>
      <td style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px; margin:0 auto; background-color:#ffffff; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding:40px 40px 32px; text-align:center; border-bottom:1px solid #e5e7eb;">
              <h1 style="margin:0; font-size:22px; font-weight:600; color:#111827;">${brand}</h1>
              <p style="margin:8px 0 0; font-size:14px; color:#6b7280;">Admin notification</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 12px; font-size:14px; font-weight:600; color:#047857;">Dashboard password updated</p>
              <p style="margin:0 0 24px; font-size:16px; line-height:1.6; color:#374151;">The administrator has changed the dashboard login password. Please store these credentials securely.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px; background-color:#f0fdf4; border-radius:8px; border:1px solid #bbf7d0;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 8px; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px;">New dashboard password</p>
                    <p style="margin:0; font-size:15px; color:#111827;"><span style="font-family:monospace; background:#dcfce7; padding:4px 12px; border-radius:4px;">${pass}</span></p>
                  </td>
                </tr>
              </table>
              <p style="margin:0; font-size:14px; color:#6b7280;">Use this password to sign in to the admin dashboard.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px; border-top:1px solid #e5e7eb;">
              <p style="margin:0; font-size:13px; color:#9ca3af;">— ${brand}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text };
}

export const authRouter = Router();

function signAccessToken(payload: { id: number; role: "ADMIN" | "EMPLOYEE" }) {
  return jwt.sign(payload, jwtConfig.secret as string, {
    expiresIn: jwtConfig.accessExpiresIn,
  } as SignOptions);
}

function parseExpiresToMs(expiresIn: string): number {
  // Supports formats used in this repo: "15m", "7d", "1h", or seconds as string.
  const trimmed = String(expiresIn).trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const m = trimmed.match(/^(\d+)\s*([smhd])$/i);
  if (!m) throw new Error(`Unsupported expiresIn format: ${expiresIn}`);
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  switch (unit) {
    case "s":
      return n * 1000;
    case "m":
      return n * 60_000;
    case "h":
      return n * 3_600_000;
    case "d":
      return n * 86_400_000;
    default:
      throw new Error(`Unsupported expiresIn format: ${expiresIn}`);
  }
}

async function issueSession(
  req: any,
  res: any,
  user: { id: number; role: "ADMIN" | "EMPLOYEE" },
) {
  const accessToken = signAccessToken({ id: user.id, role: user.role });

  const refreshToken = generateOpaqueToken(32);
  const csrfToken = generateCsrfToken();
  const refreshExpiresAt = new Date(Date.now() + parseExpiresToMs(jwtConfig.refreshExpiresIn));

  const tokenHash = hashRefreshToken(refreshToken);
  try {
    await prisma.refreshToken.create({
      data: {
        tokenHash,
        role: user.role,
        expiresAt: refreshExpiresAt,
        ...(user.role === "ADMIN" ? { adminId: user.id } : { employeeId: user.id }),
        userAgent: String(req.headers["user-agent"] || ""),
        ip: (
          (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
          req.socket.remoteAddress
        ) ?? undefined,
      },
    });

    setAuthCookies(req as any, res as any, { refreshToken, csrfToken, refreshExpiresAt });
  } catch (e: unknown) {
    // If migrations haven't been applied yet, keep legacy behavior: access token only.
    // This prevents login from breaking in existing deployments.
    const code = (e as { code?: string } | null)?.code;
    if (code !== "P2021") {
      throw e;
    }
  }
  return res.json({ accessToken, role: user.role });
}

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.issues });
  }
  const { email, password, loginAs } = parsed.data;

  const tryEmployeeLogin = async () => {
    const employee = await prisma.employee.findUnique({ where: { email } });
    if (!employee) return null;
    const ok = await bcrypt.compare(password, employee.passwordHash);
    if (!ok) return null;
    if (!employee.emailVerified) {
      res.status(403).json({ message: "Please verify your email before logging in." });
      return "handled";
    }
    await issueSession(req as any, res as any, { id: employee.id, role: "EMPLOYEE" });
    return "handled" as const;
  };

  // When loginAs === "employee", try only employee (so same email can log in as employee with employee password)
  if (loginAs === "employee") {
    const done = await tryEmployeeLogin();
    if (done === "handled") return;
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Default: try admin first, then employee
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (admin) {
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (ok) {
      return await issueSession(req as any, res as any, { id: admin.id, role: "ADMIN" });
    }
  }

  const employee = await prisma.employee.findUnique({ where: { email } });
  if (!employee) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, employee.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (!employee.emailVerified) {
    return res
      .status(403)
      .json({ message: "Please verify your email before logging in." });
  }

  return await issueSession(req as any, res as any, { id: employee.id, role: "EMPLOYEE" });
});

authRouter.post("/refresh", async (req, res) => {
  if (!requireCsrfDoubleSubmit(req as any)) {
    return res.status(403).json({ message: "CSRF check failed" });
  }

  const raw = (req as any).cookies?.rt as string | undefined;
  if (!raw) {
    return res.status(401).json({ message: "Missing refresh token" });
  }

  const tokenHash = hashRefreshToken(raw);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing || existing.revokedAt || existing.expiresAt <= new Date()) {
    clearAuthCookies(req as any, res as any);
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const role = existing.role as "ADMIN" | "EMPLOYEE";
  const userId = role === "ADMIN" ? existing.adminId : existing.employeeId;
  if (!userId) {
    clearAuthCookies(req as any, res as any);
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  // Rotate refresh token
  const newRefreshToken = generateOpaqueToken(32);
  const newCsrfToken = generateCsrfToken();
  const refreshExpiresAt = new Date(Date.now() + parseExpiresToMs(jwtConfig.refreshExpiresIn));

  const created = await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(newRefreshToken),
      role,
      expiresAt: refreshExpiresAt,
      ...(role === "ADMIN" ? { adminId: userId } : { employeeId: userId }),
      userAgent: String(req.headers["user-agent"] || ""),
      ip:
        (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        null,
    },
  });

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), replacedByTokenId: created.id },
  });

  setAuthCookies(req as any, res as any, {
    refreshToken: newRefreshToken,
    csrfToken: newCsrfToken,
    refreshExpiresAt,
  });

  const accessToken = signAccessToken({ id: userId, role });
  return res.json({ accessToken, role });
});

authRouter.post("/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.issues });
  }
  const { email } = parsed.data;

  const admin = await prisma.admin.findUnique({ where: { email } });
  const employee = !admin
    ? await prisma.employee.findUnique({ where: { email } })
    : null;

  // Security rule: only verified employee emails can request a reset.
  if (employee && !employee.emailVerified) {
    return res.status(403).json({
      message: "Please verify your email first before resetting your password.",
    });
  }

  if (!admin && !employee) {
    return res.json({
      message: "If this email exists, a reset link has been sent.",
    });
  }

  const role = admin ? "ADMIN" : "EMPLOYEE";
  const userId = (admin ?? employee)!.id;

  const token = jwt.sign(
    { id: userId, role, type: "RESET" },
    jwtConfig.secret as string,
    { expiresIn: "1h" } as SignOptions,
  );

  const baseUrl =
    process.env.FRONTEND_DASHBOARD_URL ||
    process.env.FRONTEND_CUSTOMER_URL ||
    "http://localhost:5173";
  const resetUrl = `${baseUrl.replace(
    /\/$/,
    "",
  )}/reset-password?token=${encodeURIComponent(token)}`;

  if (!isMailConfigured()) {
    return res.status(503).json({
      message: "Email is not configured. Contact the administrator to set up SMTP in .env (EMAIL_SMTP_HOST, EMAIL_SMTP_USER, EMAIL_SMTP_PASS, EMAIL_FROM_ADDRESS).",
    });
  }

  try {
    await sendEmail({
      to: email,
      subject: "Reset your password",
      text: `You requested a password reset.

If you did not request this, ignore this email.

Reset link (valid for 1 hour):
${resetUrl}
`,
    });
  } catch (err) {
    // ignore email errors (don't reveal internals)
  }

  return res.json({
    message: "If this email exists, a reset link has been sent.",
  });
});

authRouter.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.issues });
  }

  const { token, newPassword } = parsed.data;

  try {
    const decoded = jwt.verify(
      token,
      jwtConfig.secret as string,
    ) as { id: number; role: "ADMIN" | "EMPLOYEE"; type?: string };

    if (decoded.type !== "RESET") {
      return res.status(400).json({ message: "Invalid reset token" });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    if (decoded.role === "ADMIN") {
      await prisma.admin.update({
        where: { id: decoded.id },
        data: { passwordHash: hash },
      });
    } else {
      await prisma.employee.update({
        where: { id: decoded.id },
        data: { passwordHash: hash },
      });
    }

    return res.json({ message: "Password reset successfully" });
  } catch {
    return res.status(400).json({ message: "Invalid or expired token" });
  }
});

// Admin: change own dashboard password (requires current password)
authRouter.post(
  "/change-password",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.issues });
    }

    const adminId = req.user!.id;
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const ok = await bcrypt.compare(parsed.data.currentPassword, admin.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.admin.update({
      where: { id: adminId },
      data: { passwordHash },
    });

    const newPassword = parsed.data.newPassword;
    const fromName = process.env.EMAIL_FROM_NAME || "Chapter One Cafe";

    // Notify all directors (from every branch's directorsEmail in Branch Settings)
    if (isMailConfigured()) {
      try {
        const branches = await prisma.branch.findMany({
          select: { directorsEmail: true },
        });
        const directorEmails = [
          ...new Set(
            branches.flatMap((b) =>
              (b.directorsEmail || "")
                .split(/[,\s]+/)
                .map((e) => e.trim())
                .filter((e) => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
            ),
          ),
        ];
        if (directorEmails.length > 0) {
          const { html, text } = getAdminPasswordChangeNotificationContent(newPassword, fromName);
          await sendEmail({ to: directorEmails, subject: "Admin dashboard password updated", text, html });
        }
      } catch (e: unknown) {
        // Password was updated; don't fail the request
      }
    }

    return res.json({ message: "Password updated successfully" });
  },
);

// Placeholder logout – stateless JWT, so just let frontend clear token
authRouter.post("/logout", async (req, res) => {
  if (!requireCsrfDoubleSubmit(req as any)) {
    return res.status(403).json({ message: "CSRF check failed" });
  }

  const raw = (req as any).cookies?.rt as string | undefined;
  if (raw) {
    const tokenHash = hashRefreshToken(raw);
    const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (existing && !existing.revokedAt) {
      await prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  clearAuthCookies(req as any, res as any);
  return res.json({ message: "Logged out" });
});

