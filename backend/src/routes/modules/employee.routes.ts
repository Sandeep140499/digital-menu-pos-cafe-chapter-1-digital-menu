import { Router } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { getFromAddress, isMailConfigured, sendEmail } from "../../config/mailer.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import path from "node:path";
import fs from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getVerifyEmployeeEmailContent(params: {
  employeeName: string;
  employeeCode: string;
  employeeEmail: string;
  temporaryPassword: string;
  loginUrl: string;
  fromName: string;
}): { html: string; text: string } {
  const { employeeName, employeeCode, employeeEmail, temporaryPassword, loginUrl, fromName } = params;
  const n = escapeHtml(employeeName);
  const code = escapeHtml(employeeCode);
  const email = escapeHtml(employeeEmail);
  const pass = escapeHtml(temporaryPassword);
  const brand = escapeHtml(fromName);

  const text = [
    `Dear ${employeeName},`,
    "",
    `Welcome to ${fromName}. Your employee account has been verified and is ready to use.`,
    "",
    "Your login credentials:",
    `  Employee Code: ${employeeCode}`,
    `  Email: ${employeeEmail}`,
    `  Temporary Password: ${temporaryPassword}`,
    "",
    "Please sign in using the link below and change your password after your first login.",
    "",
    `Login: ${loginUrl}`,
    "",
    "If you did not request this account, please contact your administrator.",
    "",
    `— ${fromName}`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ${brand} Employee Account</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;">
    <tr>
      <td style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px; margin:0 auto; background-color:#ffffff; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding:40px 40px 32px; text-align:center; border-bottom:1px solid #e5e7eb;">
              <h1 style="margin:0; font-size:22px; font-weight:600; color:#111827;">${brand}</h1>
              <p style="margin:8px 0 0; font-size:14px; color:#6b7280;">Employee Portal</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#374151;">Dear <strong>${n}</strong>,</p>
              <p style="margin:0 0 24px; font-size:16px; line-height:1.6; color:#374151;">Welcome to <strong>${brand}</strong>. Your employee account has been verified and is ready to use.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px; background-color:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px;">Your login credentials</p>
                    <p style="margin:0 0 8px; font-size:15px; color:#111827;"><strong>Employee Code:</strong> <span style="font-family:monospace; background:#e5e7eb; padding:2px 8px; border-radius:4px;">${code}</span></p>
                    <p style="margin:0 0 8px; font-size:15px; color:#111827;"><strong>Email:</strong> ${email}</p>
                    <p style="margin:0; font-size:15px; color:#111827;"><strong>Temporary Password:</strong> <span style="font-family:monospace; background:#e5e7eb; padding:2px 8px; border-radius:4px;">${pass}</span></p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#374151;">Please sign in using the button below and change your password after your first login.</p>
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="border-radius:8px; background-color:#047857;">
                    <a href="${escapeHtml(loginUrl)}" style="display:inline-block; padding:14px 28px; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none;">Sign in to your account</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0; font-size:14px; color:#6b7280;">Or copy this link: <a href="${escapeHtml(loginUrl)}" style="color:#047857; text-decoration:none;">${escapeHtml(loginUrl)}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px; border-top:1px solid #e5e7eb;">
              <p style="margin:0; font-size:13px; color:#9ca3af;">If you did not request this account, please contact your administrator.</p>
              <p style="margin:12px 0 0; font-size:13px; color:#9ca3af;">— ${brand}</p>
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

function getDirectorPasswordChangeEmailContent(params: {
  employeeName: string;
  employeeEmail: string;
  employeeCode: string;
  newPassword: string;
  fromName: string;
}): { html: string; text: string } {
  const { employeeName, employeeEmail, employeeCode, newPassword, fromName } = params;
  const n = escapeHtml(employeeName);
  const email = escapeHtml(employeeEmail);
  const code = escapeHtml(employeeCode);
  const pass = escapeHtml(newPassword);
  const brand = escapeHtml(fromName);

  const text = [
    "Employee password updated by admin",
    "",
    `An administrator has set a new password for the following employee.`,
    "",
    `Employee: ${employeeName}`,
    `Email: ${employeeEmail}`,
    `Employee Code: ${employeeCode}`,
    `New Password: ${newPassword}`,
    "",
    "Please store this securely. The employee can use these credentials to sign in.",
    "",
    `— ${fromName}`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Employee Password Updated – ${brand}</title>
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
              <p style="margin:0 0 12px; font-size:14px; font-weight:600; color:#047857;">Employee password updated</p>
              <p style="margin:0 0 24px; font-size:16px; line-height:1.6; color:#374151;">An administrator has set a new password for the following employee. Please store these details securely.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px; background-color:#f0fdf4; border-radius:8px; border:1px solid #bbf7d0;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 8px; font-size:15px; color:#111827;"><strong>Employee:</strong> ${n}</p>
                    <p style="margin:0 0 8px; font-size:15px; color:#111827;"><strong>Email:</strong> ${email}</p>
                    <p style="margin:0 0 8px; font-size:15px; color:#111827;"><strong>Employee Code:</strong> <span style="font-family:monospace; background:#dcfce7; padding:2px 8px; border-radius:4px;">${code}</span></p>
                    <p style="margin:0; font-size:15px; color:#111827;"><strong>New Password:</strong> <span style="font-family:monospace; background:#dcfce7; padding:2px 8px; border-radius:4px;">${pass}</span></p>
                  </td>
                </tr>
              </table>
              <p style="margin:0; font-size:14px; color:#6b7280;">The employee can use these credentials to sign in. They may change their password after logging in.</p>
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

const timeStringSchema = z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:mm 24h format");

const createEmployeeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  branchId: z.number().int(),
  role: z.string().optional(),
  phone: z.string().optional(),
  salary: z.number().optional(),
  address: z.string().optional(),
  pincode: z.string().optional(),
  workingHoursPerDay: z.number().int().min(1).max(24).optional(),
  shiftStartTime: timeStringSchema.optional(),
  shiftEndTime: timeStringSchema.optional(),
  joiningDate: z.string().optional(), // YYYY-MM-DD
});

const updateEmployeeSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  phone: z.string().optional(),
  salary: z.number().optional(),
  address: z.string().optional(),
  pincode: z.string().optional(),
  workingHoursPerDay: z.number().int().min(1).max(24).optional().nullable(),
  shiftStartTime: timeStringSchema.optional().nullable(),
  shiftEndTime: timeStringSchema.optional().nullable(),
  joiningDate: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "LEFT"]).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "LEFT"]),
});

const adminSetPasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

const verifyEmailSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  profileImageUrl: z.string().url().optional(),
});

async function generateNextEmployeeCode() {
  const last = await prisma.employee.findFirst({
    where: { employeeCode: { startsWith: "CC" } },
    orderBy: { employeeCode: "desc" },
  });

  if (!last || !last.employeeCode) {
    return "CC100001";
  }

  const numeric = Number(last.employeeCode.replace("CC", "")) || 100000;
  const next = numeric + 1;
  return `CC${next.toString().padStart(6, "0")}`;
}

export const employeeRouter = Router();

// Admin: create employee and send activation email with random password
employeeRouter.post(
  "/",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = createEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.issues });
    }

    const { name, email, branchId, role, workingHoursPerDay, shiftStartTime, shiftEndTime, joiningDate } = parsed.data;

    const existing = await prisma.employee.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "Employee already exists" });
    }

    const randomPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    const linkToken = randomBytes(16).toString("hex");
    const linkExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const employeeCode = await generateNextEmployeeCode();

    const employee = await prisma.employee.create({
      data: {
        name,
        email,
        branchId,
        role: role ?? undefined,
        passwordHash,
        employeeCode,
        verificationOtp: linkToken,
        verificationOtpExpiresAt: linkExpires,
        phone: parsed.data.phone,
        salary: parsed.data.salary,
        address: parsed.data.address,
        pincode: parsed.data.pincode,
        workingHoursPerDay: workingHoursPerDay ?? undefined,
        shiftStartTime: shiftStartTime ?? undefined,
        shiftEndTime: shiftEndTime ?? undefined,
        joiningDate: joiningDate ? new Date(joiningDate + "T00:00:00.000Z") : undefined,
      },
    });

    const baseUrl = (process.env.FRONTEND_URL || process.env.FRONTEND_DASHBOARD_URL || process.env.FRONTEND_CUSTOMER_URL || "http://localhost:5173").replace(/\/$/, "");
    // Public verification endpoints live in the backend under /api. Prefer PUBLIC_API_BASE_URL when set.
    const apiBaseUrl = (process.env.PUBLIC_API_BASE_URL || baseUrl).replace(/\/$/, "");
    const confirmUrl = `${apiBaseUrl}/api/employees/confirm-email?token=${encodeURIComponent(linkToken)}`;
    const fromName =
      process.env.EMAIL_FROM_NAME || "Cafe Chapter 1 Restro Private Limited";

    if (isMailConfigured()) {
      try {
        const n = escapeHtml(name);
        const pass = escapeHtml(randomPassword);
        await sendEmail({
          to: email,
          subject: "Your employee account is ready – verify your email",
          text: `Hi ${name},

Your employee account has been created.

Temporary password: ${randomPassword}

You must verify your email before you can log in. Click the link below:

${confirmUrl}

After verification you can log in with the password above and change it.

Dashboard: ${baseUrl}/login

This link expires in 24 hours.`,
          html: `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;"><p>Hi <strong>${n}</strong>,</p><p>Your employee account has been created.</p><p><strong>Temporary password:</strong> <code style="background:#eee;padding:4px 8px;border-radius:4px;">${pass}</code></p><p>You must <strong>verify your email</strong> before you can log in. Click the button below:</p><p><a href="${escapeHtml(confirmUrl)}" style="display:inline-block;background:#047857;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;">Verify my email</a></p><p style="color:#666;font-size:14px;">Or copy this link: ${escapeHtml(confirmUrl)}</p><p>After verification you can log in with the password above and change it.</p><p><a href="${escapeHtml(baseUrl)}/login">Dashboard login</a></p><p style="color:#999;font-size:12px;">This link expires in 24 hours.</p></body></html>`,
        });
      } catch (mailErr) {
        console.error("Failed to send employee welcome email:", mailErr);
      }
    } else {
      console.warn("Email not configured; welcome email skipped. Set EMAIL_SMTP_* and EMAIL_FROM_ADDRESS in .env");
    }

    const { passwordHash: _, verificationOtp: __, verificationOtpExpiresAt: ___, ...safe } = employee;
    return res.status(201).json(safe);
  },
);

