/**
 * Protected Route Component
 * 
 * Wraps routes that require authentication.
 * Redirects to sign in page if not authenticated.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

interface ProtectedRouteProps {
  // Optional: roles/permissions required
  allowedRoles?: string[];
  // Optional: redirect to specific URL instead of default
  redirectTo?: string;
  // Optional: show loading state
  showLoading?: boolean;
}

export function ProtectedRoute({
  allowedRoles,
  redirectTo = '/auth/signin',
  showLoading = true,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // If still loading, wait
    if (isLoading) {
      return;
    }

    setIsChecking(false);

    // Check authentication
    if (!isAuthenticated) {
      // Redirect to sign in, preserving the intended destination
      navigate(redirectTo, {
        state: { from: location.pathname },
        replace: true,
      });
      return;
    }

    // Check roles if specified
    if (allowedRoles && allowedRoles.length > 0) {
      const userRole = session?.user?.email?.includes('admin') ? 'admin' : 'user';
      if (!allowedRoles.includes(userRole)) {
        // User doesn't have required role
        navigate('/unauthorized', { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, allowedRoles, session, navigate, redirectTo, location]);

  // Show loading state
  if (showLoading && (isLoading || isChecking)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-primary-600" size={48} />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Verifying authentication...
          </p>
        </div>
      </div>
    );
  }

  // If not authenticated, the useEffect will redirect
  if (!isAuthenticated) {
    return null;
  }

  // Render child routes
  return <Outlet />;
}

/**
 * Higher-Order Component for protecting routes
 * 
 * @deprecated Use ProtectedRoute with Outlet instead
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: ProtectedRouteProps
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        navigate(options?.redirectTo || '/auth/signin', { replace: true });
      }
    }, [isAuthenticated, isLoading, navigate, options]);

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="animate-spin mx-auto text-primary-600" size={48} />
        </div>
      );
    }

    if (!isAuthenticated) {
      return null;
    }

    return <Component {...props} />;
  };
}

/**
 * Route guard hook
 * 
 * Use this hook to protect individual components within a page.
 */
export function useAuthGuard(options?: {
  redirectTo?: string;
  onDenied?: () => void;
}): boolean {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      if (options?.onDenied) {
        options.onDenied();
      } else {
        navigate(options?.redirectTo || '/auth/signin', { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, navigate, options]);

  return isAuthenticated && !isLoading;
}

export default ProtectedRoute;
