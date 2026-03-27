import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Phone,
  QrCode,
  Utensils,
  X,
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  MessageCircle,
  AlertCircle,
  HelpCircle,
  Loader2,
  Clock,
  CheckCircle2,
  FileDown,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AnimatePresence, motion } from 'framer-motion';
import QRCodeGenerator from '@/components/QRCodeGenerator';
import LocationMap from '@/components/LocationMap';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL, API_TIMEOUT_MS, fetchWithTimeout, readApiErrorMessage } from '@/constants';
import { useOrderStatusStream } from '@/hooks/useOrderStatusStream';
import cafeLogo from '@/assets/logo.png';

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  variant?: 'HALF' | 'FULL';
  category?: string;
};

const PC_VARIANT_MARKER_RE = /\(\s*5pc\s*\/\s*8pc\s*\)/i;
const HALF_FULL_VARIANT_MARKER_RE = /\(\s*half\s*\/\s*full\s*\)/i;

function getBaseItemName(name: string): string {
  return (
    (name || '')
      .replace(PC_VARIANT_MARKER_RE, '')
      .replace(HALF_FULL_VARIANT_MARKER_RE, '')
      .replace(/\s+/g, ' ')
      .trim() || name
  );
}

function isPcVariantItem(params: { name: string; category?: string }): boolean {
  const name = params.name || '';
  const cat = (params.category || '').toLowerCase();
  if (PC_VARIANT_MARKER_RE.test(name)) return true;
  if (cat.includes('momos')) return true;
  return false;
}

function getDisplayVariant(params: {
  name: string;
  variant?: 'HALF' | 'FULL';
  category?: string;
}): string {
  if (!params.variant) return '';
  const pc = isPcVariantItem({ name: params.name, category: params.category });
  if (pc) return params.variant === 'HALF' ? '5pc' : '8pc';
  return params.variant === 'HALF' ? 'Half' : 'Full';
}

