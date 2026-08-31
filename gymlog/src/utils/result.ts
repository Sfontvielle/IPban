/** Простейший безопасный вызов — чтобы фоновые задачи не роняли экран. */
export async function safeAsync<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (__DEV__) console.warn('[gymlog] safeAsync', error);
    return fallback;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
