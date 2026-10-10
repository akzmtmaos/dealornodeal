// ============================================
// Settings gear
// ============================================
import { game, dom } from './game.js?v=100';
import { MIN_CASE_COUNT, MAX_CASE_COUNT } from './game.js?v=100';
import { logEvent, fmtDisplayBoard } from './helpers.js?v=101';
import { renderGrid, renderYourCase } from './render.js?v=102';
import { refreshCurrencyDisplay } from './render.js?v=102';
import { applySfxLevel } from './sound.js?v=105';
import { newGame } from './init.js?v=109';

dom.settingsGear.addEventListener('click', (e) => {
  e.stopPropagation();
  dom.settingsPanel.style.display = dom.settingsPanel.style.display === 'none' ? 'grid' : 'none';
});

dom.closeSettingsBtn.addEventListener('click', () => {
  dom.settingsPanel.style.display = 'none';
});

// ---- Settings persistence (localStorage) ----
const STORAGE_KEY = 'freebuff-settings';

function saveSettings() {
  const settings = {
    manualOpenMode: game.manualOpenMode,
    hostMode: game.hostMode,
    nightVisionMode: game.nightVisionMode,
    showCurrencyBoard: game.showCurrencyBoard,
    showCurrencyBriefcase: game.showCurrencyBriefcase,
    hideOpenedCases: game.hideOpenedCases,
    gameLogEnabled: game.gameLogEnabled,
    caseCount: game.caseCount,
    sfxEnabled: game.sfxEnabled,
    sfxVolumePercent: game.sfxVolumePercent,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    logEvent('Settings saved.');
  } catch (e) { /* ignore */ }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.manualOpenMode === 'boolean') {
      game.manualOpenMode = s.manualOpenMode;
      dom.manualModeToggle.checked = s.manualOpenMode;
    }
    if (typeof s.hostMode === 'boolean') {
      game.hostMode = s.hostMode;
      dom.hostModeToggle.checked = s.hostMode;
    }
    if (typeof s.nightVisionMode === 'boolean') {
      game.nightVisionMode = s.nightVisionMode;
      dom.nightVisionToggle.checked = s.nightVisionMode;
    }
    if (typeof s.showCurrencyBoard === 'boolean') {
      game.showCurrencyBoard = s.showCurrencyBoard;
      dom.currencyBoardToggle.checked = s.showCurrencyBoard;
    }
    if (typeof s.showCurrencyBriefcase === 'boolean') {
      game.showCurrencyBriefcase = s.showCurrencyBriefcase;
      dom.currencyBriefcaseToggle.checked = s.showCurrencyBriefcase;
    }
    if (typeof s.hideOpenedCases === 'boolean') {
      game.hideOpenedCases = s.hideOpenedCases;
      dom.hideOpenedCasesToggle.checked = s.hideOpenedCases;
    }
    if (typeof s.gameLogEnabled === 'boolean') {
      game.gameLogEnabled = s.gameLogEnabled;
      dom.gameLogEnabledToggle.checked = s.gameLogEnabled;
    }
    if (typeof s.caseCount === 'number' && s.caseCount >= 4 && s.caseCount <= 26) {
      game.caseCount = s.caseCount;
      game.nextCaseCount = s.caseCount;
      dom.caseCountInput.value = s.caseCount;
    }
    if (typeof s.sfxEnabled === 'boolean') {
      game.sfxEnabled = s.sfxEnabled;
      dom.soundToggle.checked = s.sfxEnabled;
    }
    if (typeof s.sfxVolumePercent === 'number' && s.sfxVolumePercent >= 0 && s.sfxVolumePercent <= 200) {
      game.sfxVolumePercent = s.sfxVolumePercent;
      dom.sfxVolumeInput.value = s.sfxVolumePercent;
    }
  } catch (e) { /* ignore */ }
  applySfxLevel();
}

dom.saveSettingsBtn.addEventListener('click', () => {
  saveSettings();
  dom.settingsPanel.style.display = 'none';
});

// Load on startup
loadSettings();
applyGameLogVisibility();

dom.gameLogHeader.addEventListener('click', () => {
  dom.gameLogPanel.classList.toggle('collapsed');
});

function setCustomBankOfferVisible(visible) {
  dom.customBankOfferWrap.classList.toggle('visible', visible);
  if (!visible) {
    dom.customBankOfferWrap.classList.remove('active');
    dom.customBankOfferInput.value = '';
    dom.customBankOfferInput.style.display = 'none';
  }
}

