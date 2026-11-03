import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ProviderError, meta, jsonResult, request } from './providers.mjs';

const CTAS = new Set(['LEARN_MORE', 'SHOP_NOW', 'CONTACT_US', 'VIEW_INSTAGRAM_PROFILE']);
const clean = s => String(s ?? '').trim();
// ───────── Tope de gasto ─────────
// Límite duro (en COP) del gasto máximo que este programa puede comprometer EN TOTAL. No se puede subir por .env:
// el .env solo puede bajarlo. Se aplica (1) al validar el brief, (2) antes de crear nada en Meta, (3) acumulado
// entre borradores (ads-ledger.json) y (4) como spend_cap de la campaña dentro de Meta.
export const HARD_CAP_COP = 100000;
const USD_TO_COP_SAFE = 5000; // conversión conservadora para el tope si la cuenta fuera USD
export function spendCap(env = {}) {
  const n = Number(env.ADS_MAX_TOTAL_COP);
  return Number.isFinite(n) && n > 0 ? Math.min(HARD_CAP_COP, Math.floor(n)) : HARD_CAP_COP;
}
export function briefTotalCop(b) {
  const daily = Number(b.dailyBudget) || 0,
    days = Number(b.days) || 0;
  return Math.ceil(daily * days * (String(b.currency).toUpperCase() === 'USD' ? USD_TO_COP_SAFE : 1));
}
export function assertWithinCap(b, env = {}, committed = 0) {
  const cap = spendCap(env),
    total = briefTotalCop(b);
  if (total > cap)
    throw new ProviderError(
      `Tope de seguridad: esta pauta comprometería COP ${total.toLocaleString('es-CO')} (presupuesto diario × días) y el máximo permitido es COP ${cap.toLocaleString('es-CO')}. Baja el presupuesto o los días.`,
      403
    );
  if (committed + total > cap)
    throw new ProviderError(
      `Tope de seguridad: ya hay COP ${committed.toLocaleString('es-CO')} comprometidos en borradores anteriores; con esta pauta (COP ${total.toLocaleString('es-CO')}) pasarías el máximo total de COP ${cap.toLocaleString('es-CO')}.`,
      403
    );
  return { cap, total, committed };
}
export async function readLedger(file) {
  try {
    const j = JSON.parse(await readFile(file, 'utf8'));
    return Array.isArray(j.entries) ? j : { entries: [] };
  } catch {
    return { entries: [] };
  }
}
export const ledgerTotal = l => (l.entries || []).reduce((a, e) => a + (Number(e.totalCop) || 0), 0);
async function writeLedger(file, l) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(l, null, 2));
}

