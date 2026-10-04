(function () {
  "use strict";

// ============================================
// Shared Game State & Configuration
// All modules import from here
// ============================================

/* ---- Safe localStorage wrapper ---- */
// localStorage is unavailable on opaque origins (e.g. some file:// setups),
// so guard every read/write behind this helper.
const lStorage = {
  getItem(key) {
    try { return window.localStorage ? window.localStorage.getItem(key) : null; }
    catch (e) { return null; }
  },
  setItem(key, value) {
    try { if (window.localStorage) window.localStorage.setItem(key, value); }
    catch (e) { /* ignore */ }
  }
};

/* ---- Config ---- */
const STANDARD_VALUES = [
  .01, 1, 5, 10, 25, 50, 75, 100, 200, 300, 400, 500, 750,
  1000, 5000, 10000, 25000, 50000, 75000, 100000, 200000, 300000, 400000, 500000, 750000, 1000000
];
const MIN_CASE_COUNT = 4;
const MAX_CASE_COUNT = 26;

/* ---- State ---- */
const game = {
  caseCount: 26,
  nextCaseCount: 26,
  schedule: [],
  amounts: [],
  caseAssignment: [],
  yourCase: null,
  openedCases: new Set(),
  state: 'setup',
  roundIndex: 0,
  openedInRound: 0,
  roundEliminatedValues: [],
  lastOffer: null,
  offerHistory: [],
  counterOfferUsed: false,
  pendingCounterOffer: null,
  pendingCounterAccepted: null,
  postDealMode: false,
  dealTakenAmount: null,
  hypotheticalOffers: [],
  revealMode: 'real',
  editMode: false,
  manualOpenMode: true,
  nightVisionMode: false,
  showCurrencyBoard: false,
  showCurrencyBriefcase: false,
  hideOpenedCases: false,
  gameLogEnabled: true,
  sfxEnabled: true,
  sfxVolumePercent: 130, // 100% = normal; defaulted louder per request
  boardRowEls: {},
  gameLog: [],
};

/* ---- DOM refs ---- */
const $ = id => document.getElementById(id);
const dom = {
  statusLine: $('statusLine'),
  yourCaseHolder: $('yourCaseHolder'),
  caseGrid: $('caseGrid'),
  boardColLow: $('boardColLow'),
  boardColHigh: $('boardColHigh'),
  editToggle: $('editToggle'),
  saveValuesBtn: $('saveValuesBtn'),
  shuffleBtn: $('shuffleBtn'),
  resetValuesBtn: $('resetValuesBtn'),
  spotlightBackdrop: $('spotlightBackdrop'),
  dangerFlash: $('dangerFlash'),
  centerStage: $('centerStage'),
  centerCase: $('centerCase'),
  centerStageLabel: $('centerStageLabel'),
  offersPanel: $('offersPanel'),
  bankerOfferDisplay: $('bankerOfferDisplay'),
  offersList: $('offersList'),
  settingsGear: $('settingsGear'),
  settingsPanel: $('settingsPanel'),
  manualModeToggle: $('manualModeToggle'),
  nightVisionToggle: $('nightVisionToggle'),
  currencyBoardToggle: $('currencyBoardToggle'),
  currencyBriefcaseToggle: $('currencyBriefcaseToggle'),
  hideOpenedCasesToggle: $('hideOpenedCasesToggle'),
  gameLogEnabledToggle: $('gameLogEnabledToggle'),
  soundToggle: $('soundToggle'),
  sfxVolumeInput: $('sfxVolumeInput'),
  suggestBtn: $('suggestBtn'),
  suggestPanel: $('suggestPanel'),
  suggestBody: $('suggestBody'),
  suggestRegenBtn: $('suggestRegenBtn'),
  closeSuggestBtn: $('closeSuggestBtn'),
  bgPickerBtn: $('bgPickerBtn'),
  bgPickerPanel: $('bgPickerPanel'),
  bgPickerGrid: $('bgPickerGrid'),
  boardBgPickerGrid: $('boardBgPickerGrid'),
  closeBgPickerBtn: $('closeBgPickerBtn'),
  caseCountInput: $('caseCountInput'),
  applyCaseCountBtn: $('applyCaseCountBtn'),
  saveSettingsBtn: $('saveSettingsBtn'),
  closeSettingsBtn: $('closeSettingsBtn'),
  pbSelectBtn: $('pbSelectBtn'),
  pbSelectPanel: $('pbSelectPanel'),
  pbSaveName: $('pbSaveName'),
  pbSaveConfirmBtn: $('pbSaveConfirmBtn'),
  pbExportBtn: $('pbExportBtn'),
  pbImportBtn: $('pbImportBtn'),
  pbImportFile: $('pbImportFile'),
  pbList: $('pbList'),
  closePbSelectBtn: $('closePbSelectBtn'),
  boardSaveBtn: $('boardSaveBtn'),
  gameLogPanel: $('gameLogPanel'),
  gameLogHeader: $('gameLogHeader'),
  gameLogList: $('gameLogList'),
  manualSlider: $('manualSlider'),
  sliderTrack: $('sliderTrack'),
  sliderFill: $('sliderFill'),
  sliderHandle: $('sliderHandle'),
  offerBackdrop: $('offerBackdrop'),
  offerStatus: $('offerStatus'),
  offerContent: $('offerContent'),
  offerLabel: $('offerLabel'),
  revealOfferBtn: $('revealOfferBtn'),
  continuePlayoutBtn: $('continuePlayoutBtn'),
  acknowledgeDealBtn: $('acknowledgeDealBtn'),
  instantRevealBtn: $('instantRevealBtn'),
  postDealActions: $('postDealActions'),
  offerButtonsRow: $('offerButtonsRow'),
  dealBtn: $('dealBtn'),
  noDealBtn: $('noDealBtn'),
  counterLinkBtn: $('counterLinkBtn'),
  counterPanel: $('counterPanel'),
  counterInput: $('counterInput'),
  counterStatus: $('counterStatus'),
  submitCounterBtn: $('submitCounterBtn'),
  cancelCounterBtn: $('cancelCounterBtn'),
  offerModalEl: $('bankerCallCard'),
  phoneIconEl: document.querySelector('.phone-icon'),
  finalBackdrop: $('finalBackdrop'),
  finalSub: $('finalSub'),
  finalCases: $('finalCases'),
  endBackdrop: $('endBackdrop'),
  endTitle: $('endTitle'),
  endSub: $('endSub'),
  endResults: $('endResults'),
  badDecisionNote: $('badDecisionNote'),
  playAgainBtn: $('playAgainBtn'),
  manualBackBtn: $('manualBackBtn'),
  manualContinueBtn: $('manualContinueBtn'),
};


// ============================================
// Helpers — formatting, logging, value checks
// ============================================
function formatNumber(v) {
  if (v < 1) return v.toFixed(2).replace(/^0(?=\.)/, '');
  return Math.round(v).toLocaleString('en-US');
}
function fmt(v) {
  return '$' + formatNumber(v);
}

/** Prize board + banker offer amounts — respects the board currency setting. */
function fmtDisplayBoard(v) {
  const n = formatNumber(v);
  return game.showCurrencyBoard ? '$' + n : n;
}

/** Briefcase amounts — respects the briefcase currency setting. */
function fmtDisplayBriefcase(v) {
  const n = formatNumber(v);
  return game.showCurrencyBriefcase ? '$' + n : n;
}

function setBriefcaseAmount(el, value) {
  el.replaceChildren();
  if (game.showCurrencyBriefcase) {
    const currency = document.createElement('span');
    currency.className = 'briefcase-currency';
    currency.textContent = '$';
    el.appendChild(currency);
  }
  el.appendChild(document.createTextNode(formatNumber(value)));
}

/** Appends an entry to the bottom-right game log panel.
 *  Suppressed entirely while the "Enable Game Log" setting is off. */
function logEvent(html, type) {
  if (game.gameLogEnabled === false) return;
  game.gameLog.push({ html, type });
  const entry = document.createElement('div');
  entry.className = 'game-log-entry' + (type ? ' log-' + type : '');
  entry.innerHTML = html;
  const empty = dom.gameLogList.querySelector('.game-log-empty');
  if (empty) empty.remove();
  dom.gameLogList.appendChild(entry);
  dom.gameLogList.scrollTop = dom.gameLogList.scrollHeight;
}
function resetGameLog() {
  game.gameLog = [];
  if (game.gameLogEnabled === false) return;
  dom.gameLogList.innerHTML = '<div class="game-log-empty">No activity yet.</div>';
}
function logYourCaseReveal(caseNumber, value) {
  logEvent(`<b>Your Case Revealed</b> — Case #${caseNumber} held <b>${fmt(value)}</b>.`, 'deal');
}
function logUnopenedFinalCaseReveal(caseNumber, value) {
  logEvent(`<b>Unopened Final Case Revealed</b> — Case #${caseNumber} held <b>${fmt(value)}</b>.`);
}
function triggerDangerFlash() {
  dom.dangerFlash.classList.remove('pulse', 'pulse-yellow');
  void dom.dangerFlash.offsetWidth;
  dom.dangerFlash.classList.add('pulse');
}
function triggerYellowFlash() {
  dom.dangerFlash.classList.remove('pulse', 'pulse-yellow');
  void dom.dangerFlash.offsetWidth;
  dom.dangerFlash.classList.add('pulse-yellow');
}

/** Picks `n` dollar tiers spread across the classic 26-value ladder. */
function getValuesForCount(n) {
  if (n >= STANDARD_VALUES.length) return STANDARD_VALUES.slice();
  if (n === 1) return [STANDARD_VALUES[0]];
  const values = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round(i * (STANDARD_VALUES.length - 1) / (n - 1));
    values.push(STANDARD_VALUES[idx]);
  }
  return values;
}

/** Round schedule: first round opens ~25%, then each round opens one fewer until done. */
function buildSchedule(count) {
  const totalOpens = count - 2;
  if (totalOpens <= 0) return [];
  const sched = [];
  sched.push(Math.max(1, Math.min(totalOpens, Math.round(totalOpens * 0.25))));
  let remaining = totalOpens - sched[0];
  while (remaining > 0) {
    const prev = sched[sched.length - 1];
    const next = Math.max(1, prev - 1);
    sched.push(Math.min(next, remaining));
    remaining -= sched[sched.length - 1];
  }
  return sched;
}

/** Staggered pyramid rows (7-6-7-6 pattern) for any case count, with a
 *  20-case override: 4-5-5-6 (top to bottom). */
function getCaseGridRows(count) {
  if (count === 20) {
    return [
      { start: 17, count: 4, align: 'indent' }, // row 1: 17, 18, 19, 20 (indented right)
      { start: 12, count: 5, align: 'flush' },  // row 2: 12, 13, 14, 15, 16 (flush left, untouched)
      { start: 7, count: 5, align: 'indent' },  // row 3: 7, 8, 9, 10, 11 (indented right)
      { start: 1, count: 6, align: 'flush' },   // row 4: 1, 2, 3, 4, 5, 6 (flush left)
    ];
  }
  const rows = [];
  let remaining = count;
  let nextStart = count;
  let rowIdx = 0;
  while (remaining > 0) {
    const baseSize = (rowIdx % 2 === 0) ? 7 : 6;
    const rowCount = Math.min(baseSize, remaining);
    nextStart = nextStart - rowCount + 1;
    rows.push({ start: nextStart, count: rowCount });
    nextStart = nextStart - 1;
    remaining -= rowCount;
    rowIdx++;
  }
  return rows;
}
function isBigValue(v) {
  return v >= 100000;
}

/** Check if v is the highest value still in play (not eliminated). */
function isHighestRemaining(v) {
  const remaining = game.amounts.filter(a => !a.eliminated).map(a => a.value);
  if (!remaining.length) return false;
  const maxVal = Math.max(...remaining);
  return v === maxVal;
}
function isLowValue(v) {
  // Good-news tier: everything below the $100K danger line.
  return v < 100000;
}
function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function remainingAmountValues() {
  return game.amounts.filter(a => !a.eliminated).map(a => a.value);
}


// ============================================
// Customization Picker (case interior + board value backgrounds)
// ============================================
/* ---------- Case Interior Background ---------- */
const BG_OPTIONS = [
  { id: 'default', label: 'Hex Pattern', class: '', swatch: 'linear-gradient(135deg,#000 0%,#161616 100%)' },
  { id: 'usgrid', label: 'US Style', class: 'interior-usgrid', swatch: 'linear-gradient(135deg,#4c525a 30%,#4a4342 30%,#4a4342 70%,#4c525a 70%)' },
];

let currentBgId = lStorage.getItem('dnd_interior_bg') || 'default';

/* ---------- Prize Board Value Background ---------- */
const BOARD_BG_OPTIONS = [
  { id: 'default', label: 'Classic Yellow', class: '', swatch: 'linear-gradient(180deg,#f4d258,#e2b63e)' },
  { id: 'blue', label: 'Blue', class: 'board-bg-blue', swatch: 'linear-gradient(180deg,#2f66ff,#1237b8)' },
  { id: 'gold', label: 'Gold', class: 'board-bg-gold', swatch: 'linear-gradient(180deg,#f7d874,#c99b2e)' },
  { id: 'red', label: 'Red', class: 'board-bg-red', swatch: 'linear-gradient(180deg,#e8505f,#a11f2e)' },
  { id: 'emerald', label: 'Emerald', class: 'board-bg-emerald', swatch: 'linear-gradient(180deg,#1fae6a,#0b6b3d)' },
  { id: 'dark', label: 'Dark', class: 'board-bg-dark', swatch: 'linear-gradient(180deg,#3a3f4a,#1e222b)' },
  { id: 'squares', label: 'Squares', class: 'board-bg-squares', swatch: 'repeating-linear-gradient(90deg,#fff8e0 0 10px,#d9a52e 10px 13px)' },
];

let currentBoardBgId = lStorage.getItem('dnd_board_bg') || 'default';

/** Returns the active prize-board background id ('default', 'squares', ...). */
function getBoardBgId() {
  return currentBoardBgId;
}

/** Returns the active case-interior background id ('default', 'usgrid', ...). */
function getInteriorBgId() {
  return currentBgId;
}

/* Squares style: split a text element into one square cell per character.
   Every prize uses the same width, expanding beyond seven cells when a board
   contains a larger value. Commas get no square. */
const SQ_FULL_WIDTH = 7;
function getBoardSquareWidth() {
  return Math.max(SQ_FULL_WIDTH, ...game.amounts.map(({ value }) =>
    formatNumber(value).replace(/,/g, '').length
  ));
}

function wrapValueSquares(el, pad) {
  const text = el.textContent;
  el.textContent = '';
  const chars = [];
  for (const ch of text) {
    if (ch === ',') continue; // skip commas — no square needed
    chars.push(ch);
  }
  if (pad) {
    const width = getBoardSquareWidth() + (text.trimStart().startsWith('$') ? 1 : 0);
    while (chars.length < width) chars.unshift(' ');
  }
  for (const ch of chars) {
    const span = document.createElement('span');
    span.className = 'sq-char' + (ch === '.' ? ' sq-char-dim' : '') + (ch === ' ' ? ' sq-char-empty' : '');
    if (ch !== ' ') {
      const value = document.createElement('span');
      value.className = 'sq-char-value';
      value.textContent = ch;
      span.appendChild(value);
    }
    el.appendChild(span);
  }
}

/* ---------- Squares: Banker Offer tile ---------- */
/* In Squares mode the banker offer tile re-renders its plain amount text
   with the same square-grid cells the prize board uses: one yellow square
   per character ($ and commas included), blanks padded to the 7-slot board
   width — e.g. [ ][1][,][5][0][0]. A MutationObserver keeps the cells in
   sync with every writer of the tile (offer reveal, currency refresh, DEAL
   / NO DEAL, counter offer); non-numeric states keep their normal designs. */
const OFFER_SQUARES_TEXT = /^[0-9,$.\s]+$/;
const offerSquareObserver = new MutationObserver(() => renderOfferTileSquares());

/** Re-renders the offer tile's amount into per-character yellow squares (Squares mode). */
function renderOfferTileSquares() {
  const tile = dom.bankerOfferDisplay;
  if (!tile) return;
  const text = tile.textContent;
  const active = getBoardBgId() === 'squares' && !!text && OFFER_SQUARES_TEXT.test(text);
  if (!active) {
    // Leaving squares mode (or a non-amount state like "NO DEAL"): if the tile
    // still shows cells from a previous amount, restore its normal look.
    if (tile.dataset.squaresApplied === '1') {
      delete tile.dataset.squaresApplied;
      tile.classList.remove('offer-squares');
      if (OFFER_SQUARES_TEXT.test(text)) {
        tile.textContent = [...tile.querySelectorAll('.offer-sq-char .sq-char-value')]
          .map(v => v.textContent)
          .join('');
      }
    } else {
      tile.classList.remove('offer-squares');
    }
    return;
  }
  const cells = [...tile.querySelectorAll('.offer-sq-char .sq-char-value')].map(v => v.textContent);
  const alreadyCells = cells.length > 0;
  const sig = text.replace(/\s/g, '');
  if (alreadyCells && cells.join('') === sig) return;
  tile.dataset.squaresApplied = '1';
  tile.classList.add('offer-squares');
  tile.textContent = '';
  // Center the amount in the 7-slot strip; the odd blank goes on the left
  // (e.g. 55,500 -> [ ][5][5][,][5][0][0], 299 -> [ ][ ][2][9][9][ ][ ]). Amounts
  // of 7+ characters (like 1,000,000) render at natural width with no padding.
  const chars = sig.split('');
  if (chars.length < SQ_FULL_WIDTH) {
    const padTotal = SQ_FULL_WIDTH - chars.length;
    const padLeft = Math.ceil(padTotal / 2);
    const padRight = padTotal - padLeft;
    for (let i = 0; i < padLeft; i++) chars.unshift(' ');
    for (let i = 0; i < padRight; i++) chars.push(' ');
  }
  for (const ch of chars) {
    const span = document.createElement('span');
    span.className = 'offer-sq-char' + (ch === ' ' ? ' sq-char-empty' : '');
    if (ch !== ' ') {
      const value = document.createElement('span');
      value.className = 'sq-char-value';
      value.textContent = ch;
      span.appendChild(value);
    }
    tile.appendChild(span);
  }
}

/** Wires up the offer-tile squares sync. Called once at startup. */
function initOfferTileSquares() {
  if (!dom.bankerOfferDisplay) return;
  offerSquareObserver.observe(dom.bankerOfferDisplay, { childList: true, characterData: true, subtree: true });
  renderOfferTileSquares();
}

function applyBoardBg(bgId) {
  const opt = BOARD_BG_OPTIONS.find(o => o.id === bgId);
  if (!opt) return;
  const changed = bgId !== currentBoardBgId;
  currentBoardBgId = bgId;
  lStorage.setItem('dnd_board_bg', bgId);
  const boardEl = dom.boardColLow ? dom.boardColLow.closest('.board') : document.getElementById('board');
  if (!boardEl) return;
  BOARD_BG_OPTIONS.forEach(o => { if (o.class) boardEl.classList.remove(o.class); });
  if (opt.class) boardEl.classList.add(opt.class);
  // Squares mode changes row markup (per-digit cells) — rebuild the tiles.
  if (changed) renderBoard();
  // Keep the offer tile in sync even when its own DOM didn't change.
  renderOfferTileSquares();
}

function renderBoardBgPicker() {
  dom.boardBgPickerGrid.innerHTML = '';
  BOARD_BG_OPTIONS.forEach(opt => {
    const div = document.createElement('div');
    div.className = 'bg-option' + (opt.id === currentBoardBgId ? ' active' : '');
    div.innerHTML = `<div class="bg-option-swatch" style="background:${opt.swatch};"></div><div class="bg-option-label">${opt.label}</div>`;
    div.addEventListener('click', () => {
      applyBoardBg(opt.id);
      renderBoardBgPicker();
    });
    dom.boardBgPickerGrid.appendChild(div);
  });
}

function fitUsGridText(el) {
  const container = el.parentElement;
  if (!container) return;
  el.style.setProperty('font-size', '', 'important');
  const maxW = container.clientWidth;
  const maxH = container.clientHeight;
  if (!maxW || !maxH) return;
  // Measure the rendered box so both CSS scaleX and scaleY are included.
  const heightRatio = el.textContent.length >= 8 ? 0.8 : 0.72;
  const maxFontSize = 50;
  let lo = 10, hi = maxFontSize, best = maxFontSize;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    el.style.setProperty('font-size', mid + 'px', 'important');
    const rendered = el.getBoundingClientRect();
    if (rendered.width <= maxW * 0.995 && rendered.height <= maxH * heightRatio) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  el.style.setProperty('font-size', best + 'px', 'important');
  el.style.marginTop = '-2px';
}

/** Sizes a briefcase's amount text for the active interior background.
 *  Call after setting .amount-val content on a freshly built case. */
function applyInteriorAmountStyling(el) {
  if (!el) return;
  if (currentBgId !== 'usgrid') {
    el.classList.toggle('big-val', el.textContent.length > 8);
  } else {
    fitUsGridText(el);
  }
}

function buildUsGridHTML() {
  const cols = 8, rows = 6;
  let html = '';
  // Top 2 rows: all blue cells
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cols; c++) {
      html += '<div class="usgrid-cell blue"></div>';
    }
  }
  // Middle: blue cells on edges + single wide center container
  for (let r = 2; r < 4; r++) {
    html += '<div class="usgrid-cell blue"></div>';
    if (r === 2) html += '<div class="usgrid-center"></div>';
    html += '<div class="usgrid-cell blue"></div>';
  }
  // Bottom 2 rows: all blue cells
  for (let r = 4; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      html += '<div class="usgrid-cell blue"></div>';
    }
  }
  return html;
}
function applyInteriorBg(bgId) {
  const opt = BG_OPTIONS.find(o => o.id === bgId);
  if (!opt) return;
  currentBgId = bgId;
  lStorage.setItem('dnd_board_bg', bgId);
  document.querySelectorAll('.case-interior').forEach(el => {
    // Remove all interior classes and grid markup
    const briefcase = el.closest('.briefcase');
    BG_OPTIONS.forEach(o => { if (o.class) el.classList.remove(o.class); });
    if (briefcase) briefcase.classList.remove('interior-usgrid-active');
    el.querySelectorAll('.usgrid-row').forEach(r => r.remove());
    // Apply new class
    if (opt.class) el.classList.add(opt.class);
    // If US Grid, inject the grid cells and mark the briefcase
    if (bgId === 'usgrid') {
      el.insertAdjacentHTML('beforeend', buildUsGridHTML());
      if (briefcase) briefcase.classList.add('interior-usgrid-active');
      // Move amount-val inside the center container
      const center = el.querySelector('.usgrid-center');
      const amountVal = briefcase ? briefcase.querySelector('.amount-val') : null;
      if (center && amountVal) center.appendChild(amountVal);
    } else {
      // Move amount-val back to briefcase if it was in the center
      const amountVal = el.querySelector('.amount-val');
      if (amountVal && amountVal.parentElement !== el.closest('.briefcase')) {
        el.closest('.briefcase').appendChild(amountVal);
      }
    }
  });
}

