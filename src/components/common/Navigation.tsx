import { Book, Library, Plus, Settings, BarChart2, Menu, X, Home, History } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useUIStore, useModalStore } from '../../store/useStore';
import { useIsTouchDevice } from '../../hooks/useOffline';
import { clsx } from 'clsx';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  action?: () => void;
}

export function BottomNavigation() {
  const location = useLocation();
  const { mobileNavOpen, toggleMobileNav } = useUIStore();
  const { openModal } = useModalStore();
  const isTouchDevice = useIsTouchDevice();
  
  // Only show bottom navigation on touch devices
  if (!isTouchDevice) {
    return null;
  }
  
  const navItems: NavItem[] = [
    { icon: <Home size={24} />, label: 'Home', path: '/' },
    { icon: <Library size={24} />, label: 'Library', path: '/library' },
    { 
      icon: <Plus size={24} />, 
      label: 'Add Book', 
      path: '/add',
      action: () => openModal('addBook')
    },
    { icon: <History size={24} />, label: 'History', path: '/history' },
    { icon: <BarChart2 size={24} />, label: 'Analytics', path: '/analytics' },
    { icon: <Settings size={24} />, label: 'Settings', path: '/settings' },
  ];
  
  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={(e) => {
                  if (item.action) {
                    e.preventDefault();
                    item.action();
                  }
                }}
                className={clsx(
                  'flex flex-col items-center justify-center flex-1 h-full',
                  'transition-colors duration-200',
                  isActive 
                    ? 'text-primary-600 dark:text-primary-400' 
                    : 'text-gray-500 dark:text-gray-400'
                )}
              >
                {item.icon}
                <span className="text-xs mt-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      
      {/* Mobile Menu Toggle */}
      <button
        onClick={toggleMobileNav}
        className="lg:hidden fixed bottom-20 right-4 z-50 btn-icon bg-primary-600 text-white shadow-lg"
        aria-label="Toggle menu"
      >
        {mobileNavOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
    </>
  );
}

export function SidebarNavigation() {
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const isTouchDevice = useIsTouchDevice();
  
  // Only show sidebar on non-touch devices (desktop)
  if (isTouchDevice) {
    return null;
  }
  
  const navItems: NavItem[] = [
    { icon: <Home size={20} />, label: 'Home', path: '/' },
    { icon: <Library size={20} />, label: 'Library', path: '/library' },
    { icon: <History size={20} />, label: 'History', path: '/history' },
    { icon: <BarChart2 size={20} />, label: 'Analytics', path: '/analytics' },
    { icon: <Settings size={20} />, label: 'Settings', path: '/settings' },
  ];
  
  if (!sidebarOpen) {
    return (
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-40 btn-icon bg-white dark:bg-gray-800 shadow-md"
        aria-label="Open sidebar"
      >
        <Menu size={24} />
      </button>
    );
  }
  
  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={() => setSidebarOpen(false)}
      />
      
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Book className="text-primary-600" size={32} />
            <div>
              <h1 className="text-xl font-bold">Book Collection</h1>
              <p className="text-sm text-gray-500">Your personal library</p>
            </div>
          </div>
        </div>
        
        <nav className="p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 rounded-lg',
                      'transition-all duration-200',
                      isActive
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                  >
                    {item.icon}
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-full btn-secondary text-sm"
          >
            Collapse Sidebar
          </button>
        </div>
      </aside>
    </>
  );
}
