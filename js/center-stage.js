// ============================================
// Center-stage opening animation
// ============================================
import { game, dom } from './game.js?v=100';
import { setBriefcaseAmount, isBigValue, isLowValue, isHighestRemaining, triggerDangerFlash, triggerYellowFlash } from './helpers.js?v=101';
import { caseInnerMarkup, flashTableShelves, clearShelfFlash } from './render.js?v=102';
import { applyInteriorBg, getInteriorBgId, applyInteriorAmountStyling } from './customization.js?v=104';
import { revealSoundLow, revealSoundHigh, playRevealSound, startTensionRoll } from './sound.js?v=105';

export function hideAll() {
  awaitingContinue = false;
  dom.manualContinueBtn.onclick = null;
  dom.spotlightBackdrop.classList.remove('show');
  dom.centerStage.classList.remove('show');
  dom.manualBackBtn.style.display = 'none';
  dom.manualContinueBtn.classList.remove('show');
  dom.manualContinueBtn.style.display = 'none';
  dom.caseGrid.classList.remove('reveal-focus');
  clearShelfFlash();
  dom.offerBackdrop.classList.remove('show');
  dom.offersPanel.style.display = 'none';
  dom.finalBackdrop.classList.remove('show');
  dom.endBackdrop.classList.remove('show');
  dom.dangerFlash.classList.remove('pulse');
  dom.badDecisionNote.style.display = 'none';
}

export function updateStatus() {
  const remainingUnopened = game.caseCount - 1 - game.openedCases.size;
  if (game.state === 'playing') {
    const need = (game.schedule[game.roundIndex] || 0) - game.openedInRound;
    if (game.postDealMode) {
      dom.statusLine.innerHTML = `If you'd said No Deal: open <b>${need}</b> more case${need === 1 ? '' : 's'} to see what happens next. ` +
        `<b>${remainingUnopened}</b> case${remainingUnopened === 1 ? '' : 's'} left besides yours.`;
    } else {
      dom.statusLine.innerHTML = `Round ${game.roundIndex + 1}: open <b>${need}</b> more case${need === 1 ? '' : 's'}. ` +
        `<b>${remainingUnopened}</b> case${remainingUnopened === 1 ? '' : 's'} left besides yours.`;
    }
  }
}

/** Set while a manual reveal has finished and its Continue button is
 *  waiting to be dismissed — see finishPendingReveal(). */
let awaitingContinue = false;

/** Beat between the stage closing and the prize-board cross-off
 *  starting — lets the closed case sink in before the next animation. */
export const CONTINUE_PAUSE_MS = 700;

/**
 * Plays a literal briefcase-opening sequence for case n.
 */
