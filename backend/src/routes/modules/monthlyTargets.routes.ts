import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { prisma } from '../../config/prisma.js';
import { isMailConfigured, sendEmail } from '../../config/mailer.js';
import {
  getCurrentMonthTargetProgress,
  getTargetForMonth,
  monthKey,
  monthLabel,
  setMonthlyTarget,
} from '../../services/monthlyTargetService.js';

export const monthlyTargetsRouter = Router();

const setTargetSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  targetAmount: z.union([z.number(), z.string()]).transform(v => Number(v) || 0),
});

function featureEnabled(): boolean {
  return String(process.env.ENABLE_MONTHLY_TARGETS || 'true').toLowerCase() === 'true';
}

function parseDirectorEmails(input: string | null | undefined): string[] {
  return (input || '')
    .split(/[,\s]+/)
    .map(e => e.trim())
    .filter(e => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

async function getAllDirectorEmails(): Promise<string[]> {
  const branches = await prisma.branch.findMany({
    select: { directorsEmail: true },
  });
  return [...new Set(branches.flatMap(b => parseDirectorEmails(b.directorsEmail)))];
}

monthlyTargetsRouter.post('/set', authenticate, requireRole('ADMIN'), async (req, res) => {
  if (!featureEnabled()) {
    return res.status(503).json({ message: 'Monthly target feature is disabled' });
  }
  const parsed = setTargetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }
  const { year, month, targetAmount } = parsed.data;
  if (!Number.isFinite(targetAmount) || targetAmount < 0) {
    return res.status(400).json({ message: 'targetAmount must be non-negative' });
  }
  const saved = await setMonthlyTarget(year, month, targetAmount, req.user?.id ?? null);

  let directorNotification: 'sent' | 'skipped' | 'failed' = 'skipped';
  if (isMailConfigured()) {
    const directors = await getAllDirectorEmails();
    if (directors.length > 0) {
      const mLabel = monthLabel(year, month);
      try {
        await sendEmail({
          to: directors,
          subject: `🎯 Monthly target set - ${mLabel}`,
          text:
            `Monthly target updated.\n` +
            `Month: ${mLabel}\n` +
            `Target: ₹${Math.round(targetAmount).toLocaleString('en-IN')}\n` +
            `Updated at: ${new Date().toLocaleString('en-IN')}`,
          html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Monthly Target Updated</title></head>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#334155">
  <h1 style="color:#047857;margin-bottom:8px">🎯 Monthly target set</h1>
  <p style="margin:0 0 18px 0;color:#64748b">${mLabel}</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
    <tbody>
      <tr><td style="padding:8px 12px;border:1px solid #e2e8f0">Target</td><td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right">₹${Math.round(targetAmount).toLocaleString('en-IN')}</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #e2e8f0">Month key</td><td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right">${monthKey(year, month)}</td></tr>
    </tbody>
  </table>
</body></html>`,
        });
        directorNotification = 'sent';
      } catch (e) {
        console.error('[MonthlyTargets] Director notification failed:', e);
        directorNotification = 'failed';
      }
    }
  }

  return res.json({
    message: 'Monthly target saved',
    monthlyTarget: saved,
    directorNotification,
  });
});

// Signature requested: /api/monthly-targets/{branchId}/{year}/{month}
monthlyTargetsRouter.get(
  '/:branchId/:year/:month',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    if (!featureEnabled()) {
      return res.status(503).json({ message: 'Monthly target feature is disabled' });
    }
    const year = Number(req.params.year);
    const month = Number(req.params.month);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid year/month' });
    }
    const row = await getTargetForMonth(year, month);
    return res.json({
      branchId: Number(req.params.branchId),
      year,
      month,
      yearMonth: monthKey(year, month),
      monthLabel: monthLabel(year, month),
      targetSet: Boolean(row && row.targetAmount > 0),
      targetAmount: Number(row?.targetAmount ?? 0),
      updatedAt: row?.updatedAt ?? null,
    });
  }
);

// Signature requested: /api/monthly-targets/branch/{branchId}
monthlyTargetsRouter.get(
  '/branch/:branchId',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    if (!featureEnabled()) {
      return res.status(503).json({ message: 'Monthly target feature is disabled' });
    }
    const progress = await getCurrentMonthTargetProgress(new Date());
    return res.json({
      branchId: Number(req.params.branchId),
      ...progress,
    });
  }
);

// Optional reporting endpoint: target vs achieved trends
monthlyTargetsRouter.get('/history', authenticate, requireRole('ADMIN'), async (_req, res) => {
  if (!featureEnabled()) {
    return res.status(503).json({ message: 'Monthly target feature is disabled' });
  }
  const targets = await prisma.monthlyTarget.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 24,
  });
  const snapshots = await prisma.monthlyRevenueSnapshot.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 24,
  });
  const snapByYm = new Map(snapshots.map(s => [s.yearMonth, s]));
  const rows = targets.map(t => {
    const snap = snapByYm.get(t.yearMonth);
    const achieved = Number(snap?.totalSales ?? 0);
    const pct = t.targetAmount > 0 ? (achieved / t.targetAmount) * 100 : 0;
    return {
      year: t.year,
      month: t.month,
      yearMonth: t.yearMonth,
      monthLabel: monthLabel(t.year, t.month),
      targetAmount: t.targetAmount,
      achievedAmount: achieved,
      achievedPct: pct,
    };
  });
  return res.json({ rows });
});
