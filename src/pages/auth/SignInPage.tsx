/**
 * Sign In Page
 * 
 * OAuth sign in page with provider buttons.
 * Integrates with NextAuth.js for authentication.
 */

import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { LoginButton } from '../../components/auth/LoginButton';
import { Card } from '../../components/common/Button';

export function SignInPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages: Record<string, string> = {
    Configuration: 'There is a problem with the server configuration.',
    AccessDenied: 'Access was denied. You may not have permission to sign in.',
    Verification: 'The verification link may have expired or already been used.',
    Default: 'An error occurred during sign in. Please try again.',
  };

  const getErrorMessage = (errorKey: string) => {
    return errorMessages[errorKey] || errorMessages.Default;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Sign in to Booky
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Manage your book collection securely
        </p>
      </div>

      {error && (
        <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Sign in failed
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <p>{getErrorMessage(error)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <Card className="py-8 px-4 shadow sm:px-10">
          <div className="space-y-6">
            <div className="space-y-4">
              <LoginButton
                provider="google"
                className="w-full"
                variant="outline"
              />
              
              {import.meta.env.VITE_AUTH_ENABLE_GITHUB === 'true' && (
                <LoginButton
                  provider="github"
                  className="w-full"
                  variant="outline"
                />
              )}
              
              {import.meta.env.VITE_AUTH_ENABLE_DISCORD === 'true' && (
                <LoginButton
                  provider="discord"
                  className="w-full"
                  variant="outline"
                />
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                For demo purposes, use the Google OAuth provider with a test account.
              </p>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <ArrowLeft size={16} className="mr-1" />
                Go back
              </button>
            </div>
          </div>
        </Card>

        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          By signing in, you agree to our{' '}
          <a href="/terms" className="text-primary-600 hover:text-primary-500">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-primary-600 hover:text-primary-500">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}

export default SignInPage;