function renderBgPicker() {
  dom.bgPickerGrid.innerHTML = '';
  BG_OPTIONS.forEach(opt => {
    const div = document.createElement('div');
    div.className = 'bg-option' + (opt.id === currentBgId ? ' active' : '');
    div.innerHTML = `<div class="bg-option-swatch" style="background:${opt.swatch};"></div><div class="bg-option-label">${opt.label}</div>`;
    div.addEventListener('click', () => {
      applyInteriorBg(opt.id);
      renderBgPicker();
    });
    dom.bgPickerGrid.appendChild(div);
  });
}

/* ---------- Customization tabs ---------- */
const custTabs = document.querySelectorAll('.cust-tab');
const custTabContents = {
  interior: document.getElementById('custTabContentInterior'),
  board: document.getElementById('custTabContentBoard'),
};
custTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    custTabs.forEach(t => t.classList.toggle('active', t === tab));
    const name = tab.dataset.tab;
    Object.entries(custTabContents).forEach(([key, el]) => {
      el.classList.toggle('active', key === name);
    });
  });
});

dom.bgPickerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const visible = dom.bgPickerPanel.style.display !== 'none';
  dom.bgPickerPanel.style.display = visible ? 'none' : 'flex';
  if (!visible) {
    renderBgPicker();
    renderBoardBgPicker();
  }
});

dom.closeBgPickerBtn.addEventListener('click', () => {
  dom.bgPickerPanel.style.display = 'none';
});

// Apply saved backgrounds on page load
applyInteriorBg(currentBgId);
applyBoardBg(currentBoardBgId);
initOfferTileSquares();


// ============================================
// Sound effects (Web Audio synthesis + recorded MP3 stings)
// ============================================
let audioCtx = null;
let audioMasterGain = null;

function getAudioCtx() {
  if (!audioCtx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
      // Everything routes through one master gain so sound can be toggled,
      // and boosted louder than normal via the Volume setting.
      audioMasterGain = audioCtx.createGain();
      audioMasterGain.gain.value = 0;
      audioMasterGain.connect(audioCtx.destination);
      applySfxLevel();
    } catch (e) { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/** Applies the Sound Effects on/off + Volume setting to the master gain. */
function applySfxLevel() {
  if (!audioMasterGain || !audioCtx) return;
  const level = game.sfxEnabled ? Math.max(0, game.sfxVolumePercent) / 100 : 0;
  audioMasterGain.gain.setTargetAtTime(level, audioCtx.currentTime, 0.02);
}

// Browsers only let audio start after a user gesture — warm the context up
// on the first interaction so reveal sounds are never silently blocked.
document.addEventListener('pointerdown', function unlockAudio() { getAudioCtx(); }, { once: true });
document.addEventListener('keydown', function unlockAudio2() { getAudioCtx(); }, { once: true });

/** Plays a short filtered noise burst (snare-ish crack / crash). */
function playNoiseBurst(ctx, startAt, dur, peak, cutoff) {
  const buffer = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * dur)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  let node = src;
  if (cutoff) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    src.connect(filter);
    node = filter;
  }
  node.connect(gain);
  gain.connect(audioMasterGain || ctx.destination);
  src.start(startAt);
}

/** Accelerating snare-style drumroll + a quiet rising sweep, for the tension
 *  while a case is travelling to center stage and opening. */
function playTensionRoll(ctx, dur) {
  const t0 = ctx.currentTime;
  const ticks = 14;
  for (let i = 0; i < ticks; i++) {
    const p = i / (ticks - 1);
    // p^2 spacing makes the hits accelerate toward the reveal moment
    playNoiseBurst(ctx, t0 + dur * p * p * 0.97, 0.045, 0.05 + 0.1 * p, 3200);
  }
  scheduleTone(ctx, 'sine', 150, t0, dur, 0.045, 780);
}

/** Schedules one tone: oscillator + fast attack / exponential decay envelope,
 *  optional pitch glide to freqEnd and low-pass cutoff to tame harsh shapes. */
function scheduleTone(ctx, type, freq, startAt, dur, peak, freqEnd, cutoff) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, freq), startAt);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), startAt + dur);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  let node = osc;
  if (cutoff) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    osc.connect(filter);
    node = filter;
  }
  node.connect(gain);
  gain.connect(audioMasterGain || ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.05);
}

/** Recorded case-value reveal stings, resolved from this module's own
 *  path so both builds load the same shared files no matter where
 *  index.html lives. The legacy document-relative paths are kept as
 *  fallbacks for older copies. */
const LIGHT_REVEAL_SFX_URL = 'js/sounds/lightamountreveal.mp3';
const LIGHT_REVEAL_SFX_LEGACY_URL = 'js/sounds/lightamountreveal.mp3';
const DANGER_REVEAL_SFX_URL = 'js/sounds/dangeramountreveal.mp3';
const DANGER_REVEAL_SFX_LEGACY_URL = 'js/sounds/dangeramountreveal.mp3';

/** The reveal recordings start right on the hit, so no lead-in offset
 *  is needed. If a re-exported file gains a soft intro, raise this to skip it. */
const REVEAL_SFX_START_SEC = 0;

