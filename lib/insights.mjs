// Lecturas de Instagram (SOLO LECTURA, sin costo): métricas, comentarios, competencia y límite de publicación.
// Nunca escribe en Meta. Sin credenciales devuelve datos de demostración marcados como tales.
import { instagram, ProviderError } from './providers.mjs';
import { graph as adsGraph, adsReady } from './ads.mjs';

const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.t > Date.now() - ttlMs) return hit.v;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}
export const KINDS = { reel: 'Reel', carousel: 'Carrusel', photo: 'Foto', story: 'Historia' };
export function kindOf(m) {
  if (m.media_product_type === 'STORY') return 'story';
  if (m.media_product_type === 'REELS' || m.media_type === 'REEL' || m.media_type === 'VIDEO') return 'reel';
  if (m.media_type === 'CAROUSEL_ALBUM') return 'carousel';
  return 'photo';
}
const inter = m => (Number(m.like_count) || 0) + (Number(m.comments_count) || 0) + (Number(m.saved) || 0) + (Number(m.shares) || 0);
// Ranking de formatos: interacción por cada 100 personas alcanzadas (sin inventar datos: solo cuenta lo medido).
export function analyze(media) {
  const by = {};
  for (const m of media) {
    const k = m.kind || kindOf(m);
    const b = (by[k] ||= { kind: k, label: KINDS[k], posts: 0, reach: 0, views: 0, interactions: 0, likes: 0 });
    b.posts++;
    b.reach += Number(m.reach) || 0;
    b.views += Number(m.views) || 0;
    b.interactions += inter(m);
    b.likes += Number(m.like_count) || 0;
  }
  const rows = Object.values(by).map(b => ({ ...b, rate: b.reach ? +((b.interactions / b.reach) * 100).toFixed(1) : null, avgReach: b.posts ? Math.round(b.reach / b.posts) : 0 }));
  rows.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.avgReach - a.avgReach);
  const best = rows[0];
  const note = !rows.length
    ? 'Aún no hay publicaciones para comparar. Publica y vuelve en unas horas.'
    : rows.length === 1
      ? `Solo hay datos de ${best.label.toLowerCase()}. Publica otro formato para poder compararlos.`
      : `Hoy el mejor formato es ${best.label.toLowerCase()}: ${best.rate ?? 's/d'} interacciones por cada 100 personas alcanzadas (${best.posts} publicación(es)). Con pocas publicaciones es una pista, no una regla: repite el formato y compara.`;
  return { rows, best: best?.kind || null, note, sample: media.length };
}
export const igReady = env => !!(env.IG_ACCESS_TOKEN && env.IG_USER_ID);

const DEMO0 = {
  mode: 'demo',
  summary: { posts: 3, reach: 1240, views: 2310, likes: 96, comments: 7, saves: 18, shares: 9 },
  media: [
    { id: 'demo1', caption: 'Demo: lanzamiento', media_type: 'REEL', like_count: 54, comments_count: 4, reach: 760, views: 1500, saved: 11, shares: 5 },
    { id: 'demo2', caption: 'Demo: carrusel producto', media_type: 'CAROUSEL_ALBUM', like_count: 30, comments_count: 2, reach: 330, views: 540, saved: 5, shares: 3 },
    { id: 'demo3', caption: 'Demo: historia', media_type: 'IMAGE', like_count: 12, comments_count: 1, reach: 150, views: 270, saved: 2, shares: 1 }
  ],
  comments: [{ id: 'democ1', media_id: 'demo1', username: 'cliente_demo', text: '¿Dónde lo consigo?', timestamp: new Date().toISOString() }]
};

async function mediaInsights(env, id) {
  // Cada tipo de medio acepta métricas distintas: se prueba la lista completa y, si falla, una mínima.
  for (const metric of ['reach,views,saved,shares,total_interactions', 'reach,saved']) {
    try {
      const r = await instagram(env, `${id}/insights?metric=${metric}`);
      return Object.fromEntries((r.data || []).map(m => [m.name, m.values?.[0]?.value ?? m.total_value?.value ?? 0]));
    } catch {}
  }
  return {};
}

