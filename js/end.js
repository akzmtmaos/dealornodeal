// ============================================
// End Game
// ============================================
import { game, dom } from './game.js?v=100';
import { fmt } from './helpers.js?v=101';
import { renderAll } from './render.js?v=102';
import { triggerDangerFlash } from './helpers.js?v=101';
import { newGame } from './init.js?v=109';

export function endGame(mode, chosenCase, otherCase) {
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
