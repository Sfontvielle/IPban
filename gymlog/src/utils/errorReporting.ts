/**
 * Перехват ошибок вне React-дерева.
 *
 * Импортируется первым в корневом layout: ошибки, случившиеся до монтирования
 * интерфейса, иначе выглядят как «приложение просто закрылось».
 */

type GlobalWithErrorUtils = typeof globalThis & {
  ErrorUtils?: {
    getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
    setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
  };
};

let lastError: { message: string; stack: string | null } | null = null;

export function getLastGlobalError() {
  return lastError;
}

function install() {
  const globalObject = globalThis as GlobalWithErrorUtils;
  const errorUtils = globalObject.ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;

  const previous = errorUtils.getGlobalHandler?.();

  errorUtils.setGlobalHandler((error, isFatal) => {
    const normalized = error instanceof Error ? error : new Error(String(error));
    lastError = { message: `${normalized.name}: ${normalized.message}`, stack: normalized.stack ?? null };
    console.error(`[gymlog] ${isFatal ? 'фатальная ' : ''}ошибка:`, normalized);
    previous?.(error, isFatal);
  });
}

install();
