/**
 * Leaderboard.js
 * Client-side leaderboard persisted in localStorage.
 * Stores top 10 entries sorted by fastest completion time.
 */

const STORAGE_KEY = 'contra2026_lb';
const MAX_ENTRIES = 10;

export class Leaderboard {
  /**
   * Load all entries sorted by time ascending (fastest first).
   * @returns {{ name: string, timeMs: number, date: string }[]}
   */
  static load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Save a new entry and persist the top 10.
   * @param {string} name    - Player callsign (trimmed, max 16 chars)
   * @param {number} timeMs  - Total completion time in milliseconds
   */
  static save(name, timeMs) {
    const sanitised = (name || 'OPERATIVE').trim().substring(0, 16).toUpperCase() || 'OPERATIVE';
    const entries = Leaderboard.load();
    entries.push({ name: sanitised, timeMs, date: new Date().toLocaleDateString() });
    // Sort fastest first, keep top 10
    entries.sort((a, b) => a.timeMs - b.timeMs);
    entries.splice(MAX_ENTRIES);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      console.warn('[Leaderboard] localStorage write failed.');
    }
  }

  /**
   * Format milliseconds as MM:SS.
   * @param {number} ms
   * @returns {string}  e.g. "04:37"
   */
  static format(ms) {
    const totalSec = Math.floor(ms / 1000);
    const minutes  = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const seconds  = (totalSec % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
}
