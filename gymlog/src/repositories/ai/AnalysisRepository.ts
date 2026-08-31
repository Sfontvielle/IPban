import { getDatabase } from '@/db/client';
import { newId } from '@/utils/id';

export interface StoredAnalysis {
  id: string;
  sessionId: string;
  content: string;
  model: string | null;
  createdAt: number;
}

export const AnalysisRepository = {
  async getBySession(sessionId: string): Promise<StoredAnalysis | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM ai_analysis WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
      [sessionId],
    );
    if (!row) return null;
    return {
      id: String(row.id),
      sessionId: String(row.session_id),
      content: String(row.content ?? ''),
      model: row.model === null ? null : String(row.model),
      createdAt: Number(row.created_at),
    };
  },

  async save(sessionId: string, content: string, contextJson: string, model: string | null): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM ai_analysis WHERE session_id = ?', [sessionId]);
    await db.runAsync(
      `INSERT INTO ai_analysis (id, session_id, model, prompt_version, context_json, content, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [newId(), sessionId, model, 'v1', contextJson, content, Date.now()],
    );
  },

  async clear(): Promise<void> {
    const db = await getDatabase();
    await db.execAsync('DELETE FROM ai_analysis');
  },
};
