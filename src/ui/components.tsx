/** 通用小组件 */
import type { ComponentChildren, JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import type { Member } from '../domain/types';

type IconProps = { size?: number };

const svg = (size: number, children: ComponentChildren) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const Icon = {
  Home: ({ size = 24 }: IconProps) =>
    svg(size, [<path d="M3 10.5 12 3l9 7.5" />, <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />, <path d="m9 15 2 2 4-4" />]),
  List: ({ size = 24 }: IconProps) =>
    svg(size, [
      <path d="M9 6h11M9 12h11M9 18h11" />,
      <circle cx="4.5" cy="6" r="1" />,
      <circle cx="4.5" cy="12" r="1" />,
      <circle cx="4.5" cy="18" r="1" />,
    ]),
  Clock: ({ size = 24 }: IconProps) => svg(size, [<circle cx="12" cy="12" r="9" />, <path d="M12 7v5l3 2" />]),
  Chart: ({ size = 24 }: IconProps) => svg(size, [<path d="M4 20h16" />, <path d="M7 16v-5M12 16V6M17 16v-8" />]),
  Check: ({ size = 20 }: IconProps) => svg(size, <path d="m5 12.5 4.5 4.5L19 7.5" />),
  Plus: ({ size = 20 }: IconProps) => svg(size, <path d="M12 5v14M5 12h14" />),
  Copy: ({ size = 18 }: IconProps) =>
    svg(size, [<rect x="9" y="9" width="11" height="11" rx="2" />, <path d="M5 15V5a1 1 0 0 1 1-1h10" />]),
  Bell: ({ size = 14 }: IconProps) =>
    svg(size, [<path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" />, <path d="M10 20a2 2 0 0 0 4 0" />]),
  Undo: ({ size = 16 }: IconProps) => svg(size, [<path d="M9 7 4 12l5 5" />, <path d="M4 12h10a6 6 0 0 1 0 12h-2" />]),
  Close: ({ size = 20 }: IconProps) => svg(size, <path d="M6 6l12 12M18 6 6 18" />),
};

export function Avatar({ member, size = 24 }: { member: Member | undefined; size?: number }) {
  const name = member?.name ?? '?';
  return (
    <span
      class="avatar"
      style={{ '--c': member?.color ?? '#8b8e86', width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.5)}px` }}
      aria-hidden="true"
    >
      {[...name][0]}
    </span>
  );
}

export function Stepper(props: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const { value, min, max, onChange, label } = props;
  return (
    <span class="stepper" role="group" aria-label={label}>
      <button type="button" aria-label="减少" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <span class="stepper-value" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label="增加" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </span>
  );
}

export function Segmented<T extends string>(props: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  small?: boolean;
}) {
  return (
    <div class={`segmented ${props.small ? 'segmented-small' : ''}`} role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={o.value === props.value}
          class={o.value === props.value ? 'active' : ''}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch(props: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.label}
      class={`switch ${props.checked ? 'on' : ''}`}
      onClick={() => props.onChange(!props.checked)}
    >
      <span class="switch-knob" />
    </button>
  );
}

/** 从底部弹出的面板 */
export function Sheet(props: {
  title: string;
  onClose: () => void;
  left?: ComponentChildren;
  right?: ComponentChildren;
  children: ComponentChildren;
  labelledBy?: string;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const stop = (e: JSX.TargetedMouseEvent<HTMLDivElement>) => e.stopPropagation();

  return (
    <div class="sheet-backdrop" onClick={props.onClose}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={props.title} onClick={stop}>
        <div class="sheet-header">
          <div class="sheet-header-side">{props.left}</div>
          <h2 class="sheet-title">{props.title}</h2>
          <div class="sheet-header-side right">{props.right}</div>
        </div>
        <div class="sheet-body">{props.children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ComponentChildren }) {
  return (
    <div class="empty">
      <div class="empty-emoji" aria-hidden="true">
        {emoji}
      </div>
      <div class="empty-title">{title}</div>
      {children && <div class="empty-text">{children}</div>}
    </div>
  );
}
