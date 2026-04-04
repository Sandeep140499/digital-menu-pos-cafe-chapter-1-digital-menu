/**
 * WhatsApp message builder for Cafe Chapter 1.
 * Builds invoice, status, and payment messages. Use waMeLink to open WhatsApp with pre-filled text.
 */

import { filterOrderItemsForReceipt } from '../utils/orderItemsFilter.js';

const RESTAURANT_NAME = process.env.RESTAURANT_NAME || 'CAFE CHAPTER 1 RESTRO';
const RESTAURANT_PHONE = process.env.RESTAURANT_PHONE || '';
const DEFAULT_REVIEW_URL = process.env.GOOGLE_REVIEW_URL || '';
const DEFAULT_ADDRESS = process.env.RESTAURANT_ADDRESS || 'Green Park, Gautam Nagar, New Delhi';
const MENU_BASE_URL = process.env.MENU_BASE_URL || '';

export type BranchInfo = {
  name?: string | null;
  location?: string | null;
  logoUrl?: string | null;
  phone?: string | null;
  googleReviewUrl?: string | null;
  instagramUrl?: string | null;
  showTotalAmountToCustomers?: boolean | null;
};

function normalizeMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return `91${digits.slice(-10)}`;
}

export function getWaMeLink(mobile: string, text: string): string {
  const num = normalizeMobile(mobile);
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

/** Short professional order confirmation (PDF invoice attached separately or via link). */
export function buildOrderInvoice(params: {
  orderId: number;
  customerName: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    variant?: string | null;
    isRemoved?: boolean;
  }>;
  totalAmount: number;
  tableNumber: string;
  branch?: BranchInfo | null;
  invoicePdfUrl?: string | null;
  acceptedBy?: { name: string; role?: string | null } | null;
}): string {
  const { orderId, customerName, totalAmount, tableNumber, branch, invoicePdfUrl, acceptedBy } =
    params;
  const name = branch?.name || RESTAURANT_NAME;
  const location = branch?.location || DEFAULT_ADDRESS;
  const phone = branch?.phone || RESTAURANT_PHONE;
  const menuUrl = MENU_BASE_URL;
  const orderIdStr = `ORD${String(orderId).padStart(4, '0')}`;

  let msg = `Hello ${customerName} 👋\n\n`;
  msg += `Your order has been confirmed at\n${name}\n\n`;
  msg += `Order ID: ${orderIdStr}\n`;
  msg += `Branch: ${location}\n`;
  if (acceptedBy?.name) {
    msg += `Order accepted by: ${acceptedBy.name}${acceptedBy.role ? ` (${acceptedBy.role})` : ''}\n`;
  }
  if (branch?.showTotalAmountToCustomers !== false) {
    msg += `Total Amount: ₹${totalAmount.toFixed(0)}\n`;
  }
  msg += `Status: Preparing 👨‍🍳\n\n`;
  if (invoicePdfUrl) {
    msg += `Your invoice is attached with this message.\n\n`;
    msg += `Download invoice: ${invoicePdfUrl}\n\n`;
  } else {
    msg += `Your invoice is attached with this message.\n\n`;
  }
  msg += `We will notify you once your order is ready.\n\n`;
  if (menuUrl) msg += `Track Order:\n${menuUrl}\n\n`;
  if (phone) msg += `Need help?\nCall: +91 ${phone}\n\n`;
  msg += `Thank you for visiting ❤️`;
  // Review link is sent only when employee marks order as Paid (buildPaymentMessage), not in order confirmation.
  return msg;
}

/** Status update – Preparing / Ready / Completed (professional templates). */
export function buildStatusMessage(params: {
  orderId: number;
  customerName: string;
  status: string;
  tableNumber?: string;
  totalAmount?: number;
  branch?: BranchInfo | null;
}): string {
  const { orderId, customerName, status, tableNumber, totalAmount, branch } = params;
  const orderIdStr = `ORD${String(orderId).padStart(4, '0')}`;

  if (status === 'Preparing' || status.toLowerCase().includes('preparing')) {
    return `Order ${orderIdStr} is being prepared 👨‍🍳`;
  }
  if (status === 'Served' || status.toLowerCase().includes('ready')) {
    let msg = `Hello ${customerName} 🔔\n\n`;
    msg += `Your order ${orderIdStr} is READY.\n\n`;
    if (tableNumber) msg += `Please collect from Table ${tableNumber}.\n\n`;
    if (branch?.showTotalAmountToCustomers !== false && totalAmount != null)
      msg += `Amount: ₹${totalAmount.toFixed(0)}\n`;
    msg += `Payment: Pending`;
    return msg;
  }
  if (status === 'Completed' || status.toLowerCase().includes('complete')) {
    let msg = `Order Completed ✅\n\n`;
    if (branch?.showTotalAmountToCustomers !== false && totalAmount != null)
      msg += `Total Paid: ₹${totalAmount.toFixed(0)}\n\n`;
    msg += `Thank you ❤️`;
    return msg;
  }
  let msg = `Hello ${customerName} 👋\n\n`;
  msg += `Order ID: ${orderIdStr}\n`;
  msg += `Status: ${status}\n\n`;
  if (branch?.googleReviewUrl) msg += `Please review us:\n${branch.googleReviewUrl}\n`;
  return msg;
}

