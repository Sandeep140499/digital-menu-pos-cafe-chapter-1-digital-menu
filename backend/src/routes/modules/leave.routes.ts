import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { isMailConfigured, sendEmail } from '../../config/mailer.js';

export const leaveRouter = Router();

const applyLeaveSchema = z.object({
  leaveType: z.enum(['SICK', 'CASUAL', 'PAID']),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().optional(),
});

function atMidnightLocal(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetweenInclusive(start: Date, end: Date): number {
  const ms = atMidnightLocal(end).getTime() - atMidnightLocal(start).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

function validateAdvanceRule(
  leaveType: 'SICK' | 'CASUAL' | 'PAID',
  startDate: Date
): string | null {
  const today = atMidnightLocal(new Date());
  const start = atMidnightLocal(startDate);
  if (start < today) return 'Past dates are not allowed';
  const diffDays = Math.floor((start.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (leaveType === 'CASUAL' && diffDays < 2) {
    return 'Casual leave must be applied at least 2 days in advance';
  }
  if (leaveType === 'PAID' && diffDays < 15) {
    return 'Paid leave must be applied at least 15 days in advance';
  }
  // SICK: same-day and future allowed
  return null;
}

async function notifyAdminsForNewLeave(params: {
  employeeName: string;
  employeeCode?: string | null;
  leaveType: 'SICK' | 'CASUAL' | 'PAID';
  startDate: Date;
  endDate: Date;
  reason?: string | null;
  totalDays: number;
}) {
  if (!isMailConfigured()) return;
  const admins = await prisma.admin.findMany({
    select: { email: true },
    take: 1000,
  });
  const to = admins.map(a => a.email).filter(Boolean);
  if (to.length === 0) return;
  const leaveTypeLabel =
    params.leaveType === 'SICK'
      ? 'Sick Leave'
      : params.leaveType === 'PAID'
        ? 'Paid Leave'
        : 'Casual Leave';
  const subject = `📝 Leave request pending – ${params.employeeName} (${leaveTypeLabel})`;
  const text = [
    `Employee: ${params.employeeName}${params.employeeCode ? ` (${params.employeeCode})` : ''}`,
    `Type: ${leaveTypeLabel}`,
    `Dates: ${params.startDate.toISOString().slice(0, 10)} to ${params.endDate.toISOString().slice(0, 10)}`,
    `Total days: ${params.totalDays}`,
    `Reason: ${params.reason?.trim() || 'N/A'}`,
    `Status: PENDING`,
  ].join('\n');
  const html = `
<html><body style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#334155">
  <h2 style="margin:0 0 8px 0;color:#0f766e">New Leave Request (Pending)</h2>
  <table style="width:100%;border-collapse:collapse">
    <tbody>
      <tr><td style="padding:8px;border:1px solid #e2e8f0">Employee</td><td style="padding:8px;border:1px solid #e2e8f0">${params.employeeName}${params.employeeCode ? ` (${params.employeeCode})` : ''}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8f0">Leave Type</td><td style="padding:8px;border:1px solid #e2e8f0">${leaveTypeLabel}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8f0">Dates</td><td style="padding:8px;border:1px solid #e2e8f0">${params.startDate.toISOString().slice(0, 10)} to ${params.endDate.toISOString().slice(0, 10)}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8f0">Total Days</td><td style="padding:8px;border:1px solid #e2e8f0">${params.totalDays}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8f0">Reason</td><td style="padding:8px;border:1px solid #e2e8f0">${params.reason?.trim() || 'N/A'}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8f0">Status</td><td style="padding:8px;border:1px solid #e2e8f0">PENDING</td></tr>
    </tbody>
  </table>
</body></html>`;
  await sendEmail({ to, subject, text, html });
}

async function notifyEmployeeLeaveDecision(params: {
  to: string;
  employeeName: string;
  leaveType: 'SICK' | 'CASUAL' | 'PAID';
  startDate: Date;
  endDate: Date;
  status: 'APPROVED' | 'REJECTED';
  remarks?: string | null;
}) {
  if (!isMailConfigured()) return;
  const leaveTypeLabel =
    params.leaveType === 'SICK'
      ? 'Sick Leave'
      : params.leaveType === 'PAID'
        ? 'Paid Leave'
        : 'Casual Leave';
  const subject = `Leave request ${params.status.toLowerCase()} – ${leaveTypeLabel}`;
  const text = [
    `Hello ${params.employeeName},`,
    `Your leave request has been ${params.status}.`,
    `Type: ${leaveTypeLabel}`,
    `Dates: ${params.startDate.toISOString().slice(0, 10)} to ${params.endDate.toISOString().slice(0, 10)}`,
    `Remarks: ${params.remarks?.trim() || 'N/A'}`,
  ].join('\n');
  const html = `
<html><body style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#334155">
  <h2 style="margin:0 0 8px 0;color:${params.status === 'APPROVED' ? '#15803d' : '#b91c1c'}">Leave Request ${params.status}</h2>
  <p>Hello ${params.employeeName},</p>
  <table style="width:100%;border-collapse:collapse">
    <tbody>
      <tr><td style="padding:8px;border:1px solid #e2e8f0">Type</td><td style="padding:8px;border:1px solid #e2e8f0">${leaveTypeLabel}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8f0">Dates</td><td style="padding:8px;border:1px solid #e2e8f0">${params.startDate.toISOString().slice(0, 10)} to ${params.endDate.toISOString().slice(0, 10)}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8f0">Status</td><td style="padding:8px;border:1px solid #e2e8f0">${params.status}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8f0">Remarks</td><td style="padding:8px;border:1px solid #e2e8f0">${params.remarks?.trim() || 'N/A'}</td></tr>
    </tbody>
  </table>
</body></html>`;
  await sendEmail({ to: [params.to], subject, text, html });
}

async function notifyEmployeeLeaveSubmitted(params: {
  to: string;
  employeeName: string;
  leaveType: 'SICK' | 'CASUAL' | 'PAID';
  startDate: Date;
  endDate: Date;
  reason?: string | null;
  totalDays: number;
}) {
  if (!isMailConfigured()) return;
  const leaveTypeLabel =
    params.leaveType === 'SICK'
      ? 'Sick Leave'
      : params.leaveType === 'PAID'
        ? 'Paid Leave'
        : 'Casual Leave';
  const subject = `Leave request submitted – ${leaveTypeLabel}`;
  const text = [
    `Hello ${params.employeeName},`,
    `Your leave request has been submitted successfully.`,
    `Type: ${leaveTypeLabel}`,
    `Dates: ${params.startDate.toISOString().slice(0, 10)} to ${params.endDate.toISOString().slice(0, 10)}`,
    `Total days: ${params.totalDays}`,
    `Reason: ${params.reason?.trim() || 'N/A'}`,
    `Status: PENDING (awaiting admin approval)`,
  ].join('\n');
  const html = `
<html><body style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#334155">
  <h2 style="margin:0 0 8px 0;color:#0f766e">Leave Request Submitted</h2>
  <p>Hello ${params.employeeName}, your leave request is received and pending admin approval.</p>
  <table style="width:100%;border-collapse:collapse">
    <tbody>
      <tr><td style="padding:8px;border:1px solid #e2e8f0">Type</td><td style="padding:8px;border:1px solid #e2e8f0">${leaveTypeLabel}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8f0">Dates</td><td style="padding:8px;border:1px solid #e2e8f0">${params.startDate.toISOString().slice(0, 10)} to ${params.endDate.toISOString().slice(0, 10)}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8f0">Total Days</td><td style="padding:8px;border:1px solid #e2e8f0">${params.totalDays}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8f0">Reason</td><td style="padding:8px;border:1px solid #e2e8f0">${params.reason?.trim() || 'N/A'}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8f0">Current Status</td><td style="padding:8px;border:1px solid #e2e8f0">PENDING</td></tr>
    </tbody>
  </table>
</body></html>`;
  await sendEmail({ to: [params.to], subject, text, html });
}

// Employee: apply leave
leaveRouter.post('/apply', authenticate, requireRole('EMPLOYEE'), async (req, res) => {
  const parsed = applyLeaveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }
  const employeeId = req.user!.id;
  const employeeForEligibility = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { status: true },
  });
  if (!employeeForEligibility || employeeForEligibility.status !== 'ACTIVE') {
    return res.status(403).json({
      message: 'Only active employees can apply for leave',
    });
  }
  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    return res.status(400).json({ message: 'Invalid date range' });
  }
  if (endDate < startDate) {
    return res.status(400).json({ message: 'End date must be after start date' });
  }
  const advanceErr = validateAdvanceRule(parsed.data.leaveType, startDate);
  if (advanceErr) return res.status(400).json({ message: advanceErr });

  const overlap = await prisma.employeeLeave.findFirst({
    where: {
      employeeId,
      status: { not: 'REJECTED' as any },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true },
  });
  if (overlap) {
    return res.status(409).json({ message: 'Overlapping leave request already exists' });
  }
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { name: true, employeeCode: true, email: true },
  });
  const leave = await prisma.employeeLeave.create({
    data: {
      employeeId,
      leaveType: parsed.data.leaveType as any,
      startDate,
      endDate,
      reason: parsed.data.reason?.trim() || null,
      status: 'PENDING' as any,
    },
  });
  try {
    if (employee?.name) {
      await notifyAdminsForNewLeave({
        employeeName: employee.name,
        employeeCode: employee.employeeCode,
        leaveType: parsed.data.leaveType,
        startDate,
        endDate,
        reason: parsed.data.reason,
        totalDays: daysBetweenInclusive(startDate, endDate),
      });
      if (employee.email) {
        await notifyEmployeeLeaveSubmitted({
          to: employee.email,
          employeeName: employee.name,
          leaveType: parsed.data.leaveType,
          startDate,
          endDate,
          reason: parsed.data.reason,
          totalDays: daysBetweenInclusive(startDate, endDate),
        });
      }
    }
  } catch (e) {
    console.error('[Leave] notification failed:', e);
  }
  return res.status(201).json({ leave });
});

