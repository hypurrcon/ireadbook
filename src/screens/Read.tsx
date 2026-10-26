import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { Book, SessionMode } from '../db/types';
import * as repo from '../db/repo';
import { useBooks, useSessions, useSettings } from '../hooks/data';
import { useTimer } from '../state/timer';
import { Button, Field, Sheet, spring, toast } from '../ui/kit';
import { Icon, type IconName } from '../ui/Icon';
import { Cover } from '../ui/Cover';
import { displayTitle, formatMinutes, startReading } from '../state/actions';
import { minutesByDay } from '../domain/streak';
import { todayKey, dayKey } from '../domain/dates';
import { etaMinutes } from '../domain/speed';
import Session from './ReadSession';

export default function Read() {
  return (
    <Routes>
      <Route index element={<ReadHub />} />
      <Route path="session" element={<Session />} />
    </Routes>
  );
}

const MODES: { mode: SessionMode; icon: IconName; target?: number }[] = [
  { mode: '5min', icon: 'clock', target: 5 },
  { mode: 'pomodoro', icon: 'refresh' },
  { mode: 'facedown', icon: 'phoneDown' },
];

function ReadHub() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const books = useBooks() ?? [];
  const sessions = useSessions() ?? [];
  const settings = useSettings();
  const active = useTimer((s) => s.active);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [choose, setChoose] = useState(false);

  const candidates = useMemo(() => books.filter((b) => b.status === 'reading' || b.status === 'want' || b.status === 'paused')
    .sort((a, b) => (a.status === 'reading' ? 0 : 1) - (b.status === 'reading' ? 0 : 1) || b.updatedAt - a.updatedAt), [books]);
  const book = (pickedId ? books.find((b) => b.id === pickedId) : undefined) ?? candidates[0];
  const last = useMemo(() => (book ? [...sessions].reverse().find((s) => s.bookId === book.id) : undefined), [sessions, book]);
  const pageIds = useMemo(() => new Set(books.filter((b) => b.progressUnit === 'page').map((b) => b.id)), [books]);
  const eta = book ? etaMinutes(book, sessions, pageIds) : null;
  const todayMin = Math.floor(minutesByDay(sessions).get(todayKey()) ?? 0);
  const goal = settings.dailyGoalMin;
  const ratio = Math.min(1, todayMin / goal);
  const activeBook = active ? books.find((b) => b.id === active.bookId) : undefined;

  return (
    <div className="screen read-hub">
      <div className="read-today">
        <Ring ratio={ratio} />
        <div>
          <p className="read-today-big">{todayMin >= goal ? t('read.todayDone') : t('read.todayLeft', { left: goal - todayMin })}</p>
          <p className="muted small">{t('read.todayOf', { done: todayMin, goal })}</p>
        </div>
      </div>

      {active && activeBook && (
        <motion.button className="resume-card" onClick={() => nav('/read/session')} initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
          <span className="live-dot" />
          <span className="book-line-text">
            <strong>{t('read.inProgress')}</strong>
            <span className="small">{displayTitle(activeBook, t)}</span>
          </span>
          <Icon name="forward" />
        </motion.button>
      )}

      {!book ? (
        <div className="empty">
          <h3>{t('read.noBookTitle')}</h3>
          <p>{t('read.noBookBody')}</p>
          <Button variant="primary" icon="camera" onClick={() => nav('/add')}>{t('shelf.addFirst')}</Button>
        </div>
      ) : (
        <>
          <section className="read-book">
            <button className="read-book-cover" onClick={() => nav(`/book/${book.id}`)} aria-label={t('shelf.details')}>
              <Cover book={book} width={120} />
            </button>
            <div className="read-book-text">
              <span className="eyebrow">{book.status === 'reading' ? t('read.continueWith') : t('read.startWith')}</span>
              <h1>{displayTitle(book, t)}</h1>
              {book.authors.length > 0 && <p className="muted">{book.authors.join(', ')}</p>}
              {candidates.length > 1 && <button className="link" onClick={() => setChoose(true)}>{t('read.otherBook')}</button>}
            </div>
          </section>

          <div className="recap">
            {last ? (
              <>
                <p><strong>{t('read.lastTime', { when: relDay(last.startedAt, t) })}</strong> {book.progressUnit === 'percent' ? t('read.lastPercent', { p: last.endPage }) : t('read.lastPage', { page: last.endPage })}</p>
                {last.note && <p className="recap-note">“{last.note}”</p>}
              </>
            ) : <p>{book.whyRead ? <>“{book.whyRead}”</> : t('read.firstTime')}</p>}
            {eta !== null && <p className="muted small">{t('book.eta', { time: formatMinutes(eta, t) })}</p>}
          </div>

          <Button variant="primary" size="lg" icon="play" className="read-go" onClick={() => startReading(book, 'timer', nav)} disabled={!!active}>
            {t('read.startTimer')}
          </Button>
          <div className="mode-row">
            {MODES.map((m) => (
              <motion.button key={m.mode} whileTap={{ scale: 0.95 }} transition={spring} className="mode-btn" disabled={!!active}
                onClick={() => startReading(book, m.mode, nav, m.target ?? (m.mode === 'pomodoro' ? settings.pomodoroWork : undefined))}>
                <Icon name={m.icon} size={22} />
                <strong>{t(`read.mode.${m.mode}`)}</strong>
                <span>{t(`read.modeHint.${m.mode}`, { work: settings.pomodoroWork, rest: settings.pomodoroBreak })}</span>
              </motion.button>
            ))}
          </div>
          <Button variant="ghost" icon="edit" className="full" onClick={() => setManual(true)}>{t('read.logPast')}</Button>
        </>
      )}

      <Sheet open={choose} onClose={() => setChoose(false)} title={t('read.otherBook')}>
        <div className="list">
          {candidates.map((b) => (
            <button key={b.id} className="list-item" onClick={() => { setPickedId(b.id); setChoose(false); }}>
              <Cover book={b} width={40} />
              <span className="book-line-text">
                <strong className="book-line-title">{displayTitle(b, t)}</strong>
                <span className="muted small">{t(`status.${b.status}`)}</span>
              </span>
              {b.id === book?.id && <Icon name="check" />}
            </button>
          ))}
        </div>
      </Sheet>
      {book && <ManualSheet open={manual} onClose={() => setManual(false)} books={candidates.length ? candidates : [book]} initial={book} />}
    </div>
  );
}

