import { Router } from "express";
import { authRouter } from "./modules/auth.routes.js";
import { employeeRouter } from "./modules/employee.routes.js";
import { shiftRouter } from "./modules/shift.routes.js";
import { orderRouter } from "./modules/order.routes.js";
import { paymentRouter } from "./modules/payment.routes.js";
import { reportRouter } from "./modules/report.routes.js";
import { menuRouter } from "./modules/menu.routes.js";
import { configRouter } from "./modules/config.routes.js";
import { branchRouter } from "./modules/branch.routes.js";
import { directorRouter, directorPublicRouter } from "./modules/director.routes.js";
import { errorLogRouter } from "./modules/errorLog.routes.js";
import { customerQueryRouter } from "./modules/customerQuery.routes.js";
import { overtimeRouter } from "./modules/overtime.routes.js";
import { lateRouter } from "./modules/late.routes.js";
import { notificationRouter } from "./modules/notification.routes.js";
import { performanceRouter } from "./modules/performance.routes.js";
import { leaveRouter } from "./modules/leave.routes.js";
import { attendanceRouter } from "./modules/attendance.routes.js";

export const router = Router();

// Health check for load balancers / deployment platforms
router.get("/health", (_req, res) => res.status(200).json({ ok: true }));

router.use("/auth", authRouter);
router.use("/employees", employeeRouter);
router.use("/shift", shiftRouter);
router.use("/orders", orderRouter);
router.use("/payments", paymentRouter);
router.use("/reports", reportRouter);
router.use("/menu", menuRouter);
router.use("/config", configRouter);
router.use("/branches", branchRouter);
router.use("/directors", directorPublicRouter);
router.use("/error-logs", errorLogRouter);
router.use("/customer-queries", customerQueryRouter);
router.use("/overtime", overtimeRouter);
router.use("/late", lateRouter);
router.use("/notifications", notificationRouter);
router.use("/performance", performanceRouter);
router.use("/leaves", leaveRouter);
router.use("/attendance", attendanceRouter);

