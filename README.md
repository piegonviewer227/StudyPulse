# StudyPulse

A cross-platform study timer built with Expo (React Native) and TypeScript. It
features a Pomodoro-style focus engine with per-subject presets, persistent
local storage, light/dark theming, and a data-driven analytics screen.

## Stack

- Expo SDK 56 (managed workflow), React Native 0.85, React 19
- TypeScript (strict mode, no `any`)
- React Navigation 7 (native stack + bottom tabs)
- TanStack Query 5 (`useQuery` for reads, `useMutation` for the cloud write)
- Axios (shared client with an auth-token request interceptor)
- expo-secure-store (encrypted storage for the JWT auth token)
- @react-native-async-storage/async-storage (local app data)
- expo-notifications (focus/break completion alerts)
- Real HTTP: DummyJSON (token auth) + JSONPlaceholder (GET + write)

## Demo login

The Login screen performs a **real** POST against DummyJSON and stores the JWT
it returns. Prefilled working credentials:

```
username: emilys
password: emilyspass
```

## Setup

This project pins approximate dependency versions. The reliable way to align
the native modules to your installed Expo SDK is to let the Expo CLI fix them:

```bash
cd StudyPulse
npm install
npx expo install --fix    # aligns expo-* and react-native-* to the SDK
npx expo start            # press i (iOS), a (Android), or w (web)
```

If `npm install` reports peer conflicts, run it with `--legacy-peer-deps`, then
run `npx expo install --fix` to correct versions.

To type-check:

```bash
npm run typecheck
```

## Project structure

```
StudyPulse/
├── App.tsx                 Providers, QueryClient, navigation, hydration gate
├── index.ts                Expo entry (registerRootComponent)
└── src/
    ├── constants/theme.ts  Light/dark palettes, spacing, radius, font scales
    ├── types/index.ts      All shared types and discriminated action unions
    ├── context/
    │   ├── AuthContext.tsx  Global state (user, prefs, subjects, sessions)
    │   └── ThemeContext.tsx Theme mode, persisted
    ├── api/
    │   ├── axiosInstance.ts Configured axios client
    │   └── statsApi.ts      Mock fetcher with simulated latency/failure
    ├── hooks/
    │   ├── useAuth.ts
    │   └── useTheme.ts
    ├── navigation/AppNavigator.tsx
    ├── components/
    │   ├── SubjectItem.tsx
    │   └── StatsItem.tsx
    └── screens/
        ├── LoginScreen.tsx
        ├── TimerScreen.tsx
        ├── SubjectsScreen.tsx
        ├── StatsScreen.tsx
        └── ProfileScreen.tsx
```

## Architecture notes

- **Authentication.** `LoginScreen` calls `api/authApi.loginRequest`, a real
  POST to DummyJSON. The returned JWT is saved in SecureStore (`api/tokenStore`).
  The shared Axios client (`api/client`) has a request interceptor that attaches
  `Authorization: Bearer <token>` to every call automatically. Logout deletes
  the token from SecureStore.
- **Storage split (mirrors the course).** The sensitive JWT lives in SecureStore
  (iOS Keychain / Android Keystore, encrypted). Non-sensitive app data (user,
  preferences, subjects, sessions, theme) lives in AsyncStorage. Both are guarded
  so the app still runs on web with in-memory fallbacks.
- **Networking (real HTTP).** `api/cloudApi` does a GET (`/posts`, used by the
  Stats screen via `useQuery`) and a write (`POST /posts`, used by the Profile
  "Sync Data to Cloud Backend" row via `useMutation`) against JSONPlaceholder.
- **Global state** lives in `AuthContext` behind a typed `useReducer`, rehydrated
  on launch with each slice persisted on change once hydration completes.
- The timer is a self-contained `useReducer` engine in `TimerScreen` with the
  actions START, PAUSE, RESET, TICK, TOGGLE_MODE, UPDATE_CONFIGS, and
  SELECT_SUBJECT. A single interval effect drives ticks while running.
- The Stats screen uses TanStack Query; its loading / error+retry / success
  branches now reflect the real network call. Auto-retry is disabled so the error
  state is reproducible; the Retry button refetches.
- No emojis are used anywhere in the UI or source. Tab icons are solid
  color-filled indicators.

## Course requirements mapping

| Requirement | Where it lives |
|---|---|
| 5+ screens, Stack + Tab navigation | `navigation/AppNavigator.tsx` + `screens/` |
| Authentication (token in SecureStore) | `api/authApi.ts`, `api/tokenStore.ts`, `LoginScreen` |
| Axios interceptor attaches token | `api/client.ts` |
| State management (Context + TanStack Query) | `context/AuthContext.tsx`, Stats/Profile queries |
| Data persistence (AsyncStorage) | `context/AuthContext.tsx`, `context/ThemeContext.tsx` |
| Networking — real GET | `api/cloudApi.fetchRemoteSummaries` → `StatsScreen` |
| Networking — real write | `api/cloudApi.pushSessionSummary` → `ProfileScreen` sync |
| Native feature (local notifications) | `screens/TimerScreen.tsx` |
| Error handling (loading/error/success) | `StatsScreen` (query), `ProfileScreen` (mutation) |
| TypeScript, no `any` | entire `src/` |

## Notes and limitations

- `expo-secure-store` and `expo-notifications` are native modules. They work in
  Expo Go and development/production builds, but not in the web target. The app
  guards those calls so it still runs on web with in-memory fallbacks.
- Login uses DummyJSON's sample accounts (see Demo login above).
- JSONPlaceholder is a fake REST API: it accepts writes and echoes a created
  record id, but does not persist them server-side. The HTTP round-trip is real.
