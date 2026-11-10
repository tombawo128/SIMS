import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import type { BadgeTone } from '@sims/shared';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'btn--primary',
  secondary:
    'btn--secondary',
  ghost: 'btn--ghost',
  danger: 'btn--danger',
  outline:
    'btn--outline',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'btn--sm',
  md: 'btn--md',
  lg: 'btn--lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'btn',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className='btn__spinner' aria-hidden /> : null}
      {children}
    </button>
  );
}

export function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('label', className)} {...props}>
      {children}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'input',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'textarea',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'select',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className='field__required'>*</span> : null}
      </Label>
      {children}
      {error ? <p className='field__error'>{error}</p> : null}
      {!error && hint ? <p className='stat-card__hint'>{hint}</p> : null}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('card', className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('card__header', className)}>
      <div>
        <h2 className='heading-sm'>{title}</h2>
        {description ? <p className='card__description'>{description}</p> : null}
      </div>
      {actions ? <div className='card__actions'>{actions}</div> : null}
    </div>
  );
}

const badgeTones: Record<BadgeTone, string> = {
  slate: 'badge--slate',
  blue: 'badge--blue',
  amber: 'badge--amber',
  violet: 'badge--violet',
  emerald: 'badge--emerald',
  rose: 'badge--rose',
};

export function Badge({
  tone = 'slate',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'badge',
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = size === 'sm' ? 'modal__panel--sm' : size === 'lg' ? 'modal__panel--lg' : 'modal__panel--md';

  return createPortal(
    <div className='modal'>
      <div
        className='modal__backdrop'
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'modal__panel',
          width,
        )}
      >
        <div className='modal__header'>
          <div>
            <h2 className='modal__title'>{title}</h2>
            {description ? <p className='modal__description'>{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className='modal__close'
            aria-label="Close dialog"
          >
            <X className='icon' />
          </button>
        </div>
        <div className='modal__body'>{children}</div>
        {footer ? (
          <div className='modal__footer'>
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('spinner', className)} aria-label="Loading" />;
}

export function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className='full-page-spinner'>
      <Spinner className='icon-xl' />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('empty-state', className)}>
      {icon ? (
        <div className='empty-state__icon'>
          {icon}
        </div>
      ) : null}
      <h3 className='heading-sm'>{title}</h3>
      {description ? <p className='empty-state__description'>{description}</p> : null}
      {action ? <div className='empty-state__action'>{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('stat-card', className)}>
      <div className='stat-card__row'>
        <div>
          <p className='stat-card__label'>{label}</p>
          <p className='stat-card__value'>{value}</p>
          {hint ? <p className='stat-card__hint'>{hint}</p> : null}
        </div>
        {icon ? (
          <div className='stat-card__icon'>
            {icon}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function Tabs({
  options,
  value,
  onChange,
  className,
}: {
  options: { key: string; label: string; count?: number }[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('tabs', className)}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={cn(
              'tabs__item',
              active
                ? 'tabs__item--active'
                : 'tabs__item--inactive',
            )}
          >
            {option.label}
            {typeof option.count === 'number' ? (
              <span
                className={cn(
                  'tabs__count',
                  active ? 'tabs__count--active' : 'tabs__count--inactive',
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const label = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className={cn(
        'avatar',
        className,
      )}
    >
      {label || '?'}
    </span>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    info: 'alert--info',
    success: 'alert--success',
    warning: 'alert--warning',
    danger: 'alert--danger',
  } as const;
  return (
    <div className={cn('alert', tones[tone])}>
      {title ? <p className='alert__title'>{title}</p> : null}
      <div className={cn(title && 'alert__body--spaced', 'alert__body')}>{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className='page-header'>
      <div>
        <h1 className='page-header__title'>{title}</h1>
        {description ? <p className='page-header__description'>{description}</p> : null}
      </div>
      {actions ? <div className='page-header__actions'>{actions}</div> : null}
    </div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('table-wrap', className)}>
      <table className='table'>{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'th',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('td', className)}>{children}</td>;
}

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (input: { title: string; description?: string; tone?: ToastTone }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = (id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  };

  const toast: ToastContextValue['toast'] = (input) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [
      ...current,
      { id, title: input.title, description: input.description, tone: input.tone ?? 'info' },
    ]);
    window.setTimeout(() => dismiss(id), 5000);
  };

  const tones: Record<ToastTone, string> = {
    success: 'toast--success',
    error: 'toast--error',
    info: 'toast--info',
  };
  const dots: Record<ToastTone, string> = {
    success: 'toast__dot--success',
    error: 'toast__dot--error',
    info: 'toast__dot--info',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className='toast-region'>
        {toasts.map((item) => (
          <div
            key={item.id}
            className={cn(
              'toast',
              tones[item.tone],
            )}
          >
            <span className={cn('toast__dot', dots[item.tone])} />
            <div className='toast__content'>
              <p className='toast__title'>{item.title}</p>
              {item.description ? <p className='toast__description'>{item.description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className='toast__close'
              aria-label="Dismiss notification"
            >
              <X className='icon-sm' />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
