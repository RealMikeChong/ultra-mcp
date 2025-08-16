import { describe, it, expect, beforeEach } from 'vitest';
import { trackLLMRequest, updateLLMCompletion } from '../../db/tracking';
import { getDatabase } from '../../db/connection';
import { llmRequests } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { ensureDatabaseReady } from '../../db/migrate';

describe('Fast completion path', () => {
  beforeEach(async () => {
    await ensureDatabaseReady();
    try {
      const db = await getDatabase();
      await db.delete(llmRequests).execute();
    } catch {}
  });

  it('should persist completion even when called immediately after track', async () => {
    const startTime = Date.now();
    const requestId = await trackLLMRequest({
      provider: 'openai',
      model: 'gpt-4',
      requestData: { prompt: 'hi' },
      startTime,
    });

    // Immediately update completion (fast path)
    await updateLLMCompletion({
      requestId,
      responseData: { text: 'hello' },
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
      finishReason: 'stop',
      endTime: Date.now(),
    });

    const db = await getDatabase();
    const rows = await db.select()
      .from(llmRequests)
      .where(eq(llmRequests.id, requestId))
      .execute();

    expect(rows).toHaveLength(1);
    const rec = rows[0];
    expect(rec.totalTokens).toBe(3);
    expect(rec.status).toBe('success');
    expect(rec.responseData?.text).toBe('hello');
  });
});
