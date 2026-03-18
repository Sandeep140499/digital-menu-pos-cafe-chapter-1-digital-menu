import { useEffect, useMemo, useState, useRef, useCallback, memo } from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Clock,
  ShoppingCart,
  CheckCircle,
  CreditCard,
  User,
  ChefHat,
  Bell,
  MoreHorizontal,
  ArrowUpRight,
  IndianRupee,
  RefreshCw,
  Play,
  Square,
  Utensils,
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
  Loader2,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoaderButton } from "@/components/shared/LoaderButton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHours } from "@/utils/timeFormatter";
import {
  API_BASE_URL,
  fetchWithTimeout,
  ORDER_STATUS_COLORS,
  BREAK_TIME_MINUTES,
  formatBreakTime,
} from "@/constants";
import { useGlobalLoading } from "@/components/GlobalLoadingProvider";

const apiBase = API_BASE_URL;

/** Delay threshold for \"Delayed\" order (ms). Business requirement: 30 minutes from acceptance. */
const DELAYED_ORDER_MINUTES = 30;
const DELAYED_ORDER_MS = DELAYED_ORDER_MINUTES * 60 * 1000;

// INR Currency formatter
const formatINR = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/** "1 min ago", "5 mins ago", "Just now" */
function timeAgo(createdAt: string): string {
  const sec = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min === 1) return "1 min ago";
  if (min < 60) return `${min} mins ago`;
  const hr = Math.floor(min / 60);
  return hr === 1 ? "1 hr ago" : `${hr} hrs ago`;
}

/** Static time for popups so content doesn't change every second (stops flashing). */
function formatPopupTime(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
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
  asOf: Date,
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
  const raw = name || "";
  const isPc = /\(\s*5pc\s*\/\s*8pc\s*\)/i.test(raw);
  const base =
    raw
      .replace(/\s*\(5pc\s*\/\s*8pc\)\s*/gi, " ")
      .replace(/\s*\(half\s*\/\s*full\)\s*/gi, " ")
      .replace(/\s+/g, " ")
      .trim() || raw;
  if (!variant) return base;
  if (variant === "HALF") return `${base} (${isPc ? "5pc" : "Half"})`;
  if (variant === "FULL") return `${base} (${isPc ? "8pc" : "Full"})`;
  return `${base} (${variant})`;
}

