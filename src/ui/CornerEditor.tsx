import { useEffect, useRef, useState } from 'react';
import type { Pt } from '../db/types';
import { haptic } from '../audio/sound';

/**
 * Shows a photo with four draggable corner handles (image pixel coordinates).
 * A loupe magnifies the area under the finger while dragging.
 */
export function CornerEditor({ src, width, height, corners, onChange }: {
  src: string; width: number; height: number; corners: Pt[]; onChange: (c: Pt[]) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1, h: 1, ox: 0, oy: 0, s: 1 });
  const [drag, setDrag] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const s = Math.min(r.width / width, r.height / height);
      setSize({ w: width * s, h: height * s, ox: (r.width - width * s) / 2, oy: (r.height - height * s) / 2, s });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  const toImg = (clientX: number, clientY: number): Pt => {
    const r = box.current!.getBoundingClientRect();
    const x = (clientX - r.left - size.ox) / size.s;
    const y = (clientY - r.top - size.oy) / size.s;
    return { x: Math.max(0, Math.min(width, x)), y: Math.max(0, Math.min(height, y)) };
  };

  const onMove = (e: React.PointerEvent) => {
    if (drag === null) return;
    const p = toImg(e.clientX, e.clientY);
    const next = corners.map((c, i) => (i === drag ? p : c));
    onChange(next);
  };

  const scr = (p: Pt) => ({ x: size.ox + p.x * size.s, y: size.oy + p.y * size.s });
  const poly = corners.map((p) => { const s = scr(p); return `${s.x},${s.y}`; }).join(' ');
  const active = drag !== null ? scr(corners[drag]) : null;
  const LOUPE = 110, ZOOM = 2.6;

  return (
    <div className="corner-editor" ref={box} onPointerMove={onMove} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
      <img src={src} alt="" draggable={false} style={{ left: size.ox, top: size.oy, width: size.w, height: size.h }} />
      <svg className="corner-svg" width="100%" height="100%">
        <defs>
          <mask id="ce-mask">
            <rect width="100%" height="100%" fill="white" />
            <polygon points={poly} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,.5)" mask="url(#ce-mask)" />
        <polygon points={poly} fill="none" stroke="var(--accent)" strokeWidth="2" />
      </svg>
      {corners.map((c, i) => {
        const s = scr(c);
        return (
          <button key={i} type="button" className={`corner-handle ${drag === i ? 'on' : ''}`} style={{ left: s.x, top: s.y }}
            aria-label={`corner ${i + 1}`}
            onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setDrag(i); haptic(6); }}
            onPointerMove={onMove} onPointerUp={() => setDrag(null)} />
        );
      })}
      {active && (
        <div className="corner-loupe" style={{
          width: LOUPE, height: LOUPE,
          left: Math.min(Math.max(8, active.x - LOUPE / 2), size.ox * 2 + size.w - LOUPE - 8),
          top: active.y > LOUPE + 40 ? active.y - LOUPE - 36 : active.y + 36,
          backgroundImage: `url(${src})`,
          backgroundSize: `${size.w * ZOOM}px ${size.h * ZOOM}px`,
          backgroundPosition: `${-(active.x - size.ox) * ZOOM + LOUPE / 2}px ${-(active.y - size.oy) * ZOOM + LOUPE / 2}px`,
        }}><i /></div>
      )}
    </div>
  );
}