const certificateSchema = z.object({
  name: z.string().min(1),
  position: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  responsibilities: z.string().min(1),
});

// Admin: generate and send completion certificate to employee
employeeRouter.post(
  "/:id/certificate",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = certificateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.issues });
    }

    const id = Number(req.params.id);
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const { name, position, startDate, endDate, responsibilities } =
      parsed.data;

    const templatePath = path.resolve(
      process.cwd(),
      "assets",
      "BlueModernCompletionCertificate.pdf",
    );

    let attachmentBuffer: Buffer | null = null;
    try {
      const bytes = await fs.readFile(templatePath);
      const pdfDoc = await PDFDocument.load(bytes);
      const page = pdfDoc.getPage(0);
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontSmall = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // These coordinates may need visual tweaking but will render dynamic content
      page.drawText(name, {
        x: 220,
        y: 300,
        size: 16,
        font,
      });

      page.drawText(position, {
        x: 220,
        y: 275,
        size: 12,
        font: fontSmall,
      });

      page.drawText(`From ${startDate} to ${endDate}`, {
        x: 220,
        y: 255,
        size: 11,
        font: fontSmall,
      });

      const wrapped = responsibilities.slice(0, 300);
      page.drawText(wrapped, {
        x: 80,
        y: 220,
        size: 10,
        font: fontSmall,
        maxWidth: 430,
        lineHeight: 12,
      });

      const pdfBytes = await pdfDoc.save();
      attachmentBuffer = Buffer.from(pdfBytes);
    } catch {
      attachmentBuffer = null;
    }

    if (!isMailConfigured()) {
      return res.status(503).json({ message: "Email is not configured. Set EMAIL_SMTP_* and EMAIL_FROM_ADDRESS in .env." });
    }
    try {
      await sendEmail({
        to: employee.email,
        subject: "Completion Certificate – Cafe Chapter 1",
        text: `Dear ${name},

This is to certify that you served as ${position} at Cafe Chapter 1
from ${startDate} to ${endDate}.

Key responsibilities:
${responsibilities}

Please find your completion certificate attached as PDF.

Best regards,
Cafe Chapter 1
`,
        attachments:
          attachmentBuffer != null
            ? [
                {
                  filename: "CompletionCertificate.pdf",
                  content: attachmentBuffer,
                },
              ]
            : [
                {
                  filename: "CompletionCertificate.pdf",
                  path: templatePath,
                },
              ],
      });
    } catch (e) {
      console.error("Certificate email failed:", e);
      return res.status(500).json({ message: "Failed to send email. Check SMTP settings in .env." });
    }
    return res.json({ message: "Certificate email sent to employee." });
  },
);

