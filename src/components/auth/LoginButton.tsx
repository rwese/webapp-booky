/**
 * Login Button Component
 * 
 * Provides OAuth login buttons for supported providers.
 * Supports Google, GitHub, and Discord.
 */

import React, { useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface LoginButtonProps {
  provider?: 'google' | 'github' | 'discord';
  callbackUrl?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

export function LoginButton({
  provider = 'google',
  callbackUrl = '/',
  className = '',
  variant = 'primary',
  size = 'md',
  children
}: LoginButtonProps) {
  const { signIn, isLoading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Provider configurations
  const providerConfig = {
    google: {
      label: 'Continue with Google',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      ),
      bgColor: 'bg-white hover:bg-gray-50',
      textColor: 'text-gray-900',
      borderColor: 'border-gray-300'
    },
    github: {
      label: 'Continue with GitHub',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      ),
      bgColor: 'bg-gray-900 hover:bg-gray-800',
      textColor: 'text-white',
      borderColor: 'border-transparent'
    },
    discord: {
      label: 'Continue with Discord',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
      ),
      bgColor: 'bg-[#5865F2] hover:bg-[#4752C4]',
      textColor: 'text-white',
      borderColor: 'border-transparent'
    }
  };

  const config = providerConfig[provider];

  const handleClick = async () => {
    if (isSigningIn || isLoading) return;
    
    setIsSigningIn(true);
    try {
      await signIn(provider);
      // Redirect will happen automatically
    } catch (error) {
      console.error('Sign in failed:', error);
    } finally {
      setIsSigningIn(false);
    }
  };

  // Size configurations
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2.5 text-base gap-2',
    lg: 'px-6 py-3 text-lg gap-2.5'
  };

  // Variant configurations
  const variantClasses = {
    primary: `${config.bgColor} ${config.textColor} ${config.borderColor} border`,
    secondary: 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600',
    outline: 'bg-transparent text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isSigningIn || isLoading}
      className={`
        inline-flex items-center justify-center font-medium rounded-lg
        transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {isSigningIn || isLoading ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          {children || 'Signing in...'}
        </>
      ) : (
        <>
          {config.icon}
          {children || config.label}
        </>
      )}
    </button>
  );
}

/**
 * Logout Button Component
 */
interface LogoutButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

export function LogoutButton({
  className = '',
  variant = 'outline',
  size = 'md',
  children
}: LogoutButtonProps) {
  const { signOut, isLoading } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleClick = async () => {
    if (isSigningOut || isLoading) return;
    
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2.5 text-base gap-2',
    lg: 'px-6 py-3 text-lg gap-2.5'
  };

  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 border border-transparent',
    secondary: 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600',
    outline: 'bg-transparent text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800',
    ghost: 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isSigningOut || isLoading}
      className={`
        inline-flex items-center justify-center font-medium rounded-lg
        transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {isSigningOut || isLoading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <>
          <LogIn size={18} />
          {children || 'Sign Out'}
        </>
      )}
    </button>
  );
}

/**
 * Auth Status Component
 * Shows current user info and login/logout buttons
 */
interface AuthStatusProps {
  showAvatar?: boolean;
  showEmail?: boolean;
  loginButtonVariant?: 'primary' | 'secondary' | 'outline';
  loginButtonSize?: 'sm' | 'md' | 'lg';
}

export function AuthStatus({
  showAvatar = true,
  showEmail = true,
  loginButtonVariant = 'primary',
  loginButtonSize = 'md'
}: AuthStatusProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="animate-pulse flex items-center gap-2">
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-3">
        {showAvatar && (
          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center overflow-hidden">
            {user.image ? (
              <img src={user.image} alt={user.name || 'User'} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                {user.name?.charAt(0) || user.email?.charAt(0) || '?'}
              </span>
            )}
          </div>
        )}
        {showEmail && user.email && (
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
            {user.email}
          </span>
        )}
        <LogoutButton size="sm" variant="ghost" />
      </div>
    );
  }

  return (
    <LoginButton
      provider="google"
      variant={loginButtonVariant}
      size={loginButtonSize}
    />
  );
}

export default LoginButton;
