# Agent Instructions

This is the **Book Collection Webapp** - a mobile-first, offline-capable Progressive Web Application (PWA) for organizing personal book collections. The project uses **bd** (beads) for issue tracking.

## Quick Reference

```bash
# Issue Tracking (bd/beads)
bd onboard              # Initialize bd for the project
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>           # Complete work
bd sync                 # Sync with git

# Development
npm install             # Install dependencies
npm run dev             # Start development server (port 3001)
npm run build           # Build for production
npm run preview         # Preview production build

# Testing
npm test                # Run unit tests only (Vitest)
npm run test:e2e        # Run e2e tests (Playwright, auto-starts dev server on port 3001)
npm test && npm run test:e2e  # Run all tests (116 tests: 108 unit + 8 e2e)
```

**Note**: E2E tests use port 3001 to avoid conflicts with OpenCode desktop app on port 3000.

---

## Project Overview

**Book Collection Webapp** is a production-ready PWA for organizing personal book collections with the following characteristics:

### Core Philosophy

- **Privacy-First**: All data stored locally by default, optional cloud sync
- **Offline-Capable**: Full functionality without internet connection
- **Mobile-First**: Optimized for mobile with responsive design
- **Beautiful**: Clean, modern UI with smooth animations
- **Friction-Free**: Quick entry, intuitive organization, instant feedback

### Target Audience

Avid readers who want a private, beautiful way to track their reading journey without social pressure or algorithm overwhelm.

### Quality Status

- **Production Ready**: ✅ 94/100 quality score
- **Risk Level**: Low
- **Test Coverage**: 108 unit tests + 8 e2e tests

---

## Application Features

### Core Features

| Feature                 | Description                                                   | Status      |
| ----------------------- | ------------------------------------------------------------- | ----------- |
| **Book Cataloging**     | Search/add books via Open Library and Google Books APIs       | ✅ Complete |
| **Rating System**       | 5-star ratings with half-star precision and rich text reviews | ✅ Complete |
| **Tags & Collections**  | Flexible organization with smart collections support          | ✅ Complete |
| **Reading History**     | Track reading progress with timeline visualization            | ✅ Complete |
| **Analytics Dashboard** | Interactive charts showing reading habits and trends          | ✅ Complete |
| **Mobile-First Design** | Responsive layout optimized for all screen sizes              | ✅ Complete |
| **Offline Support**     | Full offline functionality with local-first data architecture | ✅ Complete |
| **Barcode Scanning**    | ISBN barcode scanning for quick book lookup                   | ✅ Complete |
| **PWA Implementation**  | Installable on mobile and desktop with service worker         | ✅ Complete |
| **Performance**         | Lighthouse score > 80, accessibility score > 90               | ✅ Complete |

### Technical Features

- **Code Splitting**: Lazy loading by route for optimal bundle size
- **Dark Mode**: Light/Dark/System theme with smooth transitions
- **Accessibility**: WCAG 2.1 AA compliant with full keyboard navigation
- **Error Handling**: Graceful error boundaries with recovery options
- **Loading States**: Skeleton screens and progress indicators
- **Service Worker**: Workbox-powered offline caching and background sync

---

## User Stories Summary

### Book Cataloging

- **Story 1.1**: Search and add books via Open Library/Google Books APIs
- **Story 1.2**: Manual entry for books not found in databases
- **Story 1.3**: Barcode scanning with camera for ISBN lookup

### Rating and Review

- **Story 2.1**: 5-star ratings with half-star precision
- **Story 2.2**: Rich text reviews with markdown support
- **Story 2.3**: Rating analytics and distribution visualization

### Organization

- **Story 3.1**: Tag management with colors and auto-complete
- **Story 3.2**: Collections with manual ordering and cover images
- **Story 3.3**: Smart collections with automatic membership rules

### Reading History

- **Story 4.1**: Reading status management (Want to Read, Currently Reading, Read, DNF)
- **Story 4.2**: Reading timeline with chronological visualization
- **Story 4.3**: Progress tracking with page counts and reading sessions

### Analytics

- **Story 5.1**: Comprehensive reading statistics dashboard
- **Story 5.2**: Reading trends and pattern visualization
- **Story 5.3**: Shareable year-in-review reports

### Offline and Sync