export function revealCaseAnimated(n, label, callback, dangerAware, onCancel, revealSoundOverride) {
  const idx = game.caseAssignment[n - 1];
  const value = game.amounts[idx].value;
  const isDanger = !!dangerAware && (isBigValue(value) || isHighestRemaining(value));
  const isLow = !!dangerAware && !isDanger && isLowValue(value);
  const gridBtn = dom.caseGrid.querySelector(`.briefcase[data-num="${n}"]`);
  const startRect = gridBtn ? gridBtn.getBoundingClientRect() : null;
  dom.caseGrid.classList.add('reveal-focus');
  if (gridBtn) gridBtn.classList.add('focus-case', 'lifted');

  dom.centerCase.className = 'briefcase big';
  dom.centerCase.style.transition = 'none';
  dom.centerCase.style.transform = 'none';
  dom.centerCase.innerHTML = caseInnerMarkup(n);
  applyInteriorBg(getInteriorBgId());
  const cvEl = dom.centerCase.querySelector('.amount-val');
  setBriefcaseAmount(cvEl, value);
  applyInteriorAmountStyling(cvEl);
  dom.centerStageLabel.textContent = label || ('Case #' + n);
  dom.centerStageLabel.classList.remove('show');

  dom.spotlightBackdrop.classList.add('show');
  dom.centerStage.classList.add('show');

  let travelMs = 0;
  if (startRect) {
    const endRect = dom.centerCase.getBoundingClientRect();
    const dx = startRect.left + startRect.width / 2 - (endRect.left + endRect.width / 2);
    const dy = startRect.top + startRect.height / 2 - (endRect.top + endRect.height / 2);
    const scaleX = startRect.width / endRect.width;
    const scaleY = startRect.height / endRect.height;
    dom.centerCase.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
    void dom.centerCase.offsetWidth;
    dom.centerCase.style.transition = 'transform 0.55s cubic-bezier(.32,.74,.33,1)';
    dom.centerCase.style.transform = 'translate(0, 0) scale(1, 1)';
    travelMs = 560;
  }

  setTimeout(() => {
    dom.centerCase.classList.add('unlatch');
  }, travelMs + 120);

  function revealDrama() {
    dom.centerCase.classList.add('show-amount');
    if (isDanger) {
      triggerDangerFlash();
    } else if (isLow) {
      triggerYellowFlash();
    }
    // The case table reacts to the value that was just revealed...
    flashTableShelves(value);
    // Final reveals use the decision outcome; normal reveals use value tiers.
    if (revealSoundOverride === 'good') {
      revealSoundLow();
    } else if (revealSoundOverride === 'bad') {
      revealSoundHigh();
    } else {
      playRevealSound(value);
    }
  }

  function finishReveal() {
    // Manual mode: leave the stage on screen and surface a Continue button
    // at the bottom center so the player controls when to move on.
    setTimeout(() => {
      dom.manualContinueBtn.style.display = '';
      void dom.manualContinueBtn.offsetWidth; // commit display change so the fade-in transition runs
      dom.manualContinueBtn.classList.add('show');
      awaitingContinue = true;
    }, 850);
    dom.manualContinueBtn.onclick = () => {
      awaitingContinue = false;
      dom.manualContinueBtn.onclick = null; // a hidden button must never re-fire an old reveal
      dom.manualContinueBtn.classList.remove('show');
      dom.manualContinueBtn.style.display = 'none';
      // Close the revealed case right away — once Continue is
      // pressed the stage starts to exit immediately...
      setTimeout(() => {
        dom.centerStage.classList.remove('show');
        dom.spotlightBackdrop.classList.remove('show');
        dom.manualSlider.style.display = 'none';
        dom.manualBackBtn.style.display = 'none';
      }, 150);
      // ...then hold the beat before the prize-board removal
      // animation, so the closed case gets a moment to itself.
      // The game unlocks when the callback fires, or the next
      // case click gets swallowed mid-fade.
      setTimeout(() => {
        if (gridBtn) gridBtn.classList.remove('focus-case', 'lifted');
        dom.caseGrid.classList.remove('reveal-focus');
        callback(value, idx);
      }, CONTINUE_PAUSE_MS + 150);
    };
  }

  if (game.manualOpenMode) {
    setTimeout(() => {
      dom.centerStageLabel.classList.add('show');
      startManualSlider(() => {
        revealDrama();
        finishReveal();
      }, typeof onCancel === 'function' ? () => {
        dom.centerStage.classList.remove('show');
        dom.spotlightBackdrop.classList.remove('show');
        dom.manualSlider.style.display = 'none';
        if (gridBtn) gridBtn.classList.remove('focus-case', 'lifted');
        dom.caseGrid.classList.remove('reveal-focus');
        onCancel();
      } : null);
    }, travelMs + 280);
  } else {
    setTimeout(() => {
      dom.centerCase.classList.add('lid-open');
      dom.centerStageLabel.classList.add('show');
      // Drumroll builds tension and peaks right as the value is revealed.
      startTensionRoll(0.65);
    }, travelMs + 280);

    setTimeout(revealDrama, travelMs + 950);

    setTimeout(() => {
      dom.centerStage.classList.remove('show');
      dom.spotlightBackdrop.classList.remove('show');
    }, travelMs + 2050);

    setTimeout(() => {
      if (gridBtn) gridBtn.classList.remove('focus-case', 'lifted');
      dom.caseGrid.classList.remove('reveal-focus');
      callback(value, idx);
    }, travelMs + 2400);
  }
}

