import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAchievements, useBooks, useSessions, useSettings } from '../hooks/data';
import { saveSettings } from '../db/repo';
import { Button, IconButton, Segmented, Sheet, spring } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { Cover } from '../ui/Cover';
import { periodStats, monthRange, yearRange } from '../domain/stats';
import { computeStreak, FREEZES_PER_MONTH } from '../domain/streak';
import { todayKey, dayKey } from '../domain/dates';
import { levelFromXp, totalXp } from '../domain/xp';
import { ACHIEVEMENTS } from '../domain/achievements';
import { renderWrappedCard } from '../share/cards';
import { cardText, shareBlob } from '../share/actions';
import { currentLang } from '../i18n';

type Period = 'month' | 'year';

export default function Stats() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const books = useBooks() ?? [];
  const sessions = useSessions() ?? [];
  const settings = useSettings();
  const unlocked = useAchievements() ?? [];
  const now = new Date();
  const [period, setPeriod] = useState<Period>('month');
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [goalOpen, setGoalOpen] = useState(false);
  const [achOpen, setAchOpen] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const [from, to] = period === 'month' ? monthRange(cursor.y, cursor.m) : yearRange(cursor.y);
  const st = useMemo(() => periodStats(sessions, books, from, to), [sessions, books, from, to]);
  const yearSt = useMemo(() => periodStats(sessions, books, ...yearRange(cursor.y)), [sessions, books, cursor.y]);
  const streak = computeStreak(sessions, settings.dailyGoalMin, todayKey());
  const finishedAll = books.filter((b) => b.status === 'finished').length;
  const lvl = levelFromXp(totalXp(sessions, finishedAll, unlocked.length));
  const usedFreezes = streak.frozenDays.filter((d) => d.startsWith(todayKey().slice(0, 7))).length;
  const unlockedSet = new Set(unlocked.map((a) => a.id));
  const loc = currentLang() === 'th' ? 'th-TH' : 'en-GB';
  const heading = period === 'month'
    ? new Date(cursor.y, cursor.m - 1, 1).toLocaleDateString(loc, { month: 'long', year: 'numeric' })
    : new Date(cursor.y, 0, 1).toLocaleDateString(loc, { year: 'numeric' });
  const isCurrent = period === 'month' ? cursor.y === now.getFullYear() && cursor.m === now.getMonth() + 1 : cursor.y === now.getFullYear();
  const move = (d: number) => setCursor((c) => {
    if (period === 'year') return { ...c, y: c.y + d };
    const m = c.m + d;
    return m < 1 ? { y: c.y - 1, m: 12 } : m > 12 ? { y: c.y + 1, m: 1 } : { y: c.y, m };
  });

  const topGenre = Object.entries(st.genres).sort((a, b) => b[1] - a[1])[0]?.[0];
  const share = async () => {
    setSharing(true);
    try {
      const blob = await renderWrappedCard({ heading, minutes: st.minutes, booksFinished: st.finished.length, daysRead: st.daysRead, pages: st.pages, topGenre: topGenre ? t(`genre.${topGenre}`) : undefined, covers: st.finished.length ? st.finished : books.filter((b) => sessions.some((s) => s.bookId === b.id && s.startedAt >= from && s.startedAt < to)) }, cardText(t));
      await shareBlob(blob, `ireadbook-${period}-${cursor.y}${period === 'month' ? '-' + cursor.m : ''}.png`, t);
    } finally { setSharing(false); }
  };

  const hours = st.minutes / 60;
  return (
    <div className="screen stats">
      <div className="screen-head">
        <h1>{t('stats.title')}</h1>
        <IconButton icon="settings" label={t('shelf.settings')} onClick={() => nav('/settings')} />
      </div>

      <div className="stat-top">
        <div className="tile tile-level">
          <span className="tile-k">{t('stats.level')}</span>
          <strong className="tile-v">{lvl.level}</strong>
          <div className="level-bar small"><motion.i initial={{ width: 0 }} animate={{ width: `${(lvl.into / lvl.next) * 100}%` }} transition={{ duration: 1 }} /></div>
          <span className="tile-s">{t('result.toNext', { xp: lvl.next - lvl.into })}</span>
        </div>
        <div className="tile tile-streak">
          <span className="tile-k">{t('stats.streak')}</span>
          <strong className="tile-v"><Icon name="flame" size={26} filled={streak.todayDone} />{streak.current}</strong>
          <span className="tile-s">{t('stats.best', { count: streak.best })} · {t('stats.freezesLeft', { count: Math.max(0, FREEZES_PER_MONTH - usedFreezes) })}</span>
        </div>
      </div>

      <button className="goal-card" onClick={() => setGoalOpen(true)}>
        <GoalRing done={yearSt.finished.length} goal={settings.yearlyGoal} />
        <span>
          <strong>{t('stats.yearGoal', { year: cursor.y })}</strong>
          <span className="muted small">{t('stats.yearGoalBody', { done: yearSt.finished.length, goal: settings.yearlyGoal })}</span>
        </span>
        <Icon name="edit" size={16} className="muted" />
      </button>

      <div className="period-bar">
        <Segmented label="period" value={period} onChange={(v) => { setPeriod(v); }} options={[{ value: 'month', label: t('stats.month') }, { value: 'year', label: t('stats.year') }]} />
      </div>
      <div className="period-nav">
        <IconButton icon="back" label={t('stats.prev')} onClick={() => move(-1)} />
        <h2>{heading}</h2>
        <IconButton icon="forward" label={t('stats.next')} onClick={() => move(1)} disabled={isCurrent} style={{ opacity: isCurrent ? 0.3 : 1 }} />
      </div>

      <motion.div key={`${period}${from}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
        <div className="hero-num">
          <strong>{hours >= 10 ? Math.round(hours) : hours.toFixed(1)}</strong>
          <span>{t('stats.hoursRead')}</span>
        </div>
        <div className="num-grid">
          <Num v={st.finished.length} k={t('stats.booksFinished')} />
          <Num v={st.daysRead} k={t('stats.daysRead')} />
          <Num v={st.pages} k={t('stats.pages')} />
          <Num v={st.pagesPerHour ? Math.round(st.pagesPerHour) : '–'} k={t('stats.pagesPerHour')} />
          <Num v={st.longestMin} k={t('stats.longest')} />
          <Num v={st.sessions} k={t('stats.sessions')} />
        </div>

        <section className="section">
          <h2>{t('stats.calendar')}</h2>
          {period === 'month' ? <MonthHeat y={cursor.y} m={cursor.m} perDay={st.perDay} goal={settings.dailyGoalMin} /> : <YearHeat y={cursor.y} perDay={st.perDay} goal={settings.dailyGoalMin} />}
        </section>

        {st.finished.length > 0 && (
          <section className="section">
            <h2>{t('stats.finishedBooks')}</h2>
            <div className="finished-row">
              {st.finished.map((b) => <button key={b.id} onClick={() => nav(`/book/${b.id}`)}><Cover book={b} width={74} /></button>)}
            </div>
          </section>
        )}

        {st.minutes > 0 && (
          <>
            <section className="section">
              <h2>{t('stats.genres')}</h2>
              <Bars data={Object.entries(st.genres).sort((a, b) => b[1] - a[1]).map(([g, v]) => ({ label: t(`genre.${g}`), v }))} unit={t('time.minUnit')} />
            </section>
            <section className="section">
              <h2>{t('stats.when')}</h2>
              <Hours hours={st.hours} />
              <p className="muted small" style={{ marginTop: 8 }}>{t('stats.whenBody', { hour: st.hours.indexOf(Math.max(...st.hours)) })}</p>
            </section>
          </>
        )}

        <Button variant="primary" size="lg" icon="share" className="full wrapped-btn" disabled={sharing || st.minutes === 0} onClick={share}>
          {period === 'month' ? t('stats.shareMonth') : t('stats.shareYear')}
        </Button>
      </motion.div>

      <section className="section">
        <h2>{t('stats.achievements', { done: unlocked.length, total: ACHIEVEMENTS.length })}</h2>
        <div className="ach-grid">
          {ACHIEVEMENTS.map((a) => {
            const on = unlockedSet.has(a.id);
            return (
              <motion.button key={a.id} whileTap={{ scale: 0.94 }} transition={spring} className={`ach ${on ? 'on' : ''}`} onClick={() => setAchOpen(a.id)}>
                <span className="ach-icon"><Icon name={a.icon} size={22} filled={on && (a.icon === 'flame' || a.icon === 'star')} /></span>
                <span className="ach-name">{t(`ach.list.${a.id}.name`)}</span>
              </motion.button>
            );
          })}
        </div>
      </section>

      <Sheet open={!!achOpen} onClose={() => setAchOpen(null)} title={achOpen ? t(`ach.list.${achOpen}.name`) : ''}>
        {achOpen && (
          <>
            <p>{t(`ach.list.${achOpen}.desc`)}</p>
            <p className="muted small" style={{ marginTop: 10 }}>
              {unlockedSet.has(achOpen)
                ? t('stats.unlockedOn', { date: new Date(unlocked.find((u) => u.id === achOpen)!.unlockedAt).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' }) })
                : t('stats.locked')}
            </p>
          </>
        )}
      </Sheet>
      <GoalSheet open={goalOpen} onClose={() => setGoalOpen(false)} value={settings.yearlyGoal} />
    </div>
  );
}

function Num({ v, k }: { v: number | string; k: string }) {
  return <div className="num"><strong>{v}</strong><span>{k}</span></div>;
}

function GoalRing({ done, goal }: { done: number; goal: number }) {
  const r = 24, c = 2 * Math.PI * r, ratio = Math.min(1, done / Math.max(1, goal));
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden="true" style={{ flex: 'none' }}>
      <circle cx="30" cy="30" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
      <motion.circle cx="30" cy="30" r={r} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c}
        initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - ratio) }} transition={{ duration: 1.1 }} transform="rotate(-90 30 30)" />
      <text x="30" y="35" textAnchor="middle" fill="var(--ink)" fontSize="15" fontWeight="700" fontFamily="var(--font-display)">{done}</text>
    </svg>
  );
}

function level(min: number, goal: number) {
  if (min <= 0) return 0;
  if (min < goal) return 1;
  if (min < goal * 3) return 2;
  return 3;
}

function MonthHeat({ y, m, perDay, goal }: { y: number; m: number; perDay: Map<string, number>; goal: number }) {
  const { t } = useTranslation();
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const today = todayKey();
  const names = t('stats.weekdays').split(',');
  return (
    <div className="month-heat">
      {names.map((n, i) => <span key={'wd' + i} className="wd">{n}</span>)}
      {Array.from({ length: lead }, (_, i) => <span key={'x' + i} />)}
      {Array.from({ length: days }, (_, i) => {
        const k = dayKey(new Date(y, m - 1, i + 1).getTime());
        const min = perDay.get(k) ?? 0;
        return (
          <span key={k} className={`day l${level(min, goal)} ${k === today ? 'today' : ''}`} title={`${k}: ${Math.round(min)}`}>
            {i + 1}
          </span>
        );
      })}
    </div>
  );
}

function YearHeat({ y, perDay, goal }: { y: number; perDay: Map<string, number>; goal: number }) {
  const start = new Date(y, 0, 1);
  const lead = (start.getDay() + 6) % 7;
  const n = (new Date(y + 1, 0, 1).getTime() - start.getTime()) / 86400000;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(<i key={'x' + i} className="blank" />);
  for (let d = 0; d < n; d++) {
    const k = dayKey(new Date(y, 0, 1 + d).getTime());
    cells.push(<i key={k} className={`l${level(perDay.get(k) ?? 0, goal)}`} />);
  }
  return <div className="year-heat">{cells}</div>;
}

function Bars({ data, unit }: { data: { label: string; v: number }[]; unit: string }) {
  const max = Math.max(...data.map((d) => d.v), 1);
  return (
    <div className="bars">
      {data.slice(0, 6).map((d, i) => (
        <div key={d.label} className="bar-row">
          <span className="bar-label">{d.label}</span>
          <span className="bar-track"><motion.i initial={{ width: 0 }} animate={{ width: `${(d.v / max) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.05 }} /></span>
          <span className="bar-v">{Math.round(d.v)} {unit}</span>
        </div>
      ))}
    </div>
  );
}

