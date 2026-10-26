import type { Book, Quote, Session } from '../db/types';
import { pagesPerMinute } from './speed';

export type Lang = 'th' | 'en';
export interface BuiltinTemplate {
  id: 'whatNext' | 'finishPlan' | 'quiz' | 'summarizeNotes' | 'similar' | 'discuss';
  needs: ('book' | 'mood' | 'deadline' | 'collage')[];
  body: Record<Lang, string>;
}

export const VARIABLES = ['unreadBooks', 'readBooks', 'favoriteGenres', 'minutesPerDay', 'mood', 'currentBook', 'pageNow', 'pagesLeft', 'speed', 'deadline', 'notes', 'ownedBooks'] as const;
export type VarName = typeof VARIABLES[number];

export const BUILTIN: BuiltinTemplate[] = [
  {
    id: 'whatNext', needs: ['mood', 'collage'],
    body: {
      th: `ช่วยฉันเลือกว่าควรอ่านหนังสือเล่มไหนก่อน จากหนังสือที่ฉันมีแต่ยังไม่ได้อ่าน (ถ้าแนบรูปปกมาด้วย หมายเลขในรูปตรงกับรายการด้านล่าง)

หนังสือที่ยังไม่ได้อ่าน:
{unreadBooks}

เกี่ยวกับฉัน:
- เล่มที่อ่านจบแล้วและคะแนนที่ให้: {readBooks}
- แนวที่อ่านบ่อย: {favoriteGenres}
- ช่วงนี้อ่านได้ประมาณ {minutesPerDay} นาทีต่อวัน
- อารมณ์ตอนนี้: {mood}

สิ่งที่อยากให้ช่วย:
1. ค้นรีวิวและความเห็นของผู้อ่านของแต่ละเล่ม (ถ้าค้นเว็บได้) แล้วประเมินคุณภาพของหนังสือ
2. เรียง 3–5 เล่มที่ควรอ่านก่อน พร้อมเหตุผลสั้นๆ ของแต่ละเล่ม: คุณภาพและรีวิว, ความเหมาะกับรสนิยมและอารมณ์ตอนนี้, ความยาวเทียบกับเวลาที่มี
3. ถ้ามีซีรีส์ ให้แนะนำตามลำดับเล่ม
4. บอกด้วยว่าเล่มไหนอ่านง่ายที่สุด เหมาะกับการกลับมาเริ่มอ่านใหม่
ตอบเป็นภาษาไทย กระชับ`,
      en: `Help me choose which book to read next from the books I own but haven't read yet. (If a cover image is attached, its numbers match the list below.)

Unread books:
{unreadBooks}

About me:
- Books I've finished and my ratings: {readBooks}
- Genres I read most: {favoriteGenres}
- Lately I read about {minutesPerDay} minutes a day
- My mood right now: {mood}

Please:
1. Look up reviews and reader opinions for each book (if you can search the web) and judge its quality
2. Rank the 3–5 books I should read first, with a short reason for each: quality and reviews, fit with my taste and current mood, length versus the time I have
3. Keep series in volume order
4. Point out which one is the easiest way back into reading
Keep it concise.`,
    },
  },
  {
    id: 'finishPlan', needs: ['book', 'deadline'],
    body: {
      th: `ช่วยวางแผนให้ฉันอ่าน {currentBook} ให้จบภายในวันที่ {deadline}
- ตอนนี้อยู่หน้า {pageNow} เหลืออีก {pagesLeft}
- ความเร็วในการอ่านของฉันประมาณ {speed}
- ปกติอ่านได้ประมาณ {minutesPerDay} นาทีต่อวัน
ช่วยแบ่งเป็นแผนรายวัน (กี่หน้า หรือกี่นาที) ที่ทำได้จริง เผื่อวันที่ไม่ได้อ่านไว้ด้วย บอกว่าต้องอ่านมากกว่าปกติแค่ไหน และถ้าไม่ทันจริงๆ ให้เสนอวันจบที่เป็นไปได้ ตอบเป็นภาษาไทย`,
      en: `Help me plan to finish {currentBook} by {deadline}.
- I'm on page {pageNow}, with {pagesLeft} left
- My reading speed is about {speed}
- I usually read about {minutesPerDay} minutes a day
Make a realistic day-by-day plan (pages or minutes), leave room for days I miss, tell me how much more than usual I need to read, and if it really can't be done, suggest a realistic finish date.`,
    },
  },
  {
    id: 'quiz', needs: ['book'],
    body: {
      th: `ฉันกำลังอ่าน {currentBook} ถึงหน้า {pageNow}
ช่วยตั้งคำถาม 5 ข้อเพื่อทดสอบความเข้าใจเนื้อหาที่อ่านมาถึงตอนนี้ ห้ามสปอยล์เนื้อหาหลังหน้านี้ ถามทีละข้อ รอฉันตอบก่อนแล้วค่อยเฉลยพร้อมอธิบาย ถ้าไม่แน่ใจว่าเนื้อหาส่วนไหนอยู่ก่อนหรือหลังหน้านี้ ให้ถามแบบกว้างๆ แทน
โน้ตที่ฉันจดไว้: {notes}
ตอบเป็นภาษาไทย`,
      en: `I'm reading {currentBook} and I'm on page {pageNow}.
Ask me 5 questions to check my understanding of what I've read so far. No spoilers past this page. Ask one at a time, wait for my answer, then give the answer with a short explanation. If you're not sure whether something comes before or after this page, keep the question general.
My notes so far: {notes}`,
    },
  },
  {
    id: 'summarizeNotes', needs: ['book'],
    body: {
      th: `นี่คือโน้ตและคำคมที่ฉันจดไว้ระหว่างอ่าน {currentBook}
{notes}

ช่วย:
1. สรุปใจความสำคัญจากโน้ตเหล่านี้
2. เชื่อมโยงความคิดที่เกี่ยวข้องกัน
3. เสนอ 3 อย่างที่เอาไปใช้ในชีวิตจริงได้
4. ตั้งคำถามชวนคิดต่อ 2 ข้อ
ตอบเป็นภาษาไทย`,
      en: `These are the notes and quotes I saved while reading {currentBook}:
{notes}

Please:
1. Summarise the key ideas in them
2. Connect related ideas
3. Suggest 3 things I could apply in real life
4. Ask me 2 questions to think about further`,
    },
  },
  {
    id: 'similar', needs: [],
    body: {
      th: `จากหนังสือที่ฉันอ่านจบแล้วและคะแนนที่ให้:
{readBooks}
แนวที่อ่านบ่อย: {favoriteGenres}

ช่วยแนะนำหนังสือ 5 เล่มที่น่าอ่านต่อ (ถ้ามีฉบับภาษาไทยจะดีมาก) บอกเหตุผลว่าทำไมเหมาะกับฉัน และไม่ต้องแนะนำเล่มที่ฉันมีอยู่แล้ว:
{ownedBooks}
ตอบเป็นภาษาไทย`,
      en: `Based on the books I've finished and my ratings:
{readBooks}
Genres I read most: {favoriteGenres}

Recommend 5 books I should read next and tell me why each one suits me. Don't recommend books I already own:
{ownedBooks}`,
    },
  },
  {
    id: 'discuss', needs: ['book'],
    body: {
      th: `อยากคุยเรื่องหนังสือ {currentBook} ตอนนี้ฉันอ่านถึงหน้า {pageNow} ห้ามสปอยล์เนื้อหาหลังจากนี้
คุยกับฉันเหมือนเพื่อนที่อ่านเล่มเดียวกัน ถามความเห็นของฉันเกี่ยวกับตัวละครหรือประเด็นในเรื่อง และเล่าบริบทเบื้องหลังที่น่าสนใจได้ เช่น ผู้เขียน หรือยุคสมัย
โน้ตของฉัน: {notes}
ตอบเป็นภาษาไทย`,
      en: `I'd like to talk about {currentBook}. I'm on page {pageNow}, so no spoilers past this point.
Chat with me like a friend reading the same book: ask what I think about the characters or ideas, and share interesting background such as the author or the period.
My notes: {notes}`,
    },
  },
];