// Admin: list all employees (active list = permanent roster). Filter by status on frontend.
// Branch included with limited fields so missing columns (e.g. pincode) do not break the API.
employeeRouter.get(
  "/",
  authenticate,
  requireRole("ADMIN"),
  async (_req, res) => {
    const employees = await prisma.employee.findMany({
      include: {
        branch: {
          select: { id: true, name: true, location: true, timezone: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(employees);
  },
);

// Admin: roster-active employees (status ACTIVE). Email verification is separate from roster visibility.
employeeRouter.get(
  "/active",
  authenticate,
  requireRole("ADMIN"),
  async (_req, res) => {
    const employees = await prisma.employee.findMany({
      where: { status: "ACTIVE" },
      include: {
        branch: {
          select: { id: true, name: true, location: true, timezone: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return res.json(employees);
  },
);

// Admin: update employee (name, phone, salary, address, pincode, status)
employeeRouter.patch(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = updateEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.issues });
    }
    const id = Number(req.params.id);
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.joiningDate !== undefined) {
      data.joiningDate = parsed.data.joiningDate
        ? new Date(parsed.data.joiningDate + "T00:00:00.000Z")
        : null;
    }
    const employee = await prisma.employee.update({
      where: { id },
      data: data as any,
    });
    return res.json(employee);
  },
);

// Admin: send verification email to employee – they must click the link in that email to verify; only then can they log in.
// We do NOT set emailVerified here; it is set only when they click the link (GET /verify-email-link).
employeeRouter.post(
  "/:id/verify-and-send-invite",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = Number(req.params.id);
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    if (employee.emailVerified) {
      const { passwordHash: _, verificationOtp: __, verificationOtpExpiresAt: ___, ...safe } = employee;
      return res.status(200).json({ ...safe, _message: "Employee is already verified. They can log in with their existing credentials." });
    }
    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    const baseUrl = (process.env.FRONTEND_URL || process.env.FRONTEND_DASHBOARD_URL || process.env.FRONTEND_CUSTOMER_URL || "http://localhost:5173").replace(/\/$/, "");
    // Public verification endpoints live in the backend under /api. Prefer PUBLIC_API_BASE_URL when set.
    const apiBaseUrl = (process.env.PUBLIC_API_BASE_URL || baseUrl).replace(/\/$/, "");
    const verifyLink = `${apiBaseUrl}/api/employees/verify-email-link?token=${encodeURIComponent(token)}`;
    const fromName = process.env.EMAIL_FROM_NAME || "Chapter One Cafe";
    if (!isMailConfigured()) {
      return res.status(503).json({ message: "Email is not configured. Set EMAIL_SMTP_* and EMAIL_FROM_ADDRESS in .env." });
    }
    await prisma.employee.update({
      where: { id },
      data: { verificationOtp: token, verificationOtpExpiresAt: expiresAt },
    });
    const n = escapeHtml(employee.name);
    const brand = escapeHtml(fromName);
    const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;"><p>Hello <strong>${n}</strong>,</p><p>You have been invited as an employee for <strong>${brand}</strong>. To activate your account and receive your login password, you must verify your email by clicking the button below.</p><p><a href="${escapeHtml(verifyLink)}" style="display:inline-block;background:#047857;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;">Verify my email</a></p><p style="color:#666;font-size:14px;">Or copy this link: ${escapeHtml(verifyLink)}</p><p style="color:#999;font-size:12px;">This link expires in 24 hours. If you did not request this, ignore this email.</p></body></html>`;
    const text = `Hello ${employee.name},\n\nYou have been invited as an employee for ${fromName}. To activate your account and receive your login password, verify your email by opening this link:\n\n${verifyLink}\n\nThis link expires in 24 hours.`;
    try {
      await sendEmail({
        to: employee.email,
        subject: `Verify your email – ${fromName} Employee Account`,
        text,
        html,
      });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      console.error("Verify-and-send-invite email failed:", err?.code || err?.message || e);
      const hint =
        err?.code === "EAUTH"
          ? "Check EMAIL_SMTP_USER and EMAIL_SMTP_PASS (use Gmail App Password, not regular password)."
          : err?.code === "ECONNECTION" || err?.code === "ETIMEDOUT"
            ? "Check EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, and network/firewall."
            : "Check server logs and .env (EMAIL_SMTP_*, EMAIL_FROM_ADDRESS).";
      return res.status(500).json({
        message: "Failed to send email. " + hint,
        detail: process.env.NODE_ENV === "development" ? String(err?.message || e) : undefined,
      });
    }
    const updated = await prisma.employee.findUnique({ where: { id } });
    const { passwordHash: _, verificationOtp: __, verificationOtpExpiresAt: ___, ...safe } = updated!;
    return res.json({ ...safe, _message: "Verification email sent. The employee must click the link in that email to verify; only then can they log in." });
  },
);

// Admin: resend verification email to employee
employeeRouter.post(
  "/:id/resend-verification",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = Number(req.params.id);
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
    await prisma.employee.update({
      where: { id },
      data: { verificationOtp: otp, verificationOtpExpiresAt: otpExpires },
    });
    const baseUrl = (process.env.FRONTEND_URL || process.env.FRONTEND_DASHBOARD_URL || process.env.FRONTEND_CUSTOMER_URL || "http://localhost:5173").replace(/\/$/, "");
    const verifyUrl = `${baseUrl}/login?verify=1&email=${encodeURIComponent(employee.email)}`;
    if (!isMailConfigured()) {
      return res.status(503).json({ message: "Email is not configured. Set EMAIL_SMTP_* and EMAIL_FROM_ADDRESS in .env." });
    }
    try {
      await sendEmail({
        to: employee.email,
        subject: `Verify your email – ${process.env.EMAIL_FROM_NAME || "Cafe Chapter 1 Restro Private Limited"}`,
        text: `Hi ${employee.name},\n\nYour verification code: ${otp}\n\nYou can also verify by logging in and entering this code.\n\nDashboard: ${baseUrl}\n\nIf you did not request this, please ignore.`,
        html: `<!DOCTYPE html><html><body style="font-family:sans-serif;"><p>Hi ${employee.name},</p><p>Your <strong>verification code</strong>: <code style="background:#eee;padding:4px 8px;">${otp}</code></p><p>Verify at: <a href="${verifyUrl}">${verifyUrl}</a></p><p>If you did not request this, please ignore.</p></body></html>`,
      });
    } catch (e) {
      console.error("Resend verification email failed:", e);
      return res.status(500).json({ message: "Failed to send email. Check SMTP settings (e.g. Gmail app password in .env)." });
    }
    return res.json({ message: "Verification email sent" });
  },
);

// Employee: get own profile (read-only)
employeeRouter.get(
  "/me",
  authenticate,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    const employee = await prisma.employee.findUnique({
      where: { id: req.user!.id },
      include: { branch: true },
    });
    if (!employee) return res.status(404).json({ message: "Not found" });
    const { passwordHash, verificationOtp, verificationOtpExpiresAt, ...rest } = employee;
    return res.json(rest);
  },
);

// Admin: update employee status
employeeRouter.patch(
  "/:id/status",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.issues });
    }

    const id = Number(req.params.id);
    const employee = await prisma.employee.update({
      where: { id },
      data: { status: parsed.data.status },
    });

    return res.json(employee);
  },
);

