import React, { useState, useEffect, useRef } from 'react';
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
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const resolveCover = async () => {
      // Revoke previous blob URL if it exists
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

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
            blobUrlRef.current = url;
            setCoverUrl(url);
          } else {
            console.warn(`Cover ID ${book.localCoverPath} not found in IndexedDB`);
          }
        } catch (error) {
          console.error('Error loading cover from IndexedDB:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    resolveCover();

    // Cleanup: revoke blob URL when component unmounts or cover changes
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [book.coverUrl, book.localCoverPath]);

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
