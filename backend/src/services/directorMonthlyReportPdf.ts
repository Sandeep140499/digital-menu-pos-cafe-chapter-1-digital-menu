import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type MonthlyDirectorReportData = {
  monthLabel: string; // e.g. "March 2026"
  monthKey: string; // YYYY-MM
  fromDateLabel: string; // e.g. "01 Mar 2026"
  toDateLabel: string; // e.g. "31 Mar 2026"
  totalRevenue: number;
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  uniqueCustomers: number;
  newCustomersCount: number;
  totalLosses: number;
  avgDailySale: number;
  avgDailyOrders: number;
};

function formatINR(n: number): string {
  return "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
}

export function getMonthlyDirectorReportFileName(monthKey: string): string {
  return `Monthly-Director-Report-${monthKey}.pdf`;
}

export async function generateMonthlyDirectorReportPdf(
  data: MonthlyDirectorReportData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = 44;
  let y = height - margin;

  const drawText = (text: string, size = 11, bold = false, color = rgb(0.1, 0.12, 0.16)) => {
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: bold ? fontBold : font,
      color,
    });
    y -= size + 6;
  };

  const drawKVRow = (k: string, v: string) => {
    const rowH = 18;
    const leftW = 230;
    const rightW = width - margin * 2 - leftW;
    const x0 = margin;
    const y0 = y;

    page.drawRectangle({
      x: x0,
      y: y0 - rowH,
      width: leftW,
      height: rowH,
      color: rgb(0.96, 0.98, 1),
      borderColor: rgb(0.88, 0.9, 0.94),
      borderWidth: 1,
    });
    page.drawRectangle({
      x: x0 + leftW,
      y: y0 - rowH,
      width: rightW,
      height: rowH,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.88, 0.9, 0.94),
      borderWidth: 1,
    });

    page.drawText(k, { x: x0 + 10, y: y0 - 13, size: 10, font: fontBold, color: rgb(0.2, 0.24, 0.3) });
    page.drawText(v, { x: x0 + leftW + 10, y: y0 - 13, size: 10, font, color: rgb(0.1, 0.12, 0.16) });
    y -= rowH;
  };

  // Header
  drawText("Monthly Director Business Report", 18, true, rgb(0.02, 0.5, 0.34));
  drawText(`${data.monthLabel}  •  ${data.fromDateLabel} – ${data.toDateLabel}`, 11, false, rgb(0.35, 0.4, 0.47));
  y -= 10;

  // Summary cards
  drawText("Executive Summary", 13, true);
  y += 2;
  drawKVRow("Total revenue (Paid)", formatINR(data.totalRevenue));
  drawKVRow("Total orders", String(data.totalOrders));
  drawKVRow("Paid orders", String(data.paidOrders));
  drawKVRow("Pending orders", String(data.pendingOrders));
  drawKVRow("Unique customers (orders this month)", String(data.uniqueCustomers));
  drawKVRow("New customers (first order in month)", String(data.newCustomersCount));
  drawKVRow("Losses (removed items)", formatINR(data.totalLosses));
  drawKVRow("Average daily sale", formatINR(data.avgDailySale));
  drawKVRow("Average daily orders", String(Math.round(data.avgDailyOrders * 10) / 10));

  y -= 18;
  drawText("Notes", 13, true);
  drawText("- Revenue is calculated from orders marked PAID in the month.", 10);
  drawText("- Losses are calculated from removed-items reports.", 10);
  drawText("- Unique customers: distinct mobiles/sessions with any order in the month.", 10);
  drawText("- New customers: first-ever order (by mobile or session) falls in this month.", 10);

  // Footer
  page.drawText(`Generated automatically by POS • Month: ${data.monthKey}`, {
    x: margin,
    y: margin - 12,
    size: 9,
    font,
    color: rgb(0.45, 0.5, 0.56),
  });

  return await doc.save();
}

