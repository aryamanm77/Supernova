# Nova — Spoken English Tutor (PWA)

An installable, free, spoken-English AI tutor — same concept as Supernova AI's
app, built as a Progressive Web App on your own stack.

## Stack
- **STT / TTS**: Web Speech API (`SpeechRecognition` + `SpeechSynthesis`) — free, browser-native, no API calls
- **AI tutor**: Groq's free-tier Llama 3.1 (unchanged from the earlier scaffold)
- **Backend**: Firebase Cloud Functions (same `functions/index.js` as before — no changes needed)
- **Hosting**: Firebase Hosting (free Spark plan)
- **Installability**: Web App Manifest + service worker (offline app-shell caching)

## Browser support note
`SpeechRecognition` works well in Chrome (desktop + Android) and Edge. Safari/iOS
support is partial and Firefox has none — this is a real PWA limitation, not a bug
in this code. If you need iOS support later, the fallback is a cloud STT API
(e.g. Groq also hosts Whisper) called from the same `chatWithTutor`-style flow.

## Files
```
firebase.json             -> Hosting + Firestore config
firestore.rules           -> Security rules (users can only touch their own profile)
firestore.indexes.json    -> Empty index config (none needed yet)
functions/
  index.js                 -> Cloud Function "chatWithTutor" — now scenario-aware
  package.json
public/
  index.html                -> App shell: auth gate, scenario picker, chat, profile panel
  style.css                 -> Design system (plum/amber/sage, Fraunces + Inter)
  auth.js                   -> Google Sign-In via Firebase Auth
  progress.js               -> Firestore streak/XP/level tracking
  app.js                    -> Wires auth, progress, speech, and chat together
  service-worker.js         -> Offline app-shell caching
  manifest.json             -> PWA installability metadata
  icons/icon-source.svg     -> Source icon — export to PNGs (see below)
```

## Setup steps

### 1. Icons
The manifest expects 4 PNGs that don't exist yet:
`icons/icon-192.png`, `icons/icon-192-maskable.png`, `icons/icon-512.png`, `icons/icon-512-maskable.png`.

Export them from `icons/icon-source.svg` using any tool, e.g.:
```
npx @squoosh/cli --resize '{"width":512,"height":512}' icons/icon-source.svg
```
or use a free online SVG→PNG/maskable-icon generator (search "PWA maskable icon generator").
For the maskable versions, keep the circle motif within the safe zone (inner 80%) so it isn't cropped.

### 2. Firebase project setup
```
npm install -g firebase-tools
firebase login
firebase init
```
Select **Hosting**, **Functions**, and **Firestore**, choose your existing
`supernova-31273` project, point Hosting's public directory to `public/`,
and say **no** to overwriting `index.html`.

### 3. Enable Google Sign-In
Firebase console → your project → **Authentication** → **Sign-in method** →
enable **Google** as a provider. No extra config needed for web.

### 4. Deploy Firestore rules
```
firebase deploy --only firestore:rules
```
This makes sure each signed-in user can only read/write their own profile document.

### 5. Groq API key
Same as before — set it as a secret, never in code:
```
firebase functions:secrets:set GROQ_API_KEY
```
(If you pasted a key anywhere earlier, revoke it at console.groq.com/keys and generate a fresh one.)

### 6. Deploy everything
```
firebase deploy
```
This deploys Hosting, Functions, and Firestore rules together. Firebase Hosting gives you a
free `https://supernova-31273.web.app` URL — open it on your phone and use
"Add to Home Screen" (Android Chrome) to install it like an app.

### 7. Local testing
```
firebase emulators:start
```
Note: `SpeechRecognition` requires a secure context (HTTPS or `localhost`) —
the emulator's `localhost` URL satisfies this. Google Sign-In popups also work
against the Auth emulator.

## What's new in this version
- **Google Sign-In** — gates the app behind auth so progress can be saved per user
- **Profile + progress** — streak (consecutive days practiced), XP (+10 per exchange),
  and level (every 100 XP), all stored in Firestore and viewable by tapping the
  streak badge or avatar in the header
- **Scenario picker** — matches a real gap vs. free chat alone: pick "Job interview,"
  "Ordering food," "Introducing yourself," or "Airport/hotel check-in" and the tutor
  role-plays that scenario instead of just chatting generically

## Features still missing vs. the real Supernova app
These are real gaps — not built here, but here's the honest shape of each:
- **Mother-tongue support** (Hindi, Tamil, etc.) — Supernova explains things in the
  user's native language. To add: a language-preference field on the profile, a
  "translate this" button per tutor reply that calls a second Groq request asking
  for a translation, and system-prompt instructions to explain corrections in that language.
- **Structured multi-day curriculum** — Supernova has a fixed lesson sequence with
  progression gates. The scenario picker here is a lighter version (topic-based,
  not day-gated); a real curriculum needs a `lessons` Firestore collection with
  ordering and a "completed lessons" array on the user profile.
- **Pronunciation scoring** (not just grammar) — needs either a phoneme-comparison
  model or a cloud pronunciation-assessment API (e.g. Azure Speech has one with a
  free tier); the Web Speech API alone only gives you a text transcript, not
  pronunciation accuracy.
- **Push notifications for streak reminders** — needs the Web Push API + a
  service-worker push handler, plus a scheduled Cloud Function to trigger them.

## Notes on "same quality, no limits"
- Firebase Hosting free tier: 10 GB storage, 360 MB/day transfer — plenty for a personal app
- Groq free tier and Firebase Functions free tier are unchanged from the Android version
- The Web Speech API is genuinely free and uncapped, since it's the browser's own
  built-in engine (Google's speech service on Chrome) rather than a metered cloud API

## Next pieces to build (smaller, not covered above)
- Persisting full chat transcripts across sessions (currently only counts/XP persist, not message history)
- iOS fallback via a cloud STT API if Safari support matters to you