- **Story 6.1**: Complete offline library access
- **Story 6.2**: Offline modifications with sync queue
- **Story 6.3**: Optional cloud synchronization across devices

### Mobile Experience

- **Story 7.1**: Touch-optimized library browsing with bottom navigation
- **Story 7.2**: Streamlined mobile add workflow with barcode scanning

---

## Tech Stack

### Frontend (Production)

| Component            | Technology              | Purpose                              |
| -------------------- | ----------------------- | ------------------------------------ |
| **Framework**        | React 18 + TypeScript 5 | Component-based UI with type safety  |
| **Build Tool**       | Vite 5                  | Fast dev server and optimized builds |
| **Styling**          | Tailwind CSS            | Utility-first responsive design      |
| **State Management** | Zustand                 | Lightweight global state             |
| **Routing**          | React Router v7         | SPA navigation with code splitting   |
| **Database**         | IndexedDB + Dexie.js    | Local-first data persistence         |
| **Forms**            | React Hook Form + Zod   | Performance with validation          |
| **Charts**           | Recharts                | Interactive data visualizations      |
| **Icons**            | Lucide React            | Consistent icon library              |
| **Service Worker**   | Workbox                 | PWA offline capabilities             |
| **Testing**          | Vitest + Playwright     | Unit and e2e testing                 |

### Backend (Optional - Cloud Sync)

| Component          | Technology            | Purpose                            |
| ------------------ | --------------------- | ---------------------------------- |
| **Runtime**        | Node.js 18+           | Server-side JavaScript             |
| **Framework**      | Express               | REST API framework                 |
| **Database**       | PostgreSQL + Prisma   | Relational data with type-safe ORM |
| **Authentication** | JWT + Refresh Tokens  | Stateless secure auth              |
| **File Storage**   | S3-compatible storage | Book cover images                  |
| **Deployment**     | Docker + Kubernetes   | Container orchestration            |

### API Integrations

- **Open Library API** - Primary metadata source (free, no rate limits)
- **Google Books API** - Fallback for cover images and additional metadata

---

## Project Structure

```
webapp-booky/
├── AGENTS.md                    # Agent instructions (this file)
├── README.md                    # Main project documentation
├── package.json                 # Dependencies and scripts
├── vite.config.ts              # Vite configuration with PWA settings
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── playwright.config.ts        # Playwright e2e configuration
├── vitest.config.ts            # Vitest unit test configuration
│
├── spec/                       # Technical specifications
│   └── TECHNICAL_SPECIFICATION.md  # Comprehensive technical spec
│
├── docs/                       # Project documentation
│   ├── PLAN.md                 # Original project specification
│   ├── IMPLEMENTATION_SUMMARY.md   # Phase-by-phase breakdown
│   ├── VALIDATION_REPORT.md    # Feature validation results
│   ├── COMPREHENSIVE_VALIDATION_REPORT.md  # Full quality assessment
│   ├── FINAL_DELIVERABLE.md    # Complete project delivery summary
│   ├── HANDOFF_SUMMARY.md      # Project handoff summary
│   ├── FINALIZATION_LEARNINGS.md   # Finalization insights
│   ├── REGRESSION_TEST_RESULTS.md  # Test results
│   ├── E2E_TEST_FINALIZATION_REPORT.md  # E2E test finalization
│   ├── TODO.md                 # Future work and improvements
│   ├── WEBAM_TESTING_SUMMARY.md    # Webcam testing summary
│   ├── WEBCAM_ERROR_RESEARCH.md    # Webcam error research
│   ├── WEBCAM_FIXES_SUMMARY.md     # Webcam fixes implementation
│   └── PLAN.md                 # Original project plan
│
├── public/                     # Static assets
│   ├── index.html             # HTML entry point
│   ├── manifest.json          # PWA manifest
│   └── icons/                 # PWA icons (192x192, 512x512)
│
├── src/                       # Application source code
│   ├── main.tsx              # Application entry point
│   ├── App.tsx               # Root application component
│   ├── vite-env.d.ts         # Vite type declarations
│   │
│   ├── components/           # React components
│   │   └── common/           # Shared components
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── Card.tsx
│   │       ├── Navigation.tsx
│   │       ├── Toast.tsx
│   │       ├── ErrorBoundary.tsx
│   │       ├── Skeleton.tsx
│   │       ├── Accessibility.tsx
│   │       └── ...
│   │
│   ├── pages/                # Route components
│   │   ├── Home.tsx          # Dashboard with statistics
│   │   ├── Library.tsx       # Book collection view
│   │   ├── AddBook.tsx       # Book addition interface
│   │   ├── BookDetail.tsx    # Individual book view
│   │   ├── Analytics.tsx     # Reading analytics
│   │   └── Settings.tsx      # User preferences
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── useBooks.ts       # Book data management
│   │   ├── useOffline.ts     # Offline status detection
│   │   ├── useSync.ts        # Synchronization logic
│   │   ├── useDebounce.ts    # Debounce utility
│   │   └── useThrottle.ts    # Throttle utility
│   │
│   ├── lib/                   # Core libraries
│   │   ├── db.ts             # IndexedDB configuration (Dexie.js)
│   │   ├── api.ts            # External API calls (Open Library, Google Books)
│   │   ├── sync.ts           # Sync engine for offline/online
│   │   ├── ThemeProvider.tsx # Theme management
│   │   └── utils.ts          # Utility functions
│   │
│   ├── store/                 # State management
│   │   └── useStore.ts       # Zustand store configuration
│   │
│   ├── contexts/              # React contexts
│   │   └── ...
│   │
│   ├── services/              # Business logic services
│   │   └── ...
│   │
│   ├── styles/                # Global styles
│   │   └── index.css         # Tailwind imports and global styles
│   │
│   ├── types/                 # TypeScript type definitions
│   │   └── index.ts          # All TypeScript interfaces and types
│   │
│   └── __tests__/             # Test utilities and setup
│       └── ...
│
├── tests/                     # Test files
│   ├── e2e/                   # Playwright e2e tests
│   │   └── ...
│   └── unit/                  # Vitest unit tests
│       └── ...
│
├── backend/                   # Optional backend (for cloud sync)
│   ├── src/                   # Backend source code
│   ├── prisma/                # Prisma schema and migrations
│   ├── Dockerfile             # Container configuration
│   └── DEPLOYMENT.md          # Deployment instructions
│
└── dist/                      # Production build output (generated)
```

