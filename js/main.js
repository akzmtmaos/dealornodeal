// ============================================
// Main — Entry Point
// Imports all modules and starts the game
// ============================================

// Import all modules (side effects wire up event listeners)
import './settings.js?v=112';
import './toolbar.js?v=111';
import './banker.js?v=106';
import './counter.js?v=107';
import './prize-board.js?v=111';
import './suggest.js?v=113';
import './customization.js?v=104';

// Import init for startup
import { dom } from './game.js?v=100';
import { initValues, newGame } from './init.js?v=109';

// ---- Go ----
dom.caseCountInput.value = dom.caseCountInput.defaultValue;
initValues();
newGame();
