import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Book, BookStatus, Session } from '../db/types';
import * as repo from '../db/repo';
import { useBook, useBooks, useImageUrl, useSeries, useSessions } from '../hooks/data';
import { Button, Field, IconButton, Sheet, spring, toast } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { Cover } from '../ui/Cover';
import { BookForm, type BookFormValue } from '../ui/BookForm';
import { displayTitle, formatMinutes, progressRatio, startReading } from '../state/actions';
import { etaMinutes } from '../domain/speed';
import { guessSeries } from '../domain/series';
import { mergeMeta } from '../domain/meta';
import { lookupIsbn, searchText } from '../lookup/books';
import { sfx } from '../audio/sound';
import { QuoteList } from './Quotes';

const STATUSES: BookStatus[] = ['want', 'reading', 'paused', 'finished', 'dnf'];

export default function BookDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const book = useBook(id);
  const books = useBooks() ?? [];
  const allSessions = useSessions() ?? [];
  const series = useSeries() ?? [];
  const [edit, setEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [sessionEdit, setSessionEdit] = useState<Session | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissSeries, setDismissSeries] = useState(false);
  const backUrl = useImageUrl(book?.coverBackId);

  const sessions = useMemo(() => allSessions.filter((s) => s.bookId === id).sort((a, b) => b.startedAt - a.startedAt), [allSessions, id]);
  const pageBookIds = useMemo(() => new Set(books.filter((b) => b.progressUnit === 'page').map((b) => b.id)), [books]);
  const quotesCount = useLiveQuery(() => (id ? db.quotes.where('bookId').equals(id).count() : 0), [id]) ?? 0;

  if (book === undefined) return <div className="screen" />;
  if (book === null || !book) {
    return <div className="screen"><div className="screen-head"><IconButton icon="back" label={t('common.back')} onClick={() => nav(-1)} /></div><p className="muted">{t('book.missing')}</p></div>;
  }

  const ser = book.seriesId ? series.find((s) => s.id === book.seriesId) : undefined;
  const inSeries = ser ? books.filter((b) => b.seriesId === ser.id) : [];
  const readInSeries = inSeries.filter((b) => b.status === 'finished').length;
  const owned = new Set(inSeries.map((b) => b.seriesIndex).filter(Boolean) as number[]);
  const missing = ser?.totalVolumes ? Array.from({ length: ser.totalVolumes }, (_, i) => i + 1).filter((i) => !owned.has(i)) : [];
  const skipped = ser && book.seriesIndex ? inSeries.filter((b) => (b.seriesIndex ?? 0) < book.seriesIndex! && b.status !== 'finished').sort((a, b) => (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0)) : [];
  const guess = !book.seriesId && !dismissSeries ? guessSeries(book, books) : null;

  const r = progressRatio(book);
  const eta = book.status !== 'finished' ? etaMinutes(book, allSessions, pageBookIds) : null;
  const total = book.progressUnit === 'percent' ? 100 : book.pageCount;
  const title = displayTitle(book, t);

  const setStatus = async (s: BookStatus) => {
    sfx('tap');
    const patch: Partial<Book> = { status: s };
    if (s === 'finished' && !book.finishedAt) { patch.finishedAt = Date.now(); if (total) patch.currentPage = total; }
    await repo.updateBook(book.id, patch);
    if (s === 'finished') toast(t('book.finishedToast'), 'reward');
  };

  const readAgain = async () => {
    await repo.updateBook(book.id, { status: 'reading', currentPage: 0, rereadCount: book.rereadCount + 1, finishedAt: undefined });
    startReading({ ...book, status: 'reading', currentPage: 0 }, 'timer', nav);
  };

  const confirmSeries = async () => {
    if (!guess) return;
    const existing = guess.matches.find((m) => m.seriesId);
    const name = existing ? series.find((s) => s.id === existing.seriesId)?.name ?? guess.baseTitle : guess.baseTitle;
    await repo.assignSeries(book.id, name, guess.index ?? undefined);
    for (const m of guess.matches) {
      if (!m.seriesId) {
        const { parseVolume } = await import('../domain/series');
        await repo.assignSeries(m.id, name, parseVolume(m.title).index ?? undefined);
      }
    }
    toast(t('book.seriesSaved', { name }), 'ok');
  };

  const findInfo = async () => {
    setBusy(true);
    try {
      let meta = book.isbn ? await lookupIsbn(book.isbn) : null;
      if (!meta) meta = (await searchText([book.originalTitle || book.title, book.authors[0]].filter(Boolean).join(' ')))[0] ?? null;
      if (meta) { await repo.updateBook(book.id, mergeMeta(book, meta)); toast(t('book.infoUpdated'), 'ok'); }
      else toast(t('book.notFound'), 'error');
    } catch {
      toast(t('book.offline'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="screen detail">
      <div className="detail-bg" style={{ background: `radial-gradient(120% 70% at 50% 0%, ${book.dominantColor ?? 'var(--surface-2)'} 0%, transparent 70%)` }} />
      <div className="screen-head">
        <IconButton icon="back" label={t('common.back')} onClick={() => nav(-1)} />
        <span style={{ flex: 1 }} />
        <IconButton icon="edit" label={t('book.edit')} onClick={() => setEdit(true)} />
      </div>

      <div className="detail-hero">
        <motion.button className="detail-cover" onClick={() => { if (book.coverBackId) { sfx('pageFlip'); setFlipped(!flipped); } }}
          animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: 'spring', stiffness: 140, damping: 18 }} aria-label={t('book.flip')}>
          <span className="face front"><Cover book={book} width={176} /></span>
          {backUrl && <span className="face back"><img src={backUrl} alt="" style={{ width: 176 }} /></span>}
        </motion.button>
        <h1 className="detail-title">{title}</h1>
        {book.originalTitle && <p className="detail-orig">{book.originalTitle}</p>}
        <p className="detail-by">
          {book.authors.join(', ')}
          {book.translators.length > 0 && <span className="muted"> · {t('book.translatedBy', { names: book.translators.join(', ') })}</span>}
        </p>
        {ser && <p className="detail-series"><Icon name="series" size={16} />{t('book.seriesOf', { index: book.seriesIndex ?? '?', name: ser.name })}</p>}
        {book.needsLookup && (
          <Button variant="quiet" size="sm" icon="refresh" disabled={busy} onClick={findInfo} className="detail-lookup">{busy ? t('common.loading') : t('book.findInfo')}</Button>
        )}
      </div>

      <div className="detail-actions">
        {book.status === 'finished' ? (
          <Button variant="primary" size="lg" icon="refresh" onClick={readAgain}>{t('book.readAgain')}</Button>
        ) : (
          <>
            <Button variant="quiet" size="lg" onClick={() => startReading(book, '5min', nav, 5)}>{t('read.just5')}</Button>
            <Button variant="primary" size="lg" icon="play" onClick={() => startReading(book, 'timer', nav)}>{book.status === 'reading' ? t('shelf.continue') : t('shelf.start')}</Button>
          </>
        )}
      </div>

      {skipped.length > 0 && book.status !== 'finished' && (
        <p className="note-warn"><Icon name="series" size={16} />{t('book.seriesSkipWarn', { index: skipped.map((b) => b.seriesIndex).join(', ') })}</p>
      )}

      {guess && (
        <motion.div className="suggest" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
          <p>{t('book.seriesSuggest', { name: guess.matches.find((m) => m.seriesId) ? series.find((s) => s.id === guess.matches.find((m) => m.seriesId)!.seriesId)?.name : guess.baseTitle, index: guess.index ?? '?' })}</p>
          <div className="row">
            <Button variant="ghost" size="sm" onClick={() => setDismissSeries(true)}>{t('book.seriesNo')}</Button>
            <Button variant="primary" size="sm" onClick={confirmSeries}>{t('book.seriesConfirm')}</Button>
          </div>
        </motion.div>
      )}

      <section className="section">
        <h2>{t('book.status')}</h2>
        <div className="chips">
          {STATUSES.map((s) => <button key={s} className={`chip ${book.status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>{t(`status.${s}`)}</button>)}
        </div>
      </section>

      <section className="section">
        <h2>{t('book.progress')}</h2>
        {r !== null && <div className="progress big"><i style={{ width: `${Math.round(r * 100)}%` }} /></div>}
        <p className="detail-progress-line">
          <strong>{book.progressUnit === 'percent' ? t('shelf.percent', { p: book.currentPage }) : total ? t('shelf.pageOf', { page: book.currentPage, total }) : t('book.pageOnly', { page: book.currentPage })}</strong>
          {book.rereadCount > 0 && <span className="muted"> · {t('book.rereads', { count: book.rereadCount })}</span>}
        </p>
        {book.status !== 'finished' && <p className="muted small">{eta !== null ? t('book.eta', { time: formatMinutes(eta, t) }) : t('book.etaUnknown')}</p>}
        {ser && (
          <p className="muted small" style={{ marginTop: 6 }}>
            {t('book.seriesProgress', { read: readInSeries, total: ser.totalVolumes ?? inSeries.length })}
            {missing.length > 0 && missing.length <= 12 && <> · {t('book.seriesMissing', { list: missing.join(', ') })}</>}
          </p>
        )}
      </section>

      {book.whyRead && (
        <section className="section why">
          <h2>{t('book.whyRead')}</h2>
          <blockquote>{book.whyRead}</blockquote>
        </section>
      )}

      {(book.status === 'finished' || book.status === 'dnf' || book.rating) && <RatingBlock book={book} />}

      <section className="section">
        <h2>{t('book.sessions')}</h2>
        {sessions.length === 0 ? <p className="muted small">{t('book.noSessions')}</p> : (
          <div className="list">
            {sessions.slice(0, 30).map((s) => (
              <button key={s.id} className="list-item session-row" onClick={() => setSessionEdit(s)}>
                <span className="session-date">{new Date(s.startedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                <span className="session-main">
                  <strong>{formatMinutes(s.durationSec / 60, t)}</strong>
                  <span className="muted small">
                    {book.progressUnit === 'percent' ? `${s.startPage}% → ${s.endPage}%` : t('read.pagesRange', { from: s.startPage, to: s.endPage })}
                    {s.note ? ` · ${s.note}` : ''}
                  </span>
                </span>
                <Icon name="edit" size={16} className="muted" />
              </button>
            ))}
          </div>
        )}
      </section>

      <QuoteList bookId={book.id} count={quotesCount} />

      <section className="section">
        <h2>{t('book.info')}</h2>
        <dl className="facts">
          {book.pageCount ? <><dt>{t('book.fields.pageCount')}</dt><dd>{book.pageCount}</dd></> : null}
          <dt>{t('book.fields.genre')}</dt><dd>{t(`genre.${book.genre ?? 'other'}`)}</dd>
          <dt>{t('book.fields.format')}</dt><dd>{t(`format.${book.format}`)}</dd>
          {book.publisher && <><dt>{t('book.fields.publisher')}</dt><dd>{book.publisher}</dd></>}
          {book.year && <><dt>{t('book.fields.year')}</dt><dd>{book.year}</dd></>}
          {book.isbn && <><dt>{t('book.fields.isbn')}</dt><dd className="mono">{book.isbn}</dd></>}
          {book.recommendedBy && <><dt>{t('book.fields.recommendedBy')}</dt><dd>{book.recommendedBy}</dd></>}
          {book.tags.length > 0 && <><dt>{t('book.fields.tags')}</dt><dd>{book.tags.join(', ')}</dd></>}
        </dl>
        {book.description && <p className="detail-desc">{book.description}</p>}
      </section>

      <div className="section">
        <Button variant="danger" icon="trash" onClick={() => setConfirmDel(true)}>{t('book.delete')}</Button>
      </div>

      <EditSheet open={edit} onClose={() => setEdit(false)} book={book} seriesName={ser?.name} seriesTotal={ser?.totalVolumes} />

      <Sheet open={confirmDel} onClose={() => setConfirmDel(false)} title={t('book.delete')}>
        <p>{t('book.deleteConfirm', { title })}</p>
        <div className="row" style={{ marginTop: 20 }}>
          <Button onClick={() => setConfirmDel(false)}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={async () => { await repo.deleteBook(book.id); toast(t('book.deleted')); nav('/', { replace: true }); }}>{t('common.delete')}</Button>
        </div>
      </Sheet>

      <SessionSheet session={sessionEdit} book={book} onClose={() => setSessionEdit(null)} />
    </div>
  );
}

function EditSheet({ open, onClose, book, seriesName, seriesTotal }: { open: boolean; onClose: () => void; book: Book; seriesName?: string; seriesTotal?: number }) {
  const { t } = useTranslation();
  const [val, setVal] = useState<BookFormValue | null>(null);
  const save = async () => {
    if (val) {
      await repo.updateBook(book.id, val.patch);
      if ((val.series.name || '') !== (seriesName || '') || val.series.index !== book.seriesIndex || val.series.total !== seriesTotal) {
        await repo.assignSeries(book.id, val.series.name, val.series.index, val.series.total);
      }
      toast(t('book.saved'), 'ok');
    }
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('book.edit')} tall>
      {open && <BookForm book={book} seriesName={seriesName} seriesTotal={seriesTotal} onChange={setVal} />}
      <div className="sheet-actions">
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={save}>{t('common.save')}</Button>
      </div>
    </Sheet>
  );
}

function SessionSheet({ session, book, onClose }: { session: Session | null; book: Book; onClose: () => void }) {
  const { t } = useTranslation();
  const [min, setMin] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [key, setKey] = useState<string | null>(null);
  if (session && key !== session.id) {
    setKey(session.id);
    setMin(String(Math.max(1, Math.round(session.durationSec / 60))));
    setEnd(String(session.endPage));
    setNote(session.note ?? '');
  }
  const save = async () => {
    if (!session) return;
    const m = Math.max(1, parseInt(min, 10) || 1);
    await repo.updateSession(session.id, { durationSec: m * 60, endedAt: session.startedAt + m * 60_000, endPage: Math.max(0, parseInt(end, 10) || 0), note: note.trim() || undefined });
    toast(t('book.saved'), 'ok');
    onClose();
  };
  const del = async () => {
    if (!session) return;
    await repo.deleteSession(session.id);
    toast(t('book.sessionDeleted'));
    onClose();
  };
  return (
    <Sheet open={!!session} onClose={onClose} title={t('book.editSession')}>
      <div className="row">
        <Field label={t('book.minutesRead')}><input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} /></Field>
        <Field label={book.progressUnit === 'percent' ? t('book.endAtPercent') : t('book.endAt')}><input inputMode="numeric" value={end} onChange={(e) => setEnd(e.target.value.replace(/\D/g, ''))} /></Field>
      </div>
      <Field label={t('book.note')}><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <div className="sheet-actions">
        <Button variant="danger" icon="trash" onClick={del}>{t('book.deleteSession')}</Button>
        <Button variant="primary" onClick={save}>{t('common.save')}</Button>
      </div>
    </Sheet>
  );
}

function RatingBlock({ book }: { book: Book }) {
  const { t } = useTranslation();
  const [review, setReview] = useState(book.review ?? '');
  return (
    <section className="section">
      <h2>{t('book.fields.rating')}</h2>
      <div className="stars" role="radiogroup" aria-label={t('book.fields.rating')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <motion.button key={n} whileTap={{ scale: 0.8 }} transition={spring} role="radio" aria-checked={book.rating === n} aria-label={String(n)}
            className={(book.rating ?? 0) >= n ? 'on' : ''} onClick={() => { sfx('tap'); repo.updateBook(book.id, { rating: n }); }}>
            <Icon name="star" size={30} filled={(book.rating ?? 0) >= n} />
          </motion.button>
        ))}
      </div>
      <Field label={t('book.fields.review')}>
        <textarea rows={3} value={review} onChange={(e) => setReview(e.target.value)} onBlur={() => review !== (book.review ?? '') && repo.updateBook(book.id, { review: review.trim() || undefined })} placeholder={t('book.reviewPlaceholder')} />
      </Field>
    </section>
  );
}
