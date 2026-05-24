type AdminDashboardFilterNoticeProps = {
  label: string | null;
  onClear: () => void;
};

export function AdminDashboardFilterNotice({
  label,
  onClear,
}: AdminDashboardFilterNoticeProps) {
  if (!label) return null;

  return (
    <div className="notice compact admin-dashboard-filter-notice" role="status">
      <div className="admin-dashboard-filter-copy">
        <span className="admin-dashboard-filter-badge">대시보드 이동</span>
        <strong>{label} 필터 적용됨</strong>
        <span>대시보드 큐에서 {label} 필터를 적용했습니다.</span>
      </div>
      <button className="button secondary" type="button" onClick={onClear}>
        전체 보기
      </button>
    </div>
  );
}
