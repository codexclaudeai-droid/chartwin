export type SessionNavUser = {
  email: string;
  name: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  member: '회원',
  trial: '체험',
  subscriber: '구독자',
  salesperson: '영업',
  admin: '관리자',
  super_admin: '최고관리자',
};

export function formatSessionUserLabel(user: SessionNavUser): string {
  const name = (user.name || '').trim();
  return name || user.email;
}

export function formatSessionRoleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}
