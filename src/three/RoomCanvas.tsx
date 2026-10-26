import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useTranslation } from 'react-i18next';
import type { Book, Quality, RoomCustomization } from '../db/types';
import { layoutShelves, shelfCapacity, effectiveRows, type SortMode } from '../domain/layout';
import { Bookcase, caseHeight, CASE_W, CASE_D } from './Bookcase';
import { Book3D, bookDims } from './Book3D';
import { Viewer, type Spin } from './Viewer';
import { getRoom, defaultCustomization } from '../rooms/registry';
import { ensureFonts } from './textures';
import { sfx, haptic } from '../audio/sound';

export const CASE_GAP = 0.34;
const PER_SHELF = 22;

interface Props {
  roomId: string;
  books: Book[];
  sortMode: SortMode;
  quality: Quality;
  custom?: RoomCustomization;
  seriesNames: Record<string, string>;
  pickedId: string | null;
  onPick: (b: Book | null) => void;
  highlightIds?: Set<string> | null;
  onCasesChange?: (n: number, index: number) => void;
  /** book ids in shelf order, for browsing next / previous in the viewer */
  onOrder?: (ids: string[]) => void;
  spin: React.MutableRefObject<Spin>;
}

function CameraRig({ caseIndex, caseH, picked, fov, yBias, zoom }: { caseIndex: number; caseH: number; picked: THREE.Vector3 | null; fov: number; yBias: number; zoom: number }) {
  const { camera, size } = useThree();
  const look = useRef(new THREE.Vector3(0, caseH / 2, 0));
  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const aspect = size.width / size.height;
    const t = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const fitH = (caseH + 0.5) / (2 * t);
    const fitW = (CASE_W + 0.35) / (2 * t * aspect);
    const dist = Math.max(fitH, fitW) / zoom;
    const cx = caseIndex * (CASE_W + CASE_GAP);
    const target = new THREE.Vector3(cx, caseH * 0.5 + yBias, 0);
    const pos = new THREE.Vector3(cx + 0.04, caseH * 0.52 + yBias + 0.05, dist + CASE_D / 2);
    if (picked) {
      target.copy(picked).add(new THREE.Vector3(0, 0.02, 0.2));
      pos.set(picked.x + 0.05, picked.y + 0.06, picked.z + 0.2 + Math.max(0.62, 0.55 / aspect));
    }
    const k = Math.min(1, dt * 4);
    cam.position.lerp(pos, k);
    look.current.lerp(target, k);
    cam.lookAt(look.current);
  });
  return null;
}

function FaceOut({ books, x, y, untitled, pickedId, onPick, shadows }: { books: Book[]; x: number; y: number; untitled: string; pickedId: string | null; onPick: (b: Book, e: ThreeEvent<PointerEvent>) => void; shadows: boolean }) {
  // currently-reading books displayed cover-out on top of the first bookcase
  const shown = books.slice(0, 3);
  const span = 0.28;
  return (
    <>
      {shown.map((b, i) => {
        const d = bookDims(b);
        const px = x + (i - (shown.length - 1) / 2) * span;
        return <Book3D key={b.id} book={b} untitled={untitled} faceOut position={[px, y, -CASE_D / 2 + d.t / 2 + 0.03]} hidden={pickedId === b.id} onPick={onPick} castShadow={shadows} />;
      })}
    </>
  );
}

