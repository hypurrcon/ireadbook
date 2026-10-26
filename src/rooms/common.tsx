import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { proceduralTexture, rng } from '../three/textures';
import { CASE_W, CASE_D } from '../three/Bookcase';
import type { Quality } from '../db/types';

export const WALL_Z = -CASE_D / 2 - 0.02;
export const pcount = (q: Quality, n: number) => Math.round(n * (q === 'low' ? 0.35 : q === 'mid' ? 0.7 : 1));

// ---------------- surfaces ----------------
export type Paint = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export const paints = {
  plaster: (base: string, speck = 0.05): Paint => (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    const r = rng(11);
    for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * speck})`; ctx.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3); }
  },
  planks: (base: string, n = 6, vertical = false): Paint => (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    const r = rng(5);
    const len = vertical ? w : h;
    for (let i = 0; i < n; i++) {
      const p = (i / n) * len;
      ctx.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.1})`;
      if (vertical) ctx.fillRect(p, 0, len / n, h); else ctx.fillRect(0, p, w, len / n);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      if (vertical) ctx.fillRect(p, 0, 2, h); else ctx.fillRect(0, p, w, 2);
      for (let k = 0; k < 18; k++) {
        ctx.strokeStyle = `rgba(0,0,0,${0.04 + r() * 0.08})`;
        ctx.beginPath();
        const o = p + r() * (len / n);
        if (vertical) { ctx.moveTo(o, 0); ctx.lineTo(o + (r() - 0.5) * 6, h); } else { ctx.moveTo(0, o); ctx.lineTo(w, o + (r() - 0.5) * 6); }
        ctx.stroke();
      }
    }
  },
  brick: (base: string, mortar: string): Paint => (ctx, w, h) => {
    ctx.fillStyle = mortar; ctx.fillRect(0, 0, w, h);
    const r = rng(9);
    const bh = h / 8, bw = w / 4;
    for (let row = 0; row < 8; row++) for (let col = -1; col < 5; col++) {
      const x = col * bw + (row % 2 ? bw / 2 : 0);
      const c = new THREE.Color(base).offsetHSL(0, (r() - 0.5) * 0.06, (r() - 0.5) * 0.08);
      ctx.fillStyle = `#${c.getHexString()}`;
      ctx.fillRect(x + 3, row * bh + 3, bw - 6, bh - 6);
    }
  },
  tiles: (a: string, b: string, n = 8): Paint => (ctx, w, h) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { ctx.fillStyle = (x + y) % 2 ? a : b; ctx.fillRect((x * w) / n, (y * h) / n, w / n + 1, h / n + 1); }
  },
  tatami: (base: string, edge: string): Paint => (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { ctx.fillStyle = `rgba(80,70,30,${0.05 + (y % 6 ? 0 : 0.06)})`; ctx.fillRect(0, y, w, 1); }
    ctx.fillStyle = edge; ctx.fillRect(0, 0, w, 10); ctx.fillRect(0, h - 10, w, 10);
  },
  panel: (base: string, line: string): Paint => (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = line; ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = line;
    for (const [x, y] of [[18, 18], [w - 18, 18], [18, h - 18], [w - 18, h - 18]]) { ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); }
  },
  stripes: (a: string, b: string, n = 10): Paint => (ctx, w, h) => {
    for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? a : b; ctx.fillRect((i * w) / n, 0, w / n + 1, h); }
  },
};

export function useSurface(key: string, paint: Paint, repeat: [number, number] = [1, 1], size = 256) {
  return useMemo(() => {
    const t = proceduralTexture(`${key}`, size, size, paint, repeat);
    return t;
  }, [key]);
}

export function Plane({ w, h, position, rotation, color = '#ffffff', map, rough = 0.9, metal = 0, emissive, emissiveIntensity = 1, basic, transparent, opacity, side }: {
  w: number; h: number; position: [number, number, number]; rotation?: [number, number, number]; color?: string; map?: THREE.Texture | null;
  rough?: number; metal?: number; emissive?: string; emissiveIntensity?: number; basic?: boolean; transparent?: boolean; opacity?: number; side?: THREE.Side;
}) {
  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <planeGeometry args={[w, h]} />
      {basic
        ? <meshBasicMaterial color={color} map={map ?? null} transparent={transparent} opacity={opacity} toneMapped={false} side={side} />
        : <meshStandardMaterial color={color} map={map ?? null} roughness={rough} metalness={metal} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? emissiveIntensity : 0} transparent={transparent} opacity={opacity} side={side} />}
    </mesh>
  );
}

