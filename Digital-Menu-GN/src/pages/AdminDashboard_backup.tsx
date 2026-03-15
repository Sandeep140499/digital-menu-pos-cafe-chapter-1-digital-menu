import { useEffect, useState, useMemo } from "react";
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
  Star,
  Package,
  Bell,
  Award,
  ChevronLeft,
  Eye,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

// Types
type MenuCategory = {
  id: number;
  name: string;
  createdAt: string;
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
  status: "ACTIVE" | "INACTIVE" | "LEFT";
  branchId: number;
  createdAt: string;
  profileImageUrl?: string;
  shiftStartTime?: string;
  totalHoursToday?: number;
  ordersToday?: number;
  salesToday?: number;
};

type Order = {
  id: number;
  tableId: number;
  tableNumber?: string;
  employeeId?: number;
  employeeName?: string;
  branchId: number;
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
const formatINR = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const sidebarItems: SidebarItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "menu", label: "Menu", icon: ChefHat },
  { key: "employees", label: "Employees", icon: Users },
  { key: "orders", label: "Orders", icon: ShoppingCart },
  { key: "removed-items", label: "Removed Items", icon: Trash2 },
  { key: "hours", label: "Work Hours", icon: Clock },
  { key: "salary-slips", label: "Salary Slips", icon: IndianRupee },
  { key: "certificates", label: "Certificates", icon: Award },
  { key: "settings", label: "Settings", icon: Settings },
];

