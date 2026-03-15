import { ReactNode, useState, useEffect, useRef, ComponentType } from "react";
import { Bell, Menu, LogOut, LucideProps, ShoppingCart, CreditCard, User, AlertCircle, MessageCircle, X, ChevronDown, ChevronRight, LayoutDashboard, UtensilsCrossed, Users, IndianRupee, Settings } from "lucide-react";
import cafeLogo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

export type SidebarItem = {
  key: string;
  label: string;
  icon?: ComponentType<LucideProps>;
};

export type SidebarSection = {
  title: string;
  icon?: ComponentType<LucideProps>;
  items: SidebarItem[];
};

export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  createdAt?: string;
  read?: boolean;
};

type DashboardShellProps = {
  role: "ADMIN" | "EMPLOYEE";
  userName?: string;
  branchName?: string;
  /** Flat list (used by Employee dashboard) */
  sidebarItems?: SidebarItem[];
  /** Grouped sections (used by Admin POS sidebar). When provided, used instead of sidebarItems. */
  sidebarSections?: SidebarSection[];
  activeKey: string;
  onSelect: (key: string) => void;
  children: ReactNode;
  notifications?: NotificationItem[];
  notificationCount?: number;
  /** Optional badge counts per sidebar item key (e.g. { live: 3 } for Live Orders) */
  sidebarBadges?: Record<string, number>;
  /** Optional company logo URL for header/watermark (falls back to default logo) */
  companyLogoUrl?: string | null;
  /** Called when the notifications dropdown is opened; use to mark notifications as read */
  onNotificationsOpenChange?: (open: boolean) => void;
  /** Called when user clicks Clear all in notifications */
  onClearAllNotifications?: () => void;
};

const SECTION_ICONS: Record<string, ComponentType<LucideProps>> = {
  Dashboard: LayoutDashboard,
  Operations: UtensilsCrossed,
  Staff: Users,
  Finance: IndianRupee,
  System: Settings,
};

