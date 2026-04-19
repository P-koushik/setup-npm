# Firebase Auth Mobile Starter

This starter is intended for React Native or Expo apps.

## Environment variables

```bash
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_APP_ID=your-app-id
```

## Install

```bash
npm install firebase @react-native-async-storage/async-storage
```

## Notes

- This uses `initializeAuth()` with React Native persistence.
- The starter focuses on email/password auth because browser popup flows are web-specific.
