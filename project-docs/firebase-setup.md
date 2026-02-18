# Firebase Setup (Optional, Recommended)

This app is local-first. Firebase is optional and used for shared cross-device data.

## 1) Create Firebase project
- Go to Firebase Console.
- Create a new project.
- Add a Web app.

## 2) Enable Auth
- Authentication -> Sign-in method.
- Enable `Google` provider.
- Add authorized domains for local/dev and prod.

## 3) Enable Firestore
- Firestore Database -> Create database.
- Start in locked mode (recommended).

## 4) Add web config to app
- Copy Firebase web config from Project settings.
- Store values in environment variables or local config:
  - `apiKey`
  - `authDomain`
  - `projectId`
  - `storageBucket`
  - `messagingSenderId`
  - `appId`
- These are public Web SDK values and are safe to ship in browser apps.
- Do **not** add any server/admin secrets (service account JSON, private keys, admin SDK credentials).

## 5) Security rules baseline
- Restrict records per user:

```txt
match /users/{uid}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

## 6) Data model suggestion
- `users/{uid}/profile/current` -> current collections snapshot
- `users/{uid}/history/{timestamp}` -> immutable historical snapshots

## 7) Sync behavior target
- Keep local cache as source for offline.
- On login: pull remote snapshot, merge, then compute.
- On local mutation: persist local first, then push remote.
