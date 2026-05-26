import firebaseConfig from './firebaseConfig.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function getQueryParam(name){
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function el(id){ return document.getElementById(id); }

function setToast(message, kind){
  const t = el('toast');
  t.className = 'toast ' + (kind || '');
  t.textContent = message;
  t.style.display = message ? 'block' : 'none';
}

async function createList({ownerName, listTitle, surpriseMode}) {
  const { getAuth, signInAnonymously } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
  const auth = getAuth();

  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  const uid = auth.currentUser.uid;

  const list = {
    ownerName: ownerName || 'Owner',
    title: listTitle || 'My Gift List',
    surpriseMode: !!surpriseMode,
    createdAt: serverTimestamp(),
    ownerUid: uid,
  };

  const docRef = await addDoc(collection(db, 'lists'), list);
  return docRef.id;
}

async function ensureItemDefaults(items){
  // sanitize inputs minimal
  return items.map(it => ({
    name: (it.name || '').trim(),
    link: (it.link || '').trim(),
    price: (it.price || '').toString().trim(),
    notes: (it.notes || '').trim(),
  }));
}

async function addItemsToList({listId, items}){
  const itemsCol = collection(db, 'lists', listId, 'items');
  const sanitized = await ensureItemDefaults(items);

  for (const it of sanitized){
    const name = String(it.name || '').trim();
    if (!name) continue;

    const payload = {
      name,
      ...(it.link ? { link: String(it.link).trim() } : {}),
      ...(it.price ? { price: String(it.price).trim() } : {}),
      ...(it.notes ? { notes: String(it.notes).trim() } : {}),
      purchased: false,
      claimedBy: null,
      createdAt: serverTimestamp(),
    };

    await addDoc(itemsCol, payload);
  }
}

