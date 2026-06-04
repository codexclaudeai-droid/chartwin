export type VoiceNotificationInput = {
  category: string;
  title: string;
  body?: string | null;
};

export type SignalVoiceSide = 'LONG' | 'SHORT';

type SpeechSynthesisLike = {
  cancel: () => void;
  getVoices?: () => SpeechSynthesisVoice[];
  speak: (utterance: SpeechSynthesisUtterance) => void;
};

type SpeechSynthesisUtteranceConstructor = new (text: string) => SpeechSynthesisUtterance;

type NotificationVoiceOptions = {
  speechSynthesis?: SpeechSynthesisLike | null;
  Utterance?: SpeechSynthesisUtteranceConstructor | null;
  Audio?: (new (src?: string) => HTMLAudioElement) | null;
  fetch?: typeof fetch | null;
};

type NotificationVoiceTarget = string | VoiceNotificationInput;

export const STORED_NOTIFICATION_AUDIO_PATHS = {
  signalBuy: '/audio/notifications/signal-buy.mp3',
  signalSell: '/audio/notifications/signal-sell.mp3',
  adminSubscriptionPayment: '/audio/notifications/admin-subscription-payment.mp3',
  adminSupportCheck: '/audio/notifications/admin-support-check.mp3',
  memberSubscriptionApproved: '/audio/notifications/member-subscription-approved.mp3',
  memberSupportReplied: '/audio/notifications/member-support-replied.mp3',
  paymentRequested: '/audio/notifications/admin-subscription-payment.mp3',
  paymentConfirmed: '/audio/notifications/admin-subscription-payment.mp3',
  subscriptionApproved: '/audio/notifications/member-subscription-approved.mp3',
  supportReplied: '/audio/notifications/member-support-replied.mp3',
} as const;

const FEMALE_KOREAN_VOICE_HINTS = [
  'heami',
  'hyeri',
  'yuna',
  'sora',
  'sunhi',
  'seoyeon',
  'seo-yeon',
  'google',
  'korean',
  'female',
  'woman',
  'girl',
  'natural',
];

const CATEGORY_VOICE_PREFIX: Record<string, string> = {
  support_request: '고객센터 알림이에요',
  support_reply: '고객센터 알림이에요',
  qna: '고객센터 알림이에요',
  payment: '결제 알림이에요',
  subscription: '구독 알림이에요',
  expiry: '구독 만료 알림이에요',
  signal: '시그널 알림이에요',
  notice: '새 공지 알림이에요',
};

export function formatSignalVoiceMessage(side: SignalVoiceSide): string {
  return side === 'LONG' ? '매수신호발생' : '매도신호발생';
}

export function formatNotificationVoiceMessage(notification: VoiceNotificationInput): string {
  const situationMessage = getSituationVoiceMessage(notification);
  if (situationMessage) return situationMessage;

  const prefix = CATEGORY_VOICE_PREFIX[notification.category] ?? '새 알림이 도착했어요';
  const title = normalizeVoiceText(notification.title);

  return title ? `${prefix}. ${title}.` : `${prefix}.`;
}

