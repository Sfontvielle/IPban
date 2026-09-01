import { getDatabase } from '@/db/client';
import { LATEST_VERSION } from '@/db/migrations';
import { toLocalDate } from '@/utils/date';

/**
 * Работа с файлами подключается лениво: expo-router загружает все экраны при старте,
 * и обычный импорт затащил бы expo-file-system, expo-sharing и expo-document-picker
 * в путь запуска приложения. Здесь они нужны только в момент экспорта или импорта.
 */
async function fileSystem() {
  return import('expo-file-system');
}

async function sharing() {
  return import('expo-sharing');
}

async function documentPicker() {
  return import('expo-document-picker');
}

/** Таблицы с данными пользователя. Каталог не выгружается — он поставляется с приложением. */
const USER_TABLES = [
  'template_folder',
  'workout_template',
  'template_exercise',
  'workout_session',
  'workout_exercise',
  'workout_set',
  'personal_record',
  'body_weight_entry',
  'recovery_checkin',
  'ai_memory',
  'settings',
] as const;

interface BackupFile {
  format: 'gymlog-backup';
  version: number;
  schemaVersion: number;
  createdAt: string;
  customExercises: Record<string, unknown>[];
  tables: Record<string, Record<string, unknown>[]>;
}

async function dumpTable(table: string): Promise<Record<string, unknown>[]> {
  const db = await getDatabase();
  return db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
}

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const BackupService = {
  /** Полная выгрузка данных пользователя в JSON. */
  async buildBackup(): Promise<string> {
    const tables: Record<string, Record<string, unknown>[]> = {};
    for (const table of USER_TABLES) {
      tables[table] = await dumpTable(table);
    }

    const db = await getDatabase();
    const customExercises = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM exercise WHERE source = 'user'",
    );
    const customChildren = await db.getAllAsync<Record<string, unknown>>(
      `SELECT em.* FROM exercise_muscle em
       JOIN exercise e ON e.id = em.exercise_id AND e.source = 'user'`,
    );
    const customEquipment = await db.getAllAsync<Record<string, unknown>>(
      `SELECT ee.* FROM exercise_equipment ee
       JOIN exercise e ON e.id = ee.exercise_id AND e.source = 'user'`,
    );

    const backup: BackupFile = {
      format: 'gymlog-backup',
      version: 1,
      schemaVersion: LATEST_VERSION,
      createdAt: new Date().toISOString(),
      customExercises,
      tables: {
        ...tables,
        exercise_muscle_custom: customChildren,
        exercise_equipment_custom: customEquipment,
      },
    };

    return JSON.stringify(backup);
  },

  async exportToFile(): Promise<string> {
    const json = await this.buildBackup();
    const { File, Paths } = await fileSystem();

    const file = new File(Paths.cache, `gymlog-backup-${toLocalDate(Date.now())}.json`);
    if (file.exists) file.delete();
    file.create();
    file.write(json);

    const Sharing = await sharing();
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
    }
    return file.uri;
  },

  /** CSV с историей подходов — удобно открыть в Excel или Google Sheets. */
  async exportSetsCsv(): Promise<string> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT s.local_date AS date, s.title AS workout, we.exercise_name_snapshot AS exercise,
              ws.set_index AS set_no, ws.set_type, ws.weight_kg, ws.reps, ws.duration_sec,
              ws.rir, ws.rpe, ws.volume_kg, ws.est_1rm_kg, ws.is_pr
       FROM workout_set ws
       JOIN workout_exercise we ON we.id = ws.workout_exercise_id
       JOIN workout_session s ON s.id = we.session_id
       WHERE s.status = 'completed' AND s.deleted_at IS NULL AND ws.is_completed = 1
       ORDER BY s.started_at DESC, we.position, ws.set_index`,
    );

    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((header) => toCsvValue(row[header])).join(',')),
    ].join('\n');

    const { File, Paths } = await fileSystem();
    const file = new File(Paths.cache, `gymlog-sets-${toLocalDate(Date.now())}.csv`);
    if (file.exists) file.delete();
    file.create();
    file.write(csv);

    const Sharing = await sharing();
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    }
    return file.uri;
  },

  /**
   * Импорт резервной копии. Данные пользователя заменяются целиком,
   * каталог не трогается. Всё выполняется одной транзакцией.
   */
  async importFromFile(): Promise<{ ok: boolean; message: string }> {
    const DocumentPicker = await documentPicker();
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'public.json', '*/*'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) {
      return { ok: false, message: 'Импорт отменён' };
    }

    let backup: BackupFile;
    try {
      const { File } = await fileSystem();
      const file = new File(picked.assets[0].uri);
      backup = JSON.parse(await file.text()) as BackupFile;
    } catch {
      return { ok: false, message: 'Не удалось прочитать файл' };
    }

    if (backup.format !== 'gymlog-backup') {
      return { ok: false, message: 'Это не резервная копия GymLog' };
    }

    const db = await getDatabase();
    try {
      await db.withExclusiveTransactionAsync(async (tx) => {
        for (const table of [...USER_TABLES].reverse()) {
          await tx.execAsync(`DELETE FROM ${table}`);
        }
        await tx.execAsync("DELETE FROM exercise WHERE source = 'user'");

        for (const row of backup.customExercises ?? []) {
          await insertRow(tx, 'exercise', row);
        }
        for (const row of backup.tables.exercise_muscle_custom ?? []) {
          await insertRow(tx, 'exercise_muscle', row);
        }
        for (const row of backup.tables.exercise_equipment_custom ?? []) {
          await insertRow(tx, 'exercise_equipment', row);
        }
        for (const table of USER_TABLES) {
          for (const row of backup.tables[table] ?? []) {
            await insertRow(tx, table, row);
          }
        }
      });
      return { ok: true, message: 'Резервная копия загружена' };
    } catch (error) {
      return {
        ok: false,
        message: `Ошибка импорта: ${error instanceof Error ? error.message : 'неизвестная'}`,
      };
    }
  },

  /** Полная очистка данных пользователя. Каталог остаётся на месте. */
  async wipeUserData(): Promise<void> {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (tx) => {
      for (const table of [...USER_TABLES].reverse()) {
        await tx.execAsync(`DELETE FROM ${table}`);
      }
      await tx.execAsync('DELETE FROM ai_chat');
      await tx.execAsync('DELETE FROM ai_analysis');
      await tx.execAsync("DELETE FROM exercise WHERE source = 'user'");
    });
  },
};

type Tx = Awaited<ReturnType<typeof getDatabase>>;

async function insertRow(tx: Tx, table: string, row: Record<string, unknown>): Promise<void> {
  const columns = Object.keys(row);
  if (columns.length === 0) return;
  const placeholders = columns.map(() => '?').join(',');
  await tx.runAsync(
    `INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`,
    columns.map((column) => row[column] as string | number | null),
  );
}
