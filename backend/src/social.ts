/**
 * Social Features Service
 * 
 * Handles user profiles, collection sharing, recommendations,
 * reading challenges, and social permissions.
 */

import { PrismaClient, User, Collection, Book, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// ============================================================================
// Types
// ============================================================================

export interface PublicProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  booksRead: number;
  collectionsShared: number;
  joinedAt: string;
}

export interface CollectionShare {
  id: string;
  collectionId: string;
  sharedWithUserId: string;
  permission: 'view' | 'edit';
  sharedAt: string;
  sharedBy: string;
}

export interface ShareLink {
  id: string;
  collectionId: string;
  token: string;
  expiresAt: string | null;
  viewCount: number;
  maxViews: number | null;
  allowEdit: boolean;
  createdAt: string;
}

export interface BookRecommendation {
  bookId: string;
  title: string;
  authors: string[];
  coverUrl?: string;
  reason: string;
  score: number;
}

export interface ReadingChallenge {
  id: string;
  userId: string;
  name: string;
  description?: string;
  targetBooks: number;
  currentBooks: number;
  startDate: string;
  endDate: string;
  isCompleted: boolean;
  completedAt?: string;
  createdAt: string;
}

export interface ChallengeParticipant {
  challengeId: string;
  userId: string;
  booksRead: number;
  progress: number;
  lastUpdated: string;
}

// ============================================================================
// User Profiles
// ============================================================================

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  const booksRead = await prisma.readingLog.count({
    where: { userId, status: 'read' },
  });

  const collectionsShared = await prisma.collection.count({
    where: { 
      userId,
      isPublic: true,
    },
  });

  return {
    id: user.id,
    name: user.name || 'Anonymous',
    avatarUrl: user.image || undefined,
    bio: user.bio || undefined,
    booksRead,
    collectionsShared,
    joinedAt: user.createdAt.toISOString(),
  };
}

export async function updateProfile(
  userId: string,
  data: { name?: string; bio?: string; avatarUrl?: string }
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      bio: data.bio,
      image: data.avatarUrl,
    },
  });
}

export async function followUser(userId: string, targetUserId: string): Promise<void> {
  if (userId === targetUserId) {
    throw new Error('Cannot follow yourself');
  }

  await prisma.userFollow.create({
    data: {
      followerId: userId,
      followingId: targetUserId,
    },
  });
}

export async function unfollowUser(userId: string, targetUserId: string): Promise<void> {
  await prisma.userFollow.deleteMany({
    where: {
      followerId: userId,
      followingId: targetUserId,
    },
  });
}