export function Box({ size, position, rotation, color, rough = 0.8, metal = 0, map, emissive, emissiveIntensity = 1, cast = true }: {
  size: [number, number, number]; position: [number, number, number]; rotation?: [number, number, number]; color: string; rough?: number; metal?: number; map?: THREE.Texture | null; emissive?: string; emissiveIntensity?: number; cast?: boolean;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow={cast} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={rough} metalness={metal} map={map ?? null} emissive={emissive ?? '#000'} emissiveIntensity={emissive ? emissiveIntensity : 0} />
    </mesh>
  );
}

/** Standard room shell: floor, back wall, optional side walls. Spans the bookcases. */
export function Shell({ width, wall, floor, height = 3.2, sides = true, wallMap, floorMap, ceiling }: {
  width: number; wall: string; floor: string; height?: number; sides?: boolean; wallMap?: THREE.Texture; floorMap?: THREE.Texture; ceiling?: string;
}) {
  const W = width + 6;
  const cx = width / 2;
  return (
    <group>
      <Plane w={W} h={8} position={[cx, 0, 2]} rotation={[-Math.PI / 2, 0, 0]} color={floor} map={floorMap} rough={0.85} />
      <Plane w={W} h={height} position={[cx, height / 2, WALL_Z]} color={wall} map={wallMap} />
      {ceiling && <Plane w={W} h={8} position={[cx, height, 2]} rotation={[Math.PI / 2, 0, 0]} color={ceiling} />}
      {sides && <Plane w={8} h={height} position={[cx - W / 2, height / 2, 2]} rotation={[0, Math.PI / 2, 0]} color={wall} map={wallMap} />}
      {sides && <Plane w={8} h={height} position={[cx + W / 2, height / 2, 2]} rotation={[0, -Math.PI / 2, 0]} color={wall} map={wallMap} />}
    </group>
  );
}

// ---------------- windows & outside views ----------------
export function canvasTexture(key: string, w: number, h: number, draw: Paint) { return proceduralTexture(key, w, h, draw); }

