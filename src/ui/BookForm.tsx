import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Book, Format, Genre, ProgressUnit } from '../db/types';
import { GENRES } from '../db/types';
import { Button, Field, Segmented } from './kit';
import { lookupIsbn, searchText } from '../lookup/books';
import { normalizeIsbn } from '../domain/isbn';
import { sfx } from '../audio/sound';

export interface BookFormValue {
  patch: Partial<Book>;
  series: { name: string; index?: number; total?: number };
}

const FORMATS: Format[] = ['paperback', 'hardcover', 'ebook', 'audiobook'];
const list = (s: string) => s.split(/[,،、]/).map((x) => x.trim()).filter(Boolean);
const num = (s: string) => { const n = parseInt(s, 10); return Number.isFinite(n) && n > 0 ? n : undefined; };

/** Editable book fields. Calls onChange with a full patch on every edit. */
export function BookForm({ book, seriesName = '', seriesTotal, onChange, compact }: {
  book: Partial<Book>; seriesName?: string; seriesTotal?: number; onChange: (v: BookFormValue) => void; compact?: boolean;
}) {
  const { t } = useTranslation();
  const [f, setF] = useState({
    title: book.title ?? '', originalTitle: book.originalTitle ?? '', subtitle: book.subtitle ?? '',
    authors: (book.authors ?? []).join(', '), translators: (book.translators ?? []).join(', '),
    publisher: book.publisher ?? '', isbn: book.isbn ?? '', year: book.year ? String(book.year) : '',
    pageCount: book.pageCount ? String(book.pageCount) : '', format: book.format ?? 'paperback' as Format,
    genre: (book.genre ?? 'other') as Genre, tags: (book.tags ?? []).join(', '),
    seriesName, seriesIndex: book.seriesIndex ? String(book.seriesIndex) : '', seriesTotal: seriesTotal ? String(seriesTotal) : '',
    whyRead: book.whyRead ?? '', recommendedBy: book.recommendedBy ?? '', progressUnit: book.progressUnit ?? 'page' as ProgressUnit,
    description: book.description ?? '',
  });
  const [more, setMore] = useState(!compact);

  const [auto, setAuto] = useState<'idle' | 'busy' | 'done' | 'none' | 'offline'>('idle');

  const upd = (k: keyof typeof f, v: string) => emit({ ...f, [k]: v });
  const emit = (n: typeof f) => {
    setF(n);
    onChange({
      patch: {
        title: n.title.trim(), originalTitle: n.originalTitle.trim() || undefined, subtitle: n.subtitle.trim() || undefined,
        authors: list(n.authors), translators: list(n.translators), publisher: n.publisher.trim() || undefined,
        isbn: n.isbn.replace(/[^0-9Xx]/g, '') || undefined, year: num(n.year), pageCount: num(n.pageCount),
        format: n.format, genre: n.genre, tags: list(n.tags), whyRead: n.whyRead.trim() || undefined,
        recommendedBy: n.recommendedBy.trim() || undefined, progressUnit: n.progressUnit, description: n.description.trim() || undefined,
      },
      series: { name: n.seriesName.trim(), index: num(n.seriesIndex), total: num(n.seriesTotal) },
    });
  };
  /** Fill every field from the ISBN (or, without one, the best title match), overwriting what is there. */
  const runAuto = async () => {
    setAuto('busy');
    try {
      const isbn = f.isbn.replace(/[^0-9Xx]/g, '');
      const norm = isbn ? normalizeIsbn(isbn) : null;
      let m = norm ? await lookupIsbn(norm) : null;
      if (!m && f.title.trim()) m = (await searchText([f.title, f.authors.split(',')[0]].filter(Boolean).join(' ')))[0] ?? null;
      if (!m) { setAuto('none'); return; }
      emit({
        ...f,
        title: m.title || f.title, subtitle: m.subtitle ?? f.subtitle, authors: m.authors.length ? m.authors.join(', ') : f.authors,
        publisher: m.publisher ?? f.publisher, isbn: m.isbn ?? norm ?? f.isbn, year: m.year ? String(m.year) : f.year,
        pageCount: m.pageCount ? String(m.pageCount) : f.pageCount, genre: (m.genre ?? f.genre) as Genre, description: m.description ?? f.description,
      });
      setAuto('done');
      sfx('reward');
    } catch {
      setAuto('offline');
    }
  };

  const inp = (k: keyof typeof f, opts: { numeric?: boolean; placeholder?: string } = {}) => (
    <input value={f[k]} inputMode={opts.numeric ? 'numeric' : undefined} placeholder={opts.placeholder}
      onChange={(e) => upd(k, opts.numeric ? e.target.value.replace(/\D/g, '') : e.target.value)} />
  );

  return (
    <div className="book-form">
      <div className="auto-row">
        <Button icon="refresh" size="sm" disabled={auto === 'busy'} onClick={runAuto}>{auto === 'busy' ? t('common.loading') : t('book.auto')}</Button>
        <span className={`auto-note ${auto}`}>{t(`book.autoState.${auto}`)}</span>
      </div>
      <Field label={t('book.fields.title')}>{inp('title')}</Field>
      <Field label={t('book.fields.authors')} hint={t('book.commaHint')}>{inp('authors')}</Field>
      <div className="row">
        <Field label={t('book.fields.pageCount')}>{inp('pageCount', { numeric: true })}</Field>
        <Field label={t('book.fields.genre')}>
          <select value={f.genre} onChange={(e) => upd('genre', e.target.value)}>
            {GENRES.map((g) => <option key={g} value={g}>{t(`genre.${g}`)}</option>)}
          </select>
        </Field>
      </div>
      <Field label={t('book.fields.whyRead')}>
        <textarea value={f.whyRead} rows={2} onChange={(e) => upd('whyRead', e.target.value)} placeholder={t('book.whyReadPlaceholder')} />
      </Field>
      {!more && <button type="button" className="form-more" onClick={() => setMore(true)}>{t('book.moreFields')}</button>}
      {more && (
        <>
          <Field label={t('book.fields.originalTitle')}>{inp('originalTitle')}</Field>
          <Field label={t('book.fields.translators')} hint={t('book.commaHint')}>{inp('translators')}</Field>
          <div className="row">
            <Field label={t('book.fields.seriesName')}>{inp('seriesName')}</Field>
            <Field label={t('book.fields.seriesIndex')}>{inp('seriesIndex', { numeric: true })}</Field>
          </div>
          <Field label={t('book.fields.seriesTotal')}>{inp('seriesTotal', { numeric: true })}</Field>
          <div className="row">
            <Field label={t('book.fields.publisher')}>{inp('publisher')}</Field>
            <Field label={t('book.fields.year')}>{inp('year', { numeric: true })}</Field>
          </div>
          <Field label={t('book.fields.isbn')}>{inp('isbn')}</Field>
          <Field label={t('book.fields.format')}>
            <select value={f.format} onChange={(e) => upd('format', e.target.value)}>
              {FORMATS.map((x) => <option key={x} value={x}>{t(`format.${x}`)}</option>)}
            </select>
          </Field>
          <Field label={t('book.fields.progressUnit')} group>
            <Segmented label="unit" value={f.progressUnit} onChange={(v) => upd('progressUnit', v)}
              options={[{ value: 'page', label: t('book.unitPage') }, { value: 'percent', label: t('book.unitPercent') }]} />
          </Field>
          <Field label={t('book.fields.tags')} hint={t('book.commaHint')}>{inp('tags')}</Field>
          <Field label={t('book.fields.recommendedBy')}>{inp('recommendedBy')}</Field>
          <Field label={t('book.fields.subtitle')}>{inp('subtitle')}</Field>
          <Field label={t('book.fields.description')}>
            <textarea value={f.description} rows={4} onChange={(e) => upd('description', e.target.value)} />
          </Field>
        </>
      )}
    </div>
  );
}
