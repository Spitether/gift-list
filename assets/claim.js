import { firebaseConfig } from './firebaseConfig.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore,
  doc,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function setToast(message, kind){
  const t = document.getElementById('toast');
  t.className = 'toast ' + (kind || '');
  t.textContent = message;
  t.style.display = message ? 'block' : 'none';
}

window.__claimForItem = async function({ listId, itemId, purchased, surpriseMode, btn, userInput }){
  const username = (userInput?.value || '').trim();
  if (!username){
    setToast('Enter a username to claim.', 'err');
    return;
  }

  btn.disabled = true;

  const itemRef = doc(db, 'lists', listId, 'items', itemId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(itemRef);
      if (!snap.exists()) throw new Error('Item not found');
      const data = snap.data();

      if (data.purchased) {
        // Already claimed
        return;
      }

      // Claim atomically
      tx.update(itemRef, {
        purchased: true,
        claimedBy: username,
        claimedAt: Date.now(),
      });
    });

    setToast('Claim submitted!', 'ok');
  } catch (e){
    console.error(e);
    setToast('Could not claim. Try again.', 'err');
  } finally {
    btn.disabled = false;
  }
};

