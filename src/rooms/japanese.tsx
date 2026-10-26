import { useMemo } from 'react';
import type { RoomDef, SceneProps } from './types';
import { TOKENS } from './tokens';
import { Shell, paints, useSurface, Decor, Box, Plane, WALL_Z, Particles, pcount, outside, Bulb } from './common';
import { CASE_W } from '../three/Bookcase';
import { proceduralTexture } from '../three/textures';

function Shoji({ position, w, h, glow }: { position: [number, number, number]; w: number; h: number; glow: number }) {
  const tex = useMemo(() => proceduralTexture('shoji', 256, 512, (ctx, W, H) => {
    ctx.fillStyle = '#f3ecd9'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 800; i++) { ctx.fillStyle = `rgba(160,140,100,${Math.random() * 0.05})`; ctx.fillRect(Math.random() * W, Math.random() * H, 3, 3); }
    ctx.fillStyle = '#5a4330';
    for (let x = 0; x <= 4; x++) ctx.fillRect((x * W) / 4 - 3, 0, 6, H);
    for (let y = 0; y <= 8; y++) ctx.fillRect(0, (y * H) / 8 - 3, W, 6);
  }), []);
  return <Plane w={w} h={h} position={position} map={tex} emissive="#fff3d6" emissiveIntensity={glow} rough={1} />;
}

function Scroll({ position }: { position: [number, number, number] }) {
  const tex = useMemo(() => proceduralTexture('scroll', 128, 384, (ctx, W, H) => {
    ctx.fillStyle = '#e9e1cc'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#6b5a3c'; ctx.fillRect(0, 0, W, 40); ctx.fillRect(0, H - 40, W, 40);
    ctx.strokeStyle = '#2b2622'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(30, 130); ctx.quadraticCurveTo(70, 90, 100, 150); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40, 200); ctx.lineTo(95, 210); ctx.stroke();
    ctx.fillStyle = '#b8432f'; ctx.fillRect(84, 280, 18, 18);
    ctx.globalAlpha = 0.85; ctx.strokeStyle = '#2b2622'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(64, 250, 10 + i * 12, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  }), []);
  return <Plane w={0.22} h={0.66} position={position} map={tex} rough={1} />;
}

function Scene({ night, quality, width, caseH, custom }: SceneProps) {
  const wall = useSurface('jp-wall', paints.plaster('#d9cfb8', 0.04), [3, 2]);
  const floor = useSurface('jp-floor', paints.tatami('#c9bd86', '#2f3a2c'), [3, 6]);
  const garden = useMemo(() => outside.garden(night), [night]);
  const shadows = quality === 'high';
  const left = -CASE_W / 2;
  return (
    <group>
      <color attach="background" args={[night ? '#14161c' : '#d9d3c4']} />
      <fog attach="fog" args={[night ? '#14161c' : '#d9d3c4', 5, 14]} />
      <Shell width={width} wall="#ffffff" floor="#ffffff" wallMap={wall} floorMap={floor} height={caseH + 1.6} sides={false} />
      {/* wooden posts and beam (nageshi) */}
      <Box size={[width + 6, 0.08, 0.06]} position={[width / 2, caseH + 0.85, WALL_Z + 0.03]} color="#4b3725" />
      {[left - 0.08, CASE_W / 2 + 0.08].map((x) => <Box key={x} size={[0.09, caseH + 1.6, 0.09]} position={[x, (caseH + 1.6) / 2, WALL_Z + 0.05]} color="#4b3725" />)}
      {/* tokonoma alcove with a hanging scroll above the low shelf */}
      <Scroll position={[0, caseH + 0.45, WALL_Z + 0.02]} />
      {/* open sliding door to the garden on the right, shoji on the left */}
      <group position={[CASE_W / 2 + 0.62, (caseH + 0.8) / 2, WALL_Z + 0.01]}>
        <Plane w={0.86} h={caseH + 0.8} position={[0, 0, 0.004]} map={garden} basic />
        <Box size={[0.9, 0.05, 0.05]} position={[0, (caseH + 0.8) / 2, 0]} color="#4b3725" />
      </group>
      <Shoji position={[left - 0.6, (caseH + 0.8) / 2, WALL_Z + 0.015]} w={0.86} h={caseH + 0.8} glow={night ? 0.05 : 0.35} />
      {/* petals drifting in from the garden */}
      <Particles count={pcount(quality, night ? 12 : 40)} area={[-0.4, CASE_W / 2 + 1.1, 0.05, caseH + 0.9, -0.05, 1.3]} color="#f2b8c6" size={0.012} kind="petal" spin speed={[-0.06, -0.12, 0.03]} opacity={0.95} />
      {/* andon floor lantern */}
      <group position={[left - 0.12, 0, 0.6]}>
        <Box size={[0.2, 0.42, 0.2]} position={[0, 0.25, 0]} color="#f3ecd9" emissive="#ffd9a0" emissiveIntensity={night ? 0.9 : 0.15} rough={1} />
        <Box size={[0.22, 0.03, 0.22]} position={[0, 0.48, 0]} color="#3a2a1c" />
        <Box size={[0.22, 0.04, 0.22]} position={[0, 0.03, 0]} color="#3a2a1c" />
        {night && <Bulb position={[0, 0.28, 0]} color="#ffcf8a" intensity={1.6} size={0.001} distance={3} shadows={shadows} />}
      </group>
      {/* zabuton cushion and a low tea tray */}
      <Box size={[0.42, 0.06, 0.42]} position={[CASE_W / 2 - 0.1, 0.03, 0.85]} rotation={[0, 0.2, 0]} color="#2f4b6e" rough={1} />
      <Box size={[0.3, 0.025, 0.2]} position={[0.05, 0.0125, 0.7]} rotation={[0, -0.3, 0]} color="#3a2a1c" />
      <mesh position={[0.05, 0.05, 0.7]}><cylinderGeometry args={[0.03, 0.025, 0.05, 16]} /><meshStandardMaterial color="#6d7f6a" roughness={0.5} /></mesh>
      <hemisphereLight args={[night ? '#56607a' : '#fff5e0', night ? '#1a1a14' : '#8a7a50', night ? 0.35 : 0.95]} />
      <directionalLight position={[2.5, caseH + 1.5, 2]} intensity={night ? 0.25 : 1.6} color={night ? '#8fa0c9' : '#fff1d6'} castShadow={shadows} />
      <Decor ids={custom.decor} caseH={caseH} shadows={shadows} />
    </group>
  );
}

export const japanese: RoomDef = {
  id: 'japanese',
  tokens: TOKENS.japanese,
  ambience: (night) => ({ layers: night ? ['wind', 'chimes'] : ['birds', 'chimes'] }),
  Scene,
  look: (c) => ({ style: 'low', color: c.shelfColor ?? '#6b4c32', material: c.shelfMaterial, labelInk: '#2b2622', labelBg: 'rgba(244,240,230,.92)' }),
  defaults: { night: false, shelfRows: 3, shelfMaterial: 'wood', decor: [] },
  colors: ['#6b4c32', '#3a2a1c', '#9a7b55', '#2b2622'],
  exposure: 1.0,
  preview: ['#e9e4d6', '#2f4b6e', '#6b4c32'],
};
