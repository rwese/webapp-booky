import React, { useState, useEffect } from 'react';
import { Book } from 'lucide-react';
import { coverImageOperations } from '../../lib/db';
import type { Book as BookType } from '../../types';

interface BookCoverProps {
  book: BookType;
  className?: string;
  alt?: string;
}

/**
 * BookCover component that handles both remote coverUrl and localCoverPath
 * - coverUrl: Remote/external URL from APIs
 * - localCoverPath: IndexedDB cover ID for imported books
 */
export function BookCover({ book, className = '', alt }: BookCoverProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const resolveCover = async () => {
      // If we have a remote coverUrl, use it directly
      if (book.coverUrl) {
        setCoverUrl(book.coverUrl);
        return;
      }

      // If we have a localCoverPath (IndexedDB cover ID), fetch the blob URL
      if (book.localCoverPath) {
        setLoading(true);
        try {
          const url = await coverImageOperations.getUrl(book.localCoverPath);
          if (url) {
            setCoverUrl(url);
            console.log(`[DEBUG] BookCover: Loaded local cover for ${book.id}`);
          } else {
            console.warn(`[DEBUG] BookCover: Cover ID ${book.localCoverPath} not found in IndexedDB`);
          }
        } catch (error) {
          console.error('[DEBUG] BookCover: Error loading cover from IndexedDB:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    resolveCover();
  }, [book.coverUrl, book.localCoverPath, book.id]);

  if (loading) {
    return (
      <div className={`bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${className}`}>
        <Book className="text-gray-400 animate-pulse" size={24} />
      </div>
    );
  }

  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={alt || book.title}
        className={`object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${className}`}>
      <Book className="text-gray-400" size={24} />
    </div>
  );
}

export default BookCover;