---

## Data Models

### Book Model

```typescript
interface Book {
  id: string
  title: string
  subtitle?: string
  authors: string[]
  isbn13?: string
  coverUrl?: string
  localCoverPath?: string
  description?: string
  publisher?: string
  publishedYear?: number
  publishedDate?: string
  pageCount?: number
  format: BookFormat
  addedAt: Date
  externalIds: {
    openLibrary?: string
    googleBooks?: string
  }
  lastSyncedAt?: Date
  needsSync: boolean
  localOnly: boolean
  averageRating?: number
  categories?: string[]
  subjects?: string[]
  languageCode?: string
  seriesName?: string
  seriesVolume?: number
}

type BookFormat =
  | "physical"
  | "kindle"
  | "kobo"
  | "audible"
  | "audiobook"
  | "pdf"
  | "other"
```

### Rating Model

```typescript
interface Rating {
  id: string
  bookId: string
  stars: number // 0.5 to 5.0, increments of 0.5
  review?: string
  reviewCreatedAt?: Date
  updatedAt: Date
  containsSpoilers: boolean
}
```

### Tag and Collection Models

```typescript
interface Tag {
  id: string
  name: string
  color: string
  createdAt: Date
}

interface Collection {
  id: string
  name: string
  description?: string
  coverImage?: string
  isSmart: boolean
  smartRules?: SmartRule[]
  createdAt: Date
  updatedAt: Date
}

interface SmartRule {
  field: "rating" | "format" | "tags" | "status" | "year"
  operator: "equals" | "notEquals" | "greaterThan" | "lessThan" | "contains"
  value: string | number | string[]
}
```

### Reading Log Model

```typescript
interface ReadingLog {
  id: string
  bookId: string
  status: ReadingStatus
  startedAt?: Date
  finishedAt?: Date
  dnfReason?: string
  createdAt: Date
  updatedAt: Date
}

type ReadingStatus = "want_to_read" | "currently_reading" | "read" | "dnf"
```

---

## Performance Requirements

