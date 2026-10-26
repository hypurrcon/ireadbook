import { useMemo } from 'react';
import * as THREE from 'three';
import type { Book } from '../db/types';
import type { Shelf } from '../domain/layout';
import { Book3D, bookDims } from './Book3D';
import { labelTexture, proceduralTexture, rng } from './textures';
import type { ThreeEvent } from '@react-three/fiber';

export type FrameStyle = 'wood' | 'metal' | 'branch' | 'low' | 'strap' | 'floating' | 'stone';

export const CASE_W = 1.0;
export const ROW_H = 0.31;
export const BOARD = 0.024;
export const CASE_D = 0.27;

export interface BookcaseLook {
  style: FrameStyle;
  color: string;
  material: 'wood' | 'metal' | 'painted';
  labelInk: string;
  labelBg?: string;
  labelGlow?: string;
  ledColor?: string;
}

export function caseHeight(rows: number) { return rows * ROW_H + BOARD * 2 + 0.06; }

function woodTex(color: string) {
  return proceduralTexture('wood:' + color, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 70; i++) {
      const y = r() * h;
      ctx.strokeStyle = `rgba(0,0,0,${0.05 + r() * 0.12})`;
      ctx.lineWidth = 0.6 + r() * 1.6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / 30 + i) * 2.2);
      ctx.stroke();
    }
    for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(255,255,255,${r() * 0.04})`; ctx.fillRect(0, r() * h, w, 1); }
  }, [1, 1]);
}

function frameMaterial(look: BookcaseLook) {
  if (look.material === 'metal' || look.style === 'metal' || look.style === 'strap') {
    return new THREE.MeshStandardMaterial({ color: look.color, roughness: 0.35, metalness: 0.75 });
  }
  if (look.material === 'painted' || look.style === 'floating') {
    return new THREE.MeshStandardMaterial({ color: look.color, roughness: 0.6, metalness: 0 });
  }
  if (look.style === 'stone') {
    return new THREE.MeshStandardMaterial({ color: look.color, roughness: 0.95, metalness: 0 });
  }
  return new THREE.MeshStandardMaterial({ map: woodTex(look.color), roughness: 0.7, metalness: 0 });
}

const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);

function Board({ x, y, z, w, h, d, mat, cast }: { x: number; y: number; z: number; w: number; h: number; d: number; mat: THREE.Material; cast?: boolean }) {
  return <mesh geometry={box} material={mat} position={[x, y, z]} scale={[w, h, d]} castShadow={cast} receiveShadow />;
}

const LABEL_H = 0.026;
function labelWidth(text: string, look: BookcaseLook) {
  const { aspect } = labelTexture(text, { color: look.labelInk, bg: look.labelBg, glow: look.labelGlow, px: 40 });
  return LABEL_H * aspect;
}

function Label({ text, x, y, z, look, h = LABEL_H }: { text: string; x: number; y: number; z: number; look: BookcaseLook; h?: number }) {
  const { tex, aspect } = useMemo(() => labelTexture(text, { color: look.labelInk, bg: look.labelBg, glow: look.labelGlow, px: 40 }), [text, look.labelInk, look.labelBg, look.labelGlow]);
  return (
    <mesh position={[x + (h * aspect) / 2, y, z]}>
      <planeGeometry args={[h * aspect, h]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
}

interface Props {
  x: number;
  shelves: Shelf[];
  rows: number;
  look: BookcaseLook;
  pickedId?: string | null;
  readingIds: Set<string>;
  untitled: string;
  labelFor: (key: string) => string;
  onPick: (b: Book, e: ThreeEvent<PointerEvent>) => void;
  shadows: boolean;
  dimIds?: Set<string> | null;
}

export function Bookcase({ x, shelves, rows, look, pickedId, readingIds, untitled, labelFor, onPick, shadows, dimIds }: Props) {
  const mat = useMemo(() => frameMaterial(look), [look.color, look.material, look.style]);
  const ledMat = useMemo(() => look.ledColor ? new THREE.MeshBasicMaterial({ color: look.ledColor, toneMapped: false }) : null, [look.ledColor]);
  const H = caseHeight(rows);
  const inner = CASE_W - 0.06;
  const style = look.style;

  const frame: JSX.Element[] = [];
  const side = style === 'floating' ? 0 : style === 'metal' ? 0.018 : 0.03;
  if (style === 'branch') {
    // two crooked branch posts + plank shelves lashed to them
    const r = rng(3);
    for (const sx of [-CASE_W / 2 + 0.03, CASE_W / 2 - 0.03]) {
      for (let i = 0; i < 4; i++) {
        const y0 = (i * H) / 4, y1 = ((i + 1) * H) / 4;
        const dx = (r() - 0.5) * 0.03;
        frame.push(<mesh key={`p${sx}${i}`} geometry={cyl} material={mat} position={[sx + dx, (y0 + y1) / 2, -0.02]} scale={[0.028, y1 - y0 + 0.02, 0.028]} rotation={[0, 0, (r() - 0.5) * 0.08]} castShadow={shadows} />);
      }
    }
  } else if (style === 'metal' || style === 'strap') {
    for (const sx of [-CASE_W / 2, CASE_W / 2]) for (const sz of [-CASE_D / 2, CASE_D / 2]) {
      frame.push(<Board key={`post${sx}${sz}`} x={sx} y={H / 2} z={sz} w={0.022} h={H} d={0.022} mat={mat} cast={shadows} />);
    }
  } else if (style !== 'floating') {
    frame.push(<Board key="l" x={-CASE_W / 2 + side / 2} y={H / 2} z={0} w={side} h={H} d={CASE_D} mat={mat} cast={shadows} />);
    frame.push(<Board key="r" x={CASE_W / 2 - side / 2} y={H / 2} z={0} w={side} h={H} d={CASE_D} mat={mat} cast={shadows} />);
    frame.push(<Board key="back" x={0} y={H / 2} z={-CASE_D / 2 + 0.005} w={CASE_W} h={H} d={0.01} mat={mat} />);
    frame.push(<Board key="top" x={0} y={H - BOARD / 2} z={0} w={CASE_W + (style === 'stone' ? 0.06 : 0.02)} h={BOARD * (style === 'stone' ? 1.6 : 1)} d={CASE_D + 0.02} mat={mat} cast={shadows} />);
    frame.push(<Board key="plinth" x={0} y={0.03} z={0.005} w={CASE_W} h={0.06} d={CASE_D} mat={mat} />);
  }

  const rowsEls: JSX.Element[] = [];
  for (let i = 0; i < rows; i++) {
    const y = 0.06 + i * ROW_H; // top surface of the board for row i (bottom row first)
    const boardW = style === 'floating' ? CASE_W * 0.96 : CASE_W - side * 2;
    if (style === 'branch') {
      rowsEls.push(<Board key={`b${i}`} x={0} y={y - BOARD / 2} z={0} w={CASE_W + 0.05} h={BOARD} d={CASE_D} mat={mat} cast={shadows} />);
    } else {
      rowsEls.push(<Board key={`b${i}`} x={0} y={y - BOARD / 2} z={0} w={boardW} h={BOARD} d={CASE_D} mat={mat} cast={shadows} />);
    }
    if (ledMat) rowsEls.push(<mesh key={`led${i}`} geometry={box} material={ledMat} position={[0, y + ROW_H - BOARD - 0.006, CASE_D / 2 - 0.01]} scale={[boardW, 0.004, 0.004]} />);
    if (style === 'strap') rowsEls.push(<mesh key={`s${i}`} geometry={box} position={[0, y + 0.09, CASE_D / 2 - 0.035]} scale={[boardW, 0.018, 0.004]}><meshStandardMaterial color="#c9862f" roughness={0.6} /></mesh>);
  }

  const books: JSX.Element[] = [];
  const labels: JSX.Element[] = [];
  // shelves[0] is the top row (reading order), so map shelf index → row from the top
  shelves.forEach((shelf, si) => {
    const row = rows - 1 - si;
    if (row < 0) return;
    const yBase = 0.06 + row * ROW_H;
    const dims = shelf.books.map(bookDims);
    const total = dims.reduce((a, d) => a + d.t + 0.0025, 0);
    const squeeze = total > inner ? inner / total : 1;
    let cx = -inner / 2;
    let labelEnd = -Infinity;
    shelf.books.forEach((b, bi) => {
      const d = dims[bi];
      const t = d.t * squeeze;
      const seg = shelf.segments.find((s) => s.start === bi);
      if (seg && seg.label) {
        const text = labelFor(seg.label);
        const w = labelWidth(text, look);
        if (cx >= labelEnd + 0.004) {
          labels.push(<Label key={`lab${si}-${bi}`} text={text} x={cx} y={yBase - BOARD / 2} z={CASE_D / 2 + 0.002} look={look} />);
          labelEnd = cx + w;
        } else {
          // no room for the name: a small divider tab still marks where the group starts
          labels.push(<mesh key={`tab${si}-${bi}`} position={[cx - 0.0012, yBase - BOARD / 2, CASE_D / 2 + 0.002]}><planeGeometry args={[0.004, BOARD * 0.8]} /><meshBasicMaterial color={look.labelInk} toneMapped={false} /></mesh>);
        }
      }
      books.push(
        <Book3D key={b.id} book={b} untitled={untitled} position={[x + cx + t / 2, yBase, CASE_D / 2 - d.d / 2 - 0.012]}
          picked={pickedId === b.id} onPick={onPick} castShadow={shadows} dimmed={!!dimIds && !dimIds.has(b.id)}
          glow={readingIds.has(b.id) ? look.ledColor ?? '#ffcf7a' : undefined} />,
      );
      cx += t + 0.0025 * squeeze;
    });
  });

  return (
    <>
      <group position={[x, 0, 0]}>
        {frame}
        {rowsEls}
        <group>{labels}</group>
      </group>
      {books}
    </>
  );
}
