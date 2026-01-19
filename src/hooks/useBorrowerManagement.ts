/**
 * Borrower Management Hook
 *
 * Manages CRUD operations for borrowers (people who borrow books).
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { useState, useCallback } from 'react';
import { db } from '../lib/db';
import type { Borrower } from '../types';

// Hook for getting all borrowers
export function useBorrowers() {
  const borrowers = useLiveQuery(() => 
    db.borrowers
      .orderBy('name')
      .toArray()
  );
  
  return borrowers || [];
}

// Hook for getting a single borrower by ID
export function useBorrower(id: string | undefined) {
  const borrower = useLiveQuery(
    () => id ? db.borrowers.get(id) : Promise.resolve(undefined),
    [id]
  );
  
  return borrower || undefined;
}

// Hook for searching borrowers
export function useBorrowerSearch() {
  const searchBorrowers = useCallback(async (query: string): Promise<Borrower[]> => {
    if (!query.trim()) {
      return [];
    }
    
    const lowerQuery = query.toLowerCase();
    return await db.borrowers
      .filter(borrower => 
        borrower.name.toLowerCase().includes(lowerQuery) ||
        borrower.email?.toLowerCase().includes(lowerQuery) === true ||
        borrower.phone?.includes(query) === true
      )
      .toArray();
  }, []);
  
  return searchBorrowers;
}

// Hook for borrower CRUD actions
export function useBorrowerActions() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBorrower = useCallback(async (data: Omit<Borrower, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const id = `borrower-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await db.borrowers.add({
        ...data,
        id,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return id;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create borrower';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateBorrower = useCallback(async (id: string, data: Partial<Borrower>): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const existing = await db.borrowers.get(id);
      if (!existing) {
        throw new Error('Borrower not found');
      }

      await db.borrowers.update(id, {
        ...data,
        updatedAt: new Date()
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update borrower';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteBorrower = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if borrower has any active loans
      const activeLoans = await db.lendingRecords
        .where('borrowerId')
        .equals(id)
        .filter(record => record.status === 'on_loan' || record.status === 'overdue')
        .toArray();

      if (activeLoans.length > 0) {
        throw new Error('Cannot delete borrower with active loans');
      }

      await db.borrowers.delete(id);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete borrower';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getBorrowerById = useCallback(async (id: string): Promise<Borrower | undefined> => {
    return await db.borrowers.get(id);
  }, []);

  const getBorrowerWithLoans = useCallback(async (id: string) => {
    const borrower = await db.borrowers.get(id);
    if (!borrower) return null;

    const loans = await db.lendingRecords
      .where('borrowerId')
      .equals(id)
      .toArray();

    // Get book details for each loan
    const loansWithBooks = await Promise.all(
      loans.map(async (loan) => {
        const book = await db.books.get(loan.bookId);
        return {
          ...loan,
          book
        };
      })
    );

    return {
      borrower,
      loans: loansWithBooks,
      activeLoansCount: loans.filter(l => l.status === 'on_loan' || l.status === 'overdue').length,
      totalLoansCount: loans.length
    };
  }, []);

  return {
    createBorrower,
    updateBorrower,
    deleteBorrower,
    getBorrowerById,
    getBorrowerWithLoans,
    isLoading,
    error
  };
}

// Hook for getting borrower loan summary
export function useBorrowerLoanSummary(borrowerId: string | undefined) {
  const summary = useLiveQuery(
    async () => {
      if (!borrowerId) return null;
      
      const loans = await db.lendingRecords
        .where('borrowerId')
        .equals(borrowerId)
        .toArray();

      const now = new Date();
      const activeLoans = loans.filter(l => l.status === 'on_loan');
      const overdueLoans = loans.filter(l => {
        if (l.status !== 'overdue') return false;
        const dueDate = l.dueDate instanceof Date ? l.dueDate : new Date(l.dueDate as unknown as string);
        return now > dueDate;
      });
      const returnedLoans = loans.filter(l => l.status === 'returned');

      // Get book details for active loans
      const activeLoansWithBooks = await Promise.all(
        activeLoans.map(async (loan) => {
          const book = await db.books.get(loan.bookId);
          return { ...loan, book };
        })
      );

      // Get book details for overdue loans
      const overdueLoansWithBooks = await Promise.all(
        overdueLoans.map(async (loan) => {
          const book = await db.books.get(loan.bookId);
          return { ...loan, book };
        })
      );

      return {
        activeLoans: activeLoansWithBooks,
        overdueLoans: overdueLoansWithBooks,
        returnedCount: returnedLoans.length,
        totalLoansCount: loans.length,
        activeLoansCount: activeLoans.length,
        overdueLoansCount: overdueLoans.length
      };
    },
    [borrowerId]
  );

  return summary;
}

// Export a combined hook for convenience
export function useBorrowerManagement() {
  const borrowers = useBorrowers();
  const borrowerActions = useBorrowerActions();
  const searchBorrowers = useBorrowerSearch();
  const borrowerLoanSummary = useBorrowerLoanSummary;

  return {
    borrowers,
    ...borrowerActions,
    searchBorrowers,
    useBorrowerLoanSummary: borrowerLoanSummary
  };
}
