# StudyPulse — Presentation Notes
 
A Pomodoro-style study tracker built with Expo (React Native) + TypeScript.
Use this as your talking script. Each section = roughly one slide/minute.
 
---
 
## 1. One-sentence pitch
 
StudyPulse is a cross-platform study timer with per-subject presets, local
persistence, light/dark theming, real authentication, and a live analytics
screen — built to demonstrate every core mobile-architecture pattern from
the course in one working app.
 
---
 
## 2. Tech stack (say this fast, it's just context)
 
- **Expo SDK 56** / React Native 0.85 / React 19 / **TypeScript strict mode** (no `any` anywhere)
- **React Navigation 7** — native stack (Login → Main) + bottom tabs (4 screens)
- **TanStack Query 5** — `useQuery` for reads, `useMutation` for writes
- **Axios** — one shared client with a request interceptor
- **expo-secure-store** — encrypted JWT storage
- **AsyncStorage** — everything else (non-sensitive app data)
- **expo-notifications** — native local notifications on timer completion
- Two **real** APIs: DummyJSON (login/JWT) and JSONPlaceholder (GET + POST)
**Why it matters:** every dependency maps to a specific rubric requirement —
nothing is decorative.
 
---
 
## 3. App structure (the map)
 
```
App.tsx                 → providers, QueryClient, navigation, hydration gate
src/
  types/index.ts        → every shared type / action union (single source of truth)
  context/
    AuthContext.tsx      → global state: user, prefs, subjects, sessions
    ThemeContext.tsx     → light/dark mode, persisted
  api/
    client.ts            → shared Axios instance + interceptor
    authApi.ts            → real login against DummyJSON
    tokenStore.ts          → SecureStore wrapper for the JWT
    cloudApi.ts             → real GET/POST against JSONPlaceholder
    statsApi.ts              → combines local + remote data for Stats screen
  navigation/AppNavigator.tsx → stack + tabs, auth-gated
  screens/                  → Login, Timer, Subjects, Stats, Profile
  components/                → StatsItem, SubjectItem (presentational)
```
 
**Talking point:** the folder layout itself documents the architecture —
`context` is state, `api` is networking, `screens` is UI. This separation is
what lets each piece be explained independently.
 
---
 
## 4. App.tsx — how everything boots
 
```
SafeAreaProvider
  └─ QueryClientProvider   (TanStack Query)
       └─ ThemeProvider     (light/dark)
            └─ AuthProvider  (global app state)
                 └─ RootGate (waits for hydration, then renders nav)
```
 
- **Provider order matters**: Theme and Auth need to exist before anything
  reads them; QueryClient wraps everything because both Stats and Profile use it.
- **`RootGate`** blocks rendering until `state.isHydrated` is true — this is
  what prevents a flash of default data before AsyncStorage finishes loading.
- The `QueryClient` is configured with `retry: false` so the error state in
  the Stats screen is reliably reproducible during a demo, instead of silently
  retrying in the background.
**One sentence to say out loud:** "App.tsx is just composition — all the real
logic lives in the providers and screens it wraps."
 
---
 
## 5. Global state — `AuthContext` (the most "CS" part)
 
This is a classic **`useReducer` + Context** pattern, the same shape used by
Redux, just without the library.
 
- **State shape** (`GlobalState`): `user`, `preferences`, `subjects`,
  `sessions`, `isHydrated`.
- **Actions** are a discriminated union (`GlobalAction`) — TypeScript forces
  every case in the reducer to be handled, so you can't silently mishandle
  an action type.
- **Reducer is pure**: given the same state + action, always the same output.
  No side effects inside `globalReducer` — that's intentional and worth
  saying explicitly if asked.
- **Persistence is a separate concern**: four `useEffect` hooks watch each
  state slice and write it to AsyncStorage *after* hydration completes. This
  avoids overwriting saved data with the initial defaults before the load
  finishes.
- **Hydration on launch**: one `useEffect` reads all four AsyncStorage keys
  in parallel with `Promise.all`, then dispatches a single `HYDRATE` action.