export function validateAdsBrief(b) {
  const country = clean(b.country).toUpperCase(),
    city = clean(b.city),
    url = clean(b.destination),
    budget = b.dailyBudget == null || clean(b.dailyBudget) === '' ? null : Number(b.dailyBudget),
    days = b.days == null || clean(b.days) === '' ? 3 : Number(b.days),
    currency = clean(b.currency).toUpperCase(),
    radius = Number(b.radius);
  if (!/^[A-Z]{2}$/.test(country) || city.length < 2 || city.length > 80)
    throw new ProviderError('Indica país ISO de dos letras y ciudad de la pauta.', 400);
  if (b.goal === 'traffic' && !url)
    throw new ProviderError('El objetivo web necesita un destino HTTPS; para Instagram no se requiere una página.', 400);
  if (url && !/^https:\/\//.test(url)) throw new ProviderError('Indica un enlace HTTPS público y válido.', 400);
  try {
    if (url) {
      const u = new URL(url);
      if (u.username || u.password || ['localhost', '127.0.0.1'].includes(u.hostname)) throw Error();
    }
  } catch {
    throw new ProviderError('Indica un enlace HTTPS público y válido.', 400);
  }
  if (
    (budget !== null && (!Number.isFinite(budget) || budget <= 0 || budget > 100000000)) ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 90
  )
    throw new ProviderError('Indica presupuesto diario positivo y duración de 1 a 90 días.', 400);
  if (!['COP', 'USD'].includes(currency)) throw new ProviderError('Confirma la moneda COP o USD de la cuenta publicitaria.', 400);
  if (budget !== null) assertWithinCap({ dailyBudget: budget, days, currency }, {});
  if (![5, 10, 17, 20, 25, 40, 50, 80].includes(radius)) throw new ProviderError('Elige un radio de 17, 25, 40 u 80 km (Meta exige mínimo 17 km en ciudades).', 400);
  if (!['auto', 'profile', 'traffic', 'awareness'].includes(b.goal))
    throw new ProviderError('Elige objetivo: recomendación, visitas o reconocimiento.', 400);
  if (b.cta && !CTAS.has(b.cta)) throw new ProviderError('Selecciona un llamado a la acción disponible.', 400);
  if (!Array.isArray(b.selected) || !b.selected.length || b.selected.length > 4)
    throw new ProviderError('Elige de una a cuatro imágenes.', 400);
  return {
    country,
    city,
    radius,
    goal: b.goal,
    destination: url,
    destinationType: url ? 'website' : 'instagram_profile',
    dailyBudget: budget,
    currency,
    days,
    cta: url ? b.cta || 'LEARN_MORE' : 'VIEW_INSTAGRAM_PROFILE',
    audience: clean(b.audience).slice(0, 500),
    campaignTheme: clean(b.campaignTheme).slice(0, 250),
    selected: [...new Set(b.selected)]
  };
}

export function demoRecommendation(b, product) {
  return {
    grounded: false,
    objective: b.goal === 'awareness' ? 'OUTCOME_AWARENESS' : 'OUTCOME_TRAFFIC',
    audience: `Personas adultas en ${b.city}, ${b.country}; validar afinidad con ${product}.`,
    placements: 'Instagram Feed; probar variantes visuales por separado.',
    testPlan: 'Revisar alcance, clics y calidad de visitas; ajustar después de observar resultados.',
    reasoning: 'Hipótesis de trabajo para el demo, sin consulta de internet ni datos de rendimiento.',
    copy: 'Descubre esta propuesta y conoce más en nuestro sitio.',
    sources: []
  };
}

export async function researchAds(env, b, product) {
  const prompt = `Eres estratega de medios para AumentadosCo. Investiga fuentes actuales con web_search sobre buenas prácticas de anuncios de Instagram para una campaña temática: ${b.campaignTheme}. Producto observado: ${product}. Lugar: ${b.city}, ${b.country}. Preferencia de objetivo: ${b.goal === 'auto' ? 'elige entre visitas al sitio y reconocimiento de marca' : b.goal === 'traffic' ? 'visitas al sitio' : 'reconocimiento de marca'}. CTA ${b.cta}; presupuesto diario ${b.dailyBudget} ${b.currency}, durante ${b.days} días. Público descrito por cliente: ${b.audience || 'sin definir'}. Busca fuentes verificables, prioriza documentación oficial y datos públicos relevantes. No afirmes tener resultados propios, CPC real, tendencias de venta probadas, competidores exactos ni que una opción sea la mejor sin datos de rendimiento. No inventes segmentaciones de intereses de Meta ni edad inferida del producto. Sugiere una hipótesis de audiencia adulta, ubicación, placement y prueba de creatividades. Devuelve SOLO JSON con campos objective (exactamente OUTCOME_TRAFFIC o OUTCOME_AWARENESS), audience, placements, testPlan, reasoning, copy; los últimos cinco son textos en español de 20 a 500 caracteres. No incluyas URLs inventadas en el JSON.`;
  const r = await meta(env, {
    model: env.META_SPARK_MODEL || 'muse-spark-1.3',
    input: prompt,
    tools: [{ type: 'web_search', search_context_size: 'medium' }]
  });
  const searched = (r.output || []).some(x => x.type === 'web_search_call' && x.status !== 'failed');
  const sources = [
    ...new Map(
      (r.output || [])
        .flatMap(x => x.content || [])
        .flatMap(c => c.annotations || [])
        .filter(a => a.type === 'url_citation' && /^https:\/\//.test(a.url || ''))
        .map(a => [a.url, { url: a.url, title: a.title || a.url }])
    ).values()
  ];
  if (!searched || !sources.length)
    throw new ProviderError('Muse Spark no devolvió investigación web con fuentes. No se presentará una recomendación como investigada.');
  const p = jsonResult(r);
  for (const key of ['audience', 'placements', 'testPlan', 'reasoning', 'copy'])
    if (typeof p[key] !== 'string' || p[key].trim().length < 15 || p[key].length > 1000)
      throw new ProviderError('La recomendación web está incompleta.');
  if (!['OUTCOME_TRAFFIC', 'OUTCOME_AWARENESS'].includes(p.objective))
    throw new ProviderError('Meta propuso un objetivo no admitido para este flujo.');
  const objective = b.goal === 'auto' ? p.objective : b.goal === 'traffic' ? 'OUTCOME_TRAFFIC' : 'OUTCOME_AWARENESS';
  return {
    grounded: true,
    objective,
    audience: p.audience,
    placements: p.placements,
    testPlan: p.testPlan,
    reasoning: p.reasoning,
    copy: p.copy,
    sources: sources.slice(0, 8)
  };
}

export function adsReady(env) {
  return !!(env.ADS_ACCESS_TOKEN && env.ADS_ACCOUNT_ID && env.ADS_PAGE_ID && env.ADS_IG_ACTOR_ID);
}
function account(env) {
  const id = clean(env.ADS_ACCOUNT_ID).replace(/^act_/, '');
  if (!/^\d+$/.test(id)) throw new ProviderError('ADS_ACCOUNT_ID debe ser el ID numérico de la cuenta publicitaria.', 409);
  return `act_${id}`;
}
export async function graph(env, path, params = null) {
  assertDraftSafe(path, params);
  if (!adsReady(env)) throw new ProviderError('Faltan credenciales separadas de Meta Marketing API en .env.', 409);
  const version = /^v\d+\.\d+$/.test(env.ADS_GRAPH_VERSION || '') ? env.ADS_GRAPH_VERSION : 'v25.0';
  const u = new URL(`https://graph.facebook.com/${version}/${path}`);
  if (!params && !path.includes('?')) u.searchParams.set('fields', path.startsWith('act_') ? 'account_id,name,currency,account_status' : 'id,status');
  const options = { headers: { Authorization: `Bearer ${env.ADS_ACCESS_TOKEN}` } };
  if (params) {
    options.method = 'POST';
    options.body = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]));
  }
  return request(u.toString(), options);
}

