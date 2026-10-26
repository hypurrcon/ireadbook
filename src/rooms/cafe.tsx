import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { RoomDef, SceneProps } from './types';
import { TOKENS } from './tokens';
import { Shell, paints, useSurface, Decor, Box, WALL_Z, outside, PendantLamp, Plant, Mug, Plane } from './common';
import { CASE_W, CASE_D } from '../three/Bookcase';
import { labelTexture } from '../three/textures';

function Passersby({ width, y, z, night }: { width: number; y: number; z: number; night: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const people = useMemo(() => Array.from({ length: 4 }, (_, i) => ({ x: i * 0.8, s: 0.25 + Math.random() * 0.2, dir: i % 2 ? 1 : -1, h: 0.42 + Math.random() * 0.1, c: ['#3a3f4f', '#6b4a3a', '#2f4b6e', '#5b3a5e'][i] })), []);
  useFrame((_, dt) => {
    ref.current?.children.forEach((c, i) => {
      const p = people[i];
      c.position.x += p.dir * p.s * dt;
      if (c.position.x > width / 2) c.position.x = -width / 2;
      if (c.position.x < -width / 2) c.position.x = width / 2;
      c.position.y = y + Math.abs(Math.sin(c.position.x * 18)) * 0.006;
    });
  });
  return (
    <group ref={ref} position={[0, 0, z]}>
      {people.map((p, i) => (
        <group key={i} position={[p.x - width / 2, y, 0]}>
          <mesh position={[0, p.h / 2, 0]}><capsuleGeometry args={[0.05, p.h - 0.12, 4, 8]} /><meshBasicMaterial color={night ? '#0f1118' : p.c} /></mesh>
          <mesh position={[0, p.h + 0.02, 0]}><sphereGeometry args={[0.045, 10, 8]} /><meshBasicMaterial color={night ? '#0f1118' : '#c9a58a'} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Chalkboard({ position, lines }: { position: [number, number, number]; lines: string[] }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 360; c.height = 260;
    const x = c.getContext('2d')!;
    x.fillStyle = '#26302b'; x.fillRect(0, 0, 360, 260);
    x.fillStyle = '#f3f5ef'; x.textAlign = 'center';
    x.font = "600 34px 'Noto Serif Thai', serif";
    x.fillText(lines[0], 180, 70);
    x.font = "400 24px 'IBM Plex Sans Thai', sans-serif";
    lines.slice(1).forEach((l, i) => x.fillText(l, 180, 125 + i * 40));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [lines.join('|')]);
  void labelTexture;
  return (
    <group position={position}>
      <mesh><planeGeometry args={[0.5, 0.36]} /><meshStandardMaterial map={tex} roughness={1} /></mesh>
      <Box size={[0.54, 0.4, 0.015]} position={[0, 0, -0.01]} color="#6b4a2a" />
    </group>
  );
}

function Scene({ night, quality, width, caseH, custom }: SceneProps) {
  const wall = useSurface('cafe-wall', paints.brick('#eef0ea', '#cfd3c8'), [6, 4]);
  const floor = useSurface('cafe-floor', paints.tiles('#2f3a33', '#e6e3d8', 12), [3, 3]);
  const street = useMemo(() => outside.street(night), [night]);
  const shadows = quality === 'high';
  const winX = -CASE_W / 2 - 0.75;
  return (
    <group>
      <color attach="background" args={[night ? '#141820' : '#dfe5da']} />
      <fog attach="fog" args={[night ? '#141820' : '#dfe5da', 5.5, 14]} />
      <Shell width={width} wall="#ffffff" floor="#ffffff" wallMap={wall} floorMap={floor} height={caseH + 1.4} sides={false} />
      {/* shop window with people walking past */}
      <group position={[winX, caseH * 0.5 + 0.25, WALL_Z + 0.01]}>
        <mesh position={[0, 0, 0]}><planeGeometry args={[1.0, caseH + 0.5]} /><meshBasicMaterial map={street} toneMapped={false} /></mesh>
        <Passersby width={1.0} y={-(caseH + 0.5) / 2 + 0.12} z={0.005} night={night} />
        <Box size={[1.05, 0.05, 0.1]} position={[0, (caseH + 0.5) / 2, 0]} color="#1f5c45" />
        <Box size={[1.05, 0.05, 0.12]} position={[0, -(caseH + 0.5) / 2, 0]} color="#1f5c45" />
        {[-0.52, 0.52].map((x) => <Box key={x} size={[0.05, caseH + 0.5, 0.1]} position={[x, 0, 0]} color="#1f5c45" />)}
        <mesh position={[0, 0, 0.06]}><planeGeometry args={[1, caseH + 0.5]} /><meshStandardMaterial color="#e8f4ff" transparent opacity={0.08} roughness={0.05} /></mesh>
      </group>
      <Chalkboard position={[0, caseH + 0.42, WALL_Z + 0.02]} lines={['อ่านวันละนิด', 'ลาเต้ 65', 'โกโก้เย็น 55']} />
      {/* counter + espresso machine in the right foreground */}
      <group position={[CASE_W / 2 + 0.35, 0, CASE_D / 2 + 0.55]}>
        <Box size={[0.7, 0.95, 0.45]} position={[0, 0.475, 0]} color="#1f5c45" rough={0.5} />
        <Box size={[0.76, 0.04, 0.5]} position={[0, 0.97, 0]} color="#d8d2c4" rough={0.3} />
        <Box size={[0.32, 0.26, 0.24]} position={[-0.05, 1.12, -0.05]} color="#c9ccd1" metal={0.9} rough={0.25} />
        <Box size={[0.12, 0.03, 0.08]} position={[-0.05, 1.04, 0.1]} color="#2a2a2a" metal={0.5} />
        <Mug position={[-0.05, 0.99, 0.12]} color="#f3f5ef" steam />
      </group>
      <PendantLamp position={[-0.2, caseH + 0.6, 0.6]} shade="#1f5c45" color="#ffdca0" intensity={night ? 2.6 : 1.2} shadows={shadows} />
      <PendantLamp position={[0.45, caseH + 0.7, 0.9]} shade="#1f5c45" color="#ffdca0" intensity={night ? 2.0 : 0.8} />
      <hemisphereLight args={[night ? '#525a70' : '#ffffff', night ? '#1a1712' : '#a59a82', night ? 0.45 : 1.05]} />
      <directionalLight position={[-2.5, caseH + 1.5, 2]} intensity={night ? 0.2 : 1.4} color={night ? '#9ab0d8' : '#fff4dc'} castShadow={shadows} />
      <Plant position={[-CASE_W / 2 - 0.12, 0, 0.45]} scale={2.2} pot="#d8d2c4" leaf="#3f7a52" />
      <Plane w={0.01} h={0.01} position={[0, -2, 0]} />
      <Decor ids={custom.decor} caseH={caseH} shadows={shadows} />
    </group>
  );
}

export const cafe: RoomDef = {
  id: 'cafe',
  tokens: TOKENS.cafe,
  ambience: () => ({ layers: ['cafe'] }),
  Scene,
  look: (c) => ({ style: 'wood', color: c.shelfColor ?? '#a07a52', material: c.shelfMaterial, labelInk: '#f3f5ef', labelBg: 'rgba(31,92,69,.92)' }),
  defaults: { night: false, shelfRows: 4, shelfMaterial: 'wood', decor: [] },
  colors: ['#a07a52', '#1f5c45', '#6b4a2a', '#d8d2c4'],
  preview: ['#e6eadf', '#1f5c45', '#a07a52'],
};
