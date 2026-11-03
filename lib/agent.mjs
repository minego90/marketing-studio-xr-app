// Cerebro de agentes de Luma. 100 % local y gratuito salvo que se llame explícitamente a Muse Spark.
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'agent');
let cache = null;

function parseSkill(raw, id) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  const meta = {};
  if (m)
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  return { id, name: meta.name || id, description: meta.description || '', body: (m ? m[2] : raw).trim() };
}
export async function loadAgentKit() {
  if (cache) return cache;
  const roles = JSON.parse(await readFile(resolve(root, 'roles.json'), 'utf8'));
  const skills = {};
  for (const dir of await readdir(resolve(root, 'skills'))) {
    try {
      skills[dir] = parseSkill(await readFile(resolve(root, 'skills', dir, 'SKILL.md'), 'utf8'), dir);
    } catch {}
  }
  for (const r of roles.roles)
    for (const s of r.skills) if (!skills[s]) throw new Error(`El rol ${r.id} referencia una skill inexistente: ${s}`);
  return (cache = { roles, skills });
}
export function resetAgentKitCache() {
  cache = null;
}

// Contexto que se inyecta en los prompts de Muse Spark: reglas del rol + resumen de sus skills (acotado).
export async function skillContext(roleId, { maxChars = 3500 } = {}) {
  const kit = await loadAgentKit(),
    role = kit.roles.roles.find(r => r.id === roleId);
  if (!role) throw new Error('Rol desconocido: ' + roleId);
  const parts = [`ROL: ${role.name}. Misión: ${role.mission}`, 'PRINCIPIOS:\n- ' + kit.roles.principles.join('\n- ')];
  for (const s of role.skills) parts.push(`SKILL ${kit.skills[s].name}:\n${kit.skills[s].body}`);
  let out = parts.join('\n\n');
  if (out.length > maxChars) out = out.slice(0, maxChars - 1) + '…';
  return out;
}

