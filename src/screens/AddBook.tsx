import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import type { Book } from '../db/types';
import * as repo from '../db/repo';
import { useBooks, useSettings } from '../hooks/data';
import { Button, IconButton, spring, toast } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { CornerEditor } from '../ui/CornerEditor';
import { BookForm, type BookFormValue } from '../ui/BookForm';
import { analyze, loadShot, readBarcode, straighten, type Processed, type Shot, type Step } from '../lookup/analyze';
import { searchText, fetchImageBlob, type BookMeta } from '../lookup/books';
import { mergeMeta } from '../domain/meta';
import { guessSeries, parseVolume } from '../domain/series';
import { defaultCorners } from '../image/raw';
import { blobToRaw, downscaleBlob } from '../image/process';
import { dominantColorRaw } from '../image/raw';
import { enqueueAnalysis } from '../state/queue';
import { sfx, haptic } from '../audio/sound';

type Stage = 'start' | 'front' | 'back' | 'backCorners' | 'working' | 'form' | 'search' | 'saved';

export default function AddBook() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const fromWelcome = params.get('from') === 'welcome';
  const settings = useSettings();
  const books = useBooks() ?? [];
  const [stage, setStage] = useState<Stage>('start');
  const [continuous, setContinuous] = useState(false);
  const [front, setFront] = useState<Shot | null>(null);
  const [back, setBack] = useState<Shot | null>(null);
  const [step, setStep] = useState<Step>('straighten');
  const [draft, setDraft] = useState<Partial<Book>>({});
  const [frontP, setFrontP] = useState<Processed | null>(null);
  const [backP, setBackP] = useState<Processed | null>(null);
  const [form, setForm] = useState<BookFormValue | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [savedBook, setSavedBook] = useState<Book | null>(null);
  const [count, setCount] = useState(0);
  const [preview, setPreview] = useState<string>();
  const frontInput = useRef<HTMLInputElement>(null);
  const backInput = useRef<HTMLInputElement>(null);
  const libInput = useRef<HTMLInputElement>(null);

  const urls = useRef<string[]>([]);
  const revokeAll = () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); urls.current = []; };
  useEffect(() => revokeAll, []);

  const reset = () => {
    revokeAll();
    setPreview(undefined);
    setFront(null); setBack(null); setFrontP(null); setBackP(null); setDraft({}); setForm(null); setStage('start'); setStep('straighten');
  };

  const onFront = async (f?: File | null) => {
    if (!f) return;
    sfx('start'); haptic(10);
    const shot = await loadShot(f);
    urls.current.push(shot.url);
    setFront(shot);
    if (continuous) { setStage('back'); return; }
    setStage('front');
  };
  const onBack = async (f?: File | null) => {
    if (!f) return;
    sfx('start'); haptic(10);
    const shot = await loadShot(f);
    urls.current.push(shot.url);
    setBack(shot);
    if (continuous) { await quickSave(front, shot); return; }
    setStage('backCorners');
  };

  /** continuous mode: straighten + barcode now, OCR later in the background */
  const quickSave = async (fs: Shot | null, bs: Shot | null) => {
    setStage('working'); setStep('straighten');
    const fp = fs ? await straighten(fs) : null;
    const bp = bs ? await straighten(bs) : null;
    setStep('barcode');
    const isbn = await readBarcode(bs) ?? await readBarcode(fs);
    const b = await repo.addBook({
      isbn: isbn ?? undefined, needsReview: true,
      coverFrontId: fp ? await repo.putImage(fp.blob) : undefined, coverBackId: bp ? await repo.putImage(bp.blob) : undefined,
      dominantColor: fp?.color, coverAspect: fp?.aspect, cropPoints: fs?.corners,
    });
    enqueueAnalysis(b.id);
    await repo.saveSettings({ booksSinceBackup: settings.booksSinceBackup + 1 });
    setCount((c) => c + 1);
    toast(t('add.queued'), 'ok');
    reset();
  };

  const runAnalysis = async (fs: Shot | null, bs: Shot | null) => {
    setStage('working'); setStep('straighten');
    const fp = fs ? await straighten(fs) : null;
    const bp = bs ? await straighten(bs) : null;
    setFrontP(fp); setBackP(bp);
    if (fp) { const u = URL.createObjectURL(fp.blob); urls.current.push(u); setPreview(u); }
    setStep('barcode');
    const isbn = (await readBarcode(bs)) ?? (await readBarcode(fs));
    const r = await analyze(fp, bp, isbn, setStep);
    setDraft({ ...r.patch, dominantColor: fp?.color, coverAspect: fp?.aspect, cropPoints: fs?.corners });
    setFormKey((k) => k + 1);
    setStage('form');
    sfx('reward');
    if (r.source === 'none') toast(t('add.nothingFound'));
  };

  const fromSearch = async (m: BookMeta) => {
    setStage('working'); setStep('lookup');
    let fp: Processed | null = null;
    const img = await fetchImageBlob(m.thumbnail);
    if (img) {
      const blob = await downscaleBlob(img, 600);
      const raw = await blobToRaw(blob, 200);
      fp = { blob, color: dominantColorRaw(raw), aspect: raw.width / raw.height, raw };
    }
    setFrontP(fp);
    setDraft({ ...mergeMeta({ title: '', authors: [] }, m, true), dominantColor: fp?.color, coverAspect: fp?.aspect });
    setFormKey((k) => k + 1);
    setStage('form');
  };

  const save = async () => {
    const patch = { ...draft, ...(form?.patch ?? {}) };
    const book = await repo.addBook({
      ...patch,
      coverFrontId: frontP ? await repo.putImage(frontP.blob) : undefined,
      coverBackId: backP ? await repo.putImage(backP.blob) : undefined,
    });
    let seriesName = form?.series.name;
    let seriesIndex = form?.series.index;
    if (!seriesName) {
      const g = guessSeries(book, books);
      const existing = g?.matches.find((m) => m.seriesId);
      if (g && existing) { seriesName = (await repo.getSeriesName(existing.seriesId!)) ?? g.baseTitle; seriesIndex = g.index ?? parseVolume(book.title).index ?? undefined; }
    }
    if (seriesName) await repo.assignSeries(book.id, seriesName, seriesIndex, form?.series.total);
    await repo.saveSettings({ booksSinceBackup: settings.booksSinceBackup + 1 });
    sfx('bookIn'); haptic(20);
    setSavedBook(book);
    setCount((c) => c + 1);
    if (fromWelcome) { toast(t('welcome.added', { title: book.title || t('common.untitled') }), 'ok'); nav('/welcome?step=goal', { replace: true }); return; }
    setStage('saved');
  };

  const head = (title: string, onBack?: () => void) => (
    <div className="screen-head">
      <IconButton icon={onBack ? 'back' : 'close'} label={onBack ? t('common.back') : t('common.close')} onClick={onBack ?? (() => (fromWelcome ? nav('/welcome?step=book') : nav(-1)))} />
      <h1>{title}</h1>
      {count > 0 && <span className="count-pill">{t('add.addedCount', { count })}</span>}
    </div>
  );

  const fileInputs = (
    <>
      <input ref={frontInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFront(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={libInput} type="file" accept="image/*" hidden onChange={(e) => { onFront(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={backInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onBack(e.target.files?.[0]); e.target.value = ''; }} />
    </>
  );

  return (
    <div className="screen add">
      {fileInputs}
      <AnimatePresence mode="wait">
        <motion.div key={stage} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={spring} className="add-stage">
          {stage === 'start' && (
            <>
              {head(t('add.title'))}
              <button className="capture-target" onClick={() => frontInput.current?.click()}>
                <span className="capture-frame"><i /><i /><i /><i /></span>
                <Icon name="camera" size={34} sw={1.4} />
                <strong>{t('add.photoFront')}</strong>
                <span className="muted small">{t('add.photoFrontHint')}</span>
              </button>
              <label className="toggle-row">
                <span>
                  <strong>{t('add.continuous')}</strong>
                  <span className="muted small">{t('add.continuousHint')}</span>
                </span>
                <input type="checkbox" className="switch" checked={continuous} onChange={(e) => { sfx('tap'); setContinuous(e.target.checked); }} />
              </label>
              <div className="add-alt">
                <Button icon="upload" onClick={() => libInput.current?.click()}>{t('add.fromLibrary')}</Button>
                <Button icon="search" onClick={() => setStage('search')}>{t('add.searchOrType')}</Button>
              </div>
            </>
          )}

          {stage === 'front' && front && (
            <>
              {head(t('add.adjustFront'), reset)}
              <p className="muted small add-hint">{t('add.adjustHint')}</p>
              <CornerEditor src={front.url} width={front.raw.width} height={front.raw.height} corners={front.corners} onChange={(c) => setFront({ ...front, corners: c })} />
              <div className="add-actions">
                <Button variant="ghost" size="sm" onClick={() => setFront({ ...front, corners: defaultCorners(front.raw.width, front.raw.height, 0) })}>{t('add.wholePhoto')}</Button>
                <Button variant="primary" onClick={() => setStage('back')}>{t('common.next')}</Button>
              </div>
            </>
          )}

          {stage === 'back' && (
            <>
              {head(t('add.photoBack'), continuous ? reset : () => setStage('front'))}
              <button className="capture-target back" onClick={() => backInput.current?.click()}>
                <Icon name="barcode" size={40} sw={1.4} />
                <strong>{t('add.photoBack')}</strong>
                <span className="muted small">{t('add.photoBackHint')}</span>
              </button>
              <div className="add-actions">
                <Button variant="ghost" onClick={() => (continuous ? quickSave(front, null) : runAnalysis(front, null))}>{t('add.skipBack')}</Button>
              </div>
            </>
          )}

          {stage === 'backCorners' && back && (
            <>
              {head(t('add.adjustBack'), () => setStage('back'))}
              <p className="muted small add-hint">{t('add.adjustHint')}</p>
              <CornerEditor src={back.url} width={back.raw.width} height={back.raw.height} corners={back.corners} onChange={(c) => setBack({ ...back, corners: c })} />
              <div className="add-actions">
                <Button variant="ghost" size="sm" onClick={() => setBack({ ...back, corners: defaultCorners(back.raw.width, back.raw.height, 0) })}>{t('add.wholePhoto')}</Button>
                <Button variant="primary" onClick={() => runAnalysis(front, back)}>{t('add.analyze')}</Button>
              </div>
            </>
          )}

          {stage === 'working' && <Working step={step} preview={preview ?? front?.url} />}

          {stage === 'form' && (
            <>
              {head(t('add.check'), reset)}
              <FormCover processed={frontP} draft={draft} />
              {draft.needsLookup && <p className="note-warn"><Icon name="refresh" size={16} />{t('add.offlineSaved')}</p>}
              <BookForm key={formKey} book={draft} onChange={setForm} compact />
              <div className="add-save">
                <Button variant="primary" size="lg" icon="check" onClick={save} className="full">{t('add.save')}</Button>
              </div>
            </>
          )}

          {stage === 'search' && <SearchStage onBack={reset} onPick={fromSearch} onManual={() => { setDraft({ title: '', authors: [] }); setFormKey((k) => k + 1); setStage('form'); }} head={head} />}

          {stage === 'saved' && savedBook && (
            <div className="saved">
              <motion.div initial={{ scale: 0.8, rotate: -6, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
                <Icon name="check" size={40} sw={2} className="saved-check" />
              </motion.div>
              <h1>{t('add.savedTitle')}</h1>
              <p className="muted">{t('add.savedBody', { title: savedBook.title || t('common.untitled') })}</p>
              <div className="saved-actions">
                <Button variant="primary" size="lg" icon="camera" onClick={reset}>{t('add.addAnother')}</Button>
                <Button size="lg" onClick={() => nav(`/book/${savedBook.id}`)}>{t('add.openBook')}</Button>
                <Button variant="ghost" onClick={() => nav('/')}>{t('add.toShelf')}</Button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function FormCover({ processed, draft }: { processed: Processed | null; draft: Partial<Book> }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!processed) return;
    const u = URL.createObjectURL(processed.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [processed]);
  return (
    <div className="form-cover" style={{ background: draft.dominantColor ?? 'var(--surface-2)' }}>
      {url ? <img src={url} alt="" /> : <span>{draft.title}</span>}
    </div>
  );
}

const STEPS: Step[] = ['straighten', 'barcode', 'lookup', 'ocr'];

function Working({ step, preview }: { step: Step; preview?: string }) {
  const { t } = useTranslation();
  return (
    <div className="working">
      <div className="working-img">
        {preview && <img src={preview} alt="" />}
        <motion.i animate={{ y: ['0%', '100%', '0%'] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
      </div>
      <ul className="working-steps" aria-live="polite">
        {STEPS.map((s) => {
          const idx = STEPS.indexOf(s), cur = STEPS.indexOf(step === 'done' ? 'ocr' : step);
          const state = step === 'done' || idx < cur ? 'done' : idx === cur ? 'now' : 'todo';
          return (
            <li key={s} className={state}>
              {state === 'done' ? <Icon name="check" size={16} /> : <span className="dot" />}
              {t(`add.step.${s}`)}
            </li>
          );
        })}
      </ul>
      <p className="muted small">{t('add.workingHint')}</p>
    </div>
  );
}

function SearchStage({ onBack, onPick, onManual, head }: { onBack: () => void; onPick: (m: BookMeta) => void; onManual: () => void; head: (t: string, b?: () => void) => JSX.Element }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<BookMeta[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [net, setNet] = useState(true);
  const run = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try { setRes(await searchText(q)); setNet(true); } catch { setRes([]); setNet(false); }
    setBusy(false);
  };
  return (
    <>
      {head(t('add.searchOrType'), onBack)}
      <form className="search-row" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <input className="input" type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('add.searchPlaceholder')} aria-label={t('common.search')} />
        <Button variant="primary" icon="search" disabled={busy || !q.trim()} type="submit" aria-label={t('common.search')} />
      </form>
      {(!navigator.onLine || !net) && <p className="muted small" style={{ marginTop: 10 }}>{t('add.searchOffline')}</p>}
      {busy && <p className="muted small" style={{ marginTop: 14 }}>{t('common.loading')}…</p>}
      {res && !busy && (
        <div className="list" style={{ marginTop: 12 }}>
          {res.length === 0 && <p className="muted small">{t('add.noSearchResults')}</p>}
          {res.map((m, i) => (
            <button key={i} className="list-item" onClick={() => onPick(m)}>
              {m.thumbnail ? <img className="cover-thumb" src={m.thumbnail} alt="" /> : <span className="cover-thumb" />}
              <span className="book-line-text">
                <strong className="book-line-title">{m.title}</strong>
                <span className="muted small">{[m.authors.join(', '), m.year].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <Button className="full" style={{ marginTop: 18 }} icon="type" onClick={onManual}>{t('add.typeManually')}</Button>
    </>
  );
}
