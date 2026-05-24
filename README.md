# Gift List (Firebase)

A clean wish-list site with:
- Personal wish lists (items: name, link, price, notes)
- Shareable links
- Claiming items with username (prevents double-buy via Firestore transaction)
- Surprise mode (owner can’t see claimers / purchased state)

## What this project provides
- **Frontend**: static HTML + JS
- **Backend**: Firebase **Firestore** (enforced with security rules)

## Prerequisites
1. Create a Firebase project: https://console.firebase.google.com/
2. Enable **Cloud Firestore**
3. (Optional) Enable **Hosting** later; not required to run locally.

## Get Firebase config
Copy these values from Firebase console (Project settings → Your apps):
- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

### Add config
Create this file:
- `assets/firebaseConfig.js`

with content like:

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## Firestore data model
Collections:
- `lists/{listId}`: list metadata
  - `ownerMode`: "normal" | "surprise" (we store `surpriseMode` boolean)
  - `surpriseMode`: boolean
  - `createdAt`
- `lists/{listId}/items/{itemId}`: items
  - `name`, `link`, `price`, `notes`
  - `claimedBy` (string) (null if unclaimed)
  - `purchased` (boolean)
  - `createdAt`
  - `claimedAt`

Claiming uses a **transaction** on the item doc, guaranteeing no double-claim.

## Run locally
You can serve static files with any simple static server.

If you have Node installed, run:

```bash
npx serve .
```

Then open the local URL.

> Note: Some browsers block module imports when opened via `file://`. Use a local server.

## Deploy (optional)
Deploy `index.html` + `list.html` + `assets/*` to any static host.

## Important security note
This repo uses Firestore security rules to ensure surprise-mode privacy and to prevent invalid claims.

The rules also require that only a “claimed” transition is allowed when the item is unclaimed.

## Files
- `index.html`
- `list.html`
- `assets/app.js`
- `assets/styles.css`
- `firestore.rules`

