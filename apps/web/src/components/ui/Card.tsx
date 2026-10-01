import type { HTMLAttributes } from 'react';

type MetaLabelProps = HTMLAttributes<HTMLSpanElement>;

export function MetaLabel({ children, className = '', ...rest }: MetaLabelProps) {
  return (
    <span className={`meta-label ${className}`} {...rest}>
      {children}
    </span>
  );
}
