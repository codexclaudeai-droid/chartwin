const fs = require('fs');
const path = 'src/main.ts';
let text = fs.readFileSync(path, 'utf8');
const utcBlock = `function buildUtcOffsetOptions(): TimezoneOption[] {
  return [
    { id: 'UTC-10', label: 'UTC-10', display: '(UTC-10) 호놀룰루', category: 'UTC 오프셋' },
    { id: 'UTC-8', label: 'UTC-8', display: '(UTC-8) 앵커리지', category: 'UTC 오프셋' },
    { id: 'UTC-8', label: 'UTC-8', display: '(UTC-8) 주노', category: 'UTC 오프셋' },
    { id: 'UTC-7', label: 'UTC-7', display: '(UTC-7) 로스앤젤레스', category: 'UTC 오프셋' },
    { id: 'UTC-7', label: 'UTC-7', display: '(UTC-7) 밴쿠버', category: 'UTC 오프셋' },
    { id: 'UTC-7', label: 'UTC-7', display: '(UTC-7) 피닉스', category: 'UTC 오프셋' },
    { id: 'UTC-6', label: 'UTC-6', display: '(UTC-6) 덴버', category: 'UTC 오프셋' },
    { id: 'UTC-6', label: 'UTC-6', display: '(UTC-6) 멕시코 시티', category: 'UTC 오프셋' },
    { id: 'UTC-6', label: 'UTC-6', display: '(UTC-6) 산살바도르', category: 'UTC 오프셋' },
    { id: 'UTC-5', label: 'UTC-5', display: '(UTC-5) 리마', category: 'UTC 오프셋' },
    { id: 'UTC-5', label: 'UTC-5', display: '(UTC-5) 보고타', category: 'UTC 오프셋' },
    { id: 'UTC-5', label: 'UTC-5', display: '(UTC-5) 시카고', category: 'UTC 오프셋' },
    { id: 'UTC-4', label: 'UTC-4', display: '(UTC-4) 뉴욕', category: 'UTC 오프셋' },
    { id: 'UTC-4', label: 'UTC-4', display: '(UTC-4) 산티아고', category: 'UTC 오프셋' },
    { id: 'UTC-4', label: 'UTC-4', display: '(UTC-4) 카라카스', category: 'UTC 오프셋' },
    { id: 'UTC-4', label: 'UTC-4', display: '(UTC-4) 토론토', category: 'UTC 오프셋' },
    { id: 'UTC', label: 'UTC', display: '(UTC) 레이카비크', category: 'UTC 오프셋' },
    { id: 'UTC', label: 'UTC', display: '(UTC) 아조레스', category: 'UTC 오프셋' },
    { id: 'UTC+1', label: 'UTC+1', display: '(UTC+1) 더블린', category: 'UTC 오프셋' },
    { id: 'UTC+1', label: 'UTC+1', display: '(UTC+1) 라고스', category: 'UTC 오프셋' },
    { id: 'UTC+1', label: 'UTC+1', display: '(UTC+1) 런던', category: 'UTC 오프셋' },
    { id: 'UTC+1', label: 'UTC+1', display: '(UTC+1) 리스본', category: 'UTC 오프셋' },
    { id: 'UTC+1', label: 'UTC+1', display: '(UTC+1) 카사블랑카', category: 'UTC 오프셋' },
    { id: 'UTC+1', label: 'UTC+1', display: '(UTC+1) 튀니스', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 로마', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 룩셈부르크', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 류블라나', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 마드리드', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 몰타', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 바르샤바', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 베를린', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 베오그라드', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 부다페스트', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 브라티슬라바', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 브뤼셀', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 비엔나', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 스톡홀름', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 암스테르담', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 오슬로', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 요하네스버그', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 자그레브', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 취리히', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 카이로', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 코펜하겐', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 파리', category: 'UTC 오프셋' },
    { id: 'UTC+2', label: 'UTC+2', display: '(UTC+2) 프라하', category: 'UTC 오프셋' },
    { id: 'UTC+3', label: 'UTC+3', display: '(UTC+3) 나이로비', category: 'UTC 오프셋' },
    { id: 'UTC+3', label: 'UTC+3', display: '(UTC+3) 니코시아', category: 'UTC 오프셋' },
    { id: 'UTC+3', label: 'UTC+3', display: '(UTC+3) 리가', category: 'UTC 오프셋' },
    { id: 'UTC+3', label: 'UTC+3', display: '(UTC+3) 리야드', category: 'UTC 오프셋' },
    { id: 'UTC+3', label: 'UTC+3', display: '(UTC+3) 모스크바', category: 'UTC 오프셋' },
    { id: 'UTC+3', label: 'UTC+3', display: '(UTC+3) 바레인', category: 'UTC 오프셋' },
    { id: 'UTC+3', label: 'UTC+3', display: '(UTC+3) 부쿠레슈티', category: 'UTC 오프셋' },
    { id: 'UTC+3', label: 'UTC+3', display: '(UTC+3) 빌뉴스', category: 'UTC 오프셋' },
    { id: 'UTC+3', label: 'UTC+3', display: '(UTC+3) 소피아', category: 'UTC 오프셋' },
    { id: 'UTC+3', label: 'UTC+3', display: '(UTC+3) 아테네', category: 'UTC 오프셋' },
    { id: 'UTC+3', label: 'UTC+3', display: '(UTC+3) 예루살렘', category: 'UTC 오프셋' },
    { id: 'UTC+3', label: 'UTC+3', display: '(UTC+3) 이스탄불', category: 'UTC 오프셋' },
    { id: 'UTC+3', label: 'UTC+3', display: '(UTC+3) 카타르', category: 'UTC 오프셋' },
    { id: 'UTC+3', label: 'UTC+3', display: '(UTC+3) 쿠웨이트', category: 'UTC 오프셋' },
    { id: 'UTC+3', label: 'UTC+3', display: '(UTC+3) 탈린', category: 'UTC 오프셋' },
    { id: 'UTC+3', label: 'UTC+3', display: '(UTC+3) 헬싱키', category: 'UTC 오프셋' },
    { id: 'UTC+3:30', label: 'UTC+3:30', display: '(UTC+3:30) 테헤란', category: 'UTC 오프셋' },
    { id: 'UTC+4', label: 'UTC+4', display: '(UTC+4) 두바이', category: 'UTC 오프셋' },
    { id: 'UTC+4', label: 'UTC+4', display: '(UTC+4) 무스카트', category: 'UTC 오프셋' },
    { id: 'UTC+4:30', label: 'UTC+4:30', display: '(UTC+4:30) 카불', category: 'UTC 오프셋' },
    { id: 'UTC+5', label: 'UTC+5', display: '(UTC+5) 아슈하바트', category: 'UTC 오프셋' },
    { id: 'UTC+5', label: 'UTC+5', display: '(UTC+5) 아스타나', category: 'UTC 오프셋' },
    { id: 'UTC+5', label: 'UTC+5', display: '(UTC+5) 카라치', category: 'UTC 오프셋' },
    { id: 'UTC+5:30', label: 'UTC+5:30', display: '(UTC+5:30) 콜롬보', category: 'UTC 오프셋' },
    { id: 'UTC+5:30', label: 'UTC+5:30', display: '(UTC+5:30) 콜카타', category: 'UTC 오프셋' },
    { id: 'UTC+5:45', label: 'UTC+5:45', display: '(UTC+5:45) 카트만두', category: 'UTC 오프셋' },
    { id: 'UTC+6', label: 'UTC+6', display: '(UTC+6) 다카', category: 'UTC 오프셋' },
    { id: 'UTC+6:30', label: 'UTC+6:30', display: '(UTC+6:30) 양곤', category: 'UTC 오프셋' },
    { id: 'UTC+7', label: 'UTC+7', display: '(UTC+7) 방콕', category: 'UTC 오프셋' },
    { id: 'UTC+7', label: 'UTC+7', display: '(UTC+7) 자카르타', category: 'UTC 오프셋' },
    { id: 'UTC+7', label: 'UTC+7', display: '(UTC+7) 호치민', category: 'UTC 오프셋' },
    { id: 'UTC+8', label: 'UTC+8', display: '(UTC+8) 대만', category: 'UTC 오프셋' },
    { id: 'UTC+8', label: 'UTC+8', display: '(UTC+8) 마닐라', category: 'UTC 오프셋' },
    { id: 'UTC+8', label: 'UTC+8', display: '(UTC+8) 상하이', category: 'UTC 오프셋' },
    { id: 'UTC+8', label: 'UTC+8', display: '(UTC+8) 싱가폴', category: 'UTC 오프셋' },
    { id: 'UTC+8', label: 'UTC+8', display: '(UTC+8) 충칭', category: 'UTC 오프셋' },
    { id: 'UTC+8', label: 'UTC+8', display: '(UTC+8) 쿠알라 룸푸르', category: 'UTC 오프셋' },
    { id: 'UTC+8', label: 'UTC+8', display: '(UTC+8) 퍼스', category: 'UTC 오프셋' },
    { id: 'UTC+8', label: 'UTC+8', display: '(UTC+8) 홍콩', category: 'UTC 오프셋' },
    { id: 'UTC+9', label: 'UTC+9', display: '(UTC+9) 도쿄', category: 'UTC 오프셋' },
    { id: 'UTC+9', label: 'UTC+9', display: '(UTC+9) 서울', category: 'UTC 오프셋' },
    { id: 'UTC+9:30', label: 'UTC+9:30', display: '(UTC+9:30) 애들레이드', category: 'UTC 오프셋' },
    { id: 'UTC+10', label: 'UTC+10', display: '(UTC+10) 브리즈번', category: 'UTC 오프셋' },
    { id: 'UTC+10', label: 'UTC+10', display: '(UTC+10) 시드니', category: 'UTC 오프셋' },
    { id: 'UTC+11', label: 'UTC+11', display: '(UTC+11) 노포크 아일랜드', category: 'UTC 오프셋' },
    { id: 'UTC+12', label: 'UTC+12', display: '(UTC+12) 뉴질랜드', category: 'UTC 오프셋' },
    { id: 'UTC+12:45', label: 'UTC+12:45', display: '(UTC+12:45) 채텀 제도', category: 'UTC 오프셋' },
    { id: 'UTC+13', label: 'UTC+13', display: '(UTC+13) 토켈라우', category: 'UTC 오프셋' },
  ];
}
const UTC_OFFSET_OPTIONS = buildUtcOffsetOptions();
`;
if (!/function buildUtcOffsetOptions\(\): TimezoneOption\[\] \{[\s\S]*?const UTC_OFFSET_OPTIONS = buildUtcOffsetOptions\(\);/.test(text)) {
  console.error('Could not find buildUtcOffsetOptions block');
  process.exit(1);
}
text = text.replace(/function buildUtcOffsetOptions\(\): TimezoneOption\[\] \{[\s\S]*?const UTC_OFFSET_OPTIONS = buildUtcOffsetOptions\(\);/, utcBlock);
text = text.replace(/function parseUtcOffset\(timezone: string\): number \| null \{[\s\S]*?\n\}/, `function parseUtcOffset(timezone: string): number | null {
  if (timezone === 'UTC') return 0;
  const m = timezone.match(/^UTC([+-]\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const sign = m[1][0] === '-' ? -1 : 1;
  const hours = Number(m[1].slice(1));
  const minutes = m[2] ? Number(m[2]) : 0;
  return sign * (hours + minutes / 60);
}`);
fs.writeFileSync(path, text, 'utf8');
console.log('patched');