/** Below $100K (good news): the recorded light reveal sting. Falls
 *  back to the legacy path, then a media element, then the synth
 *  chime, if the file can't load or play. */
function revealSoundLow() {
  playRecordedSfx([LIGHT_REVEAL_SFX_URL, LIGHT_REVEAL_SFX_LEGACY_URL], REVEAL_SFX_START_SEC, revealSoundLowSynth);
}

/** $100K and up (danger): the recorded danger reveal sting, with the
 *  same fallback chain ending in the synth boom-and-growl. */
function revealSoundHigh() {
  playRecordedSfx([DANGER_REVEAL_SFX_URL, DANGER_REVEAL_SFX_LEGACY_URL], REVEAL_SFX_START_SEC, revealSoundHighSynth);
}

/** Synthesized light reveal — the fallback when the recorded
 *  lightamountreveal sting can't play: a soft "thwack" then a bright
 *  rising two-note chime, celebratory but lighter than the big-money sting. */
function revealSoundLowSynth() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  playNoiseBurst(ctx, t0, 0.07, 0.14, 2600);
  scheduleTone(ctx, 'sine', 130, t0, 0.22, 0.14);                  // warm floor note
  scheduleTone(ctx, 'triangle', 880, t0 + 0.03, 0.16, 0.16);       // A5
  scheduleTone(ctx, 'triangle', 1318.51, t0 + 0.13, 0.34, 0.13);   // E6
}

/** Synthesized danger reveal — the fallback when the recorded
 *  dangeramountreveal sting can't play: the drumroll lands on a big
 *  hit — sub boom + noise crash — then a growl glides down as the
 *  amount registers. */
function revealSoundHighSynth() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  scheduleTone(ctx, 'sine', 98, t0, 0.6, 0.65);                    // deep sub boom
  playNoiseBurst(ctx, t0, 0.18, 0.38, 1800);                      // crash
  scheduleTone(ctx, 'sawtooth', 440, t0 + 0.03, 0.5, 0.28, 110, 900); // A4 -> A2 growl
  scheduleTone(ctx, 'square', 233.08, t0 + 0.08, 0.32, 0.11, 116.54, 500);
}

/** Plays the reveal sting matching the revealed value's tier (same split as
 *  the shelf flash: below 100K is the good/yellow one, 100K+ the red danger). */
function playRevealSound(value) {
  if (value < 100000) {
    revealSoundLow();
  } else {
    revealSoundHigh();
  }
}

/** Kicks off the accelerating drumroll that runs while a case opens (auto
 *  reveals only — the manual drag version has its own pacing). */
function startTensionRoll(durSec) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  playTensionRoll(ctx, durSec || 0.65);
}

/** One short double "brring-brring" phone bell (440+480 Hz fused with a
 *  25 Hz tremolo, the classic telephone cadence). */
function ringBurst(ctx, t0) {
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  o1.type = 'sine'; o1.frequency.value = 440;
  o2.type = 'sine'; o2.frequency.value = 480;
  const trem = ctx.createGain();
  trem.gain.value = 0.5;
  const lfo = ctx.createOscillator();
  lfo.type = 'sine'; lfo.frequency.value = 25;
  const lfoAmp = ctx.createGain();
  lfoAmp.gain.value = 0.5;
  lfo.connect(lfoAmp);
  lfoAmp.connect(trem.gain);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);   // ring…
  env.gain.setValueAtTime(0.16, t0 + 0.19);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24); // …gap…
  env.gain.exponentialRampToValueAtTime(0.15, t0 + 0.29);   // ring!
  env.gain.setValueAtTime(0.15, t0 + 0.4);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.46);
  o1.connect(trem);
  o2.connect(trem);
  trem.connect(env);
  env.connect(audioMasterGain || ctx.destination);
  o1.start(t0); o2.start(t0); lfo.start(t0);
  o1.stop(t0 + 0.55); o2.stop(t0 + 0.55); lfo.stop(t0 + 0.55);
}

/** Plays the banker's phone ringing while the call icon is active — `rings`
 *  bursts spaced like a real ringer. */
function playBankerRing(rings) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const n = rings || 2;
  const start = ctx.currentTime + 0.05;
  for (let i = 0; i < n; i++) {
    ringBurst(ctx, start + i * 0.7);
  }
}

/** Synthesized light cross-off — the fallback when the recorded
 *  light sting can't play: a crisp rising double-tick with a soft
 *  confirm ping as the tile lands dark. */
function boardEliminateLowSynth() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  scheduleTone(ctx, 'triangle', 523.25, t0, 0.06, 0.16);          // C5 tick
  scheduleTone(ctx, 'triangle', 659.25, t0 + 0.07, 0.07, 0.15);   // E5 tick
  scheduleTone(ctx, 'sine', 1046.5, t0 + 0.16, 0.16, 0.1);        // C6 ping
  playNoiseBurst(ctx, t0 + 0.97, 0.05, 0.09, 2000);               // flip lands
}

/** One heavy "BANG": a low sine that drops in pitch with a bright noise slap
 *  on the attack, like a giant impact — punchy, then it rings off. */
function stompAt(ctx, startAt, freq, peak) {
  scheduleTone(ctx, 'sine', freq, startAt, 0.55, peak, freq * 0.5);
  playNoiseBurst(ctx, startAt, 0.12, peak * 0.45, 900);
}

/** One loud board-impact THOMP for danger values — also the fallback when the
 *  recorded danger sting can't play. */
function boardEliminateDangerThomp() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  stompAt(ctx, t0, 62, 0.78);
}

/** Recorded danger sting locations, resolved from this module's own path so
 *  both builds load the same shared file no matter where index.html lives.
 *  The legacy document-relative path is kept as a fallback for older copies. */
const DANGER_SFX_URL = 'js/sounds/danger.mp3';
const DANGER_SFX_LEGACY_URL = 'js/sounds/danger.mp3';

/** decodeAudioData wrapper that also works on older callback-only
 *  engines — the deprecated callbacks still fire in modern ones, and
 *  resolving a Promise twice is a no-op. */
function decodeSfxBuffer(ctx, arrayBuffer) {
  return new Promise(function (resolve, reject) {
    const result = ctx.decodeAudioData(arrayBuffer, resolve, reject);
    if (result && typeof result.then === 'function') result.then(resolve, reject);
  });
}

/** Plays one recorded SFX from a decoded buffer: a fresh BufferSource
 *  per play lets quick reveals overlap, and the audio rides the master
 *  gain like every other SFX (so the 0–130% Sound Effects setting
 *  applies, including values above 100%). `startSec` skips any soft
 *  lead-in on the decoded-buffer path. */
function playRecordedSfxFrom(fullUrls, urls, startSec, synthFallback) {
  if (!urls.length) {
    // Nothing could be decoded (e.g. file:// blocks fetch) — still
    // try the recording via a media element, then the synth fallback.
    playRecordedSfxElement(fullUrls, synthFallback);
    return;
  }
  const rest = urls.slice(1);
  const ctx = getAudioCtx();
  if (!ctx) {
    playRecordedSfxElement(fullUrls, synthFallback);
    return;
  }
  fetch(urls[0])
    .then(function (response) {
      if (!response.ok) throw new Error('sfx HTTP ' + response.status);
      return response.arrayBuffer();
    })
    .then(function (arrayBuffer) { return decodeSfxBuffer(ctx, arrayBuffer); })
    .then(function (audioBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(audioMasterGain || ctx.destination);
      // start(when, offset) guarantees the lead-in skip; clamp so an
      // offset past the end can never throw and break the chain.
      const offset = Math.min(startSec, Math.max(0, audioBuffer.duration - 0.05));
      src.start(0, offset);
    })
    .catch(function () { playRecordedSfxFrom(fullUrls, rest, startSec, synthFallback); });
}

/** Last-resort media-element playback. Plays the recording from its
 *  start — only the Web Audio path can guarantee the offset. */
function playRecordedSfxElement(urls, synthFallback) {
  if (!urls.length) {
    synthFallback();
    return;
  }
  const rest = urls.slice(1);
  try {
    const a = new Audio(urls[0]);
    // HTMLMediaElement.volume only accepts [0,1] and THROWS above 1 —
    // the SFX volume setting can exceed 100%, so clamp it. Setting it
    // inside the try means any media failure falls back to the next
    // URL (or the synth) instead of breaking the reveal chain.
    a.volume = game.sfxEnabled ? Math.min(1, Math.max(0, game.sfxVolumePercent) / 100) : 0;
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(function () { playRecordedSfxElement(rest, synthFallback); });
  } catch (e) {
    playRecordedSfxElement(rest, synthFallback);
  }
}

/** Plays a recorded SFX from `urls` (module-relative first, legacy
 *  second): decode-and-buffer first, media element second, synthesized
 *  fallback last. */
function playRecordedSfx(urls, startSec, synthFallback) {
  playRecordedSfxFrom(urls, urls.slice(), startSec, synthFallback);
}

/** Recorded danger sting, played from the beginning when a danger amount
 *  ($100K+) is crossed off the board. Falls back to the legacy path, then a
 *  media element, then the synthesized THOMP, if the file can't load or play. */
function playDangerSfx() {
  playRecordedSfx([DANGER_SFX_URL, DANGER_SFX_LEGACY_URL], 0, boardEliminateDangerThomp);
}

/** Recorded light cross-off sting location (below-$100K board
 *  removals), resolved like the danger sting. */
const LIGHT_ELIM_SFX_URL = 'js/sounds/light.mp3';
const LIGHT_ELIM_SFX_LEGACY_URL = 'js/sounds/light.mp3';

/** The light recording starts right on the tick, so no lead-in
 *  offset is needed. If a re-exported file gains a soft intro,
 *  raise this to skip it. */
const LIGHT_ELIM_SFX_START_SEC = 0;

/** Below-$100K cross-off: the recorded light sting. Falls back to
 *  the legacy path, then a media element, then the synthesized
 *  double-tick, if the file can't load or play. */
function boardEliminateLow() {
  playRecordedSfx([LIGHT_ELIM_SFX_URL, LIGHT_ELIM_SFX_LEGACY_URL], LIGHT_ELIM_SFX_START_SEC, boardEliminateLowSynth);
}

/** Plays the matching cross-off sound when a board value is eliminated — same
 *  split as everywhere else: below 100K is the good one (the recorded
 *  light sting), 100K+ the danger one (the recorded danger sting). */
function boardEliminateSound(value) {
  if (value < 100000) {
    boardEliminateLow();
  } else {
    playDangerSfx();
  }
}


// ============================================
// Center-stage opening animation
// ============================================
function hideAll() {
  awaitingContinue = false;
  dom.manualContinueBtn.onclick = null;
  dom.spotlightBackdrop.classList.remove('show');
  dom.centerStage.classList.remove('show');
  dom.manualBackBtn.style.display = 'none';
  dom.manualContinueBtn.classList.remove('show');
  dom.manualContinueBtn.style.display = 'none';
  dom.caseGrid.classList.remove('reveal-focus');
  clearShelfFlash();
  dom.offerBackdrop.classList.remove('show');
  dom.offersPanel.style.display = 'none';
  dom.finalBackdrop.classList.remove('show');
  dom.endBackdrop.classList.remove('show');
  dom.dangerFlash.classList.remove('pulse');
  dom.badDecisionNote.style.display = 'none';
}
function updateStatus() {
  const remainingUnopened = game.caseCount - 1 - game.openedCases.size;
  if (game.state === 'playing') {
    const need = (game.schedule[game.roundIndex] || 0) - game.openedInRound;
    if (game.postDealMode) {
      dom.statusLine.innerHTML = `If you'd said No Deal: open <b>${need}</b> more case${need === 1 ? '' : 's'} to see what happens next. ` +
        `<b>${remainingUnopened}</b> case${remainingUnopened === 1 ? '' : 's'} left besides yours.`;
    } else {
      dom.statusLine.innerHTML = `Round ${game.roundIndex + 1}: open <b>${need}</b> more case${need === 1 ? '' : 's'}. ` +
        `<b>${remainingUnopened}</b> case${remainingUnopened === 1 ? '' : 's'} left besides yours.`;
    }
  }
}

/** Set while a manual reveal has finished and its Continue button is
 *  waiting to be dismissed — see finishPendingReveal(). */
let awaitingContinue = false;

/** Beat between the stage closing and the prize-board cross-off
 *  starting — lets the closed case sink in before the next animation. */
const CONTINUE_PAUSE_MS = 700;

/**
 * Plays a literal briefcase-opening sequence for case n.
 */
