import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { RoomDef, SceneProps } from './types';
import { TOKENS } from './tokens';
import { Shell, paints, useSurface, Decor, Box, WALL_Z, outside, Bulb, Plane } from './common';
import { CASE_W, CASE_D } from '../three/Bookcase';

function RunningWindow({ position, w, h, night }: { position: [number, number, number]; w: number; h: number; night: boolean }) {
  const tex = useMemo(() => { const t = outside.street(night).clone(); t.wrapS = THREE.RepeatWrapping; t.repeat.set(0.6, 1); t.needsUpdate = true; return t; }, [night]);
  const poles = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    tex.offset.x += dt * 0.12;
    const g = poles.current;
    if (g) g.children.forEach((c) => { c.position.x -= dt * 1.6; if (c.position.x < -w / 2 - 0.1) c.position.x += w + 0.4; });
  });
  return (
    <group position={position}>
      <mesh position={[0, 0, 0]}><planeGeometry args={[w, h]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      <group ref={poles} position={[0, 0, 0.005]}>
        {[0, 0.55, 1.1].map((x) => <mesh key={x} position={[x - w / 2, 0, 0]}><planeGeometry args={[0.025, h]} /><meshBasicMaterial color="#0d0f14" /></mesh>)}
      </group>
      {/* rounded frame */}
      {[[0, h / 2 + 0.03, w + 0.1, 0.06], [0, -h / 2 - 0.03, w + 0.1, 0.06]].map(([x, y, ww, hh], i) => <Box key={i} size={[ww, hh, 0.08]} position={[x, y, 0.04]} color="#5a2f2a" />)}
      {[-1, 1].map((s) => <Box key={s} size={[0.06, h, 0.08]} position={[s * (w / 2 + 0.03), 0, 0.04]} color="#5a2f2a" />)}
      <mesh position={[0, 0, 0.02]}><planeGeometry args={[w, h]} /><meshStandardMaterial color="#c8dcff" transparent opacity={0.08} roughness={0.05} /></mesh>
    </group>
  );
}

function Scene({ night, quality, width, caseH, custom }: SceneProps) {
  const wall = useSurface('tr-wall', paints.planks('#5a2f2a', 14, true), [3, 2]);
  const floor = useSurface('tr-floor', paints.stripes('#3a2a2a', '#4a3434', 12), [4, 4]);
  const shadows = quality === 'high';
  const rig = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (rig.current) { const t = clock.elapsedTime; rig.current.rotation.z = Math.sin(t * 1.7) * 0.0025; rig.current.position.y = Math.abs(Math.sin(t * 3.6)) * 0.002; } });
  return (
    <group ref={rig}>
      <color attach="background" args={['#0d090b']} />
      <Shell width={width} wall="#ffffff" floor="#ffffff" wallMap={wall} floorMap={floor} height={caseH + 1.2} sides={false} ceiling="#3a2226" />
      <RunningWindow position={[0, caseH + 0.42, WALL_Z + 0.02]} w={CASE_W + 0.2} h={0.42} night={night} />
      {/* brass luggage rack */}
      {[0, 1, 2, 3].map((i) => <mesh key={i} position={[CASE_W / 2 + 0.55, caseH + 0.62 - i * 0.02, WALL_Z + 0.1 + i * 0.06]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.006, 0.006, 0.9, 6]} /><meshStandardMaterial color="#c9a24a" metalness={0.8} roughness={0.3} /></mesh>)}
      {/* bunk in the foreground with a folded blanket */}
      <group position={[CASE_W / 2 + 0.75, 0, CASE_D / 2 + 0.3]}>
        <Box size={[0.9, 0.3, 0.6]} position={[0, 0.15, 0]} color="#5a2f2a" />
        <Box size={[0.88, 0.07, 0.58]} position={[0, 0.335, 0]} color="#d9c7a8" rough={1} />
        <Box size={[0.4, 0.06, 0.5]} position={[-0.15, 0.4, 0]} color="#7a2f2f" rough={1} />
        <Box size={[0.3, 0.08, 0.2]} position={[0.25, 0.41, -0.15]} color="#efe6d2" rough={1} />
      </group>
      {/* small fold-down table under the window */}
      <Box size={[0.5, 0.03, 0.25]} position={[-CASE_W / 2 - 0.35, 0.68, CASE_D / 2 - 0.05]} color="#5a2f2a" />
      <Box size={[0.2, 0.04, 0.14]} position={[-CASE_W / 2 - 0.35, 0.715, CASE_D / 2 - 0.05]} rotation={[0, 0.3, 0]} color="#2f4b6e" />
      {/* wall reading lamp */}
      <group position={[-CASE_W / 2 - 0.22, caseH * 0.7, WALL_Z + 0.04]}>
        <Box size={[0.05, 0.05, 0.05]} position={[0, 0, 0]} color="#c9a24a" metal={0.8} rough={0.3} />
        <Box size={[0.012, 0.012, 0.16]} position={[0, 0, 0.08]} color="#c9a24a" metal={0.8} rough={0.3} />
        <mesh position={[0, -0.03, 0.17]}><coneGeometry args={[0.05, 0.07, 16, 1, true]} /><meshStandardMaterial color="#c9a24a" metalness={0.8} roughness={0.3} side={THREE.DoubleSide} /></mesh>
        <Bulb position={[0, -0.04, 0.17]} color="#ffd38a" intensity={2.4} size={0.014} distance={3} shadows={shadows} />
      </group>
      <hemisphereLight args={[night ? '#7a6a8a' : '#e0d6c8', '#2a1a1a', night ? 0.7 : 1.0]} />
      <pointLight position={[0.3, caseH + 0.9, 0.8]} color="#ffd8a8" intensity={night ? 2.2 : 2.2} distance={4} />
      <Plane w={0.01} h={0.01} position={[0, -2, 0]} />
      <Decor ids={custom.decor} caseH={caseH} shadows={shadows} />
    </group>
  );
}

export const train: RoomDef = {
  id: 'train',
  tokens: TOKENS.train,
  ambience: () => ({ layers: ['train'] }),
  Scene,
  look: (c) => ({ style: 'wood', color: c.shelfColor ?? '#4a2420', material: c.shelfMaterial, labelInk: '#f0c674', labelBg: 'rgba(27,20,24,.85)' }),
  defaults: { night: true, shelfRows: 3, shelfMaterial: 'wood', decor: [] },
  colors: ['#4a2420', '#2f1c1c', '#6b4a3a', '#2a2f3a'],
  preview: ['#1b1418', '#f0c674', '#4a2420'],
};
