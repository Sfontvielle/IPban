import * as Crypto from 'expo-crypto';

/** UUID v4 — первичные ключи во всех таблицах (см. архитектуру, решение №1). */
export function newId(): string {
  return Crypto.randomUUID();
}
