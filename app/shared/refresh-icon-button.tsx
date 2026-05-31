type RefreshIconButtonProps = {
  className?: string;
  disabled?: boolean;
  onClick: () => void;
};

export function RefreshIconButton({ className = 'refresh-icon-button', disabled = false, onClick }: RefreshIconButtonProps) {
  return (
    <button
      aria-label="새로고침"
      className={className}
      disabled={disabled}
      onClick={onClick}
      title="새로고침"
      type="button"
    >
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path
          d="M18.2 8.1A7 7 0 1 0 19 15"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M18.4 3.8v4.8h-4.8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </button>
  );
}
