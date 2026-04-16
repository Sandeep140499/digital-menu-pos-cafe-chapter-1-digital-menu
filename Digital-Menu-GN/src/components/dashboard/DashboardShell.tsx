import { ReactNode, useState, useEffect, useRef, ComponentType } from 'react';
import {
  Bell,
  Menu,
  LogOut,
  LucideProps,
  ShoppingCart,
  CreditCard,
  User,
  AlertCircle,
  MessageCircle,
  X,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  UtensilsCrossed,
  Users,
  IndianRupee,
  Settings,
} from 'lucide-react';
import cafeLogo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';

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
  role: 'ADMIN' | 'EMPLOYEE';
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
  userName = 'Employee',
  branchName = 'Gautam Nagar',
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
  const unreadCount = notificationCount ?? notifications.filter(n => !n.read).length;
  const logoUrl = companyLogoUrl || cafeLogo;
  const { logout } = useAuth();

  // On desktop (sm+): sidebar open by default. On small devices: closed. Only sync when breakpoint actually changes (resize).
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const handler = () => {
      const nowDesktop = mq.matches;
      if (lastBreakpoint.current !== nowDesktop) {
        lastBreakpoint.current = nowDesktop;
        setSidebarOpen(nowDesktop);
      }
    };
    lastBreakpoint.current = mq.matches;
    queueMicrotask(() => setSidebarOpen(mq.matches));
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleNavSelect = (key: string) => {
    onSelect(key);
    if (window.innerWidth < 640) setSidebarOpen(false);
  };

  const toggleSidebar = () => setSidebarOpen(v => !v);

  const handleLogout = () => {
    void logout().finally(() => {
      window.location.href = '/login';
    });
  };

  return (
    <div className="flex h-screen min-h-screen flex-col bg-slate-50">
      {/* Header: high z-index so menu button is always visible and on top on small devices */}
      <header className="relative z-[100] flex shrink-0 items-center justify-between gap-2 bg-gradient-to-r from-emerald-800 via-emerald-900 to-slate-900 py-2.5 pr-4 pl-3 text-white shadow [--header-height:3.25rem] sm:px-6 sm:py-3 sm:[--header-height:3.5rem]">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] flex-none cursor-pointer touch-manipulation items-center justify-center rounded-lg border-2 border-white/50 bg-white/20 p-2.5 hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white active:bg-white/40 md:min-h-[48px] md:min-w-[48px]"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X className="h-5 w-5 md:h-6 md:w-6" /> : <Menu className="h-5 w-5 md:h-6 md:w-6" />}
          </button>
          <img
            src={typeof logoUrl === 'string' ? logoUrl : cafeLogo}
            alt=""
            className="h-9 w-9 shrink-0 rounded bg-white object-contain p-0.5 sm:h-11 sm:w-11"
            aria-hidden
          />
          <div className="flex min-w-0 flex-col overflow-hidden">
            <span
              className="truncate text-sm font-semibold tracking-wide sm:text-base"
              title={`Cafe Chapter 1 • ${branchName}`}
            >
              <span className="sm:hidden">Cafe Chapter 1</span>
              <span className="hidden sm:inline">Cafe Chapter 1 • {branchName}</span>
            </span>
            <span
              className="truncate text-[11px] text-emerald-100/80 sm:text-xs"
              title={role === 'ADMIN' ? 'Admin Panel' : userName}
            >
              {role === 'ADMIN' ? 'Admin Panel' : `Welcome, ${userName}`}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <DropdownMenu onOpenChange={open => onNotificationsOpenChange?.(open)}>
            <DropdownMenuTrigger asChild>
              <button
                className="relative inline-flex min-h-[40px] min-w-[40px] touch-manipulation items-center justify-center rounded-full bg-white/10 p-2 hover:bg-white/20 sm:min-h-0 sm:min-w-0"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[105] w-80 sm:w-96">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <span className="text-sm font-semibold text-slate-900">Notifications</span>
                {notifications.length > 0 && onClearAllNotifications && (
                  <button
                    type="button"
                    onClick={() => onClearAllNotifications()}
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <ScrollArea className="h-[280px]">
                {notifications.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center text-sm">
                    No notifications yet
                  </div>
                ) : (
                  <div className="space-y-2 p-2">
                    {notifications.slice(0, 20).map(n => {
                      const Icon =
                        n.type === 'ORDER'
                          ? ShoppingCart
                          : n.type === 'PAYMENT'
                            ? CreditCard
                            : n.type === 'SYSTEM'
                              ? AlertCircle
                              : n.type === 'QUERY'
                                ? MessageCircle
                                : User;
                      const typeLabel =
                        n.type === 'ORDER'
                          ? 'Order'
                          : n.type === 'PAYMENT'
                            ? 'Payment'
                            : n.type === 'SYSTEM'
                              ? 'System'
                              : n.type === 'QUERY'
                                ? 'Query'
                                : 'Notification';
                      return (
                        <div
                          key={n.id}
                          className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-sm hover:bg-slate-100/80"
                        >
                          <div className="flex gap-3">
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                                {typeLabel}
                              </p>
                              <p className="font-medium break-words text-slate-900">{n.message}</p>
                              {n.createdAt && (
                                <p className="text-muted-foreground mt-1 text-xs">
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
          <div className="hidden flex-col items-end text-xs md:flex">
            <span className="font-medium">{userName}</span>
            <span className="text-emerald-100/80">
              {role === 'ADMIN' ? 'Administrator' : 'Employee'}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[40px] min-w-[44px] touch-manipulation border-white/50 bg-white/10 text-xs text-white hover:bg-white/20 sm:min-h-0 sm:min-w-0"
            onClick={handleLogout}
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4 shrink-0 sm:mr-1 sm:h-3 sm:w-3" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Sidebar: on small screens slides in from left; close on nav click (handleNavSelect) or overlay click */}
        <aside
          className={`fixed left-0 z-[55] sm:relative sm:z-auto ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'
          } top-0 bottom-0 flex w-64 shrink-0 transform flex-col border-r border-slate-800 bg-slate-900 pt-[var(--header-height)] text-slate-50 shadow-xl transition-transform duration-200 ease-out sm:w-56 sm:pt-0 sm:shadow-none ${
            !sidebarOpen ? 'pointer-events-none sm:pointer-events-auto' : ''
          }`}
        >
          {/* On mobile: show user + logout in sidebar so header options aren't hidden */}
          <div className="border-b border-slate-800 px-3 pt-4 pb-3 sm:hidden">
            <p className="truncate font-medium text-white" title={userName}>
              {userName}
            </p>
            <p className="text-xs text-slate-400">
              {role === 'ADMIN' ? 'Administrator' : 'Employee'}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 min-h-[44px] w-full justify-center border-slate-500 bg-slate-700 font-medium text-white hover:bg-slate-600 hover:text-white"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
          <nav className="flex-1 overflow-y-auto py-4">
            {sidebarSections && sidebarSections.length > 0 ? (
              <ul className="space-y-0 px-3 text-sm">
                {sidebarSections.map(section => {
                  const SectionIcon = section.icon ?? SECTION_ICONS[section.title];
                  const isOpen = sectionsOpen[section.title] !== false;
                  const toggleSection = () =>
                    setSectionsOpen(prev => ({
                      ...prev,
                      [section.title]: !prev[section.title],
                    }));
                  return (
                    <li key={section.title} className="mb-2">
                      <button
                        type="button"
                        onClick={toggleSection}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[11px] font-semibold tracking-wider text-slate-400 uppercase hover:bg-slate-800/50 hover:text-slate-200"
                      >
                        {SectionIcon && <SectionIcon className="h-3.5 w-3.5 shrink-0" />}
                        <span className="flex-1 truncate">{section.title}</span>
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        )}
                      </button>
                      {isOpen && (
                        <ul className="mt-0.5 ml-2 space-y-0.5 border-l border-slate-700/50 pl-2">
                          {section.items.map(item => {
                            const Icon = item.icon;
                            const badge = sidebarBadges[item.key];
                            const showBadge = typeof badge === 'number' && badge > 0;
                            return (
                              <li key={item.key}>
                                <button
                                  type="button"
                                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                                    activeKey === item.key
                                      ? 'bg-emerald-600 text-white'
                                      : 'text-slate-200 hover:bg-slate-800'
                                  }`}
                                  onClick={() => handleNavSelect(item.key)}
                                >
                                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                                  <span className="flex-1 truncate">{item.label}</span>
                                  {showBadge && (
                                    <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                      {badge > 99 ? '99+' : badge}
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
                {sidebarItems.map(item => {
                  const Icon = item.icon;
                  const badge = sidebarBadges[item.key];
                  const showBadge = typeof badge === 'number' && badge > 0;
                  return (
                    <li key={item.key}>
                      <button
                        className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                          activeKey === item.key
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-200 hover:bg-slate-800'
                        }`}
                        onClick={() => handleNavSelect(item.key)}
                      >
                        {Icon && <Icon className="h-4 w-4 shrink-0" />}
                        <span className="flex-1 truncate">{item.label}</span>
                        {showBadge && (
                          <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
          <footer className="border-t border-slate-800 px-3 py-3 text-[11px] text-slate-400">
            <div>© 2026 Cafe Chapter 1 POS</div>
            <div>Version 1.0.0</div>
          </footer>
        </aside>

        {/* Main content - responsive, scrollable on all devices */}
        <main
          className="relative min-h-0 min-w-0 flex-1 overflow-auto overflow-x-hidden bg-slate-50 px-3 py-4 sm:px-4 md:px-6"
          style={{ overflowAnchor: 'auto' }}
          onPointerDownCapture={() => {
            // Mobile UX: if sidebar is open, close it *without* swallowing the click.
            // This prevents the "first tap does nothing" feeling on buttons.
            if (window.innerWidth < 640 && sidebarOpen) setSidebarOpen(false);
          }}
        >
          {/* Admin & Employee: logo watermark on all pages - same logo/colour from assets */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <img
              src={typeof logoUrl === 'string' ? logoUrl : cafeLogo}
              alt=""
              className="absolute top-1/2 left-1/2 h-auto max-h-[min(50vh,400px)] w-[min(60vw,400px)] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.08]"
            />
          </div>
          <div
            className="relative z-0 min-h-full [overflow-anchor:auto]"
            style={{ overflowAnchor: 'auto' }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardShell;
