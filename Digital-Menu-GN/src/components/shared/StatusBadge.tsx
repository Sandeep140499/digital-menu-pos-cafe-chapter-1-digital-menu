import { Badge } from "@/components/ui/badge";
import { STATUS_STYLES } from "@/constants/theme";
import { cn } from "@/lib/utils";

type StatusKey = keyof typeof STATUS_STYLES;

export type StatusBadgeProps = {
  status: StatusKey | string;
  className?: string;
};

/**
 * Consistent status badge – same colors everywhere (Active / Inactive / Left).
 * Uses theme constants so you can customize in one place.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status as StatusKey] ?? {
    variant: "secondary" as const,
    className: "bg-muted text-muted-foreground",
  };
  const label =
    status === "ACTIVE" ? "Active" : status === "INACTIVE" ? "Inactive" : status === "LEFT" ? "Left" : status;
  return (
    <Badge
      variant={style.variant}
      className={cn(style.className, "text-xs", className)}
    >
      {status === "ACTIVE" ? "🟢 " : ""}{label}
    </Badge>
  );
}
