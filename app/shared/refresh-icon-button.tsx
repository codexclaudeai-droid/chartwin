'use client';

import { useState } from 'react';

const REFRESH_ICON_SPIN_MS = 520;

type RefreshIconButtonProps = {
  className?: string;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
};

export function RefreshIconButton({ className = 'refresh-icon-button', disabled = false, onClick }: RefreshIconButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const buttonClassName = isRefreshing ? `${className} refresh-icon-button--spinning` : className;

  async function handleClick() {
    if (disabled || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onClick();
    } finally {
      window.setTimeout(() => setIsRefreshing(false), REFRESH_ICON_SPIN_MS);
    }
  }

  return (
    <button
      aria-label="새로고침"
      className={buttonClassName}
      disabled={disabled}
      onClick={handleClick}
      title="새로고침"
      type="button"
    >
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path
          d="M6.9 7.7A6.9 6.9 0 0 1 18.5 10.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.15"
        />
        <path
          d="M18.5 10.5l-2.8-.2 1.7-2.2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.15"
        />
        <path
          d="M17.1 16.3A6.9 6.9 0 0 1 5.5 13.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.15"
        />
        <path
          d="M5.5 13.5l2.8.2-1.7 2.2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.15"
        />
      </svg>
    </button>
  );
}
