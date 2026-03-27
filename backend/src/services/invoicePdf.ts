/**
 * Professional restaurant invoice PDF (INV-YYYY-NNNN.pdf).
 * Used for order confirmation and WhatsApp attachment.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const RESTAURANT_NAME = process.env.RESTAURANT_NAME || 'CAFE CHAPTER 1 RESTRO';
const RESTAURANT_GSTIN = process.env.RESTAURANT_GSTIN || '';
const DEFAULT_ADDRESS = process.env.RESTAURANT_ADDRESS || 'Green Park, Gautam Nagar, New Delhi';
const MENU_BASE_URL = process.env.MENU_BASE_URL || '';
const GOOGLE_REVIEW_URL = process.env.GOOGLE_REVIEW_URL || '';

export type BranchInfo = {
  name?: string | null;
  location?: string | null;
  phone?: string | null;
  googleReviewUrl?: string | null;
  logoUrl?: string | null;
};

export type OrderItemForPdf = {
  name: string;
  quantity: number;
  price: number;
  variant?: string | null;
  isRemoved?: boolean;
};

export type OrderForPdf = {
  id: number;
  createdAt: Date;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  customerName: string | null;
  customerMobile: string | null;
  tableNumber: string;
  orderType: string; // "Dine-In" | "Takeaway"
  items: OrderItemForPdf[];
  branch?: BranchInfo | null;
  acceptedBy?: { name: string; role?: string | null } | null;
};

/** Professional filename: INV-YYYY-NNNN.pdf */
export function getInvoiceFileName(orderId: number): string {
  const year = new Date().getFullYear();
  const padded = String(orderId).padStart(4, '0');
  return `INV-${year}-${padded}.pdf`;
}

