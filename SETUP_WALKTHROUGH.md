# SETUP_WALKTHROUGH.md

## Goal: get the site up and shareable

### 1) Configure Firebase (required)
1. Open `assets/firebaseConfig.js`.
2. Replace the empty strings with your Firebase config values:
   - apiKey
   - authDomain
   - projectId
   - storageBucket
   - messagingSenderId
   - appId

### 2) Deploy/publish Firestore security rules (required)
1. Copy `firestore.rules` from this repo.
2. Firebase Console → Firestore Database → Rules → **Publish**.

> Important: current rules are minimal and are listed in `TODO.md` as needing hardening (surprise-mode privacy, stronger claim constraints). Do this before relying on privacy guarantees.

### 3) Host the frontend (static)
You have:
- `index.html`
- `list.html`
- `assets/*`

Deploy these to any free static host (GitHub Pages / Netlify / Cloudflare Pages).

### 4) Local smoke test (recommended)
Serve locally with a static server (not `file://`), then:
- open `index.html`
- create a list
- open the generated share link

### 5) Functional tests (in this order)
1. Surprise mode OFF:
   - claim an item
   - verify claim shows in the viewer UI
2. Surprise mode ON:
   - claim an item
   - verify owner UI does NOT reveal purchased/claimer info

### 6) Update the to-do list as you finish
After each step above, mark items as completed in:
- `TODO.md`

---

## Map to `TODO.md`
- Fill `assets/firebaseConfig.js` → (sets up Firebase config)
- Publish `firestore.rules` → (deploy rules)
- Run local smoke test → Verify JS works
- Hardening surprise/claim rules → (most important privacy correctness step)