function relDay(ts: number, t: (k: string, o?: any) => string) {
  const d = Math.round((new Date(todayKey()).getTime() - new Date(dayKey(ts)).getTime()) / 86400000);
  if (d <= 0) return t('read.today');
  if (d === 1) return t('read.yesterday');
  return t('read.daysAgo', { count: d });
}

function Ring({ ratio }: { ratio: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="ring" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
      <motion.circle cx="32" cy="32" r={r} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - ratio) }} transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
        transform="rotate(-90 32 32)" />
      {ratio >= 1 && <path d="M22 33l7 7 13-15" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/** Log a reading session after the fact. */
export function ManualSheet({ open, onClose, books, initial }: { open: boolean; onClose: () => void; books: Book[]; initial: Book }) {
  const { t } = useTranslation();
  const [bookId, setBookId] = useState(initial.id);
  const [min, setMin] = useState('20');
  const [end, setEnd] = useState('');
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState(() => new Date(Date.now() - 20 * 60000).toTimeString().slice(0, 5));
  const [note, setNote] = useState('');
  useEffect(() => { if (open) { setBookId(initial.id); setEnd(''); setNote(''); } }, [open, initial.id]);
  const b = books.find((x) => x.id === bookId) ?? initial;
  const save = async () => {
    const m = Math.max(1, parseInt(min, 10) || 0);
    const startedAt = new Date(`${date}T${time || '12:00'}`).getTime();
    const endPage = end === '' ? b.currentPage : Math.max(0, parseInt(end, 10));
    await repo.addSession({ bookId: b.id, startedAt, endedAt: startedAt + m * 60000, durationSec: m * 60, startPage: b.currentPage, endPage, mode: 'manual', note: note.trim() || undefined });
    toast(t('read.logged', { min: m }), 'ok');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('read.logPast')} tall>
      <Field label={t('read.book')}>
        <select value={bookId} onChange={(e) => setBookId(e.target.value)}>
          {books.map((x) => <option key={x.id} value={x.id}>{displayTitle(x, t)}</option>)}
        </select>
      </Field>
      <div className="row">
        <Field label={t('read.date')}><input type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label={t('read.startTime')}><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      <div className="row">
        <Field label={t('book.minutesRead')}><input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} /></Field>
        <Field label={b.progressUnit === 'percent' ? t('book.endAtPercent') : t('book.endAt')} hint={t('read.nowAt', { page: b.currentPage })}>
          <input inputMode="numeric" value={end} placeholder={String(b.currentPage)} onChange={(e) => setEnd(e.target.value.replace(/\D/g, ''))} />
        </Field>
      </div>
      <Field label={t('book.note')}><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('read.notePlaceholder')} /></Field>
      <div className="sheet-actions">
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" icon="check" disabled={!(parseInt(min, 10) > 0)} onClick={save}>{t('common.save')}</Button>
      </div>
    </Sheet>
  );
}

