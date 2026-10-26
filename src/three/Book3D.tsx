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
}

/** A book standing with its spine toward +z. When picked it slides out and turns its cover to the camera. */
export function Book3D({ book, position, rotationY = 0, faceOut, picked, dimmed, untitled, onPick, castShadow, glow }: Props) {
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
  const anim = useRef({ out: 0 });
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const target = picked ? 1 : 0;
    const a = anim.current;
    a.out += (target - a.out) * Math.min(1, dt * 7);
    const o = a.out;
    const baseRot = faceOut ? -Math.PI / 2 : rotationY;
    g.position.set(position[0], position[1] + dims.h / 2 + o * 0.06, position[2] + o * (faceOut ? 0.12 : 0.26));
    g.rotation.set(o * 0.08, baseRot + (faceOut ? 0 : -o * (Math.PI / 2) * 0.92), 0);
    g.scale.setScalar(1 + o * 0.15);
  });

  return (
    <group ref={group} position={[position[0], position[1] + dims.h / 2, position[2]]} rotation={[0, faceOut ? -Math.PI / 2 : rotationY, 0]}>
      <mesh
        geometry={geo}
        material={mats}
        scale={[dims.t, dims.h, dims.d]}
        castShadow={castShadow}
        receiveShadow={castShadow}
        onClick={(e) => { e.stopPropagation(); onPick?.(book, e as unknown as ThreeEvent<PointerEvent>); }}
        userData={{ bookId: book.id }}
      />
    </group>
  );
}
