# Supabase Frontend Mobile Starter

This starter is intended for React Native or Expo apps.

## Environment variables

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## Install

```bash
npm install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

## Notes

- The mobile client uses a storage adapter backed by AsyncStorage.
- Add the URL polyfill early in your app bootstrap for React Native environments.
