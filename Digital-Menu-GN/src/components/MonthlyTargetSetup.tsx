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

  const statusBoxClass =
    info?.status === 'CRITICAL'
      ? 'border-red-300 bg-red-50 text-red-900'
      : info?.status === 'NEED_TO_PUSH'
        ? 'border-amber-300 bg-amber-50 text-amber-950'
        : info?.status === 'ON_TRACK'
          ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
          : 'border-slate-200 bg-white text-slate-900';

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
          <div className={`rounded-lg border px-3 py-2.5 ${statusBoxClass}`}>
            <p className="text-[11px] font-bold tracking-wide uppercase opacity-80">Status</p>
            <p className="mt-0.5 text-base font-bold">{statusLabel}</p>
            {info?.targetSet ? (
              <p className="mt-1 text-xs opacity-90">{info.daysLeft ?? 0} day(s) left</p>
            ) : null}
          </div>
        </div>
        {info?.targetSet ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-800">
            <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
              To reach goal (paid sales, linear pace)
            </p>
            {(() => {
              const targetAmt = info.targetAmount ?? 0;
              const achievedAmt = info.achievedAmount ?? 0;
              const remaining = Math.max(0, targetAmt - achievedAmt);
              const dLeft = info.daysLeft ?? 0;
              const daily =
                remaining <= 0 ? null : dLeft > 0 ? remaining / dLeft : remaining;
              if (remaining <= 0) {
                return (
                  <p className="font-semibold text-emerald-700">Target met for this month.</p>
                );
              }
              if (daily != null && Number.isFinite(daily)) {
                return (
                  <p>
                    Aim about{' '}
                    <span className="font-bold tabular-nums text-slate-900">
                      {formatINR(Math.ceil(daily))}
                    </span>{' '}
                    per day on average over the next{' '}
                    <span className="font-semibold">{dLeft > 0 ? dLeft : 1}</span> day
                    {dLeft === 1 ? '' : 's'}.
                  </p>
                );
              }
              return null;
            })()}
          </div>
        ) : null}
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