export const outside = {
  rainyNight: () => canvasTexture('out:rainyNight', 256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1a2233'); g.addColorStop(1, '#2d3446');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const r = rng(2);
    ctx.fillStyle = '#12161f';
    for (let x = 0; x < w; x += 18) { const bh = 40 + r() * 60; ctx.fillRect(x, h - bh, 16, bh); }
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,${180 + r() * 60},120,${0.3 + r() * 0.5})`; ctx.fillRect(r() * w, h - r() * 90, 2, 3); }
  }),
  rainyDay: () => canvasTexture('out:rainyDay', 256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8d9aa6'); g.addColorStop(1, '#b6bec4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#6f7a80';
    const r = rng(4);
    for (let x = 0; x < w; x += 22) { const bh = 30 + r() * 50; ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 11, h - bh); ctx.lineTo(x + 22, h); ctx.fill(); }
  }),
  city: (night: boolean) => canvasTexture('out:city:' + night, 512, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (night) { g.addColorStop(0, '#0b0820'); g.addColorStop(0.6, '#2a0f3a'); g.addColorStop(1, '#4a1340'); } else { g.addColorStop(0, '#6f86a8'); g.addColorStop(1, '#c9a98f'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const r = rng(8);
    for (let layer = 0; layer < 3; layer++) {
      const shade = night ? ['#140d26', '#0f0a1c', '#08060f'][layer] : ['#5a6a80', '#46536a', '#323c4e'][layer];
      for (let x = -10; x < w; x += 26 + r() * 30) {
        const bw = 22 + r() * 40, bh = 120 + r() * (220 + layer * 80);
        ctx.fillStyle = shade; ctx.fillRect(x, h - bh, bw, bh);
        if (night) for (let k = 0; k < bh / 9; k++) for (let j = 0; j < bw / 8; j++) if (r() < 0.22) {
          ctx.fillStyle = r() < 0.15 ? '#ff3d7f' : r() < 0.25 ? '#2ef2ff' : '#ffd38a';
          ctx.globalAlpha = 0.5 + r() * 0.5; ctx.fillRect(x + 3 + j * 8, h - bh + 6 + k * 9, 4, 5); ctx.globalAlpha = 1;
        }
      }
    }
  }),
  garden: (night: boolean) => canvasTexture('out:garden:' + night, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = night ? '#1b2333' : '#cfe3e8'; ctx.fillRect(0, 0, w, h);
    const r = rng(12);
    ctx.fillStyle = night ? '#18241d' : '#7fa37a'; ctx.fillRect(0, h * 0.65, w, h);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = night ? '#2a2230' : `hsl(${340 + r() * 15},${55 + r() * 20}%,${78 + r() * 8}%)`;
      ctx.beginPath(); ctx.arc(r() * w, h * (0.3 + r() * 0.3), 30 + r() * 30, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = night ? '#0f0b10' : '#5b4337'; ctx.fillRect(w * 0.45, h * 0.45, 10, h * 0.3);
  }),
  forest: (night: boolean) => canvasTexture('out:forest:' + night, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = night ? '#0d1622' : '#bcd6c5'; ctx.fillRect(0, 0, w, h);
    const r = rng(21);
    for (let l = 0; l < 3; l++) for (let i = 0; i < 12; i++) {
      const x = r() * w, s = 20 + r() * 40 + l * 10;
      ctx.fillStyle = night ? ['#16261e', '#10201a', '#0a1510'][l] : ['#7fa88a', '#5d8a68', '#3f6b4c'][l];
      ctx.beginPath(); ctx.moveTo(x, h * 0.25 + l * 30); ctx.lineTo(x - s, h); ctx.lineTo(x + s, h); ctx.fill();
    }
  }),
  earth: () => canvasTexture('out:earth', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#02040a'; ctx.fillRect(0, 0, w, h);
    const r = rng(31);
    for (let i = 0; i < 300; i++) { ctx.fillStyle = `rgba(255,255,255,${r()})`; ctx.fillRect(r() * w, r() * h, 1.2, 1.2); }
    const g = ctx.createRadialGradient(w * 0.62, h * 1.25, h * 0.55, w * 0.62, h * 1.25, h * 0.92);
    g.addColorStop(0, '#2c6ea3'); g.addColorStop(0.85, '#5aa3d6'); g.addColorStop(0.93, '#bfe3ff'); g.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w * 0.62, h * 1.25, h * 0.92, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 24; i++) { ctx.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.35})`; ctx.beginPath(); ctx.ellipse(w * (0.25 + r() * 0.7), h * (0.55 + r() * 0.4), 20 + r() * 50, 5 + r() * 9, -0.3, 0, Math.PI * 2); ctx.fill(); }
    for (let i = 0; i < 10; i++) { ctx.fillStyle = `rgba(60,110,60,${0.5})`; ctx.beginPath(); ctx.ellipse(w * (0.35 + r() * 0.5), h * (0.62 + r() * 0.35), 25 + r() * 35, 12 + r() * 16, r(), 0, Math.PI * 2); ctx.fill(); }
  }),
  sea: () => canvasTexture('out:sea', 256, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1f7c93'); g.addColorStop(0.6, '#0b4459'); g.addColorStop(1, '#03202c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const r = rng(41);
    for (let i = 0; i < 8; i++) { const x = r() * w; const gr = ctx.createLinearGradient(x, 0, x + 40, h); gr.addColorStop(0, 'rgba(200,255,250,.18)'); gr.addColorStop(1, 'rgba(200,255,250,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 90, h); ctx.lineTo(x + 40, h); ctx.fill(); }
    ctx.fillStyle = '#0a3340';
    for (let x = 0; x < w; x += 14) { const hh = 30 + r() * 60; ctx.fillRect(x, h - hh, 6, hh); }
  }),
  street: (night: boolean) => canvasTexture('out:street2:' + night, 512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (night) { g.addColorStop(0, '#1b2140'); g.addColorStop(0.7, '#4a3a5a'); g.addColorStop(1, '#8a5a4a'); } else { g.addColorStop(0, '#cfe0ea'); g.addColorStop(1, '#eef0e8'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const r = rng(51);
    for (let x = 0; x < w; x += 60 + r() * 40) {
      const top = h * (0.1 + r() * 0.15);
      ctx.fillStyle = night ? '#232838' : ['#c9b9a6', '#b7c4b5', '#d6c7a1'][Math.floor(r() * 3)];
      ctx.fillRect(x, top, 56, h * 0.77 - top);
      for (let yy = top + 10; yy < h * 0.7; yy += 26) for (let k = 0; k < 3; k++) {
        ctx.fillStyle = night ? (r() < 0.65 ? '#ffcf7a' : '#394056') : '#8fa0ad';
        ctx.fillRect(x + 8 + k * 16, yy, 10, 16);
      }
    }
    ctx.fillStyle = night ? '#141821' : '#9c9a94'; ctx.fillRect(0, h * 0.77, w, h);
    if (night) for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(255,214,140,.9)'; ctx.beginPath(); ctx.arc(r() * w, h * 0.74, 2.5, 0, Math.PI * 2); ctx.fill(); }
  }),
};

export function WindowFrame({ position, w, h, frame, view, round, bars = true, glass = 0.08, depth = 0.08 }: {
  position: [number, number, number]; w: number; h: number; frame: string; view: THREE.Texture; round?: boolean; bars?: boolean; glass?: number; depth?: number;
}) {
  const t = 0.05;
  return (
    <group position={position}>
      {round ? (
        <>
          <mesh position={[0, 0, -0.01]}><circleGeometry args={[w / 2, 48]} /><meshBasicMaterial map={view} toneMapped={false} /></mesh>
          <mesh><torusGeometry args={[w / 2, t * 0.7, 12, 48]} /><meshStandardMaterial color={frame} roughness={0.7} /></mesh>
          {bars && <><Box size={[w, t * 0.5, 0.03]} position={[0, 0, 0]} color={frame} /><Box size={[t * 0.5, w, 0.03]} position={[0, 0, 0]} color={frame} /></>}
          <mesh position={[0, 0, 0.005]}><circleGeometry args={[w / 2, 48]} /><meshStandardMaterial color="#cfe3ff" transparent opacity={glass} roughness={0.1} /></mesh>
        </>
      ) : (
        <>
          <mesh position={[0, 0, 0]}><planeGeometry args={[w, h]} /><meshBasicMaterial map={view} toneMapped={false} /></mesh>
          <Box size={[w + t * 2, t, depth]} position={[0, h / 2 + t / 2, depth / 2]} color={frame} />
          <Box size={[w + t * 2.6, t, depth + 0.06]} position={[0, -h / 2 - t / 2, depth / 2 + 0.03]} color={frame} />
          <Box size={[t, h, depth]} position={[-w / 2 - t / 2, 0, depth / 2]} color={frame} />
          <Box size={[t, h, depth]} position={[w / 2 + t / 2, 0, depth / 2]} color={frame} />
          {bars && <><Box size={[t * 0.5, h, 0.02]} position={[0, 0, 0.02]} color={frame} /><Box size={[w, t * 0.5, 0.02]} position={[0, 0, 0.02]} color={frame} /></>}
          <mesh position={[0, 0, 0.03]}><planeGeometry args={[w, h]} /><meshStandardMaterial color="#d8ecff" transparent opacity={glass} roughness={0.05} metalness={0.2} /></mesh>
        </>
      )}
    </group>
  );
}

// ---------------- particles ----------------
type PState = { p: Float32Array; v: Float32Array; s: Float32Array };

export function Particles({ count, area, color, size = 0.02, speed = [0, -1, 0], jitter = 0.2, spin, kind = 'point', twinkle, opacity = 0.9, additive, shape }: {
  count: number; area: [number, number, number, number, number, number]; // x0,x1,y0,y1,z0,z1
  color: string; size?: number; speed?: [number, number, number]; jitter?: number; spin?: boolean; kind?: 'point' | 'streak' | 'petal';
  twinkle?: boolean; opacity?: number; additive?: boolean; shape?: 'round' | 'square';
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const st = useMemo<PState>(() => {
    const r = rng(count * 13 + area[0] * 7);
    const p = new Float32Array(count * 3), v = new Float32Array(count * 3), s = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      p[i * 3] = area[0] + r() * (area[1] - area[0]);
      p[i * 3 + 1] = area[2] + r() * (area[3] - area[2]);
      p[i * 3 + 2] = area[4] + r() * (area[5] - area[4]);
      v[i * 3] = speed[0] * (1 + (r() - 0.5) * jitter * 2);
      v[i * 3 + 1] = speed[1] * (1 + (r() - 0.5) * jitter * 2);
      v[i * 3 + 2] = speed[2] * (1 + (r() - 0.5) * jitter * 2);
      s[i] = r() * Math.PI * 2;
    }
    return { p, v, s };
  }, [count]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(() => {
    if (kind === 'streak') return new THREE.BoxGeometry(size * 0.12, size * 3, size * 0.12);
    if (kind === 'petal') return new THREE.CircleGeometry(size, 6).scale(1, 0.62, 1);
    return shape === 'square' ? new THREE.PlaneGeometry(size, size) : new THREE.CircleGeometry(size, 8);
  }, [kind, size, shape]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false }), [color, opacity, additive]);
  useFrame(({ clock }, dt) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    const d = Math.min(dt, 0.05);
    for (let i = 0; i < count; i++) {
      const k = i * 3;
      st.p[k] += st.v[k] * d + (kind === 'petal' || twinkle ? Math.sin(t * 0.9 + st.s[i]) * 0.002 : 0);
      st.p[k + 1] += st.v[k + 1] * d;
      st.p[k + 2] += st.v[k + 2] * d;
      for (let a = 0; a < 3; a++) {
        const lo = area[a * 2], hi = area[a * 2 + 1];
        if (st.p[k + a] < lo) st.p[k + a] = hi; else if (st.p[k + a] > hi) st.p[k + a] = lo;
      }
      dummy.position.set(st.p[k], st.p[k + 1], st.p[k + 2]);
      if (spin) dummy.rotation.set(t * 0.8 + st.s[i], t * 1.3 + st.s[i], 0); else dummy.rotation.set(0, 0, 0);
      const sc = twinkle ? 0.45 + 0.55 * Math.max(0, Math.sin(t * 1.7 + st.s[i] * 3)) : 1;
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} />;
}

// ---------------- light fixtures & props ----------------
export function Bulb({ position, color, intensity = 1.5, distance = 5, size = 0.035, shadows, flicker }: { position: [number, number, number]; color: string; intensity?: number; distance?: number; size?: number; shadows?: boolean; flicker?: boolean }) {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (flicker && light.current) light.current.intensity = intensity * (0.86 + Math.sin(clock.elapsedTime * 13) * 0.05 + Math.sin(clock.elapsedTime * 7.3) * 0.06 + Math.random() * 0.04);
  });
  return (
    <group position={position}>
      <mesh><sphereGeometry args={[size, 16, 12]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      <pointLight ref={light} color={color} intensity={intensity} distance={distance} decay={1.6} castShadow={shadows} shadow-mapSize={[512, 512]} shadow-bias={-0.002} />
    </group>
  );
}

