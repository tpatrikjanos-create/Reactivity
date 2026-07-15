/* =====================================================
   SCOREBOARD SZINKRONIZÁCIÓ (Firebase Realtime Database)
   =====================================================
   Ez a fájl köti össze a játék appot egy külön táblet/kijelzőn
   futó "scoreboard" alkalmazással valós időben.

   BEÁLLÍTÁS:
   1. Menj a https://console.firebase.google.com oldalra
   2. "Add project" → adj neki egy nevet (pl. "activity-centrum")
   3. Bal oldali menü → "Build" → "Realtime Database" → "Create Database"
      → válassz egy régiót → indulj "Test mode"-ban (publikus olvasás/írás)
   4. A "Project settings" (fogaskerék ikon) → "General" fülön görgess le
      a "Your apps" részhez → kattints a "</>" (Web) ikonra → regisztrálj egy appot
   5. Onnan kimásolod a config objektumot (apiKey, databaseURL, stb.)
      és ide lent BEILLESZTED a FIREBASE_CONFIG helyére.

   FONTOS: A Realtime Database "Test mode" szabályai 30 nap után lejárnak.
   Hosszú távú használathoz a Database "Rules" fülön állítsd be:
   {
     "rules": {
       "activityGame": {
         ".read": true,
         ".write": true
       }
     }
   }
   (Ez nyilvánosan írható/olvasható - jelszó nélküli, egyszerű demóhoz
   megfelelő, de ne tárolj benne érzékeny adatot.)
========================================================= */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCaQYwKXkmTyKX-oUDYnvYmXeyP9PR8WEU",
  authDomain: "activity-centrum.firebaseapp.com",
  databaseURL: "https://activity-centrum-default-rtdb.firebaseio.com",
  projectId: "activity-centrum",
  storageBucket: "activity-centrum.firebasestorage.app",
  messagingSenderId: "1008452626252",
  appId: "1:1008452626252:web:2f5f542e7b4785fa4551e9"
};

