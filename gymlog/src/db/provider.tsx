import React, { createContext, useContext, useEffect, useState } from 'react';

import { getDatabase } from '@/db/client';
import { migrate } from '@/db/migrations';
import { isFtsAvailable, seedCatalog } from '@/db/seed/CatalogSeeder';
import { useSettingsStore } from '@/stores/settingsStore';
import { errorMessage } from '@/utils/result';

interface DatabaseStatus {
  ready: boolean;
  error: string | null;
  /** Каталог грузится в фоне — приложением можно пользоваться, не дожидаясь его. */
  catalogLoading: boolean;
  catalogProgress: number;
  catalogWarning: string | null;
  ftsEnabled: boolean;
  exerciseCount: number;
  stage: string;
}

const INITIAL: DatabaseStatus = {
  ready: false,
  error: null,
  catalogLoading: false,
  catalogProgress: 0,
  catalogWarning: null,
  ftsEnabled: false,
  exerciseCount: 0,
  stage: 'запуск',
};

const DatabaseContext = createContext<DatabaseStatus>(INITIAL);

/** Даём интерфейсу отрисоваться до первого обращения к нативной базе. */
function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<DatabaseStatus>(INITIAL);
  const loadSettings = useSettingsStore((s) => s.load);

  useEffect(() => {
    let cancelled = false;
    const update = (patch: Partial<DatabaseStatus>) => {
      if (!cancelled) setStatus((current) => ({ ...current, ...patch }));
    };

    (async () => {
      try {
        await nextTick();

        update({ stage: 'открываю базу' });
        const db = await getDatabase();

        update({ stage: 'обновляю схему' });
        await migrate(db);

        update({ stage: 'читаю настройки' });
        await loadSettings();

        const ftsEnabled = await isFtsAvailable(db);

        // Приложение готово к работе. Каталог догружается отдельно — он нужен
        // для поиска упражнений, но не для того, чтобы открыть приложение.
        update({ ready: true, ftsEnabled, stage: 'готово', catalogLoading: true });

        // Небольшая пауза: даём первому экрану отрисоваться и сделать свои запросы,
        // чтобы импорт каталога не конкурировал с ними за соединение с базой.
        await new Promise((resolve) => setTimeout(resolve, 800));

        try {
          const seed = await seedCatalog(db, (done, total) => {
            update({ catalogProgress: total > 0 ? done / total : 0 });
          });
          update({
            catalogLoading: false,
            catalogProgress: 1,
            exerciseCount: seed.count,
            ftsEnabled: seed.ftsEnabled,
          });
        } catch (error) {
          console.error('[gymlog] каталог не загрузился', error);
          update({ catalogLoading: false, catalogWarning: errorMessage(error) });
        }
      } catch (error) {
        console.error('[gymlog] ошибка инициализации базы', error);
        update({ ready: false, error: errorMessage(error) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadSettings]);

  return <DatabaseContext.Provider value={status}>{children}</DatabaseContext.Provider>;
}

export function useDatabaseStatus(): DatabaseStatus {
  return useContext(DatabaseContext);
}
