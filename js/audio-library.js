/* =====================================================
   HANGKÖNYVTÁR - Kategóriánkénti automatizált hangok
   =====================================================
   Ez a fájl kezeli a kategóriánkénti / esemény-specifikus
   hangfájlokat (MP3), amiket a GM tölt fel a panelből.

   Tárolás: IndexedDB (a tableten, böngészőben marad meg,
   nem kell GitHub-ra tölteni minden új zenét).

   SLOT-ok (esemény-típusok), amikhez hangot lehet rendelni:
   - solved            : sikeres megoldás
   - timeout           : lejárt az idő
   - 'Mutasd meg!'      : ezzel a móddal induló kör alatt
   - 'Rajzold le!'
   - 'Magyarázd el!'
   - 'Írd körül!'
   - 'Szájról olvasás!'

   Minden kategória + slot kombinációhoz több hangfájl is
   feltölthető. A lejátszás véletlenszerű, de nem ismétel,
   amíg az adott pakliból mindegyik el nem hangzott egyszer -
   akkor a "elhangzott" lista nullázódik és kezdődik elölről.
========================================================= */

const AudioLibrary = (() => {
  const DB_NAME = 'reactivity_audio';
  const DB_VERSION = 1;
  const STORE = 'tracks';

  let db = null;
  let currentAmbient = null; // jelenleg szóló mód-specifikus zene (Audio elem)

  // "Elhangzott" nyomkövetés: { "catId:slot": ["trackId1", "trackId2", ...] }
  const PLAYED_KEY = 'audioLibraryPlayed';
  function getPlayed() {
    try { return JSON.parse(localStorage.getItem(PLAYED_KEY)) || {}; } catch { return {}; }
  }
  function setPlayed(obj) {
    try { localStorage.setItem(PLAYED_KEY, JSON.stringify(obj)); } catch {}
  }
  function markPlayed(poolKey, trackId) {
    const played = getPlayed();
    if (!played[poolKey]) played[poolKey] = [];
    if (!played[poolKey].includes(trackId)) played[poolKey].push(trackId);
    setPlayed(played);
  }
  function getPlayedIds(poolKey) {
    return getPlayed()[poolKey] || [];
  }
  function resetPlayed(poolKey) {
    const played = getPlayed();
    played[poolKey] = [];
    setPlayed(played);
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const _db = e.target.result;
        if (!_db.objectStoreNames.contains(STORE)) {
          const store = _db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('poolKey', 'poolKey', { unique: false });
        }
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e);
    });
  }

  function poolKey(categoryId, slot) {
    return `${categoryId}:${slot}`;
  }

  async function addTrack(categoryId, slot, file) {
    const _db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const record = {
        poolKey: poolKey(categoryId, slot),
        categoryId, slot,
        name: file.name,
        blob: file,
        addedAt: Date.now()
      };
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e);
    });
  }

  async function getTracks(categoryId, slot) {
    const _db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const idx = store.index('poolKey');
      const req = idx.getAll(poolKey(categoryId, slot));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e);
    });
  }

  async function removeTrack(id) {
    const _db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e);
    });
  }

  async function getAllTracksForCategory(categoryId) {
    const _db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        resolve(all.filter(t => t.categoryId === categoryId));
      };
      req.onerror = (e) => reject(e);
    });
  }

  /* ===== LEJÁTSZÁS, ISMÉTLÉSMENTESEN ===== */

  async function pickUnplayedTrack(categoryId, slot) {
    const tracks = await getTracks(categoryId, slot);
    if (tracks.length === 0) return null;
    const key = poolKey(categoryId, slot);
    let played = getPlayedIds(key);

    let available = tracks.filter(t => !played.includes(t.id));
    if (available.length === 0) {
      // Mindegyik elhangzott már - nullázzuk, kezdjük újra
      resetPlayed(key);
      available = tracks;
    }
    const pick = available[Math.floor(Math.random() * available.length)];
    markPlayed(key, pick.id);
    return pick;
  }

  function playBlob(blob) {
    try {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = SoundEngine.getVolume();
      audio.play().catch(() => {});
      audio.addEventListener('ended', () => URL.revokeObjectURL(url));
      return audio;
    } catch(e) { return null; }
  }

  // Esemény hangok (solved / timeout) - egyszeri lejátszás, nem ambient
  async function playEvent(categoryId, slot) {
    try {
      const track = await pickUnplayedTrack(categoryId, slot);
      if (track) playBlob(track.blob);
    } catch(e) {}
  }

  // Mód-specifikus / üresjárati "ambient" zene - csak egy szólhat egyszerre.
  // Amikor egy szám lejár, automatikusan a pakli következő (még el nem hangzott)
  // számára vált - sosem ismétel, amíg mindegyik el nem hangzott egyszer.
  let currentAmbientPoolKey = null;

  async function playLoopingPool(categoryId, slot) {
    stopAmbient();
    currentAmbientPoolKey = poolKey(categoryId, slot);
    await _playNextInPool(categoryId, slot);
  }

  async function _playNextInPool(categoryId, slot) {
    const myKey = poolKey(categoryId, slot);
    try {
      const track = await pickUnplayedTrack(categoryId, slot);
      if (!track) return; // nincs feltöltött szám ehhez a helyzethez
      const audio = playBlob(track.blob);
      if (!audio) return;
      currentAmbient = audio;
      audio.addEventListener('ended', () => {
        // Csak akkor folytatjuk a kört, ha közben nem váltott át más pool/leállítás
        if (currentAmbientPoolKey === myKey) {
          _playNextInPool(categoryId, slot);
        }
      });
    } catch(e) {}
  }

  function stopAmbient() {
    currentAmbientPoolKey = null;
    if (currentAmbient) {
      try { currentAmbient.pause(); } catch(e) {}
      currentAmbient = null;
    }
  }

  return {
    addTrack, getTracks, removeTrack, getAllTracksForCategory,
    playEvent, playLoopingPool, stopAmbient
  };
})();
