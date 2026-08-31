import React, { createContext, useContext, useEffect, useState } from 'react';

import { getDatabase } from '@/db/client';
import { migrate } from '@/db/migrations';
import { seedCatalog } from '@/db/seed/CatalogSeeder';
import { useSettingsStore } from '@/stores/settingsStore';
import { errorMessage } from '@/utils/result';

interface DatabaseStatus {
  ready: boolean;
  error: string | null;
  ftsEnabled: boolean;
  exerciseCount: number;
  stage: string;
}

const DatabaseContext = createContext<DatabaseStatus>({
  ready: false,
  error: null,
  ftsEnabled: false,
  exerciseCount: 0,
  stage: 'старт',
});

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<DatabaseStatus>({
    ready: false,
    error: null,
    ftsEnabled: false,
    exerciseCount: 0,
    stage: 'открываю базу',
  });
  const loadSettings = useSettingsStore((s) => s.load);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const db = await getDatabase();

        if (!cancelled) setStatus((s) => ({ ...s, stage: 'обновляю схему' }));
        await migrate(db);

        if (!cancelled) setStatus((s) => ({ ...s, stage: 'загружаю каталог упражнений' }));
        const seed = await seedCatalog(db);

        if (!cancelled) setStatus((s) => ({ ...s, stage: 'читаю настройки' }));
        await loadSettings();

        if (!cancelled) {
          setStatus({
            ready: true,
            error: null,
            ftsEnabled: seed.ftsEnabled,
            exerciseCount: seed.count,
            stage: 'готово',
          });
        }
      } catch (error) {
        console.error('[gymlog] ошибка инициализации базы', error);
        if (!cancelled) {
          setStatus((s) => ({ ...s, ready: false, error: errorMessage(error) }));
        }
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
