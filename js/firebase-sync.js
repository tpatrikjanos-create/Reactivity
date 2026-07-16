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
       "activityGame":    { ".read": true, ".write": true },
       "activityTeams":   { ".read": true, ".write": true },
       "activityControl": { ".read": true, ".write": true }
     }
   }
   (Ez nyilvánosan írható/olvasható - jelszó nélküli, egyszerű demóhoz
   megfelelő, de ne tárolj benne érzékeny adatot.)

   MEGJEGYZÉS (2026-07-15): ez a fájl szándékosan a kivetítő (kivetito_1.html)
   initFirebase()-ével AZONOS, egyszerű, direkt mintát követi - egyetlen
   window.load-ra induló init, egyetlen db.ref('activityGame').on('value', ...)
   figyelő, semmi közvetett "regisztráld a callbacket egy másik fájlból, majd
   reménykedj, hogy időben csatlakozik" bonyolultság. A korábbi, moduláris
   (attach-flag-ekkel teli) verzió megbízhatatlannak bizonyult éles használatban.
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

  // ===== Publikus API-k, amiket az app.js hív (kimenő adat) =====

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

  // Kiválasztva, de még nem indult az időzítő - a GM App innen tudja látni
  // mit választott a játékos, és onnan elindítani a kört.
  function readySelected(word, mode, points) {
    push({
      status: "ready",
      word: word || "",
      mode: mode || "",
      points: (points === null || points === undefined) ? null : points
    });
  }

  // A GM App (vagy a konzol saját, helyi GM paneljéből) is jelezheti a kör
  // indítását - ez csak magát a jelet írja, a tényleges indítás logikáját
  // a hallgató oldal (konzol/kivetítő) végzi.
  function signalStart() {
    if (!ready || !db) return;
    try { db.ref(PATH).update({ startSignal: Date.now() }); } catch (e) {}
  }

  // Minden új kör indulásakor törli az előző kör rablás-jelentkezéseit, hogy
  // ne "örököljön" jelentkezőket az új feladvány. A kivetítő és a GM App
  // ebből a node-ból olvassa a rablás állapotát (queue + currentIndex + phase).
  function robberyReset() {
    if (!ready || !db) return;
    try { db.ref('activityRobbery').set({ queue: null, currentIndex: -1, phase: 'collecting' }); } catch (e) {}
  }

  // ===== BEJÖVŐ ADAT: a GM App (vagy másik eszköz) által írt változások =====
  // Ugyanaz a minta, mint a kivetítőben: egyetlen közvetlen figyelő a teljes
  // activityGame node-on, ami a state.status VÁLTOZÁSÁRA reagál (nem minden
  // egyes tick-re), plusz egy külön figyelő a startSignal mezőn a 3-2-1-hez.
  // A window.App globálison keresztül közvetlenül hívjuk a konzol logikáját -
  // nincs közbenső "regisztráld a callbacket" réteg, ami elcsúszhatna időzítésben.
  let lastStatus = null;
  let lastStartSignal = null;

  function attachListeners(startAttachedAt) {
    db.ref(PATH).on("value", (snapshot) => {
      const data = snapshot.val();
      console.log("[ScoreboardSync] activityGame:", data);
      if (!data) return;
      if (data.status === lastStatus) return;
      const prevStatus = lastStatus;
      lastStatus = data.status;
      console.log("[ScoreboardSync] státusz váltás:", prevStatus, "->", data.status);

      if (typeof App !== "undefined" && typeof App.onRemoteGameStatus === "function") {
        App.onRemoteGameStatus(data);
      }
    }, (err) => {
      console.warn("[ScoreboardSync] activityGame figyelő hiba (jogosultság?):", err);
    });

    db.ref(PATH + "/startSignal").on("value", (snapshot) => {
      const v = snapshot.val();
      console.log("[ScoreboardSync] startSignal:", v, "| előző:", lastStartSignal);
      if (v === null || v === undefined) return;
      if (v === lastStartSignal) return;
      const isStale = lastStartSignal === null && typeof v === "number" && v < startAttachedAt;
      lastStartSignal = v;
      if (isStale) { console.log("[ScoreboardSync] -> elavult jel (csatlakozás előtti), kihagyva."); return; }
      console.log("[ScoreboardSync] -> távoli indítás.");
      if (typeof App !== "undefined" && typeof App.onRemoteStartSignal === "function") {
        db.ref(PATH).once("value").then((snap) => App.onRemoteStartSignal(snap.val()));
      }
    }, (err) => {
      console.warn("[ScoreboardSync] startSignal figyelő hiba (jogosultság?):", err);
    });
  }

  function init() {
    if (!FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.databaseURL) {
      ready = false;
      return;
    }
    if (!window.firebase) {
      console.warn("[ScoreboardSync] A Firebase SDK nem töltődött be - a szinkron inaktív.");
      ready = false;
      return;
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.database();
      ready = true;
      console.log("[ScoreboardSync] Kapcsolódva a Firebase-hez.");
      attachListeners(Date.now());
    } catch (e) {
      console.warn("[ScoreboardSync] Firebase init hiba:", e);
      ready = false;
    }
  }

  return {
    init, idle, timerStart, solved, timeout, readySelected,
    signalStart, robberyReset, isReady: () => ready
  };
})();

// Ugyanaz a bevált minta, mint a kivetítőben: window 'load'-ra várunk (nem
// DOMContentLoaded-re), mert az garantálja, hogy MINDEN <script> - a Firebase
// SDK is - már lefutott, mielőtt megpróbálnánk használni.
window.addEventListener('load', () => ScoreboardSync.init());