export async function getFollowers(userId: string, page = 1, limit = 20) {
  const follows = await prisma.userFollow.findMany({
    where: { followingId: userId },
    include: {
      follower: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  return follows.map((f: any) => ({
    userId: f.follower.id,
    name: f.follower.name,
    avatarUrl: f.follower.image,
    followedAt: f.createdAt.toISOString(),
  }));
}

export async function getFollowing(userId: string, page = 1, limit = 20) {
  const follows = await prisma.userFollow.findMany({
    where: { followerId: userId },
    include: {
      following: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  return follows.map((f: any) => ({
    userId: f.following.id,
    name: f.following.name,
    avatarUrl: f.following.image,
    followedAt: f.createdAt.toISOString(),
  }));
}

export async function isFollowing(userId: string, targetUserId: string): Promise<boolean> {
  const follow = await prisma.userFollow.findUnique({
    where: {
      followerId_followingId: {
        followerId: userId,
        followingId: targetUserId,
      },
    },
  });
  return !!follow;
}

// ============================================================================
// Collection Sharing
// ============================================================================

export async function shareCollectionWithUser(
  collectionId: string,
  userId: string,
  targetUserId: string,
  permission: 'view' | 'edit'
): Promise<CollectionShare> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
  });

  if (!collection || collection.userId !== userId) {
    throw new Error('Collection not found or access denied');
  }

  const existing = await prisma.collectionShare.findUnique({
    where: {
      collectionId_sharedWithUserId: {
        collectionId,
        sharedWithUserId: targetUserId,
      },
    },
  });

  if (existing) {
    const updated = await prisma.collectionShare.update({
      where: { id: existing.id },
      data: { permission },
    });
    
    return {
      id: updated.id,
      collectionId: updated.collectionId,
      sharedWithUserId: updated.sharedWithUserId,
      permission: updated.permission as 'view' | 'edit',
      sharedAt: updated.createdAt.toISOString(),
      sharedBy: userId,
    };
  }

  const share = await prisma.collectionShare.create({
    data: {
      collectionId,
      sharedWithUserId: targetUserId,
      permission,
    },
  });

  return {
    id: share.id,
    collectionId: share.collectionId,
    sharedWithUserId: share.sharedWithUserId,
    permission: share.permission as 'view' | 'edit',
    sharedAt: share.createdAt.toISOString(),
    sharedBy: userId,
  };
}

export async function revokeCollectionShare(
  collectionId: string,
  userId: string,
  targetUserId: string
): Promise<void> {
  await prisma.collectionShare.deleteMany({
    where: {
      collectionId,
      sharedWithUserId: targetUserId,
      collection: { userId },
    },
  });
}

export async function getCollectionShares(collectionId: string, userId: string) {
  const shares = await prisma.collectionShare.findMany({
    where: {
      collectionId,
      collection: { userId },
    },
    include: {
      sharedWith: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  return shares.map((s: any) => ({
    userId: s.sharedWith.id,
    name: s.sharedWith.name,
    avatarUrl: s.sharedWith.image,
    permission: s.permission,
    sharedAt: s.createdAt.toISOString(),
  }));
}

export async function createShareLink(
  collectionId: string,
  userId: string,
  options?: { expiresAt?: string; maxViews?: number; allowEdit?: boolean }
): Promise<ShareLink> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
  });

  if (!collection || collection.userId !== userId) {
    throw new Error('Collection not found or access denied');
  }

  const shareLink = await prisma.shareLink.create({
    data: {
      collectionId,
      token: uuidv4(),
      expiresAt: options?.expiresAt ? new Date(options.expiresAt) : null,
      maxViews: options?.maxViews || null,
      allowEdit: options?.allowEdit || false,
    },
  });

  return {
    id: shareLink.id,
    collectionId: shareLink.collectionId,
    token: shareLink.token,
    expiresAt: shareLink.expiresAt?.toISOString() ?? null,
    viewCount: shareLink.viewCount,
    maxViews: shareLink.maxViews,
    allowEdit: shareLink.allowEdit,
    createdAt: shareLink.createdAt.toISOString(),
  };
}

export async function accessViaShareLink(token: string): Promise<{
  collection: Collection;
  permission: 'view' | 'edit';
}> {
  const shareLink = await prisma.shareLink.findUnique({
    where: { token },
    include: { collection: true },
  });

  if (!shareLink) {
    throw new Error('Invalid or expired share link');
  }

  if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
    throw new Error('Share link has expired');
  }

  if (shareLink.maxViews && shareLink.viewCount >= shareLink.maxViews) {
    throw new Error('Share link view limit reached');
  }

  await prisma.shareLink.update({
    where: { id: shareLink.id },
    data: { viewCount: { increment: 1 } },
  });

  return {
    collection: shareLink.collection,
    permission: shareLink.allowEdit ? 'edit' : 'view',
  };
}

export async function makeCollectionPublic(collectionId: string, userId: string): Promise<void> {
  await prisma.collection.update({
    where: { id: collectionId, userId },
    data: { isPublic: true },
  });
}

export async function makeCollectionPrivate(collectionId: string, userId: string): Promise<void> {
  await prisma.collection.update({
    where: { id: collectionId, userId },
    data: { isPublic: false },
  });
}

export async function getPublicCollections(page = 1, limit = 20) {
  const collections = await prisma.collection.findMany({
    where: { isPublic: true },
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
      books: {
        take: 5,
      },
    },
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { updatedAt: 'desc' },
  });

  return collections.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    coverImage: c.coverImage,
    bookCount: c.books.length,
    owner: {
      id: c.user.id,
      name: c.user.name,
      avatarUrl: c.user.image || undefined,
    },
    updatedAt: c.updatedAt.toISOString(),
  }));
}

// ============================================================================
// Book Recommendations
// ============================================================================

