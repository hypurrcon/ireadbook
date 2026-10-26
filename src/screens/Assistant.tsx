import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Book, PromptTemplate } from '../db/types';
import { uid, deletePrompt } from '../db/repo';
import { useBooks, useSeries, useSessions } from '../hooks/data';
import { Button, Field, IconButton, Sheet, spring, toast } from '../ui/kit';
import { Icon, type IconName } from '../ui/Icon';
import { Cover } from '../ui/Cover';
import { BUILTIN, VARIABLES, buildVars, isUnread, renderPrompt, type BuiltinTemplate, type Fmt } from '../domain/prompts';
import { pickRandom } from '../domain/random';
import { renderCollage } from '../share/cards';
import { shareBlob, downloadBlob } from '../share/actions';
import { openExternal } from '../native';
import { currentLang } from '../i18n';
import { displayTitle, startReading } from '../state/actions';
import { sfx, haptic } from '../audio/sound';

const ICONS: Record<BuiltinTemplate['id'], IconName> = { whatNext: 'shelf', finishPlan: 'calendar', quiz: 'check', summarizeNotes: 'note', similar: 'star', discuss: 'assistant' };
const MOODS = ['light', 'deep', 'fun', 'learn', 'short'] as const;

type Sel = { kind: 'builtin'; tpl: BuiltinTemplate } | { kind: 'custom'; tpl: PromptTemplate };

export default function Assistant() {
  const { t } = useTranslation();
  const custom = useLiveQuery(() => db.prompts.toArray(), []) ?? [];
  const [sel, setSel] = useState<Sel | null>(null);
  const [edit, setEdit] = useState<PromptTemplate | null>(null);
  const [spin, setSpin] = useState(false);

  if (sel) return <Composer sel={sel} onBack={() => setSel(null)} />;

  return (
    <div className="screen assistant">
      <div className="screen-head"><h1>{t('ai.title')}</h1></div>
      <p className="muted ai-lead">{t('ai.lead')}</p>

      <motion.button className="spin-card" whileTap={{ scale: 0.98 }} transition={spring} onClick={() => { sfx('tap'); setSpin(true); }}>
        <Icon name="dice" size={28} />
        <span>
          <strong>{t('ai.randomTitle')}</strong>
          <span className="muted small">{t('ai.randomBody')}</span>
        </span>
        <Icon name="forward" size={18} />
      </motion.button>

      <div className="tpl-list">
        {BUILTIN.map((tpl, i) => (
          <motion.button key={tpl.id} className="tpl" onClick={() => setSel({ kind: 'builtin', tpl })}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.03 }}>
            <span className="tpl-icon"><Icon name={ICONS[tpl.id]} /></span>
            <span className="tpl-text">
              <strong>{t(`ai.tpl.${tpl.id}.name`)}</strong>
              <span className="muted small">{t(`ai.tpl.${tpl.id}.desc`)}</span>
            </span>
          </motion.button>
        ))}
      </div>

      <section className="section">
        <div className="section-head">
          <h2>{t('ai.mine')}</h2>
          <Button size="sm" icon="plus" onClick={() => setEdit({ id: '', name: '', body: '', builtIn: false, updatedAt: 0 })}>{t('ai.newTemplate')}</Button>
        </div>
        {custom.length === 0 ? <p className="muted small">{t('ai.mineEmpty')}</p> : (
          <div className="list">
            {custom.map((c) => (
              <div key={c.id} className="list-item">
                <button className="book-line-text" onClick={() => setSel({ kind: 'custom', tpl: c })} style={{ textAlign: 'left' }}>
                  <strong className="book-line-title">{c.name}</strong>
                  <span className="muted small">{c.body.slice(0, 80)}</span>
                </button>
                <IconButton icon="edit" label={t('common.edit')} onClick={() => setEdit(c)} />
              </div>
            ))}
          </div>
        )}
      </section>

      <TemplateEditor tpl={edit} onClose={() => setEdit(null)} />
      <SpinSheet open={spin} onClose={() => setSpin(false)} />
    </div>
  );
}

function useFmt(): Fmt {
  const { t } = useTranslation();
  const series = useSeries() ?? [];
  return useMemo(() => ({
    genre: (g: string) => t(`genre.${g}`),
    series: (id: string) => series.find((s) => s.id === id)?.name ?? '',
    untitled: t('common.untitled'),
    page: (n: number) => t('common.pages', { count: n }),
    vol: (n: number, s: string) => (s ? t('book.seriesOf', { index: n, name: s }) : t('ai.volume', { n })),
  }), [t, series]);
}

