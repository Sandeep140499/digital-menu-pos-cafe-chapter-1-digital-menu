import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, Plus, Trash2, RefreshCw, MessageCircle, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { readApiErrorMessage } from '@/constants';

type MenuCategory = {
  id: number;
  name: string;
  items: Array<{
    id: number;
    name: string;
    basePrice: number;
    halfPrice?: number | null;
    hasHalf?: boolean;
    categoryId?: number | null;
  }>;
};

type HappyHourRow = {
  id: number;
  name: string;
  discountPercent: number;
  dateStart: string;
  dateEnd: string;
  timeStart: string;
  timeEnd: string;
  daysOfWeek?: unknown;
  status: string;
  applyMode: string;
  notificationPref: string;
  notificationStatus: string;
  sentAt?: string | null;
  notifyAudience?: string | null;
  categoryLinks: { categoryId: number }[];
  itemLinks: { menuItemId: number }[];
  excludedItemLinks: { menuItemId: number }[];
};

const WEEK = [
  { v: 0, l: 'Sun' },
  { v: 1, l: 'Mon' },
  { v: 2, l: 'Tue' },
  { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' },
  { v: 5, l: 'Fri' },
  { v: 6, l: 'Sat' },
];

function prismaDateToInput(d: string | Date): string {
  const s = typeof d === 'string' ? d : d.toISOString();
  return s.slice(0, 10);
}

type ToastFn = (p: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;

export function HappyHoursAdminSection({
  apiBase,
  token,
  toast,
}: {
  apiBase: string;
  token: string | null;
  toast: ToastFn;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offers, setOffers] = useState<HappyHourRow[]>([]);
  const [menuCats, setMenuCats] = useState<MenuCategory[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [lastBroadcast, setLastBroadcast] = useState<{
    message: string;
    mobileCount: number;
    waMeLinks: string[];
  } | null>(null);

  const [name, setName] = useState('');
  const [discount, setDiscount] = useState(15);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [timeStart, setTimeStart] = useState('13:00');
  const [timeEnd, setTimeEnd] = useState('17:00');
  const [days, setDays] = useState<number[]>([]);
  const [applyMode, setApplyMode] = useState<'ALL_ITEMS' | 'CATEGORIES' | 'ITEMS'>('ALL_ITEMS');
  const [selectedCats, setSelectedCats] = useState<number[]>([]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [excludedItems, setExcludedItems] = useState<number[]>([]);
  const [notifPref, setNotifPref] = useState<'NONE' | 'SEND_ON_CREATE' | 'SEND_MANUAL'>('NONE');
  const [audience, setAudience] = useState<'ALL_CUSTOMERS' | 'LEADERS' | 'SELECTED'>('ALL_CUSTOMERS');
  const [selectedMobilesText, setSelectedMobilesText] = useState('');
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);

  const flatItems = useMemo(() => {
    const out: { id: number; name: string; categoryId: number; categoryName: string }[] = [];
    for (const c of menuCats) {
      for (const it of c.items || []) {
        out.push({
          id: it.id,
          name: it.name,
          categoryId: c.id,
          categoryName: c.name,
        });
      }
    }
    return out;
  }, [menuCats]);

  const itemsInSelectedCategories = useMemo(() => {
    const set = new Set(selectedCats);
    return flatItems.filter(i => set.has(i.categoryId));
  }, [flatItems, selectedCats]);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [hRes, mRes] = await Promise.all([
        fetch(`${apiBase}/happy-hours`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBase}/menu/admin`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (hRes.ok) {
        const j = await hRes.json();
        setOffers(Array.isArray(j.happyHours) ? j.happyHours : []);
      }
      if (mRes.ok) {
        setMenuCats(await mRes.json());
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load Happy Hour data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [apiBase, token, toast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const resetForm = () => {
    setName('');
    setDiscount(15);
    const t = new Date();
    const ymd = t.toISOString().slice(0, 10);
    setDateStart(ymd);
    setDateEnd(ymd);
    setTimeStart('13:00');
    setTimeEnd('17:00');
    setDays([]);
    setApplyMode('ALL_ITEMS');
    setSelectedCats([]);
    setSelectedItems([]);
    setExcludedItems([]);
    setNotifPref('NONE');
    setAudience('ALL_CUSTOMERS');
    setSelectedMobilesText('');
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const toggleDay = (v: number) => {
    setDays(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v].sort((a, b) => a - b)));
  };

  const toggleCat = (id: number) => {
    setSelectedCats(prev => (prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]));
  };

  const togglePickItem = (id: number) => {
    setSelectedItems(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const toggleExcluded = (id: number) => {
    setExcludedItems(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const parseMobiles = (text: string) =>
    text
      .split(/[\s,;\n]+/)
      .map(s => s.replace(/\D/g, '').slice(-10))
      .filter(m => m.length === 10 && /^[6-9]/.test(m));

  const handleCreate = async () => {
    if (!token) return;
    if (!name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    if (notifPref === 'SEND_ON_CREATE') {
      setSendConfirmOpen(true);
      return;
    }
    await submitCreate();
  };

  const submitCreate = async () => {
    if (!token) return;
    setSaving(true);
    setSendConfirmOpen(false);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        discountPercent: discount,
        dateStart,
        dateEnd,
        timeStart,
        timeEnd,
        daysOfWeek: days.length ? days : null,
        status: 'ACTIVE',
        applyMode,
        categoryIds: applyMode === 'CATEGORIES' ? selectedCats : [],
        itemIds: applyMode === 'ITEMS' ? selectedItems : [],
        excludedItemIds: applyMode === 'CATEGORIES' ? excludedItems : [],
        notificationPref: notifPref,
        notifyAudience: notifPref === 'NONE' ? null : audience,
        selectedMobiles: audience === 'SELECTED' ? parseMobiles(selectedMobilesText) : [],
      };
      const res = await fetch(`${apiBase}/happy-hours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const msg = await readApiErrorMessage(res);
        throw new Error(msg);
      }
      const data = await res.json();
      setCreateOpen(false);
      toast({ title: 'Offer created', description: `${name.trim()} is saved and active dates apply automatically.` });
      if (data.broadcast?.mobileCount != null) {
        setLastBroadcast({
          message: data.broadcast.message,
          mobileCount: data.broadcast.mobileCount,
          waMeLinks: data.broadcast.waMeLinks || [],
        });
        setBroadcastOpen(true);
      }
      await loadAll();
    } catch (e) {
      toast({
        title: 'Could not create offer',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const loadLeadersIntoTextarea = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/orders/customer-leaderboard?limit=500`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const j = await res.json();
      const rows = Array.isArray(j.leaderboard) ? j.leaderboard : [];
      const nums = rows.map((r: { customerMobile?: string }) => r.customerMobile).filter(Boolean);
      setSelectedMobilesText(nums.join('\n'));
      setAudience('SELECTED');
      toast({ title: 'Leaderboard loaded', description: `${nums.length} numbers added to the list.` });
    } catch {
      toast({ title: 'Error', description: 'Could not load leaderboard.', variant: 'destructive' });
    }
  };

  const patchStatus = async (id: number, status: 'ACTIVE' | 'INACTIVE') => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/happy-hours/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      toast({ title: status === 'ACTIVE' ? 'Activated' : 'Paused' });
      await loadAll();
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e instanceof Error ? e.message : '',
        variant: 'destructive',
      });
    }
  };

  const sendManual = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/happy-hours/${id}/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await res.json();
      if (data.broadcast) {
        setLastBroadcast({
          message: data.broadcast.message,
          mobileCount: data.broadcast.mobileCount,
          waMeLinks: data.broadcast.waMeLinks || [],
        });
        setBroadcastOpen(true);
      }
      toast({ title: 'WhatsApp links ready', description: 'Use the sample links or message text for each customer.' });
      await loadAll();
    } catch (e) {
      toast({
        title: 'Send failed',
        description: e instanceof Error ? e.message : '',
        variant: 'destructive',
      });
    }
  };

  const deleteOffer = async (id: number) => {
    if (!token) return;
    if (!window.confirm('Delete this offer permanently?')) return;
    try {
      const res = await fetch(`${apiBase}/happy-hours/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204) throw new Error(await readApiErrorMessage(res));
      toast({ title: 'Deleted' });
      await loadAll();
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : '',
        variant: 'destructive',
      });
    }
  };

  if (!token) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-2 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Sparkles className="h-7 w-7 text-amber-500" />
            Happy Hour Offers
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Schedule percentage discounts by date, time, and menu scope. Customer menu highlights eligible dishes
            automatically. WhatsApp uses pre-filled links (wa.me) — open each link to send; there is no paid API in
            this build.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadAll()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button type="button" size="sm" className="bg-amber-600 text-white hover:bg-amber-700" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New offer
          </Button>
        </div>
      </div>

      <Card className="border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">How it works</CardTitle>
          <CardDescription>
            Overlapping offers apply the highest discount per item. Category mode includes every item in selected
            categories; uncheck items below to exclude them. Prices lock when the customer adds items to the cart.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active & scheduled offers</CardTitle>
          <CardDescription>Pause an offer to hide it from customers immediately.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : offers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No offers yet. Create one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell>{Math.round(o.discountPercent)}%</TableCell>
                    <TableCell className="whitespace-nowrap text-xs sm:text-sm">
                      {prismaDateToInput(o.dateStart)} → {prismaDateToInput(o.dateEnd)}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">
                      {o.timeStart}–{o.timeEnd}
                    </TableCell>
                    <TableCell>
                      <Badge variant={o.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {o.status === 'ACTIVE' ? 'Active' : 'Paused'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{o.notificationStatus}</span>
                      {o.notificationPref === 'SEND_MANUAL' && o.notificationStatus === 'PENDING' && (
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto px-1 py-0 text-xs"
                          onClick={() => void sendManual(o.id)}
                        >
                          Send now
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => patchStatus(o.id, o.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
                        >
                          {o.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => void deleteOffer(o.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Happy Hour offer</DialogTitle>
            <DialogDescription>
              Set when the discount is valid (branch timezone). Choose menu scope and optional WhatsApp outreach.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="hh-name">Offer name</Label>
              <Input id="hh-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lunch Rush" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Discount %</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={discount}
                  onChange={e => setDiscount(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Dates</Label>
                <div className="flex gap-2">
                  <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
                  <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start time</Label>
                <Input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End time</Label>
                <Input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Days (leave empty for every day)</Label>
              <div className="flex flex-wrap gap-2">
                {WEEK.map(d => (
                  <label key={d.v} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={days.includes(d.v)} onCheckedChange={() => toggleDay(d.v)} />
                    {d.l}
                  </label>
                ))}
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Apply to</Label>
              <RadioGroup
                value={applyMode}
                onValueChange={v => setApplyMode(v as typeof applyMode)}
                className="grid gap-2"
              >
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 hover:bg-slate-50">
                  <RadioGroupItem value="ALL_ITEMS" id="m-all" />
                  <span className="text-sm font-medium">All menu items</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 hover:bg-slate-50">
                  <RadioGroupItem value="CATEGORIES" id="m-cat" />
                  <span className="text-sm font-medium">Selected categories (exclude individual dishes below)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 hover:bg-slate-50">
                  <RadioGroupItem value="ITEMS" id="m-it" />
                  <span className="text-sm font-medium">Hand-picked items only</span>
                </label>
              </RadioGroup>
            </div>
            {applyMode === 'CATEGORIES' && (
              <ScrollArea className="h-40 rounded-md border p-3">
                <div className="space-y-2">
                  {menuCats.map(c => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={selectedCats.includes(c.id)} onCheckedChange={() => toggleCat(c.id)} />
                      {c.name}
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
            {applyMode === 'CATEGORIES' && selectedCats.length > 0 && (
              <div className="space-y-2">
                <Label>Uncheck dishes to exclude from this offer</Label>
                <ScrollArea className="h-48 rounded-md border p-3">
                  <div className="space-y-2">
                    {itemsInSelectedCategories.map(it => (
                      <label key={it.id} className="flex items-start gap-2 text-sm">
                        <Checkbox
                          checked={!excludedItems.includes(it.id)}
                          onCheckedChange={() => toggleExcluded(it.id)}
                        />
                        <span>
                          <span className="font-medium">{it.name}</span>
                          <span className="text-muted-foreground block text-xs">{it.categoryName}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            {applyMode === 'ITEMS' && (
              <ScrollArea className="h-56 rounded-md border p-3">
                <div className="space-y-2">
                  {flatItems.map(it => (
                    <label key={it.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={selectedItems.includes(it.id)} onCheckedChange={() => togglePickItem(it.id)} />
                      <span className="min-w-0">
                        {it.name}{' '}
                        <span className="text-muted-foreground text-xs">({it.categoryName})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
            <Separator />
            <div className="space-y-3 rounded-xl border border-amber-200/80 bg-amber-50/40 p-4">
              <div className="flex items-center gap-2 font-semibold text-amber-950">
                <MessageCircle className="h-4 w-4" />
                WhatsApp (wa.me links)
              </div>
              <RadioGroup
                value={notifPref}
                onValueChange={v => setNotifPref(v as typeof notifPref)}
                className="grid gap-2"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="NONE" id="n-none" />
                  Do not prepare messages
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="SEND_ON_CREATE" id="n-now" />
                  Prepare links immediately after creating this offer
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="SEND_MANUAL" id="n-later" />
                  Prepare links later (use “Send now” on the offer row)
                </label>
              </RadioGroup>
              {notifPref !== 'NONE' && (
                <>
                  <Label className="pt-1">Audience</Label>
                  <RadioGroup
                    value={audience}
                    onValueChange={v => setAudience(v as typeof audience)}
                    className="grid gap-2"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="ALL_CUSTOMERS" id="a-all" />
                      All customers (distinct numbers from past orders)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="LEADERS" id="a-lead" />
                      Leaderboard customers (top spenders / order counts)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="SELECTED" id="a-sel" />
                      Selected numbers (paste below)
                    </label>
                  </RadioGroup>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={() => void loadLeadersIntoTextarea()}>
                        Load leaderboard numbers into list
                      </Button>
                    </div>
                    <textarea
                      className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[100px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      placeholder="One mobile per line (10 digits, Indian format)"
                      value={selectedMobilesText}
                      onChange={e => setSelectedMobilesText(e.target.value)}
                    />
                    <p className="text-muted-foreground text-xs">
                      For “Selected numbers”, paste mobiles here. For other audiences, this list is ignored unless
                      you still want to keep a copy.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => void handleCreate()}
            >
              {saving ? 'Saving…' : 'Create offer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send WhatsApp preparation?</DialogTitle>
            <DialogDescription>
              You are about to create this offer and generate personalized wa.me links. This does not auto-send through a
              business API — you open each link to send from your WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSendConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitCreate()} disabled={saving}>
              Confirm & create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              WhatsApp message ready
            </DialogTitle>
            <DialogDescription>
              {lastBroadcast?.mobileCount ?? 0} customers match this audience. Sample links (first 5):
            </DialogDescription>
          </DialogHeader>
          {lastBroadcast && (
            <div className="space-y-3">
              <div className="rounded-md bg-slate-50 p-3 text-xs whitespace-pre-wrap">{lastBroadcast.message}</div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  void navigator.clipboard.writeText(lastBroadcast.message);
                  toast({ title: 'Copied', description: 'Message text copied to clipboard.' });
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy message text
              </Button>
              <ScrollArea className="max-h-40 rounded-md border">
                <ul className="divide-y p-2 text-xs">
                  {lastBroadcast.waMeLinks.map((link, i) => (
                    <li key={i} className="py-2">
                      <a href={link} className="text-emerald-700 underline break-all" target="_blank" rel="noreferrer">
                        Open WhatsApp {i + 1}
                      </a>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setBroadcastOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
