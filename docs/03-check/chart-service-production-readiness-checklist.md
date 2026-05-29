# Chart Service Production Readiness Checklist

작성일: 2026-05-26

## 1. 현재 결론

TradingCore의 TC Chart 구독 서비스는 더 이상 단순 화면 목업만 있는 상태는 아니다. 회원가입, 로그인, 구독 신청, 수동 입금확인, 구독 승인, 알림, 고객센터, 관리자 운영 화면, 추천/영업/포인트, 웹정보관리, Postgres 어댑터 준비 코드까지 상당 부분 구현되어 있다.

다만 현재 상태를 바로 실서비스로 열면 안 된다. 이유는 다음과 같다.

- 일부 기능은 메모리 저장소 fallback을 통해 동작한다.
- 실제 운영 DB, 환경변수, 마이그레이션, 초기 관리자 bootstrap이 운영 환경에서 검증되어야 한다.
- 관리자/결제/환불/구독/영업 포인트는 금전과 연결되므로 권한, 감사로그, 상태 전이 QA가 더 필요하다.
- 가입/구독/프로필/고객센터/관리자 UI는 기능은 많지만 최종 UX 품질 점검이 필요하다. 랜딩페이지는 공개용 문구, 섹션 구조, CTA, 다크 라임 디자인 기준을 출시 전 완료 항목으로 고정한다.

따라서 다음 단계는 신규 기능 추가가 아니라 **실서비스 전환 스프린트**로 고정한다.

## 2. 목업 중단 기준

다음 기준을 만족하기 전까지는 새 기능 추가보다 출시 준비를 우선한다.

- [ ] 신규 메뉴/신규 기능 추가를 일시 중단한다.
- [ ] 회원가입부터 구독 승인까지 핵심 사용자 플로우를 고정한다.
- [ ] 관리자 수동 처리 플로우를 고정한다.
- [ ] 실제 DB 연결 모드에서 전체 테스트를 통과시킨다.
- [ ] 운영 환경변수와 보안 헤더를 점검한다.
- [x] 랜딩 화면을 공개용 최종 문구와 디자인 완료 기준으로 정리한다.
- [ ] 구독/가입/로그인/프로필/고객센터/관리자 화면을 1차 디자인 완료 기준으로 정리한다.
- [ ] QA 체크리스트를 통과한 항목만 “출시 가능”으로 표시한다.

## 3. 기능별 준비 상태

| 영역 | 현재 상태 | 실서비스 전환 전 필요 작업 |
| --- | --- | --- |
| 랜딩페이지 | 공개용 최종 문구/섹션/CTA/다크 라임 디자인 적용 | 모바일 반응형 실기기 QA, 배포 후 CTA 링크 스모크 검증 |
| 회원가입 | 연락번호, 비밀번호 확인, 약관 동의, 이메일 중복확인, 추천코드 확인 구현 | 이메일 인증 여부 결정, 약관 동의 DB 증거 운영 DB 검증 |
| 로그인/세션 | 쿠키 기반 세션, 로그아웃, auth/me 구현 | 운영 세션 secret, 쿠키 secure 설정, 만료/재로그인 QA |
| 비밀번호 재설정 | 토큰/이메일 outbox 구조 있음 | 실제 메일 발송 설정, 발송 실패 재시도 정책 |
| 구독 신청 | 단계형 플랜 선택/결제방식/입금확인 요청 구현 | 실제 입금자명/TXID 운영 검증, 중복 신청 방지 정책 |
| 입금 확인 | 관리자 수동 입금확인 후 구독승인 2단계 구현 | 운영 상태 전이 QA, 반려/취소/환불 케이스 재검증 |
| USDT TXID | TronScan 확인 배지/재확인/외부 링크 흐름 구현 | 실제 TronGrid/TronScan API 키 정책, rate limit, 실패 처리 |
| 마이프로필 | 연락번호/비밀번호/추천/구독 상태/알림 연결 구현 | 개인정보 수정 이력, 비밀번호 변경 실패 메시지 QA |
| 고객센터 | 1:1 문의, 답변, 상세 이동, 알림 연결 구현 | 첨부파일 여부 결정, pagination, 답변 완료/닫기 정책 |
| 알림센터 | 탭 필터, 읽음 처리, 링크 이동 구현 | 대량 알림 pagination, 알림 보존 기간 정책 |
| 관리자 대시보드 | 좌측 메뉴, 운영개요, 회원/입금/구독/영업/통계/감사로그 구현 | 페이지별 권한, 모바일 또는 최소 해상도 정책 |
| 웹정보관리 | 약관/개인정보/입금정보/포인트/플랜서비스 관리 구현 | 운영 DB 저장 검증, 변경 감사로그 보강 |
| 추천/포인트 | 추천코드, 추천링크, 7일 후 확정 로직 구현 | 스케줄러 또는 배치 실행 방식 확정 |
| 영업관리 | 영업팀, 영업자 배치, 매출/포인트 집계 구현 | 엑셀 출력 검증, 기간 필터 정확도, 개별/팀 정산율 충돌 정책 |
| 통계 | 매출/가입자/방문자 통계 UI 구현 | 실제 방문자 수집 방식, 운영 데이터 기준 검증 |
| 차트 접근 | 구독 상태 기반 접근 구조 있음 | 실제 구독 만료/권한 변경 시 차트 차단 QA |
| KIS/MetaTrader | 이번 범위에서 보류 | 실서비스 전환 후 별도 데이터 공급자 스프린트로 분리 |

