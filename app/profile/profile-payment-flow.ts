import type {
  PaymentStatus,
  SubscriptionStatus,
} from '../../src/domain/chart-service/index.ts';

export type ProfilePaymentFlowStepState = 'done' | 'current' | 'waiting' | 'blocked';

export type ProfilePaymentFlowStep = {
  key: 'request' | 'deposit' | 'approval';
  label: string;
  description: string;
  state: ProfilePaymentFlowStepState;
};

export function getProfilePaymentFlowSteps(input: {
  paymentStatus: PaymentStatus;
  subscriptionStatus?: SubscriptionStatus | null;
}): ProfilePaymentFlowStep[] {
  const subscriptionStatus = input.subscriptionStatus ?? 'none';

  if (input.paymentStatus === 'rejected' || input.paymentStatus === 'cancelled') {
    return [
      createStep('request', 'done', '입금확인 요청이 접수되었습니다.'),
      createStep('deposit', 'blocked', '입금 내역이 확인되지 않아 요청이 반려되었습니다.'),
      createStep('approval', 'blocked', '반려된 요청은 구독 승인으로 진행되지 않습니다.'),
    ];
  }

  if (input.paymentStatus === 'refunded') {
    return [
      createStep('request', 'done', '입금확인 요청이 접수되었습니다.'),
      createStep('deposit', 'done', '입금확인 이후 환불 처리가 완료되었습니다.'),
      createStep('approval', 'blocked', '환불 완료 상태라 현재 구독 승인은 중단되었습니다.'),
    ];
  }

  if (input.paymentStatus === 'confirmed' && isApprovedSubscription(subscriptionStatus)) {
    return [
      createStep('request', 'done', '입금확인 요청이 접수되었습니다.'),
      createStep('deposit', 'done', '관리자가 입금 내역을 확인했습니다.'),
      createStep('approval', 'done', '구독 승인까지 완료되어 서비스 이용이 가능합니다.'),
    ];
  }

  if (input.paymentStatus === 'confirmed') {
    return [
      createStep('request', 'done', '입금확인 요청이 접수되었습니다.'),
      createStep('deposit', 'done', '관리자가 입금 내역을 확인했습니다.'),
      createStep('approval', 'current', '관리자 구독 승인 단계가 남아 있습니다.'),
    ];
  }

  return [
    createStep('request', 'done', '입금확인 요청이 접수되었습니다.'),
    createStep('deposit', 'current', '관리자가 실제 입금 내역을 수동 확인 중입니다.'),
    createStep('approval', 'waiting', '입금확인 완료 후 구독 승인 단계로 이동합니다.'),
  ];
}

function createStep(
  key: ProfilePaymentFlowStep['key'],
  state: ProfilePaymentFlowStepState,
  description: string,
): ProfilePaymentFlowStep {
  const labels: Record<ProfilePaymentFlowStep['key'], string> = {
    request: '요청 접수',
    deposit: '입금확인',
    approval: '구독승인',
  };

  return {
    key,
    label: labels[key],
    description,
    state,
  };
}

function isApprovedSubscription(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'expiring';
}
