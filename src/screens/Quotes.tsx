import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import * as repo from '../db/repo';
import type { Quote } from '../db/types';
import { Button, Field, Sheet, toast } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { blobToRaw, downscaleBlob } from '../image/process';
import { ocrPlain } from '../lookup/ocr';
import { shareQuote } from '../share/actions';

/** Quotes saved for one book, with add (typed or from a page photo) and share. */
export function QuoteList({ bookId, count }: { bookId: string; count: number }) {
  const { t } = useTranslation();
  const quotes = useLiveQuery(() => db.quotes.where('bookId').equals(bookId).reverse().sortBy('createdAt'), [bookId]) ?? [];
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Quote | null>(null);
  return (
    <section className="section">
      <div className="section-head">
        <h2>{t('book.quotes')}{count ? ` · ${count}` : ''}</h2>
        <Button size="sm" icon="quote" onClick={() => setOpen(true)}>{t('quote.add')}</Button>
      </div>
      {quotes.length === 0 ? <p className="muted small">{t('quote.empty')}</p> : (
        <div className="quotes">
          {quotes.map((q) => (
            <button key={q.id} className="quote-card" onClick={() => setView(q)}>
              <p>{q.text}</p>
              {q.page ? <span className="muted small">{t('quote.page', { page: q.page })}</span> : null}
            </button>
          ))}
        </div>
      )}
      <AddQuoteSheet bookId={bookId} open={open} onClose={() => setOpen(false)} />
      <Sheet open={!!view} onClose={() => setView(null)} title={t('book.quotes')}>
        {view && (
          <>
            <blockquote className="quote-big">{view.text}</blockquote>
            {view.page ? <p className="muted small">{t('quote.page', { page: view.page })}</p> : null}
            <div className="sheet-actions">
              <Button variant="danger" icon="trash" onClick={async () => { await repo.deleteQuote(view.id); setView(null); }}>{t('common.delete')}</Button>
              <Button variant="primary" icon="share" onClick={() => shareQuote(view, t)}>{t('common.share')}</Button>
            </div>
          </>
        )}
      </Sheet>
    </section>
  );
}

export function AddQuoteSheet({ bookId, open, onClose, defaultPage }: { bookId: string; open: boolean; onClose: () => void; defaultPage?: number }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [page, setPage] = useState(defaultPage ? String(defaultPage) : '');
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPhoto = async (f?: File | null) => {
    if (!f) return;
    setBusy(true);
    try {
      const small = await downscaleBlob(f, 1600);
      setPhoto(small);
      const raw = await blobToRaw(small, 1600);
      const read = (await ocrPlain(raw)).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      setText((cur) => (cur ? cur + '\n' : '') + read);
      if (!read) toast(t('quote.ocrEmpty'), 'error');
    } catch {
      toast(t('quote.ocrFail'), 'error');
    } finally { setBusy(false); }
  };

  const save = async () => {
    const photoId = photo ? await repo.putImage(photo) : undefined;
    await repo.addQuote({ bookId, text: text.trim(), page: parseInt(page, 10) || undefined, photoId });
    toast(t('quote.saved'), 'ok');
    setText(''); setPage(''); setPhoto(null);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('quote.add')} tall>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
      <Button icon="camera" disabled={busy} onClick={() => fileRef.current?.click()} className="full">{busy ? t('quote.reading') : t('quote.fromPhoto')}</Button>
      <p className="muted small" style={{ margin: '8px 0 16px' }}>{t('quote.photoHint')}</p>
      <Field label={t('quote.text')}>
        <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('quote.textPlaceholder')} />
      </Field>
      <Field label={t('quote.pageLabel')}>
        <input inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, ''))} />
      </Field>
      <div className="sheet-actions">
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" icon="check" disabled={!text.trim()} onClick={save}>{t('common.save')}</Button>
      </div>
      {busy && <p className="muted small" aria-live="polite"><Icon name="clock" size={14} /> {t('quote.reading')}</p>}
    </Sheet>
  );
}
