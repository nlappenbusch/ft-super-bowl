'use client';

/**
 * Admin Design-System
 * ─────────────────────────────────────────────────────────────────────────────
 * Wiederverwendbare, markenkonforme UI-Primitives für den gesamten Adminbereich.
 * Markenfarben: Navy #143047, Akzent #d9531e.
 *
 * Wichtig: Inputs setzen IMMER eine dunkle Textfarbe (verhindert "grau auf grau").
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React from 'react';

export const COLORS = {
  navy: '#143047',
  accent: '#d9531e',
  stroke: '#e5e8ed',
  surface: '#ffffff',
  surfaceMuted: '#f5f7fa',
  text: '#143047',
  textMuted: '#6b7280',
  ok: '#16a34a',
  warn: '#d97706',
  danger: '#dc2626',
  info: '#1a6fa8',
} as const;

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ─── Card ────────────────────────────────────────────────────────────────── */

export function Card({
  children,
  className,
  padded = true,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn('rounded-2xl bg-white', padded && 'p-6', className)}
      style={{ border: `1px solid ${COLORS.stroke}`, boxShadow: '0 1px 3px rgba(20,48,71,0.06)' }}
    >
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  icon,
  actions,
  children,
  className,
  id,
}: {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <Card className={className} id={id}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3">
            {icon && (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: COLORS.surfaceMuted, color: COLORS.navy }}
              >
                {icon}
              </div>
            )}
            <div>
              {title && <h2 className="text-base font-bold" style={{ color: COLORS.navy }}>{title}</h2>}
              {description && <p className="mt-0.5 text-sm" style={{ color: COLORS.textMuted }}>{description}</p>}
            </div>
          </div>
          {actions}
        </div>
      )}
      {children}
    </Card>
  );
}

/* ─── Page header ─────────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: COLORS.navy }}>{title}</h1>
        {description && <p className="mt-1 text-sm" style={{ color: COLORS.textMuted }}>{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ─── Button ──────────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type ButtonSize = 'sm' | 'md';

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none';

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const variantStyle: Record<ButtonVariant, React.CSSProperties> = {
    primary: { background: COLORS.navy, color: '#fff' },
    accent: { background: COLORS.accent, color: '#fff', boxShadow: '0 4px 12px rgba(217,83,30,0.22)' },
    secondary: { background: '#fff', color: COLORS.navy, border: `1.5px solid ${COLORS.stroke}` },
    ghost: { background: 'transparent', color: COLORS.textMuted },
    danger: { background: '#fff', color: COLORS.danger, border: `1.5px solid #fecaca` },
  };
  return (
    <button
      className={cn(BTN_BASE, BTN_SIZE[size], 'hover:opacity-90', className)}
      style={{ ...variantStyle[variant], ...style }}
      {...props}
    >
      {children}
    </button>
  );
}

/* ─── Form fields ─────────────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>
          {label} {required && <span style={{ color: COLORS.accent }}>*</span>}
        </label>
      )}
      {children}
      {hint && <p className="mt-1 text-xs" style={{ color: '#9ca3af' }}>{hint}</p>}
    </div>
  );
}

const INPUT_CLS =
  'w-full rounded-xl border px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 transition';
const INPUT_STYLE: React.CSSProperties = { borderColor: COLORS.stroke };

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, style, ...rest } = props;
  return <input className={cn(INPUT_CLS, className)} style={{ ...INPUT_STYLE, ...style }} {...rest} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, style, ...rest } = props;
  return <textarea className={cn(INPUT_CLS, 'resize-none', className)} style={{ ...INPUT_STYLE, ...style }} {...rest} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, style, children, ...rest } = props;
  return (
    <select className={cn(INPUT_CLS, 'bg-white', className)} style={{ ...INPUT_STYLE, ...style }} {...rest}>
      {children}
    </select>
  );
}

/* ─── Labeled field shortcuts ─────────────────────────────────────────────── */

export function InputField({
  label, hint, required, ...inputProps
}: { label?: string; hint?: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} required={required}>
      <TextInput {...inputProps} />
    </Field>
  );
}

export function TextAreaField({
  label, hint, required, ...areaProps
}: { label?: string; hint?: string; required?: boolean } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} hint={hint} required={required}>
      <TextArea {...areaProps} />
    </Field>
  );
}

/* ─── Badge ───────────────────────────────────────────────────────────────── */

type Tone = 'navy' | 'accent' | 'ok' | 'warn' | 'danger' | 'info' | 'muted';

const TONE: Record<Tone, { color: string; bg: string }> = {
  navy: { color: COLORS.navy, bg: '#eef2f7' },
  accent: { color: COLORS.accent, bg: '#fff1ea' },
  ok: { color: COLORS.ok, bg: '#f0fdf4' },
  warn: { color: COLORS.warn, bg: '#fffbeb' },
  danger: { color: COLORS.danger, bg: '#fef2f2' },
  info: { color: COLORS.info, bg: '#f0f7ff' },
  muted: { color: '#6b7280', bg: '#f3f4f6' },
};

export function Badge({ children, tone = 'muted', className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  const t = TONE[tone];
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold', className)}
      style={{ color: t.color, background: t.bg }}
    >
      {children}
    </span>
  );
}

/* ─── Stat card ───────────────────────────────────────────────────────────── */

export function StatCard({
  icon, label, value, sub, tone = 'navy',
}: { icon?: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tone?: Tone }) {
  const t = TONE[tone];
  return (
    <div className="rounded-2xl p-5" style={{ background: '#fff', border: `1px solid ${COLORS.stroke}`, boxShadow: '0 1px 3px rgba(20,48,71,0.06)' }}>
      <div className="mb-3 flex items-center gap-2" style={{ color: t.color }}>
        {icon && <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: t.bg }}>{icon}</span>}
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-extrabold" style={{ color: COLORS.navy }}>{value}</div>
      {sub && <div className="mt-0.5 text-xs" style={{ color: COLORS.textMuted }}>{sub}</div>}
    </div>
  );
}

/* ─── Empty state ─────────────────────────────────────────────────────────── */

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl px-6 py-12 text-center" style={{ border: `1.5px dashed ${COLORS.stroke}` }}>
      {icon && <div className="mb-3" style={{ color: '#9ca3af' }}>{icon}</div>}
      <p className="font-semibold" style={{ color: COLORS.navy }}>{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm" style={{ color: COLORS.textMuted }}>{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ─── Tabs ────────────────────────────────────────────────────────────────── */

export function Tabs<T extends string>({
  tabs, active, onChange,
}: { tabs: { id: T; label: string; icon?: React.ReactNode }[]; active: T; onChange: (id: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 border-b" style={{ borderColor: COLORS.stroke }}>
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition"
            style={{ borderBottomColor: isActive ? COLORS.navy : 'transparent', color: isActive ? COLORS.navy : COLORS.textMuted }}
          >
            {t.icon} {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Toggle ──────────────────────────────────────────────────────────────── */

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2">
      <span
        className="relative inline-block h-6 w-11 rounded-full transition"
        style={{ background: checked ? COLORS.navy : '#cbd5e1' }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
          style={{ left: checked ? 22 : 2 }}
        />
      </span>
      {label && <span className="text-sm" style={{ color: COLORS.navy }}>{label}</span>}
    </button>
  );
}

/* ─── Spinner ─────────────────────────────────────────────────────────────── */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', className || 'h-5 w-5')}
      style={{ color: COLORS.navy }}
    />
  );
}
