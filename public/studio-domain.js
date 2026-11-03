export const STRATEGY_DEFAULTS = {
  product: '',
  theme: 'Halloween',
  audience: 'Personas de 24 a 40 años en Bogotá interesadas en IA y nuevas tecnologías',
  objective: 'followers',
  positioning: 'Creatividad profesional, fotografía y experiencias con inteligencia artificial.',
  metricsImpressions: '',
  metricsVisits: '',
  metricsFollows: ''
};
export const OBJECTIVES = { followers: 'Crecer en Instagram', awareness: 'Dar a conocer', traffic: 'Generar visitas' };
export const PHOTO_SLOTS = [
  ['front', 'Frente'],
  ['right', 'Derecha'],
  ['left', 'Izquierda'],
  ['back', 'Atrás']
];
export function normalizeStrategy(input = {}) {
  const out = { ...STRATEGY_DEFAULTS };
  for (const key of Object.keys(out))
    if (input[key] !== undefined) {
      if (typeof input[key] !== 'string') throw Error('Datos de estrategia inválidos.');
      out[key] = input[key].trim().slice(0, key === 'audience' || key === 'positioning' ? 800 : 250);
    }
  if (!Object.hasOwn(OBJECTIVES, out.objective)) throw Error('Elige un objetivo disponible.');
  for (const key of ['metricsImpressions', 'metricsVisits', 'metricsFollows'])
    if (out[key] !== '' && (!/^\d+$/.test(out[key]) || !Number.isSafeInteger(Number(out[key]))))
      throw Error('Las métricas deben ser números enteros positivos o quedar vacías.');
  return out;
}
export function analyzeMetrics(s) {
  const n = key => (s[key] === '' ? null : Number(s[key])),
    impressions = n('metricsImpressions'),
    visits = n('metricsVisits'),
    follows = n('metricsFollows');
  const warnings = [];
  if (impressions !== null && visits !== null && visits > impressions)
    warnings.push('Las visitas superan las impresiones: comprueba que el periodo y la fuente sean comparables.');
  if (visits !== null && follows !== null && follows > visits)
    warnings.push('Los seguidores superan las visitas: pueden proceder de otras fuentes; no atribuirlos todos a esta campaña.');
  return {
    source: 'Datos introducidos por ti; sin sincronización automática con Instagram.',
    visitRate: impressions > 0 && visits !== null ? +((visits / impressions) * 100).toFixed(2) : null,
    followRate: visits > 0 && follows !== null ? +((follows / visits) * 100).toFixed(2) : null,
    warnings
  };
}
export function localStrategy(input) {
  const s = normalizeStrategy(input),
    metrics = analyzeMetrics(s),
    product = s.product || 'el producto que vas a fotografiar';
  const diagnosis = metrics.warnings.length
    ? metrics.warnings.join(' ')
    : metrics.followRate !== null
      ? `De cada 100 visitas al perfil, tus datos registran ${metrics.followRate} seguidores. Compara el mismo periodo antes y después; esta relación no prueba causalidad.`
      : metrics.visitRate !== null
        ? `Tus datos registran ${metrics.visitRate}% de visitas respecto a impresiones. Úsalo como referencia de tu propio historial, sin asumir un resultado futuro.`
        : 'Aún no hay métricas previas. Definiremos una hipótesis creativa y mediremos el resultado después de publicar.';
  return {
    provider: 'local',
    generatedAt: new Date().toISOString(),
    summary: `${s.theme}: ${OBJECTIVES[s.objective].toLowerCase()} con ${product}.`,
    diagnosis,
    concepts: [
      `Producto protagonista en un universo de ${s.theme}.`,
      'Uso o contexto que explique por qué importa.',
      'Detalle distintivo de forma, material o identidad.'
    ],
    shotList: [
      'Frente completo: etiqueta legible, luz uniforme y espacio alrededor.',
      'Derecha: conserva la distancia y muestra volumen sin tapar el producto.',
      'Izquierda: gira al costado opuesto con el mismo encuadre y luz.',
      'Atrás: revela detalles reales; evita reflejos y dedos sobre la etiqueta.'
    ],
    copyAngles: [
      s.objective === 'followers'
        ? 'Muestra un resultado que despierte curiosidad e invita a seguir la cuenta.'
        : s.objective === 'traffic'
          ? 'Explica el valor y dirige a una página concreta.'
          : 'Presenta una idea memorable y el nombre de la marca.',
      'Conecta la temática con el uso del producto, sin añadir propiedades inventadas.'
    ],
    contentMix: 'Un carrusel de 3–4 imágenes y una historia. Video opcional después de elegir imágenes.',
    kpis:
      s.objective === 'followers'
        ? ['Visitas al perfil', 'Seguidores obtenidos', 'Guardados y compartidos']
        : s.objective === 'traffic'
          ? ['Clics al destino', 'Visitas de calidad', 'Acción realizada en la página']
          : ['Alcance', 'Guardados', 'Visitas al perfil'],
    assumptions: [
      'La propuesta usa tu encargo y tus datos; no consulta tendencias ni competidores.',
      'Las imágenes generadas requieren tu revisión antes de publicar.'
    ],
    nextStep: 'Toma las cuatro vistas siguiendo la guía. Primero revisa el frente y guarda la toma que prefieras.',
    metrics
  };
}
export function campaignBrief(s, plan, extra = '') {
  return [
    `Campaña temática: ${s.theme}. Producto o negocio: ${s.product || 'identificar únicamente en las fotos'}.`,
    `Objetivo: ${OBJECTIVES[s.objective]}. Público: ${s.audience}.`,
    `Posicionamiento: ${s.positioning}.`,
    plan
      ? `Dirección aprobada por el usuario: ${plan.summary}. Ideas: ${plan.concepts.join(' ')}. Ángulos de copy: ${plan.copyAngles.join(' ')}`
      : '',
    `Instrucción adicional del usuario: ${extra}.`,
    'Fotografía editorial profesional. Conservar dimensiones, proporciones, marca, etiqueta y materiales visibles. No inventar prestaciones, precios, descuentos ni resultados.'
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 4000);
}
export const CAPTURE_TIPS = {
  front: 'Coloca el producto completo de frente. Busca luz uniforme y una etiqueta legible.',
  right: 'Muestra el costado derecho. Conserva la distancia y deja visible el volumen.',
  left: 'Ahora muestra el costado izquierdo. Mantén el mismo encuadre y la misma luz.',
  back: 'Muestra la parte posterior completa. Aparta las manos de los detalles importantes.'
};
export const AGENT_PIPELINE = [
  { id: 'estratega', name: 'Estratega', icon: 'compass', label: 'Idea y plan', doing: 'Armando la estrategia' },
  { id: 'director-arte', name: 'Director de arte', icon: 'palette', label: 'Cuatro propuestas de imagen', doing: 'Dirigiendo las imágenes' },
  { id: 'copywriter', name: 'Copywriter', icon: 'pen', label: 'Titulares y copy', doing: 'Escribiendo titulares y copy' },
  { id: 'media-buyer', name: 'Media buyer', icon: 'megaphone', label: 'Pauta como borrador', doing: 'Preparando la pauta (borrador)' },
  { id: 'director-video', name: 'Director de video', icon: 'film', label: 'Tres hooks de video', doing: 'Escribiendo hooks de video' },
  { id: 'xr-designer', name: 'Diseñador XR', icon: 'cube', label: 'Anuncio XR de 4 vistas', doing: 'Montando el anuncio XR' },
  { id: 'guardian', name: 'Guardián', icon: 'shield', label: 'Nada se activa ni se gasta', doing: 'Verificando el guardián de pauta' },
  { id: 'revisor', name: 'Revisor', icon: 'check', label: 'Revisión final', doing: 'Revisando todo' }
];
export function agentName(id) {
  return AGENT_PIPELINE.find(a => a.id === id)?.name || 'Luma';
}
export const PAGE_STEP = { guide: -1, feed: -1, capture: 0, strategy: 1, brief: 2, gallery: 2, publish: 3, video: 3, ads: 4, data: 5, rec: -1, settings: -1 };

