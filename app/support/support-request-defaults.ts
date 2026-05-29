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

export function getTrialSupportRequestDraft(): DefaultSupportRequestDraft {
  return {
    title: '무료체험 신청',
    body: '무료체험 신청을 요청합니다. 체험 가능 조건과 승인 가능 여부를 안내해 주세요.',
  };
}

export function getPartnershipSupportRequestDraft(): DefaultSupportRequestDraft {
  return {
    title: '제휴문의',
    body: 'TradingCore 서비스 제휴와 관련해 문의드립니다. 제안 내용과 협의 가능 절차를 안내해 주세요.',
  };
}