export async function insights(env, limit = 6) {
  if (!igReady(env)) return DEMO;
  return cached('insights', 120000, async () => {
    const list = await instagram(env, `${env.IG_USER_ID}/media?fields=id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count&limit=${Math.min(limit, 12)}`);
    const media = [];
    for (const m of list.data || []) media.push({ ...m, kind: kindOf(m), caption: (m.caption || '').slice(0, 80), ...(await mediaInsights(env, m.id)) });
    try {
      const st = await instagram(env, `${env.IG_USER_ID}/stories?fields=id,media_type,media_product_type,permalink,timestamp,like_count&limit=5`);
      for (const m of st.data || []) media.push({ ...m, kind: 'story', caption: 'Historia', ...(await mediaInsights(env, m.id)) });
    } catch {}
    const sum = k => media.reduce((n, m) => n + (Number(m[k]) || 0), 0);
    const comments = [];
    for (const m of media.filter(m => m.comments_count > 0).slice(0, 3)) {
      try {
        const c = await instagram(env, `${m.id}/comments?fields=id,text,username,timestamp&limit=5`);
        for (const x of c.data || []) comments.push({ ...x, media_id: m.id });
      } catch {}
    }
    comments.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    return {
      mode: 'live',
      summary: { posts: media.length, reach: sum('reach'), views: sum('views'), likes: sum('like_count'), comments: sum('comments_count'), saves: sum('saved'), shares: sum('shares') },
      media,
      analysis: analyze(media),
      updatedAt: new Date().toISOString(),
      comments: comments.slice(0, 10)
    };
  });
}

export async function discovery(env, username) {
  const u = String(username || '').replace(/^@/, '');
  if (!/^[\w.]{1,30}$/.test(u)) throw new ProviderError('Usuario de Instagram no válido.', 400);
  if (!igReady(env)) return { mode: 'demo', username: u, followers_count: 12800, media_count: 240, top: [{ caption: 'Demo: post con más interacción', like_count: 900, comments_count: 40 }] };
  return cached('disc:' + u, 600000, async () => {
    const r = await instagram(env, `${env.IG_USER_ID}?fields=business_discovery.username(${u}){username,followers_count,media_count,media.limit(10){caption,like_count,comments_count,permalink,timestamp}}`);
    const d = r.business_discovery || {};
    const top = [...(d.media?.data || [])].sort((a, b) => (b.like_count + b.comments_count) - (a.like_count + a.comments_count)).slice(0, 3).map(m => ({ ...m, caption: (m.caption || '').slice(0, 120) }));
    return { mode: 'live', username: d.username, followers_count: d.followers_count, media_count: d.media_count, top };
  });
}

export async function publishingLimit(env) {
  if (!igReady(env)) return { mode: 'demo', used: 0, total: 100 };
  const r = await cached('limit', 60000, () => instagram(env, `${env.IG_USER_ID}/content_publishing_limit?fields=config,quota_usage`));
  const d = r.data?.[0] || {};
  return { mode: 'live', used: d.quota_usage ?? 0, total: d.config?.quota_total ?? 100 };
}

const DEMO = { ...DEMO0, media: DEMO0.media.map(m => ({ ...m, kind: kindOf(m) })) };
DEMO.analysis = analyze(DEMO.media);
DEMO.updatedAt = new Date().toISOString();

// Resultados de la pauta (SOLO LECTURA): campañas creadas por el estudio y su estado real en Meta.
export async function adsResults(env, campaignIds = []) {
  const ids = [...new Set(campaignIds.filter(x => /^\d+$/.test(String(x))))].slice(0, 10);
  if (!adsReady(env) || !ids.length) return { mode: adsReady(env) ? 'live' : 'demo', campaigns: [] };
  const out = [];
  for (const id of ids) {
    try {
      const c = await adsGraph(env, `${id}?fields=name,effective_status,objective,daily_budget`);
      let ins = {};
      try {
        const r = await adsGraph(env, `${id}/insights?fields=impressions,reach,clicks,spend,ctr,actions&date_preset=maximum`);
        ins = r.data?.[0] || {};
      } catch {}
      const act = t => Number((ins.actions || []).find(a => a.action_type === t)?.value || 0);
      out.push({ id, name: c.name, status: c.effective_status, objective: c.objective, impressions: Number(ins.impressions || 0), reach: Number(ins.reach || 0), clicks: Number(ins.clicks || 0), spend: Number(ins.spend || 0), ctr: Number(ins.ctr || 0), profileVisits: act('instagram_profile_visits') + act('profile_visit'), likes: act('post_reaction') });
    } catch (e) {
      out.push({ id, error: String(e.message || e).slice(0, 160) });
    }
  }
  return { mode: 'live', campaigns: out, updatedAt: new Date().toISOString() };
}