export function coachAdvice(s) {
  const photos = s.photos || {};
  const count = PHOTO_SLOTS.filter(([k]) => photos[k]).length;
  if (s.agents?.running) {
    const cur = s.agents.steps.find(x => x.status === 'running');
    return { mood: 'thinking', agent: cur?.agent || 'luma', text: cur ? `${agentName(cur.agent)}: ${AGENT_PIPELINE.find(a => a.id === cur.agent)?.doing || 'trabajando'}…` : 'Coordinando a mi equipo…', action: null, label: 'Trabajando…' };
  }
  if (s.busy) return { mood: 'thinking', agent: 'luma', text: s.job?.stage || 'Estoy preparando el siguiente paso. Puedes revisar el progreso.', action: null, label: 'Trabajando…' };
  if (s.pendingCapture) {
    const qa = s.photoQA?.pending;
    return {
      mood: qa && qa.verdict === 'repetir' ? 'alert' : 'review',
      agent: 'fotografa',
      text: qa ? (qa.verdict === 'buena' ? 'Se ve bien. Guárdala o repítela si quieres.' : qa.topFix) : '¿La toma conserva la forma y se ve nítida? Guarda si te convence o repítela.',
      action: 'capture-save',
      label: 'Guardar esta toma'
    };
  }
  if (s.captureCountdown) return { mood: 'thinking', agent: 'fotografa', text: 'Mantén el producto quieto. La foto se toma al terminar la cuenta.', action: null, label: 'Preparando foto' };
  if (s.page === 'capture' && !s.pendingCapture) {
    const last = s.photoQA?.[s.captureSlot];
    return count >= 4
      ? { mood: 'success', agent: 'fotografa', text: 'Tienes las 4 fotos. Ahora la IA las analiza y propone de qué hacer la publicación.', action: 'photos:done', label: 'Analizar fotos' }
      : { mood: last && last.verdict === 'repetir' ? 'alert' : 'idle', agent: 'fotografa', text: `${count}/4 fotos. ${CAPTURE_TIPS[s.captureSlot]}`, action: 'camera-hud', label: s.hudVisible ? 'Cerrar cámara' : 'Tomar foto' };
  }
  if (s.page === 'strategy')
    return s.strategyPlan
      ? { mood: 'success', agent: 'estratega', text: 'Elige una idea (la mía, una fecha del mes o la tuya) y creo las imágenes.', action: 'idea:create', label: 'Crear imágenes' }
      : { mood: 'idle', agent: 'estratega', text: 'Voy a mirar tus fotos para entender qué es el producto.', action: 'idea:analyze', label: 'Analizar fotos' };
  if (s.page === 'gallery' || s.page === 'brief')
    return { mood: 'review', agent: 'director-arte', text: s.selected.length ? 'Deja las imágenes que quieras publicar y sigue.' : 'Elige al menos una imagen.', action: s.selected.length ? 'nav:publish' : null, label: 'Publicar' };
  if (s.page === 'publish')
    return s.publishReceipt
      ? { mood: 'success', agent: 'copywriter', text: 'Listo. El siguiente paso es la pauta.', action: 'nav:ads', label: 'Crear pauta' }
      : s.confirm
        ? { mood: 'review', agent: 'copywriter', text: 'Revisa y confirma con el botón grande: yo no publico por ti.', action: null, label: 'Tú confirmas' }
        : { mood: 'review', agent: 'copywriter', text: 'Revisa el formato y el texto. Si quieres video, créalo antes.', action: 'confirm-publish', label: 'Revisar y publicar' };
  if (s.page === 'ads')
    return s.adsDone
      ? { mood: 'success', agent: 'media-buyer', text: 'Borrador listo y en pausa. Revísalo en Ads Manager.', action: 'nav:data', label: 'Ver resultados' }
      : { mood: 'idle', agent: 'media-buyer', text: 'Seguimos los mismos pasos de Instagram. Nada se activa desde aquí.', action: (s.adsWiz || 0) < 3 ? 'ads:next' : s.adsPlan?.result ? null : 'ads:plan2', label: (s.adsWiz || 0) < 3 ? 'Siguiente' : s.adsPlan?.result ? 'Tú lo envías' : 'Preparar' };
  if (s.page === 'data') return { mood: 'idle', agent: 'revisor', text: 'Estos son los datos reales. Se actualizan solos cada pocos minutos.', action: 'data:refresh', label: 'Actualizar' };
  if (s.page === 'rec') return { mood: 'idle', agent: 'luma', text: 'Graba, revisa y publica como historia o reel.', action: s.rec?.url ? null : s.rec?.on ? 'rec:stop' : 'rec:start', label: s.rec?.on ? 'Detener' : 'Grabar' };
  if (s.page === 'strategy_old')
    return {
      mood: 'idle',
      agent: 'estratega',
      text: s.strategyPlan ? 'Tenemos la idea. Si te gusta, pasamos a crear las imágenes con tus fotos.' : s.strategyProduct ? 'Listo. Pulsa continuar y propongo la campaña a partir de tus fotos.' : 'Cuéntame qué es el producto y qué quieres conseguir. Con una frase basta; yo ya vi tus fotos.',
      action: s.strategyProduct || s.strategyPlan ? 'strategy:express' : null,
      label: 'Proponer campaña'
    };
  if (s.page === 'capture') {
    const last = s.photoQA?.[s.captureSlot];
    return {
      mood: count === 4 ? 'success' : last && last.verdict === 'repetir' ? 'alert' : 'idle',
      agent: 'fotografa',
      text: count === 4 ? 'Cuatro vistas guardadas. Ahora las analizo y te propongo la campaña.' : last && last.verdict !== 'buena' ? last.topFix : count > 0 ? `${count}/4 vistas. Con las cuatro, la IA conserva mejor la forma. ${CAPTURE_TIPS[s.captureSlot]}` : CAPTURE_TIPS[s.captureSlot],
      action: count >= 1 ? 'nav:strategy' : null,
      label: count === 4 ? 'Proponer campaña' : 'Seguir con lo que hay'
    };
  }
  if (s.page === 'express') {
    const done = s.agents?.steps?.length && s.agents.steps.every(x => ['done', 'skipped', 'error'].includes(x.status));
    return {
      mood: done ? 'success' : 'idle',
      agent: 'luma',
      text: done ? 'Todo listo. Revisa cada pieza; yo no publico ni activo nada sin tu confirmación.' : s.mode === 'demo' ? 'Pulsa Crear todo: mi equipo prepara imágenes, copy, pauta (borrador), video y anuncio XR. Cuesta $0 en Demo.' : 'Modo real: te mostraré qué llamadas se harán antes de gastar.',
      action: done ? 'nav:results' : 'autopilot',
      label: done ? 'Ver resultados' : 'Crear todo'
    };
  }
  if (s.page === 'results' || s.page === 'review') {
    const r = s.review;
    return {
      mood: r ? (r.verdict === 'listo' ? 'success' : r.verdict === 'revisar' ? 'review' : 'alert') : 'review',
      agent: 'revisor',
      text: r ? (r.verdict === 'listo' ? `Revisión ${r.score}/100: todo en orden. Tú decides qué publicar.` : `Revisión ${r.score}/100: ${r.findings[0]?.message || 'hay cosas por revisar'}`) : 'Abre cada pieza para revisarla. Mi equipo propone; tú apruebas.',
      action: r ? 'nav:results' : 'open:review',
      label: r ? 'Volver a piezas' : 'Revisar con IA'
    };
  }
  if (s.page === 'brief') return { mood: 'idle', agent: 'director-arte', text: 'Revisa la dirección. Al crear, enviaremos las fotos y el encargo según el modo elegido.', action: null, label: 'Revisa el encargo' };
  if (s.page === 'gallery') return { mood: 'review', agent: 'director-arte', text: 'Compara proporciones y etiqueta. Tú eliges las imágenes; mis avisos son recomendaciones.', action: s.selected.length ? 'nav:publish' : null, label: s.selected.length ? 'Revisar publicación' : 'Elige tus favoritas' };
  if (s.page === 'publish')
    return {
      mood: s.publishReceipt?.verified ? 'success' : 'review',
      agent: 'copywriter',
      text: s.publishReceipt?.verified ? 'Instagram devolvió el enlace de tu publicación. Puedes abrirlo para verla.' : 'Comprueba cuenta, formato, imágenes y copy. Tú confirmas el envío a Instagram.',
      action: s.publishReceipt?.permalink ? 'open-publication' : null,
      label: s.publishReceipt?.permalink ? 'Abrir publicación' : 'Revisión final'
    };
  if (s.page === 'ads')
    return { mood: 'idle', agent: 'media-buyer', text: 'Analizaré tus imágenes y copy para proponer público, presupuesto y piezas. El borrador queda local: yo nunca activo pauta.', action: s.selected.length && s.adsStage === 'setup' ? 'ads:plan' : null, label: 'Preparar pauta' };
  if (s.page === 'video') {
    if (s.videoWatch && s.video)
      return { mood: 'review', agent: 'director-video', text: 'Paso 4 de 4: mira tu video. Si te gusta, elige Reel o Historia; todavía no se publica nada.', action: 'video:publish', label: 'Publicar como Reel' };
    if (s.videoPlan && s.busy)
      return { mood: 'thinking', agent: 'director-video', text: 'Paso 3 de 4: estoy creando tu video. Tarda de 1 a 3 minutos; no cierres esta pantalla.', action: null, label: 'Creando…' };
    if (s.videoPlan)
      return { mood: 'review', agent: 'director-video', text: 'Paso 2 de 4: elige un hook y pulsa «Crear video». Este paso sí genera el video con IA.', action: 'generate-video', label: 'Crear video' };
    return {
      mood: 'idle',
      agent: 'director-video',
      text: s.videoSelected?.length ? 'Paso 1 de 4: elige duración y pulsa «Buscar hooks con Luma». Aún no se gasta en video.' : 'Paso 1 de 4: elige la imagen que quieres animar.',
      action: s.videoSelected?.length ? 'video:plan' : null,
      label: 'Buscar hooks'
    };
  }
  if (s.page === 'xr') return { mood: 'idle', agent: 'xr-designer', text: 'Tus cuatro vistas forman un prisma que se gira con la mano. Pruébalo en escritorio o en las gafas; no usa IA ni cuesta nada.', action: 'xr:open', label: 'Abrir experiencia XR' };
  return { mood: 'idle', agent: 'luma', text: 'Estoy aquí para ayudarte a avanzar. Volvamos a la idea si quieres replantear la campaña.', action: 'nav:strategy', label: 'Ver idea' };
}
