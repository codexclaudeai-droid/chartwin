'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
};

export function IconButton({ label, children, className = '', ...props }: IconButtonProps) {
  const classNames = ['icon-button', className].filter(Boolean).join(' ');

  return (
    <button
      {...props}
      aria-label={label}
      className={classNames}
      title={props.title ?? label}
      type={props.type ?? 'button'}
    >
      {children}
    </button>
  );
}
