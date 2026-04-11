import { fetchWithTimeout } from '@/constants';

/**
 * Download order invoice PDF. Uses a blob + programmatic click so the file saves reliably
 * (some browsers open a blank tab for PDF URLs). Falls back to opening the URL in a new tab.
 */
export async function downloadOrderInvoicePdf(apiBase: string, orderId: number): Promise<void> {
  const base = apiBase.replace(/\/$/, '');
  const url = `${base}/orders/${orderId}/invoice-pdf`;
  try {
    const res = await fetchWithTimeout(url, { timeout: 60_000 });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(t || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `INV-${new Date().getFullYear()}-${String(orderId).padStart(4, '0')}.pdf`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
  } catch {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
