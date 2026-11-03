// Fechas comerciales para Colombia. Las móviles se calculan por regla; revisa la fecha oficial del año.
const nth = (y, m, dow, n) => { const d = new Date(y, m, 1); const off = (dow - d.getDay() + 7) % 7; return new Date(y, m, 1 + off + (n - 1) * 7); };
const last = (y, m, dow) => { const d = new Date(y, m + 1, 0); return new Date(y, m, d.getDate() - ((d.getDay() - dow + 7) % 7)); };
function easter(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return new Date(y, mo - 1, da); }
export function datesFor(y) {
  const E = easter(y), sv = new Date(E); sv.setDate(E.getDate() - 7);
  const bf = nth(y, 10, 5, 4), cm = new Date(bf); cm.setDate(bf.getDate() + 3);
  return [
    [new Date(y, 0, 1), 'Año nuevo', 'Propósitos y nuevos comienzos'],
    [new Date(y, 0, 6), 'Reyes Magos', 'Regalos y tradición familiar'],
    [new Date(y, 1, 14), 'San Valentín', 'Regalos y detalles para el ser querido'],
    [new Date(y, 2, 8), 'Día de la Mujer', 'Reconocimiento y mujeres referentes'],
    [new Date(y, 2, 19), 'Día del Hombre', 'Detalles para ellos'],
    [sv, 'Semana Santa', 'Descanso, viaje y familia'],
    [new Date(y, 3, 23), 'Día del Idioma', 'Palabras, cultura y creatividad'],
    [last(y, 3, 6), 'Día del Niño', 'Juego, sorpresa y familia'],
    [new Date(y, 4, 1), 'Día del Trabajo', 'Reconocer el esfuerzo'],
    [nth(y, 4, 0, 2), 'Día de la Madre', 'El regalo para mamá'],
    [nth(y, 5, 0, 3), 'Día del Padre', 'Regalos para papá'],
    [new Date(y, 6, 20), 'Independencia', 'Orgullo y producto local'],
    [new Date(y, 7, 7), 'Batalla de Boyacá', 'Puente festivo y viaje'],
    [nth(y, 8, 6, 3), 'Amor y Amistad', 'Amigos secretos y detalles'],
    [new Date(y, 9, 31), 'Halloween', 'Disfraces, misterio y diversión'],
    [bf, 'Black Friday', 'Ofertas del año'],
    [cm, 'Cyber Monday', 'Ofertas en línea'],
    [new Date(y, 11, 7), 'Día de las Velitas', 'Inicio de la Navidad'],
    [new Date(y, 11, 16), 'Novenas', 'Familia y tradición'],
    [new Date(y, 11, 25), 'Navidad', 'Regalos y reunión'],
    [new Date(y, 11, 31), 'Fin de año', 'Balance y celebración']
  ];
}
// Próximas fechas desde "now" (incluye hoy), las `n` más cercanas.
export function upcoming(now = new Date(), n = 4) {
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return [...datesFor(now.getFullYear()), ...datesFor(now.getFullYear() + 1)]
    .filter(([d]) => d >= t0)
    .sort((a, b) => a[0] - b[0])
    .slice(0, n)
    .map(([d, label, idea]) => ({ date: d, label, idea, days: Math.round((d - t0) / 864e5) }));
}
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const shortDate = d => `${d.getDate()} ${MES[d.getMonth()]}`;
