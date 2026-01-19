import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create a demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@booky.app' },
    update: {},
    create: {
      email: 'demo@booky.app',
      name: 'Demo User',
      password: '$2b$10$demo', // "demo123" - for testing only
    },
  });

  console.log('✅ Created demo user:', user.email);

  // Create sample tags
  const tags = await Promise.all([
    prisma.tag.upsert({
      where: { userId_name: { userId: user.id, name: 'Favorites' } },
      update: {},
      create: { userId: user.id, name: 'Favorites', color: '#F59E0B' },
    }),
    prisma.tag.upsert({
      where: { userId_name: { userId: user.id, name: 'To Read' } },
      update: {},
      create: { userId: user.id, name: 'To Read', color: '#3B82F6' },
    }),
    prisma.tag.upsert({
      where: { userId_name: { userId: user.id, name: 'Science Fiction' } },
      update: {},
      create: { userId: user.id, name: 'Science Fiction', color: '#10B981' },
    }),
  ]);

  console.log('✅ Created', tags.length, 'sample tags');

  // Create a sample collection
  const collection = await prisma.collection.upsert({
    where: { userId_name: { userId: user.id, name: 'Sample Collection' } },
    update: {},
    create: {
      userId: user.id,
      name: 'Sample Collection',
      description: 'A sample collection to get started',
    },
  });

  console.log('✅ Created sample collection:', collection.name);

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
