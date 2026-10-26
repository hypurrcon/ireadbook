import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, IconButton, Sheet, spring, toast } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { useSync, startPairing, cancelPairing, joinWithCode, syncNow, syncWith, disconnectPeer, type PeerState } from '../sync/manager';
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
  const [fx, setFx] = useState<string | null>(null);
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
              <Button size="sm" variant="primary" icon="sync" onClick={() => setFx(p.deviceId)}>{t('sync.one')}</Button>
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
      <SyncFx peerId={fx} onClose={() => { setFx(null); refresh(); }} />
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

const isPhone = (name: string) => /android|iphone|phone|มือถือ|mobile|ipad/i.test(name);

/** Full-screen "data flying between devices" animation for a one-tap sync. */
export function SyncFx({ peerId, onClose }: { peerId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const traffic = useSync((s) => (peerId ? s.traffic[peerId] : undefined));
  const state = useSync((s) => (peerId ? s.peerState[peerId] : undefined));
  const me = loadIdentity() ?? ensureIdentity();
  const peer = me.peers.find((p) => p.deviceId === peerId);
  const [phase, setPhase] = useState<'run' | 'done' | 'failed'>('run');
  const [started, setStarted] = useState(0);

  useEffect(() => {
    if (!peerId) return;
    setPhase('run');
    setStarted(Date.now());
    syncWith(peerId).then((ok) => { if (!ok) setPhase('failed'); });
  }, [peerId]);

  useEffect(() => {
    if (!peerId || phase !== 'run') return;
    const i = setInterval(() => {
      const st = useSync.getState();
      const tr = st.traffic[peerId];
      const quiet = !tr || Date.now() - tr.at > 900;
      if (st.peerState[peerId] === 'synced' && quiet && Date.now() - started > 1800) { setPhase('done'); sfx('reward'); }
      else if (Date.now() - started > 20000) setPhase(st.peerState[peerId] === 'offline' || !st.peerState[peerId] ? 'failed' : 'done');
    }, 250);
    return () => clearInterval(i);
  }, [peerId, phase, started]);

  const sent = traffic?.sent ?? 0, recv = traffic?.recv ?? 0;
  const out = sent > 0, inn = recv > 0;
  const waitingForData = phase === 'run' && !out && !inn;
  return createPortal(
    <AnimatePresence>
      {peerId && (
        <motion.div className="sync-fx" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => phase !== 'run' && onClose()}>
          <div className="sync-stage">
            <Device name={me.deviceName} label={t('sync.thisDeviceShort')} active={out || waitingForData} />
            <div className="sync-wire">
              <i className="wire" />
              {(out || waitingForData) && phase === 'run' && <Stream dir={1} faint={waitingForData} />}
              {(inn || waitingForData) && phase === 'run' && <Stream dir={-1} faint={waitingForData} />}
              {phase === 'done' && <motion.span className="sync-ok" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}><Icon name="check" size={22} sw={2.4} /></motion.span>}
            </div>
            <Device name={peer?.name ?? ''} label={t('sync.otherShort')} active={inn || waitingForData} />
          </div>
          <div className="sync-caption" aria-live="polite">
            {phase === 'failed' ? <p>{t('sync.fxFailed')}</p>
              : phase === 'run' ? <p>{waitingForData ? t('sync.fxComparing') : t('sync.fxMoving', { n: sent + recv })}</p>
                : (
                  <>
                    <strong>{sent + recv === 0 ? t('sync.fxSame') : t('sync.fxDone')}</strong>
                    {sent > 0 && <p>{t('sync.fxSent', { n: sent, to: peer?.name ?? '' })}</p>}
                    {recv > 0 && <p>{t('sync.fxRecv', { n: recv, from: peer?.name ?? '' })}</p>}
                    <span className="muted small">{t('sync.fxTap')}</span>
                  </>
                )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Device({ name, label, active }: { name: string; label: string; active: boolean }) {
  return (
    <div className={`sync-device ${active ? 'on' : ''}`}>
      <motion.span className="sync-device-icon" animate={active ? { scale: [1, 1.06, 1] } : { scale: 1 }} transition={{ duration: 1.2, repeat: active ? Infinity : 0 }}>
        <Icon name={isPhone(name) ? 'phone' : 'laptop'} size={40} sw={1.4} />
      </motion.span>
      <strong>{name || '—'}</strong>
      <span className="muted small">{label}</span>
    </div>
  );
}

/** A stream of glowing packets running along the wire. dir 1 = left→right. */
function Stream({ dir, faint }: { dir: 1 | -1; faint: boolean }) {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <motion.b key={i} className={`packet ${faint ? 'faint' : ''}`}
          initial={{ left: dir === 1 ? '0%' : '100%', opacity: 0 }}
          animate={{ left: dir === 1 ? ['0%', '100%'] : ['100%', '0%'], opacity: [0, 1, 1, 0], y: [0, dir * -10, dir * -10, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }} />
      ))}
    </>
  );
}
