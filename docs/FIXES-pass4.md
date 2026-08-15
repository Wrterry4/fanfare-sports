# Bugs fixed this pass

## Delete buttons did nothing — and neither did Undo

`react-native-web` implements `Alert.alert` as a bare `window.alert`. It shows
the title and **discards the buttons array entirely**, so every `onPress`
callback was silently never called.

That's why Delete Player and Delete Game looked dead: the Firestore code was
correct and the rules allowed it, but the confirmation never resolved so the
delete never ran. The same bug silently disabled:

- Undo on Game Day
- Sign out in Settings
- Every "could not save" error message

All confirmations now go through `src/utils/confirm.js`, which uses
`window.confirm` on web and `Alert.alert` on native, and returns a promise.

## "Every pitch / outcomes only" appeared to stop working

It was working — it just did nothing visible for half of every game.

Casual mode used to keep the pitch row while your own pitcher was on the mound,
so toggling it while your team was in the field changed nothing on screen. Hit
that in the wrong half-inning and the button looks broken.

Casual mode now hides the pitch row in **both** halves. Pitch counts still
matter for rest days, so it swaps in a single **+1 PITCH** tally button while
your pitcher works, which shows the running count and turns red at the limit.
The toggle now always changes something.

## Uniform button outlines

Every control on Game Day carries the same 2pt navy outline. One button with a
heavier border read as "selected"; uniform weight reads as a keypad.

## Nav bar clipping

The previous fix hardcoded `paddingBottom: 22`. An installed PWA reports a
bottom inset that a fixed number can't match, which is why it got *worse*.
Now measured with `useSafeAreaInsets`.

## Dead code

`src/components/BatonBar.jsx` was superseded by the BatonStrip inside
GameDayScreen and was still shipping. Removed.

---

# update.sh — stop re-fixing the same three files

Replacing the whole folder wipes `node_modules`, `.env`, `.firebaserc`, and the
dependency versions `expo install --check` reconciled. That has cost several
rounds.

From your project directory:

```bash
./update.sh ~/Downloads/fanfare-sports
```

Copies `src/`, `functions/`, `scripts/`, `public/`, `docs/`, `tests/`, and the
rules files. Leaves `package.json`, `app.json`, `.env`, `.firebaserc`, and
`node_modules/` untouched — and tells you if the new build needs a dependency
you don't have yet.
