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

import { Renderer }         from './src/engine/Renderer.js';
import { InputHandler }     from './src/engine/InputHandler.js';
import { AudioManager }     from './src/engine/AudioManager.js';
import { MusicManager }     from './src/engine/MusicManager.js';
import { GeminiService }    from './src/ai/GeminiService.js';
import { Player }           from './src/game/Player.js';
import { LevelManager }     from './src/game/LevelManager.js';
import { Weapon }           from './src/game/Weapon.js';
import { HUD }              from './src/ui/HUD.js';
import { EnemyHealthBars }  from './src/ui/EnemyHealthBars.js';
import { Leaderboard }      from './src/engine/Leaderboard.js';

// Module-level music (lives across all screens)
const music = new MusicManager();

// ─── DOM References ───────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const screens = {
  apiKey: $('api-key-screen'),
  title: $('title-screen'),
  missionBrief: $('mission-brief-screen'),
  debrief: $('debrief-screen'),
  gameOver: $('gameover-screen'),
  victory: $('victory-screen'),
};

const gameContainer = $('game-container');
const canvas = $('game-canvas');
const lockOverlay = $('lock-overlay');

// ─── State ────────────────────────────────────────────────────────────────────

let renderer, input, audio, gemini, player, levelManager, hud, weapon, enemyHealthBars;
let currentLevelIndex = 0;
let gameActive        = false;
/** @type {number|null} - timestamp when level 1 started (for total run time) */
let _gameStartTime    = null;

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
  audio = new AudioManager();
  gemini = new GeminiService(apiKey);
  renderer = new Renderer(canvas);
  input = new InputHandler(canvas);
  hud = new HUD();
  player = new Player(renderer.camera, input, audio);
  levelManager = new LevelManager(renderer.scene, player, hud, audio, gemini);
  weapon          = new Weapon(renderer.renderer, renderer.camera, input);
  enemyHealthBars = new EnemyHealthBars();

  // Expose health bars to LevelManager so it can track new enemies
  levelManager.setHealthBars(enemyHealthBars);
  // Expose weapon so LevelManager can trigger fire FX
  levelManager.setWeapon(weapon);

  // Wire level events
  levelManager.onLevelComplete = () => showDebrief(false);
  levelManager.onGameOver = () => showGameOver();
  levelManager.onVictory = () => showVictory();

  // Game tick — update logic only (rendering happens in onPostRender)
  renderer.onTick((delta) => {
    if (!gameActive) return;
    const isMoving = input.isForward() || input.isBackward() || input.isLeft() || input.isRight();
    player.update(delta, levelManager.world);
    levelManager.update(delta);
    weapon.setMoving(isMoving && input.isPointerLocked);
    weapon.update(delta);
    hud.setHealth(player.health, player.maxHealth);
    enemyHealthBars.update(renderer.camera);
  });

  // Post-render — weapon overlay draws AFTER the main scene
  renderer.onPostRender(() => {
    if (!gameActive) return;
    weapon.renderOnTop();
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

  // Assign handler NOW (not at boot-time) so it always fires
  deployBtn.onclick = () => startLevel(currentLevelIndex);

  showScreen('missionBrief');

  // Fetch briefing — always resolves (fallback on error)
  const brief = await gemini.getMissionBriefing(meta);
  loadingEl.classList.add('hidden');

  await typewrite(textEl, brief);
  deployBtn.classList.remove('hidden');
}

// bindBriefDeploy is no longer needed — handler assigned in showMissionBrief()
function bindBriefDeploy() { /* no-op — kept for safety */ }

// ─── Start Level ──────────────────────────────────────────────────────────────

function startLevel(index) {
  try {
    gameActive = false;
    music.stop();
    // Start the run timer only when deploying to level 1
    if (index === 0) _gameStartTime = Date.now();
    levelManager.loadLevel(index);
    showScreen('game');
    lockOverlay.classList.remove('hidden');
    setTimeout(() => {
      canvas.requestPointerLock();
      gameActive = true;
    }, 300);
  } catch (err) {
    console.error('[startLevel] Failed to load level', index, err);
  }
}

// ─── Debrief Screen ───────────────────────────────────────────────────────────

async function showDebrief(isVictory) {
  gameActive = false;
  input.releaseLock();
  renderer.stop();

  const meta = (await import('./src/levels/index.js')).LEVEL_META[currentLevelIndex];
  const stats = {
    kills: player.killCount,
    accuracy: player.accuracy,
    healthRemaining: Math.round((player.health / player.maxHealth) * 100),
  };

  $('db-kills').textContent = stats.kills;
  $('db-accuracy').textContent = `${stats.accuracy}%`;
  $('db-health').textContent = `${stats.healthRemaining}%`;
  $('debrief-title').textContent = isVictory ? 'All Objectives Complete' : 'Sector Cleared';

  const aiTextEl = $('debrief-ai-text');
  const loadingEl = $('debrief-loading');
  const nextBtn = $('debrief-next-btn');
  const restartBtn = $('debrief-restart-btn');

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
    music.start();
    showScreen('title');
  };
}