/** Format duration in ms as "X min" or "X hr Y min" for time-to-complete display. */
function formatTimeToComplete(acceptedAt: string, completedAt: string): string {
  const ms = new Date(completedAt).getTime() - new Date(acceptedAt).getTime();
  if (ms < 0) return "—";
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
    if (typeof window === "undefined") return null;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
    if (sharedAudioCtx.state === "suspended") {
      await sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

type NewOrderSoundPreset = "beep" | "ring" | "siren" | "chime";

const NEW_ORDER_SOUND_PRESET_KEY = "dm_new_order_sound_preset";
const NEW_ORDER_SOUND_VOLUME_KEY = "dm_new_order_sound_volume";

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
  const { ctx, at, freq, durationMs, volume, type = "sine" } = params;
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
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    at + Math.max(attack + release, dur),
  );
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function playSiren(params: { ctx: AudioContext; at: number; volume: number }) {
  const { ctx, at, volume } = params;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sawtooth";
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
    .then((ctx) => {
      if (!ctx) return;
      const selectedPreset: NewOrderSoundPreset =
        preset ||
        ((window?.localStorage?.getItem(
          NEW_ORDER_SOUND_PRESET_KEY,
        ) as NewOrderSoundPreset | null) ??
          "ring");
      const volRaw = volume ?? Number(window?.localStorage?.getItem(NEW_ORDER_SOUND_VOLUME_KEY) ?? "0.85");
      const vol = clamp01(volRaw);

      const t = ctx.currentTime;
      const loud = Math.max(0.15, vol); // keep minimum audible

      if (selectedPreset === "beep") {
        playTone({ ctx, at: t, freq: 880, durationMs: 220, volume: loud, type: "sine" });
        return;
      }

      if (selectedPreset === "ring") {
        // Classic noisy ring: two quick beeps, slight pitch drop, repeated once.
        playTone({ ctx, at: t, freq: 1050, durationMs: 140, volume: loud, type: "square" });
        playTone({ ctx, at: t + 0.16, freq: 850, durationMs: 140, volume: loud, type: "square" });
        playTone({ ctx, at: t + 0.40, freq: 1050, durationMs: 140, volume: loud, type: "square" });
        playTone({ ctx, at: t + 0.56, freq: 850, durationMs: 140, volume: loud, type: "square" });
        return;
      }

      if (selectedPreset === "chime") {
        // Pleasant but audible 3-tone chime.
        playTone({ ctx, at: t, freq: 1046, durationMs: 140, volume: loud * 0.95, type: "sine" });
        playTone({ ctx, at: t + 0.16, freq: 1318, durationMs: 140, volume: loud * 0.9, type: "sine" });
        playTone({ ctx, at: t + 0.32, freq: 1567, durationMs: 180, volume: loud * 0.85, type: "sine" });
        return;
      }

      // siren (very noticeable)
      playSiren({ ctx, at: t, volume: loud });
    })
    .catch(() => {});
}

function notifyNewOrders(count: number) {
  try {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    // Only notify when tab is not visible to avoid noisy duplicates.
    if (!document.hidden) return;
    const title = "New order received";
    const body =
      count === 1
        ? "1 new order needs your attention."
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
  orderType?: "DINE_IN" | "TAKE_AWAY" | null;
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
};

const sidebarItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "live", label: "Live Orders", icon: ShoppingCart },
  { key: "add-order", label: "Add Order", icon: Plus },
  { key: "all-orders", label: "All Orders", icon: ShoppingCart },
  { key: "completed", label: "Completed", icon: CheckCircle },
  { key: "pending", label: "Pending Payment", icon: CreditCard },
  { key: "performance", label: "Performance", icon: Bell },
  { key: "shift", label: "My Shift", icon: Clock },
  { key: "profile", label: "Profile", icon: User },
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
  markStatus: (orderId: number, status: string) => void;
  confirmPayment: (orderId: number) => void;
  modifyOrder: () => void;
  isModifying: boolean;
  actionOrderId: number | null;
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
    markStatus,
    confirmPayment,
    modifyOrder,
    isModifying,
    actionOrderId,
    selectedOrder,
  } = props;

  if (!displayOrder) return null;

  const isCompletedViewOnly = displayOrder.status === "ORDER_COMPLETE";
  const calculateNewTotal = () => {
    const removedTotal = displayOrder.items
      .filter((item) => removedItemIds.includes(item.id))
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
    return displayOrder.totalAmount - removedTotal;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="max-w-2xl max-h-[80vh] overflow-y-auto p-4 sm:p-6 w-[calc(100%-2rem)] sm:w-full max-sm:fixed max-sm:inset-2 max-sm:max-h-[calc(100vh-1rem)] max-sm:rounded-xl max-sm:left-4 max-sm:right-4 max-sm:top-4 max-sm:bottom-4 max-sm:translate-x-0 max-sm:translate-y-0"
        aria-describedby="order-popup-desc"
      >
        <DialogTitle className="sr-only">Order #{displayOrder.id}</DialogTitle>
        <DialogDescription id="order-popup-desc" className="sr-only">
          View order details, items, and customer information. Edit customer
          name and mobile for WhatsApp updates.
        </DialogDescription>
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Order #{displayOrder.id}
            </h2>
            <p className="text-lg font-semibold text-muted-foreground mt-0.5">
              Table{" "}
              {displayOrder.table?.tableNumber || displayOrder.table?.id || "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {displayOrder.branch?.name && (
                <span>{displayOrder.branch.name}</span>
              )}
              {displayOrder.branch?.name && " · "}
              {formatPopupTime(displayOrder.createdAt)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 min-h-[44px] min-w-[44px]"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        {displayOrder.employee && (
          <p className="text-xs text-muted-foreground mb-3">
            Accepted by {displayOrder.employee.name}
            {displayOrder.employee.role
              ? ` (${displayOrder.employee.role})`
              : ""}
          </p>
        )}

        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <h4 className="font-medium text-sm">Customer</h4>
          {isCompletedViewOnly ? (
            <div className="text-sm flex flex-wrap items-center gap-x-4 gap-y-0">
              <span className="font-medium text-foreground">
                {displayOrder.customerName ?? "—"}
              </span>
              {displayOrder.customerMobile && (
                <span className="text-muted-foreground">
                  📞 {displayOrder.customerMobile}
                </span>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    placeholder="Customer name"
                    value={popupCustomerName}
                    onChange={(e) => setPopupCustomerName(e.target.value)}
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
                    onChange={(e) =>
                      setPopupCustomerMobile(
                        e.target.value.replace(/\D/g, "").slice(0, 10),
                      )
                    }
                    className="mt-1"
                  />
                </div>
              </div>
              {(!displayOrder.customerMobile ||
                popupCustomerMobile !== displayOrder.customerMobile ||
                popupCustomerName !== (displayOrder.customerName ?? "")) && (
                <Button
                  size="sm"
                  disabled={
                    savingCustomer ||
                    popupCustomerMobile.replace(/\D/g, "").length !== 10
                  }
                  onClick={saveOrderCustomer}
                >
                  {savingCustomer ? "Saving..." : "Save customer"}
                </Button>
              )}
              {!displayOrder.customerMobile && (
                <p className="text-xs text-amber-600">
                  Save mobile to send order details, payment status & review
                  link via WhatsApp.
                </p>
              )}
            </>
          )}
        </div>

        <div className="space-y-6">
          {!isCompletedViewOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={
                  displayOrder.status === "ACCEPTED" ? "default" : "outline"
                }
                className={
                  ["PREPARING", "SERVED", "ORDER_COMPLETE"].includes(
                    displayOrder.status,
                  )
                    ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-100"
                    : ""
                }
                onClick={() =>
                  selectedOrder && markStatus(selectedOrder.id, "ACCEPTED")
                }
                disabled={
                  displayOrder.status === "ORDER_COMPLETE" ||
                  (selectedOrder && actionOrderId === selectedOrder.id)
                }
              >
                {selectedOrder && actionOrderId === selectedOrder.id ? (
                  <span className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                ) : (
                  <CheckCircle className="mr-1 h-4 w-4" />
                )}
                Accept
              </Button>
              <Button
                size="sm"
                variant={
                  displayOrder.status === "PREPARING" ? "default" : "outline"
                }
                className={
                  ["SERVED", "ORDER_COMPLETE"].includes(displayOrder.status)
                    ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-100"
                    : ""
                }
                onClick={() =>
                  selectedOrder && markStatus(selectedOrder.id, "PREPARING")
                }
                disabled={
                  displayOrder.status === "ORDER_COMPLETE" ||
                  displayOrder.status === "NEW_ORDER" ||
                  (selectedOrder && actionOrderId === selectedOrder.id)
                }
              >
                <ChefHat className="mr-1 h-4 w-4" />
                Preparing
              </Button>
              <Button
                size="sm"
                variant={
                  displayOrder.status === "SERVED" ? "default" : "outline"
                }
                className={
                  displayOrder.status === "ORDER_COMPLETE"
                    ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-100"
                    : ""
                }
                onClick={() =>
                  selectedOrder && markStatus(selectedOrder.id, "SERVED")
                }
                disabled={
                  displayOrder.status === "ORDER_COMPLETE" ||
                  displayOrder.status === "NEW_ORDER" ||
                  displayOrder.status === "ACCEPTED" ||
                  (selectedOrder && actionOrderId === selectedOrder.id)
                }
              >
                <Utensils className="mr-1 h-4 w-4" />
                Served
              </Button>
              <Button
                size="sm"
                variant={
                  displayOrder.status === "ORDER_COMPLETE"
                    ? "default"
                    : "outline"
                }
                className={
                  displayOrder.status === "ORDER_COMPLETE"
                    ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-100"
                    : ""
                }
                onClick={() =>
                  selectedOrder &&
                  markStatus(selectedOrder.id, "ORDER_COMPLETE")
                }
                disabled={
                  selectedOrder ? actionOrderId === selectedOrder.id : true
                }
              >
                <CheckCircle className="mr-1 h-4 w-4" />
                Complete
              </Button>
              <div className="flex-1 min-w-[60px]" />
              <Button
                size="sm"
                variant="destructive"
                onClick={() =>
                  selectedOrder && markStatus(selectedOrder.id, "CANCELLED")
                }
                disabled={
                  displayOrder.status === "ORDER_COMPLETE" ||
                  (selectedOrder && actionOrderId === selectedOrder.id)
                }
              >
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}

          {displayOrder.status === "ORDER_COMPLETE" && (
            <div className="space-y-2">
              <span className="font-medium">Payment</span>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-muted/30 rounded-lg">
                <Badge
                  className={
                    displayOrder.paymentStatus === "PAID"
                      ? "bg-green-100 text-green-800 border-green-300 w-fit"
                      : "bg-amber-100 text-amber-800 border-amber-300 w-fit"
                  }
                >
                  {displayOrder.paymentStatus === "PAID" ? "Paid" : "Pending"}
                </Badge>
                {displayOrder.paymentStatus !== "PAID" && selectedOrder && (
                  <Button
                    className="w-full min-h-[48px] rounded-lg sm:w-auto bg-emerald-600 hover:bg-emerald-700"
                    disabled={actionOrderId === selectedOrder.id}
                    onClick={() => confirmPayment(selectedOrder.id)}
                  >
                    {actionOrderId === selectedOrder.id ? (
                      <span className="inline-block h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <CreditCard className="mr-2 h-5 w-5" />
                    )}
                    Mark Paid
                  </Button>
                )}
              </div>
            </div>
          )}

          <div>
            <h4 className="font-medium mb-3">Order Items</h4>
            <div className="space-y-2">
              {displayOrder.items.filter((i) => !i.isRemoved).map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    !isCompletedViewOnly && removedItemIds.includes(item.id)
                      ? "opacity-50 bg-red-50"
                      : ""
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
                        {item.quantity} ×{" "}
                        {formatItemDisplayName(item.name, item.variant)}
                      </p>
                      {!isCompletedViewOnly &&
                        removedItemIds.includes(item.id) && (
                          <p className="text-sm text-red-600">
                            Will be removed
                          </p>
                        )}
                    </div>
                  </div>
                  <span className="font-medium">{formatINR(item.price)}</span>
                </div>
              ))}
            </div>
          </div>

          {!isCompletedViewOnly && (
            <>
              {removedItemIds.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Removal Reason
                  </label>
                  <Textarea
                    value={modificationReason}
                    onChange={(e) => setModificationReason(e.target.value)}
                    placeholder="Reason for removing items..."
                    className="min-h-[80px]"
                  />
                </div>
              )}
              <div className="border-t pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Original Total:</span>
                    <span className="font-medium">
                      {formatINR(displayOrder.totalAmount)}
                    </span>
                  </div>
                  {removedItemIds.length > 0 && (
                    <>
                      <div className="flex justify-between text-red-600">
                        <span>Items to Remove:</span>
                        <span className="font-medium">
                          -
                          {formatINR(
                            displayOrder.items
                              .filter((item) =>
                                removedItemIds.includes(item.id),
                              )
                              .reduce(
                                (sum, item) => sum + item.price * item.quantity,
                                0,
                              ),
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-lg font-bold">
                        <span>New Total:</span>
                        <span>{formatINR(calculateNewTotal())}</span>
                      </div>
                    </>
                  )}
                  {removedItemIds.length === 0 && (
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span>{formatINR(displayOrder.totalAmount)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `${apiBase}/orders/${displayOrder.id}/invoice-pdf`;
                    const a = document.createElement("a");
                    a.href = url;
                    a.target = "_blank";
                    a.rel = "noopener noreferrer";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  }}
                >
                  <Download className="mr-1 h-4 w-4" />
                  Invoice
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                {removedItemIds.length > 0 && (
                  <Button
                    onClick={modifyOrder}
                    disabled={isModifying}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isModifying
                      ? "Removing..."
                      : `Remove ${removedItemIds.length} Item(s)`}
                  </Button>
                )}
              </div>
            </>
          )}

          {isCompletedViewOnly && (
            <div className="border-t pt-4 space-y-3">
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>{formatINR(displayOrder.totalAmount)}</span>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = `${apiBase}/orders/${displayOrder.id}/invoice-pdf`;
                    const a = document.createElement("a");
                    a.href = url;
                    a.target = "_blank";
                    a.rel = "noopener noreferrer";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  }}
                >
                  <Download className="mr-1 h-4 w-4" />
                  Download Invoice
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
  variant?: "HALF" | "FULL";
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
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKE_AWAY">("DINE_IN");
  const [submitting, setSubmitting] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setMenuLoading(true);
    fetch(`${apiBase}/menu`)
      .then((r) => r.json())
      .then((data) => {
        const cats = Array.isArray(data) ? data : (data?.categories ?? []);
        setMenuCategories(cats);
      })
      .catch(() => setMenuCategories([]))
      .finally(() => setMenuLoading(false));
  }, []);

  const cartTotal = useMemo(
    () => cart.reduce((s, i) => s + i.price * i.quantity, 0),
    [cart],
  );

  const addToCart = (name: string, price: number, variant?: "HALF" | "FULL", category?: string) => {
    const id = `${name}-${variant ?? "FULL"}-${category ?? ""}`;
    setCart((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) return prev.map((i) => i.id === id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id, name, price, quantity: 1, variant, category }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => i.id === id ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0),
    );
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return menuCategories;
    const q = searchQuery.toLowerCase();
    return menuCategories.filter(
      (cat) =>
        cat.name?.toLowerCase().includes(q) ||
        cat.items?.some((item: any) => item.name?.toLowerCase().includes(q)),
    );
  }, [menuCategories, searchQuery]);

  const handleSubmit = async () => {
    if (!cart.length) { toast.error("Add at least one item"); return; }
    if (!customerName.trim()) { toast.error("Customer name is required"); return; }
    if (orderType === "DINE_IN" && !tableNumber.trim()) { toast.error("Table number is required"); return; }
    if (!branchId) { toast.error("Branch not loaded. Refresh and try again."); return; }

    const mobileTrim = customerMobile.replace(/\D/g, "").slice(0, 10);
    const validMobile = mobileTrim.length === 10 && /^[6-9]/.test(mobileTrim) ? mobileTrim : "";

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          orderType,
          tableNumber: orderType === "TAKE_AWAY" ? "" : tableNumber.trim(),
          customerName: customerName.trim().toUpperCase(),
          customerMobile: validMobile || undefined,
          packaging: orderType === "TAKE_AWAY",
          items: cart.map((item) => ({
            name: item.name,
            unitPrice: item.price,
            quantity: item.quantity,
            variant: item.variant,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to place order");
      }
      const data = await res.json();
      const newOrderId = data.order?.id ?? null;
      setLastOrderId(newOrderId);
      setCart([]);
      setCustomerName("");
      setCustomerMobile("");
      setTableNumber("");
      toast.success(`Order #${newOrderId} placed successfully!`);
      if (newOrderId) onOrderPlaced(newOrderId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold sm:text-xl">Add New Order</h2>
          <p className="text-sm text-muted-foreground">Place an order for a customer at the counter</p>
        </div>
        {lastOrderId && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              const url = `${apiBase}/orders/${lastOrderId}/invoice-pdf`;
              const a = document.createElement("a");
              a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
              document.body.appendChild(a); a.click(); a.remove();
            }}
          >
            <Download className="h-4 w-4" />
            Download Last Invoice (#{lastOrderId})
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Menu Panel */}
        <div className="lg:col-span-2 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-emerald-600" />
                Menu
              </CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </CardHeader>
            <CardContent className="pb-4 max-h-[60vh] overflow-y-auto">
              {menuLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : filteredCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No items found</p>
              ) : (
                <div className="space-y-4">
                  {filteredCategories.map((cat: any) => (
                    <div key={cat.id}>
                      <h3 className="text-sm font-bold text-emerald-800 mb-2 px-1 uppercase tracking-wide">{cat.name}</h3>
                      <div className="space-y-1">
                        {(cat.items || []).map((item: any) => {
                          const hasHalf = item.hasHalf && item.halfPrice;
                          return (
                            <div key={item.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {hasHalf ? `₹${item.halfPrice} / ₹${item.basePrice}` : `₹${item.basePrice}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {hasHalf ? (
                                  <>
                                    <Button size="sm" variant="outline" className="h-8 px-2 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => addToCart(item.name, item.halfPrice, "HALF", cat.name)}>
                                      Half
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-8 px-2 text-xs bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700" onClick={() => addToCart(item.name, item.basePrice, "FULL", cat.name)}>
                                      Full
                                    </Button>
                                  </>
                                ) : (
                                  <Button size="sm" variant="outline" className="h-8 px-3 text-xs bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700" onClick={() => addToCart(item.name, item.basePrice, "FULL", cat.name)}>
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
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
                Order Summary
                {cart.length > 0 && (
                  <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                    {cart.length} item{cart.length > 1 ? "s" : ""}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pb-4">
              {/* Cart Items */}
              {cart.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No items added yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[30vh] overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.name}{item.variant ? ` (${item.variant === "HALF" ? "Half" : "Full"})` : ""}</p>
                        <p className="text-xs text-muted-foreground">₹{item.price} each</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => updateQty(item.id, -1)} className="h-6 w-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-xs font-bold transition-colors">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="h-6 w-6 rounded-full bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center text-xs font-bold text-emerald-700 transition-colors">
                          <Plus className="h-3 w-3" />
                        </button>
                        <button onClick={() => setCart((p) => p.filter((i) => i.id !== item.id))} className="h-6 w-6 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center text-xs font-bold text-red-600 transition-colors ml-0.5">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t font-bold text-sm">
                    <span>Total</span>
                    <span className="text-emerald-700">₹{cartTotal.toFixed(0)}</span>
                  </div>
                </div>
              )}

              {/* Customer Details */}
              <div className="space-y-3 pt-2 border-t">
                <h4 className="text-sm font-semibold text-slate-700">Customer Details</h4>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Name <span className="text-red-500">*</span></label>
                  <Input
                    placeholder="Customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Mobile <span className="text-slate-400 font-normal">(optional)</span></label>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit number"
                    value={customerMobile}
                    onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Order Type */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderType("DINE_IN")}
                    className={`h-9 rounded-lg border-2 text-sm font-semibold transition-all ${orderType === "DINE_IN" ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 text-slate-600 hover:border-emerald-300"}`}
                  >
                    Dine In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOrderType("TAKE_AWAY"); setTableNumber(""); }}
                    className={`h-9 rounded-lg border-2 text-sm font-semibold transition-all ${orderType === "TAKE_AWAY" ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 text-slate-600 hover:border-emerald-300"}`}
                  >
                    Take Away
                  </button>
                </div>

                {orderType === "DINE_IN" && (
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Table Number <span className="text-red-500">*</span></label>
                    <Input
                      inputMode="numeric"
                      placeholder="e.g. 5"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value.replace(/\D/g, ""))}
                      className="h-9 text-sm"
                    />
                  </div>
                )}
              </div>

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 h-10"
                disabled={submitting || cart.length === 0 || !customerName.trim() || (orderType === "DINE_IN" && !tableNumber.trim())}
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
  const [popupDisplayOrder, setPopupDisplayOrder] = useState<Order | null>(
    null,
  );
  const [isOrderPopupOpen, setIsOrderPopupOpen] = useState(false);
  const [removedItemIds, setRemovedItemIds] = useState<number[]>([]);
  const [modificationReason, setModificationReason] =
    useState("Item not available");
  const [isModifying, setIsModifying] = useState(false);
  const [shiftActive, setShiftActive] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [actionOrderId, setActionOrderId] = useState<number | null>(null);
  /** Only the card where Accept was clicked shows "Accepting..." – prevents other cards showing loading */
  const [acceptingOrderId, setAcceptingOrderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("dashboard");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [popupCustomerName, setPopupCustomerName] = useState("");
  const [popupCustomerMobile, setPopupCustomerMobile] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [newOrderPopupOrders, setNewOrderPopupOrders] = useState<Order[]>([]);
  const [pauseNewOrderPopup, setPauseNewOrderPopup] = useState(false);
  const hasCompletedFirstLoad = useRef(false);
  const isOrderPopupOpenRef = useRef(false);
  const [currentShift, setCurrentShift] = useState<null | {
    id: number;
    branchId: number;
    shiftStart: string;
    shiftEnd?: string | null;
    totalHours?: number | null;
    totalSales: number;
    ordersCount?: number;
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
  const [myDailyShiftStats, setMyDailyShiftStats] = useState<
    { date: string; totalHours: number; totalSales: number; shifts: number }[]
  >([]);
  const [showStartShiftPrompt, setShowStartShiftPrompt] = useState(false);
  const prevNewOrderCountRef = useRef(0);
  const [newOrderSoundPreset, setNewOrderSoundPreset] =
    useState<NewOrderSoundPreset>(() => {
      try {
        const raw = window.localStorage.getItem(NEW_ORDER_SOUND_PRESET_KEY);
        if (
          raw === "beep" ||
          raw === "ring" ||
          raw === "siren" ||
          raw === "chime"
        )
          return raw;
      } catch (_) {}
      return "ring";
    });
  const [newOrderSoundVolume, setNewOrderSoundVolume] = useState<number>(() => {
    try {
      const raw = Number(
        window.localStorage.getItem(NEW_ORDER_SOUND_VOLUME_KEY) ?? "0.85",
      );
      return clamp01(raw);
    } catch (_) {}
    return 0.85;
  });

  const { token, ready, refresh, logout } = useAuth();

  // Employee UX settings (ringing is branch-controlled by admin)
  useEffect(() => {
    const fetchEmployeeSettings = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${apiBase}/config/employee-settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        setRingingEnabledByAdmin(data.enableNewOrderRinging !== false);
      } catch {
        setRingingEnabledByAdmin(true);
      }
    };
    fetchEmployeeSettings();
  }, [token]);

  // Performance (API speed) – employee view
  type ApiPerfRow = {
    key: string;
    actor: "ALL" | "ADMIN" | "EMPLOYEE" | "CUSTOMER";
    count: number;
    errorCount: number;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    maxMs: number;
  };
  type ApiPerfSummary = {
    now: number;
    windowMinutes: number;
    actor: "ALL" | "ADMIN" | "EMPLOYEE" | "CUSTOMER";
    totalCount: number;
    totalErrorCount: number;
    rpm: number;
    rows: ApiPerfRow[];
  };
  const [apiPerfWindowMinutes, setApiPerfWindowMinutes] = useState<number>(60);
  const [apiPerfLoading, setApiPerfLoading] = useState(false);
  const { stopGlobalLoading } = useGlobalLoading();
  const [apiPerf, setApiPerf] = useState<ApiPerfSummary | null>(null);

  const loadApiPerf = useCallback(async () => {
    if (!token) return;
    setApiPerfLoading(true);
    try {
      const params = new URLSearchParams({
        windowMinutes: String(apiPerfWindowMinutes),
        top: "30",
        actor: "EMPLOYEE",
      });
      const res = await fetch(`${apiBase}/performance/summary?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          data && typeof data === "object" && "message" in data
            ? String((data as { message?: unknown }).message || "")
            : "";
        throw new Error(msg || "Failed to load performance");
      }
      setApiPerf(data as ApiPerfSummary);
    } catch (e) {
      setApiPerf(null);
    } finally {
      setApiPerfLoading(false);
    }
  }, [token, apiPerfWindowMinutes]);

  useEffect(() => {
    if (activeSection !== "performance") return;
    loadApiPerf();
    const id = window.setInterval(() => loadApiPerf(), 30_000);
    return () => window.clearInterval(id);
  }, [activeSection, loadApiPerf]);

  const overallApiPerf = useMemo(() => {
    const rows = apiPerf?.rows ?? [];
    const total = rows.reduce((s, r) => s + (r.count || 0), 0);
    const weightedAvg =
      total > 0 ? rows.reduce((s, r) => s + (Number(r.avgMs) || 0) * r.count, 0) / total : 0;
    const weightedP95 =
      total > 0 ? rows.reduce((s, r) => s + (Number(r.p95Ms) || 0) * r.count, 0) / total : 0;
    return {
      rpm: apiPerf?.rpm ?? 0,
      avgMs: Math.round(weightedAvg),
      p95Ms: Math.round(weightedP95),
      totalCount: apiPerf?.totalCount ?? 0,
      totalErrorCount: apiPerf?.totalErrorCount ?? 0,
    };
  }, [apiPerf]);

  const mergeOrders = (prev: Order[], next: Order[]) => {
    if (prev.length === 0) return next;
    const prevById = new Map(prev.map((o) => [o.id, o]));
    let changed = prev.length !== next.length;
    const merged = next.map((n) => {
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
        (p.updatedAt ?? "") === (n.updatedAt ?? "") &&
        (p.employeeId ?? null) === (n.employeeId ?? null) &&
        (p.items?.length ?? 0) === (n.items?.length ?? 0);
      if (!same) changed = true;
      return same ? p : { ...p, ...n };
    });
    return changed ? merged : prev;
  };

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
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock as any);
      window.removeEventListener("keydown", unlock as any);
    };
  }, []);

  // New order sound when popup gets new orders (real-time notification)
  useEffect(() => {
    const n = newOrderPopupOrders.length;
    if (n > prevNewOrderCountRef.current) {
      if (ringingEnabledByAdmin) {
        playNewOrderSound(newOrderSoundPreset, newOrderSoundVolume);
      }
    }
    prevNewOrderCountRef.current = n;
  }, [
    newOrderPopupOrders.length,
    newOrderSoundPreset,
    newOrderSoundVolume,
    ringingEnabledByAdmin,
  ]);

  // Keep ringing (beep) until staff accepts/clears, unless paused.
  useEffect(() => {
    if (pauseNewOrderPopup) return;
    if (newOrderPopupOrders.length === 0) return;
    if (!ringingEnabledByAdmin) return;
    const id = window.setInterval(() => {
      playNewOrderSound(newOrderSoundPreset, newOrderSoundVolume);
    }, 3000);
    return () => window.clearInterval(id);
  }, [
    newOrderPopupOrders.length,
    pauseNewOrderPopup,
    newOrderSoundPreset,
    newOrderSoundVolume,
    ringingEnabledByAdmin,
  ]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        NEW_ORDER_SOUND_PRESET_KEY,
        newOrderSoundPreset,
      );
    } catch (_) {}
  }, [newOrderSoundPreset]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        NEW_ORDER_SOUND_VOLUME_KEY,
        String(clamp01(newOrderSoundVolume)),
      );
    } catch (_) {}
  }, [newOrderSoundVolume]);

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
    if (!token) return;
    // Don't set up polling while order popup is open – keeps cards stable
    if (isOrderPopupOpen) return;

    async function loadOrders() {
      if (isOrderPopupOpenRef.current) return;
      try {
        let res = await fetch(`${apiBase}/orders/live`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (res.status === 401) {
          const nextToken = await refresh();
          if (!nextToken) return;
          res = await fetch(`${apiBase}/orders/live`, {
            headers: { Authorization: `Bearer ${nextToken}` },
            credentials: "include",
          });
          if (res.status === 401) {
            await logout();
            window.location.href = "/login";
            return;
          }
        }
        if (!res.ok) {
          setOrders((prev) => (prev.length ? prev : []));
          return;
        }
        const data = await res.json();
        if (isOrderPopupOpenRef.current) return;
        setOrders((prev) => {
          const canShowPopup =
            hasCompletedFirstLoad.current &&
            prev.length > 0 &&
            data.length > prev.length &&
            !pauseNewOrderPopup;
          if (canShowPopup) {
            const prevIds = new Set(prev.map((o) => o.id));
            const newOrders = data.filter((d: Order) => !prevIds.has(d.id));
            if (newOrders.length > 0) {
              setNewOrderPopupOrders((popup) => [...newOrders, ...popup]);
              notifyNewOrders(newOrders.length);
              setTimeout(
                () =>
                  toast.success(`${newOrders.length} new order(s) received.`),
                100,
              );
            }
          }
          const next = mergeOrders(prev, data);
          if (prev.length === 0 && next.length >= 0)
            hasCompletedFirstLoad.current = true;
          return next;
        });
      } catch {
        setOrders((prev) => (prev.length ? prev : []));
    } finally {
        setLoading(false);
        setHasLoadedOnce(true);
        // First employee dashboard load can clear the global loader from login
        stopGlobalLoading();
      }
    }

    loadOrders();
    const id = window.setInterval(() => {
      if (isOrderPopupOpenRef.current) return;
      loadOrders();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [ready, token, refresh, logout, isOrderPopupOpen]);

  useEffect(() => {
    if (!token) return;
    fetchWithTimeout(`${apiBase}/employees/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => data && setProfile(data))
      .catch(() => {});
  }, [token]);

  // Fetch current shift status on load; show Start shift? only once per day when no active shift
  useEffect(() => {
    if (!token) return;
    fetchWithTimeout(`${apiBase}/shift/current`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.active) setShiftActive(true);
        if (data?.shift) setCurrentShift(data.shift);
        if (!data?.active) {
          const todayKey =
            "dm_shift_prompt_dismissed_" +
            new Date().toISOString().slice(0, 10);
          const dismissedToday =
            window.sessionStorage.getItem(todayKey) === "1";
          if (!dismissedToday) setShowStartShiftPrompt(true);
        }
      })
      .catch(() => {});
  }, [token]);

  // Load employee shift history (daily in/out + hours)
  useEffect(() => {
    if (!token) return;
    fetchWithTimeout(`${apiBase}/shift/my-history`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setMyShiftHistory(data.shifts ?? []);
        setMyDailyShiftStats(data.dailyStats ?? []);
      })
      .catch(() => {});
  }, [token]);

  const todayIso = new Date().toISOString();
  const endedShiftToday = myShiftHistory.some(
    (s) =>
      s.shiftEnd &&
      isSameDay(
        typeof s.shiftEnd === "string"
          ? s.shiftEnd
          : new Date(s.shiftEnd).toISOString(),
        todayIso,
      ),
  );

  const startShift = async () => {
    if (!token) return;
    // One shift per day: cannot start again after ending a shift the same day
    if (endedShiftToday) {
      toast.error(
        "You already completed a shift today. You can start again tomorrow.",
      );
      return;
    }
    if (shiftActive && currentShift) {
      toast.error("You already have an active shift. End it first.");
      return;
    }
    const openShift = myShiftHistory.find((s) => !s.shiftEnd);
    if (openShift) {
      if (isSameDay(openShift.shiftStart, todayIso)) {
        toast.error(
          "You already started a shift today. End it first or contact admin.",
        );
      } else {
        toast.error(
          "Please end your previous shift first. Contact admin if you need help.",
        );
      }
      return;
    }
    setShiftLoading(true);
    try {
      const branchId = profile?.branchId ?? profile?.branch?.id;
      const res = await fetch(`${apiBase}/shift/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(branchId != null ? { branchId } : {}),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data) setCurrentShift(data);
        setShiftActive(true);
        toast.success("Your shift has begun");
        setShowStartShiftPrompt(false);
        // Refetch history in background without blocking UI (reduces card flash)
        fetch(`${apiBase}/shift/my-history`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d) {
              setMyShiftHistory(d.shifts ?? []);
              setMyDailyShiftStats(d.dailyStats ?? []);
            }
          })
          .catch(() => {});
      } else {
        const data = await res.json().catch(() => ({}));
        const alreadyActive =
          res.status === 400 && data.message === "Shift already active";
        if (alreadyActive) {
          setShiftActive(true);
          toast.success("You're already on an active shift.");
          // refresh shift info
          fetch(`${apiBase}/shift/current`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => d?.shift && setCurrentShift(d.shift))
            .catch(() => {});
        } else {
          toast.error(data.message || "Failed to start shift");
        }
      }
    } catch {
      toast.error("Failed to start shift");
    } finally {
      setShiftLoading(false);
    }
  };

  const endShift = async () => {
    if (!token) return;
    setShiftLoading(true);
    try {
      const res = await fetch(`${apiBase}/shift/end`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data) setCurrentShift(data);
        setShiftActive(false);
        toast.success("Your shift has ended");
        fetch(`${apiBase}/shift/my-history`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d) {
              setMyShiftHistory(d.shifts ?? []);
              setMyDailyShiftStats(d.dailyStats ?? []);
            }
          })
          .catch(() => {});
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Failed to end shift");
      }
    } catch {
      toast.error("Failed to end shift");
    } finally {
      setShiftLoading(false);
    }
  };

  const acceptOrder = async (orderId: number) => {
    if (!token) return;
    setAcceptingOrderId(orderId);
    try {
      const res = await fetch(`${apiBase}/orders/${orderId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.order ?? data;
        setNewOrderPopupOrders((prev) => prev.filter((o) => o.id !== orderId));
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  ...updated,
                  employeeId: updated.employeeId ?? updated.employee?.id,
                  employee: updated.employee,
                  acceptedAt: updated.acceptedAt ?? o.acceptedAt,
                }
              : o,
          ),
        );
        setSelectedOrder((prev) =>
          prev && prev.id === orderId ? { ...prev, ...updated } : prev,
        );
        toast.success(data.message || "You are now handling this order.");
        // Business rule: employees can send WhatsApp only after payment is completed.
        if (data.statusWaMeLink) {
          toast.info(
            "WhatsApp messages can be sent after payment is marked as Paid.",
          );
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(
          err.message || "Order may already be accepted by someone else",
        );
      }
    } catch {
      toast.error("Failed to accept order");
    } finally {
      setAcceptingOrderId(null);
    }
  };

  const markStatus = useCallback(
    async (orderId: number, status: string) => {
      if (!token) return;
      setActionOrderId(orderId);
      try {
        const res = await fetch(`${apiBase}/orders/${orderId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          const data = await res.json();
          const updated = data.order ?? data;
          setOrders((prev) =>
            prev.map((o) =>
              o.id === updated.id
                ? {
                    ...o,
                    status: updated.status,
                    completedAt: updated.completedAt ?? o.completedAt,
                  }
                : o,
            ),
          );
          setSelectedOrder((prev) =>
            prev && prev.id === orderId
              ? {
                  ...prev,
                  status: updated.status,
                  completedAt: updated.completedAt ?? prev.completedAt,
                }
              : prev,
          );
          setPopupDisplayOrder((prev) =>
            prev && prev.id === orderId
              ? {
                  ...prev,
                  status: updated.status,
                  completedAt: updated.completedAt ?? prev.completedAt,
                }
              : prev,
          );
          if (data.statusWaMeLink) {
            toast.info(
              "WhatsApp messages can be sent after payment is marked as Paid.",
            );
          }
          toast.success(
            data.message ||
              `Order marked as ${status.replace("_", " ").toLowerCase()}`,
          );
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.message || "Failed to update status");
        }
      } catch {
        toast.error("Failed to update status");
      } finally {
        setActionOrderId(null);
      }
    },
    [token],
  );

  const confirmPayment = useCallback(
    async (orderId: number) => {
      if (!token) return;
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;
      setActionOrderId(orderId);
      try {
        const res = await fetch(`${apiBase}/payments/${orderId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            paymentStatus: "PAID",
            paidAmount: order.totalAmount,
            remainingAmount: 0,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const order = data.order ?? {};
          setOrders((prev) =>
            prev.map((o) =>
              o.id === orderId
                ? { ...o, paymentStatus: order.paymentStatus ?? "PAID" }
                : o,
            ),
          );
          setSelectedOrder((prev) =>
            prev && prev.id === orderId
              ? { ...prev, paymentStatus: order.paymentStatus ?? "PAID" }
              : prev,
          );
          setPopupDisplayOrder(null);
          setIsOrderPopupOpen(false);
          setSelectedOrder(null);
          fetch(`${apiBase}/shift/current`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => d?.shift && setCurrentShift(d.shift))
            .catch(() => {});
          if (data.paymentWaMeLink) {
            const win = window.open(
              data.paymentWaMeLink,
              "_blank",
              "noopener,noreferrer",
            );
            if (!win || win.closed === undefined) {
              toast.error(
                "Popup blocked. Allow popups for this site to open WhatsApp and send receipt to customer.",
                { duration: 8000 },
              );
              toast.info(
                "You can copy the receipt link from the address bar after allowing popups and retry Mark Paid.",
                { duration: 6000 },
              );
            } else {
              toast.success(
                "WhatsApp opened – send the receipt to the customer.",
              );
            }
          } else {
            if (!order.customerMobile || !order.customerName) {
              toast.success(
                "Payment marked as received. Save customer name & mobile before marking paid to send WhatsApp receipt next time.",
              );
            } else {
              toast.success(data.message || "Payment marked as received");
            }
          }
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.message || "Failed to confirm payment");
        }
      } catch {
        toast.error("Failed to confirm payment");
      } finally {
        setActionOrderId(null);
      }
    },
    [token, orders],
  );

  const openOrderPopup = useCallback((order: Order) => {
    setSelectedOrder(order);
    setPopupDisplayOrder(
      typeof structuredClone === "function"
        ? structuredClone(order)
        : JSON.parse(JSON.stringify(order)),
    );
    setRemovedItemIds([]);
    setModificationReason("Item not available");
    setPopupCustomerName(order.customerName ?? "");
    setPopupCustomerMobile(order.customerMobile ?? "");
    setIsOrderPopupOpen(true);
  }, []);

  const saveOrderCustomer = useCallback(async () => {
    if (!selectedOrder || !token) return;
    const mobile = popupCustomerMobile.replace(/\D/g, "").slice(0, 10);
    if (mobile.length !== 10 || !/^[6-9]/.test(mobile)) {
      toast.error("Enter a valid 10-digit mobile number.");
      return;
    }
    setSavingCustomer(true);
    try {
      const res = await fetch(
        `${apiBase}/orders/${selectedOrder.id}/customer`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            customerMobile: mobile,
            customerName: popupCustomerName.trim() || undefined,
          }),
        },
      );
      if (res.ok) {
        const updated = await res.json();
        setOrders((prev) =>
          prev.map((o) =>
            o.id === selectedOrder.id
              ? {
                  ...o,
                  customerName: updated.customerName,
                  customerMobile: updated.customerMobile,
                }
              : o,
          ),
        );
        setSelectedOrder((prev) =>
          prev && prev.id === selectedOrder.id
            ? {
                ...prev,
                customerName: updated.customerName,
                customerMobile: updated.customerMobile,
              }
            : prev,
        );
        setPopupDisplayOrder((prev) =>
          prev && prev.id === selectedOrder.id
            ? {
                ...prev,
                customerName: updated.customerName,
                customerMobile: updated.customerMobile,
              }
            : prev,
        );
        toast.success(
          (updated as { message?: string }).message ||
            "Customer mobile saved. WhatsApp updates will be sent to this number.",
        );
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Failed to save");
      }
    } catch {
      toast.error("Failed to save customer");
    } finally {
      setSavingCustomer(false);
    }
  }, [token, selectedOrder, popupCustomerName, popupCustomerMobile]);

  const toggleItemRemoval = useCallback((itemId: number) => {
    setRemovedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId],
    );
  }, []);

  const modifyOrder = useCallback(async () => {
    if (!selectedOrder || !token) return;
    if (removedItemIds.length === 0) return;
    setIsModifying(true);
    try {
      const res = await fetch(`${apiBase}/orders/${selectedOrder.id}/modify-v2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          removedItemIds,
          reason: modificationReason,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrders((prev) =>
          prev.map((o) => (o.id === selectedOrder.id ? data.order : o)),
        );
        toast.success(
          data.message ||
            `Removed ${data.removedCount ?? 0} item(s). New total: ${formatINR(data.newAmount ?? 0)}`,
        );
        setPopupDisplayOrder(null);
        setIsOrderPopupOpen(false);
        setSelectedOrder(null);
        setRemovedItemIds([]);
      }
    } catch (error) {
      toast.error("Failed to modify order");
    } finally {
      setIsModifying(false);
    }
  }, [token, selectedOrder, removedItemIds, modificationReason]);

  const todayStats = useMemo(() => {
    const ordersToday = orders.length;
    const paidOrdersList = orders.filter((o) => o.paymentStatus === "PAID");
    const paid = new Set(paidOrdersList.map((o) => o.id)).size; // Unique paid order count
    const completed = paid; // Completed = paid orders only
    const pendingPayments = orders.filter(
      (o) => o.status === "ORDER_COMPLETE" && o.paymentStatus !== "PAID",
    ).length;
    const salesToday = currentShift?.totalSales ?? 0;
    return { ordersToday, completed, paid, pendingPayments, salesToday };
  }, [orders, currentShift]);

  // Live = all unpaid orders. Sort: ready for payment (ORDER_COMPLETE) first, then in-progress.
  const liveOrdersRaw = orders.filter((o) => o.paymentStatus !== "PAID");
  const liveOrders = useMemo(
    () =>
      [...liveOrdersRaw].sort((a, b) =>
        a.status === "ORDER_COMPLETE" && b.status !== "ORDER_COMPLETE"
          ? -1
          : b.status === "ORDER_COMPLETE" && a.status !== "ORDER_COMPLETE"
            ? 1
            : 0,
      ),
    [liveOrdersRaw],
  );
  const completedOrders = useMemo(
    () => orders.filter((o) => o.paymentStatus === "PAID"),
    [orders],
  );
  const pendingPayments = useMemo(
    () =>
      orders.filter(
        (o) => o.status === "ORDER_COMPLETE" && o.paymentStatus !== "PAID",
      ),
    [orders],
  );
  const paidOrders = useMemo(
    () => orders.filter((o) => o.paymentStatus === "PAID"),
    [orders],
  );

  // All orders (no extra filtering) – used by the All Orders tab
  const allOrders = orders;

  const getStatusColor = useCallback(
    (status: string) =>
      ORDER_STATUS_COLORS[status] ?? "bg-slate-100 text-slate-800",
    [],
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "NEW_ORDER":
        return <Bell className="h-3 w-3" />;
      case "ACCEPTED":
        return <CheckCircle className="h-3 w-3" />;
      case "PREPARING":
        return <ChefHat className="h-3 w-3" />;
      case "SERVED":
        return <Utensils className="h-3 w-3" />;
      case "ORDER_COMPLETE":
        return <CheckCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  /** Order is delayed if NEW_ORDER/ACCEPTED and older than threshold from acceptedAt (fallback createdAt). */
  const isOrderDelayed = (order: Order) => {
    if (order.status !== "NEW_ORDER" && order.status !== "ACCEPTED") {
      return false;
    }
    const startedAt = order.acceptedAt || order.createdAt;
    return Date.now() - new Date(startedAt).getTime() > DELAYED_ORDER_MS;
  };

  /** Priority label for POS-style visibility */
  const getPriorityLabel = (order: Order): string => {
    if (isOrderDelayed(order)) return "Delayed";
    switch (order.status) {
      case "NEW_ORDER":
        return "New Order";
      case "ACCEPTED":
      case "PREPARING":
      case "SERVED":
        return "Preparing";
      case "ORDER_COMPLETE":
        return "Completed";
      default:
        return order.status.replace("_", " ");
    }
  };

  /** Badge style: green New, yellow Preparing, red Delayed, green Completed */
  const getPriorityBadgeClass = (order: Order): string => {
    if (isOrderDelayed(order))
      return "bg-red-100 text-red-800 border border-red-300";
    switch (order.status) {
      case "NEW_ORDER":
        return "bg-emerald-100 text-emerald-800 border border-emerald-300";
      case "ACCEPTED":
      case "PREPARING":
      case "SERVED":
        return "bg-amber-100 text-amber-800 border border-amber-300";
      case "ORDER_COMPLETE":
        return "bg-green-100 text-green-800 border border-green-300";
      default:
        return getStatusColor(order.status);
    }
  };

  const renderOrderCard = (
    order: Order,
    options?: { isCompletedSection?: boolean; isLiveSection?: boolean },
  ) => {
    const delayed = isOrderDelayed(order);
    const isReadyForPayment =
      options?.isLiveSection && order.status === "ORDER_COMPLETE";
    // Live: red = delayed, yellow/amber = completed but unpaid, green = completed paid (or preparing)
    const liveCardStyle = options?.isLiveSection
      ? delayed
        ? "border-l-4 border-l-red-600 bg-red-50/50 ring-1 ring-red-200"
        : order.status === "ORDER_COMPLETE"
          ? order.paymentStatus !== "PAID"
            ? "border-l-4 border-l-amber-500 bg-amber-50/60"
            : "border-l-4 border-l-green-600 bg-green-50/50"
          : "border-l-4 border-l-amber-500 bg-amber-50/40"
      : "";
    const completedCardStyle = options?.isCompletedSection
      ? "border-l-4 border-l-green-600 bg-green-50/50"
      : "";
    const defaultCardStyle =
      !options?.isLiveSection && !options?.isCompletedSection
        ? "border-l-4 border-l-emerald-500"
        : "";
    const isAcceptingThis = acceptingOrderId === order.id;
    const isActionThis = actionOrderId === order.id;

    // Completed (ready for payment): Order # + Table + Payment Status (prominent), View Order, Confirm Payment.
    const compactCompletedBlock = isReadyForPayment && (
      <div className="flex flex-col gap-2 p-3 min-h-0">
        <div className="font-bold text-base text-slate-900">
          Order #{order.id}
        </div>
        <div className="font-semibold text-sm truncate text-slate-700">
          Table {order.table?.tableNumber || order.table?.id || "?"}
        </div>
        {options?.isLiveSection && (
          <p className="font-bold text-emerald-700">
            {formatINR(order.totalAmount)}
          </p>
        )}
        {order.acceptedAt && order.completedAt && (
          <p className="text-xs text-slate-600">
            Time to complete:{" "}
            {formatTimeToComplete(order.acceptedAt, order.completedAt)}
          </p>
        )}
        <Badge
          variant={order.paymentStatus === "PAID" ? "default" : "secondary"}
          className={`w-fit shrink-0 text-sm font-semibold px-3 py-1 ${order.paymentStatus === "PAID" ? "bg-green-100 text-green-800 border-green-300" : "bg-red-100 text-red-800 border-red-300"}`}
        >
          {order.paymentStatus === "PAID" ? "Paid" : "Not Paid"}
        </Badge>
        <div className="flex flex-col gap-2 mt-auto w-full">
          <Button
            size="sm"
            variant="outline"
            className="w-full min-h-[44px] text-xs"
            onClick={(e) => {
              e.stopPropagation();
              openOrderPopup(order);
            }}
          >
            <Eye className="mr-1 h-3 w-3 shrink-0" />
            <span className="truncate">View Order</span>
          </Button>
          {order.paymentStatus !== "PAID" && (
            <Button
              size="sm"
              className="w-full min-h-[44px] text-xs rounded-lg"
              disabled={isActionThis || order.status !== "ORDER_COMPLETE"}
              onClick={(e) => {
                e.stopPropagation();
                confirmPayment(order.id);
              }}
            >
              {isActionThis ? (
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
              ) : (
                <CreditCard className="mr-1 h-4 w-4 shrink-0" />
              )}
              <span className="truncate">Confirm Payment</span>
            </Button>
          )}
        </div>
      </div>
    );

    return (
      <Card
        key={order.id}
        className={`flex flex-col min-w-0 card-gpu cursor-pointer ${liveCardStyle || completedCardStyle || defaultCardStyle} ${isReadyForPayment ? "max-w-full" : ""}`}
        onClick={() => !isReadyForPayment && openOrderPopup(order)}
      >
        <CardContent
          className={`flex-1 flex flex-col min-h-0 ${isReadyForPayment ? "p-2 sm:p-3" : "p-2 sm:p-4"}`}
        >
          {compactCompletedBlock}
          {!isReadyForPayment && (
            <div
              className="flex flex-col flex-1"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Priority badge + Order # + Time ago (POS-style) */}
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <Badge
                  className={`shrink-0 text-[10px] sm:text-xs font-semibold ${getPriorityBadgeClass(order)}`}
                >
                  {getPriorityLabel(order)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  #{order.id} ·{" "}
                  {timeAgo(order.acceptedAt ?? order.createdAt)}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-base sm:text-lg truncate">
                      Table {order.table?.tableNumber || order.table?.id || "?"}
                    </span>
                    {order.customerMobile && (
                      <span
                        className="text-xs text-muted-foreground truncate max-w-[100px] sm:max-w-[120px]"
                        title={order.customerMobile}
                      >
                        {order.customerMobile.slice(-4).padStart(10, "•")}
                      </span>
                    )}
                    <Badge
                      className={`shrink-0 ${getStatusColor(order.status)}`}
                    >
                      <span className="flex items-center gap-1">
                        {getStatusIcon(order.status)}
                        <span className="hidden sm:inline">{order.status}</span>
                      </span>
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      <span className="font-medium text-slate-600">{timeAgo(order.createdAt)}</span>
                    </p>
                    {order.orderType && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${order.orderType === "TAKE_AWAY" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}`}>
                        {order.orderType === "TAKE_AWAY" ? "Take Away" : "Dine In"}
                      </span>
                    )}
                  </div>
                  {order.employee && (
                    <p className="text-xs text-emerald-700 font-medium">
                      Accepted by {order.employee.name}
                    </p>
                  )}
                  {order.status === "ORDER_COMPLETE" &&
                    order.acceptedAt &&
                    order.completedAt && (
                      <p className="text-xs text-slate-600 font-medium">
                        Time to complete:{" "}
                        {formatTimeToComplete(
                          order.acceptedAt,
                          order.completedAt,
                        )}
                      </p>
                    )}
                  <div className="mt-2 space-y-1 hidden sm:block">
                    {order.items.filter((i) => !i.isRemoved).map((item) => (
                      <p key={item.id} className="text-sm">
                        {item.quantity} ×{" "}
                        {formatItemDisplayName(item.name, item.variant)}
                        {!(
                          options?.isLiveSection &&
                          order.status !== "ORDER_COMPLETE"
                        ) && (
                          <span className="font-medium ml-2">
                            {formatINR(item.price)}
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                </div>
                {/* Total and payment: only after order is completed (payment flow is after Complete) */}
                {(!(
                  options?.isLiveSection && order.status !== "ORDER_COMPLETE"
                ) ||
                  order.status === "ORDER_COMPLETE") && (
                  <div className="text-right space-y-2 shrink-0">
                    <p className="font-bold text-base sm:text-lg">
                      {formatINR(order.totalAmount)}
                    </p>
                    {order.status === "ORDER_COMPLETE" && (
                      <Badge
                        variant={
                          order.paymentStatus === "PAID"
                            ? "default"
                            : "secondary"
                        }
                        className={
                          order.paymentStatus === "PAID"
                            ? "bg-green-100 text-green-800 border-green-300"
                            : "bg-amber-100 text-amber-800 border-amber-300"
                        }
                      >
                        {order.paymentStatus === "PAID" ? "Paid" : "Pending"}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <Separator className="my-2 sm:my-3" />
              <div className="flex flex-wrap gap-2 mt-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    openOrderPopup(order);
                  }}
                  className="text-xs sm:text-sm"
                >
                  <Eye className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                  View
                </Button>
                {order.status !== "ORDER_COMPLETE" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      openOrderPopup(order);
                    }}
                    className="text-xs sm:text-sm"
                  >
                    Modify
                  </Button>
                )}
                {!order.employeeId && order.status === "NEW_ORDER" && (
                  <>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm"
                      disabled={isAcceptingThis || isActionThis}
                      onClick={(e) => {
                        e.stopPropagation();
                        acceptOrder(order.id);
                      }}
                    >
                      {isAcceptingThis ? (
                        <>
                          <span className="inline-block h-3 w-3 sm:h-4 sm:w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                          Accepting...
                        </>
                      ) : (
                        <>Accept</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50 text-xs sm:text-sm"
                      disabled={isActionThis}
                      onClick={(e) => {
                        e.stopPropagation();
                        markStatus(order.id, "CANCELLED");
                      }}
                    >
                      <XCircle className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                      Reject
                    </Button>
                  </>
                )}
                {order.employeeId && order.status !== "ORDER_COMPLETE" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isActionThis}
                      onClick={(e) => {
                        e.stopPropagation();
                        markStatus(
                          order.id,
                          order.status === "PREPARING" ? "SERVED" : "PREPARING",
                        );
                      }}
                      className="text-xs sm:text-sm"
                    >
                      {isActionThis ? (
                        <>
                          <span className="inline-block h-3 w-3 sm:h-4 sm:w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <ChefHat className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                          {order.status === "PREPARING"
                            ? "Mark Served"
                            : "Mark Preparing"}
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isActionThis}
                      onClick={(e) => {
                        e.stopPropagation();
                        markStatus(order.id, "ORDER_COMPLETE");
                      }}
                      className="text-xs sm:text-sm"
                    >
                      {isActionThis ? (
                        <span className="inline-block h-3 w-3 sm:h-4 sm:w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                      ) : (
                        <CheckCircle className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                      )}
                      Complete
                    </Button>
                  </>
                )}
                {order.status === "ORDER_COMPLETE" && (
                  <Button
                    size="sm"
                    variant={
                      order.paymentStatus === "PAID" ? "secondary" : "default"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmPayment(order.id);
                    }}
                    disabled={order.paymentStatus === "PAID" || isActionThis}
                    title={
                      order.status !== "ORDER_COMPLETE"
                        ? "Mark order complete first"
                        : undefined
                    }
                    className="text-xs sm:text-sm"
                  >
                    {isActionThis ? (
                      <span className="inline-block h-3 w-3 sm:h-4 sm:w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                    ) : (
                      <CreditCard className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                    )}
                    {order.paymentStatus === "PAID"
                      ? "Paid"
                      : "Confirm Payment"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderOrderList = (data: Order[], title: string) => {
    const isLiveOrders = title === "Live Orders";
    const isCompletedSection = title === "Completed Orders";
    const emptyState = isLiveOrders ? (
      <div className="text-center py-6 sm:py-8 text-muted-foreground">
        <ShoppingCart className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-20" />
        <p className="text-sm sm:text-base font-medium">No Active Orders</p>
        <p className="text-xs sm:text-sm mt-1">New orders will appear here</p>
      </div>
    ) : (
      <div className="text-center py-4 sm:py-6 text-muted-foreground">
        <ShoppingCart className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-20" />
        <p className="text-sm sm:text-base">
          No orders in this section right now.
        </p>
      </div>
    );
    return (
      <Card
        className={isCompletedSection ? "border-green-200 bg-green-50/30" : ""}
      >
        <CardHeader className="pb-3 pt-4 px-4 sm:px-6 sm:pb-4 sm:pt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle
                  className={`text-base sm:text-lg flex items-center gap-2 ${isCompletedSection ? "text-green-800" : ""}`}
                >
                  <ShoppingCart
                    className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 ${isCompletedSection ? "text-green-600" : ""}`}
                  />
                  <span className="truncate">{title}</span>
                </CardTitle>
                <Badge
                  variant="outline"
                  className={
                    isCompletedSection ? "border-green-300 text-green-800" : ""
                  }
                >
                  {data.length}
                </Badge>
              </div>
              <CardDescription className="text-xs sm:text-sm">
                {data.length} orders in this section
              </CardDescription>
            </div>
            {isLiveOrders && shiftActive && (
              <div className="flex justify-end sm:justify-end sm:ml-auto shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={shiftLoading}
                  onClick={async () => {
                    if (!token) return;
                    const endpoint =
                      currentShift?.status === "PAUSED" ? "resume" : "pause";
                    const res = await fetch(`${apiBase}/shift/${endpoint}`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.ok) {
                      const data = await res.json().catch(() => null);
                      if (data)
                        setCurrentShift((prev) =>
                          prev ? { ...prev, ...data } : prev,
                        );
                      toast.success(
                        data?.message ||
                          (endpoint === "pause"
                            ? "Orders paused. Other staff can receive new orders."
                            : "You are Active again for new orders."),
                      );
                    }
                  }}
                  className="text-xs sm:text-sm"
                >
                  {currentShift?.status === "PAUSED"
                    ? "Resume Orders"
                    : "Pause Orders"}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          {isLiveOrders ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {data.length === 0 && (
                <div className="col-span-full">{emptyState}</div>
              )}
              {data.map((order) => (
                <div key={order.id} className="min-w-0">
                  {renderOrderCard(order, {
                    isCompletedSection: false,
                    isLiveSection: true,
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50/50 overflow-hidden">
              <ScrollArea className="h-[480px] sm:h-[560px] w-full [&>[data-radix-scroll-area-viewport]]:pr-3">
                <div className="space-y-4 py-1">
                  {data.length === 0 && emptyState}
                  {data.map((order) =>
                    renderOrderCard(order, { isCompletedSection }),
                  )}
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
    () => renderOrderList(liveOrders, "Live Orders"),
    [
      liveOrders,
      acceptingOrderId,
      actionOrderId,
      currentShift?.status,
      shiftActive,
      shiftLoading,
    ],
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
    const [search, setSearch] = useState("");
    // Default to "all" so All Orders tab shows full history unless user narrows it
    const [dateFilter, setDateFilter] = useState<"today" | "last7" | "all">(
      "all",
    );
    const [paymentFilter, setPaymentFilter] = useState<
      "all" | "paid" | "unpaid"
    >("all");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);

    const filtered = useMemo(() => {
      let list = rawOrders;
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const last7Start = new Date(todayStart);
      last7Start.setDate(last7Start.getDate() - 7);
      if (dateFilter === "today") {
        list = list.filter((o) => new Date(o.createdAt) >= todayStart);
      } else if (dateFilter === "last7") {
        list = list.filter((o) => new Date(o.createdAt) >= last7Start);
      }
      if (paymentFilter === "paid")
        list = list.filter((o) => o.paymentStatus === "PAID");
      else if (paymentFilter === "unpaid")
        list = list.filter((o) => o.paymentStatus !== "PAID");
      const q = search.trim().toLowerCase();
      if (q) {
        list = list.filter(
          (o) =>
            String(o.id).includes(q) ||
            (o.table?.tableNumber ?? "").toLowerCase().includes(q) ||
            (o.employee?.name ?? "").toLowerCase().includes(q),
        );
      }
      // Always show latest orders first
      return [...list].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }, [rawOrders, dateFilter, paymentFilter, search]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageOrders = useMemo(
      () => filtered.slice(start, start + pageSize),
      [filtered, start, pageSize],
    );

    const exportCSV = () => {
      const headers = [
        "Order ID",
        "Table",
        "Items",
        "Amount",
        "Status",
        "Payment",
        "Accepted By",
        "Time",
        "Time to Complete",
      ];
      const rows = filtered.map((o) => {
        const itemsStr = o.items
          .map((i) => `${i.name} ×${i.quantity}`)
          .join("; ");
        const timeToComplete =
          o.acceptedAt && o.completedAt
            ? formatTimeToComplete(o.acceptedAt, o.completedAt)
            : "";
        return [
          o.id,
          o.table?.tableNumber ?? "",
          itemsStr,
          o.totalAmount,
          o.status,
          o.paymentStatus,
          o.employee?.name ?? "",
          new Date(o.createdAt).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          timeToComplete,
        ];
      });
      const csv = [
        headers.join(","),
        ...rows.map((r) =>
          r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","),
        ),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    const itemsSummary = (order: Order) => {
      const parts = order.items
        .slice(0, 2)
        .map((i) => `${i.name} ×${i.quantity}`);
      if (order.items.length > 2) parts.push(`+${order.items.length - 2} more`);
      return parts.join(", ");
    };

    const paymentBadgeClass = (paymentStatus: string) =>
      paymentStatus === "PAID"
        ? "bg-green-100 text-green-800 border-green-300"
        : "bg-amber-100 text-amber-800 border-amber-300";

    const isCompleted =
      title.toLowerCase().includes("completed") ||
      title.toLowerCase().includes("paid");

    return (
      <Card
        className={
          isCompleted
            ? "border-green-200 bg-green-50/30"
            : "border-amber-200/60 bg-amber-50/20"
        }
      >
        <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle
                className={`text-base sm:text-lg flex items-center gap-2 ${isCompleted ? "text-green-800" : "text-amber-800"}`}
              >
                <ShoppingCart
                  className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 ${isCompleted ? "text-green-600" : "text-amber-600"}`}
                />
                {title}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
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
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-wrap">
              <div className="relative w-full sm:flex-1 min-w-0 sm:min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Order ID, Table, Employee..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 h-10"
                />
              </div>
              <Select
                value={dateFilter}
                onValueChange={(v: "today" | "last7" | "all") => {
                  setDateFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[140px] h-10 min-h-[44px] sm:min-h-0 min-w-0">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="last7">Last 7 Days</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
              {isCompleted && (
                <Select
                  value={paymentFilter}
                  onValueChange={(v: "all" | "paid" | "unpaid") => {
                    setPaymentFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[120px] h-10 min-h-[44px] sm:min-h-0 min-w-0">
                    <SelectValue placeholder="Payment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[120px] h-10 min-h-[44px] sm:min-h-0 min-w-0">
                  <SelectValue placeholder="Page size" />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Show {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
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
                    <TableHead className="hidden sm:table-cell">
                      Accepted By
                    </TableHead>
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
                        <Skeleton className="h-8 w-14 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : total === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No orders match your filters.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block rounded-md border overflow-x-auto">
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
                    {pageOrders.map((order) => (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => onViewOrder(order)}
                      >
                        <TableCell className="font-medium">
                          #{order.id}
                        </TableCell>
                        <TableCell>
                          {order.table?.tableNumber ?? order.table?.id ?? "—"}
                        </TableCell>
                        <TableCell
                          className="max-w-[180px] truncate"
                          title={itemsSummary(order)}
                        >
                          {itemsSummary(order)}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatINR(order.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={getStatusColor(order.status)}
                            variant="secondary"
                          >
                            {order.status === "ORDER_COMPLETE"
                              ? "Completed"
                              : order.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={paymentBadgeClass(order.paymentStatus)}
                          >
                            {order.paymentStatus === "PAID"
                              ? "Paid"
                              : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-emerald-700">
                          {order.employee?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="text-xs font-medium text-slate-700">
                            {new Date(order.createdAt).toLocaleTimeString(
                              "en-IN",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {timeAgo(order.createdAt)}
                          </div>
                          {order.acceptedAt && order.completedAt && (
                            <span className="block text-xs text-emerald-600 font-medium">
                              Done in{" "}
                              {formatTimeToComplete(
                                order.acceptedAt,
                                order.completedAt,
                              )}
                            </span>
                          )}
                          {(order as any).orderType && (
                            <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${(order as any).orderType === "TAKE_AWAY" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}`}>
                              {(order as any).orderType === "TAKE_AWAY" ? "Take Away" : "Dine In"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
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
                            order.paymentStatus !== "PAID" &&
                            order.status === "ORDER_COMPLETE" && (
                              <Button
                                size="sm"
                                disabled={actionOrderId === order.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onConfirmPayment(order.id);
                                }}
                              >
                                {actionOrderId === order.id ? (
                                  <span className="inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <CreditCard className="h-3 w-3 sm:mr-1" />
                                    <span className="hidden sm:inline">
                                      Pay
                                    </span>
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
              <div className="md:hidden space-y-3">
                {pageOrders.map((order) => (
                  <Card
                    key={order.id}
                    className="border bg-white cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => onViewOrder(order)}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-semibold">Order #{order.id}</span>
                        <Badge
                          className={paymentBadgeClass(order.paymentStatus)}
                          variant="outline"
                        >
                          {order.paymentStatus === "PAID" ? "Paid" : "Pending"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Table{" "}
                        {order.table?.tableNumber ?? order.table?.id ?? "—"}
                      </p>
                      <p className="text-sm">Items: {itemsSummary(order)}</p>
                      <p className="font-semibold">
                        {formatINR(order.totalAmount)}
                      </p>
                      <p className="text-xs text-emerald-700">
                        {order.employee?.name &&
                          `Accepted by ${order.employee.name}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" · "}
                        {timeAgo(order.createdAt)}
                        {order.acceptedAt &&
                          order.completedAt &&
                          ` · Done in ${formatTimeToComplete(order.acceptedAt, order.completedAt)}`}
                      </p>
                      {(order as any).orderType && (
                        <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold ${(order as any).orderType === "TAKE_AWAY" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}`}>
                          {(order as any).orderType === "TAKE_AWAY" ? "Take Away" : "Dine In"}
                        </span>
                      )}
                      <div
                        className="flex gap-2 pt-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => onViewOrder(order)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        {showConfirmPayment &&
                          order.paymentStatus !== "PAID" &&
                          order.status === "ORDER_COMPLETE" && (
                            <Button
                              size="sm"
                              disabled={actionOrderId === order.id}
                              onClick={() => onConfirmPayment(order.id)}
                            >
                              {actionOrderId === order.id ? (
                                <span className="inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                "Confirm Payment"
                              )}
                            </Button>
                          )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {total === 0 ? 0 : start + 1}–
                  {Math.min(start + pageSize, total)} of {total} orders
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[80px] text-center">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold sm:text-xl">
              Today&apos;s Dashboard
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground truncate max-w-full">
              {currentTime.toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {" · "}
              {currentTime.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {shiftActive && (
              <Button
                variant="outline"
                size="sm"
                disabled={shiftLoading}
                onClick={async () => {
                  if (!token) return;
                  const endpoint =
                    currentShift?.status === "PAUSED" ? "resume" : "pause";
                  const res = await fetch(`${apiBase}/shift/${endpoint}`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (res.ok) {
                    const data = await res.json().catch(() => null);
                    if (data)
                      setCurrentShift((prev) =>
                        prev ? { ...prev, ...data } : prev,
                      );
                    toast.success(
                      data?.message ||
                        (endpoint === "pause"
                          ? "Orders paused. Other staff can receive new orders."
                          : "You are Active again for new orders."),
                    );
                  }
                }}
              >
                {currentShift?.status === "PAUSED"
                  ? "Resume Orders"
                  : "Pause Orders"}
              </Button>
            )}
            <Button
              variant={shiftActive ? "destructive" : "default"}
              size="lg"
              disabled={shiftLoading || endedShiftToday}
              onClick={shiftActive ? endShift : startShift}
              className={`gap-2 shrink-0 ${!shiftActive && !shiftLoading && !endedShiftToday ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
            >
              {shiftLoading ? (
                <span className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : shiftActive ? (
                <Square className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {shiftLoading
                ? "Please wait..."
                : shiftActive
                  ? "End Shift"
                  : endedShiftToday
                    ? "Start tomorrow"
                    : "Start Shift"}
            </Button>
          </div>
        </div>

        {/* KPI Cards - same structure and font as admin dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <Card
            className={`min-w-0 ${shiftActive ? "bg-gradient-to-br from-emerald-50 to-white border-emerald-200 border-2" : "bg-gradient-to-br from-emerald-50 to-white border-emerald-100"}`}
          >
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Shift Status</p>
                  <p
                    className={`text-base sm:text-lg font-bold truncate ${shiftActive ? "text-emerald-700" : "text-slate-700"}`}
                  >
                    {currentShift?.status === "PAUSED"
                      ? "Paused"
                      : shiftActive
                        ? "Active"
                        : "Inactive"}
                  </p>
                  {currentShift?.shiftStart && (
                    <p className="text-xs mt-0.5">
                      <span className="text-muted-foreground">
                        Start:{" "}
                        {new Date(currentShift.shiftStart).toLocaleTimeString(
                          "en-IN",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </span>
                      {" · "}
                      <span
                        className={
                          shiftActive
                            ? "text-emerald-700 font-semibold"
                            : "text-muted-foreground"
                        }
                      >
                        {currentShift?.shiftStart
                          ? (() => {
                              const end =
                                currentShift.shiftEnd &&
                                currentShift.status === "ENDED"
                                  ? new Date(currentShift.shiftEnd)
                                  : currentTime;
                              const ms =
                                end.getTime() -
                                new Date(currentShift.shiftStart).getTime();
                              const totalMins = Math.max(
                                0,
                                Math.floor(ms / 60000),
                              );
                              const h = Math.floor(totalMins / 60);
                              const m = totalMins % 60;
                              const pad = (n: number) =>
                                n.toString().padStart(2, "0");
                              return `${pad(h)}:${pad(m)} hrs`;
                            })()
                          : "--:-- hrs"}
                      </span>
                    </p>
                  )}
                  {shiftActive &&
                    currentShift?.shiftStart &&
                    (() => {
                      const ms =
                        currentTime.getTime() -
                        new Date(currentShift.shiftStart).getTime();
                      if (ms / (1000 * 60 * 60) > 10)
                        return (
                          <p className="text-xs font-medium text-amber-600 mt-0.5">
                            Overtime
                          </p>
                        );
                      return null;
                    })()}
                </div>
                <div className="p-1.5 bg-emerald-100 rounded-md shrink-0">
                  <Clock className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 min-w-0">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                  <p className="text-base sm:text-lg font-bold text-blue-700 truncate">
                    {todayStats.ordersToday}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Today&apos;s orders
                  </p>
                </div>
                <div className="p-1.5 bg-blue-100 rounded-md shrink-0">
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-white border-green-100 min-w-0">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="text-base sm:text-lg font-bold text-green-700 truncate">
                    {todayStats.completed}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Paid orders today
                  </p>
                </div>
                <div className="p-1.5 bg-green-100 rounded-md shrink-0">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100 min-w-0">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Pending Payment
                  </p>
                  <p className="text-base sm:text-lg font-bold text-amber-700 truncate">
                    {todayStats.pendingPayments}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Awaiting payment
                  </p>
                </div>
                <div className="p-1.5 bg-amber-100 rounded-md shrink-0">
                  <CreditCard className="h-4 w-4 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100 min-w-0">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Sales</p>
                  <p className="text-base sm:text-lg font-bold text-emerald-700 truncate">
                    {formatINR(todayStats.salesToday)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total collected
                  </p>
                </div>
                <div className="p-1.5 bg-emerald-100 rounded-md shrink-0">
                  <IndianRupee className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions - same card style as admin */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
          <Card
            className="bg-gradient-to-br from-blue-50 to-white border-blue-100 min-w-0 hover:border-blue-200 cursor-pointer transition-colors"
            onClick={() => setActiveSection("live")}
          >
            <CardContent className="p-2 sm:p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Live Orders</p>
                <p className="text-base sm:text-lg font-bold text-blue-700">
                  {liveOrders.length} active
                </p>
              </div>
              <div className="p-1.5 bg-blue-100 rounded-md shrink-0">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>

          <Card
            className="bg-gradient-to-br from-amber-50 to-white border-amber-100 min-w-0 hover:border-amber-200 cursor-pointer transition-colors"
            onClick={() => setActiveSection("pending")}
          >
            <CardContent className="p-2 sm:p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  Pending Payments
                </p>
                <p className="text-base sm:text-lg font-bold text-amber-700">
                  {pendingPayments.length} to collect
                </p>
              </div>
              <div className="p-1.5 bg-amber-100 rounded-md shrink-0">
                <CreditCard className="h-4 w-4 text-amber-600" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>

          <Card
            className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100 min-w-0 hover:border-emerald-200 cursor-pointer transition-colors"
            onClick={() => setActiveSection("shift")}
          >
            <CardContent className="p-2 sm:p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">My Shift</p>
                <p className="text-base sm:text-lg font-bold text-emerald-700">
                  View details
                </p>
              </div>
              <div className="p-1.5 bg-emerald-100 rounded-md shrink-0">
                <Clock className="h-4 w-4 text-emerald-600" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
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
              {orders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openOrderPopup(order)}
                  onKeyDown={(e) => e.key === "Enter" && openOrderPopup(order)}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold text-lg">
                      #{order.id}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        Table{" "}
                        {order.table?.tableNumber ?? order.table?.id ?? "—"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {order.items.length}{" "}
                        {order.items.length === 1 ? "item" : "items"} ·{" "}
                        {timeAgo(order.createdAt)}
                        {order.acceptedAt && order.completedAt && (
                          <span className="block text-xs text-slate-600 mt-0.5">
                            Time to complete:{" "}
                            {formatTimeToComplete(
                              order.acceptedAt,
                              order.completedAt,
                            )}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
                    <Badge
                      className={getStatusColor(order.status)}
                      variant="secondary"
                    >
                      {order.status === "ORDER_COMPLETE"
                        ? "Complete"
                        : order.status.replace("_", " ")}
                    </Badge>
                    <Badge
                      className={
                        order.paymentStatus === "PAID"
                          ? "bg-green-100 text-green-800 border-green-300"
                          : "bg-amber-100 text-amber-800 border-amber-300"
                      }
                      variant="outline"
                    >
                      {order.paymentStatus === "PAID" ? "Paid" : "Pending"}
                    </Badge>
                    <span className="font-bold text-emerald-700 whitespace-nowrap">
                      {formatINR(order.totalAmount)}
                    </span>
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="font-medium">No orders yet</p>
                  <p className="text-sm mt-1">
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
    ],
  );

  const shiftSectionContent = useMemo(
    () => (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold sm:text-xl">My Shift</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Track your shift and earnings
            </p>
          </div>
          <Button
            variant={shiftActive ? "destructive" : "default"}
            size="lg"
            disabled={shiftLoading}
            onClick={shiftActive ? endShift : startShift}
            className={`gap-2 shrink-0 w-full sm:w-auto ${!shiftActive && !shiftLoading ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
          >
            {shiftLoading ? (
              <span className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : shiftActive ? (
              <Square className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {shiftLoading
              ? "Please wait..."
              : shiftActive
                ? "End Shift"
                : "Start Shift"}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
          <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100 min-w-0">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Shift Status</p>
                  <p
                    className={`text-base sm:text-lg font-bold truncate ${shiftActive ? "text-emerald-700" : "text-slate-700"}`}
                  >
                    {currentShift?.status === "PAUSED"
                      ? "Paused"
                      : shiftActive
                        ? "Active"
                        : "Inactive"}
                  </p>
                  {currentShift?.shiftStart && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Start:{" "}
                      {new Date(currentShift.shiftStart).toLocaleTimeString(
                        "en-IN",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </p>
                  )}
                  {shiftActive && currentShift?.shiftStart && (
                    <>
                      <p className="text-xs mt-1">
                        <span className="inline-block font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                          Live:{" "}
                          {(() => {
                            const ms =
                              currentTime.getTime() -
                              new Date(currentShift.shiftStart).getTime();
                            const totalMins = Math.max(
                              0,
                              Math.floor(ms / 60000),
                            );
                            const h = Math.floor(totalMins / 60);
                            const m = totalMins % 60;
                            return `${h}h ${m}m`;
                          })()}
                        </span>
                      </p>
                      {(() => {
                        const ms =
                          currentTime.getTime() -
                          new Date(currentShift.shiftStart).getTime();
                        if (ms / (1000 * 60 * 60) > 10)
                          return (
                            <p className="text-xs font-medium text-amber-600">
                              Overtime
                            </p>
                          );
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
                          const endpoint =
                            currentShift?.status === "PAUSED"
                              ? "resume"
                              : "pause";
                          const res = await fetch(
                            `${apiBase}/shift/${endpoint}`,
                            {
                              method: "POST",
                              headers: { Authorization: `Bearer ${token}` },
                            },
                          );
                          if (res.ok) {
                            const data = await res.json().catch(() => null);
                            if (data)
                              setCurrentShift((prev) =>
                                prev ? { ...prev, ...data } : prev,
                              );
                            toast.success(
                              data?.message ||
                                (endpoint === "pause"
                                  ? "Status set to Paused."
                                  : "Back to Active."),
                            );
                          } else {
                            const err = await res.json().catch(() => ({}));
                            toast.error(err.message || "Failed");
                          }
                        }}
                      >
                        {currentShift?.status === "PAUSED" ? "Resume" : "Pause"}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="p-1.5 bg-emerald-100 rounded-md shrink-0">
                  <Clock className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 min-w-0">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Orders Handled
                  </p>
                  <p className="text-base sm:text-lg font-bold text-blue-700 truncate">
                    {currentShift?.ordersCount ?? 0}
                  </p>
                </div>
                <div className="p-1.5 bg-blue-100 rounded-md shrink-0">
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-white border-green-100 min-w-0">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Sales Collected
                  </p>
                  <p className="text-base sm:text-lg font-bold text-green-700 truncate">
                    {formatINR(todayStats.salesToday)}
                  </p>
                </div>
                <div className="p-1.5 bg-green-100 rounded-md shrink-0">
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
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                {myDailyShiftStats.slice(0, 6).map((d) => {
                  const isToday = isSameDay(d.date, new Date().toISOString());
                  const activeShiftToday =
                    isToday &&
                    currentShift &&
                    !currentShift.shiftEnd &&
                    isSameDay(
                      currentShift.shiftStart,
                      new Date().toISOString(),
                    );
                  const displayHours = activeShiftToday
                    ? getElapsedHours(
                        currentShift!.shiftStart,
                        currentShift!.shiftEnd,
                        currentTime,
                      )
                    : d.totalHours;
                  return (
                    <div
                      key={d.date}
                      className="rounded-lg border bg-white p-3 text-sm"
                    >
                      <p className="font-medium">
                        {new Date(d.date).toLocaleDateString("en-IN")}
                      </p>
                      <p className="text-muted-foreground">
                        Hours: {formatHours(displayHours, activeShiftToday)}
                      </p>
                      <p className="text-muted-foreground">
                        Shifts: {d.shifts}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
            {myShiftHistory.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No shift history yet
              </p>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="space-y-2 md:hidden">
                  {myShiftHistory.slice(0, 20).map((s) => {
                    const isActive = !s.shiftEnd;
                    const hours = isActive
                      ? getElapsedHours(s.shiftStart, s.shiftEnd, currentTime)
                      : (s.totalHours ?? 0);
                    return (
                      <div
                        key={s.id}
                        className="rounded-lg border bg-slate-50/50 p-3 text-sm grid grid-cols-2 gap-x-3 gap-y-1"
                      >
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-medium">
                          {new Date(s.shiftStart).toLocaleDateString("en-IN")}
                        </span>
                        <span className="text-muted-foreground">In</span>
                        <span>
                          {new Date(s.shiftStart).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="text-muted-foreground">Out</span>
                        <span>
                          {s.shiftEnd
                            ? new Date(s.shiftEnd).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </span>
                        <span className="text-muted-foreground">Hours</span>
                        <span className="font-medium">
                          {formatHours(hours, isActive)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop: table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        <th className="p-2 font-medium">Date</th>
                        <th className="p-2 font-medium">In</th>
                        <th className="p-2 font-medium">Out</th>
                        <th className="p-2 font-medium text-right">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myShiftHistory.slice(0, 20).map((s) => {
                        const isActive = !s.shiftEnd;
                        const hours = isActive
                          ? getElapsedHours(
                              s.shiftStart,
                              s.shiftEnd,
                              currentTime,
                            )
                          : (s.totalHours ?? 0);
                        return (
                          <tr key={s.id} className="border-b last:border-b-0">
                            <td className="p-2">
                              {new Date(s.shiftStart).toLocaleDateString(
                                "en-IN",
                              )}
                            </td>
                            <td className="p-2">
                              {new Date(s.shiftStart).toLocaleTimeString(
                                "en-IN",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </td>
                            <td className="p-2">
                              {s.shiftEnd
                                ? new Date(s.shiftEnd).toLocaleTimeString(
                                    "en-IN",
                                    { hour: "2-digit", minute: "2-digit" },
                                  )
                                : "—"}
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
    ],
  );

  const profileSectionContent = useMemo(
    () => (
      <div className="space-y-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold sm:text-xl">My Profile</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Your account details
          </p>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                <AvatarFallback className="bg-emerald-100 text-emerald-600 text-xl sm:text-2xl">
                  {profile?.name?.charAt(0) ?? "E"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <CardTitle className="text-lg">
                  {profile?.name ?? "Employee"}
                </CardTitle>
                <CardDescription>
                  {profile?.employeeCode ?? "—"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Separator className="mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{profile?.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Employee Code</p>
                <p className="text-sm font-medium">
                  {profile?.employeeCode ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Branch</p>
                <p className="text-sm font-medium">
                  {profile?.branch?.name ?? "—"}
                </p>
              </div>
              {profile?.phone && (
                <div>
                  <p className="text-xs text-muted-foreground">Mobile</p>
                  <p className="text-sm font-medium">{profile.phone}</p>
                </div>
              )}
              {profile?.address && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="text-sm font-medium">
                    {profile.address}
                    {profile.pincode ? ` - ${profile.pincode}` : ""}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    ),
    [profile],
  );

  const performanceSectionContent = useMemo(
    () => (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold sm:text-xl">Performance</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Live API speed and traffic (employee requests).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(apiPerfWindowMinutes)}
              onValueChange={(v) => setApiPerfWindowMinutes(Number(v) || 60)}
            >
              <SelectTrigger className="w-full sm:w-[150px] min-w-0 min-h-[44px] sm:min-h-0">
                <SelectValue placeholder="Window" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">Last 15 min</SelectItem>
                <SelectItem value="60">Last 60 min</SelectItem>
                <SelectItem value="360">Last 6 hours</SelectItem>
                <SelectItem value="1440">Last 24 hours</SelectItem>
              </SelectContent>
            </Select>
            <LoaderButton
              size="sm"
              variant="outline"
              loading={apiPerfLoading}
              loadingLabel="Refreshing..."
              onClick={loadApiPerf}
              className="min-h-[44px] sm:min-h-0"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </LoaderButton>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Requests / min</p>
              <p className="mt-1 text-lg font-bold">
                {overallApiPerf.rpm ? overallApiPerf.rpm.toFixed(1) : "0.0"}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">API Avg (ms)</p>
              <p className="mt-1 text-lg font-bold">{overallApiPerf.avgMs}</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">API P95 (ms)</p>
              <p className="mt-1 text-lg font-bold text-amber-700">
                {overallApiPerf.p95Ms}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Errors (5xx)</p>
              <p className="mt-1 text-lg font-bold text-red-600">
                {overallApiPerf.totalErrorCount}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total requests</p>
              <p className="mt-1 text-lg font-bold">
                {overallApiPerf.totalCount}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Slow APIs (by P95)</CardTitle>
            <CardDescription className="text-xs">
              Endpoints with traffic and latency (employee traffic).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {apiPerfLoading && !apiPerf ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : (apiPerf?.rows?.length ?? 0) === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No API traffic in this window yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>API</TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Hits
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Avg (ms)
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        P95 (ms)
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        5xx
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(apiPerf?.rows ?? []).map((r) => (
                      <TableRow key={r.key}>
                        <TableCell className="font-medium">{r.key}</TableCell>
                        <TableCell className="text-right">{r.count}</TableCell>
                        <TableCell className="text-right">
                          {Math.round(r.avgMs)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-amber-700">
                          {Math.round(r.p95Ms)}
                        </TableCell>
                        <TableCell className="text-right text-red-600 font-semibold">
                          {r.errorCount}
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
    ),
    [
      apiPerf,
      apiPerfLoading,
      apiPerfWindowMinutes,
      loadApiPerf,
      overallApiPerf.avgMs,
      overallApiPerf.p95Ms,
      overallApiPerf.rpm,
      overallApiPerf.totalCount,
      overallApiPerf.totalErrorCount,
    ],
  );

  const StartShiftPromptDialog = () => (
    <Dialog
      open={showStartShiftPrompt}
      onOpenChange={(open) => {
        setShowStartShiftPrompt(open);
        if (!open)
          window.sessionStorage.setItem(
            "dm_shift_prompt_dismissed_" +
              new Date().toISOString().slice(0, 10),
            "1",
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
              ? "You already completed a shift today. You can start again tomorrow."
              : "To accept orders and track working time, please start your shift."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              window.sessionStorage.setItem(
                "dm_shift_prompt_dismissed_" +
                  new Date().toISOString().slice(0, 10),
                "1",
              );
              setShowStartShiftPrompt(false);
            }}
          >
            {endedShiftToday ? "Close" : "Not now"}
          </Button>
          {!endedShiftToday && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
      newOrderPopupOrders.map((order) => (
        <div
          key={order.id}
          className="rounded-lg border-2 border-emerald-200 bg-emerald-50/50 p-3 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">
              Table {order.table?.tableNumber || order.table?.id || "?"}
            </span>
            <Badge className={getPriorityBadgeClass(order)}>
              {getPriorityLabel(order)}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-0.5">
            Order #{order.id} · {formatPopupTime(order.createdAt)}
          </p>
          <ul className="mt-2 space-y-0.5 font-medium text-slate-800">
            {order.items.filter((i) => !i.isRemoved).map((item) => (
              <li key={item.id}>
                {item.quantity}×{" "}
                {formatItemDisplayName(item.name, item.variant)}
              </li>
            ))}
          </ul>
          <p className="font-bold mt-2 text-emerald-700">
            {formatINR(order.totalAmount)}
          </p>
        </div>
      )),
    [newOrderPopupOrders],
  );

  const NewOrderPopupDialog = () => {
    if (newOrderPopupOrders.length === 0) return null;
    return (
      <Dialog
        open={newOrderPopupOrders.length > 0}
        onOpenChange={(open) => {
          if (!open) setNewOrderPopupOrders([]);
        }}
      >
        <DialogContent
          className="max-w-md"
          aria-describedby="new-order-popup-desc"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              New order(s) received
            </DialogTitle>
            <DialogDescription id="new-order-popup-desc">
              {newOrderPopupOrders.length} new order
              {newOrderPopupOrders.length !== 1 ? "s" : ""} need your attention.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[280px] pr-2">
            <div className="space-y-3">{newOrderPopupCards}</div>
          </ScrollArea>
          <div className="mt-3 rounded-lg border bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">
                  New order sound
                </div>
                <div className="text-xs text-slate-600">
                  Choose a louder ringtone and volume.
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  playNewOrderSound(newOrderSoundPreset, newOrderSoundVolume)
                }
              >
                Test
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-700">
                  Sound
                </span>
                <select
                  className="h-10 rounded-md border bg-white px-3 text-sm"
                  value={newOrderSoundPreset}
                  onChange={(e) =>
                    setNewOrderSoundPreset(
                      e.target.value as NewOrderSoundPreset,
                    )
                  }
                >
                  <option value="ring">Ring (loud)</option>
                  <option value="siren">Siren (very loud)</option>
                  <option value="chime">Chime</option>
                  <option value="beep">Beep</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-700">
                  Volume: {Math.round(newOrderSoundVolume * 100)}%
                </span>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={newOrderSoundVolume}
                  onChange={(e) => setNewOrderSoundVolume(Number(e.target.value))}
                />
              </label>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => setNewOrderPopupOrders([])}
            >
              Dismiss
            </Button>
            <Button
              onClick={() => {
                setActiveSection("live");
                setNewOrderPopupOrders([]);
              }}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
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
    [popupDisplayOrder, selectedOrder],
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
        title="Completed Orders"
        loading={loading}
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
      loading,
      actionOrderId,
      openOrderPopup,
      confirmPayment,
      formatINR,
      getStatusColor,
      formatTimeToComplete,
    ],
  );
  const pendingSectionContent = useMemo(
    () => (
      <OrdersTableSection
        orders={pendingPayments}
        title="Pending Payments"
        loading={loading}
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
      loading,
      actionOrderId,
      openOrderPopup,
      confirmPayment,
      formatINR,
      getStatusColor,
      formatTimeToComplete,
    ],
  );
  const paidSectionContent = useMemo(
    () => (
      <OrdersTableSection
        orders={paidOrders}
        title="Paid Orders"
        loading={loading}
        showConfirmPayment={false}
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
      loading,
      actionOrderId,
      openOrderPopup,
      confirmPayment,
      formatINR,
      getStatusColor,
      formatTimeToComplete,
    ],
  );

  // Memoize entire content tree so cards do NOT re-render when only clock/other unrelated state updates
  const content = useMemo(
    () => (
      <div className="w-full min-h-full space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6 relative animate-fade-in">
        {activeSection === "dashboard" && dashboardOverviewContent}
        {activeSection === "live" && liveOrdersSectionContent}
        {activeSection === "add-order" && (
          <AddOrderSection
            branchId={profile?.branchId ?? profile?.branch?.id}
            token={token}
            onOrderPlaced={(orderId) => {
              // Navigate to live orders after placing
              setTimeout(() => setActiveSection("live"), 1500);
            }}
          />
        )}
        {activeSection === "all-orders" && (
          <OrdersTableSection
            orders={allOrders}
            title="All Orders"
            loading={loading}
            showConfirmPayment={true}
            onViewOrder={openOrderPopup}
            onConfirmPayment={confirmPayment}
            actionOrderId={actionOrderId}
            formatINR={formatINR}
            getStatusColor={getStatusColor}
            formatTimeToComplete={formatTimeToComplete}
          />
        )}
        {activeSection === "completed" && completedSectionContent}
        {activeSection === "pending" && pendingSectionContent}
        {activeSection === "paid" && paidSectionContent}
        {activeSection === "performance" && performanceSectionContent}
        {activeSection === "shift" && shiftSectionContent}
        {activeSection === "profile" && profileSectionContent}
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
      completedSectionContent,
      pendingSectionContent,
      paidSectionContent,
      performanceSectionContent,
      shiftSectionContent,
      profileSectionContent,
      loading,
      openOrderPopup,
      confirmPayment,
      actionOrderId,
      formatINR,
      getStatusColor,
      formatTimeToComplete,
    ],
  );

  const companyLogoUrl =
    typeof window !== "undefined"
      ? window.localStorage.getItem("branch_logo_url")
      : null;

  // Skeleton layout so UI feels fast – no blank full-page spinner
  if (loading && !hasLoadedOnce) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <header className="h-14 border-b bg-white shrink-0" />
        <div className="flex-1 flex gap-4 p-4">
          <aside className="w-52 rounded-lg bg-slate-200/60 animate-pulse shrink-0" />
          <main className="flex-1 space-y-4 min-w-0">
            <div className="h-8 w-48 rounded bg-slate-200/60 animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl bg-slate-200/60 animate-pulse"
                />
              ))}
            </div>
            <div className="h-64 rounded-xl bg-slate-200/60 animate-pulse" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell
      role="EMPLOYEE"
      userName={profile?.name ?? "Employee"}
      branchName={
        profile?.branch?.name &&
        !/^main(\s+branch)?$/i.test(profile.branch.name.trim())
          ? profile.branch.name.trim()
          : "Gautam Nagar"
      }
      sidebarItems={sidebarItems}
      activeKey={activeSection}
      onSelect={setActiveSection}
      sidebarBadges={
        liveOrders.length > 0 ? { live: liveOrders.length } : undefined
      }
      companyLogoUrl={companyLogoUrl || undefined}
    >
      <div className="relative">
        {loading && hasLoadedOnce && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-xl bg-white/80 px-5 py-4 shadow-lg border border-slate-200">
              <div className="h-8 w-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-600">Loading data…</p>
            </div>
          </div>
        )}
        {content}
      </div>
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
        markStatus={markStatus}
        confirmPayment={confirmPayment}
        modifyOrder={modifyOrder}
        isModifying={isModifying}
        actionOrderId={actionOrderId}
        selectedOrder={selectedOrder}
      />
    </DashboardShell>
  );
};

export default EmployeeDashboard;
