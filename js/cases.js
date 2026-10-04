// ============================================
// Case click logic
// ============================================
import { game, dom } from './game.js?v=100';
import { fmt, logEvent } from './helpers.js?v=101';
import { renderGrid, renderYourCase, renderAll, eliminateBoardValue } from './render.js?v=102';
import { revealCaseAnimated, finishPendingReveal, CONTINUE_PAUSE_MS } from './center-stage.js?v=103';
import { triggerBankerOffer, triggerHypotheticalOffer } from './banker.js?v=106';
import { updateStatus } from './center-stage.js?v=103';

export function onCaseClick(n) {
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
