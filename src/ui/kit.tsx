import { type ButtonHTMLAttributes, type ReactNode, useEffect } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { create } from 'zustand';
import { Icon, type IconName } from './Icon';
import { sfx, haptic } from '../audio/sound';

export const spring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 } as const;
export const softSpring = { type: 'spring', stiffness: 260, damping: 30 } as const;

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'ghost' | 'danger'; icon?: IconName; size?: 'sm' | 'md' | 'lg'; silent?: boolean };

export function Button({ variant = 'quiet', icon, size = 'md', children, className = '', onClick, silent, ...rest }: BtnProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={spring}
      className={`btn btn-${variant} btn-${size} ${className}`}
      onClick={(e) => { if (!silent) { sfx('tap'); haptic(6); } onClick?.(e); }}
      {...(rest as any)}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 22 : 18} />}
      {children && <span>{children}</span>}
    </motion.button>
  );
}

export function IconButton({ icon, label, onClick, className = '', ...rest }: { icon: IconName; label: string; onClick?: () => void; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <motion.button whileTap={{ scale: 0.9 }} transition={spring} className={`icon-btn ${className}`} aria-label={label} title={label}
      onClick={() => { sfx('tap'); haptic(6); onClick?.(); }} {...(rest as any)}>
      <Icon name={icon} />
    </motion.button>
  );
}

export function Sheet({ open, onClose, children, title, tall }: { open: boolean; onClose: () => void; children: ReactNode; title?: string; tall?: boolean }) {
  useEffect(() => { if (open) sfx('open'); }, [open]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  const onDragEnd = (_: unknown, info: PanInfo) => { if (info.offset.y > 120 || info.velocity.y > 600) { sfx('close'); onClose(); } };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="sheet-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { sfx('close'); onClose(); }} />
          <motion.div className={`sheet ${tall ? 'sheet-tall' : ''}`} role="dialog" aria-modal="true" aria-label={title}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} onDragEnd={onDragEnd}>
            <div className="sheet-grip" />
            {title && <h2 className="sheet-title">{title}</h2>}
            <div className="sheet-body" onPointerDownCapture={(e) => e.stopPropagation()}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Labelled form row. Use `group` when the content is buttons/chips rather than one input,
 *  so tapping the label text does not activate the first button. */
export function Field({ label, children, hint, group }: { label: string; children: ReactNode; hint?: string; group?: boolean }) {
  if (group) {
    return (
      <div className="field" role="group" aria-label={label}>
        <span className="field-label">{label}</span>
        {children}
        {hint && <span className="field-hint">{hint}</span>}
      </div>
    );
  }
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''}
          onClick={() => { sfx('tap'); onChange(o.value); }}>
          {value === o.value && <motion.span layoutId={`seg-${label}`} className="seg-pill" transition={spring} />}
          <span className="seg-text">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---- toasts ----
interface Toast { id: number; text: string; tone?: 'ok' | 'reward' | 'error' }
export const useToasts = create<{ list: Toast[]; push: (t: Omit<Toast, 'id'>) => void; drop: (id: number) => void }>((set, get) => ({
  list: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set({ list: [...get().list, { ...t, id }].slice(-3) });
    if (t.tone === 'reward') sfx('reward');
    if (t.tone === 'error') sfx('error');
    setTimeout(() => get().drop(id), t.tone === 'reward' ? 4200 : 2800);
  },
  drop: (id) => set({ list: get().list.filter((x) => x.id !== id) }),
}));
export const toast = (text: string, tone?: Toast['tone']) => useToasts.getState().push({ text, tone });

export function Toasts() {
  const list = useToasts((s) => s.list);
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {list.map((t) => (
          <motion.div key={t.id} className={`toast toast-${t.tone ?? 'plain'}`} initial={{ y: -30, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -20, opacity: 0 }} transition={spring}>
            {t.tone === 'reward' && <Icon name="star" size={18} />}
            <span>{t.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}
