import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, IconButton, Sheet, spring, toast } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { useSync, startPairing, cancelPairing, joinWithCode, syncNow, disconnectPeer, type PeerState } from '../sync/manager';
import { ensureIdentity, loadIdentity, updateIdentity } from '../sync/identity';
import { currentLang } from '../i18n';
import { sfx } from '../audio/sound';

function useIdentity() {
  const [id, setId] = useState(() => ensureIdentity());
  const peerState = useSync((s) => s.peerState);
  useEffect(() => { setId(loadIdentity() ?? ensureIdentity()); }, [peerState]);
  return [id, () => setId(loadIdentity() ?? ensureIdentity())] as const;
}

/** Settings section: this device, paired devices, pair / join. */
export function DevicesSection() {
  const { t } = useTranslation();
  const [me, refresh] = useIdentity();
  const peerState = useSync((s) => s.peerState);
  const [pairOpen, setPairOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState(me.deviceName);
  const loc = currentLang() === 'th' ? 'th-TH' : 'en-GB';

  return (
    <section className="section" id="devices">
      <h2>{t('sync.title')}</h2>
      <p className="muted small" style={{ marginBottom: 12 }}>{t('sync.body')}</p>
      <label className="field">
        <span className="field-label">{t('sync.thisDevice')}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { updateIdentity({ deviceName: name.trim() || me.deviceName }); refresh(); }} />
      </label>
      {me.peers.length > 0 && (
        <div className="list devices">
          {me.peers.map((p) => (
            <div key={p.deviceId} className="list-item">
              <StatusDot s={peerState[p.deviceId] ?? 'offline'} />
              <span className="book-line-text">
                <strong>{p.name || t('sync.unnamed')}</strong>
                <span className="muted small">
                  {t(`sync.state.${peerState[p.deviceId] ?? 'offline'}`)}
                  {p.lastSyncAt ? ` · ${t('sync.last', { when: new Date(p.lastSyncAt).toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}` : ''}
                </span>
              </span>
              <IconButton icon="close" label={t('sync.forget')} onClick={() => { disconnectPeer(p.deviceId); refresh(); toast(t('sync.forgotten')); }} />
            </div>
          ))}
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <Button variant="primary" icon="plus" onClick={() => { setPairOpen(true); startPairing(); }}>{t('sync.pairNew')}</Button>
        <Button icon="type" onClick={() => setJoinOpen(true)}>{t('sync.enterCode')}</Button>
      </div>
      {me.peers.length > 0 && <Button variant="ghost" icon="refresh" className="full" style={{ marginTop: 6 }} onClick={() => { sfx('tap'); syncNow(); }}>{t('sync.now')}</Button>}
      <p className="muted small" style={{ marginTop: 10 }}>{t('sync.hint')}</p>
      <PairSheet open={pairOpen} onClose={() => { setPairOpen(false); cancelPairing(); refresh(); }} />
      <JoinSheet open={joinOpen} onClose={() => { setJoinOpen(false); refresh(); }} />
    </section>
  );
}

export function StatusDot({ s }: { s: PeerState }) {
  return <span className={`sync-dot ${s}`} aria-hidden="true" />;
}

function PairSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const pairing = useSync((s) => s.pairing);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!open) return; const i = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(i); }, [open]);
  useEffect(() => { if (pairing?.state === 'connected') { sfx('reward'); toast(t('sync.paired'), 'reward'); } }, [pairing?.state]);
  const left = pairing ? Math.max(0, pairing.expiresAt - now) : 0;
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
  return (
    <Sheet open={open} onClose={onClose} title={t('sync.pairNew')}>
      {pairing && (
        <div className="pair">
          {pairing.state === 'connected' ? (
            <motion.div className="pair-done" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
              <Icon name="check" size={36} sw={2} />
              <strong>{t('sync.paired')}</strong>
              <span className="muted">{t('sync.pairedBody')}</span>
            </motion.div>
          ) : pairing.state === 'expired' || left === 0 ? (
            <>
              <p className="muted">{t('sync.expired')}</p>
              <Button variant="primary" icon="refresh" onClick={() => startPairing()}>{t('sync.newCode')}</Button>
            </>
          ) : pairing.state === 'error' ? (
            <>
              <p className="muted">{t('sync.netError')}</p>
              <Button variant="primary" icon="refresh" onClick={() => startPairing()}>{t('common.retry')}</Button>
            </>
          ) : (
            <>
              <p className="muted">{t('sync.showCode')}</p>
              <div className="pair-code" aria-live="polite">
                {pairing.state === 'starting' ? <span className="muted small">{t('common.loading')}…</span> : pairing.code.split('').map((c, i) => <b key={i}>{c}</b>)}
              </div>
              <p className="pair-timer">{t('sync.expiresIn', { time: `${mm}:${String(ss).padStart(2, '0')}` })}</p>
              <p className="muted small"><span className="live-dot" style={{ display: 'inline-block', marginRight: 8, color: 'var(--accent)' }} />{t('sync.waiting')}</p>
            </>
          )}
        </div>
      )}
      <div className="sheet-actions"><Button onClick={onClose}>{pairing?.state === 'connected' ? t('common.done') : t('common.cancel')}</Button></div>
    </Sheet>
  );
}

export function JoinSheet({ open, onClose, onJoined }: { open: boolean; onClose: () => void; onJoined?: () => void }) {
  const { t } = useTranslation();
  const join = useSync((s) => s.join);
  const [code, setCode] = useState('');
  useEffect(() => { if (open) { setCode(''); useSync.setState({ join: 'idle' }); } }, [open]);
  const go = async () => {
    const r = await joinWithCode(code);
    if (r === 'done') { sfx('reward'); toast(t('sync.joined'), 'reward'); onJoined?.(); onClose(); }
  };
  const busy = join === 'connecting' || join === 'syncing';
  return (
    <Sheet open={open} onClose={onClose} title={t('sync.enterCode')}>
      <p className="muted">{t('sync.enterBody')}</p>
      <input className="input code-input" value={code} maxLength={8} autoCapitalize="characters" autoComplete="off" spellCheck={false}
        onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" aria-label={t('sync.codeLabel')} />
      <AnimatePresence>
        {join !== 'idle' && (
          <motion.p key={join} className={`join-state ${join}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{t(`sync.join.${join}`)}</motion.p>
        )}
      </AnimatePresence>
      <div className="sheet-actions">
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" disabled={busy || code.replace(/\s/g, '').length < 6} onClick={go}>{busy ? t('common.loading') : t('sync.connect')}</Button>
      </div>
    </Sheet>
  );
}
