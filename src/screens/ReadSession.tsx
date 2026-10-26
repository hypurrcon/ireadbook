import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Book, Session } from '../db/types';
import * as repo from '../db/repo';
import { useBook, useSessions, useSettings } from '../hooks/data';
import { useTimer, type Draft } from '../state/timer';
import { Button, Field, IconButton, Sheet, spring, toast } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { Cover } from '../ui/Cover';
import { displayTitle, formatMinutes, startReading } from '../state/actions';
import { pomodoroState } from '../domain/pomodoro';
import { computeStreak } from '../domain/streak';
import { todayKey } from '../domain/dates';
import { pagesPerMinute } from '../domain/speed';
import { levelFromXp, totalXp, xpForSession, XP_FINISH_BOOK } from '../domain/xp';
import { useFaceDown, useWakeLock } from '../hooks/device';
import { getRoom } from '../rooms/registry';
import { playAmbience, stopAmbience, sfx, haptic } from '../audio/sound';
import { renderFinishedCard, renderSessionCard } from '../share/cards';
import { cardText, shareBlob } from '../share/actions';

const MOODS = ['fun', 'calm', 'hard', 'sleepy', 'moved'] as const;
const fmt = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

interface Result { session: Session; book: Book; xp: number; finished: boolean; levelBefore: number; level: { level: number; into: number; next: number }; streak: number; todayDone: boolean }

export default function ReadSession() {
  const active = useTimer((s) => s.active);
  const [result, setResult] = useState<Result | null>(null);
  const [saving, setSaving] = useState(false);
  if (result) return <ResultView r={result} />;
  if (!active && !saving) return <Navigate to="/read" replace />;
  if (!active) return <div className="session" />;
  return <Running onSaving={() => setSaving(true)} onDone={setResult} />;
}

