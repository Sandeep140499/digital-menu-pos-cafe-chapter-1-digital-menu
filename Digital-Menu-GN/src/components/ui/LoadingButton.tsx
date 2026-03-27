import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { Button } from './button';
import { Loader2 } from 'lucide-react';

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

/**
 * Button component with built-in loading state
 * Shows spinner and disables button when loading
 */
const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ loading = false, loadingText = 'Loading...', children, disabled, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        disabled={disabled || loading}
        className={className}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? loadingText : children}
      </Button>
    );
  }
);

LoadingButton.displayName = 'LoadingButton';

export { LoadingButton };
