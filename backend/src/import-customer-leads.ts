import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from './config/prisma.js';

type ParsedLead = {
  name: string;
  mobile: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: Date | null;
};

function normalizeMobile(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  // Keep last 10 digits for India-style numbers; fallback to whatever digits exist.
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function parseCsvLine(line: string): string[] {
  // Minimal CSV parser that supports quoted fields with commas.
  // Works for the provided export format (all values are quoted).
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map(v => v.trim());
}

function parseNumber(raw: string): number {
  const n = Number(
    String(raw || '')
      .trim()
      .replace(/,/g, '')
  );
  return Number.isFinite(n) ? n : 0;
}

function parseDate(raw: string): Date | null {
  const t = String(raw || '').trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isFinite(d.getTime()) ? d : null;
}

function resolveSourceTag(filePath: string): string {
  const base = path.basename(filePath).replace(/\.csv$/i, '');
  return base || 'customer-leads';
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npm run import:customer-leads -- <path-to-csv>');
    process.exit(2);
  }

  const raw = await fs.readFile(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length <= 1) {
    console.error('CSV appears empty (no data rows).');
    process.exit(2);
  }

  const header = parseCsvLine(lines[0]).map(h => h.toLowerCase());
  const idxName = header.indexOf('customer name');
  const idxMobile = header.indexOf('mobile number');
  const idxOrders = header.indexOf('total orders');
  const idxSpent = header.indexOf('total spent');
  const idxLast = header.indexOf('last order date');

  if ([idxName, idxMobile, idxOrders, idxSpent, idxLast].some(i => i < 0)) {
    console.error('CSV header does not match expected columns.');
    console.error('Found header:', header.join(', '));
    process.exit(2);
  }

  const sourceTag = resolveSourceTag(filePath);

  const parsed: ParsedLead[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const name = String(cols[idxName] || '').trim();
    const mobile = normalizeMobile(cols[idxMobile] || '');
    const totalOrders = Math.max(0, Math.trunc(parseNumber(cols[idxOrders] || '0')));
    const totalSpent = Math.max(0, parseNumber(cols[idxSpent] || '0'));
    const lastOrderAt = parseDate(cols[idxLast] || '');
    if (!mobile) continue;
    parsed.push({ name, mobile, totalOrders, totalSpent, lastOrderAt });
  }

  if (parsed.length === 0) {
    console.error('No valid rows found (missing mobile numbers).');
    process.exit(2);
  }

  await prisma.$connect();
  try {
    let upserted = 0;
    for (const row of parsed) {
      await prisma.customerLead.upsert({
        where: { mobile: row.mobile },
        create: {
          mobile: row.mobile,
          name: row.name || null,
          totalOrders: row.totalOrders,
          totalSpent: row.totalSpent,
          lastOrderAt: row.lastOrderAt,
          sourceTag,
        },
        update: {
          name: row.name || null,
          totalOrders: row.totalOrders,
          totalSpent: row.totalSpent,
          lastOrderAt: row.lastOrderAt,
          sourceTag,
        },
      });
      upserted++;
      if (upserted % 250 === 0) {
        // keep some progress for big files
        console.log(`Upserted ${upserted}/${parsed.length}...`);
      }
    }

    console.log(`Done. Upserted ${upserted} lead(s). sourceTag=${sourceTag}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  const anyErr = err as any;
  const code = typeof anyErr?.code === 'string' ? anyErr.code : '';
  if (code === 'P2021') {
    console.error(
      'Database schema is missing required tables (CustomerLead). Run `npx prisma migrate deploy` on the target database, then re-run the import.'
    );
  } else if (code) {
    console.error(`Import failed (Prisma ${code}):`, anyErr?.message || anyErr);
  } else if (anyErr instanceof Error) {
    console.error(anyErr.stack || anyErr.message);
  } else {
    try {
      console.error(JSON.stringify(anyErr, null, 2));
    } catch {
      console.error(anyErr);
    }
  }
  process.exit(1);
});