## 4. 저장소/DB 전환 체크리스트

현재 코드에는 메모리 저장소와 Postgres 저장소를 선택하는 adapter 구조가 있다. 실서비스에서는 반드시 persistent repository를 사용해야 한다.

- [ ] `CHART_SERVICE_REPOSITORY=postgres` 설정
- [ ] `CHART_SERVICE_DATABASE_URL` 설정
- [ ] 운영 DB SSL 모드 `require`, `verify-ca`, `verify-full` 중 하나로 설정
- [ ] `CHART_SERVICE_SESSION_SECRET` 32자 이상으로 설정
- [ ] Postgres migration 실행
- [ ] 초기 관리자 계정 bootstrap 실행
- [ ] 기본 구독 플랜 seed 확인
- [ ] 결제정보/약관/개인정보/포인트 설정 seed 확인
- [ ] 메모리 fallback에서만 보이던 데이터가 없는지 점검
- [ ] 실제 DB 모드에서 `npm.cmd run service:build` 통과
- [ ] 실제 DB 모드에서 핵심 API smoke test 통과

## 5. 보안/권한 체크리스트

- [ ] 관리자 API는 admin 또는 super_admin 세션 없이는 접근 불가
- [ ] super_admin 전용 설정은 일반 admin 접근 불가
- [ ] 결제 확인, 반려, 환불, 구독승인, 구독취소는 모두 감사로그 기록
- [ ] 회원 개인정보 응답에서 passwordHash 미노출
- [ ] 추천인 확인 API는 전체 이메일 미노출
- [ ] 비밀번호 정책은 가입/변경/재설정에 동일 적용
- [ ] CSRF 또는 mutation guard 정책 점검
- [ ] 로그인/가입/비밀번호 재설정 rate limit 점검
- [ ] 파일 업로드가 있다면 확장자/용량/저장 위치 제한
- [ ] 운영 secret이 git에 포함되지 않는지 점검

## 6. 운영 QA 시나리오

### 사용자 플로우

- [ ] 신규 회원가입: 연락번호 자동 하이픈, 이메일 중복확인, 비밀번호 확인, 약관 동의
- [ ] 추천링크 가입: 추천코드 자동 고정, 추천인 마스킹 표시
- [ ] 직접 추천코드 가입: 추천인 확인 후 가입
- [ ] 로그인/로그아웃/세션 만료
- [ ] 무료체험 신청은 로그인 회원만 가능
- [ ] 구독 플랜 선택 후 은행이체 입금자명 없으면 다음 단계 차단
- [ ] USDT 결제 시 TXID 입력 및 확인 상태 표시
- [ ] 마이프로필에서 구독/결제/환불/취소 상태 확인
- [ ] 고객센터 문의 등록 후 관리자 답변을 알림/상세 화면에서 확인

### 관리자 플로우

- [ ] 관리자 로그인 후 관리자 페이지 진입
- [ ] 입금확인 대기 결제 확인 처리
- [ ] 입금확인 후 구독승인 처리
- [ ] 미입금 반려 처리
- [ ] 취소/환불 요청 승인 및 반려 처리
- [ ] 회원 상세에서 이름/이메일/연락번호/추천인/가입일 확인
- [ ] 영업팀 등록, 영업자 배치, 기간별 집계 확인
- [ ] 포인트 설정 변경은 super_admin만 가능
- [ ] 약관/개인정보/입금정보/플랜서비스 수정 후 사용자 화면 반영
- [ ] 감사로그에서 주요 처리 이력 확인

## 7. 출시 전 작업 순서

