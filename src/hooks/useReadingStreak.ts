/**
 * Reading Streak Hook
 * 
 * Tracks reading streaks and daily reading activity.
 */

import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { ReadingStreak, DayReadingStatus } from '../types';
import { format, subDays, parseISO, getYear, startOfYear, endOfYear, eachDayOfInterval } from 'date-fns';

// Hook for reading streak statistics
export function useReadingStreak() {
  const readingLogs = useLiveQuery(() => db.readingLogs.toArray());
  
  const [streak, setStreak] = useState<ReadingStreak>({
    currentStreak: 0,
    longestStreak: 0,
    lastReadingDate: null,
    totalReadingDays: 0
  });

  useEffect(() => {
    if (!readingLogs || readingLogs.length === 0) {
      setStreak({
        currentStreak: 0,
        longestStreak: 0,
        lastReadingDate: null,
        totalReadingDays: 0
      });
      return;
    }

    // Get unique dates when user read at least one book
    const readingDates = new Set<string>();
    readingLogs
      .filter(log => log.status === 'read' && log.finishedAt)
      .forEach(log => {
        const date = log.finishedAt instanceof Date 
          ? format(log.finishedAt, 'yyyy-MM-dd')
          : format(parseISO(log.finishedAt as unknown as string), 'yyyy-MM-dd');
        readingDates.add(date);
      });

    const sortedDates = Array.from(readingDates).sort();
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    // Calculate current streak
    let currentStreak = 0;
    let lastReadingDate: string | null = null;
    
    // Check if streak is active (read today or yesterday)
    if (sortedDates.includes(today)) {
      currentStreak = 1;
      lastReadingDate = today;
      // Count backwards from today
      for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = format(subDays(new Date(), i), 'yyyy-MM-dd');
        if (sortedDates.includes(prevDate)) {
          currentStreak++;
        } else {
          break;
        }
      }
    } else if (sortedDates.includes(yesterday)) {
      currentStreak = 1;
      lastReadingDate = yesterday;
      for (let i = 2; i < sortedDates.length + 1; i++) {
        const prevDate = format(subDays(new Date(), i), 'yyyy-MM-dd');
        if (sortedDates.includes(prevDate)) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    let prevDate: Date | null = null;
    
    sortedDates.forEach(dateStr => {
      const currentDate = parseISO(dateStr);
      
      if (prevDate) {
        const daysDiff = Math.floor(
          (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysDiff === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      } else {
        tempStreak = 1;
      }
      
      prevDate = currentDate;
    });
    longestStreak = Math.max(longestStreak, tempStreak);

    setStreak({
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      lastReadingDate: lastReadingDate ? parseISO(lastReadingDate) : null,
      totalReadingDays: sortedDates.length
    });
  }, [readingLogs]);

  return streak;
}

// Hook for calendar heatmap data
export function useReadingCalendar(year: number = getYear(new Date())) {
  const readingLogs = useLiveQuery(() => db.readingLogs.toArray());
  
  const heatmapData = useMemo(() => {
    if (!readingLogs) return [];
    
    const start = startOfYear(new Date(year));
    const end = endOfYear(new Date(year));
    const days = eachDayOfInterval({ start, end });
    
    // Count books read per day
    const booksPerDay: Record<string, number> = {};
    
    readingLogs
      .filter(log => log.status === 'read' && log.finishedAt)
      .forEach(log => {
        const date = log.finishedAt instanceof Date 
          ? format(log.finishedAt, 'yyyy-MM-dd')
          : format(parseISO(log.finishedAt as unknown as string), 'yyyy-MM-dd');
        
        booksPerDay[date] = (booksPerDay[date] || 0) + 1;
      });
    
    return days.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const count = booksPerDay[dateStr] || 0;
      
      return {
        date: dateStr,
        hasRead: count > 0,
        bookCount: count
      } as DayReadingStatus;
    });
  }, [readingLogs, year]);

  return heatmapData;
}

// Hook for year comparison
export function useYearComparison() {
  const readingLogs = useLiveQuery(() => db.readingLogs.toArray());
  
  const comparison = useMemo(() => {
    if (!readingLogs) return { thisYear: 0, lastYear: 0, percentChange: 0 };
    
    const currentYear = getYear(new Date());
    const lastYear = currentYear - 1;
    
    const thisYearLogs = readingLogs.filter(log => {
      if (log.status !== 'read' || !log.finishedAt) return false;
      const date = log.finishedAt instanceof Date 
        ? log.finishedAt
        : parseISO(log.finishedAt as unknown as string);
      return getYear(date) === currentYear;
    });
    
    const lastYearLogs = readingLogs.filter(log => {
      if (log.status !== 'read' || !log.finishedAt) return false;
      const date = log.finishedAt instanceof Date 
        ? log.finishedAt
        : parseISO(log.finishedAt as unknown as string);
      return getYear(date) === lastYear;
    });
    
    const percentChange = lastYearLogs.length > 0
      ? Math.round(((thisYearLogs.length - lastYearLogs.length) / lastYearLogs.length) * 100)
      : thisYearLogs.length > 0 ? 100 : 0;
    
    return {
      thisYear: thisYearLogs.length,
      lastYear: lastYearLogs.length,
      percentChange
    };
  }, [readingLogs]);

  return comparison;
}

// Hook for monthly progress
export function useMonthlyProgress() {
  const readingLogs = useLiveQuery(() => db.readingLogs.toArray());
  
  const progress = useMemo(() => {
    if (!readingLogs) return { thisMonth: 0, averageMonth: 0, projected: 0 };
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // This month's books
    const thisMonthLogs = readingLogs.filter(log => {
      if (log.status !== 'read' || !log.finishedAt) return false;
      const date = log.finishedAt instanceof Date 
        ? log.finishedAt
        : parseISO(log.finishedAt as unknown as string);
      return (
        date.getMonth() === currentMonth &&
        date.getFullYear() === currentYear
      );
    });
    
    // Average books per month this year
    const monthsElapsed = currentMonth + 1;
    const thisYearLogs = readingLogs.filter(log => {
      if (log.status !== 'read' || !log.finishedAt) return false;
      const date = log.finishedAt instanceof Date 
        ? log.finishedAt
        : parseISO(log.finishedAt as unknown as string);
      return date.getFullYear() === currentYear;
    });
    
    const averageMonth = monthsElapsed > 0 
      ? Math.round(thisYearLogs.length / monthsElapsed * 10) / 10
      : 0;
    
    // Projected total for year based on current pace
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysElapsed = now.getDate();
    const projected = daysElapsed > 0 && daysInMonth > 0
      ? Math.round((thisMonthLogs.length / daysElapsed) * daysInMonth)
      : 0;
    
    return {
      thisMonth: thisMonthLogs.length,
      averageMonth,
      projected
    };
  }, [readingLogs]);

  return progress;
}