**If asked "why useReducer instead of useState x5?"** — because the state
slices aren't independent (e.g. login needs to be one atomic transition), and
a reducer keeps all transition logic in one auditable place instead of
scattered `setX` calls across components.
 
---
 
## 6. Authentication flow (real, not mocked)
 
1. `LoginScreen` calls `authApi.loginRequest(username, password)`.
2. That does a real `axios.post` to `https://dummyjson.com/auth/login`.
3. On success, the returned JWT is saved via `tokenStore.saveToken()` —
   which calls **`expo-secure-store`**, backed by the iOS Keychain / Android
   Keystore (actual encryption, not just AsyncStorage).
4. `AuthContext.login(username)` then dispatches `LOGIN`, which flips
   `state.user` and the navigator swaps from the Login stack to the Main tabs.
5. **Logout** deletes the token from SecureStore and dispatches `LOGOUT`.
**Why two storage systems?** Sensitive data (the token) vs. everything else.
This mirrors a real production split and is worth calling out as a deliberate
choice, not an accident.
 
**Demo credentials** (prefilled in the login form):
```
username: emilys
password: emilyspass
```
 
---
 
## 7. The Axios interceptor (small file, high marks)
 
`api/client.ts` creates **one shared Axios instance** with a **request
interceptor**:
 
```ts
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});
```
 
**The point to make clearly:** no screen or component ever sets an
`Authorization` header manually. Every request that goes through `api`
automatically gets the token attached. This is the textbook reason
interceptors exist — cross-cutting concerns handled once, centrally.
 
There's also a response interceptor (currently pass-through) with a comment
noting where a real app would catch a `401` and refresh the token — shows
you understand the pattern even where it isn't fully built out.
 
---
 
## 8. Real networking — GET and POST
 
Two genuinely live HTTP calls, both routed through the same `api` client:
 
- **GET** `cloudApi.fetchRemoteSummaries()` → `/posts?_limit=5` on
  JSONPlaceholder. Used by the Stats screen to prove live connectivity (shown
  as "Synced records").
- **POST** `cloudApi.pushSessionSummary()` → `/posts`. Triggered from the
  Profile screen's "Sync Data to Cloud Backend" action via a `useMutation`.
**Honesty point worth stating in the talk:** JSONPlaceholder is a fake REST
API — it echoes back a created record with a new `id`, but doesn't actually
persist it server-side. The HTTP round-trip itself is real; the backend
storage is not. Say this proactively — it shows you understand what your
tools actually do instead of overclaiming.
 
---
 
## 9. TanStack Query — the Stats screen
 
```ts
const query = useQuery<StudyStats, Error>({
  queryKey: ['study-stats', querySignature],
  queryFn: () => fetchStudyStats(sessions),
});
```
 
- `fetchStudyStats` does the **real GET** above, then locally sums
  `sessions` (from Context) into total time/count.
- The screen renders **three explicit states**:
  - `query.isPending` → spinner
  - `query.isError` → error card + **Retry button** that calls `query.refetch()`
  - success → header stats + `FlatList` of sessions
- `retry: false` (set globally in `App.tsx`) means a failed request doesn't
  silently retry in the background — so the error UI is actually reachable
  and demoable on command (e.g. by going offline).
**This is the cleanest "loading / error / success" demonstration in the app**
— if you only have time to deep-dive one screen for the "error handling"
rubric line, use this one.
 
---
 
## 10. The Timer — `useReducer` engine (the centerpiece)
 
This is the most original/complex code in the project, so spend real time
here.
 
**State** (`TimerState`): `status` (`idle | running | paused`), `mode`
(`focus | break`), `remainingSeconds`, `focusDuration`, `breakDuration`,
`selectedSubjectId`.
 
**Actions**: `START`, `PAUSE`, `RESET`, `TICK`, `TOGGLE_MODE`,
`UPDATE_CONFIGS`, `SELECT_SUBJECT` — each one a pure transition in
`timerReducer`.
 
**Two effects drive the engine:**
 
1. **Tick driver** — only mounts an interval while `status === 'running'`:
```ts
   useEffect(() => {
     if (timer.status !== 'running') return;
     const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
     return () => clearInterval(id);
   }, [timer.status]);
```
   Pausing/resetting simply changes `status`, which mounts/unmounts the
   interval — no manual `clearInterval` bookkeeping scattered around handlers.
 
