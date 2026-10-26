import { useMemo } from 'react';
import * as THREE from 'three';
import type { RoomDef, SceneProps } from './types';
import { TOKENS } from './tokens';
import { Shell, paints, useSurface, Decor, Box, WALL_Z, Particles, pcount, outside, WindowFrame, Plant } from './common';
import { CASE_W } from '../three/Bookcase';
import { proceduralTexture } from '../three/textures';

function Trunk({ x, h }: { x: number; h: number }) {
  const bark = useMemo(() => proceduralTexture('bark', 128, 256, (ctx, W, H) => {
    ctx.fillStyle = '#4a3423'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) { ctx.strokeStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.25})`; ctx.lineWidth = 1 + Math.random() * 3; const x0 = Math.random() * W; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.bezierCurveTo(x0 + 8, H / 3, x0 - 8, H / 1.5, x0 + 4, H); ctx.stroke(); }
  }, [2, 3]), []);
  return (
    <group position={[x, 0, WALL_Z + 0.12]}>
      <mesh position={[0, h / 2, 0]} castShadow><cylinderGeometry args={[0.2, 0.26, h, 18]} /><meshStandardMaterial map={bark} roughness={1} /></mesh>
      <mesh position={[0.25, h * 0.72, 0.1]} rotation={[0, 0, -1.0]}><cylinderGeometry args={[0.05, 0.08, 0.7, 10]} /><meshStandardMaterial map={bark} roughness={1} /></mesh>
    </group>
  );
}

function StringLights({ from, to, sag, count, color }: { from: THREE.Vector3; to: THREE.Vector3; sag: number; count: number; color: string }) {
  const pts = useMemo(() => Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const p = from.clone().lerp(to, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    return p;
  }), [from, to, sag, count]);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(pts), [pts]);
  return (
    <group>
      <mesh><tubeGeometry args={[curve, 40, 0.003, 4, false]} /><meshStandardMaterial color="#222" /></mesh>
      {pts.map((p, i) => <mesh key={i} position={[p.x, p.y - 0.015, p.z]}><sphereGeometry args={[0.014, 8, 6]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>)}
      <pointLight position={pts[Math.floor(count / 2)].toArray()} color={color} intensity={2.6} distance={4} />
    </group>
  );
}

function Scene({ night, quality, width, caseH, custom }: SceneProps) {
  const wall = useSurface('tree-wall', paints.planks('#6d5034', 12, true), [3, 2]);
  const floor = useSurface('tree-floor', paints.planks('#5c4029', 6), [3, 4]);
  const view = useMemo(() => outside.forest(night), [night]);
  const shadows = quality === 'high';
  const lights = useMemo(() => ({ a: new THREE.Vector3(-CASE_W / 2 - 0.4, caseH + 0.7, 0.2), b: new THREE.Vector3(CASE_W / 2 + 0.5, caseH + 0.75, 0.25) }), [caseH]);
  return (
    <group>
      <color attach="background" args={[night ? '#0a120e' : '#9fc0aa']} />
      <fog attach="fog" args={[night ? '#0a120e' : '#9fc0aa', 5, 13]} />
      <Shell width={width} wall="#ffffff" floor="#ffffff" wallMap={wall} floorMap={floor} height={caseH + 1.6} sides={false} />
      <Trunk x={-CASE_W / 2 - 0.42} h={caseH + 1.6} />
      <WindowFrame position={[CASE_W / 2 + 0.55, caseH * 0.65, WALL_Z + 0.02]} w={0.55} h={0.7} frame="#3d2a1a" view={view} glass={0.06} />
      <WindowFrame position={[0, caseH + 0.5, WALL_Z + 0.02]} w={0.4} h={0.4} frame="#3d2a1a" view={view} round glass={0.06} bars={false} />
      <StringLights from={lights.a} to={lights.b} sag={0.18} count={9} color="#ffd98a" />
      {night
        ? <Particles count={pcount(quality, 36)} area={[-0.9, 0.9, 0.1, caseH + 0.8, 0.1, 1.3]} color="#d6f56a" size={0.008} speed={[0.03, 0.02, 0.02]} twinkle additive opacity={1} />
        : <Particles count={pcount(quality, 18)} area={[-0.9, 0.9, 0.1, caseH + 0.8, 0.1, 1.3]} color="#9cbf5a" size={0.014} kind="petal" spin speed={[0.03, -0.1, 0.02]} opacity={0.9} />}
      <hemisphereLight args={[night ? '#3a5a6a' : '#e8f4d8', '#2a1f12', night ? 0.6 : 1.0]} />
      <pointLight position={[0.2, caseH * 0.55, 1.2]} color="#ffcf8a" intensity={night ? 1.2 : 0.4} distance={3.5} />
      <directionalLight position={[2, caseH + 2, 2]} intensity={night ? 0.2 : 1.5} color={night ? '#9ab4d0' : '#fff2cc'} castShadow={shadows} />
      <Plant position={[CASE_W / 2 + 0.25, 0, 0.5]} scale={1.8} pot="#7a5236" leaf="#557a3e" />
      <Box size={[0.5, 0.05, 0.35]} position={[-0.15, 0.025, 0.9]} rotation={[0, 0.15, 0]} color="#3d2a1a" />
      <Decor ids={custom.decor} caseH={caseH} shadows={shadows} />
    </group>
  );
}

export const treehouse: RoomDef = {
  id: 'treehouse',
  tokens: TOKENS.treehouse,
  ambience: (night) => ({ layers: night ? ['wind', 'crackle'] : ['birds', 'wind'] }),
  Scene,
  look: (c) => ({ style: 'branch', color: c.shelfColor ?? '#6a4a30', material: 'wood', labelInk: '#e6efd9', labelBg: 'rgba(20,32,25,.8)' }),
  defaults: { night: true, shelfRows: 4, shelfMaterial: 'wood', decor: [] },
  colors: ['#6a4a30', '#4a3423', '#8a6a48', '#3d4a2c'],
  preview: ['#142019', '#c8e06a', '#6a4a30'],
};
