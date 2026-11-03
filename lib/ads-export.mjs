// Salidas 100 % locales para llevar la pauta a Meta SIN enviar nada ni activar nada.
// 1) Ficha "Promocionar en 4 pantallas": los valores exactos para el flujo de Instagram (Objetivo → Público → Presupuesto → Revisar).
// 2) CSV de importación para Ads Manager: crea BORRADORES en la interfaz de Ads Manager (todo en pausa).
const esc = v => {
  const s = String(v ?? '')
    .replace(/\r?\n/g, ' ')
    .trim();
  return /[",;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const OBJECTIVE_LABEL = { OUTCOME_TRAFFIC: 'Visitas', OUTCOME_AWARENESS: 'Reconocimiento' };
const IG_GOAL = { profile: 'Visitar tu perfil', awareness: 'Visitar tu perfil (reconocimiento de marca)', traffic: 'Visitar tu sitio web' };

export function promoteCard(result) {
  const r = result.recommendation || {},
    b = result.brief || {};
  const amount = r.suggestedDailyBudget ?? b.dailyBudget,
    days = r.days || b.days || 3;
  return {
    title: 'Ficha de carga · Promocionar publicación (Instagram)',
    warning:
      'Esta ficha NO envía nada. Tú abres la publicación en Instagram → Promocionar y escribes estos valores. La pauta se activa solo cuando tú pulsas el botón final.',
    screens: [
      {
        screen: '1 · Objetivo',
        ask: '¿Qué quieres que hagan las personas cuando vean tu anuncio?',
        value: IG_GOAL[r.goal || b.goal] || IG_GOAL.profile,
        note: r.reasoning || ''
      },
      {
        screen: '2 · Público',
        ask: '¿Quién quieres que vea tu anuncio?',
        value:
          'Elige «Público sugerido» (personas similares a tus seguidores) o «Crear el tuyo» con: ' +
          (r.audience || b.audience || 'público adulto de tu ciudad'),
        note: 'Ubicación: ' + (b.city || '') + (b.radius ? ' · radio ' + b.radius + ' km' : '')
      },
      {
        screen: '3 · Presupuesto y duración',
        ask: '¿Cuál es tu presupuesto publicitario?',
        value: (amount == null ? 'Define tu tope' : amount + ' ' + (b.currency || 'COP') + ' por día') + ' · ' + days + ' día(s)',
        note: r.budgetReasoning || 'Es una propuesta, no una autorización de gasto.'
      },
      {
        screen: '4 · Revisar',
        ask: '¿Toda la información es correcta?',
        value:
          'Verifica objetivo, público, presupuesto y vista previa. Instagram revisa los anuncios (hasta 24 h) cuando pulsas el botón final.',
        note: 'Antes de pulsar: ¿copy sin promesas? ¿imagen sin texto excesivo? ¿etiqueta de IA si aplica?'
      }
    ],
    copy: r.copy || result.caption || '',
    kpis: r.kpis || [],
    creative: (r.creativePlan || []).map((c, i) => ({ piece: i + 1, angle: c.angle }))
  };
}

export function adsManagerCsv(result, { pageId = '', instagramId = '', link = '' } = {}) {
  const r = result.recommendation || {},
    b = result.brief || {};
  const amount = r.suggestedDailyBudget ?? b.dailyBudget ?? '',
    days = r.days || b.days || 3;
  const start = new Date(Date.now() + 86400000),
    end = new Date(start.getTime() + days * 86400000);
  const objective = OBJECTIVE_LABEL[r.objective] || 'Visitas',
    name = `AumentadosCo · ${b.campaignTheme || 'Campaña'} · ${b.city || ''}`.slice(0, 120);
  const head = [
    'Campaign Name',
    'Campaign Status',
    'Campaign Objective',
    'Buying Type',
    'Ad Set Name',
    'Ad Set Run Status',
    'Ad Set Daily Budget',
    'Ad Set Time Start',
    'Ad Set Time Stop',
    'Countries',
    'Cities',
    'Age Min',
    'Age Max',
    'Publisher Platforms',
    'Instagram Positions',
    'Optimization Goal',
    'Billing Event',
    'Bid Strategy',
    'Ad Name',
    'Ad Status',
    'Title',
    'Body',
    'Link',
    'Call to Action',
    'Image File Name',
    'Video File Name',
    'Facebook Page ID',
    'Instagram Account ID'
  ];
  const rows = (result.assets || []).map((a, i) => [
    name,
    'Paused',
    objective,
    'Auction',
    name + (a.kind === 'video' ? ' · Instagram Reels' : ' · Instagram Feed'),
    'Paused',
    amount,
    start.toISOString(),
    end.toISOString(),
    b.country || 'CO',
    b.city || '',
    18,
    65,
    'instagram',
    a.kind === 'video' ? 'Reels' : 'Feed',
    objective === 'Visitas' ? 'Link Clicks' : 'Reach',
    'Impressions',
    'Lowest cost',
    `${name} · pieza ${i + 1}`,
    'Paused',
    (a.headline || a.title || '').slice(0, 40),
    r.copy || result.caption || '',
    link || b.destination || '',
    b.cta || 'Learn More',
    a.kind === 'video' ? '' : a.file || '',
    a.kind === 'video' ? a.file || '' : '',
    pageId,
    instagramId
  ]);
  return '﻿' + [head, ...rows].map(row => row.map(esc).join(',')).join('\r\n') + '\r\n';
}

export function exportReadme() {
  return [
    '# Cómo llevar este borrador a Meta sin activar nada',
    '',
    'Opción A · Ficha de 4 pantallas (la más simple): abre tu publicación en Instagram → Promocionar y copia los valores de la ficha.',
    'Opción B · CSV a Ads Manager: Ads Manager → Importar (Import) → sube el CSV. Los anuncios quedan como borrador/pausa; revísalos y publícalos tú.',
    '',
    'Aviso: el formato CSV sigue las columnas de la exportación de Ads Manager; si Meta lo rechaza, usa la Opción A. Verifica siempre el estado «Pausado/Borrador» antes de salir.'
  ].join('\n');
}