export function speakNotificationVoice(message: string, options: NotificationVoiceOptions = {}): boolean {
  const text = normalizeVoiceText(message);
  if (!text) return false;

  const speechSynthesis = options.speechSynthesis ?? getBrowserSpeechSynthesis();
  const Utterance = options.Utterance ?? getBrowserSpeechSynthesisUtterance();
  if (!speechSynthesis || !Utterance) return false;

  try {
    speechSynthesis.cancel();
    const utterance = new Utterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.86;
    utterance.pitch = 1.18;
    utterance.volume = 0.95;
    utterance.voice = pickWarmKoreanVoice(speechSynthesis.getVoices?.() ?? []);
    speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export async function playNotificationVoice(target: NotificationVoiceTarget, options: NotificationVoiceOptions = {}): Promise<boolean> {
  const text = normalizeVoiceText(typeof target === 'string' ? target : formatNotificationVoiceMessage(target));
  if (!text) return false;

  const audioPath = typeof target === 'string'
    ? getStoredNotificationAudioPath(text)
    : resolveNotificationVoiceAudioPath(target) ?? getStoredNotificationAudioPath(text);
  if (audioPath) {
    return tryPlayStoredNotificationAudio(audioPath, options);
  }

  return speakNotificationVoice(text, options);
}

export function resolveNotificationVoiceAudioPath(notification: VoiceNotificationInput): string | null {
  const title = normalizeVoiceText(notification.title);
  const body = normalizeVoiceText(notification.body ?? '');
  const text = `${title} ${body}`;

  if (notification.category === 'payment') return STORED_NOTIFICATION_AUDIO_PATHS.adminSubscriptionPayment;
  if (notification.category === 'support_request' || notification.category === 'qna') {
    return STORED_NOTIFICATION_AUDIO_PATHS.adminSupportCheck;
  }
  if (notification.category === 'support_reply') return STORED_NOTIFICATION_AUDIO_PATHS.memberSupportReplied;
  if (notification.category === 'subscription' && includesAny(text, ['구독이 활성화', '구독 승인', '구독이 승인'])) {
    return STORED_NOTIFICATION_AUDIO_PATHS.memberSubscriptionApproved;
  }

  return null;
}

export function getStoredNotificationAudioPath(message: string): string | null {
  const text = normalizeVoiceText(message);
  if (!text) return null;

  if (text === '매수신호발생') return STORED_NOTIFICATION_AUDIO_PATHS.signalBuy;
  if (text === '매도신호발생') return STORED_NOTIFICATION_AUDIO_PATHS.signalSell;
  if (includesAny(text, ['새 입금 확인 요청 게시글', '새 문의 게시글이 등록'])) {
    return STORED_NOTIFICATION_AUDIO_PATHS.adminSupportCheck;
  }
  if (includesAny(text, ['입금 확인 요청이 접수', '입금 확인이 완료'])) {
    return STORED_NOTIFICATION_AUDIO_PATHS.adminSubscriptionPayment;
  }
  if (includesAny(text, ['구독 승인이 완료', '구독이 활성화'])) {
    return STORED_NOTIFICATION_AUDIO_PATHS.memberSubscriptionApproved;
  }
  if (includesAny(text, ['문의 답변이 등록'])) return STORED_NOTIFICATION_AUDIO_PATHS.memberSupportReplied;

  return null;
}

function getSituationVoiceMessage(notification: VoiceNotificationInput): string | null {
  const title = normalizeVoiceText(notification.title);
  const body = normalizeVoiceText(notification.body ?? '');
  const text = `${title} ${body}`;

  if (notification.category === 'support_request' && includesAny(text, ['입금확인 요청', '입금 확인 요청'])) {
    return '새 입금 확인 요청 게시글이 도착했어요.';
  }
  if (notification.category === 'support_request') {
    return '새 문의 게시글이 등록되었어요. 관리자 답변을 기다리고 있어요.';
  }
  if (notification.category === 'support_reply') {
    return '문의 답변이 등록되었어요. 고객센터에서 확인해 주세요.';
  }
  if (notification.category === 'payment' && includesAny(text, ['입금확인 요청', '입금 확인 요청', '요청이 접수'])) {
    return '입금 확인 요청이 접수되었어요. 관리자가 입금 내역을 확인할 예정이에요.';
  }
  if (notification.category === 'payment' && includesAny(text, ['입금 확인이 완료', '입금확인이 완료'])) {
    return '입금 확인이 완료되었어요. 구독 승인 절차로 이어질 예정이에요.';
  }
  if (notification.category === 'payment' && includesAny(text, ['결제 요청이 반려', '입금 요청이 반려'])) {
    return '결제 요청이 반려되었어요. 상세 내용을 확인해 주세요.';
  }
  if (notification.category === 'payment' && includesAny(text, ['환불 처리가 완료'])) {
    return '환불 처리가 완료되었어요.';
  }
  if (notification.category === 'subscription' && includesAny(text, ['구독이 활성화', '구독 승인', '구독이 승인'])) {
    return '구독 승인이 완료되었어요. 이제 차트를 이용할 수 있어요.';
  }
  if (notification.category === 'subscription' && includesAny(text, ['구독 취소가 승인'])) {
    return '구독 취소가 승인되었어요. 서비스 이용 상태를 확인해 주세요.';
  }
  if (notification.category === 'subscription' && includesAny(text, ['환불 요청이 승인'])) {
    return '환불 요청이 승인되었어요. 처리 상태를 확인해 주세요.';
  }
  if (notification.category === 'subscription' && includesAny(text, ['구독 요청이 반려'])) {
    return '구독 요청이 반려되었어요. 상세 내용을 확인해 주세요.';
  }

  return null;
}

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

async function tryPlayStoredNotificationAudio(
  audioPath: string,
  options: NotificationVoiceOptions,
): Promise<boolean> {
  const AudioConstructor = options.Audio ?? getBrowserAudioConstructor();
  if (!AudioConstructor) return false;

  const fetcher = options.fetch ?? getBrowserFetch();
  if (fetcher) {
    try {
      const response = await fetcher(audioPath, { method: 'HEAD', cache: 'force-cache' });
      if (!response.ok) return false;
    } catch {
      return false;
    }
  }

  try {
    const audio = new AudioConstructor(audioPath);
    audio.preload = 'auto';
    audio.volume = 0.95;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

function pickWarmKoreanVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const koreanVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('ko'));
  if (!koreanVoices.length) return null;

  return koreanVoices.find((voice) => {
    const name = voice.name.toLowerCase();
    return FEMALE_KOREAN_VOICE_HINTS.some((hint) => name.includes(hint));
  }) ?? koreanVoices[0] ?? null;
}

function normalizeVoiceText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 90);
}

function getBrowserSpeechSynthesis(): SpeechSynthesisLike | null {
  if (typeof window === 'undefined') return null;
  return window.speechSynthesis ?? null;
}

function getBrowserSpeechSynthesisUtterance(): SpeechSynthesisUtteranceConstructor | null {
  if (typeof SpeechSynthesisUtterance === 'undefined') return null;
  return SpeechSynthesisUtterance;
}

function getBrowserAudioConstructor(): (new (src?: string) => HTMLAudioElement) | null {
  if (typeof Audio === 'undefined') return null;
  return Audio;
}

function getBrowserFetch(): typeof fetch | null {
  if (typeof fetch === 'undefined') return null;
  return fetch;
}
