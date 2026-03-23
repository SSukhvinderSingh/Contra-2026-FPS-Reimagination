/**
 * GeminiService.js
 * Wraps all Gemini API calls (Gemini 2.0 Flash, via REST).
 * API key is stored in-memory only — never persisted.
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * @typedef {Object} LevelMeta
 * @property {number} number
 * @property {string} name
 * @property {string} theme
 */

/**
 * @typedef {Object} DebriefStats
 * @property {number} kills
 * @property {number} accuracy - 0-100
 * @property {number} healthRemaining - 0-100
 */

export class GeminiService {
  /** @type {string} */
  _apiKey;

  /**
   * @param {string} apiKey
   */
  constructor(apiKey) {
    this._apiKey = apiKey;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Generate a mission briefing for a level in the voice of a hardened commander.
   * @param {LevelMeta} level
   * @returns {Promise<string>}
   */
  async getMissionBriefing(level) {
    const prompt = `You are Commander Hayes, a grizzled military officer briefing elite operative Bill Rizer.
Write a tense, dramatic mission briefing for Level ${level.number}: "${level.name}".
Setting: ${level.theme}
Tone: Military, urgent, cinematic — like a 2026 action movie.
Constraints: 3-4 sentences max. Do NOT use markdown. No bullet points.
Start mid-sentence as if relayed by radio. Include mission objective and one key threat.`;

    return this._generate(prompt, 'Mission briefing');
  }

  /**
   * Generate a taunting one-liner from an enemy soldier.
   * @param {string} levelName
   * @returns {Promise<string>}
   */
  async getEnemyTaunt(levelName) {
    const prompt = `You are a Red Falcon soldier in ${levelName}.
Generate ONE short, menacing taunt (max 12 words) hurled at the player.
Make it sound like a military tough guy. No markdown. Just the taunt text itself.`;

    return this._generate(prompt, 'Enemy taunt');
  }

  /**
   * Generate an adaptive gameplay hint after multiple deaths.
   * @param {number} deathCount
   * @param {string} levelName
   * @returns {Promise<string>}
   */
  async getAdaptiveHint(deathCount, levelName) {
    const prompt = `The player has died ${deathCount} times in "${levelName}" in the game Contra 2026 FPS.
Give ONE short tactical hint (max 18 words) to help them survive.
Be encouraging and direct. No markdown. No intro phrase. Just the hint.`;

    return this._generate(prompt, 'Adaptive hint');
  }

  /**
   * Generate a boss monologue when the player encounters the boss.
   * @param {string} bossName
   * @param {string} bossTheme
   * @returns {Promise<string>}
   */
  async getBossMonologue(bossName, bossTheme) {
    const prompt = `You are ${bossName}, a powerful villain in the game Contra 2026 FPS.
Setting: ${bossTheme}
Deliver ONE chilling monologue when you encounter the hero (max 3 sentences).
Tone: Theatrical, menacing, megavillain energy. No markdown. Just dialogue.`;

    return this._generate(prompt, 'Boss monologue');
  }

  /**
   * Generate a post-level debrief based on performance statistics.
   * @param {LevelMeta} level
   * @param {DebriefStats} stats
   * @returns {Promise<string>}
   */
  async getDebrief(level, stats) {
    const grade = stats.accuracy > 75 ? 'elite' : stats.accuracy > 50 ? 'solid' : 'sloppy';
    const prompt = `You are Commander Hayes debriefing operative Bill Rizer after Level ${level.number}: "${level.name}".
Stats: ${stats.kills} kills, ${stats.accuracy}% accuracy, ${stats.healthRemaining}% health remaining.
Performance: ${grade}
Write a short, punchy debrief (2-3 sentences). 
${grade === 'elite' ? 'Praise their performance.' : grade === 'solid' ? 'Note what was good and what to improve.' : 'Be critical but motivational.'}
No markdown. Sound like a real military officer on radio.`;

    return this._generate(prompt, 'Debrief');
  }

  /**
   * Generate a victory speech for completing all 5 levels.
   * @returns {Promise<string>}
   */
  async getVictorySpeech() {
    const prompt = `You are Commander Hayes. Operative Bill Rizer has just destroyed Red Falcon's core and saved the Earth.
Write a triumphant 2-sentence victory radio transmission. 
Tone: Emotional, epic, proud. Reference Earth being saved. No markdown.`;

    return this._generate(prompt, 'Victory speech');
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * @private
   * @param {string} prompt
   * @param {string} label - for error logging
   * @returns {Promise<string>}
   */
  async _generate(prompt, label) {
    const url = `${GEMINI_API_URL}?key=${this._apiKey}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:     0.85,
        topK:            40,
        topP:            0.95,
        maxOutputTokens: 256,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ],
    };

    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) throw new Error(`Gemini returned empty response for: ${label}`);
      return text.trim();

    } catch (err) {
      console.error(`[GeminiService] ${label} failed:`, err);
      return this._fallback(label);
    }
  }

  /**
   * Offline / error fallback strings so the game always works.
   * @private
   * @param {string} label
   * @returns {string}
   */
  _fallback(label) {
    const fallbacks = {
      'Mission briefing': 'Rizer, intel is compromised. Move in fast, take no prisoners. Red Falcon forces are everywhere — watch your six.',
      'Enemy taunt':      'You can\'t stop Red Falcon, soldier!',
      'Adaptive hint':    'Stay moving — a stationary target is a dead target.',
      'Boss monologue':   'You dare challenge Red Falcon? Your courage amuses me. It will not save you.',
      'Debrief':          'Objective secured. Report back to base, operative.',
      'Victory speech':   'Rizer — Earth is free. Red Falcon is finished. History will remember this day.',
    };
    return fallbacks[label] ?? 'Transmission interrupted.';
  }
}
