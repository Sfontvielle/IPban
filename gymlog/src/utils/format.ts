/** 8420 → «8 420». Неразрывный пробел, чтобы число не переносилось. */
export function formatInt(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatPercent(value: number, withSign = true): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = withSign && rounded > 0 ? '+' : '';
  return `${sign}${String(rounded).replace('.', ',')}%`;
}

export function formatSigned(value: number, digits = 1): string {
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${String(rounded).replace('.', ',')}`;
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
