/**
 * Reading Goals Hook
 * 
 * Manages reading goals (books and pages) with progress tracking.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { useState, useCallback } from 'react';
import { db } from '../lib/db';
import { useReadingAnalytics } from './useAnalytics';
import type { ReadingGoal, GoalType, GoalPeriod } from '../types';
import { getYear, getMonth } from 'date-fns';

// Hook for reading goals
export function useReadingGoals() {
  const goals = useLiveQuery(() => 
    db.readingGoals
      .filter(goal => goal.isActive)
      .toArray()
  );
  
  const currentYear = getYear(new Date());
  const currentMonth = getMonth(new Date()) + 1;
  
  const yearlyBooksGoal = goals?.find(g => 
    g.type === 'books' && g.period === 'yearly' && g.year === currentYear
  );
  const yearlyPagesGoal = goals?.find(g => 
    g.type === 'pages' && g.period === 'yearly' && g.year === currentYear
  );
  const monthlyBooksGoal = goals?.find(g => 
    g.type === 'books' && g.period === 'monthly' && g.year === currentYear && g.month === currentMonth
  );

  const createGoal = useCallback(async (
    type: GoalType,
    period: GoalPeriod,
    targetValue: number,
    year: number = currentYear,
    month?: number
  ) => {
    const id = `${type}-${period}-${year}-${month || 0}`;
    
    await db.readingGoals.put({
      id,
      type,
      period,
      targetValue,
      currentValue: 0,
      year,
      month,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return id;
  }, [currentYear]);

  const updateGoal = useCallback(async (
    id: string,
    changes: Partial<ReadingGoal>
  ) => {
    const existing = await db.readingGoals.get(id);
    if (existing) {
      await db.readingGoals.put({
        ...existing,
        ...changes,
        updatedAt: new Date()
      });
    }
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    await db.readingGoals.delete(id);
  }, []);

  const getGoalProgress = useCallback((goal: ReadingGoal | undefined) => {
    if (!goal) return { current: 0, target: 0, percentage: 0, remaining: 0 };
    
    const percentage = goal.targetValue > 0 
      ? Math.min(100, (goal.currentValue / goal.targetValue) * 100)
      : 0;
    
    return {
      current: goal.currentValue,
      target: goal.targetValue,
      percentage: Math.round(percentage * 10) / 10,
      remaining: Math.max(0, goal.targetValue - goal.currentValue)
    };
  }, []);

  return {
    goals,
    yearlyBooksGoal,
    yearlyPagesGoal,
    monthlyBooksGoal,
    createGoal,
    updateGoal,
    deleteGoal,
    getGoalProgress
  };
}

// Hook for updating goal progress based on reading logs
export function useUpdateGoalProgress() {
  const { booksReadThisYear } = useReadingAnalytics();
  
  const updateYearlyBooksGoal = useCallback(async () => {
    const currentYear = getYear(new Date());
    const goalId = `books-yearly-${currentYear}-0`;
    
    const existingGoal = await db.readingGoals.get(goalId);
    if (existingGoal) {
      await db.readingGoals.put({
        ...existingGoal,
        currentValue: booksReadThisYear,
        updatedAt: new Date()
      });
    }
  }, [booksReadThisYear]);

  return { updateYearlyBooksGoal };
}

// Goal setting form hook
export function useGoalForm() {
  const [goalType, setGoalType] = useState<GoalType>('books');
  const [period, setPeriod] = useState<GoalPeriod>('yearly');
  const [targetValue, setTargetValue] = useState<number>(12);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { createGoal } = useReadingGoals();
  
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      const currentYear = getYear(new Date());
      const currentMonth = getMonth(new Date()) + 1;
      
      await createGoal(
        goalType,
        period,
        targetValue,
        currentYear,
        period === 'monthly' ? currentMonth : undefined
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save goal');
    } finally {
      setIsSubmitting(false);
    }
  }, [goalType, period, targetValue, createGoal]);
  
  return {
    goalType,
    setGoalType,
    period,
    setPeriod,
    targetValue,
    setTargetValue,
    isSubmitting,
    error,
    handleSubmit
  };
}
