import { lazy, Suspense, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { useBooks, useSettings, useSeries, useSessions } from '../hooks/data';
import type { Book, BookStatus } from '../db/types';
import { saveSettings } from '../db/repo';
import { Button, IconButton, Sheet, spring, Empty } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { Cover } from '../ui/Cover';
import { computeStreak, minutesByDay } from '../domain/streak';
import { todayKey } from '../domain/dates';
import { pickRandom } from '../domain/random';
import { layoutShelves, type SortMode } from '../domain/layout';
import { startReading, displayTitle, progressRatio } from '../state/actions';
import { sfx } from '../audio/sound';
import { backupDue } from '../domain/backupDue';
import { exportBackup, backupFileName } from '../backup/backup';
import { downloadBlob } from '../share/actions';
import { toast } from '../ui/kit';
import { useSync } from '../sync/manager';
import { loadIdentity } from '../sync/identity';
import { StatusDot } from './Devices';

const RoomCanvas = lazy(() => import('../three/RoomCanvas'));
const SORTS: SortMode[] = ['status', 'genre', 'series', 'author', 'added', 'color'];
const STATUSES: (BookStatus | 'all')[] = ['all', 'reading', 'want', 'paused', 'finished', 'dnf'];

function matches(b: Book, q: string, status: BookStatus | 'all') {
  if (status !== 'all' && b.status !== status) return false;
  if (!q) return true;
  const s = q.toLowerCase();
  return [b.title, b.originalTitle, ...b.authors, b.isbn].some((x) => x?.toLowerCase().includes(s));
}

export default function Shelf() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const books = useBooks();
  const sessions = useSessions() ?? [];
  const settings = useSettings();
  const series = useSeries() ?? [];
  const [picked, setPicked] = useState<Book | null>(null);
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<BookStatus | 'all'>('all');
  const seriesNames = useMemo(() => Object.fromEntries(series.map((s) => [s.id, s.name])), [series]);

  const list = books ?? [];
  const today = todayKey();
  const todayMin = Math.floor(minutesByDay(sessions).get(today) ?? 0);
  const streak = computeStreak(sessions, settings.dailyGoalMin, today);
  const current = useMemo(() => list.filter((b) => b.status === 'reading').sort((a, b) => b.updatedAt - a.updatedAt)[0], [list]);
  const filtered = useMemo(() => (q || status !== 'all' ? new Set(list.filter((b) => matches(b, q, status)).map((b) => b.id)) : null), [list, q, status]);
  const review = list.filter((b) => b.needsReview).length;
  const pickedLive = picked ? list.find((b) => b.id === picked.id) ?? null : null;

  const onPick = useCallback((b: Book | null) => setPicked(b), []);
  const random = () => {
    const b = pickRandom(list);
    if (b) { sfx('bookOut'); setPicked(b); }
  };

  if (books && list.length === 0) {
    return (
      <div className="screen shelf-empty">
        <div className="shelf-top"><span /><IconButton icon="settings" label={t('shelf.settings')} onClick={() => nav('/settings')} /></div>
        <Empty title={t('shelf.emptyTitle')} body={t('shelf.emptyBody')} action={<Button variant="primary" icon="camera" onClick={() => nav('/add')}>{t('shelf.addFirst')}</Button>} />
      </div>
    );
  }

  return (
    <div className="shelf">
      {settings.viewMode === '3d' ? (
        <Suspense fallback={<div className="room-loading" />}>
          <RoomCanvas roomId={settings.room} books={list} sortMode={settings.sortMode} quality={settings.quality}
            custom={settings.rooms[settings.room]} seriesNames={seriesNames} pickedId={pickedLive?.id ?? null} onPick={onPick} highlightIds={filtered} />
        </Suspense>
      ) : (
        <ShelfList books={list.filter((b) => !filtered || filtered.has(b.id))} sortMode={settings.sortMode} seriesNames={seriesNames} onOpen={(b) => nav(`/book/${b.id}`)} />
      )}

      <div className="shelf-top">
        <div className="today-chip" aria-live="polite">
          <Icon name="flame" size={16} filled={streak.todayDone} />
          <span>{streak.current > 0 ? t('shelf.streak', { count: streak.current }) : ''}</span>
          <span className="muted">{streak.todayDone ? t('shelf.todayDone') : t('shelf.todayLeft', { done: Math.min(todayMin, settings.dailyGoalMin), goal: settings.dailyGoalMin })}</span>
        </div>
        <div className="shelf-tools">
          <SyncChip onOpen={() => nav('/settings#devices')} />
          <IconButton icon="sort" label={t('shelf.sortBy')} onClick={() => setSheet(true)} className={filtered ? 'dot' : ''} />
          <IconButton icon={settings.viewMode === '3d' ? 'grid' : 'cube'} label={settings.viewMode === '3d' ? t('shelf.view2d') : t('shelf.view3d')}
            onClick={() => saveSettings({ viewMode: settings.viewMode === '3d' ? '2d' : '3d' })} />
          <IconButton icon="settings" label={t('shelf.settings')} onClick={() => nav('/settings')} />
        </div>
      </div>
      {review === 0 && backupDue(settings, list.length, Date.now(), list.length ? Math.min(...list.map((b) => b.createdAt)) : undefined) && (
        <motion.div className="backup-nudge" initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}>
          <Icon name="download" size={16} />
          <span>{t('backupNudge.text')}</span>
          <button onClick={() => saveSettings({ backupSnoozeUntil: Date.now() + 86400000 })}>{t('backupNudge.later')}</button>
          <button className="go" onClick={async () => {
            const saved = await downloadBlob(await exportBackup(), backupFileName());
            await saveSettings({ lastBackupAt: Date.now(), booksSinceBackup: 0, backupSnoozeUntil: undefined });
            toast(saved.kept ? t('settings.exportedTo', { path: saved.kept }) : t('settings.exported'), 'ok');
          }}>{t('backupNudge.go')}</button>
        </motion.div>
      )}
      {review > 0 && (
        <button className="review-chip" onClick={() => nav('/review')}>{t('shelf.reviewWaiting', { count: review })}<Icon name="forward" size={14} /></button>
      )}

      <div className="shelf-bottom">
        <AnimatePresence mode="wait">
          {pickedLive ? (
            <motion.div key={'p' + pickedLive.id} className="now-card stack" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={spring}>
              <BookLine book={pickedLive} />
              <div className="now-actions">
                <Button variant="quiet" onClick={() => nav(`/book/${pickedLive.id}`)}>{t('shelf.details')}</Button>
                <Button variant="primary" icon="play" onClick={() => startReading(pickedLive, 'timer', nav)}>{pickedLive.status === 'reading' ? t('shelf.continue') : t('shelf.start')}</Button>
              </div>
            </motion.div>
          ) : current ? (
            <motion.div key={'c' + current.id} className="now-card" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={spring}>
              <BookLine book={current} onClick={() => nav(`/book/${current.id}`)} />
              <Button variant="primary" size="lg" icon="play" className="now-go" onClick={() => startReading(current, 'timer', nav)}>{t('shelf.continue')}</Button>
            </motion.div>
          ) : (
            <motion.div key="none" className="now-card" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={spring}>
              <div className="now-text"><strong>{t('shelf.pickNext')}</strong><span className="muted small">{t('shelf.pickNextBody')}</span></div>
              <Button variant="primary" icon="dice" onClick={random}>{t('shelf.randomPick')}</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title={t('shelf.sortBy')}>
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('shelf.searchPlaceholder')} aria-label={t('common.search')} />
        <div className="chips" style={{ marginTop: 16 }}>
          {SORTS.map((s) => <button key={s} className={`chip ${settings.sortMode === s ? 'on' : ''}`} onClick={() => { sfx('tap'); saveSettings({ sortMode: s }); }}>{t(`shelf.sort.${s}`)}</button>)}
        </div>
        <h3 className="sheet-sub">{t('shelf.filter')}</h3>
        <div className="chips">
          {STATUSES.map((s) => <button key={s} className={`chip ${status === s ? 'on' : ''}`} onClick={() => { sfx('tap'); setStatus(s); }}>{s === 'all' ? t('shelf.all') : t(`status.${s}`)}</button>)}
        </div>
        {filtered && filtered.size === 0 && <p className="muted small" style={{ marginTop: 16 }}>{t('shelf.noResults')}</p>}
      </Sheet>
    </div>
  );
}

