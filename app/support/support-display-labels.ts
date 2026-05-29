const SUPPORT_CATEGORY_LABELS: Record<string, string> = {
  deposit: '입금/결제',
  cancel: '취소/환불',
  usage: '사용 방법',
  signal: '시그널',
  trial: '무료체험',
  partnership: '제휴',
  general: '일반',
};

const SUPPORT_STATUS_LABELS: Record<string, string> = {
  waiting: '답변 대기',
  answered: '답변 완료',
};

const SUPPORT_VISIBILITY_LABELS: Record<string, string> = {
  private: '비공개',
  public: '공개',
};

export function formatSupportCategoryLabel(category: string): string {
  return SUPPORT_CATEGORY_LABELS[category] ?? category;
}

export function formatSupportStatusLabel(status: string): string {
  return SUPPORT_STATUS_LABELS[status] ?? status;
}

export function formatSupportVisibilityLabel(visibility: string): string {
  return SUPPORT_VISIBILITY_LABELS[visibility] ?? visibility;
}
