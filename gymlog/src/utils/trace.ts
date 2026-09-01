/**
 * Хлебные крошки запуска.
 *
 * Пишутся обычным console.log, поэтому попадают в терминал `npx expo start`
 * прямо с телефона. Если приложение закрывается нативно — без красного экрана
 * и без исключения в JavaScript — последняя строка в терминале показывает,
 * до какого шага оно дошло. Это единственный канал, который переживает такой краш.
 */

const started = Date.now();
let counter = 0;

export function trace(step: string, extra?: unknown): void {
  counter += 1;
  const ms = Date.now() - started;
  const suffix = extra === undefined ? '' : ` ${JSON.stringify(extra)}`;
  console.log(`[GYMLOG ${String(counter).padStart(2, '0')} +${ms}ms] ${step}${suffix}`);
}

export function traceError(step: string, error: unknown): void {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.log(`[GYMLOG ОШИБКА] ${step} — ${text}`);
}
