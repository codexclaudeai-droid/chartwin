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
          d="M6.9 7.7A6.9 6.9 0 0 1 18.2 9.7"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.15"
        />
        <path
          d="M18.2 9.7 15.9 9.35 17.55 7.75Z"
          fill="currentColor"
        />
        <path
          d="M17.1 16.3A6.9 6.9 0 0 1 5.8 14.3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.15"
        />
        <path
          d="M5.8 14.3 8.1 14.65 6.45 16.25Z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
