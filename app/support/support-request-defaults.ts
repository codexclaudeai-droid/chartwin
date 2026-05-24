export type DefaultSupportRequestDraft = {
  title: string;
  body: string;
};

export function getDefaultSupportRequestDraft(): DefaultSupportRequestDraft {
  return {
    title: '서비스 이용 문의',
    body: '서비스 이용 중 확인이 필요한 내용이 있어 문의드립니다. 확인 후 안내 부탁드립니다.',
  };
}
