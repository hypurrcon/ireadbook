import { useMemo } from 'react';
import * as THREE from 'three';
import type { RoomDef, SceneProps } from './types';
import { TOKENS } from './tokens';
import { Shell, paints, useSurface, WindowFrame, outside, Particles, PendantLamp, Rug, Decor, Plane, Box, WALL_Z, pcount } from './common';
import { CASE_W } from '../three/Bookcase';

function Scene({ night, quality, width, caseH, custom }: SceneProps) {
  const wall = useSurface('attic-wall', paints.plaster('#6b5646', 0.07), [3, 2]);
  const floor = useSurface('attic-floor', paints.planks('#5a3d29', 7, true), [4, 4]);
  const roof = useSurface('attic-roof', paints.planks('#4a3222', 8), [2, 3]);
  const view = useMemo(() => (night ? outside.rainyNight() : outside.rainyDay()), [night]);
  const shadows = quality === 'high';
  const peak = caseH + 1.05;
  const slope = 0.55; // roof angle
  const roofLen = 3.2;
  const roofL = 2.2;
  return (
    <group>
      <color attach="background" args={[night ? '#120d0b' : '#5b4c42']} />
      <fog attach="fog" args={[night ? '#120d0b' : '#5b4c42', 5, 14]} />
      <Shell width={width} wall="#ffffff" floor="#ffffff" wallMap={wall} floorMap={floor} height={peak + 0.4} sides={false} />
      {/* sloped roof: two planes meeting above the bookcase */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0, peak, WALL_Z + roofL / 2]} rotation={[0, 0, -s * slope]}>
          <Plane w={roofLen} h={roofL} position={[s * roofLen / 2, 0, 0]} rotation={[Math.PI / 2, 0, 0]} color="#ffffff" map={roof} side={THREE.DoubleSide} />
          {[0.3, 0.95, 1.6].map((d) => <Box key={d} size={[0.06, 0.08, roofL]} position={[s * d, -0.045, 0]} color="#3b281b" />)}
        </group>
      ))}
      <Box size={[0.09, 0.11, roofL]} position={[0, peak - 0.03, WALL_Z + roofL / 2]} color="#3b281b" />
      {/* round window above the bookcase */}
      <WindowFrame position={[0, caseH + 0.5, WALL_Z + 0.02]} w={0.52} h={0.52} frame="#2f2017" view={view} round glass={0.12} />
      <Particles count={pcount(quality, 70)} area={[-0.25, 0.25, caseH + 0.26, caseH + 0.74, WALL_Z - 0.005, WALL_Z - 0.004]} color={night ? '#8fa6c9' : '#e8eef3'} size={0.02} kind="streak" speed={[0.02, -1.2, 0]} opacity={0.5} />
      {/* lamp + light */}
      <PendantLamp position={[0.38, caseH + 0.55, 0.55]} shade="#2c2620" color="#ffb655" intensity={night ? 5 : 2.2} shadows={shadows} />
      <hemisphereLight args={[night ? '#3a4660' : '#c9d3dc', '#2a1d14', night ? 0.55 : 0.9]} />
      <directionalLight position={[0, caseH + 1.2, 1.5]} intensity={night ? 0.35 : 0.8} color={night ? '#7d93c4' : '#dfe8f0'} />
      <pointLight position={[-0.3, caseH * 0.6, 1.4]} intensity={night ? 0.9 : 0.6} distance={4} color="#ffcf9a" />
      {/* dust in the lamp light */}
      <Particles count={pcount(quality, 40)} area={[-0.4, 1.0, 0.2, caseH + 0.5, 0.1, 1.0]} color="#ffd59a" size={0.004} speed={[0.01, 0.01, 0]} twinkle opacity={0.7} />
      <Rug position={[0, 0.003, 0.65]} w={1.3} d={0.8} color="#7c3b2a" border="#3d1d14" />
      {/* floor cushion in the foreground */}
      <mesh position={[CASE_W / 2 + 0.1, 0.06, 0.95]} scale={[1, 0.45, 1]} castShadow>
        <sphereGeometry args={[0.2, 20, 14]} />
        <meshStandardMaterial color="#a7643a" roughness={0.95} />
      </mesh>
      <Decor ids={custom.decor} caseH={caseH} shadows={shadows} />
    </group>
  );
}

export const attic: RoomDef = {
  id: 'attic',
  tokens: TOKENS.attic,
  ambience: (night) => ({ layers: night ? ['rain', 'clock'] : ['rain'] }),
  Scene,
  look: (c) => ({ style: 'wood', color: c.shelfColor ?? '#6a4630', material: c.shelfMaterial, labelInk: '#f2e7d3', labelBg: 'rgba(30,23,20,.75)' }),
  defaults: { night: true, shelfRows: 4, shelfMaterial: 'wood', decor: [] },
  colors: ['#6a4630', '#3f2a1d', '#8a6a4a', '#2f3a33'],
  preview: ['#1e1714', '#e8a33d', '#6a4630'],
};