export function PendantLamp({ position, shade, color, intensity = 2, shadows, cord = 0.6 }: { position: [number, number, number]; shade: string; color: string; intensity?: number; shadows?: boolean; cord?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, cord / 2 + 0.08, 0]}><cylinderGeometry args={[0.004, 0.004, cord, 6]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh position={[0, 0.05, 0]} castShadow><coneGeometry args={[0.14, 0.13, 24, 1, true]} /><meshStandardMaterial color={shade} side={THREE.DoubleSide} roughness={0.6} emissive={color} emissiveIntensity={0.08} /></mesh>
      <Bulb position={[0, 0, 0]} color={color} intensity={intensity} shadows={shadows} />
    </group>
  );
}

export function Candle({ position, shadows }: { position: [number, number, number]; shadows?: boolean }) {
  const flame = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (flame.current) { const t = clock.elapsedTime; flame.current.scale.set(1 + Math.sin(t * 17) * 0.08, 1 + Math.sin(t * 11) * 0.15, 1); } });
  return (
    <group position={position}>
      <mesh position={[0, 0.04, 0]} castShadow><cylinderGeometry args={[0.018, 0.02, 0.08, 14]} /><meshStandardMaterial color="#efe6d2" roughness={0.6} /></mesh>
      <mesh ref={flame} position={[0, 0.095, 0]}><sphereGeometry args={[0.009, 10, 8]} /><meshBasicMaterial color="#ffcf6e" toneMapped={false} /></mesh>
      <Bulb position={[0, 0.11, 0]} color="#ffb85c" intensity={0.9} distance={2.4} size={0.001} flicker shadows={shadows} />
    </group>
  );
}

