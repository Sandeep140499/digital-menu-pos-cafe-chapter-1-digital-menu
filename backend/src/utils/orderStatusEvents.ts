import { EventEmitter } from "events";
import type { OrderStatus } from "@prisma/client";

export type OrderStatusPayload = {
  id: number;
  status: OrderStatus;
  acceptedAt?: Date | null;
  completedAt?: Date | null;
  updatedAt?: Date | null;
};

const emitter = new EventEmitter();
// Prevent MaxListeners warnings when many customers watch.
emitter.setMaxListeners(0);

export function publishOrderStatus(payload: OrderStatusPayload) {
  emitter.emit(`order-status:${payload.id}`, payload);
}

export function onOrderStatus(
  orderId: number,
  handler: (payload: OrderStatusPayload) => void,
) {
  const event = `order-status:${orderId}`;
  emitter.on(event, handler);
  return () => emitter.off(event, handler);
}