function revealCaseAnimated(n, label, callback, dangerAware, onCancel, revealSoundOverride) {
  const idx = game.caseAssignment[n - 1];
  const value = game.amounts[idx].value;
  const isDanger = !!dangerAware && (isBigValue(value) || isHighestRemaining(value));
  const isLow = !!dangerAware && !isDanger && isLowValue(value);
  const gridBtn = dom.caseGrid.querySelector(`.briefcase[data-num="${n}"]`);
  const startRect = gridBtn ? gridBtn.getBoundingClientRect() : null;
  dom.caseGrid.classList.add('reveal-focus');
  if (gridBtn) gridBtn.classList.add('focus-case', 'lifted');

  dom.centerCase.className = 'briefcase big';
  dom.centerCase.style.transition = 'none';
  dom.centerCase.style.transform = 'none';
  dom.centerCase.innerHTML = caseInnerMarkup(n);
  applyInteriorBg(getInteriorBgId());
  const cvEl = dom.centerCase.querySelector('.amount-val');
  setBriefcaseAmount(cvEl, value);
  applyInteriorAmountStyling(cvEl);
  dom.centerStageLabel.textContent = label || ('Case #' + n);
  dom.centerStageLabel.classList.remove('show');

  dom.spotlightBackdrop.classList.add('show');
  dom.centerStage.classList.add('show');

  let travelMs = 0;
  if (startRect) {
    const endRect = dom.centerCase.getBoundingClientRect();
    const dx = startRect.left + startRect.width / 2 - (endRect.left + endRect.width / 2);
    const dy = startRect.top + startRect.height / 2 - (endRect.top + endRect.height / 2);
    const scaleX = startRect.width / endRect.width;
    const scaleY = startRect.height / endRect.height;
    dom.centerCase.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
    void dom.centerCase.offsetWidth;
    dom.centerCase.style.transition = 'transform 0.55s cubic-bezier(.32,.74,.33,1)';
    dom.centerCase.style.transform = 'translate(0, 0) scale(1, 1)';
    travelMs = 560;
  }

  setTimeout(() => {
    dom.centerCase.classList.add('unlatch');
  }, travelMs + 120);

  function revealDrama() {
    dom.centerCase.classList.add('show-amount');
    if (isDanger) {
      triggerDangerFlash();
    } else if (isLow) {
      triggerYellowFlash();
    }
    // The case table reacts to the value that was just revealed...
    flashTableShelves(value);
    // Final reveals use the decision outcome; normal reveals use value tiers.
    if (revealSoundOverride === 'good') {
      revealSoundLow();
    } else if (revealSoundOverride === 'bad') {
      revealSoundHigh();
    } else {
      playRevealSound(value);
    }
  }

  function finishReveal() {
    // Manual mode: leave the stage on screen and surface a Continue button
    // at the bottom center so the player controls when to move on.
    setTimeout(() => {
      dom.manualContinueBtn.style.display = '';
      void dom.manualContinueBtn.offsetWidth; // commit display change so the fade-in transition runs
      dom.manualContinueBtn.classList.add('show');
      awaitingContinue = true;
    }, 850);
    dom.manualContinueBtn.onclick = () => {
      awaitingContinue = false;
      dom.manualContinueBtn.onclick = null; // a hidden button must never re-fire an old reveal
      dom.manualContinueBtn.classList.remove('show');
      dom.manualContinueBtn.style.display = 'none';
      // Close the revealed case right away — once Continue is
      // pressed the stage starts to exit immediately...
      setTimeout(() => {
        dom.centerStage.classList.remove('show');
        dom.spotlightBackdrop.classList.remove('show');
        dom.manualSlider.style.display = 'none';
        dom.manualBackBtn.style.display = 'none';
      }, 150);
      // ...then hold the beat before the prize-board removal
      // animation, so the closed case gets a moment to itself.
      // The game unlocks when the callback fires, or the next
      // case click gets swallowed mid-fade.
      setTimeout(() => {
        if (gridBtn) gridBtn.classList.remove('focus-case', 'lifted');
        dom.caseGrid.classList.remove('reveal-focus');
        callback(value, idx);
      }, CONTINUE_PAUSE_MS + 150);
    };
  }

  if (game.manualOpenMode) {
    setTimeout(() => {
      dom.centerStageLabel.classList.add('show');
      startManualSlider(() => {
        revealDrama();
        finishReveal();
      }, typeof onCancel === 'function' ? () => {
        dom.centerStage.classList.remove('show');
        dom.spotlightBackdrop.classList.remove('show');
        dom.manualSlider.style.display = 'none';
        if (gridBtn) gridBtn.classList.remove('focus-case', 'lifted');
        dom.caseGrid.classList.remove('reveal-focus');
        onCancel();
      } : null);
    }, travelMs + 280);
  } else {
    setTimeout(() => {
      dom.centerCase.classList.add('lid-open');
      dom.centerStageLabel.classList.add('show');
      // Drumroll builds tension and peaks right as the value is revealed.
      startTensionRoll(0.65);
    }, travelMs + 280);

    setTimeout(revealDrama, travelMs + 950);

    setTimeout(() => {
      dom.centerStage.classList.remove('show');
      dom.spotlightBackdrop.classList.remove('show');
    }, travelMs + 2050);

    setTimeout(() => {
      if (gridBtn) gridBtn.classList.remove('focus-case', 'lifted');
      dom.caseGrid.classList.remove('reveal-focus');
      callback(value, idx);
    }, travelMs + 2400);
  }
}

function startManualSlider(onOpened, onBack) {
  const cover = dom.centerCase.querySelector('.num');
  dom.manualSlider.style.display = 'flex';
  dom.sliderHandle.style.top = '0%';
  dom.sliderFill.style.height = '0%';
  cover.style.transition = 'none';
  cover.style.transform = 'rotateX(0deg)';

  let dragging = false;
  let opened = false;
  dom.manualBackBtn.style.display = onBack ? '' : 'none';

  function setProgress(p) {
    p = Math.max(0, Math.min(1, p));
    dom.sliderHandle.style.top = (p * 100) + '%';
    dom.sliderFill.style.height = (p * 100) + '%';
    cover.style.transition = 'none';
    cover.style.transform = `rotateX(${-p * 108}deg)`;
    if (p >= 0.92 && !opened) {
      opened = true;
      lockOpen();
    }
  }

  function lockOpen() {
    dragging = false;
    cover.style.transition = 'transform 0.2s ease';
    cover.style.transform = 'rotateX(-108deg)';
    dom.sliderHandle.style.top = '100%';
    dom.sliderFill.style.height = '100%';
    dom.sliderHandle.style.pointerEvents = 'none';
    dom.manualBackBtn.style.display = 'none';
    cleanup();
    setTimeout(onOpened, 250);
  }

  function pointerToProgress(e) {
    const rect = dom.sliderTrack.getBoundingClientRect();
    return (e.clientY - rect.top) / rect.height;
  }

  function onPointerDown(e) {
    if (opened) return;
    dragging = true;
    dom.sliderHandle.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!dragging || opened) return;
    setProgress(pointerToProgress(e));
  }
  function onPointerUp() {
    if (opened) return;
    if (dragging) {
      dragging = false;
      cover.style.transition = 'transform 0.35s ease';
      cover.style.transform = 'rotateX(0deg)';
      dom.sliderHandle.style.transition = 'top 0.35s ease';
      dom.sliderFill.style.transition = 'height 0.35s ease';
      dom.sliderHandle.style.top = '0%';
      dom.sliderFill.style.height = '0%';
      setTimeout(() => {
        dom.sliderHandle.style.transition = '';
        dom.sliderFill.style.transition = '';
      }, 360);
    }
  }
  function onBackClick() {
    if (opened || !onBack) return;
    cleanup();
    dom.manualBackBtn.style.display = 'none';
    onBack();
  }

  function cleanup() {
    dom.sliderHandle.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    dom.manualBackBtn.removeEventListener('click', onBackClick);
    dom.sliderHandle.style.pointerEvents = '';
  }

  dom.sliderHandle.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  if (onBack) dom.manualBackBtn.addEventListener('click', onBackClick);
}

/** If a finished manual reveal is still waiting on its Continue button,
 *  dismiss it exactly as a real Continue click would. Returns true when a
 *  pending reveal was consumed. Lets the player click the NEXT case
 *  instead of hunting for the small Continue button. */
function finishPendingReveal() {
  if (!awaitingContinue) return false;
  dom.manualContinueBtn.click();
  return true;
}
function spawnCaseParticles(container) {
  container.innerHTML = '';
  const count = 16;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'case-particle';
    const angle = (Math.PI * 2 * i / count) + (Math.random() * 0.4 - 0.2);
    const dist = 70 + Math.random() * 90;
    p.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
    container.appendChild(p);
    requestAnimationFrame(() => p.classList.add('burst'));
  }
}


// ============================================
// Case click logic
// ============================================
function onCaseClick(n) {
  if (game.state === 'setup' && game.yourCase === null) {
    game.yourCase = n;
    game.state = 'playing';
    renderAll();
    updateStatus();
    logEvent(`Chose <b>Case #${n}</b> as Your Case.`);
    return;
  }
  if (game.state !== 'playing') {
    // A finished manual reveal sits on its Continue button — treat a
    // click on any other case as "continue" and open that case next.
    if (game.state === 'revealing' && finishPendingReveal()) {
      // Wait out the Continue pause (stage exit + board settle) so the
      // next case's reveal animation starts after a beat, not instantly.
      setTimeout(() => {
        if (game.state === 'playing' && !game.openedCases.has(n) && n !== game.yourCase) {
          openCase(n);
        }
      }, CONTINUE_PAUSE_MS + 400);
    }
    return;
  }
  if (game.openedCases.has(n) || n === game.yourCase) return;
  openCase(n);
}

function openCase(n) {
  game.state = 'revealing';
  renderGrid();
  const selectedCase = dom.caseGrid.querySelector(`.briefcase[data-num="${n}"]`);
  if (selectedCase) selectedCase.classList.add('focus-case');
  const beginCenterReveal = () => {
    revealCaseAnimated(n, 'Case #' + n, (value, idx) => {
      finishOpen(n, idx);
    }, true, () => {
      game.state = 'playing';
      renderGrid();
      updateStatus();
    });
  };
  requestAnimationFrame(() => requestAnimationFrame(() => {
    dom.caseGrid.classList.add('reveal-focus');
    setTimeout(beginCenterReveal, 800);
  }));
}

function finishOpen(n, idx) {
  game.amounts[idx].eliminated = true;
  game.openedCases.add(n);
  game.openedInRound++;
  game.roundEliminatedValues.push(game.amounts[idx].value);
  // Restore playability FIRST: a throw further down (e.g. a sound
  // effect failing) must never leave the board locked in 'revealing'
  // with every case disabled.
  game.state = 'playing';
  try {
    eliminateBoardValue(idx);
  } catch (e) { /* a failed cross-off effect must not break the game flow */ }
  logEvent(`[Round ${game.roundIndex + 1}] Eliminated <b>Case #${n}</b> — ${fmt(game.amounts[idx].value)}`);

  const roundComplete = game.openedInRound >= (game.schedule[game.roundIndex] || 0);
  renderGrid();
  renderYourCase();
  updateStatus();
  dom.caseGrid.classList.add('reveal-focus');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    dom.caseGrid.classList.remove('reveal-focus');
  }));

  if (roundComplete) {
    game.openedInRound = 0;
    // Last case of the round is gone — let the board breathe for a
    // beat before the banker gets on the line.
    if (game.postDealMode) {
      setTimeout(triggerHypotheticalOffer, 4000);
    } else {
      setTimeout(triggerBankerOffer, 4000);
    }
  }
}


