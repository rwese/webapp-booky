# Book Collection Webapp

A mobile-first, offline-capable webapp for organizing personal book collections. Users can catalog books, rate them, organize with tags and collections, track reading history, and view analytics about their reading habits.

## Features

- 📚 **Catalog Books** - Search and add books via Open Library and Google Books APIs
- ⭐ **Rate & Review** - Rate books on a 5-star scale with written reviews
- 🏷️ **Tags & Collections** - Organize with custom tags and collections
- 📖 **Reading History** - Track reading progress and history
- 📊 **Analytics** - Visual insights into reading habits
- 📱 **Mobile-First** - Optimized for mobile with responsive design
- �離線 **Offline Support** - Works without internet connection
- 🔒 **Privacy-First** - All data stored locally

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router v7
- **Database**: IndexedDB with Dexie.js
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Icons**: Lucide React

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
npm run test
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format with Prettier
- `npm run test` - Run tests with Vitest

## Development Phases

### Phase 1: Foundation (Current)

- [x] Set up React + TypeScript + Vite project
- [x] Configure Tailwind CSS
- [x] Set up IndexedDB with Dexie.js
- [x] Create basic project structure
- [x] Implement routing with React Router

### Phase 2: Core Features

- [ ] Book cataloging (search + manual add)
- [ ] Book detail view
- [ ] Rating system
- [ ] Tags system
- [ ] Collections system
- [ ] Reading status management

### Phase 3: Analytics & History

- [ ] Reading history view
- [ ] Analytics dashboard
- [ ] Charts and visualizations
- [ ] Export functionality

### Phase 4: Mobile & Offline

- [ ] Mobile-first responsive design
- [ ] Bottom navigation
- [ ] Barcode scanning
- [ ] Service Worker setup
- [ ] Offline data storage
- [ ] Sync engine

### Phase 5: Polish

- [ ] PWA manifest and icons
- [ ] Dark mode
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Bug fixing and testing

## API Integrations

- **Open Library API** - Primary metadata source (free, no rate limits)
- **Google Books API** - Fallback for cover images and metadata

## Contributing

This is a personal project, but feel free to fork and adapt for your own use.

## License

MIT License - See LICENSE file for details.
