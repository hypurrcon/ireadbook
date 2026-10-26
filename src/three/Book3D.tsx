import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Book } from '../db/types';
import { coverTexture, fallbackCover, pagesTexture, spineTexture, bookColor } from './textures';

export interface BookDims { h: number; t: number; d: number; w: number }

function hash01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

export function bookDims(b: Book): BookDims {
  const r = hash01(b.id);
  let h = b.format === 'hardcover' ? 0.235 : 0.21;
  if (b.genre === 'comics') h = 0.18;
  h += (r - 0.5) * 0.02;
  const t = b.pageCount ? Math.min(0.07, Math.max(0.009, 0.006 + b.pageCount * 0.00009)) : 0.018 + r * 0.014;
  const aspect = b.coverAspect && b.coverAspect > 0.4 && b.coverAspect < 1.2 ? b.coverAspect : 0.68;
  const d = Math.min(0.2, Math.max(0.11, h * aspect));
  return { h, t, d, w: d };
}

const geo = new THREE.BoxGeometry(1, 1, 1);
const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

interface Props {
  book: Book;
  position: [number, number, number];
  rotationY?: number;
  faceOut?: boolean;
  picked?: boolean;
  dimmed?: boolean;
  untitled: string;
  onPick?: (b: Book, e: ThreeEvent<PointerEvent>) => void;
  castShadow?: boolean;
  glow?: string;
  /** centre height above the board and tilt, from the shelf arrangement */
  pose?: { y: number; rotZ: number; t?: number };
  /** shown in the big viewer instead: keep its place on the shelf empty */
  hidden?: boolean;
}

/** A book standing with its spine toward +z. When picked it slides out and turns its cover to the camera. */
export function Book3D({ book, position, rotationY = 0, faceOut, picked, dimmed, untitled, onPick, castShadow, glow, pose, hidden }: Props) {
  const dims = useMemo(() => bookDims(book), [book.id, book.pageCount, book.format, book.genre, book.coverAspect]);
  const group = useRef<THREE.Group>(null);
  const [front, setFront] = useState<THREE.Texture | null>(null);
  const [back, setBack] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let alive = true;
    coverTexture(book.coverFrontId).then((t) => alive && setFront(t));
    coverTexture(book.coverBackId).then((t) => alive && setBack(t));
    return () => { alive = false; };
  }, [book.coverFrontId, book.coverBackId]);

  const mats = useMemo(() => {
    const col = new THREE.Color(bookColor(book));
    const pages = pagesTexture();
    const frontTex = front ?? fallbackCover(book, untitled);
    const m = (map?: THREE.Texture | null, color?: THREE.Color) => new THREE.MeshStandardMaterial({ map: map ?? null, color: color ?? new THREE.Color('#ffffff'), roughness: 0.78, metalness: 0 });
    return [
      m(frontTex),               // +x  front cover
      back ? m(back) : m(null, col.clone().multiplyScalar(0.85)), // -x back cover
      m(pages),                  // +y  top edge
      m(pages),                  // -y  bottom edge
      m(spineTexture(book, untitled)), // +z spine
      m(pages),                  // -z  fore-edge
    ];
  }, [book, front, back, untitled]);

  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);

  useEffect(() => {
    for (const m of mats) {
      m.emissive = new THREE.Color(glow ?? '#000000');
      m.emissiveIntensity = glow ? 0.08 : 0;
      m.opacity = dimmed ? 0.25 : 1;
      m.transparent = !!dimmed;
    }
  }, [mats, glow, dimmed]);

  // animation state
  const anim = useRef({ out: 0, vis: 1 });
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const a = anim.current;
    a.out += ((picked ? 1 : 0) - a.out) * Math.min(1, dt * 7);
    a.vis += ((hidden ? 0 : 1) - a.vis) * Math.min(1, dt * 9);
    const o = a.out;
    const baseRot = faceOut ? -Math.PI / 2 : rotationY;
    const cy = pose ? pose.y : dims.h / 2;
    g.position.set(position[0], position[1] + cy + o * 0.04, position[2] + o * (faceOut ? 0.1 : 0.12));
    g.rotation.set(0, baseRot, (pose?.rotZ ?? 0) * (1 - o));
    g.scale.setScalar(Math.max(0.0001, a.vis));
    g.visible = a.vis > 0.02;
  });

  const thick = pose?.t ?? dims.t;
  const ribbon = book.status === 'reading';
  return (
    <group ref={group} position={[position[0], position[1] + (pose ? pose.y : dims.h / 2), position[2]]} rotation={[0, faceOut ? -Math.PI / 2 : rotationY, pose?.rotZ ?? 0]}>
      <mesh geometry={geo} material={mats} scale={[thick, dims.h, dims.d]} castShadow={castShadow} receiveShadow={castShadow} />
      {/* generous invisible hit area: thin spines are hard to tap on a phone */}
      {onPick && (
        <mesh geometry={geo} material={hitMat} scale={[Math.max(thick, 0.034), dims.h + 0.02, dims.d + 0.03]} position={[0, 0, 0.015]}
          onClick={(e) => { e.stopPropagation(); onPick(book, e as unknown as ThreeEvent<PointerEvent>); }} userData={{ bookId: book.id }} />
      )}
      {ribbon && (
        <mesh position={[0, dims.h / 2 + 0.014, -dims.d * 0.15]} rotation={[0, 0, 0.12]}>
          <boxGeometry args={[Math.min(thick * 0.6, 0.008), 0.034, 0.0015]} />
          <meshStandardMaterial color="#b3261e" roughness={0.6} />
        </mesh>
      )}
    </group>
  );
}
