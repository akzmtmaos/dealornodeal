// ============================================
// Suggest: Random Elimination Order
// ============================================
import { game, dom } from './game.js?v=100';

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
});

dom.suggestRegenBtn.addEventListener('click', generateSuggestion);

dom.closeSuggestBtn.addEventListener('click', () => {
  dom.suggestPanel.style.display = 'none';
});