export function renderPrompt(body: string, vars: Partial<Record<string, string>>): string {
  return body.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k]! : m));
}

export interface Fmt { genre: (g: string) => string; series: (id: string) => string; untitled: string; page: (n: number) => string; vol: (n: number, series: string) => string }

const bookLabel = (b: Book, f: Fmt) => [b.title || f.untitled, b.originalTitle && b.originalTitle !== b.title ? `(${b.originalTitle})` : ''].filter(Boolean).join(' ');

/** Numbered list of unread books; numbering matches the cover collage. */
export function unreadList(books: Book[], f: Fmt): string {
  return books.map((b, i) => {
    const parts = [bookLabel(b, f) + (b.authors.length ? ` — ${b.authors.join(', ')}` : '')];
    if (b.isbn) parts.push(`ISBN ${b.isbn}`);
    if (b.genre) parts.push(f.genre(b.genre));
    if (b.pageCount) parts.push(f.page(b.pageCount));
    if (b.seriesIndex) parts.push(f.vol(b.seriesIndex, f.series(b.seriesId ?? '')));
    if (b.whyRead) parts.push(`“${b.whyRead}”`);
    return `${i + 1}. ${parts.join(' | ')}`;
  }).join('\n');
}

export const isUnread = (b: Book) => b.status === 'want' || b.status === 'reading' || b.status === 'paused';

