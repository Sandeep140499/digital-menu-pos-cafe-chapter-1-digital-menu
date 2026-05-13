import { Router } from 'express';
import { authRouter } from './modules/auth.routes.js';
import { employeeRouter } from './modules/employee.routes.js';
import { shiftRouter } from './modules/shift.routes.js';
import { orderRouter } from './modules/order.routes.js';
import { paymentRouter } from './modules/payment.routes.js';
import { reportRouter } from './modules/report.routes.js';
import { menuRouter } from './modules/menu.routes.js';
import { configRouter } from './modules/config.routes.js';
import { branchRouter } from './modules/branch.routes.js';
import { directorRouter, directorPublicRouter } from './modules/director.routes.js';
import { errorLogRouter } from './modules/errorLog.routes.js';
import { customerQueryRouter } from './modules/customerQuery.routes.js';
import { overtimeRouter } from './modules/overtime.routes.js';
import { lateRouter } from './modules/late.routes.js';
import { notificationRouter } from './modules/notification.routes.js';
import { performanceRouter } from './modules/performance.routes.js';
import { leaveRouter } from './modules/leave.routes.js';
import { attendanceRouter } from './modules/attendance.routes.js';
import { metricsRouter } from './modules/metrics.routes.js';
import { monthlyTargetsRouter } from './modules/monthlyTargets.routes.js';
import { autoShiftRouter } from './modules/autoShift.routes.js';
import { happyHourRouter } from './modules/happyHour.routes.js';
import { isMailConfigured, sendEmail, verifyMailConnection } from '../config/mailer.js';

export const router = Router();

// Health check for load balancers / deployment platforms
router.get('/health', (_req, res) => res.status(200).json({ ok: true }));

router.use('/auth', authRouter);
router.use('/employees', employeeRouter);
router.use('/shift', shiftRouter);
router.use('/auto-shift', autoShiftRouter);
router.use('/orders', orderRouter);
router.use('/payments', paymentRouter);
router.use('/reports', reportRouter);
router.use('/menu', menuRouter);
router.use('/config', configRouter);
router.use('/branches', branchRouter);
router.use('/directors', directorPublicRouter);
router.use('/error-logs', errorLogRouter);
router.use('/customer-queries', customerQueryRouter);
router.use('/overtime', overtimeRouter);
router.use('/late', lateRouter);
router.use('/notifications', notificationRouter);
router.use('/performance', performanceRouter);
router.use('/metrics', metricsRouter);
router.use('/leaves', leaveRouter);
router.use('/attendance', attendanceRouter);
router.use('/monthly-targets', monthlyTargetsRouter);
router.use('/happy-hours', happyHourRouter);

// 🧪 Temporary Debug Endpoint: Test Mail Connection
router.get('/debug/mail-test', async (req, res) => {
  const targetEmail = (req.query.to as string) || 'chapteronecafe11@gmail.com';
  
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      config: {
        host: process.env.EMAIL_SMTP_HOST,
        user: process.env.EMAIL_SMTP_USER,
        from: process.env.EMAIL_FROM_ADDRESS,
        isConfigured: isMailConfigured(),
      },
      connection: 'Checking...',
    };

    await verifyMailConnection();
    results.connection = 'SUCCESS ✅';

    await sendEmail({
      to: targetEmail,
      subject: '🛎️ Production Mail Debug Test',
      html: `<h3>Mail Test Successful!</h3><p>Sent at: ${new Date().toLocaleString()}</p>`,
    });
    results.emailSent = `SUCCESS to ${targetEmail} ✅`;

    return res.json(results);
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || String(err),
      code: err.code,
      hint: 'Check if the sender email is verified in Brevo and SMTP credentials are correct.',
    });
  }
});
