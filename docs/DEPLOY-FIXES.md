# Why the functions deploy failed

```
⚠  functions: Couldn't find firebase-functions package in your source code.
Error: An unexpected error has occurred.
```

`functions/` is a **separate npm package** with its own `package.json` and its
own dependencies. Those were never installed — and worse, `update.sh` was
deleting the directory wholesale on every run, so even if you had installed
them they'd have been wiped by the next update.

## Fix, once

```bash
npm install --prefix functions
firebase deploy --only functions
```

## Fixed for good

`update.sh` now replaces the *contents* of `functions/` while leaving
`node_modules` alone, and warns you if it's missing rather than letting the
deploy fail with a confusing message.

## Runtime bumped to Node 22

Your deploy warned that Node 20 was deprecated in April and is
**decommissioned on 2026-10-30** — about two months out, after which deploys
stop working entirely. `firebase.json` and `functions/package.json` now specify
Node 22.

If the first Node 22 deploy complains about a dependency, delete
`functions/node_modules` and `functions/package-lock.json` and reinstall — the
native bits of `firebase-admin` are compiled per runtime.

## The rules warning

```
⚠  [W] 64:14 - Unused function: canScore.
```

Left over from Phase 1, when the baton rules moved from a role check to "whoever
holds the book". Removed.

## One thing worth checking

Your bundle dropped from ~665 modules / 2.44 MB to 563 / 1.91 MB. That's most
likely the native Firebase SDK finally being excluded from the web build — the
`App.jsx` extension fix and the `notificationRouting` platform split both
removed paths that were dragging `@react-native-firebase` in.

Worth confirming rather than assuming:

```bash
grep -c "react-native-firebase" dist/_expo/static/js/web/*.js
```

`0` means the web bundle is clean. Anything else means native code is still
being shipped to browsers.