1. DB 운영 모드 고정
   - Postgres 환경변수, migration, bootstrap, seed 검증을 먼저 끝낸다.

2. 핵심 플로우 QA 자동화
   - 가입, 로그인, 구독신청, 입금확인, 구독승인, 고객센터 답변, 알림 이동을 smoke test로 묶는다.

3. 관리자 권한/감사로그 잠금
   - 금전/구독/포인트 관련 API는 권한과 감사로그를 먼저 닫는다.

4. UX 정리
   - 화면 추가가 아니라 문구, 빈 상태, 에러 상태, 모바일, 버튼 배치를 정리한다.

5. 운영 리허설
   - 실제 운영 DB와 운영 환경변수로 staging 실행 후 체크리스트를 통과시킨다.

## 8. 다음 작업 지시

다음 작업부터는 아래 원칙을 따른다.

- 새 기능 제안이 나오면 먼저 이 체크리스트에서 출시 필수인지 분류한다.
- 출시 필수가 아니면 `post-launch backlog`로 미룬다.
- 출시 필수이면 DB/권한/QA 기준까지 한 번에 닫는다.
- 화면 목업 수정만으로 끝내지 않고, 테스트 또는 빌드 검증을 함께 남긴다.

첫 번째 실행 작업은 **DB 운영 모드 readiness 점검 및 부족 항목 보강**이다.

## 9. 2026-05-26 DB Readiness 1차 점검 결과

완료한 항목:

- [x] production memory repository 사용 시 `service:check`가 실패하도록 확인했다.
- [x] production Postgres repository 설정, DB URL, SSL, session secret이 준비되면 `service:check`가 통과하도록 확인했다.
- [x] `/`, `/pricing`, `/support` 서버 페이지가 동기 mock repository 대신 async persistence boundary를 사용하도록 전환했다.
- [x] 런타임 DB를 읽는 공개 페이지 3곳에 `dynamic = 'force-dynamic'`을 선언해 빌드 타임 정적 프리렌더링 의존을 제거했다.
- [x] 공개 게시판 목록 조회에 async repository 헬퍼를 추가했다.
- [x] 관련 테스트와 Next service build를 통과시켰다.

검증 명령:

- `node --test tests\chart-service-runtime-readiness.test.mjs tests\chart-service-ui-operations.test.mjs tests\chart-service-support.test.mjs`
- `npm.cmd run service:build`
- `npm.cmd run service:check`
- `NODE_ENV=production CHART_SERVICE_REPOSITORY=memory npm.cmd run service:check` 실패 확인
- `NODE_ENV=production CHART_SERVICE_REPOSITORY=postgres CHART_SERVICE_DATABASE_URL=... CHART_SERVICE_DATABASE_SSL_MODE=require CHART_SERVICE_SESSION_SECRET=... npm.cmd run service:check` 통과 확인

다음 실행 항목:

- [ ] 실제 Postgres 연결 환경에서 migration과 bootstrap을 실행한다.
- [ ] 실제 Postgres 연결 환경에서 핵심 smoke test를 실행한다.
- [ ] seed 데이터와 관리자 계정 생성 결과를 검증한다.
- [ ] DB 모드에서 구독 신청, 입금확인, 구독승인, 고객센터 답변, 알림 이동 플로우를 순차 QA한다.
## 10. 2026-05-26 Runtime/Design Stack Decision

Completed:

- [x] Added runtime readiness check for initial super-admin bootstrap credentials.
- [x] Missing bootstrap credentials are reported as a non-blocking warning so existing production admins can continue.
- [x] Fully configured bootstrap email, password, and display name are reported as pass.
- [x] Current UI stack confirmed: custom CSS only. Tailwind and Bootstrap are not installed.

Decision:

- Do not add Bootstrap. It would add a second opinionated layout system and create avoidable churn.
- Do not introduce Tailwind during production-readiness stabilization. The current custom CSS should remain until DB, security, and QA gates are locked.
- Tailwind can be reconsidered in a later design-system refactor if we want utility classes, component extraction, and faster page-level redesign.

Verification:

- `node --test tests\chart-service-runtime-readiness.test.mjs`
## 16. 2026-05-26 CI Release Gate Automation

Completed:

- [x] Updated `.github/workflows/chart-service-ci.yml`.
- [x] CI now runs `npm.cmd run service:verify`.
- [x] CI now runs `npm.cmd run service:postgres:gate` in dry-run mode with production-like Postgres env.
- [x] CI workflow coverage verifies release gate, Postgres gate, bootstrap admin env, and chart app build steps.

Verification:

