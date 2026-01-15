import { PrismaClient, SyncOperation } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const getPrismaClient = () => new PrismaClient();

interface SyncOperationInput {
  id?: string;
  type: 'create' | 'update' | 'delete';
  entity: string;
  entityId: string;
  data?: any;
  timestamp?: Date;
}

interface SyncBatchResult {
  id: string;
  status: 'success' | 'failed' | 'conflict';
  entity: string;
  entityId: string;
  error?: string;
}

interface SyncStatus {
  status: 'ready' | 'syncing' | 'error';
  lastSync: Date | null;
  pendingOperations: number;
  conflicts: number;
}

/**
 * Queue a sync operation
 */
export async function queueSyncOperation(
  userId: string,
  operation: Omit<SyncOperationInput, 'id' | 'timestamp' | 'synced'>
): Promise<SyncOperation> {
  const prisma = getPrismaClient();
  
  return prisma.syncOperation.create({
    data: {
      userId,
      type: operation.type,
      entity: operation.entity,
      entityId: operation.entityId,
      data: operation.data || {},
      synced: false,
      timestamp: new Date()
    }
  });
}

/**
 * Get pending sync operations
 */
export async function getPendingOperations(userId: string): Promise<SyncOperation[]> {
  const prisma = getPrismaClient();
  
  return prisma.syncOperation.findMany({
    where: {
      userId,
      synced: false
    },
    orderBy: { timestamp: 'asc' }
  });
}

/**
 * Process a batch of sync operations
 */