async function bootstrapListPage(){
  // Support both old query-string URLs (?list=<id>&mode=view) and
  // new Firebase Hosting rewrites where listId is in the path (/l/<id>). 
  const listIdFromQuery = getQueryParam('list');
  // Prefer query-string; if missing, also support old rewrites like /l/<id>.
  const pathMatch = window.location.pathname.match(/\/l\/(.+?)(?:\/|$)/);
  const listId = listIdFromQuery || (pathMatch ? decodeURIComponent(pathMatch[1]) : null);

  if (!listId) {
    setToast('Missing list id in URL.', 'err');
    return;
  }

  const debugStateEl = el('debugState');
  if (debugStateEl) {
    debugStateEl.style.display = 'block';
    debugStateEl.textContent = `URL: ${window.location.href}\nlistId: ${listId}\nmode: ${getQueryParam('mode') || 'view'}`;
  }



  const viewMode = getQueryParam('mode') || 'view'; // view|owner (owner optional; path links default to view)

  // debugState block above uses viewMode


  // If ownerTools exists (owner delete controls), show them for owner mode.
  // Additionally, allow owner controls to show immediately for list creator by
  // switching into owner mode after auth.
  const ownerMode = viewMode === 'owner';
  const ownerToolsEl = el('ownerTools');
  if (ownerToolsEl) ownerToolsEl.style.display = ownerMode ? 'block' : 'none';

  // Share link must match Firebase Hosting rewrites:
  // - /l/<id> -> rewrites to /list.html
  // - list.html then reads listId from query (?list=) in bootstrapListPage.
  // Use explicit query-string URL so it works even when hosting rewrites aren’t involved.
  // `firebase.json` rewrites only `/l/**` -> `/list.html`, but bootstrap reads `?list=`.
  el('shareLink').value = window.location.origin + `/list.html?list=${encodeURIComponent(listId)}&mode=view`;




  const listDocRef = doc(db, 'lists', listId);

  // Auth (anonymous) for owner-only deletes.
  // We keep view mode public.
  const { getAuth, signInAnonymously } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
  const auth = getAuth();
  let currentUid = null;
  try {
    if (ownerMode) {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
      currentUid = auth.currentUser?.uid || null;
    }
  } catch (e) {
    console.warn('Auth init failed:', e);
    // Most common cause: Anonymous sign-in is not enabled in Firebase Console.
    setToast(
      'Auth misconfigured: enable Firebase Authentication → Anonymous sign-in in the Firebase Console.',
      'err'
    );
  }



  // Don’t rely on createdAt always existing for every item.
  const itemsQ = query(collection(db, 'lists', listId, 'items'));

  let surpriseMode = false;
  let listTitle = '';
  let ownerName = '';
  let ownerUid = null;

  // Listen list metadata
  const listUnsub = onSnapshot(listDocRef, (snap) => {
    if (!snap.exists()) {
      setToast('List not found.', 'err');
      return;
    }
    const data = snap.data();
    surpriseMode = !!data.surpriseMode;
    listTitle = data.title || 'My Gift List';
    ownerName = data.ownerName || 'Owner';
    ownerUid = data.ownerUid || null;

    el('listTitle').textContent = listTitle;
    el('ownerLabel').textContent = ownerName;
    el('surpriseBadge').textContent = surpriseMode ? 'Surprise mode ON' : 'Surprise mode OFF';

    // If owner tools exist, only enable them for the real owner.
    const ownerTools = el('ownerTools');
    if (ownerTools && ownerMode) {
      ownerTools.style.display = currentUid && ownerUid && currentUid === ownerUid ? 'block' : 'none';
    }

      // If surprise mode is ON, hide purchased/claimer info ONLY for viewers.
      // Owners should still see who claimed (requested behavior).
      el('surpriseNotice').textContent = surpriseMode
        ? (ownerMode ? 'Owner cannot see who claimed (hidden in surprise mode).' : 'Surprise mode: claimers are shown to viewers.')
        : 'Owner can see purchases.';

  });

  // Owner-only: Add item form (inline)
  const addItemWrap = ownerMode ? document.getElementById('ownerAddItem') : null;
  if (addItemWrap && ownerMode) {
    // no-op: container will be managed per snapshot below (so it stays visible)
  }

  // Listen items
  const itemsUnsub = onSnapshot(itemsQ, (snap) => {

    const wrap = el('items');
    wrap.innerHTML = '';




    if (snap.empty){
      wrap.innerHTML = '<div class="hint">No items yet.</div>';
      return;
    }

    // Owner add item visibility + handlers (wired once, but safe to call repeatedly)
    const ownerAddItem = el('ownerAddItem');
    if (ownerAddItem && ownerMode) ownerAddItem.style.display = 'block';

    const addItemSaveBtn = el('addItemSave');
    const addItemResetBtn = el('addItemReset');
    if (ownerMode && ownerAddItem && addItemSaveBtn && addItemResetBtn && !addItemSaveBtn.dataset.bound){
      addItemSaveBtn.dataset.bound = '1';
      addItemSaveBtn.addEventListener('click', async () => {
        try {
          addItemSaveBtn.disabled = true;
          const name = (el('addName').value || '').trim();
          const price = (el('addPrice').value || '').trim();
          const link = (el('addLink').value || '').trim();
          const notes = (el('addNotes').value || '').trim();
          if (!name) {
            setToast('Item name is required.', 'err');
            return;
          }

          const payload = {
            name,
            ...(link ? { link } : {}),
            ...(price ? { price } : {}),
            ...(notes ? { notes } : {}),
            purchased: false,
            claimedBy: null,
            createdAt: serverTimestamp(),
          };

          await addDoc(collection(db, 'lists', listId, 'items'), payload);
          setToast('Item added.', 'ok');
        } catch (e){
          console.error(e);
          setToast('Could not add item (owner permissions?).', 'err');
        } finally {
          addItemSaveBtn.disabled = false;
        }
      });

      addItemResetBtn.addEventListener('click', () => {
        el('addName').value = '';
        el('addPrice').value = '';
        el('addLink').value = '';
        el('addNotes').value = '';
      });
    }


    for (const d of snap.docs){
      const itemId = d.id;
      const data = d.data();

      const name = data.name || '';
      const link = data.link || '';
      const price = data.price || '';
      const notes = data.notes || '';

      const purchased = !!data.purchased;
      const claimedBy = data.claimedBy || null;

      // UI: purchased/claimedBy should reflect real Firestore state.
      // Always show that an item is claimed/purchased.
      // Privacy rules:
      // - Owner mode + surprise mode: hide claimer identity
      // - Viewer mode + surprise mode: show claimer identity
      const showPurchased = purchased;
      const showClaimedBy = purchased && claimedBy && (!surpriseMode || !ownerMode);






      const itemEl = document.createElement('div');
      itemEl.className = 'item';

      const top = document.createElement('div');
      top.className = 'itemTop';

      const left = document.createElement('div');
      const title = document.createElement('p');
      title.className = 'itemTitle';
      title.textContent = name;

      const meta = document.createElement('div');
      meta.className = 'itemMeta';
      meta.innerHTML = [
        price ? `<span class="priceTag">${escapeHtml(price)}</span>` : '',
        notes ? `<div style="margin-top:8px">${escapeHtml(notes)}</div>` : ''
      ].join('');

      left.appendChild(title);
      if (link){
        const a = document.createElement('a');
        a.href = link;
        a.target = '_blank';
        a.rel = 'noopener';
        a.style.color = 'var(--accent)';
        a.style.textDecoration = 'none';
        a.style.fontWeight = '800';
        a.style.display = 'inline-block';
        a.style.marginTop = '8px';
        a.textContent = 'View link';
        left.appendChild(a);
      }
      left.appendChild(meta);

      const right = document.createElement('div');
      right.style.minWidth = '160px';

      if (showPurchased){
        const tag = document.createElement('span');
        tag.className = 'claimedTag';
        // If purchased is true but claimedBy is missing/null, still show as claimed.
        tag.textContent = (showClaimedBy && claimedBy)
          ? `Claimed by ${escapeHtml(claimedBy)}`
          : 'Claimed';
        right.appendChild(tag);
      }


      top.appendChild(left);
      top.appendChild(right);

      const bottom = document.createElement('div');
      bottom.className = 'ghost';

      // Owner doesn’t need to claim their own items (and shouldn’t see claim UI).
      // Viewers can still claim in both modes.
      if (!ownerMode) {
        const claimArea = document.createElement('div');
        claimArea.style.marginTop = '12px';
        claimArea.innerHTML = `
          <div class="hint" style="margin-bottom:8px">Claim with your username:</div>
          <div class="row" style="align-items:center">
            <input class="usernameInput" placeholder="Your username" value="" />
            <button class="claimBtn" data-item="${itemId}" ${purchased && !surpriseMode ? 'disabled' : ''}>Claim</button>
          </div>
        `;

        bottom.appendChild(claimArea);
      }


      // Owner-only edit + delete for items.
      if (ownerMode) {
        const ownerEditRow = document.createElement('div');
        ownerEditRow.style.marginTop = '12px';
        ownerEditRow.innerHTML = `
          <div class="hint" style="margin-bottom:8px">Owner edit</div>
          <div class="row" style="align-items:flex-start">
            <div>
              <label>Edit name</label>
              <input data-edit-name="${itemId}" value="${escapeHtml(name)}" />
            </div>
            <div>
              <label>Edit price</label>
              <input data-edit-price="${itemId}" value="${escapeHtml(price)}" />
            </div>
          </div>
          <div class="row" style="margin-top:10px">
            <div>
              <label>Edit link</label>
              <input data-edit-link="${itemId}" value="${escapeHtml(link)}" />
            </div>
          </div>
          <div style="margin-top:10px">
            <label>Edit notes</label>
            <textarea data-edit-notes="${itemId}">${escapeHtml(notes)}</textarea>
          </div>
          <div class="row" style="margin-top:12px; align-items:center">
            <button class="secondary" type="button" data-save-item="${itemId}">Save</button>
            <button class="danger" type="button" data-del-item="${itemId}">Delete item</button>
          </div>
          <div id="toast" class="toast" style="display:none"></div>
        `;

        bottom.appendChild(ownerEditRow);

        ownerEditRow.querySelector('[data-save-item="' + itemId + '"]').addEventListener('click', async () => {
          try {
            const nameEl = ownerEditRow.querySelector('[data-edit-name="' + itemId + '"]');
            const priceEl = ownerEditRow.querySelector('[data-edit-price="' + itemId + '"]');
            const linkEl = ownerEditRow.querySelector('[data-edit-link="' + itemId + '"]');
            const notesEl = ownerEditRow.querySelector('[data-edit-notes="' + itemId + '"]');

            const next = {
              name: String(nameEl.value || '').trim(),
              ...(String(priceEl.value || '').trim() ? { price: String(priceEl.value).trim() } : {}),
              ...(String(linkEl.value || '').trim() ? { link: String(linkEl.value).trim() } : {}),
              ...(String(notesEl.value || '').trim() ? { notes: String(notesEl.value).trim() } : {}),
            };

            if (!next.name) {
              setToast('Item name is required.', 'err');
              return;
            }

            await updateDoc(doc(db, 'lists', listId, 'items', itemId), {
              ...next,
            });
            setToast('Item updated.', 'ok');
          } catch (e) {
            console.error(e);
            setToast('Could not save item.', 'err');
          }
        });

      }


      itemEl.appendChild(top);
      itemEl.appendChild(bottom);

      wrap.appendChild(itemEl);


      // Hook claim button for this item (only exists in view mode).
      const btn = itemEl.querySelector('.claimBtn');
      if (btn) {
        const userInput = itemEl.querySelector('.usernameInput');
        btn.addEventListener('click', async () => {
          // Force a re-render by removing and reloading the UI after claim.
          // This avoids edge-cases where the items onSnapshot listener isn't updating the DOM.
          try {
            btn.disabled = true;
            const res = await (window.__claimForItem && window.__claimForItem({
              listId,
              itemId,
              purchased: btn.disabled || purchased,
              surpriseMode,
              btn,
              userInput,
            }));
          } finally {
            // Hard refresh to reflect Firestore change reliably.
            // (keeps current mode via query string)
            const url = new URL(window.location.href);
            window.location.replace(url.toString());
          }
        });
      }




      // Owner delete handler
      const delBtn = itemEl.querySelector('[data-del-item="' + itemId + '"]');
      if (delBtn) {
        delBtn.addEventListener('click', async () => {
          const ok = confirm('Delete this item?');
          if (!ok) return;
          try {
            await deleteDoc(doc(db, 'lists', listId, 'items', itemId));
            setToast('Item deleted.', 'ok');
          } catch (e) {
            console.error(e);
            setToast('Could not delete item (owner permissions?).', 'err');
          }
        });
      }
    }
  });

  // Owner delete handler (list)
  const delListBtn = el('deleteListBtn');
  if (delListBtn) {
    delListBtn.disabled = !(ownerMode && currentUid && ownerUid && currentUid === ownerUid);
    delListBtn.style.cursor = delListBtn.disabled ? 'not-allowed' : 'pointer';
    delListBtn.addEventListener('click', async () => {
      const typed = prompt('Type DELETE to confirm deleting the entire list. This cannot be undone.');
      if (!typed || typed.trim().toUpperCase() !== 'DELETE') return;
      try {
        // Delete items first
        const { getDocs } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
        const itemsSnap = await getDocs(query(collection(db, 'lists', listId, 'items')));
        for (const d of itemsSnap.docs) {
          await deleteDoc(doc(db, 'lists', listId, 'items', d.id));
        }
        await deleteDoc(doc(db, 'lists', listId));
        setToast('List deleted.', 'ok');
        window.location.href = window.location.pathname + '?mode=owner';
      } catch (e) {
        console.error(e);
        setToast('Could not delete list (owner permissions?).', 'err');
      }
    });
  }


  // Expose basic metadata
  window.__giftList = { listId, ownerMode, surpriseModeRef: () => surpriseMode, listTitle, ownerUidRef: () => ownerUid };



  // Cleanup if needed
  window.__unsub = () => { listUnsub?.(); itemsUnsub?.(); };
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'<','>':'>','"':'"',"'":'&#039;'}[c]));
}

// If list.html includes bootstrap, it will call bootstrapListPage.
export { bootstrapListPage };