export function Plant({ position, scale = 1, pot = '#b5653d', leaf = '#4e7a4a' }: { position: [number, number, number]; scale?: number; pot?: string; leaf?: string }) {
  const leaves = useMemo(() => { const r = rng(77); return Array.from({ length: 9 }, () => ({ a: r() * Math.PI * 2, t: 0.35 + r() * 0.6, l: 0.12 + r() * 0.1 })); }, []);
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.06, 0]} castShadow><cylinderGeometry args={[0.07, 0.055, 0.12, 18]} /><meshStandardMaterial color={pot} roughness={0.8} /></mesh>
      {leaves.map((l, i) => (
        <mesh key={'s' + i} position={[Math.cos(l.a) * 0.06, 0.13 + l.l * 0.5, Math.sin(l.a) * 0.06]} rotation={[Math.sin(l.a) * l.t, l.a, -Math.cos(l.a) * l.t]} scale={[0.6, l.l * 7, 0.15]} castShadow>
          <sphereGeometry args={[0.035, 8, 6]} />
          <meshStandardMaterial color={leaf} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

export function Mug({ position, color = '#e9e2d4', steam }: { position: [number, number, number]; color?: string; steam?: boolean }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.045, 0]} castShadow><cylinderGeometry args={[0.035, 0.032, 0.09, 20]} /><meshStandardMaterial color={color} roughness={0.4} /></mesh>
      <mesh position={[0.04, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.02, 0.006, 8, 16, Math.PI]} /><meshStandardMaterial color={color} roughness={0.4} /></mesh>
      <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.03, 16]} /><meshStandardMaterial color="#3b2416" roughness={0.3} /></mesh>
      {steam && <Particles count={10} area={[-0.02, 0.02, 0.09, 0.3, -0.02, 0.02]} color="#ffffff" size={0.012} speed={[0, 0.06, 0]} opacity={0.18} twinkle />}
    </group>
  );
}

