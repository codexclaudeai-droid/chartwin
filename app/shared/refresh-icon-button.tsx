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
          d="M4.9 13.2A7.4 7.4 0 0 1 17.8 6.2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.15"
        />
        <path
          d="M18.4 6.3l-.3 4.2-4.2-.3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.15"
        />
        <path
          d="M19.1 10.8A7.4 7.4 0 0 1 6.2 17.8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.15"
        />
        <path
          d="M5.6 17.7l.3-4.2 4.2.3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.15"
        />
      </svg>
    </button>
  );
}