- `node --test tests\chart-service-ci-workflow.test.mjs tests\chart-service-deployment-runbook.test.mjs tests\chart-service-release-gate.test.mjs tests\chart-service-postgres-release-gate.test.mjs`
- `CHART_SERVICE_POSTGRES_GATE_DRY_RUN=1 ... npm.cmd run service:postgres:gate`
- `npm.cmd run service:verify`

## 15. 2026-05-26 Deployment Runbook

Completed:

- [x] Added `docs/04-deploy/chart-service-deployment-runbook.md`.
- [x] Documented local verification, Postgres dry-run, production Postgres gate, health check, manual smoke, and rollback.
- [x] Added test coverage to keep required env variables and release commands documented.

Verification:

- `node --test tests\chart-service-deployment-runbook.test.mjs`

## 14. 2026-05-26 Postgres Release Gate

Completed:

- [x] Added `npm.cmd run service:postgres:gate`.
- [x] Postgres gate requires `CHART_SERVICE_REPOSITORY=postgres`, `CHART_SERVICE_DATABASE_URL`, and `CHART_SERVICE_SESSION_SECRET`.
- [x] Postgres gate runs readiness check, bootstrap including migration, security tests, and service build.
- [x] Added dry-run coverage so the deployment order can be verified without touching a real database.

Usage:

- Dry run: set `CHART_SERVICE_POSTGRES_GATE_DRY_RUN=1` with the required Postgres env values, then run `npm.cmd run service:postgres:gate`.
- Real DB run: set the same env values without dry-run, then run `npm.cmd run service:postgres:gate`.

Verification:

- `node --test tests\chart-service-postgres-release-gate.test.mjs tests\chart-service-release-gate.test.mjs`
- `CHART_SERVICE_POSTGRES_GATE_DRY_RUN=1 ... npm.cmd run service:postgres:gate`
- `npm.cmd run service:verify`

## 13. 2026-05-26 Security Gate Expansion

Completed:

- [x] Added `npm.cmd run service:security`.
- [x] Release gate now runs readiness, security, smoke, and build checks in order.
- [x] Payment transfer setting changes now write audit logs.
- [x] Security gate covers mutation guard, admin/user async route boundaries, password policy, auth response redaction, and payment setting audit evidence.

Verification:

- `npm.cmd run service:security`
- `npm.cmd run service:verify`
- `node --test tests\chart-service-payment-settings.test.mjs tests\chart-service-release-gate.test.mjs`

## 12. 2026-05-26 Release Gate Harness

Completed:

- [x] Added `npm.cmd run service:verify`.
- [x] Release gate runs readiness check, service smoke, and Next service build in order.
- [x] Added dry-run coverage so the gate wiring can be tested quickly.
- [x] Adjusted Windows command invocation to avoid shell argument deprecation warnings.

Verification:

- `node --test tests\chart-service-release-gate.test.mjs`
- `npm.cmd run service:verify`

## 11. 2026-05-26 Service Smoke Harness

Completed:

- [x] Added `npm.cmd run service:smoke`.
- [x] Smoke harness runs the core memory-backed operations flow through async service functions.
- [x] Covered bootstrap, signup, manual bank-transfer payment request, admin payment confirmation, subscription approval, support reply, and profile dashboard access.
- [x] Added test coverage for script wiring and successful smoke execution.

Verification:

- `node --test tests\chart-service-smoke-harness.test.mjs`
- `npm.cmd run service:smoke`
- `node --test tests\chart-service-smoke-harness.test.mjs tests\chart-service-bootstrap.test.mjs tests\chart-service-runtime-readiness.test.mjs`

## 18. 2026-05-26 Production Env Template Hardening

Completed:

- [x] `.env.production.example` now separates committed defaults from runtime secrets.
- [x] Database URL, session secret, and bootstrap admin credentials stay blank in git.
- [x] The template documents the current email delivery harness defaults.
- [x] Deployment runbook now points operators to `.env.production.example`.
- [x] Tests block demo passwords, fake session secrets, and sample DB URLs from the production template/runbook.

Verification:

- `node --test tests\chart-service-production-env-template.test.mjs tests\chart-service-deployment-runbook.test.mjs`

## 19. 2026-05-26 Initial Admin Login Smoke

Completed:

- [x] Service smoke harness now bootstraps an initial super admin account.
- [x] Smoke flow authenticates that admin with a real password check before admin-only operations.
- [x] Deposit confirmation, subscription approval, and support reply now use the authenticated admin actor.

Verification:

- `node --test tests\chart-service-smoke-harness.test.mjs`
- `npm.cmd run service:smoke`