export function Cat({ position, color = '#2b2522', rotation = 0 }: { position: [number, number, number]; color?: string; rotation?: number }) {
  const tail = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (tail.current) tail.current.rotation.z = Math.sin(clock.elapsedTime * 1.4) * 0.25 - 0.4; });
  const m = <meshStandardMaterial color={color} roughness={0.85} />;
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={0.9}>
      <mesh position={[0, 0.07, 0]} scale={[1, 1.15, 0.85]} castShadow><sphereGeometry args={[0.07, 16, 12]} />{m}</mesh>
      <mesh position={[0, 0.17, 0.02]} castShadow><sphereGeometry args={[0.045, 16, 12]} />{m}</mesh>
      <mesh position={[-0.025, 0.21, 0.02]} rotation={[0, 0, 0.3]}><coneGeometry args={[0.016, 0.035, 4]} />{m}</mesh>
      <mesh position={[0.025, 0.21, 0.02]} rotation={[0, 0, -0.3]}><coneGeometry args={[0.016, 0.035, 4]} />{m}</mesh>
      <mesh position={[-0.016, 0.175, 0.062]}><sphereGeometry args={[0.006, 8, 6]} /><meshBasicMaterial color="#d8e86a" toneMapped={false} /></mesh>
      <mesh position={[0.016, 0.175, 0.062]}><sphereGeometry args={[0.006, 8, 6]} /><meshBasicMaterial color="#d8e86a" toneMapped={false} /></mesh>
      <group ref={tail} position={[0.05, 0.02, -0.03]}>
        <mesh position={[0.06, 0.0, 0]} rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.011, 0.12, 4, 8]} />{m}</mesh>
      </group>
    </group>
  );
}

export function Globe({ position }: { position: [number, number, number] }) {
  const g = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += dt * 0.2; });
  const tex = useMemo(() => outside.earth(), []);
  return (
    <group position={position}>
      <mesh position={[0, 0.01, 0]}><cylinderGeometry args={[0.05, 0.06, 0.02, 16]} /><meshStandardMaterial color="#5a3f28" /></mesh>
      <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.006, 0.006, 0.1, 6]} /><meshStandardMaterial color="#b08a46" metalness={0.7} roughness={0.3} /></mesh>
      <mesh ref={g} position={[0, 0.16, 0]} castShadow><sphereGeometry args={[0.08, 24, 16]} /><meshStandardMaterial map={tex} roughness={0.6} /></mesh>
      <mesh position={[0, 0.16, 0]} rotation={[0, 0, 0.4]}><torusGeometry args={[0.088, 0.003, 6, 32, Math.PI]} /><meshStandardMaterial color="#b08a46" metalness={0.7} roughness={0.3} /></mesh>
    </group>
  );
}

