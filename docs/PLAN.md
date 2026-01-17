# Personal Book Collection Webapp - Project Plan

## Overview

A mobile-first, offline-capable webapp for organizing personal book collections. Users can catalog books, rate them, organize with tags and collections, track reading history, and view analytics about their reading habits.

**Target Audience:** Avid readers who want a private, beautiful way to track their reading journey without social pressure or algorithm overwhelm.

**Core Philosophy:** Privacy-first, offline-ready, mobile-optimized, beautiful design, friction-free usage.

---

## Feature Priority Matrix

| Feature                   | Priority | Complexity | MVP |
| ------------------------- | -------- | ---------- | --- |
| Cataloging                | P0       | Medium     | Yes |
| Rating                    | P0       | Low        | Yes |
| Tags & Collections        | P0       | Medium     | Yes |
| Reading History           | P0       | Low        | Yes |
| Analytics                 | P1       | Medium     | Yes |
| Responsive (Mobile-First) | P0       | Low        | Yes |
| Barcode Scanning          | P1       | Medium     | Yes |
| Offline Support           | P1       | High       | Yes |

---

## P0: MVP Features

### 1. Cataloging

**Description:** Add books to the collection through search, barcode, or manual entry.

**User Stories:**

```
Story 1.1: Search & Add
As a user, I want to search for books by title, author, or ISBN so that I can quickly add books to my collection.

Story 1.2: Manual Entry
As a user, I want to manually enter book details so that I can add books not found in the database.

Story 1.3: Metadata Display
As a user, I want to see cover art, author, and description when adding a book so that I can verify I'm adding the correct edition.

Story 1.4: Format Selection
As a user, I want to specify the format (physical, ebook, audiobook) so that I can organize my collection by medium.

Story 1.5: Reading Status
As a user, I want to set initial reading status (want to read, currently reading, read) when adding a book so that I can immediately organize new additions.
```

**Acceptance Criteria:**

- [ ] Search returns results with auto-complete (debounced, 300ms)
- [ ] Results show cover, title, author, year
- [ ] ISBN lookup via barcode scanner
- [ ] Manual entry form with required fields: title, author (optional), ISBN (optional)
- [ ] Format selection: Physical Book, Kindle, Kobo, Audible, Audiobook, PDF, Other
- [ ] Status selection: Want to Read, Currently Reading, Read
- [ ] Add to collection with single click after selection
- [ ] Success feedback with animation
- [ ] Prevent duplicate entries (check by ISBN, then title+author)

**API Integrations:**

- **Open Library API:** Primary metadata source (free, no rate limits)
- **Google Books API:** Fallback for cover images and metadata
- **ISBNdb API:** Barcode lookups (paid, verify pricing)

**Data Model:**

```typescript
interface Book {
  id: string
  title: string
  authors: string[]
  isbn?: string
  isbn13?: string
  coverUrl?: string
  description?: string
  publisher?: string
  publishedYear?: number
  pageCount?: number
  format: BookFormat
  addedAt: Date
  externalIds: {
    openLibrary?: string
    googleBooks?: string
  }
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

---

### 2. Rating System

**Description:** Rate books with a 5-star system and optional written reviews.

**User Stories:**

```
Story 2.1: Star Rating
As a user, I want to rate books on a 5-star scale so that I can express how much I enjoyed each book.

Story 2.2: Half-Star Ratings
As a user, I want to use half-star ratings so that I can give more nuanced ratings.

Story 2.3: Written Review
As a user, I want to write and save reviews so that I can capture my detailed thoughts about books.

