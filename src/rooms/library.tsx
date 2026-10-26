import { useMemo } from 'react';
import * as THREE from 'three';
import type { RoomDef, SceneProps } from './types';
import { TOKENS } from './tokens';
import { Shell, paints, useSurface, Candle, Decor, Box, Plane, WALL_Z, Particles, pcount, WindowFrame, outside, Bulb } from './common';
import { CASE_W, CASE_D } from '../three/Bookcase';

function Ladder({ x, caseH }: { x: number; caseH: number }) {
  const h = caseH + 0.15;
  const lean = 0.2;
  const wood = '#4a3020';
  return (
    <group position={[x, 0, CASE_D / 2 + 0.22]} rotation={[-lean, 0, 0]}>
      {[-0.17, 0.17].map((s) => <Box key={s} size={[0.03, h, 0.03]} position={[s, h / 2, 0]} color={wood} />)}
      {Array.from({ length: Math.floor(h / 0.24) }, (_, i) => <Box key={i} size={[0.34, 0.022, 0.03]} position={[0, 0.2 + i * 0.24, 0]} color={wood} />)}
      <mesh position={[0, h, -0.06]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.012, 0.012, 0.42, 8]} /><meshStandardMaterial color="#b08a46" metalness={0.8} roughness={0.3} /></mesh>
    </group>
  );
}

function Chandelier({ position, shadows }: { position: [number, number, number]; shadows: boolean }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.004, 0.004, 1, 6]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.24, 0.012, 8, 40]} /><meshStandardMaterial color="#9c7a3c" metalness={0.8} roughness={0.35} /></mesh>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return <group key={i} position={[Math.cos(a) * 0.24, 0.01, Math.sin(a) * 0.24]}><Candle position={[0, 0, 0]} shadows={shadows && i === 0} /></group>;
      })}
      <pointLight color="#ffbb6b" intensity={2.4} distance={5} decay={1.4} position={[0, 0.05, 0]} />
    </group>
  );
}

function Scene({ night, quality, width, caseH, custom }: SceneProps) {
  const wall = useSurface('lib-wall', paints.planks('#3b2a1c', 10, true), [4, 2]);
  const floor = useSurface('lib-floor', paints.tiles('#2a2520', '#cfc2a8', 10), [3, 3]);
  const shadows = quality === 'high';
  const view = useMemo(() => (night ? outside.rainyNight() : outside.garden(false)), [night]);
  return (
    <group>
      <color attach="background" args={['#0d0b08']} />
      <fog attach="fog" args={['#0d0b08', 4.5, 12]} />
      <Shell width={width} wall="#ffffff" floor="#ffffff" wallMap={wall} floorMap={floor} height={caseH + 2.2} sides={false} />
      {/* wainscot & crown moulding */}
      <Box size={[width + 6, 0.06, 0.05]} position={[width / 2, 0.85, WALL_Z + 0.02]} color="#2a1d12" />
      <Box size={[width + 6, 0.1, 0.08]} position={[width / 2, caseH + 0.95, WALL_Z + 0.03]} color="#2a1d12" />
      {/* tall arched window beside the stacks */}
      <group position={[-CASE_W / 2 - 0.55, caseH * 0.55 + 0.3, WALL_Z + 0.02]}>
        <WindowFrame position={[0, 0, 0]} w={0.5} h={caseH * 0.9} frame="#2a1d12" view={view} glass={0.12} />
        <mesh position={[0, caseH * 0.45, -0.02]}><circleGeometry args={[0.25, 32, 0, Math.PI]} /><meshBasicMaterial map={view} toneMapped={false} /></mesh>
      </group>
      <Ladder x={CASE_W * 0.22} caseH={caseH} />
      <mesh position={[width / 2, caseH + 0.05, CASE_D / 2 + 0.05]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.01, 0.01, width + 1, 8]} /><meshStandardMaterial color="#b08a46" metalness={0.8} roughness={0.3} /></mesh>
      <Chandelier position={[0.1, caseH + 0.6, 0.7]} shadows={shadows} />
      {[-0.32, 0.36].map((x) => <Candle key={x} position={[x, caseH, 0.03]} />)}
      <hemisphereLight args={['#6b5a40', '#1a120c', night ? 0.35 : 0.7]} />
      <spotLight position={[0.5, caseH + 1.5, 2]} angle={0.55} penumbra={0.7} intensity={night ? 3 : 5} color="#ffd9a0" castShadow={shadows} />
      {/* reading desk with a green banker's lamp in the foreground */}
      <group position={[CASE_W / 2 + 0.15, 0, 0.95]}>
        <Box size={[0.8, 0.04, 0.45]} position={[0, 0.74, 0]} color="#3a2416" rough={0.5} />
        {[-0.36, 0.36].map((x) => <Box key={x} size={[0.04, 0.74, 0.04]} position={[x, 0.37, 0.18]} color="#2a1a10" />)}
        <mesh position={[-0.2, 0.92, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.06, 0.06, 0.2, 16, 1, true, 0, Math.PI]} /><meshStandardMaterial color="#1f5a3a" side={THREE.DoubleSide} metalness={0.3} roughness={0.3} /></mesh>
        <Box size={[0.012, 0.16, 0.012]} position={[-0.2, 0.82, 0]} color="#b08a46" metal={0.8} />
        <Bulb position={[-0.2, 0.89, 0]} color="#ffd38a" intensity={1.2} size={0.012} distance={2} />
        <Box size={[0.22, 0.03, 0.16]} position={[0.12, 0.775, 0]} rotation={[0, 0.3, 0]} color="#efe2c4" />
      </group>
      <Particles count={pcount(quality, 45)} area={[-0.7, 0.8, 0.3, caseH + 0.6, 0.2, 1.2]} color="#ffe2b0" size={0.004} speed={[0.004, 0.006, 0]} twinkle opacity={0.6} />
      <Decor ids={custom.decor} caseH={caseH} shadows={shadows} />
      <Plane w={0.01} h={0.01} position={[0, -1, 0]} />
    </group>
  );
}

export const library: RoomDef = {
  id: 'library',
  tokens: TOKENS.library,
  ambience: () => ({ layers: ['clock', 'crackle'] }),
  Scene,
  look: (c) => ({ style: 'wood', color: c.shelfColor ?? '#4a2f1c', material: c.shelfMaterial, labelInk: '#e6cf8a', labelBg: 'rgba(21,19,15,.8)' }),
  defaults: { night: true, shelfRows: 5, shelfMaterial: 'wood', decor: ['globe'] },
  colors: ['#4a2f1c', '#2c1c12', '#5c4128', '#20302a'],
  preview: ['#15130f', '#c9a24a', '#4a2f1c'],
};
