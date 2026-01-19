/**
 * Book Lending Hook
 * 
 * Manages book lending and borrowing tracking.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { useState, useCallback, useMemo } from 'react';
import { db } from '../lib/db';
import { isAfter, parseISO } from 'date-fns';

// Hook for lending status of a specific book
export function useBookLending(bookId: string) {
  const lendingRecordWithBorrower = useLiveQuery(
    async () => {
      const record = await db.lendingRecords
        .where('bookId')
        .equals(bookId)
        .filter(r => r.status === 'on_loan' || r.status === 'overdue')
        .first();
      
      if (!record) return null;
      
      const borrower = await db.borrowers.get(record.borrowerId);
      return {
        ...record,
        borrower: borrower || undefined
      };
    },
    [bookId]
  );
  
  const lendingRecord = lendingRecordWithBorrower;
  const borrower = lendingRecordWithBorrower?.borrower;

  const isOverdue = useMemo(() => {
    if (!lendingRecord) return false;
    const dueDate = lendingRecord.dueDate instanceof Date 
      ? lendingRecord.dueDate 
      : parseISO(lendingRecord.dueDate as unknown as string);
    return isAfter(new Date(), dueDate) && lendingRecord.status === 'on_loan';
  }, [lendingRecord]);

  return {
    lendingRecord: lendingRecord || undefined,
    borrower,
    isOverdue,
    isAvailable: !lendingRecord || lendingRecord.status === 'returned'
  };
}

// Hook for all lending records
export function useAllLendingRecords() {
  const records = useLiveQuery(() => 
    db.lendingRecords
      .orderBy('loanedAt')
      .reverse()
      .toArray()
  );
  
  return records || [];
}

// Hook for active loans (on_loan or overdue)
export function useActiveLoans() {
  const loans = useLiveQuery(() => 
    db.lendingRecords
      .where('status')
      .anyOf(['on_loan', 'overdue'])
      .toArray()
  );
  
  return loans || [];
}

// Hook for overdue loans
export function useOverdueLoans() {
  const loans = useLiveQuery(async () => {
    const allLoans = await db.lendingRecords
      .where('status')
      .anyOf(['on_loan', 'overdue'])
      .toArray();
    
    return allLoans.filter(loan => {
      const dueDate = loan.dueDate instanceof Date 
        ? loan.dueDate 
        : parseISO(loan.dueDate as unknown as string);
      return isAfter(new Date(), dueDate);
    });
  });
  
  return loans || [];
}

// Hook for lending actions
export function useLendingActions() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loanBook = useCallback(async (
    bookId: string,
    borrowerId: string,
    dueDate: Date,
    notes?: string
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if book is already on loan
      const existingLoan = await db.lendingRecords
        .where('bookId')
        .equals(bookId)
        .filter(record => record.status === 'on_loan' || record.status === 'overdue')
        .first();
      
      if (existingLoan) {
        throw new Error('Book is already on loan');
      }

      const id = `lend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await db.lendingRecords.add({
        id,
        bookId,
        borrowerId,
        status: 'on_loan',
        loanedAt: new Date(),
        dueDate,
        notes,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return id;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to loan book';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const returnBook = useCallback(async (lendingId: string, notes?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const record = await db.lendingRecords.get(lendingId);
      if (!record) {
        throw new Error('Lending record not found');
      }

      await db.lendingRecords.update(lendingId, {
        status: 'returned',
        returnedAt: new Date(),
        notes: notes || record.notes,
        updatedAt: new Date()
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to return book';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAsOverdue = useCallback(async (lendingId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await db.lendingRecords.update(lendingId, {
        status: 'overdue',
        updatedAt: new Date()
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to mark as overdue';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const renewLoan = useCallback(async (lendingId: string, newDueDate: Date) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const record = await db.lendingRecords.get(lendingId);
      if (!record) {
        throw new Error('Lending record not found');
      }

      await db.lendingRecords.update(lendingId, {
        dueDate: newDueDate,
        status: 'on_loan',
        updatedAt: new Date()
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to renew loan';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    loanBook,
    returnBook,
    markAsOverdue,
    renewLoan,
    isLoading,
    error
  };
}

// Hook for lending history of a book
export function useLendingHistory(bookId: string) {
  const history = useLiveQuery(
    () => db.lendingRecords
      .where('bookId')
      .equals(bookId)
      .sortBy('loanedAt'),
    [bookId]
  );
  
  // Sort by loanedAt descending
  return useMemo(() => {
    if (!history) return [];
    return [...history].sort((a, b) => {
      const aDate = a.loanedAt instanceof Date ? a.loanedAt : parseISO(a.loanedAt as unknown as string);
      const bDate = b.loanedAt instanceof Date ? b.loanedAt : parseISO(b.loanedAt as unknown as string);
      return bDate.getTime() - aDate.getTime();
    });
  }, [history]);
}

// Hook for getting loans by borrower
export function useBorrowerLoans(borrowerId: string) {
  const loans = useLiveQuery(
    () => db.lendingRecords
      .where('borrowerId')
      .equals(borrowerId)
      .toArray(),
    [borrowerId]
  );
  
  return loans || [];
}

// Default loan period (14 days)
export const DEFAULT_LOAN_PERIOD_DAYS = 14;