export async function generateOrderInvoicePdf(order: OrderForPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSmall = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([210, 297]); // A4 narrow
  const { width, height } = page.getSize();
  const margin = 25;
  const lineHeight = 12;
  const lineHeightSmall = 10;
  let y = height - margin;

  const name = order.branch?.name || RESTAURANT_NAME;
  const location = order.branch?.location || DEFAULT_ADDRESS;
  const phone = order.branch?.phone || '';
  const gstin = RESTAURANT_GSTIN;
  const reviewUrl = order.branch?.googleReviewUrl || GOOGLE_REVIEW_URL;

  const drawLine = () => {
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 6;
  };

  const drawText = (text: string, size: number, bold = false) => {
    const f = bold ? fontBold : font;
    page.drawText(text, { x: margin, y, size, font: f });
    y -= size + 2;
  };

  const drawTextRight = (text: string, size: number) => {
    const tw = fontSmall.widthOfTextAtSize(text, size);
    page.drawText(text, { x: width - margin - tw, y, size, font: fontSmall });
    y -= lineHeight;
  };

  const drawTextCenter = (text: string, size: number, bold = false) => {
    const f = bold ? fontBold : font;
    const tw = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - tw) / 2, y, size, font: f });
    y -= lineHeight;
  };

  // Header: logo if available (URL or data URL), then name/location
  const logoUrl = order.branch?.logoUrl;
  if (logoUrl && typeof logoUrl === 'string') {
    try {
      let bytes: Uint8Array;
      if (logoUrl.startsWith('data:')) {
        const base64 = logoUrl.replace(/^data:image\/\w+;base64,/, '');
        const raw = Buffer.from(base64, 'base64');
        bytes = new Uint8Array(raw);
      } else {
        const resp = await fetch(logoUrl);
        if (!resp.ok) throw new Error('Logo fetch failed');
        const buf = await resp.arrayBuffer();
        bytes = new Uint8Array(buf);
      }
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const logoW = 60;
      const logoH = (img.height / img.width) * logoW;
      const logoX = (width - logoW) / 2;
      page.drawImage(img, { x: logoX, y: y - logoH, width: logoW, height: logoH });
      y -= logoH + 8;
    } catch (_) {
      // ignore logo on fetch/embed error
    }
  }
  drawTextCenter(name.toUpperCase(), 16, true);
  y -= 2;
  drawTextCenter(location, 10);
  if (phone) {
    page.drawText(`Phone: +91 ${phone}`, { x: margin, y, size: 9, font: fontSmall });
    y -= lineHeightSmall;
  }
  if (gstin) {
    page.drawText(`GSTIN: ${gstin}`, { x: margin, y, size: 9, font: fontSmall });
    y -= lineHeightSmall;
  }
  y -= 6;
  drawLine();

  // ORDER INVOICE
  drawText('ORDER INVOICE', 12, true);
  y -= 4;
  const orderIdStr = `ORD${String(order.id).padStart(4, '0')}`;
  page.drawText(`Order ID: ${orderIdStr}`, { x: margin, y, size: 10, font: font });
  y -= lineHeight;
  const dateStr = order.createdAt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = order.createdAt.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  page.drawText(`Date: ${dateStr}`, { x: margin, y, size: 10, font: font });
  page.drawText(`Time: ${timeStr}`, { x: width - margin - 60, y, size: 10, font: font });
  y -= lineHeight;
  page.drawText(`Customer: ${order.customerName || '-'}`, { x: margin, y, size: 10, font: font });
  y -= lineHeight;
  page.drawText(`Mobile: ${order.customerMobile || '-'}`, { x: margin, y, size: 10, font: font });
  y -= lineHeight;
  page.drawText(`Order Type: ${order.orderType}`, { x: margin, y, size: 10, font: font });
  page.drawText(`Table: ${order.tableNumber}`, { x: width - margin - 80, y, size: 10, font: font });
  y -= lineHeight;
  if (order.acceptedBy?.name) {
    const acceptedLabel = order.acceptedBy.role
      ? `Accepted by: ${order.acceptedBy.name} (${order.acceptedBy.role})`
      : `Accepted by: ${order.acceptedBy.name}`;
    page.drawText(acceptedLabel, { x: margin, y, size: 9, font: fontSmall });
    y -= lineHeightSmall;
  }
  y -= 6;
  drawLine();

  // ITEM DETAILS
  drawText('ITEM DETAILS', 11, true);
  y -= 8;
  const colItem = margin;
  const colQty = width - margin - 120;
  const colPrice = width - margin - 80;
  const colTotal = width - margin - 35;
  page.drawText('Item', { x: colItem, y, size: 9, font: fontBold });
  page.drawText('Qty', { x: colQty, y, size: 9, font: fontBold });
  page.drawText('Price', { x: colPrice, y, size: 9, font: fontBold });
  page.drawText('Total', { x: colTotal, y, size: 9, font: fontBold });
  y -= lineHeight;

  const items = order.items.filter(i => !i.isRemoved);

  const stripVariantMarkers = (name: string): string =>
    (name || '')
      .replace(/\s*\(5pc\s*\/\s*8pc\)\s*/gi, ' ')
      .replace(/\s*\(half\s*\/\s*full\)\s*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim() || name;

  // We do not store category on order items. Use a conservative heuristic:
  // - Momos are the only items that should show 5pc/8pc labels.
  const isPcItemName = (name: string): boolean => /\bmomos?\b/i.test(name || '');

  const variantLabel = (itemName: string, v: string | null | undefined) => {
    if (!v) return '';
    const pc = isPcItemName(itemName);
    if (v === 'HALF') return pc ? '5pc' : 'Half';
    if (v === 'FULL') return pc ? '8pc' : 'Full';
    return v;
  };
  for (const item of items) {
    const baseName = stripVariantMarkers(item.name);
    const suffix = variantLabel(baseName, item.variant);
    const label = suffix ? `${baseName} (${suffix})` : baseName;
    const total = item.price * item.quantity;
    const labelShort = label.length > 32 ? label.slice(0, 29) + '...' : label;
    page.drawText(labelShort, { x: colItem, y, size: 9, font: fontSmall });
    page.drawText(String(item.quantity), { x: colQty, y, size: 9, font: fontSmall });
    page.drawText(`₹${item.price.toFixed(0)}`, { x: colPrice, y, size: 9, font: fontSmall });
    page.drawText(`₹${total.toFixed(0)}`, { x: colTotal, y, size: 9, font: fontSmall });
    y -= lineHeightSmall;
  }
  y -= 6;
  drawLine();

  page.drawText('Subtotal:', { x: colPrice - 40, y, size: 10, font: font });
  page.drawText(`₹${order.totalAmount.toFixed(0)}`, { x: colTotal, y, size: 10, font: font });
  y -= lineHeight;
  page.drawText('GST: Included', { x: colPrice - 40, y, size: 9, font: fontSmall });
  y -= lineHeight;
  page.drawText('Total Amount:', { x: margin, y, size: 11, font: fontBold });
  page.drawText(`₹${order.totalAmount.toFixed(0)}`, { x: colTotal, y, size: 11, font: fontBold });
  y -= lineHeight + 4;
  drawLine();

  page.drawText(`Payment Status: ${order.paymentStatus}`, { x: margin, y, size: 10, font: font });
  y -= lineHeight;
  page.drawText(`Order Status: ${order.status}`, { x: margin, y, size: 10, font: font });
  y -= 12;
  drawLine();

  // Footer
  drawTextCenter('Thank you for visiting', 11);
  drawTextCenter(`${name} ❤️`, 11, true);
  drawTextCenter('Visit Again', 10);
  y -= 8;
  if (MENU_BASE_URL) {
    page.drawText(`Menu: ${MENU_BASE_URL}`, { x: margin, y, size: 8, font: fontSmall });
    y -= lineHeightSmall;
  }
  if (reviewUrl) {
    page.drawText(`Review us: ${reviewUrl}`, { x: margin, y, size: 8, font: fontSmall });
    y -= lineHeightSmall;
  }
  y -= 8;
  drawLine();
  drawTextCenter('(This is a system generated bill)', 8);
  y -= 6;
  drawTextCenter('Powered by Cafe Chapter 1 Smart Ordering System', 7);

  return doc.save();
}
