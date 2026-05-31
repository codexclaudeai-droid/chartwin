export type DefaultProfileAvatarOption = {
  id: string;
  label: string;
  gender: 'male' | 'female';
  path: string;
};

export const DEFAULT_PROFILE_AVATARS: DefaultProfileAvatarOption[] = [
  { id: 'male-1', label: '남성 1', gender: 'male', path: '/avatars/male-1.png' },
  { id: 'male-2', label: '남성 2', gender: 'male', path: '/avatars/male-2.png' },
  { id: 'male-3', label: '남성 3', gender: 'male', path: '/avatars/male-3.png' },
  { id: 'male-4', label: '남성 4', gender: 'male', path: '/avatars/male-4.png' },
  { id: 'male-5', label: '남성 5', gender: 'male', path: '/avatars/male-5.png' },
  { id: 'female-1', label: '여성 1', gender: 'female', path: '/avatars/female-1.png' },
  { id: 'female-2', label: '여성 2', gender: 'female', path: '/avatars/female-2.png' },
  { id: 'female-3', label: '여성 3', gender: 'female', path: '/avatars/female-3.png' },
  { id: 'female-4', label: '여성 4', gender: 'female', path: '/avatars/female-4.png' },
  { id: 'female-5', label: '여성 5', gender: 'female', path: '/avatars/female-5.png' },
];

export function isDefaultProfileAvatarPath(value: string): boolean {
  return DEFAULT_PROFILE_AVATARS.some((avatar) => avatar.path === value);
}
