import type { CSSProperties } from 'react';
import type { Book } from '../db/types';
import { useImageUrl } from '../hooks/data';
import { bookColor, inkOn } from './color';

export function Cover({ book, width = 44, className = '', style }: { book: Book; width?: number; className?: string; style?: CSSProperties }) {
  const url = useImageUrl(book.coverFrontId);
  const aspect = book.coverAspect && book.coverAspect > 0.4 && book.coverAspect < 1.2 ? book.coverAspect : 0.68;
  const base: CSSProperties = { width, height: Math.round(width / aspect), ...style };
  if (url) return <img className={`cover ${className}`} src={url} alt="" style={base} draggable={false} />;
  const col = bookColor(book);
  return (
    <div className={`cover cover-gen ${className}`} style={{ ...base, background: col, color: inkOn(col), fontSize: Math.max(8, width / 7) }} aria-hidden="true">
      {width >= 64 ? <span>{book.title}</span> : <i className="cover-mark" />}
    </div>
  );
}
