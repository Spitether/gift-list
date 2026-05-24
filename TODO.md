# TODO - Gift List (Firebase)

## Fix list creation UI
- [x] Correct Firebase config import in `index.html`
- [x] Fix item creation call to use `addDoc`
- [ ] After creating list, ensure the page renders the list or provides a copyable share link.

## Deletion
- [ ] Add UI delete buttons for lists (owner mode) and items.
- [ ] Implement Firestore deletes (client).

## Firebase rules
- [ ] Allow item create (with required/optional fields policy).
- [ ] Allow owner delete list + items only for authenticated ownerUid.
- [ ] Keep claim transaction rules safe.

## Field optionality (mandatory vs optional)
- [ ] Items: require `name`; allow optional `price`, `link`, `notes`.
- [ ] Ensure create/update rules enforce the above.