// ============================================
// Rendering
// ============================================
function renderAll() {
  renderGrid();
  renderBoard();
  renderYourCase();
  updateToolbar();
}
function refreshCurrencyDisplay() {
  renderGrid();
  renderBoard();
  renderYourCase();
  if (game.lastOffer !== null && dom.bankerOfferDisplay.textContent &&
      dom.bankerOfferDisplay.textContent !== 'NO DEAL' &&
      !dom.bankerOfferDisplay.classList.contains('no-deal') &&
      !dom.bankerOfferDisplay.classList.contains('counter-offer')) {
    dom.bankerOfferDisplay.textContent = fmtDisplayBoard(game.lastOffer);
  }
}
function renderYourCase() {
  const holder = dom.yourCaseHolder;
  holder.className = 'your-case-holder briefcase';
  const numEl = holder.querySelector('.num');
  const amtEl = holder.querySelector('.amount-val');
  if (game.yourCase === null) {
    numEl.textContent = '?';
    amtEl.textContent = '';
  } else if (game.openedCases.has(game.yourCase)) {
    holder.classList.add('filled', 'opened');
    if (game.hideOpenedCases) holder.classList.add('opened-hidden');
    numEl.textContent = '';
    setBriefcaseAmount(amtEl, game.amounts[game.caseAssignment[game.yourCase - 1]].value);
    applyInteriorAmountStyling(amtEl);
  } else {
    holder.classList.add('filled');
    numEl.textContent = game.yourCase;
    amtEl.textContent = '';
  }
}
function caseInnerMarkup(n) {
  return `
    <div class="case-glow"></div>
    <div class="case-particles"></div>
    <div class="case-base"></div>
    <div class="case-interior"></div>
    <div class="case-handle"></div>
    <span class="num">${n}</span>
    <span class="amount-val"></span>
  `;
}
function renderGrid() {
  dom.caseGrid.innerHTML = '';
  dom.caseGrid.classList.toggle('grid-20', game.caseCount === 20);
  getCaseGridRows(game.caseCount).forEach(cfg => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'case-row' + (cfg.align ? ' ' + cfg.align : '');
    for (let i = 0; i < cfg.count; i++) {
      const n = cfg.start + i;
      const btn = document.createElement('button');
      btn.className = 'briefcase';
      btn.dataset.num = n;
      btn.innerHTML = caseInnerMarkup(n);

      const isYourCase = (n === game.yourCase);
      const isOpened = game.openedCases.has(n);

      if (isYourCase && !isOpened) btn.classList.add('your-pick');
      if (isYourCase && game.hideOpenedCases) btn.classList.add('opened', 'opened-hidden');
      if (isOpened && !game.hideOpenedCases) {
        btn.classList.add('opened');
        const rvEl = btn.querySelector('.amount-val');
        setBriefcaseAmount(rvEl, game.amounts[game.caseAssignment[n - 1]].value);
        applyInteriorAmountStyling(rvEl);
      } else if (isOpened && game.hideOpenedCases) {
        btn.classList.add('opened', 'opened-hidden');
      } else if (game.nightVisionMode) {
        btn.classList.add('night-vision');
        const tag = document.createElement('span');
        tag.className = 'night-vision-tag';
        setBriefcaseAmount(tag, game.amounts[game.caseAssignment[n - 1]].value);
        btn.appendChild(tag);
      }

      const disabled = game.state === 'ended' || game.state === 'revealing' || game.state === 'offer' ||
                        game.state === 'finalDecision' || isOpened ||
                        (game.state !== 'setup' && isYourCase);

      btn.disabled = disabled;
      btn.addEventListener('click', () => onCaseClick(n));
      rowDiv.appendChild(btn);
    }
    dom.caseGrid.appendChild(rowDiv);
  });
  // Re-apply the current interior background to newly created case-interior elements
  applyInteriorBg(getInteriorBgId());
}
function renderBoard() {
  dom.boardColLow.innerHTML = '';
  dom.boardColHigh.innerHTML = '';
  const boardEl = dom.boardColLow.closest('.board');
  const boardSquareWidth = getBoardSquareWidth();
  boardEl.classList.toggle('board-squares-wide', boardSquareWidth > SQ_FULL_WIDTH);
  game.boardRowEls = {};
  const withIndex = game.amounts.map((a, i) => ({ ...a, idx: i }));
  withIndex.sort((a, b) => a.value - b.value || a.idx - b.idx);
  const mid = Math.ceil(withIndex.length / 2);
  const low = withIndex.slice(0, mid);
  const high = withIndex.slice(mid);

  function buildRow(item) {
    const row = document.createElement('div');
    row.className = 'amount-row';
    row.dataset.idx = item.idx;
    const squares = getBoardBgId() === 'squares';
    if (squares) {
      const removedValue = document.createElement('span');
      removedValue.className = 'removed-value';
      removedValue.textContent = fmtDisplayBoard(item.value);
      wrapValueSquares(removedValue, true);
      row.appendChild(removedValue);
    }
    if (game.editMode && !item.eliminated && game.state === 'setup') {
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = 'any';
      input.value = item.value;
      input.addEventListener('change', commitEdit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
      function commitEdit() {
        const v = parseFloat(input.value);
        if (!isNaN(v) && v >= 0) {
          game.amounts[item.idx].value = v;
        } else {
          input.value = game.amounts[item.idx].value; // revert invalid input, don't touch the rest of the board
        }
        // NOTE: intentionally not calling renderBoard() here - rebuilding the whole
        // board on every single edit would destroy other inputs mid-interaction.
      }
      row.appendChild(input);
    } else if (game.showCurrencyBoard) {
      const dollar = document.createElement('span');
      dollar.className = 'currency-sym';
      dollar.textContent = '$';
      const num = document.createElement('span');
      num.className = 'currency-num';
      num.textContent = formatNumber(item.value);
      if (squares) { wrapValueSquares(dollar); wrapValueSquares(num, true); }
      row.appendChild(dollar);
      row.appendChild(num);
    } else {
      const val = document.createElement('span');
      val.textContent = fmtDisplayBoard(item.value);
      if (squares) wrapValueSquares(val, true);
      row.appendChild(val);
    }
    game.boardRowEls[item.idx] = row;
    return row;
  }
  low.forEach(item => dom.boardColLow.appendChild(buildRow(item)));
  high.forEach(item => dom.boardColHigh.appendChild(buildRow(item)));
  equalizeRowWidths();

  const rowsByValue = new Map();
  game.amounts.forEach((amount, idx) => {
    if (!rowsByValue.has(amount.value)) rowsByValue.set(amount.value, []);
    rowsByValue.get(amount.value).push({ idx, row: game.boardRowEls[idx] });
  });
  for (const rows of rowsByValue.values()) {
    const eliminatedCount = rows.filter(({ idx }) => game.amounts[idx].eliminated).length;
    rows.sort(compareBoardRowsInRevealOrder);
    rows.slice(0, eliminatedCount).forEach(({ row }) => {
      row.classList.add('eliminated');
      const removedValue = row.querySelector('.removed-value');
      if (removedValue) removedValue.classList.add('visible');
    });
  }
}

function compareBoardRowsInRevealOrder(a, b) {
  const aColumn = a.row.parentElement === dom.boardColLow ? 0 : 1;
  const bColumn = b.row.parentElement === dom.boardColLow ? 0 : 1;
  if (aColumn !== bColumn) return aColumn - bColumn;
  return a.row.getBoundingClientRect().top - b.row.getBoundingClientRect().top;
}

function equalizeRowWidths() {
  const rows = Object.values(game.boardRowEls);
  if (rows.length === 0) return;
  rows.forEach(r => { r.style.width = ''; });
  let maxWidth = 0;
  rows.forEach(r => { maxWidth = Math.max(maxWidth, r.offsetWidth); });
  rows.forEach(r => { r.style.width = maxWidth + 'px'; });
}

/** Animate a single board value being crossed off. */
function eliminateBoardValue(idx) {
  const value = game.amounts[idx].value;
  const matchingRows = game.amounts
    .map((amount, rowIdx) => ({ amount, row: game.boardRowEls[rowIdx] }))
    .filter(({ amount, row }) => amount.value === value && row &&
      !row.classList.contains('eliminated') && !row.classList.contains('eliminating'));
  matchingRows.sort(compareBoardRowsInRevealOrder);
  const el = matchingRows[0]?.row || game.boardRowEls[idx];
  if (!el) return;
  el.classList.add('eliminating');
  if (getBoardBgId() === 'squares') {
    setTimeout(() => {
      el.classList.add('squares-flip-complete');
    }, 680);
    setTimeout(() => {
      el.classList.add('squares-after-glow');
    }, 1400);
  }
  boardEliminateSound(game.amounts[idx].value);
  setTimeout(() => {
    el.classList.remove('eliminating');
    el.classList.add('eliminated');
  }, 1750);
}
function updateToolbar() {
  const preGame = (game.state === 'setup' && game.yourCase === null);
  dom.editToggle.disabled = !preGame || game.editMode;
  dom.editToggle.style.display = game.editMode ? 'none' : '';
  dom.saveValuesBtn.style.display = game.editMode ? '' : 'none';
  dom.shuffleBtn.disabled = !preGame;
  dom.resetValuesBtn.disabled = !preGame;
  if (!preGame && game.editMode) {
    game.editMode = false;
    dom.editToggle.textContent = 'Edit Values';
  }
}

let shelfFlashTimer = null;
/** Washes the whole case table's shelf rails a single solid color the moment
 *  a case value is revealed: all yellow for values below $100K, all red for
 *  $100K and up. Both are brief flashes — the rails return to their normal
 *  animated gradient on their own shortly after. The gradient loops keep
 *  running underneath, so the rails resume seamlessly once the wash lifts. */
function flashTableShelves(value) {
  dom.caseGrid.classList.remove('shelf-red-all', 'shelf-flash-yellow');
  clearTimeout(shelfFlashTimer);
  if (value < 100000) {
    dom.caseGrid.classList.add('shelf-flash-yellow');
  } else {
    dom.caseGrid.classList.add('shelf-red-all');
  }
  shelfFlashTimer = setTimeout(() => {
    dom.caseGrid.classList.remove('shelf-red-all', 'shelf-flash-yellow');
  }, 1300);
}
function clearShelfFlash() {
  dom.caseGrid.classList.remove('shelf-red-all', 'shelf-flash-yellow');
  clearTimeout(shelfFlashTimer);
}


// ============================================
// Init / New Game
// ============================================
function initValues() {
  game.amounts = getValuesForCount(game.caseCount).map(v => ({ value: v, eliminated: false }));
  game.schedule = buildSchedule(game.caseCount);
}
function resetEliminatedFlags() {
  game.amounts.forEach(a => { a.eliminated = false; });
}
function assignCases() {
  game.caseAssignment = shuffleArr([...Array(game.caseCount).keys()]);
}
function newGame() {
  const countChanged = game.caseCount !== game.nextCaseCount;
  game.caseCount = game.nextCaseCount;
  game.schedule = buildSchedule(game.caseCount);
  if (countChanged || game.amounts.length !== game.caseCount) {
    game.amounts = getValuesForCount(game.caseCount).map(v => ({ value: v, eliminated: false }));
  } else {
    resetEliminatedFlags();
  }
  assignCases();
  game.yourCase = null;
  game.openedCases = new Set();
  game.state = 'setup';
  game.roundIndex = 0;
  game.openedInRound = 0;
  game.roundEliminatedValues = [];
  game.lastOffer = null;
  game.offerHistory = [];
  game.counterOfferUsed = false;
  game.pendingCounterOffer = null;
  game.pendingCounterAccepted = null;
  game.postDealMode = false;
  game.dealTakenAmount = null;
  game.hypotheticalOffers = [];
  game.revealMode = 'real';
  game.editMode = false;
  dom.editToggle.textContent = 'Edit Values';
  dom.editToggle.disabled = false;
  dom.bankerOfferDisplay.classList.remove('flip-anim', 'no-deal', 'counter-offer');
  dom.bankerOfferDisplay.textContent = '';
  resetGameLog();
  logEvent(`New game started with <b>${game.caseCount}</b> briefcases.`);
  renderOffersHistory();
  hideAll();
  renderAll();
  dom.statusLine.innerHTML = 'Pick a briefcase below to hold as <b>your case</b>.';
}


// ============================================
// End Game
// ============================================
function endGame(mode, chosenCase, otherCase) {
  game.state = 'ended';
  renderAll();
  dom.endResults.innerHTML = '';
  dom.badDecisionNote.style.display = 'none';
  dom.badDecisionNote.innerHTML = '';

  if (mode === 'deal') {
    dom.endTitle.textContent = 'DEAL!';
    dom.endSub.textContent = `You accepted the banker's offer.`;
    const card = document.createElement('div');
    card.className = 'result-card win';
    card.innerHTML = `<div class="rc-label">You Won</div><div class="rc-val">${fmt(game.dealTakenAmount)}</div>`;
    dom.endResults.appendChild(card);

    const yourValue = game.amounts[game.caseAssignment[game.yourCase - 1]].value;
    const card2 = document.createElement('div');
    card2.className = 'result-card';
    card2.innerHTML = `<div class="rc-label">Case #${game.yourCase} Actually Held</div><div class="rc-val">${fmt(yourValue)}</div>`;
    dom.endResults.appendChild(card2);

    if (game.hypotheticalOffers.length) {
      const hypoNote = document.createElement('div');
      hypoNote.className = 'hypo-offers-note';
      hypoNote.innerHTML = game.hypotheticalOffers
        .map(o => `<span class="hypo-chip">${fmt(o.amount)}</span>`).join('');
      dom.endResults.insertAdjacentElement('afterend', hypoNote);
    }

    if (yourValue > game.dealTakenAmount) {
      card2.classList.add('danger');
      dom.badDecisionNote.style.display = 'block';
      dom.badDecisionNote.innerHTML = `⚠️ You left <b>${fmt(yourValue - game.dealTakenAmount)}</b> on the table — your case was worth more than the deal you took.`;
      triggerDangerFlash();
    }
  } else {
    const chosenValue = game.amounts[game.caseAssignment[chosenCase - 1]].value;
    const otherValue = game.amounts[game.caseAssignment[otherCase - 1]].value;
    dom.endTitle.textContent = 'NO DEAL!';
    dom.endSub.textContent = `You played it all the way to the end.`;

    const card = document.createElement('div');
    card.className = 'result-card win';
    card.innerHTML = `<div class="rc-label">Case #${chosenCase} (Your Choice)</div><div class="rc-val">${fmt(chosenValue)}</div>`;
    dom.endResults.appendChild(card);

    const card2 = document.createElement('div');
    card2.className = 'result-card';
    card2.innerHTML = `<div class="rc-label">Case #${otherCase}</div><div class="rc-val">${fmt(otherValue)}</div>`;
    dom.endResults.appendChild(card2);

    const lastDeclined = game.offerHistory.length ? game.offerHistory[game.offerHistory.length - 1].amount : null;
    if (lastDeclined !== null && chosenValue < lastDeclined) {
      card.classList.remove('win');
      card.classList.add('danger');
      dom.badDecisionNote.style.display = 'block';
      dom.badDecisionNote.innerHTML = `⚠️ You walked away with <b>${fmt(lastDeclined - chosenValue)}</b> less than the banker's last offer of ${fmt(lastDeclined)}.`;
      triggerDangerFlash();
    }
  }

  dom.statusLine.innerHTML = 'Game over. Press <b>Play Again</b> to start a new round.';
  dom.endBackdrop.classList.add('show');
}

dom.playAgainBtn.addEventListener('click', newGame);


// ============================================
// Final Decision
// ============================================
function showFinalDecision() {
  game.state = 'finalDecision';
  renderGrid();
  let otherCase = null;
  for (let n = 1; n <= game.caseCount; n++) {
    if (n !== game.yourCase && !game.openedCases.has(n)) { otherCase = n; break; }
  }
  dom.finalSub.textContent = `Case #${otherCase} is the only other case left. Keep case #${game.yourCase}, or switch?`;
  dom.finalCases.innerHTML = '';

  const keepBtn = document.createElement('button');
  keepBtn.className = 'final-case-btn';
  keepBtn.innerHTML = `<span class="fc-num">#${game.yourCase}</span><span class="fc-tag">Keep Mine</span>`;
  keepBtn.addEventListener('click', () => resolveFinal(game.yourCase, otherCase));

  const switchBtn = document.createElement('button');
  switchBtn.className = 'final-case-btn';
  switchBtn.innerHTML = `<span class="fc-num">#${otherCase}</span><span class="fc-tag">Switch</span>`;
  switchBtn.addEventListener('click', () => resolveFinal(otherCase, otherCase));

  dom.finalCases.appendChild(keepBtn);
  dom.finalCases.appendChild(switchBtn);
  dom.finalBackdrop.classList.add('show');
}

function resolveFinal(chosenCase, otherCaseNum) {
  dom.finalBackdrop.classList.remove('show');
  game.state = 'revealing';
  renderGrid();
  revealCaseAnimated(game.yourCase, 'Your Case', (v1, i1) => {
    game.amounts[i1].eliminated = true;
    game.openedCases.add(game.yourCase);
    eliminateBoardValue(i1);
    logYourCaseReveal(game.yourCase, v1);
    renderGrid();
    const finalLabel = (otherCaseNum === chosenCase) ? 'Case #' + otherCaseNum + ' (Switched To)' : 'Case #' + otherCaseNum;
    setTimeout(() => {
      revealCaseAnimated(otherCaseNum, finalLabel, (v2, i2) => {
        game.amounts[i2].eliminated = true;
        game.openedCases.add(otherCaseNum);
        eliminateBoardValue(i2);
        logUnopenedFinalCaseReveal(otherCaseNum, v2);
        const displayOtherCase = (chosenCase === game.yourCase) ? otherCaseNum : game.yourCase;
        endGame('played', chosenCase, displayOtherCase);
      });
    }, 300);
  });
}

function logYourCaseReveal(caseNumber, value) {
  logEvent(`<b>Your Case Revealed</b> — Case #${caseNumber} held <b>${fmt(value)}</b>.`, 'deal');
}

function logUnopenedFinalCaseReveal(caseNumber, value) {
  logEvent(`<b>Unopened Final Case Revealed</b> — Case #${caseNumber} held <b>${fmt(value)}</b>.`);
}


// ============================================
// Counter Offer
// ============================================
function revealCounterDecision() {
  const accepted = game.pendingCounterAccepted;
  const counterValue = game.pendingCounterOffer;
  dom.bankerOfferDisplay.classList.add('flip-anim');
  setTimeout(() => {
    dom.bankerOfferDisplay.classList.remove('counter-offer');
    dom.bankerOfferDisplay.textContent = accepted ? 'DEAL' : 'NO DEAL';
    dom.bankerOfferDisplay.classList.toggle('no-deal', !accepted);
  }, 300);
  setTimeout(() => {
    dom.bankerOfferDisplay.classList.remove('flip-anim');
    dom.offerLabel.textContent = accepted ? 'Banker said: DEAL!' : 'Banker said: NO DEAL.';
    if (accepted) {
      logEvent(`[Round ${game.roundIndex + 1}] Banker <b>accepted</b> the counter offer of ${fmt(counterValue)}.`, 'deal');
      setTimeout(() => acceptOffer(counterValue), 850);
    } else {
      logEvent(`[Round ${game.roundIndex + 1}] Banker <b>declined</b> the counter offer of ${fmt(counterValue)}.`, 'nodeal');
      setTimeout(continueAfterCounterRejection, 850);
    }
  }, 620);
}

function continueAfterCounterRejection() {
  dom.offerBackdrop.classList.remove('show', 'calling-red');
  document.body.classList.remove('calling-red-bg');
  game.offerHistory.push({ round: game.roundIndex + 1, amount: game.lastOffer });
  renderOffersHistory();
  game.roundIndex++;
  const remainingUnopened = game.caseCount - 1 - game.openedCases.size;
  if (game.roundIndex >= game.schedule.length || remainingUnopened <= 1) {
    showFinalDecision();
  } else {
    game.state = 'playing';
    renderGrid();
    updateStatus();
  }
}

function decideCounterOffer(counterValue, offerValue) {
  let prob;
  if (counterValue <= offerValue) {
    prob = 0.95;
  } else {
    const ratio = counterValue / offerValue;
    prob = 0.95 - (ratio - 1) * 1.5;
  }
  prob = Math.max(0.05, Math.min(0.95, prob));
  return Math.random() < prob;
}

// ---- Event listeners ----
dom.counterLinkBtn.addEventListener('click', () => {
  dom.counterInput.value = Math.round(game.lastOffer);
  dom.counterInput.min = game.lastOffer;
  dom.offerButtonsRow.style.display = 'none';
  dom.counterLinkBtn.style.display = 'none';
  dom.counterPanel.style.display = 'block';
});

dom.cancelCounterBtn.addEventListener('click', () => {
  dom.counterPanel.style.display = 'none';
  dom.offerButtonsRow.style.display = '';
  dom.counterLinkBtn.style.display = '';
});

dom.submitCounterBtn.addEventListener('click', () => {
  const counterValue = parseFloat(dom.counterInput.value);
  if (isNaN(counterValue) || counterValue < game.lastOffer) {
    dom.counterStatus.style.display = 'block';
    dom.counterStatus.textContent = `Your counter offer must be at least ${fmt(game.lastOffer)}.`;
    return;
  }

  game.counterOfferUsed = true;
  game.pendingCounterOffer = counterValue;
  game.pendingCounterAccepted = decideCounterOffer(counterValue, game.lastOffer);
  dom.counterPanel.style.display = 'none';
  dom.offerContent.style.display = 'none';
  dom.counterStatus.style.display = 'none';
  dom.bankerOfferDisplay.classList.remove('flip-anim', 'no-deal');
  dom.bankerOfferDisplay.classList.add('counter-offer');
  dom.bankerOfferDisplay.innerHTML = `<span class="counter-tile-label">Counter Offer</span><span class="counter-tile-amount">${fmtDisplayBoard(counterValue)}</span>`;
  logEvent(`[Round ${game.roundIndex + 1}] Made a <b>Counter Offer</b> of ${fmt(counterValue)} (banker offered ${fmt(game.lastOffer)}).`);

  setTimeout(() => {
    dom.offerStatus.style.display = 'block';
    dom.offerStatus.textContent = 'The banker is calling back...';
    dom.offerModalEl.classList.add('banker-calling');
    dom.offerBackdrop.classList.add('calling-red');
    document.body.classList.add('calling-red-bg');
    dom.phoneIconEl.classList.add('calling');
  }, 350);

  setTimeout(() => {
    dom.offerModalEl.classList.remove('banker-calling');
    dom.offerBackdrop.classList.remove('calling-red');
    document.body.classList.remove('calling-red-bg');
    dom.phoneIconEl.classList.remove('calling');
    dom.offerStatus.style.display = 'none';
    dom.offerContent.style.display = 'block';
    dom.offerLabel.textContent = 'Banker said...';
    game.revealMode = 'counterDecision';
    dom.revealOfferBtn.style.display = '';
    dom.revealOfferBtn.classList.add('fade-in');
  }, 5350);
});


// ============================================
// Banker Offer
// ============================================
// Re-export for counter.js, which (like the original monolith) reaches the
// final-decision screen through the banker module.
function computeOffer() {
  const remaining = remainingAmountValues();

  if (!remaining.length) return 0;

  // --------------------------------------------
  // 1. Expected value of the remaining board
  // --------------------------------------------
  const avg =
    remaining.reduce((sum, value) => sum + value, 0) / remaining.length;

  const count = remaining.length;

  // --------------------------------------------
  // 2. Existing round-based progression
  // --------------------------------------------
  const roundProgress = Math.min(1, game.roundIndex / 7);

  // Overall progression, tuned to the real show's offer curve:
  // offer 1 lands near ~15-30% of EV, mid game ~55-70%, late game aggressive.
  let factor = 0.35 + roundProgress * 0.55;

  // --------------------------------------------
  // 3. Number-of-cases adjustment
  // --------------------------------------------
  if (count <= 2) { // round 9
    // Final two:
    // The Banker becomes much more aggressive and
    // may offer above the mathematical average.
    factor = Math.max(factor, 0.9);
  } 
  
  else if (count === 3) { // 8
    factor = Math.max(factor, 0.8);
  } else if (count === 4) { // 7
    factor = Math.max(factor, 0.7);
  } else if (count <= 5) { // 6
    factor = Math.max(factor, 0.6);
  } else if (count <= 6) { // 6
    factor = Math.max(factor, 0.5);
  } else if (count <= 8) { // 5
    factor = Math.max(factor, 0.4);
  } else if (count <= 11) { // 4
    factor = Math.max(factor, 0.3);
  } else if (count <= 15) { // round 3
    factor = Math.max(factor, 0.2);
  } else if (count <= 20) { // round 1 — stingy opener, like the show
    factor = Math.max(factor, 0.24);
  }

  // --------------------------------------------
  // 4. Board spread / risk
  // --------------------------------------------
  const sorted = [...remaining].sort((a, b) => a - b);

  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];

  // How far apart the smallest and largest values are
  // relative to the board's average.
  const spreadRatio = avg > 0
    ? (highest - lowest) / avg
    : 0;

  /*
   * A wide spread means a high-risk board:
   *
   *   $1 / $10K / $1M
   *
   * is much more volatile than:
   *
   *   $300K / $400K / $500K
   *
   * We give the Banker a modest bonus for this.
   */
  const spreadBonus = Math.min(0.04, spreadRatio * 0.01);

  factor += spreadBonus;

  // --------------------------------------------
  // 5. Jackpot / top-value pressure
  // --------------------------------------------
  const topValue = highest;

  /*
   * When the highest remaining prize is enormous compared
   * with the average, the contestant is taking a much
   * bigger gamble by saying NO DEAL.
   *
   * This gives the Banker a little extra incentive to buy
   * them out.
   */
  const jackpotRatio = avg > 0
    ? topValue / avg
    : 0;

  if (jackpotRatio >= 1.8) {
    factor += 0.04;
  } else if (jackpotRatio >= 1.5) {
    factor += 0.025;
  }

  // --------------------------------------------
  // 6. Final-two premium
  // --------------------------------------------
  if (count === 2) {
    /*
     * Allow the final offer to exceed EV.
     *
     * Example:
     * $1 + $1,000,000
     * EV ≈ $500,000
     *
     * Final factor can reach roughly 1.20,
     * allowing offers around $600K.
     */
    factor += 0.08;
  }

  // --------------------------------------------
  // 7. Controlled randomness
  // --------------------------------------------
  let randomRange = 0.025;

  if (count <= 6) {
    randomRange = 0.015;
  }

  if (count <= 3) {
    randomRange = 0.01;
  }

  factor += Math.random() * randomRange * 2 - randomRange;

  // --------------------------------------------
  // 8. Sensible limits
  // --------------------------------------------
  // Floor is low so early rounds stay stingy; the count ladder provides the
  // late-game aggression instead of a global minimum.
  factor = Math.max(0.15, Math.min(1.20, factor));

  // Early-round stinginess cap — the show's banker opens low (~15-30% of EV)
  // and only gets generous as the board empties. Without this, the base curve
  // + spread/jackpot bonuses hand out ~45-50% of EV in round 1.
  const earlyCaps = [0.30, 0.40, 0.50, 0.60]; // rounds 1-4 (20/15/11/8 cases left)
  if (game.roundIndex < earlyCaps.length) {
    factor = Math.min(factor, earlyCaps[game.roundIndex]);
  }

  // --------------------------------------------
  // 9. Calculate offer
  // --------------------------------------------
  let offer = avg * factor;

  // --------------------------------------------
  // 10. Banker-style rounding
  // --------------------------------------------
  if (offer >= 10000) {
    offer = Math.round(offer / 500) * 500;
  } else if (offer >= 1000) {
    offer = Math.round(offer / 50) * 50;
  } else if (offer >= 100) {
    offer = Math.round(offer / 5) * 5;
  } else {
    offer = Math.round(offer);
  }

  return offer;
}
function triggerBankerOffer() {
  game.state = 'offer';
  renderGrid();
  dom.statusLine.innerHTML = 'The banker is on the line...';
  dom.offerBackdrop.classList.add('show');
  showOffersPanel();

  dom.offerStatus.style.display = 'block';
  dom.offerStatus.textContent = 'The banker is calling...';
  dom.offerContent.style.display = 'none';
  dom.offerLabel.textContent = 'The Banker Is Offering You...';
  dom.offerLabel.style.display = '';
  dom.secretBankOfferBtn.style.display = 'none';
  dom.customOfferBackdrop.style.display = 'none';
  game.revealMode = 'real';
  dom.revealOfferBtn.style.display = 'none';
  dom.revealOfferBtn.classList.remove('fade-in');
  dom.continuePlayoutBtn.style.display = 'none';
  dom.continuePlayoutBtn.classList.remove('fade-in');
  dom.bankerOfferDisplay.classList.remove('flip-anim', 'no-deal', 'counter-offer');
  dom.bankerOfferDisplay.textContent = '';
  dom.counterStatus.style.display = 'none';
  dom.counterPanel.style.display = 'none';
  // Secret: ready the custom bank-offer input with the computed offer.
  dom.customOfferInput.value = '';
  dom.customOfferInput.min = '';
  dom.offerButtonsRow.style.display = 'none';
  dom.offerButtonsRow.classList.remove('fade-in');
  dom.counterLinkBtn.style.display = 'none';
  dom.counterLinkBtn.classList.remove('fade-in');
  dom.offerModalEl.classList.add('banker-calling');
  dom.offerBackdrop.classList.add('calling-red');
  document.body.classList.add('calling-red-bg');
  dom.phoneIconEl.classList.add('calling');
  playBankerRing(2);
  setTimeout(() => {
      game.lastOffer = computeOffer();
      logEvent(`[Round ${game.roundIndex + 1}] Banker's Offer: <b>${fmt(game.lastOffer)}</b>`);
      dom.offerModalEl.classList.remove('banker-calling');
      dom.phoneIconEl.classList.remove('calling');
      dom.offerStatus.style.display = 'none';
      dom.offerContent.style.display = 'block';
      dom.revealOfferBtn.style.display = '';
      dom.revealOfferBtn.classList.add('fade-in');

      // Step 2 (+~300ms): secret custom offer control. The banker takes the
      // phone off the line; the player may now quietly set their own offer.
      dom.secretBankOfferBtn.style.display = '';
      dom.secretBankOfferBtn.classList.add('fade-in');
    }, 1700);

    // Secret mode: swap the '+' button for an inline, hidden input
    // (no panel/labels) so nothing else can see what you typed.
    dom.secretBankOfferBtn.addEventListener('click', () => {
      const current = game.lastOffer;
      // Swap the button out for an inline input widget.
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'secretCustomInput';
      input.value = current;
      input.min = current;
      input.inputMode = 'decimal';
      input.placeholder = 'ask for... ';
      input.style.cssText =
        'position:fixed;bottom:18px;right:18px;width:34px;height:34px;'
        + 'padding:0 6px;font-size:1.1rem;'
        + 'border:2px solid rgba(231,187,77,0.5);'
        + 'border-radius:50%;'
        + 'background:linear-gradient(180deg, rgba(231,187,77,0.22), rgba(200,145,20,0.12));'
        + 'color:var(--ice);'
        + 'text-align:center;'
        + 'outline:none;'
        + 'z-index:120;'
        + 'opacity:0.5;'
        + 'transition:transform .18s ease, opacity .18s ease, background .2s ease, box-shadow .2s ease;'
        + 'pointer-events:auto;'
        + 'font-family:inherit;';
      const plus = dom.secretBankOfferBtn.querySelector('.secret-plus');
      if (plus) plus.remove();
      dom.secretBankOfferBtn.appendChild(input);
      dom.secretBankOfferBtn.classList.add('fade-in');

      input.focus();
      input.select();

      // On confirm (Enter), apply the custom offer and jump to reveal.
      const confirmInput = (e) => {
        if (e.key === 'Enter' || e.type === 'blur' || e.type === 'change') {
          const ci = parseFloat(input.value.trim());
          if (isFinite(ci) && ci >= 0) {
            game.lastOffer = Math.round(ci);
            dom.bankerOfferDisplay.textContent = '';
            dom.bankerOfferDisplay.classList.remove('no-deal', 'counter-offer');
            logEvent(`[Round ${game.roundIndex + 1}] <b>Secret custom offer prepared:</b> ${fmt(game.lastOffer)}`);
            closeSecretInput();
          } else {
            input.style.borderColor = 'var(--alert)';
            setTimeout(() => {
              input.style.borderColor = '';
            }, 600);
            input.focus();
          }
        }
      };
      input.addEventListener('keydown', confirmInput);
      input.addEventListener('blur', confirmInput);
      input.addEventListener('change', confirmInput);

      // Close the secret input if the banker call ends.
      const onBankerClose = () => {
        input.removeEventListener('keydown', confirmInput);
        input.removeEventListener('blur', confirmInput);
        input.removeEventListener('change', confirmInput);
        closeSecretInput();
      };
      const bankCalls = ['revealOfferBtn','dealBtn','noDealBtn','continuePlayoutBtn'];
      bankCalls.forEach(function(id){
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', onBankerClose);
      });
    });

    function closeSecretInput(){
      const input = document.getElementById('secretCustomInput');
      if (input && input.parentNode) input.parentNode.removeChild(input);
    }

    function showCustomOfferReveal(){
      // Flip the yellow tile with the secret offer, then show the deal/NO DEAL
      // buttons exactly like the real reveal.
      dom.bankerOfferDisplay.classList.add('flip-anim');
      setTimeout(() => {
        dom.bankerOfferDisplay.textContent = fmtDisplayBoard(game.lastOffer);
      }, 300);
      setTimeout(() => {
        dom.bankerOfferDisplay.classList.remove('flip-anim');
        dom.offerButtonsRow.style.display = '';
        dom.offerButtonsRow.classList.add('fade-in');
        dom.counterLinkBtn.style.display = '';
        dom.counterLinkBtn.classList.add('fade-in');
      }, 620);
    }

    function closeCustomOffer(){
      dom.customOfferBackdrop.style.display = 'none';
      dom.customOfferBackdrop.classList.remove('show');
    }
  }
