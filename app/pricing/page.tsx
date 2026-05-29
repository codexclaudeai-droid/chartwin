import {
  getAsyncChartServicePersistence,
  getAsyncPaymentTransferSettingsForDisplay,
  getAsyncWebInfoSettingsForDisplay,
} from '../../src/server/chart-service/index.ts';
import { PricingPanel } from './pricing-panel';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const persistence = getAsyncChartServicePersistence();
  const { paymentSettings, plans, webInfoSettings } = await persistence.runRead(async (repository) => ({
    plans: await repository.listPlans(),
    paymentSettings: await getAsyncPaymentTransferSettingsForDisplay(repository),
    webInfoSettings: await getAsyncWebInfoSettingsForDisplay(repository),
  }));

  return (
    <main className="page pricing-page">
      <section className="pricing-page-hero">
        <span className="eyebrow">Subscription Checkout</span>
        <h1>구독 플랜을 선택하고 결제 정보를 확인하세요.</h1>
        <p className="lede">
          BASIC, PRO, ELITE 플랜을 비교한 뒤 은행이체 또는 USDT 결제 정보를 확인하고 입금확인 요청까지 단계별로 진행합니다.
          결제는 자동 승인되지 않으며 관리자가 실제 입금 내역을 수동 확인한 뒤 구독을 승인합니다.
        </p>
      </section>

      <PricingPanel plans={plans} paymentSettings={paymentSettings} planServices={webInfoSettings.planServices} />
    </main>
  );
}