/** Payment received / pending – professional templates. */
export function buildPaymentMessage(params: {
  orderId: number;
  customerName: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
    variant?: string | null;
    isRemoved?: boolean;
  }>;
  totalAmount: number;
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  includeReviewLink: boolean;
  branch?: BranchInfo | null;
}): string {
  const { orderId, customerName, items, totalAmount, paymentStatus, includeReviewLink, branch } =
    params;
  const name = branch?.name || RESTAURANT_NAME;
  const reviewUrl = branch?.googleReviewUrl || DEFAULT_REVIEW_URL;
  const instagramUrl = branch?.instagramUrl || process.env.INSTAGRAM_URL || '';
  const orderIdStr = `ORD${String(orderId).padStart(4, '0')}`;
  const menuUrl = MENU_BASE_URL;

  const visibleItems = filterOrderItemsForReceipt(items || []);
  const itemLines =
    visibleItems.length > 0
      ? visibleItems
          .map(i => {
            const v = i.variant ? ` (${i.variant})` : '';
            return `- ${i.name}${v} x${i.quantity}`;
          })
          .join('\n')
      : '';

  if (paymentStatus === 'PAID') {
    let msg = `Payment Received 💳\n\n`;
    msg += `Order: ${orderIdStr}\n`;
    msg += `Restaurant: ${name}\n\n`;
    if (itemLines) {
      msg += `Items:\n${itemLines}\n\n`;
    }
    if (branch?.showTotalAmountToCustomers !== false) {
      msg += `Total Amount: ₹${totalAmount.toFixed(0)}\n\n`;
    }
    if (menuUrl) msg += `Menu:\n${menuUrl}\n\n`;
    if (includeReviewLink && reviewUrl) msg += `Google Review:\n${reviewUrl}\n\n`;
    if (instagramUrl) msg += `Instagram:\n${instagramUrl}\n\n`;
    msg += `Thank you ❤️`;
    return msg;
  }
  let msg = `Payment Pending ⚠️\n\n`;
  msg += `Hello ${customerName},\n\n`;
  msg += `Order ID: ${orderIdStr}\n`;
  if (branch?.showTotalAmountToCustomers !== false) {
    msg += `Amount: ₹${totalAmount.toFixed(0)}\n\n`;
  }
  msg += `Please pay at the counter.\n`;
  return msg;
}

/** Customer query resolved – notify customer via WhatsApp. */
export function buildQueryResolvedMessage(params: {
  customerName: string;
  orderId?: number | null;
}): string {
  const { customerName, orderId } = params;
  const orderIdStr = orderId != null ? `ORD${String(orderId).padStart(4, '0')}` : 'your request';
  return `Hello ${customerName} 👋\n\nYour query regarding order ${orderIdStr} has been resolved.\n\nThank you for your patience ❤️\n\nContact us if needed.`;
}

/** New item launch broadcast – details + menu URL. */
export function buildNewItemBroadcast(params: {
  itemNames: string[];
  itemDetails?: string;
  branch?: BranchInfo | null;
}): string {
  const { itemNames, itemDetails, branch } = params;
  const name = branch?.name || RESTAURANT_NAME;
  const menuUrl = MENU_BASE_URL;

  let msg = `*${name}*\n\n`;
  msg += `*NEW LAUNCH* 🎉\n\n`;
  msg += itemNames.join(', ');
  msg += `\n\n`;
  if (itemDetails) msg += `${itemDetails}\n\n`;
  msg += `View full menu & order:\n${menuUrl || 'Visit us at the restaurant'}\n`;
  return msg;
}