function renderOffersHistory() {
  dom.offersList.innerHTML = '';
  game.offerHistory.forEach((entry, i) => {
    const chip = document.createElement('div');
    chip.className = 'offer-chip offer-sequence-item' + (i === game.offerHistory.length - 1 ? ' latest' : '');
    chip.style.setProperty('--offer-sequence-delay', `${i * 120}ms`);
    chip.innerHTML = `<span class="oc-amount">${fmt(entry.amount)}</span>`;
    dom.offersList.appendChild(chip);
  });
}
function showOffersPanel() {
  renderOffersHistory();
  dom.offersPanel.style.display = game.offerHistory.length > 0 ? 'block' : 'none';
}
function hideOffersPanel() {
  dom.offersPanel.style.display = 'none';
}
function acceptOffer(amount) {
  game.lastOffer = amount;
  game.dealTakenAmount = amount;
  game.postDealMode = true;
  game.hypotheticalOffers = [];
  hideOffersPanel();
  logEvent(`[Round ${game.roundIndex + 1}] <b>DEAL!</b> Accepted the banker's offer of ${fmt(amount)}.`, 'deal');
  dom.offerBackdrop.classList.remove('show');
  game.roundIndex++;
  game.state = 'offer';
  renderGrid();
  dom.offerBackdrop.classList.add('show');
  dom.offerStatus.style.display = 'none';
  dom.offerContent.style.display = 'block';
  dom.offerLabel.innerHTML = `You said DEAL for <b>${fmt(amount)}</b>!<br>Would you like to see how the game would have played out?`;
  dom.revealOfferBtn.style.display = 'none';
  dom.offerButtonsRow.style.display = 'none';
  dom.counterLinkBtn.style.display = 'none';
  dom.continuePlayoutBtn.style.display = 'none';
  dom.postDealActions.style.display = '';
  dom.postDealActions.classList.add('fade-in');
  dom.offerModalEl.classList.remove('banker-calling');
  dom.offerBackdrop.classList.remove('calling-red');
  document.body.classList.remove('calling-red-bg');
  dom.phoneIconEl.classList.remove('calling');
}
function declineOffer() {
  hideOffersPanel();
  dom.offerBackdrop.classList.remove('show');
  dom.offerBackdrop.classList.remove('calling-red');
  document.body.classList.remove('calling-red-bg');
  logEvent(`[Round ${game.roundIndex + 1}] <b>NO DEAL.</b> Declined the offer of ${fmt(game.lastOffer)}.`, 'nodeal');
  game.offerHistory.push({ round: game.roundIndex + 1, amount: game.lastOffer });
  renderOffersHistory();

  dom.bankerOfferDisplay.classList.add('flip-anim');
  setTimeout(() => {
    dom.bankerOfferDisplay.textContent = 'NO DEAL';
    dom.bankerOfferDisplay.classList.add('no-deal');
  }, 300);

  setTimeout(() => {
    dom.bankerOfferDisplay.classList.remove('flip-anim');
    game.roundIndex++;
    const remainingUnopened = game.caseCount - 1 - game.openedCases.size;
    if (game.roundIndex >= game.schedule.length || remainingUnopened <= 1) {
      showFinalDecision();
    } else {
      game.state = 'playing';
      renderGrid();
      updateStatus();
    }
  }, 620);
}

