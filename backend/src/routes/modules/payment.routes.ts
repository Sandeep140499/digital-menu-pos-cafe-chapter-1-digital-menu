import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { buildPaymentMessage, getWaMeLink } from "../../services/whatsapp.js";

const paymentSchema = z.object({
  paymentStatus: z.enum(["PAID", "PARTIAL", "UNPAID"]),
  paidAmount: z.number().nonnegative().optional(),
  remainingAmount: z.number().nonnegative().optional(),
});

export const paymentRouter = Router();

paymentRouter.patch(
  "/:orderId",
  authenticate,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.issues });
    }

    const employeeId = req.user!.id;
    const orderId = Number(req.params.orderId);

    const { paymentStatus, paidAmount = 0, remainingAmount = 0 } = parsed.data;

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { branch: true },
    });
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    const includeReviewLink =
      paymentStatus === "PAID" && !existingOrder.reviewSent;

    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus:
          paymentStatus === "PAID"
            ? "PAID"
            : paymentStatus === "PARTIAL"
              ? "PARTIAL"
              : "UNPAID",
        reviewSent: paymentStatus === "PAID" && includeReviewLink ? true : existingOrder.reviewSent,
      },
      include: { branch: true },
    });

    const record = await prisma.paymentRecord.create({
      data: {
        orderId: order.id,
        paymentStatus:
          paymentStatus === "PAID"
            ? "PAID"
            : paymentStatus === "PARTIAL"
              ? "PARTIAL"
              : "UNPAID",
        paidAmount,
        remainingAmount,
        confirmedByEmployee: employeeId,
      },
    });

    if (paymentStatus === "PAID") {
      const shift = await prisma.employeeShift.findFirst({
        where: { employeeId, shiftEnd: null },
      });
      if (shift) {
        await prisma.employeeShift.update({
          where: { id: shift.id },
          data: { totalSales: (shift.totalSales ?? 0) + order.totalAmount },
        });
      }
    }

    req.app.locals.io?.emit("payment:updated", {
      orderId: order.id,
      paymentStatus: order.paymentStatus,
    });

    let paymentWhatsAppMessage: string | null = null;
    let paymentWaMeLink: string | null = null;
    if (order.customerMobile && order.customerName) {
      const branchInfo = order.branch
        ? {
            name: order.branch.name,
            location: order.branch.location,
            phone: order.branch.phone,
            googleReviewUrl: order.branch.googleReviewUrl,
          }
        : null;
      paymentWhatsAppMessage = buildPaymentMessage({
        orderId: order.id,
        customerName: order.customerName,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus as "PAID" | "PARTIAL" | "UNPAID",
        includeReviewLink: paymentStatus === "PAID" ? includeReviewLink : false,
        branch: branchInfo,
      });
      paymentWaMeLink = getWaMeLink(order.customerMobile, paymentWhatsAppMessage);
    }

    return res.json({
      order,
      record,
      ...(paymentWhatsAppMessage && paymentWaMeLink
        ? { paymentWhatsAppMessage, paymentWaMeLink }
        : {}),
    });
  },
);