// Admin: set employee password and email director(s) with new password
employeeRouter.post(
  "/:id/admin-set-password",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = adminSetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.issues });
    }

    const id = Number(req.params.id);
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { branch: true },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const newPassword = parsed.data.newPassword;
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.employee.update({
      where: { id },
      data: { passwordHash },
    });

    const fromName = process.env.EMAIL_FROM_NAME || "Chapter One Cafe";
    if (isMailConfigured() && employee.branch?.directorsEmail) {
      const directorEmails = employee.branch.directorsEmail
        .split(/[,\s]+/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      if (directorEmails.length > 0) {
        const { html, text } = getDirectorPasswordChangeEmailContent({
          employeeName: employee.name,
          employeeEmail: employee.email,
          employeeCode: employee.employeeCode || "",
          newPassword,
          fromName,
        });
        try {
            await sendEmail({
            to: directorEmails,
            subject: `Employee password updated – ${employee.name}`,
            text,
            html,
          });
        } catch (e: unknown) {
          console.error("Admin set password: failed to email director(s):", (e as Error)?.message ?? e);
          // Still return success; password was updated
        }
      }
    }

    const updated = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, employeeCode: true, status: true, emailVerified: true, role: true },
    });
    return res.json(updated);
  },
);

// Public: employee clicks "Verify my email" in the account-creation email – we only set emailVerified (keep the password we sent).
employeeRouter.get("/confirm-email", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
  if (!token) {
    return res.status(400).send(
      "<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem;'><h1>Invalid link</h1><p>Missing token. Use the &quot;Verify my email&quot; button from your welcome email.</p></body></html>",
    );
  }
  const employee = await prisma.employee.findFirst({
    where: {
      verificationOtp: token,
      verificationOtpExpiresAt: { gt: new Date() },
    },
  });
  if (!employee) {
    return res.status(400).send(
      "<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem;'><h1>Link expired or invalid</h1><p>Verification links expire after 24 hours. Ask your admin to add you again or send a new verification email.</p></body></html>",
    );
  }
  await prisma.employee.update({
    where: { id: employee.id },
    data: {
      emailVerified: true,
      verificationOtp: null,
      verificationOtpExpiresAt: null,
    },
  });
  const baseUrl = (process.env.FRONTEND_URL || process.env.FRONTEND_DASHBOARD_URL || process.env.FRONTEND_CUSTOMER_URL || "http://localhost:5173").replace(/\/$/, "");
  const loginUrl = `${baseUrl}/login`;
  const name = escapeHtml(employee.name);
  const loginLink = escapeHtml(loginUrl);
  return res.send(
    `<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem;max-width:560px;margin:0 auto;'><h1>Email verified</h1><p>Hello <strong>${name}</strong>, your email is now verified. You can log in with the <strong>temporary password from your welcome email</strong>. Change it after first login.</p><p><a href="${loginLink}" style="display:inline-block;background:#047857;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;">Log in to dashboard</a></p><p style="color:#666;font-size:14px;">Or copy: <a href="${loginLink}">${loginLink}</a></p></body></html>`,
  );
});

