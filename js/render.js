// ============================================
// Rendering
// ============================================
import { game, dom } from './game.js?v=100';
import { fmtDisplayBoard, fmtDisplayBriefcase, getCaseGridRows, formatNumber, setBriefcaseAmount } from './helpers.js?v=101';
import { onCaseClick } from './cases.js?v=108';
import { applyInteriorBg, getInteriorBgId, getBoardBgId, applyInteriorAmountStyling, wrapValueSquares } from './customization.js?v=104';
import { boardEliminateSound } from './sound.js?v=105';

export function renderAll() {
  renderGrid();
  renderBoard();
  renderYourCase();
  updateToolbar();
}

export function refreshCurrencyDisplay() {
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

export function renderYourCase() {
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

export function caseInnerMarkup(n) {
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

export function renderGrid() {
  dom.caseGrid.innerHTML = '';
  dom.caseGrid.classList.toggle('grid-20', game.caseCount === 20);
  getCaseGridRows(game.caseCount).forEach((cfg, rowIndex) => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'case-row' + (cfg.align ? ' ' + cfg.align : '');

    if (rowIndex === 0) {
      const topShelfA = document.createElement('div');
      topShelfA.className = 'case-shelf-top';
      rowDiv.appendChild(topShelfA);

      const topShelfB = document.createElement('div');
      topShelfB.className = 'case-shelf-top secondary-top-shelf';
      rowDiv.appendChild(topShelfB);
    }

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

    const backShelf = document.createElement('div');
    backShelf.className = 'case-shelf-back';
    rowDiv.appendChild(backShelf);

    dom.caseGrid.appendChild(rowDiv);
  });
  // Re-apply the current interior background to newly created case-interior elements
  applyInteriorBg(getInteriorBgId());
}

export function renderBoard() {
  dom.boardColLow.innerHTML = '';
  dom.boardColHigh.innerHTML = '';
  const boardEl = dom.boardColLow.closest('.board');
  const boardSquareWidth = Math.max(7, ...game.amounts.map(({ value }) =>
    formatNumber(value).replace(/,/g, '').length
  ));
  boardEl.classList.toggle('board-squares-wide', boardSquareWidth > 7);
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
      row.querySelector('.removed-value')?.classList.add('visible');
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
export function eliminateBoardValue(idx) {
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

export function updateToolbar() {
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
export function flashTableShelves(value) {
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

export function clearShelfFlash() {
  dom.caseGrid.classList.remove('shelf-red-all', 'shelf-flash-yellow');
  clearTimeout(shelfFlashTimer);
}
