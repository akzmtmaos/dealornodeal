// ============================================
// Init / New Game
// ============================================
import { game, dom } from './game.js?v=100';
import { getValuesForCount, buildSchedule, shuffleArr, logEvent, resetGameLog } from './helpers.js?v=101';
import { renderAll, renderGrid, renderBoard, updateToolbar } from './render.js?v=102';
import { renderOffersHistory } from './banker.js?v=106';
import { hideAll } from './center-stage.js?v=103';

export function initValues() {
  game.amounts = getValuesForCount(game.caseCount).map(v => ({ value: v, eliminated: false }));
  game.schedule = buildSchedule(game.caseCount);
}

export function resetEliminatedFlags() {
  game.amounts.forEach(a => { a.eliminated = false; });
}

export function assignCases() {
  game.caseAssignment = shuffleArr([...Array(game.caseCount).keys()]);
}

export function newGame() {
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