Story 2.4: Update Rating
As a user, I want to update my rating and review so that I can change my assessment if I reread or reconsider.
```

**Acceptance Criteria:**

- [ ] 5-star rating widget with interactive hover states
- [ ] Half-star granularity (click between stars for 0.5 increments)
- [ ] Visual star display (filled, half-filled, empty)
- [ ] Rich text review editor (bold, italic, lists, quotes)
- [ ] Save rating with optional review
- [ ] Edit existing ratings and reviews
- [ ] Delete ratings and reviews
- [ ] Average rating display for books in collection
- [ ] Rating distribution chart in analytics

**UI Components:**

- StarRating component (interactive and read-only modes)
- ReviewEditor component (markdown support via simple parser)
- RatingSummary component (average, count, distribution)

**Data Model:**

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

---

### 3. Tags & Collections

**Description:** Organize books using tags and custom collections.

**User Stories:**

```
Story 3.1: Add Tags
As a user, I want to add tags to books so that I can categorize them my way.

Story 3.2: Tag Suggestions
As a user, I want tag suggestions based on existing tags so that I can maintain consistency.

Story 3.3: Create Collections
As a user, I want to create custom collections (shelves) so that I can group books into meaningful categories.

Story 3.4: Add to Collection
As a user, I want to add books to collections so that I can organize my library.

Story 3.5: Filter by Tag/Collection
As a user, I want to filter my library by tags and collections so that I can find books easily.

Story 3.6: Smart Collections
As a user, I want collections that automatically include books matching rules so that I don't have to manually maintain them.
```

**Acceptance Criteria:**

**Tags:**

- [ ] Add unlimited tags per book
- [ ] Auto-complete suggestions from existing tags
- [ ] Tag management page (rename, merge, delete)
- [ ] Color coding for tags (6 preset colors, custom picker)
- [ ] Filter by multiple tags (AND/OR logic)
- [ ] Popular tags sidebar/filter panel
- [ ] Tag usage count display

**Collections:**

- [ ] Create unlimited collections
- [ ] Collection cover image (auto-generated from book covers)
- [ ] Add books via search or drag-and-drop
- [ ] Remove books from collections
- [ ] Reorder books in collection
- [ ] Delete collections
- [ ] Filter by collection
- [ ] Collection statistics (book count, average rating)

**Smart Collections (MVP: Basic only):**

- [ ] Define rules: rating >= X, format = Y, tag = Z
- [ ] Auto-update based on rules
- [ ] Display rule summary

**Data Model:**

```typescript
interface Tag {
  id: string
  name: string
  color: string // hex color code
  createdAt: Date
}