function OrderCartDialog({
  open,
  onOpenChange,
  cart,
  cartTotal,
  incrementCartItem,
  decrementCartItem,
  removeCartItem,
  onCheckout,
  isSubmittingOrder,
  /** Which checkout path is in flight (fixes spinner on correct button). */
  pendingCheckoutType,
  lastCustomerName,
  lastCustomerMobile,
  showTotalAmount,
  checkoutEnabled,
  checkoutDisabledReason,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cart: CartItem[];
  cartTotal: number;
  incrementCartItem: (id: string) => void;
  decrementCartItem: (id: string) => void;
  removeCartItem: (id: string) => void;
  onCheckout: (formData: {
    customerName: string;
    customerMobile: string;
    tableNumber: string;
    orderType: 'DINE_IN' | 'TAKE_AWAY';
  }) => Promise<void>; // customerMobile optional – for WhatsApp invoice
  isSubmittingOrder: boolean;
  pendingCheckoutType: 'DINE_IN' | 'TAKE_AWAY' | null;
  lastCustomerName: string;
  lastCustomerMobile: string;
  showTotalAmount: boolean;
  checkoutEnabled: boolean;
  checkoutDisabledReason: string;
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKE_AWAY'>('DINE_IN');

  useEffect(() => {
    if (open) {
      setCustomerName(lastCustomerName || '');
      setCustomerMobile(lastCustomerMobile || '');
      setOrderType('DINE_IN');
    }
  }, [open, lastCustomerName, lastCustomerMobile]);

  const descriptionId = 'order-dialog-description';

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key="order-cart-dialog">
      <DialogContent
        className="flex max-h-[80dvh] flex-col overflow-hidden sm:max-w-lg"
        aria-describedby={descriptionId}
      >
        <DialogHeader>
          <DialogTitle>Your Order</DialogTitle>
          <DialogDescription id={descriptionId}>
            Review your items, fill in your details, then tap Dine In or Take Away to place your
            order.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {cart.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Your order is empty. Tap any item to add it.
            </p>
          ) : (
            cart.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {getBaseItemName(item.name)}{' '}
                    {item.variant && (
                      <span className="text-xs text-emerald-700">({getDisplayVariant(item)})</span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">₹{item.price.toFixed(0)} each</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 min-h-[44px] w-10 min-w-[44px] shrink-0 touch-manipulation"
                    onClick={() => decrementCartItem(item.id)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 min-h-[44px] w-10 min-w-[44px] shrink-0 touch-manipulation"
                    onClick={() => incrementCartItem(item.id)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 min-h-[44px] w-10 min-w-[44px] shrink-0 touch-manipulation text-red-500 hover:text-red-600"
                    onClick={() => removeCartItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="mt-2 space-y-2 border-t pt-3">
          <div className="flex flex-col gap-2 text-xs sm:text-sm">
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-olive-900">
                Your name <span className="text-red-500">*</span>
              </span>
              <input
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="e.g. Rahul Kumar"
                className="w-full rounded-md border px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-olive-900">
                Mobile number <span className="text-muted-foreground font-normal">(optional)</span>
              </span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={customerMobile}
                onChange={e => setCustomerMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                className="w-full rounded-md border px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
              <span className="text-muted-foreground text-[10px]">Mobile number is optional</span>
            </label>
            {/* Table number — only shown for Dine In */}
            {orderType === 'DINE_IN' && (
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-olive-900">
                  Table number <span className="text-red-500">*</span>
                </span>
                <input
                  value={tableNumber}
                  inputMode="numeric"
                  maxLength={1}
                  autoComplete="off"
                  onChange={e => setTableNumber(e.target.value.replace(/\D/g, '').slice(0, 1))}
                  placeholder="One digit only (0–9)"
                  className="w-full rounded-md border px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
                <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900/80">
                  Use one digit only (0–9), matching the number on your table. If your table shows
                  two digits, ask staff which single digit to use.
                </span>
              </label>
            )}
          </div>

          {showTotalAmount && (
            <div className="flex items-center justify-between pt-1 text-sm">
              <span className="font-semibold">Total</span>
              <span className="font-bold">₹{cartTotal.toFixed(0)}</span>
            </div>
          )}

          {!checkoutEnabled && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {checkoutDisabledReason || 'Online ordering is not available right now.'}
            </p>
          )}

          {/* DINE IN / TAKE AWAY — these ARE the order placement buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              disabled={
                !checkoutEnabled ||
                !cart.length ||
                isSubmittingOrder ||
                !customerName.trim() ||
                !/^\d$/.test(tableNumber.trim())
              }
              className="min-h-[48px] bg-emerald-700 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
              onClick={() => {
                setOrderType('DINE_IN');
                void onCheckout({
                  customerName,
                  customerMobile,
                  tableNumber,
                  orderType: 'DINE_IN',
                });
              }}
            >
              {isSubmittingOrder && pendingCheckoutType === 'DINE_IN' ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <span className="text-xs font-semibold">Sending…</span>
                </span>
              ) : (
                'DINE IN'
              )}
            </Button>
            <Button
              type="button"
              disabled={
                !checkoutEnabled || !cart.length || isSubmittingOrder || !customerName.trim()
              }
              className="min-h-[48px] border-2 border-emerald-700 bg-white text-sm font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
              onClick={() => {
                setTableNumber('');
                setOrderType('TAKE_AWAY');
                void onCheckout({
                  customerName,
                  customerMobile,
                  tableNumber: '',
                  orderType: 'TAKE_AWAY',
                });
              }}
            >
              {isSubmittingOrder && pendingCheckoutType === 'TAKE_AWAY' ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <span className="text-xs font-semibold">Sending…</span>
                </span>
              ) : (
                'TAKE AWAY'
              )}
            </Button>
          </div>

          <p className="text-muted-foreground text-center text-[10px]">
            Show this screen to staff if there is any issue with order confirmation.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const DEFAULT_CATEGORY_IMAGE =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop';

/** Lazy-render children when scrolled into view (with rootMargin). Keeps placeholder until in view for fast initial load on mobile. */
function LazyInView({
  children,
  placeholder,
  rootMargin = '400px',
}: {
  children: React.ReactNode;
  placeholder: React.ReactNode;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(prev => (entry.isIntersecting ? true : prev)),
      { rootMargin, threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);
  return (
    <div ref={ref} className="aspect-[4/5] min-h-[120px] w-full min-w-0">
      {inView ? children : placeholder}
    </div>
  );
}

const MenuCategoriesSection = memo(function MenuCategoriesSection({
  menuCategories,
  categoryQuery,
  setCategoryQuery,
  openCategoryKeys,
  setOpenCategoryKeys,
  bestSellerItemIds,
  addToCart,
  isLoadingMenu,
  menuLoadError,
  fetchMenu,
  lastToggledKeyRef,
}: {
  menuCategories: any[];
  categoryQuery: string;
  setCategoryQuery: (v: string) => void;
  openCategoryKeys: string[];
  setOpenCategoryKeys: React.Dispatch<React.SetStateAction<string[]>>;
  bestSellerItemIds: number[];
  addToCart: (
    itemName: string,
    price: number,
    variant?: 'HALF' | 'FULL',
    category?: string
  ) => void;
  isLoadingMenu: boolean;
  menuLoadError: string | null;
  fetchMenu: (opts?: { silent?: boolean }) => void;
  lastToggledKeyRef: React.MutableRefObject<string | null>;
}) {
  const displayCategories = useMemo(() => {
    return menuCategories.map(cat => ({
      key: String(cat.id),
      title: cat.name || 'Category',
      image: cat.imageUrl && cat.imageUrl.trim() ? cat.imageUrl : DEFAULT_CATEGORY_IMAGE,
      items: Array.isArray(cat.items)
        ? cat.items.map((item: any) => ({
            name: item.name,
            price:
              item.hasHalf && item.halfPrice
                ? `₹${item.halfPrice} / ₹${item.basePrice}`
                : `₹${item.basePrice}`,
            basePrice: item.basePrice,
            halfPrice: item.halfPrice,
            hasHalf: item.hasHalf,
            menuItemId: item.id,
          }))
        : [],
    }));
  }, [menuCategories]);

  const filteredCategories = useMemo(() => {
    const filtered = displayCategories.filter(
      cat =>
        cat.title.toLowerCase().includes(categoryQuery.toLowerCase()) ||
        cat.items.some((item: any) => item.name.toLowerCase().includes(categoryQuery.toLowerCase()))
    );
    const hasBestSeller = (s: (typeof filtered)[0]) =>
      s.items.some((item: any) => bestSellerItemIds.includes(item.menuItemId));
    return [...filtered].sort((a, b) => (hasBestSeller(b) ? 1 : 0) - (hasBestSeller(a) ? 1 : 0));
  }, [displayCategories, categoryQuery, bestSellerItemIds]);

  const openKeySet = useMemo(() => new Set(openCategoryKeys), [openCategoryKeys]);

  return (
    <>
      <div className="grid w-full max-w-full min-w-0 grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6 xl:grid-cols-5">
        {isLoadingMenu && menuCategories.length === 0 && (
          <>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                className="animate-pulse overflow-hidden rounded-xl border border-olive-200/60 bg-olive-50/50"
              >
                <div className="h-28 bg-olive-200/50 sm:h-32" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-3/4 rounded bg-olive-200/50" />
                  <div className="h-3 w-1/2 rounded bg-olive-200/40" />
                </div>
              </div>
            ))}
          </>
        )}
        {!isLoadingMenu && menuLoadError && menuCategories.length === 0 && (
          <div className="text-muted-foreground col-span-full py-16 text-center">
            <AlertCircle className="mx-auto mb-4 h-16 w-16 text-amber-500 opacity-60" />
            <p className="text-lg font-medium">Could not load menu</p>
            <p className="mt-1 text-sm">{menuLoadError}</p>
            <Button
              className="mt-4"
              variant="outline"
              size="sm"
              onClick={() => fetchMenu({ silent: false })}
            >
              Retry
            </Button>
          </div>
        )}
        {!isLoadingMenu && menuLoadError && menuCategories.length > 0 && (
          <div className="col-span-full flex justify-center py-1">
            <button
              type="button"
              onClick={() => fetchMenu({ silent: false })}
              className="text-xs text-olive-800/70 underline underline-offset-2"
            >
              Refresh menu
            </button>
          </div>
        )}
        {!isLoadingMenu && !menuLoadError && menuCategories.length === 0 && (
          <div className="text-muted-foreground col-span-full py-16 text-center">
            <Utensils className="mx-auto mb-4 h-16 w-16 opacity-40" />
            <p className="text-lg font-medium">Menu is being prepared.</p>
            <p className="mt-1 text-sm">Please check back shortly or ask staff.</p>
          </div>
        )}
        {!isLoadingMenu && menuCategories.length > 0 && filteredCategories.length === 0 && (
          <div className="text-muted-foreground col-span-full py-8 text-center">
            No categories match your search.
          </div>
        )}
        {filteredCategories.map(section => {
          const categoryKey = section.key;
          const isOpen = openKeySet.has(categoryKey);
          const isBestSeller = section.items.some((it: any) =>
            bestSellerItemIds.includes(it.menuItemId)
          );
          return (
            <div key={categoryKey} className="contents">
              <LazyInView
                placeholder={
                  <div
                    className="aspect-[4/5] min-h-[120px] w-full min-w-0 animate-pulse rounded-2xl bg-olive-100/50 ring-1 ring-black/5"
                    aria-hidden
                  />
                }
                rootMargin="400px"
              >
                <MenuCategoryCard
                  categoryKey={categoryKey}
                  section={section}
                  isSelected={isOpen}
                  isBestSeller={isBestSeller}
                  setOpenCategoryKeys={setOpenCategoryKeys}
                  lastToggledKeyRef={lastToggledKeyRef}
                />
              </LazyInView>
              <AnimatePresence>
                {isOpen && (
                  <div className="col-span-full">
                    <MenuCategoryItemsPanel
                      section={section}
                      categoryKey={categoryKey}
                      setOpenCategoryKeys={setOpenCategoryKeys}
                      addToCart={addToCart}
                    />
                  </div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </>
  );
});

function MenuCategoryCard({
  categoryKey,
  section,
  isSelected,
  isBestSeller,
  setOpenCategoryKeys,
  lastToggledKeyRef,
}: {
  categoryKey: string;
  section: { key: string; title: string; image: string; items: any[] };
  isSelected: boolean;
  isBestSeller: boolean;
  setOpenCategoryKeys: React.Dispatch<React.SetStateAction<string[]>>;
  lastToggledKeyRef: React.MutableRefObject<string | null>;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        lastToggledKeyRef.current = categoryKey;
        setOpenCategoryKeys(prev =>
          prev.includes(categoryKey) ? prev.filter(k => k !== categoryKey) : [...prev, categoryKey]
        );
      }}
      className={[
        'group relative aspect-[4/5] h-full min-h-[120px] w-full touch-manipulation overflow-hidden rounded-2xl text-left shadow-sm transition-all will-change-transform',
        'bg-white/90 hover:bg-white hover:shadow-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        isBestSeller
          ? 'shadow-lg ring-2 shadow-amber-200/50 ring-amber-400 focus-visible:ring-amber-500'
          : 'focus-visible:ring-emerald-700 focus-visible:ring-offset-emerald-50',
        isSelected
          ? isBestSeller
            ? '-translate-y-0.5 ring-2 ring-amber-500'
            : '-translate-y-0.5 ring-2 ring-emerald-600'
          : 'ring-1 ring-black/5 hover:-translate-y-0.5',
      ].join(' ')}
      aria-pressed={isSelected}
    >
      {isBestSeller && (
        <div className="absolute top-2 left-2 z-10 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold text-amber-950 shadow sm:text-[11px]">
          ★ Best Seller
        </div>
      )}
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <div className="relative min-h-0 flex-[4] bg-slate-200">
          <img
            src={section.image}
            alt={section.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={e => {
              const el = e.currentTarget;
              if (el.src !== DEFAULT_CATEGORY_IMAGE) el.src = DEFAULT_CATEGORY_IMAGE;
            }}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[20%] bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
          <div className="absolute top-2 right-2 flex justify-end">
            <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-0.5 text-[10px] font-semibold text-emerald-900 shadow-sm sm:text-[11px]">
              {section.items.length} items
            </span>
          </div>
        </div>
        <div
          className={`flex max-h-[52px] min-h-[52px] flex-shrink-0 items-center justify-start px-3 py-2 ${isBestSeller ? 'bg-gradient-to-r from-amber-600 to-amber-700' : 'bg-[#2E8B57]'}`}
        >
          <h2 className="line-clamp-2 min-w-0 flex-1 text-left text-sm leading-snug font-extrabold break-words whitespace-normal text-white sm:text-base">
            {section.title || categoryKey}
          </h2>
        </div>
      </div>
    </button>
  );
}

function MenuCategoryItemsPanel({
  section,
  categoryKey,
  setOpenCategoryKeys,
  addToCart,
}: {
  section: { key: string; title: string; image: string; items: any[] };
  categoryKey: string;
  setOpenCategoryKeys: React.Dispatch<React.SetStateAction<string[]>>;
  addToCart: (
    itemName: string,
    price: number,
    variant?: 'HALF' | 'FULL',
    category?: string
  ) => void;
}) {
  return (
    <motion.section
      id={`category-panel-${categoryKey}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="w-full max-w-full min-w-0 overflow-hidden rounded-2xl bg-white/95 shadow-sm ring-1 ring-black/5"
      aria-label={`${section.title} items`}
    >
      <div className="min-w-0 border-b border-black/5 bg-gradient-to-r from-olive-50 to-white px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0">
                <div className="truncate text-base font-bold text-olive-950 sm:text-lg">
                  {section.title || categoryKey}
                </div>
                <div className="text-xs text-olive-900/65">{section.items.length} items</div>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 bg-white hover:bg-olive-50"
            onClick={() => setOpenCategoryKeys(prev => prev.filter(k => k !== categoryKey))}
          >
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
        </div>
      </div>
      {/* QA: max-h-[80dvh] + overflow-y-auto so category list scrolls inside on iPhone; avoids viewport/scroll issues with Safari dynamic UI. */}
      <div className="max-h-[80dvh] w-full max-w-full min-w-0 overflow-x-hidden overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
        <ul className="w-full max-w-full min-w-0 divide-y divide-black/5 rounded-xl bg-white ring-1 ring-black/5">
          {section.items.map((item: any, idx: number) => {
            const isAddon = item.name.toLowerCase().startsWith('add-on');
            const priceText = String(item.price);
            const hasHalfFull = priceText.includes('/');
            const pcVariant = isPcVariantItem({
              name: item.name,
              category: section.title,
            });
            const halfBtnLabel = pcVariant ? '5pc' : 'Half';
            const fullBtnLabel = pcVariant ? '8pc' : 'Full';
            let fullPrice = 0;
            let halfPrice: number | undefined;
            if (hasHalfFull) {
              const [half, full] = priceText
                .replace(/₹/g, '')
                .split('/')
                .map((p: string) => Number(p.trim()));
              halfPrice = half;
              fullPrice = full;
            } else {
              fullPrice = Number(priceText.replace('₹', '').trim());
            }
            const priceDisplay = priceText.startsWith('₹') ? priceText : `₹${priceText}`;
            const priceBadgeClass = [
              'shrink-0 rounded-full px-3 py-1 text-sm font-extrabold',
              isAddon ? 'bg-amber-100 text-amber-900' : 'bg-olive-100 text-olive-900',
            ].join(' ');

            if (hasHalfFull && halfPrice != null) {
              return (
                <li
                  key={idx}
                  className={[
                    'flex w-full min-w-0 flex-wrap items-center gap-2 overflow-hidden px-4 py-3 transition sm:gap-4',
                    isAddon ? 'bg-amber-50/70' : 'hover:bg-olive-50/60',
                  ].join(' ')}
                >
                  <div className="flex min-w-0 flex-1 basis-full flex-col gap-1.5 sm:basis-0">
                    <div
                      className={[
                        'min-w-0 truncate text-sm font-semibold break-words sm:text-base',
                        isAddon ? 'text-amber-900' : 'text-emerald-900',
                      ].join(' ')}
                      title={item.name}
                    >
                      {item.name}
                    </div>
                    <span
                      className={[
                        'w-fit shrink-0 rounded-full px-3 py-1 text-sm font-extrabold',
                        isAddon ? 'bg-amber-100 text-amber-900' : 'bg-olive-100 text-olive-900',
                      ].join(' ')}
                    >
                      {priceDisplay}
                    </span>
                  </div>
                  {/* QA: Flexible width on small devices so buttons don't force overflow; fixed min only from sm up. */}
                  <div className="flex min-w-0 shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] min-w-0 flex-1 touch-manipulation border-emerald-600 px-3 text-emerald-700 hover:bg-emerald-50 sm:min-w-[72px] sm:flex-initial"
                      onClick={() => addToCart(item.name, halfPrice!, 'HALF', section.title)}
                    >
                      {halfBtnLabel}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] min-w-0 flex-1 touch-manipulation border-emerald-700 bg-emerald-600 px-3 text-white hover:bg-emerald-700 sm:min-w-[72px] sm:flex-initial"
                      onClick={() => addToCart(item.name, fullPrice, 'FULL', section.title)}
                    >
                      {fullBtnLabel}
                    </Button>
                  </div>
                </li>
              );
            }

            return (
              <li
                key={idx}
                className={[
                  'flex w-full min-w-0 items-center justify-between gap-2 overflow-hidden px-4 py-3 transition sm:gap-3',
                  isAddon ? 'bg-amber-50/70' : 'hover:bg-olive-50/60',
                ].join(' ')}
              >
                <span
                  className={[
                    'line-clamp-2 min-w-0 flex-1 text-sm font-semibold break-words sm:text-base',
                    isAddon ? 'text-amber-900' : 'text-emerald-900',
                  ].join(' ')}
                  title={item.name}
                >
                  {item.name}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={priceBadgeClass}>{priceDisplay}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] min-w-0 touch-manipulation border-emerald-700 bg-emerald-600 px-3 text-white hover:bg-emerald-700 sm:min-w-0"
                    onClick={() => addToCart(item.name, fullPrice, 'FULL', section.title)}
                  >
                    Add
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </motion.section>
  );
}

const Index = () => {
  const [showMenu, setShowMenu] = useState(true);
  const [openCategoryKeys, setOpenCategoryKeys] = useState<string[]>([]);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [pendingCheckoutType, setPendingCheckoutType] = useState<'DINE_IN' | 'TAKE_AWAY' | null>(
    null
  );
  const [menuCategories, setMenuCategories] = useState<any[]>([]);
  const [bestSellerItemIds, setBestSellerItemIds] = useState<number[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [lastOrderType, setLastOrderType] = useState<'DINE_IN' | 'TAKE_AWAY' | null>(null);
  const [lastOrderStatus, setLastOrderStatus] = useState<string | null>(null);
  const [lastOrderCreatedAt, setLastOrderCreatedAt] = useState<string | null>(null);
  const [lastCustomerMobile, setLastCustomerMobile] = useState<string>('');
  const [lastCustomerName, setLastCustomerName] = useState<string>('');
  const [branchContact, setBranchContact] = useState<{
    id: number | null;
    name: string;
    phone: string | null;
    location: string | null;
    googleReviewUrl: string | null;
    logoUrl: string | null;
    showTotalAmountToCustomers?: boolean;
    /** From API: at least one active employee shift (required for online orders). */
    orderingOpen?: boolean;
  } | null>(null);
  /** True after a successful GET /config/branch-contact (used to avoid scary banners on transient API failures). */
  const [branchContactResolved, setBranchContactResolved] = useState(false);
  const [branchContactLoading, setBranchContactLoading] = useState(true);
  const showTotalAmountToCustomers = branchContact?.showTotalAmountToCustomers ?? true;
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({
    name: '',
    mobile: '',
    orderId: '',
    issueType: 'OTHER' as string,
    message: '',
  });
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const reviewSectionRef = useRef<HTMLDivElement>(null);
  const lastToggledKeyRef = useRef<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [cart, setCart] = useState<CartItem[]>([]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const branchId = branchContact?.id ?? null;
  const apiBase = API_BASE_URL;

  const canPlaceOrderOnline =
    branchContactResolved && branchId != null && branchContact?.orderingOpen === true;

  const checkoutDisabledReason = !branchContactResolved
    ? 'Checking whether online ordering is available…'
    : branchId == null
      ? 'Online ordering is not set up yet. Please order at the counter or call us.'
      : branchContact?.orderingOpen === false
        ? 'Online ordering opens when staff are on shift. Browse the menu, call us, or order at the counter.'
        : '';

  const menuCategoriesRef = useRef<unknown[]>([]);
  useEffect(() => {
    menuCategoriesRef.current = menuCategories;
  }, [menuCategories]);

  // Deployment resilience: on cold starts (Railway/Render), menu + branch contact can return 503/timeout.
  // We auto-retry with gentle backoff so customers don't get stuck on a broken first load.
  const retryRef = useRef<{
    menuAttempts: number;
    contactAttempts: number;
    menuTimer: number | null;
    contactTimer: number | null;
  }>({ menuAttempts: 0, contactAttempts: 0, menuTimer: null, contactTimer: null });

  const sessionToken = useMemo(() => {
    const key = 'chapter1_session_token';
    let existing = window.localStorage.getItem(key);
    if (!existing) {
      existing = crypto.randomUUID();
      window.localStorage.setItem(key, existing);
    }
    return existing;
  }, []);

  const [menuLoadError, setMenuLoadError] = useState<string | null>(null);
  const MENU_CACHE_KEY = 'dm_public_menu_cache_v1';

  // Hydrate from last saved menu immediately (fast first paint), then refresh from server.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MENU_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        categories?: any[];
        bestSellerItemIds?: number[];
      };
      if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
        menuCategoriesRef.current = parsed.categories;
        setMenuCategories(parsed.categories);
        setBestSellerItemIds(
          Array.isArray(parsed.bestSellerItemIds) ? parsed.bestSellerItemIds : []
        );
        setIsLoadingMenu(false);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchMenu = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = !!opts?.silent;
      if (!silent) {
        setMenuLoadError(null);
      }
      const hasCachedCategories = (() => {
        try {
          const raw = window.localStorage.getItem(MENU_CACHE_KEY);
          if (!raw) return false;
          const p = JSON.parse(raw) as { categories?: unknown[] };
          return Array.isArray(p.categories) && p.categories.length > 0;
        } catch {
          return false;
        }
      })();
      const hasMenuData =
        (menuCategoriesRef.current as unknown[]).length > 0 || hasCachedCategories;
      // Only show the full grid skeleton when there is nothing to display yet.
      // Silent / background fetches must not flip loading — that caused skeleton + cards together (flashing).
      if (!silent && !hasMenuData) {
        setIsLoadingMenu(true);
      }
      try {
        const res = await fetchWithTimeout(`${apiBase}/menu`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const isWarmingUp = res.status === 502 || res.status === 503 || res.status === 504;
          const hadMenu = (menuCategoriesRef.current as unknown[]).length > 0;
          if (!hadMenu) {
            setMenuLoadError(
              isWarmingUp
                ? 'Server is starting… tap Retry in a moment.'
                : data?.message || `Failed to load menu (${res.status})`
            );
          } else {
            setMenuLoadError(null);
          }
          setMenuCategories(prev => (prev.length ? prev : []));
          setBestSellerItemIds(prev => (prev.length ? prev : []));
          if (isWarmingUp) {
            const attempts = (retryRef.current.menuAttempts ?? 0) + 1;
            retryRef.current.menuAttempts = attempts;
            const delay = Math.min(30_000, 1500 + attempts * 1500);
            if (retryRef.current.menuTimer) window.clearTimeout(retryRef.current.menuTimer);
            retryRef.current.menuTimer = window.setTimeout(() => {
              void fetchMenu({ silent: true });
            }, delay);
          }
          return;
        }
        retryRef.current.menuAttempts = 0;
        if (retryRef.current.menuTimer) {
          window.clearTimeout(retryRef.current.menuTimer);
          retryRef.current.menuTimer = null;
        }
        const categories = Array.isArray(data) ? data : (data?.categories ?? []);
        const ids = Array.isArray(data) ? [] : (data?.bestSellerItemIds ?? []);
        setMenuCategories(categories);
        setBestSellerItemIds(ids);
        setMenuLoadError(null);
        try {
          window.localStorage.setItem(
            MENU_CACHE_KEY,
            JSON.stringify({ ts: Date.now(), categories, bestSellerItemIds: ids })
          );
        } catch {
          // ignore
        }
      } catch (error) {
        const isTimeout = error instanceof Error && error.name === 'AbortError';
        let usedCache = false;
        try {
          const raw = window.localStorage.getItem(MENU_CACHE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as {
              ts?: number;
              categories?: any[];
              bestSellerItemIds?: number[];
            };
            if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
              setMenuCategories(parsed.categories);
              setBestSellerItemIds(
                Array.isArray(parsed.bestSellerItemIds) ? parsed.bestSellerItemIds : []
              );
              usedCache = true;
            }
          }
        } catch {
          // ignore cache parse
        }
        const hadMenu = usedCache || (menuCategoriesRef.current as unknown[]).length > 0;
        if (!hadMenu) {
          setMenuLoadError(
            isTimeout
              ? 'Request timed out. Please try again.'
              : 'Could not reach the server. Please try again in a moment.'
          );
          setMenuCategories(prev => (prev.length ? prev : []));
          setBestSellerItemIds(prev => (prev.length ? prev : []));
        } else {
          setMenuLoadError(null);
        }
        const attempts = (retryRef.current.menuAttempts ?? 0) + 1;
        retryRef.current.menuAttempts = attempts;
        const delay = Math.min(30_000, 2000 + attempts * 1500);
        if (retryRef.current.menuTimer) window.clearTimeout(retryRef.current.menuTimer);
        retryRef.current.menuTimer = window.setTimeout(() => {
          void fetchMenu({ silent: true });
        }, delay);
      } finally {
        setIsLoadingMenu(false);
      }
    },
    [apiBase]
  );

  useEffect(() => {
    void fetchMenu({ silent: false });
  }, [fetchMenu]);

  const branchContactRef = useRef(branchContact);
  useEffect(() => {
    branchContactRef.current = branchContact;
  }, [branchContact]);

  const fetchBranchContact = useCallback(
    async (silent: boolean) => {
      if (!silent) {
        setBranchContactLoading(true);
      }
      try {
        const res = await fetchWithTimeout(`${apiBase}/config/branch-contact`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const isWarmingUp = res.status === 502 || res.status === 503 || res.status === 504;
          if (!branchContactRef.current) {
            setBranchContact({
              id: null,
              name: 'CAFE CHAPTER 1 RESTRO',
              phone: null,
              location: null,
              googleReviewUrl: null,
              logoUrl: null,
              showTotalAmountToCustomers: true,
              orderingOpen: false,
            });
          }
          if (isWarmingUp) {
            const attempts = (retryRef.current.contactAttempts ?? 0) + 1;
            retryRef.current.contactAttempts = attempts;
            const delay = Math.min(30_000, 1500 + attempts * 1500);
            if (retryRef.current.contactTimer) window.clearTimeout(retryRef.current.contactTimer);
            retryRef.current.contactTimer = window.setTimeout(() => {
              void fetchBranchContact(false);
            }, delay);
          }
          return;
        }

        setBranchContact({
          id: data.id ?? null,
          name: data.name || 'CAFE CHAPTER 1 RESTRO',
          phone: data.phone ?? null,
          location: data.location ?? null,
          googleReviewUrl: data.googleReviewUrl ?? null,
          logoUrl: data.logoUrl ?? null,
          showTotalAmountToCustomers: data.showTotalAmountToCustomers ?? true,
          orderingOpen: typeof data.orderingOpen === 'boolean' ? data.orderingOpen : false,
        });
        setBranchContactResolved(true);
        retryRef.current.contactAttempts = 0;
        if (retryRef.current.contactTimer) {
          window.clearTimeout(retryRef.current.contactTimer);
          retryRef.current.contactTimer = null;
        }
      } catch (_) {
        if (!branchContactRef.current) {
          setBranchContact({
            id: null,
            name: 'CAFE CHAPTER 1 RESTRO',
            phone: null,
            location: null,
            googleReviewUrl: null,
            logoUrl: null,
            showTotalAmountToCustomers: true,
            orderingOpen: false,
          });
        }
        const attempts = (retryRef.current.contactAttempts ?? 0) + 1;
        retryRef.current.contactAttempts = attempts;
        const delay = Math.min(30_000, 2000 + attempts * 1500);
        if (retryRef.current.contactTimer) window.clearTimeout(retryRef.current.contactTimer);
        retryRef.current.contactTimer = window.setTimeout(() => {
          void fetchBranchContact(false);
        }, delay);
      } finally {
        if (!silent) {
          setBranchContactLoading(false);
        }
      }
    },
    [apiBase]
  );

  useEffect(() => {
    void fetchBranchContact(false);
  }, [fetchBranchContact]);

  const branchContactPollRef = useRef<number | null>(null);
  useEffect(() => {
    branchContactPollRef.current = window.setInterval(() => {
      void fetchBranchContact(true);
    }, 90_000);
    return () => {
      if (branchContactPollRef.current) window.clearInterval(branchContactPollRef.current);
    };
  }, [fetchBranchContact]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchMenu({ silent: true });
        void fetchBranchContact(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [fetchMenu, fetchBranchContact]);

  // Cleanup retry timers on unmount.
  useEffect(() => {
    return () => {
      if (retryRef.current.menuTimer) window.clearTimeout(retryRef.current.menuTimer);
      if (retryRef.current.contactTimer) window.clearTimeout(retryRef.current.contactTimer);
    };
  }, []);

  // No welcome/visiting page — splash only, then straight to menu

  const addToCart = useCallback(
    (itemName: string, price: number, variant?: 'HALF' | 'FULL', category?: string) => {
      const id = `${itemName}-${variant ?? 'FULL'}-${category ?? ''}`;
      setCart(prev => {
        const existing = prev.find(i => i.id === id);
        if (existing) {
          return prev.map(i => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i));
        }
        return [
          ...prev,
          {
            id,
            name: itemName,
            price,
            quantity: 1,
            variant,
            category,
          },
        ];
      });
      // Don't open cart on add – customer stays on menu; cart opens only on "View & Checkout"
      const result = toast({ title: 'Added' });
      if (result?.dismiss) setTimeout(result.dismiss, 2000);
    },
    [toast]
  );

  const incrementCartItem = (id: string) => {
    setCart(prev =>
      prev.map(item => (item.id === id ? { ...item, quantity: item.quantity + 1 } : item))
    );
  };

  const decrementCartItem = (id: string) => {
    setCart(prev =>
      prev
        .map(item => (item.id === id ? { ...item, quantity: item.quantity - 1 } : item))
        .filter(item => item.quantity > 0)
    );
  };

  const removeCartItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleCheckout = useCallback(
    async (formData: {
      customerName: string;
      customerMobile: string;
      tableNumber: string;
      orderType: 'DINE_IN' | 'TAKE_AWAY';
    }) => {
      if (!cart.length) {
        toast({
          title: 'Your order is empty',
          description: 'Please add some items first.',
        });
        return;
      }
      const nameTrim = formData.customerName.trim();
      if (!nameTrim) {
        toast({
          title: 'Name required',
          description: 'Please enter your name.',
        });
        return;
      }
      const mobileTrim = formData.customerMobile.replace(/\D/g, '').slice(0, 10);
      const validMobile = mobileTrim.length === 10 && /^[6-9]/.test(mobileTrim) ? mobileTrim : '';
      if (formData.orderType === 'DINE_IN' && !/^\d$/.test(formData.tableNumber.trim())) {
        toast({
          title: 'Table number: one digit only',
          description:
            'Enter a single number from 0 to 9 (the digit on your table). Two digits (e.g. 10) or letters are not accepted.',
          variant: 'destructive',
        });
        return;
      }
      if (!canPlaceOrderOnline) {
        toast({
          title: 'Ordering unavailable',
          description:
            checkoutDisabledReason || 'Please try again in a moment or order at the counter.',
          variant: 'destructive',
        });
        return;
      }
      setPendingCheckoutType(formData.orderType);
      setIsSubmittingOrder(true);
      try {
        const response = await fetchWithTimeout(`${apiBase}/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: Math.max(API_TIMEOUT_MS, 60_000),
          body: JSON.stringify({
            orderType: formData.orderType,
            tableNumber: formData.tableNumber.trim(),
            branchId,
            sessionToken,
            packaging: formData.orderType === 'TAKE_AWAY',
            customerName: nameTrim,
            customerMobile: validMobile || undefined,
            items: cart.map(item => ({
              name: item.name,
              unitPrice: item.price,
              quantity: item.quantity,
              variant: item.variant,
            })),
          }),
        });

        if (!response.ok) {
          const clonedForMessage = response.clone();
          const err = (await response.json().catch(() => ({}))) as {
            message?: string;
            errors?: Array<{ path?: (string | number)[]; message?: string }>;
          };
          const issues = Array.isArray(err.errors) ? err.errors : [];
          const tableIssue = issues.find(
            i => Array.isArray(i.path) && String(i.path[0]) === 'tableNumber'
          );
          const firstDetail =
            tableIssue?.message ||
            issues[0]?.message ||
            (err.message && err.message !== 'Invalid input' ? err.message : null);
          const msg = firstDetail || (await readApiErrorMessage(clonedForMessage));
          throw new Error(msg);
        }

        const data = await response.json();

        setCart([]);
        setCartOpen(false);
        setOrderSuccess(true);
        setLastOrderId(data.order?.id ?? null);
        setLastOrderType(formData.orderType);
        setLastOrderStatus('NEW_ORDER');
        setLastOrderCreatedAt(data.order?.createdAt ?? new Date().toISOString());
        setLastCustomerMobile(validMobile);
        setLastCustomerName(nameTrim);
        toast({
          title: 'Order placed!',
          description: 'Your order has been sent to the kitchen.',
        });
        setTimeout(() => {
          reviewSectionRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 800);
      } catch (error) {
        const isTimeout = error instanceof Error && error.name === 'AbortError';
        const message = isTimeout
          ? 'Request timed out. Check your connection and try again, or ask staff for help.'
          : error instanceof Error
            ? error.message
            : 'Please try again or call the staff.';
        toast({
          title: 'Order not sent',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setIsSubmittingOrder(false);
        setPendingCheckoutType(null);
      }
    },
    [cart, branchId, canPlaceOrderOnline, checkoutDisabledReason, sessionToken, toast]
  );

  // Poll order status while success screen is shown
  const { payload: liveOrderPayload } = useOrderStatusStream(
    orderSuccess ? lastOrderId : null,
    true
  );

  useEffect(() => {
    if (!orderSuccess || !lastOrderId) return;
    if (!liveOrderPayload) return;
    if (liveOrderPayload.id !== lastOrderId) return;
    setLastOrderStatus(liveOrderPayload.status ?? null);
  }, [liveOrderPayload, orderSuccess, lastOrderId]);

  useEffect(() => {
    const key = lastToggledKeyRef.current;
    if (!key) return;
    const isOpen = openCategoryKeys.includes(key);
    if (!isOpen) return;
    // Let the panel render first.
    const t = window.setTimeout(() => {
      const el = document.getElementById(`category-panel-${key}`);
      // Removed scrollIntoView to prevent unwanted scrolling
      // el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => window.clearTimeout(t);
  }, [openCategoryKeys]);

  return (
    <>
      <AnimatePresence>
        {orderSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 text-center text-white">
                <div className="mb-2 text-4xl">🎉</div>
                <h3 className="text-xl font-bold">Order Placed!</h3>
                <p className="mt-1 text-sm text-emerald-100">
                  Thank you for your order — Cafe Chapter 1
                </p>
              </div>

              {/* Order Details */}
              <div className="space-y-3 px-6 py-4">
                {/* Order info row */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Order ID</span>
                  <span className="font-bold text-emerald-800">#{lastOrderId}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      lastOrderType === 'TAKE_AWAY'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {lastOrderType === 'TAKE_AWAY' ? 'Take Away' : 'Dine In'}
                  </span>
                </div>

                {/* Action Buttons */}
                {/* Invoice actions removed for now (per request). */}

                <div className="flex items-center justify-between pt-1">
                  <p className="text-muted-foreground text-xs">Scroll down for review & more</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-7 px-2 text-xs"
                    onClick={() => setOrderSuccess(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showMenu && (
        <div className="min-h-[100dvh] bg-gradient-to-br from-olive-50 via-olive-100 to-olive-200">
          {/* Header: on mobile reserve top for buttons (pt-14), then compact hero so no overlap and section not too tall */}
          <header className="relative overflow-hidden px-0 pt-14 pb-4 text-white sm:py-10 sm:pt-8">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-700 via-emerald-800 to-green-950" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_55%)]" />
            {/* Login + Raise Issue: above hero, responsive labels for all devices */}
            <div className="absolute top-3 right-3 left-3 z-20 flex flex-wrap items-center justify-end gap-2 sm:top-4 sm:right-4 sm:left-auto">
              {branchContact?.phone?.trim() && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[40px] rounded-full border-white/30 bg-white/10 px-3 py-2 text-xs text-white backdrop-blur-sm hover:bg-white/20 sm:min-h-0"
                  onClick={() => setContactDialogOpen(true)}
                  aria-label="Call or WhatsApp"
                >
                  <Phone className="h-4 w-4 shrink-0 sm:mr-1" />
                  <span className="hidden sm:inline">Call / WhatsApp</span>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[40px] rounded-full border-white/30 bg-white/10 px-3 py-2 text-xs text-white backdrop-blur-sm hover:bg-white/20 sm:min-h-0"
                onClick={() => {
                  setIssueForm(f => ({
                    ...f,
                    name: lastCustomerName || f.name,
                    mobile: lastCustomerMobile || f.mobile,
                    orderId: lastOrderId != null ? String(lastOrderId) : f.orderId,
                  }));
                  setIssueDialogOpen(true);
                }}
                aria-label="Raise issue or need help"
              >
                <HelpCircle className="h-4 w-4 shrink-0 sm:mr-1" />
                <span className="hidden sm:inline">Raise Issue / Need Help</span>
                <span className="sm:hidden">Help</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-[40px] rounded-full border-white/30 bg-white/10 px-3 py-2 text-xs text-white backdrop-blur-sm hover:bg-white/20 sm:min-h-0 sm:px-4 sm:text-sm"
                onClick={() => navigate('/login')}
                aria-label="Staff login"
              >
                Login
              </Button>
            </div>
            {/* Full-width hero container: starts below button row so logo never overlaps */}
            <div className="relative w-full px-4 pt-1 sm:pt-0">
              <div className="mb-2 flex flex-col items-center gap-2 text-center sm:mb-4 sm:gap-3">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="mb-0 sm:mb-2"
                >
                  <img
                    src={branchContact?.logoUrl || cafeLogo}
                    alt=""
                    className="h-14 w-14 rounded-xl bg-white/15 object-contain p-1.5 shadow-lg sm:h-24 sm:w-24 sm:p-2 md:h-28 md:w-28"
                    aria-hidden
                  />
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="text-2xl font-extrabold tracking-tight drop-shadow sm:text-5xl md:text-6xl lg:text-7xl"
                >
                  Cafe Chapter 1
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: 'easeOut', delay: 0.05 }}
                  className="text-xs text-white/85 sm:text-sm"
                >
                  Feel the taste
                </motion.p>
              </div>

              {/* Touch-friendly: 44px min height for thumbs on phones */}
              <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2 sm:gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-[44px] min-w-[140px] touch-manipulation bg-white/90 text-emerald-950 hover:bg-white"
                  onClick={() => window.open('tel:+917800327061')}
                >
                  <Phone className="mr-2 h-4 w-4" />
                  +91 7800327061
                </Button>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="min-h-[44px] min-w-[100px] touch-manipulation bg-white text-emerald-900 hover:bg-emerald-50">
                      <QrCode className="mr-2 h-4 w-4" />
                      QR
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <QRCodeGenerator />
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="secondary"
                      className="min-h-[44px] min-w-[100px] touch-manipulation bg-white/15 text-white hover:bg-white/25"
                    >
                      <MapPin className="mr-2 h-4 w-4" />
                      Location
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[80dvh] max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>Chapter 1 Cafe Location</DialogTitle>
                    </DialogHeader>
                    <LocationMap />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </header>

          {/* Categories - memoized so cart/dialog updates do not re-render menu (stops blink). QA: Fixed pb reserves space for fixed cart bar so content never overlaps on iPhone when Safari UI changes. */}
          <main className="mx-auto w-full max-w-6xl min-w-0 overflow-x-hidden px-4 py-8 pb-[7.5rem] sm:py-10 sm:pb-10">
            <div className="space-y-6">
              <MenuCategoriesSection
                menuCategories={menuCategories}
                categoryQuery={categoryQuery}
                setCategoryQuery={setCategoryQuery}
                openCategoryKeys={openCategoryKeys}
                setOpenCategoryKeys={setOpenCategoryKeys}
                bestSellerItemIds={bestSellerItemIds}
                addToCart={addToCart}
                isLoadingMenu={isLoadingMenu}
                menuLoadError={menuLoadError}
                fetchMenu={fetchMenu}
                lastToggledKeyRef={lastToggledKeyRef}
              />
            </div>
          </main>

          {/* Floating Cart Summary - anchored above safe-area on mobile. */}
          <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto max-w-md">
              <AnimatePresence>
                {cart.length > 0 && (
                  <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 80, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-700/70 bg-emerald-900 px-4 py-3 text-white shadow-xl"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-sm font-semibold">
                        <ShoppingBag className="h-4 w-4 shrink-0" />
                        <span>
                          {cart.length} item{cart.length > 1 ? 's' : ''} in order
                        </span>
                      </div>
                      <div className="text-xs text-emerald-100">
                        {isSubmittingOrder ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                            Sending order to kitchen…
                          </span>
                        ) : showTotalAmountToCustomers ? (
                          `Total: ₹${cartTotal.toFixed(0)}`
                        ) : (
                          'Total: —'
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="min-h-[44px] min-w-[120px] shrink-0 touch-manipulation bg-white text-emerald-900 hover:bg-emerald-50"
                      disabled={isSubmittingOrder}
                      onClick={() => setCartOpen(true)}
                      title={!canPlaceOrderOnline ? checkoutDisabledReason || undefined : undefined}
                    >
                      {isSubmittingOrder ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Wait…
                        </span>
                      ) : (
                        'View & Checkout'
                      )}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Cart Drawer/Dialog - form state lives here so typing does not re-render the menu */}
          <OrderCartDialog
            open={cartOpen}
            onOpenChange={open => {
              if (!open && isSubmittingOrder) return;
              setCartOpen(open);
            }}
            cart={cart}
            cartTotal={cartTotal}
            incrementCartItem={incrementCartItem}
            decrementCartItem={decrementCartItem}
            removeCartItem={removeCartItem}
            onCheckout={handleCheckout}
            isSubmittingOrder={isSubmittingOrder}
            pendingCheckoutType={pendingCheckoutType}
            lastCustomerName={lastCustomerName}
            lastCustomerMobile={lastCustomerMobile}
            showTotalAmount={showTotalAmountToCustomers}
            checkoutEnabled={canPlaceOrderOnline}
            checkoutDisabledReason={checkoutDisabledReason}
          />

          {/* Contact dialog: only shown when branch has phone (button only renders then) */}
          <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Contact {branchContact?.name || 'us'}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 pt-2">
                {branchContact?.phone?.trim() && (
                  <>
                    <p className="text-sm font-medium">
                      📞 +91{' '}
                      {branchContact.phone
                        .replace(/\D/g, '')
                        .slice(-10)
                        .replace(/(\d{5})(\d{5})/, '$1 $2')}
                    </p>
                    {branchContact?.location && (
                      <p className="text-muted-foreground text-xs">📍 {branchContact.location}</p>
                    )}
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3"
                      onClick={() => {
                        const num = branchContact!.phone!.replace(/\D/g, '').slice(-10);
                        window.location.href = `tel:+91${num}`;
                      }}
                    >
                      <Phone className="h-4 w-4" />
                      Call
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10"
                      onClick={() => {
                        const num = branchContact!.phone!.replace(/\D/g, '').slice(-10);
                        window.open(`https://wa.me/91${num}`, '_blank');
                      }}
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </Button>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Raise Issue / Need Help */}
          <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Raise Issue / Need Help</DialogTitle>
              </DialogHeader>
              <form
                className="flex flex-col gap-4 pt-2"
                onSubmit={async e => {
                  e.preventDefault();
                  const mobile = issueForm.mobile.replace(/\D/g, '').slice(-10);
                  if (mobile.length !== 10) {
                    toast({
                      title: 'Invalid mobile',
                      description: 'Enter a valid 10-digit number',
                      variant: 'destructive',
                    });
                    return;
                  }
                  setIssueSubmitting(true);
                  try {
                    const res = await fetch(`${apiBase}/customer-queries`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: issueForm.name.trim(),
                        mobile,
                        orderId: issueForm.orderId ? Number(issueForm.orderId) : undefined,
                        branchId: branchId || undefined,
                        issueType: issueForm.issueType,
                        message: issueForm.message.trim(),
                      }),
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      throw new Error(err.message || 'Failed to submit');
                    }
                    const submittedName = issueForm.name.trim() || 'there';
                    setIssueDialogOpen(false);
                    setIssueForm({
                      name: '',
                      mobile: '',
                      orderId: '',
                      issueType: 'OTHER',
                      message: '',
                    });
                    toast({
                      title: `Thank you, ${submittedName}!`,
                      description:
                        "We've received your query and will get back to you soon. You can continue browsing the menu below.",
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } catch (err) {
                    toast({
                      title: 'Error',
                      description: err instanceof Error ? err.message : 'Could not submit',
                      variant: 'destructive',
                    });
                  } finally {
                    setIssueSubmitting(false);
                  }
                }}
              >
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Name *</label>
                  <input
                    className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={issueForm.name}
                    onChange={e => setIssueForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Your name"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Mobile (10 digits) *</label>
                  <input
                    className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={issueForm.mobile}
                    onChange={e =>
                      setIssueForm(f => ({
                        ...f,
                        mobile: e.target.value.replace(/\D/g, '').slice(0, 10),
                      }))
                    }
                    placeholder="9876543210"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Order ID (optional)</label>
                  <input
                    className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
                    type="text"
                    inputMode="numeric"
                    value={issueForm.orderId}
                    onChange={e =>
                      setIssueForm(f => ({
                        ...f,
                        orderId: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                    placeholder="e.g. 1"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Issue type *</label>
                  <select
                    className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={issueForm.issueType}
                    onChange={e => setIssueForm(f => ({ ...f, issueType: e.target.value }))}
                  >
                    <option value="ORDER_ISSUE">Order issue</option>
                    <option value="PAYMENT_ISSUE">Payment issue</option>
                    <option value="FOOD_ISSUE">Food issue</option>
                    <option value="DELAY_ISSUE">Delay issue</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Describe your issue *</label>
                  <textarea
                    className="border-input flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm"
                    value={issueForm.message}
                    onChange={e => setIssueForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Describe your issue..."
                    required
                  />
                </div>
                <Button type="submit" disabled={issueSubmitting}>
                  {issueSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit'
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* --- Other Outlets (uniform cards, similar width to category cards) --- */}
          <div className="mb-12 flex flex-col items-center">
            <span className="mb-3 text-lg font-bold tracking-wide text-orange-400 drop-shadow md:text-2xl">
              Green Park, Gautam Nagar, New Delhi
            </span>
            <div className="grid w-full max-w-5xl grid-cols-2 gap-4 px-4 sm:grid-cols-3 md:gap-6">
              {/* Yusuf Sarai - Swiggy */}
              <a
                href="https://www.swiggy.com/restaurants/cafe-chapter-1-south-extension-south-extension-729152/dineout"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col items-center rounded-2xl bg-white/90 px-5 py-4 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                aria-label="Order from Swiggy Yusuf Sarai"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/1/13/Swiggy_logo.png"
                  alt="Swiggy"
                  className="mb-2 h-16 w-16 object-contain transition group-hover:scale-110"
                />
                <span className="text-base font-bold md:text-lg" style={{ color: '#FC8019' }}>
                  Swiggy
                </span>
                <span className="mt-1 text-center text-xs text-gray-600">
                  Yusuf Sarai, New Delhi
                </span>
                <button className="mt-3 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 px-4 py-1 font-semibold text-white shadow transition hover:scale-105">
                  Order Now
                </button>
              </a>
              {/* Yusuf Sarai - Zomato */}
              <a
                href="https://www.zomato.com/ncr/chapter-1-qutab-institutional-area-new-delhi/order"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col items-center rounded-2xl bg-white/90 px-5 py-4 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                aria-label="Order from Zomato Yusuf Sarai"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/7/75/Zomato_logo.png"
                  alt="Zomato"
                  className="mb-2 h-16 w-16 object-contain transition group-hover:scale-110"
                />
                <span className="text-base font-bold md:text-lg" style={{ color: '#E23744' }}>
                  Zomato
                </span>
                <span className="mt-1 text-center text-xs text-gray-600">
                  Yusuf Sarai, New Delhi
                </span>
                <button className="mt-3 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 px-4 py-1 font-semibold text-white shadow transition hover:scale-105">
                  Order Now
                </button>
              </a>
              {/* Yusuf Sarai - Magicpin */}
              <a
                href="https://magicpin.in/New-delhi/Yusuf-sarai/Restaurant/Cafe-chapter-1/store/155b58c/"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col items-center rounded-2xl bg-white/90 px-5 py-4 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                aria-label="Order from Magicpin Yusuf Sarai"
              >
                <img
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTL3vawke4UFzJcg65Wy2KAKTmYwqHlbPf6HA&s"
                  alt="Magicpin"
                  className="mb-2 h-16 w-16 object-contain transition group-hover:scale-110"
                />
                <span className="text-base font-bold md:text-lg" style={{ color: '#6C47FF' }}>
                  Magicpin
                </span>
                <span className="mt-1 text-center text-xs text-gray-600">
                  Yusuf Sarai, New Delhi
                </span>
                <button className="mt-3 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-1 font-semibold text-white shadow transition hover:scale-105">
                  Order Now
                </button>
              </a>
            </div>
          </div>

          {/* --- Google Review and Instagram (Side by Side & Responsive, uniform cards) --- */}
          <div
            ref={reviewSectionRef}
            id="google-review"
            className="mx-auto mb-12 flex w-full max-w-4xl flex-col items-center justify-center gap-8 px-4 md:flex-row"
          >
            {/* Google Review */}
            <a
              href="https://g.page/r/CekUwwDsaYMBEAE/review"
              target="_blank"
              rel="noopener noreferrer"
              className="group mb-6 flex h-full w-full flex-col items-center rounded-2xl bg-white/90 px-5 py-4 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl md:mb-0 md:w-80"
              aria-label="Google Review"
            >
              <img
                src="https://www.seekpng.com/png/detail/351-3512666_googlereview-logo-gray-google-logo-250-x-250.png"
                alt="Google Logo"
                className="mb-2 h-20 w-50 transition group-hover:scale-110"
              />
              <span className="text-base font-bold text-orange-500 md:text-lg">
                Google Feedback
              </span>
              <span className="mt-1 text-center text-xs text-gray-600">
                Share your experience with us!
              </span>
            </a>
            {/* Instagram */}
            <a
              href="https://www.instagram.com/cafe_chapter_1?igsh=bjVsemUzZWkybzRz&utm_source=qr"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-full w-full flex-col items-center rounded-2xl bg-white/90 px-5 py-4 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl md:w-80"
              aria-label="Follow us on Instagram"
            >
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png"
                alt="Instagram"
                className="mb-2 h-16 w-16 transition group-hover:scale-110"
              />
              <span className="text-base font-bold md:text-lg" style={{ color: '#E1306C' }}>
                @cafe_chapter_1
              </span>
              <span className="mt-1 max-w-xs text-center text-xs text-gray-600">
                We announce new items and offers on Instagram first!
                <br />
                <span className="font-semibold text-orange-500">
                  Follow us for more &amp; exciting outlet offers!
                </span>
              </span>
            </a>
          </div>

          {/* --- Qutab Institutional Area (Main Outlet, uniform cards) --- */}
          <div className="mb-12 flex flex-col items-center">
            <span className="mb-3 text-lg font-bold tracking-wide text-olive-700 drop-shadow md:text-2xl">
              Order from Our Other Outlets
            </span>
            <div className="grid w-full max-w-5xl grid-cols-2 gap-4 px-4 sm:grid-cols-3 md:gap-6">
              {/* Zomato */}
              <a
                href="https://www.zomato.com/ncr/chapter-1-qutab-institutional-area-new-delhi/order"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col items-center rounded-2xl bg-white/90 px-5 py-4 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                aria-label="Order from Zomato"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/7/75/Zomato_logo.png"
                  alt="Zomato"
                  className="mb-2 h-16 w-16 object-contain transition group-hover:scale-110"
                />
                <span className="text-base font-bold md:text-lg" style={{ color: '#E23744' }}>
                  Zomato
                </span>
                <span className="mt-1 text-center text-xs text-gray-600">
                  Qutab Institutional Area, New Delhi
                </span>
                <button className="mt-3 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 px-4 py-1 font-semibold text-white shadow transition hover:scale-105">
                  Order Now
                </button>
              </a>
              {/* Swiggy */}
              <a
                href="https://www.swiggy.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col items-center rounded-2xl bg-white/90 px-5 py-4 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                aria-label="Order from Swiggy"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/1/13/Swiggy_logo.png"
                  alt="Swiggy"
                  className="mb-2 h-16 w-16 object-contain transition group-hover:scale-110"
                />
                <span className="text-base font-bold md:text-lg" style={{ color: '#FC8019' }}>
                  Swiggy
                </span>
                <span className="mt-1 text-center text-xs text-gray-600">
                  Qutab Institutional Area, New Delhi
                </span>
                <button className="mt-3 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 px-4 py-1 font-semibold text-white shadow transition hover:scale-105">
                  Order Now
                </button>
              </a>
              {/* Magicpin */}
              <a
                href="https://magicpin.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col items-center rounded-2xl bg-white/90 px-5 py-4 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                aria-label="Order from Magicpin"
              >
                <img
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTL3vawke4UFzJcg65Wy2KAKTmYwqHlbPf6HA&s"
                  alt="Magicpin"
                  className="mb-2 h-16 w-16 object-contain transition group-hover:scale-110"
                />
                <span className="text-base font-bold md:text-lg" style={{ color: '#6C47FF' }}>
                  Magicpin
                </span>
                <span className="mt-1 text-center text-xs text-gray-600">
                  Qutab Institutional Area, New Delhi
                </span>
                <button className="mt-3 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-1 font-semibold text-white shadow transition hover:scale-105">
                  Order Now
                </button>
              </a>
            </div>
          </div>

          {/* Footer */}
          <div className="py-8 text-center text-olive-700">
            <p className="text-lg font-light">Scan QR code for quick access to our digital menu</p>
            <p className="mt-2 text-sm">Call us: +91 7800327061</p>
          </div>
        </div>
      )}
    </>
  );
};

export default Index;
