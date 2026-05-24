# TODO - Gift List (Firebase)

## Plan steps
- [x] Create repo structure + base frontend (index.html, list.html, assets/*)
- [x] Add Firestore security rules file
- [ ] Add project-local setup notes (already started in README)
- [ ] Fix Firestore rules to correctly enforce surprise mode + claiming transitions (current rules are minimal)
- [ ] Add missing Firebase config wiring (firebaseConfig.js placeholder already created)
- [ ] Verify frontend imports work on the intended hosting (static server)
- [ ] Run a quick local smoke test by serving files and ensuring JS loads

## Remaining
- Implement owner/surprise enforcement more strictly:
  - Hide `claimedBy` + purchased status in surprise mode at the rules layer (not only UI)
  - Ensure read permissions prevent leakage of purchased/claimedBy when `surpriseMode` is enabled

