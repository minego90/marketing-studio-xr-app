// Orquestador de mensajes de los personajes (Luma y los 6 de la oficina).
// Reglas:
//  1) UN solo mensaje a la vez, en cualquier lugar (los demás esperan en cola, en orden).
//  2) Solo hablan por una acción real: quien llama a say() es quien detectó esa acción (foto guardada, trabajo que
//     empieza o termina, error…). No hay charla de relleno.
//  3) Duración según el largo del texto; entre mensajes hay una pausa corta.
//  4) Los errores pasan al frente de la cola (sin cortar el mensaje que se está leyendo).
export function createOrchestra({ setTimer = setTimeout, clearTimer = clearTimeout, gapMs = 350, maxQueue = 4 } = {}) {
  const speakers = new Map();
  let queue = [],
    current = null,
    timer = null;
  const durFor = text => Math.min(5, Math.max(2.2, 1.6 + String(text).length * 0.05));
  const play = () => {
    if (current || !queue.length) return;
    const m = queue.shift(),
      sp = speakers.get(m.who);
    if (!sp) return play(); // hablante no registrado (p. ej. Luma sin XR): se descarta
    current = m;
    try {
      sp.show(m.text, m.dur, m);
    } catch {}
    timer = setTimer(() => {
      try {
        sp.hide();
      } catch {}
      current = null;
      timer = setTimer(play, gapMs);
    }, m.dur * 1000);
  };
  return {
    register(id, speaker) {
      speakers.set(id, speaker);
    },
    unregister(id) {
      speakers.delete(id);
    },
    say(who, text, { dur, priority = false, key = '' } = {}) {
      text = String(text || '').trim();
      if (!text || !speakers.has(who)) return false;
      const k = key || who + '|' + text;
      if ((current && (current.key === k)) || queue.some(m => m.key === k)) return false; // sin repetidos
      const m = { who, text, dur: dur || durFor(text), key: k, priority };
      if (priority) queue.unshift(m);
      else queue.push(m);
      while (queue.length > maxQueue) {
        // Si se acumulan, se descarta el más viejo (los errores no se descartan).
        const i = queue.findIndex(x => x !== m && !x.priority);
        queue.splice(i >= 0 ? i : 0, 1);
      }
      play();
      return true;
    },
    clear() {
      queue = [];
      if (current) speakers.get(current.who)?.hide?.();
      current = null;
      clearTimer(timer);
    },
    status: () => ({ speaking: current ? { who: current.who, text: current.text } : null, waiting: queue.map(m => ({ who: m.who, text: m.text })) })
  };
}
export const orchestra = createOrchestra();