export function Clock({ position, face = '#efe6d2', rim = '#3a2a1e' }: { position: [number, number, number]; face?: string; rim?: string }) {
  const hand = useRef<THREE.Mesh>(null);
  const hand2 = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const d = new Date();
    if (hand.current) hand.current.rotation.z = -((d.getMinutes() + d.getSeconds() / 60) / 60) * Math.PI * 2;
    if (hand2.current) hand2.current.rotation.z = -(((d.getHours() % 12) + d.getMinutes() / 60) / 12) * Math.PI * 2;
  });
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.11, 0.11, 0.02, 32]} /><meshStandardMaterial color={rim} /></mesh>
      <mesh position={[0, 0, 0.011]}><circleGeometry args={[0.095, 32]} /><meshStandardMaterial color={face} /></mesh>
      <mesh ref={hand} position={[0, 0, 0.014]}><planeGeometry args={[0.006, 0.16]} /><meshBasicMaterial color="#1b1714" /></mesh>
      <mesh ref={hand2} position={[0, 0, 0.015]}><planeGeometry args={[0.008, 0.1]} /><meshBasicMaterial color="#1b1714" /></mesh>
    </group>
  );
}

export function Stack({ position, colors = ['#7a3b2e', '#2f4b6e', '#8a6a2f'] }: { position: [number, number, number]; colors?: string[] }) {
  return (
    <group position={position}>
      {colors.map((c, i) => <Box key={i} size={[0.2 - i * 0.015, 0.03, 0.14 - i * 0.008]} position={[(i % 2) * 0.01, 0.015 + i * 0.031, 0]} rotation={[0, (i - 1) * 0.12, 0]} color={c} />)}
    </group>
  );
}

export function Rug({ position, w, d, color, border }: { position: [number, number, number]; w: number; d: number; color: string; border?: string }) {
  const tex = useMemo(() => proceduralTexture(`rug:${color}:${border}`, 256, 256, (ctx, W, H) => {
    ctx.fillStyle = border ?? color; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = color; ctx.fillRect(18, 18, W - 36, H - 36);
    ctx.strokeStyle = border ?? '#000'; ctx.globalAlpha = 0.5; ctx.lineWidth = 3;
    ctx.strokeRect(36, 36, W - 72, H - 72); ctx.globalAlpha = 1;
    for (let i = 0; i < 1500; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  }), [color, border]);
  return <Plane w={w} h={d} position={position} rotation={[-Math.PI / 2, 0, 0]} map={tex} rough={1} />;
}

/** Decor items the user can place (some unlock through achievements). */
export const DECOR_IDS = ['plant', 'mug', 'cat', 'globe', 'candle', 'clock', 'stack'] as const;
export type DecorId = typeof DECOR_IDS[number];

export function Decor({ ids, caseH, shadows }: { ids: string[]; caseH: number; shadows?: boolean }) {
  const right = CASE_W / 2 + 0.02;
  const items: Record<string, ReactNode> = {
    plant: <Plant key="plant" position={[-CASE_W / 2 - 0.2, 0, 0.25]} scale={1.6} />,
    mug: <Mug key="mug" position={[CASE_W / 2 - 0.12, caseH, 0.02]} steam />,
    cat: <Cat key="cat" position={[CASE_W / 2 + 0.22, 0, 0.35]} rotation={-0.5} />,
    globe: <Globe key="globe" position={[-CASE_W / 2 + 0.13, caseH, 0]} />,
    candle: <Candle key="candle" position={[right - 0.24, caseH, 0.05]} shadows={shadows} />,
    clock: <Clock key="clock" position={[0, caseH + 0.42, WALL_Z + 0.02]} />,
    stack: <Stack key="stack" position={[CASE_W / 2 + 0.25, 0, 0.1]} />,
  };
  return <>{ids.map((id) => items[id] ?? null)}</>;
}
