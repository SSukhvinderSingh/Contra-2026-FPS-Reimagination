import test from 'node:test';
import assert from 'node:assert';
import { GeminiService } from '../src/ai/GeminiService.js';

test('GeminiService HTTP Mocking Tests', async (t) => {
  // Test 1: Instantiation retains the API Key
  await t.test('instantiates with API key', () => {
    const service = new GeminiService('FAKE_API_KEY');
    assert.strictEqual(service._apiKey, 'FAKE_API_KEY');
  });

  // Test 2: Fallback system acts as a safety net
  await t.test('_fallback returns appropriate offline texts', () => {
    const service = new GeminiService('FAKE_API_KEY');
    
    const taunt = service._fallback('Enemy taunt');
    assert.strictEqual(taunt, 'You can\'t stop Red Falcon, soldier!');

    const unknown = service._fallback('NonExistentLabel');
    assert.strictEqual(unknown, 'Transmission interrupted.');
  });

  // Test 3: Simulating a failed fetch returns a fallback safely
  await t.test('API failure safely triggers fallback instead of crashing', async () => {
    const service = new GeminiService('BAD_KEY');
    
    // We override global fetch temporarily to simulate a 403 Forbidden error
    const originalFetch = global.fetch;
    global.fetch = async () => {
      return {
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      };
    };

    const mockLevel = { number: 1, name: 'Jungle', theme: 'Jungle' };
    const result = await service.getMissionBriefing(mockLevel);

    global.fetch = originalFetch; // restore

    assert.strictEqual(result, 'Rizer, intel is compromised. Move in fast, take no prisoners. Red Falcon forces are everywhere — watch your six.');
  });
});
