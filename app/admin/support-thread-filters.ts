export type SupportThreadFilterPreset = {
  key: string;
  label: string;
  status: string;
  visibility: string;
};

type FilterableSupportThread = {
  thread: {
    status: string;
    visibility: string;
  };
};

export const SUPPORT_THREAD_FILTER_PRESETS: SupportThreadFilterPreset[] = [
  { key: 'all', label: '전체', status: '', visibility: '' },
  { key: 'waiting', label: '답변 대기', status: 'waiting', visibility: '' },
  { key: 'answered', label: '답변 완료', status: 'answered', visibility: '' },
  { key: 'private', label: '비공개', status: '', visibility: 'private' },
];

export function getSupportThreadFilterPreset(key: string): SupportThreadFilterPreset {
  return SUPPORT_THREAD_FILTER_PRESETS.find((preset) => preset.key === key) ?? SUPPORT_THREAD_FILTER_PRESETS[0];
}

export function filterSupportThreads<T extends FilterableSupportThread>(threads: T[], key: string): T[] {
  const preset = getSupportThreadFilterPreset(key);
  return threads.filter((item) => {
    const statusMatched = !preset.status || item.thread.status === preset.status;
    const visibilityMatched = !preset.visibility || item.thread.visibility === preset.visibility;
    return statusMatched && visibilityMatched;
  });
}
