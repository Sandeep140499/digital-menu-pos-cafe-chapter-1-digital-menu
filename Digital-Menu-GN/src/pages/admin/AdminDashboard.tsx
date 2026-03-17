import { useEffect, useState, useMemo, useCallback, memo, useRef } from "react";
import React from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard,
  Utensils,
  Users,
  Clock,
  ShoppingCart,
  CreditCard,
  BarChart3,
  Settings,
  Plus,
  Edit2,
  Trash2,
  Search,
  TrendingUp,
  IndianRupee,
  ChefHat,
  Store,
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  Download,
  RefreshCw,
  Calendar,
  LogOut,
  ArrowUpRight,
  ArrowDownRight,
  Timer,
  Award,
  Trophy,
  FileText,
  Star,
  Package,
  Bell,
  ChevronLeft,
  Eye,
  MessageCircle,
  Activity,
  Mail,
  MinusCircle,
  X,
  Lock,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend as RechartsLegend, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoaderButton, StatusBadge } from "@/components/shared";
import {
  API_BASE_URL,
  fetchWithTimeout,
  BREAK_TIME_MINUTES,
  formatBreakTime,
  EMPLOYEE_STATUS_FILTER_OPTIONS,
  MENU_CATEGORY_FILTER_OPTIONS,
  MENU_SORT_OPTIONS,
  STATUS_BUTTON_ACTIVE,
} from "@/constants";
import { formatHours } from "@/utils/timeFormatter";
import { calculateLate } from "@/utils/lateCalculator";
import { getBusinessDateString } from "@/utils/businessDate";
import cafeLogo from "@/assets/logo.png";

const apiBase = API_BASE_URL;

// Payslip brand colors (Cafe Chapter 1)
const PAYSLIP_COFFEE = "#6B3E26";
const PAYSLIP_LATTE = "#C9A27E";
const PAYSLIP_GREEN = "#2E7D32";

// Salary slip dialog – module-level constants (used by SalarySlipDialog to avoid re-creation/flash)
const SALARY_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
// 12 predefined colors for month-wise salary slip rows (Jan–Dec)
const SALARY_MONTH_COLORS = [
  "#FEF3C7",
  "#FCE7F3",
  "#DBEAFE",
  "#D1FAE5",
  "#E0E7FF",
  "#FFEDD5",
  "#FEE2E2",
  "#E5E7EB",
  "#F3E8FF",
  "#CCFBF1",
  "#FEF9C3",
  "#E2E8F0",
];
const SALARY_CARD_CLASS =
  "rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md";
const SALARY_INPUT_CLASS =
  "h-11 rounded-lg border border-slate-200 px-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none";

function monthNumberToName(month: number | null | undefined): string | undefined {
  if (month == null) return undefined;
  const idx = Number(month) - 1;
  return idx >= 0 && idx < SALARY_MONTH_NAMES.length ? SALARY_MONTH_NAMES[idx] : undefined;
}

function getNextSalaryNumberModule(
  existingSlips: { salaryNumber?: string; month?: string; year?: number }[],
  payYear: number,
  payMonthName: string,
): string {
  const mm = String(SALARY_MONTH_NAMES.indexOf(payMonthName) + 1).padStart(
    2,
    "0",
  );
  const prefix = `CC1/${mm}/${payYear}/`;
  const existingForMonth = existingSlips.filter(
    (s) => s.year === payYear && s.month === payMonthName,
  );
  let maxSeq = 0;
  for (const s of existingForMonth) {
    const sn = s.salaryNumber;
    if (!sn || !sn.startsWith(prefix)) continue;
    const num = parseInt(sn.slice(prefix.length), 10);
    if (!isNaN(num)) maxSeq = Math.max(maxSeq, num);
  }
  return `${prefix}${String(maxSeq + 1).padStart(5, "0")}`;
}

/** Get background color for a salary slip row by month (0–11 => Jan–Dec). */
function getSalarySlipMonthColor(slip: {
  month?: string;
  year?: number;
}): string {
  const idx = SALARY_MONTH_NAMES.indexOf(slip.month ?? "");
  return idx >= 0 && idx < SALARY_MONTH_COLORS.length
    ? SALARY_MONTH_COLORS[idx]
    : "#ffffff";
}

/** Build payslip HTML from stored slip data (for View PDF / Download PDF – no stored PDFs). */
function buildPayslipHtmlFromSlip(
  slip: {
    salaryNumber?: string;
    employee?: { name?: string };
    employeeCode?: string;
    month?: string;
    year?: number;
    basicSalary?: number;
    allowances?: { name?: string; amount?: number }[];
    deductions?: { name?: string; amount?: number }[];
    netSalary?: number;
    paidDays?: number;
    lopDays?: number;
    createdAt?: string;
  },
  opts: {
    logoUrl: string;
    companyName: string;
    companyAddress: string;
    companyPincode: string;
    phone: string;
  },
): string {
  const payMonthName = slip.month ?? "January";
  const payYear = slip.year ?? new Date().getFullYear();
  const payDate = slip.createdAt
    ? new Date(slip.createdAt).toISOString().split("T")[0]
    : `${payYear}-${String(SALARY_MONTH_NAMES.indexOf(payMonthName) + 1).padStart(2, "0")}-01`;
  const mm = String(SALARY_MONTH_NAMES.indexOf(payMonthName) + 1).padStart(
    2,
    "0",
  );
  const payPeriodLabel = `${mm} - ${payMonthName} ${payYear}`;
  const allowanceRows = (slip.allowances ?? []).map((r) => ({
    name: r.name ?? "",
    amount: Number(r.amount) || 0,
  }));
  const deductionRows = (slip.deductions ?? []).map((r) => ({
    name: r.name ?? "",
    amount: Number(r.amount) || 0,
  }));
  const basicSalary = Number(slip.basicSalary) || 0;
  const totalAllowances = allowanceRows.reduce((s, r) => s + r.amount, 0);
  const totalDeductions = deductionRows.reduce((s, r) => s + r.amount, 0);
  const grossEarnings = basicSalary + totalAllowances;
  const netSalary =
    slip.netSalary != null && slip.netSalary !== ""
      ? Number(slip.netSalary)
      : grossEarnings - totalDeductions;
  return buildPayslipPrintHtmlModule({
    logoUrl: opts.logoUrl,
    companyName: opts.companyName,
    companyAddress: opts.companyAddress,
    companyPincode: opts.companyPincode,
    phone: opts.phone,
    payMonthName,
    payYear,
    payPeriodLabel,
    payDate,
    salaryNumber: slip.salaryNumber,
    selectedEmployee: slip.employee
      ? { name: slip.employee.name, employeeCode: slip.employeeCode }
      : undefined,
    paidDays:
      slip.paidDays != null && slip.paidDays !== ""
        ? Number(slip.paidDays)
        : 22,
    lopDays:
      slip.lopDays != null && slip.lopDays !== ""
        ? Number(slip.lopDays)
        : 0,
    basicSalary,
    allowanceRows,
    deductionRows,
    grossEarnings,
    totalDeductions,
    netSalary,
  });
}

function buildPayslipPrintHtmlModule(data: {
  logoUrl: string;
  companyName: string;
  companyAddress: string;
  companyPincode: string;
  phone: string;
  payMonthName: string;
  payYear: number;
  payPeriodLabel: string;
  payDate: string;
  salaryNumber?: string;
  selectedEmployee: { name?: string; employeeCode?: string } | undefined;
  paidDays: number;
  lopDays: number;
  basicSalary: number;
  allowanceRows: { name: string; amount: number }[];
  deductionRows: { name: string; amount: number }[];
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
}): string {
  const addr =
    data.companyAddress +
    (data.companyPincode ? `, ${data.companyPincode}` : "") +
    ", India";
  const rows = (arr: { name: string; amount: number }[]) =>
    arr
      .map(
        (r) =>
          `<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${r.name || "—"}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right">₹${r.amount || 0}</td></tr>`,
      )
      .join("");
  const slipNoRow = data.salaryNumber
    ? `<p style="margin:4px 0"><strong>Salary Slip No.:</strong> ${data.salaryNumber}</p>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Salary Slip</title><style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#fff}.watermark{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0.06;z-index:0}.watermark img{max-width:90%;max-height:90%;object-fit:contain}.main{position:relative;z-index:1}table{width:100%;border-collapse:collapse;margin:16px 0}.th{background:#f1f5f9;padding:8px;text-align:left;font-weight:600}.th-r{text-align:right}.net{border-top:2px solid #047857;margin-top:16px;padding-top:12px;font-size:18px;font-weight:700;color:#047857}</style></head><body><div class="watermark"><img src="${data.logoUrl}" alt="" /></div><div class="main"><div style="border-bottom:2px solid #e2e8f0;padding-bottom:16px;margin-bottom:16px"><img src="${data.logoUrl}" alt="" style="height:64px;margin-bottom:8px" /><p style="font-weight:700;font-size:18px;margin:0">${data.companyName}</p><p style="color:#475569;font-size:14px;margin:4px 0">${addr}</p>${data.phone ? `<p style="font-size:12px;color:#64748b">Ph: ${data.phone}</p>` : ""}<p style="font-weight:600;margin-top:12px">Salary Slip — ${data.payMonthName} ${data.payYear}</p></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-bottom:16px;font-size:14px">${slipNoRow}<p style="margin:4px 0"><strong>Employee Name:</strong> ${data.selectedEmployee?.name ?? "—"}</p><p style="margin:4px 0"><strong>Employee ID:</strong> ${data.selectedEmployee?.employeeCode ?? "—"}</p><p style="margin:4px 0"><strong>Pay Period:</strong> ${data.payPeriodLabel}</p><p style="margin:4px 0"><strong>Pay Date:</strong> ${data.payDate}</p><p style="margin:4px 0"><strong>Paid Days:</strong> ${data.paidDays}</p><p style="margin:4px 0"><strong>LOP Days:</strong> ${data.lopDays}</p></div><table><thead><tr><th class="th">Earnings</th><th class="th th-r">Amount (₹)</th></tr></thead><tbody><tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">Basic Salary</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right">₹${data.basicSalary}</td></tr>${rows(data.allowanceRows)}</tbody></table><table><thead><tr><th class="th">Deductions</th><th class="th th-r">Amount (₹)</th></tr></thead><tbody>${rows(data.deductionRows)}</tbody></table><div class="net"><p style="display:flex;justify-content:space-between;margin:4px 0"><span>Gross Salary</span><span>₹${data.grossEarnings}</span></p><p style="display:flex;justify-content:space-between;margin:4px 0"><span>Total Deductions</span><span>₹${data.totalDeductions}</span></p><p style="display:flex;justify-content:space-between;margin-top:8px;font-size:18px"><span>Net Salary</span><span>₹${data.netSalary}</span></p></div><p style="text-align:center;font-size:12px;color:#64748b;margin-top:32px">Authorized Signature — ${data.companyName}</p></div></body></html>`;
}

// Types
type MenuCategory = {
  id: number;
  name: string;
  slug?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt?: string;
  items: MenuItem[];
};

type MenuItem = {
  id: number;
  name: string;
  description?: string;
  imageUrl?: string;
  basePrice: number;
  hasHalf: boolean;
  halfPrice?: number;
  isActive: boolean;
  categoryId?: number;
};

type Employee = {
  id: number;
  name: string;
  email: string;
  employeeCode: string;
  role?: string | null;
  status: "ACTIVE" | "INACTIVE" | "LEFT";
  branchId: number;
  createdAt: string;
  profileImageUrl?: string;
  shiftStartTime?: string | null;
  totalHoursToday?: number;
  ordersToday?: number;
  salesToday?: number;
  emailVerified?: boolean;
  phone?: string;
  salary?: number;
  address?: string;
  pincode?: string;
  workingHoursPerDay?: number | null;
  shiftEndTime?: string | null;
  joiningDate?: string | null;
  branch?: { id: number; name: string };
};

type Order = {
  id: number;
  tableId: number;
  tableNumber?: string;
  employeeId?: number;
  employeeName?: string;
  employee?: {
    id: number;
    name: string;
    employeeCode?: string;
    role?: string | null;
  } | null;
  branchId: number;
  branch?: { id: number; name: string; location?: string | null } | null;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
};

type OrderItem = {
  id: number;
  name: string;
  quantity: number;
  price: number;
  variant?: string;
};

type ItemSales = {
  itemName: string;
  quantity: number;
  revenue: number;
  category?: string;
};

type EmployeeSales = {
  employeeId: number;
  employeeName: string;
  orders: number;
  revenue: number;
  hoursWorked?: number;
};

type EmployeeFormState = {
  name: string;
  email: string;
  employeeCode: string;
  role: string;
  status: "ACTIVE" | "INACTIVE" | "LEFT";
  phone: string;
  salary: string | number;
  address: string;
  pincode: string;
  workingHoursPerDay: string | number;
  shiftStartTime: string;
  shiftEndTime: string;
  joiningDate: string;
};

type TodayStats = {
  totalRevenue: number;
  totalOrders: number;
  pendingPayments: number;
  paidOrders: number;
  activeEmployees: number;
  avgOrderValue: number;
  totalItemsSold: number;
  topSellingItem: { name: string; quantity: number } | null;
};

type RemovedItem = {
  id: number;
  orderId: number;
  orderItemId: number;
  itemName: string;
  itemPrice: number;
  quantity: number;
  reason: string;
  removedBy: string;
  removedAt: string;
  tableNumber?: string;
};

type DailyRemovalSummary = {
  date: string;
  totalItems: number;
  totalLoss: number;
  itemCount: number;
};

// INR Currency formatter
/** Variant display:
 * - Items named like "(5pc / 8pc)" → HALF=5pc, FULL=8pc
 * - Otherwise → HALF=Half, FULL=Full
 * Also strips "(5pc / 8pc)" and "(Half / Full)" from base name for display.
 */
const formatItemDisplayName = (
  name: string,
  variant?: string | null,
): string => {
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
};

const formatINR = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Memoized order row: one row per order, green when completed
const AdminOrderRow = memo(function AdminOrderRow({
  order,
  onSelect,
}: {
  order: Order;
  onSelect: (order: Order) => void;
}) {
  const isComplete = order.status === "ORDER_COMPLETE";
  return (
    <div
      className={`p-3 cursor-pointer transition-[background-color] duration-150 card-gpu border-l-4 ${
        isComplete
          ? "bg-green-50/70 border-l-green-600 hover:bg-green-50"
          : "hover:bg-slate-50 border-l-transparent"
      }`}
      onClick={() => onSelect(order)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm">Order #{order.id}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(order.createdAt).toLocaleTimeString()}
          </p>
        </div>
        <div className="text-right shrink-0">
          <Badge
            variant={isComplete ? "default" : "secondary"}
            className={`text-xs mb-1 ${isComplete ? "bg-green-600 hover:bg-green-700" : ""}`}
          >
            {order.status}
          </Badge>
          <p className="text-sm font-medium">{formatINR(order.totalAmount)}</p>
        </div>
      </div>
    </div>
  );
});

type SidebarItem = {
  key: string;
  label: string;
  icon: React.ComponentType<any>;
};

// Professional POS sidebar: Dashboard → Operations → Staff → Finance → System
const adminSidebarSections = [
  {
    title: "Dashboard",
    items: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
      { key: "performance", label: "Performance", icon: Activity },
    ] as SidebarItem[],
  },
  {
    title: "Operations",
    items: [
      { key: "orders", label: "Orders", icon: ShoppingCart },
      { key: "menu", label: "Menu", icon: ChefHat },
      {
        key: "customer-leaderboard",
        label: "Customer Leaderboard",
        icon: Trophy,
      },
      { key: "removed-items", label: "Removed Items", icon: Trash2 },
      {
        key: "customer-queries",
        label: "Raised Requests",
        icon: MessageCircle,
      },
    ] as SidebarItem[],
  },
  {
    title: "Staff",
    items: [
      { key: "employees", label: "Employees", icon: Users },
      { key: "hours", label: "Work Hours", icon: Clock },
      { key: "overtime", label: "Overtime", icon: AlertCircle },
      { key: "late", label: "Late Entries", icon: Clock },
      { key: "certificates", label: "Certificates", icon: Award },
    ] as SidebarItem[],
  },
  {
    title: "Finance",
    items: [
      { key: "salary-slips", label: "Salary Slips", icon: IndianRupee },
    ] as SidebarItem[],
  },
  {
    title: "System",
    items: [
      { key: "settings", label: "Settings", icon: Settings },
    ] as SidebarItem[],
  },
];

