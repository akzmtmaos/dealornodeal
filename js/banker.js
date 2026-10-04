// ============================================
// Banker Offer
// ============================================
import { game, dom } from './game.js?v=100';
import { fmt, fmtDisplayBoard, logEvent, remainingAmountValues } from './helpers.js?v=101';
import { renderGrid, renderAll, eliminateBoardValue } from './render.js?v=102';
import { revealCaseAnimated, updateStatus, hideAll } from './center-stage.js?v=103';
import { showFinalDecision } from './final.js?v=114';
import { endGame } from './end.js?v=115';
import { revealCounterDecision } from './counter.js?v=107';
import { playBankerRing } from './sound.js?v=105';

// Re-export for counter.js, which (like the original monolith) reaches the
// final-decision screen through the banker module.
export { showFinalDecision };

function setCustomBankOfferVisible(visible) {
  dom.customBankOfferWrap.classList.toggle('visible', visible);
  if (!visible) {
    dom.customBankOfferWrap.classList.remove('active');
    dom.customBankOfferInput.value = '';
    dom.customBankOfferInput.style.display = 'none';
  }
}

export function computeOffer() {
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

export function triggerBankerOffer() {
  game.state = 'offer';
  renderGrid();
  dom.statusLine.innerHTML = 'The banker is on the line...';
  dom.offerBackdrop.classList.add('show');
  setCustomBankOfferVisible(true);
  showOffersPanel();

  dom.offerStatus.style.display = 'block';
  dom.offerStatus.textContent = 'The banker is calling...';
  dom.offerContent.style.display = 'none';
  dom.offerLabel.textContent = 'The Banker Is Offering You...';
  dom.offerLabel.style.display = '';
  game.revealMode = 'real';
  dom.revealOfferBtn.style.display = 'none';
  dom.revealOfferBtn.classList.remove('fade-in');
  dom.continuePlayoutBtn.style.display = 'none';
  dom.continuePlayoutBtn.classList.remove('fade-in');
  dom.bankerOfferDisplay.classList.remove('flip-anim', 'no-deal', 'counter-offer');
  dom.bankerOfferDisplay.textContent = '';
  dom.counterStatus.style.display = 'none';
  dom.counterPanel.style.display = 'none';
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
  }, 1400);
}

export function renderOffersHistory() {
  dom.offersList.innerHTML = '';
  game.offerHistory.forEach((entry, i) => {
    const chip = document.createElement('div');
    chip.className = 'offer-chip offer-sequence-item' + (i === game.offerHistory.length - 1 ? ' latest' : '');
    chip.style.setProperty('--offer-sequence-delay', `${i * 120}ms`);
    chip.innerHTML = `<span class="oc-amount">${fmt(entry.amount)}</span>`;
    dom.offersList.appendChild(chip);
  });
}

export function showOffersPanel() {
  renderOffersHistory();
  dom.offersPanel.style.display = game.offerHistory.length > 0 ? 'block' : 'none';
}

export function hideOffersPanel() {
  dom.offersPanel.style.display = 'none';
}

export function acceptOffer(amount) {
  game.lastOffer = amount;
  game.dealTakenAmount = amount;
  game.postDealMode = true;
  game.hypotheticalOffers = [];
  hideOffersPanel();
  logEvent(`[Round ${game.roundIndex + 1}] <b>DEAL!</b> Accepted the banker's offer of ${fmt(amount)}.`, 'deal');
  dom.offerBackdrop.classList.remove('show');
  setCustomBankOfferVisible(false);
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

export function declineOffer() {
  hideOffersPanel();
  dom.offerBackdrop.classList.remove('show');
  setCustomBankOfferVisible(false);
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
export function triggerHypotheticalOffer() {
  game.state = 'offer';
  renderGrid();
  dom.offerBackdrop.classList.add('show');
  setCustomBankOfferVisible(true);
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

export function finishPostDealPlayout() {
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
export function revealYourCaseAfterDeal() {
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
  setCustomBankOfferVisible(false);
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
  setCustomBankOfferVisible(false);
  revealYourCaseAfterDeal();
});

dom.continuePlayoutBtn.addEventListener('click', () => {
  dom.offerBackdrop.classList.remove('show');
  setCustomBankOfferVisible(false);
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