function Running({ onDone, onSaving }: { onDone: (r: Result) => void; onSaving: () => void }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const timer = useTimer();
  const a = timer.active!;
  const book = useBook(a.bookId);
  const settings = useSettings();
  const sessions = useSessions() ?? [];
  const [now, setNow] = useState(Date.now());
  const [ending, setEnding] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [correct, setCorrect] = useState(() => timer.needsCorrection());
  const [ambOn, setAmbOn] = useState(settings.ambienceOn);
  const [fiveDone, setFiveDone] = useState(false);
  const lastPhase = useRef<string>('');
  const face = useFaceDown(a.mode === 'facedown');
  useWakeLock(a.mode !== 'timer');

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id); }, []);
  // the book was deleted while its timer was running
  useEffect(() => { if (book === null) { timer.discard(); nav('/read', { replace: true }); } }, [book]);

  // room ambience while reading
  useEffect(() => {
    if (ambOn) playAmbience(getRoom(settings.room).ambience(settings.rooms[settings.room]?.night ?? getRoom(settings.room).defaults.night));
    else stopAmbience();
    return () => stopAmbience();
  }, [ambOn, settings.room]);

  // face-down mode: running only while the phone lies face down
  useEffect(() => {
    if (a.mode !== 'facedown' || face.state === 'unknown') return;
    if (face.state === 'down' && a.pausedAt) { timer.resume(); sfx('start'); haptic(20); }
    if (face.state === 'up' && !a.pausedAt) { timer.pause(); sfx('stop'); haptic([30, 60, 30]); }
  }, [face.state]);
  useEffect(() => { if (a.mode === 'facedown' && !a.pausedAt && face.state !== 'down') timer.pause(); }, []);

  const elapsed = timer.elapsedSec(now);
  const pomo = a.mode === 'pomodoro' ? pomodoroState(elapsed, settings.pomodoroWork, settings.pomodoroBreak) : null;
  const readingSec = pomo ? pomo.readingSec : elapsed;

  useEffect(() => {
    if (!pomo) return;
    const key = pomo.phase + pomo.round;
    if (lastPhase.current && lastPhase.current !== key) { sfx('reward'); haptic([80, 80, 80]); }
    lastPhase.current = key;
  }, [pomo?.phase, pomo?.round]);

  const target = a.targetMin && a.mode === '5min' ? a.targetMin * 60 : null;
  useEffect(() => {
    if (target && elapsed >= target && !fiveDone) { setFiveDone(true); sfx('reward'); haptic([60, 40, 60]); }
  }, [elapsed >= (target ?? Infinity)]);

  if (!book) return <div className="session" />;

  const paused = !!a.pausedAt;
  const bigText = target && !fiveDone ? fmt(target - elapsed) : pomo ? fmt(pomo.remainingSec) : fmt(elapsed);
  const sub = target && !fiveDone ? t('session.left5') : pomo ? t(`session.pomo.${pomo.phase}`, { round: pomo.round }) : paused ? t('session.paused') : t('session.reading');
  const faceDownBlack = a.mode === 'facedown' && face.state === 'down';

  return (
    <div className={`session mode-${a.mode} ${paused ? 'is-paused' : ''}`}>
      <div className="session-top">
        <IconButton icon="back" label={t('common.back')} onClick={() => nav(-1)} />
        <div className="session-book">
          <Cover book={book} width={34} />
          <span>{displayTitle(book, t)}</span>
        </div>
        <IconButton icon={ambOn ? 'soundOn' : 'soundOff'} label={t('session.ambience')} onClick={() => { setAmbOn(!ambOn); repo.saveSettings({ ambienceOn: !ambOn }); }} />
      </div>

      <div className="session-center">
        <p className="session-sub">{sub}</p>
        <motion.p key={pomo?.phase ?? 'x'} className="session-time" initial={{ scale: 0.96, opacity: 0.6 }} animate={{ scale: 1, opacity: paused ? 0.45 : 1 }} transition={spring}>
          {bigText}
        </motion.p>
        {(target || pomo) && <p className="session-total muted">{t('session.totalRead', { time: fmt(readingSec) })}</p>}
        {pomo && <PomoBar pomo={pomo} work={settings.pomodoroWork} rest={settings.pomodoroBreak} />}

        {a.mode === 'facedown' && (
          <div className="facedown-help">
            {face.permission === 'needed' && <Button variant="primary" icon="phoneDown" onClick={face.request}>{t('session.allowSensor')}</Button>}
            {face.permission === 'unsupported' && <p className="muted small">{t('session.noSensor')}</p>}
            {face.permission === 'denied' && <p className="muted small">{t('session.sensorDenied')}</p>}
            {(face.permission === 'granted' || face.permission === 'unknown') && face.state !== 'down' && (
              <motion.div className="flip-hint" animate={{ rotateX: [0, 180, 180, 0] }} transition={{ duration: 2.8, repeat: Infinity, times: [0, 0.4, 0.7, 1] }}>
                <Icon name="phoneDown" size={44} sw={1.3} />
              </motion.div>
            )}
            {face.state !== 'down' && <p>{elapsed > 0 ? t('session.flipToContinue') : t('session.flipToStart')}</p>}
          </div>
        )}

        <AnimatePresence>
          {fiveDone && target && (
            <motion.div className="five-done" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={spring}>
              <strong>{t('session.fiveDone')}</strong>
              <span className="muted">{t('session.fiveDoneBody')}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="session-controls">
        <button className="ctl-ghost" onClick={() => setConfirmDiscard(true)}>{t('session.discard')}</button>
        {(a.mode !== 'facedown' || face.permission !== 'granted') && (
          <motion.button whileTap={{ scale: 0.92 }} transition={spring} className="ctl-main" aria-label={paused ? t('session.resume') : t('session.pause')}
            onClick={() => { if (paused) { timer.resume(); sfx('start'); } else { timer.pause(); sfx('stop'); } haptic(10); }}>
            <Icon name={paused ? 'play' : 'pause'} size={30} sw={2.2} />
          </motion.button>
        )}
        <Button variant={fiveDone ? 'primary' : 'quiet'} icon="stop" onClick={() => { timer.pause(); setEnding(true); }}>{t('session.finish')}</Button>
      </div>

      {faceDownBlack && <div className="black-screen" aria-hidden="true"><p>{fmt(elapsed)}</p></div>}

      <EndSheet open={ending} book={book} sessions={sessions} readingSec={readingSec}
        onCancel={() => { setEnding(false); if (!(a.mode === 'facedown' && face.state !== 'down')) timer.resume(); }}
        onSave={async (endPage, note, mood) => {
          onSaving();
          const draft = timer.stop()!;
          const r = await saveDraft({ ...draft, durationSec: pomo ? readingSec : draft.durationSec }, endPage, note, mood, settings.dailyGoalMin);
          sfx('reward'); haptic([30, 50, 90]);
          onDone(r);
        }} />

      <Sheet open={confirmDiscard} onClose={() => setConfirmDiscard(false)} title={t('session.discardTitle')}>
        <p>{t('session.discardBody')}</p>
        <div className="sheet-actions">
          <Button onClick={() => setConfirmDiscard(false)}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={() => { timer.discard(); nav('/read', { replace: true }); }}>{t('session.discard')}</Button>
        </div>
      </Sheet>

      <CorrectionSheet open={correct} startedAt={a.startedAt} onClose={() => setCorrect(false)} onFix={(min) => {
        // move the start forward so the elapsed time equals what was really read
        useTimer.setState({ active: { ...a, startedAt: Date.now() - min * 60000, pausedMs: 0, pausedAt: Date.now() } });
        setCorrect(false);
        setEnding(true);
      }} />
    </div>
  );
}

async function saveDraft(d: Draft, endPage: number, note: string, mood: string | undefined, goalMin: number): Promise<Result> {
  const before = await db.books.get(d.bookId);
  const [sessionsBefore, ach] = await Promise.all([db.sessions.toArray(), db.achievements.count()]);
  const finishedBefore = await db.books.where('status').equals('finished').count();
  const levelBefore = levelFromXp(totalXp(sessionsBefore, finishedBefore, ach)).level;
  const session = await repo.addSession({
    bookId: d.bookId, startedAt: d.startedAt, endedAt: d.endedAt, durationSec: Math.max(1, d.durationSec),
    startPage: d.startPage, endPage, mode: d.mode, note: note.trim() || undefined, mood,
  });
  const book = (await db.books.get(d.bookId))!;
  const finished = book.status === 'finished' && before?.status !== 'finished';
  const sessions = await db.sessions.toArray();
  const finishedNow = await db.books.where('status').equals('finished').count();
  const streak = computeStreak(sessions, goalMin, todayKey());
  return {
    session, book, finished, levelBefore,
    xp: xpForSession(session.durationSec / 60) + (finished ? XP_FINISH_BOOK : 0),
    level: levelFromXp(totalXp(sessions, finishedNow, ach)),
    streak: streak.current, todayDone: streak.todayDone,
  };
}

function PomoBar({ pomo, work, rest }: { pomo: ReturnType<typeof pomodoroState>; work: number; rest: number }) {
  const total = (pomo.phase === 'work' ? work : rest) * 60;
  return (
    <div className={`pomo-bar ${pomo.phase}`}>
      <i style={{ width: `${100 - (pomo.remainingSec / total) * 100}%` }} />
    </div>
  );
}

function EndSheet({ open, book, sessions, readingSec, onCancel, onSave }: {
  open: boolean; book: Book; sessions: Session[]; readingSec: number; onCancel: () => void; onSave: (endPage: number, note: string, mood?: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const pct = book.progressUnit === 'percent';
  const speed = useMemo(() => pagesPerMinute(sessions, book.id) ?? pagesPerMinute(sessions), [sessions, book.id]);
  const guess = Math.round(book.currentPage + (pct ? 0 : (speed ?? 0.8) * (readingSec / 60)));
  const max = pct ? 100 : book.pageCount;
  const [page, setPage] = useState('');
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setPage(String(Math.min(max ?? Infinity, guess))); }, [open]);
  const val = parseInt(page, 10);
  const bump = (n: number) => { sfx('tick'); setPage(String(Math.max(0, Math.min(max ?? Infinity, (Number.isFinite(val) ? val : book.currentPage) + n)))); };
  return (
    <Sheet open={open} onClose={onCancel} title={t('session.endTitle', { time: formatMinutes(readingSec / 60, t) })} tall>
      <Field label={pct ? t('book.endAtPercent') : t('book.endAt')} hint={max ? t('session.of', { max }) : undefined} group>
        <div className="page-stepper">
          <button type="button" onClick={() => bump(-1)} aria-label="-1">−</button>
          <input inputMode="numeric" aria-label={pct ? t('book.endAtPercent') : t('book.endAt')} value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, ''))} />
          <button type="button" onClick={() => bump(1)} aria-label="+1">+</button>
        </div>
        <div className="chips" style={{ marginTop: 10 }}>
          {[5, 10, 20].map((n) => <button key={n} type="button" className="chip" onClick={() => bump(n)}>+{n}</button>)}
          {max ? <button type="button" className="chip" onClick={() => { sfx('tick'); setPage(String(max)); }}>{t('session.finishedBook')}</button> : null}
        </div>
      </Field>
      <Field label={t('session.feel')} group>
        <div className="chips">
          {MOODS.map((m) => <button key={m} type="button" className={`chip ${mood === m ? 'on' : ''}`} onClick={() => { sfx('tap'); setMood(mood === m ? undefined : m); }}>{t(`mood.${m}`)}</button>)}
        </div>
      </Field>
      <Field label={t('book.note')}><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('read.notePlaceholder')} /></Field>
      <div className="sheet-actions">
        <Button onClick={onCancel}>{t('session.keepReading')}</Button>
        <Button variant="primary" icon="check" disabled={busy} onClick={async () => { setBusy(true); await onSave(Number.isFinite(val) ? val : book.currentPage, note, mood); setBusy(false); }}>{t('common.save')}</Button>
      </div>
    </Sheet>
  );
}

