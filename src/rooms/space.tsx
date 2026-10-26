import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { RoomDef, SceneProps } from './types';
import { TOKENS } from './tokens';
import { Shell, paints, useSurface, Decor, Box, WALL_Z, outside, Particles, pcount } from './common';
import { CASE_W } from '../three/Bookcase';

function Porthole({ position, r }: { position: [number, number, number]; r: number }) {
  const view = useMemo(() => outside.earth(), []);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ref.current) (ref.current.material as THREE.MeshBasicMaterial).map!.offset.x += dt * 0.004; });
  useMemo(() => { view.wrapS = THREE.RepeatWrapping; }, [view]);
  return (
    <group position={position}>
      <mesh ref={ref} position={[0, 0, -0.02]}><circleGeometry args={[r, 48]} /><meshBasicMaterial map={view} toneMapped={false} /></mesh>
      <mesh><torusGeometry args={[r + 0.02, 0.045, 16, 48]} /><meshStandardMaterial color="#c9d0da" metalness={0.6} roughness={0.35} /></mesh>
      {Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return <mesh key={i} position={[Math.cos(a) * (r + 0.02), Math.sin(a) * (r + 0.02), 0.045]}><sphereGeometry args={[0.012, 8, 6]} /><meshStandardMaterial color="#7d8794" metalness={0.8} /></mesh>; })}
    </group>
  );
}

function Floater({ position, color, size }: { position: [number, number, number]; color: string; size: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const seed = useMemo(() => Math.random() * 10, []);
  useFrame(({ clock }) => {
    const m = ref.current; if (!m) return;
    const t = clock.elapsedTime * 0.25 + seed;
    m.position.set(position[0] + Math.sin(t) * 0.08, position[1] + Math.sin(t * 1.3) * 0.06, position[2] + Math.cos(t * 0.7) * 0.05);
    m.rotation.set(t * 0.7, t * 0.5, t * 0.3);
  });
  return <mesh ref={ref}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.5} /></mesh>;
}

function Scene({ quality, width, caseH, custom }: SceneProps) {
  const wall = useSurface('sp-wall', paints.panel('#d9dee6', '#aab3c0'), [8, 5]);
  const floor = useSurface('sp-floor', paints.panel('#8d96a3', '#6b7480'), [8, 8]);
  const shadows = quality === 'high';
  return (
    <group>
      <color attach="background" args={['#05070c']} />
      <Shell width={width} wall="#ffffff" floor="#ffffff" wallMap={wall} floorMap={floor} height={caseH + 1.4} sides={false} ceiling="#c3cad4" />
      <Porthole position={[0, caseH + 0.5, WALL_Z + 0.03]} r={0.3} />
      {/* handrails and cable bundle */}
      {[-1, 1].map((s) => <mesh key={s} position={[s * (CASE_W / 2 + 0.16), caseH * 0.55, WALL_Z + 0.09]}><capsuleGeometry args={[0.014, caseH * 0.7, 4, 8]} /><meshStandardMaterial color="#ffb547" roughness={0.5} /></mesh>)}
      <mesh position={[width / 2, caseH + 1.05, WALL_Z + 0.08]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.04, 0.04, width + 6, 12]} /><meshStandardMaterial color="#3b4350" roughness={0.6} /></mesh>
      {/* light strips */}
      <Box size={[width + 6, 0.025, 0.02]} position={[width / 2, caseH + 0.98, WALL_Z + 0.05]} color="#fff" emissive="#eaf3ff" emissiveIntensity={1.4} cast={false} />
      <pointLight position={[0, caseH + 1.0, 0.9]} intensity={2.2} distance={4} color="#eaf3ff" />
      <ambientLight intensity={0.55} color="#cfd8e6" />
      <directionalLight position={[1.5, caseH + 1.5, 2]} intensity={1.1} color="#ffffff" castShadow={shadows} />
      <pointLight position={[0, caseH + 0.4, 0.4]} intensity={0.6} color="#7fb6ff" distance={2} />
      {/* drifting things: a pen, a water bubble, a sticky note */}
      <Floater position={[CASE_W / 2 + 0.12, caseH * 0.7, 0.6]} color="#2f4b6e" size={[0.012, 0.012, 0.14]} />
      <Floater position={[-CASE_W / 2 - 0.05, caseH * 0.4, 0.7]} color="#ffd14a" size={[0.07, 0.07, 0.002]} />
      <mesh position={[-0.3, caseH + 0.15, 0.55]}><sphereGeometry args={[0.025, 16, 12]} /><meshStandardMaterial color="#bfe6ff" transparent opacity={0.45} roughness={0} metalness={0.2} /></mesh>
      <Particles count={pcount(quality, 20)} area={[-0.8, 0.8, 0.1, caseH + 0.8, 0.2, 1.2]} color="#ffffff" size={0.003} speed={[0.004, 0.003, 0.002]} twinkle opacity={0.5} />
      <Decor ids={custom.decor} caseH={caseH} shadows={shadows} />
    </group>
  );
}

export const space: RoomDef = {
  id: 'space',
  tokens: TOKENS.space,
  ambience: () => ({ layers: ['hum'] }),
  Scene,
  look: (c) => ({ style: 'strap', color: c.shelfColor ?? '#9aa3af', material: 'metal', labelInk: '#070b14', labelBg: 'rgba(255,181,71,.95)' }),
  defaults: { night: false, shelfRows: 4, shelfMaterial: 'metal', decor: [] },
  colors: ['#9aa3af', '#e3e7ec', '#5b6470', '#c9a24a'],
  faceOut: true,
  preview: ['#070b14', '#ffb547', '#9aa3af'],
};
