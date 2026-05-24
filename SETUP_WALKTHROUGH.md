# Firebase Auth (Option 1: anonymous) — setup walkthrough

This app can use Firebase **Anonymous Auth** so anyone can use the site (no passwords) but Firestore rules can still rely on `request.auth != null`.

## 1) Enable Firebase Auth
1. Open: Firebase Console → **Authentication**
2. Go to **Sign-in method**
3. Enable **Anonymous**

## 2) Add Auth code to the frontend
We will add:
- `firebase-auth` import
- `getAuth()`
- `signInAnonymously(auth)`

After that, Firestore security rules can safely allow deletes for authenticated users.

## 3) Required Firestore rule model for secure deletes (recommended)
- When creating a list, we should store `ownerUid` = `user.uid` on the list document.
- Then rules can allow:
  - delete only when `request.auth.uid == resource.data.ownerUid`

## 4) Deploy rules
- After editing `firestore.rules`, go to Firebase Console → Firestore → Rules → **Publish**.

## Note
The current repo already has Firestore rules that require `request.auth != null` for delete.
Without adding anonymous auth to the frontend, list deletion will fail.

