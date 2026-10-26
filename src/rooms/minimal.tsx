import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { RoomDef, SceneProps } from './types';
import { TOKENS } from './tokens';
import { Shell, paints, useSurface, Decor, WALL_Z, Plant, Particles, pcount, Box } from './common';
import { CASE_W } from '../three/Bookcase';

function SunShafts({ position, night }: { position: [number, number, number]; night: boolean }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 256;
    const x = c.getContext('2d')!;
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,240,205,.55)'); g.addColorStop(1, 'rgba(255,240,205,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 256);
    const t = new THREE.CanvasTexture(c); return t;
  }, []);
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { g.current?.children.forEach((c, i) => ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (night ? 0 : 0.5) + Math.sin(clock.elapsedTime * 0.4 + i) * (night ? 0 : 0.12)); });
  return (
    <group ref={g} position={position} rotation={[0, 0, 0.55]}>
      {[0, 0.16, 0.3, 0.5].map((x, i) => <mesh key={i} position={[x, -0.8, 0.3 + i * 0.05]}><planeGeometry args={[0.07 + i * 0.02, 2.2]} /><meshBasicMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>)}
    </group>
  );
}

function Curtain({ position, h, night }: { position: [number, number, number]; h: number; night: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.PlaneGeometry(0.6, h, 24, 1), [h]);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo]);
  useFrame(({ clock }) => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < p.count; i++) { const x = base[i * 3]; p.setZ(i, Math.sin(x * 40 + t * 0.6) * 0.02 + Math.sin(x * 9 + t) * 0.01); }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  });
  return <mesh ref={ref} geometry={geo} position={position}><meshStandardMaterial color="#ffffff" emissive="#fff4dc" emissiveIntensity={night ? 0.02 : 0.45} transparent opacity={0.92} side={THREE.DoubleSide} roughness={1} /></mesh>;
}

function Scene({ night, quality, width, caseH, custom }: SceneProps) {
  const wall = useSurface('min-wall', paints.plaster('#f1f1ee', 0.02), [3, 2]);
  const floor = useSurface('min-floor', paints.planks('#d9c5a5', 6), [3, 4]);
  const shadows = quality !== 'low';
  return (
    <group>
      <color attach="background" args={[night ? '#1b1c1e' : '#f3f3f0']} />
      <fog attach="fog" args={[night ? '#1b1c1e' : '#f3f3f0', 6, 16]} />
      <Shell width={width} wall="#ffffff" floor="#ffffff" wallMap={wall} floorMap={floor} height={caseH + 1.5} sides={false} />
      <Curtain position={[-CASE_W / 2 - 0.5, caseH * 0.62 + 0.2, WALL_Z + 0.06]} h={caseH + 0.9} night={night} />
      <SunShafts position={[-CASE_W / 2 - 0.4, caseH + 0.9, 0]} night={night} />
      <Particles count={pcount(quality, night ? 0 : 30) || 1} area={[-0.9, 0.3, 0.2, caseH + 0.6, 0.1, 0.9]} color="#fff2cf" size={0.004} speed={[0.004, 0.006, 0]} twinkle additive opacity={night ? 0 : 0.8} />
      <Plant position={[CASE_W / 2 + 0.28, 0, 0.35]} scale={2.4} pot="#e7e4dd" leaf="#4f7a53" />
      {/* a single framed print */}
      <group position={[0.05, caseH + 0.5, WALL_Z + 0.02]}>
        <Box size={[0.36, 0.46, 0.02]} position={[0, 0, 0]} color="#1c1c1c" />
        <Box size={[0.32, 0.42, 0.005]} position={[0, 0, 0.012]} color="#f6f4ef" />
        <mesh position={[0, 0.03, 0.016]}><circleGeometry args={[0.08, 32]} /><meshBasicMaterial color="#e3a03d" /></mesh>
      </group>
      <hemisphereLight args={[night ? '#5a5f6a' : '#ffffff', night ? '#1a1a1a' : '#bfb6a5', night ? 0.35 : 1.1]} />
      <directionalLight position={[-3, caseH + 2.5, 2.5]} intensity={night ? 0.15 : 2.0} color="#fff3dc" castShadow={shadows} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0015} />
      {night && <pointLight position={[0.4, caseH + 0.6, 1]} color="#ffd9a8" intensity={1.6} distance={4} />}
      <Decor ids={custom.decor} caseH={caseH} shadows={shadows} />
    </group>
  );
}

export const minimal: RoomDef = {
  id: 'minimal',
  tokens: TOKENS.minimal,
  ambience: () => ({ layers: ['wind'] }),
  Scene,
  look: (c) => ({ style: 'floating', color: c.shelfColor ?? '#f4f2ee', material: 'painted', labelInk: '#1c1c1c', labelBg: 'rgba(255,255,255,.95)' }),
  defaults: { night: false, shelfRows: 4, shelfMaterial: 'painted', decor: [] },
  colors: ['#f4f2ee', '#1c1c1c', '#c9b28d', '#8a9a8a'],
  preview: ['#f6f6f3', '#1c1c1c', '#c9b28d'],
};