const ScoreboardSync = (() => {
  let db = null;
  let ready = false;
  const PATH = "activityGame";

  function init() {
    if (!FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.databaseURL) {
      // Nincs beállítva Firebase - az app simán működik szinkron nélkül
      ready = false;
      return;
    }
    try {
      if (!window.firebase) { ready = false; return; }
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.database();
      ready = true;
      console.log("[ScoreboardSync] Kapcsolódva a Firebase-hez.");
      // Ha a listenForStart() már korábban meghívódott (mielőtt a Firebase
      // kapcsolat felépült volna), itt csatlakoztatjuk a figyelőt - nincs
      // időkorlát/timeout, eseményvezérelt: amint kész a kapcsolat, azonnal
      // felcsatlakozik, bármeddig is tartott (lassú hálózat esetén sem adja fel).
      attachStartListener();
    } catch (e) {
      console.warn("[ScoreboardSync] Firebase init hiba:", e);
      ready = false;
    }
  }

  function push(data) {
    if (!ready || !db) return;
    try {
      db.ref(PATH).set({
        ...data,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn("[ScoreboardSync] push hiba:", e);
    }
  }

  // ===== Publikus API-k, amiket az app.js hív =====

  function idle() {
    push({ status: "idle" });
  }

  function timerStart(word, mode, points, totalTime) {
    push({
      status: "running",
      word: word || "",
      mode: mode || "",
      points: (points === null || points === undefined) ? null : points,
      timeLeft: totalTime,
      totalTime: totalTime
    });
  }

  function timerTick(timeLeft, totalTime) {
    if (!ready) return;
    try {
      db.ref(PATH).update({ timeLeft, totalTime, updatedAt: Date.now() });
    } catch (e) {}
  }

  function solved(word, points) {
    push({
      status: "solved",
      word: word || "",
      points: (points === null || points === undefined) ? null : points
    });
  }

  function timeout(word, points) {
    push({
      status: "timeout",
      word: word || "",
      points: (points === null || points === undefined) ? null : points
    });
  }

  // Kiválasztva, de még nem indult az időzítő - a GM "másik appja" innen
  // tudja látni mit választott a játékos, és onnan elindítani a kört.
  function readySelected(word, mode, points) {
    push({
      status: "ready",
      word: word || "",
      mode: mode || "",
      points: (points === null || points === undefined) ? null : points
    });
  }

  // ===== A TELJES activityGame NODE FOLYAMATOS FIGYELÉSE =====
  // Mindig friss másolatot tartunk a legutóbb látott állapotról (word/mode/
  // points/status), hogy a startSignal-ra NE kelljen külön, késleltetett
  // (és hibázható) lekérdezést indítani, amíg a jel feldolgozása fut - a
  // "Kör indítása" reakciója emiatt ugyanolyan azonnali, mintha a konzol
  // saját, helyi indítógombja hívta volna.
  let lastKnownGame = null;
  let gameListenerAttached = false;

  function attachGameListener() {
    if (!ready || !db || gameListenerAttached) return;
    gameListenerAttached = true;
    db.ref(PATH).on("value", (snapshot) => {
      lastKnownGame = snapshot.val() || null;
      console.log("[ScoreboardSync] activityGame frissült:", lastKnownGame);
    }, (err) => {
      console.warn("[ScoreboardSync] activityGame figyelő hiba (jogosultság?):", err);
    });
  }

  // ===== TÁVOLI INDÍTÁS FIGYELÉSE =====
  // A GM egy másik appból ír a "activityGame/startSignal" mezőbe
  // (pl. egy időbélyeget), amire ez az app reagál: 3-2-1 leszámolás,
  // majd elindul az időzítő a már kiválasztott szóval.
  let startSignalCallback = null;
  let lastSeenStartSignal = null;
  let startListenerAttached = false;

  function attachStartListener() {
    if (!ready || !db || startListenerAttached || !startSignalCallback) return;
    startListenerAttached = true;
    attachGameListener();
    // Amikor ez a listener csatlakozik, a Firebase AZONNAL visszaadja az akkor
    // aktuális értéket - ezt korábban mindig "csak baseline"-ként kezeltük és
    // sosem indítottunk rá timer-t. Ez azt okozta, hogy ha a GM app épp akkor
    // (vagy közvetlenül előtte) küldött indító jelet, amikor a konzol Firebase
    // kapcsolata még épült ki (pl. friss oldalbetöltés után), a konzol soha
    // nem reagált az első "Kör indítása" gombnyomásra. Csak akkor tekintjük
    // baseline-nak (nem indítunk rá), ha a jel a listener csatlakozása ELŐTT
    // íródott - ha utána/közben, azonnal reagálunk rá.
    const attachedAt = Date.now();
    console.log("[ScoreboardSync] startSignal figyelő csatlakoztatva.");
    db.ref(PATH + "/startSignal").on("value", (snapshot) => {
      const val = snapshot.val();
      console.log("[ScoreboardSync] startSignal érkezett:", val, "| előző:", lastSeenStartSignal);
      if (val === null || val === undefined) return;
      if (val === lastSeenStartSignal) return;
      const isStale = lastSeenStartSignal === null && typeof val === "number" && val < attachedAt;
      lastSeenStartSignal = val;
      if (isStale) { console.log("[ScoreboardSync] -> elavultnak jelölve (a figyelő csatlakozása előtti jel), kihagyva."); return; }
      if (!startSignalCallback) return;
      console.log("[ScoreboardSync] -> indítás, ismert játékállapot:", lastKnownGame);
      startSignalCallback(lastKnownGame);
    }, (err) => {
      console.warn("[ScoreboardSync] startSignal figyelő hiba (jogosultság?):", err);
    });
  }

  function listenForStart(callback) {
    startSignalCallback = callback;
    attachStartListener();
  }

  // A GM másik appból (vagy a konzol saját, helyi GM paneljéből) is jelezheti
  // a kör indítását - ez csak magát a jelet írja, a tényleges indítás logikáját
  // a hallgató oldal (konzol/kivetítő) végzi.
  function signalStart() {
    if (!ready || !db) return;
    try { db.ref(PATH).update({ startSignal: Date.now() }); } catch (e) {}
  }

  return {
    init, idle, timerStart, timerTick, solved, timeout, readySelected,
    listenForStart, signalStart, isReady: () => ready
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  // Kis késleltetés, hogy a Firebase SDK script biztosan betöltődjön előbb
  setTimeout(() => ScoreboardSync.init(), 200);
});
