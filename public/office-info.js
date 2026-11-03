// Contenido de la ventana informativa de la oficina: muestra lo que YA hay (fotos, idea, imágenes, pauta, datos, publicación).
// Si aún no hay datos, dice que está esperando la información y explica qué se hace en ese escritorio.
// Función pura del estado de la app (se puede probar sin navegador). `imageUrls` se convierte en imágenes al dibujar.
const n = v => (Number.isFinite(Number(v)) ? Number(v).toLocaleString('es-CO') : '—');
const SLOTS = ['front', 'right', 'left', 'back'];
const NAME = { front: 'frente', right: 'derecha', left: 'izquierda', back: 'atrás' };
const cut = (t, k) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, k);
export function officeInfo(id, s = {}) {
  const have = SLOTS.filter(k => s.photos?.[k]),
    assets = s.campaign?.result?.assets || [],
    chosen = (s.selected || []).map(a => assets.find(x => x.id === a)).filter(Boolean),
    ins = s.data?.insights?.summary,
    camp = s.data?.ads?.campaigns?.[0],
    plan = s.strategyPlan,
    idea = cut(s.ideaOwn || plan?.seen || plan?.summary || plan?.concepts?.[0]?.title || plan?.concepts?.[0], 110),
    receipt = s.publishReceipt;
  const wait = (title, agent, what, open) => ({ title, agent, waiting: true, status: 'Esperando la información', what, lines: [], imageUrls: [], open });
  switch (id) {
    case 'estudio':
      if (!have.length) return wait('Estudio de fotos', 'Fotógrafa', 'Aquí se toman y guardan las 4 vistas de tu producto (frente, derecha, izquierda y atrás).', 'Abrir Fotos');
      return { title: 'Estudio de fotos', agent: 'Fotógrafa', status: `${have.length}/4 fotos guardadas`, lines: have.length === 4 ? ['Todo listo para analizar'] : ['Faltan: ' + SLOTS.filter(k => !s.photos?.[k]).map(k => NAME[k]).join(', ')], imageUrls: have.map(k => s.photos[k].url).filter(Boolean), open: 'Abrir Fotos' };
    case 'redaccion':
      if (!idea) return wait('Redacción', 'Copywriter', 'Mira tus fotos y propone la idea y el texto de la publicación.', 'Abrir Idea');
      return { title: 'Redacción', agent: 'Copywriter', status: 'Idea lista', lines: [idea, s.strategyTheme ? 'Tema: ' + cut(s.strategyTheme, 60) : null, s.caption ? 'Texto: ' + cut(s.caption, 80) : null].filter(Boolean), imageUrls: [], open: 'Abrir Idea' };
    case 'taller':
      if (!assets.length) return wait('Taller de imágenes', 'Diseñador XR', 'Crea las imágenes de tu publicación (y el video, si lo pides).', 'Abrir Imágenes');
      return { title: 'Taller de imágenes', agent: 'Diseñador XR', status: `${assets.length} imágenes creadas`, lines: [chosen.length ? `${chosen.length} elegidas para publicar` : 'Elige cuáles publicar', s.videoAssets?.length ? 'Video: listo' : 'Video: opcional'], imageUrls: assets.slice(0, 4).map(a => a.url).filter(Boolean), open: 'Abrir Imágenes' };
    case 'pauta': {
      if (!s.adsDone && !s.adsPlan) return wait('Sala de pauta', 'Media buyer + Guardián', 'Prepara el anuncio en Meta Ads. Siempre queda en PAUSA: tú lo activas. Tope de seguridad: $ 100.000.', 'Abrir Pauta');
      return { title: 'Sala de pauta', agent: 'Media buyer + Guardián', status: s.adsDone ? 'Borrador creado · en PAUSA' : 'Plan listo · aún no creado', lines: [`Presupuesto: $ ${n(s.adsBudgetN)} / día · ${s.adsDays || 3} días`, 'Tope de seguridad: $ 100.000', 'Nada se activa sin tu revisión'], imageUrls: (chosen.length ? chosen : assets).slice(0, 1).map(a => a.url).filter(Boolean), open: 'Abrir Pauta' };
    }
    case 'analitica':
      if (!ins) return wait('Analítica', 'Analista', 'Lee cómo les va a tus publicaciones y a la pauta. Abre Datos para leerlos.', 'Abrir Datos');
      return { title: 'Analítica', agent: 'Analista', status: 'Datos de Instagram', lines: [`Alcance ${n(ins.reach)} · Vistas ${n(ins.views)}`, `Me gusta ${n(ins.likes)} · Comentarios ${n(ins.comments)}`, camp ? `Pauta: ${camp.status || '—'} · gasto $ ${n(camp.spend)}` : 'Pauta: sin datos aún'], imageUrls: [], open: 'Abrir Datos' };
    case 'revision':
    case '__tv': {
      const t = id === '__tv' ? ['Pantalla de publicación', 'Luma'] : ['Sala de revisión', 'Revisor'];
      if (!receipt) return wait(t[0], t[1], 'Revisa el texto y las imágenes antes de publicar como post, historia o reel.', 'Abrir Publicar');
      return { title: t[0], agent: t[1], status: receipt.simulated ? 'Publicación simulada' : 'Publicado y verificado', lines: [cut(receipt.message, 90), receipt.id ? 'ID ' + receipt.id : null].filter(Boolean), imageUrls: chosen.slice(0, 1).map(a => a.url).filter(Boolean), open: 'Abrir Publicar' };
    }
    default:
      return null;
  }
}
