// ============================================
// Counter Offer
// ============================================
import { game, dom } from './game.js?v=100';
import { fmt, fmtDisplayBoard, logEvent } from './helpers.js?v=101';
import { renderGrid } from './render.js?v=102';
import { updateStatus } from './center-stage.js?v=103';
import { acceptOffer, renderOffersHistory, showFinalDecision } from './banker.js?v=106';

export function revealCounterDecision() {
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
