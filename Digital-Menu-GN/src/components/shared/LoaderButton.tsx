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
  onClick,
  type,
  ...props
}: LoaderButtonProps) {
  return (
    <Button
      disabled={disabled || loading}
      className={cn(className)}
      type={type}
      onClick={e => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        // Some layouts (overlays, pointer-capture, etc.) can interfere with normal submit bubbling.
        // For submit buttons, explicitly trigger the nearest form submit on click.
        if ((type ?? 'button') !== 'submit') return;
        const el = e.currentTarget as HTMLElement;
        const form = el.closest('form') as HTMLFormElement | null;
        form?.requestSubmit?.();
      }}
      {...props}
    >
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