function BookLine({ book, onClick }: { book: Book; onClick?: () => void }) {
  const { t } = useTranslation();
  const r = progressRatio(book);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="book-line" onClick={onClick}>
      <Cover book={book} width={46} />
      <div className="book-line-text">
        <strong className="book-line-title">{displayTitle(book, t)}</strong>
        <span className="muted small">{book.authors.join(', ') || t(`status.${book.status}`)}</span>
        {r !== null && book.status === 'reading' && <div className="progress" style={{ marginTop: 6 }}><i style={{ width: `${Math.round(r * 100)}%` }} /></div>}
      </div>
    </Tag>
  );
}

function ShelfList({ books, sortMode, seriesNames, onOpen }: { books: Book[]; sortMode: SortMode; seriesNames: Record<string, string>; onOpen: (b: Book) => void }) {
  const { t } = useTranslation();
  const shelves = layoutShelves(books, sortMode, 1000, 1000, seriesNames)[0].shelves;
  const label = (k?: string) => (!k ? '' : sortMode === 'genre' ? t(`genre.${k}`) : sortMode === 'status' ? t(`status.${k}`) : k);
  if (!books.length) return <div className="shelf-list"><p className="muted" style={{ padding: 24 }}>{t('shelf.noResults')}</p></div>;
  return (
    <div className="shelf-list">
      {shelves.map((sh, i) => {
        const segs = sh.segments.length ? sh.segments : [{ label: '', start: 0 }];
        return segs.map((sg, j) => {
          const end = segs[j + 1]?.start ?? sh.books.length;
          return (
            <section key={`${i}-${j}`} className="list-group">
              {sg.label && <h2>{label(sg.label)}</h2>}
              <div className="cover-grid">
                {sh.books.slice(sg.start, end).map((b) => (
                  <motion.button key={b.id} className="grid-book" onClick={() => { sfx('bookOut'); onOpen(b); }} whileTap={{ scale: 0.95 }} transition={spring}>
                    <Cover book={b} width={96} />
                    <span className="grid-title">{displayTitle(b, t)}</span>
                    {b.seriesIndex ? <span className="grid-badge">{b.seriesIndex}</span> : null}
                  </motion.button>
                ))}
              </div>
            </section>
          );
        });
      })}
    </div>
  );
}

function SyncChip({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const peerState = useSync((s) => s.peerState);
  const peers = loadIdentity()?.peers ?? [];
  if (!peers.length) return null;
  const states = peers.map((p) => peerState[p.deviceId] ?? 'offline');
  const s = states.includes('syncing') || states.includes('connecting') ? 'syncing' : states.includes('synced') ? 'synced' : 'offline';
  return (
    <button className="sync-chip" onClick={onOpen} aria-label={t(`sync.state.${s}`)} title={t(`sync.state.${s}`)}>
      <StatusDot s={s} />
    </button>
  );
}