const DashboardShell = ({
  role,
  userName = "Employee",
  branchName = "Gautam Nagar",
  sidebarItems = [],
  sidebarSections,
  activeKey,
  onSelect,
  children,
  notifications = [],
  notificationCount,
  sidebarBadges = {},
  companyLogoUrl,
  onNotificationsOpenChange,
  onClearAllNotifications,
}: DashboardShellProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({});
  const lastBreakpoint = useRef(false);
  const unreadCount = notificationCount ?? notifications.filter((n) => !n.read).length;
  const logoUrl = companyLogoUrl || cafeLogo;

  // On desktop (sm+): sidebar open by default. On small devices: closed. Only sync when breakpoint actually changes (resize).
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const handler = () => {
      const nowDesktop = mq.matches;
      if (lastBreakpoint.current !== nowDesktop) {
        lastBreakpoint.current = nowDesktop;
        setSidebarOpen(nowDesktop);
      }
    };
    lastBreakpoint.current = mq.matches;
    setSidebarOpen(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleNavSelect = (key: string) => {
    onSelect(key);
    if (window.innerWidth < 640) setSidebarOpen(false);
  };

  const toggleSidebar = () => setSidebarOpen((v) => !v);

  const handleLogout = () => {
    window.sessionStorage.removeItem("dm_auth_token");
    window.sessionStorage.removeItem("dm_auth_role");
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen h-screen flex flex-col bg-slate-50">
      {/* Header: high z-index so menu button is always visible and on top on small devices */}
      <header className="relative z-[100] flex shrink-0 items-center justify-between gap-2 pl-3 pr-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-emerald-800 via-emerald-900 to-slate-900 text-white shadow [--header-height:3.25rem] sm:[--header-height:3.5rem]">
        <div className="flex items-center gap-2 min-w-0 sm:gap-3 flex-1">
          <button
            type="button"
            className="flex-none inline-flex items-center justify-center rounded-lg border-2 border-white/50 bg-white/20 min-h-[44px] min-w-[44px] p-2.5 hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white touch-manipulation cursor-pointer"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <img src={typeof logoUrl === "string" ? logoUrl : cafeLogo} alt="" className="h-9 w-9 sm:h-11 sm:w-11 object-contain rounded bg-white p-0.5 shrink-0" aria-hidden />
          <div className="flex flex-col min-w-0 overflow-hidden">
            <span className="font-semibold tracking-wide text-sm sm:text-base truncate" title={`Cafe Chapter 1 • ${branchName}`}>
              <span className="sm:hidden">Cafe Chapter 1</span>
              <span className="hidden sm:inline">Cafe Chapter 1 • {branchName}</span>
            </span>
            <span className="text-[11px] sm:text-xs text-emerald-100/80 truncate" title={role === "ADMIN" ? "Admin Panel" : userName}>
              {role === "ADMIN" ? "Admin Panel" : `Welcome, ${userName}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <DropdownMenu onOpenChange={(open) => onNotificationsOpenChange?.(open)}>
            <DropdownMenuTrigger asChild>
              <button
                className="relative inline-flex items-center justify-center rounded-full bg-white/10 p-2 hover:bg-white/20 min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 touch-manipulation"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 sm:w-96 z-[105]">
              <div className="px-3 py-2 border-b flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-900">Notifications</span>
                {notifications.length > 0 && onClearAllNotifications && (
                  <button
                    type="button"
                    onClick={() => onClearAllNotifications()}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <ScrollArea className="h-[280px]">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No notifications yet</div>
                ) : (
                  <div className="p-2 space-y-2">
                    {notifications.slice(0, 20).map((n) => {
                      const Icon = n.type === "ORDER" ? ShoppingCart : n.type === "PAYMENT" ? CreditCard : n.type === "SYSTEM" ? AlertCircle : n.type === "QUERY" ? MessageCircle : User;
                      const typeLabel = n.type === "ORDER" ? "Order" : n.type === "PAYMENT" ? "Payment" : n.type === "SYSTEM" ? "System" : n.type === "QUERY" ? "Query" : "Notification";
                      return (
                        <div
                          key={n.id}
                          className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-sm hover:bg-slate-100/80"
                        >
                          <div className="flex gap-3">
                            <Icon className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{typeLabel}</p>
                              <p className="font-medium text-slate-900 break-words">{n.message}</p>
                              {n.createdAt && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(n.createdAt).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="hidden md:flex flex-col items-end text-xs">
            <span className="font-medium">{userName}</span>
            <span className="text-emerald-100/80">
              {role === "ADMIN" ? "Administrator" : "Employee"}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-white/50 text-white bg-white/10 hover:bg-white/20 text-xs min-h-[40px] min-w-[44px] sm:min-h-0 sm:min-w-0 touch-manipulation"
            onClick={handleLogout}
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4 sm:w-3 sm:h-3 sm:mr-1 shrink-0" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay: tap outside to close sidebar (below header, below sidebar) */}
        {sidebarOpen && (
          <div
            className="fixed left-0 right-0 bottom-0 z-[50] sm:hidden bg-black/50"
            style={{ top: "var(--header-height)" }}
            aria-hidden
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* Sidebar: on small screens slides in from left; close on nav click (handleNavSelect) or overlay click */}
        <aside
          className={`fixed sm:relative left-0 z-[55] sm:z-auto ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
          } transform transition-transform duration-200 ease-out w-64 sm:w-56 shrink-0 bg-slate-900 text-slate-50 border-r border-slate-800 flex flex-col shadow-xl sm:shadow-none top-0 bottom-0 pt-[var(--header-height)] sm:pt-0 ${
            !sidebarOpen ? "pointer-events-none sm:pointer-events-auto" : ""
          }`}
        >
          {/* On mobile: show user + logout in sidebar so header options aren't hidden */}
          <div className="sm:hidden px-3 pt-4 pb-3 border-b border-slate-800">
            <p className="font-medium text-white truncate" title={userName}>{userName}</p>
            <p className="text-xs text-slate-400">{role === "ADMIN" ? "Administrator" : "Employee"}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full justify-center bg-slate-700 border-slate-500 text-white hover:bg-slate-600 hover:text-white font-medium min-h-[44px]"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
          <nav className="flex-1 overflow-y-auto py-4">
            {sidebarSections && sidebarSections.length > 0 ? (
              <ul className="space-y-0 px-3 text-sm">
                {sidebarSections.map((section) => {
                  const SectionIcon = section.icon ?? SECTION_ICONS[section.title];
                  const isOpen = sectionsOpen[section.title] !== false;
                  const toggleSection = () => setSectionsOpen((prev) => ({ ...prev, [section.title]: !prev[section.title] }));
                  return (
                    <li key={section.title} className="mb-2">
                      <button
                        type="button"
                        onClick={toggleSection}
                        className="w-full text-left px-2 py-2 rounded-md flex items-center gap-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 text-[11px] font-semibold uppercase tracking-wider"
                      >
                        {SectionIcon && <SectionIcon className="w-3.5 h-3.5 shrink-0" />}
                        <span className="flex-1 truncate">{section.title}</span>
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                      {isOpen && (
                        <ul className="space-y-0.5 mt-0.5 border-l border-slate-700/50 ml-2 pl-2">
                          {section.items.map((item) => {
                            const Icon = item.icon;
                            const badge = sidebarBadges[item.key];
                            const showBadge = typeof badge === "number" && badge > 0;
                            return (
                              <li key={item.key}>
                                <button
                                  type="button"
                                  className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-3 ${
                                    activeKey === item.key ? "bg-emerald-600 text-white" : "text-slate-200 hover:bg-slate-800"
                                  }`}
                                  onClick={() => handleNavSelect(item.key)}
                                >
                                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                                  <span className="flex-1 truncate">{item.label}</span>
                                  {showBadge && (
                                    <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shrink-0">
                                      {badge > 99 ? "99+" : badge}
                                    </span>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="space-y-1 px-3 text-sm">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  const badge = sidebarBadges[item.key];
                  const showBadge = typeof badge === "number" && badge > 0;
                  return (
                    <li key={item.key}>
                      <button
                        className={`w-full text-left px-3 py-2.5 rounded-md transition-colors flex items-center gap-3 ${
                          activeKey === item.key ? "bg-emerald-600 text-white" : "text-slate-200 hover:bg-slate-800"
                        }`}
                        onClick={() => handleNavSelect(item.key)}
                      >
                        {Icon && <Icon className="h-4 w-4 shrink-0" />}
                        <span className="flex-1 truncate">{item.label}</span>
                        {showBadge && (
                          <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shrink-0">
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
          <footer className="px-3 py-3 text-[11px] text-slate-400 border-t border-slate-800">
            <div>© 2026 Cafe Chapter 1 POS</div>
            <div>Version 1.0.0</div>
          </footer>
        </aside>

        {/* Main content - responsive, scrollable on all devices */}
        <main className="flex-1 min-h-0 min-w-0 overflow-auto overflow-x-hidden px-3 sm:px-4 md:px-6 py-4 bg-slate-50 relative" style={{ overflowAnchor: "auto" }}>
          {/* Admin & Employee: logo watermark on all pages - same logo/colour from assets */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
            <img
              src={typeof logoUrl === "string" ? logoUrl : cafeLogo}
              alt=""
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(60vw,400px)] h-auto max-h-[min(50vh,400px)] object-contain opacity-[0.08]"
            />
          </div>
          <div className="relative z-0 min-h-full [overflow-anchor:auto]" style={{ overflowAnchor: "auto" }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardShell;

