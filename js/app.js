/* ===== STORAGE ===== */
const Store = {
  get: (k, def) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

/* ===== STATE ===== */
const state = {
  // "csaladi" -> "altalanos" átnevezés (2026-07-15) - régi mentett érték migrálása
  activeCategoryId: (Store.get('activeCategoryId', 'altalanos') === 'csaladi') ? 'altalanos' : Store.get('activeCategoryId', 'altalanos'),
  timerSecs: Store.get('timerSecs', 60),
  pick3SelectSecs: Store.get('pick3SelectSecs', 15),
  apiKey: Store.get('apiKey', ''),
  hideWords: Store.get('hideWords', false),
  currentWord: null,
  currentMode: null,
  currentPoints: null,
  threeCards: [],
  selectedPick3Index: null,
  pick3Interval: null,
  pick3TimeLeft: 15,
  timerInterval: null,
  timeLeft: 60,
  usedWords: Store.get('usedWords', {})
};

const CIRC = 2 * Math.PI * 96;

/* ===== SESSION ===== */
const Session = {
  getUsed(id) { return state.usedWords[id] || []; },
  markUsed(id, w) {
    if (!state.usedWords[id]) state.usedWords[id] = [];
    if (!state.usedWords[id].includes(w)) { state.usedWords[id].push(w); Store.set('usedWords', state.usedWords); }
  },
  reset() { state.usedWords = {}; Store.set('usedWords', {}); },
  totalUsed() { return Object.values(state.usedWords).reduce((s, a) => s + a.length, 0); }
};

/* ===== AI PROMPTS ===== */
const CAT_PROMPTS = {
  tizennyolcPlus: (modeName, used) => {
    const u = used.length > 0 ? `\nMÁR HASZNÁLT szavak (TILOS megismételni): ${used.join(', ')}` : '';
    return `Te egy felnőtt bulihoz készült, ittas társaság számára szóló Activity játék feladványgenerátora vagy. Feladattípus: "${modeName}". Generálj EGYETLEN rövid, nagyon vulgáris, trágár, szókimondó, obszcén magyar szót vagy kifejezést (max 3 szó). Legyen durva, szexuálisan explicit, akár ocsmány – ez egy csapatépítős ivós parti játék.${u}\nCsak a szót válaszold!`;
  },
  ceges: (modeName, used) => {
    const u = used.length > 0 ? `\nMÁR HASZNÁLT szavak (TILOS megismételni): ${used.join(', ')}` : '';
    return `Céges csapatépítő Activity játék feladványgenerátora. Feladattípus: "${modeName}". Generálj EGYETLEN rövid, irodai témájú, vidám magyar szót (max 3 szó).${u}\nCsak a szót válaszold!`;
  },
  gyerek: (modeName, used) => {
    const u = used.length > 0 ? `\nMÁR HASZNÁLT szavak (TILOS megismételni): ${used.join(', ')}` : '';
    return `Gyerekzsúr Activity feladványgenerátora, 6-12 éveseknek. Feladattípus: "${modeName}". Generálj EGYETLEN egyszerű, gyerekbarát magyar szót (max 3 szó).${u}\nCsak a szót válaszold!`;
  },
  default: (catName, modeName, used) => {
    const u = used.length > 0 ? `\nMÁR HASZNÁLT szavak (TILOS megismételni): ${used.join(', ')}` : '';
    return `Activity társasjáték feladványgenerátora. Kategória: "${catName}". Feladattípus: "${modeName}". Generálj EGYETLEN rövid, kreatív magyar szót (max 3 szó).${u}\nCsak a szót válaszold!`;
  }
};

/* ===== MODES META ===== */
const MODES_META = {
  'Mutasd meg!':        { icon: 'ti-user',          hint: 'Csak mutogatással, szó nélkül!' },
  'Rajzold le!':        { icon: 'ti-pencil',         hint: 'Csak rajzzal, szó és jel nélkül!' },
  'Magyarázd el!':      { icon: 'ti-message-circle', hint: 'Szóban magyarázd körül!' },
  'Írd körül!':         { icon: 'ti-writing',        hint: 'Egy mondatban körülírd!' },
  'Szájról olvasás!':   { icon: 'ti-mouth',          hint: 'Hangtalanul mozgasd a szájad – semmi hang!' }
};

// A belső adatkulcsok (fenti MODES_META, adatfájlok) NEM változtak, csak a
// képernyőn megjelenő elnevezés - így nem kellett a több száz szó-bejegyzést
// átírni. 2026-07-15: átnevezve a felhasználó kérésére.
const MODE_DISPLAY_NAMES = {
  'Mutasd meg!':       'Mutogatás',
  'Rajzold le!':       'Rajzolás',
  'Magyarázd el!':     'Magyarázás',
  'Írd körül!':        'Körülírás',
  'Szájról olvasás!':  'Szájról olvasás'
};

/* ===== AI GENERÁLÁS ===== */
async function generateWithAI(category) {
  const modeNames = Object.keys(category.words);
  const modeName = modeNames[Math.floor(Math.random() * modeNames.length)];
  const modeObj = MODES_META[modeName] || MODES[0];
  const used = Session.getUsed(category.id);

  let prompt;
  if (category.id === 'tizennyolcPlus') prompt = CAT_PROMPTS.tizennyolcPlus(modeName, used);
  else if (category.id === 'ceges') prompt = CAT_PROMPTS.ceges(modeName, used);
  else if (category.id === 'gyerek') prompt = CAT_PROMPTS.gyerek(modeName, used);
  else prompt = CAT_PROMPTS.default(category.name, modeName, used);

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": state.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 60,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!resp.ok) throw new Error('API hiba');
  const data = await resp.json();
  return { word: data.content?.[0]?.text?.trim() || null, modeName, modeObj };
}

/* ===== FALLBACK ===== */
function generateFallback(category) {
  const modeNames = Object.keys(category.words);
  const used = Session.getUsed(category.id);
  let available = [];
  for (const m of modeNames) for (const w of category.words[m]) if (!used.includes(w)) available.push({ modeName: m, word: w });
  if (available.length === 0) {
    state.usedWords[category.id] = [];
    Store.set('usedWords', state.usedWords);
    for (const m of modeNames) for (const w of category.words[m]) available.push({ modeName: m, word: w });
  }
  const pick = available[Math.floor(Math.random() * available.length)];
  return { word: pick.word, modeName: pick.modeName, modeObj: MODES_META[pick.modeName] || MODES[0] };
}

/* ===== 3 KÁRTYÁS HÚZÁS (1/2/3 PONT) - "pick3" kategóriákhoz ===== */
// A WORDS_18PLUS / WORDS_ALTALANOS tömbök a data-18plus.js / data-altalanos.js
// fájlokból jönnek. Minden húzásnál pontosan 1 db 1-pontos, 1 db 2-pontos,
// 1 db 3-pontos kártyát adunk, amiből a játékos választ.
const PICK3_SOURCES = {
  tizennyolcPlus: () => WORDS_18PLUS,
  altalanos: () => WORDS_ALTALANOS
};

function pickWordForTier(categoryId, tierPoints, excludeWords) {
  const used = Session.getUsed(categoryId);
  const source = (PICK3_SOURCES[categoryId] && PICK3_SOURCES[categoryId]()) || [];
  const pool = source.filter(e =>
    e.points === tierPoints &&
    !used.includes(e.word) &&
    !excludeWords.includes(e.word)
  );
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function drawPick3Tier(categoryId, tierPoints, excludeWords) {
  let pick = pickWordForTier(categoryId, tierPoints, excludeWords);
  if (pick) {
    return { word: pick.word, modeName: pick.mode, modeObj: MODES_META[pick.mode] || MODES[0], points: pick.points };
  }

  // Kifogyott ez a pontszint a sessionben -> AI próbálkozás, ha van kulcs (csak 18+-nál van rá promptunk)
  if (state.apiKey && categoryId === 'tizennyolcPlus') {
    try {
      const modes = (tierPoints === 2)
        ? ['Mutasd meg!', 'Rajzold le!', 'Magyarázd el!', 'Szájról olvasás!']
        : ['Mutasd meg!', 'Rajzold le!', 'Magyarázd el!'];
      const modeName = modes[Math.floor(Math.random() * modes.length)];
      const used = Session.getUsed(categoryId).concat(excludeWords);
      const prompt = CAT_PROMPTS.tizennyolcPlus(modeName, used);

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": state.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 60,
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        const word = data.content?.[0]?.text?.trim();
        if (word) return { word, modeName, modeObj: MODES_META[modeName] || MODES[0], points: tierPoints };
      }
    } catch(e) {}
  }

  // Nincs API kulcs, vagy az AI sikertelen (vagy nincs AI erre a kategóriára) -> recikláljuk a session-listát
  state.usedWords[categoryId] = [];
  Store.set('usedWords', state.usedWords);
  pick = pickWordForTier(categoryId, tierPoints, excludeWords);
  if (pick) {
    return { word: pick.word, modeName: pick.mode, modeObj: MODES_META[pick.mode] || MODES[0], points: pick.points };
  }

  // Végszükség (elméletileg nem fordulhat elő)
  return { word: "???", modeName: "Mutasd meg!", modeObj: MODES_META['Mutasd meg!'], points: tierPoints };
}

async function drawPick3ThreeCards(categoryId) {
  const c1 = await drawPick3Tier(categoryId, 1, []);
  const c3 = await drawPick3Tier(categoryId, 3, [c1.word]);
  const c2 = await drawPick3Tier(categoryId, 2, [c1.word, c3.word]);
  return [c1, c2, c3];
}

/* ===== UI ===== */
const UI = {
  showState(name) {
    document.querySelectorAll('.state').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('state-' + name);
    if (el) { el.classList.add('active'); void el.offsetWidth; }
  },
  hideAll() {
    document.getElementById('gm-panel').classList.remove('active');
  },
  openGMPanel() {
    SoundEngine.play('menu-open');
    document.getElementById('api-key-input').value = state.apiKey;
    document.getElementById('timer-range').value = state.timerSecs;
    document.getElementById('timer-val').textContent = state.timerSecs;
    document.getElementById('pick3-range').value = state.pick3SelectSecs;
    document.getElementById('pick3-val').textContent = state.pick3SelectSecs;
    document.getElementById('gm-status').textContent = '';
    document.getElementById('sound-toggle').checked = SoundEngine.isEnabled();
    document.getElementById('hidewords-toggle').checked = state.hideWords;
    document.getElementById('volume-range').value = Math.round(SoundEngine.getVolume() * 100);
    document.getElementById('volume-val').textContent = Math.round(SoundEngine.getVolume() * 100) + '%';
    UI.updateSessionCounter();
    UI.renderCategoryGrid();
    UI.populateAudioCategorySelect();
    UI.refreshAudioLibraryList();
    document.getElementById('gm-panel').classList.add('active');
  },
  renderCategoryGrid() {
    document.getElementById('category-grid').innerHTML = CATEGORIES.map(cat => `
      <button class="cat-btn ${cat.id === state.activeCategoryId ? 'selected' : ''}"
        onclick="UI.selectCategory('${cat.id}')">
        <i class="ti ${cat.icon}"></i>
        <div>
          <div>${cat.name}</div>
          <div style="font-size:11px;opacity:0.6;font-weight:400;margin-top:2px;">${cat.description}</div>
        </div>
      </button>`).join('');
  },
  selectCategory(id) { SoundEngine.play('cat-select'); state.activeCategoryId = id; UI.renderCategoryGrid(); },
  updateTimerLabel() { document.getElementById('timer-val').textContent = document.getElementById('timer-range').value; },
  updatePick3Label() { document.getElementById('pick3-val').textContent = document.getElementById('pick3-range').value; },
  updateVolumeLabel() {
    const v = document.getElementById('volume-range').value;
    document.getElementById('volume-val').textContent = v + '%';
    SoundEngine.setVolume(v / 100);
  },
  toggleSound() { const on = document.getElementById('sound-toggle').checked; SoundEngine.setEnabled(on); if (on) SoundEngine.play('btn-click'); },
  toggleHideWords() {
    state.hideWords = document.getElementById('hidewords-toggle').checked;
    Store.set('hideWords', state.hideWords);
    // Ha épp látszik egy feladvány, azonnal frissítsük a megjelenítést
    if (document.getElementById('state-card')?.classList.contains('active')) {
      document.getElementById('challenge-word').classList.toggle('word-hidden', state.hideWords);
    }
    if (document.getElementById('state-pick3')?.classList.contains('active') && state.threeCards.length && state.selectedPick3Index === null) {
      UI.renderPick3(state.threeCards);
    }
  },
  updateSessionCounter() {
    const t = Session.totalUsed();
    const el = document.getElementById('session-counter');
    if (el) el.textContent = t > 0 ? `${t} szó elhangzott` : 'Még nincs elhangzott szó';
  },
  resetSession() { Session.reset(); UI.updateSessionCounter(); document.getElementById('gm-status').textContent = '✓ Session visszaállítva!'; },

  manualStartTimer() {
    if (!state.currentWord) {
      document.getElementById('gm-status').textContent = '⚠ Nincs kiválasztott feladvány még!';
      return;
    }
    UI.hideAll();
    // A kivetítő is a "startSignal" mezőt figyeli a 3-2-1 leszámoláshoz -
    // a helyi (konzolos) indításnál is elküldjük, hogy szinkronban maradjanak.
    if (window.ScoreboardSync) ScoreboardSync.signalStart();
    App.onRemoteStartSignal();
  },

  /* ===== HANGKÖNYVTÁR GM UI ===== */
  populateAudioCategorySelect() {
    const sel = document.getElementById('audio-cat-select');
    if (!sel) return;
    sel.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  },

  async refreshAudioLibraryList() {
    const catId = document.getElementById('audio-cat-select').value;
    const slot = document.getElementById('audio-slot-select').value;
    const listEl = document.getElementById('audio-track-list');
    if (!listEl) return;
    try {
      const tracks = await AudioLibrary.getTracks(catId, slot);
      if (tracks.length === 0) {
        listEl.innerHTML = '<div class="audio-track-empty">Még nincs hozzárendelt hangfájl ehhez a helyzethez.</div>';
        return;
      }
      listEl.innerHTML = tracks.map(t => `
        <div class="audio-track-item">
          <i class="ti ti-music"></i>
          <span class="track-name">${t.name}</span>
          <button class="track-del" onclick="UI.deleteAudioTrack(${t.id})"><i class="ti ti-trash"></i></button>
        </div>`).join('');
    } catch(e) {
      listEl.innerHTML = '<div class="audio-track-empty">Hiba a betöltéskor.</div>';
    }
  },

  async uploadAudioFiles() {
    const input = document.getElementById('audio-file-input');
    const catId = document.getElementById('audio-cat-select').value;
    const slot = document.getElementById('audio-slot-select').value;
    if (!input.files || input.files.length === 0) return;
    for (const file of input.files) {
      try { await AudioLibrary.addTrack(catId, slot, file); } catch(e) {}
    }
    input.value = '';
    UI.refreshAudioLibraryList();
    document.getElementById('gm-status').textContent = '✓ Hangfájl(ok) feltöltve!';
  },

  async deleteAudioTrack(id) {
    try { await AudioLibrary.removeTrack(id); } catch(e) {}
    UI.refreshAudioLibraryList();
  },
  saveGMSettings() {
    SoundEngine.play('btn-click');
    const sel = document.querySelector('.cat-btn.selected');
    if (sel) { const m = sel.getAttribute('onclick').match(/'([^']+)'/); if (m) state.activeCategoryId = m[1]; }
    state.timerSecs = parseInt(document.getElementById('timer-range').value);
    state.pick3SelectSecs = parseInt(document.getElementById('pick3-range').value);
    state.apiKey = document.getElementById('api-key-input').value.trim();
    Store.set('activeCategoryId', state.activeCategoryId);
    Store.set('timerSecs', state.timerSecs);
    Store.set('pick3SelectSecs', state.pick3SelectSecs);
    Store.set('apiKey', state.apiKey);
    const cat = CATEGORIES.find(c => c.id === state.activeCategoryId);
    if (cat) document.getElementById('active-cat-name').textContent = cat.name;

    // Ha épp az üresjárati képernyőn vagyunk, frissítjük az ambient zenét az új kategóriára
    const idleVisible = document.getElementById('state-idle')?.classList.contains('active');
    if (idleVisible && window.AudioLibrary) {
      AudioLibrary.stopAmbient();
      AudioLibrary.playLoopingPool(state.activeCategoryId, 'idle');
    }

    document.getElementById('gm-status').textContent = '✓ Mentve!';
    setTimeout(() => UI.hideAll(), 1200);
  },
  setLoading(on) { document.getElementById('loading-overlay').style.display = on ? 'flex' : 'none'; },

  renderPick3(cards) {
    const grid = document.getElementById('pick3-grid');
    grid.classList.remove('locked');
    grid.innerHTML = cards.map((c, i) => `
      <button class="pick3-card" data-idx="${i}" onclick="App.selectPick3Card(${i})">
        <div>
          <div class="pick3-points">${c.points} pontos</div>
          <div class="pick3-stars">${'★'.repeat(c.points)}</div>
        </div>
        <div class="pick3-divider"></div>
        <div class="pick3-word${state.hideWords ? ' word-hidden' : ''}">${c.word}</div>
        <div class="pick3-mode">
          <i class="ti ${(c.modeObj && c.modeObj.icon) || 'ti-star'}"></i>
          ${MODE_DISPLAY_NAMES[c.modeName] || c.modeName}
        </div>
        <i class="ti ti-circle-check pick3-check"></i>
      </button>`).join('');
    const waitEl = document.getElementById('pick3-waiting');
    if (waitEl) waitEl.style.display = 'none';
  },
  startFullscreen() {
    const el = document.getElementById('fs-start');
    if (el) { el.style.display = 'none'; }
    try {
      const d = document.documentElement;
      if (d.requestFullscreen) d.requestFullscreen({ navigationUI: 'hide' });
      else if (d.webkitRequestFullscreen) d.webkitRequestFullscreen();
      else if (d.mozRequestFullScreen) d.mozRequestFullScreen();
    } catch(e) {}
    if (window.AudioLibrary) AudioLibrary.playLoopingPool(state.activeCategoryId, 'idle');
  },
  toggleFullscreen() {
    try {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
      if (!isFs) {
        const d = document.documentElement;
        if (d.requestFullscreen) d.requestFullscreen({ navigationUI: 'hide' });
        else if (d.webkitRequestFullscreen) d.webkitRequestFullscreen();
        else if (d.mozRequestFullScreen) d.mozRequestFullScreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
      }
    } catch(e) {}
  },

  /* ===== KONFETTI ANIMÁCIÓ ===== */
  launchConfetti() {
    const burst = document.getElementById('celebrate-burst');
    if (!burst) return;
    burst.innerHTML = '';
    const colors = ['#1ec8ff', '#4ee6ff', '#27c47a', '#3b82f6', '#e84040', '#a855f7', '#fbbf24'];
    const pieceCount = 80;

    for (let i = 0; i < pieceCount; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 100;
      const delay = Math.random() * 0.4;
      const duration = 1.8 + Math.random() * 1.4;
      const drift = (Math.random() - 0.5) * 200;
      const spin = (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720);
      const size = 6 + Math.random() * 8;

      piece.style.left = left + '%';
      piece.style.background = color;
      piece.style.width = size + 'px';
      piece.style.height = (size * 1.6) + 'px';
      piece.style.animationDuration = duration + 's';
      piece.style.animationDelay = delay + 's';
      piece.style.setProperty('--drift', drift + 'px');
      piece.style.setProperty('--spin', spin + 'deg');

      burst.appendChild(piece);
    }

    // Eltakarítás némi idő után
    setTimeout(() => { burst.innerHTML = ''; }, 4000);
  }
};

/* ===== APP ===== */
const App = {
  async drawCard() {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFs) { try { const d = document.documentElement; if (d.requestFullscreen) d.requestFullscreen({ navigationUI: 'hide' }); else if (d.webkitRequestFullscreen) d.webkitRequestFullscreen(); } catch(e) {} }

    if (window.AudioLibrary) AudioLibrary.stopAmbient(); // üresjárati zene leállítása

    SoundEngine.play('card-draw');
    const category = CATEGORIES.find(c => c.id === state.activeCategoryId);
    if (!category) return;

    if (category.pick3) {
      await App.drawPick3(category.id);
      return;
    }

    // ===== ÖSSZES TÖBBI KATEGÓRIA: a meglévő AI/fallback logika, egyszavas húzás =====
    let result;
    if (state.apiKey) {
      UI.setLoading(true);
      try {
        result = await generateWithAI(category);
        if (!result.word || Session.getUsed(category.id).includes(result.word)) result = generateFallback(category);
      } catch(e) { result = generateFallback(category); }
      finally { UI.setLoading(false); }
    } else {
      result = generateFallback(category);
    }

    Session.markUsed(category.id, result.word);
    state.currentWord = result.word;
    state.currentMode = result.modeName;
    state.currentPoints = null;

    const wordEl = document.getElementById('challenge-word');
    wordEl.textContent = result.word;
    wordEl.classList.toggle('word-hidden', state.hideWords);
    document.getElementById('mode-label').textContent = MODE_DISPLAY_NAMES[result.modeName] || result.modeName;
    document.getElementById('mode-icon').className = 'ti ' + (result.modeObj?.icon || 'ti-star');
    document.getElementById('challenge-desc').textContent = result.modeObj?.hint || '';

    UI.showState('card');
    ScoreboardSync.readySelected(state.currentWord, state.currentMode, state.currentPoints);
  },

  /* ===== HÁROM KÁRTYÁS HÚZÁS (pick3 kategóriáknál) ===== */
  async drawPick3(categoryId) {
    UI.setLoading(true);
    let cards;
    try {
      cards = await drawPick3ThreeCards(categoryId);
    } finally {
      UI.setLoading(false);
    }

    // A 3 megjelenített szó még NEM számít elhasználtnak -
    // csak az válik elhasználttá, amelyiket a játékos végül kiválasztja.
    state.threeCards = cards;
    state.selectedPick3Index = null;
    UI.renderPick3(cards);
    UI.showState('pick3');
    App.startPick3Countdown();
  },

  startPick3Countdown() {
    App.stopPick3Countdown();
    const secs = state.pick3SelectSecs;
    state.pick3TimeLeft = secs;
    const el = document.getElementById('pick3-countdown');
    const numEl = document.getElementById('pick3-countdown-num');
    if (el) { el.style.display = ''; el.classList.remove('urgent'); }
    if (numEl) numEl.textContent = secs;

    state.pick3Interval = setInterval(() => {
      state.pick3TimeLeft--;
      if (numEl) numEl.textContent = Math.max(state.pick3TimeLeft, 0);
      if (el && state.pick3TimeLeft <= 5) el.classList.add('urgent');

      if (state.pick3TimeLeft <= 0) {
        App.stopPick3Countdown();
        // Ha még nem választott - véletlenszerűen kiválasztunk egyet
        if (state.selectedPick3Index === null) {
          const randomIdx = Math.floor(Math.random() * state.threeCards.length);
          App.selectPick3Card(randomIdx);
        }
      }
    }, 1000);
  },

  stopPick3Countdown() {
    if (state.pick3Interval) { clearInterval(state.pick3Interval); state.pick3Interval = null; }
    const el = document.getElementById('pick3-countdown');
    if (el) el.style.display = 'none';
  },

  selectPick3Card(idx) {
    SoundEngine.play('btn-click');
    App.stopPick3Countdown();
    state.selectedPick3Index = idx;
    document.querySelectorAll('.pick3-card').forEach((el, i) => {
      el.classList.toggle('selected', i === idx);
    });

    const picked = state.threeCards[idx];
    state.currentWord = picked.word;
    state.currentMode = picked.modeName;
    state.currentPoints = picked.points;
    Session.markUsed(state.activeCategoryId, picked.word);

    const grid = document.getElementById('pick3-grid');
    if (grid) grid.classList.add('locked');
    const waitEl = document.getElementById('pick3-waiting');
    if (waitEl) waitEl.style.display = 'flex';

    ScoreboardSync.readySelected(state.currentWord, state.currentMode, state.currentPoints);
  },

  /* ===== 3-2-1 LESZÁMOLÁS + TÁVOLI INDÍTÁS ===== */
  runCountdownThenStart() {
    let n = 3;
    const numEl = document.getElementById('countdown-num');
    UI.showState('countdown');
    numEl.textContent = n;
    SoundEngine.play('beep');

    const interval = setInterval(() => {
      n--;
      if (n > 0) {
        numEl.textContent = n;
        numEl.style.animation = 'none';
        void numEl.offsetWidth;
        numEl.style.animation = '';
        SoundEngine.play('beep');
      } else {
        clearInterval(interval);
        App.startTimer();
      }
    }, 800);
  },

  // A GM egy másik appból (pl. a GM appból) indítja el a kört -
  // ez a függvény hívódik meg, amikor a Firebase "startSignal" mezője frissül.
  // remoteGame: a Firebase activityGame node aktuális tartalma (lehet null) -
  // ha a konzolnak helyileg nincs kiválasztott szava (pl. újratöltés után),
  // ebből pótoljuk, hogy a konzol és a GM app mindig ugyanazt lássa.
  onRemoteStartSignal(remoteGame) {
    console.log('[App] onRemoteStartSignal, helyi szó:', state.currentWord, '| távoli állapot:', remoteGame);
    if (!state.currentWord && remoteGame && remoteGame.word) {
      state.currentWord = remoteGame.word;
      state.currentMode = remoteGame.mode || null;
      state.currentPoints = (remoteGame.points === undefined) ? null : remoteGame.points;
    }
    if (!state.currentWord) {
      console.warn('[App] onRemoteStartSignal megszakítva: se helyi, se távoli feladvány nincs kiválasztva.');
      return;
    }
    App.runCountdownThenStart();
  },

  // A GM App (vagy bármely másik app) közvetlenül a "Megoldva"/"Lejárt"
  // állapotot is beállíthatja a Firebase-ben (pl. a GM App saját "Megoldva"
  // gombjával) - ezt a konzolnak is le kell követnie, ha épp fut nála az
  // időzítő, különben a képernyője rossz állapotban ragad.
  onRemoteGameStatus(game) {
    if (!game || !game.status) return;
    const status = game.status;
    if (status === App._lastSeenRemoteStatus) return;
    App._lastSeenRemoteStatus = status;

    const timerActive = document.getElementById('state-timer')?.classList.contains('active');
    if (!timerActive) return; // csak akkor követjük, ha épp fut nálunk a kör

    if (status === 'solved') {
      console.log('[App] Távoli "Megoldva" jelzés érkezett, helyi időzítő leállítása.');
      if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
      if (window.AudioLibrary) AudioLibrary.stopAmbient();
      // Az ünneplő hang a kivetítőn szól, nem itt.
      if (window.AudioLibrary) AudioLibrary.playEvent(state.activeCategoryId, 'solved');
      document.getElementById('solved-word-recap').textContent = game.word || state.currentWord || '';
      UI.showState('solved');
      UI.launchConfetti();
    } else if (status === 'timeout') {
      console.log('[App] Távoli "Lejárt" jelzés érkezett, helyi időzítő leállítása.');
      if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
      if (window.AudioLibrary) AudioLibrary.stopAmbient();
      if (window.AudioLibrary) AudioLibrary.playEvent(state.activeCategoryId, 'timeout');
      document.getElementById('btn-solved').style.display = 'none';
      document.getElementById('btn-done').style.display = '';
      UI.showState('timeout');
    }
  },

  startTimer() {
    // Az időzítő hangjai (indítás/tik-tak/duda) a kivetítőn szólnak, nem itt.
    const secs = state.timerSecs;
    state.timeLeft = secs;

    // Hangkönyvtár: mód-specifikus ambient zene indítása (ismétlésmentes körforgásban)
    if (window.AudioLibrary) AudioLibrary.playLoopingPool(state.activeCategoryId, state.currentMode);

    // Scoreboard szinkron: időzítő indul, szó/mód/pont átadása
    ScoreboardSync.timerStart(state.currentWord, state.currentMode, state.currentPoints, secs);

    const arc = document.getElementById('timer-arc');
    arc.style.strokeDasharray = CIRC;
    arc.style.transition = 'none';
    arc.style.strokeDashoffset = '0';
    arc.style.stroke = '#27c47a';

    document.getElementById('timer-num').textContent = secs;
    document.getElementById('timer-word-recap').textContent = state.currentWord || '';
    document.getElementById('btn-done').style.display = 'none';
    document.getElementById('btn-solved').style.display = '';
    UI.showState('timer');

    setTimeout(() => {
      arc.style.transition = `stroke-dashoffset ${secs}s linear, stroke 1s ease`;
      arc.style.strokeDashoffset = CIRC;
    }, 80);

    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      state.timeLeft--;
      document.getElementById('timer-num').textContent = state.timeLeft;
      const pct = state.timeLeft / secs;

      // Scoreboard szinkron: minden másodperces tick
      ScoreboardSync.timerTick(state.timeLeft, secs);

      if (pct < 0.25) arc.style.stroke = '#e84040';
      else if (pct < 0.5) arc.style.stroke = '#fbbf24';

      if (state.timeLeft <= 0) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
        if (window.AudioLibrary) AudioLibrary.stopAmbient();
        if (window.AudioLibrary) AudioLibrary.playEvent(state.activeCategoryId, 'timeout');
        document.getElementById('btn-solved').style.display = 'none';
        document.getElementById('btn-done').style.display = '';
        // Scoreboard szinkron: lejárt az idő -> piros (a "duda" hang a kivetítőn szól)
        ScoreboardSync.timeout(state.currentWord, state.currentPoints);
        UI.showState('timeout');
      }
    }, 1000);
  },

  /* ===== MEGOLDVA GOMB ===== */
  solved() {
    // Időzítő leállítása
    if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
    if (window.AudioLibrary) AudioLibrary.stopAmbient();

    // Az ünneplő hang a kivetítőn szól, nem itt. Konfetti marad itt (helyi vizuál).
    if (window.AudioLibrary) AudioLibrary.playEvent(state.activeCategoryId, 'solved');

    // Scoreboard szinkron: megoldva -> zöld
    ScoreboardSync.solved(state.currentWord, state.currentPoints);

    document.getElementById('solved-word-recap').textContent = state.currentWord || '';
    UI.showState('solved');
    UI.launchConfetti();
  },

  reset() {
    SoundEngine.play('btn-click');
    if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
    if (window.AudioLibrary) AudioLibrary.stopAmbient();
    App.stopPick3Countdown();
    state.currentWord = null;
    state.currentMode = null;
    state.currentPoints = null;
    state.threeCards = [];
    state.selectedPick3Index = null;
    const grid = document.getElementById('pick3-grid');
    if (grid) grid.classList.remove('locked');
    const waitEl = document.getElementById('pick3-waiting');
    if (waitEl) waitEl.style.display = 'none';
    ScoreboardSync.idle();
    UI.showState('idle');
    if (window.AudioLibrary) AudioLibrary.playLoopingPool(state.activeCategoryId, 'idle');
  }
};

/* ===== INIT ===== */
function init() {
  const starsEl = document.getElementById('stars');
  for (let i = 0; i < 80; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = Math.random() * 2.5 + 1;
    s.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;width:${size}px;height:${size}px;--dur:${(Math.random()*4+2).toFixed(1)}s;--op:${(Math.random()*0.5+0.2).toFixed(2)};animation-delay:${(Math.random()*5).toFixed(1)}s;`;
    starsEl.appendChild(s);
  }
  const cat = CATEGORIES.find(c => c.id === state.activeCategoryId);
  if (cat) document.getElementById('active-cat-name').textContent = cat.name;
  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange'].forEach(ev => {
    document.addEventListener(ev, () => {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
      const icon = document.getElementById('fs-icon');
      if (icon) icon.className = isFs ? 'ti ti-arrows-minimize' : 'ti ti-arrows-maximize';
    });
  });
  UI.showState('idle');
  // A távoli indítás/megoldás/lejárat figyelését a firebase-sync.js intézi
  // közvetlenül (window.App.onRemoteStartSignal / onRemoteGameStatus hívásával),
  // itt nincs szükség semmilyen regisztrációra.
}

document.addEventListener('DOMContentLoaded', init);