| Metric                         | Target          | Measurement Method |
| ------------------------------ | --------------- | ------------------ |
| First Contentful Paint (FCP)   | < 1.5s          | Lighthouse         |
| Time to Interactive (TTI)      | < 3s            | Lighthouse         |
| Largest Contentful Paint (LCP) | < 2.5s          | Lighthouse         |
| Cumulative Layout Shift (CLS)  | < 0.1           | Lighthouse         |
| Bundle Size (initial)          | < 200KB gzipped | Build output       |
| Time to Sync (1000 books)      | < 2s            | Manual testing     |
| IndexedDB Query Time           | < 100ms         | Manual testing     |

---

## Testing Commands

### Unit Tests (Vitest)

```bash
npm test
```

- Runs all unit tests (108 tests)
- Uses Vitest framework
- Fast execution with watch mode support

### E2E Tests (Playwright)

```bash
npm run test:e2e
```

- Runs e2e tests (8 essential tests)
- Auto-starts dev server on port 3001
- Avoids conflicts with OpenCode on port 3000

### All Tests

```bash
npm test && npm run test:e2e
```

- Runs all tests (116 total: 108 unit + 8 e2e)
- Quality gate for commits

---

## Development Workflow

### Starting Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Code Quality

```bash
# Run linter
npm run lint

# Format code
npm run format

# Run tests
npm test

# Run e2e tests
npm run test:e2e
```

---

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

### MANDATORY WORKFLOW

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

### CRITICAL RULES

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

---

## Key Documentation

| Document                          | Purpose                                          |
| --------------------------------- | ------------------------------------------------ |
| `README.md`                       | Main project documentation and getting started   |
| `spec/TECHNICAL_SPECIFICATION.md` | Comprehensive technical specification            |
| `docs/PLAN.md`                    | Original feature specifications and user stories |
| `docs/IMPLEMENTATION_SUMMARY.md`  | Phase-by-phase implementation details            |
| `docs/HANDOFF_SUMMARY.md`         | Project handoff and delivery summary             |
| `docs/FINAL_DELIVERABLE.md`       | Complete feature list and acceptance criteria    |

---

## Browser Support

### Modern Browsers

- Chrome 90+ (recommended)
- Firefox 88+ (recommended)
- Safari 14+ (recommended)
- Edge 90+ (recommended)

### Mobile Support

- iOS Safari 14+ (PWA installable)
- Chrome Mobile 90+ (PWA installable)
- Samsung Internet 15+ (PWA installable)

### Required Features

- ES6+ JavaScript
- IndexedDB
- Service Worker
- CSS Custom Properties
- Fetch API

---

## API Endpoints (Optional Backend)

```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/refresh

GET    /api/books
POST   /api/books
GET    /api/books/:id
PUT    /api/books/:id
DELETE /api/books/:id

GET    /api/books/search?q=...
GET    /api/books/isbn/:isbn

GET    /api/ratings/:bookId
POST   /api/ratings
PUT    /api/ratings/:id
DELETE /api/ratings/:id

GET    /api/tags
POST   /api/tags
PUT    /api/tags/:id
DELETE /api/tags/:id

GET    /api/collections
POST   /api/collections
PUT    /api/collections/:id
DELETE /api/collections/:id

POST   /api/sync
GET    /api/sync/status
```

---

## Known Issues and Technical Debt

### Minor Issues (Non-Blocking)

1. **TypeScript Strict Mode**: Some unused variable warnings exist (relaxed in tsconfig for build compatibility)
2. **Test Infrastructure**: Test file had JSX syntax issues; tests need infrastructure updates
3. **Build Tooling**: Vite PWA plugin configuration needs review for fresh builds

### Recommendations

1. **Address TypeScript debt** - Fix strict mode violations systematically
2. **Improve test coverage** - Add unit tests for critical paths
3. **Set up CI/CD** - Automate testing and deployment
4. **Performance testing** - Validate with 10,000+ books

---

## Directory Structure Guidelines

This project maintains a clean root directory. Follow these guidelines to keep the project organized.

### Root Directory Files (Keep Minimal)

Only the following file types should exist in the root directory:

| File Type         | Examples                                                                                                                                | Purpose                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Configuration** | `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`, `eslint.config.js`, `playwright.config.ts`, `vitest.config.ts` | Project build and tool configuration       |
| **Environment**   | `.env`, `.env.example`                                                                                                                  | Environment variables                      |
| **Documentation** | `README.md`, `AGENTS.md`                                                                                                                | Project documentation (only these 2 files) |
| **Manifests**     | `vercel.json`, `frontend-vercel.json`                                                                                                   | Deployment configurations                  |