function closeCustomBankOffer() {
  setCustomBankOfferVisible(false);
}

function submitCustomBankOffer() {
  const raw = dom.customBankOfferInput.value.trim();
  if (!raw) {
    closeCustomBankOffer();
    return;
  }
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) {
    dom.customBankOfferInput.focus();
    return;
  }
  game.lastOffer = Math.round(amount);
  dom.bankerOfferDisplay.textContent = '';
  dom.bankerOfferDisplay.classList.remove('no-deal', 'counter-offer');
  logEvent(`Custom banker offer prepared: <b>${fmtDisplayBoard(game.lastOffer)}</b>.`);
  closeCustomBankOffer();
}

dom.customBankOfferBtn.addEventListener('click', () => {
  if (!dom.customBankOfferWrap.classList.contains('visible')) return;
  dom.customBankOfferWrap.classList.add('active');
  dom.customBankOfferInput.style.display = 'block';
  dom.customBankOfferInput.focus();
});

dom.customBankOfferInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitCustomBankOffer();
  }
  if (e.key === 'Escape') {
    closeCustomBankOffer();
  }
});

dom.customBankOfferInput.addEventListener('blur', () => {
  if (!dom.customBankOfferInput.value.trim()) {
    closeCustomBankOffer();
  }
});  dom.manualModeToggle.addEventListener('change', () => {
    game.manualOpenMode = dom.manualModeToggle.checked;
  });

  dom.hostModeToggle.addEventListener('change', () => {
    game.hostMode = dom.hostModeToggle.checked;
  });

dom.nightVisionToggle.addEventListener('change', () => {
  game.nightVisionMode = dom.nightVisionToggle.checked;
  renderGrid();
});

dom.currencyBoardToggle.addEventListener('change', () => {
  game.showCurrencyBoard = dom.currencyBoardToggle.checked;
  refreshCurrencyDisplay();
});

dom.currencyBriefcaseToggle.addEventListener('change', () => {
  game.showCurrencyBriefcase = dom.currencyBriefcaseToggle.checked;
  refreshCurrencyDisplay();
});  dom.hideOpenedCasesToggle.addEventListener('change', () => {
  game.hideOpenedCases = dom.hideOpenedCasesToggle.checked;
  renderGrid();
  renderYourCase();
});

dom.gameLogEnabledToggle.addEventListener('change', () => {
  game.gameLogEnabled = dom.gameLogEnabledToggle.checked;
  applyGameLogVisibility();
});

/** Shows/hides the bottom-right log panel to match the current setting. */
function applyGameLogVisibility() {
  dom.gameLogPanel.style.display = game.gameLogEnabled === false ? 'none' : '';
}

dom.soundToggle.addEventListener('change', () => {
  game.sfxEnabled = dom.soundToggle.checked;
  applySfxLevel();
});

dom.sfxVolumeInput.addEventListener('input', () => {
  game.sfxVolumePercent = parseInt(dom.sfxVolumeInput.value, 10) || 0;
  applySfxLevel();
});

dom.applyCaseCountBtn.addEventListener('click', () => {
  const n = parseInt(dom.caseCountInput.value, 10);
  if (isNaN(n) || n < MIN_CASE_COUNT || n > MAX_CASE_COUNT) {
    dom.caseCountInput.value = game.caseCount;
    logEvent(`Invalid case count — use <b>${MIN_CASE_COUNT}–${MAX_CASE_COUNT}</b>.`);
    return;
  }
  if (n === game.caseCount) {
    dom.settingsPanel.style.display = 'none';
    return;
  }
  game.nextCaseCount = n;
  dom.caseCountInput.value = n;
  dom.settingsPanel.style.display = 'none';
  newGame();
});

document.addEventListener('click', (e) => {
  if (dom.settingsPanel.style.display !== 'none' &&
      !dom.settingsPanel.contains(e.target) &&
      e.target !== dom.settingsGear) {
    dom.settingsPanel.style.display = 'none';
  }
  if (dom.pbSelectPanel.style.display !== 'none' &&
      e.target !== dom.pbSelectBtn &&
      e.target !== dom.boardSaveBtn &&
      !dom.pbSelectPanel.querySelector('.pb-select-card').contains(e.target)) {
    dom.pbSelectPanel.style.display = 'none';
  }
  if (dom.bgPickerPanel.style.display !== 'none' &&
      e.target !== dom.bgPickerBtn &&
      !dom.bgPickerPanel.querySelector('.bg-picker-card').contains(e.target)) {
    dom.bgPickerPanel.style.display = 'none';
  }
});
