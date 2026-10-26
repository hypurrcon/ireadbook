import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { RoomDef, SceneProps } from './types';
import { TOKENS } from './tokens';
import { paints, useSurface, Decor, Box, WALL_Z, Particles, pcount, Candle, Bulb, WindowFrame, outside } from './common';
import { CASE_W, CASE_D } from '../three/Bookcase';

function Tower({ caseH }: { caseH: number }) {
  const stone = useSurface('wz-stone', paints.brick('#4b4458', '#2a2533'), [10, 4]);
  const floor = useSurface('wz-floor', paints.brick('#3a3445', '#1f1b27'), [4, 4]);
  const R = 2.4;
  const H = caseH + 2.2;
  return (
    <group position={[0, 0, WALL_Z + R]}>
      <mesh position={[0, H / 2, 0]}><cylinderGeometry args={[R, R, H, 48, 1, true, Math.PI * 0.5, Math.PI]} /><meshStandardMaterial map={stone} side={THREE.BackSide} roughness={0.95} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}><circleGeometry args={[R, 48]} /><meshStandardMaterial map={floor} roughness={0.95} /></mesh>
    </group>
  );
}

function FloatingBook({ radius, height, speed, color, phase }: { radius: number; height: number; speed: number; color: string; phase: number }) {
  const ref = useRef<THREE.Group>(null);
  const cover = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed + phase;
    const g = ref.current; if (!g) return;
    g.position.set(Math.cos(t) * radius, height + Math.sin(t * 2) * 0.05, 0.55 + Math.sin(t) * radius * 0.5);
    g.rotation.set(0.2, -t + Math.PI / 2, Math.sin(t * 3) * 0.1);
    if (cover.current) cover.current.rotation.y = 0.5 + Math.sin(t * 4) * 0.35; // pages flapping
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0, 0]}><boxGeometry args={[0.012, 0.16, 0.11]} /><meshStandardMaterial color={color} /></mesh>
      <mesh ref={cover} position={[0, 0, 0]}><boxGeometry args={[0.005, 0.15, 0.1]} /><meshStandardMaterial color="#efe2c4" /></mesh>
    </group>
  );
}

function Potion({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]}><sphereGeometry args={[0.045, 16, 12]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} transparent opacity={0.85} roughness={0.1} /></mesh>
      <mesh position={[0, 0.11, 0]}><cylinderGeometry args={[0.012, 0.016, 0.05, 10]} /><meshStandardMaterial color="#c7d6e0" transparent opacity={0.6} /></mesh>
      <mesh position={[0, 0.14, 0]}><cylinderGeometry args={[0.014, 0.014, 0.015, 10]} /><meshStandardMaterial color="#6b4a2a" /></mesh>
      <pointLight position={[0, 0.06, 0.05]} color={color} intensity={0.5} distance={0.8} />
    </group>
  );
}

function Scene({ night, quality, width, caseH, custom }: SceneProps) {
  const shadows = quality === 'high';
  const view = useMemo(() => outside.forest(true), []);
  void width;
  return (
    <group>
      <color attach="background" args={['#0c0913']} />
      <fog attach="fog" args={['#120d1c', 3.5, 9]} />
      <Tower caseH={caseH} />
      {/* narrow arrow-slit window with stars */}
      <WindowFrame position={[CASE_W / 2 + 0.45, caseH * 0.75, WALL_Z + 0.05]} w={0.16} h={0.6} frame="#2a2533" view={view} glass={0.05} bars={false} />
      <Particles count={pcount(quality, 8)} area={[CASE_W / 2 + 0.38, CASE_W / 2 + 0.52, caseH * 0.45, caseH * 1.05, WALL_Z - 0.03, WALL_Z - 0.02]} color="#ffffff" size={0.004} speed={[0, 0, 0]} twinkle />
      {[0, 1, 2, 3].map((i) => <FloatingBook key={i} radius={0.35 + i * 0.12} height={caseH + 0.25 + i * 0.18} speed={0.25 + i * 0.07} color={['#5b3a5e', '#2c5d63', '#8c4a3c', '#3e5a3a'][i]} phase={i * 1.7} />)}
      <Potion position={[-CASE_W / 2 + 0.12, caseH, 0.02]} color="#7fe3c4" />
      <Potion position={[-CASE_W / 2 + 0.25, caseH, 0.05]} color="#c27fe3" />
      <Potion position={[CASE_W / 2 - 0.15, caseH, 0.03]} color="#e3b07f" />
      {/* floating candles */}
      {[[-0.55, caseH + 0.65, 0.4], [0.5, caseH + 0.8, 0.6], [0.1, caseH + 0.95, 0.9], [-0.2, caseH + 0.55, 1.0]].map((p, i) => (
        <FloatCandle key={i} position={p as [number, number, number]} shadows={shadows && i === 0} />
      ))}
      <ambientLight color="#4a3a6a" intensity={night ? 0.45 : 0.7} />
      <Bulb position={[0, caseH + 1.4, 1.2]} color="#c9a8ff" intensity={1.4} distance={5} size={0.001} />
      <spotLight position={[0.4, caseH + 1.6, 1.8]} angle={0.6} penumbra={0.8} intensity={4} color="#ffd8b0" castShadow={shadows} />
      {/* desk with open spellbook in front */}
      <group position={[-0.2, 0, CASE_D / 2 + 0.75]}>
        <Box size={[0.6, 0.05, 0.36]} position={[0, 0.7, 0]} color="#3a2416" />
        <Box size={[0.07, 0.7, 0.07]} position={[0, 0.35, 0]} color="#2a1a10" />
        <Box size={[0.3, 0.012, 0.2]} position={[0, 0.735, 0]} rotation={[0, 0.2, 0]} color="#efe2c4" />
        <Candle position={[0.2, 0.725, 0.05]} />
      </group>
      <Particles count={pcount(quality, 50)} area={[-0.9, 0.9, 0.2, caseH + 1.2, 0.1, 1.4]} color="#9ff2d6" size={0.005} speed={[0.0, 0.03, 0]} twinkle additive />
      <Decor ids={custom.decor} caseH={caseH} shadows={shadows} />
    </group>
  );
}

function FloatCandle({ position, shadows }: { position: [number, number, number]; shadows?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const s = useMemo(() => Math.random() * 6, []);
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.8 + s) * 0.04; });
  return <group ref={ref} position={position}><Candle position={[0, 0, 0]} shadows={shadows} /></group>;
}

export const wizard: RoomDef = {
  id: 'wizard',
  tokens: TOKENS.wizard,
  ambience: () => ({ layers: ['crackle', 'wind', 'chimes'] }),
  Scene,
  look: (c) => ({ style: 'stone', color: c.shelfColor ?? '#3d2e24', material: 'wood', labelInk: '#7fe3c4', labelBg: 'rgba(26,20,38,.85)', labelGlow: '#7fe3c4' }),
  defaults: { night: true, shelfRows: 4, shelfMaterial: 'wood', decor: [] },
  colors: ['#3d2e24', '#2a2238', '#56463a', '#1f2b28'],
  preview: ['#1a1426', '#7fe3c4', '#3d2e24'],
};
