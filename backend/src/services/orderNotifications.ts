import { Server as SocketIOServer } from 'socket.io';
import { logger, logSecurityEvent } from '../utils/logger.js';
import { prisma } from '../config/prisma.js';

export interface OrderNotificationData {
  orderId: number;
  branchId: number;
  tableNumber: string;
  customerName: string;
  orderType: 'DINE_IN' | 'TAKE_AWAY';
  orderSource: 'CUSTOMER' | 'EMPLOYEE';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  totalAmount: number;
  employeeName?: string;
  items: Array<{ name: string; quantity: number }>;
}

export class OrderNotificationService {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  async sendNewOrderNotification(orderData: OrderNotificationData): Promise<void> {
    try {
      // Get branch settings for notification volume
      const branch = await prisma.branch.findUnique({
        where: { id: orderData.branchId },
        select: {
          name: true,
          enableNewOrderRinging: true,
          newOrderSoundPreset: true,
          newOrderSoundVolume: true,
        },
      });

      if (!branch) {
        logger.error('Branch not found for order notification', { branchId: orderData.branchId });
        return;
      }

      // Skip notification if disabled
      if (!branch.enableNewOrderRinging) {
        logger.debug('Order ringing disabled for branch', { branchId: orderData.branchId });
        return;
      }

      // Calculate notification volume based on priority and settings
      const baseVolume = branch.newOrderSoundVolume || 1.0;
      const urgentVolume = 1.5; // Default urgent volume multiplier

      let notificationVolume = baseVolume;
      let soundType = branch.newOrderSoundPreset || 'ring';

      // Increase volume for high-priority orders
      if (orderData.priority === 'HIGH' || orderData.priority === 'URGENT') {
        notificationVolume = Math.min(baseVolume * urgentVolume, 2.0);
        soundType = 'urgent';
      }

      // Extra loud for customer orders (vs employee orders)
      if (orderData.orderSource === 'CUSTOMER') {
        notificationVolume = Math.min(notificationVolume * 1.2, 2.0);
      }

      // Prepare notification payload
      const notificationPayload = {
        type: 'NEW_ORDER',
        data: {
          ...orderData,
          notificationVolume,
          soundType,
          branchName: branch.name,
          timestamp: new Date().toISOString(),
          isUrgent: orderData.priority === 'HIGH' || orderData.priority === 'URGENT',
          isCustomerOrder: orderData.orderSource === 'CUSTOMER',
        },
      };

      // Send to all employees in the branch
      this.io.to(`branch:${orderData.branchId}`).emit('newOrder', notificationPayload);

      // Also send to admins for urgent orders
      if (orderData.priority === 'HIGH' || orderData.priority === 'URGENT') {
        this.io.to('admins').emit('urgentOrder', notificationPayload);
      }

      logger.info('Order notification sent', {
        orderId: orderData.orderId,
        branchId: orderData.branchId,
        priority: orderData.priority,
        orderSource: orderData.orderSource,
        volume: notificationVolume,
        soundType,
      });
    } catch (error) {
      logger.error('Failed to send order notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        orderId: orderData.orderId,
      });
    }
  }

  async sendOrderStatusUpdate(
    orderId: number,
    branchId: number,
    status: string,
    updatedBy: string
  ): Promise<void> {
    try {
      const notificationPayload = {
        type: 'ORDER_STATUS_UPDATE',
        data: {
          orderId,
          branchId,
          status,
          updatedBy,
          timestamp: new Date().toISOString(),
        },
      };

      // Send to branch employees
      this.io.to(`branch:${branchId}`).emit('orderStatusUpdate', notificationPayload);

      // Send to admins
      this.io.to('admins').emit('orderStatusUpdate', notificationPayload);

      logger.info('Order status update sent', {
        orderId,
        branchId,
        status,
        updatedBy,
      });
    } catch (error) {
      logger.error('Failed to send order status update', {
        error: error instanceof Error ? error.message : 'Unknown error',
        orderId,
      });
    }
  }

  async sendPaymentRequest(
    orderId: number,
    branchId: number,
    tableNumber: string,
    customerName: string,
    totalAmount: number
  ): Promise<void> {
    try {
      const notificationPayload = {
        type: 'PAYMENT_REQUEST',
        data: {
          orderId,
          branchId,
          tableNumber,
          customerName,
          totalAmount,
          timestamp: new Date().toISOString(),
        },
      };

      // Send to branch employees with higher priority
      this.io.to(`branch:${branchId}`).emit('paymentRequest', notificationPayload);

      logger.info('Payment request sent', {
        orderId,
        branchId,
        totalAmount,
      });
    } catch (error) {
      logger.error('Failed to send payment request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        orderId,
      });
    }
  }

  async sendEmployeeNotification(
    employeeId: number,
    type: 'SHIFT_START' | 'SHIFT_END' | 'BREAK_START' | 'BREAK_END',
    data: any
  ): Promise<void> {
    try {
      const notificationPayload = {
        type: 'EMPLOYEE_NOTIFICATION',
        data: {
          employeeId,
          notificationType: type,
          ...data,
          timestamp: new Date().toISOString(),
        },
      };

      // Send to specific employee
      this.io.to(`employee:${employeeId}`).emit('employeeNotification', notificationPayload);

      logger.info('Employee notification sent', {
        employeeId,
        type,
      });
    } catch (error) {
      logger.error('Failed to send employee notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        employeeId,
        type,
      });
    }
  }

  // Test notification system
  async testNotification(branchId: number, employeeId?: number): Promise<void> {
    try {
      const testPayload = {
        type: 'TEST_NOTIFICATION',
        data: {
          branchId,
          employeeId,
          message: 'Test notification - System is working!',
          timestamp: new Date().toISOString(),
        },
      };

      if (employeeId) {
        this.io.to(`employee:${employeeId}`).emit('test', testPayload);
      } else {
        this.io.to(`branch:${branchId}`).emit('test', testPayload);
      }

      logger.info('Test notification sent', { branchId, employeeId });
    } catch (error) {
      logger.error('Failed to send test notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        branchId,
      });
    }
  }
}

// Helper function to determine order priority
export function determineOrderPriority(
  orderType: 'DINE_IN' | 'TAKE_AWAY',
  orderSource: 'CUSTOMER' | 'EMPLOYEE',
  totalAmount: number,
  itemCount: number
): 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' {
  // Customer orders get higher priority
  if (orderSource === 'CUSTOMER') {
    if (totalAmount > 1000 || itemCount > 10) {
      return 'URGENT';
    }
    if (totalAmount > 500 || itemCount > 5) {
      return 'HIGH';
    }
    return 'NORMAL';
  }

  // Employee orders are typically lower priority
  if (orderSource === 'EMPLOYEE') {
    if (totalAmount > 800 || itemCount > 8) {
      return 'NORMAL';
    }
    return 'LOW';
  }

  return 'NORMAL';
}

export default OrderNotificationService;
