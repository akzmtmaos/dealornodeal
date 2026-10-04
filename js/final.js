// ============================================
// Final Decision
// ============================================
import { game, dom } from './game.js?v=100';
import { logEvent, fmt } from './helpers.js?v=101';
import { renderGrid, eliminateBoardValue } from './render.js?v=102';
import { revealCaseAnimated } from './center-stage.js?v=103';
import { endGame } from './end.js?v=115';

export function showFinalDecision() {
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
