# Deploying

Two paths. Hosting is automatic; everything else is deliberate.

| What | How | Why |
| --- | --- | --- |
| The web app (hosting) | Push to `main` | Safe to automate — worst case is a bad UI you can redeploy over |
| Cloud Functions | `firebase deploy --only functions` | Manual |
| Firestore rules & indexes | `npm run deploy:backend` | Manual |

Rules stay manual on purpose: a bad rules deploy locks real families out of
their own data, and that should be a decision someone makes at a keyboard, not
a side effect of a push from a phone.

## Automatic hosting deploys

`.github/workflows/deploy.yml` runs on every push to `main`:

1. `npm ci`
2. rebuilds `.env` from repository secrets
3. `npm run check` and `npm test` — **a failure here stops the deploy**
4. `npm run build:web`
5. verifies the bundle actually carries the Firebase config and the fonts
6. `firebase deploy --only hosting`

The Actions run summary prints the build stamp and the URL.

This also kills a recurring footgun. Deploying by hand meant building, then
committing, then noticing the stamp in Settings named the *previous* commit,
then rebuilding. CI always builds from exactly what is on `main`, so the stamp
cannot lie — and there is no longer any reason to make "Stamp build ..."
commits by hand.

## One-time setup

### 1. A service account for the deploy

Firebase Console → **Project settings** → **Service accounts** → **Generate new
private key**. That downloads a JSON file.

GitHub → repo → **Settings** → **Secrets and variables** → **Actions** → **New
repository secret**:

- Name: `FIREBASE_SERVICE_ACCOUNT`
- Value: the entire contents of that JSON file, pasted as-is

Delete the downloaded file afterwards. It is a credential for the whole
project — treat it like a password.

### 2. The client config

Seven more secrets, same place. The values are the ones in your local `.env`:

```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_FIREBASE_VAPID_KEY
```

These end up in the shipped bundle and are readable by anyone who views source
— they identify the project, they do not authorize anything. They live in
secrets to keep them out of the repo, not because they are sensitive. Security
comes from `firestore.rules`.

`EXPO_PUBLIC_SPARK_MODE` is set to `false` by the workflow itself. It is not a
secret and it should never be `true` again now that functions are deployed.

### 3. Check it

Push anything to `main`, or use **Actions → Deploy → Run workflow**. The first
run fails if any secret is missing, and says which one.

## Working from a phone

With this in place, a phone can do the whole loop: edit, commit, push, and the
deploy happens without you. What still needs the desktop is Cloud Functions,
rules, and anything requiring the Firebase CLI logged in as a person.

## Deploying by hand anyway

Still works, unchanged:

```
npm run deploy:web
```

Just remember the stamp names whatever commit was checked out when the build
ran — commit first, then build, or the version in Settings will point at the
wrong code.
