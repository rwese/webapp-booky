import React from 'react';
import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-pulse',
    none: '',
  };

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      className={clsx(
        'bg-gray-200 dark:bg-gray-700',
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={style}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// Skeleton for card components
interface SkeletonCardProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
}

export function SkeletonCard({ variant = 'rounded' }: SkeletonCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="space-y-4">
        {/* Cover image placeholder */}
        <Skeleton
          variant={variant}
          width="100%"
          height="200px"
          className="mb-4"
        />
        
        {/* Title placeholder */}
        <Skeleton width="80%" height="20px" />
        
        {/* Author placeholder */}
        <Skeleton width="60%" height="16px" />
        
        {/* Rating placeholder */}
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="circular" width="16px" height="16px" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Skeleton for list items
export function SkeletonListItem() {
  return (
    <div className="flex gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <Skeleton variant="rectangular" width="80px" height="112px" />
      <div className="flex-1 space-y-3">
        <Skeleton width="70%" height="20px" />
        <Skeleton width="50%" height="16px" />
        <Skeleton width="40%" height="14px" />
        <div className="flex gap-2">
          <Skeleton width="80px" height="24px" />
          <Skeleton width="60px" height="24px" />
        </div>
      </div>
    </div>
  );
}

// Skeleton for statistics cards
export function SkeletonStatCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton width="60px" height="14px" />
          <Skeleton width="80px" height="32px" />
        </div>
        <Skeleton variant="circular" width="48px" height="48px" />
      </div>
    </div>
  );
}

// Skeleton for forms
export function SkeletonFormField() {
  return (
    <div className="space-y-2">
      <Skeleton width="120px" height="16px" />
      <Skeleton width="100%" height="44px" />
    </div>
  );
}

// Skeleton for table rows
export function SkeletonTableRow() {
  return (
    <div className="flex gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
      <Skeleton variant="circular" width="40px" height="40px" />
      <div className="flex-1 space-y-2">
        <Skeleton width="30%" height="16px" />
        <Skeleton width="20%" height="14px" />
      </div>
      <Skeleton width="80px" height="24px" />
    </div>
  );
}

// Animated skeleton wrapper
interface SkeletonLoaderProps {
  children: React.ReactNode;
  isLoading: boolean;
  skeleton: React.ReactNode;
  duration?: number;
}

export function SkeletonLoader({
  children,
  isLoading,
  skeleton,
  duration = 300,
}: SkeletonLoaderProps) {
  return (
    <div
      style={{
        position: 'relative',
      }}
    >
      <div
        className={clsx(
          'transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100'
        )}
        aria-hidden={isLoading}
      >
        {children}
      </div>
      
      {isLoading && (
        <div
          className="absolute inset-0"
          style={{
            animation: `fadeIn ${duration}ms ease-in-out`,
          }}
        >
          {skeleton}
        </div>
      )}
    </div>
  );
}

// Skeleton for book detail page
export function SkeletonBookDetail() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <Skeleton width="100px" height="32px" className="mb-4" />
          <Skeleton width="60%" height="28px" />
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Cover */}
          <Skeleton
            variant="rounded"
            width="300px"
            height="450px"
            className="flex-shrink-0"
          />
          
          {/* Details */}
          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <Skeleton width="100%" height="24px" />
              <Skeleton width="70%" height="20px" />
            </div>
            
            <Skeleton width="50%" height="16px" />
            
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} variant="circular" width="24px" height="24px" />
              ))}
            </div>
            
            <Skeleton width="100%" height="100px" />
            
            <div className="flex gap-3">
              <Skeleton width="120px" height="44px" />
              <Skeleton width="100px" height="44px" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