export async function processSyncBatch(
  userId: string,
  operations: SyncOperationInput[]
): Promise<SyncBatchResult[]> {
  const prisma = getPrismaClient();
  const results: SyncBatchResult[] = [];
  
  for (const operation of operations) {
    try {
      await processOperation(userId, operation);
      
      results.push({
        id: operation.id || crypto.randomUUID(),
        status: 'success',
        entity: operation.entity,
        entityId: operation.entityId
      });
    } catch (error) {
      results.push({
        id: operation.id || crypto.randomUUID(),
        status: 'failed',
        entity: operation.entity,
        entityId: operation.entityId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return results;
}

/**
 * Process a single sync operation
 */
async function processOperation(
  userId: string,
  operation: SyncOperationInput
): Promise<void> {
  const prisma = getPrismaClient();
  
  const { entity, type, entityId, data } = operation;
  
  switch (entity) {
    case 'book': {
      if (type === 'create') {
        await prisma.book.create({ data: { ...data, userId } });
      } else if (type === 'update') {
        await prisma.book.updateMany({ where: { id: entityId, userId }, data });
      } else {
        await prisma.book.deleteMany({ where: { id: entityId, userId } });
      }
      break;
    }
      
    case 'rating': {
      if (type === 'create') {
        await prisma.rating.create({ data: { ...data, userId } });
      } else if (type === 'update') {
        await prisma.rating.updateMany({ where: { id: entityId, userId }, data });
      } else {
        await prisma.rating.deleteMany({ where: { id: entityId, userId } });
      }
      break;
    }
      
    case 'tag': {
      if (type === 'create') {
        await prisma.tag.create({ data: { ...data, userId } });
      } else if (type === 'update') {
        await prisma.tag.updateMany({ where: { id: entityId, userId }, data });
      } else {
        await prisma.tag.deleteMany({ where: { id: entityId, userId } });
      }
      break;
    }
      
    case 'collection': {
      if (type === 'create') {
        await prisma.collection.create({ data: { ...data, userId } });
      } else if (type === 'update') {
        await prisma.collection.updateMany({ where: { id: entityId, userId }, data });
      } else {
        await prisma.collection.deleteMany({ where: { id: entityId, userId } });
      }
      break;
    }
      
    case 'readingLog': {
      if (type === 'create') {
        await prisma.readingLog.create({ data: { ...data, userId } });
      } else if (type === 'update') {
        await prisma.readingLog.updateMany({ where: { id: entityId, userId }, data });
      } else {
        await prisma.readingLog.deleteMany({ where: { id: entityId, userId } });
      }
      break;
    }
      
    case 'userSettings': {
      if (type === 'delete') {
        await prisma.userSettings.deleteMany({ where: { userId } });
      } else {
        await prisma.userSettings.upsert({
          where: { userId },
          create: { userId, ...data },
          update: data
        });
      }
      break;
    }
      
    default:
      throw new Error(`Unknown entity type: ${entity}`);
  }
}

/**
 * Get changes since a specific timestamp (incremental sync)
 */
export async function getChangesSince(
  userId: string,
  since: Date
): Promise<any[]> {
  const prisma = getPrismaClient();
  const changes: any[] = [];
  
  const [books, ratings, tags, collections, readingLogs, settings] = await Promise.all([
    prisma.book.findMany({
      where: { userId, updatedAt: { gt: since } }
    }),
    prisma.rating.findMany({
      where: { userId, updatedAt: { gt: since } }
    }),
    prisma.tag.findMany({
      where: { userId, updatedAt: { gt: since } }
    }),
    prisma.collection.findMany({
      where: { userId, updatedAt: { gt: since } }
    }),
    prisma.readingLog.findMany({
      where: { userId, updatedAt: { gt: since } }
    }),
    prisma.userSettings.findUnique({
      where: { userId }
    })
  ]);
  
  // Add type information to each entity
  for (const book of books) {
    changes.push({ type: 'book', data: book });
  }
  for (const rating of ratings) {
    changes.push({ type: 'rating', data: rating });
  }
  for (const tag of tags) {
    changes.push({ type: 'tag', data: tag });
  }
  for (const collection of collections) {
    changes.push({ type: 'collection', data: collection });
  }
  for (const readingLog of readingLogs) {
    changes.push({ type: 'readingLog', data: readingLog });
  }
  
  if (settings && settings.updatedAt > since) {
    changes.push({ type: 'userSettings', data: settings });
  }
  
  return changes.sort((a, b) => 
    new Date(a.data.updatedAt).getTime() - new Date(b.data.updatedAt).getTime()
  );
}

/**
 * Full sync - replace all user data
 */
export async function fullSync(
  userId: string,
  data: {
    books?: any[];
    collections?: any[];
    tags?: any[];
    readings?: any[];
    settings?: any;
  }
): Promise<{ success: boolean; syncedAt: Date }> {
  const prisma = getPrismaClient();
  
  await prisma.$transaction(async (tx) => {
    if (data.books) {
      for (const book of data.books) {
        await tx.book.upsert({
          where: { id: book.id },
          create: { ...book, userId },
          update: book
        });
      }
    }
    
    if (data.collections) {
      for (const collection of data.collections) {
        await tx.collection.upsert({
          where: { id: collection.id },
          create: { ...collection, userId },
          update: collection
        });
      }
    }
    
    if (data.tags) {
      for (const tag of data.tags) {
        await tx.tag.upsert({
          where: { id: tag.id },
          create: { ...tag, userId },
          update: tag
        });
      }
    }
    
    if (data.readings) {
      for (const reading of data.readings) {
        await tx.readingLog.upsert({
          where: { id: reading.id },
          create: { ...reading, userId },
          update: reading
        });
      }
    }
    
    if (data.settings) {
      await tx.userSettings.upsert({
        where: { userId },
        create: { ...data.settings, userId },
        update: data.settings
      });
    }
  });
  
  return { success: true, syncedAt: new Date() };
}

/**
 * Get sync status
 */
export async function getSyncStatus(userId: string): Promise<SyncStatus> {
  const prisma = getPrismaClient();
  
  const pendingCount = await prisma.syncOperation.count({
    where: { userId, synced: false }
  });
  
  const lastOperation = await prisma.syncOperation.findFirst({
    where: { userId },
    orderBy: { timestamp: 'desc' }
  });
  
  return {
    status: pendingCount > 0 ? 'syncing' : 'ready',
    lastSync: lastOperation?.timestamp || null,
    pendingOperations: pendingCount,
    conflicts: 0
  };
}

/**
 * Mark operations as synced
 */
export async function markOperationsSynced(
  userId: string,
  operationIds: string[]
): Promise<void> {
  const prisma = getPrismaClient();
  
  await prisma.syncOperation.updateMany({
    where: { id: { in: operationIds }, userId },
    data: { synced: true }
  });
}

/**
 * Clear synced operations
 */
export async function clearSyncedOperations(userId: string): Promise<void> {
  const prisma = getPrismaClient();
  
  await prisma.syncOperation.deleteMany({
    where: { userId, synced: true }
  });
}

export default {
  queueSyncOperation,
  getPendingOperations,
  processSyncBatch,
  getChangesSince,
  fullSync,
  getSyncStatus,
  markOperationsSynced,
  clearSyncedOperations
};