/** Continues the hypothetical No Deal path after a player selects Let's See. */
function triggerHypotheticalOffer() {
  game.state = 'offer';
  renderGrid();
  dom.offerBackdrop.classList.add('show');
  showOffersPanel();

  dom.offerStatus.style.display = 'block';
  dom.offerStatus.textContent = 'The banker is calling...';
  dom.offerContent.style.display = 'none';
  dom.offerLabel.textContent = 'Your Offer Would Have Been...';
  dom.offerLabel.style.display = '';
  dom.revealOfferBtn.style.display = 'none';
  dom.revealOfferBtn.classList.remove('fade-in');
  dom.continuePlayoutBtn.style.display = 'none';
  dom.continuePlayoutBtn.classList.remove('fade-in');
  dom.bankerOfferDisplay.classList.remove('flip-anim', 'no-deal', 'counter-offer');
  dom.bankerOfferDisplay.textContent = '';
  dom.offerButtonsRow.style.display = 'none';
  dom.offerButtonsRow.classList.remove('fade-in');
  dom.counterLinkBtn.style.display = 'none';
  dom.offerModalEl.classList.add('banker-calling');
  dom.offerBackdrop.classList.add('calling-red');
  document.body.classList.add('calling-red-bg');
  dom.phoneIconEl.classList.add('calling');
  playBankerRing(2);

  setTimeout(() => {
    const hypoOffer = computeOffer();
    game.hypotheticalOffers.push({ round: game.roundIndex + 1, amount: hypoOffer });
    logEvent(`[Round ${game.roundIndex + 1}] Hypothetical offer (had you kept playing): <b>${fmt(hypoOffer)}</b>`);
    game.lastOffer = hypoOffer;
    game.revealMode = 'hypothetical';
    dom.offerModalEl.classList.remove('banker-calling');
    dom.phoneIconEl.classList.remove('calling');
    dom.offerStatus.style.display = 'none';
    dom.offerContent.style.display = 'block';
    dom.revealOfferBtn.style.display = '';
    dom.revealOfferBtn.classList.add('fade-in');
  }, 1400);
}
function finishPostDealPlayout() {
  game.state = 'revealing';
  renderGrid();
  const yourValue = game.amounts[game.caseAssignment[game.yourCase - 1]].value;
  const dealSound = yourValue <= game.dealTakenAmount ? 'good' : 'bad';
  let otherCase = null;
  for (let n = 1; n <= game.caseCount; n++) {
    if (n !== game.yourCase && !game.openedCases.has(n)) { otherCase = n; break; }
  }
  function openOtherCaseIfAny() {
    if (otherCase) {
      revealCaseAnimated(otherCase, 'Case #' + otherCase, (value, idx) => {
        game.amounts[idx].eliminated = true;
        game.openedCases.add(otherCase);
        eliminateBoardValue(idx);
        logUnopenedFinalCaseReveal(otherCase, value);
        endGame('deal');
      }, true);
    } else {
      endGame('deal');
    }
  }
  revealCaseAnimated(game.yourCase, 'Your Case', (value, idx) => {
    game.amounts[idx].eliminated = true;
    game.openedCases.add(game.yourCase);
    eliminateBoardValue(idx);
    logYourCaseReveal(game.yourCase, value);
    renderGrid();
    setTimeout(openOtherCaseIfAny, 300);
  }, true, null, dealSound);
}

/** Instantly finishes a Deal by opening only the player's own briefcase. */
function revealYourCaseAfterDeal() {
  game.state = 'revealing';
  renderGrid();
  const yourValue = game.amounts[game.caseAssignment[game.yourCase - 1]].value;
  const dealSound = yourValue <= game.dealTakenAmount ? 'good' : 'bad';
  revealCaseAnimated(game.yourCase, 'Your Case', (value, idx) => {
    game.amounts[idx].eliminated = true;
    game.openedCases.add(game.yourCase);
    eliminateBoardValue(idx);
    logYourCaseReveal(game.yourCase, value);
    endGame('deal');
  }, true, null, dealSound);
}

function logYourCaseReveal(caseNumber, value) {
  logEvent(`<b>Your Case Revealed</b> — Case #${caseNumber} held <b>${fmt(value)}</b>.`, 'deal');
}

function logUnopenedFinalCaseReveal(caseNumber, value) {
  logEvent(`<b>Unopened Final Case Revealed</b> — Case #${caseNumber} held <b>${fmt(value)}</b>.`);
}

// ---- Event listeners (wired up at module load) ----
dom.revealOfferBtn.addEventListener('click', () => {
  dom.revealOfferBtn.style.display = 'none';
  dom.offerLabel.style.display = 'none';
  if (game.revealMode === 'counterDecision') {
    revealCounterDecision();
    return;
  }
  dom.bankerOfferDisplay.classList.add('flip-anim');
  setTimeout(() => {
    dom.bankerOfferDisplay.textContent = fmtDisplayBoard(game.lastOffer);
  }, 300);
  setTimeout(() => {
    dom.bankerOfferDisplay.classList.remove('flip-anim');
    if (game.revealMode === 'hypothetical') {
      dom.offerLabel.textContent = 'Just something to think about...';
      dom.continuePlayoutBtn.style.display = '';
      dom.continuePlayoutBtn.classList.add('fade-in');
    } else {
      dom.offerButtonsRow.style.display = '';
      dom.offerButtonsRow.classList.add('fade-in');
      if (!game.counterOfferUsed) {
        dom.counterLinkBtn.style.display = '';
        dom.counterLinkBtn.classList.add('fade-in');
      }
    }
  }, 620);
});

dom.acknowledgeDealBtn.addEventListener('click', () => {
  dom.postDealActions.style.display = 'none';
  dom.postDealActions.classList.remove('fade-in');
  dom.offerBackdrop.classList.remove('show');
  const remainingUnopened = game.caseCount - 1 - game.openedCases.size;
  if (game.roundIndex >= game.schedule.length || remainingUnopened <= 1) {
    finishPostDealPlayout();
  } else {
    game.state = 'playing';
    renderGrid();
    updateStatus();
  }
});

dom.instantRevealBtn.addEventListener('click', () => {
  dom.postDealActions.style.display = 'none';
  dom.postDealActions.classList.remove('fade-in');
  dom.offerBackdrop.classList.remove('show');
  revealYourCaseAfterDeal();
});

dom.continuePlayoutBtn.addEventListener('click', () => {
  dom.offerBackdrop.classList.remove('show');
  dom.offerBackdrop.classList.remove('calling-red');
  document.body.classList.remove('calling-red-bg');
  game.roundIndex++;
  const remainingUnopened = game.caseCount - 1 - game.openedCases.size;
  if (game.roundIndex >= game.schedule.length || remainingUnopened <= 1) {
    finishPostDealPlayout();
  } else {
    game.state = 'playing';
    renderGrid();
    updateStatus();
  }
});

dom.dealBtn.addEventListener('click', () => acceptOffer(game.lastOffer));
dom.noDealBtn.addEventListener('click', declineOffer);


// ============================================
// Toolbar actions
// ============================================
function pulseGrid() {
  const cases = [...dom.caseGrid.querySelectorAll('.briefcase')];
  cases.forEach((el, i) => {
    setTimeout(() => {
      el.classList.add('pulse');
      setTimeout(() => el.classList.remove('pulse'), 350);
    }, i * 14);
  });
}

function flashBoard() {
  Object.values(game.boardRowEls).forEach((el, i) => {
    setTimeout(() => {
      el.classList.add('flash-reset');
      setTimeout(() => el.classList.remove('flash-reset'), 500);
    }, i * 18);
  });
}

// Expose flashBoard for prize-board module

dom.editToggle.addEventListener('click', () => {
  if (dom.editToggle.disabled || game.editMode) return;
  game.editMode = true;
  updateToolbar();
  renderBoard();
});

dom.saveValuesBtn.addEventListener('click', () => {
  document.querySelectorAll('#board .amount-row input').forEach(input => {
    const idx = parseInt(input.closest('.amount-row').dataset.idx, 10);
    const v = parseFloat(input.value);
    if (!isNaN(v) && v >= 0) {
      game.amounts[idx].value = v;
    }
  });
  game.editMode = false;
  updateToolbar();
  renderBoard();
});

dom.shuffleBtn.addEventListener('click', () => {
  if (dom.shuffleBtn.disabled) return;
  assignCases();
  renderAll();
  pulseGrid();
});

dom.resetValuesBtn.addEventListener('click', () => {
  if (dom.resetValuesBtn.disabled) return;
  game.amounts = getValuesForCount(game.caseCount).map(v => ({ value: v, eliminated: false }));
  renderBoard();
  flashBoard();
});


// ============================================
// Prize Board Selection
// ============================================
const PB_STORAGE_KEY = 'dnd_saved_boards';

