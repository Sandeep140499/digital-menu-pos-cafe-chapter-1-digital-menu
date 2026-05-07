/**
 * Order invoice PDF (INV-YYYY-NNNN.pdf) — layout aligned with payslip HTML in AdminDashboard
 * (`buildPayslipPrintHtmlModule`): watermark logo, header band, two-column meta, table, green total block.
 */
import { PDFDocument, StandardFonts, rgb, type PDFImage } from 'pdf-lib';
import { filterOrderItemsForReceipt } from '../utils/orderItemsFilter.js';

const RESTAURANT_NAME = process.env.RESTAURANT_NAME || 'CAFE CHAPTER 1 RESTRO';
const RESTAURANT_GSTIN = process.env.RESTAURANT_GSTIN || '';
const DEFAULT_ADDRESS = process.env.RESTAURANT_ADDRESS || 'Green Park, Gautam Nagar, New Delhi';
const MENU_BASE_URL = process.env.MENU_BASE_URL || '';
const GOOGLE_REVIEW_URL = process.env.GOOGLE_REVIEW_URL || '';

/** Tailwind slate / emerald palette (matches salary slip print HTML). */
const SLATE_200 = rgb(226 / 255, 232 / 255, 240 / 255);
const SLATE_100 = rgb(241 / 255, 245 / 255, 249 / 255);
const SLATE_600 = rgb(71 / 255, 85 / 255, 105 / 255);
const SLATE_500 = rgb(100 / 255, 116 / 255, 139 / 255);
const EMERALD_700 = rgb(4 / 255, 120 / 255, 87 / 255);

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
  orderType: string;
  items: OrderItemForPdf[];
  branch?: BranchInfo | null;
  acceptedBy?: { name: string; role?: string | null } | null;
};

export function getInvoiceFileName(orderId: number): string {
  const year = new Date().getFullYear();
  const padded = String(orderId).padStart(4, '0');
  return `INV-${year}-${padded}.pdf`;
}

export function pdfWinAnsiSafe(input: string | null | undefined, maxLen = 220): string {
  let s = String(input ?? '')
    .replace(/\u20B9/g, 'Rs.')
    .replace(/\r\n/g, ' ')
    .replace(/[\r\n\t]/g, ' ');
  s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  let out = '';
  for (let i = 0; i < s.length && out.length < maxLen; i++) {
    const c = s[i]!;
    const code = c.charCodeAt(0);
    if (code >= 32 && code <= 126) out += c;
    else out += ' ';
  }
  return out.replace(/\s+/g, ' ').trim() || '-';
}

function rs(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 'Rs. 0';
  return `Rs. ${n.toFixed(0)}`;
}

export function buildInvoicePdfPublicUrl(orderId: number): string | undefined {
  const raw = (process.env.PUBLIC_API_BASE_URL || '').trim();
  if (!raw) return undefined;
  const base = raw.replace(/\/+$/, '');
  if (/\/api$/i.test(base)) return `${base}/orders/${orderId}/invoice-pdf`;
  return `${base}/api/orders/${orderId}/invoice-pdf`;
}