// Public: employee clicks "Verify my email" link (from admin "Verify" button) – set emailVerified and show new password.
employeeRouter.get("/verify-email-link", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
  if (!token) {
    return res.status(400).send(
      "<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem;'><h1>Invalid link</h1><p>Missing token. Use the link from your verification email.</p></body></html>",
    );
  }
  const employee = await prisma.employee.findFirst({
    where: {
      verificationOtp: token,
      verificationOtpExpiresAt: { gt: new Date() },
    },
  });
  if (!employee) {
    return res.status(400).send(
      "<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem;'><h1>Link expired or invalid</h1><p>Verification links expire after 24 hours. Ask your admin to send a new verification email.</p></body></html>",
    );
  }
  const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
  const passwordHash = await bcrypt.hash(randomPassword, 10);
  await prisma.employee.update({
    where: { id: employee.id },
    data: {
      passwordHash,
      emailVerified: true,
      verificationOtp: null,
      verificationOtpExpiresAt: null,
    },
  });
  const baseUrl = (process.env.FRONTEND_URL || process.env.FRONTEND_DASHBOARD_URL || process.env.FRONTEND_CUSTOMER_URL || "http://localhost:5173").replace(/\/$/, "");
  const loginUrl = `${baseUrl}/login`;
  const fromName = process.env.EMAIL_FROM_NAME || "Chapter One Cafe";

  // Send follow-up email with employee number, email, password and login URL
  if (isMailConfigured()) {
    try {
      const { html: credHtml, text: credText } = getVerifyEmployeeEmailContent({
        employeeName: employee.name,
        employeeCode: employee.employeeCode || "",
        employeeEmail: employee.email,
        temporaryPassword: randomPassword,
        loginUrl,
        fromName,
      });
      await sendEmail({
        to: employee.email,
        subject: `Your ${fromName} login credentials – account verified`,
        text: credText,
        html: credHtml,
      });
    } catch (e: unknown) {
      console.error("Verify-email-link: failed to send credentials email:", (e as Error)?.message ?? e);
    }
  }

  const name = escapeHtml(employee.name);
  const pass = escapeHtml(randomPassword);
  const loginLink = escapeHtml(loginUrl);
  return res.send(
    `<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem;max-width:560px;margin:0 auto;'><h1>Email verified</h1><p>Hello <strong>${name}</strong>, your email is now verified. We have sent your <strong>employee number, email, password and login link</strong> to your inbox. You can also use the details below to log in (change your password after first login):</p><p style='background:#f0fdf4;padding:12px 16px;border-radius:8px;font-family:monospace;font-size:18px;'>${pass}</p><p><a href="${loginLink}" style="display:inline-block;background:#047857;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;">Log in to dashboard</a></p><p style="color:#666;font-size:14px;">Or copy this link: <a href="${loginLink}">${loginLink}</a></p></body></html>`,
  );
});

