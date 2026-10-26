import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { RoomDef, SceneProps } from './types';
import { TOKENS } from './tokens';
import { Shell, paints, useSurface, Decor, Box, WALL_Z, outside, Particles, pcount, PendantLamp } from './common';
import { CASE_W } from '../three/Bookcase';

function Fish({ y, z, speed, color, size, phase }: { y: number; z: number; speed: number; color: string; size: number; phase: number }) {
  const ref = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const g = ref.current; if (!g) return;
    const span = 1.3;
    const x = ((t * speed + phase) % span) - span / 2;
    g.position.set(x, y + Math.sin(t * 0.8 + phase) * 0.05, z);
    if (tail.current) tail.current.rotation.y = Math.sin(t * 9 + phase) * 0.5;
  });
  return (
    <group ref={ref} scale={size}>
      <mesh scale={[1, 0.5, 0.25]}><sphereGeometry args={[0.1, 12, 8]} /><meshStandardMaterial color={color} roughness={0.4} emissive={color} emissiveIntensity={0.15} /></mesh>
      <mesh ref={tail} position={[-0.11, 0, 0]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[0.05, 0.07, 3]} /><meshStandardMaterial color={color} /></mesh>
    </group>
  );
}

function Caustics({ w, h, position }: { w: number; h: number; position: [number, number, number] }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d')!;
    x.strokeStyle = 'rgba(190,255,245,.55)';
    for (let i = 0; i < 40; i++) { x.lineWidth = 1 + Math.random() * 2.5; x.beginPath(); const cx = Math.random() * 256, cy = Math.random() * 256, r = 14 + Math.random() * 30; x.ellipse(cx, cy, r, r * 0.7, Math.random() * 3, 0, Math.PI * 1.6); x.stroke(); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
    return t;
  }, []);
  useFrame((_, dt) => { tex.offset.x += dt * 0.02; tex.offset.y += dt * 0.013; });
  return <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[w, h]} /><meshBasicMaterial map={tex} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>;
}

function Scene({ quality, width, caseH, custom }: SceneProps) {
  const wall = useSurface('uw-wall', paints.panel('#2c4a55', '#1d3640'), [8, 5]);
  const floor = useSurface('uw-floor', paints.planks('#3a3a36', 8), [4, 4]);
  const sea = useMemo(() => outside.sea(), []);
  const shadows = quality === 'high';
  const winX = CASE_W / 2 + 0.7;
  return (
    <group>
      <color attach="background" args={['#021219']} />
      <fog attach="fog" args={['#03222c', 4, 11]} />
      <Shell width={width} wall="#ffffff" floor="#ffffff" wallMap={wall} floorMap={floor} height={caseH + 1.3} sides={false} ceiling="#1d3640" />
      {/* big curved viewport */}
      <group position={[winX, caseH * 0.55 + 0.2, WALL_Z + 0.01]}>
        <mesh><planeGeometry args={[1.2, caseH + 0.6]} /><meshBasicMaterial map={sea} toneMapped={false} /></mesh>
        <group position={[0, 0, 0.04]}>
          <Fish y={0.1} z={0} speed={0.18} color="#ffb547" size={1} phase={0} />
          <Fish y={-0.2} z={0.01} speed={0.12} color="#7fe3ff" size={0.7} phase={1.4} />
          <Fish y={0.35} z={0.02} speed={0.09} color="#ff7a5c" size={1.3} phase={2.1} />
        </group>
        <Particles count={pcount(quality, 30)} area={[-0.55, 0.55, -caseH / 2, caseH / 2, 0.08, 0.1]} color="#d6fbff" size={0.01} speed={[0, 0.18, 0]} opacity={0.5} />
        <mesh position={[0, 0, 0.14]}><planeGeometry args={[1.2, caseH + 0.6]} /><meshStandardMaterial color="#9ff0ff" transparent opacity={0.07} roughness={0} /></mesh>
      </group>
      <Box size={[0.08, caseH + 0.7, 0.3]} position={[winX - 0.62, caseH * 0.55 + 0.2, WALL_Z + 0.1]} color="#4a6a75" metal={0.6} rough={0.3} />
      <Box size={[0.08, caseH + 0.7, 0.3]} position={[winX + 0.62, caseH * 0.55 + 0.2, WALL_Z + 0.1]} color="#4a6a75" metal={0.6} rough={0.3} />
      {/* small porthole above the bookcase */}
      <group position={[0, caseH + 0.48, WALL_Z + 0.02]}>
        <mesh position={[0, 0, -0.01]}><circleGeometry args={[0.18, 32]} /><meshBasicMaterial map={sea} toneMapped={false} /></mesh>
        <mesh><torusGeometry args={[0.2, 0.035, 12, 32]} /><meshStandardMaterial color="#b08a46" metalness={0.8} roughness={0.3} /></mesh>
      </group>
      <Caustics w={width + 3} h={3} position={[width / 2, 0.004, 0.8]} />
      <PendantLamp position={[-0.3, caseH + 0.62, 0.7]} shade="#b08a46" color="#ffd27a" intensity={2.4} shadows={shadows} cord={0.4} />
      <ambientLight color="#2e7f8a" intensity={0.65} />
      <pointLight position={[winX, caseH * 0.6, 0.3]} color="#5ef0d2" intensity={1.4} distance={3} />
      <Particles count={pcount(quality, 25)} area={[-0.8, 0.8, 0.1, caseH + 0.6, 0.2, 1.2]} color="#bff6ff" size={0.005} speed={[0, 0.05, 0]} twinkle opacity={0.4} />
      <Decor ids={custom.decor} caseH={caseH} shadows={shadows} />
    </group>
  );
}

export const underwater: RoomDef = {
  id: 'underwater',
  tokens: TOKENS.underwater,
  ambience: () => ({ layers: ['ocean', 'bubbles', 'hum'] }),
  Scene,
  look: (c) => ({ style: 'metal', color: c.shelfColor ?? '#b08a46', material: 'metal', labelInk: '#04202a', labelBg: 'rgba(255,210,122,.95)' }),
  defaults: { night: false, shelfRows: 4, shelfMaterial: 'metal', decor: [] },
  colors: ['#b08a46', '#4a6a75', '#8a9aa0', '#5a3a2a'],
  preview: ['#04202a', '#ffd27a', '#5ef0d2'],
};
