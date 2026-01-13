/**
 * Auth Error Page
 * 
 * Displays authentication errors with helpful messages.
 */

import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Button';

export function AuthErrorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const errorConfigs: Record<string, { title: string; message: string; suggestion: string }> = {
    Configuration: {
      title: 'Configuration Error',
      message: 'There is a problem with the server configuration.',
      suggestion: 'Please contact the administrator to fix this issue.',
    },
    AccessDenied: {
      title: 'Access Denied',
      message: 'You do not have permission to sign in.',
      suggestion: 'Please contact the administrator if you believe this is an error.',
    },
    Verification: {
      title: 'Verification Failed',
      message: 'The verification link has expired or has already been used.',
      suggestion: 'Please try signing in again to receive a new verification link.',
    },
    SessionRequired: {
      title: 'Session Required',
      message: 'You must be signed in to access this page.',
      suggestion: 'Please sign in and try again.',
    },
    Default: {
      title: 'Authentication Error',
      message: errorDescription || 'An unexpected error occurred during authentication.',
      suggestion: 'Please try signing in again or contact support if the problem persists.',
    },
  };

  const config = errorConfigs[error || 'Default'];

  const handleRetry = () => {
    navigate('/auth/signin');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-3">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
        </div>
        
        <h1 className="mt-4 text-center text-2xl font-bold text-gray-900 dark:text-white">
          {config.title}
        </h1>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <Card className="py-8 px-4 shadow sm:px-10">
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400">
                {config.message}
              </p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Suggestion:</strong> {config.suggestion}
              </p>
            </div>

            {error && (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Error code: {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleRetry}
                className="flex-1"
                variant="secondary"
              >
                <RefreshCw size={16} className="mr-2" />
                Try Again
              </Button>
              
              <Button
                onClick={handleGoHome}
                className="flex-1"
              >
                <Home size={16} className="mr-2" />
                Go Home
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default AuthErrorPage;