## 20. 2026-05-26 Unified Launch Check

Completed:

- [x] Added `npm.cmd run service:launch-check` as the single launch-readiness command.
- [x] Launch check runs `service:verify`, production docs/env tests, email delivery harness, and Postgres dry-run gate.
- [x] CI now calls `service:launch-check` instead of separate release, email, and Postgres dry-run steps.
- [x] CI no longer carries sample DB URLs, fake session secrets, or demo admin passwords in workflow env.
- [x] Deployment runbook now promotes `service:launch-check` as the preferred pre-deployment command.

Verification:

- `node --test tests\chart-service-launch-check.test.mjs tests\chart-service-ci-workflow.test.mjs tests\chart-service-deployment-runbook.test.mjs`
- `npm.cmd run service:launch-check`

## 21. 2026-05-26 Postgres Admin Login Gate

Completed:

- [x] Added `npm.cmd run service:postgres:admin-check`.
- [x] Real Postgres gate now runs admin login verification immediately after bootstrap.
- [x] Postgres gate now requires bootstrap admin email/password so first-launch access is verified, not assumed.
- [x] Deployment runbook documents the 5-step Postgres gate order.

Verification:

- `node --test tests\chart-service-postgres-release-gate.test.mjs tests\chart-service-deployment-runbook.test.mjs`
- `npm.cmd run service:launch-check`

## 22. 2026-05-26 Production Env Doctor

Completed:

- [x] Added `npm.cmd run service:prod-env:check`.
- [x] The doctor validates production mode, Postgres repository mode, database URL syntax, SSL mode, session secret strength, email delivery settings, and bootstrap admin credentials.
- [x] The doctor redacts database user/password and never prints the bootstrap admin password.
- [x] Postgres gate now starts with `service:prod-env:check`, so unsafe env values fail before database migration/login work.
- [x] Deployment runbook documents the 6-step Postgres gate order.

Verification:

- `node --test tests\chart-service-production-env-doctor.test.mjs tests\chart-service-postgres-release-gate.test.mjs tests\chart-service-deployment-runbook.test.mjs`
- `npm.cmd run service:launch-check`

## 23. 2026-05-26 Post-Deploy Health Smoke

Completed:

- [x] Added `npm.cmd run service:postdeploy:smoke`.
- [x] The smoke checks `/api/health`, `/api/auth/login`, and `/api/admin/dashboard` against a deployed base URL.
- [x] The smoke verifies the health payload does not expose database connection strings.
- [x] The smoke verifies admin login returns a session cookie and the protected admin dashboard accepts it.
- [x] Deployment runbook documents the post-deploy command and required env values.

Verification:

- `node --test tests\chart-service-postdeploy-smoke.test.mjs tests\chart-service-deployment-runbook.test.mjs`
- `npm.cmd run service:launch-check`

## 24. 2026-05-26 Operator Launch Guide

Completed:

- [x] Added `npm.cmd run service:launch-guide`.
- [x] The guide prints the operational sequence from secret preparation through post-deploy smoke.
- [x] The guide redacts database user/password and never prints the bootstrap admin password.
- [x] Launch check now includes the launch guide regression test.
- [x] Deployment runbook documents the guide command.

Verification:

- `node --test tests\chart-service-launch-guide.test.mjs tests\chart-service-deployment-runbook.test.mjs tests\chart-service-launch-check.test.mjs`
- `npm.cmd run service:launch-check`

## 25. 2026-05-27 Readiness Output Clarity

Completed:

- [x] `service:check` now prints a `[READINESS TARGET]` line.
- [x] Local launch-check warnings are explicitly labeled as expected local warnings.
- [x] Production Postgres readiness output is labeled separately from local development checks.
- [x] Launch check now includes the readiness output regression test.

Verification:

- `node --test tests\chart-service-readiness-output.test.mjs tests\chart-service-launch-check.test.mjs`
- `npm.cmd run service:launch-check`

## 26. 2026-05-27 Release Gap Report

Completed:

- [x] Added `npm.cmd run service:release-gap-report`.
- [x] The report separates ready gates, real-environment requirements, and post-launch backlog.
- [x] The report calls out real Postgres, manual bank transfer policy, external email provider, browser QA, KIS/MetaTrader, and analytics gaps.
- [x] Database URL output is redacted and admin password is never printed.
- [x] Launch check now includes the release gap report regression test.

Verification:

- `node --test tests\chart-service-release-gap-report.test.mjs tests\chart-service-launch-check.test.mjs`
- `npm.cmd run service:launch-check`
