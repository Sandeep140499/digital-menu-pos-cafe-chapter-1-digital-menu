import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export type MonthlyTargetInfo = {
  yearMonth: string;
  monthLabel: string;
  targetSet: boolean;
  targetAmount?: number;
  achievedAmount?: number;
  achievedPct?: number;
  daysLeft?: number;
  status?: 'ON_TRACK' | 'NEED_TO_PUSH' | 'CRITICAL';
};

type Props = {
  info: MonthlyTargetInfo | null;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  formatINR: (n: number) => string;
};

export default function MonthlyTargetSetup({
  info,
  inputValue,
  onInputChange,
  onSave,
  saving,
  formatINR,
}: Props) {
  const statusLabel =
    info?.status === 'ON_TRACK'
      ? '✓ ON TRACK'
      : info?.status === 'NEED_TO_PUSH'
        ? '⚠️ NEED TO PUSH'
        : info?.status === 'CRITICAL'
          ? '🔴 CRITICAL'
          : info?.targetSet
            ? '—'
            : 'Target not set';

  return (
    <Card className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      <CardHeader className="px-3 pb-2 sm:px-6">
        <CardTitle className="text-lg">Set Monthly Sales Target</CardTitle>
        <CardDescription>
          Define the target once and daily emails will track achievement automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-3 pb-6 sm:px-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Month
            </p>
            <p className="mt-0.5 text-base font-semibold text-slate-900">
              {info?.monthLabel || info?.yearMonth || 'Current month'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Current Target
            </p>
            <p className="mt-0.5 text-base font-semibold text-slate-900">
              {info?.targetSet ? formatINR(info.targetAmount || 0) : 'Not set'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Achieved
            </p>
            <p className="mt-0.5 text-base font-semibold text-slate-900">
              {info?.targetSet
                ? `${formatINR(info.achievedAmount || 0)} (${Math.round((info.achievedPct || 0) * 10) / 10}%)`
                : 'Target not set'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Status
            </p>
            <p className="mt-0.5 text-base font-semibold text-slate-900">{statusLabel}</p>
            {info?.targetSet ? (
              <p className="text-muted-foreground mt-1 text-xs">{info.daysLeft ?? 0} day(s) left</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="e.g. 500000"
            value={inputValue}
            onChange={e => onInputChange(e.target.value)}
            className="sm:max-w-xs border-slate-300 bg-white text-base text-slate-900 shadow-sm placeholder:text-slate-500 dark:border-slate-300 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-500"
            aria-label="Monthly sales target amount"
          />
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Set target'}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Enter amount in rupees (numbers only), then click Set target. Use Revenue → refresh if
          progress does not update.
        </p>
      </CardContent>
    </Card>
  );
}
