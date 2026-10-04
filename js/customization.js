// ============================================
// Customization Picker (case interior + board value backgrounds)
// ============================================
import { game, dom } from './game.js?v=100';
import { formatNumber } from './helpers.js?v=101';
import { renderBoard } from './render.js?v=102';

/* ---------- Case Interior Background ---------- */
const BG_OPTIONS = [
  { id: 'default', label: 'Hex Pattern', class: '', swatch: 'linear-gradient(135deg,#000 0%,#161616 100%)' },
  { id: 'usgrid', label: 'US Style', class: 'interior-usgrid', swatch: 'linear-gradient(135deg,#4c525a 30%,#4a4342 30%,#4a4342 70%,#4c525a 70%)' },
];

let currentBgId = localStorage.getItem('dnd_interior_bg') || 'default';

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

let currentBoardBgId = localStorage.getItem('dnd_board_bg') || 'default';

/** Returns the active prize-board background id ('default', 'squares', ...). */
export function getBoardBgId() {
  return currentBoardBgId;
}

/** Returns the active case-interior background id ('default', 'usgrid', ...). */
export function getInteriorBgId() {
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

export function wrapValueSquares(el, pad) {
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
export function initOfferTileSquares() {
  if (!dom.bankerOfferDisplay) return;
  offerSquareObserver.observe(dom.bankerOfferDisplay, { childList: true, characterData: true, subtree: true });
  renderOfferTileSquares();
}

function applyBoardBg(bgId) {
  const opt = BOARD_BG_OPTIONS.find(o => o.id === bgId);
  if (!opt) return;
  const changed = bgId !== currentBoardBgId;
  currentBoardBgId = bgId;
  localStorage.setItem('dnd_board_bg', bgId);
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
export function applyInteriorAmountStyling(el) {
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

export function applyInteriorBg(bgId) {
  const opt = BG_OPTIONS.find(o => o.id === bgId);
  if (!opt) return;
  currentBgId = bgId;
  localStorage.setItem('dnd_interior_bg', bgId);
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
