import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Phone, QrCode, Search, Utensils, X, Minus, Plus, Trash2, ShoppingBag, MessageCircle, AlertCircle, HelpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnimatePresence, motion } from "framer-motion";
import QRCodeGenerator from "@/components/QRCodeGenerator";
import LocationMap from "@/components/LocationMap";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/constants";
import cafeLogo from "@/assets/logo.png";

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  variant?: "HALF" | "FULL";
};

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
  lastCustomerName,
  lastCustomerMobile,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cart: CartItem[];
  cartTotal: number;
  incrementCartItem: (id: string) => void;
  decrementCartItem: (id: string) => void;
  removeCartItem: (id: string) => void;
  onCheckout: (formData: { customerName: string; customerMobile: string; tableNumber: string; packaging: boolean }) => Promise<void>; // customerMobile optional – for WhatsApp invoice
  isSubmittingOrder: boolean;
  lastCustomerName: string;
  lastCustomerMobile: string;
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [packaging, setPackaging] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomerName(lastCustomerName || "");
      setCustomerMobile(lastCustomerMobile || "");
    }
  }, [open, lastCustomerName, lastCustomerMobile]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key="order-cart-dialog">
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Your Order</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your order is empty. Tap any item to add it.
            </p>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {item.name}{" "}
                    {item.variant && (
                      <span className="text-xs text-emerald-700">
                        ({item.variant === "HALF" ? "Half" : "Full"})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ₹{item.price.toFixed(0)} each
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 min-h-[44px] min-w-[44px] touch-manipulation shrink-0"
                    onClick={() => decrementCartItem(item.id)}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-6 text-center text-sm font-semibold">
                    {item.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 min-h-[44px] min-w-[44px] touch-manipulation shrink-0"
                    onClick={() => incrementCartItem(item.id)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 min-h-[44px] min-w-[44px] touch-manipulation shrink-0 text-red-500 hover:text-red-600"
                    onClick={() => removeCartItem(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t pt-3 mt-2 space-y-2">
          <div className="flex flex-col gap-2 text-xs sm:text-sm">
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-olive-900">Your name <span className="text-red-500">*</span></span>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Rahul Kumar"
                className="w-full rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-olive-900">Mobile number <span className="font-normal text-muted-foreground">(optional)</span></span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit for invoice on WhatsApp"
                className="w-full rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <span className="text-[10px] text-muted-foreground">Add number to receive order confirmation & invoice on WhatsApp</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold text-olive-900">
                Table number {packaging && <span className="font-normal text-muted-foreground">(optional for takeaway)</span>}
              </span>
              <input
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder={packaging ? "Optional (e.g., T1, 5)" : "Enter your table number (e.g., T1, 5)"}
                className="w-full rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-olive-900">
              <input
                type="checkbox"
                checked={packaging}
                onChange={(e) => setPackaging(e.target.checked)}
                className="h-4 w-4 rounded border-emerald-600 text-emerald-600"
              />
              <span>Packaging required (takeaway)</span>
            </label>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Total</span>
            <span className="font-bold">₹{cartTotal.toFixed(0)}</span>
          </div>
          <Button
            className="w-full bg-emerald-700 hover:bg-emerald-800"
            disabled={
              !cart.length ||
              isSubmittingOrder ||
              !customerName.trim() ||
              (!packaging && !tableNumber.trim())
            }
            onClick={() => onCheckout({ customerName, customerMobile, tableNumber, packaging })}
          >
            {isSubmittingOrder ? "Placing Order..." : "Place Order"}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            Show this screen to staff if there is any issue with order confirmation.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const DEFAULT_CATEGORY_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop";

/** Lazy-render children when scrolled into view (with rootMargin). Keeps placeholder until in view for fast initial load on mobile. */
function LazyInView({
  children,
  placeholder,
  rootMargin = "400px",
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
      ([entry]) => setInView((prev) => (entry.isIntersecting ? true : prev)),
      { rootMargin, threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);
  return (
    <div ref={ref} className="min-h-[120px] aspect-[4/5] w-full min-w-0">
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
  addToCart: (itemName: string, price: number, variant?: "HALF" | "FULL") => void;
  isLoadingMenu: boolean;
  menuLoadError: string | null;
  fetchMenu: () => void;
  lastToggledKeyRef: React.MutableRefObject<string | null>;
}) {
  const displayCategories = useMemo(() => {
    return menuCategories.map(cat => ({
      key: String(cat.id),
      title: cat.name || "Category",
      image: cat.imageUrl && cat.imageUrl.trim() ? cat.imageUrl : DEFAULT_CATEGORY_IMAGE,
      items: Array.isArray(cat.items)
        ? cat.items.map((item: any) => ({
            name: item.name,
            price: item.hasHalf && item.halfPrice
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
      (cat) =>
        cat.title.toLowerCase().includes(categoryQuery.toLowerCase()) ||
        cat.items.some((item: any) =>
          item.name.toLowerCase().includes(categoryQuery.toLowerCase())
        )
    );
    const hasBestSeller = (s: typeof filtered[0]) =>
      s.items.some((item: any) => bestSellerItemIds.includes(item.menuItemId));
    return [...filtered].sort((a, b) => (hasBestSeller(b) ? 1 : 0) - (hasBestSeller(a) ? 1 : 0));
  }, [displayCategories, categoryQuery, bestSellerItemIds]);

  const openKeySet = useMemo(() => new Set(openCategoryKeys), [openCategoryKeys]);

  return (
    <>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-olive-900 sm:text-3xl">Menu Categories</h2>
        <p className="mt-2 text-sm text-olive-900/70 sm:text-base">
          Tap a category to open it.
        </p>
      </div>

      <div className="mx-auto w-full max-w-lg">
        <div className="flex items-center gap-2 rounded-2xl bg-white/90 px-4 min-h-[44px] shadow-sm ring-1 ring-black/5 touch-manipulation">
          <Search className="h-4 w-4 shrink-0 text-olive-900/60" />
          <input
            value={categoryQuery}
            onChange={(e) => setCategoryQuery(e.target.value)}
            placeholder="Search categories (e.g., coffee, momos)..."
            className="w-full min-h-[40px] bg-transparent text-base text-olive-950 placeholder:text-olive-900/45 focus:outline-none"
            aria-label="Search menu categories"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 lg:gap-6 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {isLoadingMenu && (
          <>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-xl border border-olive-200/60 bg-olive-50/50 overflow-hidden animate-pulse">
                <div className="h-28 sm:h-32 bg-olive-200/50" />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-olive-200/50" />
                  <div className="h-3 w-1/2 rounded bg-olive-200/40" />
                </div>
              </div>
            ))}
          </>
        )}
        {!isLoadingMenu && menuLoadError && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <AlertCircle className="h-16 w-16 mx-auto mb-4 opacity-60 text-amber-500" />
            <p className="text-lg font-medium">Could not load menu</p>
            <p className="text-sm mt-1">{menuLoadError}</p>
            <Button className="mt-4" variant="outline" size="sm" onClick={() => fetchMenu()}>
              Retry
            </Button>
          </div>
        )}
        {!isLoadingMenu && !menuLoadError && menuCategories.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <Utensils className="h-16 w-16 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">Menu is being prepared.</p>
            <p className="text-sm mt-1">Please check back shortly or ask staff.</p>
          </div>
        )}
        {!isLoadingMenu && menuCategories.length > 0 && filteredCategories.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No categories match your search.
          </div>
        )}
        {filteredCategories.map((section) => {
          const categoryKey = section.key;
          const isOpen = openKeySet.has(categoryKey);
          const isBestSeller = section.items.some((it: any) => bestSellerItemIds.includes(it.menuItemId));
          return (
            <div key={categoryKey} className="contents">
              <LazyInView
                placeholder={
                  <div className="min-h-[120px] aspect-[4/5] w-full min-w-0 rounded-2xl bg-olive-100/50 animate-pulse ring-1 ring-black/5" aria-hidden />
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
        setOpenCategoryKeys((prev) =>
          prev.includes(categoryKey) ? prev.filter((k) => k !== categoryKey) : [...prev, categoryKey]
        );
      }}
      className={[
        "group relative w-full h-full min-h-[120px] aspect-[4/5] overflow-hidden rounded-2xl text-left shadow-sm transition-all will-change-transform touch-manipulation",
        "bg-white/90 hover:bg-white hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        isBestSeller
          ? "ring-2 ring-amber-400 focus-visible:ring-amber-500 shadow-amber-200/50 shadow-lg"
          : "focus-visible:ring-emerald-700 focus-visible:ring-offset-emerald-50",
        isSelected ? (isBestSeller ? "ring-2 ring-amber-500 -translate-y-0.5" : "ring-2 ring-emerald-600 -translate-y-0.5") : "ring-1 ring-black/5 hover:-translate-y-0.5",
      ].join(" ")}
      aria-pressed={isSelected}
    >
      {isBestSeller && (
        <div className="absolute left-2 top-2 z-10 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold text-amber-950 shadow sm:text-[11px]">
          ★ Best Seller
        </div>
      )}
      <div className="flex h-full flex-col min-h-0 min-w-0">
        <div className="flex-[4] min-h-0 relative bg-slate-200">
          <img
            src={section.image}
            alt={section.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              const el = e.currentTarget;
              if (el.src !== DEFAULT_CATEGORY_IMAGE) el.src = DEFAULT_CATEGORY_IMAGE;
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-[20%] bg-gradient-to-t from-black/65 via-black/20 to-transparent pointer-events-none" />
          <div className="absolute right-2 top-2 flex justify-end">
            <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-0.5 text-[10px] font-semibold text-emerald-900 shadow-sm sm:text-[11px]">
              {section.items.length} items
            </span>
          </div>
        </div>
        <div className={`flex-shrink-0 min-h-[52px] max-h-[52px] px-3 py-2 flex items-center justify-start ${isBestSeller ? "bg-gradient-to-r from-amber-600 to-amber-700" : "bg-[#2E8B57]"}`}>
          <h2 className="whitespace-normal break-words text-left text-sm font-extrabold leading-snug text-white sm:text-base line-clamp-2 min-w-0 flex-1">
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
  addToCart: (itemName: string, price: number, variant?: "HALF" | "FULL") => void;
}) {
  return (
    <motion.section
      id={`category-panel-${categoryKey}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="overflow-hidden rounded-2xl bg-white/95 shadow-sm ring-1 ring-black/5"
      aria-label={`${section.title} items`}
    >
      <div className="border-b border-black/5 bg-gradient-to-r from-olive-50 to-white px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="min-w-0">
                <div className="truncate text-base font-bold text-olive-950 sm:text-lg">
                  {section.title || categoryKey}
                </div>
                <div className="text-xs text-olive-900/65">
                  {section.items.length} items
                </div>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 bg-white hover:bg-olive-50"
            onClick={() => setOpenCategoryKeys((prev) => prev.filter((k) => k !== categoryKey))}
          >
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
        </div>
      </div>
      <div className="px-4 py-3 sm:px-5 sm:py-4 min-w-0">
        <ul className="divide-y divide-black/5 rounded-xl bg-white ring-1 ring-black/5 min-w-0 w-full">
          {section.items.map((item: any, idx: number) => {
            const isAddon = item.name.toLowerCase().startsWith("add-on");
            const priceText = String(item.price);
            const hasHalfFull = priceText.includes("/");
            let fullPrice = 0;
            let halfPrice: number | undefined;
            if (hasHalfFull) {
              const [half, full] = priceText.replace(/₹/g, "").split("/").map((p: string) => Number(p.trim()));
              halfPrice = half;
              fullPrice = full;
            } else {
              fullPrice = Number(priceText.replace("₹", "").trim());
            }
            const priceDisplay = priceText.startsWith("₹") ? priceText : `₹${priceText}`;
            const priceBadgeClass = ["shrink-0 rounded-full px-3 py-1 text-sm font-extrabold", isAddon ? "bg-amber-100 text-amber-900" : "bg-olive-100 text-olive-900"].join(" ");

            if (hasHalfFull && halfPrice != null) {
              return (
                <li
                  key={idx}
                  className={["flex items-center gap-4 w-full min-w-0 px-4 py-3 transition", isAddon ? "bg-amber-50/70" : "hover:bg-olive-50/60"].join(" ")}
                >
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <div className={["text-sm font-semibold sm:text-base break-words", isAddon ? "text-amber-900" : "text-emerald-900"].join(" ")}>
                      {item.name}
                    </div>
                    <span className={["w-fit rounded-full px-3 py-1 text-sm font-extrabold", isAddon ? "bg-amber-100 text-amber-900" : "bg-olive-100 text-olive-900"].join(" ")}>
                      {priceDisplay}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="min-h-[44px] min-w-[72px] touch-manipulation border-emerald-600 text-emerald-700 hover:bg-emerald-50" onClick={() => addToCart(item.name, halfPrice!, "HALF")}>
                      Half
                    </Button>
                    <Button variant="outline" size="sm" className="min-h-[44px] min-w-[72px] touch-manipulation border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => addToCart(item.name, fullPrice, "FULL")}>
                      Full
                    </Button>
                  </div>
                </li>
              );
            }

            return (
              <li
                key={idx}
                className={["flex w-full min-w-0 px-4 py-3 items-center justify-between gap-3 transition", isAddon ? "bg-amber-50/70" : "hover:bg-olive-50/60"].join(" ")}
              >
                <span className={["min-w-0 flex-1 line-clamp-2 break-words text-sm font-semibold sm:text-base", isAddon ? "text-amber-900" : "text-emerald-900"].join(" ")}>
                  {item.name}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={priceBadgeClass}>{priceDisplay}</span>
                  <Button variant="outline" size="sm" className="min-h-[44px] touch-manipulation border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => addToCart(item.name, fullPrice, "FULL")}>
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
  const [categoryQuery, setCategoryQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [menuCategories, setMenuCategories] = useState<any[]>([]);
  const [bestSellerItemIds, setBestSellerItemIds] = useState<number[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderWaMeLink, setLastOrderWaMeLink] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [lastCustomerMobile, setLastCustomerMobile] = useState<string>("");
  const [lastCustomerName, setLastCustomerName] = useState<string>("");
  const [branchContact, setBranchContact] = useState<{ id: number | null; name: string; phone: string | null; location: string | null; googleReviewUrl: string | null; logoUrl: string | null } | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({ name: "", mobile: "", orderId: "", issueType: "OTHER" as string, message: "" });
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const reviewSectionRef = useRef<HTMLDivElement>(null);
  const lastToggledKeyRef = useRef<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [cart, setCart] = useState<CartItem[]>([]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  const branchId = branchContact?.id ?? null;
  const apiBase = API_BASE_URL;

  const sessionToken = useMemo(() => {
    const key = "chapter1_session_token";
    let existing = window.localStorage.getItem(key);
    if (!existing) {
      existing = crypto.randomUUID();
      window.localStorage.setItem(key, existing);
    }
    return existing;
  }, []);

  const [menuLoadError, setMenuLoadError] = useState<string | null>(null);

  const fetchMenu = useCallback(async () => {
    setMenuLoadError(null);
    setIsLoadingMenu(true);
    try {
      const res = await fetch(`${apiBase}/menu`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMenuLoadError(data?.message || `Failed to load menu (${res.status})`);
        setMenuCategories([]);
        setBestSellerItemIds([]);
        return;
      }
      const categories = Array.isArray(data) ? data : (data?.categories ?? []);
      const ids = Array.isArray(data) ? [] : (data?.bestSellerItemIds ?? []);
      setMenuCategories(categories);
      setBestSellerItemIds(ids);
    } catch (error) {
      console.error("Failed to load menu:", error);
      setMenuLoadError(
        `Could not reach the server at ${apiBase}. Make sure the backend is running (e.g. npm run dev in the backend folder) and the URL is correct.`
      );
      setMenuCategories([]);
      setBestSellerItemIds([]);
      toast({
        title: "Error",
        description: "Failed to load menu. Check that the backend is running.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMenu(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Refetch menu when user returns to the tab so first open / refresh shows all cards without manual refresh
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchMenu();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [fetchMenu]);

  // Fetch branch contact for Call / WhatsApp on menu
  useEffect(() => {
    const fetchContact = async () => {
      try {
        const res = await fetch(`${apiBase}/config/branch-contact`);
        if (res.ok) {
          const data = await res.json();
          setBranchContact({
            id: data.id ?? null,
            name: data.name || "CAFE CHAPTER 1 RESTRO",
            phone: data.phone ?? null,
            location: data.location ?? null,
            googleReviewUrl: data.googleReviewUrl ?? null,
            logoUrl: data.logoUrl ?? null,
          });
        }
      } catch (_) {
        setBranchContact({
          id: null,
          name: "CAFE CHAPTER 1 RESTRO",
          phone: null,
          location: null,
          googleReviewUrl: null,
          logoUrl: null,
        });
      }
    };
    fetchContact();
  }, [apiBase]);

  // No welcome/visiting page — splash only, then straight to menu

  const addToCart = useCallback((itemName: string, price: number, variant?: "HALF" | "FULL") => {
    const id = `${itemName}-${variant ?? "FULL"}`;
    setCart((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) {
        return prev.map((i) =>
          i.id === id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          id,
          name: itemName,
          price,
          quantity: 1,
          variant,
        },
      ];
    });
    // Don't open cart on add – customer stays on menu; cart opens only on "View & Checkout"
    const result = toast({ title: "Added" });
    if (result?.dismiss) setTimeout(result.dismiss, 2000);
  }, [toast]);

  const incrementCartItem = (id: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    );
  };

  const decrementCartItem = (id: string) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity - 1 } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const removeCartItem = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCheckout = useCallback(
    async (formData: { customerName: string; customerMobile: string; tableNumber: string; packaging: boolean }) => {
      if (!cart.length) {
        toast({ title: "Your order is empty", description: "Please add some items first." });
        return;
      }
      const nameTrim = formData.customerName.trim();
      if (!nameTrim) {
        toast({ title: "Name required", description: "Please enter your name." });
        return;
      }
      const mobileTrim = formData.customerMobile.replace(/\D/g, "").slice(0, 10);
      const validMobile = mobileTrim.length === 10 && /^[6-9]/.test(mobileTrim) ? mobileTrim : "";
      if (!formData.packaging && !formData.tableNumber.trim()) {
        toast({
          title: "Table number required",
          description: "Please enter your table number, or check packaging for takeaway.",
        });
        return;
      }
      if (branchId == null) {
        toast({
          title: "Branch not loaded",
          description: "Please refresh the page and try again.",
          variant: "destructive",
        });
        return;
      }
      setIsSubmittingOrder(true);
      setLastOrderWaMeLink(null);
      try {
        const response = await fetch(`${API_BASE_URL}/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tableNumber: formData.packaging ? (formData.tableNumber.trim() || "Takeaway") : formData.tableNumber.trim(),
            branchId,
            sessionToken,
            packaging: formData.packaging,
            customerName: nameTrim,
            customerMobile: validMobile || undefined,
            items: cart.map((item) => ({
              name: item.name,
              unitPrice: item.price,
              quantity: item.quantity,
              variant: item.variant,
            })),
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const msg = err.message || "Failed to place order";
          throw new Error(msg);
        }

        const data = await response.json();
        const waMe = data.waMeLink || null;

        setCart([]);
        setCartOpen(false);
        setOrderSuccess(true);
        setLastOrderWaMeLink(waMe);
        setLastOrderId(data.order?.id ?? null);
        setLastCustomerMobile(validMobile);
        setLastCustomerName(nameTrim);
        toast({
          title: "Order placed!",
          description: validMobile
            ? "Your order has been sent. Use the button below to get your invoice on WhatsApp."
            : "Your order has been sent to the kitchen. Add your mobile next time to receive the invoice on WhatsApp.",
        });
        setTimeout(() => {
          reviewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 800);
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Please try again or call the staff.";
        toast({
          title: message,
          description: message.includes("active employee") ? "Ask staff to start their shift at the counter, then try again." : undefined,
          variant: "destructive",
        });
      } finally {
        setIsSubmittingOrder(false);
      }
    },
    [cart, branchId, sessionToken, toast]
  );

  useEffect(() => {
    if (!orderSuccess) return;
    const delay = lastOrderWaMeLink ? 15000 : 2500;
    const t = setTimeout(() => setOrderSuccess(false), delay);
    return () => clearTimeout(t);
  }, [orderSuccess, lastOrderWaMeLink]);

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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-2xl px-8 py-10 text-center max-w-sm mx-4"
            >
              <div className="text-5xl mb-3">🎉</div>
              <h3 className="text-xl font-bold text-emerald-900">Thank you!</h3>
              <p className="text-emerald-700 mt-2">Your order is on its way.</p>
              {lastOrderWaMeLink && (
                <Button
                  className="mt-4 w-full bg-[#25D366] hover:bg-[#20BD5A] text-white"
                  onClick={() => {
                    window.open(lastOrderWaMeLink!, "_blank");
                  }}
                >
                  Get invoice on WhatsApp
                </Button>
              )}
              {lastOrderId != null && (
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={async () => {
                    const url = `${API_BASE_URL}/orders/${lastOrderId}/invoice-pdf`;
                    try {
                      const res = await fetch(url, { credentials: "include" });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        toast({
                          title: "Invoice unavailable",
                          description: err?.message || "Failed to generate invoice PDF. Please try again or contact staff.",
                          variant: "destructive",
                        });
                        return;
                      }
                      const blob = await res.blob();
                      const blobUrl = URL.createObjectURL(blob);
                      window.open(blobUrl, "_blank");
                      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
                    } catch {
                      toast({
                        title: "Invoice unavailable",
                        description: "Could not load the invoice. Check your connection and try again.",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  Download PDF invoice
                </Button>
              )}
              <p className="text-sm text-muted-foreground mt-4">Scroll down to leave us a review.</p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setOrderSuccess(false)}>
                Close
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showMenu && (
        <div className="min-h-screen bg-gradient-to-br from-olive-50 via-olive-100 to-olive-200">


          {/* Header: on mobile reserve top for buttons (pt-14), then compact hero so no overlap and section not too tall */}
          <header className="relative overflow-hidden px-0 pt-14 pb-4 text-white sm:pt-8 sm:py-10">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-700 via-emerald-800 to-green-950" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_55%)]" />
            {/* Login + Raise Issue: above hero, responsive labels for all devices */}
            <div className="absolute top-3 right-3 left-3 z-20 flex flex-wrap items-center justify-end gap-2 sm:top-4 sm:right-4 sm:left-auto">
              {branchContact?.phone?.trim() && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/30 text-white bg-white/10 hover:bg-white/20 text-xs rounded-full px-3 py-2 min-h-[40px] sm:min-h-0 backdrop-blur-sm"
                  onClick={() => setContactDialogOpen(true)}
                  aria-label="Call or WhatsApp"
                >
                  <Phone className="w-4 h-4 sm:mr-1 shrink-0" />
                  <span className="hidden sm:inline">Call / WhatsApp</span>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/30 text-white bg-white/10 hover:bg-white/20 text-xs rounded-full px-3 py-2 min-h-[40px] sm:min-h-0 backdrop-blur-sm"
                onClick={() => {
                  setIssueForm((f) => ({
                    ...f,
                    name: lastCustomerName || f.name,
                    mobile: lastCustomerMobile || f.mobile,
                    orderId: lastOrderId != null ? String(lastOrderId) : f.orderId,
                  }));
                  setIssueDialogOpen(true);
                }}
                aria-label="Raise issue or need help"
              >
                <HelpCircle className="w-4 h-4 sm:mr-1 shrink-0" />
                <span className="hidden sm:inline">Raise Issue / Need Help</span>
                <span className="sm:hidden">Help</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/30 text-white bg-white/10 hover:bg-white/20 text-xs sm:text-sm rounded-full px-3 sm:px-4 py-2 min-h-[40px] sm:min-h-0 backdrop-blur-sm"
                onClick={() => navigate("/login")}
                aria-label="Staff login"
              >
                Login
              </Button>
            </div>
            {/* Full-width hero container: starts below button row so logo never overlaps */}
            <div className="relative w-full px-4 pt-1 sm:pt-0">
              <div className="flex flex-col items-center gap-2 mb-2 text-center sm:gap-3 sm:mb-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="mb-0 sm:mb-2"
                >
                  <img
                    src={branchContact?.logoUrl || cafeLogo}
                    alt=""
                    className="h-14 w-14 sm:h-24 sm:w-24 md:h-28 md:w-28 object-contain rounded-xl bg-white/15 p-1.5 sm:p-2 shadow-lg"
                    aria-hidden
                  />
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="text-2xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight drop-shadow"
                >
                  Cafe Chapter 1
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
                  className="text-xs sm:text-sm text-white/85"
                >
                  Feel the taste
                </motion.p>
              </div>

              {/* Touch-friendly: 44px min height for thumbs on phones */}
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto sm:gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-[44px] min-w-[140px] touch-manipulation bg-white/90 text-emerald-950 hover:bg-white"
                  onClick={() => window.open("tel:+917800327061")}
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
                  <DialogContent className="max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>Chapter 1 Cafe Location</DialogTitle>
                    </DialogHeader>
                    <LocationMap />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </header>

          {/* Categories - memoized so cart/dialog updates do not re-render menu (stops blink) */}
          <main className="mx-auto max-w-6xl px-4 py-8 pb-[max(12rem,calc(6rem+env(safe-area-inset-bottom)))] sm:py-10 sm:pb-10">
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

          {/* Floating Cart Summary - above browser chrome on mobile, safe area for notched phones */}
          <div className="fixed bottom-0 inset-x-0 px-4 z-40 pb-[max(1rem,calc(env(safe-area-inset-bottom)+80px))] sm:pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto max-w-md">
              <AnimatePresence>
                {cart.length > 0 && (
                  <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 80, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-2xl bg-emerald-900 text-white shadow-xl border border-emerald-700/70 px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-sm font-semibold">
                        <ShoppingBag className="w-4 h-4 shrink-0" />
                        <span>{cart.length} item{cart.length > 1 ? "s" : ""} in order</span>
                      </div>
                      <div className="text-xs text-emerald-100">
                        Total: ₹{cartTotal.toFixed(0)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="min-h-[44px] min-w-[120px] touch-manipulation shrink-0 bg-white text-emerald-900 hover:bg-emerald-50"
                      onClick={() => setCartOpen(true)}
                    >
                      View & Checkout
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Cart Drawer/Dialog - form state lives here so typing does not re-render the menu */}
          <OrderCartDialog
            open={cartOpen}
            onOpenChange={setCartOpen}
            cart={cart}
            cartTotal={cartTotal}
            incrementCartItem={incrementCartItem}
            decrementCartItem={decrementCartItem}
            removeCartItem={removeCartItem}
            onCheckout={handleCheckout}
            isSubmittingOrder={isSubmittingOrder}
            lastCustomerName={lastCustomerName}
            lastCustomerMobile={lastCustomerMobile}
          />

          {/* Contact dialog: only shown when branch has phone (button only renders then) */}
          <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Contact {branchContact?.name || "us"}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 pt-2">
                {branchContact?.phone?.trim() && (
                  <>
                    <p className="text-sm font-medium">📞 +91 {branchContact.phone.replace(/\D/g, "").slice(-10).replace(/(\d{5})(\d{5})/, "$1 $2")}</p>
                    {branchContact?.location && (
                      <p className="text-xs text-muted-foreground">📍 {branchContact.location}</p>
                    )}
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3"
                      onClick={() => {
                        const num = branchContact!.phone!.replace(/\D/g, "").slice(-10);
                        window.location.href = `tel:+91${num}`;
                      }}
                    >
                      <Phone className="w-4 h-4" />
                      Call
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 text-[#25D366] border-[#25D366] hover:bg-[#25D366]/10"
                      onClick={() => {
                        const num = branchContact!.phone!.replace(/\D/g, "").slice(-10);
                        window.open(`https://wa.me/91${num}`, "_blank");
                      }}
                    >
                      <MessageCircle className="w-4 h-4" />
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
                onSubmit={async (e) => {
                  e.preventDefault();
                  const mobile = issueForm.mobile.replace(/\D/g, "").slice(-10);
                  if (mobile.length !== 10) {
                    toast({ title: "Invalid mobile", description: "Enter a valid 10-digit number", variant: "destructive" });
                    return;
                  }
                  setIssueSubmitting(true);
                  try {
                    const res = await fetch(`${apiBase}/customer-queries`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
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
                      throw new Error(err.message || "Failed to submit");
                    }
                    const submittedName = issueForm.name.trim() || "there";
                    setIssueDialogOpen(false);
                    setIssueForm({ name: "", mobile: "", orderId: "", issueType: "OTHER", message: "" });
                    toast({
                      title: `Thank you, ${submittedName}!`,
                      description: "We've received your query and will get back to you soon. You can continue browsing the menu below.",
                    });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } catch (err) {
                    toast({ title: "Error", description: err instanceof Error ? err.message : "Could not submit", variant: "destructive" });
                  } finally {
                    setIssueSubmitting(false);
                  }
                }}
              >
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Name *</label>
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={issueForm.name}
                    onChange={(e) => setIssueForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Your name"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Mobile (10 digits) *</label>
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={issueForm.mobile}
                    onChange={(e) => setIssueForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                    placeholder="9876543210"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Order ID (optional)</label>
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    type="text"
                    inputMode="numeric"
                    value={issueForm.orderId}
                    onChange={(e) => setIssueForm((f) => ({ ...f, orderId: e.target.value.replace(/\D/g, "") }))}
                    placeholder="e.g. 1"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Issue type *</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={issueForm.issueType}
                    onChange={(e) => setIssueForm((f) => ({ ...f, issueType: e.target.value }))}
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
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                    value={issueForm.message}
                    onChange={(e) => setIssueForm((f) => ({ ...f, message: e.target.value }))}
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
                    "Submit"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* --- Other Outlets (uniform cards, similar width to category cards) --- */}
          <div className="flex flex-col items-center mb-12">
            <span className="text-lg md:text-2xl font-bold text-orange-400 mb-3 tracking-wide drop-shadow">
              Green Park, Gautam Nagar, New Delhi
            </span>
            <div className="w-full max-w-5xl px-4 grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6">
              {/* Yusuf Sarai - Swiggy */}
              <a
                href="https://www.swiggy.com/restaurants/cafe-chapter-1-south-extension-south-extension-729152/dineout"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full flex-col items-center bg-white/90 rounded-2xl shadow-lg px-5 py-4 hover:scale-105 hover:shadow-2xl transition-all duration-300 group"
                aria-label="Order from Swiggy Yusuf Sarai"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/1/13/Swiggy_logo.png"
                  alt="Swiggy"
                  className="w-16 h-16 object-contain mb-2 group-hover:scale-110 transition"
                />
                <span className="text-base md:text-lg font-bold" style={{ color: "#FC8019" }}>
                  Swiggy
                </span>
                <span className="text-xs text-gray-600 text-center mt-1">
                  Yusuf Sarai, New Delhi
                </span>
                <button className="mt-3 px-4 py-1 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 text-white font-semibold shadow hover:scale-105 transition">
                  Order Now
                </button>
              </a>
              {/* Yusuf Sarai - Zomato */}
              <a
                href="https://www.zomato.com/ncr/chapter-1-qutab-institutional-area-new-delhi/order"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full flex-col items-center bg-white/90 rounded-2xl shadow-lg px-5 py-4 hover:scale-105 hover:shadow-2xl transition-all duration-300 group"
                aria-label="Order from Zomato Yusuf Sarai"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/7/75/Zomato_logo.png"
                  alt="Zomato"
                  className="w-16 h-16 object-contain mb-2 group-hover:scale-110 transition"
                />
                <span className="text-base md:text-lg font-bold" style={{ color: "#E23744" }}>
                  Zomato
                </span>
                <span className="text-xs text-gray-600 text-center mt-1">
                  Yusuf Sarai, New Delhi
                </span>
                <button className="mt-3 px-4 py-1 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 text-white font-semibold shadow hover:scale-105 transition">
                  Order Now
                </button>
              </a>
              {/* Yusuf Sarai - Magicpin */}
              <a
                href="https://magicpin.in/New-delhi/Yusuf-sarai/Restaurant/Cafe-chapter-1/store/155b58c/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full flex-col items-center bg-white/90 rounded-2xl shadow-lg px-5 py-4 hover:scale-105 hover:shadow-2xl transition-all duration-300 group"
                aria-label="Order from Magicpin Yusuf Sarai"
              >
                <img
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTL3vawke4UFzJcg65Wy2KAKTmYwqHlbPf6HA&s"
                  alt="Magicpin"
                  className="w-16 h-16 object-contain mb-2 group-hover:scale-110 transition"
                />
                <span className="text-base md:text-lg font-bold" style={{ color: "#6C47FF" }}>
                  Magicpin
                </span>
                <span className="text-xs text-gray-600 text-center mt-1">
                  Yusuf Sarai, New Delhi
                </span>
                <button className="mt-3 px-4 py-1 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold shadow hover:scale-105 transition">
                  Order Now
                </button>
              </a>
            </div>
          </div>


          {/* --- Google Review and Instagram (Side by Side & Responsive, uniform cards) --- */}
          <div ref={reviewSectionRef} id="google-review" className="flex flex-col md:flex-row items-center justify-center gap-8 mb-12 w-full max-w-4xl px-4 mx-auto">
            {/* Google Review */}
            <a
              href="https://g.page/r/CekUwwDsaYMBEAE/review"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full flex-col items-center bg-white/90 rounded-2xl shadow-lg px-5 py-4 hover:scale-105 hover:shadow-2xl transition-all duration-300 group w-full md:w-80 mb-6 md:mb-0"
              aria-label="Google Review"
            >
              <img
                src="https://www.seekpng.com/png/detail/351-3512666_googlereview-logo-gray-google-logo-250-x-250.png"
                alt="Google Logo"
                className="w-50 h-20 mb-2 group-hover:scale-110 transition"
              />
              <span className="text-base md:text-lg font-bold text-orange-500">
                Google Feedback
              </span>
              <span className="text-xs text-gray-600 text-center mt-1">
                Share your experience with us!
              </span>
            </a>
            {/* Instagram */}
            <a
              href="https://www.instagram.com/cafe_chapter_1?igsh=bjVsemUzZWkybzRz&utm_source=qr"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full flex-col items-center bg-white/90 rounded-2xl shadow-lg px-5 py-4 hover:scale-105 hover:shadow-2xl transition-all duration-300 group w-full md:w-80"
              aria-label="Follow us on Instagram"
            >
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png"
                alt="Instagram"
                className="w-16 h-16 mb-2 group-hover:scale-110 transition"
              />
              <span className="text-base md:text-lg font-bold" style={{ color: "#E1306C" }}>
                @cafe_chapter_1
              </span>
              <span className="text-xs text-gray-600 text-center mt-1 max-w-xs">
                We announce new items and offers on Instagram first!
                <br />
                <span className="font-semibold text-orange-500">
                  Follow us for more &amp; exciting outlet offers!
                </span>
              </span>
            </a>
          </div>

          {/* --- Qutab Institutional Area (Main Outlet, uniform cards) --- */}
          <div className="flex flex-col items-center mb-12">
            <span className="text-lg md:text-2xl font-bold text-olive-700 mb-3 tracking-wide drop-shadow">
              Order from Our Other Outlets
            </span>
            <div className="w-full max-w-5xl px-4 grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6">
              {/* Zomato */}
              <a
                href="https://www.zomato.com/ncr/chapter-1-qutab-institutional-area-new-delhi/order"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full flex-col items-center bg-white/90 rounded-2xl shadow-lg px-5 py-4 hover:scale-105 hover:shadow-2xl transition-all duration-300 group"
                aria-label="Order from Zomato"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/7/75/Zomato_logo.png"
                  alt="Zomato"
                  className="w-16 h-16 object-contain mb-2 group-hover:scale-110 transition"
                />
                <span className="text-base md:text-lg font-bold" style={{ color: "#E23744" }}>
                  Zomato
                </span>
                <span className="text-xs text-gray-600 text-center mt-1">
                  Qutab Institutional Area, New Delhi
                </span>
                <button className="mt-3 px-4 py-1 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 text-white font-semibold shadow hover:scale-105 transition">
                  Order Now
                </button>
              </a>
              {/* Swiggy */}
              <a
                href="https://www.swiggy.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full flex-col items-center bg-white/90 rounded-2xl shadow-lg px-5 py-4 hover:scale-105 hover:shadow-2xl transition-all duration-300 group"
                aria-label="Order from Swiggy"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/1/13/Swiggy_logo.png"
                  alt="Swiggy"
                  className="w-16 h-16 object-contain mb-2 group-hover:scale-110 transition"
                />
                <span className="text-base md:text-lg font-bold" style={{ color: "#FC8019" }}>
                  Swiggy
                </span>
                <span className="text-xs text-gray-600 text-center mt-1">
                  Qutab Institutional Area, New Delhi
                </span>
                <button className="mt-3 px-4 py-1 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 text-white font-semibold shadow hover:scale-105 transition">
                  Order Now
                </button>
              </a>
              {/* Magicpin */}
              <a
                href="https://magicpin.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full flex-col items-center bg-white/90 rounded-2xl shadow-lg px-5 py-4 hover:scale-105 hover:shadow-2xl transition-all duration-300 group"
                aria-label="Order from Magicpin"
              >
                <img
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTL3vawke4UFzJcg65Wy2KAKTmYwqHlbPf6HA&s"
                  alt="Magicpin"
                  className="w-16 h-16 object-contain mb-2 group-hover:scale-110 transition"
                />
                <span className="text-base md:text-lg font-bold" style={{ color: "#6C47FF" }}>
                  Magicpin
                </span>
                <span className="text-xs text-gray-600 text-center mt-1">
                  Qutab Institutional Area, New Delhi
                </span>
                <button className="mt-3 px-4 py-1 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold shadow hover:scale-105 transition">
                  Order Now
                </button>
              </a>
            </div>
          </div>

           

          {/* Footer */}
          <div className="text-center py-8 text-olive-700">
            <p className="text-lg font-light">Scan QR code for quick access to our digital menu</p>
            <p className="text-sm mt-2">Call us: +91 7800327061</p>
          </div>
        </div>
      )}
    </>
  );
};

export default Index;