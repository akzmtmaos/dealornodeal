// ============================================
// Toolbar actions
// ============================================
import { game, dom } from './game.js?v=100';
import { getValuesForCount } from './helpers.js?v=101';
import { renderBoard, renderAll, updateToolbar } from './render.js?v=102';
import { assignCases } from './init.js?v=109';

function pulseGrid() {
  const cases = [...dom.caseGrid.querySelectorAll('.briefcase')];
  cases.forEach((el, i) => {
    setTimeout(() => {
      el.classList.add('pulse');
      setTimeout(() => el.classList.remove('pulse'), 350);
    }, i * 14);
  });
}

function flashBoard() {
  Object.values(game.boardRowEls).forEach((el, i) => {
    setTimeout(() => {
      el.classList.add('flash-reset');
      setTimeout(() => el.classList.remove('flash-reset'), 500);
    }, i * 18);
  });
}

// Expose flashBoard for prize-board module
export { flashBoard };

dom.editToggle.addEventListener('click', () => {
  if (dom.editToggle.disabled || game.editMode) return;
  game.editMode = true;
  updateToolbar();
  renderBoard();
});

dom.saveValuesBtn.addEventListener('click', () => {
  document.querySelectorAll('#board .amount-row input').forEach(input => {
    const idx = parseInt(input.closest('.amount-row').dataset.idx, 10);
    const v = parseFloat(input.value);
    if (!isNaN(v) && v >= 0) {
      game.amounts[idx].value = v;
    }
  });
  game.editMode = false;
  updateToolbar();
  renderBoard();
});

dom.shuffleBtn.addEventListener('click', () => {
  if (dom.shuffleBtn.disabled) return;
  assignCases();
  renderAll();
  pulseGrid();
});

dom.resetValuesBtn.addEventListener('click', () => {
  if (dom.resetValuesBtn.disabled) return;
  game.amounts = getValuesForCount(game.caseCount).map(v => ({ value: v, eliminated: false }));
  renderBoard();
  flashBoard();
});
