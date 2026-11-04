// Plano de la oficina en coordenadas de three.js (x derecha, y arriba, z hacia la cámara). Equivale a Blender (x, -z_b → z, z_b → y).
const PI = Math.PI;
export const LAYOUT = {
  bounds: { x0: -3.5, x1: 3.5, z0: -3.0, z1: 3.0 },
  obstacles: [
    { x0: -2.05, x1: -0.35, z0: -2.93, z1: -2.17 }, // mesa analítica
    { x0: -1.7, x1: -0.1, z0: -0.9, z1: -0.1 }, // mesa pauta
    { x0: -1.7, x1: -0.1, z0: 1.12, z1: 1.88 }, // mesa taller
    { x0: -3.33, x1: -2.57, z0: -0.35, z1: 1.15 }, // mesa redacción
    { x0: 1.65, x1: 3.05, z0: -2.1, z1: -0.7 }, // mesa revisión
    { x0: 2.68, x1: 3.48, z0: 0.28, z1: 1.08 }, // mesa del producto
    { x0: 2.8, x1: 3.25, z0: 2.4, z1: 2.85 }, // trípode
    { x0: -3.3, x1: -2.7, z0: -2.75, z1: -2.15 }, // palmera
    { x0: 1.6, x1: 3.3, z0: -2.95, z1: -2.55 } // estantería
  ],
  workers: {
    estudio: { x: 2.3, z: 1.6, yaw: Math.atan2(0.78, -0.92), standing: true },
    redaccion: { x: -2.25, z: 0.4, yaw: -PI / 2 },
    taller: { x: -0.9, z: 2.2, yaw: PI },
    pauta: { x: -0.9, z: 0.2, yaw: PI },
    analitica: { x: -1.2, z: -1.85, yaw: PI },
    revision: { x: 1.55, z: -1.4, yaw: PI / 2 }
  },
  extraChairs: [{ x: 2.35, z: -0.7, yaw: 0 }], // silla vacía de la sala de revisión
  zones: {
    estudio: { x: 3.0, z: 1.4, w: 1.4, d: 2.8, h: 1.4 },
    redaccion: { x: -2.95, z: 0.4, w: 0.9, d: 1.6, h: 1.3 },
    taller: { x: -0.9, z: 1.5, w: 1.8, d: 1.0, h: 1.3 },
    pauta: { x: -0.9, z: -0.5, w: 1.8, d: 1.0, h: 1.3 },
    analitica: { x: -1.2, z: -2.55, w: 1.9, d: 1.0, h: 1.45 },
    revision: { x: 2.35, z: -1.4, w: 1.6, d: 1.6, h: 1.1 }
  },
  pois: {
    tv: { x: 0.2, z: -1.8, fx: -1.4, fz: -1.05 },
    ventanas: [{ x: -3.1, z: 1.6, fx: -1, fz: 0 }, { x: -3.1, z: -1.2, fx: -1, fz: 0 }],
    celular: { x: 2.9, z: 0.0, fx: -1, fz: 0.3 },
    alejo: { x: 0.9, z: 0.4, fx: 1, fz: 0 },
    planta: { x: -2.4, z: -2.0, fx: -0.7, fz: -0.6 },
    estanteria: { x: 2.4, z: -2.1, fx: 0, fz: -1 },
    paseo: [{ x: 0.9, z: -0.2 }, { x: 1.8, z: 0.3 }, { x: 0.4, z: 1.6 }, { x: 2.0, z: 2.2 }, { x: -2.0, z: 2.4 }, { x: 0.0, z: 2.4 }]
  },
  tv: { x: -1.2, y: 1.9, z: -2.812, w: 1.54, h: 0.87 },
  monitors: [
    { x: -1.525, y: 1.07, z: -2.68, ry: 0, role: 'analitica' }, { x: -0.875, y: 1.07, z: -2.68, ry: 0, role: 'analitica' },
    { x: -1.225, y: 1.07, z: -0.63, ry: 0, role: 'pauta' }, { x: -0.575, y: 1.07, z: -0.63, ry: 0, role: 'pauta' },
    { x: -0.9, y: 1.07, z: 1.37, ry: 0, role: 'taller' },
    { x: -3.08, y: 1.07, z: 0.4, ry: PI / 2, role: 'redaccion' }
  ],
  dog: { x: 1.2, z: 0.9 }
};