export function buildVars(o: { books: Book[]; sessions: Session[]; quotes: Quote[]; lang: Lang; fmt: Fmt; book?: Book; mood?: string; deadline?: string; now?: number }): Record<VarName, string> {
  const { books, sessions, fmt, book } = o;
  const none = o.lang === 'th' ? '(ไม่มี)' : '(none)';
  const now = o.now ?? Date.now();
  const unread = books.filter(isUnread);
  const read = books.filter((b) => b.status === 'finished');
  const genreMin = new Map<string, number>();
  for (const s of sessions) {
    const g = books.find((b) => b.id === s.bookId)?.genre;
    if (g) genreMin.set(g, (genreMin.get(g) ?? 0) + s.durationSec / 60);
  }
  const recent = sessions.filter((s) => s.startedAt > now - 14 * 86400000).reduce((a, s) => a + s.durationSec / 60, 0);
  const ppm = book ? pagesPerMinute(sessions, book.id) ?? pagesPerMinute(sessions) : pagesPerMinute(sessions);
  const notes = book ? [
    ...sessions.filter((s) => s.bookId === book.id && s.note).map((s) => `- ${s.note}${s.endPage ? ` (${fmt.page(s.endPage)})` : ''}`),
    ...o.quotes.filter((q) => q.bookId === book.id).map((q) => `- “${q.text}”${q.page ? ` (${fmt.page(q.page)})` : ''}`),
  ].join('\n') : '';
  const total = book ? (book.progressUnit === 'percent' ? 100 : book.pageCount) : undefined;
  return {
    unreadBooks: unread.length ? unreadList(unread, fmt) : none,
    readBooks: read.length ? read.map((b) => `${bookLabel(b, fmt)}${b.rating ? ` ${b.rating}/5` : ''}${b.review ? ` — ${b.review}` : ''}`).join('; ') : none,
    favoriteGenres: [...genreMin.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => fmt.genre(g)).join(', ') || none,
    minutesPerDay: String(Math.max(5, Math.round(recent / 14))),
    mood: o.mood || none,
    currentBook: book ? `"${bookLabel(book, fmt)}"${book.authors.length ? ` (${book.authors.join(', ')})` : ''}` : none,
    pageNow: book ? (book.progressUnit === 'percent' ? `${book.currentPage}%` : String(book.currentPage)) : none,
    pagesLeft: book && total ? (book.progressUnit === 'percent' ? `${100 - book.currentPage}%` : fmt.page(Math.max(0, total - book.currentPage))) : none,
    speed: ppm ? (o.lang === 'th' ? `${Math.round(ppm * 60)} หน้าต่อชั่วโมง` : `${Math.round(ppm * 60)} pages per hour`) : (o.lang === 'th' ? 'ยังไม่ทราบ' : 'unknown'),
    deadline: o.deadline || none,
    notes: notes || none,
    ownedBooks: books.map((b) => bookLabel(b, fmt)).join('; ') || none,
  };
}
