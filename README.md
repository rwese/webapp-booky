# Book Collection Webapp

A mobile-first, offline-capable webapp for organizing personal book collections with optional cloud sync. Users can catalog books, rate them, organize with tags and collections, track reading history, and view analytics about their reading habits.

## Features

- 📚 **Catalog Books** - Search and add books via Open Library and Google Books APIs
- ⭐ **Rate & Review** - Rate books on a 5-star scale with written reviews
- 🏷️ **Tags & Collections** - Organize with custom tags and collections
- 📖 **Reading History** - Track reading progress and history
- 📊 **Analytics** - Visual insights into reading habits
- 📱 **Mobile-First** - Optimized for mobile with responsive design
- 📴 **Offline Support** - Works without internet connection
- 🔄 **Cloud Sync** - Optional backend sync across devices (PostgreSQL + JWT auth)
- 🔒 **Privacy-First** - All data stored locally by default

## Tech Stack

### Frontend

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router v7
- **Database**: IndexedDB with Dexie.js
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Icons**: Lucide React
- **Testing**: Vitest (unit) + Playwright (e2e)

### Backend (Optional)

- **Runtime**: Node.js 18+ with Express
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens
- **File Storage**: S3-compatible storage for book covers
- **Deployment**: Docker + Kubernetes or Docker Compose
- **Monitoring**: Prometheus + Grafana + Sentry

## Project Structure

```
webapp-booky/
├── public/
│   ├── icons/
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Navigation.tsx
│   │   │   └── Toast.tsx
│   │   └── ...
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Library.tsx
│   │   ├── AddBook.tsx
│   │   ├── Analytics.tsx
│   │   └── Settings.tsx
│   ├── hooks/
│   │   ├── useBooks.ts
│   │   ├── useOffline.ts
│   │   └── useSync.ts
│   ├── lib/
│   │   ├── db.ts           // IndexedDB setup
│   │   ├── api.ts          // External API calls
│   │   └── utils.ts
│   ├── store/
│   │   └── useStore.ts     // Zustand store
│   ├── styles/
│   │   └── index.css       // Tailwind imports
│   ├── types/
│   │   └── index.ts        // TypeScript interfaces
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   ├── e2e/                // Playwright e2e tests
│   └── ...
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test              # Unit tests only (108 tests)
npm run test:e2e      # E2E tests only (8 essential tests)
npm test && npm run test:e2e  # All tests (116 tests)
```

### E2E Test Setup

E2E tests are configured to **automatically start the dev server** on port 3001 (avoiding OpenCode conflict on port 3000):

```bash
# Run e2e tests - Playwright will auto-start the dev server
npm run test:e2e

# Or use the helper script that verifies dev server auto-start
bash scripts/test-e2e.sh
```

The Playwright configuration (`playwright.config.ts`) includes a `webServer` section that:

- Automatically starts the Vite dev server on port 3001
- Waits for the server to be ready before running tests
- Reuses existing server when available (faster local development)

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format with Prettier
- `npm test` - Run unit tests with Vitest
- `npm run test:e2e` - Run e2e tests with Playwright (port 3001)
- `npm run test:ui` - Run tests with Vitest UI

## Development Phases

### Phase 1: Foundation ✅

- [x] Set up React + TypeScript + Vite project
- [x] Configure Tailwind CSS
- [x] Set up IndexedDB with Dexie.js
- [x] Create basic project structure
- [x] Implement routing with React Router

### Phase 2: Core Features ✅

- [x] Book cataloging (search + manual add)
- [x] Book detail view
- [x] Rating system
- [x] Tags system
- [x] Collections system
- [x] Reading status management

### Phase 3: Analytics & History ✅

- [x] Reading history view
- [x] Analytics dashboard
- [x] Charts and visualizations
- [x] Export functionality

### Phase 4: Mobile & Offline ✅

- [x] Mobile-first responsive design
- [x] Bottom navigation
- [x] Barcode scanning
- [x] Service Worker setup
- [x] Offline data storage
- [x] Sync engine

### Phase 5: Polish ✅

- [x] PWA manifest and icons
- [x] Dark mode
- [x] Performance optimization
- [x] Accessibility audit
- [x] Bug fixing and testing
- [x] **Test Infrastructure** (108 unit + 8 e2e tests)

## API Integrations

- **Open Library API** - Primary metadata source (free, no rate limits)
- **Google Books API** - Fallback for cover images and metadata

## Backend (Optional Cloud Sync)

The app can optionally use a backend server for cloud sync across devices:

### Quick Start (Docker Compose)

```bash
cd backend
cp .env.production .env  # Configure environment variables
docker-compose up -d     # Start PostgreSQL and backend

# Verify deployment
curl https://api.booky.app/api/health
```

### Backend Features

- **Authentication**: JWT-based with refresh tokens
- **Data Sync**: Real-time sync with conflict resolution
- **File Storage**: S3-compatible storage for book covers
- **Rate Limiting**: Protection against abuse
- **Monitoring**: Prometheus metrics and alerting

### Deployment Options

- **Docker Compose**: Single-server deployment
- **Kubernetes**: Scalable container orchestration
- **Cloud Services**: AWS ECS, GCP Cloud Run, Azure Container Apps

See [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) for detailed deployment instructions.

## Contributing

This is a personal project, but feel free to fork and adapt for your own use.

## License

MIT License - See LICENSE file for details.
