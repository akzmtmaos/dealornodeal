// ============================================
// Prize Board Selection
// ============================================
import { game, dom } from './game.js?v=100';
import { buildSchedule, logEvent } from './helpers.js?v=101';
import { renderAll } from './render.js?v=102';
import { flashBoard } from './toolbar.js?v=111';
import { resetEliminatedFlags, assignCases } from './init.js?v=109';

const PB_STORAGE_KEY = 'dnd_saved_boards';

function loadSavedBoards() {
  try { return JSON.parse(localStorage.getItem(PB_STORAGE_KEY)) || []; }
  catch (e) { return []; }
}

function saveSavedBoards(list) {
  localStorage.setItem(PB_STORAGE_KEY, JSON.stringify(list));
}

function renderPbList() {
  const boards = loadSavedBoards();
  dom.pbList.innerHTML = '';
  if (boards.length === 0) {
    dom.pbList.innerHTML = '<div class="pb-empty">No saved boards yet.</div>';
    return;
  }
  boards.forEach((b, i) => {
    const item = document.createElement('div');
    item.className = 'pb-item';
    item.innerHTML = `<span><span class="pb-item-name">${b.name}</span><span class="pb-item-count">${b.values.length} values</span></span>`;
    const delBtn = document.createElement('button');
    delBtn.className = 'pb-item-delete';
    delBtn.textContent = '✕';
    delBtn.title = 'Delete';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const boards2 = loadSavedBoards();
      boards2.splice(i, 1);
      saveSavedBoards(boards2);
      renderPbList();
    });
    item.appendChild(delBtn);
    item.addEventListener('click', () => {
      game.caseCount = b.values.length;
      game.nextCaseCount = game.caseCount;
      dom.caseCountInput.value = game.caseCount;
      game.amounts = b.values.map(v => ({ value: v, eliminated: false }));
      game.schedule = buildSchedule(game.caseCount);
      resetEliminatedFlags();
      assignCases();
      renderAll();
      flashBoard();
      dom.pbSelectPanel.style.display = 'none';
      logEvent(`Loaded prize board: <b>${b.name}</b> (${b.values.length} values).`);
    });
    dom.pbList.appendChild(item);
  });
}

dom.pbSelectBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const visible = dom.pbSelectPanel.style.display !== 'none';
  dom.pbSelectPanel.style.display = visible ? 'none' : 'flex';
  if (!visible) renderPbList();
});

dom.closePbSelectBtn.addEventListener('click', () => {
  dom.pbSelectPanel.style.display = 'none';
});

dom.boardSaveBtn.addEventListener('click', () => {
  dom.pbSaveName.value = '';
  dom.pbSelectPanel.style.display = 'flex';
  renderPbList();
  dom.pbSaveName.focus();
});

dom.pbSaveConfirmBtn.addEventListener('click', () => {
  const name = dom.pbSaveName.value.trim();
  if (!name) {
    dom.pbSaveName.focus();
    return;
  }
  const currentValues = game.amounts.map(a => a.value);
  const boards = loadSavedBoards();
  boards.push({ name, values: currentValues });
  saveSavedBoards(boards);
  dom.pbSaveName.value = '';
  renderPbList();
  logEvent(`Saved prize board: <b>${name}</b> (${currentValues.length} values).`);
});

dom.pbSaveName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') dom.pbSaveConfirmBtn.click();
});
