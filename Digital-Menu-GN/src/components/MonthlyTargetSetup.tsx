import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type MonthlyTargetInfo = {
  yearMonth: string;
  monthLabel: string;
  targetSet: boolean;
  targetAmount?: number;
  achievedAmount?: number;
  achievedPct?: number;
  daysLeft?: number;
  status?: "ON_TRACK" | "NEED_TO_PUSH" | "CRITICAL";
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
    info?.status === "ON_TRACK"
      ? "✓ ON TRACK"
      : info?.status === "NEED_TO_PUSH"
        ? "⚠️ NEED TO PUSH"
        : info?.status === "CRITICAL"
          ? "🔴 CRITICAL"
          : info?.targetSet
            ? "—"
            : "Target not set";

  return (
    <Card className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      <CardHeader className="px-3 sm:px-6 pb-2">
        <CardTitle className="text-lg">Set Monthly Sales Target</CardTitle>
        <CardDescription>
          Define the target once and daily emails will track achievement automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Month
            </p>
            <p className="text-base font-semibold text-slate-900 mt-0.5">
              {info?.monthLabel || info?.yearMonth || "Current month"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Current Target
            </p>
            <p className="text-base font-semibold text-slate-900 mt-0.5">
              {info?.targetSet ? formatINR(info.targetAmount || 0) : "Not set"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Achieved
            </p>
            <p className="text-base font-semibold text-slate-900 mt-0.5">
              {info?.targetSet
                ? `${formatINR(info.achievedAmount || 0)} (${Math.round((info.achievedPct || 0) * 10) / 10}%)`
                : "Target not set"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Status
            </p>
            <p className="text-base font-semibold text-slate-900 mt-0.5">
              {statusLabel}
            </p>
            {info?.targetSet ? (
              <p className="text-xs text-muted-foreground mt-1">
                {info.daysLeft ?? 0} day(s) left
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Input
            type="number"
            min={0}
            step="1"
            placeholder="Target amount (e.g. 100000)"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            className="sm:max-w-xs"
          />
          <Button onClick={onSave} disabled={!inputValue.trim() || saving}>
            {saving ? "Saving..." : "Set Target"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