export async function generateOrderInvoicePdf(order: OrderForPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSmall = await doc.embedFont(StandardFonts.Helvetica);

  let headerImage: PDFImage | null = null;
  const logoUrl = order.branch?.logoUrl;
  if (logoUrl && typeof logoUrl === 'string') {
    try {
      let bytes: Uint8Array;
      if (logoUrl.startsWith('data:')) {
        const base64 = logoUrl.replace(/^data:image\/\w+;base64,/, '');
        bytes = new Uint8Array(Buffer.from(base64, 'base64'));
      } else {
        const resp = await fetch(logoUrl);
        if (!resp.ok) throw new Error('Logo fetch failed');
        bytes = new Uint8Array(await resp.arrayBuffer());
      }
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      headerImage = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    } catch (_) {
      headerImage = null;
    }
  }

  let page = doc.addPage([210, 297]);
  const { width, height } = page.getSize();
  const margin = 24;
  const lineHeight = 12;
  const lineHeightSmall = 10;
  const floorY = margin + 14;
  const colItem = margin + 4;
  const colQty = width - margin - 118;
  const colPrice = width - margin - 78;
  const colTotal = width - margin - 4;
  let y = height - margin;

  const drawWatermark = () => {
    if (!headerImage) return;
    const iw = headerImage.width;
    const ih = headerImage.height;
    if (iw <= 0 || ih <= 0) return;
    const scale = Math.min((width * 0.82) / iw, (height * 0.72) / ih);
    const wmW = iw * scale;
    const wmH = ih * scale;
    page.drawImage(headerImage, {
      x: (width - wmW) / 2,
      y: (height - wmH) / 2,
      width: wmW,
      height: wmH,
      opacity: 0.06,
    });
  };

  drawWatermark();

  const drawItemColumnHeaders = () => {
    const bandH = 14;
    const bandBottom = y - 4;
    page.drawRectangle({
      x: margin,
      y: bandBottom,
      width: width - 2 * margin,
      height: bandH,
      color: SLATE_100,
      borderColor: SLATE_200,
      borderWidth: 0.35,
    });
    page.drawText('Item', { x: colItem, y, size: 9, font: fontBold, color: rgb(0, 0, 0) });
    page.drawText('Qty', { x: colQty, y, size: 9, font: fontBold, color: rgb(0, 0, 0) });
    page.drawText('Rate (Rs.)', { x: colPrice, y, size: 9, font: fontBold, color: rgb(0, 0, 0) });
    const amtHdr = 'Amount (Rs.)';
    const amtTw = fontBold.widthOfTextAtSize(amtHdr, 9);
    page.drawText(amtHdr, {
      x: width - margin - amtTw - 2,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight + 2;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: SLATE_200,
    });
    y -= 6;
  };

  const ensureSpace = (reserve: number, repeatItemHeaders = false) => {
    if (y - reserve >= floorY) return;
    page = doc.addPage([210, 297]);
    drawWatermark();
    y = height - margin;
    page.drawText('(continued)', { x: margin, y, size: 8, font: fontSmall, color: SLATE_500 });
    y -= lineHeightSmall + 4;
    if (repeatItemHeaders) drawItemColumnHeaders();
  };

  const name = pdfWinAnsiSafe(order.branch?.name || RESTAURANT_NAME, 120);
  const location = pdfWinAnsiSafe(order.branch?.location || DEFAULT_ADDRESS, 200);
  const phone = pdfWinAnsiSafe(order.branch?.phone || '', 20);
  const gstin = pdfWinAnsiSafe(RESTAURANT_GSTIN, 24);
  const reviewUrl = pdfWinAnsiSafe(order.branch?.googleReviewUrl || GOOGLE_REVIEW_URL, 240);

  const drawHeaderRule = () => {
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1.2,
      color: SLATE_200,
    });
    y -= 14;
  };

  const metaPairRow = (
    leftLabel: string,
    leftVal: string,
    rightLabel: string,
    rightVal: string,
    size = 9
  ) => {
    const mid = width / 2 + 8;
    const lw = pdfWinAnsiSafe(`${leftLabel}: ${leftVal}`, 85);
    const rw = pdfWinAnsiSafe(`${rightLabel}: ${rightVal}`, 85);
    page.drawText(lw, { x: margin, y, size, font: font, color: rgb(0, 0, 0) });
    page.drawText(rw, { x: mid, y, size, font: font, color: rgb(0, 0, 0) });
    y -= lineHeight;
  };

  // ----- Header block (same rhythm as salary slip: logo, company, address, phone, title) -----
  if (headerImage) {
    const iw = headerImage.width;
    const ih = headerImage.height;
    if (iw > 0 && ih > 0) {
      const logoH = 48;
      const logoW = (iw / ih) * logoH;
      if (Number.isFinite(logoW) && logoW > 0 && logoW < width - 2 * margin) {
        ensureSpace(logoH + 24, false);
        const logoX = (width - logoW) / 2;
        page.drawImage(headerImage, { x: logoX, y: y - logoH, width: logoW, height: logoH });
        y -= logoH + 10;
      }
    }
  }

  page.drawText(name, { x: margin, y, size: 18, font: fontBold, color: rgb(0, 0, 0) });
  y -= 22;
  page.drawText(location, { x: margin, y, size: 10, font: font, color: SLATE_600 });
  y -= lineHeight + 2;
  if (phone && phone !== '-') {
    page.drawText(`Ph: +91 ${phone}`, { x: margin, y, size: 9, font: fontSmall, color: SLATE_500 });
    y -= lineHeightSmall + 2;
  }
  if (gstin && gstin !== '-') {
    page.drawText(`GSTIN: ${gstin}`, { x: margin, y, size: 9, font: fontSmall, color: SLATE_500 });
    y -= lineHeightSmall + 2;
  }
  y -= 4;

  const dateStr = order.createdAt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = order.createdAt.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const titleMonth = order.createdAt.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
  page.drawText(`Order Invoice — ${pdfWinAnsiSafe(titleMonth, 48)}`, {
    x: margin,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= lineHeight + 8;
  drawHeaderRule();

  const orderIdStr = `ORD${String(order.id).padStart(4, '0')}`;
  metaPairRow(
    'Order Invoice No.',
    orderIdStr,
    'Customer Name',
    pdfWinAnsiSafe(order.customerName || '-', 60)
  );
  metaPairRow(
    'Mobile',
    pdfWinAnsiSafe(order.customerMobile || '-', 14),
    'Table',
    pdfWinAnsiSafe(order.tableNumber, 20)
  );
  metaPairRow('Date', pdfWinAnsiSafe(dateStr, 28), 'Time', pdfWinAnsiSafe(timeStr, 16));
  metaPairRow(
    'Order Type',
    pdfWinAnsiSafe(order.orderType, 28),
    'Payment Status',
    pdfWinAnsiSafe(order.paymentStatus, 24)
  );
  page.drawText(`Order Status: ${pdfWinAnsiSafe(order.status, 100)}`, {
    x: margin,
    y,
    size: 9,
    font: font,
    color: rgb(0, 0, 0),
  });
  y -= lineHeight;
  if (order.acceptedBy?.name) {
    const acc = order.acceptedBy.role
      ? `${order.acceptedBy.name} (${order.acceptedBy.role})`
      : order.acceptedBy.name;
    page.drawText(`Accepted by: ${pdfWinAnsiSafe(acc, 100)}`, {
      x: margin,
      y,
      size: 9,
      font: fontSmall,
      color: SLATE_600,
    });
    y -= lineHeightSmall;
  }
  y -= 10;

  // ----- Items table (Earnings-style) -----
  ensureSpace(lineHeight + 22 + 8, false);
  page.drawText('Items', { x: margin, y, size: 10, font: fontBold, color: rgb(0, 0, 0) });
  y -= lineHeight + 4;
  drawItemColumnHeaders();

  const items = filterOrderItemsForReceipt(order.items);
  const stripVariantMarkers = (n: string): string =>
    (n || '')
      .replace(/\s*\(5pc\s*\/\s*8pc\)\s*/gi, ' ')
      .replace(/\s*\(half\s*\/\s*full\)\s*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim() || n;
  const isPcItemName = (n: string): boolean => /\bmomos?\b/i.test(n || '');
  const variantLabel = (itemName: string, v: string | null | undefined) => {
    if (!v) return '';
    const pc = isPcItemName(itemName);
    if (v === 'HALF') return pc ? '5pc' : 'Half';
    if (v === 'FULL') return pc ? '8pc' : 'Full';
    return v;
  };

  for (const item of items) {
    ensureSpace(lineHeightSmall + 8, true);
    const baseName = stripVariantMarkers(item.name);
    const suffix = variantLabel(baseName, item.variant);
    const label = suffix ? `${baseName} (${suffix})` : baseName;
    const qty = Number(item.quantity);
    const price = Number(item.price);
    const safeQty = Number.isFinite(qty) ? qty : 0;
    const safePrice = Number.isFinite(price) ? price : 0;
    const lineTotal = safeQty * safePrice;
    const labelSafe = pdfWinAnsiSafe(label, 90);
    const labelShort = labelSafe.length > 36 ? labelSafe.slice(0, 33) + '...' : labelSafe;
    page.drawText(labelShort, { x: colItem, y, size: 9, font: fontSmall, color: rgb(0, 0, 0) });
    page.drawText(String(safeQty), { x: colQty, y, size: 9, font: fontSmall, color: rgb(0, 0, 0) });
    page.drawText(rs(safePrice), { x: colPrice, y, size: 9, font: fontSmall, color: rgb(0, 0, 0) });
    const totStr = rs(lineTotal);
    const tw = fontSmall.widthOfTextAtSize(totStr, 9);
    page.drawText(totStr, {
      x: width - margin - tw - 2,
      y,
      size: 9,
      font: fontSmall,
      color: rgb(0, 0, 0),
    });
    y -= lineHeightSmall;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.35,
      color: SLATE_200,
    });
    y -= 3;
  }

  y -= 8;
  ensureSpace(100, false);

  // ----- Totals (.net block — same idea as Net Salary) -----
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 2,
    color: EMERALD_700,
  });
  y -= 14;
  const totalAmt = Number(order.totalAmount);
  const safeTotal = Number.isFinite(totalAmt) ? totalAmt : 0;

  const rowBetween = (
    left: string,
    right: string,
    sz: number,
    bold: boolean,
    color = rgb(0, 0, 0)
  ) => {
    const f = bold ? fontBold : font;
    page.drawText(left, { x: margin, y, size: sz, font: f, color });
    const tw = f.widthOfTextAtSize(right, sz);
    page.drawText(right, { x: width - margin - tw - 2, y, size: sz, font: f, color });
    y -= lineHeight;
  };

  rowBetween('Subtotal', rs(safeTotal), 10, false, SLATE_600);
  rowBetween('GST', 'Included', 9, false, SLATE_500);
  y -= 4;
  rowBetween('Total Amount', rs(safeTotal), 12, true, EMERALD_700);

  y -= 16;
  ensureSpace(lineHeightSmall * 4 + 28, false);
  page.drawText('Authorized Signature — ' + name, {
    x: margin,
    y,
    size: 10,
    font: font,
    color: SLATE_500,
  });
  y -= lineHeight + 16;

  if (MENU_BASE_URL || (reviewUrl && reviewUrl !== '-')) {
    page.drawText('—', {
      x: (width - fontSmall.widthOfTextAtSize('—', 8)) / 2,
      y,
      size: 8,
      font: fontSmall,
      color: SLATE_200,
    });
    y -= lineHeightSmall;
    if (MENU_BASE_URL) {
      page.drawText(`Menu: ${pdfWinAnsiSafe(MENU_BASE_URL, 200)}`, {
        x: margin,
        y,
        size: 8,
        font: fontSmall,
        color: SLATE_500,
      });
      y -= lineHeightSmall;
    }
    if (reviewUrl && reviewUrl !== '-') {
      page.drawText(`Review us: ${reviewUrl}`, {
        x: margin,
        y,
        size: 8,
        font: fontSmall,
        color: SLATE_500,
      });
      y -= lineHeightSmall;
    }
  }
  y -= 4;
  page.drawText('(This is a system generated document.)', {
    x: margin,
    y,
    size: 8,
    font: fontSmall,
    color: SLATE_500,
  });
  y -= lineHeightSmall;
  page.drawText('Powered by Cafe Chapter 1 Smart Ordering System', {
    x: margin,
    y,
    size: 7,
    font: fontSmall,
    color: SLATE_200,
  });

  return doc.save();
}
