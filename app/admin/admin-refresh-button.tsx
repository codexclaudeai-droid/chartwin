import { RefreshIconButton } from '../shared/refresh-icon-button';

type AdminRefreshButtonProps = Parameters<typeof RefreshIconButton>[0];

export function AdminRefreshButton({ disabled = false, onClick }: AdminRefreshButtonProps) {
  return (
    <RefreshIconButton
      className="admin-refresh-icon-button refresh-icon-button"
      disabled={disabled}
      onClick={onClick}
    />
  );
}
