import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageLoaderProps {
  loading?: boolean;
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Full page loading component
 * Shows spinner with optional text
 */
export function PageLoader({ 
  loading = true, 
  text = 'Loading...', 
  size = 'md',
  className 
}: PageLoaderProps) {
  if (!loading) return null;

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-8 space-y-4",
      className
    )}>
      <Loader2 className={cn("animate-spin text-primary", sizeClasses[size])} />
      {text && (
        <p className="text-muted-foreground text-sm animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}

/**
 * Inline loader for cards and sections
 */
export function InlineLoader({ 
  loading = true, 
  text = 'Loading...',
  className 
}: Omit<PageLoaderProps, 'size'>) {
  if (!loading) return null;

  return (
    <div className={cn(
      "flex items-center justify-center p-4 space-x-2",
      className
    )}>
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      {text && (
        <span className="text-muted-foreground text-sm">
          {text}
        </span>
      )}
    </div>
  );
}

/**
 * Skeleton loader for data cards
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 space-y-4", className)}>
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
        <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-8 bg-muted rounded w-1/4 animate-pulse" />
        <div className="h-3 bg-muted rounded w-full animate-pulse" />
      </div>
    </div>
  );
}
