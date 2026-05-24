import { firebaseConfig } from './firebaseConfig.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  onSnapshot,
  orderBy,
  query,
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

async function createList({ownerName, listTitle, surpriseMode}){
  const list = {
    ownerName: ownerName || 'Owner',
    title: listTitle || 'My Gift List',
    surpriseMode: !!surpriseMode,
    createdAt: serverTimestamp(),
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
    if (!it.name) continue;
    await addDoc(itemsCol, {
      ...it,
      purchased: false,
      claimedBy: null,
      createdAt: serverTimestamp(),
    });
  }
}

async function bootstrapListPage(){
  const listId = getQueryParam('list');
  if (!listId) {
    setToast('Missing list id in URL.', 'err');
    return;
  }

  const viewMode = getQueryParam('mode') || 'view'; // view|owner
  const username = (el('username')?.value || '').trim();

  // If owner mode, allow showing purchased state depending on surpriseMode.
  // In surprise mode, owner still should not see claimedBy/purchased.
  const ownerMode = viewMode === 'owner';

  el('shareLink').value = window.location.origin + window.location.pathname + `?list=${encodeURIComponent(listId)}&mode=view`;

  const listDocRef = doc(db, 'lists', listId);

  const itemsQ = query(collection(db, 'lists', listId, 'items'), orderBy('createdAt', 'asc'));

  let surpriseMode = false;
  let listTitle = '';
  let ownerName = '';

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

    el('listTitle').textContent = listTitle;
    el('ownerLabel').textContent = ownerName;
    el('surpriseBadge').textContent = surpriseMode ? 'Surprise mode ON' : 'Surprise mode OFF';

    // If surprise mode is ON, hide purchased/claimer info for everyone (including owner).
    // The UI can still show “Claim” buttons for unclaimed items.
    el('surpriseNotice').textContent = surpriseMode
      ? 'Owner cannot see what was purchased (claimers hidden).'
      : 'Owner can see purchases.';
  });

  // Listen items
  const itemsUnsub = onSnapshot(itemsQ, (snap) => {
    const wrap = el('items');
    wrap.innerHTML = '';

    if (snap.empty){
      wrap.innerHTML = '<div class="hint">No items yet.</div>';
      return;
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

      // UI privacy logic:
      // - if surpriseMode: show no purchased status and no claimedBy
      // - else: show purchased status and claimedBy
      const showPurchased = !surpriseMode && purchased;
      const showClaimedBy = !surpriseMode && purchased && claimedBy;

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
        tag.textContent = showClaimedBy ? `Claimed by ${escapeHtml(claimedBy)}` : 'Claimed';
        right.appendChild(tag);
      }

      top.appendChild(left);
      top.appendChild(right);

      const bottom = document.createElement('div');
      bottom.className = 'ghost';

      const claimArea = document.createElement('div');
      claimArea.style.marginTop = '12px';
      claimArea.innerHTML = `
        <div class="hint" style="margin-bottom:8px">Claim with your username:</div>
        <div class="row" style="align-items:center">
          <input id="username" placeholder="Your username" value="" />
          <button id="claimBtn" data-item="${itemId}" ${purchased && !surpriseMode ? 'disabled' : ''}>Claim</button>
        </div>
      `;

      bottom.appendChild(claimArea);
      itemEl.appendChild(top);
      itemEl.appendChild(bottom);

      wrap.appendChild(itemEl);

      // Hook claim button for this item
      const btn = itemEl.querySelector('#claimBtn');
      const userInput = itemEl.querySelector('#username');
      btn.addEventListener('click', () => {
        window.__claimForItem && window.__claimForItem({listId, itemId, purchased, surpriseMode, btn, userInput});
      });
    }
  });

  // Expose basic metadata
  window.__giftList = { listId, ownerMode, surpriseModeRef: () => surpriseMode, listTitle };

  // Cleanup if needed
  window.__unsub = () => { listUnsub?.(); itemsUnsub?.(); };
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'<','>':'>','"':'"',"'":'&#039;'}[c]));
}

// If list.html includes bootstrap, it will call bootstrapListPage.
export { bootstrapListPage };

