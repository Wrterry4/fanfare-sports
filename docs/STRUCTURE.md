# Fanfare Sports — File Structure

The organizing idea: **everything sport-specific lives in `src/sports/<sport>/`.
Everything else is sport-agnostic.** Adding basketball means adding a folder and
one registry entry. It does not mean touching the backend, the security rules,
auth, invites, messaging, or the roster.

```
fanfare-sports/
│
├── App.jsx                       Root: providers, navigation container, linking
├── app.json                      Expo config — bundle IDs, deep links, web, fonts
├── package.json
├── firebase.json                 Hosting, emulators, functions predeploy hook
├── firestore.rules               ★ Roles, stat privacy, the baton
├── firestore.indexes.json        6 composite indexes
├── storage.rules                 Walk-up audio + media buckets
├── .env                          EXPO_PUBLIC_FIREBASE_* (gitignored)
├── google-services.json          Android — native build only (gitignored)
├── GoogleService-Info.plist      iOS — native build only (gitignored)
│
├── public/                       Served verbatim by Firebase Hosting
│   ├── manifest.json             PWA manifest
│   ├── firebase-messaging-sw.js  ★ Web push service worker — MUST be at root
│   └── icons/
│       ├── icon-192.png
│       ├── icon-512.png
│       ├── icon-maskable-512.png
│       └── badge-72.png
│
├── assets/
│   └── fonts/
│       ├── Archivo-Bold.ttf          Scoreboard numerals, headings
│       ├── Archivo-ExtraBold.ttf
│       ├── Archivo-Black.ttf
│       ├── PublicSans-Regular.ttf    UI text
│       ├── PublicSans-SemiBold.ttf
│       └── PublicSans-Bold.ttf
│
├── src/
│   │
│   ├── theme/                    ─── BRAND (constant across sports) ───
│   │   ├── brand.js              ★ Fanfare palette, light + dark, contrast notes
│   │   ├── index.js              Merges brand + sport pack
│   │   ├── ThemeProvider.jsx     useTheme(); picks light/dark by game time
│   │   └── tokens.js             Back-compat shim — delete after migration
│   │
│   ├── sports/                   ─── SPORT PACKS ───
│   │   ├── registry.js           ★ SPORTS map; sportForTeam(team)
│   │   └── baseball/
│   │       ├── index.js          Single import surface for everything baseball
│   │       ├── theme.js          Infield clay accent + terminology
│   │       ├── engine.js         Pure reducer: reduce(events, rules) -> state
│   │       ├── events.js         Event vocabulary
│   │       ├── rules.js          Rule presets: t-ball → high school
│   │       ├── stats.js          Batting / pitching / fielding
│   │       ├── config.js         buildGameConfig, opponent placeholders
│   │       ├── scoringModes.js   Full vs casual
│   │       ├── export.js         CSV + career JSON
│   │       └── components/
│   │           ├── Field.jsx         The scorebook diamond
│   │           ├── ActionPads.jsx    Pitch / on-base / out buttons
│   │           ├── RunnerSheet.jsx   Baserunning drawer
│   │           └── BatterBar.jsx     Exported as ParticipantBar
│   │
│   ├── shared/                   ─── SPORT-AGNOSTIC LOGIC ───
│   │   └── inviteRules.js        Validation, roles, capabilities
│   │
│   ├── services/                 ─── PLATFORM BOUNDARY ───
│   │   ├── firebase.js           native → @react-native-firebase
│   │   ├── firebase.web.js       ★ web → JS SDK + IndexedDB persistence
│   │   ├── push.js               native → FCM
│   │   ├── push.web.js           ★ web → VAPID + iOS install detection
│   │   ├── haptics.js            native → expo-haptics
│   │   ├── haptics.web.js        web → navigator.vibrate (Android only)
│   │   ├── gameService.js        Event append, live subscription, the baton
│   │   ├── authService.js        Accounts + push token lifecycle
│   │   └── inviteService.js      Invite generation + redemption
│   │
│   ├── hooks/
│   │   ├── AuthProvider.jsx      ★ ONE auth listener for the whole app
│   │   └── useGame.js            Live game state, debounced summary write
│   │
│   ├── navigation/
│   │   ├── RootNavigator.jsx     Auth gate + bottom tabs
│   │   ├── linking.js            ★ Deep links; preserves the invite fragment
│   │   └── navigationRef.js      Navigating from outside a screen
│   │
│   ├── components/               ─── SPORT-AGNOSTIC UI ───
│   │   ├── Scoreboard.jsx        Sticky score strip
│   │   ├── BatonBar.jsx          Handoff + scoring mode
│   │   └── InstallPrompt.jsx     ★ Add to Home Screen (iOS push depends on it)
│   │
│   └── screens/
│       ├── GameDayScreen.jsx     Live scoring — pulls its sport from registry
│       ├── JoinScreen.jsx        Parent onboarding; works signed out
│       ├── SignInScreen.jsx      ⬜ stub
│       ├── SignUpScreen.jsx      ⬜ stub
│       ├── ScheduleScreen.jsx    ⬜ stub
│       ├── RosterScreen.jsx      ⬜ stub
│       ├── MessagesScreen.jsx    ⬜ stub
│       └── PlayerCardScreen.jsx  ⬜ stub
│
├── functions/                    ─── CLOUD FUNCTIONS (sport-agnostic) ───
│   ├── package.json              Node 20, ESM
│   ├── index.js                  Players, transfers, finalize, notifications
│   ├── invites.js                Invite generation, redemption, pipeline
│   ├── build-shared.js           ★ Vendors src/sports + src/shared into shared/
│   └── shared/                   Generated — gitignored, never edit
│
├── tests/
│   ├── engine.test.js            64
│   ├── finalize.test.js          24
│   ├── invites.test.js           36
│   ├── scoringModes.test.js      26
│   └── rules/
│       └── firestore.rules.test.js   ⬜ never run — needs the emulator
│
├── prototype/                    HTML layout reference — not shipped
│   ├── template.html
│   └── index.html
│
└── docs/
    ├── STRUCTURE.md              this file
    ├── RUNNING-PWA.md            ★ setup + deploy
    ├── AUDIT.md                  bugs found and fixed
    ├── data-model.md             Firestore schema
    ├── README-firestore.md       rules + onboarding rationale
    └── README-app.md             app shell notes

★ = load-bearing, read before changing        ⬜ = not built yet
```

