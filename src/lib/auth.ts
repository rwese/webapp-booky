/**
 * NextAuth.js Configuration
 * 
 * This module provides OAuth authentication using NextAuth.js v4.
 * Designed for use with React + Vite frontend.
 */

import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import DiscordProvider from 'next-auth/providers/discord';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { NextAuthOptions } from 'next-auth';

// Environment variables check
const AUTH_SECRET = process.env.AUTH_SECRET || 'development-secret-change-in-production';

// Provider configuration
const providers = [
  // Google OAuth
  process.env.AUTH_ENABLE_GOOGLE === 'true' && GoogleProvider({
    clientId: process.env.AUTH_GOOGLE_ID || '',
    clientSecret: process.env.AUTH_GOOGLE_SECRET || '',
    authorization: {
      params: {
        prompt: 'consent',
        access_type: 'offline',
        response_type: 'code'
      }
    }
  }),

  // GitHub OAuth
  process.env.AUTH_ENABLE_GITHUB === 'true' && GithubProvider({
    clientId: process.env.AUTH_GITHUB_ID || '',
    clientSecret: process.env.AUTH_GITHUB_SECRET || '',
  }),

  // Discord OAuth
  process.env.AUTH_ENABLE_DISCORD === 'true' && DiscordProvider({
    clientId: process.env.AUTH_DISCORD_ID || '',
    clientSecret: process.env.AUTH_DISCORD_SECRET || '',
  }),
].filter(Boolean) as any[];

// Extended session type with user ID
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    accessToken?: string;
    error?: string;
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}

/**
 * NextAuth.js Configuration
 * 
 * Features:
 * - Multiple OAuth providers (Google, GitHub, Discord)
 * - JWT-based sessions with refresh token support
 * - Protected routes support
 * - Custom user session data
 */
export const authConfig: NextAuthOptions = {
  providers,
  secret: AUTH_SECRET,
  callbacks: {
    /**
     * JWT callback - called when creating or updating JWT token
     */
    async jwt({ token, user, account }) {
      // Initial sign in
      if (user && account) {
        token.id = user.id;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at 
          ? (account.expires_at as number) * 1000 
          : Date.now() + ((account.expires_in as number) || 3600) * 1000;
      }

      return token;
    },

    /**
     * Session callback - called when creating session
     */
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.accessToken = token.accessToken;
        session.error = token.error;
      }
      return session;
    },

    /**
     * Redirect callback - control redirect after sign in/out
     */
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },

    /**
     * Sign in callback - control who can sign in
     */
    async signIn({ user, account, profile }) {
      // Allow sign in from configured providers
      if (account?.provider) {
        const providerEnabled = process.env[`AUTH_ENABLE_${account.provider.toUpperCase()}`];
        if (providerEnabled !== 'true') {
          return false;
        }
      }
      return true;
    }
  },

  events: {
    /**
     * Create user event - called when new user is created
     */
    async createUser({ user }) {
      console.log('New user created:', user.email);
    },

    /**
     * Sign in event - called on successful sign in
     */
    async signIn({ user, account, isNewUser }) {
      console.log(`User signed in: ${user.email} via ${account?.provider}`);
    },

    /**
     * Sign out event - called on sign out
     */
    async signOut({ token }) {
      console.log('User signed out');
    }
  },

  session: {
    strategy: (process.env.AUTH_SESSION_STRATEGY === 'database') ? ('database' as const) : ('jwt' as const),
    maxAge: parseInt(process.env.AUTH_SESSION_MAX_AGE || '2592000'),
    updateAge: 86400,
  },

  debug: process.env.AUTH_DEBUG === 'true',
};

export default authConfig;
