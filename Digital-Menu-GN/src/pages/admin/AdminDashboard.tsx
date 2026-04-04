import { useEffect, useState, useMemo, useCallback, memo, useRef } from 'react';
import React from 'react';
import { io, type Socket } from 'socket.io-client';
import DashboardShell from '@/components/dashboard/DashboardShell';
import MonthlyTargetSetup from '@/components/MonthlyTargetSetup';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { PageLoader, InlineLoader, LoadingButton } from '@/components/shared';
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
  Info,
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
  Copy,
} from 'lucide-react';
import { useGlobalLoading } from '@/components/GlobalLoadingProvider';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoaderButton, StatusBadge } from '@/components/shared';
import {
  API_BASE_URL,
  API_TIMEOUT_MS,
  describeFetchFailure,
  fetchWithTimeout,
  fetchWithTimeoutRetry,
  readApiErrorMessage,
  BREAK_TIME_MINUTES,
  formatBreakTime,
  EMPLOYEE_STATUS_FILTER_OPTIONS,
  MENU_CATEGORY_FILTER_OPTIONS,
  MENU_SORT_OPTIONS,
  STATUS_BUTTON_ACTIVE,
} from '@/constants';
import { formatHours } from '@/utils/timeFormatter';
import { calculateLate } from '@/utils/lateCalculator';
import { getBusinessDateString } from '@/utils/businessDate';
import cafeLogo from '@/assets/logo.png';

const apiBase = API_BASE_URL;

// Payslip brand colors (Cafe Chapter 1)
const PAYSLIP_COFFEE = '#6B3E26';
const PAYSLIP_LATTE = '#C9A27E';
const PAYSLIP_GREEN = '#2E7D32';

// Salary slip dialog – module-level constants (used by SalarySlipDialog to avoid re-creation/flash)
const SALARY_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
// 12 predefined colors for month-wise salary slip rows (Jan–Dec)
const SALARY_MONTH_COLORS = [
  '#FEF3C7',
  '#FCE7F3',
  '#DBEAFE',
  '#D1FAE5',
  '#E0E7FF',
  '#FFEDD5',
  '#FEE2E2',
  '#E5E7EB',
  '#F3E8FF',
  '#CCFBF1',
  '#FEF9C3',
  '#E2E8F0',
];
const SALARY_CARD_CLASS =
  'rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md';
const SALARY_INPUT_CLASS =
  'h-11 rounded-lg border border-slate-200 px-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none';

function monthNumberToName(month: number | null | undefined): string | undefined {
  if (month == null) return undefined;
  const idx = Number(month) - 1;
  return idx >= 0 && idx < SALARY_MONTH_NAMES.length ? SALARY_MONTH_NAMES[idx] : undefined;
}

function getNextSalaryNumberModule(
  existingSlips: { salaryNumber?: string; month?: string; year?: number }[],
  payYear: number,
  payMonthName: string
): string {
  const mm = String(SALARY_MONTH_NAMES.indexOf(payMonthName) + 1).padStart(2, '0');
  const prefix = `CC1/${mm}/${payYear}/`;
  const existingForMonth = existingSlips.filter(
    s => s.year === payYear && s.month === payMonthName
  );
  let maxSeq = 0;
  for (const s of existingForMonth) {
    const sn = s.salaryNumber;
    if (!sn || !sn.startsWith(prefix)) continue;
    const num = parseInt(sn.slice(prefix.length), 10);
    if (!isNaN(num)) maxSeq = Math.max(maxSeq, num);
  }
  return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;
}

/** Get background color for a salary slip row by month (0–11 => Jan–Dec). */
function getSalarySlipMonthColor(slip: { month?: string; year?: number }): string {
  const idx = SALARY_MONTH_NAMES.indexOf(slip.month ?? '');
  return idx >= 0 && idx < SALARY_MONTH_COLORS.length ? SALARY_MONTH_COLORS[idx] : '#ffffff';
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
  }
): string {
  const payMonthName = slip.month ?? 'January';
  const payYear = slip.year ?? new Date().getFullYear();
  const payDate = slip.createdAt
    ? new Date(slip.createdAt).toISOString().split('T')[0]
    : `${payYear}-${String(SALARY_MONTH_NAMES.indexOf(payMonthName) + 1).padStart(2, '0')}-01`;
  const mm = String(SALARY_MONTH_NAMES.indexOf(payMonthName) + 1).padStart(2, '0');
  const payPeriodLabel = `${mm} - ${payMonthName} ${payYear}`;
  const allowanceRows = (slip.allowances ?? []).map(r => ({
    name: r.name ?? '',
    amount: Number(r.amount) || 0,
  }));
  const deductionRows = (slip.deductions ?? []).map(r => ({
    name: r.name ?? '',
    amount: Number(r.amount) || 0,
  }));
  const basicSalary = Number(slip.basicSalary) || 0;
  const totalAllowances = allowanceRows.reduce((s, r) => s + r.amount, 0);
  const totalDeductions = deductionRows.reduce((s, r) => s + r.amount, 0);
  const grossEarnings = basicSalary + totalAllowances;
  const netSalary =
    slip.netSalary != null ? Number(slip.netSalary) : grossEarnings - totalDeductions;
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
    paidDays: slip.paidDays != null ? Number(slip.paidDays) : 22,
    lopDays: slip.lopDays != null ? Number(slip.lopDays) : 0,
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
    data.companyAddress + (data.companyPincode ? `, ${data.companyPincode}` : '') + ', India';
  const rows = (arr: { name: string; amount: number }[]) =>
    arr
      .map(
        r =>
          `<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${r.name || '—'}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right">₹${r.amount || 0}</td></tr>`
      )
      .join('');
  const slipNoRow = data.salaryNumber
    ? `<p style="margin:4px 0"><strong>Salary Slip No.:</strong> ${data.salaryNumber}</p>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Salary Slip</title><style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#fff}.watermark{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0.06;z-index:0}.watermark img{max-width:90%;max-height:90%;object-fit:contain}.main{position:relative;z-index:1}table{width:100%;border-collapse:collapse;margin:16px 0}.th{background:#f1f5f9;padding:8px;text-align:left;font-weight:600}.th-r{text-align:right}.net{border-top:2px solid #047857;margin-top:16px;padding-top:12px;font-size:18px;font-weight:700;color:#047857}</style></head><body><div class="watermark"><img src="${data.logoUrl}" alt="" /></div><div class="main"><div style="border-bottom:2px solid #e2e8f0;padding-bottom:16px;margin-bottom:16px"><img src="${data.logoUrl}" alt="" style="height:64px;margin-bottom:8px" /><p style="font-weight:700;font-size:18px;margin:0">${data.companyName}</p><p style="color:#475569;font-size:14px;margin:4px 0">${addr}</p>${data.phone ? `<p style="font-size:12px;color:#64748b">Ph: ${data.phone}</p>` : ''}<p style="font-weight:600;margin-top:12px">Salary Slip — ${data.payMonthName} ${data.payYear}</p></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-bottom:16px;font-size:14px">${slipNoRow}<p style="margin:4px 0"><strong>Employee Name:</strong> ${data.selectedEmployee?.name ?? '—'}</p><p style="margin:4px 0"><strong>Employee ID:</strong> ${data.selectedEmployee?.employeeCode ?? '—'}</p><p style="margin:4px 0"><strong>Pay Period:</strong> ${data.payPeriodLabel}</p><p style="margin:4px 0"><strong>Pay Date:</strong> ${data.payDate}</p><p style="margin:4px 0"><strong>Paid Days:</strong> ${data.paidDays}</p><p style="margin:4px 0"><strong>LOP Days:</strong> ${data.lopDays}</p></div><table><thead><tr><th class="th">Earnings</th><th class="th th-r">Amount (₹)</th></tr></thead><tbody><tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">Basic Salary</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right">₹${data.basicSalary}</td></tr>${rows(data.allowanceRows)}</tbody></table><table><thead><tr><th class="th">Deductions</th><th class="th th-r">Amount (₹)</th></tr></thead><tbody>${rows(data.deductionRows)}</tbody></table><div class="net"><p style="display:flex;justify-content:space-between;margin:4px 0"><span>Gross Salary</span><span>₹${data.grossEarnings}</span></p><p style="display:flex;justify-content:space-between;margin:4px 0"><span>Total Deductions</span><span>₹${data.totalDeductions}</span></p><p style="display:flex;justify-content:space-between;margin-top:8px;font-size:18px"><span>Net Salary</span><span>₹${data.netSalary}</span></p></div><p style="text-align:center;font-size:12px;color:#64748b;margin-top:32px">Authorized Signature — ${data.companyName}</p></div></body></html>`;
}

// Types
type MenuCategory = {
  id: number;
  name: string;
  slug?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt?: string;
  highlightNewUntil?: string | null;
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
  highlightNewUntil?: string | null;
};

type Employee = {
  id: number;
  name: string;
  email: string;
  employeeCode: string;
  role?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'LEFT';
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
  orderType?: 'DINE_IN' | 'TAKE_AWAY' | null;
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
  acceptedAt?: string | null;
  completedAt?: string | null;
  customerName?: string | null;
  customerMobile?: string | null;
  table?: { id: number; tableNumber: string } | null;
  items: OrderItem[];
};

