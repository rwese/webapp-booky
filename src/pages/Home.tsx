import { Link } from 'react-router-dom';
import { Book, Plus, ArrowRight, Library, TrendingUp, Clock } from 'lucide-react';
import { Card, Badge } from '../components/common/Button';
import { useBooks } from '../hooks/useBooks';
import { useReadingStats } from '../hooks/useBooks';
import { useSyncStatus } from '../hooks/useSync';
import { useNavigate } from 'react-router-dom';

export function HomePage() {
  const books = useBooks();
  const { totalCompleted, totalInProgress, totalWantToRead } = useReadingStats();
  const { isOnline, pendingCount } = useSyncStatus();
  const navigate = useNavigate();
  
  const recentBooks = books?.slice(0, 3) || [];
  
  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
            Welcome Back
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Here's an overview of your book collection
          </p>
        </div>
      </header>
      
      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Library className="text-blue-500" />}
            label="Total Books"
            value={books?.length || 0}
            color="blue"
          />
          <StatCard
            icon={<Clock className="text-yellow-500" />}
            label="Currently Reading"
            value={totalInProgress}
            color="yellow"
          />
          <StatCard
            icon={<Book className="text-green-500" />}
            label="Completed"
            value={totalCompleted}
            color="green"
          />
          <StatCard
            icon={<TrendingUp className="text-purple-500" />}
            label="Want to Read"
            value={totalWantToRead}
            color="purple"
          />
        </div>
        
        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ActionCard
              icon={<Plus className="text-primary-600" size={24} />}
              title="Add New Book"
              description="Search or scan a book to add to your collection"
              onClick={() => navigate('/add')}
            />
            <ActionCard
              icon={<Library className="text-primary-600" size={24} />}
              title="Browse Library"
              description="View and manage your entire book collection"
              onClick={() => navigate('/library')}
            />
            <ActionCard
              icon={<TrendingUp className="text-primary-600" size={24} />}
              title="View Analytics"
              description="See insights about your reading habits"
              onClick={() => navigate('/analytics')}
            />
          </div>
        </div>
        
        {/* Recent Books */}
        {recentBooks.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recently Added
              </h2>
              <Link 
                to="/library" 
                className="text-primary-600 hover:text-primary-700 dark:text-primary-400 text-sm font-medium flex items-center gap-1"
              >
                View all
                <ArrowRight size={16} />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentBooks.map((book) => (
                <BookCard key={book.id} book={book} navigate={navigate} />
              ))}
            </div>
          </div>
        )}
        
        {/* Empty State */}
        {(!books || books.length === 0) && (
          <EmptyState
            icon={<Library size={48} />}
            title="No books yet"
            description="Start building your collection by adding your first book"
            action={
              <button
                type="button"
                onClick={() => navigate('/add')}
                className="btn-primary"
              >
                <Plus size={20} />
                Add Your First Book
              </button>
            }
          />
        )}
        
        {/* Sync Status */}
        <div className="mt-8 flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          {pendingCount > 0 && (
            <Badge variant="warning">
              {pendingCount} pending sync
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'blue' | 'green' | 'yellow' | 'purple';
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
  };
  
  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
}

function ActionCard({ icon, title, description, onClick }: ActionCardProps) {
  return (
    <Card hover className="p-4 cursor-pointer" onClick={onClick}>
      <div className="flex items-start gap-4">
        <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
        </div>
      </div>
    </Card>
  );
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">{description}</p>
      {action}
    </div>
  );
}

interface BookCardProps {
  book: {
    id: string;
    title: string;
    authors: string[];
    coverUrl?: string;
    format: string;
  };
  navigate: ReturnType<typeof useNavigate>;
}

function BookCard({ book, navigate }: BookCardProps) {
  return (
    <Card hover className="overflow-hidden" onClick={() => navigate(`/book/${book.id}`)}>
      <div className="flex p-4 gap-4">
        <div className="flex-shrink-0 w-16 h-24 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
          {book.coverUrl ? (
            <img 
              src={book.coverUrl} 
              alt={book.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Book className="text-gray-400" size={24} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white truncate">{book.title}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {book.authors.join(', ')}
          </p>
          <Badge variant="neutral" className="mt-2">
            {book.format}
          </Badge>
        </div>
      </div>
    </Card>
  );
}
