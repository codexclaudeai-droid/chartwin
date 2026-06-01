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
          d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M21 3v5h-5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M8 16H3v5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </button>
  );
}