function loadSavedBoards() {
  try {
    const saved = JSON.parse(lStorage.getItem(PB_STORAGE_KEY));
    if (Array.isArray(saved)) return saved;
  } catch (e) { /* check the legacy fallback key */ }
  try {
    const legacy = JSON.parse(lStorage.getItem('dnd_board_bg'));
    if (Array.isArray(legacy) && legacy.every(isValidSavedBoard)) {
      saveSavedBoards(legacy);
      lStorage.setItem('dnd_board_bg', 'default');
      return legacy;
    }
  } catch (e) { /* no legacy board data */ }
  return [];
}

function saveSavedBoards(list) {
  lStorage.setItem(PB_STORAGE_KEY, JSON.stringify(list));
}

function isValidSavedBoard(board) {
  return board && typeof board.name === 'string' && board.name.trim() &&
    Array.isArray(board.values) && board.values.length >= MIN_CASE_COUNT &&
    board.values.length <= MAX_CASE_COUNT &&
    board.values.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function boardsMatch(first, second) {
  return first.name === second.name && first.values.length === second.values.length &&
    first.values.every((value, index) => value === second.values[index]);
}

function exportSavedBoards() {
  const boards = loadSavedBoards();
  if (!boards.length) {
    logEvent('There are no saved prize boards to export.');
    return;
  }
  const blob = new Blob([JSON.stringify({ version: 1, boards }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'deal-or-no-deal-prize-boards.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importSavedBoards(file) {
  const parsed = JSON.parse(await file.text());
  const imported = Array.isArray(parsed) ? parsed : parsed?.boards;
  if (!Array.isArray(imported) || !imported.length || !imported.every(isValidSavedBoard)) {
    throw new Error('Invalid prize board file');
  }
  const existing = loadSavedBoards();
  const additions = imported
    .map(board => ({ name: board.name.trim(), values: [...board.values] }))
    .filter(board => !existing.some(saved => boardsMatch(saved, board)));
  saveSavedBoards([...existing, ...additions]);
  renderPbList();
  logEvent(additions.length
    ? `Imported ${additions.length} prize board${additions.length === 1 ? '' : 's'}.`
    : 'Those prize boards are already saved.');
}

function renderPbList() {
  const boards = loadSavedBoards();
  dom.pbList.innerHTML = '';
  if (boards.length === 0) {
    dom.pbList.innerHTML = '<div class="pb-empty">No saved boards yet.</div>';
    return;
  }
  boards.forEach((b, i) => {
    const item = document.createElement('div');
    item.className = 'pb-item';
    item.innerHTML = `<span><span class="pb-item-name">${b.name}</span><span class="pb-item-count">${b.values.length} values</span></span>`;
    const delBtn = document.createElement('button');
    delBtn.className = 'pb-item-delete';
    delBtn.textContent = '✕';
    delBtn.title = 'Delete';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const boards2 = loadSavedBoards();
      boards2.splice(i, 1);
      saveSavedBoards(boards2);
      renderPbList();
    });
    item.appendChild(delBtn);
    item.addEventListener('click', () => {
      game.caseCount = b.values.length;
      game.nextCaseCount = game.caseCount;
      dom.caseCountInput.value = game.caseCount;
      game.amounts = b.values.map(v => ({ value: v, eliminated: false }));
      game.schedule = buildSchedule(game.caseCount);
      resetEliminatedFlags();
      assignCases();
      renderAll();
      flashBoard();
      dom.pbSelectPanel.style.display = 'none';
      logEvent(`Loaded prize board: <b>${b.name}</b> (${b.values.length} values).`);
    });
    dom.pbList.appendChild(item);
  });
}

dom.pbSelectBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const visible = dom.pbSelectPanel.style.display !== 'none';
  dom.pbSelectPanel.style.display = visible ? 'none' : 'flex';
  if (!visible) renderPbList();
});

dom.closePbSelectBtn.addEventListener('click', () => {
  dom.pbSelectPanel.style.display = 'none';
});

dom.pbExportBtn.addEventListener('click', exportSavedBoards);
dom.pbImportBtn.addEventListener('click', () => dom.pbImportFile.click());
dom.pbImportFile.addEventListener('change', async () => {
  const file = dom.pbImportFile.files[0];
  if (!file) return;
  try {
    await importSavedBoards(file);
  } catch (e) {
    logEvent('Could not import that file. Choose a valid prize-board export.');
  } finally {
    dom.pbImportFile.value = '';
  }
});

dom.boardSaveBtn.addEventListener('click', () => {
  dom.pbSaveName.value = '';
  dom.pbSelectPanel.style.display = 'flex';
  renderPbList();
  dom.pbSaveName.focus();
});

dom.pbSaveConfirmBtn.addEventListener('click', () => {
  const name = dom.pbSaveName.value.trim();
  if (!name) {
    dom.pbSaveName.focus();
    return;
  }
  const currentValues = game.amounts.map(a => a.value);
  const boards = loadSavedBoards();
  boards.push({ name, values: currentValues });
  saveSavedBoards(boards);
  dom.pbSaveName.value = '';
  renderPbList();
  logEvent(`Saved prize board: <b>${name}</b> (${currentValues.length} values).`);
});

dom.pbSaveName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') dom.pbSaveConfirmBtn.click();
});


// ============================================
// Settings gear
// ============================================
dom.settingsGear.addEventListener('click', (e) => {
  e.stopPropagation();
  dom.settingsPanel.style.display = dom.settingsPanel.style.display === 'none' ? 'grid' : 'none';
});

dom.closeSettingsBtn.addEventListener('click', () => {
  dom.settingsPanel.style.display = 'none';
});

// ---- Settings persistence (localStorage) ----
const STORAGE_KEY = 'freebuff-settings';

function saveSettings() {
  const settings = {
    manualOpenMode: game.manualOpenMode,
    nightVisionMode: game.nightVisionMode,
    showCurrencyBoard: game.showCurrencyBoard,
    showCurrencyBriefcase: game.showCurrencyBriefcase,
    hideOpenedCases: game.hideOpenedCases,
    gameLogEnabled: game.gameLogEnabled,
    caseCount: game.caseCount,
    sfxEnabled: game.sfxEnabled,
    sfxVolumePercent: game.sfxVolumePercent,
  };
  try {
    lStorage.setItem('freebuff-settings', JSON.stringify(settings));
    logEvent('Settings saved.');
  } catch (e) { /* ignore */ }
}

function loadSettings() {
  try {
    const raw = lStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.manualOpenMode === 'boolean') {
      game.manualOpenMode = s.manualOpenMode;
      dom.manualModeToggle.checked = s.manualOpenMode;
    }
    if (typeof s.nightVisionMode === 'boolean') {
      game.nightVisionMode = s.nightVisionMode;
      dom.nightVisionToggle.checked = s.nightVisionMode;
    }
    if (typeof s.showCurrencyBoard === 'boolean') {
      game.showCurrencyBoard = s.showCurrencyBoard;
      dom.currencyBoardToggle.checked = s.showCurrencyBoard;
    }
    if (typeof s.showCurrencyBriefcase === 'boolean') {
      game.showCurrencyBriefcase = s.showCurrencyBriefcase;
      dom.currencyBriefcaseToggle.checked = s.showCurrencyBriefcase;
    }
    if (typeof s.hideOpenedCases === 'boolean') {
      game.hideOpenedCases = s.hideOpenedCases;
      dom.hideOpenedCasesToggle.checked = s.hideOpenedCases;
    }
    if (typeof s.gameLogEnabled === 'boolean') {
      game.gameLogEnabled = s.gameLogEnabled;
      dom.gameLogEnabledToggle.checked = s.gameLogEnabled;
    }
    if (typeof s.caseCount === 'number' && s.caseCount >= 4 && s.caseCount <= 26) {
      game.caseCount = s.caseCount;
      game.nextCaseCount = s.caseCount;
      dom.caseCountInput.value = s.caseCount;
    }
    if (typeof s.sfxEnabled === 'boolean') {
      game.sfxEnabled = s.sfxEnabled;
      dom.soundToggle.checked = s.sfxEnabled;
    }
    if (typeof s.sfxVolumePercent === 'number' && s.sfxVolumePercent >= 0 && s.sfxVolumePercent <= 200) {
      game.sfxVolumePercent = s.sfxVolumePercent;
      dom.sfxVolumeInput.value = s.sfxVolumePercent;
    }
  } catch (e) { /* ignore */ }
  applySfxLevel();
}

dom.saveSettingsBtn.addEventListener('click', () => {
  saveSettings();
  dom.settingsPanel.style.display = 'none';
});

// Load on startup
loadSettings();
applyGameLogVisibility();

dom.gameLogHeader.addEventListener('click', () => {
  dom.gameLogPanel.classList.toggle('collapsed');
});

dom.manualModeToggle.addEventListener('change', () => {
  game.manualOpenMode = dom.manualModeToggle.checked;
});

dom.nightVisionToggle.addEventListener('change', () => {
  game.nightVisionMode = dom.nightVisionToggle.checked;
  renderGrid();
});

dom.currencyBoardToggle.addEventListener('change', () => {
  game.showCurrencyBoard = dom.currencyBoardToggle.checked;
  refreshCurrencyDisplay();
});

dom.currencyBriefcaseToggle.addEventListener('change', () => {
  game.showCurrencyBriefcase = dom.currencyBriefcaseToggle.checked;
  refreshCurrencyDisplay();
});  dom.hideOpenedCasesToggle.addEventListener('change', () => {
  game.hideOpenedCases = dom.hideOpenedCasesToggle.checked;
  renderGrid();
  renderYourCase();
});

dom.gameLogEnabledToggle.addEventListener('change', () => {
  game.gameLogEnabled = dom.gameLogEnabledToggle.checked;
  applyGameLogVisibility();
});

/** Shows/hides the bottom-right log panel to match the current setting. */
function applyGameLogVisibility() {
  dom.gameLogPanel.style.display = game.gameLogEnabled === false ? 'none' : '';
}

dom.soundToggle.addEventListener('change', () => {
  game.sfxEnabled = dom.soundToggle.checked;
  applySfxLevel();
});

dom.sfxVolumeInput.addEventListener('input', () => {
  game.sfxVolumePercent = parseInt(dom.sfxVolumeInput.value, 10) || 0;
  applySfxLevel();
});

dom.applyCaseCountBtn.addEventListener('click', () => {
  const n = parseInt(dom.caseCountInput.value, 10);
  if (isNaN(n) || n < MIN_CASE_COUNT || n > MAX_CASE_COUNT) {
    dom.caseCountInput.value = game.caseCount;
    logEvent(`Invalid case count — use <b>${MIN_CASE_COUNT}–${MAX_CASE_COUNT}</b>.`);
    return;
  }
  if (n === game.caseCount) {
    dom.settingsPanel.style.display = 'none';
    return;
  }
  game.nextCaseCount = n;
  dom.caseCountInput.value = n;
  dom.settingsPanel.style.display = 'none';
  newGame();
});

document.addEventListener('click', (e) => {
  if (dom.settingsPanel.style.display !== 'none' &&
      !dom.settingsPanel.contains(e.target) &&
      e.target !== dom.settingsGear) {
    dom.settingsPanel.style.display = 'none';
  }
  if (dom.pbSelectPanel.style.display !== 'none' &&
      e.target !== dom.pbSelectBtn &&
      e.target !== dom.boardSaveBtn &&
      !dom.pbSelectPanel.querySelector('.pb-select-card').contains(e.target)) {
    dom.pbSelectPanel.style.display = 'none';
  }
  if (dom.bgPickerPanel.style.display !== 'none' &&
      e.target !== dom.bgPickerBtn &&
      !dom.bgPickerPanel.querySelector('.bg-picker-card').contains(e.target)) {
    dom.bgPickerPanel.style.display = 'none';
  }
});


// ============================================
// Suggest: Random Elimination Order
// ============================================
function generateSuggestion() {
  dom.suggestBody.innerHTML = '';
  // Pick a random case as 'Your Case'
  const suggestedCase = Math.floor(Math.random() * game.caseCount) + 1;
  // Your Case display
  const ycDiv = document.createElement('div');
  ycDiv.className = 'suggest-your-case';
  ycDiv.innerHTML = `<div class="suggest-your-case-title">Your Case</div><div class="suggest-cases"><span class="suggest-case yc">#${suggestedCase}</span></div>`;
  dom.suggestBody.appendChild(ycDiv);
  // Build a shuffled pool of all case numbers except the suggested case
  const pool = [];
  for (let n = 1; n <= game.caseCount; n++) {
    if (n !== suggestedCase) pool.push(n);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Distribute cases round by round according to the schedule
  let idx = 0;
  game.schedule.forEach((opens, round) => {
    const roundDiv = document.createElement('div');
    roundDiv.className = 'suggest-round';
    const title = document.createElement('div');
    title.className = 'suggest-round-title';
    title.textContent = `Round ${round + 1} — Open ${opens} case${opens > 1 ? 's' : ''}`;
    roundDiv.appendChild(title);
    const casesDiv = document.createElement('div');
    casesDiv.className = 'suggest-cases';
    for (let i = 0; i < opens && idx < pool.length; i++, idx++) {
      const chip = document.createElement('span');
      chip.className = 'suggest-case';
      chip.textContent = '#' + pool[idx];
      casesDiv.appendChild(chip);
    }
    roundDiv.appendChild(casesDiv);
    dom.suggestBody.appendChild(roundDiv);
  });

  // Random Deal or No Deal decision
  const willDeal = Math.random() < 0.5;
  const decisionDiv = document.createElement('div');
  decisionDiv.className = 'suggest-decision' + (willDeal ? ' deal' : ' no-deal');
  decisionDiv.innerHTML = `
    <div class="suggest-decision-title">Decision</div>
    <div class="suggest-decision-value">${willDeal ? 'DEAL' : 'NO DEAL'}</div>
  `;
  dom.suggestBody.appendChild(decisionDiv);
}

dom.suggestBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const visible = dom.suggestPanel.style.display !== 'none';
  dom.suggestPanel.style.display = visible ? 'none' : 'flex';
  if (!visible && dom.suggestBody.children.length === 0) generateSuggestion();
});dom.suggestRegenBtn.addEventListener('click', generateSuggestion);

dom.closeSuggestBtn.addEventListener('click', () => {
  dom.suggestPanel.style.display = 'none';
});

// ---- Boot ----
dom.caseCountInput.value = dom.caseCountInput.defaultValue;
initValues();
newGame();
})();
