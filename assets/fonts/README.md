# Fonts

**Nothing goes in this folder for the web build.** The fonts the PWA uses live
in `public/fonts/` and are loaded by `public/fonts.css`. See that file for why.

This folder is for a future native build, which needs `expo-font` and static
`.ttf` files rather than `@font-face`.

## What happened here

This README used to ask for six `.ttf` files that were never downloaded, so
`assets/fonts/` sat empty while 84 `fontFamily` declarations across `src/`
named `Archivo` and `PublicSans`. Every one silently fell back to the system
font — the scoreboard shipped in Segoe UI for months. The old note predicted
exactly that ("if the scoreboard looks generic after a build, these didn't
link") and nobody read it in time.

Two things changed when it was fixed:

1. **`@font-face`, not `expo-font`.** `useFonts()` maps one file to one family
   name, but the app needs `Archivo` at 700, 800, and 900 — one family, several
   weights. Only `@font-face` expresses that.
2. **Two files, not six.** Google serves Archivo and Public Sans as *variable*
   fonts. Requesting three weights returns the same file three times; the three
   URLs each family does have are character subsets, not weights.

## If you add native later

Download the static instances from Google Fonts into this folder, register them
in `app.json`, and call `useFonts` — the web path is unaffected and keeps using
`public/fonts.css`.

- **Archivo** — https://fonts.google.com/specimen/Archivo (Bold, ExtraBold, Black)
- **Public Sans** — https://fonts.google.com/specimen/Public+Sans (Regular, SemiBold, Bold)

Both are SIL Open Font License 1.1.
