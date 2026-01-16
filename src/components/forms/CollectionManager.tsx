import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Plus, Edit, Trash2, Book, X, Search } from 'lucide-react';
import { Button, Input, Card, Badge } from '../common/Button';
import { collectionOperations } from '../../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Collection, SmartRule } from '../../types';
import { clsx } from 'clsx';

// Smart collection rule operators
const RULE_OPERATORS = {
  rating: [
    { value: 'equals', label: 'equals' },
    { value: 'notEquals', label: 'does not equal' },
    { value: 'greaterThan', label: 'is greater than' },
    { value: 'lessThan', label: 'is less than' }
  ],
  format: [
    { value: 'equals', label: 'equals' },
    { value: 'notEquals', label: 'does not equal' }
  ],
  tags: [
    { value: 'contains', label: 'contains' },
    { value: 'notContains', label: 'does not contain' }
  ],
  status: [
    { value: 'equals', label: 'equals' },
    { value: 'notEquals', label: 'does not equal' }
  ],
  year: [
    { value: 'equals', label: 'equals' },
    { value: 'notEquals', label: 'does not equal' },
    { value: 'greaterThan', label: 'is greater than' },
    { value: 'lessThan', label: 'is less than' }
  ]
};

interface CollectionManagerProps {
  onClose: () => void;
  className?: string;
}