// Stable component so Settings inputs don't lose focus on each keystroke (no remount)
type SettingsSectionContentProps = {
  branchForm: {
    name: string;
    location: string;
    timezone: string;
    logoUrl: string;
    phone: string;
    googleReviewUrl: string;
    pincode: string;
    directorsEmail: string;
    showTotalAmountToCustomers: boolean;
  };
  setBranchForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      location: string;
      timezone: string;
      logoUrl: string;
      phone: string;
      googleReviewUrl: string;
      pincode: string;
      directorsEmail: string;
      showTotalAmountToCustomers: boolean;
    }>
  >;
  branch: any;
  setBranch: (b: any) => void;
  branches: any[];
  createBranchOpen: boolean;
  setCreateBranchOpen: (v: boolean) => void;
  createBranchForm: {
    name: string;
    location: string;
    timezone: string;
    logoUrl: string;
    phone: string;
    googleReviewUrl: string;
    pincode: string;
    directorsEmail: string;
    showTotalAmountToCustomers: boolean;
  };
  setCreateBranchForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      location: string;
      timezone: string;
      logoUrl: string;
      phone: string;
      googleReviewUrl: string;
      pincode: string;
      directorsEmail: string;
      showTotalAmountToCustomers: boolean;
    }>
  >;
  handleCreateBranch: () => Promise<void>;
  handleUpdateBranch: () => Promise<void>;
  loadSettings: () => Promise<void>;
  savingBranch: boolean;
  notifications: any[];
  errorLogs: { logs: any[]; unresolvedCount: number };
  toast: (p: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => void;
  token: string | null;
  directorsData: {
    verified: string[];
    pendingVerification: { email: string; expiresAt: string }[];
    pendingRemoval: { email: string; expiresAt: string }[];
  } | null;
  loadDirectors: () => Promise<void>;
};
function parseDirectorEmails(s: string): string[] {
  const arr = (s || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return arr.length ? arr : [""];
}

const SettingsSectionContent = memo(function SettingsSectionContent(
  props: SettingsSectionContentProps,
) {
  const {
    branchForm,
    setBranchForm,
    branch,
    setBranch,
    branches,
    createBranchOpen,
    setCreateBranchOpen,
    createBranchForm,
    setCreateBranchForm,
    handleCreateBranch,
    handleUpdateBranch,
    loadSettings,
    savingBranch,
    notifications,
    errorLogs,
    toast,
    token,
    directorsData,
    loadDirectors,
  } = props;
  const [newDirectorEmail, setNewDirectorEmail] = useState("");
  const [sendingVerify, setSendingVerify] = useState(false);
  const [sendingRemove, setSendingRemove] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [orderNotificationsEnabled, setOrderNotificationsEnabled] = useState(true);
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [savingSystemPrefs, setSavingSystemPrefs] = useState(false);
  const branchId = branch?.id ?? branches[0]?.id;

  useEffect(() => {
    try {
      const on = window.localStorage.getItem("dm_admin_order_notifications");
      const sound = window.localStorage.getItem("dm_admin_sound_alerts");
      const auto = window.localStorage.getItem("dm_admin_auto_refresh");
      if (on !== null) setOrderNotificationsEnabled(on === "true");
      if (sound !== null) setSoundAlertsEnabled(sound === "true");
      if (auto !== null) setAutoRefreshEnabled(auto === "true");
    } catch {
      // ignore (storage blocked)
    }
  }, []);

  return (
    <div className="space-y-6 min-w-0">
      <div className="min-w-0">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
          System Settings
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          Manage system configuration and preferences
        </p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-lg">Branches</CardTitle>
            </div>
            <Button size="sm" onClick={() => setCreateBranchOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Branch
            </Button>
          </div>
          <CardDescription>
            Manage branches. Assign employees to a branch when creating them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {branches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No branches yet. Create your first branch below.
            </p>
          ) : (
            <div className="space-y-2">
              {branches.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border min-w-0"
                >
                  <p className="font-medium truncate min-w-0">{b.name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 w-full sm:w-auto"
                    onClick={() => {
                      setBranchForm({
                        ...branchForm,
                        name: b.name,
                        location: b.location || "",
                        timezone: b.timezone || "Asia/Kolkata",
                        logoUrl: b.logoUrl || "",
                        phone: b.phone || "",
                        googleReviewUrl: b.googleReviewUrl || "",
                        pincode: b.pincode || "",
                        directorsEmail: b.directorsEmail || "",
                        showTotalAmountToCustomers:
                          typeof (b as any).showTotalAmountToCustomers === "boolean"
                            ? (b as any).showTotalAmountToCustomers
                            : true,
                      });
                      setBranch(b);
                    }}
                  >
                    Edit in Branch Settings
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-lg">Branch Settings</CardTitle>
          </div>
          <CardDescription>
            {branch
              ? `Editing: ${branch.name}`
              : "Select a branch above to edit its settings, then save."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>
                Restaurant Name (shown on Salary Slip &amp; Certificates)
              </Label>
              <Input
                placeholder="Enter restaurant / company name"
                value={branchForm.name ?? ""}
                onChange={(e) =>
                  setBranchForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Location</Label>
              <Input
                placeholder="Enter location"
                value={branchForm.location}
                onChange={(e) =>
                  setBranchForm((prev) => ({
                    ...prev,
                    location: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Timezone</Label>
              <Select
                value={branchForm.timezone}
                onValueChange={(value) =>
                  setBranchForm((prev) => ({ ...prev, timezone: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Kolkata">Asia/Kolkata</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>
                Contact Phone (for Call / WhatsApp on customer menu)
              </Label>
              <Input
                placeholder="10-digit number"
                value={branchForm.phone}
                onChange={(e) =>
                  setBranchForm((prev) => ({
                    ...prev,
                    phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Logo URL</Label>
              <Input
                placeholder="Enter logo URL"
                value={branchForm.logoUrl}
                onChange={(e) =>
                  setBranchForm((prev) => ({
                    ...prev,
                    logoUrl: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Pincode (for payslip & address)</Label>
              <Input
                placeholder="e.g. 110049"
                value={branchForm.pincode}
                onChange={(e) =>
                  setBranchForm((prev) => ({
                    ...prev,
                    pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Directors Email (salary slip copies)</Label>
              <p className="text-xs text-muted-foreground">
                Each director must verify their email. To remove, a confirmation
                email is sent—they are removed only when they click
                &quot;Yes&quot; in that email.
              </p>
              {!branchId ? (
                <p className="text-sm text-amber-700">
                  Select a branch above to manage directors.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    {directorsData?.verified?.map((email) => (
                      <div
                        key={email}
                        className="flex flex-wrap items-center gap-2 p-2 rounded-lg border bg-white"
                      >
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate flex-1 min-w-0">
                          {email}
                        </span>
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 shrink-0">
                          Verified
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                          disabled={sendingRemove === email}
                          onClick={async () => {
                            setSendingRemove(email);
                            try {
                              const res = await fetch(
                                `${apiBase}/branches/${branchId}/directors/request-remove`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${token}`,
                                  },
                                  body: JSON.stringify({ email }),
                                },
                              );
                              const data = await res.json().catch(() => ({}));
                              if (res.ok) {
                                toast({
                                  title: "Email sent",
                                  description:
                                    "Director will receive a link to confirm removal. They are removed only after they click Yes.",
                                });
                                await loadDirectors();
                              } else {
                                toast({
                                  title: "Error",
                                  description:
                                    (data as { message?: string }).message ||
                                    "Failed to send removal email",
                                  variant: "destructive",
                                });
                              }
                            } catch {
                              toast({
                                title: "Error",
                                description: "Failed to send removal email",
                                variant: "destructive",
                              });
                            } finally {
                              setSendingRemove(null);
                            }
                          }}
                        >
                          {sendingRemove === email ? "Sending…" : "Remove"}
                        </Button>
                      </div>
                    ))}
                    {directorsData?.pendingVerification?.map((p) => (
                      <div
                        key={p.email}
                        className="flex flex-wrap items-center gap-2 p-2 rounded-lg border bg-amber-50/50"
                      >
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate flex-1 min-w-0">
                          {p.email}
                        </span>
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 shrink-0">
                          Pending verification
                        </Badge>
                      </div>
                    ))}
                    {directorsData?.pendingRemoval?.map((p) => (
                      <div
                        key={p.email}
                        className="flex flex-wrap items-center gap-2 p-2 rounded-lg border bg-slate-50"
                      >
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate flex-1 min-w-0">
                          {p.email}
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          Removal requested – waiting for director to confirm
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Input
                      type="email"
                      placeholder="e.g. director@company.com"
                      value={newDirectorEmail}
                      onChange={(e) => setNewDirectorEmail(e.target.value)}
                      className="flex-1 min-w-0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 shrink-0"
                      disabled={sendingVerify || !newDirectorEmail.trim()}
                      onClick={async () => {
                        const email = newDirectorEmail.trim();
                        if (!email) return;
                        setSendingVerify(true);
                        try {
                          const res = await fetch(
                            `${apiBase}/branches/${branchId}/directors/request-verify`,
                            {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({ email }),
                            },
                          );
                          const data = await res.json().catch(() => ({}));
                          if (res.ok) {
                            toast({
                              title: "Verification email sent",
                              description:
                                "Director must click the link in the email to be added.",
                            });
                            setNewDirectorEmail("");
                            await loadDirectors();
                          } else {
                            toast({
                              title: "Error",
                              description:
                                (data as { message?: string }).message ||
                                "Failed to send verification email",
                              variant: "destructive",
                            });
                          }
                        } catch {
                          toast({
                            title: "Error",
                            description: "Failed to send verification email",
                            variant: "destructive",
                          });
                        } finally {
                          setSendingVerify(false);
                        }
                      }}
                    >
                      {sendingVerify ? "Sending…" : "Send verification email"}
                    </Button>
                  </div>
                </>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Google Review URL</Label>
              <Input
                placeholder="https://..."
                value={branchForm.googleReviewUrl}
                onChange={(e) =>
                  setBranchForm((prev) => ({
                    ...prev,
                    googleReviewUrl: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="space-y-0.5 pr-4">
                <Label className="text-sm">Show total amount to customers</Label>
                <p className="text-xs text-muted-foreground">
                  Controls whether the customer menu/checkout displays the order total
                </p>
              </div>
              <Switch
                checked={!!branchForm.showTotalAmountToCustomers}
                onCheckedChange={(checked) =>
                  setBranchForm((prev) => ({
                    ...prev,
                    showTotalAmountToCustomers: !!checked,
                  }))
                }
              />
            </div>
            {branchForm.logoUrl && (
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                <img
                  src={branchForm.logoUrl}
                  alt="Logo Preview"
                  className="h-16 w-16 object-contain rounded bg-white"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextElementSibling?.classList.remove(
                      "hidden",
                    );
                  }}
                />
                <span className="text-sm text-muted-foreground hidden">
                  Failed to load logo
                </span>
                <div>
                  <p className="text-sm font-medium">Logo Preview</p>
                  <p
                    className="text-xs text-muted-foreground truncate max-w-[300px]"
                    title={branchForm.logoUrl}
                  >
                    {branchForm.logoUrl}
                  </p>
                </div>
              </div>
            )}
          </div>
          <Button
            onClick={async () => {
              await handleUpdateBranch();
              if (branchForm.logoUrl)
                localStorage.setItem("branch_logo_url", branchForm.logoUrl);
              if (branchForm.name)
                localStorage.setItem("branch_name", branchForm.name);
            }}
            disabled={savingBranch}
          >
            {savingBranch ? (
              <>
                <span className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />{" "}
                Saving...
              </>
            ) : (
              "Save Branch Settings"
            )}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-lg">Dashboard password</CardTitle>
          </div>
          <CardDescription>
            Change your admin dashboard login password. You will need to sign in
            again after changing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="admin-current-pw">Current password</Label>
            <Input
              id="admin-current-pw"
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="admin-new-pw">New password</Label>
            <Input
              id="admin-new-pw"
              type="password"
              placeholder="Min 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="admin-confirm-pw">Confirm new password</Label>
            <Input
              id="admin-confirm-pw"
              type="password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button
            disabled={
              changingPassword ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
            onClick={async () => {
              if (newPassword.length < 6) {
                toast({
                  title: "Invalid password",
                  description: "New password must be at least 6 characters",
                  variant: "destructive",
                });
                return;
              }
              if (newPassword !== confirmPassword) {
                toast({
                  title: "Passwords don't match",
                  description: "New password and confirm must match",
                  variant: "destructive",
                });
                return;
              }
              if (!token) {
                toast({
                  title: "Error",
                  description: "Not signed in",
                  variant: "destructive",
                });
                return;
              }
              setChangingPassword(true);
              try {
                const res = await fetch(`${apiBase}/auth/change-password`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ currentPassword, newPassword }),
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                  toast({
                    title: "Password updated",
                    description: "Use your new password next time you sign in.",
                  });
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                } else {
                  toast({
                    title: "Error",
                    description:
                      (data as { message?: string }).message ||
                      "Failed to update password",
                    variant: "destructive",
                  });
                }
              } catch {
                toast({
                  title: "Error",
                  description: "Failed to update password",
                  variant: "destructive",
                });
              } finally {
                setChangingPassword(false);
              }
            }}
          >
            {changingPassword ? (
              <>
                <span
                  className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
                  aria-hidden
                />{" "}
                Updating…
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-lg">System Preferences</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm">Order Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Show alerts for new orders
                </p>
              </div>
              <Switch
                checked={orderNotificationsEnabled}
                onCheckedChange={(v) => setOrderNotificationsEnabled(!!v)}
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm">Sound Alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Play sound on new orders
                </p>
              </div>
              <Switch
                checked={soundAlertsEnabled}
                onCheckedChange={(v) => setSoundAlertsEnabled(!!v)}
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm">Auto-refresh</Label>
                <p className="text-xs text-muted-foreground">
                  Auto refresh data every 10s
                </p>
              </div>
              <Switch
                checked={autoRefreshEnabled}
                onCheckedChange={(v) => setAutoRefreshEnabled(!!v)}
              />
            </div>
          </div>
          <Button
            size="sm"
            disabled={savingSystemPrefs}
            onClick={async () => {
              setSavingSystemPrefs(true);
              try {
                window.localStorage.setItem(
                  "dm_admin_order_notifications",
                  String(!!orderNotificationsEnabled),
                );
                window.localStorage.setItem(
                  "dm_admin_sound_alerts",
                  String(!!soundAlertsEnabled),
                );
                window.localStorage.setItem(
                  "dm_admin_auto_refresh",
                  String(!!autoRefreshEnabled),
                );
                toast({
                  title: "Saved",
                  description: "System preferences updated for this browser.",
                });
              } catch {
                toast({
                  title: "Could not save",
                  description:
                    "Your browser blocked storage. Try allowing site storage and retry.",
                  variant: "destructive",
                });
              } finally {
                setSavingSystemPrefs(false);
              }
            }}
          >
            {savingSystemPrefs ? "Saving..." : "Save System Settings"}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-lg">Error Logs</CardTitle>
            {errorLogs.unresolvedCount > 0 && (
              <Badge variant="destructive">
                {errorLogs.unresolvedCount} unresolved
              </Badge>
            )}
          </div>
          <CardDescription>
            API failures, database errors, and suggested fixes. Resolve in Error
            Logs API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {errorLogs.logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No errors logged yet.
              </p>
            ) : (
              <div className="space-y-2">
                {errorLogs.logs.slice(0, 8).map((log) => (
                  <div key={log.id} className="p-3 rounded-lg border text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={
                          log.status === "RESOLVED"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {log.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground truncate">
                      {log.errorMessage}
                    </p>
                    {log.apiEndpoint && (
                      <p className="text-xs text-muted-foreground">
                        {log.apiEndpoint}
                      </p>
                    )}
                    {(log.metadata as any)?.suggestedFix && (
                      <p className="text-xs text-emerald-700 mt-1">
                        Fix: {(log.metadata as any).suggestedFix}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-lg">Recent Notifications</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No notifications yet
                </p>
              ) : (
                notifications.map((notif, index) => (
                  <div
                    key={
                      (notif as any).id ?? `notif-${notif.createdAt}-${index}`
                    }
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-50"
                  >
                    <div className="p-1.5 bg-blue-100 rounded-full">
                      <Bell className="h-3 w-3 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{notif.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(notif.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
});

// Add Employee Dialog – module-level so it doesn’t re-mount on parent render (no flash on type/clear)
const AddEmployeeDialog = memo(function AddEmployeeDialog({
  open,
  onOpenChange,
  onCreated,
  token,
  branches,
  onGoToSettings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (emp: Employee) => void;
  token: string | null;
  branches: { id: number; name: string }[];
  onGoToSettings?: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<EmployeeFormState & { branchId: number }>({
    name: "",
    email: "",
    employeeCode: "",
    role: "Counter Staff",
    status: "ACTIVE",
    phone: "",
    salary: "",
    address: "",
    pincode: "",
    workingHoursPerDay: "8",
    shiftStartTime: "10:00",
    shiftEndTime: "18:00",
    joiningDate: "",
    branchId: 0,
  });
  const [saving, setSaving] = useState(false);
  // When dialog opens or branches load, set default branch
  useEffect(() => {
    if (open && branches.length > 0) {
      const firstId = branches[0].id;
      setForm((f) =>
        f.branchId && branches.some((b) => b.id === f.branchId)
          ? f
          : { ...f, branchId: firstId },
      );
    }
  }, [open, branches]);
  const branchId =
    form.branchId && branches.some((b) => b.id === form.branchId)
      ? form.branchId
      : (branches[0]?.id ?? 0);
  const handleCreate = async () => {
    if (!token || !form.name.trim() || !form.email.trim()) return;
    if (!branchId || !branches.some((b) => b.id === branchId)) {
      toast({
        title: "Select branch",
        description: "Create a branch in Settings first, then add an employee.",
        variant: "destructive",
      });
      if (onGoToSettings) onGoToSettings();
      return;
    }
    const whpd = Number(form.workingHoursPerDay);
    if (!(whpd >= 1 && whpd <= 24)) {
      toast({
        title: "Invalid working hours",
        description: "Working Hours Per Day must be between 1 and 24.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        branchId,
      };
      if (form.role?.trim()) payload.role = form.role.trim();
      if (form.phone?.toString().trim())
        payload.phone = form.phone.toString().trim();
      if (form.salary !== "" && Number(form.salary) > 0)
        payload.salary = Number(form.salary);
      if (form.address?.toString().trim())
        payload.address = form.address.toString().trim();
      if (form.pincode?.toString().trim())
        payload.pincode = form.pincode.toString().trim();
      const whpd = Number(form.workingHoursPerDay);
      if (whpd >= 1 && whpd <= 24) payload.workingHoursPerDay = whpd;
      if (form.shiftStartTime?.trim())
        payload.shiftStartTime = form.shiftStartTime.trim();
      if (form.shiftEndTime?.trim())
        payload.shiftEndTime = form.shiftEndTime.trim();
      if (form.joiningDate?.trim())
        payload.joiningDate = form.joiningDate.trim();
      const res = await fetch(`${apiBase}/employees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Success",
          description: "Employee created. Verification email sent.",
        });
        setForm({
          name: "",
          email: "",
          employeeCode: "",
          role: "Counter Staff",
          status: "ACTIVE",
          phone: "",
          salary: "",
          address: "",
          pincode: "",
          workingHoursPerDay: "8",
          shiftStartTime: "10:00",
          shiftEndTime: "18:00",
          joiningDate: "",
          branchId: branches[0]?.id ?? 0,
        } as EmployeeFormState & { branchId: number });
        onOpenChange(false);
        onCreated(data);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Error",
          description:
            (err as { message?: string }).message ||
            "Failed to create employee",
          variant: "destructive",
        });
      }
    } catch (e) {
      const isNetworkError =
        e instanceof TypeError &&
        (e.message === "Failed to fetch" ||
          (e as Error).message?.includes("fetch"));
      toast({
        title: "Error",
        description: isNetworkError
          ? "Could not reach server. Check that the backend is running."
          : "Failed to create employee",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="add-employee-desc">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
          <DialogDescription id="add-employee-desc" className="sr-only">
            Enter employee details and assign a branch.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Branch *</Label>
            {branches.length > 0 ? (
              <Select
                value={
                  branchId && branches.some((b) => b.id === branchId)
                    ? String(branchId)
                    : String(branches[0]?.id ?? "")
                }
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, branchId: Number(v) }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  className="max-h-[280px]"
                >
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-medium">No branch yet</p>
                <p className="mt-1 text-xs">
                  Create a branch in Settings first, then you can add employees
                  and select the branch here.
                </p>
                {onGoToSettings && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 border-amber-300 text-amber-800 hover:bg-amber-100"
                    onClick={onGoToSettings}
                  >
                    Go to Settings → Create Branch
                  </Button>
                )}
              </div>
            )}
          </div>
          <Input
            placeholder="Full Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            placeholder="Role (e.g. Counter Staff, Kitchen)"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          />
          <Input
            placeholder="Mobile"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            placeholder="Salary (optional)"
            type="number"
            value={form.salary}
            onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
          />
          <div className="grid gap-2">
            <Label>Working Hours Per Day *</Label>
            <Input
              type="number"
              min={1}
              max={24}
              placeholder="Enter daily working hours (e.g., 8)"
              value={form.workingHoursPerDay}
              onChange={(e) =>
                setForm((f) => ({ ...f, workingHoursPerDay: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Required for payroll and overtime (1–24 hours). Overtime starts
              after this.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Shift Start Time</Label>
              <Input
                type="time"
                value={form.shiftStartTime}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    shiftStartTime: e.target.value || "10:00",
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Scheduled start (for late tracking)
              </p>
            </div>
            <div className="space-y-1">
              <Label>Shift End Time</Label>
              <Input
                type="time"
                value={form.shiftEndTime}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    shiftEndTime: e.target.value || "18:00",
                  }))
                }
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Joining Date</Label>
            <Input
              type="date"
              value={form.joiningDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, joiningDate: e.target.value }))
              }
              className="w-full min-h-[44px] sm:min-h-0"
            />
          </div>
          <Input
            placeholder="Address (optional)"
            value={form.address}
            onChange={(e) =>
              setForm((f) => ({ ...f, address: e.target.value }))
            }
          />
          <Input
            placeholder="Pincode (optional)"
            value={form.pincode}
            onChange={(e) =>
              setForm((f) => ({ ...f, pincode: e.target.value }))
            }
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving || branches.length === 0}
          >
            {saving ? (
              <>
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

// Edit Employee Dialog – module-level so it doesn’t re-mount on parent render (no flash on type/clear)
const EditEmployeeDialog = memo(function EditEmployeeDialog({
  open,
  employee,
  onOpenChange,
  onSaved,
  token,
}: {
  open: boolean;
  employee: Employee | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (emp: Employee) => void;
  token: string | null;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<EmployeeFormState>({
    name: "",
    email: "",
    employeeCode: "",
    role: "",
    status: "ACTIVE",
    phone: "",
    salary: "",
    address: "",
    pincode: "",
    workingHoursPerDay: "8",
    shiftStartTime: "10:00",
    shiftEndTime: "18:00",
    joiningDate: "",
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open && employee) {
      const joinDate = employee.joiningDate
        ? typeof employee.joiningDate === "string"
          ? employee.joiningDate.slice(0, 10)
          : ""
        : "";
      setForm({
        name: employee.name,
        email: employee.email,
        employeeCode: employee.employeeCode,
        role: employee.role ?? "",
        status: employee.status,
        phone: employee.phone ?? "",
        salary: employee.salary ?? "",
        address: employee.address ?? "",
        pincode: employee.pincode ?? "",
        workingHoursPerDay: employee.workingHoursPerDay ?? 8,
        shiftStartTime: employee.shiftStartTime ?? "10:00",
        shiftEndTime: employee.shiftEndTime ?? "18:00",
        joiningDate: joinDate,
      });
    }
  }, [open, employee]);
  const handleSave = async () => {
    if (!token || !employee) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name?.trim() ?? "",
        email: form.email?.trim() ?? "",
        role: form.role?.trim() || null,
        phone: form.phone?.toString().trim() || null,
        salary:
          form.salary !== "" && form.salary !== undefined
            ? Number(form.salary) || null
            : null,
        address: form.address?.toString().trim() || null,
        pincode: form.pincode?.toString().trim() || null,
        status: form.status,
      };
      const whpd = Number(form.workingHoursPerDay);
      if (whpd >= 1 && whpd <= 24) payload.workingHoursPerDay = whpd;
      if (form.shiftStartTime !== undefined)
        payload.shiftStartTime = form.shiftStartTime?.trim() || null;
      if (form.shiftEndTime !== undefined)
        payload.shiftEndTime = form.shiftEndTime?.trim() || null;
      if (form.joiningDate !== undefined)
        payload.joiningDate = form.joiningDate?.trim() || null;
      const res = await fetch(`${apiBase}/employees/${employee.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        toast({ title: "Success", description: "Employee updated" });
        onOpenChange(false);
        onSaved(updated);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Error",
          description:
            (err as { message?: string }).message || "Failed to update",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to update employee",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent aria-describedby="edit-employee-desc">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
          <DialogDescription id="edit-employee-desc" className="sr-only">
            Update employee name, email, and role.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input
            placeholder="Full Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            placeholder="Role (e.g. Counter Staff, Kitchen)"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          />
          <Input
            placeholder="Mobile"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            placeholder="Salary"
            type="number"
            value={form.salary}
            onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
          />
          <div className="grid gap-2">
            <Label>Working Hours Per Day</Label>
            <Input
              type="number"
              min={1}
              max={24}
              placeholder="Enter daily working hours (e.g., 8)"
              value={form.workingHoursPerDay}
              onChange={(e) =>
                setForm((f) => ({ ...f, workingHoursPerDay: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Shift Start Time</Label>
              <Input
                type="time"
                value={form.shiftStartTime}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    shiftStartTime: e.target.value || "10:00",
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Shift End Time</Label>
              <Input
                type="time"
                value={form.shiftEndTime}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    shiftEndTime: e.target.value || "18:00",
                  }))
                }
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Joining Date</Label>
            <Input
              type="date"
              value={form.joiningDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, joiningDate: e.target.value }))
              }
              className="w-full min-h-[44px] sm:min-h-0"
            />
          </div>
          <Input
            placeholder="Address"
            value={form.address}
            onChange={(e) =>
              setForm((f) => ({ ...f, address: e.target.value }))
            }
          />
          <Input
            placeholder="Pincode"
            value={form.pincode}
            onChange={(e) =>
              setForm((f) => ({ ...f, pincode: e.target.value }))
            }
          />
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={form.status === "ACTIVE" ? "default" : "outline"}
                size="sm"
                className={
                  form.status === "ACTIVE" ? STATUS_BUTTON_ACTIVE.ACTIVE : ""
                }
                onClick={() => setForm((f) => ({ ...f, status: "ACTIVE" }))}
              >
                Active
              </Button>
              <Button
                type="button"
                variant={form.status === "INACTIVE" ? "default" : "outline"}
                size="sm"
                className={
                  form.status === "INACTIVE"
                    ? STATUS_BUTTON_ACTIVE.INACTIVE
                    : ""
                }
                onClick={() => setForm((f) => ({ ...f, status: "INACTIVE" }))}
              >
                Inactive
              </Button>
              <Button
                type="button"
                variant={form.status === "LEFT" ? "default" : "outline"}
                size="sm"
                className={
                  form.status === "LEFT" ? STATUS_BUTTON_ACTIVE.LEFT : ""
                }
                onClick={() => setForm((f) => ({ ...f, status: "LEFT" }))}
              >
                Left
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

// Change password (admin): set new password; director(s) receive email with new password
const ChangePasswordDialog = memo(function ChangePasswordDialog({
  open,
  employee,
  onOpenChange,
  onSuccess,
  token,
  loading,
  setLoading,
}: {
  open: boolean;
  employee: Employee | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  token: string | null;
  loading: boolean;
  setLoading: (id: number | null) => void;
}) {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  useEffect(() => {
    if (!open) {
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [open]);
  const handleSubmit = async () => {
    if (!employee || !token) return;
    if (newPassword.length < 6) {
      toast({
        title: "Invalid password",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirm password must match",
        variant: "destructive",
      });
      return;
    }
    setLoading(employee.id);
    try {
      const res = await fetch(
        `${apiBase}/employees/${employee.id}/admin-set-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ newPassword }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: "Password updated",
          description:
            "Director(s) will receive an email with the new password.",
        });
        onOpenChange(false);
        onSuccess();
      } else {
        toast({
          title: "Error",
          description:
            (data as { message?: string }).message ||
            "Failed to update password",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="max-w-md" aria-describedby="change-pw-desc">
        <DialogHeader>
          <DialogTitle>Change employee password</DialogTitle>
          <DialogDescription id="change-pw-desc">
            {employee
              ? `Set a new password for ${employee.name}. Director(s) for this branch will receive an email with the new password and employee email.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-pw">New password</Label>
            <Input
              id="new-pw"
              type="password"
              placeholder="Min 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pw">Confirm password</Label>
            <Input
              id="confirm-pw"
              type="password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !newPassword || !confirmPassword}
          >
            {loading ? (
              <>
                <span
                  className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"
                  aria-hidden
                />
                Updating…
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

// Salary slip dialog at module level so it does not re-mount on parent re-render (stops flashing)
type SalarySlipDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: {
    id: number;
    name: string;
    employeeCode?: string;
    status: string;
    salary?: number;
    email?: string;
    branch?: { id: number; name: string };
    workingHoursPerDay?: number | null;
  }[];
  branch: any;
  branchForm: any;
  salarySlips: any[];
  setSalarySlips: (fn: (prev: any[]) => any[]) => void;
  cafeLogo: string;
  token: string | null;
  /** When set, dialog opens with this slip's data pre-filled (Generate Again). */
  prefillSlip?: any;
};
const SalarySlipDialogModule = memo(function SalarySlipDialogModule(
  props: SalarySlipDialogProps,
) {
  const {
    open,
    onOpenChange,
    employees: propsEmployees,
    branch,
    branchForm,
    salarySlips,
    setSalarySlips,
    cafeLogo,
    token,
    prefillSlip,
  } = props;
  const { toast } = useToast();
  const [localEmployees, setLocalEmployees] = useState<typeof propsEmployees>(
    [],
  );
  const [employeesLoading, setEmployeesLoading] = useState(open);
  // Use fetched list when available; otherwise fall back to props (e.g. while loading or if fetch failed)
  const employees = localEmployees.length > 0 ? localEmployees : propsEmployees;
  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    setEmployeesLoading(true);
    setLocalEmployees([]);
    fetch(`${apiBase}/employees/active`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data)
          ? data
          : data && Array.isArray((data as any).data)
            ? (data as any).data
            : Array.isArray((data as any).employees)
              ? (data as any).employees
              : [];
        setLocalEmployees(list);
      })
      .catch(() => {
        if (!cancelled) setLocalEmployees([]);
      })
      .finally(() => {
        if (!cancelled) setEmployeesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token]);
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [employeeId, setEmployeeId] = useState(0);
  const [payPeriodMonth, setPayPeriodMonth] = useState(defaultMonth);
  const [basicSalary, setBasicSalary] = useState<number>(0);
  const [paidDays, setPaidDays] = useState<number>(22);
  const [lopDays, setLopDays] = useState<number>(0);
  const [payDate, setPayDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [allowanceRows, setAllowanceRows] = useState<
    { id: string; name: string; amount: number }[]
  >([
    { id: "a1", name: "House Rent Allowance", amount: 0 },
    { id: "a2", name: "Other Allowance", amount: 0 },
  ]);
  const [deductionRows, setDeductionRows] = useState<
    { id: string; name: string; amount: number }[]
  >([
    { id: "d1", name: "Income Tax", amount: 0 },
    { id: "d2", name: "Provident Fund", amount: 0 },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [employeeDataLoading, setEmployeeDataLoading] = useState(false);
  const lastAutoFilledEmployeeId = useRef<number>(0);
  const [overtimeStartDate, setOvertimeStartDate] = useState("");
  const [overtimeEndDate, setOvertimeEndDate] = useState("");
  const [overtimeRecords, setOvertimeRecords] = useState<
    {
      id: number | string;
      overtimeHours: number;
      shiftDate: string;
      status?: string;
    }[]
  >([]);
  const [overtimeLoading, setOvertimeLoading] = useState(false);
  const [lateStartDate, setLateStartDate] = useState("");
  const [lateEndDate, setLateEndDate] = useState("");
  const [lateTotalMinutes, setLateTotalMinutes] = useState<number | null>(null);
  const [lateLoading, setLateLoading] = useState(false);

  useEffect(() => {
    if (!open) setEmployeeDataLoading(false);
  }, [open]);

  // When dialog opens with prefillSlip, populate form from stored slip data
  useEffect(() => {
    if (!open || !prefillSlip) return;
    const emp = employees.find(
      (e) =>
        (e.employeeCode && e.employeeCode === prefillSlip.employeeCode) ||
        e.name === prefillSlip.employee?.name,
    );
    if (emp) setEmployeeId(emp.id);
    const monthIdx = SALARY_MONTH_NAMES.indexOf(prefillSlip.month ?? "");
    const y = prefillSlip.year ?? now.getFullYear();
    const m = monthIdx >= 0 ? monthIdx + 1 : now.getMonth() + 1;
    setPayPeriodMonth(`${y}-${String(m).padStart(2, "0")}`);
    setBasicSalary(Number(prefillSlip.basicSalary) || 0);
    setPaidDays(
      prefillSlip.paidDays != null && prefillSlip.paidDays !== ""
        ? Number(prefillSlip.paidDays)
        : 22
    );
    setLopDays(
      prefillSlip.lopDays != null && prefillSlip.lopDays !== ""
        ? Number(prefillSlip.lopDays)
        : 0
    );
    setPayDate(
      prefillSlip.createdAt
        ? new Date(prefillSlip.createdAt).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
    );
    const allow = (prefillSlip.allowances ?? []).map((r: any, i: number) => ({
      id: `a${i}-${Date.now()}`,
      name: r.name ?? "",
      amount: Number(r.amount) || 0,
    }));
    setAllowanceRows(
      allow.length
        ? allow
        : [
            { id: "a1", name: "House Rent Allowance", amount: 0 },
            { id: "a2", name: "Other Allowance", amount: 0 },
          ],
    );
    const ded = (prefillSlip.deductions ?? []).map((r: any, i: number) => ({
      id: `d${i}-${Date.now()}`,
      name: r.name ?? "",
      amount: Number(r.amount) || 0,
    }));
    setDeductionRows(
      ded.length
        ? ded
        : [
            { id: "d1", name: "Income Tax", amount: 0 },
            { id: "d2", name: "Provident Fund", amount: 0 },
          ],
    );
  }, [open, prefillSlip, employees]);
  // API /employees/active returns only ACTIVE; fallback filter if using full list
  const activeEmployees = useMemo(
    () =>
      employees.filter(
        (e) => String(e.status || "").toUpperCase() === "ACTIVE",
      ),
    [employees],
  );
  const employeesToShow =
    activeEmployees.length > 0 ? activeEmployees : employees;
  const selectedEmployee = employeesToShow.find((e) => e.id === employeeId);
  const [payYear, payMonthNum] = payPeriodMonth.split("-").map(Number);
  const payMonthName = SALARY_MONTH_NAMES[(payMonthNum || 1) - 1];
  const payPeriodLabel = payPeriodMonth
    ? `${String(payMonthNum).padStart(2, "0")} - ${payMonthName} ${payYear}`
    : "";
  const companyName =
    branchForm?.name ||
    branch?.name ||
    (typeof window !== "undefined"
      ? window.localStorage.getItem("branch_name")
      : null) ||
    "Cafe Chapter 1 Restro Private Limited";
  const companyAddress =
    branchForm?.location ?? branch?.location ?? "Gautam Nagar";
  const totalAllowances = allowanceRows.reduce(
    (s, r) => s + (r.amount || 0),
    0,
  );
  const totalDeductions = deductionRows.reduce(
    (s, r) => s + (r.amount || 0),
    0,
  );
  const netSalary = (basicSalary || 0) + totalAllowances - totalDeductions;
  const grossEarnings = (basicSalary || 0) + totalAllowances;
  const logoUrl =
    (typeof window !== "undefined" &&
      window.localStorage.getItem("branch_logo_url")) ||
    branchForm?.logoUrl ||
    cafeLogo;
  const companyPincode = branchForm?.pincode || branch?.pincode || "";

  const fetchOvertime = useCallback(async () => {
    if (!token || !selectedEmployee || !overtimeStartDate || !overtimeEndDate)
      return;
    setOvertimeLoading(true);
    try {
      const params = new URLSearchParams({
        dateFrom: overtimeStartDate,
        dateTo: overtimeEndDate,
        employeeId: String(selectedEmployee.id),
      });
      const res = await fetch(`${apiBase}/overtime?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOvertimeRecords(
          (data || []).map((r: any) => ({
            id: r.id,
            overtimeHours: r.overtimeHours ?? 0,
            shiftDate: r.shiftDate,
            status: r.status,
          })),
        );
      } else setOvertimeRecords([]);
    } catch {
      setOvertimeRecords([]);
    } finally {
      setOvertimeLoading(false);
    }
  }, [token, selectedEmployee, overtimeStartDate, overtimeEndDate]);

  const addOvertimeToSlip = (overtimeHours: number) => {
    const daysInMonth = paidDays + lopDays || 22;
    const hoursPerDay = Number(selectedEmployee?.workingHoursPerDay) || 8;
    const dailySalary = (basicSalary || 0) / daysInMonth;
    const hourlyRate = dailySalary / hoursPerDay;
    const amount = Math.round(overtimeHours * hourlyRate);
    setAllowanceRows((prev) => [
      ...prev,
      {
        id: `ot-${Date.now()}`,
        name: `Overtime (${formatHours(overtimeHours)})`,
        amount,
      },
    ]);
    toast({
      title: "Added",
      description: `Overtime ₹${amount} added to earnings.`,
    });
  };

  const formatLateMinutesHuman = (mins: number) => {
    if (mins < 60) return `${mins} Minute${mins !== 1 ? "s" : ""}`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h} Hour${h !== 1 ? "s" : ""}`;
    return `${h} Hour${h !== 1 ? "s" : ""} ${m} Min`;
  };

  const fetchLate = useCallback(async () => {
    if (!token || !selectedEmployee || !lateStartDate || !lateEndDate) return;
    setLateLoading(true);
    setLateTotalMinutes(null);
    try {
      const params = new URLSearchParams({
        employeeId: String(selectedEmployee.id),
        dateFrom: lateStartDate,
        dateTo: lateEndDate,
      });
      const res = await fetch(`${apiBase}/late/summary?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLateTotalMinutes(data.totalLateMinutes ?? 0);
      }
    } catch {
      setLateTotalMinutes(null);
    } finally {
      setLateLoading(false);
    }
  }, [token, selectedEmployee, lateStartDate, lateEndDate]);

  const addLateDeductionToSlip = (amount: number) => {
    const mins = lateTotalMinutes ?? 0;
    const label = mins > 0 ? `Late (${formatLateMinutesHuman(mins)})` : "Late";
    setDeductionRows((prev) => [
      ...prev,
      { id: `late-${Date.now()}`, name: label, amount },
    ]);
    toast({
      title: "Added",
      description:
        amount > 0
          ? `Late deduction ₹${amount} added.`
          : "Late entry added to slip (edit amount if needed).",
    });
  };

  useEffect(() => {
    if (
      !selectedEmployee ||
      selectedEmployee.id === lastAutoFilledEmployeeId.current
    ) {
      if (!employeeId) setEmployeeDataLoading(false);
      return;
    }
    lastAutoFilledEmployeeId.current = selectedEmployee.id;
    const base = Number(selectedEmployee.salary) || 0;
    setBasicSalary(base);
    setPaidDays(22);
    setLopDays(0);
    setAllowanceRows((prev) =>
      prev.map((r, i) =>
        i === 0
          ? {
              ...r,
              name: "House Rent Allowance",
              amount: Math.round(base * 0.2),
            }
          : i === 1
            ? { ...r, name: "Other Allowance", amount: 0 }
            : r,
      ),
    );
    setEmployeeDataLoading(false);
  }, [employeeId, selectedEmployee]);

  const addAllowance = () =>
    setAllowanceRows((prev) => [
      ...prev,
      { id: `a${Date.now()}`, name: "", amount: 0 },
    ]);
  const removeAllowance = (id: string) =>
    setAllowanceRows((prev) => prev.filter((r) => r.id !== id));
  const updateAllowance = (
    id: string,
    field: "name" | "amount",
    value: string | number,
  ) =>
    setAllowanceRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, [field]: field === "amount" ? Number(value) || 0 : value }
          : r,
      ),
    );
  const addDeduction = () =>
    setDeductionRows((prev) => [
      ...prev,
      { id: `d${Date.now()}`, name: "", amount: 0 },
    ]);
  const removeDeduction = (id: string) =>
    setDeductionRows((prev) => prev.filter((r) => r.id !== id));
  const updateDeduction = (
    id: string,
    field: "name" | "amount",
    value: string | number,
  ) =>
    setDeductionRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, [field]: field === "amount" ? Number(value) || 0 : value }
          : r,
      ),
    );

  const handleSendEmail = async () => {
    if (!selectedEmployee) {
      toast({
        title: "Select employee",
        description: "Please select an employee first.",
        variant: "destructive",
      });
      return;
    }
    if (!token) {
      toast({
        title: "Error",
        description: "Not authenticated.",
        variant: "destructive",
      });
      return;
    }
    const directorEmails = (branchForm?.directorsEmail || "")
      .split(/[\s,]+/)
      .map((e: string) => e.trim())
      .filter(
        (e: string) => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
      );
    const employeeEmail =
      selectedEmployee.email &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(selectedEmployee.email)
        ? selectedEmployee.email
        : null;
    const to = [
      ...new Set([employeeEmail, ...directorEmails].filter(Boolean)),
    ] as string[];
    if (to.length === 0) {
      toast({
        title: "No email addresses",
        description:
          "Add employee email or directors' emails in Settings (Directors Email) to send the salary slip.",
        variant: "destructive",
      });
      return;
    }
    const html = buildPayslipPrintHtmlModule({
      logoUrl: String(logoUrl),
      companyName,
      companyAddress,
      companyPincode,
      phone: branchForm?.phone || "",
      payMonthName,
      payYear,
      payPeriodLabel,
      payDate,
      salaryNumber: getNextSalaryNumberModule(
        salarySlips,
        payYear,
        payMonthName,
      ),
      selectedEmployee,
      paidDays,
      lopDays,
      basicSalary: basicSalary || 0,
      allowanceRows,
      deductionRows,
      grossEarnings,
      totalDeductions,
      netSalary,
    });
    const subject = `Salary Slip – ${selectedEmployee.name} – ${payMonthName} ${payYear}`;
    setSendingEmail(true);
    try {
      const res = await fetch(`${apiBase}/reports/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to, subject, html }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: "Email sent",
          description: `Salary slip sent to ${to.length} recipient(s).`,
        });
      } else {
        toast({
          title: "Send failed",
          description:
            (data as { message?: string }).message || "Failed to send email.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Send failed",
        description: "Network error. Check backend and try again.",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedEmployee) {
      toast({
        title: "Select employee",
        description: "Please select an employee first.",
        variant: "destructive",
      });
      return;
    }
    setIsGenerating(true);
    try {
      const salaryNumber = getNextSalaryNumberModule(
        salarySlips,
        payYear,
        payMonthName,
      );
      const res = await fetch(`${apiBase}/reports/salary-slips`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          salaryNumber,
          month: payMonthNum,
          year: payYear,
          paidDays,
          lopDays,
          basicSalary: basicSalary || 0,
          netSalary,
          allowances: allowanceRows,
          deductions: deductionRows,
        }),
      });
      const created = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          created && typeof created === "object" && "message" in created
            ? String((created as any).message)
            : "Failed to save salary slip";
        throw new Error(msg);
      }

      const normalized = {
        ...(created as any),
        month:
          typeof (created as any)?.month === "number"
            ? monthNumberToName((created as any).month) ?? payMonthName
            : (created as any)?.month ?? payMonthName,
        employeeCode:
          (created as any)?.employee?.employeeCode ??
          (created as any)?.employeeCode ??
          selectedEmployee.employeeCode,
        allowances: Array.isArray((created as any)?.allowances)
          ? (created as any).allowances
          : allowanceRows,
        deductions: Array.isArray((created as any)?.deductions)
          ? (created as any).deductions
          : deductionRows,
      };

      setSalarySlips((prev) => [normalized, ...prev]);
      onOpenChange(false);
      toast({
        title: "Slip generated successfully",
        description: `Salary slip for ${selectedEmployee.name} has been saved and added to the list.`,
      });
    } catch (e: unknown) {
      const err = e as { message?: string; errors?: { message?: string }[] };
      toast({
        title: "Error",
        description:
          err?.message ||
          err?.errors?.[0]?.message ||
          "Failed to generate slip",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="max-w-4xl w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-h-[90vh] sm:max-h-[85vh] overflow-y-auto overflow-x-hidden p-0 gap-0 fixed left-[50%] top-[50%] z-[110] border-2 border-slate-200 bg-white shadow-2xl translate-x-[-50%] translate-y-[-50%] rounded-lg sm:rounded-xl opacity-100 min-w-0"
        aria-describedby="salary-slip-desc"
      >
        <DialogTitle className="sr-only">Generate Salary Slip</DialogTitle>
        <DialogDescription id="salary-slip-desc" className="sr-only">
          Select employee, pay period, and salary components. Preview or
          download the payslip before generating.
        </DialogDescription>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 z-[120] rounded-full bg-white/20 hover:bg-white/30 text-white h-9 w-9 shrink-0"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="rounded-t-lg px-3 sm:px-6 py-3 sm:py-4 pr-10 sm:pr-12 text-white flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-3 sm:gap-4 bg-gradient-to-r from-[#064E3B] to-[#047857] shrink-0 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <img
              src={logoUrl}
              alt=""
              className="h-10 w-10 sm:h-16 sm:w-16 object-contain rounded bg-white p-1 sm:p-1.5 shrink-0"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-white/80 text-[10px] uppercase tracking-wide">
                Restaurant / Company
              </p>
              <p className="font-bold text-base sm:text-xl truncate">
                {companyName}
              </p>
              <p className="text-white/90 text-xs sm:text-sm truncate">
                {companyAddress || "—"}
                {companyPincode ? `, ${companyPincode}` : ""}
                {companyAddress || companyPincode ? ", India" : ""}
              </p>
              {branchForm?.phone && (
                <p className="text-white/80 text-xs mt-0.5">
                  Ph: {branchForm.phone}
                </p>
              )}
            </div>
          </div>
          <div className="w-full sm:w-auto flex flex-col sm:items-end gap-2">
            <Label className="text-white/90 text-sm">
              Payslip For The Month
            </Label>
            <input
              type="month"
              value={payPeriodMonth}
              onChange={(e) => setPayPeriodMonth(e.target.value)}
              className="rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white font-semibold text-base min-h-11 w-full sm:min-w-[180px] [color-scheme:dark]"
              title="Select month"
            />
            {payPeriodLabel && (
              <p className="text-white/90 text-xs sm:text-right">
                {payPeriodLabel}
              </p>
            )}
          </div>
        </div>
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto overflow-x-hidden min-w-0">
          <div className="grid gap-2">
            <Label className="text-sm font-medium">Employee *</Label>
            <Select
              value={
                employeeId && employeesToShow.some((e) => e.id === employeeId)
                  ? String(employeeId)
                  : "0"
              }
              onValueChange={(v) => {
                const id = v === "0" ? 0 : Number(v);
                if (id) setEmployeeDataLoading(true);
                setEmployeeId(id);
              }}
            >
              <SelectTrigger
                className={SALARY_INPUT_CLASS + " w-full"}
                id="salary-slip-employee-select"
              >
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                className="max-h-[320px]"
                sideOffset={4}
              >
                <SelectItem value="0" disabled>
                  Select employee
                </SelectItem>
                {employeesLoading ? (
                  <SelectItem value="_loading" disabled>
                    Loading employees...
                  </SelectItem>
                ) : employeesToShow.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    No employee
                  </SelectItem>
                ) : (
                  employeesToShow.map(
                    (emp: SalarySlipDialogProps["employees"][number]) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        <span className="truncate block">
                          {emp.name ?? "—"}
                          {emp.employeeCode ? ` · ${emp.employeeCode}` : ""}
                          {"email" in emp && emp.email ? ` · ${emp.email}` : ""}
                          {"branch" in emp && emp.branch?.name
                            ? ` · ${emp.branch.name}`
                            : ""}
                        </span>
                      </SelectItem>
                    ),
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className={SALARY_CARD_CLASS + " relative"}>
            {employeeDataLoading && (
              <div className="absolute inset-0 bg-slate-50/80 rounded-lg flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-slate-600">
                    Loading employee data...
                  </span>
                </div>
              </div>
            )}
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              Employee Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">
                  Salary Slip No. (auto-generated, not editable)
                </Label>
                <Input
                  value={getNextSalaryNumberModule(
                    salarySlips,
                    payYear,
                    payMonthName,
                  )}
                  readOnly
                  className={SALARY_INPUT_CLASS + " bg-slate-100 font-mono"}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Employee Name
                </Label>
                <Input
                  value={selectedEmployee?.name ?? ""}
                  readOnly
                  className={SALARY_INPUT_CLASS + " bg-slate-50"}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Employee ID
                </Label>
                <Input
                  value={selectedEmployee?.employeeCode ?? ""}
                  readOnly
                  className={SALARY_INPUT_CLASS + " bg-slate-50"}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Pay Period
                </Label>
                <Input
                  type="date"
                  value={payPeriodMonth ? `${payPeriodMonth}-01` : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) setPayPeriodMonth(v.slice(0, 7));
                  }}
                  className={SALARY_INPUT_CLASS}
                  title="Select pay period (month)"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Pay Date
                </Label>
                <Input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className={SALARY_INPUT_CLASS}
                />
              </div>
            </div>
          </div>
          <div className={SALARY_CARD_CLASS}>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              Overtime (optional)
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Load overtime for the selected employee in a date range, then add
              total hours to the slip. Amount is calculated from basic salary
              and working hours per day.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="space-y-1">
                <Label className="text-xs">Start date</Label>
                <Input
                  type="date"
                  value={overtimeStartDate}
                  onChange={(e) => setOvertimeStartDate(e.target.value)}
                  className={SALARY_INPUT_CLASS}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End date</Label>
                <Input
                  type="date"
                  value={overtimeEndDate}
                  onChange={(e) => setOvertimeEndDate(e.target.value)}
                  className={SALARY_INPUT_CLASS}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchOvertime}
                disabled={
                  !selectedEmployee ||
                  !overtimeStartDate ||
                  !overtimeEndDate ||
                  overtimeLoading
                }
              >
                {overtimeLoading ? "Loading..." : "Load overtime"}
              </Button>
              {overtimeRecords.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() =>
                    addOvertimeToSlip(
                      overtimeRecords.reduce((s, r) => s + r.overtimeHours, 0),
                    )
                  }
                >
                  Add{" "}
                  {formatHours(
                    overtimeRecords.reduce((s, r) => s + r.overtimeHours, 0),
                  )}{" "}
                  to slip
                </Button>
              )}
            </div>
            {overtimeRecords.length > 0 && (
              <div className="rounded border border-slate-200 p-2 max-h-32 overflow-y-auto">
                <p className="text-xs font-medium text-slate-600 mb-1">
                  Overtime entries
                </p>
                <ul className="text-xs space-y-0.5">
                  {overtimeRecords.map((r) => (
                    <li key={String(r.id)} className="flex justify-between">
                      <span>
                        {r.shiftDate
                          ? new Date(r.shiftDate).toLocaleDateString()
                          : "—"}
                      </span>
                      <span>{formatHours(r.overtimeHours)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className={SALARY_CARD_CLASS}>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              Late (optional)
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Load late entries for the selected employee in a date range. You
              can add a late deduction to the slip if needed.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="space-y-1">
                <Label className="text-xs">Start date</Label>
                <Input
                  type="date"
                  value={lateStartDate}
                  onChange={(e) => setLateStartDate(e.target.value)}
                  className={SALARY_INPUT_CLASS}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End date</Label>
                <Input
                  type="date"
                  value={lateEndDate}
                  onChange={(e) => setLateEndDate(e.target.value)}
                  className={SALARY_INPUT_CLASS}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchLate}
                disabled={
                  !selectedEmployee ||
                  !lateStartDate ||
                  !lateEndDate ||
                  lateLoading
                }
              >
                {lateLoading ? "Loading..." : "Load late"}
              </Button>
              {lateTotalMinutes !== null && (
                <>
                  <span className="text-sm text-slate-600">
                    Total late: {formatLateMinutesHuman(lateTotalMinutes)}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => addLateDeductionToSlip(0)}
                  >
                    Add late to slip (edit amount)
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className={SALARY_CARD_CLASS}>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              Salary Earnings
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-100">
                <span className="text-sm text-slate-700">Basic Salary</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">₹</span>
                  <Input
                    type="number"
                    min={0}
                    className={SALARY_INPUT_CLASS + " w-28 text-right"}
                    value={basicSalary || ""}
                    onChange={(e) =>
                      setBasicSalary(Number(e.target.value) || 0)
                    }
                  />
                </div>
              </div>
              {allowanceRows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-4 py-2 border-b border-slate-100"
                >
                  <Input
                    placeholder="e.g. HRA"
                    className={
                      SALARY_INPUT_CLASS +
                      " flex-1 max-w-[200px] border-0 border-b border-transparent bg-transparent shadow-none focus-visible:ring-0 py-0 h-9"
                    }
                    value={r.name}
                    onChange={(e) =>
                      updateAllowance(r.id, "name", e.target.value)
                    }
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">₹</span>
                    <Input
                      type="number"
                      min={0}
                      className={SALARY_INPUT_CLASS + " w-24 text-right"}
                      value={r.amount || ""}
                      onChange={(e) =>
                        updateAllowance(r.id, "amount", e.target.value)
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                      onClick={() => removeAllowance(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="pt-2 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addAllowance}
                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-xs"
                >
                  + Add Earnings
                </Button>
              </div>
            </div>
          </div>
          <div className={SALARY_CARD_CLASS}>
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <MinusCircle className="h-4 w-4 text-red-500" /> Deductions
            </h3>
            <div className="space-y-3">
              {deductionRows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-4 py-2 border-b border-slate-100"
                >
                  <Input
                    placeholder="e.g. Income Tax"
                    className={
                      SALARY_INPUT_CLASS +
                      " flex-1 max-w-[200px] border-0 border-b border-transparent bg-transparent shadow-none focus-visible:ring-0 py-0 h-9"
                    }
                    value={r.name}
                    onChange={(e) =>
                      updateDeduction(r.id, "name", e.target.value)
                    }
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">₹</span>
                    <Input
                      type="number"
                      min={0}
                      className={SALARY_INPUT_CLASS + " w-24 text-right"}
                      value={r.amount || ""}
                      onChange={(e) =>
                        updateDeduction(r.id, "amount", e.target.value)
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                      onClick={() => removeDeduction(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="pt-2 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addDeduction}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                >
                  + Add Deductions
                </Button>
              </div>
            </div>
          </div>
          <div
            className={
              SALARY_CARD_CLASS +
              " bg-gradient-to-br from-emerald-50 to-white border-emerald-100"
            }
          >
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              Salary Summary
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Paid Days
                </Label>
                <Input
                  type="number"
                  min={0}
                  className={SALARY_INPUT_CLASS}
                  value={paidDays}
                  onChange={(e) => setPaidDays(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  LOP Days
                </Label>
                <Input
                  type="number"
                  min={0}
                  className={SALARY_INPUT_CLASS}
                  value={lopDays}
                  onChange={(e) => setLopDays(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="space-y-2 text-sm border-t border-slate-200 pt-4">
              <div className="flex justify-between">
                <span className="text-slate-600">Gross Salary</span>
                <span className="font-medium">{formatINR(grossEarnings)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Deduction</span>
                <span className="font-medium text-red-600">
                  {formatINR(totalDeductions)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-3 mt-3 border-t-2 border-emerald-200">
                <span className="font-semibold text-slate-800">Net Salary</span>
                <span className="text-xl font-bold text-emerald-700">
                  {formatINR(netSalary)}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-wrap gap-2 pt-4 border-t border-slate-200 sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg h-10"
              onClick={() => {
                const html = buildPayslipPrintHtmlModule({
                  logoUrl: String(logoUrl),
                  companyName,
                  companyAddress,
                  companyPincode,
                  phone: branchForm?.phone || "",
                  payMonthName,
                  payYear,
                  payPeriodLabel,
                  payDate,
                  salaryNumber: getNextSalaryNumberModule(
                    salarySlips,
                    payYear,
                    payMonthName,
                  ),
                  selectedEmployee,
                  paidDays,
                  lopDays,
                  basicSalary: basicSalary || 0,
                  allowanceRows,
                  deductionRows,
                  grossEarnings,
                  totalDeductions,
                  netSalary,
                });
                const w = window.open("", "_blank");
                if (w) {
                  w.document.write(html);
                  w.document.close();
                  w.focus();
                }
              }}
            >
              <Eye className="h-4 w-4 mr-2" /> Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg h-10"
              onClick={() => {
                const html = buildPayslipPrintHtmlModule({
                  logoUrl: String(logoUrl),
                  companyName,
                  companyAddress,
                  companyPincode,
                  phone: branchForm?.phone || "",
                  payMonthName,
                  payYear,
                  payPeriodLabel,
                  payDate,
                  salaryNumber: getNextSalaryNumberModule(
                    salarySlips,
                    payYear,
                    payMonthName,
                  ),
                  selectedEmployee,
                  paidDays,
                  lopDays,
                  basicSalary: basicSalary || 0,
                  allowanceRows,
                  deductionRows,
                  grossEarnings,
                  totalDeductions,
                  netSalary,
                });
                const w = window.open("", "_blank");
                if (w) {
                  w.document.write(html);
                  w.document.close();
                  w.focus();
                  setTimeout(() => {
                    w.print();
                    w.close();
                  }, 400);
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" /> Download
            </Button>
            <LoaderButton
              variant="outline"
              size="sm"
              className="rounded-lg h-10"
              onClick={handleSendEmail}
              disabled={!selectedEmployee}
              loading={sendingEmail}
              loadingLabel="Sending…"
            >
              <Mail className="h-4 w-4 mr-2" /> Send Email
            </LoaderButton>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg h-10"
              onClick={() =>
                toast({
                  title: "Send WhatsApp",
                  description:
                    "Salary slip will be sent to employee via WhatsApp",
                })
              }
            >
              <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-lg h-11"
            >
              Cancel
            </Button>
            <LoaderButton
              onClick={handleGenerate}
              disabled={!selectedEmployee}
              loading={isGenerating}
              loadingLabel="Generating..."
              className="rounded-lg h-12 bg-gradient-to-r from-[#064E3B] to-[#047857] hover:opacity-90 text-white font-semibold"
            >
              <IndianRupee className="h-5 w-5 mr-2" /> Generate Salary Slip
            </LoaderButton>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
});

const AdminDashboard = () => {
  const { toast } = useToast();
  const validSectionKeys = [
    "overview",
    "performance",
    "menu",
    "employees",
    "orders",
    "customer-leaderboard",
    "customer-queries",
    "removed-items",
    "hours",
    "overtime",
    "late",
    "salary-slips",
    "certificates",
    "settings",
  ];
  const [activeSection, setActiveSection] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("admin_active_section") || "overview";
      return validSectionKeys.includes(saved) ? saved : "overview";
    }
    return "overview";
  });
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ name?: string } | null>(null);
  const [publicNetworkTraffic, setPublicNetworkTraffic] = useState<number>(0);
  const [performanceSummary, setPerformanceSummary] = useState<{
    date: string;
    totalOrders: number;
    totalRevenue: number;
    publicNetworkTraffic: number;
    trend: { label: string; orders: number; revenue: number }[];
    routes: { route: string; orders: number; revenue: number }[];
  } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Persist active section to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_active_section", activeSection);
    }
  }, [activeSection]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemSales, setItemSales] = useState<ItemSales[]>([]);
  const [employeeSales, setEmployeeSales] = useState<EmployeeSales[]>([]);

  // Form states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(
    null,
  );
  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    basePrice: 0,
    hasHalf: false,
    halfPrice: 0,
    isActive: true,
    categoryId: 0,
    imageUrl: "",
    notifyCustomers: false,
  });

  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [sendingVerification, setSendingVerification] = useState<number | null>(
    null,
  );
  const [employeeToVerify, setEmployeeToVerify] = useState<Employee | null>(
    null,
  );
  const [verifyingEmployeeId, setVerifyingEmployeeId] = useState<number | null>(
    null,
  );
  const [employeeToChangePassword, setEmployeeToChangePassword] =
    useState<Employee | null>(null);
  const [changingPasswordEmployeeId, setChangingPasswordEmployeeId] = useState<
    number | null
  >(null);

  // Additional state for new features
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [ordersByTable, setOrdersByTable] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  /** Frozen snapshot for order details dialog – prevents popup/cards flashing when parent re-renders or orders refresh */
  const [popupDisplayOrder, setPopupDisplayOrder] = useState<Order | null>(
    null,
  );
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const isOrderDialogOpenRef = useRef(false);
  const [completingOrderId, setCompletingOrderId] = useState<number | null>(
    null,
  );
  const [orderDateFilter, setOrderDateFilter] = useState<string>(() =>
    getBusinessDateString(),
  );
  const [orderTableFilter, setOrderTableFilter] = useState<string>("all");

  // Customer leaderboard state (aggregated from orders)
  const [leaderboard, setLeaderboard] = useState<
    {
      customerName: string;
      customerMobile: string;
      totalOrders: number;
      totalSpent: number;
      lastOrderDate: string | null;
    }[]
  >([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardSortBy, setLeaderboardSortBy] = useState<
    "orders" | "amount"
  >("amount");
  const [leaderboardLimit, setLeaderboardLimit] = useState(10);

  // Customer queries state
  const [customerQueries, setCustomerQueries] = useState<
    {
      id: number;
      name: string;
      mobile: string;
      orderId: number | null;
      branchId: number | null;
      branch?: { id: number; name: string } | null;
      issueType: string;
      message: string;
      status: string;
      createdAt: string;
    }[]
  >([]);
  const [pendingQueriesCount, setPendingQueriesCount] = useState(0);
  const [queryStatusFilter, setQueryStatusFilter] = useState<string>("all");
  const [selectedQuery, setSelectedQuery] = useState<
    (typeof customerQueries)[0] | null
  >(null);
  const [queryDialogOpen, setQueryDialogOpen] = useState(false);
  const [resolvingQueryId, setResolvingQueryId] = useState<number | null>(null);

  // Work hours state
  const [shifts, setShifts] = useState<any[]>([]);
  const [activeShiftsNow, setActiveShiftsNow] = useState<any[]>([]); // live: employees currently on shift
  const [hoursEmployeeFilter, setHoursEmployeeFilter] = useState<string>("all");
  const [hoursStartDate, setHoursStartDate] = useState<string>("");
  const [hoursEndDate, setHoursEndDate] = useState<string>("");
  const [hoursSummary, setHoursSummary] = useState({
    totalShifts: 0,
    totalHours: 0,
    totalSales: 0,
  });
  const [dailyStats, setDailyStats] = useState<any[]>([]);

  // Overtime state
  const [overtimeRecords, setOvertimeRecords] = useState<any[]>([]);
  const [overtimeSummary, setOvertimeSummary] = useState<{
    pendingOvertimeCount: number;
    overtimeRunningCount: number;
    overtimeRunning: {
      id: number;
      employeeId: number;
      employeeName: string;
      role: string | null;
      shiftStart: string;
      workingHours: number;
    }[];
  }>({ pendingOvertimeCount: 0, overtimeRunningCount: 0, overtimeRunning: [] });
  const [overtimeDateFrom, setOvertimeDateFrom] = useState<string>("");
  const [overtimeDateTo, setOvertimeDateTo] = useState<string>("");
  const [overtimeEmployeeFilter, setOvertimeEmployeeFilter] =
    useState<string>("all");
  const [overtimeLoading, setOvertimeLoading] = useState(false);

  // Late entries state
  const [lateEntries, setLateEntries] = useState<
    {
      id: number;
      employeeId: number;
      date: string;
      shiftStartTime: string;
      actualLoginTime: string;
      lateDurationMinutes: number;
      employee: { id: number; name: string; employeeCode: string };
    }[]
  >([]);
  const [lateDateFrom, setLateDateFrom] = useState<string>("");
  const [lateDateTo, setLateDateTo] = useState<string>("");
  const [lateEmployeeFilter, setLateEmployeeFilter] = useState<string>("all");
  const [lateLoading, setLateLoading] = useState(false);

  // Settings state
  const [branch, setBranch] = useState<any>(null);
  const [branches, setBranches] = useState<
    {
      id: number;
      name: string;
      location?: string | null;
      _count?: { employees: number; tables: number; orders: number };
    }[]
  >([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [branchForm, setBranchForm] = useState({
    name: "",
    location: "",
    timezone: "Asia/Kolkata",
    logoUrl: "",
    phone: "",
    googleReviewUrl: "",
    pincode: "",
    directorsEmail: "",
    showTotalAmountToCustomers: true,
  });
  const [createBranchOpen, setCreateBranchOpen] = useState(false);
  const [createBranchForm, setCreateBranchForm] = useState({
    name: "",
    location: "",
    timezone: "Asia/Kolkata",
    logoUrl: "",
    phone: "",
    googleReviewUrl: "",
    pincode: "",
    directorsEmail: "",
    showTotalAmountToCustomers: true,
  });
  const [savingBranch, setSavingBranch] = useState(false);
  const [directorsData, setDirectorsData] = useState<{
    verified: string[];
    pendingVerification: { email: string; expiresAt: string }[];
    pendingRemoval: { email: string; expiresAt: string }[];
  } | null>(null);
  const [errorLogs, setErrorLogs] = useState<{
    logs: {
      id: number;
      errorType: string;
      errorMessage: string;
      apiEndpoint?: string;
      branchId?: number;
      status: string;
      createdAt: string;
      metadata?: { suggestedFix?: string };
    }[];
    unresolvedCount: number;
  }>({ logs: [], unresolvedCount: 0 });

  // Load directors for current branch (verified, pending verification, pending removal)
  const loadDirectors = useCallback(async () => {
    const b = branch ?? branches[0];
    if (!token || !b?.id) {
      setDirectorsData(null);
      return;
    }
    try {
      const res = await fetch(`${apiBase}/branches/${b.id}/directors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDirectorsData({
          verified: data.verified ?? [],
          pendingVerification: data.pendingVerification ?? [],
          pendingRemoval: data.pendingRemoval ?? [],
        });
      } else {
        setDirectorsData(null);
      }
    } catch {
      setDirectorsData(null);
    }
  }, [branch, branches, token]);
  useEffect(() => {
    loadDirectors();
  }, [loadDirectors]);

  // Load logo from localStorage on mount
  useEffect(() => {
    const savedLogoUrl = localStorage.getItem("branch_logo_url");
    const savedBranchName = localStorage.getItem("branch_name");
    if (savedLogoUrl || savedBranchName) {
      setBranchForm((prev) => ({
        ...prev,
        logoUrl: savedLogoUrl || "",
        name: savedBranchName || "",
      }));
    }
  }, []);

  // Removed items state
  const [removedItems, setRemovedItems] = useState<RemovedItem[]>([]);
  const [dailyRemovalSummaries, setDailyRemovalSummaries] = useState<
    DailyRemovalSummary[]
  >([]);
  const [removedItemsDateFilter, setRemovedItemsDateFilter] = useState<string>(
    () => getBusinessDateString(),
  );
  const [totalLoss, setTotalLoss] = useState<number>(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE"); // default: show Active employees (permanent roster)

  // Menu management state
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [viewingCategory, setViewingCategory] = useState<number | null>(null);
  const [menuSortBy, setMenuSortBy] = useState<string>("name");
  const [menuFilterBy, setMenuFilterBy] = useState<string>("all");

  // Salary slips state
  const [salarySlips, setSalarySlips] = useState<any[]>([]);
  const [isSalarySlipDialogOpen, setIsSalarySlipDialogOpen] = useState(false);
  const [salarySlipPrefill, setSalarySlipPrefill] = useState<any>(null);
  const [salaryTableSearch, setSalaryTableSearch] = useState("");
  const [salaryTableMonthFilter, setSalaryTableMonthFilter] = useState("");
  const [salaryTablePage, setSalaryTablePage] = useState(0);
  const SALARY_TABLE_PAGE_SIZE = 10;

  // Certificates state
  const [certificates, setCertificates] = useState<any[]>([]);
  const [isCertificateDialogOpen, setIsCertificateDialogOpen] = useState(false);

  // Time updater
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Status calculation helper (must be defined before filteredCategories useMemo)
  const getCategoryStatus = (category: MenuCategory) => {
    const totalItems = category.items?.length || 0;
    const liveItems =
      category.items?.filter((item: any) => item.isActive).length || 0;
    const pendingItems = totalItems - liveItems;
    return { totalItems, liveItems, pendingItems };
  };

  // Filtered and sorted categories for menu search
  const filteredCategories = useMemo(() => {
    let filtered = categories;

    // Apply search filter
    if (menuSearchQuery) {
      filtered = filtered.filter((cat) =>
        cat.name.toLowerCase().includes(menuSearchQuery.toLowerCase()),
      );
    }

    // Apply status filter
    if (menuFilterBy !== "all") {
      filtered = filtered.filter((cat) => {
        const status = getCategoryStatus(cat);
        if (menuFilterBy === "live") return status.liveItems > 0;
        if (menuFilterBy === "pending") return status.pendingItems > 0;
        return true;
      });
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      const statusA = getCategoryStatus(a);
      const statusB = getCategoryStatus(b);

      switch (menuSortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "items-asc":
          return statusA.totalItems - statusB.totalItems;
        case "items-desc":
          return statusB.totalItems - statusA.totalItems;
        case "live-desc":
          return statusB.liveItems - statusA.liveItems;
        default:
          return 0;
      }
    });

    return filtered;
  }, [categories, menuSearchQuery, menuFilterBy, menuSortBy]);

  // Viewing category data
  const viewingCategoryData = useMemo(() => {
    if (!viewingCategory) return null;
    return categories.find((c) => c.id === viewingCategory);
  }, [categories, viewingCategory]);

  // Active employees for salary slips and certificates (case-insensitive status)
  const activeEmployees = useMemo(() => {
    return employees.filter(
      (e) => String(e.status || "").toUpperCase() === "ACTIVE",
    );
  }, [employees]);

  useEffect(() => {
    const storedToken = window.sessionStorage.getItem("dm_auth_token");
    setAuthChecked(true);
    if (!storedToken) {
      window.location.href = "/login";
      return;
    }
    setToken(storedToken);
  }, []);

  useEffect(() => {
    isOrderDialogOpenRef.current = isOrderDialogOpen;
  }, [isOrderDialogOpen]);

  useEffect(() => {
    if (!token) return;
    if (isOrderDialogOpen) return;
    loadDashboardData();
    const refreshOrdersOnly = async () => {
      if (!token || isOrderDialogOpenRef.current) return;
      try {
        const res = await fetchWithTimeout(`${apiBase}/orders/live`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        });
        if (res.ok) {
          const data = await res.json();
          if (isOrderDialogOpenRef.current) return;
          setOrders((prev) => {
            if (!Array.isArray(prev) || prev.length !== data.length)
              return data;
            const prevIds = prev
              .map((o: Order) => o.id)
              .sort()
              .join(",");
            const nextIds = data
              .map((o: Order) => o.id)
              .sort()
              .join(",");
            return prevIds === nextIds ? prev : data;
          });
        }
      } catch {
        /* ignore */
      }
    };
    const interval = setInterval(refreshOrdersOnly, 10000);
    return () => clearInterval(interval);
  }, [token, isOrderDialogOpen]);

  // Calculate today's stats
  const todayStats: TodayStats = useMemo(() => {
    const todayOrders = orders;
    const paidOrders = todayOrders.filter((o) => o.paymentStatus === "PAID");
    const pendingOrders = todayOrders.filter((o) => o.paymentStatus !== "PAID");

    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = todayOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const activeEmps = employees.filter(
      (e) => String(e.status || "").toUpperCase() === "ACTIVE",
    ).length;

    const totalItemsSold = itemSales.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    const topItem =
      itemSales.length > 0
        ? itemSales.reduce(
            (max, item) => (item.quantity > max.quantity ? item : max),
            itemSales[0],
          )
        : null;

    return {
      totalRevenue,
      totalOrders,
      pendingPayments: pendingOrders.length,
      paidOrders: paidOrders.length,
      activeEmployees: activeEmps,
      avgOrderValue,
      totalItemsSold,
      topSellingItem: topItem
        ? { name: topItem.itemName, quantity: topItem.quantity }
        : null,
    };
  }, [orders, employees, itemSales]);

  const loadDashboardData = async () => {
    if (!token) return;

    try {
      setLoading(true);

      const opts = { headers: { Authorization: `Bearer ${token}` } };
      const [
        menuRes,
        employeesRes,
        ordersRes,
        trafficRes,
        dashboardSummaryRes,
        activeShiftsRes,
        overtimeSummaryRes,
        branchesRes,
        salarySlipsRes,
      ] = await Promise.all([
        fetchWithTimeout(`${apiBase}/menu/admin`, opts),
        fetchWithTimeout(`${apiBase}/employees`, opts),
        fetchWithTimeout(`${apiBase}/orders/live`, opts),
        fetchWithTimeout(`${apiBase}/config/public-traffic`, opts),
        fetchWithTimeout(`${apiBase}/reports/dashboard-summary`, opts),
        fetchWithTimeout(`${apiBase}/shift/active`, opts),
        fetchWithTimeout(`${apiBase}/overtime/summary`, opts),
        fetchWithTimeout(`${apiBase}/branches`, opts),
        fetchWithTimeout(`${apiBase}/reports/salary-slips`, opts),
      ]);

      // Read each response body only once (avoid "body stream already read")
      const menuData = menuRes.ok ? await menuRes.json() : null;
      const empData = employeesRes.ok ? await employeesRes.json() : null;
      const ordersData = ordersRes.ok ? await ordersRes.json() : null;
      const salarySlipData = salarySlipsRes.ok ? await salarySlipsRes.json() : null;
      if (trafficRes.ok) {
        const trafficData = await trafficRes.json();
        setPublicNetworkTraffic(trafficData.publicNetworkTraffic ?? 0);
      }
      if (dashboardSummaryRes.ok) {
        const summaryData = await dashboardSummaryRes.json();
        setPerformanceSummary(summaryData);
      }
      if (activeShiftsRes.ok) {
        const activeData = await activeShiftsRes.json();
        setActiveShiftsNow(activeData.shifts || []);
      }
      if (overtimeSummaryRes.ok) {
        const summary = await overtimeSummaryRes.json();
        setOvertimeSummary({
          pendingOvertimeCount: summary.pendingOvertimeCount ?? 0,
          overtimeRunningCount: summary.overtimeRunningCount ?? 0,
          overtimeRunning: summary.overtimeRunning ?? [],
        });
      }
      if (branchesRes.ok) {
        const branchesData = await branchesRes.json();
        const branchList = Array.isArray(branchesData)
          ? branchesData
          : Array.isArray((branchesData as any)?.branches)
            ? (branchesData as any).branches
            : Array.isArray((branchesData as any)?.data)
              ? (branchesData as any).data
              : [];
        setBranches(branchList);
      }

      if (salarySlipData) {
        const slipsRaw = Array.isArray((salarySlipData as any)?.slips)
          ? (salarySlipData as any).slips
          : Array.isArray(salarySlipData)
            ? salarySlipData
            : [];
        const normalized = slipsRaw.map((s: any) => ({
          ...s,
          month:
            typeof s?.month === "number"
              ? monthNumberToName(s.month) ?? String(s.month)
              : s?.month,
          employeeCode: s?.employee?.employeeCode ?? s?.employeeCode,
          allowances: Array.isArray(s?.allowances) ? s.allowances : [],
          deductions: Array.isArray(s?.deductions) ? s.deductions : [],
        }));
        setSalarySlips(normalized);
      }

      if (menuData) {
        setCategories(menuData);
        const itemMap = new Map<string, ItemSales>();
        if (ordersData) {
          ordersData.forEach((order: Order) => {
            if (order.paymentStatus !== "PAID") return;
            order.items.forEach((item: OrderItem) => {
              const key = `${item.name}\0${item.variant ?? ""}`;
              const displayName = formatItemDisplayName(
                item.name,
                item.variant,
              );
              const existing = itemMap.get(key);
              if (existing) {
                existing.quantity += item.quantity;
                existing.revenue += item.price * item.quantity;
              } else {
                itemMap.set(key, {
                  itemName: displayName,
                  quantity: item.quantity,
                  revenue: item.price * item.quantity,
                });
              }
            });
          });
        }
        setItemSales(
          Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity),
        );
      }

      if (empData) {
        const employeeList = Array.isArray(empData)
          ? empData
          : Array.isArray((empData as any)?.data)
            ? (empData as any).data
            : Array.isArray((empData as any)?.employees)
              ? (empData as any).employees
              : [];
        setEmployees(employeeList);
        if (ordersData) {
          const empSalesMap = new Map<number, EmployeeSales>();
          employeeList.forEach((emp: Employee) => {
            empSalesMap.set(emp.id, {
              employeeId: emp.id,
              employeeName: emp.name,
              orders: 0,
              revenue: 0,
              hoursWorked: emp.totalHoursToday || 0,
            });
          });
          ordersData.forEach((order: Order) => {
            if (order.employeeId && empSalesMap.has(order.employeeId)) {
              const empSale = empSalesMap.get(order.employeeId)!;
              empSale.orders += 1;
              if (order.paymentStatus === "PAID") {
                empSale.revenue += order.totalAmount;
              }
            }
          });
          setEmployeeSales(
            Array.from(empSalesMap.values()).sort(
              (a, b) => b.revenue - a.revenue,
            ),
          );
        }
      }

      if (ordersData) {
        setOrders(ordersData);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      const isTimeout =
        error instanceof Error && error.name === "AbortError";
      toast({
        title: "Error",
        description: isTimeout
          ? "Request timed out. The server may be slow—try again."
          : "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  };

  // When salary slip dialog opens, refresh employees so the dropdown has the latest active list
  useEffect(() => {
    if (!token || !isSalarySlipDialogOpen) return;
    let cancelled = false;
    fetch(`${apiBase}/employees`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data)
          ? data
          : data && Array.isArray((data as any)?.data)
            ? (data as any).data
            : Array.isArray((data as any)?.employees)
              ? (data as any).employees
              : [];
        setEmployees(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, isSalarySlipDialogOpen]);

  const handleDeleteCategory = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/menu/categories/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast({ title: "Success", description: "Category deleted" });
        setCategories((prev) => prev.filter((c) => c.id !== id));
        if (viewingCategory === id) setViewingCategory(null);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    }
  };

  // Category Add/Edit Dialog – local form state so typing doesn't re-render parent (no flashing)
  const CategoryDialog = memo(function CategoryDialog({
    open,
    editingCategory,
    onOpenChange,
    onCreated,
    onUpdated,
    token,
  }: {
    open: boolean;
    editingCategory: MenuCategory | null;
    onOpenChange: (open: boolean) => void;
    onCreated: (cat: MenuCategory) => void;
    onUpdated: (cat: MenuCategory) => void;
    token: string | null;
  }) {
    const { toast } = useToast();
    const [name, setName] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [imagePreview, setImagePreview] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (open) {
        if (editingCategory) {
          setName(editingCategory.name);
          setImageUrl(editingCategory.imageUrl || "");
          setImagePreview(editingCategory.imageUrl || "");
        } else {
          setName("");
          setImageUrl("");
          setImagePreview("");
        }
      }
    }, [open, editingCategory]);

    const handleSubmit = async () => {
      if (!token || !name.trim()) return;
      setSaving(true);
      try {
        if (editingCategory) {
          const res = await fetch(
            `${apiBase}/menu/categories/${editingCategory.id}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                name: name.trim(),
                imageUrl: imageUrl.trim() || undefined,
              }),
            },
          );
          const data = await res.json();
          if (!res.ok)
            throw new Error(
              (data as { message?: string }).message ||
                "Failed to update category",
            );
          toast({ title: "Success", description: "Category updated" });
          onOpenChange(false);
          onUpdated(data);
        } else {
          const res = await fetch(`${apiBase}/menu/categories`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: name.trim(),
              imageUrl: imageUrl.trim() || undefined,
            }),
          });
          const data = await res.json();
          if (!res.ok)
            throw new Error(
              (data as { message?: string }).message ||
                "Failed to create category",
            );
          toast({ title: "Success", description: "Category created" });
          onOpenChange(false);
          onCreated(data);
        }
      } catch (e) {
        toast({
          title: "Error",
          description:
            e instanceof Error ? e.message : "Failed to save category",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-describedby="category-dialog-desc">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "New Category"}
            </DialogTitle>
            <DialogDescription id="category-dialog-desc" className="sr-only">
              Enter category name and optional description.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Category Name</Label>
              <Input
                placeholder="e.g., Cold Coffee, Momos"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Image URL</Label>
              <Input
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImagePreview(e.target.value);
                }}
              />
            </div>
            {(imagePreview || editingCategory?.imageUrl) && (
              <div className="grid gap-2">
                <Label>Image Preview</Label>
                <div className="border rounded-lg p-2">
                  <img
                    src={imagePreview || editingCategory?.imageUrl}
                    alt="Category preview"
                    className="w-full h-32 object-cover rounded-md"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      (
                        e.currentTarget.nextElementSibling as HTMLElement
                      )?.classList.remove("hidden");
                    }}
                  />
                  <div className="hidden text-center text-muted-foreground text-sm py-8">
                    Failed to load image
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? (
                <>
                  <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  {editingCategory ? "Updating..." : "Creating..."}
                </>
              ) : editingCategory ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  });

  const handleCreateItem = async () => {
    if (!token || !itemForm.name.trim() || itemForm.basePrice <= 0) return;
    try {
      const { notifyCustomers, ...payload } = itemForm;
      const res = await fetch(`${apiBase}/menu/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...payload,
          notifyCustomers: !!notifyCustomers,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const item = data.item ?? data;
        setItemForm({
          name: "",
          description: "",
          basePrice: 0,
          hasHalf: false,
          halfPrice: 0,
          isActive: true,
          categoryId: 0,
          imageUrl: "",
          notifyCustomers: false,
        });
        setIsItemDialogOpen(false);
        loadDashboardData();
        toast({ title: "Success", description: "Menu item created" });
        if (data.broadcast?.mobileCount > 0) {
          toast({
            title: "Notify customers",
            description: `Broadcast prepared for ${data.broadcast.mobileCount} customers. Use WhatsApp to send the new launch message.`,
          });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Error",
          description:
            (err as { message?: string }).message || "Failed to create item",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create item",
        variant: "destructive",
      });
    }
  };

  const handleUpdateItem = async () => {
    if (!token || !editingItem) return;
    try {
      const res = await fetch(`${apiBase}/menu/items/${editingItem.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(itemForm),
      });
      if (res.ok) {
        toast({ title: "Success", description: "Menu item updated" });
        setEditingItem(null);
        setIsItemDialogOpen(false);
        loadDashboardData();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive",
      });
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/menu/items/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast({ title: "Success", description: "Menu item deleted" });
        loadDashboardData();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
    }
  };

  const handleResendVerification = async (empId: number) => {
    if (!token) return;
    setSendingVerification(empId);
    try {
      const res = await fetch(
        `${apiBase}/employees/${empId}/resend-verification`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        toast({ title: "Success", description: "Verification email sent." });
        loadDashboardData();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Error",
          description:
            (data as { message?: string }).message ||
            "Failed to send email. Check SMTP settings in .env.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Network error. Check backend and SMTP settings.",
        variant: "destructive",
      });
    } finally {
      setSendingVerification(null);
    }
  };

  const handleVerifyAndSendInvite = async () => {
    const emp = employeeToVerify;
    if (!token || !emp) return;
    setVerifyingEmployeeId(emp.id);
    try {
      const res = await fetchWithTimeout(
        `${apiBase}/employees/${emp.id}/verify-and-send-invite`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          // Allow extra time in production where SMTP can be slow,
          // so the request does not fail with a client-side timeout
          // while the server is still sending the email.
          timeout: 60000,
        },
      );
      const contentType = res.headers.get("content-type");
      const isJson = contentType?.includes("application/json");
      const data = isJson
        ? await res.json().catch(() => ({}))
        : { message: await res.text().catch(() => "Server error") };
      if (res.ok) {
        const { _message, ...updated } = data as {
          _message?: string;
          [k: string]: unknown;
        };
        setEmployees((prev) =>
          prev.map((e) => (e.id === emp.id ? { ...e, ...updated } : e)),
        );
        setEmployeeToVerify(null);
        if (_message) {
          toast({ title: "Already verified", description: _message });
        } else {
          toast({
            title: "Invite sent",
            description: `${emp.name} will receive login credentials via email.`,
          });
        }
      } else {
        const payload = data as { message?: string; detail?: string };
        const desc =
          payload.message ||
          (res.status === 503
            ? "Email is not configured on the server. Add EMAIL_SMTP_* and EMAIL_FROM_ADDRESS in the backend environment (e.g. Render dashboard)."
            : res.status === 500
              ? "Server could not send email. Check backend SMTP settings and logs."
              : "Failed to send invite.");
        const extra = payload.detail ? ` ${payload.detail}` : "";
        toast({
          title: "Error",
          description: desc + extra,
          variant: "destructive",
        });
      }
    } catch (e) {
      const isAbort = e instanceof Error && e.name === "AbortError";
      toast({
        title: "Error",
        description: isAbort
          ? "Request timed out. Check your connection and try again."
          : "Failed to send invite. Check network and backend.",
        variant: "destructive",
      });
    } finally {
      setVerifyingEmployeeId(null);
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    if (!token) return;
    setCompletingOrderId(orderId);
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
        toast({
          title: "Success",
          description: `Order marked ${status.replace("_", " ").toLowerCase()}`,
        });
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status } : o)),
        );
        setAllOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status } : o)),
        );
        setOrdersByTable((prev) =>
          prev.map((t) => ({
            ...t,
            orders: (t.orders || []).map((o: Order) =>
              o.id === orderId ? { ...o, status } : o,
            ),
          })),
        );
        if (selectedOrder?.id === orderId) {
          setSelectedOrder((prev) => (prev ? { ...prev, status } : null));
          setPopupDisplayOrder((prev) =>
            prev && prev.id === orderId ? { ...prev, status } : null,
          );
        }
        setIsOrderDialogOpen(false);
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Error",
          description: data.message || "Failed to update order",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to update order",
        variant: "destructive",
      });
    } finally {
      setCompletingOrderId(null);
    }
  };

  // Load all orders with filters
  const loadAllOrders = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (orderDateFilter) params.append("date", orderDateFilter);
      if (orderTableFilter !== "all")
        params.append("tableId", orderTableFilter);

      const res = await fetch(`${apiBase}/orders/all?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAllOrders(data.orders);
        setOrdersByTable(data.byTable);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
    }
  };

  const handleOpenOrderDialog = useCallback((order: Order) => {
    setSelectedOrder(order);
    setPopupDisplayOrder(
      typeof structuredClone === "function"
        ? structuredClone(order)
        : JSON.parse(JSON.stringify(order)),
    );
    setIsOrderDialogOpen(true);
  }, []);

  // Load shift history
  const loadShiftHistory = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (hoursEmployeeFilter !== "all")
        params.append("employeeId", hoursEmployeeFilter);
      if (hoursStartDate) params.append("startDate", hoursStartDate);
      if (hoursEndDate) params.append("endDate", hoursEndDate);

      const res = await fetch(`${apiBase}/shift/history?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setShifts(data.shifts);
        setHoursSummary(data.summary);
        setDailyStats(data.dailyStats);
      }
    } catch (error) {
      console.error("Error loading shifts:", error);
    }
  };

  const loadOvertime = useCallback(async () => {
    if (!token) return;
    setOvertimeLoading(true);
    try {
      const params = new URLSearchParams();
      if (overtimeDateFrom) params.append("dateFrom", overtimeDateFrom);
      if (overtimeDateTo) params.append("dateTo", overtimeDateTo);
      if (overtimeEmployeeFilter !== "all")
        params.append("employeeId", overtimeEmployeeFilter);
      const res = await fetch(`${apiBase}/overtime?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOvertimeRecords(data);
      }
    } catch (e) {
      console.error("Load overtime error:", e);
    } finally {
      setOvertimeLoading(false);
    }
  }, [
    token,
    apiBase,
    overtimeDateFrom,
    overtimeDateTo,
    overtimeEmployeeFilter,
  ]);

  const loadLate = useCallback(async () => {
    if (!token) return;
    setLateLoading(true);
    try {
      const params = new URLSearchParams();
      if (lateDateFrom) params.append("dateFrom", lateDateFrom);
      if (lateDateTo) params.append("dateTo", lateDateTo);
      if (lateEmployeeFilter !== "all")
        params.append("employeeId", lateEmployeeFilter);
      const res = await fetch(`${apiBase}/late?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLateEntries(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Load late entries error:", e);
    } finally {
      setLateLoading(false);
    }
  }, [token, apiBase, lateDateFrom, lateDateTo, lateEmployeeFilter]);

  // Debounce late filters so Apply feels reliable and avoids spam fetches
  const lateDebounceTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!token) return;
    if (activeSection !== "late") return;
    if (lateDebounceTimerRef.current)
      window.clearTimeout(lateDebounceTimerRef.current);
    lateDebounceTimerRef.current = window.setTimeout(() => {
      loadLate();
    }, 350);
    return () => {
      if (lateDebounceTimerRef.current)
        window.clearTimeout(lateDebounceTimerRef.current);
    };
  }, [token, activeSection, lateDateFrom, lateDateTo, lateEmployeeFilter, loadLate]);

  // Load branch, branches list, and notifications
  const loadSettings = async () => {
    if (!token) return;
    try {
      const [branchRes, branchesRes, notifRes] = await Promise.all([
        fetch(`${apiBase}/config/branch`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBase}/branches`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBase}/config/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (branchRes.ok) {
        const branchData = await branchRes.json();
        setBranch(branchData);
        setBranchForm({
          name: branchData?.name || "",
          location: branchData?.location || "",
          timezone: branchData?.timezone || "Asia/Kolkata",
          logoUrl: branchData?.logoUrl || "",
          phone: branchData?.phone || "",
          googleReviewUrl: branchData?.googleReviewUrl || "",
          pincode: branchData?.pincode || "",
          directorsEmail: branchData?.directorsEmail || "",
          showTotalAmountToCustomers:
            typeof branchData?.showTotalAmountToCustomers === "boolean"
              ? branchData.showTotalAmountToCustomers
              : true,
        });
      } else {
        setBranch(null);
      }
      if (branchesRes.ok) {
        const branchesData = await branchesRes.json();
        const branchList = Array.isArray(branchesData)
          ? branchesData
          : Array.isArray((branchesData as any)?.branches)
            ? (branchesData as any).branches
            : Array.isArray((branchesData as any)?.data)
              ? (branchesData as any).data
              : [];
        setBranches(branchList);
      }
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        const list = Array.isArray(notifData) ? notifData : [];
        try {
          const clearedAt = localStorage.getItem("dm_notifications_cleared_at");
          const filtered = clearedAt
            ? list.filter(
                (n: any) =>
                  new Date(n.createdAt || 0).getTime() > Number(clearedAt),
              )
            : list;
          setNotifications(filtered);
        } catch {
          setNotifications(list);
        }
      }
      const errRes = await fetch(`${apiBase}/error-logs?limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (errRes.ok) {
        const errData = await errRes.json();
        setErrorLogs(errData);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleCreateBranch = async () => {
    if (!token || !createBranchForm.name.trim()) return;
    setSavingBranch(true);
    try {
      const res = await fetch(`${apiBase}/branches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: createBranchForm.name.trim(),
          location: createBranchForm.location.trim() || undefined,
          timezone: createBranchForm.timezone || undefined,
          logoUrl: createBranchForm.logoUrl.trim() || undefined,
          phone: createBranchForm.phone.trim() || undefined,
          googleReviewUrl: createBranchForm.googleReviewUrl.trim() || undefined,
          pincode: createBranchForm.pincode.trim() || undefined,
          directorsEmail: createBranchForm.directorsEmail.trim() || undefined,
          showTotalAmountToCustomers: !!createBranchForm.showTotalAmountToCustomers,
        }),
      });
      if (res.ok) {
        const newBranch = await res.json();
        setBranches((prev) => [...prev, newBranch]);
        setCreateBranchOpen(false);
        setCreateBranchForm({
          name: "",
          location: "",
          timezone: "Asia/Kolkata",
          logoUrl: "",
          phone: "",
          googleReviewUrl: "",
          pincode: "",
          directorsEmail: "",
          showTotalAmountToCustomers: true,
        });
        toast({ title: "Success", description: "Branch created" });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Error",
          description:
            (err as { message?: string }).message || "Failed to create branch",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to create branch",
        variant: "destructive",
      });
    } finally {
      setSavingBranch(false);
    }
  };

  // Update branch settings
  const handleUpdateBranch = async () => {
    const branchToUpdate = branch ?? branches[0];
    if (!token || !branchToUpdate?.id) {
      toast({
        title: "Cannot save",
        description: "No branch selected. Select a branch above or create one.",
        variant: "destructive",
      });
      return;
    }
    setSavingBranch(true);
    try {
      const { directorsEmail: _de, ...branchPayload } = branchForm;
      const res = await fetch(`${apiBase}/config/branch/${branchToUpdate.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(branchPayload),
      });
      if (res.ok) {
        toast({
          title: "Saved successfully",
          description: "Branch settings updated.",
        });
        const updated = await res.json();
        setBranch(updated);
        setBranchForm({
          name: updated?.name || "",
          location: updated?.location || "",
          timezone: updated?.timezone || "Asia/Kolkata",
          logoUrl: updated?.logoUrl || "",
          phone: updated?.phone || "",
          googleReviewUrl: updated?.googleReviewUrl || "",
          pincode: updated?.pincode || "",
          directorsEmail: updated?.directorsEmail || "",
          showTotalAmountToCustomers:
            typeof updated?.showTotalAmountToCustomers === "boolean"
              ? updated.showTotalAmountToCustomers
              : true,
        });
        if (typeof window !== "undefined") {
          if (updated?.name)
            window.localStorage.setItem("branch_name", updated.name);
          if (updated?.logoUrl)
            window.localStorage.setItem("branch_logo_url", updated.logoUrl);
        }
        await loadSettings();
      } else {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
          errors?: { path?: string[]; message?: string }[];
        };
        const firstErr = Array.isArray(err.errors) && err.errors[0];
        const detail = firstErr
          ? `${firstErr.message || "Invalid input"}${firstErr.path?.length ? ` (${firstErr.path.join(".")})` : ""}`
          : err.message;
        toast({
          title: "Could not save branch",
          description:
            detail || "Failed to save branch. Check Logo URL and other fields.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to update branch",
        variant: "destructive",
      });
    } finally {
      setSavingBranch(false);
    }
  };

  // Load removed items report
  const loadRemovedItems = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (removedItemsDateFilter) {
        params.append("date", removedItemsDateFilter);
      }

      const res = await fetch(
        `${apiBase}/orders/reports/removed-items?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        // Backend returns removedItems (with unitPrice, employee, order.table), dailyStats, summary.totalLoss
        const items = (data.removedItems || []).map((item: any) => ({
          id: item.id,
          orderId: item.orderId,
          itemName: item.itemName,
          itemPrice: item.unitPrice ?? 0,
          quantity: item.quantity,
          reason: item.reason || "",
          removedBy: item.employee?.name ?? "—",
          removedAt: item.createdAt ?? item.date,
          tableNumber: item.order?.table?.tableNumber,
        }));
        setRemovedItems(items);
        setDailyRemovalSummaries(data.dailyStats || []);
        setTotalLoss(data.summary?.totalLoss ?? 0);
      }
    } catch (error) {
      console.error("Error loading removed items:", error);
    }
  };

  const loadCustomerQueries = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (queryStatusFilter && queryStatusFilter !== "all")
        params.append("status", queryStatusFilter);
      const res = await fetch(`${apiBase}/customer-queries?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCustomerQueries(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error loading customer queries:", error);
    }
  }, [token, apiBase, queryStatusFilter]);

  const loadPendingQueriesCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/customer-queries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        const count = list.filter(
          (q: { status: string }) => q.status !== "RESOLVED",
        ).length;
        setPendingQueriesCount(count);
      }
    } catch (_) {}
  }, [token, apiBase]);

  // Effects for loading data when sections change
  useEffect(() => {
    if (token && activeSection === "orders") {
      loadAllOrders();
    }
  }, [token, activeSection, orderDateFilter, orderTableFilter]);

  useEffect(() => {
    if (token && activeSection === "removed-items") {
      loadRemovedItems();
    }
  }, [token, activeSection, removedItemsDateFilter]);

  // Default date range for Work Hours when section is first opened (so date range UI shows properly)
  useEffect(() => {
    if (activeSection === "hours" && !hoursStartDate && !hoursEndDate) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setHoursStartDate(start.toISOString().slice(0, 10));
      setHoursEndDate(now.toISOString().slice(0, 10));
    }
  }, [activeSection]);

  useEffect(() => {
    if (token && activeSection === "hours") {
      loadShiftHistory();
    }
  }, [token, activeSection, hoursEmployeeFilter, hoursStartDate, hoursEndDate]);

  useEffect(() => {
    if (activeSection === "overtime" && !overtimeDateFrom && !overtimeDateTo) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setOvertimeDateFrom(start.toISOString().slice(0, 10));
      setOvertimeDateTo(now.toISOString().slice(0, 10));
    }
  }, [activeSection]);

  useEffect(() => {
    if (token && activeSection === "overtime") {
      loadOvertime();
    }
  }, [token, activeSection, loadOvertime]);

  useEffect(() => {
    if (activeSection === "late" && !lateDateFrom && !lateDateTo) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setLateDateFrom(start.toISOString().slice(0, 10));
      setLateDateTo(now.toISOString().slice(0, 10));
    }
  }, [activeSection]);

  useEffect(() => {
    if (token && activeSection === "late") {
      loadLate();
    }
  }, [token, activeSection, loadLate]);

  useEffect(() => {
    if (token && activeSection === "settings") {
      loadSettings();
    }
  }, [token, activeSection]);

  // When Add Employee dialog opens, load branches so branch dropdown is populated (even if user hasn't visited Settings)
  useEffect(() => {
    if (!token || !isEmployeeDialogOpen) return;
    let cancelled = false;
    fetch(`${apiBase}/branches`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        // Only update when we got a response; do not overwrite with [] on 401/500
        if (data == null) return;
        const list = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.branches)
            ? (data as any).branches
            : Array.isArray((data as any)?.data)
              ? (data as any).data
              : [];
        setBranches(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, isEmployeeDialogOpen]);

  useEffect(() => {
    if (token && activeSection === "customer-queries") {
      loadCustomerQueries();
    }
  }, [token, activeSection, loadCustomerQueries]);

  const loadLeaderboard = useCallback(async () => {
    if (!token) return;
    setLeaderboardLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(leaderboardLimit),
        sortBy: leaderboardSortBy,
      });
      const res = await fetch(
        `${apiBase}/orders/customer-leaderboard?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard ?? []);
      } else {
        setLeaderboard([]);
      }
    } catch {
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }, [token, leaderboardLimit, leaderboardSortBy]);

  useEffect(() => {
    if (token && activeSection === "customer-leaderboard") {
      loadLeaderboard();
    }
  }, [token, activeSection, loadLeaderboard]);

  useEffect(() => {
    if (token) loadPendingQueriesCount();
  }, [token, loadPendingQueriesCount]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(loadPendingQueriesCount, 60000);
    return () => clearInterval(interval);
  }, [token, loadPendingQueriesCount]);

  // Load notifications on mount and poll for admin (new orders, status updates). Respect "Clear all" (persisted in localStorage).
  useEffect(() => {
    if (!token) return;
    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${apiBase}/config/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          try {
            const clearedAt = localStorage.getItem(
              "dm_notifications_cleared_at",
            );
            const filtered = clearedAt
              ? list.filter(
                  (n: any) =>
                    new Date(n.createdAt || 0).getTime() > Number(clearedAt),
                )
              : list;
            setNotifications(filtered);
          } catch {
            setNotifications(list);
          }
        }
      } catch (_) {}
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 25000);
    return () => clearInterval(interval);
  }, [token]);

  // Auto refresh orders every 10 seconds when on orders page – skip while order dialog is open to keep popup stable
  useEffect(() => {
    if (activeSection !== "orders") return;
    const interval = setInterval(() => {
      if (isOrderDialogOpenRef.current) return;
      loadAllOrders();
    }, 10000);
    return () => clearInterval(interval);
  }, [activeSection, orderDateFilter, orderTableFilter, isOrderDialogOpen]);

  // ============ SECTIONS ============

  // 1. COMPACT KPI CARDS - All INR (responsive: 2 col mobile, 4 col md+)
  const KPICards = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 w-full min-w-0">
      {/* Row 1 */}
      <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100 min-w-0 overflow-hidden">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-base sm:text-lg font-bold text-emerald-700 truncate">
                {formatINR(todayStats.totalRevenue)}
              </p>
            </div>
            <div className="p-1.5 bg-emerald-100 rounded-md shrink-0">
              <IndianRupee className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 min-w-0 overflow-hidden">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Total Orders</p>
              <p className="text-base sm:text-lg font-bold text-blue-700 truncate">
                {todayStats.totalOrders}
              </p>
            </div>
            <div className="p-1.5 bg-blue-100 rounded-md shrink-0">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100 min-w-0 overflow-hidden">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-base sm:text-lg font-bold text-amber-700 truncate">
                {todayStats.pendingPayments}
              </p>
            </div>
            <div className="p-1.5 bg-amber-100 rounded-md shrink-0">
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-50 to-white border-green-100 min-w-0 overflow-hidden">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Paid Orders</p>
              <p className="text-base sm:text-lg font-bold text-green-700 truncate">
                {todayStats.paidOrders}
              </p>
            </div>
            <div className="p-1.5 bg-green-100 rounded-md shrink-0">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row 2 */}
      <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100 min-w-0 overflow-hidden">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Employees Summary</p>
              <p className="text-xs sm:text-sm font-bold text-purple-700 line-clamp-2 break-words">
                Total: {employees.length} · Active: {todayStats.activeEmployees}{" "}
                · On Shift: {activeShiftsNow.length}
                {overtimeSummary.overtimeRunningCount > 0 && (
                  <span className="text-amber-600">
                    {" "}
                    · OT: {overtimeSummary.overtimeRunningCount}
                  </span>
                )}
              </p>
            </div>
            <div className="p-1.5 bg-purple-100 rounded-md shrink-0">
              <Users className="h-4 w-4 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-cyan-50 to-white border-cyan-100 min-w-0 overflow-hidden">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Avg Order</p>
              <p className="text-base sm:text-lg font-bold text-cyan-700 truncate">
                {formatINR(todayStats.avgOrderValue)}
              </p>
            </div>
            <div className="p-1.5 bg-cyan-100 rounded-md shrink-0">
              <TrendingUp className="h-4 w-4 text-cyan-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-pink-50 to-white border-pink-100 min-w-0 overflow-hidden">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Items Sold</p>
              <p className="text-base sm:text-lg font-bold text-pink-700 truncate">
                {todayStats.totalItemsSold}
              </p>
            </div>
            <div className="p-1.5 bg-pink-100 rounded-md shrink-0">
              <Package className="h-4 w-4 text-pink-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-100 min-w-0 overflow-hidden">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Top selling today</p>
              <p
                className="text-sm font-bold text-orange-700 truncate"
                title={todayStats.topSellingItem?.name}
              >
                {todayStats.topSellingItem?.name || "—"}
              </p>
              <p className="text-xs text-orange-600">
                {todayStats.topSellingItem?.quantity != null
                  ? `${todayStats.topSellingItem.quantity} sold`
                  : ""}
              </p>
            </div>
            <div className="p-1.5 bg-orange-100 rounded-md shrink-0">
              <Star className="h-4 w-4 text-orange-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-200 min-w-0 overflow-hidden">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                Public Network Traffic
              </p>
              <p className="text-base sm:text-lg font-bold text-slate-700 truncate">
                {publicNetworkTraffic.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500">
                Menu views (this session)
              </p>
            </div>
            <div className="p-1.5 bg-slate-100 rounded-md shrink-0">
              <Activity className="h-4 w-4 text-slate-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // 2. TODAY'S ITEM SALES (orders from today only, timezone Asia/Kolkata)
  const ItemSalesSection = () => (
    <Card className="min-h-0 flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex flex-col gap-2 md:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Utensils className="h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base sm:text-lg truncate">
                Today&apos;s Item Sales
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Today&apos;s orders, paid only
              </p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit self-start">
            {todayStats.totalItemsSold} items sold
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-3 sm:p-6 pt-0 sm:pt-0">
        <ScrollArea className="h-[240px] sm:h-[260px] w-full rounded-md border border-slate-200/80 bg-slate-50/50">
          <div className="p-2 space-y-1.5">
            {itemSales.map((item, index) => (
              <div
                key={`${String(item.itemName).slice(0, 40)}-${index}`}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white border border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                      index < 3
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {item.itemName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} sold
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm text-emerald-600">
                    {formatINR(item.revenue)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Revenue</p>
                </div>
              </div>
            ))}
            {itemSales.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">
                No sales yet today
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  // 4. EMPLOYEE SALES TODAY
  const EmployeeSalesSection = () => (
    <Card className="min-h-0 flex flex-col overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-base sm:text-lg truncate">
              Sales by Employee
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs">Employee</TableHead>
                <TableHead className="text-xs text-right">Orders</TableHead>
                <TableHead className="text-xs text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeeSales.map((emp) => (
                <TableRow key={emp.employeeId} className="text-sm">
                  <TableCell className="font-medium">
                    {emp.employeeName}
                  </TableCell>
                  <TableCell className="text-right">{emp.orders}</TableCell>
                  <TableCell className="text-right font-medium text-emerald-600">
                    {formatINR(emp.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  // 5. END OF DAY SUMMARY
  const EndOfDaySummary = () => (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-emerald-400" />
          <CardTitle className="text-lg text-white">
            End of Day Summary
          </CardTitle>
        </div>
        <CardDescription className="text-slate-400">
          {currentTime.toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="text-center p-2 sm:p-3 bg-slate-700/50 rounded-lg min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-emerald-400 truncate">
              {todayStats.totalOrders}
            </p>
            <p className="text-xs text-slate-400">Total Orders</p>
          </div>
          <div className="text-center p-2 sm:p-3 bg-slate-700/50 rounded-lg min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-emerald-400 truncate">
              {formatINR(todayStats.totalRevenue)}
            </p>
            <p className="text-xs text-slate-400">Total Revenue</p>
          </div>
          <div className="text-center p-2 sm:p-3 bg-slate-700/50 rounded-lg min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-amber-400 truncate">
              {todayStats.pendingPayments}
            </p>
            <p className="text-xs text-slate-400">Pending</p>
          </div>
          <div className="text-center p-2 sm:p-3 bg-slate-700/50 rounded-lg min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-emerald-400 truncate">
              {todayStats.totalItemsSold}
            </p>
            <p className="text-xs text-slate-400">Items Sold</p>
          </div>
        </div>

        {todayStats.topSellingItem && (
          <div className="border-t border-slate-700 pt-4">
            <p className="text-sm text-slate-400 mb-2">Top selling today</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shrink-0">
                {todayStats.topSellingItem.name} —{" "}
                {todayStats.topSellingItem.quantity} sold
              </Badge>
              {itemSales
                .filter(
                  (item) => item.itemName !== todayStats.topSellingItem?.name,
                )
                .slice(0, 4)
                .map((item, i) => (
                  <Badge
                    key={`${item.itemName}-${i}`}
                    variant="outline"
                    className="border-slate-600 text-slate-400 shrink-0"
                  >
                    {item.itemName} — {item.quantity} sold
                  </Badge>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // DASHBOARD OVERVIEW - Main Section
  const OverviewSection = () => (
    <div className="space-y-4">
      {/* Header with Date - stacks on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-bold sm:text-xl">Today's Dashboard</h2>
          <p className="text-xs sm:text-sm text-muted-foreground truncate max-w-full">
            {currentTime.toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}{" "}
            •{" "}
            {currentTime.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadDashboardData}
          disabled={loading}
          className="shrink-0 w-full sm:w-auto min-h-[44px] sm:min-h-0"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {/* KPI Cards */}
      <KPICards />

      {/* Overtime alert – employees working > 10h */}
      {overtimeSummary.overtimeRunningCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-lg">Overtime running</CardTitle>
              </div>
              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                {overtimeSummary.overtimeRunningCount} over 10h
              </Badge>
            </div>
            <CardDescription>
              These employees have been on shift for more than 10 hours
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-amber-200/50">
              {overtimeSummary.overtimeRunning.map((s: any) => (
                <li
                  key={s.id}
                  className="px-4 py-2 flex items-center justify-between text-sm"
                >
                  <span className="font-medium">{s.employeeName}</span>
                  <span className="text-amber-700">
                    {formatHours(s.workingHours)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Currently on shift (live, like employee dashboard) */}
      {activeShiftsNow.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-lg">Currently on Shift</CardTitle>
              </div>
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-200"
              >
                {activeShiftsNow.length} active
              </Badge>
            </div>
            <CardDescription>
              Employees with an active shift right now
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs">Employee</TableHead>
                    <TableHead className="text-xs">Branch</TableHead>
                    <TableHead className="text-xs">Scheduled Start</TableHead>
                    <TableHead className="text-xs">Actual Login</TableHead>
                    <TableHead className="text-xs">Late</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Hours</TableHead>
                    <TableHead className="text-xs text-right">Orders</TableHead>
                    <TableHead className="text-xs text-right">Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeShiftsNow.map((s) => (
                    <TableRow key={s.id} className="text-sm">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700">
                              {s.employee?.name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {s.employee?.name || "—"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {s.employee?.employeeCode || ""}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {(s.branch as any)?.name || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.late
                          ? new Date(s.late.scheduledStart).toLocaleTimeString(
                              "en-IN",
                              { hour: "2-digit", minute: "2-digit", hour12: true },
                            )
                          : formatShiftTime24ToAmPm((s.employee as any)?.shiftStartTime ?? "") || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.shiftStart
                          ? new Date(s.shiftStart).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.late
                          ? s.late.lateMinutes === 0
                            ? "On time"
                            : formatHours(s.late.lateMinutes / 60)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                          {(s as any).status || "ACTIVE"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {formatHours(s.totalHours ?? 0, true)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {s.ordersCount ?? 0}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatINR((s.totalSales as number) ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Currently active only: who has started their shift (shown above when any) */}
      {activeShiftsNow.length === 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-slate-500" />
              <CardTitle className="text-lg">Currently active</CardTitle>
            </div>
            <CardDescription>
              Only employees who have started their shift appear here
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No one on shift right now.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Two Column Layout for Item Sales & Employee Sales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ItemSalesSection />
        <EmployeeSalesSection />
      </div>

      {/* End of Day Summary */}
      <EndOfDaySummary />
    </div>
  );

  const MenuSection = () => (
    <div className="space-y-6 min-h-0" style={{ overflowAnchor: "auto" }}>
      {viewingCategory ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 min-w-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingCategory(null)}
                className="w-full sm:w-auto min-h-[44px] sm:min-h-0 shrink-0"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Categories
              </Button>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold truncate">
                  {viewingCategoryData?.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {viewingCategoryData?.items?.length || 0} items
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setItemForm({
                    name: "",
                    description: "",
                    basePrice: 0,
                    hasHalf: false,
                    halfPrice: 0,
                    isActive: true,
                    categoryId: viewingCategory,
                    imageUrl: "",
                    notifyCustomers: false,
                  });
                  setIsItemDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[320px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        Item Name
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Full Price
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Half Price
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Status
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingCategoryData?.items?.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No items in this category
                        </TableCell>
                      </TableRow>
                    )}
                    {viewingCategoryData?.items?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell>{formatINR(item.basePrice)}</TableCell>
                        <TableCell>
                          {item.hasHalf ? formatINR(item.halfPrice) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              item.isActive
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : ""
                            }
                            variant={item.isActive ? "outline" : "secondary"}
                          >
                            {item.isActive ? "Live" : "Hidden"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setEditingItem(item);
                                setItemForm({
                                  name: item.name,
                                  description: item.description || "",
                                  basePrice: item.basePrice,
                                  hasHalf: item.hasHalf,
                                  halfPrice: item.halfPrice || 0,
                                  isActive: item.isActive,
                                  categoryId:
                                    item.categoryId || viewingCategory,
                                  imageUrl: item.imageUrl || "",
                                  notifyCustomers: false,
                                });
                                setIsItemDialogOpen(true);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500"
                              onClick={() => handleDeleteItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold">Menu Categories</h2>
              <p className="text-sm text-muted-foreground">
                Manage categories and their items
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingCategory(null);
                setIsCategoryDialogOpen(true);
              }}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-0 shrink-0"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Category
            </Button>
            <CategoryDialog
              open={isCategoryDialogOpen}
              editingCategory={editingCategory}
              onOpenChange={(open) => {
                if (!open) setEditingCategory(null);
                setIsCategoryDialogOpen(open);
              }}
              onCreated={(cat) => {
                setCategories((prev) => [...prev, cat]);
                setIsCategoryDialogOpen(false);
                setEditingCategory(null);
              }}
              onUpdated={(cat) => {
                setCategories((prev) =>
                  prev.map((c) => (c.id === cat.id ? { ...c, ...cat } : c)),
                );
                setIsCategoryDialogOpen(false);
                setEditingCategory(null);
              }}
              token={token}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                className="pl-8 min-h-[44px] sm:min-h-0"
                value={menuSearchQuery}
                onChange={(e) => setMenuSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={menuFilterBy} onValueChange={setMenuFilterBy}>
                <SelectTrigger className="w-full sm:w-32 min-h-[44px] sm:min-h-0">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  {MENU_CATEGORY_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={menuSortBy} onValueChange={setMenuSortBy}>
                <SelectTrigger className="w-full sm:w-40 min-h-[44px] sm:min-h-0">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  {MENU_SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div
                className="overflow-x-auto overflow-y-visible"
                style={{ overflowAnchor: "auto" }}
              >
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="whitespace-nowrap sticky left-0 z-10 bg-slate-50 border-r min-w-[100px]">
                        Image
                      </TableHead>
                      <TableHead className="whitespace-nowrap min-w-[130px]">
                        Category Name
                      </TableHead>
                      <TableHead className="whitespace-nowrap min-w-[90px]">
                        Items
                      </TableHead>
                      <TableHead className="whitespace-nowrap min-w-[120px]">
                        Status
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap sticky right-0 z-10 bg-slate-50 border-l min-w-[200px]">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCategories.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          {menuSearchQuery
                            ? "No categories found matching your search"
                            : "No categories yet. Create your first category!"}
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredCategories.map((category) => {
                      const status = getCategoryStatus(category);
                      return (
                        <TableRow
                          key={category.id}
                          className="hover:bg-slate-50/50"
                        >
                          <TableCell className="sticky left-0 z-10 bg-white border-r">
                            <div className="flex items-center gap-2">
                              {category.imageUrl ? (
                                <img
                                  src={category.imageUrl}
                                  alt={category.name}
                                  className="h-10 w-10 object-cover rounded-lg border shrink-0"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                    e.currentTarget.nextElementSibling?.classList.remove(
                                      "hidden",
                                    );
                                  }}
                                />
                              ) : (
                                <div className="h-10 w-10 bg-gray-100 rounded-lg border flex items-center justify-center shrink-0">
                                  <Utensils className="h-5 w-5 text-gray-400" />
                                </div>
                              )}
                              <div className="hidden text-xs text-muted-foreground">
                                No image
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium min-w-[130px]">
                            {category.name}
                          </TableCell>
                          <TableCell className="min-w-[90px]">
                            <span className="text-sm font-medium">
                              {status.totalItems}
                            </span>
                            <span className="text-xs text-muted-foreground ml-0.5">
                              items
                            </span>
                          </TableCell>
                          <TableCell className="min-w-[120px]">
                            <div className="flex flex-wrap gap-1 items-center">
                              {status.liveItems > 0 && (
                                <Badge className="bg-green-100 text-green-800 border-green-200 text-[11px] px-1.5 py-0">
                                  {status.liveItems} Live
                                </Badge>
                              )}
                              {status.pendingItems > 0 && (
                                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-[11px] px-1.5 py-0">
                                  {status.pendingItems} Pending
                                </Badge>
                              )}
                              {status.totalItems === 0 && (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right sticky right-0 z-10 bg-white border-l">
                            <div className="flex justify-end gap-1.5 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0 h-8"
                                onClick={() => setViewingCategory(category.id)}
                              >
                                <Eye className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">View</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0 h-8"
                                onClick={() => {
                                  setEditingCategory(category);
                                  setIsCategoryDialogOpen(true);
                                }}
                              >
                                <Edit2 className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">Edit</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 shrink-0"
                                onClick={() =>
                                  handleDeleteCategory(category.id)
                                }
                                disabled={category.items?.length > 0}
                                title={
                                  category.items?.length > 0
                                    ? "Delete all items first"
                                    : "Delete category"
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  const PerformanceSection = () => {
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
      totalBytesSent?: number;
      rpm: number;
      rows: ApiPerfRow[];
    };

    type SystemPerf = {
      now: number;
      cpuUsagePct: number;
      diskUsagePct: number;
      diskTotalBytes: number;
      diskUsedBytes: number;
      diskFreeBytes: number;
      networkEgressBytes: number;
      window: { hours: number };
    };

    type CompletionRow = {
      employeeId: number;
      employeeName: string;
      employeeCode: string | null;
      ordersCompleted: number;
      avgMinutes: number;
      minMinutes: number;
      maxMinutes: number;
    };

    const [apiPerfActor, setApiPerfActor] = useState<
      "ALL" | "ADMIN" | "EMPLOYEE" | "CUSTOMER"
    >("ALL");
    const [apiPerfWindowMinutes, setApiPerfWindowMinutes] = useState<number>(60);
    const [apiPerfLoading, setApiPerfLoading] = useState(false);
    const [apiPerf, setApiPerf] = useState<ApiPerfSummary | null>(null);
    const [sysPerfLoading, setSysPerfLoading] = useState(false);
    const [sysPerf, setSysPerf] = useState<SystemPerf | null>(null);
    const [completionLoading, setCompletionLoading] = useState(false);
    const [completionRows, setCompletionRows] = useState<CompletionRow[]>([]);

    const formatBytes = (b: number) => {
      const n = Number(b) || 0;
      if (n < 1024) return `${n} B`;
      const kb = n / 1024;
      if (kb < 1024) return `${kb.toFixed(1)} KB`;
      const mb = kb / 1024;
      if (mb < 1024) return `${mb.toFixed(1)} MB`;
      const gb = mb / 1024;
      return `${gb.toFixed(2)} GB`;
    };

    const loadApiPerf = useCallback(async () => {
      if (!token) return;
      setApiPerfLoading(true);
      try {
        const params = new URLSearchParams({
          windowMinutes: String(apiPerfWindowMinutes),
          top: "30",
          actor: apiPerfActor,
        });
        const res = await fetch(`${apiBase}/performance/summary?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            (data && typeof data === "object" && "message" in data
              ? String((data as any).message)
              : "Failed to load performance") || "Failed to load performance",
          );
        }
        setApiPerf(data as ApiPerfSummary);
      } catch (e) {
        console.error("Load API performance error:", e);
        setApiPerf(null);
      } finally {
        setApiPerfLoading(false);
      }
    }, [token, apiPerfWindowMinutes, apiPerfActor]);

    const loadSysPerf = useCallback(async () => {
      if (!token) return;
      setSysPerfLoading(true);
      try {
        const res = await fetch(`${apiBase}/performance/system`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error((data as any)?.message || "Failed to load system metrics");
        setSysPerf(data as SystemPerf);
      } catch (e) {
        console.error("Load system metrics error:", e);
        setSysPerf(null);
      } finally {
        setSysPerfLoading(false);
      }
    }, [token]);

    const loadCompletion = useCallback(async () => {
      if (!token) return;
      setCompletionLoading(true);
      try {
        const res = await fetch(`${apiBase}/reports/order-completion-times?days=7`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error((data as any)?.message || "Failed to load completion times");
        setCompletionRows(Array.isArray((data as any)?.rows) ? (data as any).rows : []);
      } catch (e) {
        console.error("Load completion times error:", e);
        setCompletionRows([]);
      } finally {
        setCompletionLoading(false);
      }
    }, [token]);

    useEffect(() => {
      if (activeSection !== "performance") return;
      loadApiPerf();
      loadSysPerf();
      loadCompletion();
      const id = window.setInterval(() => loadApiPerf(), 30_000);
      const id2 = window.setInterval(() => loadSysPerf(), 60_000);
      const id3 = window.setInterval(() => loadCompletion(), 120_000);
      return () => {
        window.clearInterval(id);
        window.clearInterval(id2);
        window.clearInterval(id3);
      };
    }, [activeSection, loadApiPerf, loadSysPerf, loadCompletion]);

    const overall = useMemo(() => {
      const rows = apiPerf?.rows ?? [];
      const total = rows.reduce((s, r) => s + (r.count || 0), 0);
      const weightedAvg =
        total > 0
          ? rows.reduce((s, r) => s + (Number(r.avgMs) || 0) * r.count, 0) /
            total
          : 0;
      const weightedP95 =
        total > 0
          ? rows.reduce((s, r) => s + (Number(r.p95Ms) || 0) * r.count, 0) /
            total
          : 0;
      return {
        rpm: apiPerf?.rpm ?? 0,
        avgMs: Math.round(weightedAvg),
        p95Ms: Math.round(weightedP95),
        totalCount: apiPerf?.totalCount ?? 0,
        totalErrorCount: apiPerf?.totalErrorCount ?? 0,
        totalBytesSent: apiPerf?.totalBytesSent ?? 0,
      };
    }, [apiPerf]);

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold sm:text-xl">
              Performance Dashboard
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground truncate max-w-full">
              Live backend API latency and traffic (auto refresh every 30 seconds).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={apiPerfActor}
              onValueChange={(v: any) =>
                setApiPerfActor(
                  v === "ADMIN" || v === "EMPLOYEE" || v === "CUSTOMER"
                    ? v
                    : "ALL",
                )
              }
            >
              <SelectTrigger className="w-[150px] min-h-[44px] sm:min-h-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
                <SelectItem value="CUSTOMER">Customer</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={String(apiPerfWindowMinutes)}
              onValueChange={(v) => setApiPerfWindowMinutes(Number(v) || 60)}
            >
              <SelectTrigger className="w-[150px] min-h-[44px] sm:min-h-0">
                <SelectValue />
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
              <p className="mt-1 text-lg font-bold text-slate-900">
                {overall.rpm ? overall.rpm.toFixed(1) : "0.0"}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">API Avg (ms)</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {overall.avgMs || 0}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">API P95 (ms)</p>
              <p className="mt-1 text-lg font-bold text-amber-700">
                {overall.p95Ms || 0}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Errors (5xx)</p>
              <p className="mt-1 text-lg font-bold text-red-600">
                {overall.totalErrorCount || 0}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total requests</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {overall.totalCount || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Network Egress (24h)</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {sysPerf ? formatBytes(sysPerf.networkEgressBytes) : "—"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Estimated from API responses
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">CPU Usage</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {sysPerf ? `${sysPerf.cpuUsagePct}%` : "—"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Based on 1‑min load average
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Disk Usage</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {sysPerf ? `${sysPerf.diskUsagePct}%` : "—"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {sysPerf
                  ? `${formatBytes(sysPerf.diskUsedBytes)} / ${formatBytes(sysPerf.diskTotalBytes)}`
                  : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" />
              Slow APIs (by P95)
            </CardTitle>
            <CardDescription className="text-xs">
              Endpoints with traffic and latency. P95 is the most important number.
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
                        P50 (ms)
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        P95 (ms)
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Max (ms)
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
                        <TableCell className="text-right">
                          {Math.round(r.p50Ms)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-amber-700">
                          {Math.round(r.p95Ms)}
                        </TableCell>
                        <TableCell className="text-right">
                          {Math.round(r.maxMs)}
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Order completion time (avg)</CardTitle>
            <CardDescription className="text-xs">
              Average time taken by employees to complete orders (last 7 days).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {completionLoading && completionRows.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : completionRows.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No completed orders in this window yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Orders
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Avg (min)
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Min
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Max
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completionRows.map((r) => (
                      <TableRow key={String(r.employeeId)}>
                        <TableCell className="font-medium">
                          {r.employeeName}
                          {r.employeeCode ? (
                            <span className="text-xs text-muted-foreground ml-2 font-mono">
                              {r.employeeCode}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.ordersCompleted}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-700">
                          {r.avgMinutes}
                        </TableCell>
                        <TableCell className="text-right">{r.minMinutes}</TableCell>
                        <TableCell className="text-right">{r.maxMinutes}</TableCell>
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
  };

  // EMPLOYEES SECTION – Active Employees = permanent roster; Shift Status = currently on shift (from /shift/active)
  const onShiftEmployeeIds = useMemo(
    () =>
      new Set(
        (activeShiftsNow || []).map((s: any) => s.employee?.id).filter(Boolean),
      ),
    [activeShiftsNow],
  );
  const filteredEmployees = useMemo(
    () =>
      employees.filter((e) => {
        const matchesSearch =
          e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (e.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (e.employeeCode || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase());
        const statusUpper = String(e.status || "").toUpperCase();
        const filterUpper = String(statusFilter || "").toUpperCase();
        const matchesStatus =
          statusFilter === "all" || statusUpper === filterUpper;
        return matchesSearch && matchesStatus;
      }),
    [employees, searchQuery, statusFilter],
  );
  const activeCount = employees.filter(
    (e) => String(e.status || "").toUpperCase() === "ACTIVE",
  ).length;

  const EmployeesSection = () => (
    <div className="space-y-4 min-w-0 overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Employees</h2>
          <p className="text-sm text-muted-foreground">
            Active employees = permanent roster. &quot;Currently on Shift&quot;
            is shown on the dashboard.
          </p>
        </div>
        <Button size="sm" onClick={() => setIsEmployeeDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Employee
        </Button>
      </div>

      {/* Summary: Total, Active, Currently on Shift */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Employees</p>
            <p className="text-xl font-bold">{employees.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Active Employees</p>
            <p className="text-xl font-bold text-emerald-700">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Currently on Shift</p>
            <p className="text-xl font-bold text-amber-700">
              {activeShiftsNow.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="pb-3 px-3 sm:px-6">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, code..."
                className="pl-8 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36 min-w-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYEE_STATUS_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Showing {filteredEmployees.length} employee
            {filteredEmployees.length !== 1 ? "s" : ""} (filter:{" "}
            {statusFilter === "ACTIVE"
              ? "Active"
              : statusFilter === "all"
                ? "All"
                : statusFilter}
            )
          </p>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden">
          <div className="overflow-x-auto -mx-1 px-1">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-semibold whitespace-nowrap">
                    Code
                  </TableHead>
                  <TableHead className="text-xs font-semibold whitespace-nowrap">
                    Name
                  </TableHead>
                  <TableHead className="text-xs font-semibold min-w-[140px] sm:min-w-[200px]">
                    Email
                  </TableHead>
                  <TableHead className="text-xs font-semibold">Role</TableHead>
                  <TableHead className="text-xs font-semibold">
                    Verified
                  </TableHead>
                  <TableHead className="text-xs font-semibold">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-semibold">
                    Shift Status
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No employees match the filter. Try &quot;All&quot; or a
                      different search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp) => (
                    <TableRow key={emp.id} className="text-sm">
                      <TableCell className="font-mono text-xs">
                        {emp.employeeCode || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                              {emp.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{emp.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          {emp.emailVerified && (
                            <span
                              className="shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100 text-emerald-700"
                              title="Email verified"
                            >
                              <CheckCircle2
                                className="h-3.5 w-3.5"
                                aria-hidden
                              />
                            </span>
                          )}
                          <span className="text-slate-800 font-medium break-all">
                            {emp.email ? (
                              <a
                                href={`mailto:${emp.email}`}
                                className="text-emerald-700 hover:underline"
                              >
                                {emp.email}
                              </a>
                            ) : (
                              "—"
                            )}
                          </span>
                          {!emp.emailVerified && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs shrink-0"
                              disabled={verifyingEmployeeId === emp.id}
                              onClick={() => setEmployeeToVerify(emp)}
                              title="Verify employee email"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              {verifyingEmployeeId === emp.id
                                ? "Sending..."
                                : "Verify"}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{emp.role || "—"}</TableCell>
                      <TableCell>
                        {emp.emailVerified ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                            Verified
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                            Not Verified
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={emp.status} />
                      </TableCell>
                      <TableCell>
                        {String(emp.status || "").toUpperCase() !== "ACTIVE" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : onShiftEmployeeIds.has(emp.id) ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                            On Shift
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground"
                          >
                            Off Shift
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEmployeeToChangePassword(emp)}
                            disabled={changingPasswordEmployeeId === emp.id}
                            title="Change password (director receives email)"
                          >
                            <Lock className="h-4 w-4 mr-1" />
                            Change password
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingEmployee(emp)}
                          >
                            <Edit2 className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Memoized order cards grid so cards don't re-render on every parent update (stable, no flash)
  const ordersGridContent = useMemo(
    () => (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 min-w-0">
        {ordersByTable.map((table) => (
          <Card key={table.tableId} className="overflow-hidden card-gpu">
            <CardHeader className="pb-2 bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 rounded-md">
                    <Utensils className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      Table {table.tableNumber}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {table.orders.length} orders
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-emerald-600">
                  {formatINR(table.totalAmount)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[200px]">
                <div className="divide-y">
                  {table.orders.map((order: Order) => (
                    <AdminOrderRow
                      key={order.id}
                      order={order}
                      onSelect={handleOpenOrderDialog}
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
        {ordersByTable.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-20" />
              <p className="text-muted-foreground">
                No orders found for the selected date
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    ),
    [ordersByTable, handleOpenOrderDialog],
  );

  // ORDERS SECTION - Updated with table view and popup
  const OrdersSection = () => (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold truncate">
            Orders by Table
          </h2>
          <p className="text-sm text-muted-foreground">
            View all orders grouped by table
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Input
            type="date"
            className="w-full min-w-0 sm:w-36 min-h-[44px] sm:min-h-0"
            value={orderDateFilter}
            onChange={(e) => setOrderDateFilter(e.target.value)}
          />
          <Select value={orderTableFilter} onValueChange={setOrderTableFilter}>
            <SelectTrigger className="w-full sm:w-36 min-h-[44px] sm:min-h-0">
              <SelectValue placeholder="All Tables" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tables</SelectItem>
              {ordersByTable.map((t) => (
                <SelectItem key={t.tableId} value={String(t.tableId)}>
                  Table {t.tableNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={loadAllOrders}
            disabled={loading}
            title="Refresh orders"
            className="min-h-[44px] sm:min-h-0 shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <Card className="bg-blue-50 border-blue-100 min-w-0">
          <CardContent className="p-2 sm:p-3">
            <p className="text-xs text-muted-foreground">Total Orders</p>
            <p className="text-lg sm:text-xl font-bold text-blue-700 truncate">
              {allOrders.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100 min-w-0">
          <CardContent className="p-2 sm:p-3">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-lg sm:text-xl font-bold text-emerald-700 truncate">
              {formatINR(
                allOrders
                  .filter((o) => o.paymentStatus === "PAID")
                  .reduce((sum, o) => sum + o.totalAmount, 0),
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100 min-w-0">
          <CardContent className="p-2 sm:p-3">
            <p className="text-xs text-muted-foreground">Tables Active</p>
            <p className="text-lg sm:text-xl font-bold text-amber-700 truncate">
              {ordersByTable.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100 min-w-0">
          <CardContent className="p-2 sm:p-3">
            <p className="text-xs text-muted-foreground">Pending Payment</p>
            <p className="text-lg sm:text-xl font-bold text-purple-700 truncate">
              {allOrders.filter((o) => o.paymentStatus !== "PAID").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Orders by Table – memoized so cards stay stable */}
      {ordersGridContent}
    </div>
  );

  // CUSTOMER LEADERBOARD SECTION – Top customers by amount (default) / orders
  const CustomerLeaderboardSection = () => (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold truncate">
            Customer Leaderboard
          </h2>
          <p className="text-sm text-muted-foreground">
            Highest paying customers (descending)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={leaderboardSortBy}
            onValueChange={(v: "orders" | "amount") => setLeaderboardSortBy(v)}
          >
            <SelectTrigger className="w-[180px] min-h-[44px] sm:min-h-0">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="orders">Sort by Total Orders</SelectItem>
              <SelectItem value="amount">Sort by Amount Spent</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={String(leaderboardLimit)}
            onValueChange={(v) => setLeaderboardLimit(Number(v))}
          >
            <SelectTrigger className="w-[100px] min-h-[44px] sm:min-h-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">Top 5</SelectItem>
              <SelectItem value="10">Top 10</SelectItem>
              <SelectItem value="20">Top 20</SelectItem>
              <SelectItem value="50">Top 50</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={loadLeaderboard}
            disabled={leaderboardLoading}
            className="min-h-[44px] sm:min-h-0"
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${leaderboardLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {leaderboardLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="h-5 w-32 rounded bg-slate-200 animate-pulse mb-3" />
                <div className="h-4 w-24 rounded bg-slate-100 animate-pulse mb-2" />
                <div className="h-4 w-20 rounded bg-slate-100 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : leaderboard.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground font-medium">
              No customer data yet
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Orders with a mobile number will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Table: Customer Name, Mobile, Total Orders, Total Spent — clear list form */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-14 whitespace-nowrap">Rank</TableHead>
                  <TableHead className="min-w-[140px] sm:min-w-[180px] whitespace-nowrap">
                    Customer Name
                  </TableHead>
                  <TableHead className="min-w-[110px] whitespace-nowrap">
                    Mobile Number
                  </TableHead>
                  <TableHead className="w-24 whitespace-nowrap text-right">
                    Total Orders
                  </TableHead>
                  <TableHead className="min-w-[100px] whitespace-nowrap text-right">
                    Total Spent
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((row, idx) => (
                  <TableRow key={`${row.customerMobile}-${idx}`}>
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell className="font-medium align-top">
                      {(row.customerName || "—").toUpperCase()}
                    </TableCell>
                    <TableCell className="text-muted-foreground align-top font-mono text-sm">
                      {row.customerMobile || "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold align-top">
                      {row.totalOrders}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-emerald-700 align-top">
                      {formatINR(row.totalSpent)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );

  // WORK HOURS SECTION - Updated with filters and daily stats
  const WorkHoursSection = () => (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Employee Work Hours</h2>
          <p className="text-sm text-muted-foreground">
            Track attendance, hours and sales
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={hoursEmployeeFilter}
            onValueChange={setHoursEmployeeFilter}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees
                .filter(
                  (e) => String(e.status || "").toUpperCase() === "ACTIVE",
                )
                .map((emp) => (
                  <SelectItem key={emp.id} value={String(emp.id)}>
                    {emp.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">
                Start Date
              </Label>
              <Input
                type="date"
                className="w-full min-w-[140px] bg-background border border-input"
                value={hoursStartDate}
                onChange={(e) => setHoursStartDate(e.target.value)}
              />
            </div>
            <span className="text-muted-foreground pb-2 hidden sm:inline">
              –
            </span>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">End Date</Label>
              <Input
                type="date"
                className="w-full min-w-[140px] bg-background border border-input"
                value={hoursEndDate}
                onChange={(e) => setHoursEndDate(e.target.value)}
              />
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={loadShiftHistory}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Shifts</p>
            <p className="text-xl font-bold text-blue-700">
              {hoursSummary.totalShifts}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Hours</p>
            <p className="text-xl font-bold text-emerald-700">
              {formatHours(hoursSummary.totalHours)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Sales</p>
            <p className="text-xl font-bold text-purple-700">
              {formatINR(hoursSummary.totalSales)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Avg Hours/Shift</p>
            <p className="text-xl font-bold text-amber-700">
              {hoursSummary.totalShifts > 0
                ? formatHours(
                    hoursSummary.totalHours / hoursSummary.totalShifts,
                  )
                : "0 min"}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Break (fixed)</p>
            <p className="text-xl font-bold text-slate-700">
              {formatBreakTime(BREAK_TIME_MINUTES)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Stats */}
      {dailyStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Daily Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs text-right">Shifts</TableHead>
                    <TableHead className="text-xs text-right">Hours</TableHead>
                    <TableHead className="text-xs text-right">Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyStats.map((stat) => (
                    <TableRow key={stat.date} className="text-sm">
                      <TableCell>
                        {new Date(stat.date).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right">
                        {stat.shifts}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatHours(stat.totalHours)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatINR(stat.totalSales)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shifts Detail */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Shift Details</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs">Employee</TableHead>
                  <TableHead className="text-xs">Branch</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">In Time</TableHead>
                  <TableHead className="text-xs">Out Time</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Hours</TableHead>
                  <TableHead className="text-xs text-right">Orders</TableHead>
                  <TableHead className="text-xs text-right">Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.id} className="text-sm">
                    <TableCell className="font-medium">
                      {shift.employee?.name}
                    </TableCell>
                    <TableCell>{(shift as any).branch?.name || "—"}</TableCell>
                    <TableCell>
                      {new Date(shift.shiftStart).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell>
                      {new Date(shift.shiftStart).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      {shift.shiftEnd
                        ? new Date(shift.shiftEnd).toLocaleTimeString()
                        : "Active"}
                    </TableCell>
                    <TableCell>
                      {(shift as any).status ||
                        (shift.shiftEnd ? "ENDED" : "ACTIVE")}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatHours(shift.totalHours || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {shift.orders?.length || 0}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">
                      {formatINR(shift.totalSales || 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {shifts.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No shifts found for the selected filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const handleOvertimeResetFilters = useCallback(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setOvertimeDateFrom(start.toISOString().slice(0, 10));
    setOvertimeDateTo(now.toISOString().slice(0, 10));
    setOvertimeEmployeeFilter("all");
  }, []);

  // OVERTIME SECTION – Shifts > 10h; filter by date and employee
  const OvertimeSection = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Overtime</h2>
        <p className="text-sm text-muted-foreground">
          Shifts over employee&apos;s working hours per day. Auto-closed at
          04:00 AM if not ended.
        </p>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Date From</Label>
              <Input
                type="date"
                value={overtimeDateFrom}
                onChange={(e) => setOvertimeDateFrom(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Date To</Label>
              <Input
                type="date"
                value={overtimeDateTo}
                onChange={(e) => setOvertimeDateTo(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Employee</Label>
              <Select
                value={overtimeEmployeeFilter}
                onValueChange={setOvertimeEmployeeFilter}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees
                    .filter(
                      (e) => String(e.status || "").toUpperCase() === "ACTIVE",
                    )
                    .map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <LoaderButton
                variant="outline"
                size="sm"
                onClick={handleOvertimeResetFilters}
                loading={overtimeLoading}
                loadingLabel="Resetting..."
              >
                Reset
              </LoaderButton>
              <LoaderButton
                size="sm"
                onClick={() => loadOvertime()}
                loading={overtimeLoading}
                loadingLabel="Applying..."
              >
                <Search className="h-4 w-4 mr-1" />
                Apply
              </LoaderButton>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {overtimeRecords.length === 0 && !overtimeLoading ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No overtime records for the selected filters
            </p>
          ) : (
            <>
              <div className="md:hidden space-y-2 p-3">
                {overtimeRecords.map((r) => {
                  const isLive = r.live === true || r.status === "RUNNING";
                  const endTime = r.shiftEnd
                    ? new Date(r.shiftEnd).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—";
                  return (
                    <div
                      key={r.id}
                      className="rounded-lg border bg-slate-50/50 p-3 text-sm grid grid-cols-2 gap-x-3 gap-y-1"
                    >
                      <span className="text-muted-foreground">Employee</span>
                      <span className="font-medium">{r.employeeName}</span>
                      <span className="text-muted-foreground">Role</span>
                      <span>{r.role ?? "—"}</span>
                      <span className="text-muted-foreground">Date</span>
                      <span>
                        {new Date(r.shiftDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="text-muted-foreground">Start</span>
                      <span>
                        {new Date(r.shiftStart).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="text-muted-foreground">End</span>
                      <span>{endTime}</span>
                      <span className="text-muted-foreground">Total Hours</span>
                      <span>{formatHours(Number(r.totalHours))}</span>
                      <span className="text-muted-foreground">Overtime</span>
                      <span className="font-medium text-amber-600">
                        {formatHours(Number(r.overtimeHours))}
                      </span>
                      <span className="text-muted-foreground">Reason</span>
                      <span>{r.reason ?? "—"}</span>
                      <span className="text-muted-foreground">Status</span>
                      <span>
                        {isLive ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                            RUNNING
                          </Badge>
                        ) : (
                          <Select
                            value={r.status}
                            onValueChange={async (status) => {
                              try {
                                const res = await fetch(
                                  `${apiBase}/overtime/${r.id}/status`,
                                  {
                                    method: "PATCH",
                                    headers: {
                                      "Content-Type": "application/json",
                                      Authorization: `Bearer ${token}`,
                                    },
                                    body: JSON.stringify({ status }),
                                  },
                                );
                                if (res.ok) {
                                  loadOvertime();
                                  if (
                                    overtimeSummary.pendingOvertimeCount > 0 ||
                                    overtimeSummary.overtimeRunningCount > 0
                                  ) {
                                    const sumRes = await fetch(
                                      `${apiBase}/overtime/summary`,
                                      {
                                        headers: {
                                          Authorization: `Bearer ${token}`,
                                        },
                                      },
                                    );
                                    if (sumRes.ok) {
                                      const summary = await sumRes.json();
                                      setOvertimeSummary({
                                        pendingOvertimeCount:
                                          summary.pendingOvertimeCount ?? 0,
                                        overtimeRunningCount:
                                          summary.overtimeRunningCount ?? 0,
                                        overtimeRunning:
                                          summary.overtimeRunning ?? [],
                                      });
                                    }
                                  }
                                }
                              } catch (_e) {}
                            }}
                          >
                            <SelectTrigger className="w-full max-w-[120px] h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PENDING">Pending</SelectItem>
                              <SelectItem value="APPROVED">Approved</SelectItem>
                              <SelectItem value="REJECTED">Rejected</SelectItem>
                              <SelectItem value="PAID">Paid</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-semibold">
                        Employee
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Role
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Date
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Start
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        End
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Total Hours
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Overtime
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Reason
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overtimeRecords.map((r) => {
                      const isLive = r.live === true || r.status === "RUNNING";
                      const endTime = r.shiftEnd
                        ? new Date(r.shiftEnd).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—";
                      return (
                        <TableRow key={r.id} className="text-sm">
                          <TableCell className="font-medium">
                            {r.employeeName}
                          </TableCell>
                          <TableCell>{r.role ?? "—"}</TableCell>
                          <TableCell>
                            {new Date(r.shiftDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell>
                            {new Date(r.shiftStart).toLocaleTimeString(
                              "en-IN",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </TableCell>
                          <TableCell>{endTime}</TableCell>
                          <TableCell>
                            {formatHours(Number(r.totalHours))}
                          </TableCell>
                          <TableCell className="font-medium text-amber-600">
                            {formatHours(Number(r.overtimeHours))}
                          </TableCell>
                          <TableCell>{r.reason ?? "—"}</TableCell>
                          <TableCell>
                            {isLive ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                                RUNNING
                              </Badge>
                            ) : (
                              <Select
                                value={r.status}
                                onValueChange={async (status) => {
                                  try {
                                    const res = await fetch(
                                      `${apiBase}/overtime/${r.id}/status`,
                                      {
                                        method: "PATCH",
                                        headers: {
                                          "Content-Type": "application/json",
                                          Authorization: `Bearer ${token}`,
                                        },
                                        body: JSON.stringify({ status }),
                                      },
                                    );
                                    if (res.ok) {
                                      loadOvertime();
                                      if (
                                        overtimeSummary.pendingOvertimeCount >
                                          0 ||
                                        overtimeSummary.overtimeRunningCount > 0
                                      ) {
                                        const sumRes = await fetch(
                                          `${apiBase}/overtime/summary`,
                                          {
                                            headers: {
                                              Authorization: `Bearer ${token}`,
                                            },
                                          },
                                        );
                                        if (sumRes.ok) {
                                          const summary = await sumRes.json();
                                          setOvertimeSummary({
                                            pendingOvertimeCount:
                                              summary.pendingOvertimeCount ?? 0,
                                            overtimeRunningCount:
                                              summary.overtimeRunningCount ?? 0,
                                            overtimeRunning:
                                              summary.overtimeRunning ?? [],
                                          });
                                        }
                                      }
                                    }
                                  } catch (_e) {}
                                }}
                              >
                                <SelectTrigger className="w-[110px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PENDING">
                                    Pending
                                  </SelectItem>
                                  <SelectItem value="APPROVED">
                                    Approved
                                  </SelectItem>
                                  <SelectItem value="REJECTED">
                                    Rejected
                                  </SelectItem>
                                  <SelectItem value="PAID">Paid</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const formatLateMinutes = (mins: number) => {
    if (mins < 60) return `${mins} Minute${mins !== 1 ? "s" : ""}`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h} Hour${h !== 1 ? "s" : ""}`;
    return `${h} Hour${h !== 1 ? "s" : ""} ${m} Min`;
  };

  /** Format "HH:mm" (24h) to "10:00 AM" / "3:23 PM" for Scheduled Start in Late Entries. */
  const formatShiftTime24ToAmPm = (timeStr: string): string => {
    if (!timeStr || typeof timeStr !== "string") return timeStr || "—";
    const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
    if (!match) return timeStr;
    const hour = parseInt(match[1], 10);
    const minute = match[2];
    if (hour < 0 || hour > 23) return timeStr;
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? "AM" : "PM";
    return `${h}:${minute} ${ampm}`;
  };

  const LateSection = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Late Entries</h2>
        <p className="text-sm text-muted-foreground">
          Employees who started their shift after the scheduled shift start time.
          <span className="block mt-1 text-xs">Scheduled Start = shift start time (e.g. 10:00 AM). Actual Login = when the employee started their shift.</span>
        </p>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Date From</Label>
              <Input
                type="date"
                value={lateDateFrom}
                onChange={(e) => setLateDateFrom(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Date To</Label>
              <Input
                type="date"
                value={lateDateTo}
                onChange={(e) => setLateDateTo(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Employee</Label>
              <Select
                value={lateEmployeeFilter}
                onValueChange={setLateEmployeeFilter}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees
                    .filter(
                      (e) => String(e.status || "").toUpperCase() === "ACTIVE",
                    )
                    .map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <LoaderButton
                variant="outline"
                size="sm"
                onClick={() => {
                  setLateDateFrom("");
                  setLateDateTo("");
                  setLateEmployeeFilter("all");
                }}
                loading={lateLoading}
                loadingLabel="Resetting..."
              >
                Reset
              </LoaderButton>
              <LoaderButton
                size="sm"
                onClick={() => loadLate()}
                loading={lateLoading}
                loadingLabel="Applying..."
              >
                <Search className="h-4 w-4 mr-1" />
                Apply
              </LoaderButton>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {lateEntries.length === 0 && !lateLoading ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No late entries for the selected filters
            </p>
          ) : (
            <>
              <div className="md:hidden space-y-2 p-3">
                {lateEntries.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-lg border bg-slate-50/50 p-3 text-sm grid grid-cols-2 gap-x-3 gap-y-1"
                  >
                    <span className="text-muted-foreground">Employee</span>
                    <span className="font-medium">
                      {e.employee?.name ?? "—"}
                    </span>
                    <span className="text-muted-foreground">Date</span>
                    <span>
                      {new Date(e.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-muted-foreground">
                      Scheduled Start
                    </span>
                    <span>{formatShiftTime24ToAmPm(e.shiftStartTime)}</span>
                    <span className="text-muted-foreground">Actual Login</span>
                    <span>
                      {new Date(e.actualLoginTime).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-muted-foreground">Late</span>
                    <span className="font-medium text-amber-600">
                      {formatLateMinutes(e.lateDurationMinutes)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-semibold">
                        Employee
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Date
                      </TableHead>
                      <TableHead className="text-xs font-semibold" title="Scheduled shift start time">
                        Scheduled Start
                      </TableHead>
                      <TableHead className="text-xs font-semibold" title="When the employee actually started their shift">
                        Actual Login
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Late
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lateEntries.map((e) => (
                      <TableRow key={e.id} className="text-sm">
                        <TableCell className="font-medium">
                          {e.employee?.name ?? "—"}
                        </TableCell>
                        <TableCell>
                          {new Date(e.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell>{formatShiftTime24ToAmPm(e.shiftStartTime)}</TableCell>
                        <TableCell>
                          {new Date(e.actualLoginTime).toLocaleTimeString(
                            "en-IN",
                            { hour: "2-digit", minute: "2-digit", hour12: true },
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-amber-600">
                          {formatLateMinutes(e.lateDurationMinutes)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // Customer Queries Section
  const CustomerQueriesSection = () => (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Customer Queries
          </h2>
          <p className="text-sm text-muted-foreground">
            Issues and help requests from customers
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Select
            value={queryStatusFilter}
            onValueChange={setQueryStatusFilter}
          >
            <SelectTrigger className="w-full sm:w-40 min-h-[44px] sm:min-h-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={loadCustomerQueries}
            className="min-h-[44px] sm:min-h-0 shrink-0 w-full sm:w-auto"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto overflow-y-visible">
            <ScrollArea className="h-[min(500px,70vh)] w-full">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="whitespace-nowrap sticky left-0 z-10 bg-slate-50 border-r min-w-[52px]">
                      ID
                    </TableHead>
                    <TableHead className="whitespace-nowrap min-w-[100px]">
                      Customer
                    </TableHead>
                    <TableHead className="whitespace-nowrap min-w-[100px]">
                      Mobile
                    </TableHead>
                    <TableHead className="whitespace-nowrap min-w-[90px]">
                      Branch
                    </TableHead>
                    <TableHead className="whitespace-nowrap min-w-[70px]">
                      Order
                    </TableHead>
                    <TableHead className="whitespace-nowrap min-w-[90px]">
                      Issue Type
                    </TableHead>
                    <TableHead className="whitespace-nowrap min-w-[90px]">
                      Status
                    </TableHead>
                    <TableHead className="whitespace-nowrap min-w-[110px]">
                      Date
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap sticky right-0 z-10 bg-slate-50 border-l min-w-[180px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerQueries.map((q) => (
                    <TableRow key={q.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium sticky left-0 z-10 bg-white border-r whitespace-nowrap">
                        {q.id}
                      </TableCell>
                      <TableCell className="min-w-[100px]">{q.name}</TableCell>
                      <TableCell className="whitespace-nowrap min-w-[100px]">
                        {q.mobile}
                      </TableCell>
                      <TableCell
                        className="min-w-[90px] truncate max-w-[120px]"
                        title={q.branch?.name ?? undefined}
                      >
                        {q.branch?.name ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {q.orderId != null ? `#${q.orderId}` : "—"}
                      </TableCell>
                      <TableCell className="min-w-[90px]">
                        {q.issueType.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            q.status === "RESOLVED"
                              ? "default"
                              : q.status === "IN_PROGRESS"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-xs shrink-0"
                        >
                          {q.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(q.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right sticky right-0 z-10 bg-white border-l">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 h-8"
                            onClick={() => {
                              setSelectedQuery(q);
                              setQueryDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                          {q.status !== "RESOLVED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0 h-8"
                              disabled={resolvingQueryId === q.id}
                              onClick={async () => {
                                setResolvingQueryId(q.id);
                                try {
                                  const res = await fetch(
                                    `${apiBase}/customer-queries/${q.id}/resolve`,
                                    {
                                      method: "POST",
                                      headers: {
                                        Authorization: `Bearer ${token}`,
                                      },
                                    },
                                  );
                                  if (res.ok) {
                                    const data = await res.json();
                                    if (data.waMeLink)
                                      window.open(data.waMeLink, "_blank");
                                    toast({
                                      title: "Resolved",
                                      description:
                                        "Open WhatsApp to notify the customer.",
                                    });
                                    loadCustomerQueries();
                                    loadPendingQueriesCount();
                                  }
                                } finally {
                                  setResolvingQueryId(null);
                                }
                              }}
                            >
                              {resolvingQueryId === q.id ? "..." : "Resolve"}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 h-8"
                            onClick={() =>
                              window.open(
                                `https://wa.me/91${q.mobile.replace(/\D/g, "").slice(-10)}`,
                                "_blank",
                              )
                            }
                          >
                            Contact
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {customerQueries.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No customer queries found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
      <Dialog open={queryDialogOpen} onOpenChange={setQueryDialogOpen}>
        <DialogContent
          className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6"
          aria-describedby="query-dialog-desc"
        >
          <DialogHeader>
            <DialogTitle>Query #{selectedQuery?.id}</DialogTitle>
            <DialogDescription id="query-dialog-desc" className="sr-only">
              View customer query details and message.
            </DialogDescription>
          </DialogHeader>
          {selectedQuery && (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">Customer:</span>{" "}
                {selectedQuery.name}
              </p>
              <p>
                <span className="font-medium">Mobile:</span>{" "}
                {selectedQuery.mobile}
              </p>
              <p>
                <span className="font-medium">Branch:</span>{" "}
                {selectedQuery.branch?.name ?? "—"}
              </p>
              <p>
                <span className="font-medium">Order ID:</span>{" "}
                {selectedQuery.orderId != null
                  ? `ORD${String(selectedQuery.orderId).padStart(4, "0")}`
                  : "—"}
              </p>
              <p>
                <span className="font-medium">Issue type:</span>{" "}
                {selectedQuery.issueType.replace(/_/g, " ")}
              </p>
              <p>
                <span className="font-medium">Status:</span>{" "}
                {selectedQuery.status}
              </p>
              <p>
                <span className="font-medium">Date:</span>{" "}
                {new Date(selectedQuery.createdAt).toLocaleString()}
              </p>
              <div>
                <p className="font-medium mb-1">Message:</p>
                <p className="rounded bg-muted p-3 text-muted-foreground">
                  {selectedQuery.message}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  // Removed Items Section
  const RemovedItemsSection = () => (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Removed Items Report
          </h2>
          <p className="text-sm text-muted-foreground">
            Track items removed by employees from orders
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Input
            type="date"
            value={removedItemsDateFilter}
            onChange={(e) => setRemovedItemsDateFilter(e.target.value)}
            className="w-full sm:w-40 min-h-[44px] sm:min-h-0"
          />
          <Button
            variant="outline"
            onClick={loadRemovedItems}
            className="min-h-[44px] sm:min-h-0 shrink-0"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Items Removed
                </p>
                <p className="text-2xl font-bold">{removedItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <IndianRupee className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Loss</p>
                <p className="text-2xl font-bold">{formatINR(totalLoss)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Daily Avg Loss</p>
                <p className="text-2xl font-bold">
                  {formatINR(
                    dailyRemovalSummaries.length > 0
                      ? totalLoss / dailyRemovalSummaries.length
                      : 0,
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Removed Items Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Removed Items Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="overflow-x-auto overflow-y-visible -mx-1 px-1"
            style={{ overflowAnchor: "auto" }}
          >
            <ScrollArea className="h-[400px] w-full">
              <div className="min-w-[900px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap sticky left-0 z-10 bg-white border-r min-w-[100px]">
                        Date
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Order #
                      </TableHead>
                      <TableHead className="whitespace-nowrap">Table</TableHead>
                      <TableHead className="whitespace-nowrap">Item</TableHead>
                      <TableHead className="whitespace-nowrap">Qty</TableHead>
                      <TableHead className="whitespace-nowrap">Price</TableHead>
                      <TableHead className="whitespace-nowrap">Loss</TableHead>
                      <TableHead className="whitespace-nowrap">
                        Removed By
                      </TableHead>
                      <TableHead className="whitespace-nowrap min-w-[120px]">
                        Reason
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {removedItems.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="text-center text-muted-foreground py-8"
                        >
                          No removed items found for the selected date
                        </TableCell>
                      </TableRow>
                    )}
                    {removedItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="sticky left-0 z-10 bg-white border-r whitespace-nowrap">
                          {new Date(item.removedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          #{item.orderId}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {item.tableNumber || "N/A"}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {item.itemName}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatINR(item.itemPrice)}
                        </TableCell>
                        <TableCell className="text-red-600 font-medium whitespace-nowrap">
                          {formatINR(item.itemPrice * item.quantity)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {item.removedBy}
                        </TableCell>
                        <TableCell
                          className="max-w-[150px] truncate"
                          title={item.reason}
                        >
                          {item.reason}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Daily Summary */}
      {dailyRemovalSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daily Removal Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Items Removed</TableHead>
                  <TableHead>Total Loss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyRemovalSummaries.map((summary) => (
                  <TableRow key={summary.date}>
                    <TableCell>
                      {new Date(summary.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{summary.totalItems}</TableCell>
                    <TableCell className="text-red-600 font-medium">
                      {formatINR(summary.totalLoss)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // 9. SALARY SLIPS SECTION
  const salarySlipsFiltered = useMemo(() => {
    let list = salarySlips;
    const q = salaryTableSearch.trim().toLowerCase();
    if (q)
      list = list.filter(
        (s) =>
          (s.employee?.name ?? "").toLowerCase().includes(q) ||
          (s.employeeCode ?? "").toLowerCase().includes(q),
      );
    if (salaryTableMonthFilter) {
      const [y, m] = salaryTableMonthFilter.split("-").map(Number);
      const monthName = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ][(m || 1) - 1];
      list = list.filter(
        (s) => String(s.year) === String(y) && String(s.month) === monthName,
      );
    }
    return list;
  }, [salarySlips, salaryTableSearch, salaryTableMonthFilter]);

  const salarySlipsPaginated = useMemo(() => {
    const start = salaryTablePage * SALARY_TABLE_PAGE_SIZE;
    return salarySlipsFiltered.slice(start, start + SALARY_TABLE_PAGE_SIZE);
  }, [salarySlipsFiltered, salaryTablePage]);

  const salaryTotalThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return salarySlips
      .filter(
        (s) =>
          s.year === currentYear &&
          s.month ===
            [
              "January",
              "February",
              "March",
              "April",
              "May",
              "June",
              "July",
              "August",
              "September",
              "October",
              "November",
              "December",
            ][currentMonth],
      )
      .reduce((sum, s) => sum + (s.netSalary || 0), 0);
  }, [salarySlips]);

  const handleOpenGenerateDialog = useCallback(() => {
    setSalarySlipPrefill(null);
    setIsSalarySlipDialogOpen(true);
  }, []);
  const handleOpenGenerateAgain = useCallback((slip: any) => {
    setSalarySlipPrefill(slip);
    setIsSalarySlipDialogOpen(true);
  }, []);
  const SalarySlipsSection = (sectionProps: {
    onOpenGenerateDialog: () => void;
    onOpenGenerateAgain: (slip: any) => void;
  }) => {
    const { onOpenGenerateDialog, onOpenGenerateAgain } = sectionProps;
    const logoUrl =
      (typeof window !== "undefined" &&
        window.localStorage.getItem("branch_logo_url")) ||
      branchForm?.logoUrl ||
      cafeLogo;
    const companyNameFromSettings =
      branchForm?.name ||
      branch?.name ||
      (typeof window !== "undefined"
        ? window.localStorage.getItem("branch_name")
        : null) ||
      "Cafe Chapter 1 Restro Private Limited";
    const pdfBuildOpts = {
      logoUrl: String(logoUrl),
      companyName: companyNameFromSettings,
      companyAddress:
        branchForm?.location ?? branch?.location ?? "Gautam Nagar",
      companyPincode: branchForm?.pincode || branch?.pincode || "",
      phone: branchForm?.phone || "",
    };
    return (
      <div className="w-full min-w-0 space-y-6 overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <IndianRupee className="h-5 w-5 text-emerald-600 shrink-0" />
            <h2 className="text-xl font-bold truncate">Salary Slips</h2>
          </div>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenGenerateDialog();
            }}
            className="w-full sm:w-auto min-h-12 rounded-lg bg-gradient-to-r from-[#064E3B] to-[#047857] hover:opacity-90 text-white font-semibold shrink-0"
          >
            <IndianRupee className="h-5 w-5 mr-2" />
            Generate Salary Slip
          </Button>
        </div>

        {/* Analytics cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Salary Paid This Month
                </p>
                <p className="text-2xl font-bold text-emerald-700 mt-1">
                  {formatINR(salaryTotalThisMonth)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-100">
                <IndianRupee className="h-8 w-8 text-emerald-700" />
              </div>
            </div>
          </Card>
          <Card className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Payslips Generated
                </p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {salarySlipsFiltered.length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-100">
                <Users className="h-8 w-8 text-slate-600" />
              </div>
            </div>
          </Card>
        </div>

        <Card className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <CardHeader className="px-3 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg">Generated Slips</CardTitle>
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <Input
                  placeholder="Search employee..."
                  value={salaryTableSearch}
                  onChange={(e) => {
                    setSalaryTableSearch(e.target.value);
                    setSalaryTablePage(0);
                  }}
                  className="h-11 rounded-lg border border-slate-200 w-full min-w-0 sm:w-48 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                <input
                  type="month"
                  value={salaryTableMonthFilter}
                  onChange={(e) => {
                    setSalaryTableMonthFilter(e.target.value);
                    setSalaryTablePage(0);
                  }}
                  className="h-11 rounded-lg border border-slate-200 px-3 w-full sm:w-40 text-sm"
                  title="Filter by month"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-1 px-1">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="whitespace-nowrap">
                      Slip No.
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      Employee
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Month</TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      Net Salary
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salarySlipsPaginated.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {salarySlipsFiltered.length === 0
                          ? "No salary slips yet. Generate one above."
                          : "No results for this search or filter."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    salarySlipsPaginated.map((slip) => {
                      const rowBg = getSalarySlipMonthColor(slip);
                      return (
                        <TableRow
                          key={slip.id}
                          className="hover:opacity-95"
                          style={{ backgroundColor: rowBg }}
                        >
                          <TableCell className="font-mono text-xs">
                            {slip.salaryNumber ?? "—"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {slip.employee?.name ?? "—"}
                          </TableCell>
                          <TableCell>
                            {slip.month} {slip.year}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatINR(slip.netSalary)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                slip.status === "Sent"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : "bg-slate-100 text-slate-800"
                              }
                            >
                              {slip.status ?? "Paid"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="rounded-lg h-9 border-slate-300"
                                >
                                  <MoreHorizontal className="h-4 w-4 mr-1" />{" "}
                                  Actions
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => {
                                    const html = buildPayslipHtmlFromSlip(
                                      slip,
                                      pdfBuildOpts,
                                    );
                                    const w = window.open("", "_blank");
                                    if (w) {
                                      w.document.write(html);
                                      w.document.close();
                                      w.focus();
                                    }
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-2" /> View PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onOpenGenerateAgain(slip)}
                                >
                                  <RefreshCw className="h-4 w-4 mr-2" />{" "}
                                  Generate Again
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    const html = buildPayslipHtmlFromSlip(
                                      slip,
                                      pdfBuildOpts,
                                    );
                                    const w = window.open("", "_blank");
                                    if (w) {
                                      w.document.write(html);
                                      w.document.close();
                                      w.focus();
                                      setTimeout(() => {
                                        w.print();
                                        w.close();
                                      }, 400);
                                    }
                                  }}
                                >
                                  <Download className="h-4 w-4 mr-2" /> Download
                                  PDF
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {salarySlipsFiltered.length > SALARY_TABLE_PAGE_SIZE && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4 pt-4 border-t border-slate-200">
                <p className="text-sm text-muted-foreground order-2 sm:order-1 text-center sm:text-left">
                  Showing {salaryTablePage * SALARY_TABLE_PAGE_SIZE + 1}–
                  {Math.min(
                    (salaryTablePage + 1) * SALARY_TABLE_PAGE_SIZE,
                    salarySlipsFiltered.length,
                  )}{" "}
                  of {salarySlipsFiltered.length}
                </p>
                <div className="flex gap-2 justify-center sm:justify-end order-1 sm:order-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-9 flex-1 sm:flex-initial"
                    disabled={salaryTablePage === 0}
                    onClick={() => setSalaryTablePage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-9 flex-1 sm:flex-initial"
                    disabled={
                      (salaryTablePage + 1) * SALARY_TABLE_PAGE_SIZE >=
                      salarySlipsFiltered.length
                    }
                    onClick={() => setSalaryTablePage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // 10. CERTIFICATES SECTION (same layout as Salary Slips)
  const CertificatesSection = memo(() => (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Award className="h-5 w-5 text-emerald-600 shrink-0" />
          <h2 className="text-xl font-bold">Employee Certificates</h2>
        </div>
        <Button
          onClick={() => setIsCertificateDialogOpen(true)}
          className="w-full sm:w-auto min-h-12 rounded-lg bg-gradient-to-r from-[#064E3B] to-[#047857] hover:opacity-90 text-white font-semibold"
        >
          <Plus className="h-5 w-5 mr-2" />
          Generate Certificate
        </Button>
      </div>
      <Card className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Generated Certificates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-1 px-1">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="whitespace-nowrap">Employee</TableHead>
                  <TableHead className="whitespace-nowrap">
                    Certificate Name
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Type</TableHead>
                  <TableHead className="whitespace-nowrap">
                    Issue Date
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    Expiry Date
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    Download
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificates.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No certificates yet. Generate one above.
                    </TableCell>
                  </TableRow>
                ) : (
                  certificates.map((cert) => (
                    <TableRow key={cert.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium">
                        {cert.employee?.name ?? "—"}
                      </TableCell>
                      <TableCell>{cert.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {cert.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {cert.issueDate}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {cert.expiryDate || "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="rounded-lg h-9 bg-gradient-to-r from-[#064E3B] to-[#047857] hover:opacity-90 text-white"
                          onClick={() =>
                            toast({
                              title: "Download",
                              description:
                                "Certificate download in next update",
                            })
                          }
                        >
                          <Download className="h-4 w-4 mr-1" /> PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  ));

  // Certificate Dialog with local state to prevent re-renders
  const CertificateDialog = () => {
    const [localForm, setLocalForm] = useState({
      employeeId: 0,
      name: "",
      issueDate: new Date().toISOString().split("T")[0],
      expiryDate: "",
      type: "",
    });
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
      const employee = employees.find((e) => e.id === localForm.employeeId);
      if (!employee) return;

      setIsGenerating(true);

      // Simulate async generation
      setTimeout(() => {
        const newCertificate = {
          id: Date.now(),
          employee: { name: employee.name },
          name: localForm.name,
          type: localForm.type,
          issueDate: localForm.issueDate,
          expiryDate: localForm.expiryDate,
          createdAt: new Date().toISOString(),
        };

        setCertificates((prev) => [...prev, newCertificate]);
        setIsCertificateDialogOpen(false);
        setIsGenerating(false);

        toast({
          title: "Certificate generated",
          description: `${localForm.name} for ${employee.name}`,
        });
      }, 1000);
    };

    return (
      <Dialog
        open={isCertificateDialogOpen}
        onOpenChange={setIsCertificateDialogOpen}
      >
        <DialogContent
          className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6"
          aria-describedby="certificate-dialog-desc"
        >
          <DialogHeader>
            <DialogTitle>Generate Certificate</DialogTitle>
            <DialogDescription id="certificate-dialog-desc" className="sr-only">
              Choose employee, certificate name and type, then set issue and
              expiry dates.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Employee</Label>
              <Select
                value={String(localForm.employeeId)}
                onValueChange={(v) =>
                  setLocalForm({ ...localForm, employeeId: Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter(
                      (e) => String(e.status || "").toUpperCase() === "ACTIVE",
                    )
                    .map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Certificate Name</Label>
              <Input
                placeholder="e.g., Employee of the Month"
                value={localForm.name}
                onChange={(e) =>
                  setLocalForm({ ...localForm, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Certificate Type</Label>
              <Select
                value={localForm.type}
                onValueChange={(v) => setLocalForm({ ...localForm, type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="experience">
                    Experience Certificate
                  </SelectItem>
                  <SelectItem value="completion">
                    Completion Certificate
                  </SelectItem>
                  <SelectItem value="appreciation">
                    Appreciation Certificate
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Issue Date</Label>
                <Input
                  type="date"
                  value={localForm.issueDate}
                  onChange={(e) =>
                    setLocalForm({ ...localForm, issueDate: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Expiry Date (Optional)</Label>
                <Input
                  type="date"
                  value={localForm.expiryDate}
                  onChange={(e) =>
                    setLocalForm({ ...localForm, expiryDate: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCertificateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                "Generate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const currentSection = validSectionKeys.includes(activeSection)
    ? activeSection
    : "overview";

  // Memoize section body so cards/lists do NOT re-render when only clock or unrelated state updates
  const mainSectionContent = useMemo(() => {
    switch (currentSection) {
      case "overview":
        return <OverviewSection />;
      case "performance":
        return <PerformanceSection />;
      case "menu":
        return <MenuSection />;
      case "employees":
        return <EmployeesSection />;
      case "orders":
        return <OrdersSection />;
      case "customer-leaderboard":
        return <CustomerLeaderboardSection />;
      case "customer-queries":
        return <CustomerQueriesSection />;
      case "removed-items":
        return <RemovedItemsSection />;
      case "hours":
        return <WorkHoursSection />;
      case "overtime":
        return <OvertimeSection />;
      case "late":
        return <LateSection />;
      case "salary-slips":
        return (
          <SalarySlipsSection
            onOpenGenerateDialog={handleOpenGenerateDialog}
            onOpenGenerateAgain={handleOpenGenerateAgain}
          />
        );
      case "certificates":
        return <CertificatesSection />;
      case "settings":
        return (
          <SettingsSectionContent
            branchForm={branchForm}
            setBranchForm={setBranchForm}
            branch={branch}
            setBranch={setBranch}
            branches={branches}
            createBranchOpen={createBranchOpen}
            setCreateBranchOpen={setCreateBranchOpen}
            createBranchForm={createBranchForm}
            setCreateBranchForm={setCreateBranchForm}
            handleCreateBranch={handleCreateBranch}
            handleUpdateBranch={handleUpdateBranch}
            loadSettings={loadSettings}
            savingBranch={savingBranch}
            notifications={notifications}
            errorLogs={errorLogs}
            toast={toast}
            token={token}
            directorsData={directorsData}
            loadDirectors={loadDirectors}
          />
        );
      default:
        return <OverviewSection />;
    }
  }, [currentSection, ordersByTable, handleOpenOrderDialog, performanceSummary]);

  if (!authChecked || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Skeleton layout on first load only (after that, we use a blur overlay)
  if (loading && !hasLoadedOnce) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <header className="h-14 border-b bg-white shrink-0" />
        <div className="flex-1 flex gap-4 p-4">
          <aside className="w-56 rounded-lg bg-slate-200/60 animate-pulse shrink-0" />
          <main className="flex-1 space-y-4 min-w-0">
            <div className="h-8 w-56 rounded bg-slate-200/60 animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl bg-slate-200/60 animate-pulse"
                />
              ))}
            </div>
            <div className="h-80 rounded-xl bg-slate-200/60 animate-pulse" />
          </main>
        </div>
      </div>
    );
  }

  const displayBranchName = (() => {
    const n = branch?.name?.trim();
    if (!n || n.toLowerCase() === "main branch" || n.toLowerCase() === "main")
      return "Gautam Nagar";
    return n;
  })();

  return (
    <DashboardShell
      role="ADMIN"
      userName={profile?.name ?? "Admin"}
      branchName={displayBranchName}
      sidebarSections={adminSidebarSections}
      activeKey={currentSection}
      onSelect={(key) =>
        validSectionKeys.includes(key) && setActiveSection(key)
      }
      notifications={notifications}
      notificationCount={notifications.filter((n: any) => !n.read).length}
      sidebarBadges={{
        "customer-queries": pendingQueriesCount,
        ...(overtimeSummary.pendingOvertimeCount +
          overtimeSummary.overtimeRunningCount >
        0
          ? {
              overtime:
                overtimeSummary.pendingOvertimeCount +
                overtimeSummary.overtimeRunningCount,
            }
          : {}),
      }}
      onNotificationsOpenChange={(open) => {
        if (open)
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }}
      onClearAllNotifications={async () => {
        setNotifications([]);
        try {
          localStorage.setItem(
            "dm_notifications_cleared_at",
            String(Date.now()),
          );
        } catch (_) {}
        if (token) {
          try {
            await fetch(`${apiBase}/notifications/mark-all-read`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
          } catch (_) {}
        }
      }}
    >
      <div className="w-full min-h-full space-y-4 pb-6 relative overflow-x-hidden max-w-full px-0 sm:px-0">
        {loading && hasLoadedOnce && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-xl bg-white/80 px-5 py-4 shadow-lg border border-slate-200">
              <div className="h-8 w-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-600">Loading data…</p>
            </div>
          </div>
        )}
        {mainSectionContent}
      </div>

      {/* Order Details Dialog – top level so it opens when order card is clicked from Orders section */}
      <Dialog
        open={isOrderDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPopupDisplayOrder(null);
            setSelectedOrder(null);
          }
          setIsOrderDialogOpen(open);
        }}
      >
        <DialogContent
          className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6"
          aria-describedby="order-details-desc"
        >
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg truncate pr-8">
              Order Details #{selectedOrder?.id ?? popupDisplayOrder?.id}
            </DialogTitle>
            <DialogDescription id="order-details-desc" className="sr-only">
              View order items, total, and payment status.
            </DialogDescription>
          </DialogHeader>
          {(selectedOrder || popupDisplayOrder) &&
            (() => {
              const displayOrder = popupDisplayOrder ?? selectedOrder!;
              const tableLabel =
                (displayOrder as any).table?.tableNumber ??
                displayOrder.tableNumber ??
                displayOrder.tableId ??
                "—";
              const items = Array.isArray(displayOrder.items)
                ? displayOrder.items
                : [];
              return (
                <div className="space-y-4 py-2 sm:py-4 min-w-0">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">Table</p>
                      <p className="font-medium truncate">Table {tableLabel}</p>
                    </div>
                    <div className="text-left sm:text-right min-w-0">
                      <p className="text-sm text-muted-foreground">Time</p>
                      <p className="font-medium text-sm sm:text-base break-words">
                        {new Date(displayOrder.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {(displayOrder.employee || displayOrder.branch) && (
                    <div className="text-sm text-muted-foreground space-y-1 min-w-0 break-words">
                      {displayOrder.branch?.name && (
                        <p>Branch: {displayOrder.branch.name}</p>
                      )}
                      {displayOrder.employee && (
                        <p>
                          Accepted by:{" "}
                          <span className="font-medium text-foreground">
                            {displayOrder.employee.name}
                          </span>
                          {displayOrder.employee.role
                            ? ` (${displayOrder.employee.role})`
                            : displayOrder.employee.employeeCode
                              ? ` (${displayOrder.employee.employeeCode})`
                              : ""}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        displayOrder.status === "ORDER_COMPLETE"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {displayOrder.status}
                    </Badge>
                    <Badge
                      variant={
                        displayOrder.paymentStatus === "PAID"
                          ? "default"
                          : "secondary"
                      }
                      className={
                        displayOrder.paymentStatus === "PAID"
                          ? "bg-green-100 text-green-700"
                          : ""
                      }
                    >
                      {displayOrder.paymentStatus}
                    </Badge>
                  </div>

                  <div className="border rounded-lg overflow-x-auto min-w-0">
                    <Table className="min-w-[280px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Item</TableHead>
                          <TableHead className="text-xs text-right">
                            Qty
                          </TableHead>
                          <TableHead className="text-xs text-right">
                            Price
                          </TableHead>
                          <TableHead className="text-xs text-right">
                            Total
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item: OrderItem) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-sm">
                              {formatItemDisplayName(item.name, item.variant)}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatINR(item.price)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatINR(item.price * item.quantity)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
                    <p className="text-lg font-bold">Total Amount</p>
                    <p className="text-xl font-bold text-emerald-600">
                      {formatINR(displayOrder.totalAmount)}
                    </p>
                  </div>

                  {displayOrder.status !== "ORDER_COMPLETE" &&
                    selectedOrder && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={completingOrderId === selectedOrder?.id}
                          onClick={() =>
                            handleUpdateOrderStatus(
                              selectedOrder.id,
                              "ORDER_COMPLETE",
                            )
                          }
                        >
                          {completingOrderId === selectedOrder?.id ? (
                            <>
                              <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                              Completing...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Mark Complete
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Menu Item Dialog */}
      <Dialog
        open={isItemDialogOpen}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
          setIsItemDialogOpen(open);
        }}
      >
        <DialogContent
          className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6"
          aria-describedby="menu-item-dialog-desc"
        >
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add Item"}</DialogTitle>
            <DialogDescription id="menu-item-dialog-desc" className="sr-only">
              Enter item name, price, category, and optional description.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                placeholder="Item name"
                value={itemForm.name}
                onChange={(e) =>
                  setItemForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder="Description"
                value={itemForm.description}
                onChange={(e) =>
                  setItemForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Full Price (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={itemForm.basePrice || ""}
                  onChange={(e) =>
                    setItemForm((f) => ({
                      ...f,
                      basePrice: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Half Price (₹, optional)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={itemForm.halfPrice || ""}
                  onChange={(e) =>
                    setItemForm((f) => ({
                      ...f,
                      halfPrice: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="hasHalf"
                checked={itemForm.hasHalf}
                onCheckedChange={(c) =>
                  setItemForm((f) => ({ ...f, hasHalf: !!c }))
                }
              />
              <Label htmlFor="hasHalf">Has half portion</Label>
            </div>
            <div className="grid gap-2">
              <Label>Image URL (optional)</Label>
              <Input
                placeholder="https://..."
                value={itemForm.imageUrl}
                onChange={(e) =>
                  setItemForm((f) => ({ ...f, imageUrl: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                checked={itemForm.isActive}
                onCheckedChange={(c) =>
                  setItemForm((f) => ({ ...f, isActive: !!c }))
                }
              />
              <Label htmlFor="isActive">Active (visible on menu)</Label>
            </div>
            {!editingItem && (
              <div className="flex items-center gap-2 rounded-lg border p-3 bg-amber-50/50">
                <Checkbox
                  id="notifyCustomers"
                  checked={itemForm.notifyCustomers}
                  onCheckedChange={(c) =>
                    setItemForm((f) => ({ ...f, notifyCustomers: !!c }))
                  }
                />
                <Label
                  htmlFor="notifyCustomers"
                  className="text-sm font-medium"
                >
                  Notify customers about this new launch (broadcast to all saved
                  mobiles)
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingItem(null);
                setIsItemDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            {editingItem ? (
              <Button onClick={handleUpdateItem}>Update</Button>
            ) : (
              <Button
                onClick={handleCreateItem}
                disabled={!itemForm.name.trim() || itemForm.basePrice <= 0}
              >
                Create
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Branch Dialog */}
      <Dialog open={createBranchOpen} onOpenChange={setCreateBranchOpen}>
        <DialogContent
          className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6"
          aria-describedby="create-branch-desc"
        >
          <DialogHeader>
            <DialogTitle>Create Branch</DialogTitle>
            <DialogDescription id="create-branch-desc" className="sr-only">
              Enter branch name, location, and contact details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Branch Name *</Label>
              <Input
                placeholder="e.g. Patna Branch"
                value={createBranchForm.name}
                onChange={(e) =>
                  setCreateBranchForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Location</Label>
              <Input
                placeholder="Address"
                value={createBranchForm.location}
                onChange={(e) =>
                  setCreateBranchForm((f) => ({
                    ...f,
                    location: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Phone (for Call/WhatsApp)</Label>
              <Input
                placeholder="10-digit"
                value={createBranchForm.phone}
                onChange={(e) =>
                  setCreateBranchForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Logo URL</Label>
              <Input
                placeholder="https://..."
                value={createBranchForm.logoUrl}
                onChange={(e) =>
                  setCreateBranchForm((f) => ({
                    ...f,
                    logoUrl: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Google Review URL</Label>
              <Input
                placeholder="https://..."
                value={createBranchForm.googleReviewUrl}
                onChange={(e) =>
                  setCreateBranchForm((f) => ({
                    ...f,
                    googleReviewUrl: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateBranchOpen(false)}
              disabled={savingBranch}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBranch}
              disabled={savingBranch || !createBranchForm.name.trim()}
            >
              {savingBranch ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Employee – send login credentials */}
      <Dialog
        open={!!employeeToVerify}
        onOpenChange={(open) => !open && setEmployeeToVerify(null)}
      >
        <DialogContent
          className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6"
          aria-describedby="verify-employee-desc"
        >
          <DialogHeader>
            <DialogTitle>Verify Employee?</DialogTitle>
            <DialogDescription id="verify-employee-desc">
              {employeeToVerify
                ? `${employeeToVerify.name} will receive login credentials (temporary password) via email. They can then log in and change their password.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEmployeeToVerify(null)}
              disabled={!!verifyingEmployeeId}
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerifyAndSendInvite}
              disabled={!!verifyingEmployeeId}
            >
              {verifyingEmployeeId ? (
                <>
                  <span
                    className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"
                    aria-hidden
                  />
                  Sending invite…
                </>
              ) : (
                "Send Invite"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change password (admin) – director(s) receive email with new password */}
      <ChangePasswordDialog
        open={!!employeeToChangePassword}
        employee={employeeToChangePassword}
        onOpenChange={(open) => {
          if (!open) {
            setEmployeeToChangePassword(null);
          }
        }}
        onSuccess={() => {
          setEmployeeToChangePassword(null);
        }}
        token={token}
        loading={changingPasswordEmployeeId !== null}
        setLoading={(id) => setChangingPasswordEmployeeId(id)}
      />

      {/* Dialogs - rendered at dashboard level so they do not remount when section re-renders (no flash on type) */}
      <AddEmployeeDialog
        open={isEmployeeDialogOpen}
        onOpenChange={setIsEmployeeDialogOpen}
        branches={branches}
        onCreated={(emp) => {
          setEmployees((prev) => [...prev, emp as Employee]);
          setIsEmployeeDialogOpen(false);
        }}
        onGoToSettings={() => {
          setIsEmployeeDialogOpen(false);
          setActiveSection("settings");
          setCreateBranchOpen(true);
        }}
        token={token}
      />
      <EditEmployeeDialog
        open={!!editingEmployee}
        employee={editingEmployee}
        onOpenChange={(open) => !open && setEditingEmployee(null)}
        onSaved={(emp) => {
          setEmployees((prev) =>
            prev.map((e) => (e.id === emp.id ? { ...e, ...emp } : e)),
          );
          setEditingEmployee(null);
        }}
        token={token}
      />
      <SalarySlipDialogModule
        key={
          isSalarySlipDialogOpen ? "salary-dialog-open" : "salary-dialog-closed"
        }
        open={isSalarySlipDialogOpen}
        onOpenChange={(open) => {
          setIsSalarySlipDialogOpen(open);
          if (!open) setSalarySlipPrefill(null);
        }}
        employees={employees}
        branch={branch}
        branchForm={branchForm}
        salarySlips={salarySlips}
        setSalarySlips={setSalarySlips}
        cafeLogo={cafeLogo}
        prefillSlip={salarySlipPrefill}
        token={token}
      />
      <CertificateDialog />
    </DashboardShell>
  );
};

export default AdminDashboard;