function Composer({ sel, onBack }: { sel: Sel; onBack: () => void }) {
  const { t } = useTranslation();
  const lang = currentLang();
  const books = useBooks() ?? [];
  const sessions = useSessions() ?? [];
  const quotes = useLiveQuery(() => db.quotes.toArray(), []) ?? [];
  const fmt = useFmt();
  const needs = sel.kind === 'builtin' ? sel.tpl.needs : inferNeeds(sel.tpl.body);
  const body = sel.kind === 'builtin' ? sel.tpl.body[lang] : sel.tpl.body;
  const reading = books.filter(isUnread).sort((a, b) => (a.status === 'reading' ? -1 : 0) - (b.status === 'reading' ? -1 : 0) || b.updatedAt - a.updatedAt);
  const [bookId, setBookId] = useState<string>('');
  const [mood, setMood] = useState<string>('');
  const [deadline, setDeadline] = useState(() => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const book = books.find((b) => b.id === bookId) ?? reading[0] ?? books[0];
  const title = sel.kind === 'builtin' ? t(`ai.tpl.${sel.tpl.id}.name`) : sel.tpl.name;

  const generated = useMemo(() => {
    const vars = buildVars({ books, sessions, quotes, lang, fmt, book, mood: mood ? t(`ai.mood.${mood}`) : '', deadline: deadline ? new Date(deadline).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '' });
    return renderPrompt(body, vars);
  }, [books, sessions, quotes, lang, fmt, book, mood, deadline, body]);
  useEffect(() => { if (!touched) setText(generated); }, [generated, touched]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast(t('common.copied'), 'ok'); sfx('reward'); }
    catch { toast(t('ai.copyFail'), 'error'); }
  };
  const collage = async (mode: 'share' | 'save') => {
    const blob = await renderCollage(books.filter(isUnread), t('common.untitled'));
    if (mode === 'share') await shareBlob(blob, 'ireadbook-books.png', t); else downloadBlob(blob, 'ireadbook-books.png');
  };
  const open = (url: string) => { copy(); openExternal(url + encodeURIComponent(text.slice(0, 6000))); };

  return (
    <div className="screen composer">
      <div className="screen-head">
        <IconButton icon="back" label={t('common.back')} onClick={onBack} />
        <h1>{title}</h1>
      </div>
      {needs.includes('book') && (
        <Field label={t('read.book')}>
          <select value={book?.id ?? ''} onChange={(e) => { setBookId(e.target.value); setTouched(false); }}>
            {(reading.length ? reading : books).map((b) => <option key={b.id} value={b.id}>{displayTitle(b, t)}</option>)}
          </select>
        </Field>
      )}
      {needs.includes('deadline') && (
        <Field label={t('ai.deadline')}><input type="date" value={deadline} onChange={(e) => { setDeadline(e.target.value); setTouched(false); }} /></Field>
      )}
      {needs.includes('mood') && (
        <Field label={t('ai.moodLabel')} group>
          <div className="chips">
            {MOODS.map((m) => <button key={m} className={`chip ${mood === m ? 'on' : ''}`} onClick={() => { sfx('tap'); setMood(mood === m ? '' : m); setTouched(false); }}>{t(`ai.mood.${m}`)}</button>)}
          </div>
        </Field>
      )}
      <Field label={t('ai.preview')} hint={touched ? t('ai.edited') : t('ai.editable')}>
        <textarea className="prompt-box" value={text} onChange={(e) => { setText(e.target.value); setTouched(true); }} rows={14} />
      </Field>
      {touched && <button className="link" onClick={() => setTouched(false)}>{t('ai.reset')}</button>}

      <div className="composer-actions">
        <Button variant="primary" size="lg" icon="copy" onClick={copy}>{t('ai.copy')}</Button>
        {needs.includes('collage') && (
          <div className="collage-row">
            <p className="muted small">{t('ai.collageHint')}</p>
            <div className="row">
              <Button icon="download" onClick={() => collage('save')}>{t('common.saveImage')}</Button>
              <Button icon="share" onClick={() => collage('share')}>{t('common.share')}</Button>
            </div>
          </div>
        )}
        <p className="muted small" style={{ marginTop: 6 }}>{t('ai.openHint')}</p>
        <div className="row">
          <Button onClick={() => open('https://chatgpt.com/?q=')}>ChatGPT</Button>
          <Button onClick={() => open('https://claude.ai/new?q=')}>Claude</Button>
        </div>
      </div>
    </div>
  );
}

