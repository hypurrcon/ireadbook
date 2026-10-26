import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Segmented, spring, toast } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { ROOMS } from '../rooms/registry';
import { addBook, saveSettings } from '../db/repo';
import { useBooks, useSettings } from '../hooks/data';
import { setLanguage, currentLang, type Lang } from '../i18n';
import { applyTokens } from '../rooms/tokens';
import { startReading } from '../state/actions';
import { sfx } from '../audio/sound';
import { requestPersistence } from '../state/install';
import { setOnboardedNow } from '../state/onboard';
import { importBackup, BackupError } from '../backup/backup';
import { getSettings } from '../db/repo';
import { JoinSheet } from './Devices';

const STEPS = ['lang', 'room', 'book', 'goal', 'ready'] as const;
type Step = typeof STEPS[number];

export default function Onboarding() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const settings = useSettings();
  const books = useBooks() ?? [];
  const step = (STEPS.includes(params.get('step') as Step) ? params.get('step') : 'lang') as Step;
  const idx = STEPS.indexOf(step);
  const go = (s: Step) => { sfx('pageFlip'); setParams({ step: s }, { replace: true }); };
  const [lang, setLang] = useState<Lang>(currentLang());
  const [title, setTitle] = useState('');
  const [pages, setPages] = useState('');
  const restoreRef = useRef<HTMLInputElement>(null);
  const [joinOpen, setJoinOpen] = useState(false);

  const restore = async (f?: File | null) => {
    if (!f) return;
    try {
      const r = await importBackup(f, 'replace');
      await saveSettings({ onboarded: true });
      setOnboardedNow(true);
      applyTokens((await getSettings()).room);
      toast(t('settings.imported', { books: r.books, sessions: r.sessions }), 'ok');
      nav('/', { replace: true });
    } catch (e) {
      toast(e instanceof BackupError && e.code === 'version' ? t('settings.importNewer') : t('settings.importBad'), 'error');
    }
  };

  const addTyped = async () => {
    const b = await addBook({ title, pageCount: pages ? Math.max(1, parseInt(pages, 10)) : undefined, needsLookup: true });
    toast(t('welcome.added', { title: b.title || t('common.untitled') }), 'ok');
    setTitle(''); setPages('');
    go('goal');
  };

  const finish = async (read: boolean) => {
    await saveSettings({ onboarded: true });
    setOnboardedNow(true);
    requestPersistence();
    const first = books.find((b) => b.status !== 'finished');
    if (read && first) startReading(first, '5min', nav, 5);
    else nav('/', { replace: true });
  };

  return (
    <div className="welcome">
      <div className="welcome-progress" aria-hidden="true">
        {STEPS.map((s, i) => <span key={s} className={i <= idx ? 'on' : ''} />)}
      </div>
      <AnimatePresence mode="wait">
        <motion.section key={step} className="welcome-step" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={spring}>
          {step === 'lang' && (
            <>
              <div className="welcome-mark" aria-hidden="true"><Icon name="read" size={40} sw={1.3} /></div>
              <h1 className="welcome-title">Ireadbook</h1>
              <p className="welcome-lead">{t('welcome.tagline')}</p>
              <div className="welcome-fill" />
              <p className="field-label">{t('welcome.pickLang')}</p>
              <Segmented label="lang" value={lang} onChange={(v) => { setLang(v); setLanguage(v); }}
                options={[{ value: 'th', label: 'ภาษาไทย' }, { value: 'en', label: 'English' }]} />
              <Button variant="primary" size="lg" className="welcome-next" onClick={() => go('room')}>{t('common.next')}</Button>
              <button className="welcome-restore" onClick={() => setJoinOpen(true)}>{t('welcome.joinOther')}</button>
              <button className="welcome-restore" onClick={() => restoreRef.current?.click()}>{t('welcome.restore')}</button>
              <JoinSheet open={joinOpen} onClose={() => setJoinOpen(false)} onJoined={async () => {
                await saveSettings({ onboarded: true });
                setOnboardedNow(true);
                applyTokens((await getSettings()).room);
                nav('/', { replace: true });
              }} />
              <input ref={restoreRef} type="file" accept=".ireadbook,.zip,application/zip" hidden onChange={(e) => { restore(e.target.files?.[0]); e.target.value = ''; }} />
            </>
          )}

          {step === 'room' && (
            <>
              <h1 className="welcome-h">{t('welcome.pickRoom')}</h1>
              <p className="muted">{t('welcome.pickRoomHint')}</p>
              <div className="room-grid">
                {ROOMS.map((r) => (
                  <RoomTile key={r.id} id={r.id} preview={r.preview} on={settings.room === r.id}
                    onPick={() => { applyTokens(r.id); saveSettings({ room: r.id }); }} />
                ))}
              </div>
              <Button variant="primary" size="lg" className="welcome-next sticky" onClick={() => go('book')}>{t('common.next')}</Button>
            </>
          )}

          {step === 'book' && (
            <>
              <h1 className="welcome-h">{t('welcome.firstBook')}</h1>
              <p className="muted">{t('welcome.firstBookHint')}</p>
              {books.length > 0 && (
                <ul className="welcome-books">
                  {books.map((b) => <li key={b.id}><Icon name="check" size={16} />{b.title || t('common.untitled')}</li>)}
                </ul>
              )}
              <Button variant="primary" size="lg" icon="camera" className="welcome-photo" onClick={() => nav('/add?from=welcome')}>{t('welcome.takePhoto')}</Button>
              <p className="welcome-or">{t('welcome.typeTitle')}</p>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('welcome.titlePlaceholder')} aria-label={t('welcome.titlePlaceholder')} />
              <input className="input" style={{ marginTop: 10 }} inputMode="numeric" value={pages} onChange={(e) => setPages(e.target.value.replace(/\D/g, ''))} placeholder={t('welcome.pagesPlaceholder')} aria-label={t('welcome.pagesPlaceholder')} />
              <div className="welcome-fill" />
              <div className="row">
                <Button variant="ghost" onClick={() => go('goal')}>{books.length ? t('common.next') : t('common.skip')}</Button>
                <Button variant="primary" disabled={!title.trim()} onClick={addTyped}>{t('welcome.addBook')}</Button>
              </div>
            </>
          )}

          {step === 'goal' && (
            <>
              <h1 className="welcome-h">{t('welcome.goal')}</h1>
              <p className="muted">{t('welcome.goalHint')}</p>
              <div className="goal-pick">
                {[5, 10, 15, 30].map((m) => (
                  <motion.button key={m} whileTap={{ scale: 0.95 }} transition={spring} className={`goal-opt ${settings.dailyGoalMin === m ? 'on' : ''}`}
                    onClick={() => { sfx('tap'); saveSettings({ dailyGoalMin: m }); }}>
                    <strong>{m}</strong><span>{t('time.minUnit')}</span>
                  </motion.button>
                ))}
              </div>
              <div className="welcome-fill" />
              <Button variant="primary" size="lg" className="welcome-next" onClick={() => go('ready')}>{t('common.next')}</Button>
            </>
          )}

          {step === 'ready' && (
            <>
              <div className="welcome-fill" />
              <h1 className="welcome-title">{t('welcome.ready')}</h1>
              <p className="welcome-lead">{books.length ? t('welcome.readyBody') : t('welcome.readyNoBook')}</p>
              <div className="welcome-fill" />
              {books.length > 0 && <Button variant="primary" size="lg" icon="play" className="welcome-next" onClick={() => finish(true)}>{t('welcome.start5')}</Button>}
              <Button variant={books.length ? 'ghost' : 'primary'} size="lg" className="welcome-next" onClick={() => finish(false)}>{t('welcome.toShelf')}</Button>
            </>
          )}
        </motion.section>
      </AnimatePresence>
      {idx > 0 && (
        <button className="welcome-back" onClick={() => go(STEPS[idx - 1])} aria-label={t('common.back')}><Icon name="back" /></button>
      )}
    </div>
  );
}

export function RoomTile({ id, preview, on, onPick }: { id: string; preview: [string, string, string]; on: boolean; onPick: () => void }) {
  const { t } = useTranslation();
  const [imgOk, setImgOk] = useState(true);
  return (
    <motion.button whileTap={{ scale: 0.96 }} transition={spring} className={`room-tile ${on ? 'on' : ''}`} onClick={() => { sfx('tap'); onPick(); }} aria-pressed={on}>
      <span className="room-thumb" style={{ background: `linear-gradient(160deg, ${preview[0]} 55%, ${preview[2]})` }}>
        {imgOk && <img src={`./rooms/${id}.jpg`} alt="" loading="lazy" onError={() => setImgOk(false)} />}
        <i style={{ background: preview[1] }} />
      </span>
      <span className="room-name">{t(`rooms.${id}.name`)}</span>
      <span className="room-desc">{t(`rooms.${id}.desc`)}</span>
    </motion.button>
  );
}
