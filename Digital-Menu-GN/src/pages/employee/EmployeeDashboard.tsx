import { useEffect, useMemo, useState, useRef, useCallback, memo } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { LoadingButton } from '@/components/shared';
import { io, type Socket } from 'socket.io-client';
import {
  LayoutDashboard,
  Clock,
  ShoppingCart,
  CheckCircle,
  CreditCard,
  User,
  Bell,
  MoreHorizontal,
  ArrowUpRight,
  IndianRupee,
  RefreshCw,
  Play,
  Square,
  Eye,
  X,
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Plus,
  Minus,
  Trash2,
  Download,
  Copy,
  Loader2,
  Package,
  CalendarDays,
  Edit2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoaderButton } from '@/components/shared/LoaderButton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatHours } from '@/utils/timeFormatter';
import { filterOrderItemsForDisplay } from '@/utils/orderDisplay';
import { downloadOrderInvoicePdf } from '@/utils/downloadOrderInvoicePdf';
import {
  API_BASE_URL,
  fetchWithTimeout,
  ORDER_STATUS_COLORS,
  BREAK_TIME_MINUTES,
  formatBreakTime,
} from '@/constants';
import { useGlobalLoading } from '@/components/GlobalLoadingProvider';

const apiBase = API_BASE_URL;

/** Delay threshold for \"Delayed\" order (ms). Business requirement: 30 minutes from acceptance. */
const DELAYED_ORDER_MINUTES = 30;
const DELAYED_ORDER_MS = DELAYED_ORDER_MINUTES * 60 * 1000;

/** Auto-reject NEW_ORDER if not accepted (queue hygiene). */
const NEW_ORDER_AUTO_REJECT_MS = 120_000;

function formatOrderChannel(source?: string | null): string {
  if (source === 'EMPLOYEE') return 'Staff (POS)';
  if (source === 'CUSTOMER') return 'QR menu';
  return '—';
}

