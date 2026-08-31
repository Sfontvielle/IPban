/**
 * GymLog AI proxy.
 *
 * Единственная задача этого сервера — хранить ключ AI-провайдера и передавать запросы дальше.
 * Он НЕ хранит вашу тренировочную историю и не имеет к ней доступа:
 * инструменты выполняются на телефоне, сюда приходит только текущий вопрос и результаты
 * тех запросов, которые приложение выполнило локально.
 */

interface Env {
  ANTHROPIC_API_KEY: string;
  DEVICE_TOKEN: string;
  MODEL: string;
  MAX_REQUESTS_PER_HOUR: string;
  RATE_LIMIT: KVNamespace;
}

const MAX_BODY_BYTES = 200_000;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function isRateLimited(env: Env, token: string): Promise<boolean> {
  const limit = Number(env.MAX_REQUESTS_PER_HOUR || '60');
  const hour = new Date().toISOString().slice(0, 13);
  const key = `rl:${token}:${hour}`;

  const current = Number((await env.RATE_LIMIT.get(key)) ?? '0');
  if (current >= limit) return true;

  await env.RATE_LIMIT.put(key, String(current + 1), { expirationTtl: 3600 });
  return false;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return json({ ok: true, model: env.MODEL });
    }

    if (request.method !== 'POST' || url.pathname !== '/v1/messages') {
      return json({ error: { message: 'Not found' } }, 404);
    }

    // Простая аутентификация: секрет, который знает только ваше приложение.
    const token = request.headers.get('x-device-token');
    if (!token) {
      return json({ error: { message: 'Не передан токен устройства' } }, 401);
    }
    if (env.DEVICE_TOKEN && token !== env.DEVICE_TOKEN) {
      return json({ error: { message: 'Неизвестное устройство' } }, 401);
    }

    if (await isRateLimited(env, token)) {
      return json({ error: { message: 'Слишком много запросов, попробуйте позже' } }, 429);
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return json({ error: { message: 'Слишком большой запрос' } }, 413);
    }

    let body: {
      system?: string;
      messages?: unknown[];
      tools?: unknown[];
      max_tokens?: number;
    };
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: { message: 'Некорректный JSON' } }, 400);
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return json({ error: { message: 'Пустой список сообщений' } }, 400);
    }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: env.MODEL,
        max_tokens: Math.min(body.max_tokens ?? 1200, 2000),
        system: body.system,
        messages: body.messages,
        ...(body.tools && body.tools.length > 0 ? { tools: body.tools } : {}),
      }),
    });

    // Тела запросов и ответов намеренно не логируются.
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  },
};