function CorrectionSheet({ open, startedAt, onClose, onFix }: { open: boolean; startedAt: number; onClose: () => void; onFix: (min: number) => void }) {
  const { t } = useTranslation();
  const [min, setMin] = useState('30');
  return (
    <Sheet open={open} onClose={onClose} title={t('session.forgotTitle')}>
      <p>{t('session.forgotBody', { time: new Date(startedAt).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) })}</p>
      <Field label={t('session.reallyRead')}><input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} /></Field>
      <div className="sheet-actions">
        <Button onClick={onClose}>{t('session.keepTimer')}</Button>
        <Button variant="primary" disabled={!(parseInt(min, 10) > 0)} onClick={() => onFix(parseInt(min, 10))}>{t('common.save')}</Button>
      </div>
    </Sheet>
  );
}

function ResultView({ r }: { r: Result }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const minutes = r.session.durationSec / 60;
  const pages = Math.max(0, r.session.endPage - r.session.startPage);
  const levelUp = r.level.level > r.levelBefore;
  const quotes = useLiveQuery(() => db.quotes.where('bookId').equals(r.book.id).count(), [r.book.id]) ?? 0;
  const share = async () => {
    const tx = cardText(t);
    if (r.finished) {
      const ss = await db.sessions.where('bookId').equals(r.book.id).toArray();
      const start = r.book.startedAt ?? r.session.startedAt;
      const blob = await renderFinishedCard({ book: r.book, days: Math.max(1, Math.ceil((Date.now() - start) / 86400000)), minutes: ss.reduce((a, s) => a + s.durationSec / 60, 0) }, tx);
      await shareBlob(blob, 'ireadbook-finished.png', t);
    } else {
      const blob = await renderSessionCard({ book: r.book, minutes, fromPage: r.session.startPage, toPage: r.session.endPage, percent: r.book.progressUnit === 'percent', streak: r.streak, date: new Date(r.session.startedAt) }, tx);
      await shareBlob(blob, 'ireadbook-today.png', t);
    }
  };
  return (
    <div className="result">
      <motion.div className="result-xp" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
        +{r.xp} <span>XP</span>
      </motion.div>
      <motion.h1 initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...spring, delay: 0.15 }}>
        {r.finished ? t('result.finished') : t('result.title', { time: formatMinutes(minutes, t) })}
      </motion.h1>
      <p className="muted">{displayTitle(r.book, t)}{pages > 0 && r.book.progressUnit === 'page' ? ` · ${t('result.pages', { count: pages })}` : ''}</p>

      <motion.div className="result-stats" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...spring, delay: 0.3 }}>
        <div><Icon name="flame" filled={r.todayDone} /><strong>{r.streak}</strong><span>{t('result.streak')}</span></div>
        <div><Icon name="star" filled={levelUp} /><strong>{r.level.level}</strong><span>{levelUp ? t('result.levelUp') : t('result.level')}</span></div>
      </motion.div>
      <div className="level-bar"><motion.i initial={{ width: 0 }} animate={{ width: `${(r.level.into / r.level.next) * 100}%` }} transition={{ duration: 1.1, delay: 0.4, ease: [0.2, 0.8, 0.2, 1] }} /></div>
      <p className="muted small">{t('result.toNext', { xp: r.level.next - r.level.into })}</p>
      {r.todayDone && <p className="result-today">{t('result.todayDone')}</p>}

      <div className="result-actions">
        <Button variant="primary" size="lg" icon="share" onClick={share}>{t('result.share')}</Button>
        {r.finished
          ? <Button size="lg" onClick={() => nav(`/book/${r.book.id}`, { replace: true })}>{t('result.rate')}</Button>
          : <Button size="lg" icon="play" onClick={() => startReading(r.book, 'timer', (p) => nav(p, { replace: true }))}>{t('result.again')}</Button>}
        <Button variant="ghost" onClick={() => nav('/', { replace: true })}>{t('common.done')}</Button>
      </div>
      {quotes === 0 && !r.finished && <p className="muted small result-tip"><Icon name="quote" size={14} /> {t('result.quoteTip')}</p>}
    </div>
  );
}
