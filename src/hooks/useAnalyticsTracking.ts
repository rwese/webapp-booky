import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { analyticsOperations } from '../lib/db';
import type { AnalyticsEvent, AnalyticsEventType, AnalyticsEventData, ReadingSession } from '../types';
import { useSettingsStore } from '../store/useStore';

/**
 * Hook for tracking book-centric analytics events.
 * All tracking is book-level only - no page tracking as per user requirements.
 */
export function useAnalyticsTracking() {
  const { settings } = useSettingsStore();
  // Check if analytics tracking is enabled (privacy control)
  const analyticsEnabled = settings.analyticsEnabled !== false;

  /**
   * Track a book-centric analytics event.
   * Respects user's privacy settings and stores events in IndexedDB for offline support.
   */
  const trackEvent = useCallback(async (
    eventType: AnalyticsEventType,
    bookId: string,
    eventData: AnalyticsEventData = {}
  ) => {
    // Check if analytics is enabled (privacy control)
    if (!analyticsEnabled) {
      console.debug('Analytics tracking disabled, skipping event:', eventType);
      return null;
    }

    try {
      const event: AnalyticsEvent = {
        id: crypto.randomUUID(),
        eventType,
        bookId,
        timestamp: new Date(),
        eventData,
        synced: false
      };

      const eventId = await analyticsOperations.trackEvent(event);
      console.debug('Analytics event tracked:', eventType, { bookId, eventId });
      return eventId;
    } catch (error) {
      console.error('Failed to track analytics event:', error);
      // Don't throw - tracking failures shouldn't break the app
      return null;
    }
  }, [analyticsEnabled]);

  /**
   * Track when a book is viewed/opened.
   */
  const trackBookView = useCallback(async (bookId: string) => {
    return trackEvent('book_viewed', bookId, {});
  }, [trackEvent]);

  /**
   * Start a reading session for a book.
   */
  const startReadingSession = useCallback(async (bookId: string) => {
    return trackEvent('reading_session_start', bookId, {
      sessionStart: new Date()
    });
  }, [trackEvent]);

  /**
   * End a reading session for a book.
   */
  const endReadingSession = useCallback(async (
    bookId: string, 
    sessionDuration?: number
  ) => {
    return trackEvent('reading_session_end', bookId, {
      sessionDuration,
      sessionEnd: new Date()
    });
  }, [trackEvent]);

  /**
   * Track when a book is completed.
   */
  const trackBookCompleted = useCallback(async (
    bookId: string,
    completionTime?: number,
    isReRead: boolean = false
  ) => {
    return trackEvent('book_completed', bookId, {
      completionTime,
      reRead: isReRead
    });
  }, [trackEvent]);

  /**
   * Track when a rating is added or updated.
   */
  const trackRatingAdded = useCallback(async (
    bookId: string,
    rating: number,
    previousRating?: number
  ) => {
    return trackEvent('rating_added', bookId, {
      rating,
      previousRating
    });
  }, [trackEvent]);

  /**
   * Track when a review is added.
   */
  const trackReviewAdded = useCallback(async (
    bookId: string,
    reviewLength: number,
    containsSpoilers: boolean = false
  ) => {
    return trackEvent('review_added', bookId, {
      reviewLength,
      containsSpoilers
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackBookView,
    startReadingSession,
    endReadingSession,
    trackBookCompleted,
    trackRatingAdded,
    trackReviewAdded
  };
}

/**
 * Hook for accessing analytics events for a specific book.
 */
export function useBookAnalytics(bookId: string) {
  const events = useLiveQuery(
    () => analyticsOperations.getEventsByBookId(bookId),
    [bookId]
  );

  const sessions = useLiveQuery(
    () => analyticsOperations.getSessionsByBookId(bookId),
    [bookId]
  );

  // Calculate aggregate analytics
  const bookAnalytics = {
    totalViews: events?.filter(e => e.eventType === 'book_viewed').length || 0,
    totalReadingTime: 0,
    totalSessions: sessions?.length || 0,
    averageSessionDuration: 0,
    lastViewedAt: events?.find(e => e.eventType === 'book_viewed')?.timestamp,
    lastReadAt: sessions?.[0]?.startTime,
    completionCount: events?.filter(e => e.eventType === 'book_completed').length || 0,
    averageRating: 0,
    totalReviews: events?.filter(e => e.eventType === 'review_added').length || 0
  };

  // Calculate reading time from session events
  const readingSessionEvents = events?.filter(
    e => e.eventType === 'reading_session_end' && e.eventData.sessionDuration
  ) || [];
  
  const totalReadingTime = readingSessionEvents.reduce(
    (total, event) => total + (event.eventData.sessionDuration || 0),
    0
  );
  
  bookAnalytics.totalReadingTime = totalReadingTime;
  
  if (readingSessionEvents.length > 0) {
    bookAnalytics.averageSessionDuration = totalReadingTime / readingSessionEvents.length;
  }

  return {
    events: events || [],
    sessions: sessions || [],
    analytics: bookAnalytics
  };
}

/**
 * Hook for accessing all analytics events with filters.
 */
export function useAnalyticsEvents(filters?: {
  eventTypes?: AnalyticsEventType[];
  bookIds?: string[];
  startDate?: Date;
  endDate?: Date;
}) {
  return useLiveQuery(
    () => analyticsOperations.getEvents(filters),
    [filters]
  );
}