export async function getRecommendations(userId: string, limit = 10): Promise<BookRecommendation[]> {
  const readBooks = await prisma.book.findMany({
    where: { userId, localOnly: false },
    select: {
      id: true,
      title: true,
      authors: true,
      categories: true,
      subjects: true,
      tags: true,
    },
    take: 50,
  });

  if (readBooks.length === 0) {
    return getPopularBooks(limit);
  }

  const categories = new Set<string>();
  const subjects = new Set<string>();
  const tags = new Set<string>();
  const readBookIds = new Set(readBooks.map(b => b.id));

  readBooks.forEach(book => {
    book.categories?.forEach(c => categories.add(c));
    book.subjects?.forEach(s => subjects.add(s));
    book.tags?.forEach(t => tags.add(t));
  });

  const recommendations = await prisma.book.findMany({
    where: {
      userId: { not: userId },
      id: { notIn: Array.from(readBookIds) },
      OR: [
        { authors: { hasSome: readBooks.flatMap(b => b.authors) } },
        { categories: { hasSome: Array.from(categories) } },
        { subjects: { hasSome: Array.from(subjects) } },
        { tags: { hasSome: Array.from(tags) } },
      ],
    },
    take: limit * 3,
  });

  const scored = recommendations.map(book => {
    let score = 0;
    let reason = '';

    const sharedAuthors = book.authors.filter(a => 
      readBooks.some(rb => rb.authors.includes(a))
    );
    if (sharedAuthors.length > 0) {
      score += sharedAuthors.length * 3;
      reason = `Same author${sharedAuthors.length > 1 ? 's' : ''}: ${sharedAuthors.join(', ')}`;
    }

    const sharedCategories = (book.categories || []).filter(c => categories.has(c));
    if (sharedCategories.length > 0) {
      score += sharedCategories.length * 2;
      reason = reason || `Similar categories: ${sharedCategories.join(', ')}`;
    }

    const sharedSubjects = (book.subjects || []).filter(s => subjects.has(s));
    if (sharedSubjects.length > 0) {
      score += sharedSubjects.length * 1;
      reason = reason || `Related subjects: ${sharedSubjects.join(', ')}`;
    }

    const sharedTags = (book.tags || []).filter(t => tags.has(t));
    if (sharedTags.length > 0) {
      score += sharedTags.length * 1.5;
      reason = reason || `Similar tags: ${sharedTags.join(', ')}`;
    }

    return {
      bookId: book.id,
      title: book.title,
      authors: book.authors,
      coverUrl: book.coverUrl || undefined,
      reason: reason || 'Based on your reading history',
      score,
    };
  });

  return scored
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function getPopularBooks(limit: number): Promise<BookRecommendation[]> {
  const books = await prisma.book.findMany({
    where: { localOnly: false },
    take: limit * 2,
    orderBy: { ratingsCount: 'desc' },
  });

  return books.slice(0, limit).map(book => ({
    bookId: book.id,
    title: book.title,
    authors: book.authors,
    coverUrl: book.coverUrl || undefined,
    reason: 'Popular among readers',
    score: book.ratingsCount || 0,
  }));
}

export async function getSimilarBooks(bookId: string, limit = 5): Promise<BookRecommendation[]> {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
  });

  if (!book) return [];

  const books = await prisma.book.findMany({
    where: {
      id: { not: bookId },
      userId: { not: book.userId },
      OR: [
        { authors: { hasSome: book.authors } },
        { categories: { hasSome: book.categories || [] } },
        { subjects: { hasSome: book.subjects || [] } },
        { tags: { hasSome: book.tags || [] } },
      ],
    },
    take: limit * 2,
  });

  const scored = books.map(b => {
    let score = 0;
    const sharedAuthors = b.authors.filter(a => book.authors.includes(a));
    score += sharedAuthors.length * 3;
    const sharedCategories = (b.categories || []).filter(c => (book.categories || []).includes(c));
    score += sharedCategories.length * 2;

    return {
      bookId: b.id,
      title: b.title,
      authors: b.authors,
      coverUrl: b.coverUrl || undefined,
      reason: `Similar to "${book.title}"`,
      score,
    };
  });

  return scored
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ============================================================================
// Reading Challenges
// ============================================================================

export async function createChallenge(
  userId: string,
  data: {
    name: string;
    description?: string;
    targetBooks: number;
    startDate: string;
    endDate: string;
  }
): Promise<ReadingChallenge> {
  const challenge = await prisma.readingChallenge.create({
    data: {
      userId,
      name: data.name,
      description: data.description,
      targetBooks: data.targetBooks,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    },
  });

  return {
    id: challenge.id,
    userId: challenge.userId,
    name: challenge.name,
    description: challenge.description || undefined,
    targetBooks: challenge.targetBooks,
    currentBooks: challenge.currentBooks,
    startDate: challenge.startDate.toISOString(),
    endDate: challenge.endDate.toISOString(),
    isCompleted: challenge.isCompleted,
    completedAt: challenge.completedAt?.toISOString(),
    createdAt: challenge.createdAt.toISOString(),
  };
}

