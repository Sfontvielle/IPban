import { getDatabase } from '@/db/client';
import type { AiMemoryItem } from '@/types/domain';
import { newId } from '@/utils/id';

type Row = Record<string, unknown>;

function mapMemory(row: Row): AiMemoryItem {
  return {
    id: String(row.id),
    text: String(row.text),
    category: row.category === null ? null : String(row.category),
    origin: row.origin as AiMemoryItem['origin'],
    isEnabled: row.is_enabled === 1,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export const MemoryRepository = {
  async list(): Promise<AiMemoryItem[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>('SELECT * FROM ai_memory ORDER BY created_at DESC');
    return rows.map(mapMemory);
  },

  async listEnabled(): Promise<AiMemoryItem[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      'SELECT * FROM ai_memory WHERE is_enabled = 1 ORDER BY created_at DESC LIMIT 30',
    );
    return rows.map(mapMemory);
  },

  async add(text: string, category: string | null = null, origin: AiMemoryItem['origin'] = 'user'): Promise<string> {
    const db = await getDatabase();
    const id = newId();
    const now = Date.now();
    await db.runAsync(
      'INSERT INTO ai_memory (id, text, category, origin, is_enabled, created_at, updated_at) VALUES (?,?,?,?,1,?,?)',
      [id, text, category, origin, now, now],
    );
    return id;
  },

  async update(id: string, patch: { text?: string; isEnabled?: boolean; category?: string | null }): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = [];
    const params: (string | number | null)[] = [];
    if (patch.text !== undefined) {
      fields.push('text = ?');
      params.push(patch.text);
    }
    if (patch.category !== undefined) {
      fields.push('category = ?');
      params.push(patch.category);
    }
    if (patch.isEnabled !== undefined) {
      fields.push('is_enabled = ?');
      params.push(patch.isEnabled ? 1 : 0);
    }
    if (fields.length === 0) return;
    fields.push('updated_at = ?');
    params.push(Date.now(), id);
    await db.runAsync(`UPDATE ai_memory SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  async remove(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM ai_memory WHERE id = ?', [id]);
  },

  async clear(): Promise<void> {
    const db = await getDatabase();
    await db.execAsync('DELETE FROM ai_memory');
  },
};
