import { Star } from 'lucide-react';
import { useState, useCallback } from 'react';
import { clsx } from 'clsx';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  className?: string;
}

const STAR_SIZES = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6', 
  lg: 'w-8 h-8'
};

// Simple read-only display version
function StarRatingDisplayOnly({ 
  rating, 
  maxRating = 5,
  size = 'md',
  className 
}: { 
  rating: number; 
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const starSizeClass = STAR_SIZES[size];

  return (
    <span className={clsx('inline-flex gap-0.5', className)}>
      {Array.from({ length: maxRating }, (_, index) => {
        const starNumber = index + 1;
        const isFilled = rating >= starNumber;
        const isHalfFilled = rating === starNumber - 0.5;

        return (
          <Star
            key={`star-${starNumber}`}
            className={clsx(
              starSizeClass,
              'transition-colors',
              isFilled || isHalfFilled
                ? 'text-yellow-400 fill-yellow-400' 
                : 'text-gray-300 dark:text-gray-600'
            )}
          />
        );
      })}
    </span>
  );
}

// Interactive version with hover and click
function StarRatingInteractive({ 
  rating, 
  onRatingChange, 
  maxRating = 5, 
  size = 'md',
  className 
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width / maxRating;
    const starPosition = x / width;
    
    const positionInStar = starPosition - Math.floor(starPosition);
    if (positionInStar < 0.5) {
      setHoverRating(Math.floor(starPosition) + 0.5);
    } else {
      setHoverRating(Math.floor(starPosition) + 1);
    }
  }, [maxRating]);

  const handleMouseLeave = useCallback(() => {
    setHoverRating(null);
  }, []);

  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width / maxRating;
    const starPosition = x / width;
    
    const positionInStar = starPosition - Math.floor(starPosition);
    let finalRating: number;
    if (positionInStar < 0.5) {
      finalRating = Math.floor(starPosition) + 0.5;
    } else {
      finalRating = Math.floor(starPosition) + 1;
    }
    
    // Clamp to valid range
    finalRating = Math.max(0.5, Math.min(maxRating, finalRating));
    onRatingChange(finalRating);
  }, [onRatingChange, maxRating]);

  const currentRating = hoverRating !== null ? hoverRating : rating;
  const starSizeClass = STAR_SIZES[size];

  return (
    <button
      type="button"
      className={clsx('inline-flex gap-0.5 cursor-pointer', className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      aria-label="Rate this book"
    >
      {Array.from({ length: maxRating }, (_, index) => {
        const starNumber = index + 1;
        const isFilled = currentRating >= starNumber;
        const isHalfFilled = currentRating === starNumber - 0.5;

        return (
          <Star
            key={`star-${starNumber}`}
            className={clsx(
              starSizeClass,
              'transition-colors',
              isFilled || isHalfFilled
                ? 'text-yellow-400 fill-yellow-400' 
                : 'text-gray-300 dark:text-gray-600'
            )}
          />
        );
      })}
    </button>
  );
}

// Main component that switches between modes
export function StarRating({ 
  rating, 
  onRatingChange, 
  maxRating = 5, 
  size = 'md',
  interactive = false,
  className 
}: StarRatingProps) {
  if (interactive) {
    return (
      <StarRatingInteractive
        rating={rating}
        onRatingChange={onRatingChange!}
        maxRating={maxRating}
        size={size}
        className={className}
      />
    );
  }

  return (
    <StarRatingDisplayOnly
      rating={rating}
      maxRating={maxRating}
      size={size}
      className={className}
    />
  );
}

// Read-only version with just stars and number
export function StarRatingDisplay({ 
  rating, 
  maxRating = 5,
  size = 'md',
  showNumber = true,
  className 
}: { 
  rating: number; 
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  showNumber?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx('inline-flex items-center gap-2', className)}>
      <StarRating rating={rating} maxRating={maxRating} size={size} interactive={false} />
      {showNumber && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}