function startManualSlider(onOpened, onBack) {
  const cover = dom.centerCase.querySelector('.num');
  dom.manualSlider.style.display = 'flex';
  dom.sliderHandle.style.top = '0%';
  dom.sliderFill.style.height = '0%';
  cover.style.transition = 'none';
  cover.style.transform = 'rotateX(0deg)';

  let dragging = false;
  let opened = false;
  dom.manualBackBtn.style.display = onBack ? '' : 'none';

  function setProgress(p) {
    p = Math.max(0, Math.min(1, p));
    dom.sliderHandle.style.top = (p * 100) + '%';
    dom.sliderFill.style.height = (p * 100) + '%';
    cover.style.transition = 'none';
    cover.style.transform = `rotateX(${-p * 108}deg)`;
    if (p >= 0.92 && !opened) {
      opened = true;
      lockOpen();
    }
  }

  function lockOpen() {
    dragging = false;
    cover.style.transition = 'transform 0.2s ease';
    cover.style.transform = 'rotateX(-108deg)';
    dom.sliderHandle.style.top = '100%';
    dom.sliderFill.style.height = '100%';
    dom.sliderHandle.style.pointerEvents = 'none';
    dom.manualBackBtn.style.display = 'none';
    cleanup();
    setTimeout(onOpened, 250);
  }

  function pointerToProgress(e) {
    const rect = dom.sliderTrack.getBoundingClientRect();
    return (e.clientY - rect.top) / rect.height;
  }

  function onPointerDown(e) {
    if (opened) return;
    dragging = true;
    dom.sliderHandle.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!dragging || opened) return;
    setProgress(pointerToProgress(e));
  }
  function onPointerUp() {
    if (opened) return;
    if (dragging) {
      dragging = false;
      cover.style.transition = 'transform 0.35s ease';
      cover.style.transform = 'rotateX(0deg)';
      dom.sliderHandle.style.transition = 'top 0.35s ease';
      dom.sliderFill.style.transition = 'height 0.35s ease';
      dom.sliderHandle.style.top = '0%';
      dom.sliderFill.style.height = '0%';
      setTimeout(() => {
        dom.sliderHandle.style.transition = '';
        dom.sliderFill.style.transition = '';
      }, 360);
    }
  }
  function onBackClick() {
    if (opened || !onBack) return;
    cleanup();
    dom.manualBackBtn.style.display = 'none';
    onBack();
  }

  function cleanup() {
    dom.sliderHandle.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    dom.manualBackBtn.removeEventListener('click', onBackClick);
    dom.sliderHandle.style.pointerEvents = '';
  }

  dom.sliderHandle.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  if (onBack) dom.manualBackBtn.addEventListener('click', onBackClick);
}

/** If a finished manual reveal is still waiting on its Continue button,
 *  dismiss it exactly as a real Continue click would. Returns true when a
 *  pending reveal was consumed. Lets the player click the NEXT case
 *  instead of hunting for the small Continue button. */
export function finishPendingReveal() {
  if (!awaitingContinue) return false;
  dom.manualContinueBtn.click();
  return true;
}

export function spawnCaseParticles(container) {
  container.innerHTML = '';
  const count = 16;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'case-particle';
    const angle = (Math.PI * 2 * i / count) + (Math.random() * 0.4 - 0.2);
    const dist = 70 + Math.random() * 90;
    p.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
    container.appendChild(p);
    requestAnimationFrame(() => p.classList.add('burst'));
  }
}
