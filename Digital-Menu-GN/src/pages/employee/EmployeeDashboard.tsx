import { useEffect, useMemo, useState, useRef, useCallback, memo } from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import toast from "react-hot-toast";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_BASE_URL, ORDER_STATUS_COLORS, BREAK_TIME_MINUTES, formatBreakTime } from "@/constants";

const apiBase = API_BASE_URL;

/** Delay threshold for "Delayed" order (ms) */
const DELAYED_ORDER_MINUTES = 2;
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
  return new Date(createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/** True if two ISO date strings are the same calendar day (local time). */
function isSameDay(iso1: string, iso2: string): boolean {
  const d1 = new Date(iso1);
  const d2 = new Date(iso2);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

/** Elapsed hours between shift start and end (or asOf if no end). */
function getElapsedHours(shiftStart: string, shiftEnd: string | null | undefined, asOf: Date): number {
  const start = new Date(shiftStart).getTime();
  const end = shiftEnd ? new Date(shiftEnd).getTime() : asOf.getTime();
  return Math.max(0, (end - start) / 3600000);
}

/** Show only selected size: HALF → 5pc, FULL → 8pc. Strip "(5pc / 8pc)" from name so staff see e.g. "Paneer Fried Momos (8pc)". */
function formatItemDisplayName(name: string, variant?: string | null): string {
  const base = name.replace(/\s*\(5pc\s*\/\s*8pc\)\s*/gi, "").trim() || name;
  if (variant === "HALF") return `${base} (5pc)`;
  if (variant === "FULL") return `${base} (8pc)`;
  if (variant) return `${base} (${variant})`;
  return base;
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
function playNewOrderSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (_) {}
}

type OrderItem = {
  id: number;
  name: string;
  quantity: number;
  price: number;
  variant?: string | null;
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
  table?: TableInfo | null;
  items: OrderItem[];
  customerName?: string | null;
  customerMobile?: string | null;
  employee?: { id: number; name: string; employeeCode: string; role?: string | null } | null;
  branch?: { id: number; name: string; location?: string | null } | null;
};

const sidebarItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "live", label: "Live Orders", icon: ShoppingCart },
  { key: "completed", label: "Completed", icon: CheckCircle },
  { key: "pending", label: "Pending Payment", icon: CreditCard },
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
          View order details, items, and customer information. Edit customer name and mobile for WhatsApp updates.
        </DialogDescription>
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Order #{displayOrder.id}</h2>
            <p className="text-lg font-semibold text-muted-foreground mt-0.5">
              Table {displayOrder.table?.tableNumber || displayOrder.table?.id || "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {displayOrder.branch?.name && <span>{displayOrder.branch.name}</span>}
              {displayOrder.branch?.name && " · "}
              {formatPopupTime(displayOrder.createdAt)}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 min-h-[44px] min-w-[44px]" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
        {displayOrder.employee && (
          <p className="text-xs text-muted-foreground mb-3">
            Accepted by {displayOrder.employee.name}
            {displayOrder.employee.role ? ` (${displayOrder.employee.role})` : ""}
          </p>
        )}

        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <h4 className="font-medium text-sm">Customer</h4>
          {isCompletedViewOnly ? (
            <div className="text-sm flex flex-wrap items-center gap-x-4 gap-y-0">
              <span className="font-medium text-foreground">{displayOrder.customerName ?? "—"}</span>
              {displayOrder.customerMobile && <span className="text-muted-foreground">📞 {displayOrder.customerMobile}</span>}
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
                    onChange={(e) => setPopupCustomerMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="mt-1"
                  />
                </div>
              </div>
              {(!displayOrder.customerMobile || popupCustomerMobile !== displayOrder.customerMobile || popupCustomerName !== (displayOrder.customerName ?? "")) && (
                <Button size="sm" disabled={savingCustomer || popupCustomerMobile.replace(/\D/g, "").length !== 10} onClick={saveOrderCustomer}>
                  {savingCustomer ? "Saving..." : "Save customer"}
                </Button>
              )}
              {!displayOrder.customerMobile && (
                <p className="text-xs text-amber-600">Save mobile to send order details, payment status & review link via WhatsApp.</p>
              )}
            </>
          )}
        </div>

        <div className="space-y-6">
          {!isCompletedViewOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={displayOrder.status === "ACCEPTED" ? "default" : "outline"}
                className={["PREPARING", "SERVED", "ORDER_COMPLETE"].includes(displayOrder.status) ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-100" : ""}
                onClick={() => selectedOrder && markStatus(selectedOrder.id, "ACCEPTED")}
                disabled={displayOrder.status === "ORDER_COMPLETE" || (selectedOrder && actionOrderId === selectedOrder.id)}
              >
                {selectedOrder && actionOrderId === selectedOrder.id ? <span className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" /> : <CheckCircle className="mr-1 h-4 w-4" />}
                Accept
              </Button>
              <Button
                size="sm"
                variant={displayOrder.status === "PREPARING" ? "default" : "outline"}
                className={["SERVED", "ORDER_COMPLETE"].includes(displayOrder.status) ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-100" : ""}
                onClick={() => selectedOrder && markStatus(selectedOrder.id, "PREPARING")}
                disabled={displayOrder.status === "ORDER_COMPLETE" || displayOrder.status === "NEW_ORDER" || (selectedOrder && actionOrderId === selectedOrder.id)}
              >
                <ChefHat className="mr-1 h-4 w-4" />
                Preparing
              </Button>
              <Button
                size="sm"
                variant={displayOrder.status === "SERVED" ? "default" : "outline"}
                className={displayOrder.status === "ORDER_COMPLETE" ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-100" : ""}
                onClick={() => selectedOrder && markStatus(selectedOrder.id, "SERVED")}
                disabled={displayOrder.status === "ORDER_COMPLETE" || displayOrder.status === "NEW_ORDER" || displayOrder.status === "ACCEPTED" || (selectedOrder && actionOrderId === selectedOrder.id)}
              >
                <Utensils className="mr-1 h-4 w-4" />
                Served
              </Button>
              <Button
                size="sm"
                variant={displayOrder.status === "ORDER_COMPLETE" ? "default" : "outline"}
                className={displayOrder.status === "ORDER_COMPLETE" ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-100" : ""}
                onClick={() => selectedOrder && markStatus(selectedOrder.id, "ORDER_COMPLETE")}
                disabled={selectedOrder ? actionOrderId === selectedOrder.id : true}
              >
                <CheckCircle className="mr-1 h-4 w-4" />
                Complete
              </Button>
              <div className="flex-1 min-w-[60px]" />
              <Button
                size="sm"
                variant="destructive"
                onClick={() => selectedOrder && markStatus(selectedOrder.id, "CANCELLED")}
                disabled={displayOrder.status === "ORDER_COMPLETE" || (selectedOrder && actionOrderId === selectedOrder.id)}
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
                  className={displayOrder.paymentStatus === "PAID" ? "bg-green-100 text-green-800 border-green-300 w-fit" : "bg-amber-100 text-amber-800 border-amber-300 w-fit"}
                >
                  {displayOrder.paymentStatus === "PAID" ? "Paid" : "Pending"}
                </Badge>
                {displayOrder.paymentStatus !== "PAID" && selectedOrder && (
                  <Button
                    className="w-full min-h-[48px] rounded-lg sm:w-auto bg-emerald-600 hover:bg-emerald-700"
                    disabled={actionOrderId === selectedOrder.id}
                    onClick={() => confirmPayment(selectedOrder.id)}
                  >
                    {actionOrderId === selectedOrder.id ? <span className="inline-block h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <CreditCard className="mr-2 h-5 w-5" />}
                    Mark Paid
                  </Button>
                )}
              </div>
            </div>
          )}

          <div>
            <h4 className="font-medium mb-3">Order Items</h4>
            <div className="space-y-2">
              {displayOrder.items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    !isCompletedViewOnly && removedItemIds.includes(item.id) ? "opacity-50 bg-red-50" : ""
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
                        {item.quantity} × {formatItemDisplayName(item.name, item.variant)}
                      </p>
                      {!isCompletedViewOnly && removedItemIds.includes(item.id) && <p className="text-sm text-red-600">Will be removed</p>}
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
                  <label className="text-sm font-medium mb-2 block">Removal Reason</label>
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
                    <span className="font-medium">{formatINR(displayOrder.totalAmount)}</span>
                  </div>
                  {removedItemIds.length > 0 && (
                    <>
                      <div className="flex justify-between text-red-600">
                        <span>Items to Remove:</span>
                        <span className="font-medium">
                          -{formatINR(displayOrder.items.filter((item) => removedItemIds.includes(item.id)).reduce((sum, item) => sum + item.price * item.quantity, 0))}
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
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                {removedItemIds.length > 0 && (
                  <Button onClick={modifyOrder} disabled={isModifying} className="bg-red-600 hover:bg-red-700">
                    {isModifying ? "Removing..." : `Remove ${removedItemIds.length} Item(s)`}
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
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

const EmployeeDashboard = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  /** Frozen snapshot for modal display – only updated on open or user action, so popup doesn't flash on parent re-renders (clock/poll). */
  const [popupDisplayOrder, setPopupDisplayOrder] = useState<Order | null>(null);
  const [isOrderPopupOpen, setIsOrderPopupOpen] = useState(false);
  const [removedItemIds, setRemovedItemIds] = useState<number[]>([]);
  const [modificationReason, setModificationReason] = useState("Item not available");
  const [isModifying, setIsModifying] = useState(false);
  const [shiftActive, setShiftActive] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [actionOrderId, setActionOrderId] = useState<number | null>(null);
  /** Only the card where Accept was clicked shows "Accepting..." – prevents other cards showing loading */
  const [acceptingOrderId, setAcceptingOrderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
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
    { id: number; shiftStart: string; shiftEnd: string | null; totalHours: number | null; totalSales: number | null }[]
  >([]);
  const [myDailyShiftStats, setMyDailyShiftStats] = useState<
    { date: string; totalHours: number; totalSales: number; shifts: number }[]
  >([]);
  const [showStartShiftPrompt, setShowStartShiftPrompt] = useState(false);
  const prevNewOrderCountRef = useRef(0);

  const token = window.sessionStorage.getItem("dm_auth_token");

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

  // New order sound when popup gets new orders (real-time notification)
  useEffect(() => {
    const n = newOrderPopupOrders.length;
    if (n > prevNewOrderCountRef.current) {
      playNewOrderSound();
    }
    prevNewOrderCountRef.current = n;
  }, [newOrderPopupOrders.length]);

  const [profile, setProfile] = useState<{ name: string; email: string; employeeCode: string; branchId?: number; branch?: { id: number; name: string }; phone?: string; salary?: number; address?: string; pincode?: string } | null>(null);

  useEffect(() => {
    isOrderPopupOpenRef.current = isOrderPopupOpen;
  }, [isOrderPopupOpen]);

  useEffect(() => {
    if (!token) {
      window.location.href = "/login";
      return;
    }
    // Don't set up polling while order popup is open – keeps cards stable
    if (isOrderPopupOpen) return;

    async function loadOrders() {
      if (isOrderPopupOpenRef.current) return;
      try {
        const res = await fetch(`${apiBase}/orders/live`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          window.sessionStorage.removeItem("dm_auth_token");
          window.sessionStorage.removeItem("dm_auth_role");
          window.location.href = "/login";
          return;
        }
        if (!res.ok) {
          setOrders((prev) => (prev.length ? prev : []));
          return;
        }
        const data = await res.json();
        if (isOrderPopupOpenRef.current) return;
        setOrders((prev) => {
          const canShowPopup = hasCompletedFirstLoad.current && prev.length > 0 && data.length > prev.length && !pauseNewOrderPopup;
          if (canShowPopup) {
            const prevIds = new Set(prev.map((o) => o.id));
            const newOrders = data.filter((d: Order) => !prevIds.has(d.id));
            if (newOrders.length > 0) {
              setNewOrderPopupOrders((popup) => [...newOrders, ...popup]);
              setTimeout(() => toast.success(`${newOrders.length} new order(s) received.`), 100);
            }
          }
          const next = mergeOrders(prev, data);
          if (prev.length === 0 && next.length >= 0) hasCompletedFirstLoad.current = true;
          return next;
        });
      } catch {
        setOrders((prev) => (prev.length ? prev : []));
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
    const id = window.setInterval(() => {
      if (isOrderPopupOpenRef.current) return;
      loadOrders();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [token, isOrderPopupOpen]);

  useEffect(() => {
    if (!token) return;
    fetch(`${apiBase}/employees/me`, { headers: { Authorization: `Bearer ${token}` } })
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
    fetch(`${apiBase}/shift/current`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.active) setShiftActive(true);
        if (data?.shift) setCurrentShift(data.shift);
        if (!data?.active) {
          const todayKey = "dm_shift_prompt_dismissed_" + new Date().toISOString().slice(0, 10);
          const dismissedToday = window.sessionStorage.getItem(todayKey) === "1";
          if (!dismissedToday) setShowStartShiftPrompt(true);
        }
      })
      .catch(() => {});
  }, [token]);

  // Load employee shift history (daily in/out + hours)
  useEffect(() => {
    if (!token) return;
    fetch(`${apiBase}/shift/my-history`, { headers: { Authorization: `Bearer ${token}` } })
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
    (s) => s.shiftEnd && isSameDay(typeof s.shiftEnd === "string" ? s.shiftEnd : new Date(s.shiftEnd).toISOString(), todayIso)
  );

  const startShift = async () => {
    if (!token) return;
    // One shift per day: cannot start again after ending a shift the same day
    if (endedShiftToday) {
      toast.error("You already completed a shift today. You can start again tomorrow.");
      return;
    }
    if (shiftActive && currentShift) {
      toast.error("You already have an active shift. End it first.");
      return;
    }
    const openShift = myShiftHistory.find((s) => !s.shiftEnd);
    if (openShift) {
      if (isSameDay(openShift.shiftStart, todayIso)) {
        toast.error("You already started a shift today. End it first or contact admin.");
      } else {
        toast.error("Please end your previous shift first. Contact admin if you need help.");
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
        fetch(`${apiBase}/shift/my-history`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => { if (d) { setMyShiftHistory(d.shifts ?? []); setMyDailyShiftStats(d.dailyStats ?? []); } })
          .catch(() => {});
      } else {
        const data = await res.json().catch(() => ({}));
        const alreadyActive = res.status === 400 && data.message === "Shift already active";
        if (alreadyActive) {
          setShiftActive(true);
          toast.success("You're already on an active shift.");
          // refresh shift info
          fetch(`${apiBase}/shift/current`, { headers: { Authorization: `Bearer ${token}` } })
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
        fetch(`${apiBase}/shift/my-history`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => { if (d) { setMyShiftHistory(d.shifts ?? []); setMyDailyShiftStats(d.dailyStats ?? []); } })
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
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, ...updated, employeeId: updated.employeeId ?? updated.employee?.id, employee: updated.employee, acceptedAt: updated.acceptedAt ?? o.acceptedAt } : o)),
        );
        setSelectedOrder((prev) => (prev && prev.id === orderId ? { ...prev, ...updated } : prev));
        toast.success(data.message || "You are now handling this order.");
        if (data.statusWaMeLink) window.open(data.statusWaMeLink, "_blank");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "Order may already be accepted by someone else");
      }
    } catch {
      toast.error("Failed to accept order");
    } finally {
      setAcceptingOrderId(null);
    }
  };

  const markStatus = useCallback(async (orderId: number, status: string) => {
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
          prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status, completedAt: updated.completedAt ?? o.completedAt } : o)),
        );
        setSelectedOrder((prev) => (prev && prev.id === orderId ? { ...prev, status: updated.status, completedAt: updated.completedAt ?? prev.completedAt } : prev));
        setPopupDisplayOrder((prev) => (prev && prev.id === orderId ? { ...prev, status: updated.status, completedAt: updated.completedAt ?? prev.completedAt } : prev));
        if (data.statusWaMeLink) {
          window.open(data.statusWaMeLink, "_blank");
          toast.success("Opening WhatsApp to send status update to customer. Allow popups if the window did not open.", { duration: 6000 });
        } else {
          toast.success(data.message || `Order marked as ${status.replace("_", " ").toLowerCase()}`);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Failed to update status");
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setActionOrderId(null);
    }
  }, [token]);

  const confirmPayment = useCallback(async (orderId: number) => {
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
          prev.map((o) => (o.id === orderId ? { ...o, paymentStatus: order.paymentStatus ?? "PAID" } : o)),
        );
        setSelectedOrder((prev) => (prev && prev.id === orderId ? { ...prev, paymentStatus: order.paymentStatus ?? "PAID" } : prev));
        setPopupDisplayOrder(null);
        setIsOrderPopupOpen(false);
        setSelectedOrder(null);
        fetch(`${apiBase}/shift/current`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d?.shift && setCurrentShift(d.shift))
          .catch(() => {});
        if (data.paymentWaMeLink) {
          const win = window.open(data.paymentWaMeLink, "_blank", "noopener,noreferrer");
          if (!win || win.closed === undefined) {
            toast.error("Popup blocked. Allow popups for this site to open WhatsApp and send receipt to customer.", { duration: 8000 });
            toast.info("You can copy the receipt link from the address bar after allowing popups and retry Mark Paid.", { duration: 6000 });
          } else {
            toast.success("WhatsApp opened – send the receipt to the customer.");
          }
        } else {
          if (!order.customerMobile || !order.customerName) {
            toast.success("Payment marked as received. Save customer name & mobile before marking paid to send WhatsApp receipt next time.");
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
  }, [token, orders]);

  const openOrderPopup = useCallback((order: Order) => {
    setSelectedOrder(order);
    setPopupDisplayOrder(typeof structuredClone === "function" ? structuredClone(order) : JSON.parse(JSON.stringify(order)));
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
      const res = await fetch(`${apiBase}/orders/${selectedOrder.id}/customer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customerMobile: mobile,
          customerName: popupCustomerName.trim() || undefined,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? { ...o, customerName: updated.customerName, customerMobile: updated.customerMobile } : o)));
        setSelectedOrder((prev) => (prev && prev.id === selectedOrder.id ? { ...prev, customerName: updated.customerName, customerMobile: updated.customerMobile } : prev));
        setPopupDisplayOrder((prev) => (prev && prev.id === selectedOrder.id ? { ...prev, customerName: updated.customerName, customerMobile: updated.customerMobile } : prev));
        toast.success((updated as { message?: string }).message || "Customer mobile saved. WhatsApp updates will be sent to this number.");
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
        : [...prev, itemId]
    );
  }, []);

  const modifyOrder = useCallback(async () => {
    if (!selectedOrder || !token || removedItemIds.length === 0) return;
    setIsModifying(true);
    try {
      const res = await fetch(`${apiBase}/orders/${selectedOrder.id}/modify`, {
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
          prev.map((o) => (o.id === selectedOrder.id ? data.order : o))
        );
        toast.success(data.message || `Removed ${data.removedItems?.length ?? 0} item(s). New total: ${formatINR(data.newAmount ?? 0)}`);
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
    const pendingPayments = orders.filter((o) => o.status === "ORDER_COMPLETE" && o.paymentStatus !== "PAID").length;
    const salesToday = currentShift?.totalSales ?? 0;
    return { ordersToday, completed, paid, pendingPayments, salesToday };
  }, [orders, currentShift]);

  // Live = all unpaid orders. Sort: ready for payment (ORDER_COMPLETE) first, then in-progress.
  const liveOrdersRaw = orders.filter((o) => o.paymentStatus !== "PAID");
  const liveOrders = useMemo(
    () => [...liveOrdersRaw].sort((a, b) => (a.status === "ORDER_COMPLETE" && b.status !== "ORDER_COMPLETE" ? -1 : b.status === "ORDER_COMPLETE" && a.status !== "ORDER_COMPLETE" ? 1 : 0)),
    [liveOrdersRaw],
  );
  const completedOrders = useMemo(() => orders.filter((o) => o.paymentStatus === "PAID"), [orders]);
  const pendingPayments = useMemo(() => orders.filter((o) => o.status === "ORDER_COMPLETE" && o.paymentStatus !== "PAID"), [orders]);
  const paidOrders = useMemo(() => orders.filter((o) => o.paymentStatus === "PAID"), [orders]);

  const getStatusColor = useCallback((status: string) =>
    ORDER_STATUS_COLORS[status] ?? "bg-slate-100 text-slate-800", []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "NEW_ORDER": return <Bell className="h-3 w-3" />;
      case "ACCEPTED": return <CheckCircle className="h-3 w-3" />;
      case "PREPARING": return <ChefHat className="h-3 w-3" />;
      case "SERVED": return <Utensils className="h-3 w-3" />;
      case "ORDER_COMPLETE": return <CheckCircle className="h-3 w-3" />;
      default: return null;
    }
  };

  /** Order is delayed if NEW_ORDER/ACCEPTED and older than 2 minutes */
  const isOrderDelayed = (order: Order) => {
    if (order.status !== "NEW_ORDER" && order.status !== "ACCEPTED") return false;
    return Date.now() - new Date(order.createdAt).getTime() > DELAYED_ORDER_MS;
  };

  /** Priority label for POS-style visibility */
  const getPriorityLabel = (order: Order): string => {
    if (isOrderDelayed(order)) return "Delayed";
    switch (order.status) {
      case "NEW_ORDER": return "New Order";
      case "ACCEPTED":
      case "PREPARING":
      case "SERVED": return "Preparing";
      case "ORDER_COMPLETE": return "Completed";
      default: return order.status.replace("_", " ");
    }
  };

  /** Badge style: green New, yellow Preparing, red Delayed, green Completed */
  const getPriorityBadgeClass = (order: Order): string => {
    if (isOrderDelayed(order)) return "bg-red-100 text-red-800 border border-red-300";
    switch (order.status) {
      case "NEW_ORDER": return "bg-emerald-100 text-emerald-800 border border-emerald-300";
      case "ACCEPTED":
      case "PREPARING":
      case "SERVED": return "bg-amber-100 text-amber-800 border border-amber-300";
      case "ORDER_COMPLETE": return "bg-green-100 text-green-800 border border-green-300";
      default: return getStatusColor(order.status);
    }
  };

  const renderOrderCard = (order: Order, options?: { isCompletedSection?: boolean; isLiveSection?: boolean }) => {
    const delayed = isOrderDelayed(order);
    const isReadyForPayment = options?.isLiveSection && order.status === "ORDER_COMPLETE";
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
    const completedCardStyle = options?.isCompletedSection ? "border-l-4 border-l-green-600 bg-green-50/50" : "";
    const defaultCardStyle = !options?.isLiveSection && !options?.isCompletedSection ? "border-l-4 border-l-emerald-500" : "";
    const isAcceptingThis = acceptingOrderId === order.id;
    const isActionThis = actionOrderId === order.id;

    // Completed (ready for payment): Order # + Table + Payment Status (prominent), View Order, Confirm Payment.
    const compactCompletedBlock = isReadyForPayment && (
      <div className="flex flex-col gap-2 p-3 min-h-0">
        <div className="font-bold text-base text-slate-900">Order #{order.id}</div>
        <div className="font-semibold text-sm truncate text-slate-700">Table {order.table?.tableNumber || order.table?.id || "?"}</div>
        {options?.isLiveSection && <p className="font-bold text-emerald-700">{formatINR(order.totalAmount)}</p>}
        {order.acceptedAt && order.completedAt && (
          <p className="text-xs text-slate-600">Time to complete: {formatTimeToComplete(order.acceptedAt, order.completedAt)}</p>
        )}
        <Badge
          variant={order.paymentStatus === "PAID" ? "default" : "secondary"}
          className={`w-fit shrink-0 text-sm font-semibold px-3 py-1 ${order.paymentStatus === "PAID" ? "bg-green-100 text-green-800 border-green-300" : "bg-red-100 text-red-800 border-red-300"}`}
        >
          {order.paymentStatus === "PAID" ? "Paid" : "Not Paid"}
        </Badge>
        <div className="flex flex-col gap-2 mt-auto w-full">
          <Button size="sm" variant="outline" className="w-full min-h-[44px] text-xs" onClick={(e) => { e.stopPropagation(); openOrderPopup(order); }}>
            <Eye className="mr-1 h-3 w-3 shrink-0" /><span className="truncate">View Order</span>
          </Button>
          {order.paymentStatus !== "PAID" && (
            <Button
              size="sm"
              className="w-full min-h-[44px] text-xs rounded-lg"
              disabled={isActionThis || order.status !== "ORDER_COMPLETE"}
              onClick={(e) => { e.stopPropagation(); confirmPayment(order.id); }}
            >
              {isActionThis ? <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" /> : <CreditCard className="mr-1 h-4 w-4 shrink-0" />}
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
      <CardContent className={`flex-1 flex flex-col min-h-0 ${isReadyForPayment ? "p-2 sm:p-3" : "p-2 sm:p-4"}`}>
        {compactCompletedBlock}
        {!isReadyForPayment && (
        <div className="flex flex-col flex-1" onClick={(e) => e.stopPropagation()}>
        {/* Priority badge + Order # + Time ago (POS-style) */}
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <Badge className={`shrink-0 text-[10px] sm:text-xs font-semibold ${getPriorityBadgeClass(order)}`}>
            {getPriorityLabel(order)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            #{order.id} · {timeAgo(order.createdAt)}
          </span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-base sm:text-lg truncate">
                Table {order.table?.tableNumber || order.table?.id || "?"}
              </span>
              {order.customerMobile && (
                <span className="text-xs text-muted-foreground truncate max-w-[100px] sm:max-w-[120px]" title={order.customerMobile}>
                  {order.customerMobile.slice(-4).padStart(10, "•")}
                </span>
              )}
              <Badge className={`shrink-0 ${getStatusColor(order.status)}`}>
                <span className="flex items-center gap-1">
                  {getStatusIcon(order.status)}
                  <span className="hidden sm:inline">{order.status}</span>
                </span>
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {new Date(order.createdAt).toLocaleTimeString()}
            </p>
            {order.employee && (
              <p className="text-xs text-emerald-700 font-medium">Accepted by {order.employee.name}</p>
            )}
            {order.status === "ORDER_COMPLETE" && order.acceptedAt && order.completedAt && (
              <p className="text-xs text-slate-600 font-medium">Time to complete: {formatTimeToComplete(order.acceptedAt, order.completedAt)}</p>
            )}
            <div className="mt-2 space-y-1 hidden sm:block">
              {order.items.map((item) => (
                <p key={item.id} className="text-sm">
                  {item.quantity} × {formatItemDisplayName(item.name, item.variant)}
                  {!(options?.isLiveSection && order.status !== "ORDER_COMPLETE") && (
                    <span className="font-medium ml-2">{formatINR(item.price)}</span>
                  )}
                </p>
              ))}
            </div>
          </div>
          {/* Total and payment: only after order is completed (payment flow is after Complete) */}
          {(!(options?.isLiveSection && order.status !== "ORDER_COMPLETE") || order.status === "ORDER_COMPLETE") && (
          <div className="text-right space-y-2 shrink-0">
            <p className="font-bold text-base sm:text-lg">{formatINR(order.totalAmount)}</p>
            {order.status === "ORDER_COMPLETE" && (
            <Badge
              variant={order.paymentStatus === "PAID" ? "default" : "secondary"}
              className={order.paymentStatus === "PAID" ? "bg-green-100 text-green-800 border-green-300" : "bg-amber-100 text-amber-800 border-amber-300"}
            >
              {order.paymentStatus === "PAID" ? "Paid" : "Pending"}
            </Badge>
            )}
          </div>
          )}
        </div>
        <Separator className="my-2 sm:my-3" />
        <div className="flex flex-wrap gap-2 mt-auto">
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openOrderPopup(order); }} className="text-xs sm:text-sm">
            <Eye className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
            View
          </Button>
          {order.status !== "ORDER_COMPLETE" && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openOrderPopup(order); }} className="text-xs sm:text-sm">
              Modify
            </Button>
          )}
          {!order.employeeId && order.status === "NEW_ORDER" && (
            <>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm"
                disabled={isAcceptingThis || isActionThis}
                onClick={(e) => { e.stopPropagation(); acceptOrder(order.id); }}
              >
                {isAcceptingThis ? (
                  <><span className="inline-block h-3 w-3 sm:h-4 sm:w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />Accepting...</>
                ) : (
                  <>Accept</>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50 text-xs sm:text-sm"
                disabled={isActionThis}
                onClick={(e) => { e.stopPropagation(); markStatus(order.id, "CANCELLED"); }}
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
                onClick={(e) => { e.stopPropagation(); markStatus(order.id, order.status === "PREPARING" ? "SERVED" : "PREPARING"); }}
                className="text-xs sm:text-sm"
              >
                {isActionThis ? (
                  <><span className="inline-block h-3 w-3 sm:h-4 sm:w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />Updating...</>
                ) : (
                  <><ChefHat className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />{order.status === "PREPARING" ? "Mark Served" : "Mark Preparing"}</>
                )}
              </Button>
              <Button size="sm" variant="outline" disabled={isActionThis} onClick={(e) => { e.stopPropagation(); markStatus(order.id, "ORDER_COMPLETE"); }} className="text-xs sm:text-sm">
                {isActionThis ? <span className="inline-block h-3 w-3 sm:h-4 sm:w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" /> : <CheckCircle className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />}
                Complete
              </Button>
            </>
          )}
          {order.status === "ORDER_COMPLETE" && (
            <Button
              size="sm"
              variant={order.paymentStatus === "PAID" ? "secondary" : "default"}
              onClick={(e) => { e.stopPropagation(); confirmPayment(order.id); }}
              disabled={order.paymentStatus === "PAID" || isActionThis}
              title={order.status !== "ORDER_COMPLETE" ? "Mark order complete first" : undefined}
              className="text-xs sm:text-sm"
            >
              {isActionThis ? <span className="inline-block h-3 w-3 sm:h-4 sm:w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" /> : <CreditCard className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />}
              {order.paymentStatus === "PAID" ? "Paid" : "Confirm Payment"}
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
    const emptyState = (
      <div className="text-center py-4 sm:py-6 text-muted-foreground">
        <ShoppingCart className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-20" />
        <p className="text-sm sm:text-base">No orders in this section right now.</p>
      </div>
    );
    return (
      <Card className={isCompletedSection ? "border-green-200 bg-green-50/30" : ""}>
        <CardHeader className="pb-3 pt-4 px-4 sm:px-6 sm:pb-4 sm:pt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className={`text-base sm:text-lg flex items-center gap-2 ${isCompletedSection ? "text-green-800" : ""}`}>
                  <ShoppingCart className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 ${isCompletedSection ? "text-green-600" : ""}`} />
                  <span className="truncate">{title}</span>
                </CardTitle>
                <Badge variant="outline" className={isCompletedSection ? "border-green-300 text-green-800" : ""}>
                  {data.length}
                </Badge>
              </div>
              <CardDescription className="text-xs sm:text-sm">{data.length} orders in this section</CardDescription>
            </div>
            {isLiveOrders && shiftActive && (
              <div className="flex justify-end sm:justify-end sm:ml-auto shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={shiftLoading}
                  onClick={async () => {
                    if (!token) return;
                    const endpoint = currentShift?.status === "PAUSED" ? "resume" : "pause";
                    const res = await fetch(`${apiBase}/shift/${endpoint}`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.ok) {
                      const data = await res.json().catch(() => null);
                      if (data) setCurrentShift((prev) => (prev ? { ...prev, ...data } : prev));
                      toast.success(data?.message || (endpoint === "pause" ? "Orders paused. Other staff can receive new orders." : "You are Active again for new orders."));
                    }
                  }}
                  className="text-xs sm:text-sm"
                >
                  {currentShift?.status === "PAUSED" ? "Resume Orders" : "Pause Orders"}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          {isLiveOrders ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {data.length === 0 && <div className="col-span-full">{emptyState}</div>}
              {data.map((order) => (
                <div key={order.id} className="min-w-0">
                  {renderOrderCard(order, { isCompletedSection: false, isLiveSection: true })}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50/50 overflow-hidden">
              <ScrollArea className="h-[480px] sm:h-[560px] w-full [&>[data-radix-scroll-area-viewport]]:pr-3">
                <div className="space-y-4 py-1">
                  {data.length === 0 && emptyState}
                  {data.map((order) => renderOrderCard(order, { isCompletedSection }))}
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
    const [search, setSearch] = useState("");
    const [dateFilter, setDateFilter] = useState<"today" | "last7" | "all">("today");
    const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid">("all");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);

    const filtered = useMemo(() => {
      let list = rawOrders;
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const last7Start = new Date(todayStart);
      last7Start.setDate(last7Start.getDate() - 7);
      if (dateFilter === "today") {
        list = list.filter((o) => new Date(o.createdAt) >= todayStart);
      } else if (dateFilter === "last7") {
        list = list.filter((o) => new Date(o.createdAt) >= last7Start);
      }
      if (paymentFilter === "paid") list = list.filter((o) => o.paymentStatus === "PAID");
      else if (paymentFilter === "unpaid") list = list.filter((o) => o.paymentStatus !== "PAID");
      const q = search.trim().toLowerCase();
      if (q) {
        list = list.filter(
          (o) =>
            String(o.id).includes(q) ||
            (o.table?.tableNumber ?? "").toLowerCase().includes(q) ||
            (o.employee?.name ?? "").toLowerCase().includes(q)
        );
      }
      return list;
    }, [rawOrders, dateFilter, paymentFilter, search]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageOrders = useMemo(() => filtered.slice(start, start + pageSize), [filtered, start, pageSize]);

    const exportCSV = () => {
      const headers = ["Order ID", "Table", "Items", "Amount", "Status", "Payment", "Accepted By", "Time", "Time to Complete"];
      const rows = filtered.map((o) => {
        const itemsStr = o.items.map((i) => `${i.name} ×${i.quantity}`).join("; ");
        const timeToComplete = o.acceptedAt && o.completedAt ? formatTimeToComplete(o.acceptedAt, o.completedAt) : "";
        return [
          o.id,
          o.table?.tableNumber ?? "",
          itemsStr,
          o.totalAmount,
          o.status,
          o.paymentStatus,
          o.employee?.name ?? "",
          new Date(o.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          timeToComplete,
        ];
      });
      const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    const itemsSummary = (order: Order) => {
      const parts = order.items.slice(0, 2).map((i) => `${i.name} ×${i.quantity}`);
      if (order.items.length > 2) parts.push(`+${order.items.length - 2} more`);
      return parts.join(", ");
    };

    const paymentBadgeClass = (paymentStatus: string) =>
      paymentStatus === "PAID" ? "bg-green-100 text-green-800 border-green-300" : "bg-amber-100 text-amber-800 border-amber-300";

    const isCompleted = title.toLowerCase().includes("completed") || title.toLowerCase().includes("paid");

    return (
      <Card className={isCompleted ? "border-green-200 bg-green-50/30" : "border-amber-200/60 bg-amber-50/20"}>
        <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className={`text-base sm:text-lg flex items-center gap-2 ${isCompleted ? "text-green-800" : "text-amber-800"}`}>
                <ShoppingCart className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 ${isCompleted ? "text-green-600" : "text-amber-600"}`} />
                {title}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-1" onClick={exportCSV} disabled={filtered.length === 0}>
                  <FileDown className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Order ID, Table, Employee..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9 h-10"
                />
              </div>
              <Select value={dateFilter} onValueChange={(v: "today" | "last7" | "all") => { setDateFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="last7">Last 7 Days</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
              {isCompleted && (
                <Select value={paymentFilter} onValueChange={(v: "all" | "paid" | "unpaid") => { setPaymentFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-[120px] h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[100px] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>Show {n}</SelectItem>
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
                    <TableHead className="hidden sm:table-cell">Accepted By</TableHead>
                    <TableHead className="hidden md:table-cell">Time</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-14 ml-auto" /></TableCell>
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
                      <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onViewOrder(order)}>
                        <TableCell className="font-medium">#{order.id}</TableCell>
                        <TableCell>{order.table?.tableNumber ?? order.table?.id ?? "—"}</TableCell>
                        <TableCell className="max-w-[180px] truncate" title={itemsSummary(order)}>{itemsSummary(order)}</TableCell>
                        <TableCell className="font-semibold">{formatINR(order.totalAmount)}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.status)} variant="secondary">
                            {order.status === "ORDER_COMPLETE" ? "Completed" : order.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={paymentBadgeClass(order.paymentStatus)}>
                            {order.paymentStatus === "PAID" ? "Paid" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-emerald-700">{order.employee?.name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          {order.acceptedAt && order.completedAt && (
                            <span className="block text-xs text-slate-500">Done in {formatTimeToComplete(order.acceptedAt, order.completedAt)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="outline" className="mr-1" onClick={() => onViewOrder(order)}>
                            <Eye className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">View</span>
                          </Button>
                          {showConfirmPayment && order.paymentStatus !== "PAID" && order.status === "ORDER_COMPLETE" && (
                            <Button
                              size="sm"
                              disabled={actionOrderId === order.id}
                              onClick={(e) => { e.stopPropagation(); onConfirmPayment(order.id); }}
                            >
                              {actionOrderId === order.id ? (
                                <span className="inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <><CreditCard className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Pay</span></>
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
                  <Card key={order.id} className="border bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => onViewOrder(order)}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-semibold">Order #{order.id}</span>
                        <Badge className={paymentBadgeClass(order.paymentStatus)} variant="outline">{order.paymentStatus === "PAID" ? "Paid" : "Pending"}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Table {order.table?.tableNumber ?? order.table?.id ?? "—"}</p>
                      <p className="text-sm">Items: {itemsSummary(order)}</p>
                      <p className="font-semibold">{formatINR(order.totalAmount)}</p>
                      <p className="text-xs text-emerald-700">{order.employee?.name && `Accepted by ${order.employee.name}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        {order.acceptedAt && order.completedAt && ` · Done in ${formatTimeToComplete(order.acceptedAt, order.completedAt)}`}
                      </p>
                      <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => onViewOrder(order)}><Eye className="h-3 w-3 mr-1" />View</Button>
                        {showConfirmPayment && order.paymentStatus !== "PAID" && order.status === "ORDER_COMPLETE" && (
                          <Button size="sm" disabled={actionOrderId === order.id} onClick={() => onConfirmPayment(order.id)}>
                            {actionOrderId === order.id ? <span className="inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Confirm Payment"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {total === 0 ? 0 : start + 1}–{Math.min(start + pageSize, total)} of {total} orders
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[80px] text-center">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
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
          <h2 className="text-lg font-bold sm:text-xl">Today&apos;s Dashboard</h2>
          <p className="text-xs sm:text-sm text-muted-foreground truncate max-w-full">
            {currentTime.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {" · "}{currentTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
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
                  const endpoint = currentShift?.status === "PAUSED" ? "resume" : "pause";
                  const res = await fetch(`${apiBase}/shift/${endpoint}`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (res.ok) {
                    const data = await res.json().catch(() => null);
                    if (data) setCurrentShift((prev) => (prev ? { ...prev, ...data } : prev));
                    toast.success(data?.message || (endpoint === "pause" ? "Orders paused. Other staff can receive new orders." : "You are Active again for new orders."));
                  }
                }}
              >
                {currentShift?.status === "PAUSED" ? "Resume Orders" : "Pause Orders"}
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
              {shiftLoading ? "Please wait..." : shiftActive ? "End Shift" : endedShiftToday ? "Start tomorrow" : "Start Shift"}
            </Button>
          </div>
        </div>

        {/* KPI Cards - same structure and font as admin dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <Card className={`min-w-0 ${shiftActive ? "bg-gradient-to-br from-emerald-50 to-white border-emerald-200 border-2" : "bg-gradient-to-br from-emerald-50 to-white border-emerald-100"}`}>
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Shift Status</p>
                  <p className={`text-base sm:text-lg font-bold truncate ${shiftActive ? "text-emerald-700" : "text-slate-700"}`}>
                    {currentShift?.status === "PAUSED" ? "Paused" : shiftActive ? "Active" : "Inactive"}
                  </p>
                  {currentShift?.shiftStart && (
                    <p className="text-xs mt-0.5">
                      <span className="text-muted-foreground">Start: {new Date(currentShift.shiftStart).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                      {" · "}
                      <span className={shiftActive ? "text-emerald-700 font-semibold" : "text-muted-foreground"}>
                        {currentShift?.shiftStart
                          ? (() => {
                              const end = currentShift.shiftEnd && currentShift.status === "ENDED" ? new Date(currentShift.shiftEnd) : currentTime;
                              const ms = end.getTime() - new Date(currentShift.shiftStart).getTime();
                              const totalMins = Math.max(0, Math.floor(ms / 60000));
                              const h = Math.floor(totalMins / 60);
                              const m = totalMins % 60;
                              const pad = (n: number) => n.toString().padStart(2, "0");
                              return `${pad(h)}:${pad(m)} hrs`;
                            })()
                          : "--:-- hrs"}
                      </span>
                    </p>
                  )}
                  {shiftActive && currentShift?.shiftStart && (() => {
                    const ms = currentTime.getTime() - new Date(currentShift.shiftStart).getTime();
                    if (ms / (1000 * 60 * 60) > 10) return <p className="text-xs font-medium text-amber-600 mt-0.5">Overtime</p>;
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
                  <p className="text-base sm:text-lg font-bold text-blue-700 truncate">{todayStats.ordersToday}</p>
                  <p className="text-xs text-muted-foreground">Today&apos;s orders</p>
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
                  <p className="text-base sm:text-lg font-bold text-green-700 truncate">{todayStats.completed}</p>
                  <p className="text-xs text-muted-foreground">Paid orders today</p>
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
                  <p className="text-xs text-muted-foreground">Pending Payment</p>
                  <p className="text-base sm:text-lg font-bold text-amber-700 truncate">{todayStats.pendingPayments}</p>
                  <p className="text-xs text-muted-foreground">Awaiting payment</p>
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
                  <p className="text-base sm:text-lg font-bold text-emerald-700 truncate">{formatINR(todayStats.salesToday)}</p>
                  <p className="text-xs text-muted-foreground">Total collected</p>
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
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 min-w-0 hover:border-blue-200 cursor-pointer transition-colors" onClick={() => setActiveSection("live")}>
            <CardContent className="p-2 sm:p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Live Orders</p>
                <p className="text-base sm:text-lg font-bold text-blue-700">{liveOrders.length} active</p>
              </div>
              <div className="p-1.5 bg-blue-100 rounded-md shrink-0">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100 min-w-0 hover:border-amber-200 cursor-pointer transition-colors" onClick={() => setActiveSection("pending")}>
            <CardContent className="p-2 sm:p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Pending Payments</p>
                <p className="text-base sm:text-lg font-bold text-amber-700">{pendingPayments.length} to collect</p>
              </div>
              <div className="p-1.5 bg-amber-100 rounded-md shrink-0">
                <CreditCard className="h-4 w-4 text-amber-600" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100 min-w-0 hover:border-emerald-200 cursor-pointer transition-colors" onClick={() => setActiveSection("shift")}>
            <CardContent className="p-2 sm:p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">My Shift</p>
                <p className="text-base sm:text-lg font-bold text-emerald-700">View details</p>
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
            <CardDescription className="text-muted-foreground">Latest 5 orders · Tap to open</CardDescription>
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
                        Table {order.table?.tableNumber ?? order.table?.id ?? "—"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {order.items.length} {order.items.length === 1 ? "item" : "items"} · {timeAgo(order.createdAt)}
                        {order.acceptedAt && order.completedAt && (
                          <span className="block text-xs text-slate-600 mt-0.5">Time to complete: {formatTimeToComplete(order.acceptedAt, order.completedAt)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
                    <Badge className={getStatusColor(order.status)} variant="secondary">
                      {order.status === "ORDER_COMPLETE" ? "Complete" : order.status.replace("_", " ")}
                    </Badge>
                    <Badge
                      className={order.paymentStatus === "PAID" ? "bg-green-100 text-green-800 border-green-300" : "bg-amber-100 text-amber-800 border-amber-300"}
                      variant="outline"
                    >
                      {order.paymentStatus === "PAID" ? "Paid" : "Pending"}
                    </Badge>
                    <span className="font-bold text-emerald-700 whitespace-nowrap">{formatINR(order.totalAmount)}</span>
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No orders yet</p>
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
          <p className="text-xs sm:text-sm text-muted-foreground">Track your shift and earnings</p>
        </div>
        <Button
          variant={shiftActive ? "destructive" : "default"}
          size="lg"
          disabled={shiftLoading}
          onClick={shiftActive ? endShift : startShift}
          className={`gap-2 shrink-0 w-full sm:w-auto ${!shiftActive && !shiftLoading ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
        >
          {shiftLoading ? <span className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : shiftActive ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {shiftLoading ? "Please wait..." : shiftActive ? "End Shift" : "Start Shift"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100 min-w-0">
          <CardContent className="p-2 sm:p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Shift Status</p>
                <p className={`text-base sm:text-lg font-bold truncate ${shiftActive ? "text-emerald-700" : "text-slate-700"}`}>
                  {currentShift?.status === "PAUSED" ? "Paused" : shiftActive ? "Active" : "Inactive"}
                </p>
                {currentShift?.shiftStart && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Start: {new Date(currentShift.shiftStart).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
                {shiftActive && currentShift?.shiftStart && (
                  <>
                    <p className="text-xs mt-1">
                      <span className="inline-block font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                        Live: {(() => {
                          const ms = currentTime.getTime() - new Date(currentShift.shiftStart).getTime();
                          const totalMins = Math.max(0, Math.floor(ms / 60000));
                          const h = Math.floor(totalMins / 60);
                          const m = totalMins % 60;
                          return `${h}h ${m}m`;
                        })()}
                      </span>
                    </p>
                    {(() => {
                      const ms = currentTime.getTime() - new Date(currentShift.shiftStart).getTime();
                      if (ms / (1000 * 60 * 60) > 10) return <p className="text-xs font-medium text-amber-600">Overtime</p>;
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
                        const endpoint = currentShift?.status === "PAUSED" ? "resume" : "pause";
                        const res = await fetch(`${apiBase}/shift/${endpoint}`, {
                          method: "POST",
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        if (res.ok) {
                          const data = await res.json().catch(() => null);
                          if (data) setCurrentShift((prev) => (prev ? { ...prev, ...data } : prev));
                          toast.success(data?.message || (endpoint === "pause" ? "Status set to Paused." : "Back to Active."));
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
                <p className="text-xs text-muted-foreground">Orders Handled</p>
                <p className="text-base sm:text-lg font-bold text-blue-700 truncate">{currentShift?.ordersCount ?? 0}</p>
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
                <p className="text-xs text-muted-foreground">Sales Collected</p>
                <p className="text-base sm:text-lg font-bold text-green-700 truncate">{formatINR(todayStats.salesToday)}</p>
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
          <CardDescription className="text-muted-foreground">Your recent shifts and hours</CardDescription>
        </CardHeader>
        <CardContent>
          {myDailyShiftStats.length > 0 && (
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {myDailyShiftStats.slice(0, 6).map((d) => {
                const isToday = isSameDay(d.date, new Date().toISOString());
                const activeShiftToday = isToday && currentShift && !currentShift.shiftEnd && isSameDay(currentShift.shiftStart, new Date().toISOString());
                const displayHours = activeShiftToday
                  ? getElapsedHours(currentShift!.shiftStart, currentShift!.shiftEnd, currentTime)
                  : d.totalHours;
                return (
                  <div key={d.date} className="rounded-lg border bg-white p-3 text-sm">
                    <p className="font-medium">{new Date(d.date).toLocaleDateString("en-IN")}</p>
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
            <p className="text-muted-foreground text-center py-8">No shift history yet</p>
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
                      <span className="font-medium">{new Date(s.shiftStart).toLocaleDateString("en-IN")}</span>
                      <span className="text-muted-foreground">In</span>
                      <span>{new Date(s.shiftStart).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-muted-foreground">Out</span>
                      <span>
                        {s.shiftEnd
                          ? new Date(s.shiftEnd).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </span>
                      <span className="text-muted-foreground">Hours</span>
                      <span className="font-medium">{formatHours(hours, isActive)}</span>
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
                        ? getElapsedHours(s.shiftStart, s.shiftEnd, currentTime)
                        : (s.totalHours ?? 0);
                      return (
                        <tr key={s.id} className="border-b last:border-b-0">
                          <td className="p-2">{new Date(s.shiftStart).toLocaleDateString("en-IN")}</td>
                          <td className="p-2">{new Date(s.shiftStart).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td>
                          <td className="p-2">
                            {s.shiftEnd
                              ? new Date(s.shiftEnd).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
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
    ]
  );

  const profileSectionContent = useMemo(
    () => (
      <div className="space-y-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold sm:text-xl">My Profile</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Your account details</p>
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
                <CardTitle className="text-lg">{profile?.name ?? "Employee"}</CardTitle>
                <CardDescription>{profile?.employeeCode ?? "—"}</CardDescription>
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
                <p className="text-sm font-medium">{profile?.employeeCode ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Branch</p>
                <p className="text-sm font-medium">{profile?.branch?.name ?? "—"}</p>
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
                  <p className="text-sm font-medium">{profile.address}{profile.pincode ? ` - ${profile.pincode}` : ""}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    ),
    [profile]
  );

  const StartShiftPromptDialog = () => (
    <Dialog
      open={showStartShiftPrompt}
      onOpenChange={(open) => {
        setShowStartShiftPrompt(open);
        if (!open) window.sessionStorage.setItem("dm_shift_prompt_dismissed_" + new Date().toISOString().slice(0, 10), "1");
      }}
    >
      <DialogContent className="max-w-md" aria-describedby="start-shift-desc" aria-label="Start shift">
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
              window.sessionStorage.setItem("dm_shift_prompt_dismissed_" + new Date().toISOString().slice(0, 10), "1");
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
        <div key={order.id} className="rounded-lg border-2 border-emerald-200 bg-emerald-50/50 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">Table {order.table?.tableNumber || order.table?.id || "?"}</span>
            <Badge className={getPriorityBadgeClass(order)}>{getPriorityLabel(order)}</Badge>
          </div>
          <p className="text-muted-foreground mt-0.5">
            Order #{order.id} · {formatPopupTime(order.createdAt)}
          </p>
          <ul className="mt-2 space-y-0.5 font-medium text-slate-800">
            {order.items.map((item) => (
              <li key={item.id}>
                {item.quantity}× {formatItemDisplayName(item.name, item.variant)}
              </li>
            ))}
          </ul>
          <p className="font-bold mt-2 text-emerald-700">{formatINR(order.totalAmount)}</p>
        </div>
      )),
    [newOrderPopupOrders]
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
        <DialogContent className="max-w-md" aria-describedby="new-order-popup-desc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              New order(s) received
            </DialogTitle>
            <DialogDescription id="new-order-popup-desc">
              {newOrderPopupOrders.length} new order{newOrderPopupOrders.length !== 1 ? "s" : ""} need your attention.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[280px] pr-2">
            <div className="space-y-3">{newOrderPopupCards}</div>
          </ScrollArea>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setNewOrderPopupOrders([])}>
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
    [completedOrders, loading, actionOrderId, openOrderPopup, confirmPayment, formatINR, getStatusColor, formatTimeToComplete]
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
    [pendingPayments, loading, actionOrderId, openOrderPopup, confirmPayment, formatINR, getStatusColor, formatTimeToComplete]
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
    [paidOrders, loading, actionOrderId, openOrderPopup, confirmPayment, formatINR, getStatusColor, formatTimeToComplete]
  );

  // Memoize entire content tree so cards do NOT re-render when only clock/other unrelated state updates
  const content = useMemo(
    () => (
      <div className="w-full min-h-full space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6 relative animate-fade-in">
        {activeSection === "dashboard" && dashboardOverviewContent}
        {activeSection === "live" && liveOrdersSectionContent}
        {activeSection === "completed" && completedSectionContent}
        {activeSection === "pending" && pendingSectionContent}
        {activeSection === "paid" && paidSectionContent}
        {activeSection === "shift" && shiftSectionContent}
        {activeSection === "profile" && profileSectionContent}
      </div>
    ),
    [
      activeSection,
      dashboardOverviewContent,
      liveOrdersSectionContent,
      completedSectionContent,
      pendingSectionContent,
      paidSectionContent,
      shiftSectionContent,
      profileSectionContent,
    ]
  );

  const companyLogoUrl = typeof window !== "undefined" ? window.localStorage.getItem("branch_logo_url") : null;

  // Skeleton layout so UI feels fast – no blank full-page spinner
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <header className="h-14 border-b bg-white shrink-0" />
        <div className="flex-1 flex gap-4 p-4">
          <aside className="w-52 rounded-lg bg-slate-200/60 animate-pulse shrink-0" />
          <main className="flex-1 space-y-4 min-w-0">
            <div className="h-8 w-48 rounded bg-slate-200/60 animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-slate-200/60 animate-pulse" />
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
      branchName={profile?.branch?.name && !/^main(\s+branch)?$/i.test(profile.branch.name.trim()) ? profile.branch.name.trim() : "Gautam Nagar"}
      sidebarItems={sidebarItems}
      activeKey={activeSection}
      onSelect={setActiveSection}
      sidebarBadges={liveOrders.length > 0 ? { live: liveOrders.length } : undefined}
      companyLogoUrl={companyLogoUrl || undefined}
    >
      {content}
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

