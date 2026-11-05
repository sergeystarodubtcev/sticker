/**
 * Сервер синхронизации базы лотов (Cloudflare Worker).
 *
 * Токен GitHub и пароль на удаление хранятся ТОЛЬКО здесь, в секретах воркера,
 * поэтому на сайте их не видно.
 *   GET  /lots                              → вся база
 *   POST /lots {lots:[…], custom:[…]}       → добавить/обновить лоты (может любой)
 *   POST /lots {delete:[id…], password}     → удалить лоты (только с паролем)
 *   POST /lots {deleteAll:true, password}   → очистить базу (только с паролем)
 *
 * Секреты (Settings → Variables and Secrets):
 *   GH_TOKEN         — fine-grained токен GitHub, Contents: Read and write на репозиторий
 *   DELETE_PASSWORD  — пароль на удаление
 * Переменные (необязательно):
 *   GH_REPO          — по умолчанию sergeystarodubtcev/sticker
 *   GH_BRANCH        — по умолчанию gh-pages
 *   ALLOWED_ORIGINS  — через запятую, по умолчанию https://sergeystarodubtcev.github.io
 */
const FILE = 'data/lots.json';
const MAX_LOTS_PER_REQUEST = 300;
const MAX_LOTS_TOTAL = 5000;
const KEY_RE = /^[a-z_][a-z0-9_]{0,40}$/i;
const ID_RE = /^[a-z0-9_-]{4,48}$/i;

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || 'https://sergeystarodubtcev.github.io')
      .split(',').map((s) => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    const reply = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    if (!path.endsWith('/lots')) return reply({ ok: true, hint: 'GET/POST /lots' });
    if (!env.GH_TOKEN) return reply({ error: 'На сервере не задан GH_TOKEN' }, 500);

    try {
      if (req.method === 'GET') return reply((await load(env)).doc);
      if (req.method !== 'POST') return reply({ error: 'method' }, 405);
      if (!okOrigin) return reply({ error: 'Запись разрешена только с сайта' }, 403);

      const body = await req.json().catch(() => null);
      if (!body || typeof body !== 'object') return reply({ error: 'Пустой запрос' }, 400);
      const wantsDelete = body.deleteAll === true || (Array.isArray(body.delete) && body.delete.length > 0);
      if (wantsDelete) {
        if (!env.DELETE_PASSWORD) return reply({ error: 'На сервере не задан пароль на удаление' }, 500);
        if (!(await sameText(String(body.password || ''), env.DELETE_PASSWORD))) {
          await new Promise((r) => setTimeout(r, 1500)); // притормозить перебор
          return reply({ error: 'Неверный пароль' }, 403);
        }
      }
      const lots = sanitizeLots(body.lots);
      const custom = sanitizeCustom(body.custom);
      const delIds = Array.isArray(body.delete) ? body.delete.filter((x) => typeof x === 'string' && ID_RE.test(x)) : [];

      for (let attempt = 0; attempt < 4; attempt++) {
        const { doc, sha } = await load(env);
        const summary = apply(doc, { lots, custom, delIds, deleteAll: body.deleteAll === true });
        if (!summary.changed) return reply(doc);
        if (doc.lots.length > MAX_LOTS_TOTAL) return reply({ error: 'База переполнена' }, 413);
        doc.updated = new Date().toISOString();
        const res = await save(env, doc, sha, summary.message);
        if (res.ok) return reply(doc);
        if (res.status !== 409 && res.status !== 422) {
          const t = await res.text();
          return reply({ error: 'GitHub ' + res.status + ': ' + t.slice(0, 200) }, 502);
        }
      }
      return reply({ error: 'Не удалось сохранить, попробуй ещё раз' }, 409);
    } catch (e) {
      return reply({ error: String(e && e.message || e) }, 500);
    }
  },
};

function gh(env, method, body) {
  const repo = env.GH_REPO || 'sergeystarodubtcev/sticker';
  const branch = env.GH_BRANCH || 'gh-pages';
  const url = `https://api.github.com/repos/${repo}/contents/${FILE}` + (method === 'GET' ? `?ref=${encodeURIComponent(branch)}` : '');
  return fetch(url, {
    method,
    headers: {
      Authorization: 'Bearer ' + env.GH_TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sticker-sync-worker',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify({ ...body, branch }) : undefined,
  });
}
async function load(env) {
  const r = await gh(env, 'GET');
  if (r.status === 404) return { doc: emptyDoc(), sha: undefined };
  if (!r.ok) throw new Error('GitHub ' + r.status + ' при чтении базы');
  const j = await r.json();
  const text = new TextDecoder().decode(Uint8Array.from(atob(j.content.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
  const doc = Object.assign(emptyDoc(), JSON.parse(text || '{}'));
  return { doc, sha: j.sha };
}
function save(env, doc, sha, message) {
  const bytes = new TextEncoder().encode(JSON.stringify(doc, null, 1));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return gh(env, 'PUT', { message, content: btoa(bin), sha });
}
function emptyDoc() { return { version: 1, updated: '', custom: [], lots: [], deleted: {} }; }

function sanitizeLots(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, MAX_LOTS_PER_REQUEST).map((src) => {
    if (!src || typeof src !== 'object' || !ID_RE.test(String(src.id || ''))) return null;
    const o = {};
    for (const [k, v] of Object.entries(src)) {
      if (!KEY_RE.test(k) || (typeof v !== 'string' && typeof v !== 'number')) continue;
      o[k] = String(v).slice(0, k === 'added' || k === 'updated' ? 40 : 200);
    }
    return o;
  }).filter(Boolean);
}
function sanitizeCustom(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 30).filter((f) => f && KEY_RE.test(String(f.k || '')) && /^c_/.test(f.k)).map((f) => ({
    k: f.k, label: String(f.label || f.k).slice(0, 40), custom: 1, date: f.date ? 1 : 0, today: f.today ? 1 : 0,
  }));
}
function apply(doc, { lots, custom, delIds, deleteAll }) {
  let added = 0, updated = 0, removed = 0;
  const now = new Date().toISOString();
  if (deleteAll) { doc.lots.forEach((x) => { doc.deleted[x.id] = now; }); removed = doc.lots.length; doc.lots = []; }
  if (delIds.length) {
    const set = new Set(delIds);
    doc.lots = doc.lots.filter((x) => { if (set.has(x.id)) { removed++; return false; } return true; });
    delIds.forEach((id) => { doc.deleted[id] = now; });
  }
  const byId = new Map(doc.lots.map((x, i) => [x.id, i]));
  for (const lot of lots) {
    if (doc.deleted[lot.id]) continue;                // удалённое паролем без пароля не вернуть
    const i = byId.get(lot.id);
    if (i === undefined) {
      lot.added = lot.added || now; lot.updated = lot.updated || now;
      byId.set(lot.id, doc.lots.length); doc.lots.push(lot); added++;
    } else if (String(lot.updated || '') > String(doc.lots[i].updated || '')) {
      lot.added = doc.lots[i].added || lot.added;
      doc.lots[i] = lot; updated++;
    }
  }
  let fields = 0;
  for (const f of custom) if (!doc.custom.some((x) => x.k === f.k)) { doc.custom.push(f); fields++; }
  const parts = [];
  if (added) parts.push('+' + added);
  if (updated) parts.push('изменено ' + updated);
  if (removed) parts.push('удалено ' + removed);
  if (fields) parts.push('поля +' + fields);
  return { changed: parts.length > 0, message: 'База лотов: ' + parts.join(', ') };
}
async function sameText(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0; for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}