## Files you still need to create

| File | How |
|---|---|
| `.env` | See RUNNING-PWA.md |
| `public/icons/*.png` | Any icon generator; 192, 512, maskable 512, badge 72 |
| `assets/fonts/*.ttf` | Google Fonts: Archivo, Public Sans |
| Firebase config in `firebase-messaging-sw.js` | Paste over the `REPLACE_ME` values |

## Why sports are folders, not flags

The alternative is `if (sport === 'baseball')` scattered through the codebase,
which rots fast — basketball has no innings, soccer has no batting order, and
each one would add a branch to every shared file.

A pack owns its state machine, stat engine, rules, event vocabulary, theme,
terminology, and field component. `GameDayScreen` reads `sportForTeam(team)` and
destructures `Field`, `ActionPads`, `RunnerSheet`, `ParticipantBar` — so the
same screen renders basketball once that pack exists, with no edits.

**What deliberately does NOT change per sport:** surfaces, type, spacing, the
scoreboard treatment, and every security rule. That's what makes two Fanfare
sports feel like siblings rather than two unrelated apps. A pack contributes an
accent and a field glyph; it cannot override the brand.

Add `sport: 'baseball'` to the team document now, defaulted in `sportForTeam()`,
so existing teams keep working when a second sport lands.

## Two conventions that will silently break things

**Platform files import without extensions.** `from './firebase'`, never
`from './firebase.js'`. The extension defeats Metro's `.web.js` resolution and
the PWA will load the React Native build.

**`functions/shared/` is generated.** `build-shared.js` regenerates it on every
deploy. Edits there are overwritten without warning; change the source in
`src/sports/` or `src/shared/`.
