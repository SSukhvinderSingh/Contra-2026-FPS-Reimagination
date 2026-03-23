/**
 * main.js
 * Game bootstrap — wires all systems together and manages screen state machine.
 *
 * Screen flow:
 *   api-key-screen → title-screen → mission-brief-screen → [GAME]
 *   → debrief-screen → mission-brief-screen (next level) → ...
 *   → victory-screen  (win)
 *   → gameover-screen (lose) → restart options
 */

import { Renderer }      from './src/engine/Renderer.js';
import { InputHandler }  from './src/engine/InputHandler.js';
import { AudioManager }  from './src/engine/AudioManager.js';
import { GeminiService } from './src/ai/GeminiService.js';
import { Player }        from './src/game/Player.js';
import { LevelManager }  from './src/game/LevelManager.js';
import { HUD }           from './src/ui/HUD.js';

// ─── DOM References ───────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const screens = {
  apiKey:       $('api-key-screen'),
  title:        $('title-screen'),
  missionBrief: $('mission-brief-screen'),
  debrief:      $('debrief-screen'),
  gameOver:     $('gameover-screen'),
  victory:      $('victory-screen'),
};

const gameContainer = $('game-container');
const canvas        = $('game-canvas');
const lockOverlay   = $('lock-overlay');

// ─── State ────────────────────────────────────────────────────────────────────

let renderer, input, audio, gemini, player, levelManager, hud;
let currentLevelIndex = 0;
let gameActive        = false;

// ─── Screen Manager ───────────────────────────────────────────────────────────

/**
 * @param {keyof screens | 'game'} screen
 */
function showScreen(screen) {
  // Hide all overlays
  Object.values(screens).forEach((el) => el.classList.remove('active'));
  gameContainer.classList.add('hidden');

  if (screen === 'game') {
    gameContainer.classList.remove('hidden');
    return;
  }

  if (screens[screen]) {
    screens[screen].classList.add('active');
  }
}

// ─── Typewriter Effect ────────────────────────────────────────────────────────

/**
 * Simulates a typewriter effect for briefing/debrief text.
 * @param {HTMLElement} el
 * @param {string} text
 * @param {number} [speed=28]  chars per second
 * @returns {Promise<void>}
 */
function typewrite(el, text, speed = 28) {
  return new Promise((resolve) => {
    el.textContent = '';
    el.classList.add('typing');
    let i = 0;
    const interval = setInterval(() => {
      el.textContent += text[i];
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        el.classList.remove('typing');
        resolve();
      }
    }, 1000 / speed);
  });
}

// ─── Initialise Systems ───────────────────────────────────────────────────────

function initSystems(apiKey) {
  audio        = new AudioManager();
  gemini       = new GeminiService(apiKey);
  renderer     = new Renderer(canvas);
  input        = new InputHandler(canvas);
  hud          = new HUD();
  player       = new Player(renderer.camera, input, audio);
  levelManager = new LevelManager(renderer.scene, player, hud, audio, gemini);

  // Wire level events
  levelManager.onLevelComplete = () => showDebrief(false);
  levelManager.onGameOver      = () => showGameOver();
  levelManager.onVictory       = () => showVictory();

  // Game tick
  renderer.onTick((delta) => {
    if (!gameActive) return;
    player.update(delta, levelManager.world);
    levelManager.update(delta);
    hud.setHealth(player.health, player.maxHealth);
  });

  // Pointer lock UI
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
      lockOverlay.classList.add('hidden');
    } else {
      if (gameActive) lockOverlay.classList.remove('hidden');
    }
  });

  lockOverlay.addEventListener('click', () => {
    canvas.requestPointerLock();
  });

  renderer.start();
}

// ─── Mission Brief Screen ─────────────────────────────────────────────────────

async function showMissionBrief(levelIndex) {
  currentLevelIndex = levelIndex;

  const meta = (await import('./src/levels/index.js')).LEVEL_META[levelIndex];

  $('brief-level-num').textContent  = meta.number;
  $('brief-level-name').textContent = meta.name;

  const textEl    = $('brief-typing-text');
  const loadingEl = $('brief-loading');
  const deployBtn = $('brief-deploy-btn');

  textEl.textContent = '';
  loadingEl.classList.remove('hidden');
  deployBtn.classList.add('hidden');

  showScreen('missionBrief');

  // Fetch briefing from Gemini while the loading indicator shows
  const brief = await gemini.getMissionBriefing(meta);
  loadingEl.classList.add('hidden');

  await typewrite(textEl, brief);
  deployBtn.classList.remove('hidden');
}

