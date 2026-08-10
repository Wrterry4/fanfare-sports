# Fanfare Sports

Live scoring, stats, and team communication for youth sports. Baseball first;
the architecture takes other sports as drop-in packs.

**Start here:** [`docs/STRUCTURE.md`](docs/STRUCTURE.md) then
[`docs/RUNNING-PWA.md`](docs/RUNNING-PWA.md).

```bash
npm install
npm test                 # 150 tests, no Firebase required
npm run web              # PWA dev server
npm run deploy:web       # export + firebase hosting
```

## State

| | |
|---|---|
| Scoring engine, stats, exports | done, 150 tests passing |
| Firestore rules | written, **never run against the emulator** |
| Cloud Functions | written, never deployed |
| Onboarding / invites | done |
| Game Day + Join screens | done, **never rendered** |
| Sign in, roster, schedule, messages | stubs |
| Walk-up audio | flagged off, nav slot exists |
