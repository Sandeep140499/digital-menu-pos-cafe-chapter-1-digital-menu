import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  loadingLabel = 'Please wait...',
  disabled,
  children,
  className,
  ...props
}: LoaderButtonProps) {
  return (
    <Button disabled={disabled || loading} className={cn(className)} {...props}>
      {loading ? (
        <>
          <span
            className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
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
