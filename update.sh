#!/usr/bin/env bash
#
# update.sh — Apply a new build without clobbering your local setup.
#
# Replacing the whole folder wipes node_modules, .env, .firebaserc, and any
# dependency versions reconciled by `expo install --check`. That has cost
# several rounds of re-fixing the same three files.
#
# This copies only what actually changes between builds and leaves the rest
# alone.
#
# Usage, from YOUR project directory:
#     ./update.sh ~/Downloads/fanfare-sports
#
set -euo pipefail

SRC="${1:-}"
if [ -z "$SRC" ] || [ ! -d "$SRC" ]; then
  echo "Usage: ./update.sh /path/to/extracted/fanfare-sports"
  exit 1
fi

if [ ! -f "package.json" ]; then
  echo "Run this from your project directory (the one with package.json)."
  exit 1
fi

echo "Updating from: $SRC"
echo ""

# Source and config that's safe to overwrite wholesale.
#
# functions/ is handled separately below: it has its own node_modules, and
# blowing the directory away on every run meant the Cloud Functions deploy failed with
# "Couldn't find firebase-functions package" every single time.
for dir in src scripts public docs tests prototype; do
  if [ -d "$SRC/$dir" ]; then
    rm -rf "./$dir"
    cp -R "$SRC/$dir" "./$dir"
    echo "  updated  $dir/"
  fi
done

# functions/ — replace the source, keep the installed dependencies.
if [ -d "$SRC/functions" ]; then
  mkdir -p ./functions
  find ./functions -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +
  find "$SRC/functions" -mindepth 1 -maxdepth 1 ! -name node_modules -exec cp -R {} ./functions/ \;
  echo "  updated  functions/ (node_modules kept)"
  if [ ! -d "./functions/node_modules" ]; then
    echo ""
    echo "  ! functions/node_modules is missing — Cloud Functions won't deploy."
    echo "    Run:  npm install --prefix functions"
  fi
fi

for file in App.jsx firestore.rules firestore.rules.dev storage.rules \
            firestore.indexes.json babel.config.js metro.config.js \
            build-prototype.mjs update.sh README.md; do
  if [ -f "$SRC/$file" ]; then
    cp "$SRC/$file" "./$file"
    echo "  updated  $file"
  fi
done

echo ""
echo "Deliberately NOT touched:"
echo "  package.json     your reconciled dependency versions"
echo "  app.json         your plugin config"
echo "  .env             your Firebase keys"
echo "  .firebaserc      your project binding"
echo "  node_modules/    no reinstall needed"
echo ""

# Surface anything the new build expects that the local package.json lacks.
if [ -f "$SRC/package.json" ]; then
  MISSING=$(node -e "
    const a=require('./package.json').dependencies||{};
    const b=require('$SRC/package.json').dependencies||{};
    const missing=Object.keys(b).filter(k=>!a[k]);
    console.log(missing.join(' '));
  " 2>/dev/null || true)
  if [ -n "$MISSING" ]; then
    echo "New dependencies this build needs:"
    echo "  npx expo install $MISSING"
    echo ""
  fi
fi

echo "Next:"
echo "  npx expo export --platform web --clear"
echo "  node scripts/finalize-web.mjs"
echo "  firebase deploy --only hosting"