// Employee: list my leaves
leaveRouter.get('/mine', authenticate, requireRole('EMPLOYEE'), async (req, res) => {
  const employeeId = req.user!.id;
  const leaves = await prisma.employeeLeave.findMany({
    where: { employeeId },
    orderBy: { startDate: 'desc' },
    take: 200,
  });
  return res.json({ leaves });
});

// Admin: list leaves with filters
leaveRouter.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { employeeId, startDate, endDate, status } = req.query;
  const where: any = {};
  if (employeeId) where.employeeId = Number(employeeId);
  if (status) where.status = String(status).toUpperCase();
  if (startDate || endDate) {
    where.AND = [];
    if (startDate) where.AND.push({ endDate: { gte: new Date(String(startDate)) } });
    if (endDate) where.AND.push({ startDate: { lte: new Date(String(endDate)) } });
  }
  const leaves = await prisma.employeeLeave.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { employee: { select: { id: true, name: true, branchId: true, status: true } } },
    take: 500,
  });
  const summary = {
    total: leaves.length,
    pending: leaves.filter(l => String(l.status) === 'PENDING').length,
    approved: leaves.filter(l => String(l.status) === 'APPROVED').length,
    rejected: leaves.filter(l => String(l.status) === 'REJECTED').length,
  };
  return res.json({ leaves, summary });
});

const updateLeaveStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  remarks: z.string().max(1000).optional(),
});

// Admin: approve/reject leave
leaveRouter.patch('/:id/status', authenticate, requireRole('ADMIN'), async (req, res) => {
  const parsed = updateLeaveStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }
  const id = Number(req.params.id);
  const leave = await prisma.employeeLeave.update({
    where: { id },
    data: {
      status: parsed.data.status as any,
      adminRemarks: parsed.data.remarks?.trim() || null,
    },
    include: {
      employee: { select: { name: true, email: true } },
    },
  });
  try {
    if (leave.employee?.email) {
      await notifyEmployeeLeaveDecision({
        to: leave.employee.email,
        employeeName: leave.employee.name,
        leaveType: leave.leaveType as 'SICK' | 'CASUAL' | 'PAID',
        startDate: leave.startDate,
        endDate: leave.endDate,
        status: parsed.data.status,
        remarks: parsed.data.remarks,
      });
    }
  } catch (e) {
    console.error('[Leave] employee decision notification failed:', e);
  }
  return res.json({ leave });
});