export async function getUserChallenges(userId: string) {
  const challenges = await prisma.readingChallenge.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return challenges.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    targetBooks: c.targetBooks,
    currentBooks: c.currentBooks,
    progress: c.targetBooks > 0 ? Math.round((c.currentBooks / c.targetBooks) * 100) : 0,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate.toISOString(),
    isCompleted: c.isCompleted,
    completedAt: c.completedAt?.toISOString(),
    createdAt: c.createdAt.toISOString(),
  }));
}

export async function updateChallengeProgress(challengeId: string): Promise<void> {
  const challenge = await prisma.readingChallenge.findUnique({
    where: { id: challengeId },
    include: { user: true },
  });

  if (!challenge || challenge.isCompleted) return;

  const booksRead = await prisma.readingLog.count({
    where: {
      userId: challenge.userId,
      status: 'read',
      updatedAt: {
        gte: challenge.startDate,
        lte: challenge.endDate,
      },
    },
  });

  const isCompleted = booksRead >= challenge.targetBooks;

  await prisma.readingChallenge.update({
    where: { id: challengeId },
    data: {
      currentBooks: booksRead,
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
    },
  });
}

export async function joinCommunityChallenge(
  challengeId: string,
  userId: string
): Promise<ChallengeParticipant> {
  const existing = await prisma.challengeParticipant.findUnique({
    where: {
      challengeId_userId: {
        challengeId,
        userId,
      },
    },
  });

  if (existing) {
    return {
      challengeId: existing.challengeId,
      userId: existing.userId,
      booksRead: existing.booksRead,
      progress: existing.progress,
      lastUpdated: existing.lastUpdated.toISOString(),
    };
  }

  const participant = await prisma.challengeParticipant.create({
    data: {
      challengeId,
      userId,
    },
  });

  return {
    challengeId: participant.challengeId,
    userId: participant.userId,
    booksRead: 0,
    progress: 0,
    lastUpdated: participant.lastUpdated.toISOString(),
  };
}

export async function getChallengeLeaderboard(challengeId: string, limit = 10) {
  const participants = await prisma.challengeParticipant.findMany({
    where: { challengeId },
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
    },
    orderBy: { booksRead: 'desc' },
    take: limit,
  });

  return participants.map((p: any, index: number) => ({
    rank: index + 1,
    userId: p.user.id,
    name: p.user.name,
    avatarUrl: p.user.image || undefined,
    booksRead: p.booksRead,
    progress: p.progress,
  }));
}

export async function getPublicChallenges(page = 1, limit = 20) {
  const challenges = await prisma.readingChallenge.findMany({
    where: { isPublic: true },
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
      _count: {
        select: { participants: true },
      },
    },
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  return challenges.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    targetBooks: c.targetBooks,
    currentBooks: c.currentBooks,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate.toISOString(),
    isCompleted: c.isCompleted,
    participantCount: c._count.participants,
    owner: {
      id: c.user.id,
      name: c.user.name,
      avatarUrl: c.user.image || undefined,
    },
  }));
}

// ============================================================================
// Activity Feed
// ============================================================================

export async function getActivityFeed(userId: string, page = 1, limit = 20) {
  const following = await prisma.userFollow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });

  const followingIds = following.map(f => f.followingId);

  if (followingIds.length === 0) {
    return [];
  }

  const activities = await prisma.activityLog.findMany({
    where: {
      userId: { in: followingIds },
      action: { in: ['book.read', 'book.started', 'collection.created', 'challenge.completed'] },
    },
    include: {
      user: {
        select: { id: true, name: true, image: true },
      },
      book: {
        select: { id: true, title: true, coverUrl: true, authors: true },
      },
    },
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  return activities.map(a => ({
    id: a.id,
    userId: a.user.id,
    userName: a.user.name,
    userAvatar: a.user.image || undefined,
    action: a.action,
    bookId: a.book?.id,
    bookTitle: a.book?.title,
    bookCover: a.book?.coverUrl,
    timestamp: a.createdAt.toISOString(),
  }));
}

export async function logActivity(
  userId: string,
  action: string,
  bookId?: string
): Promise<void> {
  await prisma.activityLog.create({
    data: {
      userId,
      action,
      bookId,
    },
  });
}

// ============================================================================
// Search Users
// ============================================================================

export async function searchUsers(query: string, limit = 20) {
  const users = await prisma.user.findMany({
    where: {
      name: { contains: query, mode: 'insensitive' },
    },
    select: {
      id: true,
      name: true,
      image: true,
    },
    take: limit,
  });

  return users.map(u => ({
    userId: u.id,
    name: u.name || 'Anonymous',
    avatarUrl: u.image || undefined,
  }));
}
