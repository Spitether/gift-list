# Gift List features v2 (implementation checklist)

This file expands the original plan with the requested features (1–7) while keeping the site simple.

## 0) Current state (already implemented)
- Firebase + Firestore frontend
- Shareable list links (`?list=<id>&mode=view`)
- Claiming via Firestore transaction (prevents double-buy)
- Basic surprise-mode UI hiding

## 1) Add Anonymous Gifting Option (Feature #1)
### UI
On claim UI per item:
- Radio: **Show my username** vs **Anonymous gift giver**

### Data model
- In the claim write, store:
  - `claimerName` (actual username)
  - `claimerDisplayName` (either username or "Anonymous" depending on choice)
- Store this in `claimDetails` subcollection so rules can hide it from owner in surprise mode.

### Rules
- In surprise mode, owner cannot read `claimDetails` (claimers hidden).

## 2) Priority Levels (Feature #2)
### UI
Per item:
- selector: ⭐ Really want / Nice to have / If you’re feeling generous

### Data model
- `items.priority` as one of: `really` | `nice` | `generous`

### Viewer display
- Show a small badge next to item name.

## 3) Price Range Filters (Feature #3)
### UI
On list view:
- filter dropdown / chips:
  - Under $20
  - $20–$50
  - $50–$100
  - Over $100
  - (optional) Clear

### Implementation
- purely frontend filter on the loaded item docs (fast, simple)

## 4) Group Gifting (Feature #4)
### UI
For items that support it:
- toggle “Group gifting”
- goal amount input
- claim form becomes “Chip in”:
  - username
  - contribution amount
  - anonymous toggle
  - optional claim note

### Data model
- `items.goalAmount` (number) OR null
- `items.groupTotal` (number) and `items.groupComplete` (bool) for quick UI
- `itemContributions` subcollection:
  - `contributions/{contribId}`: user, amount, displayName, createdAt

### Transaction
- transaction creates a contribution doc (or updates an existing per `(itemId, username)`), and updates groupTotal.

## 5) Event-Based Lists (Feature #5)
### UI
In create-list page:
- event type dropdown: birthdays, holidays, weddings, baby showers, graduations
- optional date input
- icon shown based on event type

### Data model
- `lists.eventType`
- `lists.eventDate`
- `lists.eventIcon` (derived or stored)

## 6) Auto-Hide Purchased Items for viewers (Feature #6)
### UI
- toggle: “Show purchased” (default OFF)
- default behavior: purchased items hidden.

### Rules
- optional: make purchased status not readable when surprise mode is on.
- for normal mode, allow purchased status.

## 7) Notes for Gift Givers (Feature #7)
### UI
During claim/chip-in:
- textbox: “Notes to share”

### Data model + rules
- Put notes in `claimDetails` / `contributions` subcollection
- Rules must deny owner reads when `lists.surpriseMode == true`.

---

## Firestore security rules next step (critical)
Current rules only partially cover privacy.
Next changes should:
1. Allow read of list and *public item fields* always.
2. When `surpriseMode == true`, deny reads for `claimedBy`/`purchased`/`claimNotes`.
3. Deny updates other than the correct claiming transition.

---

