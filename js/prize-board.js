// ============================================
// Prize Board Selection
// ============================================
import { game, dom, MIN_CASE_COUNT, MAX_CASE_COUNT } from './game.js?v=100';
import { buildSchedule, logEvent } from './helpers.js?v=101';
import { renderAll } from './render.js?v=102';
import { flashBoard } from './toolbar.js?v=111';
import { resetEliminatedFlags, assignCases } from './init.js?v=109';

const PB_STORAGE_KEY = 'dnd_saved_boards';
const pbExportBtn = document.getElementById('pbExportBtn');
const pbImportBtn = document.getElementById('pbImportBtn');
const pbImportFile = document.getElementById('pbImportFile');

function loadSavedBoards() {
  try {
    const saved = JSON.parse(localStorage.getItem(PB_STORAGE_KEY));
    if (Array.isArray(saved)) return saved;
  } catch (e) { /* check the legacy fallback key */ }
  try {
    const legacy = JSON.parse(localStorage.getItem('dnd_board_bg'));
    if (Array.isArray(legacy) && legacy.every(isValidSavedBoard)) {
      saveSavedBoards(legacy);
      localStorage.setItem('dnd_board_bg', 'default');
      return legacy;
    }
  } catch (e) { /* no legacy board data */ }
  return [];
}

function saveSavedBoards(list) {
  localStorage.setItem(PB_STORAGE_KEY, JSON.stringify(list));
}

function isValidSavedBoard(board) {
  return board && typeof board.name === 'string' && board.name.trim() &&
    Array.isArray(board.values) && board.values.length >= MIN_CASE_COUNT &&
    board.values.length <= MAX_CASE_COUNT &&
    board.values.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function boardsMatch(first, second) {
  return first.name === second.name && first.values.length === second.values.length &&
    first.values.every((value, index) => value === second.values[index]);
}

function exportSavedBoards() {
  const boards = loadSavedBoards();
  if (!boards.length) {
    logEvent('There are no saved prize boards to export.');
    return;
  }
  const blob = new Blob([JSON.stringify({ version: 1, boards }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'deal-or-no-deal-prize-boards.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importSavedBoards(file) {
  const parsed = JSON.parse(await file.text());
  const imported = Array.isArray(parsed) ? parsed : parsed?.boards;
  if (!Array.isArray(imported) || !imported.length || !imported.every(isValidSavedBoard)) {
    throw new Error('Invalid prize board file');
  }
  const existing = loadSavedBoards();
  const additions = imported
    .map(board => ({ name: board.name.trim(), values: [...board.values] }))
    .filter(board => !existing.some(saved => boardsMatch(saved, board)));
  saveSavedBoards([...existing, ...additions]);
  renderPbList();
  logEvent(additions.length
    ? `Imported ${additions.length} prize board${additions.length === 1 ? '' : 's'}.`
    : 'Those prize boards are already saved.');
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

pbExportBtn.addEventListener('click', exportSavedBoards);
pbImportBtn.addEventListener('click', () => pbImportFile.click());
pbImportFile.addEventListener('change', async () => {
  const file = pbImportFile.files[0];
  if (!file) return;
  try {
    await importSavedBoards(file);
  } catch (e) {
    logEvent('Could not import that file. Choose a valid prize-board export.');
  } finally {
    pbImportFile.value = '';
  }
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