**Files NOT allowed in root:**

- ❌ `.test.ts` or `.test.tsx` files (move to `tests/unit/`)
- ❌ `.spec.ts` or `.spec.tsx` files (move to `tests/unit/`)
- ❌ `.js` or `.ts` utility scripts (move to `tools/` or `scripts/`)
- ❌ `.html` files (move to `public/` for PWA, or remove if testing leftovers)
- ❌ Markdown documentation files (move to `docs/` except README.md and AGENTS.md)
- ❌ Generated output (use appropriate directories like `dist/`, `build/`)

### Directory Purposes

| Directory       | Purpose                       | Contents                                                  |
| --------------- | ----------------------------- | --------------------------------------------------------- |
| `src/`          | Application source code       | React components, hooks, lib, pages, store, types, styles |
| `public/`       | Static assets served directly | `index.html`, `manifest.json`, icons, robots.txt          |
| `tests/`        | Test files                    | `e2e/` for Playwright tests, `unit/` for Vitest tests     |
| `docs/`         | Project documentation         | All markdown documentation except README.md and AGENTS.md |
| `spec/`         | Technical specifications      | Architecture docs, API specs, technical design documents  |
| `backend/`      | Optional backend code         | Express server, Prisma schema, backend tests              |
| `mobile/`       | Mobile-specific code          | Capacitor/React Native mobile implementation              |
| `tools/`        | Development utilities         | Build scripts, validation tools, one-off scripts          |
| `scripts/`      | Build/deployment scripts      | Shell scripts, automation scripts                         |
| `dist/`         | Production build output       | Generated production bundle (auto-generated)              |
| `test-results/` | Test output                   | Playwright test results and reports                       |

### Where to Put New Files

**Source Code (src/):**

- React components → `src/components/[feature]/`
- Custom hooks → `src/hooks/`
- Library functions → `src/lib/`
- State management → `src/store/`
- Page components → `src/pages/`
- Types/interfaces → `src/types/index.ts`

**Tests (tests/):**

- Unit tests → `tests/unit/[feature].test.ts`
- E2E tests → `tests/e2e/[feature].spec.ts`
- Test utilities → `tests/utils/`

**Documentation (docs/):**

- Feature documentation → `docs/FEATURE_NAME.md`
- Meeting notes → `docs/notes/`
- Design docs → `docs/design/`

**Utilities (tools/):**

- One-off scripts → `tools/script-name.js` or `tools/script-name/`
- Validation scripts → `tools/validate-*.js`
- Build helpers → `tools/build-*.js`

### Cleanup Commands

```bash
# Check for files that shouldn't be in root
ls -la *.ts *.js *.html *.md | grep -v -E "(AGENTS|README|package|tsconfig|vite|tailwind|eslint|playwright|vitest|\.env)"

# Find test files in wrong location
find . -maxdepth 1 -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx"

# Find orphan scripts
find . -maxdepth 1 -type f \( -name "*.js" -o -name "*.ts" \) ! -name "*.config.*"
```

### Clean Root Checklist

Before committing, verify:

- [ ] No `.test.ts` or `.test.tsx` files in root (should be in `tests/unit/`)
- [ ] No `.spec.ts` or `.spec.tsx` files in root (should be in `tests/unit/`)
- [ ] No standalone `.js` or `.ts` scripts in root (should be in `tools/` or `scripts/`)
- [ ] No `.html` files in root (should be in `public/` or removed)
- [ ] No markdown files in root except `README.md` and `AGENTS.md` (should be in `docs/` or `spec/`)
- [ ] Configuration files are minimal and necessary
- [ ] All new files placed in appropriate directories

---

## References

- Open Library API: https://openlibrary.org/developers/api
- Google Books API: https://developers.google.com/books
- React Documentation: https://react.dev
- TypeScript Documentation: https://www.typescriptlang.org/docs/
- Tailwind CSS Documentation: https://tailwindcss.com/docs
- Dexie.js Documentation: https://dexie.org/
- Recharts Documentation: https://recharts.org/
- Workbox Documentation: https://developer.chrome.com/docs/workbox/
- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