interface BookTag {
  bookId: string
  tagId: string
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

interface CollectionBook {
  collectionId: string
  bookId: string
  order: number // for manual ordering
  addedAt: Date
}

interface SmartRule {
  field: "rating" | "format" | "tags" | "status" | "year"
  operator: "equals" | "notEquals" | "greaterThan" | "lessThan" | "contains"
  value: string | number | string[]
}
```

---

### 4. Reading History

**Description:** Track books read over time with dates and basic progress.

**User Stories:**

```
Story 4.1: Mark as Read
As a user, I want to mark a book as read so that I can track my completed books.

Story 4.2: Read Date
As a user, I want to set the date I finished reading so that my history is accurate.

Story 4.3: Reading Timeline
As a user, I want to see a timeline of books I've read so that I can visualize my reading journey.

Story 4.4: Re-read Tracking
As a user, I want to track re-reads separately so that I can see my reading patterns.

Story 4.5: DNF Tracking
As a user, I want to mark books as "did not finish" so that I can track abandoned books.
```

**Acceptance Criteria:**

- [ ] Mark book as Read with date picker (default to today)
- [ ] Mark book as Currently Reading
- [ ] Mark book as Want to Read
- [ ] Mark book as DNF (Did Not Finish) with optional reason
- [ ] History view showing all read books with dates
- [ ] Chronological and reverse-chronological sorting
- [ ] Filter history by year, format, rating, collection
- [ ] Re-read with separate rating tracking
- [ ] Remove from history option (soft delete)
- [ ] Export history to CSV/JSON

**Reading Status Enum:**

```typescript
type ReadingStatus = "want_to_read" | "currently_reading" | "read" | "dnf"

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
```

**UI Views:**

- Library view (all books with status badges)
- Currently Reading section (prominent, limited to 3-5)
- History view (paginated, filterable, sortable)
- Want to Read list (prioritized)

---

### 5. Analytics

**Description:** Visualize reading habits and collection statistics.

**User Stories:**

```
Story 5.1: Basic Statistics
As a user, I want to see total books read so that I can track my reading volume.

Story 5.2: Yearly Breakdown
As a user, I want to see how many books I read each year so that I can track my progress over time.

Story 5.3: Genre Distribution
As a user, I want to see the distribution of genres I read so that I can understand my preferences.

Story 5.4: Rating Distribution
As a user, I want to see my rating distribution so that I can see how critical I am as a reader.

Story 5.5: Format Preferences
As a user, I want to see what formats I read most so that I can understand my reading medium preferences.
```

**Acceptance Criteria:**

**Dashboard Widgets:**

- [ ] Total books in collection
- [ ] Books read (all time, this year, this month)
- [ ] Currently reading count
- [ ] Average rating across collection
- [ ] Pages read (estimate based on book metadata)

**Charts:**

- [ ] Books read by year (bar chart)
- [ ] Books read by month (line chart, current year)
- [ ] Genre distribution (pie/donut chart)
- [ ] Rating distribution (histogram)
- [ ] Format distribution (bar chart)
- [ ] Reading streak calendar (heat map)

**Export:**

- [ ] Export analytics summary as JSON
- [ ] Generate shareable year-in-review (image or link)
- [ ] Export reading history as CSV

**UI Requirements:**

- [ ] Responsive chart sizes
- [ ] Dark mode support
- [ ] Loading states
- [ ] Interactive tooltips on hover

**Library Choices:**

- **Charts:** Recharts (React-friendly, responsive, good animations)
- **Export:** html2canvas for images, native JSON/CSV generation

---

### 6. Responsive Design (Mobile-First)

**Description:** Beautiful, functional interface on all device sizes, optimized for mobile.

**User Stories:**

```
Story 6.1: Mobile Layout
As a mobile user, I want a touch-friendly interface so that I can easily manage my collection on my phone.

Story 6.2: Tablet Layout
As a tablet user, I want a responsive layout so that I can take advantage of the larger screen.

Story 6.3: Desktop Layout
As a desktop user, I want a spacious layout so that I can efficiently manage large collections.

Story 6.6.4: Fast Loading
As a mobile user, I want fast page loads so that I can use the app on slow connections.
```

**Acceptance Criteria:**

**Mobile (< 640px):**

- [ ] Bottom navigation bar (Home, Library, Add, Analytics, Settings)
- [ ] Touch targets minimum 44px
- [ ] Single-column book lists
- [ ] Swipe actions on book cards (add to collection, quick rate)
- [ ] Full-height bottom sheets for modals
- [ ] Pull-to-refresh on lists
- [ ] Keyboard-friendly form inputs

**Tablet (640px - 1024px):**

- [ ] Side navigation (collapsible)
- [ ] Two-column book grids
- [ ] Multi-column tag/collection filters
- [ ] Split-view for book details

**Desktop (> 1024px):**

- [ ] Sidebar navigation
- [ ] Three-column book grids
- [ ] Filter panel (always visible or collapsible)
- [ ] Keyboard shortcuts (add book: Ctrl+N, search: Ctrl+K)
- [ ] Hover states for interactive elements

**Performance:**

- [ ] Lighthouse score: Performance > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Lazy load images
- [ ] Code splitting by route

**Design System:**

- [ ] Mobile-first CSS (Tailwind)
- [ ] Dark mode support (system preference + manual toggle)
- [ ] Consistent spacing system (4px baseline)
- [ ] Typography scale (modular scale)
- [ ] Color palette (accessible contrast ratios)

---

### 7. Barcode Scanning

**Description:** Add books quickly by scanning ISBN barcodes.

**User Stories:**

```
Story 7.1: Camera Scanning
As a user, I want to scan a book barcode with my phone camera so that I can quickly add physical books.

Story 7.2: Manual ISBN Entry
As a user, I want to manually enter an ISBN so that I can add books without camera access.

Story 7.3: Batch Scanning
As a user, I want to scan multiple books in a row so that I can quickly add a pile of books.
```

**Acceptance Criteria:**

**Camera Scanning:**

- [ ] Camera permission request and handling
- [ ] Real-time barcode detection overlay
- [ ] Support ISBN-10 and ISBN-13 barcodes
- [ ] Auto-capture on barcode detection
- [ ] Manual capture button
- [ ] Switch between front/back camera
- [ ] Flashlight toggle
- [ ] Error handling for unreadable barcodes

**Manual Entry:**

- [ ] ISBN input field with validation
- [ ] Auto-format (hyphens added)
- [ ] Clear input button
- [ ] Lookup button

**Batch Mode:**

- [ ] Queue of scanned ISBNs
- [ ] Review queue before adding
- [ ] Remove individual items from queue
- [ ] Clear queue
- [ ] Progress indicator

**Technical Requirements:**

- [ ] Library: QuaggaJS or ZXing (browser-compatible)
- [ ] HTTPS required for camera access
- [ ] Fallback for devices without camera

**UI Flow:**

1. Tap "Scan Barcode" in Add Book modal
2. Grant camera permission
3. Point at barcode (overlay guides user)
4. Auto-detect and lookup
5. Show book details for confirmation
6. Add to collection

---

### 8. Offline Support

**Description:** Core functionality works without internet connection.

**User Stories:**

```
Story 8.1: Offline Library View
As a user, I want to view my library offline so that I can access my collection without internet.

Story 8.2: Add Books Offline
As a user, I want to add books offline so that I can catalog books without connectivity.

Story 8.3: Sync When Online
As a user, I want my offline changes to sync when I'm back online so that my data stays current.

Story 8.4: Conflict Resolution
As a user, I want to be notified of sync conflicts so that I can resolve them manually.
```

**Acceptance Criteria:**

**Offline Functionality:**

- [ ] View library (all books, filtered views)
- [ ] View book details
- [ ] Add new books (stored locally, synced later)
- [ ] Update ratings (stored locally, synced later)
- [ ] Add/remove tags (stored locally, synced later)
- [ ] Create collections (stored locally, synced later)
- [ ] Mark books as read (stored locally, synced later)
- [ ] View analytics (based on cached data)

**Sync:**

- [ ] Automatic sync when online (debounced, 30s)
- [ ] Manual sync button
- [ ] Sync status indicator (online/offline/syncing)
- [ ] Background sync via Service Worker
- [ ] Conflict detection and resolution UI
- [ ] Last sync timestamp display

**Data Storage:**

- [ ] IndexedDB for book data, metadata, and images
- [ ] LocalStorage for user preferences and settings
- [ ] Service Worker for offline caching (HTML, CSS, JS, assets)
- [ ] Image caching (covers stored locally)
- [ ] Storage usage indicator

**Edge Cases:**

- [ ] Handle conflicting edits (last-write-wins with manual override option)
- [ ] Large library performance (virtual scrolling for 1000+ books)
- [ ] Storage quota management (warn at 80%, stop at 95%)
- [ ] Clear local data option

**Technical Stack:**

- **Service Worker:** Workbox for caching strategies
- **Database:** IndexedDB via Dexie.js (simpler API than raw IndexedDB)
- **Sync:** Custom sync engine with operational transformation or conflict-free replicated data types (CRDTs)

**Sync Strategy:**

```
1. Offline Changes
   - Queue operations in IndexedDB
   - Mark records as "dirty" for sync

2. Online Detection
   - navigator.onLine listener
   - Background sync API (if available)

3. Sync Process
   - Upload dirty records to server
   - Download server changes
   - Merge local and server changes
   - Clear dirty flags on success

4. Conflict Resolution
   - Detect conflicts via version vector or timestamp
   - Prefer server changes by default
   - Allow user to choose on conflict
```

---

## Technical Architecture

### Frontend Stack

| Component        | Choice                | Rationale                                   |
| ---------------- | --------------------- | ------------------------------------------- |
| Framework        | React                 | Large ecosystem, good for interactive UIs   |
| Language         | TypeScript            | Type safety, better developer experience    |
| Styling          | Tailwind CSS          | Mobile-first, utility-first, small bundle   |
| State Management | Zustand               | Simple, performant, good TypeScript support |
| Routing          | React Router v7       | Standard, well-supported                    |
| Forms            | React Hook Form + Zod | Performance, validation                     |
| Charts           | Recharts              | React-native, responsive, customizable      |
| Icons            | Lucide React          | Clean, consistent, tree-shakeable           |
| Date Handling    | date-fns              | Lightweight, modular                        |

### Backend Stack (Optional - for sync)

| Component | Choice               | Rationale                                 |
| --------- | -------------------- | ----------------------------------------- |
| API       | Node.js + Express    | Simple, familiar, good TypeScript support |
| Database  | PostgreSQL           | Relational data, robust, scalable         |
| ORM       | Prisma               | Type-safe, good DX, migration support     |
| Auth      | JWT + Refresh Tokens | Stateless, secure, widely supported       |
| Search    | MeiliSearch          | Fast, typo-tolerant, easy to set up       |

### Data Architecture

**Local-First Approach:**

- All data stored locally in IndexedDB
- Server acts as sync endpoint (optional)
- No server required for single-user offline-first experience

**Data Model (Simplified):**

```typescript
interface User {
  id: string
  name: string
  email?: string
  createdAt: Date
  settings: UserSettings
}

interface UserSettings {
  theme: "light" | "dark" | "system"
  defaultFormat: BookFormat
  ratingDisplay: "stars" | "numbers"
  dateFormat: string
  analyticsPreferences: AnalyticsConfig
}

interface Database {
  books: Book[]
  ratings: Rating[]
  tags: Tag[]
  collections: Collection[]
  readingLogs: ReadingLog[]
  syncQueue: SyncOperation[]
  settings: UserSettings
}

type SyncOperation = {
  id: string
  type: "create" | "update" | "delete"
  entity: "book" | "rating" | "tag" | "collection" | "readingLog"
  entityId: string
  data: any
  timestamp: Date
  synced: boolean
}
```

### Progressive Web App (PWA)

**Manifest:**

```json
{
  "name": "Book Collection",
  "short_name": "Books",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Service Worker (Workbox):**

- Precaching: App shell, critical assets
- Runtime caching: API responses, images
- Offline page: Fallback when no network
- Background sync: Retry failed sync operations

### Performance Budgets

| Metric                    | Target          | Measurement    |
| ------------------------- | --------------- | -------------- |
| First Contentful Paint    | < 1.5s          | Lighthouse     |
| Time to Interactive       | < 3s            | Lighthouse     |
| Largest Contentful Paint  | < 2.5s          | Lighthouse     |
| Cumulative Layout Shift   | < 0.1           | Lighthouse     |
| Bundle Size (initial)     | < 200KB gzipped | Build output   |
| Time to Sync (1000 books) | < 2s            | Manual testing |
| IndexedDB Query Time      | < 100ms         | Manual testing |

---

## Project Structure

```
webapp-booky/
├── public/
│   ├── index.html
│   ├── manifest.json
│   ├── icons/
│   └── robots.txt
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Card.tsx
│   │   ├── books/
│   │   │   ├── BookCard.tsx
│   │   │   ├── BookGrid.tsx
│   │   │   └── BookDetails.tsx
│   │   ├── forms/
│   │   │   ├── StarRating.tsx
│   │   │   ├── ReviewEditor.tsx
│   │   │   └── TagInput.tsx
│   │   └── analytics/
│   │       ├── Charts.tsx
│   │       └── StatsWidget.tsx
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Library.tsx
│   │   ├── AddBook.tsx
│   │   ├── BookDetail.tsx
│   │   ├── Analytics.tsx
│   │   └── Settings.tsx
│   ├── hooks/
│   │   ├── useBooks.ts
│   │   ├── useOffline.ts
│   │   └── useSync.ts
│   ├── lib/
│   │   ├── db.ts           // IndexedDB setup
│   │   ├── api.ts          // External API calls
│   │   ├── sync.ts         // Sync engine
│   │   └── utils.ts
│   ├── store/
│   │   └── useStore.ts     // Zustand store
│   ├── styles/
│   │   └── index.css       // Tailwind imports
│   ├── types/
│   │   └── index.ts        // TypeScript interfaces
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Development Phases

### Phase 1: Foundation (Week 1)

- [ ] Set up React + TypeScript + Vite project
- [ ] Configure Tailwind CSS
- [ ] Set up IndexedDB with Dexie.js
- [ ] Create basic project structure
- [ ] Implement routing with React Router

### Phase 2: Core Features (Week 2)

- [ ] Book cataloging (search + manual add)
- [ ] Book detail view
- [ ] Rating system
- [ ] Tags system
- [ ] Collections system
- [ ] Reading status management

### Phase 3: Analytics & History (Week 3)

- [ ] Reading history view
- [ ] Analytics dashboard
- [ ] Charts and visualizations
- [ ] Export functionality

### Phase 4: Mobile & Offline (Week 4)

- [ ] Mobile-first responsive design
- [ ] Bottom navigation
- [ ] Barcode scanning
- [ ] Service Worker setup
- [ ] Offline data storage
- [ ] Sync engine

### Phase 5: Polish (Week 5)

- [ ] PWA manifest and icons
- [ ] Dark mode
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Bug fixing and testing

---

## API Endpoints (for future sync server)

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

## Open Questions

1. **Authentication:** Do you need user accounts with server sync, or is local-first without accounts acceptable?

2. **Data Import:** Is Goodreads import a priority for launch, or can it come later?

3. **Sharing:** Do you want social/sharing features (friends, public profiles), or keep it fully private?

4. **Monetization:** Is this a personal project, or do you plan to add premium features or subscriptions?

5. **E-reader Integration:** Do you want integration with Kindle/Goodreads APIs for progress sync?

6. **Target Scale:** Is this for personal use (100-1000 books) or larger collections (10,000+)?

---

## Success Metrics

**MVP Launch Criteria:**

- [ ] Can add books via search (100+ books in library)
- [ ] Can rate and review books
- [ ] Can organize with tags and collections
- [ ] Can track reading history
- [ ] Analytics dashboard shows basic stats
- [ ] Works on mobile (iOS Safari, Chrome mobile)
- [ ] Works offline (view library without internet)
- [ ] Barcode scanning works on mobile
- [ ] PWA installable on mobile home screen
- [ ] Lighthouse performance score > 80
- [ ] Accessibility score > 90

**Post-MVP Goals:**

- [ ] Goodreads import functionality
- [ ] Social features (friends, shared collections)
- [ ] Book recommendations
- [ ] E-reader integration
- [ ] Browser extension
- [ ] 10,000+ books performance
- [ ] Multi-user support
- [ ] API for third-party integrations

---

## References

**Research Sources:**

- Open Library API: https://openlibrary.org/developers/api
- Google Books API: https://developers.google.com/books
- ISBNdb API: https://isbndb.com/pages/api
- StoryGraph: https://storygraph.com/
- Goodreads alternatives research

**Technical References:**

- Workbox: https://developer.chrome.com/docs/workbox/
- Dexie.js: https://dexie.org/
- Recharts: https://recharts.org/
- Tailwind CSS: https://tailwindcss.com/
- Vite: https://vitejs.dev/

---

_Last Updated: January 2025_
_Version: 1.0_