// Employee: verify email with OTP (6-digit code entry)
employeeRouter.post("/verify-email", async (req, res) => {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.issues });
  }

  const { email, otp } = parsed.data;
  const employee = await prisma.employee.findUnique({ where: { email } });

  if (
    !employee ||
    !employee.verificationOtp ||
    employee.verificationOtp !== otp ||
    !employee.verificationOtpExpiresAt ||
    employee.verificationOtpExpiresAt < new Date()
  ) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  await prisma.employee.update({
    where: { id: employee.id },
    data: {
      emailVerified: true,
      verificationOtp: null,
      verificationOtpExpiresAt: null,
    },
  });

  return res.json({ message: "Email verified successfully" });
});

// Employee: change password
employeeRouter.post(
  "/change-password",
  authenticate,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.issues });
    }

    const employeeId = req.user!.id;
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const ok = await bcrypt.compare(
      parsed.data.currentPassword,
      employee.passwordHash,
    );
    if (!ok) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.employee.update({
      where: { id: employeeId },
      data: { passwordHash: newHash },
    });

    return res.json({ message: "Password updated successfully" });
  },
);

// Employee: update profile (name, profile image)
employeeRouter.patch(
  "/me",
  authenticate,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.issues });
    }

    const employeeId = req.user!.id;
    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: parsed.data,
    });

    return res.json(updated);
  },
);