// ───────── Guardián de pauta ─────────
// Regla de oro: este programa NUNCA activa una pauta. Cualquier escritura a Meta Ads debe ser una creación
// (campaña, conjunto, creativo, anuncio o imagen) y todo objeto con estado debe nacer PAUSED. La única
// escritura sobre un objeto existente permitida es una pausa de emergencia.
const WRITE_PATHS = /^act_\d+\/(campaigns|adsets|adcreatives|ads|adimages|advideos)$/;
const STATUS_KEYS = new Set(['status', 'configured_status', 'effective_status']);
function statusValues(value, out = []) {
  if (Array.isArray(value)) {
    for (const x of value) statusValues(x, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (STATUS_KEYS.has(k)) out.push(String(v));
      else statusValues(v, out);
    }
  }
  return out;
}
export function assertDraftSafe(path, params = null) {
  if (!params) return true; // lecturas GET
  const emergency = /^\d+$/.test(path) && Object.keys(params).length === 1 && params.status === 'PAUSED';
  if (emergency) return true;
  const capOnly = /^\d+$/.test(path) && Object.keys(params).length === 1 && Number(params.spend_cap) > 0 && Number(params.spend_cap) <= HARD_CAP_COP;
  if (capOnly) return true;
  if (/\/campaigns$/.test(path) && params.spend_cap != null && !(Number(params.spend_cap) > 0 && Number(params.spend_cap) <= HARD_CAP_COP))
    throw new ProviderError('Guardián de pauta: spend_cap fuera del tope de seguridad.', 403);
  if (!WRITE_PATHS.test(path))
    throw new ProviderError('Guardián de pauta: esta escritura a Meta Ads no está permitida. Solo se pueden crear objetos PAUSED.', 403);
  let values = statusValues(params);
  for (const v of Object.values(params)) {
    if (typeof v === 'string' && /^[\[{]/.test(v)) {
      try {
        values = values.concat(statusValues(JSON.parse(v)));
      } catch {}
    }
  }
  if (/\/(campaigns|adsets|ads)$/.test(path) && values[0] !== 'PAUSED')
    throw new ProviderError('Guardián de pauta: todo objeto debe crearse con status PAUSED.', 403);
  if (values.some(v => v !== 'PAUSED'))
    throw new ProviderError('Guardián de pauta: se bloqueó un estado distinto de PAUSED. La pauta no se activa desde este programa.', 403);
  return true;
}
export function adsGuardReport(env = {}) {
  const write = env.ENABLE_META_ADS_WRITE === 'true',
    paid = env.ENABLE_PAID_APIS === 'true',
    ready = adsReady(env);
  const mode = !write ? 'local-draft' : 'remote-paused';
  return {
    mode,
    writeEnabled: write,
    paidEnabled: paid,
    credentialsPresent: ready,
    label: mode === 'local-draft' ? 'Pauta: borrador local · nada se envía a Meta' : 'Pauta: envío habilitado · solo PAUSED, jamás activa',
    spendCapCop: spendCap(env),
    guarantees: [
      `Tope de seguridad: nunca se comprometen más de COP ${spendCap(env).toLocaleString('es-CO')} en total (presupuesto × días, acumulado) y la campaña nace con ese límite dentro de Meta.`,
      'Todo objeto se crea con status PAUSED; el guardián rechaza ACTIVE.',
      'Sin ENABLE_META_ADS_WRITE=true no se hace ninguna escritura a Meta Ads.',
      'Sin ENABLE_PAID_APIS=true no se llama a ninguna API de pago.',
      'Meta puede enviar a revisión un anuncio PAUSED recién creado: por eso el flujo por defecto es el borrador local + Ficha/CSV para cargarlo tú.',
      'Activar la pauta es siempre una acción manual tuya en Ads Manager.'
    ]
  };
}
export async function verifyPaused(env, ids) {
  const problems = [];
  for (const id of [ids.campaign, ids.adset, ...(ids.ads || [])].filter(Boolean)) {
    const r = await graph(env, String(id));
    if (r.status && r.status !== 'PAUSED') {
      problems.push(id);
      try {
        await graph(env, String(id), { status: 'PAUSED' });
      } catch {}
    }
  }
  if (problems.length)
    throw new ProviderError(
      'Guardián de pauta: un objeto no quedó PAUSED (' +
        problems.join(', ') +
        '). Se intentó pausar de inmediato; verifica en Ads Manager.',
      500
    );
  return true;
}
export async function accountInfo(env) {
  return graph(env, account(env));
}
export async function resolveCity(env, city, country) {
  const version = /^v\d+\.\d+$/.test(env.ADS_GRAPH_VERSION || '') ? env.ADS_GRAPH_VERSION : 'v25.0';
  const u = new URL(`https://graph.facebook.com/${version}/search`);
  u.searchParams.set('type', 'adgeolocation');
  u.searchParams.set('q', city);
  u.searchParams.set('country_code', country);
  u.searchParams.set('location_types', JSON.stringify(['city']));
  const r = await request(u.toString(), { headers: { Authorization: `Bearer ${env.ADS_ACCESS_TOKEN}` } });
  const matches = (r.data || []).filter(
    x =>
      x.type === 'city' &&
      x.country_code === country &&
      x.name
        ?.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase() ===
        city
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
  );
  if (matches.length !== 1)
    throw new ProviderError(`No se identificó una única ciudad «${city}» en Meta. Aclara la ubicación antes de subir la pauta.`);
  return matches[0];
}

// Meta rechaza un spend_cap de campaña menor a 200.000 COP. Con un tope propio menor, la campaña va sin spend_cap
// (nace PAUSED, con presupuesto diario y fecha de fin); el tope de seguridad local sigue validándose antes de crear nada.
const META_MIN_SPEND_CAP_COP = 200000;
export async function pushPausedAds(env, draft, assets, dir, progress = async () => {}) {
  if (!adsReady(env))
    throw new ProviderError(
      'Faltan ADS_ACCESS_TOKEN, ADS_ACCOUNT_ID, ADS_PAGE_ID o ADS_IG_ACTOR_ID; el token de publicación de Instagram no sustituye ads_management.',
      409
    );
  const profileAd = !draft.brief.destination;
  if (!Number.isFinite(draft.brief.dailyBudget) || draft.brief.dailyBudget <= 0)
    throw new ProviderError('Confirma un presupuesto diario antes de crear el borrador en Meta.', 409);
  if (profileAd && !/^[\w.]{1,30}$/.test(String(draft.sourceContext?.profile || '')))
    throw new ProviderError('Falta el usuario de Instagram para una pauta de perfil.', 409);
  const ledgerFile = env.ADS_LEDGER_FILE || `${env.DATA_DIR || 'data'}/ads-ledger.json`.replace(/^(?!\/)/, process.cwd() + '/');
  const ledger = await readLedger(ledgerFile);
  const capInfo = assertWithinCap(draft.brief, env, ledgerTotal(ledger));
  const ids = { campaign: null, adset: null, ads: [], creatives: [], imageHashes: [] };
  try {
    const info = await accountInfo(env),
      currency = info.currency;
    if (currency !== draft.brief.currency)
      throw new ProviderError(
        `La cuenta publicitaria usa ${currency || 'una moneda desconocida'}, pero confirmaste ${draft.brief.currency}. Corrige el presupuesto antes de crearla.`,
        409
      );
    const minor = Math.round(draft.brief.dailyBudget * (currency === 'COP' ? 1 : 100));
    if (!Number.isSafeInteger(minor) || minor < 1) throw new ProviderError('Presupuesto diario inválido.', 400);
    const days = Number(draft.brief.days);
    if (!Number.isInteger(days) || days < 1 || days > 90) throw new ProviderError('Duración de pauta inválida.', 400);
    const start = new Date(Date.now() + 3600000),
      end = new Date(start.getTime() + days * 86400000);
    const city = await resolveCity(env, draft.brief.city, draft.brief.country);
    await progress('Ubicación y moneda confirmadas', 10, ids);
    const accountPath = account(env),
      baseName = `AumentadosCo · ${draft.brief.campaignTheme || 'Campaña'} · ${draft.brief.city}`.slice(0, 150);
    const objective = draft.recommendation.objective;
    if (!['OUTCOME_TRAFFIC', 'OUTCOME_AWARENESS'].includes(objective)) throw new ProviderError('Objetivo de pauta no admitido.', 400);
    const campaign = await graph(env, `${accountPath}/campaigns`, {
      name: baseName,
      objective,
      special_ad_categories: [],
      status: 'PAUSED',
      is_adset_budget_sharing_enabled: false,
      ...(capInfo.total >= META_MIN_SPEND_CAP_COP
        ? { spend_cap: currency === 'COP' ? capInfo.total : Math.round((capInfo.total / USD_TO_COP_SAFE) * 100) }
        : {})
    });
    if (!campaign.id) throw new ProviderError('Meta no devolvió ID de campaña.');
    ids.campaign = campaign.id;
    ledger.entries.push({ campaign: campaign.id, at: new Date().toISOString(), totalCop: capInfo.total, dailyBudget: draft.brief.dailyBudget, days: draft.brief.days, currency });
    await writeLedger(ledgerFile, ledger);
    await progress('Campaña creada y pausada', 25, ids);
    const targeting = {
      geo_locations: { cities: [{ key: city.key, radius: Math.min(80, Math.max(17, Number(draft.brief.radius) || 25)), distance_unit: 'kilometer' }] },
      age_min: 18,
      age_max: 65,
      publisher_platforms: ['instagram'],
      instagram_positions: assets.some(x => x.kind === 'video') ? ['reels', 'story'] : ['stream'],
      device_platforms: ['mobile']
    };
    const adsetBase = {
      name: `${baseName} · ${assets.some(x => x.kind === 'video') ? 'Instagram Reels' : 'Instagram Feed'}`,
      campaign_id: ids.campaign,
      daily_budget: minor,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      billing_event: 'IMPRESSIONS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting,
      status: 'PAUSED'
    };
    // Meta cambia los nombres de optimización de perfil entre versiones: se prueba cada variante en modo
    // «solo validar» (no crea nada) y se crea el conjunto con la primera que Meta acepta.
    const variants =
      objective === 'OUTCOME_TRAFFIC'
        ? profileAd
          ? [
              { optimization_goal: 'VISIT_INSTAGRAM_PROFILE', destination_type: 'INSTAGRAM_PROFILE' },
              { optimization_goal: 'PROFILE_VISIT', destination_type: 'INSTAGRAM_PROFILE' },
              { optimization_goal: 'VISIT_INSTAGRAM_PROFILE' },
              { optimization_goal: 'PROFILE_VISIT' }
            ]
          : [{ optimization_goal: 'LINK_CLICKS' }]
        : [{ optimization_goal: 'REACH' }];
    let chosen = variants[0],
      lastErr = null;
    if (variants.length > 1) {
      chosen = null;
      for (const v of variants) {
        try {
          await graph(env, `${accountPath}/adsets`, { ...adsetBase, ...v, execution_options: ['validate_only'] });
          chosen = v;
          break;
        } catch (e) {
          lastErr ||= e;
        }
      }
      if (!chosen) throw lastErr || new ProviderError('Meta no aceptó ninguna variante del conjunto de anuncios.');
    }
    const adset = await graph(env, `${accountPath}/adsets`, { ...adsetBase, ...chosen });
    if (!adset.id) throw new ProviderError('Meta no devolvió ID de conjunto.');
    ids.adset = adset.id;
    await progress('Conjunto de anuncios pausado', 40, ids);
    const mediaId = /^\d{5,30}$/.test(String(draft.sourceContext?.mediaId || '')) ? String(draft.sourceContext.mediaId) : null;
    const profileLink = profileAd ? `https://www.instagram.com/${draft.sourceContext.profile}/` : null;
    let usedMedia = false;
    if (mediaId)
      try {
      // Promueve la publicación que ya existe en Instagram (como en la app): un solo anuncio con ese post.
      const creative = await graph(env, `${accountPath}/adcreatives`, {
        name: `${baseName} · publicación`,
        source_instagram_media_id: mediaId,
        instagram_user_id: env.ADS_IG_ACTOR_ID,
        object_id: env.ADS_PAGE_ID
      });
      if (!creative.id) throw new ProviderError('Meta no devolvió ID del creativo.');
      ids.creatives.push(creative.id);
      const ad = await graph(env, `${accountPath}/ads`, {
        name: `${baseName} · publicación`,
        adset_id: ids.adset,
        creative: { creative_id: creative.id },
        status: 'PAUSED'
      });
      if (!ad.id) throw new ProviderError('Meta no devolvió ID del anuncio.');
      ids.ads.push(ad.id);
      await progress('Anuncio de tu publicación pausado', 90, ids);
      usedMedia = true;
      } catch (e) {
        await progress('Meta no acepta promover esa publicación; uso las imágenes', 55, ids);
      }
    if (!usedMedia)
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      if (a.kind === 'video') {
        if (!a.publicUrl) throw new ProviderError('Falta el enlace público del video para que Meta lo descargue.', 409);
        if (!a.thumbFile) throw new ProviderError('Falta la imagen de portada del video.', 409);
        const thumb = Object.values((await graph(env, `${accountPath}/adimages`, { bytes: (await readFile(`${dir}/${a.thumbFile}`)).toString('base64') })).images || {})[0];
        if (!thumb?.hash) throw new ProviderError('Meta no devolvió hash de la portada del video.');
        ids.imageHashes.push(thumb.hash);
        await progress('Portada subida · enviando el video a Meta', 50, ids);
        const up = await graph(env, `${accountPath}/advideos`, { file_url: a.publicUrl, name: `${baseName} · video` });
        if (!up.id) throw new ProviderError('Meta no devolvió ID del video.');
        ids.videoId = up.id;
        let ready = false;
        for (let t = 0; t < 36 && !ready; t++) {
          await new Promise(r => setTimeout(r, Number(env.ADS_VIDEO_POLL_MS) || 5000));
          const st = await graph(env, `${up.id}?fields=status`);
          const s = String(st.status?.video_status || '').toLowerCase();
          if (s === 'error') throw new ProviderError('Meta no pudo procesar el video: ' + (st.status?.processing_progress ?? 'error') );
          ready = s === 'ready';
          await progress('Meta procesa el video…', 55 + Math.min(14, t), ids);
        }
        if (!ready) throw new ProviderError('Meta sigue procesando el video. Conserva el ID ' + up.id + ' y revisa en Ads Manager; no se creó el anuncio.');
        const profileUrl = draft.brief.destination || profileLink;
        const story = {
          page_id: env.ADS_PAGE_ID,
          instagram_user_id: env.ADS_IG_ACTOR_ID,
          video_data: {
            video_id: up.id,
            image_hash: thumb.hash,
            message: draft.recommendation.copy || draft.caption,
            title: (a.headline || a.title || draft.brief.campaignTheme || 'Conoce más').slice(0, 100),
            call_to_action: { type: draft.brief.cta, value: { link: profileUrl } }
          }
        };
        const creative = await graph(env, `${accountPath}/adcreatives`, { name: `${baseName} · video`, object_story_spec: story });
        if (!creative.id) throw new ProviderError('Meta no devolvió ID del creativo.');
        ids.creatives.push(creative.id);
        const ad = await graph(env, `${accountPath}/ads`, { name: `${baseName} · anuncio video`, adset_id: ids.adset, creative: { creative_id: creative.id }, status: 'PAUSED' });
        if (!ad.id) throw new ProviderError('Meta no devolvió ID del anuncio.');
        ids.ads.push(ad.id);
        await progress('Anuncio de video pausado', 95, ids);
        continue;
      }
      const bytes = await readFile(`${dir}/${a.file}`),
        upload = await graph(env, `${accountPath}/adimages`, { bytes: bytes.toString('base64') }),
        image = Object.values(upload.images || {})[0];
      if (!image?.hash) throw new ProviderError('Meta no devolvió hash de imagen publicitaria.');
      ids.imageHashes.push(image.hash);
      await progress(`Imagen ${i + 1}/${assets.length} subida`, 45 + Math.round((i / assets.length) * 25), ids);
      const story = {
        page_id: env.ADS_PAGE_ID,
        instagram_user_id: env.ADS_IG_ACTOR_ID,
        link_data: {
          image_hash: image.hash,
          link: draft.brief.destination || profileLink,
          message: draft.recommendation.copy || draft.caption,
          name: (a.headline || a.title || draft.brief.campaignTheme || 'Conoce más').slice(0, 100),
          call_to_action: { type: draft.brief.cta, value: { link: draft.brief.destination || profileLink } }
        }
      };
      const creative = await graph(env, `${accountPath}/adcreatives`, { name: `${baseName} · pieza ${i + 1}`, object_story_spec: story });
      if (!creative.id) throw new ProviderError('Meta no devolvió ID del creativo.');
      ids.creatives.push(creative.id);
      const ad = await graph(env, `${accountPath}/ads`, {
        name: `${baseName} · anuncio ${i + 1}`,
        adset_id: ids.adset,
        creative: { creative_id: creative.id },
        status: 'PAUSED'
      });
      if (!ad.id) throw new ProviderError('Meta no devolvió ID del anuncio.');
      ids.ads.push(ad.id);
      await progress(`Anuncio ${i + 1}/${assets.length} pausado`, 70 + Math.round(((i + 1) / assets.length) * 28), ids);
    }
    await verifyPaused(env, ids);
    return {
      ...ids,
      currency,
      city: city.name,
      status: 'PAUSED',
      url: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${account(env).slice(4)}`
    };
  } catch (e) {
    e.partial = ids;
    throw e;
  }
}
