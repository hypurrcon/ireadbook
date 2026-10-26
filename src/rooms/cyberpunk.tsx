import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { RoomDef, SceneProps } from './types';
import { TOKENS } from './tokens';
import { Shell, paints, useSurface, WindowFrame, outside, Particles, Decor, Box, Plane, WALL_Z, pcount } from './common';
import { labelTexture } from '../three/textures';
import { CASE_W } from '../three/Bookcase';

function NeonSign({ text, position, color, h = 0.16 }: { text: string; position: [number, number, number]; color: string; h?: number }) {
  const { tex, aspect } = useMemo(() => labelTexture(text, { color: '#fff4fb', glow: color, px: 90, font: "'IBM Plex Sans Thai', sans-serif", padX: 40 }), [text, color]);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    const t = clock.elapsedTime;
    // occasional flicker, like a real tube
    mat.current.opacity = Math.sin(t * 0.7) > 0.985 ? 0.35 + Math.random() * 0.4 : 1;
  });
  return (
    <group position={position}>
      <mesh><planeGeometry args={[h * aspect, h]} /><meshBasicMaterial ref={mat} map={tex} transparent toneMapped={false} /></mesh>
      <pointLight position={[0, 0, 0.25]} color={color} intensity={1.6} distance={2.5} decay={1.5} />
    </group>
  );
}

function Holo({ position, w, h, color }: { position: [number, number, number]; w: number; h: number; color: string }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const x = c.getContext('2d')!;
    x.strokeStyle = color; x.globalAlpha = 0.9; x.lineWidth = 2;
    x.strokeRect(3, 3, 122, 122);
    x.globalAlpha = 0.35;
    for (let y = 0; y < 128; y += 4) x.fillRect(0, y, 128, 1);
    x.globalAlpha = 0.8;
    x.fillStyle = color;
    for (let i = 0; i < 6; i++) x.fillRect(12, 20 + i * 16, 30 + Math.random() * 70, 5);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [color]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (ref.current) { ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 1.2) * 0.012; (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(clock.elapsedTime * 9) * 0.05; } });
  return <mesh ref={ref} position={position} rotation={[0, -0.35, 0]}><planeGeometry args={[w, h]} /><meshBasicMaterial map={tex} transparent opacity={0.6} toneMapped={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>;
}

function Scene({ night, quality, width, caseH, custom }: SceneProps) {
  const wall = useSurface('cp-wall', paints.panel('#1d1a2b', '#2b2740'), [6, 4]);
  const floor = useSurface('cp-floor', paints.tiles('#15131f', '#1b1828', 8), [6, 6]);
  const view = useMemo(() => outside.city(night), [night]);
  const shadows = quality === 'high';
  return (
    <group>
      <color attach="background" args={['#07060d']} />
      <fog attach="fog" args={['#0b0814', 4, 12]} />
      <Shell width={width} wall="#ffffff" floor="#ffffff" wallMap={wall} floorMap={floor} height={3.4} sides={false} />
      {/* wet floor sheen */}
      <Plane w={width + 6} h={4} position={[width / 2, 0.002, 1.6]} rotation={[-Math.PI / 2, 0, 0]} color="#1a1530" rough={0.15} metal={0.6} transparent opacity={0.55} />
      {/* tall window to the right: the city in the rain */}
      <WindowFrame position={[CASE_W / 2 + 0.62, caseH * 0.62 + 0.25, WALL_Z + 0.02]} w={0.75} h={caseH + 0.4} frame="#2a2638" view={view} glass={0.1} bars={false} />
      <Particles count={pcount(quality, 120)} area={[CASE_W / 2 + 0.25, CASE_W / 2 + 1.0, 0.1, caseH + 0.9, WALL_Z - 0.03, WALL_Z - 0.02]} color="#9fb6ff" size={0.025} kind="streak" speed={[-0.05, -2.2, 0]} opacity={0.35} />
      <NeonSign text="อ่าน" position={[0, caseH + 0.42, WALL_Z + 0.03]} color="#ff3d7f" />
      <NeonSign text="24/7" position={[-CASE_W / 2 - 0.42, caseH * 0.8, WALL_Z + 0.03]} color="#2ef2ff" h={0.1} />
      {/* pipes and cables */}
      {[-0.06, 0.04].map((dy, i) => <mesh key={i} position={[width / 2, caseH + 0.82 + dy, WALL_Z + 0.06]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.025, 0.025, width + 6, 10]} /><meshStandardMaterial color="#2a2733" metalness={0.8} roughness={0.35} /></mesh>)}
      <mesh position={[-CASE_W / 2 - 0.12, caseH * 0.5, WALL_Z + 0.04]}><cylinderGeometry args={[0.012, 0.012, caseH + 2, 8]} /><meshStandardMaterial color="#111" /></mesh>
      <Holo position={[-CASE_W / 2 - 0.05, caseH * 0.62, 0.45]} w={0.3} h={0.22} color="#2ef2ff" />
      {/* lights: magenta key from the sign, cyan rim from the window */}
      <ambientLight color="#3a2a6a" intensity={0.55} />
      <pointLight position={[0.2, caseH * 0.5, 1.2]} color="#ff5ea0" intensity={1.4} distance={4} />
      <pointLight position={[CASE_W / 2 + 0.6, caseH * 0.6, 0.4]} color="#2ef2ff" intensity={1.6} distance={3.5} />
      <spotLight position={[0, caseH + 1.4, 1.6]} angle={0.6} penumbra={0.6} intensity={night ? 6 : 9} color="#d9d2ff" castShadow={shadows} />
      {/* crate + console in the foreground */}
      <Box size={[0.42, 0.3, 0.32]} position={[-CASE_W / 2 + 0.05, 0.15, 0.75]} rotation={[0, 0.25, 0]} color="#272235" metal={0.4} rough={0.5} />
      <Box size={[0.2, 0.01, 0.14]} position={[-CASE_W / 2 + 0.05, 0.305, 0.75]} rotation={[0, 0.25, 0]} color="#000" emissive="#2ef2ff" emissiveIntensity={0.6} />
      <Particles count={pcount(quality, 30)} area={[-0.6, 0.6, 0.1, caseH + 0.4, 0.2, 1.2]} color="#ff7ab0" size={0.004} speed={[0.0, 0.02, 0]} twinkle additive />
      <Decor ids={custom.decor} caseH={caseH} shadows={shadows} />
    </group>
  );
}

export const cyberpunk: RoomDef = {
  id: 'cyberpunk',
  tokens: TOKENS.cyberpunk,
  ambience: () => ({ layers: ['rain', 'synth', 'hum'] }),
  Scene,
  look: (c) => ({ style: 'metal', color: c.shelfColor ?? '#2c2a3a', material: 'metal', labelInk: '#2ef2ff', labelBg: 'rgba(14,12,23,.85)', labelGlow: '#2ef2ff', ledColor: '#2ef2ff' }),
  defaults: { night: true, shelfRows: 4, shelfMaterial: 'metal', decor: [] },
  colors: ['#2c2a3a', '#3a1f2e', '#1f2e3a', '#4a4a52'],
  exposure: 1.1,
  preview: ['#0e0c17', '#ff3d7f', '#2ef2ff'],
};
