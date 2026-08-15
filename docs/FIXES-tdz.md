# "Cannot access 'ee' before initialization"

## What it was

In `SettingsScreen`, `copyInvite` was a `useCallback` whose dependency array
named `joinUrl`:

```js
const copyInvite = useCallback(async () => { … }, [team, joinUrl]);   // line 76
…
const joinUrl = buildJoinUrl(origin, team.id, team.joinCode);          // line 105
```

**A dependency array is evaluated during render**, at the point the hook is
written — not when the callback runs. So it read `joinUrl` twenty-nine lines
before the declaration, which is a temporal dead zone error. Minified, `joinUrl`
became `ee`.

The fix builds the link inside the callback instead of closing over it.

## How the hunt went

Worth recording, because two of my own tools lied first.

**The cycle detector said "no cycles" — and it was wrong.** Its path resolver
tried `base + '.js'` and `base + '.jsx'` but never `base` itself, so every
import written with an explicit `.js` extension resolved to nothing. Most of
the graph was invisible. Corrected, it found 199 edges across 73 files and
still no cycles — but the first answer was worthless.

**The TDZ checker's first run produced a false alarm**, flagging `code` in
JoinTeamScreen because it didn't understand `const [code, setCode] =
useState()` and matched an unrelated `const code` inside a helper further down.

Both were confidently wrong in the same way the bug was: something that looks
correct and isn't. Checking a checker against code you've already read is worth
the two minutes.

## Three checkers now, three different failure modes

| Script | Catches |
|---|---|
| `check-props.mjs` | a prop used but never declared (the first blue screen) |
| `check-imports.mjs` | an identifier used but never imported (the Settings crash) |
| `check-tdz.mjs` | a dependency read before its declaration (this one) |

All three are in `npm test`. Every one of these bugs compiled cleanly, resolved
its imports, and failed only at runtime — which is exactly why the checks
have to exist separately from the bundler.