function Hours({ hours }: { hours: number[] }) {
  const max = Math.max(...hours, 1);
  return (
    <div className="hours">
      {hours.map((h, i) => (
        <span key={i} className="hour">
          <motion.i initial={{ height: 0 }} animate={{ height: `${Math.max(h > 0 ? 6 : 2, (h / max) * 100)}%` }} transition={{ duration: 0.7, delay: i * 0.015 }} className={h > 0 ? 'on' : ''} />
          {i % 6 === 0 && <b>{i}</b>}
        </span>
      ))}
    </div>
  );
}

function GoalSheet({ open, onClose, value }: { open: boolean; onClose: () => void; value: number }) {
  const { t } = useTranslation();
  const [v, setV] = useState(value);
  return (
    <Sheet open={open} onClose={onClose} title={t('stats.setGoal')}>
      <p className="muted">{t('stats.setGoalBody')}</p>
      <div className="goal-stepper">
        <button onClick={() => setV(Math.max(1, v - 1))} aria-label="-1">−</button>
        <strong>{v}</strong>
        <button onClick={() => setV(v + 1)} aria-label="+1">+</button>
      </div>
      <p className="muted small" style={{ textAlign: 'center' }}>{t('stats.perMonth', { n: (v / 12).toFixed(1) })}</p>
      <div className="sheet-actions">
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={() => { saveSettings({ yearlyGoal: v }); onClose(); }}>{t('common.save')}</Button>
      </div>
    </Sheet>
  );
}