function bindBriefDeploy() {
  $('brief-deploy-btn').addEventListener('click', () => {
    startLevel(currentLevelIndex);
  });
}

// ─── Start Level ──────────────────────────────────────────────────────────────

function startLevel(index) {
  gameActive = false;
  levelManager.loadLevel(index);
  showScreen('game');
  lockOverlay.classList.remove('hidden');
  // Small delay lets the overlay render before we lock
  setTimeout(() => {
    canvas.requestPointerLock();
    gameActive = true;
  }, 300);
}

// ─── Debrief Screen ───────────────────────────────────────────────────────────

async function showDebrief(isVictory) {
  gameActive = false;
  input.releaseLock();
  renderer.stop();

  const meta  = (await import('./src/levels/index.js')).LEVEL_META[currentLevelIndex];
  const stats = {
    kills:           player.killCount,
    accuracy:        player.accuracy,
    healthRemaining: Math.round((player.health / player.maxHealth) * 100),
  };

  $('db-kills').textContent    = stats.kills;
  $('db-accuracy').textContent = `${stats.accuracy}%`;
  $('db-health').textContent   = `${stats.healthRemaining}%`;
  $('debrief-title').textContent = isVictory ? 'All Objectives Complete' : 'Sector Cleared';

  const aiTextEl    = $('debrief-ai-text');
  const loadingEl   = $('debrief-loading');
  const nextBtn     = $('debrief-next-btn');
  const restartBtn  = $('debrief-restart-btn');

  aiTextEl.textContent = '';
  loadingEl.classList.remove('hidden');
  nextBtn.classList.add('hidden');
  restartBtn.classList.add('hidden');

  showScreen('debrief');

  const debrief = await gemini.getDebrief(meta, stats);
  loadingEl.classList.add('hidden');
  await typewrite(aiTextEl, debrief);

  if (currentLevelIndex < 4) {
    nextBtn.classList.remove('hidden');
    nextBtn.onclick = () => {
      renderer.start();
      showMissionBrief(currentLevelIndex + 1);
    };
  } else {
    restartBtn.classList.remove('hidden');
    restartBtn.textContent = '↺ PLAY AGAIN';
    restartBtn.onclick = () => { currentLevelIndex = 0; renderer.start(); showMissionBrief(0); };
  }
}

// ─── Game Over Screen ─────────────────────────────────────────────────────────

function showGameOver() {
  gameActive = false;
  input.releaseLock();

  showScreen('gameOver');

  $('go-restart-btn').onclick = () => {
    levelManager.resetDeathCount();
    renderer.start();
    startLevel(currentLevelIndex);
  };

  $('go-menu-btn').onclick = () => {
    currentLevelIndex = 0;
    renderer.start();
    showScreen('title');
  };
}

// ─── Victory Screen ───────────────────────────────────────────────────────────

async function showVictory() {
  gameActive = false;
  input.releaseLock();

  const aiTextEl = $('victory-ai-text');
  aiTextEl.textContent = '';
  showScreen('victory');

  const speech = await gemini.getVictorySpeech();
  await typewrite(aiTextEl, speech);

  $('vic-menu-btn').onclick = () => {
    currentLevelIndex = 0;
    renderer.start();
    showScreen('title');
  };
}

// ─── Boot Sequence ────────────────────────────────────────────────────────────

function boot() {
  showScreen('apiKey');

  $('start-game-btn').addEventListener('click', () => {
    const key = $('api-key-input').value.trim();
    if (!key) {
      $('api-key-input').style.borderColor = 'var(--col-red)';
      $('api-key-input').focus();
      return;
    }
    initSystems(key);
    showScreen('title');
  });

  // Allow Enter key on API input
  $('api-key-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('start-game-btn').click();
  });

  $('menu-play-btn').addEventListener('click', () => {
    showMissionBrief(0);
  });

  $('menu-controls-btn').addEventListener('click', () => {
    const panel = $('controls-panel');
    panel.classList.toggle('hidden');
  });

  bindBriefDeploy();
}

boot();