// ───────── Revisor local (gratis) ─────────
const CLAIMS = [
  [/garantiza|garantizad/i, 'Evita «garantizado»: es una promesa que Meta puede rechazar.'],
  [/\b100\s?%/, 'Evita «100 %» sin evidencia.'],
  [/\b(el|la)\s+mejor(es)?\b|número\s*1|#1\b/i, 'Superlativos como «el mejor» requieren prueba.'],
  [/sin\s+riesgo|resultados?\s+(inmediat|asegurad)/i, 'Evita promesas de «sin riesgo» o resultados inmediatos.'],
  [/bajar\s+de\s+peso|adelgaz|cura\b|curar|antes\s+y\s+despu[eé]s/i, 'Mensajes de salud/cuerpo o «antes y después» suelen ser rechazados.']
];
const PRICE = /(\$\s?\d)|\b\d+\s?(usd|cop|pesos)\b|\b\d{1,2}\s?%\s?(off|dto|de\s+descuento)|descuento|oferta/i;
const SENSITIVE =
  /religi[oó]n|cristian|musulm|ateo|orientaci[oó]n sexual|gay|lgbt|salud mental|enfermedad|diabet|deuda|endeudad|etnia|raza|discapacidad/i;
const hashtags = t => t.match(/#[\p{L}\p{N}_]+/gu) || [];
const sev = { error: 0, warn: 1, info: 2 };

export function reviewCampaign({
  caption = '',
  headlines = [],
  mode = 'demo',
  ads = null,
  hasVideo = false,
  photos = null,
  assetCount = 0,
  aiGenerated = true
} = {}) {
  const f = [],
    add = (severity, rule, message, fix = '') => f.push({ severity, rule, message, fix, agent: 'revisor' });
  const text = String(caption || '');
  if (!text.trim()) add('error', 'copy.vacio', 'La publicación no tiene copy.', 'Escribe un gancho de una línea y un CTA honesto.');
  if (text.length > 2200) add('error', 'copy.largo', 'El copy supera 2200 caracteres.', 'Recorta: Instagram corta el texto.');
  const first = text.split('\n')[0];
  if (text.trim() && first.length > 125)
    add(
      'warn',
      'copy.gancho',
      'La primera línea pasa de 125 caracteres: se cortará con «más» antes del mensaje clave.',
      'Pon el gancho en las primeras 125 letras.'
    );
  const tags = hashtags(text);
  if (tags.length > 5)
    add('warn', 'copy.hashtags', `Hay ${tags.length} hashtags; recomendado 3–5.`, 'Deja marca, categoría, ciudad y temporada.');
  if (text.trim() && tags.length === 0) add('info', 'copy.sin-hashtags', 'No hay hashtags.', 'Añade 3 relevantes.');
  for (const [re, msg] of CLAIMS) if (re.test(text)) add('error', 'copy.promesa', msg, 'Reescribe con lo observable.');
  if (PRICE.test(text)) add('warn', 'copy.precio', 'Se menciona precio/descuento.', 'Quítalo si el encargo dice «sin precios».');
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (letters.length > 20 && letters.replace(/[^\p{Lu}]/gu, '').length / letters.length > 0.5)
    add('warn', 'copy.mayusculas', 'Demasiado texto en MAYÚSCULAS.', 'Usa mayúsculas solo en el titular.');
  if ((text.match(/\p{Extended_Pictographic}/gu) || []).length > 4)
    add('info', 'copy.emojis', 'Muchos emojis; 0–3 se lee más profesional.', '');
  if (text.trim() && !/(visita|perfil|escr[ií]be|conoce|guarda|sigue|descubre|comparte|ver|mira)/i.test(text))
    add('info', 'copy.cta', 'No se detecta una llamada a la acción.', 'Cierra con «Visita el perfil» o similar.');
  const seen = new Set();
  for (const h of headlines) {
    const t = String(h || '').trim(),
      w = t.split(/\s+/).filter(Boolean).length;
    if (!t) add('warn', 'titular.vacio', 'Una pieza no tiene titular.', 'Escribe 2–6 palabras.');
    else {
      if (w > 6 || t.length > 72) add('warn', 'titular.largo', `Titular largo: «${t.slice(0, 40)}».`, 'Máximo 6 palabras / 72 caracteres.');
      if (w < 2) add('info', 'titular.corto', `Titular de una palabra: «${t}».`, 'Prueba con 2–6 palabras.');
      const k = t.toLowerCase();
      if (seen.has(k) && !f.some(x => x.rule === 'titular.repetido')) add('warn', 'titular.repetido', 'Dos piezas tienen el mismo titular.', 'Distínguelos.');
      seen.add(k);
    }
  }
  if (photos) {
    const n = Object.values(photos).filter(Boolean).length;
    if (n < 4) add('info', 'fotos.vistas', `Hay ${n}/4 vistas del producto.`, 'Con 4 vistas la IA conserva mejor la forma.');
  }
  if (assetCount && aiGenerated)
    add('info', 'ia.etiqueta', 'El contenido es realista y generado con IA.', 'Activa «Agregar etiqueta de IA» al publicar.');
  if (hasVideo)
    add(
      'info',
      'video.zonas',
      'Revisa que titulares queden en la zona segura (≈14 % arriba, ≈35 % abajo en Reels).',
      'Mira la vista previa del Reel.'
    );
  if (ads) {
    const r = ads.recommendation || ads,
      b = ads.brief || {};
    if (!['OUTCOME_TRAFFIC', 'OUTCOME_AWARENESS'].includes(r.objective))
      add('error', 'pauta.objetivo', 'Objetivo de pauta no admitido.', 'Usa Tráfico o Reconocimiento.');
    const budget = r.suggestedDailyBudget ?? b.dailyBudget;
    if (budget == null) add('warn', 'pauta.presupuesto', 'La pauta no tiene presupuesto propuesto.', 'Define un tope diario.');
    const days = r.days || b.days;
    if (days && (days < 1 || days > 30)) add('warn', 'pauta.dias', 'Duración fuera de 1–30 días.', 'Usa 3–7 días para aprender.');
    if (SENSITIVE.test(String(r.audience || '')))
      add('error', 'pauta.sensible', 'El público menciona un atributo sensible.', 'Segmenta por ubicación, edad adulta y afinidad amplia.');
    if (ads.remote && ads.remote.status && ads.remote.status !== 'PAUSED')
      add('error', 'pauta.activa', 'Hay un objeto remoto que no está PAUSED.', 'Pausa en Ads Manager de inmediato.');
    add('info', 'pauta.guardian', 'Pauta como borrador: nada se envía ni se activa sin tu acción manual.', '');
  }
  f.sort((a, b) => sev[a.severity] - sev[b.severity]);
  const score = Math.max(
    0,
    100 -
      f.filter(x => x.severity === 'error').length * 20 -
      f.filter(x => x.severity === 'warn').length * 7 -
      f.filter(x => x.severity === 'info').length * 1
  );
  return {
    score,
    verdict: f.some(x => x.severity === 'error') ? 'corregir' : f.some(x => x.severity === 'warn') ? 'revisar' : 'listo',
    findings: f,
    checkedAt: new Date().toISOString(),
    mode
  };
}

// ───────── Respuestas locales de Luma (gratis): recuperación simple sobre las skills ─────────
const QA = [
  { re: /luz|ilumin|oscur|brill/i, skill: 'fotografia-producto', section: 'Luz' },
  { re: /encuadr|foto|vista|c[aá]mara|nitid|borros/i, skill: 'fotografia-producto', section: 'Encuadre y cámara' },
  { re: /hook|gancho|video|reel|story|historia/i, skill: 'video-social-ia', section: 'Estructura de 5 o 10 segundos' },
  { re: /hashtag|copy|titular|texto|caption/i, skill: 'copywriting-es', section: 'Copy de feed' },
  { re: /presupuesto|pauta|anuncio|p[uú]blico|objetivo/i, skill: 'marketing-digital-meta', section: 'Presupuesto' },
  { re: /activa|gast|pausa|borrador/i, skill: 'pauta-segura-borrador', section: 'Reglas inquebrantables' },
  { re: /xr|realidad|gafas|quest|espacial/i, skill: 'anuncios-webxr', section: 'Formatos que ya soporta el proyecto' }
];
export async function askLuma(question, page = '') {
  const kit = await loadAgentKit(),
    q = String(question || '').slice(0, 300);
  const hit = QA.find(x => x.re.test(q + ' ' + page)) || QA[0];
  const skill = kit.skills[hit.skill],
    i = skill.body.indexOf('## ' + hit.section);
  let snippet = i >= 0 ? skill.body.slice(i, i + 700) : skill.body.slice(0, 700);
  snippet = snippet
    .replace(/\n{2,}/g, '\n')
    .split('\n')
    .slice(0, 8)
    .join('\n');
  return { answer: snippet, skill: skill.id, source: 'skill-local', cost: 0 };
}