// ─── Victory Screen ───────────────────────────────────────────────────────────

async function showVictory() {
  gameActive = false;
  input.releaseLock();

  // Capture run time immediately
  const runTimeMs = _gameStartTime ? Date.now() - _gameStartTime : 0;
  _gameStartTime  = null; // reset for next run

  const aiTextEl = $('victory-ai-text');
  aiTextEl.textContent = '';
  showScreen('victory');

  const speech = await gemini.getVictorySpeech();
  await typewrite(aiTextEl, speech);

  // Show callsign input after speech completes
  const callsignWrap = $('callsign-wrap');
  const callsignInput = $('callsign-input');
  const submitBtn = $('callsign-submit-btn');
  const menuBtn = $('vic-menu-btn');

  callsignWrap.classList.remove('hidden');
  callsignInput.value = '';
  callsignInput.focus();

  const handleSubmit = () => {
    const name = callsignInput.value.trim() || 'OPERATIVE';
    Leaderboard.save(name, runTimeMs);
    callsignWrap.classList.add('hidden');
    menuBtn.classList.remove('hidden');
    renderLeaderboard();
  };

  submitBtn.onclick = handleSubmit;
  callsignInput.onkeydown = (e) => { if (e.key === 'Enter') handleSubmit(); };

  menuBtn.onclick = () => {
    currentLevelIndex = 0;
    renderer.start();
    music.start();
    showScreen('title');
    renderLeaderboard();
  };
}

// ─── Leaderboard Renderer ───────────────────────────────────────────────────────────

/**
 * Re-renders the #lb-list element from localStorage.
 * Call whenever a score is saved or the title screen is shown.
 */
function renderLeaderboard() {
  const list    = $('lb-list');
  const entries = Leaderboard.load();

  if (entries.length === 0) {
    list.innerHTML = '<li class="lb-empty">No entries yet — be the first!</li>';
    return;
  }

  list.innerHTML = entries.map((e, i) => `
    <li class="lb-row">
      <span class="lb-rank">${i + 1}</span>
      <span class="lb-name">${e.name}</span>
      <span class="lb-time">${Leaderboard.format(e.timeMs)}</span>
    </li>
  `).join('');
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
    music.start(); // first user gesture — safe to create AudioContext now
    showScreen('title');
    renderLeaderboard(); // populate leaderboard from localStorage
  });

  $('api-key-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('start-game-btn').click();
  });

  $('menu-play-btn').addEventListener('click', () => {
    music.stop(); // stop music when going into mission brief
    showMissionBrief(0);
  });

  $('menu-controls-btn').addEventListener('click', () => {
    const panel = $('controls-panel');
    panel.classList.toggle('hidden');
  });

  // Mid-game exit button — appears on lock overlay when Esc is pressed
  $('lock-exit-btn').addEventListener('click', (e) => {
    e.stopPropagation(); // prevent lock overlay from re-acquiring pointer lock
    gameActive = false;
    document.exitPointerLock?.();
    if (renderer) renderer.stop();
    if (input)    input.releaseLock();
    currentLevelIndex = 0;
    if (renderer) renderer.start();
    music.start();
    showScreen('title');
  });

  bindBriefDeploy();
  _startTitleParticles();
}

// ─── Title Particle Animation ─────────────────────────────────────────────────

/**
 * Animated bullet tracer particles flying across the title screen.
 * Runs on its own rAF loop, only draws when title screen is active.
 */
function _startTitleParticles() {
  const canvas = document.getElementById('title-particles');
  if (!canvas) return;
  const ctx   = canvas.getContext('2d');
  const COUNT = 55;
  const ptcls = [];

  const resize = () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < COUNT; i++) ptcls.push(_makeParticle(canvas, true));

  function tick() {
    if (!document.getElementById('title-screen')?.classList.contains('active')) {
      requestAnimationFrame(tick);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < ptcls.length; i++) {
      const p = ptcls[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.004;

      if (p.alpha <= 0 || p.x > canvas.width + 60) {
        ptcls[i] = _makeParticle(canvas, false);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.strokeStyle = '#ff2233';
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = '#ff2233';
      ctx.shadowBlur  = 6;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * p.len, p.y - p.vy * p.len);
      ctx.stroke();
      ctx.restore();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/** @private */
function _makeParticle(canvas, randomStart = false) {
  const angle = (Math.random() * 30 - 15) * (Math.PI / 180);
  const speed = 3 + Math.random() * 5;
  return {
    x:     randomStart ? Math.random() * canvas.width : -20,
    y:     Math.random() * canvas.height,
    vx:    Math.cos(angle) * speed,
    vy:    Math.sin(angle) * speed,
    len:   4 + Math.random() * 8,
    alpha: 0.3 + Math.random() * 0.5,
  };
}

boot();

