import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LoaderButtonProps = ButtonProps & {
  loading?: boolean;
  loadingLabel?: string;
};

/**
 * Button with loading state – use everywhere for Create/Update/Send actions.
 * Prevents double submit and shows consistent loader UI.
 */
export function LoaderButton({
  loading = false,
  loadingLabel = "Please wait...",
  disabled,
  children,
  className,
  ...props
}: LoaderButtonProps) {
  return (
    <Button
      disabled={disabled || loading}
      className={cn(className)}
      {...props}
    >
      {loading ? (
        <>
          <span
            className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
            aria-hidden
          />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
