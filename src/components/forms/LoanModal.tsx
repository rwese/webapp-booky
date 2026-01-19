/**
 * Loan Book Modal
 * Allows selecting a borrower and setting a due date when loaning a book
 */

import { useState } from 'react';
import { User, Calendar, Search, X } from 'lucide-react';
import { Button, Card, Input } from '../common/Button';
import { useBorrowers, useBorrowerActions } from '../../hooks/useBorrowerManagement';
import { useLendingActions, DEFAULT_LOAN_PERIOD_DAYS } from '../../hooks/useBookLending';
import type { Borrower } from '../../types';
import { addDays } from 'date-fns';

interface LoanModalProps {
  bookId: string;
  bookTitle: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LoanModal({ bookId, bookTitle, onClose, onSuccess }: LoanModalProps) {
  const borrowers = useBorrowers();
  const { createBorrower } = useBorrowerActions();
  const { loanBook, isLoading: isLending } = useLendingActions();
  
  const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);
  const [dueDate, setDueDate] = useState(() => {
    const date = addDays(new Date(), DEFAULT_LOAN_PERIOD_DAYS);
    return date.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddBorrower, setShowAddBorrower] = useState(false);
  const [newBorrowerName, setNewBorrowerName] = useState('');
  const [newBorrowerEmail, setNewBorrowerEmail] = useState('');
  const [newBorrowerPhone, setNewBorrowerPhone] = useState('');
  const [isCreatingBorrower, setIsCreatingBorrower] = useState(false);

  // Filter borrowers based on search
  const filteredBorrowers = borrowers.filter(borrower =>
    borrower.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    borrower.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    borrower.phone?.includes(searchQuery)
  );

  // Handle creating a new borrower
  const handleCreateBorrower = async () => {
    if (!newBorrowerName.trim()) return;
    
    setIsCreatingBorrower(true);
    try {
      const id = await createBorrower({
        name: newBorrowerName.trim(),
        email: newBorrowerEmail.trim() || undefined,
        phone: newBorrowerPhone.trim() || undefined,
      });
      
      // Auto-select the new borrower
      setSelectedBorrower({
        id,
        name: newBorrowerName.trim(),
        email: newBorrowerEmail.trim() || undefined,
        phone: newBorrowerPhone.trim() || undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      setShowAddBorrower(false);
      setNewBorrowerName('');
      setNewBorrowerEmail('');
      setNewBorrowerPhone('');
    } catch (error) {
      console.error('Failed to create borrower:', error);
    } finally {
      setIsCreatingBorrower(false);
    }
  };

  // Handle loaning the book
  const handleLoanBook = async () => {
    if (!selectedBorrower) return;
    
    try {
      await loanBook(bookId, selectedBorrower.id, new Date(dueDate), notes || undefined);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to loan book:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Loan Book</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{bookTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          {/* Add New Borrower Toggle */}
          {!showAddBorrower ? (
            <div className="mb-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAddBorrower(true)}
                className="w-full"
                type="button"
              >
                <User size={16} />
                Add New Borrower
              </Button>
            </div>
          ) : (
            <Card className="p-4 mb-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">New Borrower</h3>
              <div className="space-y-3">
                <Input
                  label="Name *"
                  value={newBorrowerName}
                  onChange={(e) => setNewBorrowerName(e.target.value)}
                  placeholder="Enter name"
                />
                <Input
                  label="Email"
                  type="email"
                  value={newBorrowerEmail}
                  onChange={(e) => setNewBorrowerEmail(e.target.value)}
                  placeholder="Enter email"
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={newBorrowerPhone}
                  onChange={(e) => setNewBorrowerPhone(e.target.value)}
                  placeholder="Enter phone number"
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddBorrower(false)}
                    type="button"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreateBorrower}
                    disabled={!newBorrowerName.trim() || isCreatingBorrower}
                    type="button"
                  >
                    {isCreatingBorrower ? 'Creating...' : 'Create & Select'}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Borrower List */}
          {!showAddBorrower && (
            <div className="mb-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search borrowers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {filteredBorrowers.length > 0 ? (
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {filteredBorrowers.map(borrower => (
                    <button
                      key={borrower.id}
                      type="button"
                      onClick={() => setSelectedBorrower(borrower)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedBorrower?.id === borrower.id
                          ? 'bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-500'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{borrower.name}</div>
                      {(borrower.email || borrower.phone) && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {borrower.email && <span>{borrower.email}</span>}
                          {borrower.email && borrower.phone && <span> • </span>}
                          {borrower.phone && <span>{borrower.phone}</span>}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  {searchQuery ? 'No borrowers found' : 'No borrowers yet. Add one above!'}
                </div>
              )}
            </div>
          )}

          {/* Due Date */}
          <div className="mb-4">
            <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Due Date
            </label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label htmlFor="loanNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes (optional)
            </label>
            <textarea
              id="loanNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            onClick={handleLoanBook}
            disabled={!selectedBorrower || isLending}
            type="button"
          >
            {isLending ? 'Loaning...' : 'Loan Book'}
          </Button>
        </div>
      </div>
    </div>
  );
}
