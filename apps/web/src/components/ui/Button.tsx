import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-sans text-sm font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-[#43403E]',
  secondary: 'border border-line bg-transparent text-ink hover:border-accent hover:text-accent',
  ghost: 'bg-transparent text-ink-soft hover:text-ink',
};

const SIZES = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-6',
  lg: 'h-13 px-8 text-[15px]',
} as const;

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof SIZES;
  children: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }: Props) {
  return (
    <button className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
