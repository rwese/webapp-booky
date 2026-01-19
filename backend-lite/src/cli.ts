#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

interface CliArgs {
  _: string[];
  createUser?: boolean;
  listUsers?: boolean;
  deleteUser?: boolean;
  email?: string;
  password?: string;
  name?: string;
  help?: boolean;
}

async function createUser(email: string, password: string, name?: string) {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
      },
    });

    console.log(`✅ User created: ${user.email} (ID: ${user.id})`);
    return user;
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.log(`❌ User already exists: ${email}`);
    } else {
      console.log(`❌ Error creating user: ${error.message}`);
    }
    process.exit(1);
  }
}

async function listUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (users.length === 0) {
    console.log('No users found.');
    return;
  }

  console.log(`Found ${users.length} user(s):\n`);
  users.forEach((user) => {
    console.log(`  • ${user.email} (${user.name || 'no name'}) - ${user.id}`);
  });
}

async function deleteUser(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`❌ User not found: ${email}`);
      process.exit(1);
    }

    await prisma.user.delete({
      where: { email },
    });

    console.log(`✅ User deleted: ${email}`);
  } catch (error: any) {
    console.log(`❌ Error deleting user: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  const args: CliArgs = {
    _: process.argv.slice(2),
  };

  // Parse arguments
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === 'create-user' || arg === 'create') args.createUser = true;
    else if (arg === 'list-users' || arg === 'list') args.listUsers = true;
    else if (arg === 'delete-user' || arg === 'delete') args.deleteUser = true;
    else if (arg === '--email' || arg === '-e') args.email = argv[++i];
    else if (arg === '--password' || arg === '-p') args.password = argv[++i];
    else if (arg === '--name' || arg === '-n') args.name = argv[++i];
    else if (arg === '--help' || arg === '-h') args.help = true;
  }

  if (args.help) {
    printHelp();
    return;
  }

  if (args.createUser) {
    if (!args.email || !args.password) {
      console.log('❌ Error: --email and --password are required for create-user');
      console.log('\nUsage: npm run cli -- create-user --email <email> --password <password> [--name <name>]');
      process.exit(1);
    }
    await createUser(args.email, args.password, args.name);
    return;
  }

  if (args.listUsers) {
    await listUsers();
    return;
  }

  if (args.deleteUser) {
    if (!args.email) {
      console.log('❌ Error: --email is required for delete-user');
      console.log('\nUsage: npm run cli -- delete-user --email <email>');
      process.exit(1);
    }
    await deleteUser(args.email);
    return;
  }

  printHelp();
}

function printHelp() {
  console.log(`
Booky CLI - User Management

Usage:
  npm run cli -- <command> [options]

Commands:
  create-user          Create a new user
  list-users           List all users
  delete-user          Delete a user
  help                 Show this help message

Options:
  --email, -e <email>    User email (required for create-user, delete-user)
  --password, -p <pw>    User password (required for create-user)
  --name, -n <name>      User name (optional for create-user)
  --help, -h             Show help

Examples:
  npm run cli -- create-user --email user@example.com --password secret123 --name "John"
  npm run cli -- list-users
  npm run cli -- delete-user --email user@example.com

Environment:
  DATABASE_PATH    SQLite database path (default: ./data/booky.db)
`);
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