export default function RoomCanvas({ roomId, books, sortMode, quality, custom, seriesNames, pickedId, onPick, highlightIds, onCasesChange, onOrder, spin }: Props) {
  const { t } = useTranslation();
  const room = getRoom(roomId);
  const cust = { ...defaultCustomization(room), ...(custom ?? {}) };
  const rows = effectiveRows(books.length, Math.max(2, Math.min(6, cust.shelfRows)));
  const caseH = caseHeight(rows);
  const reading = useMemo(() => books.filter((b) => b.status === 'reading').sort((a, b) => b.updatedAt - a.updatedAt), [books]);
  const onShelf = useMemo(() => books.filter((b) => !reading.slice(0, 3).some((r) => r.id === b.id)), [books, reading]);
  const cases = useMemo(() => layoutShelves(onShelf, sortMode, shelfCapacity(onShelf.length, rows, PER_SHELF), rows, seriesNames), [onShelf, sortMode, rows, seriesNames]);
  const [caseIndex, setCaseIndex] = useState(0);
  const [pickedPos, setPickedPos] = useState<THREE.Vector3 | null>(null);
  const [, setFontsReady] = useState(false);
  const readingIds = useMemo(() => new Set(reading.map((b) => b.id)), [reading]);
  const look = room.look(cust);
  const shadows = quality === 'high';
  const dpr: [number, number] = quality === 'low' ? [1, 1] : quality === 'mid' ? [1, 1.5] : [1, 2];

  useEffect(() => { ensureFonts().then(() => setFontsReady(true)); }, []);
  useEffect(() => { if (caseIndex >= cases.length) setCaseIndex(Math.max(0, cases.length - 1)); }, [cases.length, caseIndex]);
  useEffect(() => { onCasesChange?.(cases.length, caseIndex); }, [cases.length, caseIndex, onCasesChange]);
  useEffect(() => { if (!pickedId) setPickedPos(null); }, [pickedId]);
  useEffect(() => {
    onOrder?.([...reading.slice(0, 3).map((b) => b.id), ...cases.flatMap((c) => c.shelves.flatMap((s) => s.books.map((b) => b.id)))]);
  }, [cases, reading, onOrder]);
  const pickedBook = pickedId ? books.find((b) => b.id === pickedId) ?? null : null;
  // keep the bookcase that holds the picked book in view
  useEffect(() => {
    if (!pickedId) return;
    const i = cases.findIndex((c) => c.shelves.some((s) => s.books.some((b) => b.id === pickedId)));
    if (i >= 0 && i !== caseIndex) setCaseIndex(i);
  }, [pickedId]);

  const labelFor = (key: string) => {
    if (sortMode === 'genre') return t(`genre.${key}`);
    if (sortMode === 'status') return t(`status.${key}`);
    return key;
  };

  const handlePick = (b: Book, e: ThreeEvent<PointerEvent>) => {
    if ((e as any).delta > 10) return;
    if (pickedId === b.id) { onPick(null); sfx('bookIn'); return; }
    const p = new THREE.Vector3();
    e.object.getWorldPosition(p);
    setPickedPos(p);
    sfx('bookOut');
    haptic(10);
    onPick(b);
  };

  // horizontal swipe between bookcases
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3 && !pickedId) {
      const next = Math.max(0, Math.min(cases.length - 1, caseIndex + (dx < 0 ? 1 : -1)));
      if (next !== caseIndex) { setCaseIndex(next); sfx('open'); haptic(6); }
    }
  };

  const width = cases.length * (CASE_W + CASE_GAP) - CASE_GAP;
  const Scene = room.Scene;

  return (
    <div className="room-canvas" onPointerDown={onPointerDown} onPointerUp={onPointerUp} style={{ touchAction: 'pan-y' }}>
      <Canvas
        shadows={shadows}
        dpr={dpr}
        gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}
        camera={{ fov: room.camera?.fov ?? 38, position: [0, caseH / 2, 3], near: 0.05, far: 60 }}
        onPointerMissed={() => { if (pickedId) { sfx('bookIn'); onPick(null); } }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = room.exposure ?? 1; }}
      >
        <Suspense fallback={null}>
          <Scene night={cust.night} quality={quality} width={width} caseH={caseH} rows={rows} custom={cust} />
          {cases.map((c, i) => (
            <Bookcase key={i} x={i * (CASE_W + CASE_GAP)} shelves={c.shelves} rows={rows} look={look} pickedId={pickedId}
              readingIds={readingIds} untitled={t('common.untitled')} labelFor={labelFor} onPick={handlePick} shadows={shadows} dimIds={highlightIds} />
          ))}
          {room.faceOut !== false && <FaceOut books={reading} x={0} y={caseH} untitled={t('common.untitled')} pickedId={pickedId} onPick={handlePick} shadows={shadows} />}
          <Viewer book={pickedBook} spin={spin} untitled={t('common.untitled')} />
          <CameraRig caseIndex={caseIndex} caseH={caseH} picked={null} fov={room.camera?.fov ?? 38} yBias={room.camera?.yBias ?? 0} zoom={room.camera?.zoom ?? 1} />
        </Suspense>
      </Canvas>
      {cases.length > 1 && (
        <div className="case-dots" aria-hidden="true">
          {cases.map((_, i) => <span key={i} className={i === caseIndex ? 'on' : ''} />)}
        </div>
      )}
    </div>
  );
}
