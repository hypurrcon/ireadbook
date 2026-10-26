import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { Quality, RoomCustomization, Settings as S } from '../db/types';
import { resetDb } from '../db/db';
import { saveSettings } from '../db/repo';
import { useAchievements, useBooks, useSettings } from '../hooks/data';
import { Button, Field, IconButton, Segmented, Sheet, spring, toast } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { ROOMS, getRoom, defaultCustomization } from '../rooms/registry';
import { applyTokens } from '../rooms/tokens';
import { RoomTile } from './Onboarding';
import { setLanguage, currentLang } from '../i18n';
import { exportBackup, importBackup, backupFileName, BackupError } from '../backup/backup';
import { buildDailyIcs } from '../domain/ics';
import { DECOR, decorUnlocked } from '../domain/decor';
import { downloadBlob } from '../share/actions';
import { useInstall, isIOS, requestPersistence } from '../state/install';
import { setOnboardedNow } from '../state/onboard';
import { DevicesSection } from './Devices';
import { resetIdentity } from '../sync/identity';
import { setVolumes, setMuted, sfx } from '../audio/sound';

export default function Settings() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const s = useSettings();
  const books = useBooks() ?? [];
  const unlocked = new Set((useAchievements() ?? []).map((a) => a.id));
  const room = getRoom(s.room);
  const custom: RoomCustomization = { ...defaultCustomization(room), ...(s.rooms[s.room] ?? {}) };
  const setCustom = (patch: Partial<RoomCustomization>) => saveSettings({ rooms: { ...s.rooms, [s.room]: { ...custom, ...patch } } });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [wipe, setWipe] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const install = useInstall();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null)); }, []);

  const doExport = async () => {
    const blob = await exportBackup();
    const saved = await downloadBlob(blob, backupFileName());
    await saveSettings({ lastBackupAt: Date.now(), booksSinceBackup: 0, backupSnoozeUntil: undefined });
    toast(saved.kept ? t('settings.exportedTo', { path: saved.kept }) : t('settings.exported'), 'ok');
  };

  const vol = (k: keyof S['volume'], v: number) => {
    const volume = { ...s.volume, [k]: v };
    setVolumes(volume);
    saveSettings({ volume });
  };

  const loc = currentLang() === 'th' ? 'th-TH' : 'en-GB';

  return (
    <div className="screen settings">
      <div className="screen-head">
        <IconButton icon="back" label={t('common.back')} onClick={() => nav(-1)} />
        <h1>{t('settings.title')}</h1>
      </div>

      {!install.installed && (
        <div className="install-card">
          <Icon name="download" />
          <div>
            <strong>{t('settings.installTitle')}</strong>
            <p className="muted small">{isIOS() ? t('settings.installIOS') : t('settings.installBody')}</p>
          </div>
          {install.prompt && <Button variant="primary" size="sm" onClick={async () => { install.prompt.prompt(); await install.prompt.userChoice; useInstall.setState({ prompt: null }); }}>{t('settings.install')}</Button>}
        </div>
      )}

      <DevicesSection />

      <section className="section">
        <h2>{t('settings.language')}</h2>
        <Segmented label="lang" value={currentLang()} onChange={(v) => setLanguage(v)} options={[{ value: 'th', label: 'ภาษาไทย' }, { value: 'en', label: 'English' }]} />
      </section>

      <section className="section">
        <h2>{t('settings.room')}</h2>
        <div className="room-strip">
          {ROOMS.map((r) => (
            <RoomTile key={r.id} id={r.id} preview={r.preview} on={s.room === r.id} onPick={() => { applyTokens(r.id); saveSettings({ room: r.id }); }} />
          ))}
        </div>
      </section>

      <section className="section">
        <h2>{t('settings.customize', { room: t(`rooms.${room.id}.name`) })}</h2>
        <Field label={t('settings.shelfColor')} group>
          <div className="swatches">
            {room.colors.map((c) => (
              <motion.button key={c} whileTap={{ scale: 0.88 }} transition={spring} className={`swatch ${custom.shelfColor === c || (!custom.shelfColor && c === room.colors[0]) ? 'on' : ''}`}
                style={{ background: c }} aria-label={c} onClick={() => { sfx('tap'); setCustom({ shelfColor: c }); }} />
            ))}
          </div>
        </Field>
        <Field label={t('settings.material')} group>
          <Segmented label="material" value={custom.shelfMaterial} onChange={(v) => setCustom({ shelfMaterial: v })}
            options={(['wood', 'metal', 'painted'] as const).map((m) => ({ value: m, label: t(`settings.materials.${m}`) }))} />
        </Field>
        <Field label={t('settings.rows')} group>
          <div className="mini-stepper">
            <button onClick={() => setCustom({ shelfRows: Math.max(2, custom.shelfRows - 1) })} aria-label="-1">−</button>
            <strong>{custom.shelfRows}</strong>
            <button onClick={() => setCustom({ shelfRows: Math.min(6, custom.shelfRows + 1) })} aria-label="+1">+</button>
          </div>
        </Field>
        <Field label={t('settings.time')} group>
          <Segmented label="daynight" value={custom.night ? 'night' : 'day'} onChange={(v) => setCustom({ night: v === 'night' })}
            options={[{ value: 'day', label: t('settings.day') }, { value: 'night', label: t('settings.night') }]} />
        </Field>
        <Field label={t('settings.decor')} hint={t('settings.decorHint')} group>
          <div className="decor-grid">
            {DECOR.map((d) => {
              const open = decorUnlocked(d.id, unlocked);
              const on = custom.decor.includes(d.id);
              return (
                <button key={d.id} className={`decor ${on ? 'on' : ''} ${open ? '' : 'locked'}`} disabled={!open}
                  onClick={() => { sfx('tap'); setCustom({ decor: on ? custom.decor.filter((x) => x !== d.id) : [...custom.decor, d.id] }); }}>
                  <strong>{t(`decor.${d.id}`)}</strong>
                  <span>{open ? (on ? t('settings.decorOn') : t('settings.decorOff')) : t('settings.decorNeeds', { name: t(`ach.list.${d.needs}.name`) })}</span>
                </button>
              );
            })}
          </div>
        </Field>
        <Field label={t('settings.quality')} hint={t('settings.qualityHint')} group>
          <Segmented label="quality" value={s.quality} onChange={(v: Quality) => saveSettings({ quality: v })}
            options={(['low', 'mid', 'high'] as const).map((q) => ({ value: q, label: t(`settings.q.${q}`) }))} />
        </Field>
      </section>

      <section className="section">
        <h2>{t('settings.sound')}</h2>
        <label className="toggle-row">
          <span><strong>{t('settings.soundOn')}</strong></span>
          <input type="checkbox" className="switch" checked={!s.muted} onChange={(e) => { setMuted(!e.target.checked); saveSettings({ muted: !e.target.checked }); }} />
        </label>
        {(['ui', 'book', 'ambience', 'reward'] as const).map((k) => (
          <label key={k} className="slider-row">
            <span>{t(`settings.vol.${k}`)}</span>
            <input type="range" min={0} max={1} step={0.05} value={s.volume[k]} disabled={s.muted}
              onChange={(e) => vol(k, parseFloat(e.target.value))} onPointerUp={() => sfx(k === 'book' ? 'bookOut' : k === 'reward' ? 'reward' : 'tap')} />
          </label>
        ))}
      </section>

      <section className="section">
        <h2>{t('settings.goals')}</h2>
        <Field label={t('settings.dailyGoal')} hint={t('welcome.goalHint')} group>
          <div className="chips">
            {[5, 10, 15, 20, 30, 45, 60].map((m) => <button key={m} className={`chip ${s.dailyGoalMin === m ? 'on' : ''}`} onClick={() => { sfx('tap'); saveSettings({ dailyGoalMin: m }); }}>{t('time.m', { m })}</button>)}
          </div>
        </Field>
        <div className="row">
          <Field label={t('settings.yearGoal')}><input inputMode="numeric" value={s.yearlyGoal} onChange={(e) => saveSettings({ yearlyGoal: Math.max(1, parseInt(e.target.value.replace(/\D/g, ''), 10) || 1) })} /></Field>
          <Field label={t('settings.pomoWork')}><input inputMode="numeric" value={s.pomodoroWork} onChange={(e) => saveSettings({ pomodoroWork: Math.max(1, parseInt(e.target.value.replace(/\D/g, ''), 10) || 25) })} /></Field>
          <Field label={t('settings.pomoBreak')}><input inputMode="numeric" value={s.pomodoroBreak} onChange={(e) => saveSettings({ pomodoroBreak: Math.max(1, parseInt(e.target.value.replace(/\D/g, ''), 10) || 5) })} /></Field>
        </div>
      </section>

      <section className="section">
        <h2>{t('settings.reminder')}</h2>
        <p className="muted small" style={{ marginBottom: 12 }}>{t('settings.reminderBody')}</p>
        <div className="row reminder-row">
          <Field label={t('settings.reminderTime')}><input type="time" value={s.reminderTime ?? '20:30'} onChange={(e) => saveSettings({ reminderTime: e.target.value })} /></Field>
          <Button icon="calendar" onClick={async () => {
            const ics = buildDailyIcs(s.reminderTime ?? '20:30', t('settings.reminderTitle'), t('settings.reminderNote', { min: s.dailyGoalMin }));
            await downloadBlob(new Blob([ics], { type: 'text/calendar' }), 'ireadbook-reminder.ics');
            toast(t('settings.reminderSaved'), 'ok');
          }}>{t('settings.addToCalendar')}</Button>
        </div>
      </section>

      <section className="section" id="backup">
        <h2>{t('settings.data')}</h2>
        <p className="muted small">{t('settings.dataBody')}</p>
        <p className="small" style={{ margin: '10px 0 14px' }}>
          {s.lastBackupAt ? t('settings.lastBackup', { date: new Date(s.lastBackupAt).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' }) }) : t('settings.neverBackedUp')}
          {' · '}{t('common.books', { count: books.length })}
        </p>
        <div className="row">
          <Button variant="primary" icon="download" onClick={doExport}>{t('settings.export')}</Button>
          <Button icon="upload" onClick={() => fileRef.current?.click()}>{t('settings.import')}</Button>
        </div>
        <input ref={fileRef} type="file" accept=".ireadbook,.zip,application/zip" hidden onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
        <p className="muted small persist-line">
          <Icon name={persisted ? 'check' : 'clock'} size={14} />
          {persisted ? t('settings.persisted') : t('settings.notPersisted')}
          {!persisted && <button className="link" onClick={async () => setPersisted(await requestPersistence())}>{t('settings.persistAsk')}</button>}
        </p>
      </section>

      <section className="section">
        <Button variant="danger" icon="trash" onClick={() => setWipe(true)}>{t('settings.wipe')}</Button>
        <p className="muted small about">Ireadbook · {t('settings.about')}</p>
      </section>

      <ImportSheet file={importFile} onClose={() => setImportFile(null)} />
      <Sheet open={wipe} onClose={() => setWipe(false)} title={t('settings.wipe')}>
        <p>{t('settings.wipeBody')}</p>
        <div className="sheet-actions">
          <Button onClick={() => setWipe(false)}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={async () => { await resetDb(); resetIdentity(); setOnboardedNow(false); setWipe(false); nav('/welcome', { replace: true }); }}>{t('settings.wipeConfirm')}</Button>
        </div>
      </Sheet>
    </div>
  );
}

function ImportSheet({ file, onClose }: { file: File | null; onClose: () => void }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await importBackup(file, mode);
      toast(t('settings.imported', { books: r.books, sessions: r.sessions }), 'ok');
      const st = await import('../db/repo').then((m) => m.getSettings());
      applyTokens(st.room);
      onClose();
      nav('/', { replace: true });
    } catch (e) {
      toast(e instanceof BackupError && e.code === 'version' ? t('settings.importNewer') : t('settings.importBad'), 'error');
    } finally { setBusy(false); }
  };
  return (
    <Sheet open={!!file} onClose={onClose} title={t('settings.import')}>
      <p className="small muted" style={{ marginBottom: 14 }}>{file?.name}</p>
      <Segmented label="mode" value={mode} onChange={setMode} options={[{ value: 'merge', label: t('settings.merge') }, { value: 'replace', label: t('settings.replace') }]} />
      <p className="small" style={{ marginTop: 12 }}>{mode === 'merge' ? t('settings.mergeBody') : t('settings.replaceBody')}</p>
      <div className="sheet-actions">
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant={mode === 'replace' ? 'danger' : 'primary'} disabled={busy} onClick={run}>{busy ? t('common.loading') : t('settings.importGo')}</Button>
      </div>
    </Sheet>
  );
}