2. **Completion handler** — watches `remainingSeconds` hit `0` while running:
   - Logs a `StudySession` to global state (if it was a focus session)
   - Shows an in-app toast
   - Fires a real local notification via `expo-notifications` (if enabled)
   - Dispatches `RESET`
   - Uses a `completionGuard` ref to make sure this fires **exactly once**
     per zero-crossing, not on every re-render while `remainingSeconds`
     stays at 0.
**Why a ref instead of state for the guard?** Because flipping a state flag
would itself trigger a re-render and fight with the effect's own dependency
array. A ref mutates without re-rendering — exactly what a one-shot guard
needs.
 
**Good question to pre-empt:** "Why one big reducer instead of separate
`useState` calls for status/mode/remainingSeconds?" — Several of these
fields change together in a single user action (e.g. `SELECT_SUBJECT` changes
both `selectedSubjectId` and `focusDuration` and possibly `remainingSeconds`
atomically). A reducer keeps those multi-field transitions consistent in one
place instead of risking partial updates across multiple `setState` calls.
 
---
 
## 11. Native feature — local notifications
 
- Configured once at module load (`Notifications.setNotificationHandler`),
  guarded by `Platform.OS !== 'web'` since this is a native-only module.
- `ensureNotificationPermission()` checks then requests permission lazily —
  only when notifications are actually toggled on or a session completes.
- `fireCompletionNotification()` schedules an immediate local notification
  (`trigger: null`) with the session-complete message.
- Everything is wrapped in `try/catch` and fails silently — a missing
  permission or unsupported platform never crashes the timer.
---
 
## 12. Cross-platform guards (why the app still runs on web)
 
Two native modules have **no web implementation**: `expo-secure-store` and
`expo-notifications`. Both are guarded the same way throughout the code:
 
```ts
if (Platform.OS === 'web') {
  // in-memory fallback, no-op, or early return
}
```
 
**Worth saying:** this isn't defensive overkill — it's the difference
between the app being demoable in a browser during a presentation vs. only
working on a physical device/simulator.
 
---
 
## 13. Course requirements → code mapping (your safety net slide)
 
| Requirement | Where |
|---|---|
| 5+ screens, Stack + Tab nav | `navigation/AppNavigator.tsx` |
| Auth with secure token storage | `authApi.ts`, `tokenStore.ts`, `LoginScreen` |
| Axios interceptor | `api/client.ts` |
| State management (Context + Query) | `context/AuthContext.tsx`, Stats/Profile |
| Local persistence (AsyncStorage) | `AuthContext.tsx`, `ThemeContext.tsx` |
| Real network GET | `cloudApi.fetchRemoteSummaries` → Stats |
| Real network write | `cloudApi.pushSessionSummary` → Profile sync |
| Native feature | `expo-notifications` in `TimerScreen` |
| Loading/error/success handling | `StatsScreen` query states |
| Strict TypeScript, no `any` | entire `src/` |
 
If a professor asks "show me where X is," this table is your index.
 
---
 
## 14. If you get a hard question
 
- **"Why Context instead of Redux/Zustand?"** — App-scale state is small
  (4 slices). A typed reducer + Context gives the same predictable-transition
  benefit as Redux without an extra dependency — appropriate for this scope.
- **"What happens if the network is down on launch?"** — Hydration reads from
  AsyncStorage, not the network, so the app still boots with cached/local
  data. Only the Stats screen's remote GET would show the error state.
- **"Is the JWT actually secure?"** — As secure as the platform's native
  keychain/keystore allows; that's exactly why it's split out from
  AsyncStorage, which stores plain JSON.
- **"What would you add with more time?"** — A 401 → refresh-token flow in
  the response interceptor (there's already a comment marking where it'd go),
  and persisting timer state across app restarts (currently resets on reload).
---
 
## 15. Closing line
 
"Every architectural choice here — the reducer, the interceptor, the storage
split, the query states — exists because of a specific requirement, not for
decoration. The app is small, but every pattern in it scales to a real
production app."
