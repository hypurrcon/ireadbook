import { useEffect, useState } from 'react';
import type { Book } from '../db/types';
import { useImageUrl } from '../hooks/data';
import { bookColor, inkOn } from './color';

const PAGE_EVERY_MS = 9000;

/**
 * The chosen book opening on screen, then turning a page every few seconds
 * while the timer runs. Pure CSS 3D so it stays light on phones.
 */
export function ReadingBook({ book, running, untitled }: { book: Book; running: boolean; untitled: string }) {
  const cover = useImageUrl(book.coverFrontId);
  const [open, setOpen] = useState(false);
  const [leaves, setLeaves] = useState<number[]>([]);
  const col = bookColor(book);

  useEffect(() => { const t = setTimeout(() => setOpen(true), 350); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (!running || !open) return;
    let n = 0;
    const first = setTimeout(() => setLeaves((l) => [...l, Date.now()]), 2600);
    const id = setInterval(() => { n++; setLeaves((l) => [...l.slice(-2), Date.now() + n]); }, PAGE_EVERY_MS);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [running, open]);

  return (
    <div className={`reading-book ${open ? 'open' : ''} ${running ? '' : 'paused'}`} aria-hidden="true">
      <div className="rb-body">
        <div className="rb-page left"><i /></div>
        <div className="rb-page right"><i /></div>
        {leaves.map((k) => (
          <div key={k} className="rb-leaf" onAnimationEnd={() => setLeaves((l) => l.filter((x) => x !== k))}>
            <div className="rb-face front"><i /></div>
            <div className="rb-face back"><i /></div>
          </div>
        ))}
        <div className="rb-cover" style={{ background: col }}>
          <div className="rb-face front" style={{ background: col, color: inkOn(col) }}>
            {cover ? <img src={cover} alt="" /> : <span>{book.title || untitled}</span>}
          </div>
          <div className="rb-face back"><i /></div>
        </div>
      </div>
    </div>
  );
}