function inferNeeds(body: string): BuiltinTemplate['needs'] {
  const n: BuiltinTemplate['needs'] = [];
  if (/\{(currentBook|pageNow|pagesLeft|notes|speed)\}/.test(body)) n.push('book');
  if (body.includes('{mood}')) n.push('mood');
  if (body.includes('{deadline}')) n.push('deadline');
  if (body.includes('{unreadBooks}')) n.push('collage');
  return n;
}

function TemplateEditor({ tpl, onClose }: { tpl: PromptTemplate | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (tpl) { setName(tpl.name); setBody(tpl.body); } }, [tpl]);
  const insert = (v: string) => {
    const el = ref.current;
    const tok = `{${v}}`;
    if (!el) { setBody(body + tok); return; }
    const s = el.selectionStart ?? body.length, e = el.selectionEnd ?? body.length;
    const next = body.slice(0, s) + tok + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + tok.length, s + tok.length); });
  };
  const save = async () => {
    await db.prompts.put({ id: tpl?.id || uid(), name: name.trim(), body, builtIn: false, updatedAt: Date.now() });
    toast(t('book.saved'), 'ok');
    onClose();
  };
  return (
    <Sheet open={!!tpl} onClose={onClose} title={tpl?.id ? t('ai.editTemplate') : t('ai.newTemplate')} tall>
      <Field label={t('ai.tplName')}><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('ai.tplNamePlaceholder')} /></Field>
      <Field label={t('ai.tplBody')} hint={t('ai.tplBodyHint')}>
        <textarea ref={ref} rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('ai.tplBodyPlaceholder')} />
      </Field>
      <div className="chips var-chips">
        {VARIABLES.map((v) => <button key={v} className="chip" onClick={() => insert(v)} title={t(`ai.var.${v}`)}>{t(`ai.var.${v}`)}</button>)}
      </div>
      <div className="sheet-actions">
        {tpl?.id ? <Button variant="danger" icon="trash" onClick={async () => { await deletePrompt(tpl.id); onClose(); }}>{t('common.delete')}</Button> : <Button onClick={onClose}>{t('common.cancel')}</Button>}
        <Button variant="primary" disabled={!name.trim() || !body.trim()} onClick={save}>{t('common.save')}</Button>
      </div>
    </Sheet>
  );
}

/** Slot-machine style random pick over unread books. */
function SpinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const books = (useBooks() ?? []).filter(isUnread);
  const [shown, setShown] = useState<Book | null>(null);
  const [rolling, setRolling] = useState(false);
  const roll = () => {
    if (!books.length) return;
    setRolling(true);
    const final = pickRandom(books)!;
    let i = 0;
    const steps = 14;
    const tick = () => {
      i++;
      if (i < steps) {
        setShown(books[Math.floor(Math.random() * books.length)]);
        sfx('tick'); haptic(4);
        setTimeout(tick, 40 + i * i * 2.2);
      } else {
        setShown(final); setRolling(false); sfx('bookOut'); haptic([20, 40, 30]);
      }
    };
    tick();
  };
  useEffect(() => { if (open) { setShown(null); roll(); } }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title={t('ai.randomTitle')}>
      {books.length === 0 ? <p className="muted">{t('ai.randomEmpty')}</p> : (
        <div className="spin">
          <AnimatePresence mode="popLayout">
            {shown && (
              <motion.div key={shown.id + (rolling ? Math.random() : '')} className="spin-cover"
                initial={{ y: -40, opacity: 0, rotate: -4 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: rolling ? 0.08 : 0.35 }}>
                <Cover book={shown} width={130} />
              </motion.div>
            )}
          </AnimatePresence>
          <h3 className="spin-title">{shown && !rolling ? displayTitle(shown, t) : ' '}</h3>
          {shown && !rolling && shown.whyRead && <p className="muted small">“{shown.whyRead}”</p>}
          <div className="sheet-actions" style={{ width: '100%' }}>
            <Button icon="dice" disabled={rolling} onClick={roll}>{t('ai.again')}</Button>
            <Button variant="primary" icon="play" disabled={rolling || !shown} onClick={() => shown && startReading(shown, '5min', nav, 5)}>{t('read.just5')}</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