export function CollectionManager({ onClose, className }: CollectionManagerProps) {
  const allCollections = useLiveQuery(() => collectionOperations.getAll()) || [];
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [newCollection, setNewCollection] = useState({
    name: '',
    description: '',
    isSmart: false,
    smartRules: [] as SmartRule[]
  });

  const handleCreateCollection = useCallback(async () => {
    if (!newCollection.name.trim()) return;

    try {
      const collection: Collection = {
        id: crypto.randomUUID(),
        name: newCollection.name.trim(),
        description: newCollection.description.trim(),
        isSmart: newCollection.isSmart,
        smartRules: newCollection.isSmart ? newCollection.smartRules : undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await collectionOperations.add(collection);
      setNewCollection({ name: '', description: '', isSmart: false, smartRules: [] });
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create collection:', error);
    }
  }, [newCollection]);

  const handleDeleteCollection = useCallback(async (collectionId: string) => {
    if (confirm('Are you sure you want to delete this collection?')) {
      await collectionOperations.delete(collectionId);
    }
  }, []);

  const handleUpdateCollection = useCallback(async (collectionId: string, updates: Partial<Collection>) => {
    await collectionOperations.update(collectionId, { ...updates, updatedAt: new Date() });
    setEditingCollection(null);
  }, []);

  return (
    <div className={clsx('bg-white dark:bg-gray-800 rounded-lg shadow-xl', className)}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Collections</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-4">
        {/* Create New Collection Button */}
        {!showCreateForm && (
          <Button onClick={() => setShowCreateForm(true)} className="w-full mb-4">
            <Plus size={16} />
            Create New Collection
          </Button>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <Card className="p-4 mb-4">
            <h3 className="font-semibold mb-3">Create Collection</h3>
            <Input
              label="Name"
              value={newCollection.name}
              onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
              placeholder="Collection name"
              className="mb-3"
            />
            <Input
              label="Description (optional)"
              value={newCollection.description}
              onChange={(e) => setNewCollection({ ...newCollection, description: e.target.value })}
              placeholder="What's this collection for?"
              className="mb-3"
            />
            
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={newCollection.isSmart}
                onChange={(e) => setNewCollection({ ...newCollection, isSmart: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Smart Collection (auto-populate based on rules)
              </span>
            </label>

            {newCollection.isSmart && (
              <SmartRuleEditor
                rules={newCollection.smartRules}
                onRulesChange={(rules) => setNewCollection({ ...newCollection, smartRules: rules })}
              />
            )}

            <div className="flex gap-2 mt-4">
              <Button onClick={handleCreateCollection} disabled={!newCollection.name.trim()}>
                Create
              </Button>
              <Button variant="ghost" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {/* Collections List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {allCollections.map(collection => {
            const isEditing = editingCollection?.id === collection.id;
            
            return (
              <div
                key={collection.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                {isEditing ? (
                  <CollectionEditForm
                    collection={collection}
                    onSave={(updates) => handleUpdateCollection(collection.id, updates)}
                    onCancel={() => setEditingCollection(null)}
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Book size={16} className="text-gray-400" />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">{collection.name}</span>
                        {collection.isSmart && (
                          <Badge variant="primary" className="ml-2">Smart</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingCollection(collection)}>
                        <Edit size={14} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteCollection(collection.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {allCollections.length === 0 && !showCreateForm && (
          <div className="text-center py-8 text-gray-500">
            No collections yet. Create one to organize your books!
          </div>
        )}
      </div>
    </div>
  );
}

// Smart Rule Editor Component
interface SmartRuleEditorProps {
  rules: SmartRule[];
  onRulesChange: (rules: SmartRule[]) => void;
}

function SmartRuleEditor({ rules, onRulesChange }: SmartRuleEditorProps) {
  const addRule = useCallback(() => {
    onRulesChange([...rules, {
      field: 'rating',
      operator: 'greaterThan',
      value: 3
    }]);
  }, [rules, onRulesChange]);

  const updateRule = useCallback((index: number, updates: Partial<SmartRule>) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], ...updates };
    onRulesChange(newRules);
  }, [rules, onRulesChange]);

  const removeRule = useCallback((index: number) => {
    onRulesChange(rules.filter((_, i) => i !== index));
  }, [rules, onRulesChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Rules</span>
        <Button variant="ghost" size="sm" onClick={addRule}>
          <Plus size={14} />
          Add Rule
        </Button>
      </div>
      
      {rules.map((rule, index) => (
        <div key={`smart-rule-${rule.field}-${index}`} className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-600 rounded">
          <select
            value={rule.field}
            onChange={(e) => updateRule(index, { field: e.target.value as SmartRule['field'] })}
            className="input text-sm flex-1"
          >
            <option value="rating">Rating</option>
            <option value="format">Format</option>
            <option value="status">Status</option>
            <option value="tags">Tags</option>
            <option value="year">Year</option>
          </select>
          
          <select
            value={rule.operator}
            onChange={(e) => updateRule(index, { operator: e.target.value as SmartRule['operator'] })}
            className="input text-sm flex-1"
          >
            {RULE_OPERATORS[rule.field]?.map(op => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          
          <input
            type={rule.field === 'rating' || rule.field === 'year' ? 'number' : 'text'}
            value={String(rule.value)}
            onChange={(e) => updateRule(index, { value: rule.field === 'rating' || rule.field === 'year' ? parseFloat(e.target.value) : e.target.value })}
            className="input text-sm flex-1"
            placeholder="Value"
          />
          
          <button
            type="button"
            onClick={() => removeRule(index)}
            className="p-1 text-red-500 hover:text-red-700"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      
      {rules.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-2">No rules added yet</p>
      )}
    </div>
  );
}

// Collection Edit Form
interface CollectionEditFormProps {
  collection: Collection;
  onSave: (updates: Partial<Collection>) => void;
  onCancel: () => void;
}

function CollectionEditForm({ collection, onSave, onCancel }: CollectionEditFormProps) {
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description || '');

  return (
    <div className="flex-1 flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input flex-1"
        placeholder="Collection name"
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="input flex-1"
        placeholder="Description"
      />
      <Button size="sm" onClick={() => onSave({ name, description })}>Save</Button>
      <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

// Collection Badge Component
interface CollectionBadgeProps {
  collection: Collection;
  bookCount?: number;
  className?: string;
}

export function CollectionBadge({ collection, bookCount, className }: CollectionBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium',
        'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200',
        className
      )}
    >
      <Book size={12} />
      {collection.name}
      {bookCount !== undefined && (
        <span className="text-xs opacity-75">({bookCount})</span>
      )}
    </span>
  );
}

// Enhanced Collection Selector Component with search and creation
interface CollectionSelectorProps {
  selectedCollections: Collection[];
  onCollectionsChange: (collections: Collection[]) => void;
  className?: string;
}

export function CollectionSelector({ selectedCollections, onCollectionsChange, className }: CollectionSelectorProps) {
  const allCollectionsRaw = useLiveQuery(() => collectionOperations.getAll()) || [];
  const allCollections = useMemo(() => allCollectionsRaw, [allCollectionsRaw]);
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close suggestions
  useEffect(() => {
    if (!wrapperRef.current) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter collections based on input
  const filteredCollections = useMemo(() => {
    if (!inputValue.trim()) return allCollections;
    return allCollections.filter(collection => 
      collection.name.toLowerCase().includes(inputValue.toLowerCase())
    );
  }, [allCollections, inputValue]);

  // Check if input matches an existing collection
  const matchingCollection = useMemo(() => {
    if (!inputValue.trim()) return null;
    return allCollections.find(c => c.name.toLowerCase() === inputValue.toLowerCase());
  }, [allCollections, inputValue]);

  const handleCreateCollection = useCallback(async () => {
    const name = inputValue.trim();
    if (!name) return;

    setIsCreating(true);
    try {
      const newCollection: Collection = {
        id: crypto.randomUUID(),
        name,
        isSmart: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await collectionOperations.add(newCollection);
      onCollectionsChange([...selectedCollections, newCollection]);
      setInputValue('');
      setShowSuggestions(false);
    } catch (error) {
      console.error('Failed to create collection:', error);
    } finally {
      setIsCreating(false);
    }
  }, [inputValue, selectedCollections, onCollectionsChange]);

  const handleSelectExistingCollection = useCallback((collection: Collection) => {
    onCollectionsChange([...selectedCollections, collection]);
    setInputValue('');
    setShowSuggestions(false);
  }, [selectedCollections, onCollectionsChange]);

  const handleRemoveCollection = useCallback((collectionId: string) => {
    onCollectionsChange(selectedCollections.filter(c => c.id !== collectionId));
  }, [selectedCollections, onCollectionsChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (matchingCollection) {
        handleSelectExistingCollection(matchingCollection);
      } else if (inputValue.trim()) {
        handleCreateCollection();
      }
    } else if (event.key === 'Escape') {
      setShowSuggestions(false);
    }
  }, [inputValue, matchingCollection, handleSelectExistingCollection, handleCreateCollection]);

  return (
    <div ref={wrapperRef} className={className}>
      {/* Selected Collections Display */}
      {selectedCollections.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedCollections.map(collection => (
            <span
              key={collection.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200"
            >
              <Book size={12} />
              {collection.name}
              {collection.isSmart && <Badge variant="primary">Smart</Badge>}
              <button
                type="button"
                onClick={() => handleRemoveCollection(collection.id)}
                className="ml-1 hover:opacity-70 transition-opacity"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search or create collection..."
              className="input pl-9 pr-4"
            />
          </div>
          
          <Button 
            onClick={handleCreateCollection} 
            disabled={!inputValue.trim() || isCreating || !!matchingCollection}
            size="sm"
          >
            <Plus size={16} />
            Add
          </Button>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && (filteredCollections.length > 0 || (inputValue.trim() && !matchingCollection)) && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {/* Existing Collections */}
            {filteredCollections.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  Existing Collections
                </div>
                {filteredCollections.map(collection => {
                  const isSelected = selectedCollections.some(c => c.id === collection.id);
                  return (
                    <button
                      key={collection.id}
                      type="button"
                      onClick={() => handleSelectExistingCollection(collection)}
                      disabled={isSelected}
                      className={clsx(
                        'w-full px-3 py-2 text-left flex items-center gap-2',
                        isSelected 
                          ? 'bg-primary-50 dark:bg-primary-900 opacity-50' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                    >
                      <Book size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-white">{collection.name}</span>
              {collection.isSmart && <Badge variant="primary">Smart</Badge>}
                      {isSelected && <span className="ml-auto text-xs text-primary-600">Selected</span>}
                    </button>
                  );
                })}
              </>
            )}

            {/* Create New Collection Option */}
            {inputValue.trim() && !matchingCollection && (
              <button
                type="button"
                onClick={handleCreateCollection}
                disabled={isCreating}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-primary-50 dark:hover:bg-primary-900 border-t border-gray-200 dark:border-gray-700"
              >
                <Plus size={16} className="text-primary-600" />
                <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                  Create new collection &quot;{inputValue.trim()}&quot;
                </span>
              </button>
            )}

            {/* Empty State */}
            {allCollections.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                No collections yet. Create your first one above!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}