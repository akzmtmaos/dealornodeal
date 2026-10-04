// ============================================
// Helpers — formatting, logging, value checks
// ============================================
import { game, dom, STANDARD_VALUES } from './game.js?v=100';

export function formatNumber(v) {
  if (v < 1) return v.toFixed(2).replace(/^0(?=\.)/, '');
  return Math.round(v).toLocaleString('en-US');
}

export function fmt(v) {
  return '$' + formatNumber(v);
}

/** Prize board + banker offer amounts — respects the board currency setting. */
export function fmtDisplayBoard(v) {
  const n = formatNumber(v);
  return game.showCurrencyBoard ? '$' + n : n;
}

/** Briefcase amounts — respects the briefcase currency setting. */
export function fmtDisplayBriefcase(v) {
  const n = formatNumber(v);
  return game.showCurrencyBriefcase ? '$' + n : n;
}

export function setBriefcaseAmount(el, value) {
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
export function logEvent(html, type) {
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

export function resetGameLog() {
  game.gameLog = [];
  if (game.gameLogEnabled === false) return;
  dom.gameLogList.innerHTML = '<div class="game-log-empty">No activity yet.</div>';
}

export function logYourCaseReveal(caseNumber, value) {
  logEvent(`<b>Your Case Revealed</b> — Case #${caseNumber} held <b>${fmt(value)}</b>.`, 'deal');
}

export function logUnopenedFinalCaseReveal(caseNumber, value) {
  logEvent(`<b>Unopened Final Case Revealed</b> — Case #${caseNumber} held <b>${fmt(value)}</b>.`);
}

export function triggerDangerFlash() {
  dom.dangerFlash.classList.remove('pulse', 'pulse-yellow');
  void dom.dangerFlash.offsetWidth;
  dom.dangerFlash.classList.add('pulse');
}

export function triggerYellowFlash() {
  dom.dangerFlash.classList.remove('pulse', 'pulse-yellow');
  void dom.dangerFlash.offsetWidth;
  dom.dangerFlash.classList.add('pulse-yellow');
}

/** Picks `n` dollar tiers spread across the classic 26-value ladder. */
export function getValuesForCount(n) {
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
export function buildSchedule(count) {
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
export function getCaseGridRows(count) {
  if (count === 20) {
    return [
      { start: 17, count: 4, align: 'flush' }, // row 1: 17, 18, 19, 20 (matches row 4 alignment)
      { start: 12, count: 5, align: 'flush' }, // row 2: 12, 13, 14, 15, 16 (flush left, untouched)
      { start: 7, count: 5, align: 'flush' },  // row 3: 7, 8, 9, 10, 11 (matches row 4 alignment)
      { start: 1, count: 6, align: 'flush' },  // row 4: 1, 2, 3, 4, 5, 6 (flush left)
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

export function isBigValue(v) {
  return v >= 100000;
}

/** Check if v is the highest value still in play (not eliminated). */
export function isHighestRemaining(v) {
  const remaining = game.amounts.filter(a => !a.eliminated).map(a => a.value);
  if (!remaining.length) return false;
  const maxVal = Math.max(...remaining);
  return v === maxVal;
}

export function isLowValue(v) {
  // Good-news tier: everything below the $100K danger line.
  return v < 100000;
}

export function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function remainingAmountValues() {
  return game.amounts.filter(a => !a.eliminated).map(a => a.value);
}
