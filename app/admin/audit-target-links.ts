import { createAdminPaymentUrl } from './payment-links.ts';
import { createAdminSubscriptionUrl } from './subscription-links.ts';
import { createAdminSupportThreadUrl } from './support-thread-links.ts';

export type AdminAuditTargetLink = {
  href: string;
  label: string;
};

export function getAdminAuditTargetLink(targetType: string, targetId: string): AdminAuditTargetLink | null {
  if (targetType === 'payment_request') {
    return {
      href: createAdminPaymentUrl(targetId),
      label: '결제 큐에서 보기',
    };
  }

  if (targetType === 'subscription') {
    return {
      href: createAdminSubscriptionUrl(targetId),
      label: '구독 큐에서 보기',
    };
  }

  if (targetType === 'support_thread') {
    return {
      href: createAdminSupportThreadUrl(targetId),
      label: '문의 답변 화면으로 이동',
    };
  }

  return null;
}
