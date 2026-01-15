# Booky Mobile App

React Native mobile application for iOS and Android.

## Features

- **Offline-first sync** - Works without internet connection
- **Biometric authentication** - FaceID / TouchID support
- **Barcode scanning** - Add books by scanning ISBN barcodes
- **Push notifications** - Reading reminders and updates
- **Cross-platform** - iOS and Android support

## Getting Started

### Prerequisites

- Node.js 18+
- React Native CLI
- iOS: Xcode 14+
- Android: Android Studio 2022+

### Installation

```bash
# Install dependencies
cd mobile
npm install

# iOS
cd ios && pod install && cd ..
npm run ios

# Android
npm run android
```

## Project Structure

```
mobile/
├── src/
│   ├── components/     # Reusable UI components
│   ├── context/        # React contexts (Auth, Theme)
│   ├── navigation/     # React Navigation setup
│   ├── screens/        # App screens
│   ├── services/       # API, Auth, Storage, Sync
│   ├── types/          # TypeScript types
│   └── utils/          # Helper functions
├── ios/                # iOS project
└── android/            # Android project
```

## Configuration

Copy `.env.example` to `.env` and configure:

- `API_URL` - Backend API URL
- `ENABLE_PUSH` - Enable push notifications

## Backend Integration

The mobile app connects to the Booky backend API. Ensure the backend is running:

```bash
cd backend
npm run dev
```

## License

MIT