type OrderItem = {
  id: number;
  name: string;
  quantity: number;
  price: number;
  variant?: string;
  isRemoved?: boolean;
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
  status: 'ACTIVE' | 'INACTIVE' | 'LEFT';
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
const formatItemDisplayName = (name: string, variant?: string | null): string => {
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
};

const formatINR = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

type NewOrderSoundPreset = 'beep' | 'ring' | 'siren' | 'chime';
type BranchFormState = {
  name: string;
  location: string;
  timezone: string;
  logoUrl: string;
  phone: string;
  googleReviewUrl: string;
  pincode: string;
  directorsEmail: string;
  showTotalAmountToCustomers: boolean;
  enableNewOrderRinging?: boolean;
  newOrderSoundPreset?: NewOrderSoundPreset;
  newOrderSoundVolume?: number;
};

// Memoized order row: one row per order, green when completed
const AdminOrderRow = memo(function AdminOrderRow({
  order,
  onSelect,
  now,
}: {
  order: Order;
  onSelect: (order: Order) => void;
  now: Date;
}) {
  const isComplete = order.status === 'ORDER_COMPLETE';
  const relativeAge = useMemo(() => {
    const sec = Math.floor((now.getTime() - new Date(order.createdAt).getTime()) / 1000);
    if (sec < 60) return 'Just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} min ago`;
    return `${Math.floor(min / 60)} hr ago`;
  }, [now, order.createdAt]);

  return (
    <div
      className={`card-gpu cursor-pointer border-l-4 p-3 transition-[background-color] duration-150 ${
        isComplete
          ? 'border-l-green-600 bg-green-50/70 hover:bg-green-50'
          : 'border-l-transparent hover:bg-slate-50'
      }`}
      onClick={() => onSelect(order)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-medium">Order #{order.id}</p>
            {order.orderType && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${order.orderType === 'TAKE_AWAY' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}
              >
                {order.orderType === 'TAKE_AWAY' ? 'Take Away' : 'Dine In'}
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            {new Date(order.createdAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {' · '}
            {relativeAge}
          </p>
          {order.customerName && (
            <p className="truncate text-xs font-medium text-emerald-700">{order.customerName}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <Badge
            variant={isComplete ? 'default' : 'secondary'}
            className={`mb-1 text-xs ${isComplete ? 'bg-green-600 hover:bg-green-700' : ''}`}
          >
            {order.status === 'ORDER_COMPLETE' ? 'Completed' : order.status.replace('_', ' ')}
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
    title: 'Dashboard',
    items: [
      { key: 'overview', label: 'Overview', icon: LayoutDashboard },
      { key: 'performance', label: 'Performance', icon: Activity },
    ] as SidebarItem[],
  },
  {
    title: 'Operations',
    items: [
      { key: 'all-orders', label: 'All Orders', icon: ShoppingCart },
      { key: 'menu', label: 'Menu', icon: ChefHat },
      {
        key: 'customer-leaderboard',
        label: 'Customer Leaderboard',
        icon: Trophy,
      },
      { key: 'removed-items', label: 'Removed Items', icon: Trash2 },
      {
        key: 'customer-queries',
        label: 'Raised Requests',
        icon: MessageCircle,
      },
    ] as SidebarItem[],
  },
  {
    title: 'Staff',
    items: [
      { key: 'employees', label: 'Employees', icon: Users },
      { key: 'hours', label: 'Work Hours', icon: Clock },
      { key: 'overtime', label: 'Overtime', icon: AlertCircle },
      { key: 'late', label: 'Late Entries', icon: Clock },
      { key: 'leaves', label: 'Leave Requests', icon: FileText },
      { key: 'certificates', label: 'Certificates', icon: Award },
    ] as SidebarItem[],
  },
  {
    title: 'Finance',
    items: [
      { key: 'revenue', label: 'Revenue', icon: BarChart3 },
      { key: 'salary-slips', label: 'Salary Slips', icon: IndianRupee },
    ] as SidebarItem[],
  },
  {
    title: 'System',
    items: [{ key: 'settings', label: 'Settings', icon: Settings }] as SidebarItem[],
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
    enableNewOrderRinging?: boolean;
    newOrderSoundPreset?: 'beep' | 'ring' | 'siren' | 'chime';
    newOrderSoundVolume?: number;
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
      enableNewOrderRinging?: boolean;
      newOrderSoundPreset?: 'beep' | 'ring' | 'siren' | 'chime';
      newOrderSoundVolume?: number;
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
    enableNewOrderRinging?: boolean;
    newOrderSoundPreset?: 'beep' | 'ring' | 'siren' | 'chime';
    newOrderSoundVolume?: number;
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
      enableNewOrderRinging?: boolean;
      newOrderSoundPreset?: 'beep' | 'ring' | 'siren' | 'chime';
      newOrderSoundVolume?: number;
    }>
  >;
  handleCreateBranch: () => Promise<void>;
  handleUpdateBranch: () => Promise<void>;
  handleDeleteBranch: (id: number) => Promise<void>;
  loadSettings: () => Promise<void>;
  savingBranch: boolean;
  notifications: any[];
  errorLogs: { logs: any[]; unresolvedCount: number };
  toast: (p: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
  token: string | null;
  directorsData: {
    verified: string[];
    pendingVerification: { email: string; expiresAt: string }[];
    pendingRemoval: { email: string; expiresAt: string }[];
  } | null;
  loadDirectors: () => Promise<void>;
  branchesListUnavailable: boolean;
};
function parseDirectorEmails(s: string): string[] {
  const arr = (s || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
  return arr.length ? arr : [''];
}

const SettingsSectionContent = memo(function SettingsSectionContent(
  props: SettingsSectionContentProps
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
    handleDeleteBranch,
    loadSettings,
    savingBranch,
    notifications,
    errorLogs,
    toast,
    token,
    directorsData,
    loadDirectors,
    branchesListUnavailable,
  } = props;
  const [newDirectorEmail, setNewDirectorEmail] = useState('');
  const [sendingVerify, setSendingVerify] = useState(false);
  const [sendingRemove, setSendingRemove] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [orderNotificationsEnabled, setOrderNotificationsEnabled] = useState(true);
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [savingSystemPrefs, setSavingSystemPrefs] = useState(false);
  const branchId = branch?.id ?? branches[0]?.id;

  useEffect(() => {
    try {
      const on = window.localStorage.getItem('dm_admin_order_notifications');
      const sound = window.localStorage.getItem('dm_admin_sound_alerts');
      const auto = window.localStorage.getItem('dm_admin_auto_refresh');
      if (on !== null) setOrderNotificationsEnabled(on === 'true');
      if (sound !== null) setSoundAlertsEnabled(sound === 'true');
      if (auto !== null) setAutoRefreshEnabled(auto === 'true');
    } catch {
      // ignore (storage blocked)
    }
  }, []);

  return (
    <div className="min-w-0 space-y-6">
      <div className="min-w-0">
        <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">System Settings</h2>
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
              <Plus className="mr-1 h-4 w-4" />
              Create Branch
            </Button>
          </div>
          <CardDescription>
            Manage branches. Assign employees to a branch when creating them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {branches.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {branchesListUnavailable
                ? 'List could not be loaded from the server. Use “Retry loading” on the banner at the top, or try again in a minute.'
                : 'No branches yet. Tap “Create Branch” above to add your first location.'}
            </p>
          ) : (
            <div className="space-y-2">
              {branches.map(b => (
                <div
                  key={b.id}
                  className="flex min-w-0 flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="min-w-0 truncate font-medium">{b.name}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full shrink-0 sm:w-auto"
                      onClick={() => {
                        setBranchForm({
                          name: b.name,
                          location: b.location || '',
                          timezone: b.timezone || 'Asia/Kolkata',
                          logoUrl: b.logoUrl || '',
                          phone: b.phone || '',
                          googleReviewUrl: b.googleReviewUrl || '',
                          pincode: b.pincode || '',
                          directorsEmail: b.directorsEmail || '',
                          showTotalAmountToCustomers:
                            typeof (b as any).showTotalAmountToCustomers === 'boolean'
                              ? (b as any).showTotalAmountToCustomers
                              : true,
                          enableNewOrderRinging:
                            typeof (b as any).enableNewOrderRinging === 'boolean'
                              ? (b as any).enableNewOrderRinging
                              : true,
                          newOrderSoundPreset: (b as any).newOrderSoundPreset || 'ring',
                          newOrderSoundVolume:
                            typeof (b as any).newOrderSoundVolume === 'number'
                              ? (b as any).newOrderSoundVolume
                              : 1,
                        });
                        setBranch(b);
                      }}
                    >
                      Edit in Branch Settings
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700 sm:w-auto"
                      onClick={() => handleDeleteBranch(b.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
              : 'Select a branch above to edit its settings, then save.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Restaurant Name (shown on Salary Slip &amp; Certificates)</Label>
              <Input
                placeholder="Enter restaurant / company name"
                value={branchForm.name ?? ''}
                onChange={e => setBranchForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Location</Label>
              <Input
                placeholder="Enter location"
                value={branchForm.location}
                onChange={e =>
                  setBranchForm(prev => ({
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
                onValueChange={value => setBranchForm(prev => ({ ...prev, timezone: value }))}
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
              <Label>Contact Phone (for Call / WhatsApp on customer menu)</Label>
              <Input
                placeholder="10-digit number"
                value={branchForm.phone}
                onChange={e =>
                  setBranchForm(prev => ({
                    ...prev,
                    phone: e.target.value.replace(/\D/g, '').slice(0, 10),
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Logo URL</Label>
              <Input
                placeholder="Enter logo URL"
                value={branchForm.logoUrl}
                onChange={e =>
                  setBranchForm(prev => ({
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
                onChange={e =>
                  setBranchForm(prev => ({
                    ...prev,
                    pincode: e.target.value.replace(/\D/g, '').slice(0, 6),
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Directors Email (salary slip copies)</Label>
              <p className="text-muted-foreground text-xs">
                Each director must verify their email. To remove, a confirmation email is sent—they
                are removed only when they click &quot;Yes&quot; in that email.
              </p>
              {!branchId ? (
                <p className="text-sm text-amber-700">Select a branch above to manage directors.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {directorsData?.verified?.map(email => (
                      <div
                        key={email}
                        className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-2"
                      >
                        <Mail className="text-muted-foreground h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate font-medium">{email}</span>
                        <Badge className="shrink-0 border-emerald-200 bg-emerald-100 text-emerald-800">
                          Verified
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={sendingRemove === email}
                          onClick={async () => {
                            setSendingRemove(email);
                            try {
                              const res = await fetch(
                                `${apiBase}/branches/${branchId}/directors/request-remove`,
                                {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${token}`,
                                  },
                                  body: JSON.stringify({ email }),
                                }
                              );
                              const data = await res.json().catch(() => ({}));
                              if (res.ok) {
                                toast({
                                  title: 'Email sent',
                                  description:
                                    'Director will receive a link to confirm removal. They are removed only after they click Yes.',
                                });
                                await loadDirectors();
                              } else {
                                toast({
                                  title: 'Error',
                                  description:
                                    (data as { message?: string }).message ||
                                    'Failed to send removal email',
                                  variant: 'destructive',
                                });
                              }
                            } catch {
                              toast({
                                title: 'Error',
                                description: 'Failed to send removal email',
                                variant: 'destructive',
                              });
                            } finally {
                              setSendingRemove(null);
                            }
                          }}
                        >
                          {sendingRemove === email ? 'Sending…' : 'Remove'}
                        </Button>
                      </div>
                    ))}
                    {directorsData?.pendingVerification?.map(p => (
                      <div
                        key={p.email}
                        className="flex flex-wrap items-center gap-2 rounded-lg border bg-amber-50/50 p-2"
                      >
                        <Mail className="text-muted-foreground h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate font-medium">{p.email}</span>
                        <Badge className="shrink-0 border-amber-200 bg-amber-100 text-amber-800">
                          Pending verification
                        </Badge>
                      </div>
                    ))}
                    {directorsData?.pendingRemoval?.map(p => (
                      <div
                        key={p.email}
                        className="flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 p-2"
                      >
                        <Mail className="text-muted-foreground h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate font-medium">{p.email}</span>
                        <Badge variant="secondary" className="shrink-0">
                          Removal requested – waiting for director to confirm
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                    <Input
                      type="email"
                      placeholder="Type email(s) and tap + Add (comma/space separated)"
                      value={newDirectorEmail}
                      onChange={e => setNewDirectorEmail(e.target.value)}
                      className="min-w-0 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 min-w-[92px] shrink-0 gap-1 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                      disabled={sendingVerify || !newDirectorEmail.trim() || !branchId}
                      onClick={async () => {
                        const raw = newDirectorEmail.trim();
                        if (!raw) return;
                        const emails = Array.from(
                          new Set(
                            raw
                              .split(/[,\s]+/g)
                              .map(x => x.trim())
                              .filter(Boolean)
                          )
                        );
                        if (emails.length === 0) return;
                        setSendingVerify(true);
                        try {
                          const results = await Promise.all(
                            emails.map(async email => {
                              const res = await fetch(
                                `${apiBase}/branches/${branchId}/directors/request-verify`,
                                {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${token}`,
                                  },
                                  body: JSON.stringify({ email }),
                                }
                              );
                              const data = await res.json().catch(() => ({}));
                              return { email, ok: res.ok, message: (data as any)?.message };
                            })
                          );
                          const okCount = results.filter(r => r.ok).length;
                          const fail = results.filter(r => !r.ok);
                          if (okCount > 0) {
                            toast({
                              title:
                                okCount === 1
                                  ? 'Verification email sent'
                                  : 'Verification emails sent',
                              description:
                                okCount === 1
                                  ? 'Director must click the link in the email to be added.'
                                  : `${okCount} director(s) will receive a verification email. They must click the link to be added.`,
                            });
                          }
                          if (fail.length > 0) {
                            toast({
                              title: 'Some emails failed',
                              description:
                                fail
                                  .slice(0, 3)
                                  .map(f => `${f.email}: ${f.message || 'Failed'}`)
                                  .join(' | ') +
                                (fail.length > 3 ? ` | +${fail.length - 3} more` : ''),
                              variant: 'destructive',
                            });
                          }
                          setNewDirectorEmail('');
                          await loadDirectors();
                        } catch {
                          toast({
                            title: 'Error',
                            description: 'Failed to send verification email',
                            variant: 'destructive',
                          });
                        } finally {
                          setSendingVerify(false);
                        }
                      }}
                    >
                      {sendingVerify ? 'Adding…' : '+ Add'}
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
                onChange={e =>
                  setBranchForm(prev => ({
                    ...prev,
                    googleReviewUrl: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <div className="space-y-0.5 pr-4">
                <Label className="text-sm">Show total amount to customers</Label>
                <p className="text-muted-foreground text-xs">
                  Controls whether the customer menu/checkout displays the order total
                </p>
              </div>
              <Switch
                checked={!!branchForm.showTotalAmountToCustomers}
                onCheckedChange={checked =>
                  setBranchForm(prev => ({
                    ...prev,
                    showTotalAmountToCustomers: !!checked,
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <div className="space-y-0.5 pr-4">
                <Label className="text-sm">New order ringing</Label>
                <p className="text-muted-foreground text-xs">
                  Controls whether employee devices play sound for new orders
                </p>
              </div>
              <Switch
                checked={branchForm.enableNewOrderRinging !== false}
                onCheckedChange={checked =>
                  setBranchForm(prev => ({
                    ...prev,
                    enableNewOrderRinging: !!checked,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-sm">New order sound (global)</Label>
              <p className="text-muted-foreground text-xs">
                This sound is applied to all employee devices (employees cannot change it).
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label className="text-xs text-slate-700">Sound preset</Label>
                  <Select
                    value={branchForm.newOrderSoundPreset || 'ring'}
                    onValueChange={v =>
                      setBranchForm(prev => ({
                        ...prev,
                        newOrderSoundPreset: v as any,
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select sound" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ring">Ring (loud)</SelectItem>
                      <SelectItem value="siren">Siren (very loud)</SelectItem>
                      <SelectItem value="chime">Chime</SelectItem>
                      <SelectItem value="beep">Beep</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs text-slate-700">
                    Volume: {Math.round(((branchForm.newOrderSoundVolume ?? 1) as number) * 100)}%
                  </Label>
                  <div className="rounded-md border bg-white px-3 py-3">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={branchForm.newOrderSoundVolume ?? 1}
                      onChange={e =>
                        setBranchForm(prev => ({
                          ...prev,
                          newOrderSoundVolume: Number(e.target.value),
                        }))
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            {branchForm.logoUrl && (
              <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-3">
                <img
                  src={branchForm.logoUrl}
                  alt="Logo Preview"
                  className="h-16 w-16 rounded bg-white object-contain"
                  onError={e => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <span className="text-muted-foreground hidden text-sm">Failed to load logo</span>
                <div>
                  <p className="text-sm font-medium">Logo Preview</p>
                  <p
                    className="text-muted-foreground max-w-[300px] truncate text-xs"
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
              if (branchForm.logoUrl) localStorage.setItem('branch_logo_url', branchForm.logoUrl);
              if (branchForm.name) localStorage.setItem('branch_name', branchForm.name);
            }}
            disabled={savingBranch || !branch?.id}
          >
            {savingBranch ? (
              <>
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />{' '}
                Saving...
              </>
            ) : (
              'Save Branch Settings'
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
            Change your admin dashboard login password. You will need to sign in again after
            changing.
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
              onChange={e => setCurrentPassword(e.target.value)}
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
              onChange={e => setNewPassword(e.target.value)}
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
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            onClick={async () => {
              if (newPassword.length < 6) {
                toast({
                  title: 'Invalid password',
                  description: 'New password must be at least 6 characters',
                  variant: 'destructive',
                });
                return;
              }
              if (newPassword !== confirmPassword) {
                toast({
                  title: "Passwords don't match",
                  description: 'New password and confirm must match',
                  variant: 'destructive',
                });
                return;
              }
              if (!token) {
                toast({
                  title: 'Error',
                  description: 'Not signed in',
                  variant: 'destructive',
                });
                return;
              }
              setChangingPassword(true);
              try {
                const res = await fetch(`${apiBase}/auth/change-password`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ currentPassword, newPassword }),
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                  toast({
                    title: 'Password updated',
                    description: 'Use your new password next time you sign in.',
                  });
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                } else {
                  toast({
                    title: 'Error',
                    description:
                      (data as { message?: string }).message || 'Failed to update password',
                    variant: 'destructive',
                  });
                }
              } catch {
                toast({
                  title: 'Error',
                  description: 'Failed to update password',
                  variant: 'destructive',
                });
              } finally {
                setChangingPassword(false);
              }
            }}
          >
            {changingPassword ? (
              <>
                <span
                  className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />{' '}
                Updating…
              </>
            ) : (
              'Update password'
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Order Notifications</Label>
                <p className="text-muted-foreground text-xs">Show alerts for new orders</p>
              </div>
              <Switch
                checked={orderNotificationsEnabled}
                onCheckedChange={v => setOrderNotificationsEnabled(!!v)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Sound Alerts</Label>
                <p className="text-muted-foreground text-xs">Play sound on new orders</p>
              </div>
              <Switch
                checked={soundAlertsEnabled}
                onCheckedChange={v => setSoundAlertsEnabled(!!v)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Auto-refresh</Label>
                <p className="text-muted-foreground text-xs">Auto refresh data every 10s</p>
              </div>
              <Switch
                checked={autoRefreshEnabled}
                onCheckedChange={v => setAutoRefreshEnabled(!!v)}
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
                  'dm_admin_order_notifications',
                  String(!!orderNotificationsEnabled)
                );
                window.localStorage.setItem('dm_admin_sound_alerts', String(!!soundAlertsEnabled));
                window.localStorage.setItem('dm_admin_auto_refresh', String(!!autoRefreshEnabled));
                toast({
                  title: 'Saved',
                  description: 'System preferences updated for this browser.',
                });
              } catch {
                toast({
                  title: 'Could not save',
                  description: 'Your browser blocked storage. Try allowing site storage and retry.',
                  variant: 'destructive',
                });
              } finally {
                setSavingSystemPrefs(false);
              }
            }}
          >
            {savingSystemPrefs ? 'Saving...' : 'Save System Settings'}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-lg">Error Logs</CardTitle>
            {errorLogs.unresolvedCount > 0 && (
              <Badge variant="destructive">{errorLogs.unresolvedCount} unresolved</Badge>
            )}
          </div>
          <CardDescription>
            API failures, database errors, and suggested fixes. Resolve in Error Logs API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {errorLogs.logs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No errors logged yet.</p>
            ) : (
              <div className="space-y-2">
                {errorLogs.logs.slice(0, 8).map(log => (
                  <div key={log.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={log.status === 'RESOLVED' ? 'secondary' : 'destructive'}>
                        {log.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground truncate">{log.errorMessage}</p>
                    {log.apiEndpoint && (
                      <p className="text-muted-foreground text-xs">{log.apiEndpoint}</p>
                    )}
                    {(log.metadata as any)?.suggestedFix && (
                      <p className="mt-1 text-xs text-emerald-700">
                        Fix: {(log.metadata as any).suggestedFix}
                      </p>
                    )}
                    <p className="text-muted-foreground text-xs">
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
                <p className="text-muted-foreground py-8 text-center">No notifications yet</p>
              ) : (
                notifications.map((notif, index) => (
                  <div
                    key={(notif as any).id ?? `notif-${notif.createdAt}-${index}`}
                    className="flex items-start gap-3 rounded-lg bg-slate-50 p-3"
                  >
                    <div className="rounded-full bg-blue-100 p-1.5">
                      <Bell className="h-3 w-3 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{notif.message}</p>
                      <p className="text-muted-foreground text-xs">
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
    name: '',
    email: '',
    employeeCode: '',
    role: 'Counter Staff',
    status: 'ACTIVE',
    phone: '',
    salary: '',
    address: '',
    pincode: '',
    workingHoursPerDay: '8',
    shiftStartTime: '10:00',
    shiftEndTime: '18:00',
    joiningDate: '',
    branchId: 0,
  });
  const [saving, setSaving] = useState(false);
  // When dialog opens or branches load, set default branch
  useEffect(() => {
    if (open && branches.length > 0) {
      const firstId = branches[0].id;
      setForm(f =>
        f.branchId && branches.some(b => b.id === f.branchId) ? f : { ...f, branchId: firstId }
      );
    }
  }, [open, branches]);
  const branchId =
    form.branchId && branches.some(b => b.id === form.branchId)
      ? form.branchId
      : (branches[0]?.id ?? 0);
  const handleCreate = async () => {
    if (!token || !form.name.trim() || !form.email.trim()) return;
    if (!branchId || !branches.some(b => b.id === branchId)) {
      toast({
        title: 'Select branch',
        description: 'Create a branch in Settings first, then add an employee.',
        variant: 'destructive',
      });
      if (onGoToSettings) onGoToSettings();
      return;
    }
    const whpd = Number(form.workingHoursPerDay);
    if (!(whpd >= 1 && whpd <= 24)) {
      toast({
        title: 'Invalid working hours',
        description: 'Working Hours Per Day must be between 1 and 24.',
        variant: 'destructive',
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
      if (form.phone?.toString().trim()) payload.phone = form.phone.toString().trim();
      if (form.salary !== '' && Number(form.salary) > 0) payload.salary = Number(form.salary);
      if (form.address?.toString().trim()) payload.address = form.address.toString().trim();
      if (form.pincode?.toString().trim()) payload.pincode = form.pincode.toString().trim();
      const whpd = Number(form.workingHoursPerDay);
      if (whpd >= 1 && whpd <= 24) payload.workingHoursPerDay = whpd;
      if (form.shiftStartTime?.trim()) payload.shiftStartTime = form.shiftStartTime.trim();
      if (form.shiftEndTime?.trim()) payload.shiftEndTime = form.shiftEndTime.trim();
      if (form.joiningDate?.trim()) payload.joiningDate = form.joiningDate.trim();
      const res = await fetch(`${apiBase}/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Success',
          description: 'Employee created. Verification email sent.',
        });
        setForm({
          name: '',
          email: '',
          employeeCode: '',
          role: 'Counter Staff',
          status: 'ACTIVE',
          phone: '',
          salary: '',
          address: '',
          pincode: '',
          workingHoursPerDay: '8',
          shiftStartTime: '10:00',
          shiftEndTime: '18:00',
          joiningDate: '',
          branchId: branches[0]?.id ?? 0,
        } as EmployeeFormState & { branchId: number });
        onOpenChange(false);
        onCreated(data);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'Error',
          description: (err as { message?: string }).message || 'Failed to create employee',
          variant: 'destructive',
        });
      }
    } catch (e) {
      const isNetworkError =
        e instanceof TypeError &&
        (e.message === 'Failed to fetch' || (e as Error).message?.includes('fetch'));
      toast({
        title: 'Error',
        description: isNetworkError
          ? 'Could not reach server. Check that the backend is running.'
          : 'Failed to create employee',
        variant: 'destructive',
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
                  branchId && branches.some(b => b.id === branchId)
                    ? String(branchId)
                    : String(branches[0]?.id ?? '')
                }
                onValueChange={v => setForm(f => ({ ...f, branchId: Number(v) }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="max-h-[280px]">
                  {branches.map(b => (
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
                  Create a branch in Settings first, then you can add employees and select the
                  branch here.
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
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <Input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
          <Input
            placeholder="Role (e.g. Counter Staff, Kitchen)"
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
          />
          <Input
            placeholder="Mobile"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          />
          <Input
            placeholder="Salary (optional)"
            type="number"
            value={form.salary}
            onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
          />
          <div className="grid gap-2">
            <Label>Working Hours Per Day *</Label>
            <Input
              type="number"
              min={1}
              max={24}
              placeholder="Enter daily working hours (e.g., 8)"
              value={form.workingHoursPerDay}
              onChange={e => setForm(f => ({ ...f, workingHoursPerDay: e.target.value }))}
            />
            <p className="text-muted-foreground text-xs">
              Required for payroll and overtime (1–24 hours). Overtime starts after this.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Shift Start Time</Label>
              <Input
                type="time"
                value={form.shiftStartTime}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    shiftStartTime: e.target.value || '10:00',
                  }))
                }
              />
              <p className="text-muted-foreground text-xs">Scheduled start (for late tracking)</p>
            </div>
            <div className="space-y-1">
              <Label>Shift End Time</Label>
              <Input
                type="time"
                value={form.shiftEndTime}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    shiftEndTime: e.target.value || '18:00',
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
              onChange={e => setForm(f => ({ ...f, joiningDate: e.target.value }))}
              className="min-h-[44px] w-full sm:min-h-0"
            />
          </div>
          <Input
            placeholder="Address (optional)"
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          />
          <Input
            placeholder="Pincode (optional)"
            value={form.pincode}
            onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving || branches.length === 0}>
            {saving ? (
              <>
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating...
              </>
            ) : (
              'Create'
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
    name: '',
    email: '',
    employeeCode: '',
    role: '',
    status: 'ACTIVE',
    phone: '',
    salary: '',
    address: '',
    pincode: '',
    workingHoursPerDay: '8',
    shiftStartTime: '10:00',
    shiftEndTime: '18:00',
    joiningDate: '',
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open && employee) {
      const joinDate = employee.joiningDate
        ? typeof employee.joiningDate === 'string'
          ? employee.joiningDate.slice(0, 10)
          : ''
        : '';
      setForm({
        name: employee.name,
        email: employee.email,
        employeeCode: employee.employeeCode,
        role: employee.role ?? '',
        status: employee.status,
        phone: employee.phone ?? '',
        salary: employee.salary ?? '',
        address: employee.address ?? '',
        pincode: employee.pincode ?? '',
        workingHoursPerDay: employee.workingHoursPerDay ?? 8,
        shiftStartTime: employee.shiftStartTime ?? '10:00',
        shiftEndTime: employee.shiftEndTime ?? '18:00',
        joiningDate: joinDate,
      });
    }
  }, [open, employee]);
  const handleSave = async () => {
    if (!token || !employee) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name?.trim() ?? '',
        email: form.email?.trim() ?? '',
        role: form.role?.trim() || null,
        phone: form.phone?.toString().trim() || null,
        salary:
          form.salary !== '' && form.salary !== undefined ? Number(form.salary) || null : null,
        address: form.address?.toString().trim() || null,
        pincode: form.pincode?.toString().trim() || null,
        status: form.status,
      };
      const whpd = Number(form.workingHoursPerDay);
      if (whpd >= 1 && whpd <= 24) payload.workingHoursPerDay = whpd;
      if (form.shiftStartTime !== undefined)
        payload.shiftStartTime = form.shiftStartTime?.trim() || null;
      if (form.shiftEndTime !== undefined) payload.shiftEndTime = form.shiftEndTime?.trim() || null;
      if (form.joiningDate !== undefined) payload.joiningDate = form.joiningDate?.trim() || null;
      const res = await fetch(`${apiBase}/employees/${employee.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        toast({ title: 'Success', description: 'Employee updated' });
        onOpenChange(false);
        onSaved(updated);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'Error',
          description: (err as { message?: string }).message || 'Failed to update',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update employee',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={o => !o && onOpenChange(false)}>
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
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <Input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
          <Input
            placeholder="Role (e.g. Counter Staff, Kitchen)"
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
          />
          <Input
            placeholder="Mobile"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          />
          <Input
            placeholder="Salary"
            type="number"
            value={form.salary}
            onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
          />
          <div className="grid gap-2">
            <Label>Working Hours Per Day</Label>
            <Input
              type="number"
              min={1}
              max={24}
              placeholder="Enter daily working hours (e.g., 8)"
              value={form.workingHoursPerDay}
              onChange={e => setForm(f => ({ ...f, workingHoursPerDay: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Shift Start Time</Label>
              <Input
                type="time"
                value={form.shiftStartTime}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    shiftStartTime: e.target.value || '10:00',
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Shift End Time</Label>
              <Input
                type="time"
                value={form.shiftEndTime}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    shiftEndTime: e.target.value || '18:00',
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
              onChange={e => setForm(f => ({ ...f, joiningDate: e.target.value }))}
              className="min-h-[44px] w-full sm:min-h-0"
            />
          </div>
          <Input
            placeholder="Address"
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          />
          <Input
            placeholder="Pincode"
            value={form.pincode}
            onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))}
          />
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={form.status === 'ACTIVE' ? 'default' : 'outline'}
                size="sm"
                className={form.status === 'ACTIVE' ? STATUS_BUTTON_ACTIVE.ACTIVE : ''}
                onClick={() => setForm(f => ({ ...f, status: 'ACTIVE' }))}
              >
                Active
              </Button>
              <Button
                type="button"
                variant={form.status === 'INACTIVE' ? 'default' : 'outline'}
                size="sm"
                className={form.status === 'INACTIVE' ? STATUS_BUTTON_ACTIVE.INACTIVE : ''}
                onClick={() => setForm(f => ({ ...f, status: 'INACTIVE' }))}
              >
                Inactive
              </Button>
              <Button
                type="button"
                variant={form.status === 'LEFT' ? 'default' : 'outline'}
                size="sm"
                className={form.status === 'LEFT' ? STATUS_BUTTON_ACTIVE.LEFT : ''}
                onClick={() => setForm(f => ({ ...f, status: 'LEFT' }))}
              >
                Left
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              'Save'
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
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  useEffect(() => {
    if (!open) {
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open]);
  const handleSubmit = async () => {
    if (!employee || !token) return;
    if (newPassword.length < 6) {
      toast({
        title: 'Invalid password',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: 'New password and confirm password must match',
        variant: 'destructive',
      });
      return;
    }
    setLoading(employee.id);
    try {
      const res = await fetch(`${apiBase}/employees/${employee.id}/admin-set-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: 'Password updated',
          description: 'Director(s) will receive an email with the new password.',
        });
        onOpenChange(false);
        onSuccess();
      } else {
        toast({
          title: 'Error',
          description: (data as { message?: string }).message || 'Failed to update password',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update password',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };
  return (
    <Dialog open={open} onOpenChange={o => !o && onOpenChange(false)}>
      <DialogContent className="max-w-md" aria-describedby="change-pw-desc">
        <DialogHeader>
          <DialogTitle>Change employee password</DialogTitle>
          <DialogDescription id="change-pw-desc">
            {employee
              ? `Set a new password for ${employee.name}. Director(s) for this branch will receive an email with the new password and employee email.`
              : ''}
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
              onChange={e => setNewPassword(e.target.value)}
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
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !newPassword || !confirmPassword}>
            {loading ? (
              <>
                <span
                  className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                  aria-hidden
                />
                Updating…
              </>
            ) : (
              'Update password'
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
const SalarySlipDialogModule = memo(function SalarySlipDialogModule(props: SalarySlipDialogProps) {
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
  const [localEmployees, setLocalEmployees] = useState<typeof propsEmployees>([]);
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
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
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
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [employeeId, setEmployeeId] = useState(0);
  const [payPeriodMonth, setPayPeriodMonth] = useState(defaultMonth);
  const [basicSalary, setBasicSalary] = useState<number>(0);
  const [paidDays, setPaidDays] = useState<number>(22);
  const [lopDays, setLopDays] = useState<number>(0);
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [allowanceRows, setAllowanceRows] = useState<
    { id: string; name: string; amount: number }[]
  >([
    { id: 'a1', name: 'House Rent Allowance', amount: 0 },
    { id: 'a2', name: 'Other Allowance', amount: 0 },
  ]);
  const [deductionRows, setDeductionRows] = useState<
    { id: string; name: string; amount: number }[]
  >([
    { id: 'd1', name: 'Income Tax', amount: 0 },
    { id: 'd2', name: 'Provident Fund', amount: 0 },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [employeeDataLoading, setEmployeeDataLoading] = useState(false);
  const lastAutoFilledEmployeeId = useRef<number>(0);
  const [overtimeStartDate, setOvertimeStartDate] = useState('');
  const [overtimeEndDate, setOvertimeEndDate] = useState('');
  const [overtimeRecords, setOvertimeRecords] = useState<
    {
      id: number | string;
      overtimeHours: number;
      shiftDate: string;
      status?: string;
    }[]
  >([]);
  const [overtimeLoading, setOvertimeLoading] = useState(false);
  const [lateStartDate, setLateStartDate] = useState('');
  const [lateEndDate, setLateEndDate] = useState('');
  const [lateTotalMinutes, setLateTotalMinutes] = useState<number | null>(null);
  const [lateLoading, setLateLoading] = useState(false);

  useEffect(() => {
    if (!open) setEmployeeDataLoading(false);
  }, [open]);

  // When dialog opens with prefillSlip, populate form from stored slip data
  useEffect(() => {
    if (!open || !prefillSlip) return;
    const emp = employees.find(
      e =>
        (e.employeeCode && e.employeeCode === prefillSlip.employeeCode) ||
        e.name === prefillSlip.employee?.name
    );
    if (emp) setEmployeeId(emp.id);
    const monthIdx = SALARY_MONTH_NAMES.indexOf(prefillSlip.month ?? '');
    const y = prefillSlip.year ?? now.getFullYear();
    const m = monthIdx >= 0 ? monthIdx + 1 : now.getMonth() + 1;
    setPayPeriodMonth(`${y}-${String(m).padStart(2, '0')}`);
    setBasicSalary(Number(prefillSlip.basicSalary) || 0);
    setPaidDays(
      prefillSlip.paidDays != null && prefillSlip.paidDays !== ''
        ? Number(prefillSlip.paidDays)
        : 22
    );
    setLopDays(
      prefillSlip.lopDays != null && prefillSlip.lopDays !== '' ? Number(prefillSlip.lopDays) : 0
    );
    setPayDate(
      prefillSlip.createdAt
        ? new Date(prefillSlip.createdAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    );
    const allow = (prefillSlip.allowances ?? []).map((r: any, i: number) => ({
      id: `a${i}-${Date.now()}`,
      name: r.name ?? '',
      amount: Number(r.amount) || 0,
    }));
    setAllowanceRows(
      allow.length
        ? allow
        : [
            { id: 'a1', name: 'House Rent Allowance', amount: 0 },
            { id: 'a2', name: 'Other Allowance', amount: 0 },
          ]
    );
    const ded = (prefillSlip.deductions ?? []).map((r: any, i: number) => ({
      id: `d${i}-${Date.now()}`,
      name: r.name ?? '',
      amount: Number(r.amount) || 0,
    }));
    setDeductionRows(
      ded.length
        ? ded
        : [
            { id: 'd1', name: 'Income Tax', amount: 0 },
            { id: 'd2', name: 'Provident Fund', amount: 0 },
          ]
    );
  }, [open, prefillSlip, employees]);
  // Roster-active = status ACTIVE (email verification is shown separately in the table)
  const activeEmployees = useMemo(
    () => employees.filter(e => String(e.status || '').toUpperCase() === 'ACTIVE'),
    [employees]
  );
  const employeesToShow = activeEmployees.length > 0 ? activeEmployees : employees;
  const selectedEmployee = employeesToShow.find(e => e.id === employeeId);
  const [payYear, payMonthNum] = payPeriodMonth.split('-').map(Number);
  const payMonthName = SALARY_MONTH_NAMES[(payMonthNum || 1) - 1];
  const payPeriodLabel = payPeriodMonth
    ? `${String(payMonthNum).padStart(2, '0')} - ${payMonthName} ${payYear}`
    : '';
  const companyName =
    branchForm?.name ||
    branch?.name ||
    (typeof window !== 'undefined' ? window.localStorage.getItem('branch_name') : null) ||
    'Cafe Chapter 1 Restro Private Limited';
  const companyAddress = branchForm?.location ?? branch?.location ?? 'Gautam Nagar';
  const totalAllowances = allowanceRows.reduce((s, r) => s + (r.amount || 0), 0);
  const totalDeductions = deductionRows.reduce((s, r) => s + (r.amount || 0), 0);
  const netSalary = (basicSalary || 0) + totalAllowances - totalDeductions;
  const grossEarnings = (basicSalary || 0) + totalAllowances;
  const logoUrl =
    (typeof window !== 'undefined' && window.localStorage.getItem('branch_logo_url')) ||
    branchForm?.logoUrl ||
    cafeLogo;
  const companyPincode = branchForm?.pincode || branch?.pincode || '';

  const fetchOvertime = useCallback(async () => {
    if (!token || !selectedEmployee || !overtimeStartDate || !overtimeEndDate) return;
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
          }))
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
    setAllowanceRows(prev => [
      ...prev,
      {
        id: `ot-${Date.now()}`,
        name: `Overtime (${formatHours(overtimeHours)})`,
        amount,
      },
    ]);
    toast({
      title: 'Added',
      description: `Overtime ₹${amount} added to earnings.`,
    });
  };

  const formatLateMinutesHuman = (mins: number) => {
    if (mins < 60) return `${mins} Minute${mins !== 1 ? 's' : ''}`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h} Hour${h !== 1 ? 's' : ''}`;
    return `${h} Hour${h !== 1 ? 's' : ''} ${m} Min`;
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
    const label = mins > 0 ? `Late (${formatLateMinutesHuman(mins)})` : 'Late';
    setDeductionRows(prev => [...prev, { id: `late-${Date.now()}`, name: label, amount }]);
    toast({
      title: 'Added',
      description:
        amount > 0
          ? `Late deduction ₹${amount} added.`
          : 'Late entry added to slip (edit amount if needed).',
    });
  };

  useEffect(() => {
    if (!selectedEmployee || selectedEmployee.id === lastAutoFilledEmployeeId.current) {
      if (!employeeId) setEmployeeDataLoading(false);
      return;
    }
    lastAutoFilledEmployeeId.current = selectedEmployee.id;
    const base = Number(selectedEmployee.salary) || 0;
    setBasicSalary(base);
    setPaidDays(22);
    setLopDays(0);
    setAllowanceRows(prev =>
      prev.map((r, i) =>
        i === 0
          ? {
              ...r,
              name: 'House Rent Allowance',
              amount: Math.round(base * 0.2),
            }
          : i === 1
            ? { ...r, name: 'Other Allowance', amount: 0 }
            : r
      )
    );
    setEmployeeDataLoading(false);
  }, [employeeId, selectedEmployee]);

  const addAllowance = () =>
    setAllowanceRows(prev => [...prev, { id: `a${Date.now()}`, name: '', amount: 0 }]);
  const removeAllowance = (id: string) => setAllowanceRows(prev => prev.filter(r => r.id !== id));
  const updateAllowance = (id: string, field: 'name' | 'amount', value: string | number) =>
    setAllowanceRows(prev =>
      prev.map(r =>
        r.id === id ? { ...r, [field]: field === 'amount' ? Number(value) || 0 : value } : r
      )
    );
  const addDeduction = () =>
    setDeductionRows(prev => [...prev, { id: `d${Date.now()}`, name: '', amount: 0 }]);
  const removeDeduction = (id: string) => setDeductionRows(prev => prev.filter(r => r.id !== id));
  const updateDeduction = (id: string, field: 'name' | 'amount', value: string | number) =>
    setDeductionRows(prev =>
      prev.map(r =>
        r.id === id ? { ...r, [field]: field === 'amount' ? Number(value) || 0 : value } : r
      )
    );

  const handleSendEmail = async () => {
    if (!selectedEmployee) {
      toast({
        title: 'Select employee',
        description: 'Please select an employee first.',
        variant: 'destructive',
      });
      return;
    }
    if (!token) {
      toast({
        title: 'Error',
        description: 'Not authenticated.',
        variant: 'destructive',
      });
      return;
    }
    const directorEmails = (branchForm?.directorsEmail || '')
      .split(/[\s,]+/)
      .map((e: string) => e.trim())
      .filter((e: string) => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    const employeeEmail =
      selectedEmployee.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(selectedEmployee.email)
        ? selectedEmployee.email
        : null;
    const to = [...new Set([employeeEmail, ...directorEmails].filter(Boolean))] as string[];
    if (to.length === 0) {
      toast({
        title: 'No email addresses',
        description:
          "Add employee email or directors' emails in Settings (Directors Email) to send the salary slip.",
        variant: 'destructive',
      });
      return;
    }
    const html = buildPayslipPrintHtmlModule({
      logoUrl: String(logoUrl),
      companyName,
      companyAddress,
      companyPincode,
      phone: branchForm?.phone || '',
      payMonthName,
      payYear,
      payPeriodLabel,
      payDate,
      salaryNumber: getNextSalaryNumberModule(salarySlips, payYear, payMonthName),
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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to, subject, html }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: 'Email sent',
          description: `Salary slip sent to ${to.length} recipient(s).`,
        });
      } else {
        toast({
          title: 'Send failed',
          description: (data as { message?: string }).message || 'Failed to send email.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Send failed',
        description: 'Network error. Check backend and try again.',
        variant: 'destructive',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedEmployee) {
      toast({
        title: 'Select employee',
        description: 'Please select an employee first.',
        variant: 'destructive',
      });
      return;
    }
    setIsGenerating(true);
    try {
      const salaryNumber = getNextSalaryNumberModule(salarySlips, payYear, payMonthName);
      const res = await fetch(`${apiBase}/reports/salary-slips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
          created && typeof created === 'object' && 'message' in created
            ? String((created as any).message)
            : 'Failed to save salary slip';
        throw new Error(msg);
      }

      const normalized = {
        ...(created as any),
        month:
          typeof (created as any)?.month === 'number'
            ? (monthNumberToName((created as any).month) ?? payMonthName)
            : ((created as any)?.month ?? payMonthName),
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

      setSalarySlips(prev => [normalized, ...prev]);
      onOpenChange(false);
      toast({
        title: 'Slip generated successfully',
        description: `Salary slip for ${selectedEmployee.name} has been saved and added to the list.`,
      });
    } catch (e: unknown) {
      const err = e as { message?: string; errors?: { message?: string }[] };
      toast({
        title: 'Error',
        description: err?.message || err?.errors?.[0]?.message || 'Failed to generate slip',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="fixed top-[50%] left-[50%] z-[110] max-h-[90vh] w-[calc(100vw-1rem)] max-w-4xl min-w-0 translate-x-[-50%] translate-y-[-50%] gap-0 overflow-x-hidden overflow-y-auto rounded-lg border-2 border-slate-200 bg-white p-0 opacity-100 shadow-2xl sm:max-h-[85vh] sm:w-[calc(100vw-2rem)] sm:rounded-xl"
        aria-describedby="salary-slip-desc"
      >
        <DialogTitle className="sr-only">Generate Salary Slip</DialogTitle>
        <DialogDescription id="salary-slip-desc" className="sr-only">
          Select employee, pay period, and salary components. Preview or download the payslip before
          generating.
        </DialogDescription>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 z-[120] h-9 w-9 shrink-0 rounded-full bg-white/20 text-white hover:bg-white/30"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="flex min-w-0 shrink-0 flex-col items-stretch justify-between gap-3 rounded-t-lg bg-gradient-to-r from-[#064E3B] to-[#047857] px-3 py-3 pr-10 text-white sm:flex-row sm:items-start sm:gap-4 sm:px-6 sm:py-4 sm:pr-12">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <img
              src={logoUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded bg-white object-contain p-1 sm:h-16 sm:w-16 sm:p-1.5"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] tracking-wide text-white/80 uppercase">
                Restaurant / Company
              </p>
              <p className="truncate text-base font-bold sm:text-xl">{companyName}</p>
              <p className="truncate text-xs text-white/90 sm:text-sm">
                {companyAddress || '—'}
                {companyPincode ? `, ${companyPincode}` : ''}
                {companyAddress || companyPincode ? ', India' : ''}
              </p>
              {branchForm?.phone && (
                <p className="mt-0.5 text-xs text-white/80">Ph: {branchForm.phone}</p>
              )}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <Label className="text-sm text-white/90">Payslip For The Month</Label>
            <input
              type="month"
              value={payPeriodMonth}
              onChange={e => setPayPeriodMonth(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-base font-semibold text-white [color-scheme:dark] sm:min-w-[180px]"
              title="Select month"
            />
            {payPeriodLabel && (
              <p className="text-xs text-white/90 sm:text-right">{payPeriodLabel}</p>
            )}
          </div>
        </div>
        <div className="min-w-0 space-y-4 overflow-x-hidden overflow-y-auto p-3 sm:space-y-6 sm:p-6">
          <div className="grid gap-2">
            <Label className="text-sm font-medium">Employee *</Label>
            <Select
              value={
                employeeId && employeesToShow.some(e => e.id === employeeId)
                  ? String(employeeId)
                  : '0'
              }
              onValueChange={v => {
                const id = v === '0' ? 0 : Number(v);
                if (id) setEmployeeDataLoading(true);
                setEmployeeId(id);
              }}
            >
              <SelectTrigger
                className={SALARY_INPUT_CLASS + ' w-full'}
                id="salary-slip-employee-select"
              >
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-[320px]" sideOffset={4}>
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
                  employeesToShow.map((emp: SalarySlipDialogProps['employees'][number]) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      <span className="block truncate">
                        {emp.name ?? '—'}
                        {emp.employeeCode ? ` · ${emp.employeeCode}` : ''}
                        {'email' in emp && emp.email ? ` · ${emp.email}` : ''}
                        {'branch' in emp && emp.branch?.name ? ` · ${emp.branch.name}` : ''}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className={SALARY_CARD_CLASS + ' relative'}>
            {employeeDataLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-slate-50/80">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  <span className="text-sm text-slate-600">Loading employee data...</span>
                </div>
              </div>
            )}
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Employee Details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-muted-foreground text-xs">
                  Salary Slip No. (auto-generated, not editable)
                </Label>
                <Input
                  value={getNextSalaryNumberModule(salarySlips, payYear, payMonthName)}
                  readOnly
                  className={SALARY_INPUT_CLASS + ' bg-slate-100 font-mono'}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Employee Name</Label>
                <Input
                  value={selectedEmployee?.name ?? ''}
                  readOnly
                  className={SALARY_INPUT_CLASS + ' bg-slate-50'}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Employee ID</Label>
                <Input
                  value={selectedEmployee?.employeeCode ?? ''}
                  readOnly
                  className={SALARY_INPUT_CLASS + ' bg-slate-50'}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Pay Period</Label>
                <Input
                  type="date"
                  value={payPeriodMonth ? `${payPeriodMonth}-01` : ''}
                  onChange={e => {
                    const v = e.target.value;
                    if (v) setPayPeriodMonth(v.slice(0, 7));
                  }}
                  className={SALARY_INPUT_CLASS}
                  title="Select pay period (month)"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Pay Date</Label>
                <Input
                  type="date"
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className={SALARY_INPUT_CLASS}
                />
              </div>
            </div>
          </div>
          <div className={SALARY_CARD_CLASS}>
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Overtime (optional)</h3>
            <p className="text-muted-foreground mb-3 text-xs">
              Load overtime for the selected employee in a date range, then add total hours to the
              slip. Amount is calculated from basic salary and working hours per day.
            </p>
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Start date</Label>
                <Input
                  type="date"
                  value={overtimeStartDate}
                  onChange={e => setOvertimeStartDate(e.target.value)}
                  className={SALARY_INPUT_CLASS}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End date</Label>
                <Input
                  type="date"
                  value={overtimeEndDate}
                  onChange={e => setOvertimeEndDate(e.target.value)}
                  className={SALARY_INPUT_CLASS}
                />
              </div>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchOvertime}
                disabled={
                  !selectedEmployee || !overtimeStartDate || !overtimeEndDate || overtimeLoading
                }
              >
                {overtimeLoading ? 'Loading...' : 'Load overtime'}
              </Button>
              {overtimeRecords.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() =>
                    addOvertimeToSlip(overtimeRecords.reduce((s, r) => s + r.overtimeHours, 0))
                  }
                >
                  Add {formatHours(overtimeRecords.reduce((s, r) => s + r.overtimeHours, 0))} to
                  slip
                </Button>
              )}
            </div>
            {overtimeRecords.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded border border-slate-200 p-2">
                <p className="mb-1 text-xs font-medium text-slate-600">Overtime entries</p>
                <ul className="space-y-0.5 text-xs">
                  {overtimeRecords.map(r => (
                    <li key={String(r.id)} className="flex justify-between">
                      <span>{r.shiftDate ? new Date(r.shiftDate).toLocaleDateString() : '—'}</span>
                      <span>{formatHours(r.overtimeHours)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className={SALARY_CARD_CLASS}>
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Late (optional)</h3>
            <p className="text-muted-foreground mb-3 text-xs">
              Load late entries for the selected employee in a date range. You can add a late
              deduction to the slip if needed.
            </p>
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Start date</Label>
                <Input
                  type="date"
                  value={lateStartDate}
                  onChange={e => setLateStartDate(e.target.value)}
                  className={SALARY_INPUT_CLASS}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End date</Label>
                <Input
                  type="date"
                  value={lateEndDate}
                  onChange={e => setLateEndDate(e.target.value)}
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
                disabled={!selectedEmployee || !lateStartDate || !lateEndDate || lateLoading}
              >
                {lateLoading ? 'Loading...' : 'Load late'}
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
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Salary Earnings</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2">
                <span className="text-sm text-slate-700">Basic Salary</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">₹</span>
                  <Input
                    type="number"
                    min={0}
                    className={SALARY_INPUT_CLASS + ' w-28 text-right'}
                    value={basicSalary || ''}
                    onChange={e => setBasicSalary(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
              {allowanceRows.map(r => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-4 border-b border-slate-100 py-2"
                >
                  <Input
                    placeholder="e.g. HRA"
                    className={
                      SALARY_INPUT_CLASS +
                      ' h-9 max-w-[200px] flex-1 border-0 border-b border-transparent bg-transparent py-0 shadow-none focus-visible:ring-0'
                    }
                    value={r.name}
                    onChange={e => updateAllowance(r.id, 'name', e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">₹</span>
                    <Input
                      type="number"
                      min={0}
                      className={SALARY_INPUT_CLASS + ' w-24 text-right'}
                      value={r.amount || ''}
                      onChange={e => updateAllowance(r.id, 'amount', e.target.value)}
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
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addAllowance}
                  className="text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  + Add Earnings
                </Button>
              </div>
            </div>
          </div>
          <div className={SALARY_CARD_CLASS}>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <MinusCircle className="h-4 w-4 text-red-500" /> Deductions
            </h3>
            <div className="space-y-3">
              {deductionRows.map(r => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-4 border-b border-slate-100 py-2"
                >
                  <Input
                    placeholder="e.g. Income Tax"
                    className={
                      SALARY_INPUT_CLASS +
                      ' h-9 max-w-[200px] flex-1 border-0 border-b border-transparent bg-transparent py-0 shadow-none focus-visible:ring-0'
                    }
                    value={r.name}
                    onChange={e => updateDeduction(r.id, 'name', e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">₹</span>
                    <Input
                      type="number"
                      min={0}
                      className={SALARY_INPUT_CLASS + ' w-24 text-right'}
                      value={r.amount || ''}
                      onChange={e => updateDeduction(r.id, 'amount', e.target.value)}
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
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addDeduction}
                  className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  + Add Deductions
                </Button>
              </div>
            </div>
          </div>
          <div
            className={
              SALARY_CARD_CLASS + ' border-emerald-100 bg-gradient-to-br from-emerald-50 to-white'
            }
          >
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Salary Summary</h3>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Paid Days</Label>
                <Input
                  type="number"
                  min={0}
                  className={SALARY_INPUT_CLASS}
                  value={paidDays}
                  onChange={e => setPaidDays(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">LOP Days</Label>
                <Input
                  type="number"
                  min={0}
                  className={SALARY_INPUT_CLASS}
                  value={lopDays}
                  onChange={e => setLopDays(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="space-y-2 border-t border-slate-200 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Gross Salary</span>
                <span className="font-medium">{formatINR(grossEarnings)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Deduction</span>
                <span className="font-medium text-red-600">{formatINR(totalDeductions)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t-2 border-emerald-200 pt-3">
                <span className="font-semibold text-slate-800">Net Salary</span>
                <span className="text-xl font-bold text-emerald-700">{formatINR(netSalary)}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-lg"
              onClick={() => {
                const html = buildPayslipPrintHtmlModule({
                  logoUrl: String(logoUrl),
                  companyName,
                  companyAddress,
                  companyPincode,
                  phone: branchForm?.phone || '',
                  payMonthName,
                  payYear,
                  payPeriodLabel,
                  payDate,
                  salaryNumber: getNextSalaryNumberModule(salarySlips, payYear, payMonthName),
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
                const w = window.open('', '_blank');
                if (w) {
                  w.document.write(html);
                  w.document.close();
                  w.focus();
                }
              }}
            >
              <Eye className="mr-2 h-4 w-4" /> Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-lg"
              onClick={() => {
                const html = buildPayslipPrintHtmlModule({
                  logoUrl: String(logoUrl),
                  companyName,
                  companyAddress,
                  companyPincode,
                  phone: branchForm?.phone || '',
                  payMonthName,
                  payYear,
                  payPeriodLabel,
                  payDate,
                  salaryNumber: getNextSalaryNumberModule(salarySlips, payYear, payMonthName),
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
                const w = window.open('', '_blank');
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
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
            <LoaderButton
              variant="outline"
              size="sm"
              className="h-10 rounded-lg"
              onClick={handleSendEmail}
              disabled={!selectedEmployee}
              loading={sendingEmail}
              loadingLabel="Sending…"
            >
              <Mail className="mr-2 h-4 w-4" /> Send Email
            </LoaderButton>
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-lg"
              onClick={() =>
                toast({
                  title: 'Send WhatsApp',
                  description: 'Salary slip will be sent to employee via WhatsApp',
                })
              }
            >
              <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-11 rounded-lg"
            >
              Cancel
            </Button>
            <LoaderButton
              onClick={handleGenerate}
              disabled={!selectedEmployee}
              loading={isGenerating}
              loadingLabel="Generating..."
              className="h-12 rounded-lg bg-gradient-to-r from-[#064E3B] to-[#047857] font-semibold text-white hover:opacity-90"
            >
              <IndianRupee className="mr-2 h-5 w-5" /> Generate Salary Slip
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
    'overview',
    'performance',
    'menu',
    'employees',
    'all-orders',
    'customer-leaderboard',
    'customer-queries',
    'removed-items',
    'hours',
    'overtime',
    'late',
    'leaves',
    'revenue',
    'salary-slips',
    'certificates',
    'settings',
  ];
  const [activeSection, setActiveSection] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_active_section') || 'overview';
      return validSectionKeys.includes(saved) ? saved : 'overview';
    }
    return 'overview';
  });
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const { token, ready } = useAuth();
  const tokenRef = useRef(token);
  tokenRef.current = token;
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const { stopGlobalLoading } = useGlobalLoading();

  // Persist active section to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_active_section', activeSection);
    }
  }, [activeSection]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemSales, setItemSales] = useState<ItemSales[]>([]);
  const [employeeSales, setEmployeeSales] = useState<EmployeeSales[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const [newOrdersBadge, setNewOrdersBadge] = useState(0);

  // Form states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    basePrice: 0,
    hasHalf: false,
    halfPrice: 0,
    isActive: true,
    categoryId: 0,
    imageUrl: '',
    notifyCustomers: false,
    /** Saves as 7-day “New launch” highlight on customer category cards */
    highlightAsNewLaunch: true,
  });

  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [sendingVerification, setSendingVerification] = useState<number | null>(null);
  const [employeeToVerify, setEmployeeToVerify] = useState<Employee | null>(null);
  const [verifyingEmployeeId, setVerifyingEmployeeId] = useState<number | null>(null);
  const [employeeToChangePassword, setEmployeeToChangePassword] = useState<Employee | null>(null);
  const [changingPasswordEmployeeId, setChangingPasswordEmployeeId] = useState<number | null>(null);

  // Additional state for new features
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [ordersByTable, setOrdersByTable] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  /** Frozen snapshot for order details dialog – prevents popup/cards flashing when parent re-renders or orders refresh */
  const [popupDisplayOrder, setPopupDisplayOrder] = useState<Order | null>(null);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const isOrderDialogOpenRef = useRef(false);
  const [completingOrderId, setCompletingOrderId] = useState<number | null>(null);
  const [orderDateFilter, setOrderDateFilter] = useState<string>(() => getBusinessDateString());
  const [orderStartDate, setOrderStartDate] = useState<string>('');
  const [orderEndDate, setOrderEndDate] = useState<string>('');
  const [orderTableFilter, setOrderTableFilter] = useState<string>('all');
  const [ordersLoading, setOrdersLoading] = useState(false);

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
  const [leaderboardSortBy, setLeaderboardSortBy] = useState<'orders' | 'amount'>('amount');
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
  const [queryStatusFilter, setQueryStatusFilter] = useState<string>('all');
  const [selectedQuery, setSelectedQuery] = useState<(typeof customerQueries)[0] | null>(null);
  const [queryDialogOpen, setQueryDialogOpen] = useState(false);
  const [resolvingQueryId, setResolvingQueryId] = useState<number | null>(null);

  // Work hours state
  const [shifts, setShifts] = useState<any[]>([]);
  const [activeShiftsNow, setActiveShiftsNow] = useState<any[]>([]); // live: employees currently on shift
  const [hoursEmployeeFilter, setHoursEmployeeFilter] = useState<string>('all');
  const [hoursStartDate, setHoursStartDate] = useState<string>('');
  const [hoursEndDate, setHoursEndDate] = useState<string>('');
  const [shiftHistoryLoading, setShiftHistoryLoading] = useState(false);
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
  const [overtimeDateFrom, setOvertimeDateFrom] = useState<string>('');
  const [overtimeDateTo, setOvertimeDateTo] = useState<string>('');
  const [overtimeEmployeeFilter, setOvertimeEmployeeFilter] = useState<string>('all');
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
  const [lateDateFrom, setLateDateFrom] = useState<string>('');
  const [lateDateTo, setLateDateTo] = useState<string>('');
  const [lateEmployeeFilter, setLateEmployeeFilter] = useState<string>('all');
  const [lateLoading, setLateLoading] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<string>('PENDING');
  const [leaveEmployeeFilter, setLeaveEmployeeFilter] = useState<string>('all');
  const [leaveDateFrom, setLeaveDateFrom] = useState<string>('');
  const [leaveDateTo, setLeaveDateTo] = useState<string>('');
  const [leaveRemarksById, setLeaveRemarksById] = useState<Record<number, string>>({});
  const [leaveActionLoadingId, setLeaveActionLoadingId] = useState<number | null>(null);

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
  /** True when GET /branches failed (e.g. 503) — show guidance, not a generic error toast. */
  const [branchesListUnavailable, setBranchesListUnavailable] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [branchForm, setBranchForm] = useState<BranchFormState>({
    name: '',
    location: '',
    timezone: 'Asia/Kolkata',
    logoUrl: '',
    phone: '',
    googleReviewUrl: '',
    pincode: '',
    directorsEmail: '',
    showTotalAmountToCustomers: true,
    enableNewOrderRinging: true,
    newOrderSoundPreset: 'ring',
    newOrderSoundVolume: 1,
  });
  const [createBranchOpen, setCreateBranchOpen] = useState(false);
  const [createBranchForm, setCreateBranchForm] = useState<BranchFormState>({
    name: '',
    location: '',
    timezone: 'Asia/Kolkata',
    logoUrl: '',
    phone: '',
    googleReviewUrl: '',
    pincode: '',
    directorsEmail: '',
    showTotalAmountToCustomers: true,
    enableNewOrderRinging: true,
    newOrderSoundPreset: 'ring',
    newOrderSoundVolume: 1,
  });
  const [createBranchDirectorInput, setCreateBranchDirectorInput] = useState('');
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
    const savedLogoUrl = localStorage.getItem('branch_logo_url');
    const savedBranchName = localStorage.getItem('branch_name');
    if (savedLogoUrl || savedBranchName) {
      setBranchForm(prev => ({
        ...prev,
        logoUrl: savedLogoUrl || '',
        name: savedBranchName || '',
      }));
    }
  }, []);

  // Removed items state
  const [removedItems, setRemovedItems] = useState<RemovedItem[]>([]);
  const [dailyRemovalSummaries, setDailyRemovalSummaries] = useState<DailyRemovalSummary[]>([]);
  const [removedItemsDateFilter, setRemovedItemsDateFilter] = useState<string>(() =>
    getBusinessDateString()
  );
  const [removedItemsLoading, setRemovedItemsLoading] = useState(false);
  const [totalLoss, setTotalLoss] = useState<number>(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE'); // default: show Active employees (permanent roster)

  // Menu management state
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [viewingCategory, setViewingCategory] = useState<number | null>(null);
  const [menuSortBy, setMenuSortBy] = useState<string>('name');
  const [menuFilterBy, setMenuFilterBy] = useState<string>('all');

  // Salary slips state
  const [salarySlips, setSalarySlips] = useState<any[]>([]);
  const [isSalarySlipDialogOpen, setIsSalarySlipDialogOpen] = useState(false);
  const [salarySlipPrefill, setSalarySlipPrefill] = useState<any>(null);
  const [salaryTableSearch, setSalaryTableSearch] = useState('');
  const [salaryTableMonthFilter, setSalaryTableMonthFilter] = useState('');
  const [salaryTablePage, setSalaryTablePage] = useState(0);
  const SALARY_TABLE_PAGE_SIZE = 10;

  const [monthlyRevenueSnapshots, setMonthlyRevenueSnapshots] = useState<
    {
      id: number;
      year: number;
      month: number;
      yearMonth: string;
      totalOrders: number;
      totalSales: number;
      uniqueCustomers: number;
      newCustomersCount: number;
      avgOrdersPerDay: number;
      paidOrdersCount: number;
      avgOrderValue: number;
      totalLoss: number;
      overtimeHoursApproved: number;
      approvedLeavesCount: number;
      lateEntriesCount: number;
      isLive?: boolean;
    }[]
  >([]);
  const [revenueExpandedYearMonth, setRevenueExpandedYearMonth] = useState<string | null>(null);
  const [monthlyTargetInfo, setMonthlyTargetInfo] = useState<{
    yearMonth: string;
    monthLabel: string;
    targetSet: boolean;
    targetAmount?: number;
    achievedAmount?: number;
    achievedPct?: number;
    expectedPct?: number;
    daysLeft?: number;
    status?: 'ON_TRACK' | 'NEED_TO_PUSH' | 'CRITICAL';
    updatedAt?: string;
  } | null>(null);
  const [monthlyTargetInput, setMonthlyTargetInput] = useState('');
  const [savingMonthlyTarget, setSavingMonthlyTarget] = useState(false);

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
    const liveItems = category.items?.filter((item: any) => item.isActive).length || 0;
    const pendingItems = totalItems - liveItems;
    return { totalItems, liveItems, pendingItems };
  };

  // Filtered and sorted categories for menu search
  const filteredCategories = useMemo(() => {
    let filtered = categories;

    // Apply search filter
    if (menuSearchQuery) {
      filtered = filtered.filter(cat =>
        cat.name.toLowerCase().includes(menuSearchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (menuFilterBy !== 'all') {
      filtered = filtered.filter(cat => {
        const status = getCategoryStatus(cat);
        if (menuFilterBy === 'live') return status.liveItems > 0;
        if (menuFilterBy === 'pending') return status.pendingItems > 0;
        return true;
      });
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      const statusA = getCategoryStatus(a);
      const statusB = getCategoryStatus(b);

      switch (menuSortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'items-asc':
          return statusA.totalItems - statusB.totalItems;
        case 'items-desc':
          return statusB.totalItems - statusA.totalItems;
        case 'live-desc':
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
    return categories.find(c => c.id === viewingCategory);
  }, [categories, viewingCategory]);

  // Roster-active employees (status ACTIVE) — same as employee list "Active" filter
  const activeEmployees = useMemo(() => {
    return employees.filter(e => String(e.status || '').toUpperCase() === 'ACTIVE');
  }, [employees]);

  useEffect(() => {
    isOrderDialogOpenRef.current = isOrderDialogOpen;
  }, [isOrderDialogOpen]);

  // Realtime live-orders updates (Socket.IO). Only active on Overview to avoid background traffic.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!ready) return;
    if (!token) return;
    if (activeSection !== 'overview') return;

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

    const upsert = (o: Order) => {
      if (!o || typeof (o as any).id !== 'number') return;
      setOrders(prev => {
        const idx = prev.findIndex(p => p.id === o.id);
        if (idx >= 0) {
          const copy = prev.slice();
          copy[idx] = { ...copy[idx], ...o };
          return copy;
        }
        return [...prev, o];
      });
    };

    s.on('order:new', (o: Order) => {
      upsert(o);
      setNewOrdersBadge(n => n + 1);
      toast({
        title: 'New order received',
        description: `Order #${(o as any).id ?? ''}`.trim(),
        className: 'border-emerald-500 bg-emerald-50 text-emerald-900 font-medium',
      });
    });

    s.on('order:updated', (o: Order) => {
      upsert(o);
    });

    s.on('order:modified', (o: Order) => {
      upsert(o);
    });

    // Ensure we have the latest snapshot after (re)connect without polling.
    s.on('connect', () => {
      try {
        // Only refresh on Overview and when allowed by existing toggle.
        if (!isOrderDialogOpenRef.current && autoRefreshEnabled) {
          // Background refresh: do not block the UI (no full-screen overlay / loading flag).
          void loadDashboardData({ background: true });
          setNewOrdersBadge(0);
        }
      } catch {
        // ignore
      }
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
  }, [activeSection, ready, toast, token, autoRefreshEnabled]);

  useEffect(() => {
    if (!token) return;
    if (isOrderDialogOpen) return;
    // Avoid background traffic: only auto-load on Overview.
    if (activeSection === 'overview') {
      loadDashboardData();
      setNewOrdersBadge(0);
    }
  }, [token, isOrderDialogOpen, activeSection, autoRefreshEnabled]);

  // Calculate today's stats
  const todayStats: TodayStats = useMemo(() => {
    const todayOrders = orders;
    const paidOrders = todayOrders.filter(o => o.paymentStatus === 'PAID');
    const pendingOrders = todayOrders.filter(o => o.paymentStatus !== 'PAID');

    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = todayOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const activeEmps = employees.filter(
      e => String(e.status || '').toUpperCase() === 'ACTIVE'
    ).length;

    const totalItemsSold = itemSales.reduce((sum, item) => sum + item.quantity, 0);

    const topItem =
      itemSales.length > 0
        ? itemSales.reduce((max, item) => (item.quantity > max.quantity ? item : max), itemSales[0])
        : null;

    return {
      totalRevenue,
      totalOrders,
      pendingPayments: pendingOrders.length,
      paidOrders: paidOrders.length,
      activeEmployees: activeEmps,
      avgOrderValue,
      totalItemsSold,
      topSellingItem: topItem ? { name: topItem.itemName, quantity: topItem.quantity } : null,
    };
  }, [orders, employees, itemSales]);

  const loadDashboardData = async (loadOpts?: { background?: boolean }) => {
    const background = loadOpts?.background === true;
    if (!token) return;

    try {
      if (!background) setLoading(true);

      const fetchOpts = {
        headers: { Authorization: `Bearer ${token}` },
        timeout: API_TIMEOUT_MS,
      };
      const businessDate = getBusinessDateString();
      const requests = [
        { key: 'menu', url: `${apiBase}/menu/admin` },
        { key: 'employees', url: `${apiBase}/employees` },
        // Dashboard "Today" uses business day (04:00 → 03:59), not live/unpaid orders.
        { key: 'orders', url: `${apiBase}/orders/all?date=${encodeURIComponent(businessDate)}` },
        { key: 'traffic', url: `${apiBase}/config/public-traffic` },
        { key: 'dashboardSummary', url: `${apiBase}/reports/dashboard-summary` },
        { key: 'activeShifts', url: `${apiBase}/shift/active` },
        { key: 'overtimeSummary', url: `${apiBase}/overtime/summary` },
        { key: 'branches', url: `${apiBase}/branches` },
        { key: 'salarySlips', url: `${apiBase}/reports/salary-slips` },
        {
          key: 'monthlyRevenueSnapshots',
          url: `${apiBase}/reports/monthly-revenue-snapshots`,
        },
        {
          key: 'monthlyTargetCurrent',
          url: `${apiBase}/monthly-targets/branch/${Number((branch as any)?.id || 0)}`,
        },
      ] as const;

      // Batches avoid HTTP/1.1 parallel connection limits (~6 per host) causing queued
      // requests to hit the global timeout and reject (often reported as "branches" failing).
      const PARALLEL_BATCH = 5;
      const results: PromiseSettledResult<Response>[] = [];
      for (let i = 0; i < requests.length; i += PARALLEL_BATCH) {
        const batch = requests.slice(i, i + PARALLEL_BATCH);
        const batchResults = await Promise.allSettled(
          batch.map(r => fetchWithTimeoutRetry(r.url, fetchOpts))
        );
        results.push(...batchResults);
      }

      const failed: string[] = [];
      const byKey = new Map<(typeof requests)[number]['key'], Response | null>();
      results.forEach((res, idx) => {
        const key = requests[idx]!.key;
        if (res.status === 'fulfilled') {
          byKey.set(key, res.value);
        } else {
          byKey.set(key, null);
          // Branch list is optional for many screens; handle without scary toast (see below).
          if (key !== 'branches') {
            failed.push(requests[idx]!.key);
          }
          console.error('[AdminDashboard] Fetch failed:', requests[idx]!.url, res.reason);
        }
      });

      const menuRes = byKey.get('menu');
      const employeesRes = byKey.get('employees');
      const ordersRes = byKey.get('orders');
      const trafficRes = byKey.get('traffic');
      const dashboardSummaryRes = byKey.get('dashboardSummary');
      const activeShiftsRes = byKey.get('activeShifts');
      const overtimeSummaryRes = byKey.get('overtimeSummary');
      const branchesRes = byKey.get('branches');
      const salarySlipsRes = byKey.get('salarySlips');
      const monthlyRevenueRes = byKey.get('monthlyRevenueSnapshots');
      const monthlyTargetRes = byKey.get('monthlyTargetCurrent');

      // Read each response body only once (avoid "body stream already read")
      const menuData = menuRes?.ok ? await menuRes.json() : null;
      const empData = employeesRes?.ok ? await employeesRes.json() : null;
      const ordersDataRaw = ordersRes?.ok ? await ordersRes.json() : null;
      const ordersData: Order[] = Array.isArray(ordersDataRaw)
        ? (ordersDataRaw as Order[])
        : Array.isArray((ordersDataRaw as any)?.orders)
          ? ((ordersDataRaw as any).orders as Order[])
          : [];
      const salarySlipData = salarySlipsRes?.ok ? await salarySlipsRes.json() : null;
      const monthlyRevenueData = monthlyRevenueRes?.ok ? await monthlyRevenueRes.json() : null;
      const monthlyTargetData = monthlyTargetRes?.ok ? await monthlyTargetRes.json() : null;
      if (trafficRes?.ok) {
        const trafficData = await trafficRes.json();
        setPublicNetworkTraffic(trafficData.publicNetworkTraffic ?? 0);
      }
      if (dashboardSummaryRes?.ok) {
        const summaryData = await dashboardSummaryRes.json();
        setPerformanceSummary(summaryData);
      }
      if (activeShiftsRes?.ok) {
        const activeData = await activeShiftsRes.json();
        setActiveShiftsNow(activeData.shifts || []);
      }
      if (overtimeSummaryRes?.ok) {
        const summary = await overtimeSummaryRes.json();
        setOvertimeSummary({
          pendingOvertimeCount: summary.pendingOvertimeCount ?? 0,
          overtimeRunningCount: summary.overtimeRunningCount ?? 0,
          overtimeRunning: summary.overtimeRunning ?? [],
        });
      }
      const parseBranchesPayload = (raw: unknown) => {
        return Array.isArray(raw)
          ? raw
          : Array.isArray((raw as any)?.branches)
            ? (raw as any).branches
            : Array.isArray((raw as any)?.data)
              ? (raw as any).data
              : [];
      };

      if (branchesRes?.ok) {
        const branchesData = await branchesRes.json();
        const branchList = parseBranchesPayload(branchesData);
        setBranches(branchList);
        setBranchesListUnavailable(false);
      } else {
        // Transient 503/timeouts must not wipe the list — branches may still exist in the DB.
        setBranchesListUnavailable(true);
        try {
          const retry = await fetchWithTimeoutRetry(`${apiBase}/branches`, fetchOpts);
          if (retry.ok) {
            const branchList = parseBranchesPayload(await retry.json());
            setBranches(branchList);
            setBranchesListUnavailable(false);
          }
        } catch {
          // Keep existing branch state (same as employee dialog: do not overwrite with [] on failure).
        }
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
            typeof s?.month === 'number'
              ? (monthNumberToName(s.month) ?? String(s.month))
              : s?.month,
          employeeCode: s?.employee?.employeeCode ?? s?.employeeCode,
          allowances: Array.isArray(s?.allowances) ? s.allowances : [],
          deductions: Array.isArray(s?.deductions) ? s.deductions : [],
        }));
        setSalarySlips(normalized);
      }

      if (monthlyRevenueData) {
        const raw = Array.isArray((monthlyRevenueData as any)?.snapshots)
          ? (monthlyRevenueData as any).snapshots
          : Array.isArray(monthlyRevenueData)
            ? monthlyRevenueData
            : [];
        const live = (monthlyRevenueData as any)?.currentMonthLive;
        const normalizeRow = (r: any, isLive?: boolean) => {
          const paid = Number(r.paidOrdersCount ?? 0);
          const totalSales = Number(r.totalSales ?? 0);
          const avgFromApi = Number(r.avgOrderValue ?? NaN);
          const avgOrderValue =
            Number.isFinite(avgFromApi) && avgFromApi >= 0
              ? avgFromApi
              : paid > 0
                ? totalSales / paid
                : 0;
          return {
            id: typeof r.id === 'number' && Number.isFinite(r.id) ? r.id : 0,
            year: Number(r.year),
            month: Number(r.month),
            yearMonth: String(r.yearMonth ?? ''),
            totalOrders: Number(r.totalOrders ?? 0),
            totalSales,
            uniqueCustomers: Number(r.uniqueCustomers ?? 0),
            newCustomersCount: Number(r.newCustomersCount ?? r.uniqueCustomers ?? 0),
            avgOrdersPerDay: Number(r.avgOrdersPerDay ?? 0),
            paidOrdersCount: paid,
            avgOrderValue,
            totalLoss: Number(r.totalLoss ?? 0),
            overtimeHoursApproved: Number(r.overtimeHoursApproved ?? 0),
            approvedLeavesCount: Number(r.approvedLeavesCount ?? 0),
            lateEntriesCount: Number(r.lateEntriesCount ?? 0),
            ...(isLive ? { isLive: true as const } : {}),
          };
        };
        let combined = raw.map((r: any) => normalizeRow(r));
        if (
          live &&
          typeof live.yearMonth === 'string' &&
          !combined.some(x => x.yearMonth === live.yearMonth)
        ) {
          combined = [normalizeRow(live, true), ...combined];
        }
        combined.sort((a, b) => b.year - a.year || b.month - a.month);
        setMonthlyRevenueSnapshots(combined);
      }
      if (monthlyTargetData && typeof monthlyTargetData === 'object') {
        const y = Number((monthlyTargetData as any).year);
        const m = Number((monthlyTargetData as any).month);
        const ym =
          Number.isFinite(y) && Number.isFinite(m)
            ? `${y}-${String(m).padStart(2, '0')}`
            : String((monthlyTargetData as any).yearMonth || '');
        setMonthlyTargetInfo({
          yearMonth: ym,
          monthLabel: String((monthlyTargetData as any).monthLabel || ym),
          targetSet: Boolean((monthlyTargetData as any).targetSet),
          targetAmount: Number((monthlyTargetData as any).targetAmount ?? 0),
          achievedAmount: Number((monthlyTargetData as any).achievedAmount ?? 0),
          achievedPct: Number((monthlyTargetData as any).achievedPct ?? 0),
          expectedPct: Number((monthlyTargetData as any).expectedPct ?? 0),
          daysLeft: Number((monthlyTargetData as any).daysLeft ?? 0),
          status: (['ON_TRACK', 'NEED_TO_PUSH', 'CRITICAL'] as const).includes(
            (monthlyTargetData as any).status
          )
            ? ((monthlyTargetData as any).status as 'ON_TRACK' | 'NEED_TO_PUSH' | 'CRITICAL')
            : undefined,
          updatedAt:
            typeof (monthlyTargetData as any).updatedAt === 'string'
              ? (monthlyTargetData as any).updatedAt
              : undefined,
        });
      } else {
        setMonthlyTargetInfo(null);
      }

      if (menuData) {
        setCategories(menuData);
        const itemMap = new Map<string, ItemSales>();
        if (ordersData) {
          ordersData.forEach((order: Order) => {
            if (order.paymentStatus !== 'PAID') return;
            order.items.forEach((item: OrderItem) => {
              const key = `${item.name}\0${item.variant ?? ''}`;
              const displayName = formatItemDisplayName(item.name, item.variant);
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
        setItemSales(Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity));
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
              if (order.paymentStatus === 'PAID') {
                empSale.revenue += order.totalAmount;
              }
            }
          });
          setEmployeeSales(Array.from(empSalesMap.values()).sort((a, b) => b.revenue - a.revenue));
        }
      }

      if (ordersData) {
        setOrders(ordersData);
      }

      const failedForToast = failed.filter(k => k !== 'branches');
      if (!background && failedForToast.length > 0) {
        toast({
          title: 'Dashboard partially loaded',
          description: `Some data could not be loaded (${failedForToast.join(', ')}). Please refresh.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      if (!background) {
        const isTimeout = error instanceof Error && error.name === 'AbortError';
        toast({
          title: 'Error',
          description: isTimeout
            ? 'Request timed out. The server may be slow—try again.'
            : 'Failed to load dashboard data',
          variant: 'destructive',
        });
      }
    } finally {
      if (!background) setLoading(false);
      setHasLoadedOnce(true);
      // First dashboard load (admin) can clear the global loader shown from login
      stopGlobalLoading();
    }
  };

  // When salary slip dialog opens, refresh employees so the dropdown has the latest active list
  useEffect(() => {
    if (!token || !isSalarySlipDialogOpen) return;
    let cancelled = false;
    fetch(`${apiBase}/employees`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
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
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Category deleted' });
        setCategories(prev => prev.filter(c => c.id !== id));
        if (viewingCategory === id) setViewingCategory(null);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete category',
        variant: 'destructive',
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
    const [name, setName] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [imagePreview, setImagePreview] = useState('');
    const [highlightAsNewLaunch, setHighlightAsNewLaunch] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (open) {
        if (editingCategory) {
          setName(editingCategory.name);
          setImageUrl(editingCategory.imageUrl || '');
          setImagePreview(editingCategory.imageUrl || '');
          const u = editingCategory.highlightNewUntil;
          setHighlightAsNewLaunch(!!(u && new Date(u) > new Date()));
        } else {
          setName('');
          setImageUrl('');
          setImagePreview('');
          setHighlightAsNewLaunch(true);
        }
      }
    }, [open, editingCategory]);

    const handleSubmit = async () => {
      if (!token || !name.trim()) return;
      setSaving(true);
      try {
        if (editingCategory) {
          const res = await fetch(`${apiBase}/menu/categories/${editingCategory.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: name.trim(),
              imageUrl: imageUrl.trim() || undefined,
              highlightAsNewLaunch,
            }),
          });
          const data = await res.json();
          if (!res.ok)
            throw new Error((data as { message?: string }).message || 'Failed to update category');
          toast({ title: 'Success', description: 'Category updated' });
          onOpenChange(false);
          onUpdated(data);
        } else {
          const res = await fetch(`${apiBase}/menu/categories`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: name.trim(),
              imageUrl: imageUrl.trim() || undefined,
              highlightAsNewLaunch,
            }),
          });
          const data = await res.json();
          if (!res.ok)
            throw new Error((data as { message?: string }).message || 'Failed to create category');
          toast({ title: 'Success', description: 'Category created' });
          onOpenChange(false);
          onCreated(data);
        }
      } catch (e) {
        toast({
          title: 'Error',
          description: e instanceof Error ? e.message : 'Failed to save category',
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-describedby="category-dialog-desc">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'New Category'}</DialogTitle>
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
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Image URL</Label>
              <Input
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={e => {
                  setImageUrl(e.target.value);
                  setImagePreview(e.target.value);
                }}
              />
            </div>
            {(imagePreview || editingCategory?.imageUrl) && (
              <div className="grid gap-2">
                <Label>Image Preview</Label>
                <div className="rounded-lg border p-2">
                  <img
                    src={imagePreview || editingCategory?.imageUrl}
                    alt="Category preview"
                    className="h-32 w-full rounded-md object-cover"
                    onError={e => {
                      e.currentTarget.style.display = 'none';
                      (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove(
                        'hidden'
                      );
                    }}
                  />
                  <div className="text-muted-foreground hidden py-8 text-center text-sm">
                    Failed to load image
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2 rounded-lg border border-violet-100 bg-violet-50/40 p-3">
              <Checkbox
                id="cat-highlight-new"
                checked={highlightAsNewLaunch}
                onCheckedChange={c => setHighlightAsNewLaunch(!!c)}
              />
              <Label htmlFor="cat-highlight-new" className="text-sm leading-snug font-medium">
                Highlight category as <span className="text-violet-700">New launch</span> on customer
                menu (7 days from save). Uncheck to clear the highlight.
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? (
                <>
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {editingCategory ? 'Updating...' : 'Creating...'}
                </>
              ) : editingCategory ? (
                'Update'
              ) : (
                'Create'
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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
          name: '',
          description: '',
          basePrice: 0,
          hasHalf: false,
          halfPrice: 0,
          isActive: true,
          categoryId: 0,
          imageUrl: '',
          notifyCustomers: false,
          highlightAsNewLaunch: true,
        });
        setIsItemDialogOpen(false);
        loadDashboardData();
        toast({ title: 'Success', description: 'Menu item created' });
        if (data.broadcast?.mobileCount > 0) {
          toast({
            title: 'Notify customers',
            description: `Broadcast prepared for ${data.broadcast.mobileCount} customers. Use WhatsApp to send the new launch message.`,
          });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'Error',
          description: (err as { message?: string }).message || 'Failed to create item',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create item',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateItem = async () => {
    if (!token || !editingItem) return;
    try {
      const { notifyCustomers: _omitNotify, ...rest } = itemForm;
      const res = await fetch(`${apiBase}/menu/items/${editingItem.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: rest.name,
          description: rest.description?.trim() ? rest.description : undefined,
          imageUrl: rest.imageUrl?.trim() || undefined,
          basePrice: rest.basePrice,
          hasHalf: rest.hasHalf,
          halfPrice: rest.hasHalf ? rest.halfPrice : undefined,
          isActive: rest.isActive,
          categoryId: rest.categoryId,
          highlightAsNewLaunch: rest.highlightAsNewLaunch,
        }),
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Menu item updated' });
        setEditingItem(null);
        setIsItemDialogOpen(false);
        loadDashboardData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'Error',
          description: (err as { message?: string }).message || 'Failed to update item',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update item',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/menu/items/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Menu item deleted' });
        loadDashboardData();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive',
      });
    }
  };

  const handleResendVerification = async (empId: number) => {
    if (!token) return;
    setSendingVerification(empId);
    try {
      const res = await fetch(`${apiBase}/employees/${empId}/resend-verification`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Verification email sent.' });
        loadDashboardData();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: 'Error',
          description:
            (data as { message?: string }).message ||
            'Failed to send email. Check SMTP settings in .env.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Network error. Check backend and SMTP settings.',
        variant: 'destructive',
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
      const res = await fetchWithTimeout(`${apiBase}/employees/${emp.id}/verify-and-send-invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        // Allow extra time in production where SMTP can be slow,
        // so the request does not fail with a client-side timeout
        // while the server is still sending the email.
        timeout: 60000,
      });
      const contentType = res.headers.get('content-type');
      const isJson = contentType?.includes('application/json');
      const data = isJson
        ? await res.json().catch(() => ({}))
        : { message: await res.text().catch(() => 'Server error') };
      if (res.ok) {
        const { _message, ...updated } = data as {
          _message?: string;
          [k: string]: unknown;
        };
        setEmployees(prev => prev.map(e => (e.id === emp.id ? { ...e, ...updated } : e)));
        setEmployeeToVerify(null);
        if (_message) {
          toast({ title: 'Already verified', description: _message });
        } else {
          toast({
            title: 'Invite sent',
            description: `${emp.name} will receive login credentials via email.`,
          });
        }
      } else {
        const payload = data as { message?: string; detail?: string };
        const desc =
          payload.message ||
          (res.status === 503
            ? 'Email is not configured on the server. Add EMAIL_SMTP_* and EMAIL_FROM_ADDRESS in the backend environment (e.g. Render dashboard).'
            : res.status === 500
              ? 'Server could not send email. Check backend SMTP settings and logs.'
              : 'Failed to send invite.');
        const extra = payload.detail ? ` ${payload.detail}` : '';
        toast({
          title: 'Error',
          description: desc + extra,
          variant: 'destructive',
        });
      }
    } catch (e) {
      const isAbort = e instanceof Error && e.name === 'AbortError';
      toast({
        title: 'Error',
        description: isAbort
          ? 'Request timed out. Check your connection and try again.'
          : 'Failed to send invite. Check network and backend.',
        variant: 'destructive',
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
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast({
          title: 'Success',
          description: `Order marked ${status.replace('_', ' ').toLowerCase()}`,
        });
        setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status } : o)));
        setAllOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status } : o)));
        setOrdersByTable(prev =>
          prev.map(t => ({
            ...t,
            orders: (t.orders || []).map((o: Order) => (o.id === orderId ? { ...o, status } : o)),
          }))
        );
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(prev => (prev ? { ...prev, status } : null));
          setPopupDisplayOrder(prev => (prev && prev.id === orderId ? { ...prev, status } : null));
        }
        setIsOrderDialogOpen(false);
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: 'Error',
          description: data.message || 'Failed to update order',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update order',
        variant: 'destructive',
      });
    } finally {
      setCompletingOrderId(null);
    }
  };

  // Load all orders with filters
  const loadAllOrders = async () => {
    if (!token) return;
    setOrdersLoading(true);
    try {
      const params = new URLSearchParams();
      // If a custom range is provided, use start/end; otherwise fall back to single business date
      if (orderStartDate) params.append('startDate', orderStartDate);
      if (orderEndDate) params.append('endDate', orderEndDate);
      if (!orderStartDate && !orderEndDate && orderDateFilter) {
        params.append('date', orderDateFilter);
      }

      const res = await fetch(`${apiBase}/orders/all?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAllOrders(data.orders);
        setOrdersByTable(data.byTable);
      }
    } catch (error) {
      // ignore (UI handles empty/error states)
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleOpenOrderDialog = useCallback((order: Order) => {
    setSelectedOrder(order);
    setPopupDisplayOrder(
      typeof structuredClone === 'function'
        ? structuredClone(order)
        : JSON.parse(JSON.stringify(order))
    );
    setIsOrderDialogOpen(true);
  }, []);

  // Load shift history
  const loadShiftHistory = async () => {
    if (!token) return;
    setShiftHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (hoursEmployeeFilter !== 'all') params.append('employeeId', hoursEmployeeFilter);
      if (hoursStartDate) params.append('startDate', hoursStartDate);
      if (hoursEndDate) params.append('endDate', hoursEndDate);

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
      // ignore (UI handles empty/error states)
    } finally {
      setShiftHistoryLoading(false);
    }
  };

  const loadOvertime = useCallback(async () => {
    if (!token) return;
    setOvertimeLoading(true);
    try {
      const params = new URLSearchParams();
      if (overtimeDateFrom) params.append('dateFrom', overtimeDateFrom);
      if (overtimeDateTo) params.append('dateTo', overtimeDateTo);
      if (overtimeEmployeeFilter !== 'all') params.append('employeeId', overtimeEmployeeFilter);
      const res = await fetch(`${apiBase}/overtime?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOvertimeRecords(data);
      }
    } catch (e) {
      // ignore (UI handles empty/error states)
    } finally {
      setOvertimeLoading(false);
    }
  }, [token, apiBase, overtimeDateFrom, overtimeDateTo, overtimeEmployeeFilter]);

  const loadLate = useCallback(async () => {
    if (!token) return;
    setLateLoading(true);
    try {
      const params = new URLSearchParams();
      if (lateDateFrom) params.append('dateFrom', lateDateFrom);
      if (lateDateTo) params.append('dateTo', lateDateTo);
      if (lateEmployeeFilter !== 'all') params.append('employeeId', lateEmployeeFilter);
      const res = await fetch(`${apiBase}/late?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLateEntries(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      // ignore (UI handles empty/error states)
    } finally {
      setLateLoading(false);
    }
  }, [token, apiBase, lateDateFrom, lateDateTo, lateEmployeeFilter]);

  const loadLeaves = useCallback(async () => {
    if (!token) return;
    setLeaveLoading(true);
    try {
      const params = new URLSearchParams();
      if (leaveDateFrom) params.append('startDate', leaveDateFrom);
      if (leaveDateTo) params.append('endDate', leaveDateTo);
      if (leaveEmployeeFilter !== 'all') params.append('employeeId', leaveEmployeeFilter);
      if (leaveStatusFilter && leaveStatusFilter !== 'all')
        params.append('status', leaveStatusFilter);
      const res = await fetch(`${apiBase}/leaves?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data?.leaves) ? data.leaves : Array.isArray(data) ? data : [];
        setLeaveRequests(list);
      }
    } catch {
      // ignore (UI handles empty/error states)
    } finally {
      setLeaveLoading(false);
    }
  }, [token, apiBase, leaveDateFrom, leaveDateTo, leaveEmployeeFilter, leaveStatusFilter]);

  const updateLeaveStatus = useCallback(
    async (id: number, status: 'APPROVED' | 'REJECTED') => {
      if (!token) return;
      setLeaveActionLoadingId(id);
      try {
        const res = await fetch(`${apiBase}/leaves/${id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            remarks: leaveRemarksById[id]?.trim() || undefined,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            (data && typeof data === 'object' && 'message' in data
              ? String((data as any).message || '')
              : '') || `Failed to ${status.toLowerCase()} leave`
          );
        }
        toast({
          title: status === 'APPROVED' ? 'Leave approved' : 'Leave rejected',
          description: 'Employee has been notified by email.',
        });
        await loadLeaves();
      } catch (e) {
        toast({
          title: 'Action failed',
          description: e instanceof Error ? e.message : 'Could not update leave status',
          variant: 'destructive',
        });
      } finally {
        setLeaveActionLoadingId(null);
      }
    },
    [token, apiBase, leaveRemarksById, loadLeaves, toast]
  );

  // Debounce late filters so Apply feels reliable and avoids spam fetches
  const lateDebounceTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!token) return;
    if (activeSection !== 'late') return;
    if (lateDebounceTimerRef.current) window.clearTimeout(lateDebounceTimerRef.current);
    lateDebounceTimerRef.current = window.setTimeout(() => {
      loadLate();
    }, 350);
    return () => {
      if (lateDebounceTimerRef.current) window.clearTimeout(lateDebounceTimerRef.current);
    };
  }, [token, activeSection, lateDateFrom, lateDateTo, lateEmployeeFilter, loadLate]);

  // Load branch, branches list, and notifications
  const loadSettings = async () => {
    if (!token) return;
    try {
      const parseBranchesPayload = (raw: unknown) => {
        return Array.isArray(raw)
          ? raw
          : Array.isArray((raw as any)?.branches)
            ? (raw as any).branches
            : Array.isArray((raw as any)?.data)
              ? (raw as any).data
              : [];
      };

      const [branchRes, branchesRes, notifRes] = await Promise.all([
        fetchWithTimeout(`${apiBase}/config/branch`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: API_TIMEOUT_MS,
        }),
        fetchWithTimeoutRetry(`${apiBase}/branches`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: API_TIMEOUT_MS,
        }),
        fetch(`${apiBase}/config/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      let branchDataForFallback: Record<string, unknown> | null = null;
      if (branchRes.ok) {
        const branchData = await branchRes.json();
        branchDataForFallback = branchData;
        setBranch(branchData);
        setBranchForm({
          name: branchData?.name || '',
          location: branchData?.location || '',
          timezone: branchData?.timezone || 'Asia/Kolkata',
          logoUrl: branchData?.logoUrl || '',
          phone: branchData?.phone || '',
          googleReviewUrl: branchData?.googleReviewUrl || '',
          pincode: branchData?.pincode || '',
          directorsEmail: branchData?.directorsEmail || '',
          showTotalAmountToCustomers:
            typeof branchData?.showTotalAmountToCustomers === 'boolean'
              ? branchData.showTotalAmountToCustomers
              : true,
          enableNewOrderRinging:
            typeof branchData?.enableNewOrderRinging === 'boolean'
              ? branchData.enableNewOrderRinging
              : true,
          newOrderSoundPreset: branchData?.newOrderSoundPreset || 'ring',
          newOrderSoundVolume:
            typeof branchData?.newOrderSoundVolume === 'number'
              ? branchData.newOrderSoundVolume
              : 1,
        });
      } else {
        setBranch(null);
        branchDataForFallback = null;
      }
      if (branchesRes.ok) {
        const branchesData = await branchesRes.json();
        const branchList = parseBranchesPayload(branchesData);
        setBranches(branchList);
        setBranchesListUnavailable(false);
      } else {
        setBranchesListUnavailable(true);
        try {
          const retry = await fetchWithTimeoutRetry(`${apiBase}/branches`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: API_TIMEOUT_MS,
          });
          if (retry.ok) {
            const branchList = parseBranchesPayload(await retry.json());
            setBranches(branchList);
            setBranchesListUnavailable(false);
          } else if (
            branchDataForFallback &&
            typeof (branchDataForFallback as { id?: unknown }).id === 'number'
          ) {
            setBranches([branchDataForFallback as (typeof branches)[number]]);
            setBranchesListUnavailable(false);
          }
        } catch {
          if (
            branchDataForFallback &&
            typeof (branchDataForFallback as { id?: unknown }).id === 'number'
          ) {
            setBranches([branchDataForFallback as (typeof branches)[number]]);
            setBranchesListUnavailable(false);
          }
        }
      }
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        const list = Array.isArray(notifData) ? notifData : [];
        try {
          const clearedAt = localStorage.getItem('dm_notifications_cleared_at');
          const filtered = clearedAt
            ? list.filter((n: any) => new Date(n.createdAt || 0).getTime() > Number(clearedAt))
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
      // ignore (UI handles empty/error states)
    }
  };

  const handleCreateBranch = async () => {
    const name = createBranchForm.name.trim();
    const location = createBranchForm.location.trim();
    const logoUrl = createBranchForm.logoUrl.trim();
    if (!token || !name || !location || !logoUrl) return;
    setSavingBranch(true);
    try {
      // Cold Railway deploys often exceed 25s; give POST room to complete after wake-up.
      const res = await fetchWithTimeoutRetry(
        `${apiBase}/branches`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          timeout: Math.max(API_TIMEOUT_MS, 90_000),
          body: JSON.stringify({
            name,
            location,
            timezone: createBranchForm.timezone || undefined,
            logoUrl,
            phone: createBranchForm.phone.trim() || undefined,
            googleReviewUrl: createBranchForm.googleReviewUrl.trim() || undefined,
            pincode: createBranchForm.pincode.trim() || undefined,
            directorsEmail: createBranchForm.directorsEmail.trim() || undefined,
            showTotalAmountToCustomers: !!createBranchForm.showTotalAmountToCustomers,
          }),
        },
        5
      );
      if (res.ok) {
        const newBranch = await res.json();
        setBranches(prev => [...prev, newBranch]);
        setBranchesListUnavailable(false);
        setCreateBranchOpen(false);
        setCreateBranchForm({
          name: '',
          location: '',
          timezone: 'Asia/Kolkata',
          logoUrl: '',
          phone: '',
          googleReviewUrl: '',
          pincode: '',
          directorsEmail: '',
          showTotalAmountToCustomers: true,
        });
        toast({ title: 'Success', description: 'Branch created' });
      } else {
        const description = await readApiErrorMessage(res);
        toast({
          title: 'Could not create branch',
          description,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Could not create branch',
        description: describeFetchFailure(error),
        variant: 'destructive',
      });
    } finally {
      setSavingBranch(false);
    }
  };

  // Update branch settings
  const handleUpdateBranch = async () => {
    const branchToUpdate = branch;
    if (!token || !branchToUpdate?.id) {
      toast({
        title: 'Cannot save',
        description: 'Select a branch above (Edit in Branch Settings), then save.',
        variant: 'destructive',
      });
      return;
    }
    setSavingBranch(true);
    try {
      const { directorsEmail: _de, ...branchPayload } = branchForm;
      const res = await fetch(`${apiBase}/config/branch/${branchToUpdate.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(branchPayload),
      });
      if (res.ok) {
        toast({
          title: 'Saved successfully',
          description: 'Branch settings updated.',
        });
        const updated = await res.json();
        setBranch(updated);
        setBranchForm({
          name: updated?.name || '',
          location: updated?.location || '',
          timezone: updated?.timezone || 'Asia/Kolkata',
          logoUrl: updated?.logoUrl || '',
          phone: updated?.phone || '',
          googleReviewUrl: updated?.googleReviewUrl || '',
          pincode: updated?.pincode || '',
          directorsEmail: updated?.directorsEmail || '',
          showTotalAmountToCustomers:
            typeof updated?.showTotalAmountToCustomers === 'boolean'
              ? updated.showTotalAmountToCustomers
              : true,
          enableNewOrderRinging:
            typeof updated?.enableNewOrderRinging === 'boolean'
              ? updated.enableNewOrderRinging
              : true,
          newOrderSoundPreset: updated?.newOrderSoundPreset || 'ring',
          newOrderSoundVolume:
            typeof updated?.newOrderSoundVolume === 'number' ? updated.newOrderSoundVolume : 1,
        });
        if (typeof window !== 'undefined') {
          if (updated?.name) window.localStorage.setItem('branch_name', updated.name);
          if (updated?.logoUrl) window.localStorage.setItem('branch_logo_url', updated.logoUrl);
        }
        await loadSettings();
      } else {
        const description = await readApiErrorMessage(res);
        toast({
          title: 'Could not save branch',
          description,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Network error or server unreachable. Try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setSavingBranch(false);
    }
  };

  // Delete branch
  const handleDeleteBranch = async (branchId: number) => {
    if (!token) return;
    if (!window.confirm('Are you sure you want to delete this branch? This action cannot be undone.')) {
      return;
    }
    setSavingBranch(true);
    try {
      const res = await fetch(`${apiBase}/branches/${branchId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast({
          title: 'Branch deleted',
          description: 'The branch has been permanently removed.',
        });
        await loadSettings();
      } else {
        const description = await readApiErrorMessage(res);
        toast({
          title: 'Could not delete branch',
          description,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Network error or server unreachable. Try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setSavingBranch(false);
    }
  };

  // Load removed items report
  const loadRemovedItems = async () => {
    if (!token) return;
    setRemovedItemsLoading(true);
    try {
      const params = new URLSearchParams();
      if (removedItemsDateFilter) {
        params.append('date', removedItemsDateFilter);
      }

      const res = await fetch(`${apiBase}/orders/reports/removed-items?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Backend returns removedItems (with unitPrice, employee, order.table), dailyStats, summary.totalLoss
        const items = (data.removedItems || []).map((item: any) => ({
          id: item.id,
          orderId: item.orderId,
          itemName: item.itemName,
          itemPrice: item.unitPrice ?? 0,
          quantity: item.quantity,
          reason: item.reason || '',
          removedBy: item.employee?.name ?? '—',
          removedAt: item.createdAt ?? item.date,
          tableNumber: item.order?.table?.tableNumber,
        }));
        setRemovedItems(items);
        setDailyRemovalSummaries(data.dailyStats || []);
        setTotalLoss(data.summary?.totalLoss ?? 0);
      }
    } catch (error) {
      // ignore (UI handles empty/error states)
    } finally {
      setRemovedItemsLoading(false);
    }
  };

  const loadCustomerQueries = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (queryStatusFilter && queryStatusFilter !== 'all')
        params.append('status', queryStatusFilter);
      const res = await fetch(`${apiBase}/customer-queries?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCustomerQueries(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      // ignore (UI handles empty/error states)
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
        const count = list.filter((q: { status: string }) => q.status !== 'RESOLVED').length;
        setPendingQueriesCount(count);
      }
    } catch (_) {}
  }, [token, apiBase]);

  // Effects for loading data when sections change
  useEffect(() => {
    // Backward compatibility: older builds stored "orders" in localStorage.
    // We removed "orders" from sidebar; treat it as "all-orders".
    if (activeSection === 'orders') {
      setActiveSection('all-orders');
      return;
    }
    if (token && activeSection === 'all-orders') {
      loadAllOrders();
    }
  }, [token, activeSection, orderDateFilter, orderTableFilter]);

  useEffect(() => {
    if (token && activeSection === 'removed-items') {
      loadRemovedItems();
    }
  }, [token, activeSection, removedItemsDateFilter]);

  // Default date range for Work Hours when section is first opened (default: current day only)
  useEffect(() => {
    if (activeSection === 'hours' && !hoursStartDate && !hoursEndDate) {
      const now = new Date();
      setHoursStartDate(now.toISOString().slice(0, 10));
      setHoursEndDate(now.toISOString().slice(0, 10));
    }
  }, [activeSection]);

  useEffect(() => {
    if (token && activeSection === 'hours') {
      loadShiftHistory();
    }
  }, [token, activeSection, hoursEmployeeFilter, hoursStartDate, hoursEndDate]);

  useEffect(() => {
    if (activeSection === 'overtime' && !overtimeDateFrom && !overtimeDateTo) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setOvertimeDateFrom(start.toISOString().slice(0, 10));
      setOvertimeDateTo(now.toISOString().slice(0, 10));
    }
  }, [activeSection]);

  useEffect(() => {
    if (token && activeSection === 'overtime') {
      loadOvertime();
    }
  }, [token, activeSection, loadOvertime]);

  useEffect(() => {
    if (activeSection === 'late' && !lateDateFrom && !lateDateTo) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setLateDateFrom(start.toISOString().slice(0, 10));
      setLateDateTo(now.toISOString().slice(0, 10));
    }
  }, [activeSection]);

  useEffect(() => {
    if (token && activeSection === 'late') {
      loadLate();
    }
  }, [token, activeSection, loadLate]);

  useEffect(() => {
    if (token && activeSection === 'leaves') {
      loadLeaves();
    }
  }, [token, activeSection, loadLeaves]);

  useEffect(() => {
    if (token && activeSection === 'settings') {
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
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
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
    if (token && activeSection === 'customer-queries') {
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
      const res = await fetch(`${apiBase}/orders/customer-leaderboard?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
    if (token && activeSection === 'customer-leaderboard') {
      loadLeaderboard();
    }
  }, [token, activeSection, loadLeaderboard]);

  useEffect(() => {
    // Only fetch when user is actually looking at the "Raised Requests" section.
    // Requirement: avoid background polling for unrelated screens.
    if (token && activeSection === 'customer-queries') loadPendingQueriesCount();
  }, [token, loadPendingQueriesCount]);

  useEffect(() => {
    // Disable background polling (bandwidth + rate limit). Use on-demand fetch instead.
    return;
  }, []);

  // Load notifications on mount and poll for admin (new orders, status updates). Respect "Clear all" (persisted in localStorage).
  useEffect(() => {
    // Requirement: the ONLY auto-updating API should be live orders, only on live screen.
    // So notifications are fetched only when user is on Overview or opens the Notifications UI.
    if (!token) return;
    if (activeSection !== 'overview') return;
    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${apiBase}/config/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          try {
            const clearedAt = localStorage.getItem('dm_notifications_cleared_at');
            const filtered = clearedAt
              ? list.filter((n: any) => new Date(n.createdAt || 0).getTime() > Number(clearedAt))
              : list;
            setNotifications(filtered);
          } catch {
            setNotifications(list);
          }
        }
      } catch (_) {}
    };
    fetchNotifications();
    return () => {};
  }, [token, activeSection]);

  // Auto refresh orders every 10 seconds when on orders page – skip while order dialog is open to keep popup stable
  useEffect(() => {
    // Requirement: disable non-live auto-refresh. All Orders should be manual refresh/filter-driven.
    return;
  }, []);

  // ============ SECTIONS ============

  // 1. COMPACT KPI CARDS - All INR (responsive: 2 col mobile, 4 col md+)
  const KPICards = () => (
    <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
      {/* Row 1 */}
      <Card className="min-w-0 overflow-hidden border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">Total Revenue</p>
              <p className="truncate text-base font-bold text-emerald-700 sm:text-lg">
                {formatINR(todayStats.totalRevenue)}
              </p>
            </div>
            <div className="shrink-0 rounded-md bg-emerald-100 p-1.5">
              <IndianRupee className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden border-blue-100 bg-gradient-to-br from-blue-50 to-white">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">Total Orders</p>
              <p className="truncate text-base font-bold text-blue-700 sm:text-lg">
                {todayStats.totalOrders}
              </p>
            </div>
            <div className="shrink-0 rounded-md bg-blue-100 p-1.5">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden border-amber-100 bg-gradient-to-br from-amber-50 to-white">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">Pending</p>
              <p className="truncate text-base font-bold text-amber-700 sm:text-lg">
                {todayStats.pendingPayments}
              </p>
            </div>
            <div className="shrink-0 rounded-md bg-amber-100 p-1.5">
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden border-green-100 bg-gradient-to-br from-green-50 to-white">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">Paid Orders</p>
              <p className="truncate text-base font-bold text-green-700 sm:text-lg">
                {todayStats.paidOrders}
              </p>
            </div>
            <div className="shrink-0 rounded-md bg-green-100 p-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row 2 */}
      <Card className="min-w-0 overflow-hidden border-purple-100 bg-gradient-to-br from-purple-50 to-white">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">Employees Summary</p>
              <p className="line-clamp-2 text-xs font-bold break-words text-purple-700 sm:text-sm">
                Total: {employees.length} · Active: {todayStats.activeEmployees} · On Shift:{' '}
                {activeShiftsNow.length}
                {overtimeSummary.overtimeRunningCount > 0 && (
                  <span className="text-amber-600">
                    {' '}
                    · OT: {overtimeSummary.overtimeRunningCount}
                  </span>
                )}
              </p>
            </div>
            <div className="shrink-0 rounded-md bg-purple-100 p-1.5">
              <Users className="h-4 w-4 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden border-cyan-100 bg-gradient-to-br from-cyan-50 to-white">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">Avg Order</p>
              <p className="truncate text-base font-bold text-cyan-700 sm:text-lg">
                {formatINR(todayStats.avgOrderValue)}
              </p>
            </div>
            <div className="shrink-0 rounded-md bg-cyan-100 p-1.5">
              <TrendingUp className="h-4 w-4 text-cyan-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden border-pink-100 bg-gradient-to-br from-pink-50 to-white">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">Items Sold</p>
              <p className="truncate text-base font-bold text-pink-700 sm:text-lg">
                {todayStats.totalItemsSold}
              </p>
            </div>
            <div className="shrink-0 rounded-md bg-pink-100 p-1.5">
              <Package className="h-4 w-4 text-pink-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden border-orange-100 bg-gradient-to-br from-orange-50 to-white">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">Top selling today</p>
              <p
                className="truncate text-sm font-bold text-orange-700"
                title={todayStats.topSellingItem?.name}
              >
                {todayStats.topSellingItem?.name || '—'}
              </p>
              <p className="text-xs text-orange-600">
                {todayStats.topSellingItem?.quantity != null
                  ? `${todayStats.topSellingItem.quantity} sold`
                  : ''}
              </p>
            </div>
            <div className="shrink-0 rounded-md bg-orange-100 p-1.5">
              <Star className="h-4 w-4 text-orange-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden border-slate-200 bg-gradient-to-br from-slate-50 to-white">
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">Public Network Traffic</p>
              <p className="truncate text-base font-bold text-slate-700 sm:text-lg">
                {publicNetworkTraffic.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500">Menu views (this session)</p>
            </div>
            <div className="shrink-0 rounded-md bg-slate-100 p-1.5">
              <Activity className="h-4 w-4 text-slate-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // 2. TODAY'S ITEM SALES (orders from today only, timezone Asia/Kolkata)
  const ItemSalesSection = () => (
    <Card className="flex min-h-0 flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex flex-col gap-2 md:gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Utensils className="h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-base sm:text-lg">
                Today&apos;s Item Sales
              </CardTitle>
              <p className="text-muted-foreground text-xs">Today&apos;s orders, paid only</p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit self-start">
            {todayStats.totalItemsSold} items sold
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-3 pt-0 sm:p-6 sm:pt-0">
        <ScrollArea className="h-[240px] w-full rounded-md border border-slate-200/80 bg-slate-50/50 sm:h-[260px]">
          <div className="space-y-1.5 p-2">
            {itemSales.map((item, index) => (
              <div
                key={`${String(item.itemName).slice(0, 40)}-${index}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white p-2.5 transition-colors hover:bg-slate-50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      index < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.itemName}</p>
                    <p className="text-muted-foreground text-xs">{item.quantity} sold</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-emerald-600">
                    {formatINR(item.revenue)}
                  </p>
                  <p className="text-muted-foreground text-[10px]">Revenue</p>
                </div>
              </div>
            ))}
            {itemSales.length === 0 && (
              <p className="text-muted-foreground py-8 text-center text-sm">No sales yet today</p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  // 4. EMPLOYEE SALES TODAY
  const EmployeeSalesSection = () => (
    <Card className="flex min-h-0 flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-600" />
            <CardTitle className="truncate text-base sm:text-lg">Sales by Employee</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs">Employee</TableHead>
                <TableHead className="text-right text-xs">Orders</TableHead>
                <TableHead className="text-right text-xs">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeeSales.map(emp => (
                <TableRow key={emp.employeeId} className="text-sm">
                  <TableCell className="font-medium">{emp.employeeName}</TableCell>
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
          <CardTitle className="text-lg text-white">End of Day Summary</CardTitle>
        </div>
        <CardDescription className="text-slate-400">
          {currentTime.toLocaleDateString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:gap-4 md:grid-cols-4">
          <div className="min-w-0 rounded-lg bg-slate-700/50 p-2 text-center sm:p-3">
            <p className="truncate text-xl font-bold text-emerald-400 sm:text-2xl">
              {todayStats.totalOrders}
            </p>
            <p className="text-xs text-slate-400">Total Orders</p>
          </div>
          <div className="min-w-0 rounded-lg bg-slate-700/50 p-2 text-center sm:p-3">
            <p className="truncate text-xl font-bold text-emerald-400 sm:text-2xl">
              {formatINR(todayStats.totalRevenue)}
            </p>
            <p className="text-xs text-slate-400">Total Revenue</p>
          </div>
          <div className="min-w-0 rounded-lg bg-slate-700/50 p-2 text-center sm:p-3">
            <p className="truncate text-xl font-bold text-amber-400 sm:text-2xl">
              {todayStats.pendingPayments}
            </p>
            <p className="text-xs text-slate-400">Pending</p>
          </div>
          <div className="min-w-0 rounded-lg bg-slate-700/50 p-2 text-center sm:p-3">
            <p className="truncate text-xl font-bold text-emerald-400 sm:text-2xl">
              {todayStats.totalItemsSold}
            </p>
            <p className="text-xs text-slate-400">Items Sold</p>
          </div>
        </div>

        {todayStats.topSellingItem && (
          <div className="border-t border-slate-700 pt-4">
            <p className="mb-2 text-sm text-slate-400">Top selling today</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="shrink-0 border-emerald-500/30 bg-emerald-500/20 text-emerald-400">
                {todayStats.topSellingItem.name} — {todayStats.topSellingItem.quantity} sold
              </Badge>
              {itemSales
                .filter(item => item.itemName !== todayStats.topSellingItem?.name)
                .slice(0, 4)
                .map((item, i) => (
                  <Badge
                    key={`${item.itemName}-${i}`}
                    variant="outline"
                    className="shrink-0 border-slate-600 text-slate-400"
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
          <p className="text-muted-foreground max-w-full truncate text-xs sm:text-sm">
            {currentTime.toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}{' '}
            •{' '}
            {currentTime.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadDashboardData}
          disabled={loading}
          className="min-h-[44px] w-full shrink-0 sm:min-h-0 sm:w-auto"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh'}
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
              <Badge className="border-amber-200 bg-amber-100 text-amber-800">
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
                <li key={s.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="font-medium">{s.employeeName}</span>
                  <span className="text-amber-700">{formatHours(s.workingHours)}</span>
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
                className="border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                {activeShiftsNow.length} active
              </Badge>
            </div>
            <CardDescription>Employees with an active shift right now</CardDescription>
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
                    <TableHead className="text-right text-xs">Hours</TableHead>
                    <TableHead className="text-right text-xs">Orders</TableHead>
                    <TableHead className="text-right text-xs">Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeShiftsNow.map(s => (
                    <TableRow key={s.id} className="text-sm">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-emerald-100 text-xs text-emerald-700">
                              {s.employee?.name?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{s.employee?.name || '—'}</p>
                            <p className="text-muted-foreground text-xs">
                              {s.employee?.employeeCode || ''}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{(s.branch as any)?.name || '—'}</TableCell>
                      <TableCell className="text-xs">
                        {s.late
                          ? new Date(s.late.scheduledStart).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })
                          : formatShiftTime24ToAmPm((s.employee as any)?.shiftStartTime ?? '') ||
                            '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.shiftStart
                          ? new Date(s.shiftStart).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.late
                          ? s.late.lateMinutes === 0
                            ? 'On time'
                            : formatHours(s.late.lateMinutes / 60)
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800">
                          {(s as any).status || 'ACTIVE'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {formatHours(s.totalHours ?? 0, true)}
                      </TableCell>
                      <TableCell className="text-right font-medium">{s.ordersCount ?? 0}</TableCell>
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
            <p className="text-muted-foreground text-sm">No one on shift right now.</p>
          </CardContent>
        </Card>
      )}

      {/* Two Column Layout for Item Sales & Employee Sales */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ItemSalesSection />
        <EmployeeSalesSection />
      </div>

      {/* End of Day Summary */}
      <EndOfDaySummary />
    </div>
  );

  const MenuSection = () => (
    <div className="min-h-0 space-y-6" style={{ overflowAnchor: 'auto' }}>
      {viewingCategory ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingCategory(null)}
                className="min-h-[44px] w-full shrink-0 sm:min-h-0 sm:w-auto"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back to Categories
              </Button>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold sm:text-xl">
                  {viewingCategoryData?.name}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {viewingCategoryData?.items?.length || 0} items
                </p>
              </div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setItemForm({
                    name: '',
                    description: '',
                    basePrice: 0,
                    hasHalf: false,
                    halfPrice: 0,
                    isActive: true,
                    categoryId: viewingCategory,
                    imageUrl: '',
                    notifyCustomers: false,
                    highlightAsNewLaunch: true,
                  });
                  setIsItemDialogOpen(true);
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
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
                      <TableHead className="whitespace-nowrap">Item Name</TableHead>
                      <TableHead className="whitespace-nowrap">Full Price</TableHead>
                      <TableHead className="whitespace-nowrap">Half Price</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingCategoryData?.items?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                          No items in this category
                        </TableCell>
                      </TableRow>
                    )}
                    {viewingCategoryData?.items?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{formatINR(item.basePrice)}</TableCell>
                        <TableCell>{item.hasHalf ? formatINR(item.halfPrice) : '-'}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              item.isActive
                                ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                                : ''
                            }
                            variant={item.isActive ? 'outline' : 'secondary'}
                          >
                            {item.isActive ? 'Live' : 'Hidden'}
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
                                  description: item.description || '',
                                  basePrice: item.basePrice,
                                  hasHalf: item.hasHalf,
                                  halfPrice: item.halfPrice || 0,
                                  isActive: item.isActive,
                                  categoryId: item.categoryId || viewingCategory,
                                  imageUrl: item.imageUrl || '',
                                  notifyCustomers: false,
                                  highlightAsNewLaunch: !!(
                                    item.highlightNewUntil &&
                                    new Date(item.highlightNewUntil) > new Date()
                                  ),
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
              <h2 className="text-lg font-bold sm:text-xl">Menu Categories</h2>
              <p className="text-muted-foreground text-sm">Manage categories and their items</p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingCategory(null);
                setIsCategoryDialogOpen(true);
              }}
              className="min-h-[44px] w-full shrink-0 sm:min-h-0 sm:w-auto"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Category
            </Button>
            <CategoryDialog
              open={isCategoryDialogOpen}
              editingCategory={editingCategory}
              onOpenChange={open => {
                if (!open) setEditingCategory(null);
                setIsCategoryDialogOpen(open);
              }}
              onCreated={cat => {
                setCategories(prev => [...prev, cat]);
                setIsCategoryDialogOpen(false);
                setEditingCategory(null);
              }}
              onUpdated={cat => {
                setCategories(prev => prev.map(c => (c.id === cat.id ? { ...c, ...cat } : c)));
                setIsCategoryDialogOpen(false);
                setEditingCategory(null);
              }}
              token={token}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
              <Input
                placeholder="Search categories..."
                className="min-h-[44px] pl-8 sm:min-h-0"
                value={menuSearchQuery}
                onChange={e => setMenuSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={menuFilterBy} onValueChange={setMenuFilterBy}>
                <SelectTrigger className="min-h-[44px] w-full sm:min-h-0 sm:w-32">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  {MENU_CATEGORY_FILTER_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={menuSortBy} onValueChange={setMenuSortBy}>
                <SelectTrigger className="min-h-[44px] w-full sm:min-h-0 sm:w-40">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  {MENU_SORT_OPTIONS.map(opt => (
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
                style={{ overflowAnchor: 'auto' }}
              >
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="sticky left-0 z-10 min-w-[100px] border-r bg-slate-50 whitespace-nowrap">
                        Image
                      </TableHead>
                      <TableHead className="min-w-[130px] whitespace-nowrap">
                        Category Name
                      </TableHead>
                      <TableHead className="min-w-[90px] whitespace-nowrap">Items</TableHead>
                      <TableHead className="min-w-[120px] whitespace-nowrap">Status</TableHead>
                      <TableHead className="sticky right-0 z-10 min-w-[200px] border-l bg-slate-50 text-right whitespace-nowrap">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCategories.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                          {menuSearchQuery
                            ? 'No categories found matching your search'
                            : 'No categories yet. Create your first category!'}
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredCategories.map(category => {
                      const status = getCategoryStatus(category);
                      return (
                        <TableRow key={category.id} className="hover:bg-slate-50/50">
                          <TableCell className="sticky left-0 z-10 border-r bg-white">
                            <div className="flex items-center gap-2">
                              {category.imageUrl ? (
                                <img
                                  src={category.imageUrl}
                                  alt={category.name}
                                  className="h-10 w-10 shrink-0 rounded-lg border object-cover"
                                  onError={e => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-gray-100">
                                  <Utensils className="h-5 w-5 text-gray-400" />
                                </div>
                              )}
                              <div className="text-muted-foreground hidden text-xs">No image</div>
                            </div>
                          </TableCell>
                          <TableCell className="min-w-[130px] font-medium">
                            {category.name}
                          </TableCell>
                          <TableCell className="min-w-[90px]">
                            <span className="text-sm font-medium">{status.totalItems}</span>
                            <span className="text-muted-foreground ml-0.5 text-xs">items</span>
                          </TableCell>
                          <TableCell className="min-w-[120px]">
                            <div className="flex flex-wrap items-center gap-1">
                              {status.liveItems > 0 && (
                                <Badge className="border-green-200 bg-green-100 px-1.5 py-0 text-[11px] text-green-800">
                                  {status.liveItems} Live
                                </Badge>
                              )}
                              {status.pendingItems > 0 && (
                                <Badge className="border-yellow-200 bg-yellow-100 px-1.5 py-0 text-[11px] text-yellow-800">
                                  {status.pendingItems} Pending
                                </Badge>
                              )}
                              {status.totalItems === 0 && (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="sticky right-0 z-10 border-l bg-white text-right">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 shrink-0"
                                onClick={() => setViewingCategory(category.id)}
                              >
                                <Eye className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">View</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 shrink-0"
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
                                className="h-8 w-8 shrink-0 p-0 text-red-500"
                                onClick={() => handleDeleteCategory(category.id)}
                                disabled={category.items?.length > 0}
                                title={
                                  category.items?.length > 0
                                    ? 'Delete all items first'
                                    : 'Delete category'
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
      actor: 'ALL' | 'ADMIN' | 'EMPLOYEE' | 'CUSTOMER';
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
      actor: 'ALL' | 'ADMIN' | 'EMPLOYEE' | 'CUSTOMER';
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

    type MetricsSummary = {
      now: number;
      windowMinutes: number;
      socketio?: { activeConnections?: number };
      http?: { rpm?: number; totalCount?: number; totalErrorCount?: number };
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

    const [apiPerfActor, setApiPerfActor] = useState<'ALL' | 'ADMIN' | 'EMPLOYEE' | 'CUSTOMER'>(
      'ALL'
    );
    const [apiPerfWindowMinutes, setApiPerfWindowMinutes] = useState<number>(60);
    const [apiPerfLoading, setApiPerfLoading] = useState(false);
    const [apiPerf, setApiPerf] = useState<ApiPerfSummary | null>(null);
    const [apiPerfByActor, setApiPerfByActor] = useState<{
      CUSTOMER: ApiPerfSummary | null;
      EMPLOYEE: ApiPerfSummary | null;
      ADMIN: ApiPerfSummary | null;
    }>({ CUSTOMER: null, EMPLOYEE: null, ADMIN: null });
    const [sysPerfLoading, setSysPerfLoading] = useState(false);
    const [sysPerf, setSysPerf] = useState<SystemPerf | null>(null);
    const [metricsLoading, setMetricsLoading] = useState(false);
    const [metricsSummary, setMetricsSummary] = useState<MetricsSummary | null>(null);
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
        const fetchSummary = async (actor: 'ALL' | 'ADMIN' | 'EMPLOYEE' | 'CUSTOMER') => {
          const params = new URLSearchParams({
            windowMinutes: String(apiPerfWindowMinutes),
            top: '30',
            actor,
          });
          const res = await fetch(`${apiBase}/performance/summary?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            throw new Error(
              (data && typeof data === 'object' && 'message' in data
                ? String((data as any).message)
                : 'Failed to load performance') || 'Failed to load performance'
            );
          }
          return data as ApiPerfSummary;
        };

        const [all, customer, employee, admin] = await Promise.all([
          fetchSummary('ALL'),
          fetchSummary('CUSTOMER'),
          fetchSummary('EMPLOYEE'),
          fetchSummary('ADMIN'),
        ]);

        setApiPerf(all);
        setApiPerfByActor({ CUSTOMER: customer, EMPLOYEE: employee, ADMIN: admin });
      } catch (e) {
        setApiPerf(null);
        setApiPerfByActor({ CUSTOMER: null, EMPLOYEE: null, ADMIN: null });
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
        if (!res.ok) {
          const msg =
            data && typeof data === 'object' && 'message' in data
              ? String((data as { message?: unknown }).message || '')
              : '';
          throw new Error(msg || 'Failed to load system metrics');
        }
        setSysPerf(data as SystemPerf);
      } catch (e) {
        setSysPerf(null);
      } finally {
        setSysPerfLoading(false);
      }
    }, [token]);

    const loadMetricsSummary = useCallback(async () => {
      setMetricsLoading(true);
      try {
        const params = new URLSearchParams({
          windowMinutes: String(apiPerfWindowMinutes),
        });
        const res = await fetch(`${apiBase}/metrics/summary?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error('Failed to load metrics');
        setMetricsSummary(data as MetricsSummary);
      } catch {
        setMetricsSummary(null);
      } finally {
        setMetricsLoading(false);
      }
    }, [apiPerfWindowMinutes, token]);

    const loadCompletion = useCallback(async () => {
      if (!token) return;
      setCompletionLoading(true);
      try {
        const res = await fetch(`${apiBase}/reports/order-completion-times?days=7`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const msg =
            data && typeof data === 'object' && 'message' in data
              ? String((data as { message?: unknown }).message || '')
              : '';
          throw new Error(msg || 'Failed to load completion times');
        }
        const rows =
          data && typeof data === 'object' && 'rows' in data
            ? (data as { rows?: unknown }).rows
            : undefined;
        setCompletionRows(Array.isArray(rows) ? (rows as any[]) : []);
      } catch (e) {
        setCompletionRows([]);
      } finally {
        setCompletionLoading(false);
      }
    }, [token]);

    useEffect(() => {
      if (activeSection !== 'performance') return;
      loadApiPerf();
      loadSysPerf();
      loadCompletion();
      loadMetricsSummary();
      const id = window.setInterval(() => loadApiPerf(), 30_000);
      const id2 = window.setInterval(() => loadSysPerf(), 60_000);
      const id3 = window.setInterval(() => loadCompletion(), 120_000);
      const id4 = window.setInterval(() => loadMetricsSummary(), 30_000);
      return () => {
        window.clearInterval(id);
        window.clearInterval(id2);
        window.clearInterval(id3);
        window.clearInterval(id4);
      };
    }, [activeSection, loadApiPerf, loadSysPerf, loadCompletion, loadMetricsSummary]);

    const overall = useMemo(() => {
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
        totalBytesSent: apiPerf?.totalBytesSent ?? 0,
      };
    }, [apiPerf]);

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold sm:text-xl">Performance Dashboard</h2>
            <p className="text-muted-foreground max-w-full truncate text-xs sm:text-sm">
              Live backend API latency and traffic (auto refresh every 30 seconds).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={apiPerfActor}
              onValueChange={(v: any) =>
                setApiPerfActor(v === 'ADMIN' || v === 'EMPLOYEE' || v === 'CUSTOMER' ? v : 'ALL')
              }
            >
              <SelectTrigger className="min-h-[44px] w-full min-w-0 sm:min-h-0 sm:w-[150px]">
                <SelectValue placeholder="Actor" />
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
              onValueChange={v => setApiPerfWindowMinutes(Number(v) || 60)}
            >
              <SelectTrigger className="min-h-[44px] w-full min-w-0 sm:min-h-0 sm:w-[150px]">
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
              <RefreshCw className="mr-1 h-4 w-4" />
              Refresh
            </LoaderButton>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">Requests / min</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {overall.rpm ? overall.rpm.toFixed(1) : '0.0'}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">API Avg (ms)</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{overall.avgMs || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">API P95 (ms)</p>
              <p className="mt-1 text-lg font-bold text-amber-700">{overall.p95Ms || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">Errors (5xx)</p>
              <p className="mt-1 text-lg font-bold text-red-600">{overall.totalErrorCount || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">Active devices</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {metricsLoading && !metricsSummary
                  ? '…'
                  : (metricsSummary?.socketio?.activeConnections ?? 0)}
              </p>
              <p className="text-muted-foreground mt-1 text-[10px]">Socket.IO connections</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">Total requests</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{overall.totalCount || 0}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">Network Egress (24h)</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {sysPerf ? formatBytes(sysPerf.networkEgressBytes) : '—'}
              </p>
              <p className="text-muted-foreground mt-1 text-[11px]">Estimated from API responses</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">CPU Usage</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {sysPerf ? `${sysPerf.cpuUsagePct}%` : '—'}
              </p>
              <p className="text-muted-foreground mt-1 text-[11px]">Based on 1‑min load average</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">Disk Usage</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {sysPerf ? `${sysPerf.diskUsagePct}%` : '—'}
              </p>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {sysPerf
                  ? `${formatBytes(sysPerf.diskUsedBytes)} / ${formatBytes(sysPerf.diskTotalBytes)}`
                  : ''}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-emerald-600" />
              Slow APIs (by P95)
            </CardTitle>
            <CardDescription className="text-xs">
              Categorized by role: Customer, Employee, Admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {apiPerfLoading && !apiPerf ? (
              <div className="text-muted-foreground py-8 text-center text-sm">Loading…</div>
            ) : (apiPerf?.rows?.length ?? 0) === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                No API traffic in this window yet.
              </div>
            ) : (
              <div className="space-y-4">
                {(
                  [
                    { key: 'CUSTOMER' as const, label: 'Customer APIs' },
                    { key: 'EMPLOYEE' as const, label: 'Employee APIs' },
                    { key: 'ADMIN' as const, label: 'Admin APIs' },
                  ] as const
                ).map(grp => {
                  const s = apiPerfByActor[grp.key];
                  const rows = s?.rows ?? [];
                  return (
                    <div key={grp.key} className="space-y-2">
                      <div className="text-sm font-semibold text-slate-900">{grp.label}</div>
                      {rows.length === 0 ? (
                        <div className="text-muted-foreground text-xs">No traffic.</div>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50">
                                <TableHead>API</TableHead>
                                <TableHead className="text-right whitespace-nowrap">Hits</TableHead>
                                <TableHead className="text-right whitespace-nowrap">
                                  Avg (ms)
                                </TableHead>
                                <TableHead className="text-right whitespace-nowrap">
                                  P95 (ms)
                                </TableHead>
                                <TableHead className="text-right whitespace-nowrap">
                                  Max (ms)
                                </TableHead>
                                <TableHead className="text-right whitespace-nowrap">5xx</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {rows.map(r => (
                                <TableRow key={`${grp.key}-${r.key}`}>
                                  <TableCell className="font-medium">{r.key}</TableCell>
                                  <TableCell className="text-right">{r.count}</TableCell>
                                  <TableCell className="text-right">
                                    {Math.round(r.avgMs)}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-amber-700">
                                    {Math.round(r.p95Ms)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {Math.round(r.maxMs)}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-red-600">
                                    {r.errorCount}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  );
                })}
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
              <div className="text-muted-foreground py-8 text-center text-sm">Loading…</div>
            ) : completionRows.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                No completed orders in this window yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Orders</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Avg (min)</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Min</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Max</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completionRows.map(r => (
                      <TableRow key={String(r.employeeId)}>
                        <TableCell className="font-medium">
                          {r.employeeName}
                          {r.employeeCode ? (
                            <span className="text-muted-foreground ml-2 font-mono text-xs">
                              {r.employeeCode}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">{r.ordersCompleted}</TableCell>
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
    () => new Set((activeShiftsNow || []).map((s: any) => s.employee?.id).filter(Boolean)),
    [activeShiftsNow]
  );
  const filteredEmployees = useMemo(
    () =>
      employees.filter(e => {
        const matchesSearch =
          e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (e.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (e.employeeCode || '').toLowerCase().includes(searchQuery.toLowerCase());
        const statusUpper = String(e.status || '').toUpperCase();
        const filterUpper = String(statusFilter || '').toUpperCase();
        const matchesStatus = statusFilter === 'all' || statusUpper === filterUpper;
        return matchesSearch && matchesStatus;
      }),
    [employees, searchQuery, statusFilter]
  );
  const activeCount = employees.filter(
    e => String(e.status || '').toUpperCase() === 'ACTIVE'
  ).length;

  const EmployeesSection = () => (
    <div className="min-w-0 space-y-4 overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Employees</h2>
          <p className="text-muted-foreground text-sm">
            Active employees = roster status Active (not email verification). &quot;Currently on
            Shift&quot; uses live shift data.
          </p>
        </div>
        <Button size="sm" onClick={() => setIsEmployeeDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add Employee
        </Button>
      </div>

      {/* Summary: Total, Active, Currently on Shift */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-3">
            <p className="text-muted-foreground text-xs">Total Employees</p>
            <p className="text-xl font-bold">{employees.length}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-3">
            <p className="text-muted-foreground text-xs">Active Employees</p>
            <p className="text-xl font-bold text-emerald-700">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-3">
            <p className="text-muted-foreground text-xs">Currently on Shift</p>
            <p className="text-xl font-bold text-amber-700">{activeShiftsNow.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="px-3 pb-3 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
              <Input
                placeholder="Search by name, email, code..."
                className="w-full pl-8"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full min-w-0 sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYEE_STATUS_FILTER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Showing {filteredEmployees.length} employee
            {filteredEmployees.length !== 1 ? 's' : ''} (filter:{' '}
            {statusFilter === 'ACTIVE' ? 'Active' : statusFilter === 'all' ? 'All' : statusFilter})
          </p>
        </CardHeader>
        <CardContent className="overflow-hidden p-0">
          <div className="-mx-1 overflow-x-auto px-1">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-semibold whitespace-nowrap">Code</TableHead>
                  <TableHead className="text-xs font-semibold whitespace-nowrap">Name</TableHead>
                  <TableHead className="min-w-[140px] text-xs font-semibold sm:min-w-[200px]">
                    Email
                  </TableHead>
                  <TableHead className="text-xs font-semibold">Role</TableHead>
                  <TableHead className="text-xs font-semibold">Verified</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Shift Status</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                      No employees match the filter. Try &quot;All&quot; or a different search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map(emp => (
                    <TableRow key={emp.id} className="text-sm">
                      <TableCell className="font-mono text-xs">{emp.employeeCode || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-emerald-100 text-xs text-emerald-700">
                              {emp.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{emp.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[200px]">
                        <div className="flex flex-wrap items-center gap-2">
                          {emp.emailVerified && (
                            <span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
                              title="Email verified"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                            </span>
                          )}
                          <span className="font-medium break-all text-slate-800">
                            {emp.email ? (
                              <a
                                href={`mailto:${emp.email}`}
                                className="text-emerald-700 hover:underline"
                              >
                                {emp.email}
                              </a>
                            ) : (
                              '—'
                            )}
                          </span>
                          {!emp.emailVerified && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 shrink-0 px-2 text-xs"
                              disabled={verifyingEmployeeId === emp.id}
                              onClick={() => setEmployeeToVerify(emp)}
                              title="Verify employee email"
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              {verifyingEmployeeId === emp.id ? 'Sending...' : 'Verify'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{emp.role || '—'}</TableCell>
                      <TableCell>
                        {emp.emailVerified ? (
                          <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800">
                            Verified
                          </Badge>
                        ) : (
                          <Badge className="border-amber-200 bg-amber-100 text-amber-800">
                            Not Verified
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={emp.status} />
                      </TableCell>
                      <TableCell>
                        {String(emp.status || '').toUpperCase() !== 'ACTIVE' ? (
                          <span className="text-muted-foreground">—</span>
                        ) : onShiftEmployeeIds.has(emp.id) ? (
                          <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800">
                            On Shift
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Off Shift
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEmployeeToChangePassword(emp)}
                            disabled={changingPasswordEmployeeId === emp.id}
                            title="Change password (director receives email)"
                          >
                            <Lock className="mr-1 h-4 w-4" />
                            Change password
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingEmployee(emp)}
                          >
                            <Edit2 className="mr-1 h-4 w-4" />
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
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(orderTableFilter === 'all'
          ? ordersByTable
          : ordersByTable.filter(t => String(t.tableId) === String(orderTableFilter))
        ).map(table => (
          <Card key={table.tableId} className="card-gpu overflow-hidden">
            <CardHeader className="bg-slate-50 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-emerald-100 p-1.5">
                    <Utensils className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Table {table.tableNumber}</CardTitle>
                    <p className="text-muted-foreground text-xs">{table.orders.length} orders</p>
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
                      now={currentTime}
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
        {(orderTableFilter === 'all'
          ? ordersByTable.length === 0
          : ordersByTable.filter(t => String(t.tableId) === String(orderTableFilter)).length ===
            0) && (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center">
              <ShoppingCart className="text-muted-foreground mx-auto mb-3 h-12 w-12 opacity-20" />
              <p className="text-muted-foreground">No orders found for the selected date</p>
            </CardContent>
          </Card>
        )}
      </div>
    ),
    [ordersByTable, orderTableFilter, handleOpenOrderDialog]
  );

  // ORDERS SECTION - Updated with table view and popup
  const OrdersSection = () => (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold sm:text-xl">Orders by Table</h2>
          <p className="text-muted-foreground text-sm">View all orders grouped by table</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Input
              type="date"
              className="min-h-[44px] w-full min-w-0 sm:min-h-0 sm:w-36"
              value={orderStartDate}
              onChange={e => setOrderStartDate(e.target.value)}
              placeholder="Start date"
            />
            <Input
              type="date"
              className="min-h-[44px] w-full min-w-0 sm:min-h-0 sm:w-36"
              value={orderEndDate}
              onChange={e => setOrderEndDate(e.target.value)}
              placeholder="End date"
            />
          </div>
          <Select value={orderTableFilter} onValueChange={setOrderTableFilter}>
            <SelectTrigger className="min-h-[44px] w-full sm:min-h-0 sm:w-36">
              <SelectValue placeholder="All Tables" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tables</SelectItem>
              {ordersByTable.map(t => (
                <SelectItem key={t.tableId} value={String(t.tableId)}>
                  Table {t.tableNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setOrderStartDate('');
              setOrderEndDate('');
              setOrderTableFilter('all');
              // Load without filters immediately for UX
              loadAllOrders();
            }}
            disabled={ordersLoading}
            title="Reset filters"
            className="min-h-[44px] w-full shrink-0 sm:min-h-0 sm:w-auto"
          >
            Reset
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={loadAllOrders}
            disabled={ordersLoading}
            title="Refresh orders"
            className="min-h-[44px] shrink-0 sm:min-h-0"
          >
            <RefreshCw className={`h-4 w-4 ${ordersLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        <Card className="min-w-0 border-blue-100 bg-blue-50">
          <CardContent className="p-2 sm:p-3">
            <p className="text-muted-foreground text-xs">Total Orders</p>
            <p className="truncate text-lg font-bold text-blue-700 sm:text-xl">
              {allOrders.length}
            </p>
          </CardContent>
        </Card>
        <Card className="min-w-0 border-emerald-100 bg-emerald-50">
          <CardContent className="p-2 sm:p-3">
            <p className="text-muted-foreground text-xs">Total Revenue</p>
            <p className="truncate text-lg font-bold text-emerald-700 sm:text-xl">
              {formatINR(
                allOrders
                  .filter(o => o.paymentStatus === 'PAID')
                  .reduce((sum, o) => sum + o.totalAmount, 0)
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="min-w-0 border-amber-100 bg-amber-50">
          <CardContent className="p-2 sm:p-3">
            <p className="text-muted-foreground text-xs">Pending Orders</p>
            <p className="truncate text-lg font-bold text-amber-700 sm:text-xl">
              {allOrders.filter(o => o.paymentStatus !== 'PAID').length}
            </p>
          </CardContent>
        </Card>
        <Card className="min-w-0 border-amber-100 bg-amber-50">
          <CardContent className="p-2 sm:p-3">
            <p className="text-muted-foreground text-xs">Tables Active</p>
            <p className="truncate text-lg font-bold text-amber-700 sm:text-xl">
              {ordersByTable.length}
            </p>
          </CardContent>
        </Card>
        <Card className="min-w-0 border-purple-100 bg-purple-50">
          <CardContent className="p-2 sm:p-3">
            <p className="text-muted-foreground text-xs">Pending Payment</p>
            <p className="truncate text-lg font-bold text-purple-700 sm:text-xl">
              {allOrders.filter(o => o.paymentStatus !== 'PAID').length}
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
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold sm:text-xl">Customer Leaderboard</h2>
          <p className="text-muted-foreground text-sm">Highest paying customers (descending)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={leaderboardSortBy}
            onValueChange={(v: 'orders' | 'amount') => setLeaderboardSortBy(v)}
          >
            <SelectTrigger className="min-h-[44px] w-full min-w-0 sm:min-h-0 sm:w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="orders">Sort by Total Orders</SelectItem>
              <SelectItem value="amount">Sort by Amount Spent</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={String(leaderboardLimit)}
            onValueChange={v => setLeaderboardLimit(Number(v))}
          >
            <SelectTrigger className="min-h-[44px] w-full min-w-0 sm:min-h-0 sm:w-[120px]">
              <SelectValue placeholder="Top" />
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
            <RefreshCw className={`mr-1 h-4 w-4 ${leaderboardLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={leaderboard.length === 0}
            className="min-h-[44px] sm:min-h-0"
            onClick={() => {
              const rows = leaderboard.map((r, idx) => ({
                rank: idx + 1,
                customerName: r.customerName || '',
                customerMobile: r.customerMobile || '',
                totalOrders: r.totalOrders ?? 0,
                totalSpent: r.totalSpent ?? 0,
                lastOrderDate: r.lastOrderDate || '',
              }));
              const header = [
                'Rank',
                'Customer Name',
                'Mobile Number',
                'Total Orders',
                'Total Spent',
                'Last Order Date',
              ];
              const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
              const csv = [
                header.join(','),
                ...rows.map(r =>
                  [
                    r.rank,
                    r.customerName,
                    r.customerMobile,
                    r.totalOrders,
                    r.totalSpent,
                    r.lastOrderDate,
                  ]
                    .map(escape)
                    .join(',')
                ),
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `customer-leads-${new Date().toISOString().slice(0, 10)}.csv`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Download Excel (CSV)
          </Button>
        </div>
      </div>

      {leaderboardLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="mb-3 h-5 w-32 animate-pulse rounded bg-slate-200" />
                <div className="mb-2 h-4 w-24 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : leaderboard.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Trophy className="text-muted-foreground mx-auto mb-3 h-12 w-12 opacity-50" />
            <p className="text-muted-foreground font-medium">No customer data yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
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
                  <TableHead className="min-w-[140px] whitespace-nowrap sm:min-w-[180px]">
                    Customer Name
                  </TableHead>
                  <TableHead className="min-w-[140px] whitespace-nowrap">Mobile Number</TableHead>
                  <TableHead className="w-20 text-right whitespace-nowrap">Action</TableHead>
                  <TableHead className="w-24 text-right whitespace-nowrap">Total Orders</TableHead>
                  <TableHead className="min-w-[100px] text-right whitespace-nowrap">
                    Total Spent
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((row, idx) => (
                  <TableRow key={`${row.customerMobile}-${idx}`}>
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell className="align-top font-medium">
                      {(row.customerName || '—').toUpperCase()}
                    </TableCell>
                    <TableCell className="text-muted-foreground align-top font-mono text-sm">
                      {row.customerMobile || '—'}
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!row.customerMobile || !token}
                        onClick={async () => {
                          if (!token || !row.customerMobile) return;
                          try {
                            const res = await fetch(
                              `${apiBase}/orders/customer-leads/${encodeURIComponent(row.customerMobile)}`,
                              {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${token}` },
                              }
                            );
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({}));
                              toast({
                                title: 'Failed',
                                description:
                                  (err as any).message || 'Could not delete this mobile number.',
                                variant: 'destructive',
                              });
                              return;
                            }
                            const data = await res.json().catch(() => ({}));
                            toast({
                              title: 'Deleted',
                              description: `Mobile cleared from ${data.clearedCount ?? 0} order(s).`,
                            });
                            // refresh leaderboard
                            setTimeout(() => {
                              try {
                                const params = new URLSearchParams({
                                  limit: String(leaderboardLimit),
                                  sortBy: leaderboardSortBy,
                                });
                                fetch(`${apiBase}/orders/customer-leaderboard?${params}`, {
                                  headers: { Authorization: `Bearer ${token}` },
                                })
                                  .then(r => (r.ok ? r.json() : null))
                                  .then(d => d && setLeaderboard(d.leaderboard ?? []))
                                  .catch(() => {});
                              } catch {}
                            }, 150);
                          } catch (e: any) {
                            toast({
                              title: 'Failed',
                              description: e?.message || 'Delete failed',
                              variant: 'destructive',
                            });
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                    <TableCell className="text-right align-top font-semibold">
                      {row.totalOrders}
                    </TableCell>
                    <TableCell className="text-right align-top font-semibold text-emerald-700">
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
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-bold">Employee Work Hours</h2>
          <p className="text-muted-foreground text-sm">Track attendance, hours and sales</p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center md:w-auto">
          <Select value={hoursEmployeeFilter} onValueChange={setHoursEmployeeFilter}>
            <SelectTrigger className="min-h-[44px] w-full sm:w-40">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees
                .filter(e => String(e.status || '').toUpperCase() === 'ACTIVE')
                .map(emp => (
                  <SelectItem key={emp.id} value={String(emp.id)}>
                    {emp.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1">
              <Label className="text-muted-foreground text-xs">Start Date</Label>
              <Input
                type="date"
                className="bg-background border-input min-h-[44px] w-full min-w-0 border"
                value={hoursStartDate}
                onChange={e => setHoursStartDate(e.target.value)}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <Label className="text-muted-foreground text-xs">End Date</Label>
              <Input
                type="date"
                className="bg-background border-input min-h-[44px] w-full min-w-0 border"
                value={hoursEndDate}
                onChange={e => setHoursEndDate(e.target.value)}
              />
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={loadShiftHistory}
            disabled={shiftHistoryLoading}
            className="min-h-[44px] w-full sm:w-auto"
            title="Search"
          >
            {shiftHistoryLoading ? (
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden
              />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="border-blue-100 bg-blue-50">
          <CardContent className="p-3">
            <p className="text-muted-foreground text-xs">Total Shifts</p>
            <p className="text-xl font-bold text-blue-700">{hoursSummary.totalShifts}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 bg-emerald-50">
          <CardContent className="p-3">
            <p className="text-muted-foreground text-xs">Total Hours</p>
            <p className="text-xl font-bold text-emerald-700">
              {formatHours(hoursSummary.totalHours)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-purple-100 bg-purple-50">
          <CardContent className="p-3">
            <p className="text-muted-foreground text-xs">Total Sales</p>
            <p className="text-xl font-bold text-purple-700">
              {formatINR(hoursSummary.totalSales)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-100 bg-amber-50">
          <CardContent className="p-3">
            <p className="text-muted-foreground text-xs">Avg Hours/Shift</p>
            <p className="text-xl font-bold text-amber-700">
              {hoursSummary.totalShifts > 0
                ? formatHours(hoursSummary.totalHours / hoursSummary.totalShifts)
                : '0 min'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-3">
            <p className="text-muted-foreground text-xs">Break (fixed)</p>
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
                    <TableHead className="text-right text-xs">Shifts</TableHead>
                    <TableHead className="text-right text-xs">Hours</TableHead>
                    <TableHead className="text-right text-xs">Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyStats.map(stat => (
                    <TableRow key={stat.date} className="text-sm">
                      <TableCell>{new Date(stat.date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell className="text-right">{stat.shifts}</TableCell>
                      <TableCell className="text-right">{formatHours(stat.totalHours)}</TableCell>
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
                  <TableHead className="text-right text-xs">Hours</TableHead>
                  <TableHead className="text-right text-xs">Orders</TableHead>
                  <TableHead className="text-right text-xs">Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const palette = [
                    'bg-emerald-50',
                    'bg-amber-50',
                    'bg-sky-50',
                    'bg-violet-50',
                    'bg-rose-50',
                  ];
                  const groups = new Map<string, any[]>();
                  for (const s of shifts) {
                    const key = new Date(s.shiftStart).toISOString().slice(0, 10);
                    const arr = groups.get(key) ?? [];
                    arr.push(s);
                    groups.set(key, arr);
                  }
                  const keys = Array.from(groups.keys()).sort((a, b) => (a < b ? 1 : -1));
                  return keys.flatMap((dateKey, idx) => {
                    const rows = groups.get(dateKey) ?? [];
                    const color = palette[idx % palette.length];
                    return [
                      <TableRow key={`date-${dateKey}`} className={`${color}`}>
                        <TableCell colSpan={9} className="text-xs font-semibold text-slate-700">
                          {new Date(dateKey).toLocaleDateString('en-IN', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </TableCell>
                      </TableRow>,
                      ...rows.map(shift => (
                        <TableRow key={shift.id} className="text-sm">
                          <TableCell className="font-medium">{shift.employee?.name}</TableCell>
                          <TableCell>{(shift as any).branch?.name || '—'}</TableCell>
                          <TableCell>
                            {new Date(shift.shiftStart).toLocaleDateString('en-IN')}
                          </TableCell>
                          <TableCell>{new Date(shift.shiftStart).toLocaleTimeString()}</TableCell>
                          <TableCell>
                            {shift.shiftEnd
                              ? new Date(shift.shiftEnd).toLocaleTimeString()
                              : 'Active'}
                          </TableCell>
                          <TableCell>
                            {(shift as any).status || (shift.shiftEnd ? 'ENDED' : 'ACTIVE')}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatHours(shift.totalHours || 0)}
                          </TableCell>
                          <TableCell className="text-right">{shift.orders?.length || 0}</TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">
                            {formatINR(shift.totalSales || 0)}
                          </TableCell>
                        </TableRow>
                      )),
                    ];
                  });
                })()}
                {shifts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">
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
    setOvertimeEmployeeFilter('all');
  }, []);

  // OVERTIME SECTION – Shifts > 10h; filter by date and employee
  const OvertimeSection = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Overtime</h2>
        <p className="text-muted-foreground text-sm">
          Shifts over employee&apos;s working hours per day. Auto-closed at 04:00 AM if not ended.
        </p>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col flex-wrap gap-2 sm:flex-row">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Date From</Label>
              <Input
                type="date"
                value={overtimeDateFrom}
                onChange={e => setOvertimeDateFrom(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Date To</Label>
              <Input
                type="date"
                value={overtimeDateTo}
                onChange={e => setOvertimeDateTo(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Employee</Label>
              <Select value={overtimeEmployeeFilter} onValueChange={setOvertimeEmployeeFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees
                    .filter(e => String(e.status || '').toUpperCase() === 'ACTIVE')
                    .map(emp => (
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
                <Search className="mr-1 h-4 w-4" />
                Apply
              </LoaderButton>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {overtimeRecords.length === 0 && !overtimeLoading ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No overtime records for the selected filters
            </p>
          ) : (
            <>
              <div className="space-y-2 p-3 md:hidden">
                {overtimeRecords.map(r => {
                  const isLive = r.live === true || r.status === 'RUNNING';
                  const endTime = r.shiftEnd
                    ? new Date(r.shiftEnd).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—';
                  return (
                    <div
                      key={r.id}
                      className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border bg-slate-50/50 p-3 text-sm"
                    >
                      <span className="text-muted-foreground">Employee</span>
                      <span className="font-medium">{r.employeeName}</span>
                      <span className="text-muted-foreground">Role</span>
                      <span>{r.role ?? '—'}</span>
                      <span className="text-muted-foreground">Date</span>
                      <span>
                        {new Date(r.shiftDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="text-muted-foreground">Start</span>
                      <span>
                        {new Date(r.shiftStart).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
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
                      <span>{r.reason ?? '—'}</span>
                      <span className="text-muted-foreground">Status</span>
                      <span>
                        {isLive ? (
                          <Badge className="border-amber-200 bg-amber-100 text-amber-800">
                            RUNNING
                          </Badge>
                        ) : (
                          <Select
                            value={r.status}
                            onValueChange={async status => {
                              try {
                                const res = await fetch(`${apiBase}/overtime/${r.id}/status`, {
                                  method: 'PATCH',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${token}`,
                                  },
                                  body: JSON.stringify({ status }),
                                });
                                if (res.ok) {
                                  loadOvertime();
                                  if (
                                    overtimeSummary.pendingOvertimeCount > 0 ||
                                    overtimeSummary.overtimeRunningCount > 0
                                  ) {
                                    const sumRes = await fetch(`${apiBase}/overtime/summary`, {
                                      headers: {
                                        Authorization: `Bearer ${token}`,
                                      },
                                    });
                                    if (sumRes.ok) {
                                      const summary = await sumRes.json();
                                      setOvertimeSummary({
                                        pendingOvertimeCount: summary.pendingOvertimeCount ?? 0,
                                        overtimeRunningCount: summary.overtimeRunningCount ?? 0,
                                        overtimeRunning: summary.overtimeRunning ?? [],
                                      });
                                    }
                                  }
                                }
                              } catch (_e) {}
                            }}
                          >
                            <SelectTrigger className="h-9 w-full max-w-[120px] text-xs">
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
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-semibold">Employee</TableHead>
                      <TableHead className="text-xs font-semibold">Role</TableHead>
                      <TableHead className="text-xs font-semibold">Date</TableHead>
                      <TableHead className="text-xs font-semibold">Start</TableHead>
                      <TableHead className="text-xs font-semibold">End</TableHead>
                      <TableHead className="text-xs font-semibold">Total Hours</TableHead>
                      <TableHead className="text-xs font-semibold">Overtime</TableHead>
                      <TableHead className="text-xs font-semibold">Reason</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overtimeRecords.map(r => {
                      const isLive = r.live === true || r.status === 'RUNNING';
                      const endTime = r.shiftEnd
                        ? new Date(r.shiftEnd).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—';
                      return (
                        <TableRow key={r.id} className="text-sm">
                          <TableCell className="font-medium">{r.employeeName}</TableCell>
                          <TableCell>{r.role ?? '—'}</TableCell>
                          <TableCell>
                            {new Date(r.shiftDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell>
                            {new Date(r.shiftStart).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell>{endTime}</TableCell>
                          <TableCell>{formatHours(Number(r.totalHours))}</TableCell>
                          <TableCell className="font-medium text-amber-600">
                            {formatHours(Number(r.overtimeHours))}
                          </TableCell>
                          <TableCell>{r.reason ?? '—'}</TableCell>
                          <TableCell>
                            {isLive ? (
                              <Badge className="border-amber-200 bg-amber-100 text-amber-800">
                                RUNNING
                              </Badge>
                            ) : (
                              <Select
                                value={r.status}
                                onValueChange={async status => {
                                  try {
                                    const res = await fetch(`${apiBase}/overtime/${r.id}/status`, {
                                      method: 'PATCH',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${token}`,
                                      },
                                      body: JSON.stringify({ status }),
                                    });
                                    if (res.ok) {
                                      loadOvertime();
                                      if (
                                        overtimeSummary.pendingOvertimeCount > 0 ||
                                        overtimeSummary.overtimeRunningCount > 0
                                      ) {
                                        const sumRes = await fetch(`${apiBase}/overtime/summary`, {
                                          headers: {
                                            Authorization: `Bearer ${token}`,
                                          },
                                        });
                                        if (sumRes.ok) {
                                          const summary = await sumRes.json();
                                          setOvertimeSummary({
                                            pendingOvertimeCount: summary.pendingOvertimeCount ?? 0,
                                            overtimeRunningCount: summary.overtimeRunningCount ?? 0,
                                            overtimeRunning: summary.overtimeRunning ?? [],
                                          });
                                        }
                                      }
                                    }
                                  } catch (_e) {}
                                }}
                              >
                                <SelectTrigger className="h-8 w-[110px] text-xs">
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
    if (mins < 60) return `${mins} Minute${mins !== 1 ? 's' : ''}`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h} Hour${h !== 1 ? 's' : ''}`;
    return `${h} Hour${h !== 1 ? 's' : ''} ${m} Min`;
  };

  /** Format "HH:mm" (24h) to "10:00 AM" / "3:23 PM" for Scheduled Start in Late Entries. */
  const formatShiftTime24ToAmPm = (timeStr: string): string => {
    if (!timeStr || typeof timeStr !== 'string') return timeStr || '—';
    const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
    if (!match) return timeStr;
    const hour = parseInt(match[1], 10);
    const minute = match[2];
    if (hour < 0 || hour > 23) return timeStr;
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${h}:${minute} ${ampm}`;
  };

  const LateSection = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Late Entries</h2>
        <p className="text-muted-foreground text-sm">
          Employees who started their shift after the scheduled shift start time.
          <span className="mt-1 block text-xs">
            Scheduled Start = shift start time (e.g. 10:00 AM). Actual Login = when the employee
            started their shift.
          </span>
        </p>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col flex-wrap gap-2 sm:flex-row">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Date From</Label>
              <Input
                type="date"
                value={lateDateFrom}
                onChange={e => setLateDateFrom(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Date To</Label>
              <Input
                type="date"
                value={lateDateTo}
                onChange={e => setLateDateTo(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Employee</Label>
              <Select value={lateEmployeeFilter} onValueChange={setLateEmployeeFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees
                    .filter(e => String(e.status || '').toUpperCase() === 'ACTIVE')
                    .map(emp => (
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
                  setLateDateFrom('');
                  setLateDateTo('');
                  setLateEmployeeFilter('all');
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
                <Search className="mr-1 h-4 w-4" />
                Apply
              </LoaderButton>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {lateEntries.length === 0 && !lateLoading ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No late entries for the selected filters
            </p>
          ) : (
            <>
              <div className="space-y-2 p-3 md:hidden">
                {lateEntries.map(e => (
                  <div
                    key={e.id}
                    className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border bg-slate-50/50 p-3 text-sm"
                  >
                    <span className="text-muted-foreground">Employee</span>
                    <span className="font-medium">{e.employee?.name ?? '—'}</span>
                    <span className="text-muted-foreground">Date</span>
                    <span>
                      {new Date(e.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-muted-foreground">Scheduled Start</span>
                    <span>{formatShiftTime24ToAmPm(e.shiftStartTime)}</span>
                    <span className="text-muted-foreground">Actual Login</span>
                    <span>
                      {new Date(e.actualLoginTime).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-muted-foreground">Late</span>
                    <span className="font-medium text-amber-600">
                      {formatLateMinutes(e.lateDurationMinutes)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-semibold">Employee</TableHead>
                      <TableHead className="text-xs font-semibold">Date</TableHead>
                      <TableHead
                        className="text-xs font-semibold"
                        title="Scheduled shift start time"
                      >
                        Scheduled Start
                      </TableHead>
                      <TableHead
                        className="text-xs font-semibold"
                        title="When the employee actually started their shift"
                      >
                        Actual Login
                      </TableHead>
                      <TableHead className="text-xs font-semibold">Late</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lateEntries.map(e => (
                      <TableRow key={e.id} className="text-sm">
                        <TableCell className="font-medium">{e.employee?.name ?? '—'}</TableCell>
                        <TableCell>
                          {new Date(e.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>{formatShiftTime24ToAmPm(e.shiftStartTime)}</TableCell>
                        <TableCell>
                          {new Date(e.actualLoginTime).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })}
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

  const LeaveRequestsSection = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Leave Requests</h2>
        <p className="text-muted-foreground text-sm">
          Review employee leave requests and approve/reject with remarks.
        </p>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col flex-wrap gap-2 sm:flex-row">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Status</Label>
              <Select value={leaveStatusFilter} onValueChange={setLeaveStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Employee</Label>
              <Select value={leaveEmployeeFilter} onValueChange={setLeaveEmployeeFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Date From</Label>
              <Input
                type="date"
                value={leaveDateFrom}
                onChange={e => setLeaveDateFrom(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Date To</Label>
              <Input
                type="date"
                value={leaveDateTo}
                onChange={e => setLeaveDateTo(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
            <div className="flex items-end gap-2">
              <LoaderButton
                variant="outline"
                size="sm"
                onClick={() => {
                  setLeaveStatusFilter('PENDING');
                  setLeaveEmployeeFilter('all');
                  setLeaveDateFrom('');
                  setLeaveDateTo('');
                }}
                loading={leaveLoading}
                loadingLabel="Resetting..."
              >
                Reset
              </LoaderButton>
              <LoaderButton
                size="sm"
                onClick={loadLeaves}
                loading={leaveLoading}
                loadingLabel="Loading..."
              >
                <Search className="mr-1 h-4 w-4" />
                Apply
              </LoaderButton>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {leaveRequests.length === 0 && !leaveLoading ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No leave requests for selected filters
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveRequests.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        {l.employee?.name ?? '—'}
                        <div className="text-muted-foreground text-xs">
                          {l.employee?.employeeCode ?? ''}
                        </div>
                      </TableCell>
                      <TableCell>{l.leaveType}</TableCell>
                      <TableCell>
                        {new Date(l.startDate).toLocaleDateString('en-IN')} to{' '}
                        {new Date(l.endDate).toLocaleDateString('en-IN')}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate" title={l.reason || ''}>
                        {l.reason || '—'}
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
                      <TableCell className="min-w-[220px]">
                        <Input
                          placeholder="Optional remarks"
                          value={leaveRemarksById[l.id] ?? ''}
                          onChange={e =>
                            setLeaveRemarksById(prev => ({
                              ...prev,
                              [l.id]: e.target.value,
                            }))
                          }
                          disabled={l.status !== 'PENDING' || leaveActionLoadingId === l.id}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {l.status !== 'PENDING' ? (
                          <span className="text-muted-foreground text-xs">No action</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <LoaderButton
                              size="sm"
                              variant="outline"
                              onClick={() => updateLeaveStatus(l.id, 'REJECTED')}
                              loading={leaveActionLoadingId === l.id}
                              loadingLabel="Saving..."
                            >
                              Reject
                            </LoaderButton>
                            <LoaderButton
                              size="sm"
                              onClick={() => updateLeaveStatus(l.id, 'APPROVED')}
                              loading={leaveActionLoadingId === l.id}
                              loadingLabel="Saving..."
                            >
                              Approve
                            </LoaderButton>
                          </div>
                        )}
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

  // Customer Queries Section
  const CustomerQueriesSection = () => (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Customer Queries</h2>
          <p className="text-muted-foreground text-sm">Issues and help requests from customers</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select value={queryStatusFilter} onValueChange={setQueryStatusFilter}>
            <SelectTrigger className="min-h-[44px] w-full sm:min-h-0 sm:w-40">
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
            className="min-h-[44px] w-full shrink-0 sm:min-h-0 sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
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
                    <TableHead className="sticky left-0 z-10 min-w-[52px] border-r bg-slate-50 whitespace-nowrap">
                      ID
                    </TableHead>
                    <TableHead className="min-w-[100px] whitespace-nowrap">Customer</TableHead>
                    <TableHead className="min-w-[100px] whitespace-nowrap">Mobile</TableHead>
                    <TableHead className="min-w-[90px] whitespace-nowrap">Branch</TableHead>
                    <TableHead className="min-w-[70px] whitespace-nowrap">Order</TableHead>
                    <TableHead className="min-w-[90px] whitespace-nowrap">Issue Type</TableHead>
                    <TableHead className="min-w-[90px] whitespace-nowrap">Status</TableHead>
                    <TableHead className="min-w-[110px] whitespace-nowrap">Date</TableHead>
                    <TableHead className="sticky right-0 z-10 min-w-[180px] border-l bg-slate-50 text-right whitespace-nowrap">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerQueries.map(q => (
                    <TableRow key={q.id} className="hover:bg-slate-50/50">
                      <TableCell className="sticky left-0 z-10 border-r bg-white font-medium whitespace-nowrap">
                        {q.id}
                      </TableCell>
                      <TableCell className="min-w-[100px]">{q.name}</TableCell>
                      <TableCell className="min-w-[100px] whitespace-nowrap">{q.mobile}</TableCell>
                      <TableCell
                        className="max-w-[120px] min-w-[90px] truncate"
                        title={q.branch?.name ?? undefined}
                      >
                        {q.branch?.name ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {q.orderId != null ? `#${q.orderId}` : '—'}
                      </TableCell>
                      <TableCell className="min-w-[90px]">
                        {q.issueType.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            q.status === 'RESOLVED'
                              ? 'default'
                              : q.status === 'IN_PROGRESS'
                                ? 'secondary'
                                : 'outline'
                          }
                          className="shrink-0 text-xs"
                        >
                          {q.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(q.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="sticky right-0 z-10 border-l bg-white text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 shrink-0"
                            onClick={() => {
                              setSelectedQuery(q);
                              setQueryDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                          {q.status !== 'RESOLVED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 shrink-0"
                              disabled={resolvingQueryId === q.id}
                              onClick={async () => {
                                setResolvingQueryId(q.id);
                                try {
                                  const res = await fetch(
                                    `${apiBase}/customer-queries/${q.id}/resolve`,
                                    {
                                      method: 'POST',
                                      headers: {
                                        Authorization: `Bearer ${token}`,
                                      },
                                    }
                                  );
                                  if (res.ok) {
                                    const data = await res.json();
                                    if (data.waMeLink) window.open(data.waMeLink, '_blank');
                                    toast({
                                      title: 'Resolved',
                                      description: 'Open WhatsApp to notify the customer.',
                                    });
                                    loadCustomerQueries();
                                    loadPendingQueriesCount();
                                  }
                                } finally {
                                  setResolvingQueryId(null);
                                }
                              }}
                            >
                              {resolvingQueryId === q.id ? '...' : 'Resolve'}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 shrink-0"
                            onClick={() =>
                              window.open(
                                `https://wa.me/91${q.mobile.replace(/\D/g, '').slice(-10)}`,
                                '_blank'
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
                      <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">
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
          className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto p-4 sm:w-[calc(100vw-2rem)] sm:p-6"
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
                <span className="font-medium">Customer:</span> {selectedQuery.name}
              </p>
              <p>
                <span className="font-medium">Mobile:</span> {selectedQuery.mobile}
              </p>
              <p>
                <span className="font-medium">Branch:</span> {selectedQuery.branch?.name ?? '—'}
              </p>
              <p>
                <span className="font-medium">Order ID:</span>{' '}
                {selectedQuery.orderId != null
                  ? `ORD${String(selectedQuery.orderId).padStart(4, '0')}`
                  : '—'}
              </p>
              <p>
                <span className="font-medium">Issue type:</span>{' '}
                {selectedQuery.issueType.replace(/_/g, ' ')}
              </p>
              <p>
                <span className="font-medium">Status:</span> {selectedQuery.status}
              </p>
              <p>
                <span className="font-medium">Date:</span>{' '}
                {new Date(selectedQuery.createdAt).toLocaleString()}
              </p>
              <div>
                <p className="mb-1 font-medium">Message:</p>
                <p className="bg-muted text-muted-foreground rounded p-3">
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
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Removed Items Report</h2>
          <p className="text-muted-foreground text-sm">
            Track items removed by employees from orders
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Input
            type="date"
            value={removedItemsDateFilter}
            onChange={e => setRemovedItemsDateFilter(e.target.value)}
            className="min-h-[44px] w-full sm:min-h-0 sm:w-40"
          />
          <Button
            variant="outline"
            onClick={loadRemovedItems}
            disabled={removedItemsLoading}
            className="min-h-[44px] shrink-0 sm:min-h-0"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${removedItemsLoading ? 'animate-spin' : ''}`} />
            {removedItemsLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 p-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Items Removed</p>
                <p className="text-2xl font-bold">{removedItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2">
                <IndianRupee className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Loss</p>
                <p className="text-2xl font-bold">{formatINR(totalLoss)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Daily Avg Loss</p>
                <p className="text-2xl font-bold">
                  {formatINR(
                    dailyRemovalSummaries.length > 0 ? totalLoss / dailyRemovalSummaries.length : 0
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
            className="-mx-1 overflow-x-auto overflow-y-visible px-1"
            style={{ overflowAnchor: 'auto' }}
          >
            <ScrollArea className="h-[400px] w-full">
              <div className="min-w-[900px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 min-w-[100px] border-r bg-white whitespace-nowrap">
                        Date
                      </TableHead>
                      <TableHead className="whitespace-nowrap">Order #</TableHead>
                      <TableHead className="whitespace-nowrap">Table</TableHead>
                      <TableHead className="whitespace-nowrap">Item</TableHead>
                      <TableHead className="whitespace-nowrap">Qty</TableHead>
                      <TableHead className="whitespace-nowrap">Price</TableHead>
                      <TableHead className="whitespace-nowrap">Loss</TableHead>
                      <TableHead className="whitespace-nowrap">Removed By</TableHead>
                      <TableHead className="min-w-[120px] whitespace-nowrap">Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {removedItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">
                          No removed items found for the selected date
                        </TableCell>
                      </TableRow>
                    )}
                    {removedItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="sticky left-0 z-10 border-r bg-white whitespace-nowrap">
                          {new Date(item.removedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">#{item.orderId}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {item.tableNumber || 'N/A'}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {item.itemName}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{item.quantity}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatINR(item.itemPrice)}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap text-red-600">
                          {formatINR(item.itemPrice * item.quantity)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{item.removedBy}</TableCell>
                        <TableCell className="max-w-[150px] truncate" title={item.reason}>
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
                {dailyRemovalSummaries.map(summary => (
                  <TableRow key={summary.date}>
                    <TableCell>{new Date(summary.date).toLocaleDateString()}</TableCell>
                    <TableCell>{summary.totalItems}</TableCell>
                    <TableCell className="font-medium text-red-600">
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
        s =>
          (s.employee?.name ?? '').toLowerCase().includes(q) ||
          (s.employeeCode ?? '').toLowerCase().includes(q)
      );
    if (salaryTableMonthFilter) {
      const [y, m] = salaryTableMonthFilter.split('-').map(Number);
      const monthName = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ][(m || 1) - 1];
      list = list.filter(s => String(s.year) === String(y) && String(s.month) === monthName);
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
        s =>
          s.year === currentYear &&
          s.month ===
            [
              'January',
              'February',
              'March',
              'April',
              'May',
              'June',
              'July',
              'August',
              'September',
              'October',
              'November',
              'December',
            ][currentMonth]
      )
      .reduce((sum, s) => sum + (s.netSalary || 0), 0);
  }, [salarySlips]);

  const RevenueSection = () => {
    const now = new Date();
    const fallbackYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const activeYm = monthlyTargetInfo?.yearMonth || fallbackYm;
    const [targetYear, targetMonth] = activeYm.split('-').map(Number);
    const statusLabel =
      monthlyTargetInfo?.status === 'ON_TRACK'
        ? '✓ ON TRACK'
        : monthlyTargetInfo?.status === 'NEED_TO_PUSH'
          ? '⚠️ NEED TO PUSH'
          : monthlyTargetInfo?.status === 'CRITICAL'
            ? '🔴 CRITICAL'
            : monthlyTargetInfo?.targetSet
              ? '—'
              : 'Target not set';

    const saveMonthlyTarget = async () => {
      if (!token) return;
      const amount = Number(monthlyTargetInput);
      if (!Number.isFinite(amount) || amount < 0) {
        toast({
          title: 'Invalid amount',
          description: 'Please enter a valid non-negative target amount.',
          variant: 'destructive',
        });
        return;
      }
      setSavingMonthlyTarget(true);
      try {
        const res = await fetch(`${apiBase}/monthly-targets/set`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            year: targetYear,
            month: targetMonth,
            targetAmount: amount,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const msg =
            data && typeof data === 'object' && 'message' in data
              ? String((data as any).message)
              : 'Failed to save monthly target';
          throw new Error(msg);
        }
        setMonthlyTargetInput('');
        await loadDashboardData();
        toast({
          title: 'Monthly target saved',
          description:
            data &&
            typeof data === 'object' &&
            'directorNotification' in data &&
            (data as any).directorNotification === 'sent'
              ? 'Directors were notified by email.'
              : 'Saved successfully.',
        });
      } catch (e) {
        toast({
          title: 'Could not save target',
          description: e instanceof Error ? e.message : 'Network error. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setSavingMonthlyTarget(false);
      }
    };

    return (
      <div className="w-full min-w-0 space-y-6 overflow-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <BarChart3 className="h-5 w-5 shrink-0 text-emerald-600" />
            <h2 className="truncate text-xl font-bold">Revenue</h2>
          </div>
          <p className="text-muted-foreground max-w-xl text-sm">
            Monthly figures are saved at month close (before optional order archive), so history
            stays available after orders are cleared.
          </p>
        </div>

        <MonthlyTargetSetup
          info={monthlyTargetInfo}
          inputValue={monthlyTargetInput}
          onInputChange={setMonthlyTargetInput}
          onSave={saveMonthlyTarget}
          saving={savingMonthlyTarget}
          formatINR={formatINR}
        />

        <Card className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <CardHeader className="px-3 pb-2 sm:px-6">
            <CardTitle className="text-lg">Monthly performance</CardTitle>
            <CardDescription>
              Closed months are saved at month end (before optional order archive). The current
              month updates live until it is closed. New customers counts first-time orders (by
              phone or session) in that month.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-6 sm:px-6">
            <div className="-mx-1 overflow-x-auto px-1">
              <Table className="min-w-[880px]">
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="whitespace-nowrap">Month</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Total orders</TableHead>
                    <TableHead className="text-right whitespace-nowrap">New customers</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Avg orders / day</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Avg order value</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Total sales</TableHead>
                    <TableHead className="w-12 text-center whitespace-nowrap">More</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyRevenueSnapshots.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                        No revenue data loaded. Snapshots are created when each month closes; the
                        current month appears here as soon as there is activity.
                      </TableCell>
                    </TableRow>
                  ) : (
                    monthlyRevenueSnapshots.map(row => {
                      const label = new Date(row.year, row.month - 1, 1).toLocaleDateString(
                        'en-IN',
                        {
                          month: 'long',
                          year: 'numeric',
                        }
                      );
                      const open = revenueExpandedYearMonth === row.yearMonth;
                      return (
                        <React.Fragment key={row.yearMonth}>
                          <TableRow className="hover:bg-slate-50/80">
                            <TableCell className="font-medium">
                              <span className="inline-flex flex-wrap items-center gap-2">
                                {label}
                                {row.isLive ? (
                                  <Badge variant="secondary" className="text-xs font-normal">
                                    Live
                                  </Badge>
                                ) : null}
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.totalOrders.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.newCustomersCount.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {Math.round(row.avgOrdersPerDay * 1000) / 1000}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.paidOrdersCount > 0 ? formatINR(row.avgOrderValue) : '—'}
                            </TableCell>
                            <TableCell className="text-right font-medium text-emerald-800 tabular-nums">
                              {formatINR(row.totalSales)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-lg"
                                aria-expanded={open}
                                aria-label={
                                  open ? 'Hide extra metrics' : 'View loss and staff metrics'
                                }
                                onClick={() =>
                                  setRevenueExpandedYearMonth(ym =>
                                    ym === row.yearMonth ? null : row.yearMonth
                                  )
                                }
                              >
                                <Eye
                                  className={`h-4 w-4 ${open ? 'text-emerald-700' : 'text-slate-600'}`}
                                />
                              </Button>
                            </TableCell>
                          </TableRow>
                          {open ? (
                            <TableRow className="border-0 bg-slate-50/90 hover:bg-slate-50/90">
                              <TableCell colSpan={7} className="py-4">
                                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                                      Loss (removed items)
                                    </p>
                                    <p className="mt-0.5 text-base font-semibold text-slate-900">
                                      {formatINR(row.totalLoss)}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                                      Employee overtime (approved hrs)
                                    </p>
                                    <p className="mt-0.5 text-base font-semibold text-slate-900">
                                      {Math.round(row.overtimeHoursApproved * 100) / 100} hrs
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                                      Approved leaves
                                    </p>
                                    <p className="mt-0.5 text-base font-semibold text-slate-900">
                                      {row.approvedLeavesCount.toLocaleString('en-IN')}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                                      Late entries
                                    </p>
                                    <p className="mt-0.5 text-base font-semibold text-slate-900">
                                      {row.lateEntriesCount.toLocaleString('en-IN')}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

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
      (typeof window !== 'undefined' && window.localStorage.getItem('branch_logo_url')) ||
      branchForm?.logoUrl ||
      cafeLogo;
    const companyNameFromSettings =
      branchForm?.name ||
      branch?.name ||
      (typeof window !== 'undefined' ? window.localStorage.getItem('branch_name') : null) ||
      'Cafe Chapter 1 Restro Private Limited';
    const pdfBuildOpts = {
      logoUrl: String(logoUrl),
      companyName: companyNameFromSettings,
      companyAddress: branchForm?.location ?? branch?.location ?? 'Gautam Nagar',
      companyPincode: branchForm?.pincode || branch?.pincode || '',
      phone: branchForm?.phone || '',
    };
    return (
      <div className="w-full min-w-0 space-y-6 overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <IndianRupee className="h-5 w-5 shrink-0 text-emerald-600" />
            <h2 className="truncate text-xl font-bold">Salary Slips</h2>
          </div>
          <Button
            type="button"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onOpenGenerateDialog();
            }}
            className="min-h-12 w-full shrink-0 rounded-lg bg-gradient-to-r from-[#064E3B] to-[#047857] font-semibold text-white hover:opacity-90 sm:w-auto"
          >
            <IndianRupee className="mr-2 h-5 w-5" />
            Generate Salary Slip
          </Button>
        </div>

        {/* Analytics cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Total Salary Paid This Month
                </p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">
                  {formatINR(salaryTotalThisMonth)}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-100 p-3">
                <IndianRupee className="h-8 w-8 text-emerald-700" />
              </div>
            </div>
          </Card>
          <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Payslips Generated</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">
                  {salarySlipsFiltered.length}
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 p-3">
                <Users className="h-8 w-8 text-slate-600" />
              </div>
            </div>
          </Card>
        </div>

        <Card className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <CardHeader className="px-3 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg">Generated Slips</CardTitle>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Input
                  placeholder="Search employee..."
                  value={salaryTableSearch}
                  onChange={e => {
                    setSalaryTableSearch(e.target.value);
                    setSalaryTablePage(0);
                  }}
                  className="h-11 w-full min-w-0 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 sm:w-48"
                />
                <input
                  type="month"
                  value={salaryTableMonthFilter}
                  onChange={e => {
                    setSalaryTableMonthFilter(e.target.value);
                    setSalaryTablePage(0);
                  }}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm sm:w-40"
                  title="Filter by month"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="-mx-1 overflow-x-auto px-1">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="whitespace-nowrap">Slip No.</TableHead>
                    <TableHead className="whitespace-nowrap">Employee</TableHead>
                    <TableHead className="whitespace-nowrap">Month</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Net Salary</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salarySlipsPaginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                        {salarySlipsFiltered.length === 0
                          ? 'No salary slips yet. Generate one above.'
                          : 'No results for this search or filter.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    salarySlipsPaginated.map(slip => {
                      const rowBg = getSalarySlipMonthColor(slip);
                      return (
                        <TableRow
                          key={slip.id}
                          className="hover:opacity-95"
                          style={{ backgroundColor: rowBg }}
                        >
                          <TableCell className="font-mono text-xs">
                            {slip.salaryNumber ?? '—'}
                          </TableCell>
                          <TableCell className="font-medium">
                            {slip.employee?.name ?? '—'}
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
                                slip.status === 'Sent'
                                  ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-800'
                              }
                            >
                              {slip.status ?? 'Paid'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 rounded-lg border-slate-300"
                                >
                                  <MoreHorizontal className="mr-1 h-4 w-4" /> Actions
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => {
                                    const html = buildPayslipHtmlFromSlip(slip, pdfBuildOpts);
                                    const w = window.open('', '_blank');
                                    if (w) {
                                      w.document.write(html);
                                      w.document.close();
                                      w.focus();
                                    }
                                  }}
                                >
                                  <Eye className="mr-2 h-4 w-4" /> View PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onOpenGenerateAgain(slip)}>
                                  <RefreshCw className="mr-2 h-4 w-4" /> Generate Again
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    const html = buildPayslipHtmlFromSlip(slip, pdfBuildOpts);
                                    const w = window.open('', '_blank');
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
                                  <Download className="mr-2 h-4 w-4" /> Download PDF
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
              <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground order-2 text-center text-sm sm:order-1 sm:text-left">
                  Showing {salaryTablePage * SALARY_TABLE_PAGE_SIZE + 1}–
                  {Math.min(
                    (salaryTablePage + 1) * SALARY_TABLE_PAGE_SIZE,
                    salarySlipsFiltered.length
                  )}{' '}
                  of {salarySlipsFiltered.length}
                </p>
                <div className="order-1 flex justify-center gap-2 sm:order-2 sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 flex-1 rounded-lg sm:flex-initial"
                    disabled={salaryTablePage === 0}
                    onClick={() => setSalaryTablePage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 flex-1 rounded-lg sm:flex-initial"
                    disabled={
                      (salaryTablePage + 1) * SALARY_TABLE_PAGE_SIZE >= salarySlipsFiltered.length
                    }
                    onClick={() => setSalaryTablePage(p => p + 1)}
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
        <div className="flex min-w-0 items-center gap-2">
          <Award className="h-5 w-5 shrink-0 text-emerald-600" />
          <h2 className="text-xl font-bold">Employee Certificates</h2>
        </div>
        <Button
          onClick={() => setIsCertificateDialogOpen(true)}
          className="min-h-12 w-full rounded-lg bg-gradient-to-r from-[#064E3B] to-[#047857] font-semibold text-white hover:opacity-90 sm:w-auto"
        >
          <Plus className="mr-2 h-5 w-5" />
          Generate Certificate
        </Button>
      </div>
      <Card className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Generated Certificates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="-mx-1 overflow-x-auto px-1">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="whitespace-nowrap">Employee</TableHead>
                  <TableHead className="whitespace-nowrap">Certificate Name</TableHead>
                  <TableHead className="whitespace-nowrap">Type</TableHead>
                  <TableHead className="whitespace-nowrap">Issue Date</TableHead>
                  <TableHead className="whitespace-nowrap">Expiry Date</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                      No certificates yet. Generate one above.
                    </TableCell>
                  </TableRow>
                ) : (
                  certificates.map(cert => (
                    <TableRow key={cert.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium">{cert.employee?.name ?? '—'}</TableCell>
                      <TableCell>{cert.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {cert.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{cert.issueDate}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {cert.expiryDate || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="h-9 rounded-lg bg-gradient-to-r from-[#064E3B] to-[#047857] text-white hover:opacity-90"
                          onClick={() =>
                            toast({
                              title: 'Download',
                              description: 'Certificate download in next update',
                            })
                          }
                        >
                          <Download className="mr-1 h-4 w-4" /> PDF
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
      name: '',
      issueDate: new Date().toISOString().split('T')[0],
      expiryDate: '',
      type: '',
    });
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
      const employee = employees.find(e => e.id === localForm.employeeId);
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

        setCertificates(prev => [...prev, newCertificate]);
        setIsCertificateDialogOpen(false);
        setIsGenerating(false);

        toast({
          title: 'Certificate generated',
          description: `${localForm.name} for ${employee.name}`,
        });
      }, 1000);
    };

    return (
      <Dialog open={isCertificateDialogOpen} onOpenChange={setIsCertificateDialogOpen}>
        <DialogContent
          className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-md overflow-y-auto p-4 sm:w-[calc(100vw-2rem)] sm:p-6"
          aria-describedby="certificate-dialog-desc"
        >
          <DialogHeader>
            <DialogTitle>Generate Certificate</DialogTitle>
            <DialogDescription id="certificate-dialog-desc" className="sr-only">
              Choose employee, certificate name and type, then set issue and expiry dates.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Employee</Label>
              <Select
                value={String(localForm.employeeId)}
                onValueChange={v => setLocalForm({ ...localForm, employeeId: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter(e => String(e.status || '').toUpperCase() === 'ACTIVE')
                    .map(emp => (
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
                onChange={e => setLocalForm({ ...localForm, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Certificate Type</Label>
              <Select
                value={localForm.type}
                onValueChange={v => setLocalForm({ ...localForm, type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="experience">Experience Certificate</SelectItem>
                  <SelectItem value="completion">Completion Certificate</SelectItem>
                  <SelectItem value="appreciation">Appreciation Certificate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Issue Date</Label>
                <Input
                  type="date"
                  value={localForm.issueDate}
                  onChange={e => setLocalForm({ ...localForm, issueDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Expiry Date (Optional)</Label>
                <Input
                  type="date"
                  value={localForm.expiryDate}
                  onChange={e => setLocalForm({ ...localForm, expiryDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCertificateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating...
                </>
              ) : (
                'Generate'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const currentSection = validSectionKeys.includes(activeSection) ? activeSection : 'overview';

  // Memoize section body so cards/lists do NOT re-render when only clock or unrelated state updates
  const mainSectionContent = useMemo(() => {
    switch (currentSection) {
      case 'overview':
        return <OverviewSection />;
      case 'performance':
        return <PerformanceSection />;
      case 'menu':
        return <MenuSection />;
      case 'employees':
        return <EmployeesSection />;
      case 'all-orders':
        return <OrdersSection />;
      case 'customer-leaderboard':
        return <CustomerLeaderboardSection />;
      case 'customer-queries':
        return <CustomerQueriesSection />;
      case 'removed-items':
        return <RemovedItemsSection />;
      case 'hours':
        return <WorkHoursSection />;
      case 'overtime':
        return <OvertimeSection />;
      case 'late':
        return <LateSection />;
      case 'leaves':
        return <LeaveRequestsSection />;
      case 'revenue':
        return <RevenueSection />;
      case 'salary-slips':
        return (
          <SalarySlipsSection
            onOpenGenerateDialog={handleOpenGenerateDialog}
            onOpenGenerateAgain={handleOpenGenerateAgain}
          />
        );
      case 'certificates':
        return <CertificatesSection />;
      case 'settings':
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
            handleDeleteBranch={handleDeleteBranch}
            loadSettings={loadSettings}
            savingBranch={savingBranch}
            notifications={notifications}
            errorLogs={errorLogs}
            toast={toast}
            token={token}
            directorsData={directorsData}
            loadDirectors={loadDirectors}
            branchesListUnavailable={branchesListUnavailable}
          />
        );
      default:
        return <OverviewSection />;
    }
  }, [
    currentSection,
    ordersByTable,
    handleOpenOrderDialog,
    performanceSummary,
    monthlyRevenueSnapshots,
    revenueExpandedYearMonth,
    branches,
    branchesListUnavailable,
    leaveRequests,
    leaveLoading,
    leaveStatusFilter,
    leaveEmployeeFilter,
    leaveDateFrom,
    leaveDateTo,
    leaveRemarksById,
    leaveActionLoadingId,
    loadLeaves,
    updateLeaveStatus,
    employees,
  ]);

  if (!ready || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Skeleton layout on first load only (after that, we use a blur overlay)
  if (loading && !hasLoadedOnce) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <header className="h-14 shrink-0 border-b bg-white" />
        <div className="flex flex-1 gap-4 p-4">
          <aside className="w-56 shrink-0 animate-pulse rounded-lg bg-slate-200/60" />
          <main className="min-w-0 flex-1 space-y-4">
            <div className="h-8 w-56 animate-pulse rounded bg-slate-200/60" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200/60" />
              ))}
            </div>
            <div className="h-80 animate-pulse rounded-xl bg-slate-200/60" />
          </main>
        </div>
      </div>
    );
  }

  const displayBranchName = (() => {
    const n = branch?.name?.trim();
    if (!n || n.toLowerCase() === 'main branch' || n.toLowerCase() === 'main')
      return 'Gautam Nagar';
    return n;
  })();

  return (
    <DashboardShell
      role="ADMIN"
      userName={profile?.name ?? 'Admin'}
      branchName={displayBranchName}
      sidebarSections={adminSidebarSections}
      activeKey={currentSection}
      onSelect={key => validSectionKeys.includes(key) && setActiveSection(key)}
      notifications={notifications}
      notificationCount={notifications.filter((n: any) => !n.read).length}
      sidebarBadges={{
        'customer-queries': pendingQueriesCount,
        ...(overtimeSummary.pendingOvertimeCount + overtimeSummary.overtimeRunningCount > 0
          ? {
              overtime: overtimeSummary.pendingOvertimeCount + overtimeSummary.overtimeRunningCount,
            }
          : {}),
      }}
      onNotificationsOpenChange={open => {
        if (open) setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }}
      onClearAllNotifications={async () => {
        setNotifications([]);
        try {
          localStorage.setItem('dm_notifications_cleared_at', String(Date.now()));
        } catch (_) {}
        if (token) {
          try {
            await fetch(`${apiBase}/notifications/mark-all-read`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            });
          } catch (_) {}
        }
      }}
    >
      {/* Show page loader when loading initial data */}
      {loading && !hasLoadedOnce && (
        <PageLoader loading text="Loading dashboard..." className="min-h-96" />
      )}
      
      <div className="relative min-h-full w-full max-w-full space-y-4 overflow-x-hidden px-0 pb-6 sm:px-0">
        {/* Show inline loader for data refreshes */}
        {loading && hasLoadedOnce && (
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
            <InlineLoader loading text="Refreshing data..." />
          </div>
        )}
        {hasLoadedOnce && branches.length === 0 && (
          <Alert className="border-amber-200 bg-amber-50/90 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <Info className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            <AlertTitle className="text-amber-950 dark:text-amber-50">
              {branchesListUnavailable
                ? 'Branch list could not be loaded'
                : 'Create your first branch'}
            </AlertTitle>
            <AlertDescription className="space-y-2 text-amber-900/90 dark:text-amber-100/90">
              <p>
                {branchesListUnavailable
                  ? 'The server may be starting or temporarily busy (for example 503). This is not because you forgot to add a branch—try again in a moment.'
                  : 'Add at least one branch so employees, tables, and orders are tied to a location.'}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="bg-amber-800 text-white hover:bg-amber-900"
                  onClick={() => setActiveSection('settings')}
                >
                  Open Settings → Branches
                </Button>
                {branchesListUnavailable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-amber-300 bg-white/80"
                    onClick={() => loadDashboardData()}
                  >
                    Retry loading
                  </Button>
                ) : null}
              </div>
            </AlertDescription>
          </Alert>
        )}
        {mainSectionContent}
      </div>

      {/* Order Details Dialog – top level so it opens when order card is clicked from Orders section */}
      <Dialog
        open={isOrderDialogOpen}
        onOpenChange={open => {
          if (!open) {
            setPopupDisplayOrder(null);
            setSelectedOrder(null);
          }
          setIsOrderDialogOpen(open);
        }}
      >
        <DialogContent
          className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-lg overflow-x-hidden overflow-y-auto p-4 sm:w-[calc(100vw-2rem)] sm:p-6"
          aria-describedby="order-details-desc"
        >
          <DialogHeader>
            <DialogTitle className="truncate pr-8 text-base sm:text-lg">
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
                '—';
              const items = Array.isArray(displayOrder.items) ? displayOrder.items : [];
              return (
                <div className="min-w-0 space-y-4 py-2 sm:py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-sm">Table</p>
                      <p className="truncate font-medium">Table {tableLabel}</p>
                    </div>
                    <div className="min-w-0 text-left sm:text-right">
                      <p className="text-muted-foreground text-sm">Time</p>
                      <p className="text-sm font-medium break-words sm:text-base">
                        {new Date(displayOrder.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {(displayOrder.employee || displayOrder.branch) && (
                    <div className="text-muted-foreground min-w-0 space-y-1 text-sm break-words">
                      {displayOrder.branch?.name && <p>Branch: {displayOrder.branch.name}</p>}
                      {displayOrder.employee && (
                        <p>
                          Accepted by:{' '}
                          <span className="text-foreground font-medium">
                            {displayOrder.employee.name}
                          </span>
                          {displayOrder.employee.role
                            ? ` (${displayOrder.employee.role})`
                            : displayOrder.employee.employeeCode
                              ? ` (${displayOrder.employee.employeeCode})`
                              : ''}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={displayOrder.status === 'ORDER_COMPLETE' ? 'default' : 'secondary'}
                    >
                      {displayOrder.status}
                    </Badge>
                    <Badge
                      variant={displayOrder.paymentStatus === 'PAID' ? 'default' : 'secondary'}
                      className={
                        displayOrder.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : ''
                      }
                    >
                      {displayOrder.paymentStatus}
                    </Badge>
                  </div>

                  <div className="min-w-0 overflow-x-auto rounded-lg border">
                    <Table className="min-w-[280px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Item</TableHead>
                          <TableHead className="text-right text-xs">Qty</TableHead>
                          <TableHead className="text-right text-xs">Price</TableHead>
                          <TableHead className="text-right text-xs">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items
                          .filter((i: OrderItem) => !i.isRemoved)
                          .map((item: OrderItem) => (
                            <TableRow key={item.id}>
                              <TableCell className="text-sm">
                                {formatItemDisplayName(item.name, item.variant)}
                              </TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">{formatINR(item.price)}</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatINR(item.price * item.quantity)}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-lg font-bold">Total Amount</p>
                    <p className="text-xl font-bold text-emerald-600">
                      {formatINR(displayOrder.totalAmount)}
                    </p>
                  </div>

                  {/* Invoice download */}
                  <div className="pt-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => {
                          const url = `${apiBase}/orders/${displayOrder.id}/invoice-pdf`;
                          const a = document.createElement('a');
                          a.href = url;
                          a.target = '_blank';
                          a.rel = 'noopener noreferrer';
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                        }}
                      >
                        <Download className="h-4 w-4" />
                        Download Invoice
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={async () => {
                          try {
                            const res = await fetch(
                              `${apiBase}/orders/${displayOrder.id}/whatsapp-invoice`,
                              { method: 'GET' }
                            );
                            const data = (await res.json().catch(() => ({}))) as {
                              waMeLink?: string;
                              message?: string;
                            };
                            if (!res.ok || !data.waMeLink) {
                              toast({
                                title: 'Cannot send invoice',
                                description:
                                  data.message ||
                                  'Customer name/mobile missing for this order. Add customer mobile then retry.',
                                variant: 'destructive',
                              });
                              return;
                            }
                            window.open(data.waMeLink, '_blank', 'noopener,noreferrer');
                          } catch {
                            toast({
                              title: 'WhatsApp failed',
                              description: 'Could not open WhatsApp. Check connection and try again.',
                              variant: 'destructive',
                            });
                          }
                        }}
                      >
                        Send on WhatsApp
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
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
                            toast({
                              title: 'Copied',
                              description: 'Invoice link copied to clipboard.',
                              className:
                                'border-emerald-500 bg-emerald-50 text-emerald-900 font-medium',
                            });
                          } catch {
                            toast({
                              title: 'Copy failed',
                              description: 'Could not copy link. Use Download Invoice instead.',
                              variant: 'destructive',
                            });
                          }
                        }}
                      >
                        <Copy className="h-4 w-4" />
                        Copy Link
                      </Button>
                    </div>
                  </div>

                  {displayOrder.status !== 'ORDER_COMPLETE' && selectedOrder && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={completingOrderId === selectedOrder?.id}
                        onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'ORDER_COMPLETE')}
                      >
                        {completingOrderId === selectedOrder?.id ? (
                          <>
                            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Completing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-1 h-4 w-4" />
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
        onOpenChange={open => {
          if (!open) setEditingItem(null);
          setIsItemDialogOpen(open);
        }}
      >
        <DialogContent
          className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-md overflow-y-auto p-4 sm:w-[calc(100vw-2rem)] sm:p-6"
          aria-describedby="menu-item-dialog-desc"
        >
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add Item'}</DialogTitle>
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
                onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder="Description"
                value={itemForm.description}
                onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Full Price (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={itemForm.basePrice || ''}
                  onChange={e =>
                    setItemForm(f => ({
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
                  value={itemForm.halfPrice || ''}
                  onChange={e =>
                    setItemForm(f => ({
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
                onCheckedChange={c => setItemForm(f => ({ ...f, hasHalf: !!c }))}
              />
              <Label htmlFor="hasHalf">Has half portion</Label>
            </div>
            <div className="grid gap-2">
              <Label>Image URL (optional)</Label>
              <Input
                placeholder="https://..."
                value={itemForm.imageUrl}
                onChange={e => setItemForm(f => ({ ...f, imageUrl: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                checked={itemForm.isActive}
                onCheckedChange={c => setItemForm(f => ({ ...f, isActive: !!c }))}
              />
              <Label htmlFor="isActive">Active (visible on menu)</Label>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-violet-100 bg-violet-50/40 p-3">
              <Checkbox
                id="item-highlight-new"
                checked={itemForm.highlightAsNewLaunch}
                onCheckedChange={c => setItemForm(f => ({ ...f, highlightAsNewLaunch: !!c }))}
              />
              <Label htmlFor="item-highlight-new" className="text-sm leading-snug font-medium">
                Highlight this category on the customer menu as{' '}
                <span className="text-violet-700">New launch</span> (7 days from save). Stacks with
                Best Seller if both apply.
              </Label>
            </div>
            {!editingItem && (
              <div className="flex items-center gap-2 rounded-lg border bg-amber-50/50 p-3">
                <Checkbox
                  id="notifyCustomers"
                  checked={itemForm.notifyCustomers}
                  onCheckedChange={c => setItemForm(f => ({ ...f, notifyCustomers: !!c }))}
                />
                <Label htmlFor="notifyCustomers" className="text-sm font-medium">
                  Notify customers about this new launch (broadcast to all saved mobiles)
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
          className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-md overflow-y-auto p-4 sm:w-[calc(100vw-2rem)] sm:p-6"
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
                onChange={e => setCreateBranchForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Location *</Label>
              <Input
                placeholder="Address"
                value={createBranchForm.location}
                onChange={e =>
                  setCreateBranchForm(f => ({
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
                onChange={e => setCreateBranchForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Logo URL *</Label>
              <Input
                placeholder="https://..."
                value={createBranchForm.logoUrl}
                onChange={e =>
                  setCreateBranchForm(f => ({
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
                onChange={e =>
                  setCreateBranchForm(f => ({
                    ...f,
                    googleReviewUrl: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Directors Email (optional)</Label>
              <p className="text-muted-foreground text-xs">
                Add multiple emails (comma/space separated). Directors will receive daily/monthly
                reports after verification.
              </p>
              {createBranchForm.directorsEmail?.trim() ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from(
                    new Set(
                      createBranchForm.directorsEmail
                        .split(/[,\s]+/g)
                        .map(e => e.trim())
                        .filter(Boolean)
                    )
                  ).map(email => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs"
                    >
                      <Mail className="text-muted-foreground h-3.5 w-3.5" />
                      <span className="max-w-[220px] truncate">{email}</span>
                      <button
                        type="button"
                        className="text-slate-500 hover:text-red-600"
                        onClick={() => {
                          const next = Array.from(
                            new Set(
                              createBranchForm.directorsEmail
                                .split(/[,\s]+/g)
                                .map(e => e.trim())
                                .filter(Boolean)
                            )
                          ).filter(x => x !== email);
                          setCreateBranchForm(f => ({
                            ...f,
                            directorsEmail: next.join(', '),
                          }));
                        }}
                        aria-label={`Remove ${email}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  placeholder="Type email(s) then tap + Add"
                  value={createBranchDirectorInput}
                  onChange={e => setCreateBranchDirectorInput(e.target.value)}
                  className="min-w-0 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 min-w-[92px] shrink-0 gap-1 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                  disabled={!createBranchDirectorInput.trim()}
                  onClick={() => {
                    const raw = createBranchDirectorInput.trim();
                    if (!raw) return;
                    const incoming = raw
                      .split(/[,\s]+/g)
                      .map(e => e.trim())
                      .filter(Boolean);
                    const existing = (createBranchForm.directorsEmail || '')
                      .split(/[,\s]+/g)
                      .map(e => e.trim())
                      .filter(Boolean);
                    const merged = Array.from(new Set([...existing, ...incoming]));
                    setCreateBranchForm(f => ({
                      ...f,
                      directorsEmail: merged.join(', '),
                    }));
                    setCreateBranchDirectorInput('');
                  }}
                >
                  + Add
                </Button>
              </div>
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
              disabled={
                savingBranch ||
                !createBranchForm.name.trim() ||
                !createBranchForm.location.trim() ||
                !createBranchForm.logoUrl.trim()
              }
            >
              {savingBranch ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Employee – send login credentials */}
      <Dialog open={!!employeeToVerify} onOpenChange={open => !open && setEmployeeToVerify(null)}>
        <DialogContent
          className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-md overflow-y-auto p-4 sm:w-[calc(100vw-2rem)] sm:p-6"
          aria-describedby="verify-employee-desc"
        >
          <DialogHeader>
            <DialogTitle>Verify Employee?</DialogTitle>
            <DialogDescription id="verify-employee-desc">
              {employeeToVerify
                ? `${employeeToVerify.name} will receive login credentials (temporary password) via email. They can then log in and change their password.`
                : ''}
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
            <Button onClick={handleVerifyAndSendInvite} disabled={!!verifyingEmployeeId}>
              {verifyingEmployeeId ? (
                <>
                  <span
                    className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden
                  />
                  Sending invite…
                </>
              ) : (
                'Send Invite'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change password (admin) – director(s) receive email with new password */}
      <ChangePasswordDialog
        open={!!employeeToChangePassword}
        employee={employeeToChangePassword}
        onOpenChange={open => {
          if (!open) {
            setEmployeeToChangePassword(null);
          }
        }}
        onSuccess={() => {
          setEmployeeToChangePassword(null);
        }}
        token={token}
        loading={changingPasswordEmployeeId !== null}
        setLoading={id => setChangingPasswordEmployeeId(id)}
      />

      {/* Dialogs - rendered at dashboard level so they do not remount when section re-renders (no flash on type) */}
      <AddEmployeeDialog
        open={isEmployeeDialogOpen}
        onOpenChange={setIsEmployeeDialogOpen}
        branches={branches}
        onCreated={emp => {
          setEmployees(prev => [...prev, emp as Employee]);
          setIsEmployeeDialogOpen(false);
        }}
        onGoToSettings={() => {
          setIsEmployeeDialogOpen(false);
          setActiveSection('settings');
          setCreateBranchOpen(true);
        }}
        token={token}
      />
      <EditEmployeeDialog
        open={!!editingEmployee}
        employee={editingEmployee}
        onOpenChange={open => !open && setEditingEmployee(null)}
        onSaved={emp => {
          setEmployees(prev => prev.map(e => (e.id === emp.id ? { ...e, ...emp } : e)));
          setEditingEmployee(null);
        }}
        token={token}
      />
      <SalarySlipDialogModule
        key={isSalarySlipDialogOpen ? 'salary-dialog-open' : 'salary-dialog-closed'}
        open={isSalarySlipDialogOpen}
        onOpenChange={open => {
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
