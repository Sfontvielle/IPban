import { getDatabase } from '@/db/client';
import type { AiChat, AiMessage } from '@/types/domain';
import { newId } from '@/utils/id';

type Row = Record<string, unknown>;

function mapChat(row: Row): AiChat {
  return {
    id: String(row.id),
    title: row.title === null ? null : String(row.title),
    scope: row.scope as AiChat['scope'],
    refId: row.ref_id ? String(row.ref_id) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapMessage(row: Row): AiMessage {
  return {
    id: String(row.id),
    chatId: String(row.chat_id),
    role: row.role as AiMessage['role'],
    content: row.content === null ? null : String(row.content),
    toolName: row.tool_name === null ? null : String(row.tool_name),
    toolPayloadJson: row.tool_payload_json === null ? null : String(row.tool_payload_json),
    status: row.status as AiMessage['status'],
    createdAt: Number(row.created_at),
  };
}

export const ChatRepository = {
  async listChats(limit = 50): Promise<AiChat[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      'SELECT * FROM ai_chat ORDER BY updated_at DESC LIMIT ?',
      [limit],
    );
    return rows.map(mapChat);
  },

  async createChat(scope: AiChat['scope'] = 'general', refId: string | null = null, title: string | null = null): Promise<string> {
    const db = await getDatabase();
    const id = newId();
    const now = Date.now();
    await db.runAsync(
      'INSERT INTO ai_chat (id, title, scope, ref_id, created_at, updated_at) VALUES (?,?,?,?,?,?)',
      [id, title, scope, refId, now, now],
    );
    return id;
  },

  async getChat(chatId: string): Promise<AiChat | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Row>('SELECT * FROM ai_chat WHERE id = ?', [chatId]);
    return row ? mapChat(row) : null;
  },

  async setTitle(chatId: string, title: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE ai_chat SET title = ?, updated_at = ? WHERE id = ?', [title, Date.now(), chatId]);
  },

  async deleteChat(chatId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM ai_chat WHERE id = ?', [chatId]);
  },

  async deleteAll(): Promise<void> {
    const db = await getDatabase();
    await db.execAsync('DELETE FROM ai_chat');
  },

  async listMessages(chatId: string): Promise<AiMessage[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Row>(
      'SELECT * FROM ai_message WHERE chat_id = ? ORDER BY created_at',
      [chatId],
    );
    return rows.map(mapMessage);
  },

  async addMessage(message: {
    chatId: string;
    role: AiMessage['role'];
    content?: string | null;
    toolName?: string | null;
    toolPayloadJson?: string | null;
    status?: AiMessage['status'];
  }): Promise<string> {
    const db = await getDatabase();
    const id = newId();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO ai_message (id, chat_id, role, content, tool_name, tool_payload_json, status, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [id, message.chatId, message.role, message.content ?? null, message.toolName ?? null,
        message.toolPayloadJson ?? null, message.status ?? 'done', now],
    );
    await db.runAsync('UPDATE ai_chat SET updated_at = ? WHERE id = ?', [now, message.chatId]);
    return id;
  },

  async updateMessage(id: string, patch: { content?: string | null; status?: AiMessage['status'] }): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = [];
    const params: (string | null)[] = [];
    if (patch.content !== undefined) {
      fields.push('content = ?');
      params.push(patch.content);
    }
    if (patch.status !== undefined) {
      fields.push('status = ?');
      params.push(patch.status);
    }
    if (fields.length === 0) return;
    params.push(id);
    await db.runAsync(`UPDATE ai_message SET ${fields.join(', ')} WHERE id = ?`, params);
  },
};