const AdminDashboard = () => {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<string>(() => {
    // Persist section state in localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin_active_section') || 'overview';
    }
    return 'overview';
  });
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

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

  // Form states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", imageUrl: "" });
  const [itemForm, setItemForm] = useState({
    name: "", description: "", basePrice: 0, hasHalf: false,
    halfPrice: 0, isActive: true, categoryId: 0, imageUrl: "",
  });

  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    name: "", email: "", employeeCode: "", status: "ACTIVE" as const,
  });

  // Additional state for new features
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [ordersByTable, setOrdersByTable] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [orderDateFilter, setOrderDateFilter] = useState<string>(new Date().toISOString().slice(0, 10));
  const [orderTableFilter, setOrderTableFilter] = useState<string>("all");

  // Work hours state
  const [shifts, setShifts] = useState<any[]>([]);
  const [hoursEmployeeFilter, setHoursEmployeeFilter] = useState<string>("all");
  const [hoursStartDate, setHoursStartDate] = useState<string>("");
  const [hoursEndDate, setHoursEndDate] = useState<string>("");
  const [hoursSummary, setHoursSummary] = useState({ totalShifts: 0, totalHours: 0, totalSales: 0 });
  const [dailyStats, setDailyStats] = useState<any[]>([]);

  // Settings state
  const [branch, setBranch] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [branchForm, setBranchForm] = useState({ name: "", location: "", timezone: "Asia/Kolkata" });

  // Removed items state
  const [removedItems, setRemovedItems] = useState<RemovedItem[]>([]);
  const [dailyRemovalSummaries, setDailyRemovalSummaries] = useState<DailyRemovalSummary[]>([]);
  const [removedItemsDateFilter, setRemovedItemsDateFilter] = useState<string>(new Date().toISOString().slice(0, 10));
  const [totalLoss, setTotalLoss] = useState<number>(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Menu management state
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [viewingCategory, setViewingCategory] = useState<number | null>(null);

  // Salary slips state
  const [salarySlips, setSalarySlips] = useState<any[]>([]);
  const [isSalarySlipDialogOpen, setIsSalarySlipDialogOpen] = useState(false);
  const [salarySlipForm, setSalarySlipForm] = useState({
    employeeId: 0, month: "", year: new Date().getFullYear(),
    basicSalary: 0, allowances: 0, deductions: 0, netSalary: 0
  });

  // Certificates state
  const [certificates, setCertificates] = useState<any[]>([]);
  const [isCertificateDialogOpen, setIsCertificateDialogOpen] = useState(false);
  const [certificateForm, setCertificateForm] = useState({
    employeeId: 0, name: "", issueDate: new Date().toISOString().split("T")[0],
    expiryDate: "", type: ""
  });

  // Time updater
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Filtered categories for menu search
  const filteredCategories = useMemo(() => {
    if (!menuSearchQuery) return categories;
    return categories.filter(cat =>
      cat.name.toLowerCase().includes(menuSearchQuery.toLowerCase())
    );
  }, [categories, menuSearchQuery]);

  // Viewing category data
  const viewingCategoryData = useMemo(() => {
    if (!viewingCategory) return null;
    return categories.find(c => c.id === viewingCategory);
  }, [categories, viewingCategory]);

  // Active employees for salary slips and certificates
  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status === "ACTIVE");
  }, [employees]);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("dm_auth_token");
    if (!storedToken) {
      window.location.href = "/login";
      return;
    }
    setToken(storedToken);
  }, []);

  useEffect(() => {
    if (!token) return;
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, [token]);

  // Calculate today's stats
  const todayStats: TodayStats = useMemo(() => {
    const todayOrders = orders;
    const paidOrders = todayOrders.filter(o => o.paymentStatus === "PAID");
    const pendingOrders = todayOrders.filter(o => o.paymentStatus !== "PAID");
    
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = todayOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    const activeEmps = employees.filter(e => e.status === "ACTIVE").length;
    
    const totalItemsSold = itemSales.reduce((sum, item) => sum + item.quantity, 0);
    
    const topItem = itemSales.length > 0 
      ? itemSales.reduce((max, item) => item.quantity > max.quantity ? item : max, itemSales[0])
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

  const loadDashboardData = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      
      const [menuRes, employeesRes, ordersRes] = await Promise.all([
        fetch(`${apiBase}/menu`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/employees`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/orders/live`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (menuRes.ok) {
        const menuData = await menuRes.json();
        setCategories(menuData);
        
        // Calculate item sales from today's orders
        const itemMap = new Map<string, ItemSales>();
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          ordersData.forEach((order: Order) => {
            order.items.forEach((item: OrderItem) => {
              const existing = itemMap.get(item.name);
              if (existing) {
                existing.quantity += item.quantity;
                existing.revenue += item.price * item.quantity;
              } else {
                itemMap.set(item.name, {
                  itemName: item.name,
                  quantity: item.quantity,
                  revenue: item.price * item.quantity,
                });
              }
            });
          });
        }
        setItemSales(Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity));
      }

      if (employeesRes.ok) {
        const empData = await employeesRes.json();
        setEmployees(empData);
        
        // Calculate employee sales
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          const empSalesMap = new Map<number, EmployeeSales>();
          
          empData.forEach((emp: Employee) => {
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
          
          setEmployeeSales(Array.from(empSalesMap.values()).sort((a, b) => b.revenue - a.revenue));
        }
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // API Handlers
  const handleCreateCategory = async () => {
    if (!token || !categoryForm.name.trim()) return;
    try {
      const res = await fetch(`${apiBase}/menu/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: categoryForm.name }),
      });
      if (res.ok) {
        toast({ title: "Success", description: "Category created" });
        setCategoryForm({ name: "" });
        setIsCategoryDialogOpen(false);
        loadDashboardData();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create category", variant: "destructive" });
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/menu/categories/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast({ title: "Success", description: "Category deleted" });
        loadDashboardData();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete category", variant: "destructive" });
    }
  };

  const handleCreateItem = async () => {
    if (!token || !itemForm.name.trim() || itemForm.basePrice <= 0) return;
    try {
      const res = await fetch(`${apiBase}/menu/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(itemForm),
      });
      if (res.ok) {
        toast({ title: "Success", description: "Menu item created" });
        setItemForm({ name: "", description: "", basePrice: 0, hasHalf: false, halfPrice: 0, isActive: true, categoryId: 0, imageUrl: "" });
        setIsItemDialogOpen(false);
        loadDashboardData();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create item", variant: "destructive" });
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
      toast({ title: "Error", description: "Failed to update item", variant: "destructive" });
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
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    }
  };

  const handleCreateEmployee = async () => {
    if (!token || !employeeForm.name.trim() || !employeeForm.email.trim()) return;
    try {
      const res = await fetch(`${apiBase}/employees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...employeeForm, branchId: 1, password: "password123" }),
      });
      if (res.ok) {
        toast({ title: "Success", description: "Employee created" });
        setEmployeeForm({ name: "", email: "", employeeCode: "", status: "ACTIVE" });
        setIsEmployeeDialogOpen(false);
        loadDashboardData();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create employee", variant: "destructive" });
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    if (!token) return;
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
        toast({ title: "Success", description: `Order ${status}` });
        loadDashboardData();
        loadAllOrders();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update order", variant: "destructive" });
    }
  };

  // Load all orders with filters
  const loadAllOrders = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (orderDateFilter) params.append("date", orderDateFilter);
      if (orderTableFilter !== "all") params.append("tableId", orderTableFilter);
      
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

  // Load shift history
  const loadShiftHistory = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (hoursEmployeeFilter !== "all") params.append("employeeId", hoursEmployeeFilter);
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

  // Load branch and notifications
  const loadSettings = async () => {
    if (!token) return;
    try {
      const [branchRes, notifRes] = await Promise.all([
        fetch(`${apiBase}/config/branch`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/config/notifications`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      
      if (branchRes.ok) {
        const branchData = await branchRes.json();
        setBranch(branchData);
        setBranchForm({
          name: branchData?.name || "",
          location: branchData?.location || "",
          timezone: branchData?.timezone || "Asia/Kolkata",
        });
      }
      
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setNotifications(notifData);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  // Update branch settings
  const handleUpdateBranch = async () => {
    if (!token || !branch) return;
    try {
      const res = await fetch(`${apiBase}/config/branch/${branch.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(branchForm),
      });
      if (res.ok) {
        toast({ title: "Success", description: "Branch settings updated" });
        loadSettings();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update branch", variant: "destructive" });
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

      const res = await fetch(`${apiBase}/orders/reports/removed-items?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRemovedItems(data.removedItems);
        setDailyRemovalSummaries(data.dailyTotals);
        setTotalLoss(data.totalLoss);
      }
    } catch (error) {
      console.error("Error loading removed items:", error);
    }
  };

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

  useEffect(() => {
    if (token && activeSection === "hours") {
      loadShiftHistory();
    }
  }, [token, activeSection, hoursEmployeeFilter, hoursStartDate, hoursEndDate]);

  useEffect(() => {
    if (token && activeSection === "settings") {
      loadSettings();
    }
  }, [token, activeSection]);

  // Auto refresh orders every 10 seconds when on orders page
  useEffect(() => {
    if (activeSection !== "orders") return;
    const interval = setInterval(() => {
      loadAllOrders();
    }, 10000);
    return () => clearInterval(interval);
  }, [activeSection, orderDateFilter, orderTableFilter]);

  // ============ SECTIONS ============

  // 1. COMPACT KPI CARDS - All INR
  const KPICards = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Row 1 */}
      <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-lg font-bold text-emerald-700">{formatINR(todayStats.totalRevenue)}</p>
            </div>
            <div className="p-1.5 bg-emerald-100 rounded-md">
              <IndianRupee className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total Orders</p>
              <p className="text-lg font-bold text-blue-700">{todayStats.totalOrders}</p>
            </div>
            <div className="p-1.5 bg-blue-100 rounded-md">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-lg font-bold text-amber-700">{todayStats.pendingPayments}</p>
            </div>
            <div className="p-1.5 bg-amber-100 rounded-md">
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Paid Orders</p>
              <p className="text-lg font-bold text-green-700">{todayStats.paidOrders}</p>
            </div>
            <div className="p-1.5 bg-green-100 rounded-md">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row 2 */}
      <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Active Staff</p>
              <p className="text-lg font-bold text-purple-700">{todayStats.activeEmployees}</p>
            </div>
            <div className="p-1.5 bg-purple-100 rounded-md">
              <Users className="h-4 w-4 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-cyan-50 to-white border-cyan-100">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Avg Order</p>
              <p className="text-lg font-bold text-cyan-700">{formatINR(todayStats.avgOrderValue)}</p>
            </div>
            <div className="p-1.5 bg-cyan-100 rounded-md">
              <TrendingUp className="h-4 w-4 text-cyan-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-pink-50 to-white border-pink-100">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Items Sold</p>
              <p className="text-lg font-bold text-pink-700">{todayStats.totalItemsSold}</p>
            </div>
            <div className="p-1.5 bg-pink-100 rounded-md">
              <Package className="h-4 w-4 text-pink-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-100">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Top Item</p>
              <p className="text-sm font-bold text-orange-700 truncate max-w-[80px]">
                {todayStats.topSellingItem?.name || "—"}
              </p>
              <p className="text-xs text-orange-600">({todayStats.topSellingItem?.quantity || 0})</p>
            </div>
            <div className="p-1.5 bg-orange-100 rounded-md">
              <Star className="h-4 w-4 text-orange-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // 2. ACTIVE EMPLOYEES SECTION
  const ActiveEmployeesSection = () => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-lg">Active Employees</CardTitle>
          </div>
          <Badge variant="outline">{employees.filter(e => e.status === "ACTIVE").length} Active</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs">Employee</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">In Time</TableHead>
                <TableHead className="text-xs">Hours</TableHead>
                <TableHead className="text-xs text-right">Orders</TableHead>
                <TableHead className="text-xs text-right">Sales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => {
                const empSale = employeeSales.find(es => es.employeeId === emp.id);
                return (
                  <TableRow key={emp.id} className="text-sm">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700">
                            {emp.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">{emp.employeeCode}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={emp.status === "ACTIVE" ? "default" : "secondary"}
                        className={emp.status === "ACTIVE" ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
                      >
                        {emp.status === "ACTIVE" ? "🟢 Active" : emp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {emp.shiftStartTime || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {empSale?.hoursWorked ? `${empSale.hoursWorked}h` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {empSale?.orders || 0}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">
                      {formatINR(empSale?.revenue || 0)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  // 3. TODAY'S ITEM SALES
  const ItemSalesSection = () => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-lg">Today's Item Sales</CardTitle>
          </div>
          <Badge variant="outline">{todayStats.totalItemsSold} items sold</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[250px]">
          <div className="space-y-2">
            {itemSales.map((item, index) => (
              <div 
                key={item.itemName} 
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    index < 3 ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{item.itemName}</p>
                    <p className="text-xs text-muted-foreground">{item.quantity} sold</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm text-emerald-600">{formatINR(item.revenue)}</p>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                </div>
              </div>
            ))}
            {itemSales.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No sales yet today</p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  // 4. EMPLOYEE SALES TODAY
  const EmployeeSalesSection = () => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-lg">Sales by Employee</CardTitle>
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
          {currentTime.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-slate-700/50 rounded-lg">
            <p className="text-2xl font-bold text-emerald-400">{todayStats.totalOrders}</p>
            <p className="text-xs text-slate-400">Total Orders</p>
          </div>
          <div className="text-center p-3 bg-slate-700/50 rounded-lg">
            <p className="text-2xl font-bold text-emerald-400">{formatINR(todayStats.totalRevenue)}</p>
            <p className="text-xs text-slate-400">Total Revenue</p>
          </div>
          <div className="text-center p-3 bg-slate-700/50 rounded-lg">
            <p className="text-2xl font-bold text-amber-400">{todayStats.pendingPayments}</p>
            <p className="text-xs text-slate-400">Pending</p>
          </div>
          <div className="text-center p-3 bg-slate-700/50 rounded-lg">
            <p className="text-2xl font-bold text-emerald-400">{todayStats.totalItemsSold}</p>
            <p className="text-xs text-slate-400">Items Sold</p>
          </div>
        </div>

        {todayStats.topSellingItem && (
          <div className="border-t border-slate-700 pt-4">
            <p className="text-sm text-slate-400 mb-2">Top Selling Items</p>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                {todayStats.topSellingItem.name} ({todayStats.topSellingItem.quantity})
              </Badge>
              {itemSales.slice(1, 4).map((item, i) => (
                <Badge key={item.itemName} variant="outline" className="border-slate-600 text-slate-400">
                  {item.itemName} ({item.quantity})
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
      {/* Header with Date */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Today's Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            {currentTime.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {" "}• {currentTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDashboardData}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <KPICards />

      {/* Active Employees */}
      <ActiveEmployeesSection />

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
    <div className="space-y-6">
      {viewingCategory ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setViewingCategory(null)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Categories
              </Button>
              <div>
                <h2 className="text-xl font-bold">{viewingCategoryData?.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {viewingCategoryData?.items?.length || 0} items
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => {
                setEditingItem(null);
                setItemForm({
                  name: "", description: "", basePrice: 0, hasHalf: false,
                  halfPrice: 0, isActive: true, categoryId: viewingCategory, imageUrl: "",
                });
                setIsItemDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Full Price</TableHead>
                    <TableHead>Half Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewingCategoryData?.items?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No items in this category
                      </TableCell>
                    </TableRow>
                  )}
                  {viewingCategoryData?.items?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{formatINR(item.basePrice)}</TableCell>
                      <TableCell>{item.hasHalf ? formatINR(item.halfPrice) : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={item.isActive ? "default" : "secondary"}>
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
                                categoryId: item.categoryId || viewingCategory,
                                imageUrl: item.imageUrl || "",
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
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Menu Categories</h2>
              <p className="text-sm text-muted-foreground">Manage categories and their items</p>
            </div>
            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Category</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Category Name</Label>
                    <Input
                      placeholder="e.g., Cold Coffee, Momos"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Image URL</Label>
                    <Input
                      placeholder="https://example.com/image.jpg"
                      value={categoryForm.imageUrl || ""}
                      onChange={(e) => setCategoryForm({ ...categoryForm, imageUrl: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateCategory}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                className="pl-8"
                value={menuSearchQuery}
                onChange={(e) => setMenuSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Items Count</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        {menuSearchQuery ? "No categories found matching your search" : "No categories yet. Create your first category!"}
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredCategories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell>{category.items?.length || 0} items</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {category.items?.filter((i: any) => i.isActive).length || 0} live
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingCategory(category.id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Items
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500"
                            onClick={() => handleDeleteCategory(category.id)}
                            disabled={category.items?.length > 0}
                            title={category.items?.length > 0 ? "Delete all items first" : "Delete category"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  // EMPLOYEES SECTION
  const EmployeesSection = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Employees</h2>
          <p className="text-sm text-muted-foreground">Manage staff</p>
        </div>
        <Dialog open={isEmployeeDialogOpen} onOpenChange={setIsEmployeeDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Employee</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Input
                placeholder="Full Name"
                value={employeeForm.name}
                onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
              />
              <Input
                type="email"
                placeholder="Email"
                value={employeeForm.email}
                onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
              />
              <Input
                placeholder="Employee Code"
                value={employeeForm.employeeCode}
                onChange={(e) => setEmployeeForm({ ...employeeForm, employeeCode: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEmployeeDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateEmployee}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {employees
              .filter((e) => {
                const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  e.email.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesStatus = statusFilter === "all" || e.status === statusFilter;
                return matchesSearch && matchesStatus;
              })
              .map((emp) => (
                <div 
                  key={emp.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700">
                        {emp.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.employeeCode} • {emp.email}</p>
                    </div>
                  </div>
                  <Badge 
                    variant={emp.status === "ACTIVE" ? "default" : "secondary"}
                    className={emp.status === "ACTIVE" ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
                  >
                    {emp.status}
                  </Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ORDERS SECTION - Updated with table view and popup
  const OrdersSection = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Orders by Table</h2>
          <p className="text-sm text-muted-foreground">View all orders grouped by table</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="w-36"
            value={orderDateFilter}
            onChange={(e) => setOrderDateFilter(e.target.value)}
          />
          <Select value={orderTableFilter} onValueChange={setOrderTableFilter}>
            <SelectTrigger className="w-36">
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
          <Button size="sm" variant="outline" onClick={loadAllOrders}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Orders</p>
            <p className="text-xl font-bold text-blue-700">{allOrders.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-xl font-bold text-emerald-700">
              {formatINR(allOrders.filter(o => o.paymentStatus === "PAID").reduce((sum, o) => sum + o.totalAmount, 0))}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Tables Active</p>
            <p className="text-xl font-bold text-amber-700">{ordersByTable.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Pending Payment</p>
            <p className="text-xl font-bold text-purple-700">
              {allOrders.filter(o => o.paymentStatus !== "PAID").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Orders by Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ordersByTable.map((table) => (
          <Card key={table.tableId} className="overflow-hidden">
            <CardHeader className="pb-2 bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 rounded-md">
                    <Utensils className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Table {table.tableNumber}</CardTitle>
                    <p className="text-xs text-muted-foreground">{table.orders.length} orders</p>
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
                    <div
                      key={order.id}
                      className="p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedOrder(order);
                        setIsOrderDialogOpen(true);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">Order #{order.id}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={order.status === "ORDER_COMPLETE" ? "default" : "secondary"}
                            className="text-xs mb-1"
                          >
                            {order.status}
                          </Badge>
                          <p className="text-sm font-medium">{formatINR(order.totalAmount)}</p>
                        </div>
                      </div>
                    </div>
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
              <p className="text-muted-foreground">No orders found for the selected date</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Order Details Dialog */}
      <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order Details #{selectedOrder?.id}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Table</p>
                  <p className="font-medium">Table {selectedOrder.tableNumber || selectedOrder.tableId}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium">{new Date(selectedOrder.createdAt).toLocaleString()}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant={selectedOrder.status === "ORDER_COMPLETE" ? "default" : "secondary"}>
                  {selectedOrder.status}
                </Badge>
                <Badge variant={selectedOrder.paymentStatus === "PAID" ? "default" : "secondary"}
                  className={selectedOrder.paymentStatus === "PAID" ? "bg-green-100 text-green-700" : ""}>
                  {selectedOrder.paymentStatus}
                </Badge>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Item</TableHead>
                      <TableHead className="text-xs text-right">Qty</TableHead>
                      <TableHead className="text-xs text-right">Price</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{item.name}</TableCell>
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

              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-lg font-bold">Total Amount</p>
                <p className="text-xl font-bold text-emerald-600">{formatINR(selectedOrder.totalAmount)}</p>
              </div>

              {selectedOrder.status !== "ORDER_COMPLETE" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      handleUpdateOrderStatus(selectedOrder.id, "ORDER_COMPLETE");
                      setIsOrderDialogOpen(false);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Mark Complete
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  // WORK HOURS SECTION - Updated with filters and daily stats
  const WorkHoursSection = () => (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Employee Work Hours</h2>
          <p className="text-sm text-muted-foreground">Track attendance, hours and sales</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={hoursEmployeeFilter} onValueChange={setHoursEmployeeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.filter(e => e.status === "ACTIVE").map((emp) => (
                <SelectItem key={emp.id} value={String(emp.id)}>
                  {emp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 bg-slate-100 rounded-md p-1">
            <Input
              type="date"
              className="w-32 border-0 bg-transparent"
              placeholder="Start Date"
              value={hoursStartDate}
              onChange={(e) => setHoursStartDate(e.target.value)}
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="date"
              className="w-32 border-0 bg-transparent"
              placeholder="End Date"
              value={hoursEndDate}
              onChange={(e) => setHoursEndDate(e.target.value)}
            />
          </div>
          <Button size="sm" variant="outline" onClick={loadShiftHistory}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Shifts</p>
            <p className="text-xl font-bold text-blue-700">{hoursSummary.totalShifts}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Hours</p>
            <p className="text-xl font-bold text-emerald-700">{hoursSummary.totalHours.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Sales</p>
            <p className="text-xl font-bold text-purple-700">{formatINR(hoursSummary.totalSales)}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Avg Hours/Shift</p>
            <p className="text-xl font-bold text-amber-700">
              {hoursSummary.totalShifts > 0 ? (hoursSummary.totalHours / hoursSummary.totalShifts).toFixed(1) : 0}h
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
                      <TableCell>{new Date(stat.date).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell className="text-right">{stat.shifts}</TableCell>
                      <TableCell className="text-right">{stat.totalHours.toFixed(1)}h</TableCell>
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
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">In Time</TableHead>
                  <TableHead className="text-xs">Out Time</TableHead>
                  <TableHead className="text-xs text-right">Hours</TableHead>
                  <TableHead className="text-xs text-right">Orders</TableHead>
                  <TableHead className="text-xs text-right">Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.id} className="text-sm">
                    <TableCell className="font-medium">{shift.employee?.name}</TableCell>
                    <TableCell>{new Date(shift.shiftStart).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell>{new Date(shift.shiftStart).toLocaleTimeString()}</TableCell>
                    <TableCell>
                      {shift.shiftEnd ? new Date(shift.shiftEnd).toLocaleTimeString() : "Active"}
                    </TableCell>
                    <TableCell className="text-right">{(shift.totalHours || 0).toFixed(1)}h</TableCell>
                    <TableCell className="text-right">{shift.orders?.length || 0}</TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">
                      {formatINR(shift.totalSales || 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {shifts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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

  // SETTINGS SECTION - Updated with branch and notifications
  // Removed Items Section
  const RemovedItemsSection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Removed Items Report</h2>
          <p className="text-muted-foreground">Track items removed by employees from orders</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={removedItemsDateFilter}
            onChange={(e) => setRemovedItemsDateFilter(e.target.value)}
            className="w-40"
          />
          <Button variant="outline" onClick={loadRemovedItems}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Items Removed</p>
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
                  {formatINR(dailyRemovalSummaries.length > 0 ? totalLoss / dailyRemovalSummaries.length : 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Removed Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Removed Items Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Order #</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Loss</TableHead>
                  <TableHead>Removed By</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {removedItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No removed items found for the selected date
                    </TableCell>
                  </TableRow>
                )}
                {removedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{new Date(item.removedAt).toLocaleDateString()}</TableCell>
                    <TableCell>#{item.orderId}</TableCell>
                    <TableCell>{item.tableNumber || "N/A"}</TableCell>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{formatINR(item.itemPrice)}</TableCell>
                    <TableCell className="text-red-600 font-medium">
                      {formatINR(item.itemPrice * item.quantity)}
                    </TableCell>
                    <TableCell>{item.removedBy}</TableCell>
                    <TableCell className="max-w-[150px] truncate" title={item.reason}>
                      {item.reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
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
                    <TableCell>{new Date(summary.date).toLocaleDateString()}</TableCell>
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
  const SalarySlipsSection = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-lg">Salary Slips</CardTitle>
          </div>
          <Button onClick={() => setIsSalarySlipDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Salary Slip
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Month</TableCell>
              <TableCell>Year</TableCell>
              <TableCell>Basic Salary</TableCell>
              <TableCell>Net Salary</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salarySlips.map((slip) => (
              <TableRow key={slip.id}>
                <TableCell>{slip.employee?.name}</TableCell>
                <TableCell>{slip.month}</TableCell>
                <TableCell>{slip.year}</TableCell>
                <TableCell>{formatINR(slip.basicSalary)}</TableCell>
                <TableCell>{formatINR(slip.netSalary)}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  // 10. CERTIFICATES SECTION
  const CertificatesSection = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-lg">Employee Certificates</CardTitle>
          </div>
          <Button onClick={() => setIsCertificateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Certificate
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Certificate Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Issue Date</TableCell>
              <TableCell>Expiry Date</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certificates.map((cert) => (
              <TableRow key={cert.id}>
                <TableCell>{cert.employee?.name}</TableCell>
                <TableCell>{cert.name}</TableCell>
                <TableCell>{cert.type}</TableCell>
                <TableCell>{cert.issueDate}</TableCell>
                <TableCell>{cert.expiryDate || 'N/A'}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <DashboardShell
      role="ADMIN"
      sidebarItems={sidebarItems}
      activeKey={activeSection}
      onSelect={setActiveSection}
    >
      <div className="space-y-4 pb-6">
        {activeSection === "overview" && <OverviewSection />}
        {activeSection === "menu" && <MenuSection />}
        {activeSection === "employees" && <EmployeesSection />}
        {activeSection === "orders" && <OrdersSection />}
        {activeSection === "removed-items" && <RemovedItemsSection />}
        {activeSection === "hours" && <WorkHoursSection />}
        {activeSection === "salary-slips" && <SalarySlipsSection />}
        {activeSection === "certificates" && <CertificatesSection />}
        {activeSection === "settings" && <SettingsSection />}
      </div>
    </DashboardShell>
  );
};

export default AdminDashboard;
        </CardContent>
      </Card>
    </div>
  );

  // CERTIFICATES SECTION
  const CertificatesSection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Certificates</h2>
          <p className="text-sm text-muted-foreground">Manage certificates for active employees</p>
        </div>
        <Dialog open={isCertificateDialogOpen} onOpenChange={setIsCertificateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Issue Certificate
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Issue Certificate</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Employee</Label>
                <Select
                  value={String(certificateForm.employeeId)}
                  onValueChange={(v) => setCertificateForm({ ...certificateForm, employeeId: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Certificate Name</Label>
                <Input
                  placeholder="e.g., Employee of the Month"
                  value={certificateForm.name}
                  onChange={(e) => setCertificateForm({ ...certificateForm, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Certificate Type</Label>
                <Select
                  value={certificateForm.type}
                  onValueChange={(v) => setCertificateForm({ ...certificateForm, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appreciation">Appreciation</SelectItem>
                    <SelectItem value="achievement">Achievement</SelectItem>
                    <SelectItem value="experience">Experience</SelectItem>
                    <SelectItem value="training">Training Completion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Issue Date</Label>
                  <Input
                    type="date"
                    value={certificateForm.issueDate}
                    onChange={(e) => setCertificateForm({ ...certificateForm, issueDate: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Expiry Date (optional)</Label>
                  <Input
                    type="date"
                    value={certificateForm.expiryDate}
                    onChange={(e) => setCertificateForm({ ...certificateForm, expiryDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCertificateDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => {
                toast({ title: "Certificate issued", description: `For ${activeEmployees.find(e => e.id === certificateForm.employeeId)?.name}` });
                setIsCertificateDialogOpen(false);
              }}>Issue</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Certificate Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No certificates issued yet
                  </TableCell>
                </TableRow>
              )}
              {certificates.map((cert) => (
                <TableRow key={cert.id}>
                  <TableCell className="font-medium">{cert.employeeName}</TableCell>
                  <TableCell>{cert.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{cert.type}</Badge>
                  </TableCell>
                  <TableCell>{new Date(cert.issueDate).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <Award className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const SettingsSection = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Settings</h2>
          <p className="text-sm text-muted-foreground">Configure your restaurant branch</p>
        </div>
        <Button size="sm" variant="outline" onClick={loadSettings}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Branch Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base">Branch Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {branch && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="p-2 bg-emerald-100 rounded-md">
                  <Store className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium">{branch.name}</p>
                  <p className="text-xs text-muted-foreground">{branch.location || "No location set"}</p>
                  <p className="text-xs text-muted-foreground">
                    {branch._count?.employees || 0} employees • {branch._count?.tables || 0} tables
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label className="text-sm">Branch Name</Label>
                <Input
                  placeholder="e.g., Cafe Chapter 1 - Gautam Nagar"
                  value={branchForm.name}
                  onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm">Location</Label>
                <Input
                  placeholder="e.g., Gautam Nagar, New Delhi"
                  value={branchForm.location}
                  onChange={(e) => setBranchForm({ ...branchForm, location: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm">Timezone</Label>
                <Select
                  value={branchForm.timezone}
                  onValueChange={(v) => setBranchForm({ ...branchForm, timezone: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                    <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
                    <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                    <SelectItem value="America/New_York">America/New_York</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={handleUpdateBranch} className="w-full">
                Save Branch Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base">Branch Notifications</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px]">
              <div className="space-y-2">
                {notifications.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No notifications</p>
                )}
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className={`p-1.5 rounded-md ${
                      notif.type === "ORDER" ? "bg-blue-100 text-blue-600" :
                      notif.type === "PAYMENT" ? "bg-green-100 text-green-600" :
                      notif.type === "SHIFT" ? "bg-purple-100 text-purple-600" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {notif.type === "ORDER" ? <ShoppingCart className="h-4 w-4" /> :
                       notif.type === "PAYMENT" ? <CreditCard className="h-4 w-4" /> :
                       notif.type === "SHIFT" ? <Clock className="h-4 w-4" /> :
                       <Bell className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{notif.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(notif.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base">System Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-sm">Order Notifications</Label>
                  <p className="text-xs text-muted-foreground">Show alerts for new orders</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-sm">Sound Alerts</Label>
                  <p className="text-xs text-muted-foreground">Play sound on new orders</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-sm">Auto-refresh</Label>
                  <p className="text-xs text-muted-foreground">Auto refresh data every 10s</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
            <Button size="sm">Save System Settings</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // 9. SALARY SLIPS SECTION
  const SalarySlipsSection = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-lg">Salary Slips</CardTitle>
          </div>
          <Button onClick={() => setIsSalarySlipDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Salary Slip
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Month</TableCell>
              <TableCell>Year</TableCell>
              <TableCell>Basic Salary</TableCell>
              <TableCell>Net Salary</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salarySlips.map((slip) => (
              <TableRow key={slip.id}>
                <TableCell>{slip.employee?.name}</TableCell>
                <TableCell>{slip.month}</TableCell>
                <TableCell>{slip.year}</TableCell>
                <TableCell>{formatINR(slip.basicSalary)}</TableCell>
                <TableCell>{formatINR(slip.netSalary)}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  // 10. CERTIFICATES SECTION
  const CertificatesSection = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-lg">Employee Certificates</CardTitle>
          </div>
          <Button onClick={() => setIsCertificateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Certificate
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Certificate Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Issue Date</TableCell>
              <TableCell>Expiry Date</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certificates.map((cert) => (
              <TableRow key={cert.id}>
                <TableCell>{cert.employee?.name}</TableCell>
                <TableCell>{cert.name}</TableCell>
                <TableCell>{cert.type}</TableCell>
                <TableCell>{cert.issueDate}</TableCell>
                <TableCell>{cert.expiryDate || 'N/A'}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <DashboardShell
      role="ADMIN"
      sidebarItems={sidebarItems}
      activeKey={activeSection}
      onSelect={setActiveSection}
    >
      <div className="space-y-4 pb-6">
        {activeSection === "overview" && <OverviewSection />}
        {activeSection === "menu" && <MenuSection />}
        {activeSection === "employees" && <EmployeesSection />}
        {activeSection === "orders" && <OrdersSection />}
        {activeSection === "removed-items" && <RemovedItemsSection />}
        {activeSection === "hours" && <WorkHoursSection />}
        {activeSection === "salary-slips" && <SalarySlipsSection />}
        {activeSection === "certificates" && <CertificatesSection />}
        {activeSection === "settings" && <SettingsSection />}
      </div>
    </DashboardShell>
  );
};

export default AdminDashboard;