function formatPrepDuration(startIso: string, nowMs: number): string {
  const sec = Math.max(0, Math.floor((nowMs - new Date(startIso).getTime()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Matches `getBusinessDayRange` in backend (TZ default Asia/Kolkata, boundary 04:00). */
function getBusinessDateKey(
  date: Date,
  boundaryHour = 4,
  timeZone = 'Asia/Kolkata'
): string {
  const dateStr = date.toLocaleDateString('en-CA', { timeZone });
  const [y0, m0, d0] = dateStr.split('-').map(Number);
  const timeParts = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  let hh = Number(timeParts.find(p => p.type === 'hour')?.value ?? 0);
  if (hh === 24) hh = 0; // en-IN uses 24 for midnight; must count as before 04:00 boundary
  const businessDate = new Date(Date.UTC(y0, m0 - 1, d0));
  if (hh < boundaryHour) {
    businessDate.setUTCDate(businessDate.getUTCDate() - 1);
  }
  return businessDate.toISOString().slice(0, 10);
}

/** Linear POS flow: only these mean “in kitchen” (no separate Preparing/Served in UI). */
function isOrderInProgressStatus(status: string): boolean {
  return status === 'ACCEPTED' || status === 'PREPARING' || status === 'SERVED';
}

function isPaymentPaid(order: { paymentStatus: string }): boolean {
  return order.paymentStatus === 'PAID';
}

function paymentLabel(paymentStatus: string): 'Paid' | 'Pending' {
  return paymentStatus === 'PAID' ? 'Paid' : 'Pending';
}

// INR Currency formatter
const formatINR = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/** "1 min ago", "5 mins ago", "Just now" */
function timeAgo(createdAt: string): string {
  const sec = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min === 1) return '1 min ago';
  if (min < 60) return `${min} mins ago`;
  const hr = Math.floor(min / 60);
  return hr === 1 ? '1 hr ago' : `${hr} hrs ago`;
}

/** Static time for popups so content doesn't change every second (stops flashing). */
function formatPopupTime(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** True if two ISO date strings are the same calendar day (local time). */
function isSameDay(iso1: string, iso2: string): boolean {
  const d1 = new Date(iso1);
  const d2 = new Date(iso2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/** Elapsed hours between shift start and end (or asOf if no end). */
function getElapsedHours(
  shiftStart: string,
  shiftEnd: string | null | undefined,
  asOf: Date
): number {
  const start = new Date(shiftStart).getTime();
  const end = shiftEnd ? new Date(shiftEnd).getTime() : asOf.getTime();
  return Math.max(0, (end - start) / 3600000);
}

/** Variant display:
 * - Items named like "(5pc / 8pc)" → HALF=5pc, FULL=8pc
 * - Otherwise → HALF=Half, FULL=Full
 * Also strips "(5pc / 8pc)" and "(Half / Full)" from base name for display.
 */
function formatItemDisplayName(name: string, variant?: string | null): string {
  const raw = name || '';
  const isPc = /\(\s*5pc\s*\/\s*8pc\s*\)/i.test(raw);
  const base =
    raw
      .replace(/\s*\(5pc\s*\/\s*8pc\)\s*/gi, ' ')
      .replace(/\s*\(half\s*\/\s*full\)\s*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim() || raw;
  if (!variant) return base;
  if (variant === 'HALF') return `${base} (${isPc ? '5pc' : 'Half'})`;
  if (variant === 'FULL') return `${base} (${isPc ? '8pc' : 'Full'})`;
  return `${base} (${variant})`;
}

/** Format duration in ms as "X min" or "X hr Y min" for time-to-complete display. */
function formatTimeToComplete(acceptedAt: string, completedAt: string): string {
  const ms = new Date(completedAt).getTime() - new Date(acceptedAt).getTime();
  if (ms < 0) return '—';
  const totalMins = Math.round(ms / 60000);
  if (totalMins < 60) return `${totalMins} min`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** Play a short new-order alert sound (Web Audio beep) */
let sharedAudioCtx: AudioContext | null = null;
async function ensureAudioUnlocked(): Promise<AudioContext | null> {
  try {
    if (typeof window === 'undefined') return null;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
    if (sharedAudioCtx.state === 'suspended') {
      await sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

type NewOrderSoundPreset = 'beep' | 'ring' | 'siren' | 'chime';

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function playTone(params: {
  ctx: AudioContext;
  at: number;
  freq: number;
  durationMs: number;
  volume: number;
  type?: OscillatorType;
}) {
  const { ctx, at, freq, durationMs, volume, type = 'sine' } = params;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(freq, at);
  osc.type = type;
  const attack = 0.008;
  const release = 0.06;
  const dur = Math.max(0.04, durationMs / 1000);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(attack + release, dur));
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function playSiren(params: { ctx: AudioContext; at: number; volume: number }) {
  const { ctx, at, volume } = params;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sawtooth';
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.65);
  osc.frequency.setValueAtTime(650, at);
  osc.frequency.linearRampToValueAtTime(1250, at + 0.32);
  osc.frequency.linearRampToValueAtTime(650, at + 0.64);
  osc.start(at);
  osc.stop(at + 0.68);
}

function playNewOrderSound(preset?: NewOrderSoundPreset, volume?: number) {
  ensureAudioUnlocked()
    .then(ctx => {
      if (!ctx) return;
      const selectedPreset: NewOrderSoundPreset = preset || 'ring';
      // We aim for maximum loudness; actual output is still limited by device/system volume.
      const volRaw = volume ?? 1;
      const vol = clamp01(volRaw);

      const t = ctx.currentTime;
      const loud = Math.max(0.15, vol); // keep minimum audible

      if (selectedPreset === 'beep') {
        playTone({ ctx, at: t, freq: 880, durationMs: 220, volume: loud, type: 'sine' });
        return;
      }

      if (selectedPreset === 'ring') {
        // Classic noisy ring: two quick beeps, slight pitch drop, repeated once.
        playTone({ ctx, at: t, freq: 1050, durationMs: 140, volume: loud, type: 'square' });
        playTone({ ctx, at: t + 0.16, freq: 850, durationMs: 140, volume: loud, type: 'square' });
        playTone({ ctx, at: t + 0.4, freq: 1050, durationMs: 140, volume: loud, type: 'square' });
        playTone({ ctx, at: t + 0.56, freq: 850, durationMs: 140, volume: loud, type: 'square' });
        return;
      }

      if (selectedPreset === 'chime') {
        // Pleasant but audible 3-tone chime.
        playTone({ ctx, at: t, freq: 1046, durationMs: 140, volume: loud * 0.95, type: 'sine' });
        playTone({
          ctx,
          at: t + 0.16,
          freq: 1318,
          durationMs: 140,
          volume: loud * 0.9,
          type: 'sine',
        });
        playTone({
          ctx,
          at: t + 0.32,
          freq: 1567,
          durationMs: 180,
          volume: loud * 0.85,
          type: 'sine',
        });
        return;
      }

      // siren (very noticeable)
      playSiren({ ctx, at: t, volume: loud });
    })
    .catch(() => {});
}

function notifyNewOrders(count: number) {
  try {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    // Only notify when tab is not visible to avoid noisy duplicates.
    if (!document.hidden) return;
    const title = 'New order received';
    const body =
      count === 1
        ? '1 new order needs your attention.'
        : `${count} new orders need your attention.`;
    new Notification(title, { body, silent: true });
  } catch (_) {}
}

type OrderItem = {
  id: number;
  name: string;
  quantity: number;
  price: number;
  variant?: string | null;
  isRemoved?: boolean;
};

type MenuItemLite = {
  id: number;
  name: string;
  basePrice: number;
  hasHalf?: boolean;
  halfPrice?: number | null;
  isActive?: boolean;
};

type MenuCategoryLite = {
  id: number;
  name: string;
  items?: MenuItemLite[];
};

type TableInfo = {
  id: number;
  tableNumber: string;
};

type Order = {
  id: number;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  updatedAt?: string;
  acceptedAt?: string | null;
  completedAt?: string | null;
  employeeId?: number | null;
  orderType?: 'DINE_IN' | 'TAKE_AWAY' | null;
  table?: TableInfo | null;
  items: OrderItem[];
  customerName?: string | null;
  customerMobile?: string | null;
  employee?: {
    id: number;
    name: string;
    employeeCode: string;
    role?: string | null;
  } | null;
  branch?: { id: number; name: string; location?: string | null } | null;
  orderSource?: 'CUSTOMER' | 'EMPLOYEE' | null;
};

type LeaveRequest = {
  id: number;
  leaveType: 'SICK' | 'CASUAL' | 'PAID';
  startDate: string;
  endDate: string;
  reason?: string | null;
  adminRemarks?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
};

const sidebarItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'live', label: 'Live Orders', icon: ShoppingCart },
  { key: 'add-order', label: 'Add Order', icon: Plus },
  { key: 'all-orders', label: 'All Orders', icon: ShoppingCart },
  { key: 'paid', label: 'Paid & Pending', icon: CreditCard },
  { key: 'shift', label: 'My Shift', icon: Clock },
  { key: 'leave', label: 'Leave', icon: CalendarDays },
  { key: 'profile', label: 'Profile', icon: User },
];

/** Memoized order details dialog – stable identity so it doesn't unmount/remount when parent re-renders (e.g. polling). */
const OrderPopupDialogView = memo(function OrderPopupDialogView(props: {
  displayOrder: Order | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  popupCustomerName: string;
  setPopupCustomerName: (v: string) => void;
  popupCustomerMobile: string;
  setPopupCustomerMobile: (v: string) => void;
  savingCustomer: boolean;
  saveOrderCustomer: () => void;
  removedItemIds: number[];
  toggleItemRemoval: (itemId: number) => void;
  modificationReason: string;
  setModificationReason: (v: string) => void;
  addItemsSearchQuery: string;
  setAddItemsSearchQuery: (v: string) => void;
  menuCategories: MenuCategoryLite[];
  menuLoading: boolean;
  addedItemsCart: {
    id: string;
    name: string;
    menuItemId?: number;
    unitPrice: number;
    quantity: number;
    variant?: 'HALF' | 'FULL';
  }[];
  addItemToCart: (item: {
    name: string;
    menuItemId?: number;
    unitPrice: number;
    variant?: 'HALF' | 'FULL';
  }) => void;
  updateAddedItemQty: (id: string, delta: number) => void;
  pendingQtyByOrderItemId: Record<number, number | undefined>;
  setPendingQtyByOrderItemId: React.Dispatch<
    React.SetStateAction<Record<number, number | undefined>>
  >;
  markStatus: (orderId: number, status: string) => void;
  acceptOrder: (orderId: number) => void;
  rejectOrder: (orderId: number) => void;
  applyOrderPayment: (orderId: number, mode: 'PAID' | 'PENDING') => void;
  modifyOrder: () => void;
  isModifying: boolean;
  actionOrderId: number | null;
  acceptingOrderId: number | null;
  selectedOrder: Order | null;
}) {
  const {
    displayOrder,
    isOpen,
    onOpenChange,
    popupCustomerName,
    setPopupCustomerName,
    popupCustomerMobile,
    setPopupCustomerMobile,
    savingCustomer,
    saveOrderCustomer,
    removedItemIds,
    toggleItemRemoval,
    modificationReason,
    setModificationReason,
    addItemsSearchQuery,
    setAddItemsSearchQuery,
    menuCategories,
    menuLoading,
    addedItemsCart,
    addItemToCart,
    updateAddedItemQty,
    pendingQtyByOrderItemId,
    setPendingQtyByOrderItemId,
    markStatus,
    acceptOrder,
    rejectOrder,
    applyOrderPayment,
    modifyOrder,
    isModifying,
    actionOrderId,
    acceptingOrderId,
    selectedOrder,
  } = props;

  const filteredMenuCategories = useMemo(() => {
    const q = addItemsSearchQuery.trim().toLowerCase();
    if (!q) return menuCategories;
    return menuCategories
      .map(cat => ({
        ...cat,
        items: (cat.items || []).filter(it => (it.name || '').toLowerCase().includes(q)),
      }))
      .filter(cat => (cat.items || []).length > 0);
  }, [addItemsSearchQuery, menuCategories]);

  if (!displayOrder) return null;

  const isCompletedViewOnly = displayOrder.status === 'ORDER_COMPLETE';
  const displayQtyFor = (item: OrderItem) => pendingQtyByOrderItemId[item.id] ?? item.quantity;

  const calculateNewTotal = () => {
    const baseItemsTotal = filterOrderItemsForDisplay(displayOrder.items)
      .filter(i => !i.isRemoved)
      .filter(i => !removedItemIds.includes(i.id))
      .reduce((sum, i) => sum + i.price * displayQtyFor(i), 0);
    const addedTotal = addedItemsCart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    return baseItemsTotal + addedTotal;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="max-h-[80vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto p-4 max-sm:fixed max-sm:inset-2 max-sm:top-4 max-sm:right-4 max-sm:bottom-4 max-sm:left-4 max-sm:max-h-[calc(100vh-1rem)] max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-xl sm:w-full sm:p-6"
        aria-describedby="order-popup-desc"
      >
        <DialogTitle className="sr-only">Order #{displayOrder.id}</DialogTitle>
        <DialogDescription id="order-popup-desc" className="sr-only">
          View order details, items, and customer information. Edit customer name and mobile for
          WhatsApp updates.
        </DialogDescription>
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Order #{displayOrder.id}
            </h2>
            <p className="text-muted-foreground mt-0.5 text-lg font-semibold">
              Table {displayOrder.table?.tableNumber || displayOrder.table?.id || '—'}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {displayOrder.branch?.name && <span>{displayOrder.branch.name}</span>}
              {displayOrder.branch?.name && ' · '}
              {formatPopupTime(displayOrder.createdAt)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Channel: {formatOrderChannel(displayOrder.orderSource)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        {/* Per requirements: do not display "Accepted by [Employee]" */}

        <div className="bg-muted/30 space-y-2 rounded-lg border p-3">
          <h4 className="text-sm font-medium">Customer</h4>
          {isCompletedViewOnly ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-0 text-sm">
              <span className="text-foreground font-medium">
                {displayOrder.customerName ?? '—'}
              </span>
              {displayOrder.customerMobile && (
                <span className="text-muted-foreground">📞 {displayOrder.customerMobile}</span>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    placeholder="Customer name"
                    value={popupCustomerName}
                    onChange={e => setPopupCustomerName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Mobile (10 digits) *</Label>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="9876543210"
                    value={popupCustomerMobile}
                    onChange={e =>
                      setPopupCustomerMobile(e.target.value.replace(/\D/g, '').slice(0, 10))
                    }
                    className="mt-1"
                  />
                </div>
              </div>
              {(!displayOrder.customerMobile ||
                popupCustomerMobile !== displayOrder.customerMobile ||
                popupCustomerName !== (displayOrder.customerName ?? '')) && (
                <Button
                  size="sm"
                  disabled={savingCustomer || popupCustomerMobile.replace(/\D/g, '').length !== 10}
                  onClick={saveOrderCustomer}
                >
                  {savingCustomer ? 'Saving...' : 'Save customer'}
                </Button>
              )}
              {!displayOrder.customerMobile && (
                <p className="text-xs text-amber-600">
                  Save mobile to send order details, payment status & review link via WhatsApp.
                </p>
              )}
            </>
          )}
        </div>

        <div className="space-y-6">
          {/* NEW → Accept / Reject (use POST accept; do not PATCH ACCEPTED from NEW) */}
          {!isCompletedViewOnly && displayOrder.status === 'NEW_ORDER' && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-sm font-medium text-amber-900">New order — accept or reject</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 text-white hover:bg-green-700"
                  disabled={!selectedOrder || acceptingOrderId === selectedOrder.id}
                  onClick={() => selectedOrder && acceptOrder(selectedOrder.id)}
                >
                  {selectedOrder && acceptingOrderId === selectedOrder.id ? (
                    <span className="mr-1 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <CheckCircle className="mr-1 h-4 w-4" />
                  )}
                  Accept order
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                  disabled={!selectedOrder || acceptingOrderId === selectedOrder.id}
                  onClick={() => selectedOrder && rejectOrder(selectedOrder.id)}
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  Reject order
                </Button>
              </div>
            </div>
          )}

          {/* ACCEPTED / legacy PREPARING|SERVED → single step to completed */}
          {!isCompletedViewOnly && isOrderInProgressStatus(displayOrder.status) && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-muted-foreground text-sm">
                  In progress — mark completed when the order is ready for payment.
                </p>
                <Button
                  size="sm"
                  disabled={!selectedOrder || actionOrderId === selectedOrder.id}
                  onClick={() => selectedOrder && markStatus(selectedOrder.id, 'ORDER_COMPLETE')}
                >
                  {selectedOrder && actionOrderId === selectedOrder.id ? (
                    <span className="mr-1 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <CheckCircle className="mr-1 h-4 w-4" />
                  )}
                  Mark completed
                </Button>
              </div>
            )}

          {displayOrder.status === 'ORDER_COMPLETE' && (
            <div className="space-y-2">
              <span className="font-medium">Payment</span>
              <div className="bg-muted/30 flex flex-col gap-3 rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between">
                <Badge
                  className={
                    isPaymentPaid(displayOrder)
                      ? 'w-fit border-green-300 bg-green-100 text-green-800'
                      : 'w-fit border-amber-300 bg-amber-100 text-amber-800'
                  }
                >
                  {paymentLabel(displayOrder.paymentStatus)}
                </Badge>
                {!isPaymentPaid(displayOrder) && selectedOrder && (
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button
                      className="min-h-[48px] w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
                      disabled={actionOrderId === selectedOrder.id}
                      onClick={() => applyOrderPayment(selectedOrder.id, 'PAID')}
                    >
                      {actionOrderId === selectedOrder.id ? (
                        <span className="mr-2 inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <CreditCard className="mr-2 h-5 w-5" />
                      )}
                      Mark as Paid
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-[48px] w-full sm:w-auto"
                      disabled={actionOrderId === selectedOrder.id}
                      onClick={() => applyOrderPayment(selectedOrder.id, 'PENDING')}
                    >
                      Mark as Pending
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <h4 className="mb-3 font-medium">Order Items</h4>
            <div className="space-y-2">
              {filterOrderItemsForDisplay(displayOrder.items)
                .filter(i => !i.isRemoved)
                .map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      !isCompletedViewOnly && removedItemIds.includes(item.id)
                        ? 'bg-red-50 opacity-50'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {!isCompletedViewOnly && (
                        <Checkbox
                          checked={removedItemIds.includes(item.id)}
                          onCheckedChange={() => toggleItemRemoval(item.id)}
                        />
                      )}
                      <div>
                        <p className="font-medium">
                          {displayQtyFor(item)} × {formatItemDisplayName(item.name, item.variant)}
                        </p>
                        {!isCompletedViewOnly && removedItemIds.includes(item.id) && (
                          <p className="text-sm text-red-600">Will be removed</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isCompletedViewOnly && !removedItemIds.includes(item.id) && (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                              setPendingQtyByOrderItemId(prev => {
                                const current = prev[item.id] ?? item.quantity;
                                const next = Math.max(1, current - 1);
                                return { ...prev, [item.id]: next };
                              })
                            }
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                              setPendingQtyByOrderItemId(prev => {
                                const current = prev[item.id] ?? item.quantity;
                                const next = current + 1;
                                return { ...prev, [item.id]: next };
                              })
                            }
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <span className="font-medium">{formatINR(item.price)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {!isCompletedViewOnly && (
            <>
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">Add More Items</div>
                    <div className="text-xs text-slate-600">
                      Add/remove/modify items anytime. Prices update automatically.
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="relative">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input
                      placeholder="Search menu items..."
                      value={addItemsSearchQuery}
                      onChange={e => setAddItemsSearchQuery(e.target.value)}
                      className="h-9 pl-9"
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="max-h-[280px] overflow-y-auto rounded-lg border bg-white p-3">
                    {menuLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
                        ))}
                      </div>
                    ) : filteredMenuCategories.length === 0 ? (
                      <p className="text-muted-foreground py-8 text-center text-sm">
                        No items found
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {filteredMenuCategories.map(cat => (
                          <div key={cat.id}>
                            <p className="mb-2 text-xs font-bold tracking-wide text-emerald-800 uppercase">
                              {cat.name}
                            </p>
                            <div className="space-y-1">
                              {(cat.items || []).map(it => {
                                const hasHalf = !!it.hasHalf && !!it.halfPrice;
                                return (
                                  <div
                                    key={it.id}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-transparent p-2 transition-all hover:border-slate-200 hover:bg-slate-50"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium">{it.name}</p>
                                      <p className="text-muted-foreground text-xs">
                                        {hasHalf
                                          ? `₹${it.halfPrice} / ₹${it.basePrice}`
                                          : `₹${it.basePrice}`}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                      {hasHalf ? (
                                        <>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8 border-emerald-300 px-2 text-xs text-emerald-700 hover:bg-emerald-50"
                                            onClick={() =>
                                              addItemToCart({
                                                name: it.name,
                                                menuItemId: it.id,
                                                unitPrice: Number(it.halfPrice || 0),
                                                variant: 'HALF',
                                              })
                                            }
                                          >
                                            Half
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8 border-emerald-600 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700"
                                            onClick={() =>
                                              addItemToCart({
                                                name: it.name,
                                                menuItemId: it.id,
                                                unitPrice: Number(it.basePrice || 0),
                                                variant: 'FULL',
                                              })
                                            }
                                          >
                                            Full
                                          </Button>
                                        </>
                                      ) : (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-8 border-emerald-600 bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700"
                                          onClick={() =>
                                            addItemToCart({
                                              name: it.name,
                                              menuItemId: it.id,
                                              unitPrice: Number(it.basePrice || 0),
                                              variant: 'FULL',
                                            })
                                          }
                                        >
                                          Add
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border bg-white p-3">
                    <p className="text-sm font-semibold text-slate-900">Items to add</p>
                    {addedItemsCart.length === 0 ? (
                      <p className="text-muted-foreground mt-2 text-sm">No new items added yet.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {addedItemsCart.map(i => (
                          <div
                            key={i.id}
                            className="flex items-center justify-between gap-2 rounded-lg border p-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {i.name} {i.variant ? `(${i.variant})` : ''}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {formatINR(i.unitPrice)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0"
                                onClick={() => updateAddedItemQty(i.id, -1)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-8 text-center text-sm font-semibold">
                                {i.quantity}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0"
                                onClick={() => updateAddedItemQty(i.id, 1)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {removedItemIds.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium">Removal Reason</label>
                  <Textarea
                    value={modificationReason}
                    onChange={e => setModificationReason(e.target.value)}
                    placeholder="Reason for removing items..."
                    className="min-h-[80px]"
                  />
                </div>
              )}
              <div className="border-t pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Original Total:</span>
                    <span className="font-medium">{formatINR(displayOrder.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>New Total:</span>
                    <span>{formatINR(calculateNewTotal())}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void downloadOrderInvoicePdf(apiBase, displayOrder.id);
                  }}
                >
                  <Download className="mr-1 h-4 w-4" />
                  Invoice
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button
                  onClick={modifyOrder}
                  disabled={isModifying}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {isModifying ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </>
          )}

          {isCompletedViewOnly && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>{formatINR(displayOrder.totalAmount)}</span>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void downloadOrderInvoicePdf(apiBase, displayOrder.id);
                  }}
                >
                  <Download className="mr-1 h-4 w-4" />
                  Download Invoice
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const relative = `${apiBase}/orders/${displayOrder.id}/invoice-pdf`;
                    const absolute = new URL(relative, window.location.origin).toString();
                    try {
                      if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(absolute);
                      } else {
                        const ta = document.createElement('textarea');
                        ta.value = absolute;
                        ta.style.position = 'fixed';
                        ta.style.left = '-9999px';
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        ta.remove();
                      }
                      toast.success('Invoice link copied.');
                    } catch {
                      toast.error('Could not copy link. Try Download Invoice instead.');
                    }
                  }}
                >
                  <Copy className="mr-1 h-4 w-4" />
                  Copy Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await fetch(
                        `${apiBase}/orders/${displayOrder.id}/whatsapp-invoice`,
                        {
                          method: 'GET',
                        }
                      );
                      const data = (await res.json().catch(() => ({}))) as { waMeLink?: string };
                      if (!res.ok || !data.waMeLink) {
                        toast.error(
                          (data as any)?.message ||
                            'Customer name/mobile missing for this order. Add customer mobile then retry.'
                        );
                        return;
                      }
                      window.open(data.waMeLink, '_blank', 'noopener,noreferrer');
                    } catch {
                      toast.error('Could not open WhatsApp. Check connection and try again.');
                    }
                  }}
                >
                  Send on WhatsApp
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

// ─── Add Order Section ────────────────────────────────────────────────────────
type AddCartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  variant?: 'HALF' | 'FULL';
  category?: string;
};

function AddOrderSection({
  branchId,
  token,
  onOrderPlaced,
}: {
  branchId: number | null | undefined;
  token: string | null;
  onOrderPlaced: (orderId: number) => void;
}) {
  const [menuCategories, setMenuCategories] = useState<any[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [cart, setCart] = useState<AddCartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKE_AWAY'>('DINE_IN');
  const [submitting, setSubmitting] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setMenuLoading(true);
    fetchWithTimeout(`${apiBase}/menu`)
      .then(r => r.json())
      .then(data => {
        const cats = Array.isArray(data) ? data : (data?.categories ?? []);
        setMenuCategories(cats);
      })
      .catch(() => setMenuCategories([]))
      .finally(() => setMenuLoading(false));
  }, []);

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);

  const addToCart = (name: string, price: number, variant?: 'HALF' | 'FULL', category?: string) => {
    const id = `${name}-${variant ?? 'FULL'}-${category ?? ''}`;
    setCart(prev => {
      const existing = prev.find(i => i.id === id);
      if (existing) return prev.map(i => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { id, name, price, quantity: 1, variant, category }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev =>
      prev
        .map(i => (i.id === id ? { ...i, quantity: i.quantity + delta } : i))
        .filter(i => i.quantity > 0)
    );
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return menuCategories;
    const q = searchQuery.toLowerCase();
    return menuCategories.filter(
      cat =>
        cat.name?.toLowerCase().includes(q) ||
        cat.items?.some((item: any) => item.name?.toLowerCase().includes(q))
    );
  }, [menuCategories, searchQuery]);

  const handleSubmit = async () => {
    if (!cart.length) {
      toast.error('Add at least one item');
      return;
    }
    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (orderType === 'DINE_IN' && !/^\d$/.test(tableNumber.trim())) {
      toast.error('Table number: enter one digit only (0–9), as on the table sticker.');
      return;
    }
    if (!branchId) {
      toast.error('Branch not loaded. Refresh and try again.');
      return;
    }

    const mobileTrim = customerMobile.replace(/\D/g, '').slice(0, 10);
    const validMobile = mobileTrim.length === 10 && /^[6-9]/.test(mobileTrim) ? mobileTrim : '';

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          orderType,
          tableNumber: orderType === 'TAKE_AWAY' ? '' : tableNumber.trim(),
          customerName: customerName.trim().toUpperCase(),
          customerMobile: validMobile || undefined,
          packaging: orderType === 'TAKE_AWAY',
          items: cart.map(item => ({
            name: item.name,
            unitPrice: item.price,
            quantity: item.quantity,
            variant: item.variant,
          })),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
          errors?: Array<{ path?: (string | number)[]; message?: string }>;
        };
        const issues = Array.isArray(err.errors) ? err.errors : [];
        const tableIssue = issues.find(
          i => Array.isArray(i.path) && String(i.path[0]) === 'tableNumber'
        );
        const detail =
          tableIssue?.message ||
          issues.find(i => i?.message)?.message ||
          (err.message && err.message !== 'Invalid input' ? err.message : null);
        throw new Error(
          detail || 'Could not place order. For dine-in, table must be one digit (0–9).'
        );
      }
      const data = await res.json();
      const newOrderId = data.order?.id ?? null;
      setLastOrderId(newOrderId);
      setCart([]);
      setCustomerName('');
      setCustomerMobile('');
      setTableNumber('');
      toast.success(`Order #${newOrderId} placed successfully!`);
      if (newOrderId) onOrderPlaced(newOrderId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold sm:text-xl">Add New Order</h2>
          <p className="text-muted-foreground text-sm">
            Place an order for a customer at the counter
          </p>
        </div>
        {lastOrderId && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              if (lastOrderId) void downloadOrderInvoicePdf(apiBase, lastOrderId);
            }}
          >
            <Download className="h-4 w-4" />
            Download Last Invoice (#{lastOrderId})
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Menu Panel */}
        <div className="space-y-3 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Package className="h-4 w-4 text-emerald-600" />
                Menu
              </CardTitle>
              <div className="relative mt-2">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="max-h-[60vh] overflow-y-auto pb-4">
              {menuLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : filteredCategories.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">No items found</p>
              ) : (
                <div className="space-y-4">
                  {filteredCategories.map((cat: any) => (
                    <div key={cat.id}>
                      <h3 className="mb-2 px-1 text-sm font-bold tracking-wide text-emerald-800 uppercase">
                        {cat.name}
                      </h3>
                      <div className="space-y-1">
                        {(cat.items || []).map((item: any) => {
                          const hasHalf = item.hasHalf && item.halfPrice;
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-transparent p-2 transition-all hover:border-slate-200 hover:bg-slate-50"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{item.name}</p>
                                <p className="text-muted-foreground text-xs">
                                  {hasHalf
                                    ? `₹${item.halfPrice} / ₹${item.basePrice}`
                                    : `₹${item.basePrice}`}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                {hasHalf ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 border-emerald-300 px-2 text-xs text-emerald-700 hover:bg-emerald-50"
                                      onClick={() =>
                                        addToCart(item.name, item.halfPrice, 'HALF', cat.name)
                                      }
                                    >
                                      Half
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 border-emerald-600 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700"
                                      onClick={() =>
                                        addToCart(item.name, item.basePrice, 'FULL', cat.name)
                                      }
                                    >
                                      Full
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 border-emerald-600 bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700"
                                    onClick={() =>
                                      addToCart(item.name, item.basePrice, 'FULL', cat.name)
                                    }
                                  >
                                    Add
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Summary Panel */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
                Order Summary
                {cart.length > 0 && (
                  <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                    {cart.length} item{cart.length > 1 ? 's' : ''}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pb-4">
              {/* Cart Items */}
              {cart.length === 0 ? (
                <div className="text-muted-foreground py-6 text-center">
                  <ShoppingCart className="mx-auto mb-2 h-10 w-10 opacity-30" />
                  <p className="text-sm">No items added yet</p>
                </div>
              ) : (
                <div className="max-h-[30vh] space-y-2 overflow-y-auto">
                  {cart.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {item.name}
                          {item.variant ? ` (${item.variant === 'HALF' ? 'Half' : 'Full'})` : ''}
                        </p>
                        <p className="text-muted-foreground text-xs">₹{item.price} each</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => updateQty(item.id, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold transition-colors hover:bg-slate-300"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(item.id, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-200"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setCart(p => p.filter(i => i.id !== item.id))}
                          className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600 transition-colors hover:bg-red-200"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t pt-2 text-sm font-bold">
                    <span>Total</span>
                    <span className="text-emerald-700">₹{cartTotal.toFixed(0)}</span>
                  </div>
                </div>
              )}

              {/* Customer Details */}
              <div className="space-y-3 border-t pt-2">
                <h4 className="text-sm font-semibold text-slate-700">Customer Details</h4>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="Customer name"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Mobile <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit number"
                    value={customerMobile}
                    onChange={e =>
                      setCustomerMobile(e.target.value.replace(/\D/g, '').slice(0, 10))
                    }
                    className="h-9 text-sm"
                  />
                </div>

                {/* Order Type */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderType('DINE_IN')}
                    className={`h-9 rounded-lg border-2 text-sm font-semibold transition-all ${orderType === 'DINE_IN' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 text-slate-600 hover:border-emerald-300'}`}
                  >
                    Dine In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderType('TAKE_AWAY');
                      setTableNumber('');
                    }}
                    className={`h-9 rounded-lg border-2 text-sm font-semibold transition-all ${orderType === 'TAKE_AWAY' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 text-slate-600 hover:border-emerald-300'}`}
                  >
                    Take Away
                  </button>
                </div>

                {orderType === 'DINE_IN' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Table Number <span className="text-red-500">*</span>
                    </label>
                    <Input
                      inputMode="numeric"
                      maxLength={1}
                      autoComplete="off"
                      placeholder="One digit (0–9)"
                      value={tableNumber}
                      onChange={e => setTableNumber(e.target.value.replace(/\D/g, '').slice(0, 1))}
                      className="h-9 text-sm"
                    />
                    <p className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900/90">
                      One digit (0–9) only—same as on the table. Not 10 or letters.
                    </p>
                  </div>
                )}
              </div>

              <Button
                className="h-10 w-full gap-2 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                disabled={
                  submitting ||
                  cart.length === 0 ||
                  !customerName.trim() ||
                  (orderType === 'DINE_IN' && !/^\d$/.test(tableNumber.trim()))
                }
                onClick={handleSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    Place Order · ₹{cartTotal.toFixed(0)}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

const EmployeeDashboard = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ringingEnabledByAdmin, setRingingEnabledByAdmin] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  /** Frozen snapshot for modal display – only updated on open or user action, so popup doesn't flash on parent re-renders (clock/poll). */
  const [popupDisplayOrder, setPopupDisplayOrder] = useState<Order | null>(null);
  const [isOrderPopupOpen, setIsOrderPopupOpen] = useState(false);
  const [removedItemIds, setRemovedItemIds] = useState<number[]>([]);
  const [modificationReason, setModificationReason] = useState('Item not available');
  const [isModifying, setIsModifying] = useState(false);
  const [menuCategoriesForEdits, setMenuCategoriesForEdits] = useState<MenuCategoryLite[]>([]);
  const [menuLoadingForEdits, setMenuLoadingForEdits] = useState(true);
  const [addItemsSearchQuery, setAddItemsSearchQuery] = useState('');
  const [addedItemsCart, setAddedItemsCart] = useState<
    {
      id: string;
      name: string;
      menuItemId?: number;
      unitPrice: number;
      quantity: number;
      variant?: 'HALF' | 'FULL';
    }[]
  >([]);
  const [pendingQtyByOrderItemId, setPendingQtyByOrderItemId] = useState<
    Record<number, number | undefined>
  >({});
  const [shiftActive, setShiftActive] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [confirmEndShiftOpen, setConfirmEndShiftOpen] = useState(false);
  const [actionOrderId, setActionOrderId] = useState<number | null>(null);
  /** Only the card where Accept was clicked shows "Accepting..." – prevents other cards showing loading */
  const [acceptingOrderId, setAcceptingOrderId] = useState<number | null>(null);
  /** True until the first `/orders/live` snapshot finishes (success or failure). */
  const [ordersSnapshotLoading, setOrdersSnapshotLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('dashboard');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [popupCustomerName, setPopupCustomerName] = useState('');
  const [popupCustomerMobile, setPopupCustomerMobile] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [newOrderPopupOrders, setNewOrderPopupOrders] = useState<Order[]>([]);
  /** Bumps every 1s while new-order popup is open (countdown UI). */
  const [newOrderPopupTick, setNewOrderPopupTick] = useState(0);
  const [pauseNewOrderPopup, setPauseNewOrderPopup] = useState(false);
  const hasCompletedFirstLoad = useRef(false);
  const isOrderPopupOpenRef = useRef(false);
  const ordersRef = useRef<Order[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const [currentShift, setCurrentShift] = useState<null | {
    id: number;
    branchId: number;
    shiftStart: string;
    shiftEnd?: string | null;
    totalHours?: number | null;
    totalSales: number;
    ordersCount?: number;
    status?: 'ACTIVE' | 'PAUSED' | 'ENDED';
  }>(null);
  const [myShiftHistory, setMyShiftHistory] = useState<
    {
      id: number;
      shiftStart: string;
      shiftEnd: string | null;
      totalHours: number | null;
      totalSales: number | null;
    }[]
  >([]);
  const [myShiftHistoryLoaded, setMyShiftHistoryLoaded] = useState(false);
  const [myDailyShiftStats, setMyDailyShiftStats] = useState<
    { date: string; totalHours: number; totalSales: number; shifts: number }[]
  >([]);
  const [myApprovedOvertime, setMyApprovedOvertime] = useState<{
    month: string;
    approvedHours: number;
    approvedCount: number;
  } | null>(null);
  const [showStartShiftPrompt, setShowStartShiftPrompt] = useState(false);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveType, setLeaveType] = useState<'SICK' | 'CASUAL' | 'PAID'>('CASUAL');
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const prevNewOrderCountRef = useRef(0);
  const [newOrderSoundPreset, setNewOrderSoundPreset] = useState<NewOrderSoundPreset>('ring');
  const [newOrderSoundVolume, setNewOrderSoundVolume] = useState<number>(1);

  const { token, ready, refresh, logout } = useAuth();
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const fetchAuthed = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const doFetch = async (t: string) =>
        fetch(url, {
          ...init,
          headers: {
            ...(init.headers || {}),
            Authorization: `Bearer ${t}`,
          },
          credentials: 'include',
        });

      const current = tokenRef.current;
      if (!current) return doFetch('');
      const res = await doFetch(current);
      if (res.status !== 401) return res;

      const next = await refresh();
      if (!next) return res;
      return doFetch(next);
    },
    [refresh]
  );

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Employee UX settings (ringing is branch-controlled by admin)
  useEffect(() => {
    const fetchEmployeeSettings = async () => {
      if (!ready) return;
      if (!token) return;
      try {
        const res = await fetchAuthed(`${apiBase}/config/employee-settings`, { method: 'GET' });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        setRingingEnabledByAdmin(data.enableNewOrderRinging !== false);
        if (
          data.newOrderSoundPreset === 'beep' ||
          data.newOrderSoundPreset === 'ring' ||
          data.newOrderSoundPreset === 'siren' ||
          data.newOrderSoundPreset === 'chime'
        ) {
          setNewOrderSoundPreset(data.newOrderSoundPreset);
        }
        if (typeof data.newOrderSoundVolume === 'number') {
          setNewOrderSoundVolume(clamp01(data.newOrderSoundVolume));
        }
      } catch {
        setRingingEnabledByAdmin(true);
      }
    };
    fetchEmployeeSettings();
  }, [ready, token, fetchAuthed]);

  const { stopGlobalLoading } = useGlobalLoading();

  useEffect(() => {
    if (!token || !ready) return;
    const id = window.setTimeout(() => stopGlobalLoading(), 120_000);
    return () => window.clearTimeout(id);
  }, [token, ready, stopGlobalLoading]);

  const mergeOrders = useCallback((prev: Order[], next: Order[]) => {
    if (prev.length === 0) return next;
    const prevById = new Map(prev.map(o => [o.id, o]));
    let changed = prev.length !== next.length;
    const merged = next.map(n => {
      const p = prevById.get(n.id);
      if (!p) {
        changed = true;
        return n;
      }
      // keep old reference if nothing meaningful changed (prevents UI "refresh" flicker)
      const same =
        p.status === n.status &&
        p.paymentStatus === n.paymentStatus &&
        p.totalAmount === n.totalAmount &&
        (p.updatedAt ?? '') === (n.updatedAt ?? '') &&
        (p.employeeId ?? null) === (n.employeeId ?? null) &&
        (p.orderSource ?? '') === (n.orderSource ?? '') &&
        (p.items?.length ?? 0) === (n.items?.length ?? 0);
      if (!same) changed = true;
      return same ? p : { ...p, ...n };
    });
    return changed ? merged : prev;
  }, []);

  // Clock every 30s only – avoids re-rendering every second so cards stay stable (no blink)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Unlock audio on first user interaction (required by many browsers, especially iOS).
  useEffect(() => {
    const unlock = () => {
      ensureAudioUnlocked().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock as any);
      window.removeEventListener('keydown', unlock as any);
    };
  }, []);

  const isShiftPaused = currentShift?.status === 'PAUSED';

  const toDateInputValue = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.toISOString().slice(0, 10);
  };

  const getLeaveMinDate = (type: 'SICK' | 'CASUAL' | 'PAID') => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const offset = type === 'PAID' ? 15 : type === 'CASUAL' ? 2 : 0;
    today.setDate(today.getDate() + offset);
    return toDateInputValue(today);
  };

  const hasLeaveOverlap = useMemo(() => {
    if (!leaveStartDate || !leaveEndDate) return false;
    const start = new Date(leaveStartDate);
    const end = new Date(leaveEndDate);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return false;
    return myLeaves.some(l => {
      if (l.status === 'REJECTED') return false;
      const s = new Date(l.startDate);
      const e = new Date(l.endDate);
      return s <= end && e >= start;
    });
  }, [leaveStartDate, leaveEndDate, myLeaves]);

  // Keep selected dates valid when leave type changes (mobile users often change type after dates).
  useEffect(() => {
    const minDate = getLeaveMinDate(leaveType);
    if (leaveStartDate && leaveStartDate < minDate) {
      setLeaveStartDate(minDate);
    }
    if (leaveEndDate) {
      const effectiveMinEnd = leaveStartDate && leaveStartDate > minDate ? leaveStartDate : minDate;
      if (leaveEndDate < effectiveMinEnd) {
        setLeaveEndDate(effectiveMinEnd);
      }
    }
  }, [leaveType]);

  // Instant new-order notifications via Socket.IO (in addition to 10s polling fallback)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!ready) return;
    if (!token) return;

    const socketBaseUrl = API_BASE_URL.startsWith('http')
      ? API_BASE_URL.replace(/\/api\/?$/, '')
      : window.location.origin;

    const s = io(socketBaseUrl, {
      path: '/socket.io',
      withCredentials: true,
      auth: cb => {
        cb({ token: tokenRef.current || '' });
      },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = s;

    const canNotify = () =>
      shiftActive && !isShiftPaused && !pauseNewOrderPopup && !isOrderPopupOpenRef.current;

    /** Always merge into the live list so customer orders show even when popup/sound is suppressed. */
    const upsertLiveOrder = (o: Order) => {
      if (!o || typeof o.id !== 'number') return;
      setOrders(prev =>
        mergeOrders(
          prev,
          prev.some(p => p.id === o.id)
            ? prev.map(p => (p.id === o.id ? { ...p, ...o } : p))
            : [...prev, o]
        )
      );
    };

    const addPopupOrder = (o: Order) => {
      if (!canNotify()) return;
      if (!o || typeof o.id !== 'number') return;
      // Only new orders should trigger device alerts.
      if (o.status !== 'NEW_ORDER') return;
      // Show popup for all new orders - employees can see all branch orders

      setNewOrderPopupOrders(prev => {
        if (prev.some(p => p.id === o.id)) return prev;
        // Also avoid duplicates if it already exists in main orders list.
        if (ordersRef.current.some(p => p.id === o.id)) return [o, ...prev];
        return [o, ...prev];
      });
      notifyNewOrders(1);
      setTimeout(() => toast.success('1 new order received.'), 50);
    };

    const removePopupOrder = (id: number) => {
      setNewOrderPopupOrders(prev => prev.filter(p => p.id !== id));
    };

    s.on('order:new', (o: Order) => {
      upsertLiveOrder(o);
      addPopupOrder(o);
    });

    s.on('order:updated', (o: Order) => {
      if (!o || typeof o.id !== 'number') return;
      // If it is no longer NEW_ORDER, stop ringing for that order.
      if (o.status !== 'NEW_ORDER') {
        removePopupOrder(o.id);
      }
      upsertLiveOrder(o);
    });

    s.on('order:modified', (o: Order) => {
      if (!o || typeof o.id !== 'number') return;
      upsertLiveOrder(o);
    });

    s.on('disconnect', () => {
      // no-op
    });

    // After reconnect, pull a fresh snapshot once (no polling).
    s.on('connect', () => {
      (async () => {
        try {
          const t = token;
          if (!t) return;
          if (isOrderPopupOpenRef.current) return;
          const res = await fetchWithTimeout(`${apiBase}/orders/live`, {
            headers: { Authorization: `Bearer ${t}` },
            credentials: 'include',
          });
          if (!res.ok) return;
          const data = await res.json();
          if (isOrderPopupOpenRef.current) return;
          setOrders(prev => mergeOrders(prev, data));
        } catch {
          // ignore
        }
      })();
    });

    return () => {
      try {
        s.removeAllListeners();
        s.disconnect();
      } catch {
        // ignore
      }
      if (socketRef.current === s) socketRef.current = null;
    };
  }, [ready, token, shiftActive, isShiftPaused, pauseNewOrderPopup, mergeOrders]);

  // Polling fallback: keeps the list fresh when Socket.IO cannot reach the backend
  // (common when the frontend is on Vercel and the backend is on a VM).
  useEffect(() => {
    if (!ready) return;
    if (!token) return;

    let cancelled = false;
    const run = async () => {
      try {
        if (cancelled) return;
        if (isOrderPopupOpenRef.current) return;
        const res = await fetchAuthed(`${apiBase}/orders/live`, {
          method: 'GET',
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data || isOrderPopupOpenRef.current) return;
        setOrders(prev => mergeOrders(prev, data));
      } catch {
        // ignore
      }
    };

    void run();
    const id = window.setInterval(run, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [ready, token, fetchAuthed, mergeOrders]);

  useEffect(() => {
    if (newOrderPopupOrders.length === 0) return;
    const id = window.setInterval(() => setNewOrderPopupTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [newOrderPopupOrders.length]);

  // Auto-play sound when popup opens
  useEffect(() => {
    if (newOrderPopupOrders.length > 0 && ringingEnabledByAdmin && shiftActive && !isShiftPaused) {
      // Play sound immediately when popup opens
      playNewOrderSound(newOrderSoundPreset, newOrderSoundVolume);
    }
  }, [newOrderPopupOrders.length, ringingEnabledByAdmin, shiftActive, isShiftPaused, newOrderSoundPreset, newOrderSoundVolume]);

  
  const [profile, setProfile] = useState<{
    name: string;
    email: string;
    employeeCode: string;
    branchId?: number;
    branch?: { id: number; name: string };
    phone?: string;
    salary?: number;
    address?: string;
    pincode?: string;
  } | null>(null);

  useEffect(() => {
    isOrderPopupOpenRef.current = isOrderPopupOpen;
  }, [isOrderPopupOpen]);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      setOrdersSnapshotLoading(false);
      stopGlobalLoading();
      return;
    }
    // Don't fetch while order popup is open – keeps cards stable (still clear login overlay).
    if (isOrderPopupOpen) {
      stopGlobalLoading();
      return;
    }

    // With realtime socket events keeping the list fresh, do a single initial snapshot load
    // (no 10s polling). Shell stays interactive — only order tables show a loading state.
    setOrdersSnapshotLoading(true);
    (async () => {
      try {
        if (isOrderPopupOpenRef.current) return;
        let currentToken = token;
        const doFetch = async (t: string) =>
          fetchWithTimeout(`${apiBase}/orders/live`, {
            headers: { Authorization: `Bearer ${t}` },
            credentials: 'include',
          });

        let res = await doFetch(currentToken);
        if (res.status === 401) {
          const nextToken = await refresh();
          if (nextToken) {
            currentToken = nextToken;
            res = await doFetch(currentToken);
          }
        }
        if (!res.ok) return;
        const data = await res.json();
        if (isOrderPopupOpenRef.current) return;
        setOrders(prev => {
          const next = mergeOrders(prev, data);
          if (prev.length === 0 && next.length >= 0) hasCompletedFirstLoad.current = true;
          return next;
        });
      } catch {
        // ignore
      } finally {
        setOrdersSnapshotLoading(false);
        stopGlobalLoading();
      }
    })();
  }, [ready, token, refresh, logout, isOrderPopupOpen, mergeOrders]);

  useEffect(() => {
    if (!ready) return;
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAuthed(`${apiBase}/employees/me`, { method: 'GET' });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const payload =
          data && typeof data === 'object' && 'employee' in data ? (data as any).employee : data;
        if (!cancelled && payload) setProfile(payload);
      } catch {
        // ignore – profile is optional UI
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, token, fetchAuthed]);

  // Fetch current shift status on load; show Start shift? only once per day when no active shift
  useEffect(() => {
    if (!ready) return;
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAuthed(`${apiBase}/shift/current`, { method: 'GET' });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (cancelled || !data) return;
        if (data.active) setShiftActive(true);
        if (data.shift) setCurrentShift(data.shift);
        if (!data.active) {
          const businessDayKey = getBusinessDateKey(new Date());
          const todayKey = 'dm_shift_prompt_dismissed_' + businessDayKey;
          const dismissedToday = window.sessionStorage.getItem(todayKey) === '1';
          if (!dismissedToday) setShowStartShiftPrompt(true);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, token, fetchAuthed]);

  // Load employee shift history (daily in/out + hours)
  useEffect(() => {
    if (!ready) return;
    if (!token) return;
    setMyShiftHistoryLoaded(false);
    (async () => {
      try {
        const res = await fetchAuthed(`${apiBase}/shift/my-history`, { method: 'GET' });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) return;
        setMyShiftHistory(data.shifts ?? []);
        setMyDailyShiftStats(data.dailyStats ?? []);
      } catch {
        // ignore
      } finally {
        setMyShiftHistoryLoaded(true);
      }
    })();
  }, [ready, token, fetchAuthed]);

  // Approved overtime counter (only after Admin approval)
  useEffect(() => {
    if (!ready) return;
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAuthed(`${apiBase}/overtime/my-summary`, { method: 'GET' });
        const data = await res.json().catch(() => null);
        if (!res.ok || cancelled || !data) return;
        setMyApprovedOvertime(data);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, token, fetchAuthed]);

  const loadMyLeaves = useCallback(async () => {
    if (!ready) return;
    if (!token) return;
    setLeaveLoading(true);
    try {
      const res = await fetchAuthed(`${apiBase}/leaves/mine`, { method: 'GET' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (data && typeof data === 'object' && 'message' in data
            ? String((data as any).message || '')
            : '') || 'Failed to load leaves'
        );
      }
      const rows =
        data && typeof data === 'object' && 'leaves' in data
          ? (data as { leaves?: unknown }).leaves
          : [];
      setMyLeaves(Array.isArray(rows) ? (rows as LeaveRequest[]) : []);
    } catch {
      setMyLeaves([]);
    } finally {
      setLeaveLoading(false);
    }
  }, [ready, token, fetchAuthed]);

  useEffect(() => {
    if (!token || activeSection !== 'leave') return;
    loadMyLeaves();
  }, [token, activeSection, loadMyLeaves]);

  const applyLeave = async () => {
    if (!token || !leaveStartDate || !leaveEndDate) {
      toast.error('Select start and end date first.');
      return;
    }
    if (new Date(leaveEndDate) < new Date(leaveStartDate)) {
      toast.error('End date must be after start date.');
      return;
    }
    if (hasLeaveOverlap) {
      toast.error('Selected dates overlap with an existing leave request.');
      return;
    }
    setLeaveSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/leaves/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          leaveType,
          startDate: leaveStartDate,
          endDate: leaveEndDate,
          reason: leaveReason.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (data && typeof data === 'object' && 'message' in data
            ? String((data as any).message || '')
            : '') || 'Leave request failed'
        );
      }
      toast.success('Leave request submitted for admin approval.');
      setLeaveReason('');
      setLeaveStartDate('');
      setLeaveEndDate('');
      await loadMyLeaves();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to apply leave');
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const endedShiftToday =
    myShiftHistoryLoaded &&
    myShiftHistory.some(
      s =>
        !!s.shiftEnd &&
        getBusinessDateKey(new Date(s.shiftStart)) === getBusinessDateKey(new Date())
    );

  const startShift = async () => {
    if (!token) return;
    // One shift per day: cannot start again after ending a shift the same day
    if (endedShiftToday) {
      toast.error('You already completed a shift today. You can start again tomorrow.');
      return;
    }
    if (shiftActive && currentShift) {
      toast.error('You already have an active shift. End it first.');
      return;
    }
    const openShift = myShiftHistory.find(s => !s.shiftEnd);
    if (openShift) {
      if (getBusinessDateKey(new Date(openShift.shiftStart)) === getBusinessDateKey(new Date())) {
        toast.error('You already started a shift today. End it first or contact admin.');
      } else {
        toast.error('Please end your previous shift first. Contact admin if you need help.');
      }
      return;
    }
    setShiftLoading(true);
    try {
      const branchId = profile?.branchId ?? profile?.branch?.id;
      const res = await fetch(`${apiBase}/shift/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(branchId != null ? { branchId } : {}),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data) setCurrentShift(data);
        setShiftActive(true);
        toast.success('Your shift has begun');
        setShowStartShiftPrompt(false);
        // Refetch history in background without blocking UI (reduces card flash)
        fetch(`${apiBase}/shift/my-history`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => (r.ok ? r.json() : null))
          .then(d => {
            if (d) {
              setMyShiftHistory(d.shifts ?? []);
              setMyDailyShiftStats(d.dailyStats ?? []);
            }
          })
          .catch(() => {});
      } else {
        const data = await res.json().catch(() => ({}));
        const alreadyActive = res.status === 400 && data.message === 'Shift already active';
        if (alreadyActive) {
          setShiftActive(true);
          toast.success("You're already on an active shift.");
          // refresh shift info
          fetch(`${apiBase}/shift/current`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then(r => (r.ok ? r.json() : null))
            .then(d => d?.shift && setCurrentShift(d.shift))
            .catch(() => {});
        } else {
          toast.error(data.message || 'Failed to start shift');
        }
      }
    } catch {
      toast.error('Failed to start shift');
    } finally {
      setShiftLoading(false);
    }
  };

  const endShift = async () => {
    if (!token) return;
    setShiftLoading(true);
    try {
      const res = await fetch(`${apiBase}/shift/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data) setCurrentShift(data);
        setShiftActive(false);
        toast.success('Your shift has ended');
        setConfirmEndShiftOpen(false);
        fetch(`${apiBase}/shift/my-history`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => (r.ok ? r.json() : null))
          .then(d => {
            if (d) {
              setMyShiftHistory(d.shifts ?? []);
              setMyDailyShiftStats(d.dailyStats ?? []);
            }
          })
          .catch(() => {});
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || 'Failed to end shift');
      }
    } catch {
      toast.error('Failed to end shift');
    } finally {
      setShiftLoading(false);
    }
  };

  const acceptOrder = async (orderId: number) => {
    if (!token) return;
    setAcceptingOrderId(orderId);
    try {
      const res = await fetchAuthed(`${apiBase}/orders/${orderId}/accept`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.order ?? data;
        setNewOrderPopupOrders(prev => prev.filter(o => o.id !== orderId));
        setOrders(prev =>
          prev.map(o =>
            o.id === orderId
              ? {
                  ...o,
                  ...updated,
                  employeeId: updated.employeeId ?? updated.employee?.id,
                  employee: updated.employee,
                  acceptedAt: updated.acceptedAt ?? o.acceptedAt,
                }
              : o
          )
        );
        setSelectedOrder(prev => (prev && prev.id === orderId ? { ...prev, ...updated } : prev));
        setPopupDisplayOrder(prev =>
          prev && prev.id === orderId
            ? {
                ...prev,
                ...updated,
                employeeId: updated.employeeId ?? updated.employee?.id ?? prev.employeeId,
                employee: updated.employee ?? prev.employee,
                acceptedAt: updated.acceptedAt ?? prev.acceptedAt,
                status: updated.status ?? 'ACCEPTED',
              }
            : prev
        );
        toast.success(data.message || 'You are now handling this order.');
        // Business rule: employees can send WhatsApp only after payment is completed.
        if (data.statusWaMeLink) {
          toast('WhatsApp messages can be sent after payment is marked as Paid.');
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Order may already be accepted by someone else');
      }
    } catch {
      toast.error('Failed to accept order');
    } finally {
      setAcceptingOrderId(null);
    }
  };

  const rejectOrder = async (orderId: number) => {
    if (!token) return;
    setAcceptingOrderId(orderId);
    try {
      const res = await fetchAuthed(`${apiBase}/orders/${orderId}/reject`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.order ?? data;
        setNewOrderPopupOrders(prev => prev.filter(o => o.id !== orderId));
        setOrders(prev =>
          prev.map(o =>
            o.id === orderId
              ? {
                  ...o,
                  ...updated,
                  status: 'REJECTED',
                }
              : o
          )
        );
        setSelectedOrder(prev => (prev && prev.id === orderId ? { ...prev, ...updated } : prev));
        setPopupDisplayOrder(prev =>
          prev && prev.id === orderId ? { ...prev, ...updated, status: 'REJECTED' } : prev
        );
        toast.success(data.message || 'Order rejected successfully.');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Failed to reject order');
      }
    } catch {
      toast.error('Failed to reject order');
    } finally {
      setAcceptingOrderId(null);
    }
  };

  const rejectOrderRef = useRef(rejectOrder);
  rejectOrderRef.current = rejectOrder;

  useEffect(() => {
    if (newOrderPopupOrders.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const o of newOrderPopupOrders) {
      if (o.status !== 'NEW_ORDER') continue;
      const elapsed = Date.now() - new Date(o.createdAt).getTime();
      const delay = Math.max(0, NEW_ORDER_AUTO_REJECT_MS - elapsed);
      const orderId = o.id;
      timers.push(
        window.setTimeout(() => {
          void rejectOrderRef.current(orderId);
        }, delay)
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [newOrderPopupOrders]);

  const markStatus = useCallback(
    async (orderId: number, status: string) => {
      if (!token) return;
      setActionOrderId(orderId);
      try {
        const res = await fetchAuthed(`${apiBase}/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          const data = await res.json();
          const updated = data.order ?? data;
          setOrders(prev =>
            prev.map(o =>
              o.id === updated.id
                ? {
                    ...o,
                    status: updated.status,
                    completedAt: updated.completedAt ?? o.completedAt,
                  }
                : o
            )
          );
          setSelectedOrder(prev =>
            prev && prev.id === orderId
              ? {
                  ...prev,
                  status: updated.status,
                  completedAt: updated.completedAt ?? prev.completedAt,
                }
              : prev
          );
          setPopupDisplayOrder(prev =>
            prev && prev.id === orderId
              ? {
                  ...prev,
                  status: updated.status,
                  completedAt: updated.completedAt ?? prev.completedAt,
                }
              : prev
          );
          if (data.statusWaMeLink) {
            toast('WhatsApp messages can be sent after payment is marked as Paid.');
          }
          toast.success(
            data.message || `Order marked as ${status.replace('_', ' ').toLowerCase()}`
          );
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.message || 'Failed to update status');
        }
      } catch {
        toast.error('Failed to update status');
      } finally {
        setActionOrderId(null);
      }
    },
    [token, fetchAuthed]
  );

  const applyOrderPayment = useCallback(
    async (orderId: number, mode: 'PAID' | 'PENDING') => {
      if (!token) return;
      const localOrder = orders.find(o => o.id === orderId);
      if (!localOrder) return;
      setActionOrderId(orderId);
      const body =
        mode === 'PAID'
          ? {
              paymentStatus: 'PAID',
              paidAmount: localOrder.totalAmount,
              remainingAmount: 0,
            }
          : {
              paymentStatus: 'PAYMENT_PENDING',
              paidAmount: 0,
              remainingAmount: localOrder.totalAmount,
            };
      try {
        const res = await fetchAuthed(`${apiBase}/payments/${orderId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          const updated = data.order ?? {};
          const ps = updated.paymentStatus ?? (mode === 'PAID' ? 'PAID' : 'PAYMENT_PENDING');
          setOrders(prev =>
            prev.map(o => (o.id === orderId ? { ...o, paymentStatus: ps } : o))
          );
          setSelectedOrder(prev =>
            prev && prev.id === orderId ? { ...prev, paymentStatus: ps } : prev
          );
          setPopupDisplayOrder(prev =>
            prev && prev.id === orderId ? { ...prev, paymentStatus: ps } : prev
          );

          if (mode === 'PAID') {
            setPopupDisplayOrder(null);
            setIsOrderPopupOpen(false);
            setSelectedOrder(null);
            fetch(`${apiBase}/shift/current`, {
              headers: { Authorization: `Bearer ${token}` },
            })
              .then(r => (r.ok ? r.json() : null))
              .then(d => d?.shift && setCurrentShift(d.shift))
              .catch(() => {});
            if (data.paymentWaMeLink) {
              const win = window.open(data.paymentWaMeLink, '_blank', 'noopener,noreferrer');
              if (!win || win.closed === undefined) {
                toast.error(
                  'Popup blocked. Allow popups for this site to open WhatsApp and send receipt to customer.',
                  { duration: 8000 }
                );
                toast(
                  'You can copy the receipt link from the address bar after allowing popups and retry Mark as Paid.',
                  { duration: 6000 }
                );
              } else {
                toast.success('WhatsApp opened – send the receipt to the customer.');
              }
            } else {
              if (!localOrder.customerMobile || !localOrder.customerName) {
                toast.success(
                  'Payment marked as received. Save customer name & mobile before marking paid to send WhatsApp receipt next time.'
                );
              } else {
                toast.success(data.message || 'Payment marked as received');
              }
            }
          } else {
            toast.success(data.message || 'Payment marked as pending.');
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          toast.error(errData.message || 'Failed to update payment');
        }
      } catch {
        toast.error('Failed to update payment');
      } finally {
        setActionOrderId(null);
      }
    },
    [token, orders]
  );

  const confirmPayment = useCallback(
    (orderId: number) => {
      void applyOrderPayment(orderId, 'PAID');
    },
    [applyOrderPayment]
  );

  const openOrderPopup = useCallback((order: Order) => {
    setSelectedOrder(order);
    setPopupDisplayOrder(
      typeof structuredClone === 'function'
        ? structuredClone(order)
        : JSON.parse(JSON.stringify(order))
    );
    setRemovedItemIds([]);
    setModificationReason('Item not available');
    setAddItemsSearchQuery('');
    setAddedItemsCart([]);
    setPendingQtyByOrderItemId({});
    setPopupCustomerName(order.customerName ?? '');
    setPopupCustomerMobile(
      (order.customerMobile ?? '').replace(/\D/g, '').slice(-10)
    );
    setIsOrderPopupOpen(true);
  }, []);

  // Menu for "Add more items" — load only when the order popup opens (saves a heavy request on every visit).
  useEffect(() => {
    if (!isOrderPopupOpen) return;
    let cancelled = false;
    setMenuLoadingForEdits(true);
    fetchWithTimeout(`${apiBase}/menu`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const cats = Array.isArray(data) ? data : (data?.categories ?? []);
        setMenuCategoriesForEdits(cats);
      })
      .catch(() => {
        if (!cancelled) setMenuCategoriesForEdits([]);
      })
      .finally(() => {
        if (!cancelled) setMenuLoadingForEdits(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOrderPopupOpen]);

  const addItemToCart = useCallback(
    (item: { name: string; menuItemId?: number; unitPrice: number; variant?: 'HALF' | 'FULL' }) => {
      const id = `${item.menuItemId ?? item.name}-${item.variant ?? 'FULL'}-${item.unitPrice}`;
      setAddedItemsCart(prev => {
        const existing = prev.find(p => p.id === id);
        if (existing) {
          return prev.map(p => (p.id === id ? { ...p, quantity: p.quantity + 1 } : p));
        }
        return [
          ...prev,
          {
            id,
            name: item.name,
            menuItemId: item.menuItemId,
            unitPrice: item.unitPrice,
            quantity: 1,
            variant: item.variant,
          },
        ];
      });
    },
    []
  );

  const updateAddedItemQty = useCallback((id: string, delta: number) => {
    setAddedItemsCart(prev =>
      prev
        .map(p => (p.id === id ? { ...p, quantity: p.quantity + delta } : p))
        .filter(p => p.quantity > 0)
    );
  }, []);

  const saveOrderCustomer = useCallback(async () => {
    if (!selectedOrder || !token) return;
    const mobile = popupCustomerMobile.replace(/\D/g, '').slice(0, 10);
    if (mobile.length !== 10 || !/^[6-9]/.test(mobile)) {
      toast.error('Enter a valid 10-digit mobile number.');
      return;
    }
    setSavingCustomer(true);
    try {
      const res = await fetch(`${apiBase}/orders/${selectedOrder.id}/customer`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerMobile: mobile,
          customerName: popupCustomerName.trim() || undefined,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setOrders(prev =>
          prev.map(o =>
            o.id === selectedOrder.id
              ? {
                  ...o,
                  customerName: updated.customerName,
                  customerMobile: updated.customerMobile,
                }
              : o
          )
        );
        setSelectedOrder(prev =>
          prev && prev.id === selectedOrder.id
            ? {
                ...prev,
                customerName: updated.customerName,
                customerMobile: updated.customerMobile,
              }
            : prev
        );
        setPopupDisplayOrder(prev =>
          prev && prev.id === selectedOrder.id
            ? {
                ...prev,
                customerName: updated.customerName,
                customerMobile: updated.customerMobile,
              }
            : prev
        );
        toast.success(
          (updated as { message?: string }).message ||
            'Customer mobile saved. WhatsApp updates will be sent to this number.'
        );
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save customer');
    } finally {
      setSavingCustomer(false);
    }
  }, [token, selectedOrder, popupCustomerName, popupCustomerMobile]);

  const toggleItemRemoval = useCallback((itemId: number) => {
    setRemovedItemIds(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  }, []);

  const modifyOrder = useCallback(async () => {
    if (!selectedOrder || !token) return;
    const updatedItems = Object.entries(pendingQtyByOrderItemId)
      .map(([orderItemId, qty]) => ({
        orderItemId: Number(orderItemId),
        quantity: qty as number,
      }))
      .filter(u => Number.isFinite(u.orderItemId) && typeof u.quantity === 'number');

    const addedItems = addedItemsCart.map(i => ({
      name: i.name,
      menuItemId: i.menuItemId,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      variant: i.variant,
    }));

    const hasChanges =
      removedItemIds.length > 0 || addedItems.length > 0 || updatedItems.length > 0;
    if (!hasChanges) return;
    setIsModifying(true);
    try {
      const res = await fetch(`${apiBase}/orders/${selectedOrder.id}/modify-v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          removedItemIds,
          addedItems,
          updatedItems,
          reason: modificationReason,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(prev => prev.map(o => (o.id === selectedOrder.id ? data.order : o)));
        toast.success(
          data.message ||
            `Order updated. New total: ${formatINR(data.newAmount ?? data.order?.totalAmount ?? 0)}`
        );
        setPopupDisplayOrder(null);
        setIsOrderPopupOpen(false);
        setSelectedOrder(null);
        setRemovedItemIds([]);
        setAddedItemsCart([]);
        setPendingQtyByOrderItemId({});
      }
    } catch (error) {
      toast.error('Failed to modify order');
    } finally {
      setIsModifying(false);
    }
  }, [
    token,
    selectedOrder,
    removedItemIds,
    modificationReason,
    addedItemsCart,
    pendingQtyByOrderItemId,
  ]);

  const getBusinessDayStart = (now: Date) => {
    const startHour = 4; // 04:00 AM
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, 0, 0, 0);
    // If it's after midnight but before 4 AM, we're still in the previous business day.
    if (now.getTime() < start.getTime()) start.setDate(start.getDate() - 1);
    return start;
  };

  // Live = unpaid, non-rejected orders for current business day (starts 04:00 AM).
  // This prevents yesterday's pending orders from showing after daily reset.
  const businessDayStart = useMemo(() => getBusinessDayStart(currentTime), [currentTime]);
  const businessDayEnd = useMemo(
    () => new Date(businessDayStart.getTime() + 24 * 60 * 60 * 1000),
    [businessDayStart]
  );
  const ordersInBusinessDay = useMemo(
    () =>
      orders.filter(o => {
        const t = new Date(o.createdAt);
        return t >= businessDayStart && t < businessDayEnd;
      }),
    [orders, businessDayStart, businessDayEnd]
  );

  const todayStats = useMemo(() => {
    const ordersToday = ordersInBusinessDay.length;
    const paidOrdersList = ordersInBusinessDay.filter(o => o.paymentStatus === 'PAID');
    const paid = new Set(paidOrdersList.map(o => o.id)).size; // Unique paid order count
    const completed = ordersInBusinessDay.filter(
      o => o.status === 'ORDER_COMPLETE' && o.paymentStatus !== 'PAID'
    ).length; // Completed = completed but not yet paid
    const pendingPayments = ordersInBusinessDay.filter(
      o => o.status === 'ORDER_COMPLETE' && o.paymentStatus !== 'PAID'
    ).length;
    const salesToday = currentShift?.totalSales ?? 0;
    return { ordersToday, completed, paid, pendingPayments, salesToday };
  }, [ordersInBusinessDay, currentShift]);
  const liveOrdersRaw = useMemo(
    () =>
      orders.filter(o => {
        if (o.paymentStatus === 'PAID') return false;
        if (o.status === 'REJECTED') return false;
        const t = new Date(o.createdAt);
        return t >= businessDayStart && t < businessDayEnd;
      }),
    [orders, businessDayStart, businessDayEnd]
  );
  const liveOrders = useMemo(
    () =>
      [...liveOrdersRaw].sort((a, b) =>
        a.status === 'ORDER_COMPLETE' && b.status !== 'ORDER_COMPLETE'
          ? -1
          : b.status === 'ORDER_COMPLETE' && a.status !== 'ORDER_COMPLETE'
            ? 1
            : 0
      ),
    [liveOrdersRaw]
  );
  const completedOrders = useMemo(
    () =>
      ordersInBusinessDay.filter(o => o.status === 'ORDER_COMPLETE' && o.paymentStatus !== 'PAID'),
    [ordersInBusinessDay]
  );
  const pendingPayments = useMemo(
    () =>
      ordersInBusinessDay.filter(o => o.status === 'ORDER_COMPLETE' && o.paymentStatus !== 'PAID'),
    [ordersInBusinessDay]
  );
  const paidOrders = useMemo(
    () => ordersInBusinessDay.filter(o => o.paymentStatus === 'PAID' || o.status === 'ORDER_COMPLETE'),
    [ordersInBusinessDay]
  );

  // All orders (no extra filtering) – used by the All Orders tab
  const allOrders = orders;

  const recentOrders = useMemo(() => {
    return [...ordersInBusinessDay]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [ordersInBusinessDay]);

  const getStatusColor = useCallback(
    (status: string) => ORDER_STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-800',
    []
  );

  const getStatusIcon = (status: string) => {
    if (status === 'NEW_ORDER') return <Bell className="h-3 w-3" />;
    if (isOrderInProgressStatus(status)) return <CheckCircle className="h-3 w-3" />;
    if (status === 'ORDER_COMPLETE') return <CheckCircle className="h-3 w-3" />;
    if (status === 'REJECTED') return <XCircle className="h-3 w-3" />;
    return null;
  };

  /** Order is delayed if NEW_ORDER/ACCEPTED and older than threshold from acceptedAt (fallback createdAt). */
  const isOrderDelayed = (order: Order) => {
    if (order.status !== 'NEW_ORDER' && order.status !== 'ACCEPTED') {
      return false;
    }
    const startedAt = order.acceptedAt || order.createdAt;
    return Date.now() - new Date(startedAt).getTime() > DELAYED_ORDER_MS;
  };

  /** Priority label for POS-style visibility */
  const getPriorityLabel = (order: Order): string => {
    if (isOrderDelayed(order)) return 'Delayed';
    if (order.status === 'NEW_ORDER') return 'New Order';
    if (isOrderInProgressStatus(order.status)) return 'In progress';
    if (order.status === 'ORDER_COMPLETE') return 'Completed';
    if (order.status === 'REJECTED') return 'Rejected';
    return order.status.replace('_', ' ');
  };

  /** Badge style: green New, yellow Preparing, red Delayed, green Completed */
  const getPriorityBadgeClass = (order: Order): string => {
    if (isOrderDelayed(order)) return 'bg-red-100 text-red-800 border border-red-300';
    if (order.status === 'NEW_ORDER') return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
    if (isOrderInProgressStatus(order.status))
      return 'bg-amber-100 text-amber-800 border border-amber-300';
    if (order.status === 'ORDER_COMPLETE')
      return 'bg-green-100 text-green-800 border border-green-300';
    if (order.status === 'REJECTED') return 'bg-rose-100 text-rose-800 border border-rose-300';
    return getStatusColor(order.status);
  };

  const renderOrderCard = (
    order: Order,
    options?: { isCompletedSection?: boolean; isLiveSection?: boolean }
  ) => {
    const delayed = isOrderDelayed(order);
    const isTakeAway = order.orderType === 'TAKE_AWAY';
    const isReadyForPayment = options?.isLiveSection && order.status === 'ORDER_COMPLETE';
    // Card theme by order type:
    // - Dine-in: green
    // - Takeaway: blue (distinct alternative)
    const typeTheme = isTakeAway
      ? {
          border: 'border-l-blue-600',
          bg: 'bg-blue-50/50',
          badge: 'bg-blue-100 text-blue-800 border-blue-300',
        }
      : {
          border: 'border-l-green-600',
          bg: 'bg-green-50/50',
          badge: 'bg-green-100 text-green-800 border-green-300',
        };

    // Live: red = delayed, otherwise themed by order type
    const liveCardStyle = options?.isLiveSection
      ? delayed
        ? 'border-l-4 border-l-red-600 bg-red-50/50 ring-1 ring-red-200'
        : order.status === 'ORDER_COMPLETE'
          ? order.paymentStatus !== 'PAID'
            ? `border-l-4 ${typeTheme.border} ${typeTheme.bg}`
            : `border-l-4 ${typeTheme.border} ${typeTheme.bg}`
          : `border-l-4 ${typeTheme.border} ${typeTheme.bg}`
      : '';
    const completedCardStyle = options?.isCompletedSection
      ? `border-l-4 ${typeTheme.border} ${typeTheme.bg}`
      : '';
    const defaultCardStyle =
      !options?.isLiveSection && !options?.isCompletedSection
        ? `border-l-4 ${typeTheme.border} ${typeTheme.bg}`
        : '';
    const isAcceptingThis = acceptingOrderId === order.id;
    const isActionThis = actionOrderId === order.id;

    // Completed: View, Mark as Paid, Mark as Pending (no add/modify on card).
    const compactCompletedBlock = isReadyForPayment && (
      <div className="flex min-h-0 flex-col gap-2 p-3">
        <div className="text-base font-bold text-slate-900">Order #{order.id}</div>
        <div className="truncate text-sm font-semibold text-slate-700">
          Table {order.table?.tableNumber || order.table?.id || '?'}
        </div>
        {options?.isLiveSection && (
          <p className="font-bold text-emerald-700">{formatINR(order.totalAmount)}</p>
        )}
        {order.acceptedAt && order.completedAt && (
          <p className="text-xs text-slate-600">
            Time to complete: {formatTimeToComplete(order.acceptedAt, order.completedAt)}
          </p>
        )}
        <Badge
          variant={isPaymentPaid(order) ? 'default' : 'secondary'}
          className={`w-fit shrink-0 px-3 py-1 text-sm font-semibold ${isPaymentPaid(order) ? 'border-green-300 bg-green-100 text-green-800' : 'border-amber-300 bg-amber-100 text-amber-800'}`}
        >
          {paymentLabel(order.paymentStatus)}
        </Badge>
        <div className="mt-auto flex w-full flex-col gap-2">
          <Button
            size="sm"
            variant="outline"
            className="min-h-[44px] w-full text-xs"
            onClick={e => {
              e.stopPropagation();
              openOrderPopup(order);
            }}
          >
            <Eye className="mr-1 h-3 w-3 shrink-0" />
            <span className="truncate">View</span>
          </Button>
          {!isPaymentPaid(order) && (
            <>
              <Button
                size="sm"
                className="min-h-[44px] w-full rounded-lg text-xs bg-emerald-600 hover:bg-emerald-700"
                disabled={isActionThis}
                onClick={e => {
                  e.stopPropagation();
                  void applyOrderPayment(order.id, 'PAID');
                }}
              >
                {isActionThis ? (
                  <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <CreditCard className="mr-1 h-4 w-4 shrink-0" />
                )}
                <span className="truncate">Mark as Paid</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px] w-full text-xs"
                disabled={isActionThis}
                onClick={e => {
                  e.stopPropagation();
                  void applyOrderPayment(order.id, 'PENDING');
                }}
              >
                Mark as Pending
              </Button>
            </>
          )}
        </div>
      </div>
    );

    return (
      <Card
        key={order.id}
        className={`card-gpu flex min-w-0 cursor-pointer flex-col ${liveCardStyle || completedCardStyle || defaultCardStyle} ${isReadyForPayment ? 'max-w-full' : ''}`}
        onClick={() => !isReadyForPayment && openOrderPopup(order)}
      >
        <CardContent
          className={`flex min-h-0 flex-1 flex-col ${isReadyForPayment ? 'p-2 sm:p-3' : 'p-2 sm:p-4'}`}
        >
          {compactCompletedBlock}
          {!isReadyForPayment && (
            <div className="flex flex-1 flex-col" onClick={e => e.stopPropagation()}>
              {/* Priority badge + Order # + Time ago (POS-style) */}
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <Badge
                  className={`shrink-0 text-[10px] font-semibold sm:text-xs ${getPriorityBadgeClass(order)}`}
                >
                  {getPriorityLabel(order)}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  #{order.id} · {timeAgo(order.acceptedAt ?? order.createdAt)}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-semibold sm:text-lg">
                      Table {order.table?.tableNumber || order.table?.id || '?'}
                    </span>
                    {order.customerMobile && (
                      <span
                        className="text-muted-foreground max-w-[100px] truncate text-xs sm:max-w-[120px]"
                        title={order.customerMobile}
                      >
                        {order.customerMobile.slice(-4).padStart(10, '•')}
                      </span>
                    )}
                    <Badge className={`shrink-0 ${getStatusColor(order.status)}`}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(order.status)}
                        <span className="hidden sm:inline">
                          {isOrderInProgressStatus(order.status)
                            ? 'In progress'
                            : order.status === 'NEW_ORDER'
                              ? 'New order'
                              : order.status === 'ORDER_COMPLETE'
                                ? 'Completed'
                                : order.status === 'REJECTED'
                                  ? 'Rejected'
                                  : order.status.replace(/_/g, ' ')}
                        </span>
                      </span>
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-muted-foreground text-xs sm:text-sm">
                      {new Date(order.createdAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' · '}
                      <span className="font-medium text-slate-600">{timeAgo(order.createdAt)}</span>
                    </p>
                    {order.orderType && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          order.orderType === 'TAKE_AWAY'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {order.orderType === 'TAKE_AWAY' ? 'Take Away' : 'Dine In'}
                      </span>
                    )}
                  </div>
                  {isOrderInProgressStatus(order.status) && (order.acceptedAt || order.createdAt) && (
                      <p className="text-xs font-medium text-amber-800">
                        Prep timer:{' '}
                        {formatPrepDuration(
                          order.acceptedAt ?? order.createdAt,
                          currentTime.getTime()
                        )}
                      </p>
                    )}
                  {/* Paused shift: show who accepted (no popup/ringing while paused). */}
                  {isShiftPaused && order.employee && (order.employee as any).name && (
                    <p className="text-xs font-medium text-slate-600">
                      Accepted by {(order.employee as any).name}
                    </p>
                  )}
                  {order.status === 'ORDER_COMPLETE' && order.acceptedAt && order.completedAt && (
                    <p className="text-xs font-medium text-slate-600">
                      Time to complete: {formatTimeToComplete(order.acceptedAt, order.completedAt)}
                    </p>
                  )}
                  <div className="mt-2 hidden space-y-1 sm:block">
                    {filterOrderItemsForDisplay(order.items)
                      .filter(i => !i.isRemoved)
                      .map(item => (
                        <p key={item.id} className="text-sm">
                          {item.quantity} × {formatItemDisplayName(item.name, item.variant)}
                          {!(options?.isLiveSection && order.status !== 'ORDER_COMPLETE') && (
                            <span className="ml-2 font-medium">{formatINR(item.price)}</span>
                          )}
                        </p>
                      ))}
                  </div>
                </div>
                {/* Total and payment: only after order is completed (payment flow is after Complete) */}
                {(!(options?.isLiveSection && order.status !== 'ORDER_COMPLETE') ||
                  order.status === 'ORDER_COMPLETE') && (
                  <div className="shrink-0 space-y-2 text-right">
                    <p className="text-base font-bold sm:text-lg">{formatINR(order.totalAmount)}</p>
                    {order.status === 'ORDER_COMPLETE' && (
                      <Badge
                        variant={isPaymentPaid(order) ? 'default' : 'secondary'}
                        className={
                          isPaymentPaid(order)
                            ? 'border-green-300 bg-green-100 text-green-800'
                            : 'border-amber-300 bg-amber-100 text-amber-800'
                        }
                      >
                        {paymentLabel(order.paymentStatus)}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <Separator className="my-2 sm:my-3" />
              <div className="mt-auto flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={e => {
                    e.stopPropagation();
                    openOrderPopup(order);
                  }}
                  className="text-xs sm:text-sm"
                >
                  <Eye className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                  View
                </Button>

                {order.status !== 'REJECTED' &&
                  order.status !== 'ORDER_COMPLETE' &&
                  order.status !== 'NEW_ORDER' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={e => {
                          e.stopPropagation();
                          openOrderPopup(order);
                        }}
                        className="text-xs sm:text-sm"
                      >
                        <Plus className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                        Add more items
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={e => {
                          e.stopPropagation();
                          openOrderPopup(order);
                        }}
                        className="text-xs sm:text-sm"
                      >
                        <Edit2 className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                        Modify
                      </Button>
                    </>
                  )}

                {order.status === 'NEW_ORDER' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={e => {
                        e.stopPropagation();
                        openOrderPopup(order);
                      }}
                      className="text-xs sm:text-sm"
                    >
                      <Plus className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                      Add more items
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={e => {
                        e.stopPropagation();
                        openOrderPopup(order);
                      }}
                      className="text-xs sm:text-sm"
                    >
                      <Edit2 className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                      Modify
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 text-xs text-white hover:bg-green-700 sm:text-sm"
                      disabled={isAcceptingThis || isActionThis}
                      onClick={e => {
                        e.stopPropagation();
                        acceptOrder(order.id);
                      }}
                    >
                      {isAcceptingThis ? (
                        <>
                          <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent sm:h-4 sm:w-4" />
                          Accepting...
                        </>
                      ) : (
                        <>Accept</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 sm:text-sm"
                      disabled={isAcceptingThis || isActionThis}
                      onClick={e => {
                        e.stopPropagation();
                        rejectOrder(order.id);
                      }}
                    >
                      <XCircle className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                      Reject
                    </Button>
                  </>
                )}

                {isOrderInProgressStatus(order.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isActionThis}
                    onClick={e => {
                      e.stopPropagation();
                      markStatus(order.id, 'ORDER_COMPLETE');
                    }}
                    className="text-xs sm:text-sm"
                  >
                    {isActionThis ? (
                      <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent sm:h-4 sm:w-4" />
                    ) : (
                      <CheckCircle className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                    )}
                    Mark as Completed
                  </Button>
                )}

                {order.status === 'ORDER_COMPLETE' && !isPaymentPaid(order) && (
                  <>
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-xs text-white hover:bg-emerald-700 sm:text-sm"
                      disabled={isActionThis}
                      onClick={e => {
                        e.stopPropagation();
                        void applyOrderPayment(order.id, 'PAID');
                      }}
                    >
                      {isActionThis ? (
                        <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent sm:h-4 sm:w-4" />
                      ) : (
                        <CreditCard className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                      )}
                      Mark as Paid
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs sm:text-sm"
                      disabled={isActionThis}
                      onClick={e => {
                        e.stopPropagation();
                        void applyOrderPayment(order.id, 'PENDING');
                      }}
                    >
                      Mark as Pending
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderOrderList = (
    data: Order[],
    title: string,
    options?: { ordersLoading?: boolean }
  ) => {
    const ordersLoading = options?.ordersLoading;
    const isLiveOrders = title === 'Live Orders';
    const isCompletedSection = title === 'Completed Orders';
    const emptyState = isLiveOrders ? (
      <div className="text-muted-foreground py-6 text-center sm:py-8">
        <ShoppingCart className="mx-auto mb-3 h-10 w-10 opacity-20 sm:h-12 sm:w-12" />
        <p className="text-sm font-medium sm:text-base">No Active Orders</p>
        <p className="mt-1 text-xs sm:text-sm">New orders will appear here</p>
      </div>
    ) : (
      <div className="text-muted-foreground py-4 text-center sm:py-6">
        <ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-20 sm:mb-3 sm:h-12 sm:w-12" />
        <p className="text-sm sm:text-base">No orders in this section right now.</p>
      </div>
    );
    return (
      <Card className={isCompletedSection ? 'border-green-200 bg-green-50/30' : ''}>
        <CardHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle
                  className={`flex items-center gap-2 text-base sm:text-lg ${isCompletedSection ? 'text-green-800' : ''}`}
                >
                  <ShoppingCart
                    className={`h-4 w-4 shrink-0 sm:h-5 sm:w-5 ${isCompletedSection ? 'text-green-600' : ''}`}
                  />
                  <span className="truncate">{title}</span>
                </CardTitle>
                <Badge
                  variant="outline"
                  className={isCompletedSection ? 'border-green-300 text-green-800' : ''}
                >
                  {data.length}
                </Badge>
              </div>
              <CardDescription className="text-xs sm:text-sm">
                {data.length} orders in this section
              </CardDescription>
            </div>
            {isLiveOrders && (
              <div className="flex shrink-0 flex-col items-stretch justify-end gap-2 sm:ml-auto sm:flex-row sm:items-center sm:justify-end">
                <Button
                  size="sm"
                  className="min-h-[44px] text-xs sm:min-h-0 sm:text-sm"
                  onClick={() => setActiveSection('add-order')}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Order
                </Button>
                {shiftActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={shiftLoading}
                    onClick={async () => {
                      if (!token) return;
                      const endpoint = currentShift?.status === 'PAUSED' ? 'resume' : 'pause';
                      const res = await fetch(`${apiBase}/shift/${endpoint}`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      if (res.ok) {
                        const data = await res.json().catch(() => null);
                        if (data) setCurrentShift(prev => (prev ? { ...prev, ...data } : prev));
                        toast.success(
                          data?.message ||
                            (endpoint === 'pause'
                              ? 'Orders paused. Other staff can receive new orders.'
                              : 'You are Active again for new orders.')
                        );
                      }
                    }}
                    className="min-h-[44px] text-xs sm:min-h-0 sm:text-sm"
                  >
                    {currentShift?.status === 'PAUSED' ? 'Resume Orders' : 'Pause Orders'}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          {isLiveOrders ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {ordersLoading && data.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">Loading orders…</p>
                </div>
              ) : null}
              {!ordersLoading && data.length === 0 && (
                <div className="col-span-full">{emptyState}</div>
              )}
              {data.map(order => (
                <div key={order.id} className="min-w-0">
                  {renderOrderCard(order, {
                    isCompletedSection: false,
                    isLiveSection: true,
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50/50">
              <ScrollArea className="h-[480px] w-full sm:h-[560px] [&>[data-radix-scroll-area-viewport]]:pr-3">
                <div className="space-y-4 py-1">
                  {data.length === 0 && emptyState}
                  {data.map(order => renderOrderCard(order, { isCompletedSection }))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Memoize live orders section so it does not re-render when only currentTime (clock) updates – stops card flashing
  const liveOrdersSectionContent = useMemo(
    () => renderOrderList(liveOrders, 'Live Orders', { ordersLoading: ordersSnapshotLoading }),
    [
      liveOrders,
      ordersSnapshotLoading,
      acceptingOrderId,
      actionOrderId,
      currentShift?.status,
      shiftActive,
      shiftLoading,
      applyOrderPayment,
      currentTime,
    ]
  );

  const PAGE_SIZE = 10;
  const PAGE_SIZE_OPTIONS = [10, 20, 50];

  const OrdersTableSection = ({
    orders: rawOrders,
    title,
    loading,
    showConfirmPayment,
    onViewOrder,
    onConfirmPayment,
    actionOrderId,
    formatINR,
    getStatusColor,
    formatTimeToComplete,
  }: {
    orders: Order[];
    title: string;
    loading: boolean;
    showConfirmPayment: boolean;
    onViewOrder: (order: Order) => void;
    onConfirmPayment: (orderId: number) => void;
    actionOrderId: number | null;
    formatINR: (n: number) => string;
    getStatusColor: (s: string) => string;
    formatTimeToComplete: (a: string, b: string) => string;
  }) => {
    const [search, setSearch] = useState('');
    // Default to "all" so All Orders tab shows full history unless user narrows it
    const [dateFilter, setDateFilter] = useState<'today' | 'last7' | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<
      'all' | 'live' | 'ready_for_payment' | 'paid' | 'rejected'
    >('all');
    const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);

    const filtered = useMemo(() => {
      let list = rawOrders;
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const last7Start = new Date(todayStart);
      last7Start.setDate(last7Start.getDate() - 7);
      if (dateFilter === 'today') {
        list = list.filter(o => new Date(o.createdAt) >= todayStart);
      } else if (dateFilter === 'last7') {
        list = list.filter(o => new Date(o.createdAt) >= last7Start);
      }

      // Order status grouping (used on All Orders to replace separate Completed/Pending pages)
      if (statusFilter === 'paid') {
        list = list.filter(o => o.paymentStatus === 'PAID');
      } else if (statusFilter === 'ready_for_payment') {
        list = list.filter(o => o.status === 'ORDER_COMPLETE' && o.paymentStatus !== 'PAID');
      } else if (statusFilter === 'live') {
        list = list.filter(o => o.paymentStatus !== 'PAID' && o.status !== 'ORDER_COMPLETE');
      } else if (statusFilter === 'rejected') {
        list = list.filter(o => o.status === 'REJECTED');
      }

      if (paymentFilter === 'paid') list = list.filter(o => o.paymentStatus === 'PAID');
      else if (paymentFilter === 'unpaid') list = list.filter(o => o.paymentStatus !== 'PAID');
      const q = search.trim().toLowerCase();
      if (q) {
        list = list.filter(
          o =>
            String(o.id).includes(q) ||
            (o.table?.tableNumber ?? '').toLowerCase().includes(q) ||
            (o.employee?.name ?? '').toLowerCase().includes(q)
        );
      }
      // Always show latest orders first
      return [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }, [rawOrders, dateFilter, statusFilter, paymentFilter, search]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageOrders = useMemo(
      () => filtered.slice(start, start + pageSize),
      [filtered, start, pageSize]
    );

    const exportCSV = () => {
      const headers = [
        'Order ID',
        'Table',
        'Items',
        'Amount',
        'Status',
        'Payment',
        'Accepted By',
        'Time',
        'Time to Complete',
      ];
      const rows = filtered.map(o => {
        const itemsStr = filterOrderItemsForDisplay(o.items)
          .map(i => `${i.name} ×${i.quantity}`)
          .join('; ');
        const timeToComplete =
          o.acceptedAt && o.completedAt ? formatTimeToComplete(o.acceptedAt, o.completedAt) : '';
        return [
          o.id,
          o.table?.tableNumber ?? '',
          itemsStr,
          o.totalAmount,
          o.status,
          o.paymentStatus,
          o.employee?.name ?? '',
          new Date(o.createdAt).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          timeToComplete,
        ];
      });
      const csv = [
        headers.join(','),
        ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    const itemsSummary = (order: Order) => {
      const vis = filterOrderItemsForDisplay(order.items);
      const parts = vis.slice(0, 2).map(i => `${i.name} ×${i.quantity}`);
      if (vis.length > 2) parts.push(`+${vis.length - 2} more`);
      return parts.join(', ');
    };

    const paymentBadgeClass = (paymentStatus: string) =>
      paymentStatus === 'PAID'
        ? 'bg-green-100 text-green-800 border-green-300'
        : 'bg-amber-100 text-amber-800 border-amber-300';

    const isAllOrders = title.toLowerCase().includes('all orders');
    const isCompleted =
      title.toLowerCase().includes('completed') ||
      title.toLowerCase().includes('paid') ||
      (isAllOrders && statusFilter === 'paid');

    return (
      <Card
        className={
          isCompleted ? 'border-green-200 bg-green-50/30' : 'border-amber-200/60 bg-amber-50/20'
        }
      >
        <CardHeader className="px-4 pt-4 pb-3 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle
                className={`flex items-center gap-2 text-base sm:text-lg ${isCompleted ? 'text-green-800' : 'text-amber-800'}`}
              >
                <ShoppingCart
                  className={`h-4 w-4 shrink-0 sm:h-5 sm:w-5 ${isCompleted ? 'text-green-600' : 'text-amber-600'}`}
                />
                {title}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={exportCSV}
                  disabled={filtered.length === 0}
                >
                  <FileDown className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>
            <div className="flex flex-col flex-wrap gap-2 sm:flex-row sm:gap-3">
              <div className="relative w-full max-w-md min-w-0 sm:min-w-[200px] sm:flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search by Order ID, Table, Employee..."
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="h-10 pl-9"
                />
              </div>
              {isAllOrders && (
                <Select
                  value={statusFilter}
                  onValueChange={(
                    v: 'all' | 'live' | 'ready_for_payment' | 'paid' | 'rejected'
                  ) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-10 min-h-[44px] w-full min-w-0 sm:min-h-0 sm:w-[170px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="live">Live (In progress)</SelectItem>
                    <SelectItem value="ready_for_payment">Ready for payment</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select
                value={dateFilter}
                onValueChange={(v: 'today' | 'last7' | 'all') => {
                  setDateFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10 min-h-[44px] w-full min-w-0 sm:min-h-0 sm:w-[140px]">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="last7">Last 7 Days</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={paymentFilter}
                onValueChange={(v: 'all' | 'paid' | 'unpaid') => {
                  setPaymentFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10 min-h-[44px] w-full min-w-0 sm:min-h-0 sm:w-[120px]">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={String(pageSize)}
                onValueChange={v => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10 min-h-[44px] w-full min-w-0 sm:min-h-0 sm:w-[120px]">
                  <SelectValue placeholder="Page size" />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map(n => (
                    <SelectItem key={n} value={String(n)}>
                      Show {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6">
          {loading ? (
            <div className="space-y-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="hidden sm:table-cell">Accepted By</TableHead>
                    <TableHead className="hidden md:table-cell">Time</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-5 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-12" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-14" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-14" />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Skeleton className="h-5 w-16" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-8 w-14" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : total === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <ShoppingCart className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p className="text-sm">No orders match your filters.</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-md border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Accepted By</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageOrders.map(order => (
                      <TableRow
                        key={order.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => onViewOrder(order)}
                      >
                        <TableCell className="font-medium">#{order.id}</TableCell>
                        <TableCell>{order.table?.tableNumber ?? order.table?.id ?? '—'}</TableCell>
                        <TableCell className="max-w-[180px] truncate" title={itemsSummary(order)}>
                          {itemsSummary(order)}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatINR(order.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.status)} variant="secondary">
                            {order.status === 'ORDER_COMPLETE'
                              ? 'Completed'
                              : order.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={paymentBadgeClass(order.paymentStatus)}
                          >
                            {order.paymentStatus === 'PAID' ? 'Paid' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-emerald-700">
                          {order.employee?.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="text-xs font-medium text-slate-700">
                            {new Date(order.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {timeAgo(order.createdAt)}
                          </div>
                          {order.acceptedAt && order.completedAt && (
                            <span className="block text-xs font-medium text-emerald-600">
                              Done in {formatTimeToComplete(order.acceptedAt, order.completedAt)}
                            </span>
                          )}
                          {(order as any).orderType && (
                            <span
                              className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                (order as any).orderType === 'TAKE_AWAY'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {(order as any).orderType === 'TAKE_AWAY' ? 'Take Away' : 'Dine In'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mr-1"
                            onClick={() => onViewOrder(order)}
                          >
                            <Eye className="h-3 w-3 sm:mr-1" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                          {showConfirmPayment &&
                            order.paymentStatus !== 'PAID' &&
                            order.status === 'ORDER_COMPLETE' && (
                              <Button
                                size="sm"
                                disabled={actionOrderId === order.id}
                                onClick={e => {
                                  e.stopPropagation();
                                  onConfirmPayment(order.id);
                                }}
                              >
                                {actionOrderId === order.id ? (
                                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                ) : (
                                  <>
                                    <CreditCard className="h-3 w-3 sm:mr-1" />
                                    <span className="hidden sm:inline">Pay</span>
                                  </>
                                )}
                              </Button>
                            )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 md:hidden">
                {pageOrders.map(order => (
                  <Card
                    key={order.id}
                    className="cursor-pointer border bg-white transition-shadow hover:shadow-md"
                    onClick={() => onViewOrder(order)}
                  >
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between">
                        <span className="font-semibold">Order #{order.id}</span>
                        <Badge className={paymentBadgeClass(order.paymentStatus)} variant="outline">
                          {order.paymentStatus === 'PAID' ? 'Paid' : 'Unpaid'}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        Table {order.table?.tableNumber ?? order.table?.id ?? '—'}
                      </p>
                      <p className="text-sm">Items: {itemsSummary(order)}</p>
                      <p className="font-semibold">{formatINR(order.totalAmount)}</p>
                      {/* Paused shift: show who accepted (no popup/ringing while paused). */}
                      {isShiftPaused && order.employee && (order.employee as any).name && (
                        <p className="text-muted-foreground text-xs">
                          Accepted by {(order.employee as any).name}
                        </p>
                      )}
                      <p className="text-muted-foreground text-xs">
                        {new Date(order.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {' · '}
                        {timeAgo(order.createdAt)}
                        {order.acceptedAt &&
                          order.completedAt &&
                          ` · Done in ${formatTimeToComplete(order.acceptedAt, order.completedAt)}`}
                      </p>
                      {(order as any).orderType && (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            (order as any).orderType === 'TAKE_AWAY'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {(order as any).orderType === 'TAKE_AWAY' ? 'Take Away' : 'Dine In'}
                        </span>
                      )}
                      <div className="flex gap-2 pt-2" onClick={e => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => onViewOrder(order)}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          View
                        </Button>
                        {showConfirmPayment &&
                          order.paymentStatus !== 'PAID' &&
                          order.status === 'ORDER_COMPLETE' && (
                            <Button
                              size="sm"
                              disabled={actionOrderId === order.id}
                              onClick={() => onConfirmPayment(order.id)}
                            >
                              {actionOrderId === order.id ? (
                                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              ) : (
                                'Confirm Payment'
                              )}
                            </Button>
                          )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row">
                <p className="text-muted-foreground text-sm">
                  Showing {total === 0 ? 0 : start + 1}–{Math.min(start + pageSize, total)} of{' '}
                  {total} orders
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[80px] text-center text-sm font-medium">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const dashboardOverviewContent = useMemo(
    () => (
      <div className="space-y-4 sm:space-y-6">
        {/* Header - same as admin */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold sm:text-xl">Today&apos;s Dashboard</h2>
            <p className="text-muted-foreground max-w-full truncate text-xs sm:text-sm">
              {currentTime.toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              {' · '}
              {currentTime.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {shiftActive && (
              <Button
                variant="outline"
                size="sm"
                disabled={shiftLoading}
                onClick={async () => {
                  if (!token) return;
                  const endpoint = currentShift?.status === 'PAUSED' ? 'resume' : 'pause';
                  const res = await fetch(`${apiBase}/shift/${endpoint}`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (res.ok) {
                    const data = await res.json().catch(() => null);
                    if (data) setCurrentShift(prev => (prev ? { ...prev, ...data } : prev));
                    toast.success(
                      data?.message ||
                        (endpoint === 'pause'
                          ? 'Orders paused. Other staff can receive new orders.'
                          : 'You are Active again for new orders.')
                    );
                  }
                }}
              >
                {currentShift?.status === 'PAUSED' ? 'Resume Orders' : 'Pause Orders'}
              </Button>
            )}
            <Button
              variant={shiftActive ? 'destructive' : 'default'}
              size="lg"
              disabled={shiftLoading || endedShiftToday}
              onClick={() => {
                if (shiftActive) setConfirmEndShiftOpen(true);
                else void startShift();
              }}
              className={`shrink-0 gap-2 ${!shiftActive && !shiftLoading && !endedShiftToday ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}`}
            >
              {shiftLoading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : shiftActive ? (
                <Square className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {shiftLoading
                ? 'Please wait...'
                : shiftActive
                  ? 'End Shift'
                  : endedShiftToday
                    ? 'Start tomorrow'
                    : 'Start Shift'}
            </Button>
          </div>
        </div>

        {/* KPI Cards - same structure and font as admin dashboard */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
          <Card
            className={`min-w-0 ${shiftActive ? 'border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white' : 'border-emerald-100 bg-gradient-to-br from-emerald-50 to-white'}`}
          >
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">Shift Status</p>
                  <p
                    className={`truncate text-base font-bold sm:text-lg ${shiftActive ? 'text-emerald-700' : 'text-slate-700'}`}
                  >
                    {currentShift?.status === 'PAUSED'
                      ? 'Paused'
                      : shiftActive
                        ? 'Active'
                        : 'Inactive'}
                  </p>
                  {currentShift?.shiftStart && (
                    <p className="mt-0.5 text-xs">
                      <span className="text-muted-foreground">
                        Start:{' '}
                        {new Date(currentShift.shiftStart).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {' · '}
                      <span
                        className={
                          shiftActive ? 'font-semibold text-emerald-700' : 'text-muted-foreground'
                        }
                      >
                        {currentShift?.shiftStart
                          ? (() => {
                              const end =
                                currentShift.shiftEnd && currentShift.status === 'ENDED'
                                  ? new Date(currentShift.shiftEnd)
                                  : currentTime;
                              const ms =
                                end.getTime() - new Date(currentShift.shiftStart).getTime();
                              const totalMins = Math.max(0, Math.floor(ms / 60000));
                              const h = Math.floor(totalMins / 60);
                              const m = totalMins % 60;
                              const pad = (n: number) => n.toString().padStart(2, '0');
                              return `${pad(h)}:${pad(m)} hrs`;
                            })()
                          : '--:-- hrs'}
                      </span>
                    </p>
                  )}
                  {shiftActive &&
                    currentShift?.shiftStart &&
                    (() => {
                      const ms =
                        currentTime.getTime() - new Date(currentShift.shiftStart).getTime();
                      if (ms / (1000 * 60 * 60) > 10)
                        return (
                          <p className="mt-0.5 text-xs font-medium text-amber-600">Overtime</p>
                        );
                      return null;
                    })()}
                </div>
                <div className="shrink-0 rounded-md bg-emerald-100 p-1.5">
                  <Clock className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-blue-100 bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">Total Orders</p>
                  <p className="truncate text-base font-bold text-blue-700 sm:text-lg">
                    {todayStats.ordersToday}
                  </p>
                  <p className="text-muted-foreground text-xs">Today&apos;s orders</p>
                </div>
                <div className="shrink-0 rounded-md bg-blue-100 p-1.5">
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-green-100 bg-gradient-to-br from-green-50 to-white">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">Paid</p>
                  <p className="truncate text-base font-bold text-green-700 sm:text-lg">
                    {todayStats.completed}
                  </p>
                  <p className="text-muted-foreground text-xs">Paid orders today</p>
                </div>
                <div className="shrink-0 rounded-md bg-green-100 p-1.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-amber-100 bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">Pending Payment</p>
                  <p className="truncate text-base font-bold text-amber-700 sm:text-lg">
                    {todayStats.pendingPayments}
                  </p>
                  <p className="text-muted-foreground text-xs">Awaiting payment</p>
                </div>
                <div className="shrink-0 rounded-md bg-amber-100 p-1.5">
                  <CreditCard className="h-4 w-4 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">Sales</p>
                  <p className="truncate text-base font-bold text-emerald-700 sm:text-lg">
                    {formatINR(todayStats.salesToday)}
                  </p>
                  <p className="text-muted-foreground text-xs">Total collected</p>
                </div>
                <div className="shrink-0 rounded-md bg-emerald-100 p-1.5">
                  <IndianRupee className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-slate-100 bg-gradient-to-br from-slate-50 to-white">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">
                    Approved overtime ({myApprovedOvertime?.month ?? '—'})
                  </p>
                  <p className="truncate text-base font-bold text-slate-900 sm:text-lg">
                    {myApprovedOvertime
                      ? `${Number(myApprovedOvertime.approvedHours || 0).toFixed(2)}h`
                      : '0.00h'}
                  </p>
                  <p className="text-muted-foreground text-xs">After admin approval</p>
                </div>
                <div className="shrink-0 rounded-md bg-slate-100 p-1.5">
                  <Clock className="h-4 w-4 text-slate-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions - same card style as admin */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 md:grid-cols-3">
          <Card
            className="min-w-0 cursor-pointer border-blue-100 bg-gradient-to-br from-blue-50 to-white transition-colors hover:border-blue-200"
            onClick={() => setActiveSection('live')}
          >
            <CardContent className="flex items-center justify-between gap-2 p-2 sm:p-3">
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">Live Orders</p>
                <p className="text-base font-bold text-blue-700 sm:text-lg">
                  {liveOrders.length} active
                </p>
              </div>
              <div className="shrink-0 rounded-md bg-blue-100 p-1.5">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
              </div>
              <ArrowUpRight className="text-muted-foreground h-4 w-4 shrink-0" />
            </CardContent>
          </Card>

          <Card
            className="min-w-0 cursor-pointer border-amber-100 bg-gradient-to-br from-amber-50 to-white transition-colors hover:border-amber-200"
            onClick={() => setActiveSection('pending')}
          >
            <CardContent className="flex items-center justify-between gap-2 p-2 sm:p-3">
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">Pending Payments</p>
                <p className="text-base font-bold text-amber-700 sm:text-lg">
                  {pendingPayments.length} to collect
                </p>
              </div>
              <div className="shrink-0 rounded-md bg-amber-100 p-1.5">
                <CreditCard className="h-4 w-4 text-amber-600" />
              </div>
              <ArrowUpRight className="text-muted-foreground h-4 w-4 shrink-0" />
            </CardContent>
          </Card>

          <Card
            className="min-w-0 cursor-pointer border-emerald-100 bg-gradient-to-br from-emerald-50 to-white transition-colors hover:border-emerald-200"
            onClick={() => setActiveSection('shift')}
          >
            <CardContent className="flex items-center justify-between gap-2 p-2 sm:p-3">
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">My Shift</p>
                <p className="text-base font-bold text-emerald-700 sm:text-lg">View details</p>
              </div>
              <div className="shrink-0 rounded-md bg-emerald-100 p-1.5">
                <Clock className="h-4 w-4 text-emerald-600" />
              </div>
              <ArrowUpRight className="text-muted-foreground h-4 w-4 shrink-0" />
            </CardContent>
          </Card>

          <Card
            className="min-w-0 cursor-pointer border-indigo-100 bg-gradient-to-br from-indigo-50 to-white transition-colors hover:border-indigo-200"
            onClick={() => setActiveSection('leave')}
          >
            <CardContent className="flex items-center justify-between gap-2 p-2 sm:p-3">
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">Leave</p>
                <p className="text-base font-bold text-indigo-700 sm:text-lg">Apply / Track</p>
              </div>
              <div className="shrink-0 rounded-md bg-indigo-100 p-1.5">
                <CalendarDays className="h-4 w-4 text-indigo-600" />
              </div>
              <ArrowUpRight className="text-muted-foreground h-4 w-4 shrink-0" />
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders - same Card header style as admin */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Recent Orders</CardTitle>
            <CardDescription className="text-muted-foreground">
              Latest 5 orders · Tap to open
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentOrders.map(order => (
                <div
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openOrderPopup(order)}
                  onKeyDown={e => e.key === 'Enter' && openOrderPopup(order)}
                  className="flex cursor-pointer flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-emerald-300 hover:shadow-md sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-slate-700">
                      #{order.id}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        Table {order.table?.tableNumber ?? order.table?.id ?? '—'}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {(() => {
                          const n = filterOrderItemsForDisplay(order.items).length;
                          return `${n} ${n === 1 ? 'item' : 'items'}`;
                        })()}
                        {' · '}
                        {timeAgo(order.createdAt)}
                        {order.acceptedAt && order.completedAt && (
                          <span className="mt-0.5 block text-xs text-slate-600">
                            Time to complete:{' '}
                            {formatTimeToComplete(order.acceptedAt, order.completedAt)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
                    <Badge className={getStatusColor(order.status)} variant="secondary">
                      {order.status === 'ORDER_COMPLETE'
                        ? 'Complete'
                        : order.status.replace('_', ' ')}
                    </Badge>
                    <Badge
                      className={
                        order.paymentStatus === 'PAID'
                          ? 'border-green-300 bg-green-100 text-green-800'
                          : 'border-amber-300 bg-amber-100 text-amber-800'
                      }
                      variant="outline"
                    >
                      {order.paymentStatus === 'PAID' ? 'Paid' : 'Unpaid'}
                    </Badge>
                    <span className="font-bold whitespace-nowrap text-emerald-700">
                      {formatINR(order.totalAmount)}
                    </span>
                  </div>
                </div>
              ))}
              {recentOrders.length === 0 && (
                <div className="text-muted-foreground py-8 text-center">
                  <p className="font-medium">No orders yet</p>
                  <p className="mt-1 text-sm">
                    Orders will appear here when you have an active shift
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    ),
    [
      shiftActive,
      shiftLoading,
      currentShift,
      todayStats,
      liveOrders.length,
      pendingPayments.length,
      orders,
      token,
      apiBase,
      endShift,
      startShift,
      formatINR,
      getStatusColor,
      formatTimeToComplete,
      timeAgo,
      openOrderPopup,
    ]
  );

  const shiftSectionContent = useMemo(
    () => (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold sm:text-xl">My Shift</h2>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Track your shift and earnings
            </p>
          </div>
          <Button
            variant={shiftActive ? 'destructive' : 'default'}
            size="lg"
            disabled={shiftLoading}
            onClick={() => {
              if (shiftActive) setConfirmEndShiftOpen(true);
              else void startShift();
            }}
            className={`w-full shrink-0 gap-2 sm:w-auto ${!shiftActive && !shiftLoading ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}`}
          >
            {shiftLoading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : shiftActive ? (
              <Square className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {shiftLoading ? 'Please wait...' : shiftActive ? 'End Shift' : 'Start Shift'}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
          <Card className="min-w-0 border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">Shift Status</p>
                  <p
                    className={`truncate text-base font-bold sm:text-lg ${shiftActive ? 'text-emerald-700' : 'text-slate-700'}`}
                  >
                    {currentShift?.status === 'PAUSED'
                      ? 'Paused'
                      : shiftActive
                        ? 'Active'
                        : 'Inactive'}
                  </p>
                  {currentShift?.shiftStart && (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Start:{' '}
                      {new Date(currentShift.shiftStart).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                  {shiftActive && currentShift?.shiftStart && (
                    <>
                      <p className="mt-1 text-xs">
                        <span className="inline-block rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                          Live:{' '}
                          {(() => {
                            const ms =
                              currentTime.getTime() - new Date(currentShift.shiftStart).getTime();
                            const totalMins = Math.max(0, Math.floor(ms / 60000));
                            const h = Math.floor(totalMins / 60);
                            const m = totalMins % 60;
                            return `${h}h ${m}m`;
                          })()}
                        </span>
                      </p>
                      {(() => {
                        const ms =
                          currentTime.getTime() - new Date(currentShift.shiftStart).getTime();
                        if (ms / (1000 * 60 * 60) > 10)
                          return <p className="text-xs font-medium text-amber-600">Overtime</p>;
                        return null;
                      })()}
                    </>
                  )}
                  {shiftActive && (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (!token) return;
                          const endpoint = currentShift?.status === 'PAUSED' ? 'resume' : 'pause';
                          const res = await fetch(`${apiBase}/shift/${endpoint}`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          if (res.ok) {
                            const data = await res.json().catch(() => null);
                            if (data) setCurrentShift(prev => (prev ? { ...prev, ...data } : prev));
                            toast.success(
                              data?.message ||
                                (endpoint === 'pause' ? 'Status set to Paused.' : 'Back to Active.')
                            );
                          } else {
                            const err = await res.json().catch(() => ({}));
                            toast.error(err.message || 'Failed');
                          }
                        }}
                      >
                        {currentShift?.status === 'PAUSED' ? 'Resume' : 'Pause'}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="shrink-0 rounded-md bg-emerald-100 p-1.5">
                  <Clock className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-blue-100 bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">Orders Handled</p>
                  <p className="truncate text-base font-bold text-blue-700 sm:text-lg">
                    {currentShift?.ordersCount ?? 0}
                  </p>
                </div>
                <div className="shrink-0 rounded-md bg-blue-100 p-1.5">
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-green-100 bg-gradient-to-br from-green-50 to-white">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">Sales Collected</p>
                  <p className="truncate text-base font-bold text-green-700 sm:text-lg">
                    {formatINR(todayStats.salesToday)}
                  </p>
                </div>
                <div className="shrink-0 rounded-md bg-green-100 p-1.5">
                  <IndianRupee className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Shift History</CardTitle>
            <CardDescription className="text-muted-foreground">
              Your recent shifts and hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            {myDailyShiftStats.length > 0 && (
              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {myDailyShiftStats.slice(0, 6).map(d => {
                  const isToday = isSameDay(d.date, new Date().toISOString());
                  const activeShiftToday =
                    isToday &&
                    currentShift &&
                    !currentShift.shiftEnd &&
                    isSameDay(currentShift.shiftStart, new Date().toISOString());
                  const displayHours = activeShiftToday
                    ? getElapsedHours(currentShift!.shiftStart, currentShift!.shiftEnd, currentTime)
                    : d.totalHours;
                  return (
                    <div key={d.date} className="rounded-lg border bg-white p-3 text-sm">
                      <p className="font-medium">{new Date(d.date).toLocaleDateString('en-IN')}</p>
                      <p className="text-muted-foreground">
                        Hours: {formatHours(displayHours, activeShiftToday)}
                      </p>
                      <p className="text-muted-foreground">Shifts: {d.shifts}</p>
                    </div>
                  );
                })}
              </div>
            )}
            {myShiftHistory.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">No shift history yet</p>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="space-y-2 md:hidden">
                  {myShiftHistory.slice(0, 20).map(s => {
                    const isActive = !s.shiftEnd;
                    const hours = isActive
                      ? getElapsedHours(s.shiftStart, s.shiftEnd, currentTime)
                      : (s.totalHours ?? 0);
                    return (
                      <div
                        key={s.id}
                        className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border bg-slate-50/50 p-3 text-sm"
                      >
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-medium">
                          {new Date(s.shiftStart).toLocaleDateString('en-IN')}
                        </span>
                        <span className="text-muted-foreground">In</span>
                        <span>
                          {new Date(s.shiftStart).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="text-muted-foreground">Out</span>
                        <span>
                          {s.shiftEnd
                            ? new Date(s.shiftEnd).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </span>
                        <span className="text-muted-foreground">Hours</span>
                        <span className="font-medium">{formatHours(hours, isActive)}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop: table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        <th className="p-2 font-medium">Date</th>
                        <th className="p-2 font-medium">In</th>
                        <th className="p-2 font-medium">Out</th>
                        <th className="p-2 text-right font-medium">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myShiftHistory.slice(0, 20).map(s => {
                        const isActive = !s.shiftEnd;
                        const hours = isActive
                          ? getElapsedHours(s.shiftStart, s.shiftEnd, currentTime)
                          : (s.totalHours ?? 0);
                        return (
                          <tr key={s.id} className="border-b last:border-b-0">
                            <td className="p-2">
                              {new Date(s.shiftStart).toLocaleDateString('en-IN')}
                            </td>
                            <td className="p-2">
                              {new Date(s.shiftStart).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="p-2">
                              {s.shiftEnd
                                ? new Date(s.shiftEnd).toLocaleTimeString('en-IN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </td>
                            <td className="p-2 text-right font-medium">
                              {formatHours(hours, isActive)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    ),
    [
      shiftActive,
      shiftLoading,
      currentShift,
      currentTime,
      token,
      apiBase,
      endShift,
      startShift,
      todayStats.salesToday,
      myDailyShiftStats,
      myShiftHistory,
      formatINR,
    ]
  );

  const profileSectionContent = useMemo(
    () => (
      <div className="space-y-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold sm:text-xl">My Profile</h2>
          <p className="text-muted-foreground text-xs sm:text-sm">Your account details</p>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                <AvatarFallback className="bg-emerald-100 text-xl text-emerald-600 sm:text-2xl">
                  {profile?.name?.charAt(0) ?? 'E'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <CardTitle className="text-lg">{profile?.name ?? 'Employee'}</CardTitle>
                <CardDescription>{profile?.employeeCode ?? '—'}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Separator className="mb-4" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs">Email</p>
                <p className="text-sm font-medium">{profile?.email ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Employee Code</p>
                <p className="text-sm font-medium">{profile?.employeeCode ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Branch</p>
                <p className="text-sm font-medium">{profile?.branch?.name ?? '—'}</p>
              </div>
              {profile?.phone && (
                <div>
                  <p className="text-muted-foreground text-xs">Mobile</p>
                  <p className="text-sm font-medium">{profile.phone}</p>
                </div>
              )}
              {profile?.address && (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground text-xs">Address</p>
                  <p className="text-sm font-medium">
                    {profile.address}
                    {profile.pincode ? ` - ${profile.pincode}` : ''}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    ),
    [profile]
  );

  const leaveSectionContent = useMemo(() => {
    const minDate = getLeaveMinDate(leaveType);
    const leaveTypeHint =
      leaveType === 'SICK'
        ? 'Same-day and future dates allowed.'
        : leaveType === 'CASUAL'
          ? 'Apply at least 2 days in advance.'
          : 'Apply at least 15 days in advance.';
    return (
      <div className="space-y-5">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight">Leave Management</h2>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Submit leave requests as per policy. All requests need admin approval.
          </p>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Apply Leave</CardTitle>
            <CardDescription>
              Sick: same day/future | Casual: 2 days advance | Paid: 15 days advance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-4">
              <div>
                <Label className="mb-1.5 block">Employee</Label>
                <Select value="self" disabled>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        profile?.name
                          ? `${profile.name} · ${profile.email || '—'} · ${profile.phone || 'No phone'}`
                          : 'Loading employee...'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">
                      {profile?.name
                        ? `${profile.name} · ${profile.email || '—'} · ${profile.phone || 'No phone'}`
                        : 'Current employee'}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground mt-1 text-xs">
                  Applying as current logged-in employee
                </p>
              </div>
              <div>
                <Label className="mb-1.5 block">Leave Type</Label>
                <Select
                  value={leaveType}
                  onValueChange={v =>
                    setLeaveType(v === 'SICK' || v === 'CASUAL' || v === 'PAID' ? v : 'CASUAL')
                  }
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SICK">Sick Leave</SelectItem>
                    <SelectItem value="CASUAL">Casual Leave</SelectItem>
                    <SelectItem value="PAID">Paid Leave</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground mt-1 text-xs">{leaveTypeHint}</p>
              </div>
              <div>
                <Label className="mb-1.5 block">Start Date</Label>
                <Input
                  type="date"
                  value={leaveStartDate}
                  min={minDate}
                  className="min-h-[44px]"
                  onChange={e => {
                    setLeaveStartDate(e.target.value);
                    if (leaveEndDate && e.target.value && leaveEndDate < e.target.value) {
                      setLeaveEndDate(e.target.value);
                    }
                  }}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">End Date</Label>
                <Input
                  type="date"
                  value={leaveEndDate}
                  min={leaveStartDate || minDate}
                  className="min-h-[44px]"
                  onChange={e => setLeaveEndDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Reason (optional)</Label>
              <Textarea
                value={leaveReason}
                onChange={e => setLeaveReason(e.target.value)}
                placeholder="Explain briefly (e.g., fever / personal work)"
                rows={3}
              />
            </div>
            {hasLeaveOverlap ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Selected dates overlap with an existing leave request.
              </p>
            ) : null}
            <div className="flex justify-end">
              <LoaderButton
                loading={leaveSubmitting}
                loadingLabel="Submitting..."
                onClick={applyLeave}
                disabled={!leaveStartDate || !leaveEndDate || hasLeaveOverlap}
                className="min-h-[44px] w-full sm:w-auto"
              >
                Submit Leave Request
              </LoaderButton>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-slate-50/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">📝 Leave Policy Guidelines</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm text-slate-700 md:grid-cols-2">
            <div className="rounded-lg border bg-white p-3">
              <p className="font-semibold">Sick Leave</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Same day and future dates are allowed.
              </p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="font-semibold">Casual Leave</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Must be applied at least 2 days in advance.
              </p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="font-semibold">Paid Leave</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Must be applied at least 15 days in advance.
              </p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="font-semibold">General Rules</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Admin approval required. Invalid/restricted and overlapping dates are not allowed.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">My Leave History</CardTitle>
            <CardDescription>All requests and statuses.</CardDescription>
          </CardHeader>
          <CardContent>
            {leaveLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : myLeaves.length === 0 ? (
              <p className="text-muted-foreground text-sm">No leave requests yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myLeaves.map(l => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <Badge variant="outline">{l.leaveType}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(l.startDate).toLocaleDateString('en-IN')} to{' '}
                          {new Date(l.endDate).toLocaleDateString('en-IN')}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              l.status === 'APPROVED'
                                ? 'default'
                                : l.status === 'REJECTED'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {l.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {l.adminRemarks || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }, [
    profile,
    leaveType,
    myLeaves,
    leaveLoading,
    leaveSubmitting,
    leaveStartDate,
    leaveEndDate,
    leaveReason,
    hasLeaveOverlap,
  ]);

  const StartShiftPromptDialog = () => (
    <Dialog
      open={showStartShiftPrompt}
      onOpenChange={open => {
        setShowStartShiftPrompt(open);
        if (!open)
          window.sessionStorage.setItem(
            'dm_shift_prompt_dismissed_' + new Date().toISOString().slice(0, 10),
            '1'
          );
      }}
    >
      <DialogContent
        className="max-w-md"
        aria-describedby="start-shift-desc"
        aria-label="Start shift"
      >
        <DialogHeader>
          <DialogTitle id="start-shift-title">Start shift?</DialogTitle>
          <DialogDescription id="start-shift-desc">
            {endedShiftToday
              ? 'You already completed a shift today. You can start again tomorrow.'
              : 'To accept orders and track working time, please start your shift.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              window.sessionStorage.setItem(
                'dm_shift_prompt_dismissed_' + new Date().toISOString().slice(0, 10),
                '1'
              );
              setShowStartShiftPrompt(false);
            }}
          >
            {endedShiftToday ? 'Close' : 'Not now'}
          </Button>
          {!endedShiftToday && (
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={async () => {
                await startShift();
                setShowStartShiftPrompt(false);
              }}
            >
              Start Shift
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  // New order notification popup – stable time (no "X mins ago") so cards don't flash when clock ticks
  const newOrderPopupCards = useMemo(
    () =>
      newOrderPopupOrders.map(order => (
        <div
          key={order.id}
          className="rounded-lg border-2 border-emerald-200 bg-emerald-50/50 p-3 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">
              Table {order.table?.tableNumber || order.table?.id || '?'}
            </span>
            <Badge className={getPriorityBadgeClass(order)}>{getPriorityLabel(order)}</Badge>
          </div>
          <p className="text-muted-foreground mt-0.5">
            Order #{order.id} · {formatPopupTime(order.createdAt)}
          </p>
          <ul className="mt-2 space-y-0.5 font-medium text-slate-800">
            {filterOrderItemsForDisplay(order.items)
              .filter(i => !i.isRemoved)
              .map(item => (
                <li key={item.id}>
                  {item.quantity}× {formatItemDisplayName(item.name, item.variant)}
                </li>
              ))}
          </ul>
          <p className="mt-2 font-bold text-emerald-700">{formatINR(order.totalAmount)}</p>
        </div>
      )),
    [newOrderPopupOrders]
  );

  const NewOrderPopupDialog = () => {
    if (newOrderPopupOrders.length === 0) return null;
    
    const handleAcceptOrder = async (orderId: number) => {
      await acceptOrder(orderId);
    };
    
    const handleRejectOrder = async (orderId: number) => {
      await rejectOrder(orderId);
    };

    const handleViewOrder = (order: Order) => {
      openOrderPopup(order);
      setNewOrderPopupOrders([]);
    };

    const handleAddMoreItems = (order: Order) => {
      openOrderPopup(order);
      setNewOrderPopupOrders([]);
    };

    const handleModifyOrder = (order: Order) => {
      openOrderPopup(order);
      setNewOrderPopupOrders([]);
    };
    
    return (
      <Dialog
        open={newOrderPopupOrders.length > 0}
        onOpenChange={open => {
          if (!open) setNewOrderPopupOrders([]);
        }}
      >
        <DialogContent className="max-w-md" aria-describedby="new-order-popup-desc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              New order(s) received
            </DialogTitle>
            <DialogDescription id="new-order-popup-desc">
              {newOrderPopupOrders.length} new order
              {newOrderPopupOrders.length !== 1 ? 's' : ''} need your attention.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[280px] pr-2">
            <div className="space-y-3">
              {newOrderPopupOrders.map(order => (
                <div key={order.id} className="rounded-lg border-2 border-emerald-200 bg-emerald-50/50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      Table {order.table?.tableNumber || order.table?.id || '?'}
                    </span>
                    <Badge className={getPriorityBadgeClass(order)}>{getPriorityLabel(order)}</Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5">
                    Order #{order.id} · {formatPopupTime(order.createdAt)}
                  </p>
                  <ul className="mt-2 space-y-0.5 font-medium text-slate-800">
                    {filterOrderItemsForDisplay(order.items)
                      .filter(i => !i.isRemoved)
                      .map(item => (
                        <li key={item.id}>
                          {item.quantity}× {formatItemDisplayName(item.name, item.variant)}
                        </li>
                      ))}
                  </ul>
                  <p className="mt-2 font-bold text-emerald-700">{formatINR(order.totalAmount)}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => handleViewOrder(order)}
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => handleAddMoreItems(order)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add more items
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => handleModifyOrder(order)}
                    >
                      <Edit2 className="mr-1 h-3 w-3" />
                      Modify
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 text-xs text-white hover:bg-green-700"
                      disabled={acceptingOrderId === order.id}
                      onClick={() => handleAcceptOrder(order.id)}
                    >
                      {acceptingOrderId === order.id ? (
                        <>
                          <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Accepting...
                        </>
                      ) : (
                        <>Accept</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={acceptingOrderId === order.id}
                      onClick={() => handleRejectOrder(order.id)}
                    >
                      <XCircle className="mr-1 h-3 w-3" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setNewOrderPopupOrders([])}>
              Dismiss
            </Button>
            <Button
              onClick={() => {
                setActiveSection('live');
                setNewOrderPopupOrders([]);
              }}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              View Live Orders
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Frozen snapshot for dialog – same reference while popup is open so memoized OrderPopupDialogView doesn't re-render on poll
  const orderPopupDisplayOrder = useMemo(
    () => popupDisplayOrder ?? selectedOrder ?? null,
    [popupDisplayOrder, selectedOrder]
  );

  const handleOrderPopupOpenChange = useCallback((open: boolean) => {
    setIsOrderPopupOpen(open);
    if (!open) {
      setPopupDisplayOrder(null);
      setSelectedOrder(null);
    }
  }, []);

  // Memoize table sections so cards don't flash when only clock/poll updates (same deps as live section)
  const completedSectionContent = useMemo(
    () => (
      <OrdersTableSection
        orders={completedOrders}
        title="Completed (Unpaid)"
        loading={ordersSnapshotLoading}
        showConfirmPayment={true}
        onViewOrder={openOrderPopup}
        onConfirmPayment={confirmPayment}
        actionOrderId={actionOrderId}
        formatINR={formatINR}
        getStatusColor={getStatusColor}
        formatTimeToComplete={formatTimeToComplete}
      />
    ),
    [
      completedOrders,
      ordersSnapshotLoading,
      actionOrderId,
      openOrderPopup,
      confirmPayment,
      formatINR,
      getStatusColor,
      formatTimeToComplete,
    ]
  );
  const pendingSectionContent = useMemo(
    () => (
      <OrdersTableSection
        orders={pendingPayments}
        title="Pending Payments"
        loading={ordersSnapshotLoading}
        showConfirmPayment={true}
        onViewOrder={openOrderPopup}
        onConfirmPayment={confirmPayment}
        actionOrderId={actionOrderId}
        formatINR={formatINR}
        getStatusColor={getStatusColor}
        formatTimeToComplete={formatTimeToComplete}
      />
    ),
    [
      pendingPayments,
      ordersSnapshotLoading,
      actionOrderId,
      openOrderPopup,
      confirmPayment,
      formatINR,
      getStatusColor,
      formatTimeToComplete,
    ]
  );
  const paidSectionContent = useMemo(
    () => (
      <OrdersTableSection
        orders={paidOrders}
        title="Paid & Pending Orders"
        loading={ordersSnapshotLoading}
        showConfirmPayment={true}
        onViewOrder={openOrderPopup}
        onConfirmPayment={confirmPayment}
        actionOrderId={actionOrderId}
        formatINR={formatINR}
        getStatusColor={getStatusColor}
        formatTimeToComplete={formatTimeToComplete}
      />
    ),
    [
      paidOrders,
      ordersSnapshotLoading,
      actionOrderId,
      openOrderPopup,
      confirmPayment,
      formatINR,
      getStatusColor,
      formatTimeToComplete,
    ]
  );

  // Memoize entire content tree so cards do NOT re-render when only clock/other unrelated state updates
  const content = useMemo(
    () => (
      <div className="animate-fade-in relative min-h-full w-full space-y-4 p-3 sm:space-y-6 sm:p-4 md:p-6">
        {activeSection === 'dashboard' && dashboardOverviewContent}
        {activeSection === 'live' && liveOrdersSectionContent}
        {activeSection === 'add-order' && (
          <AddOrderSection
            branchId={profile?.branchId ?? profile?.branch?.id}
            token={token}
            onOrderPlaced={orderId => {
              // Navigate to live orders after placing
              setTimeout(() => setActiveSection('live'), 1500);
            }}
          />
        )}
        {activeSection === 'all-orders' && (
          <OrdersTableSection
            orders={allOrders}
            title="All Orders"
            loading={ordersSnapshotLoading}
            showConfirmPayment={true}
            onViewOrder={openOrderPopup}
            onConfirmPayment={confirmPayment}
            actionOrderId={actionOrderId}
            formatINR={formatINR}
            getStatusColor={getStatusColor}
            formatTimeToComplete={formatTimeToComplete}
          />
        )}
        {activeSection === 'paid' && paidSectionContent}
        {activeSection === 'shift' && shiftSectionContent}
        {activeSection === 'leave' && leaveSectionContent}
        {activeSection === 'profile' && profileSectionContent}
      </div>
    ),
    [
      activeSection,
      dashboardOverviewContent,
      liveOrdersSectionContent,
      profile,
      token,
      setActiveSection,
      allOrders,
      paidSectionContent,
      shiftSectionContent,
      leaveSectionContent,
      profileSectionContent,
      ordersSnapshotLoading,
      openOrderPopup,
      confirmPayment,
      actionOrderId,
      formatINR,
      getStatusColor,
      formatTimeToComplete,
    ]
  );

  const companyLogoUrl =
    typeof window !== 'undefined' ? window.localStorage.getItem('branch_logo_url') : null;

  return (
    <DashboardShell
      role="EMPLOYEE"
      userName={profile?.name ?? 'Employee'}
      branchName={
        profile?.branch?.name && !/^main(\s+branch)?$/i.test(profile.branch.name.trim())
          ? profile.branch.name.trim()
          : 'Gautam Nagar'
      }
      sidebarItems={sidebarItems}
      activeKey={activeSection}
      onSelect={setActiveSection}
      sidebarBadges={liveOrders.length > 0 ? { live: liveOrders.length } : undefined}
      companyLogoUrl={companyLogoUrl || undefined}
    >
      <div className="relative">{content}</div>
      <NewOrderPopupDialog />
      <StartShiftPromptDialog />
      <OrderPopupDialogView
        displayOrder={orderPopupDisplayOrder}
        isOpen={isOrderPopupOpen}
        onOpenChange={handleOrderPopupOpenChange}
        popupCustomerName={popupCustomerName}
        setPopupCustomerName={setPopupCustomerName}
        popupCustomerMobile={popupCustomerMobile}
        setPopupCustomerMobile={setPopupCustomerMobile}
        savingCustomer={savingCustomer}
        saveOrderCustomer={saveOrderCustomer}
        removedItemIds={removedItemIds}
        toggleItemRemoval={toggleItemRemoval}
        modificationReason={modificationReason}
        setModificationReason={setModificationReason}
        addItemsSearchQuery={addItemsSearchQuery}
        setAddItemsSearchQuery={setAddItemsSearchQuery}
        menuCategories={menuCategoriesForEdits}
        menuLoading={menuLoadingForEdits}
        addedItemsCart={addedItemsCart}
        addItemToCart={addItemToCart}
        updateAddedItemQty={updateAddedItemQty}
        pendingQtyByOrderItemId={pendingQtyByOrderItemId}
        setPendingQtyByOrderItemId={setPendingQtyByOrderItemId}
        markStatus={markStatus}
        acceptOrder={acceptOrder}
        rejectOrder={rejectOrder}
        applyOrderPayment={applyOrderPayment}
        modifyOrder={modifyOrder}
        isModifying={isModifying}
        actionOrderId={actionOrderId}
        acceptingOrderId={acceptingOrderId}
        selectedOrder={selectedOrder}
      />
      <Dialog open={confirmEndShiftOpen} onOpenChange={setConfirmEndShiftOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>End shift?</DialogTitle>
            <DialogDescription>
              This will end your active shift. Any in-progress order assignments will be cleared so
              other staff can continue.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setConfirmEndShiftOpen(false)}
              disabled={shiftLoading}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void endShift()} disabled={shiftLoading}>
              {shiftLoading ? 'Ending...' : 'End Shift'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
};

export default EmployeeDashboard;
