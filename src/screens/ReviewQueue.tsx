import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import type { Book } from '../db/types';
import * as repo from '../db/repo';
import { useBooks, useSeries } from '../hooks/data';
import { useQueue } from '../state/queue';
import { Button, Empty, IconButton, Sheet, spring, toast } from '../ui/kit';
import { Cover } from '../ui/Cover';
import { BookForm, type BookFormValue } from '../ui/BookForm';
import { displayTitle } from '../state/actions';

export default function ReviewQueue() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const books = (useBooks() ?? []).filter((b) => b.needsReview).sort((a, b) => a.createdAt - b.createdAt);
  const series = useSeries() ?? [];
  const jobs = useQueue((s) => s.jobs);
  const [open, setOpen] = useState<Book | null>(null);
  const [val, setVal] = useState<BookFormValue | null>(null);

  const confirm = async (b: Book, v: BookFormValue | null) => {
    await repo.updateBook(b.id, { ...(v?.patch ?? {}), needsReview: false });
    if (v?.series.name) await repo.assignSeries(b.id, v.series.name, v.series.index, v.series.total);
    toast(t('review.confirmed'), 'ok');
  };

  const busy = (id: string) => jobs[id] === 'queued' || jobs[id] === 'working';

  return (
    <div className="screen">
      <div className="screen-head">
        <IconButton icon="back" label={t('common.back')} onClick={() => nav(-1)} />
        <h1>{t('review.title')}</h1>
      </div>
      {books.length === 0 ? (
        <Empty title={t('review.empty')} action={<Button variant="primary" onClick={() => nav('/')}>{t('add.toShelf')}</Button>} />
      ) : (
        <>
          <div className="list">
            <AnimatePresence initial={false}>
              {books.map((b) => (
                <motion.button key={b.id} layout exit={{ opacity: 0, x: 60 }} transition={spring} className="list-item" onClick={() => { setVal(null); setOpen(b); }}>
                  <Cover book={b} width={48} />
                  <span className="book-line-text">
                    <strong className="book-line-title">{busy(b.id) ? t('review.working') : displayTitle(b, t)}</strong>
                    <span className="muted small">{busy(b.id) ? '' : b.authors.join(', ') || t('review.ready')}</span>
                  </span>
                  {!busy(b.id) && <Button size="sm" variant="quiet" onClick={(e) => { e.stopPropagation(); confirm(b, null); }}>{t('review.confirm')}</Button>}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
          <Button variant="primary" className="full" style={{ marginTop: 20 }} disabled={books.some((b) => busy(b.id))}
            onClick={async () => { for (const b of books) await repo.updateBook(b.id, { needsReview: false }); toast(t('review.confirmed'), 'ok'); }}>
            {t('review.confirmAll')}
          </Button>
        </>
      )}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={t('add.check')} tall>
        {open && <BookForm key={open.id} book={open} seriesName={series.find((s) => s.id === open.seriesId)?.name} onChange={setVal} compact />}
        <div className="sheet-actions">
          <Button onClick={() => setOpen(null)}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={async () => { if (open) await confirm(open, val); setOpen(null); }}>{t('review.confirm')}</Button>
        </div>
      </Sheet>
    </div>
  );
}
