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
- **Database**: SQLite with Prisma ORM (local development)
- **Authentication**: JWT with refresh tokens
- **File Storage**: Local filesystem for book covers

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

### NAS Deployment

Deploy to Synology NAS directly from GitHub:

```bash
# Copy deployment scripts to NAS
scp scripts/setup-nas.sh scripts/deploy-nas.sh user@nas-ip:/volume1/webapps/

# SSH into NAS and run setup
ssh user@nas-ip
cd /volume1/webapps
chmod +x setup-nas.sh deploy-nas.sh
sudo ./setup-nas.sh

# Deploy the application
sudo ./deploy.sh deploy
```

**Commands:**

- `sudo ./deploy.sh deploy` - Full deployment (clone, build, deploy)
- `sudo ./deploy.sh update` - Quick update (pull, rebuild, deploy)
- `sudo ./deploy.sh rollback` - Rollback to previous backup
- `sudo ./deploy.sh status` - Show deployment status

See `docs/NAS_DEPLOYMENT.md` for detailed documentation.

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

The app uses **backend-lite** - a lightweight SQLite-based backend for local development:

```bash
cd backend-lite
npm install
npm run dev  # Starts on port 3001
```

### Backend Features

- **Authentication**: JWT-based with refresh tokens
- **SQLite Database**: Simple local storage
- **File Upload**: Local storage for book covers
- **API Routes**: Auth, books, collections, ratings, reading, tags, files

### Production Deployment

For production, the app works fully offline with IndexedDB. Optional backend can be deployed separately for cloud sync.

- **Cloud Services**: AWS ECS, GCP Cloud Run, Azure Container Apps

## Contributing

This is a personal project, but feel free to fork and adapt for your own use.

## License

MIT License - See LICENSE file for details.
