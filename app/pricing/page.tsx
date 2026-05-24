import { getChartServiceRepository } from '../../src/server/chart-service/index.ts';
import { PricingPanel } from './pricing-panel';
import { SubscriptionActionsPanel } from './subscription-actions-panel';

export default function PricingPage() {
  const plans = getChartServiceRepository().listPlans();

  return (
    <main className="page">
      <h1>구독 플랜</h1>
      <p className="lede">
        결제는 자동 승인하지 않습니다. 사용자가 입금 확인 요청을 남기면 관리자가 관리자페이지에서 승인, 환불, 취소를 처리합니다.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Plan</th>
            <th>Period</th>
            <th>Price</th>
            <th>Discount</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr key={plan.id}>
              <td>{plan.name}</td>
              <td>{plan.durationDays}일</td>
              <td>${Math.round(plan.basePriceUsd * (1 - plan.discountPercent / 100) * 100) / 100}</td>
              <td>{plan.discountPercent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <PricingPanel plans={plans} />
      <SubscriptionActionsPanel />
    </main>
  );
}
