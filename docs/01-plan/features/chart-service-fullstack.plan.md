# Chart Service Fullstack Plan

## 1. Purpose

기존 차트 엔진을 보존하면서 랜딩페이지, 회원가입, 로그인, 구독 신청, 입금 확인, 고객센터, 알림, 관리자 페이지를 갖춘 구독형 차트 서비스로 확장한다.

핵심 방향은 다음과 같다.

- 차트 렌더링/전략/드로잉 코어는 큰 구조 변경 없이 유지한다.
- 서비스 화면과 운영 기능은 Next.js 기반 풀스택 앱으로 확장한다.
- 초기에는 프론트와 백엔드를 한 저장소/한 앱에서 운영하되, API 계약을 분리해 추후 별도 백엔드로 이전 가능하게 설계한다.
- 결제 자동화는 1차 범위에서 제외하고, 관리자 수동 확인 기반으로 구독을 승인한다.

## 2. Current Context

현재 프로젝트는 Vite 기반 차트 앱이며 다음 자산이 이미 존재한다.

- 차트 코어: `src/chart`, `src/ui/workspace`, `src/app/init.ts`
- 전략 시스템: `src/strategy`, `src/strategy/strategies`
- 시세 게이트웨이: `server/data-gateway.mjs`
- 단순 관리자 화면: `public/admin.html`
- 관리자 설정 엔드포인트: 심볼/전략/패스프레이즈 중심

새 서비스 확장에서는 기존 차트 기능을 재작성하지 않고, 인증/권한/구독/알림 레이어에서 감싼다.

## 3. Product Scope

### In Scope

- 랜딩페이지
- 회원가입/로그인/비밀번호 재설정
- 마이프로필
- 무료체험 신청
- 구독 플랜 및 수동 결제 요청
- 관리자 입금 확인, 구독 승인, 환불/취소 처리
- 구독 권한 기반 차트/시그널 접근 제어
- 고객센터: 공지, FAQ, Q&A, 1:1 문의
- 온사이트 알림
- 텔레그램 시그널 알림 연동 준비
- 관리자 대시보드
- 회원, 구독, 결제요청, 문의, 심볼, 전략, 시그널, 영업자 관리
- 보안 기본값: RBAC, 감사로그, rate limit, 업로드 제한, secret 분리

### Out of Scope for Phase 1

- 카드/PG 자동결제
- 완전한 백엔드 서비스 분리
- 모바일 앱
- 실시간 채팅 상담
- 복잡한 회계/세금 정산 자동화
- 전략 실행 엔진 대규모 재작성

## 4. User Roles

- Guest: 랜딩, 플랜, 고객센터 공개글, 제한된 차트 미리보기 접근
- Member: 로그인 사용자, 무료체험 신청 가능, 제한된 마이프로필 접근
- Trial: 승인된 무료체험 사용자, 체험 기간 동안 차트/시그널 접근 가능
- Subscriber: 결제 확인 후 승인된 정회원, 구독 기간 동안 차트/시그널/부가서비스 접근 가능
- Salesperson: 추천코드/추천링크와 추천 매출 확인 가능
- Admin: 회원, 문의, 결제, 구독, 심볼, 전략, 시그널 운영 가능
- Super Admin: 관리자 관리, 보안 설정, 핵심 운영 설정 변경 가능

## 5. Subscription State Machine

구독은 다음 상태를 가진다.

- none: 구독 없음
- trial_requested: 무료체험 신청됨
- trial_active: 관리자가 무료체험 승인
- trial_expired: 무료체험 만료
- payment_requested: 사용자가 플랜 선택 후 결제 요청
- payment_pending: 입금/USDT 확인 대기
- active: 관리자가 입금 확인 후 구독 승인
- expiring: 만료 3일 전 알림 대상
- expired: 구독 기간 만료
- cancel_requested: 사용자가 취소 요청
- cancelled: 관리자가 취소 승인
- refund_requested: 환불 요청
- refunded: 관리자가 환불 처리 완료

관리자만 가능한 전이:

- `trial_requested -> trial_active`
- `payment_pending -> active`
- `cancel_requested -> cancelled`
- `refund_requested -> refunded`
- `active -> expired` 수동 보정

시스템 자동 전이:

- `trial_active -> trial_expired`
- `active -> expiring`
- `expiring -> expired`
- 추천포인트 `pending -> confirmed` 7일 경과 후

## 6. Access Rules

- Guest는 랜딩과 제한된 미리보기만 접근한다.
- Member는 무료체험/구독 신청과 본인 문의를 작성할 수 있다.
- Trial은 체험 종료 전까지 차트와 시그널을 볼 수 있다.
- Subscriber는 구독 기간 동안 차트, 시그널, 알림, 부가서비스를 사용할 수 있다.
- 구독 만료 시 차트 진입은 허용할 수 있으나 시그널과 유료 전략 표시는 비활성화한다.
- Admin/Super Admin은 운영 화면에 접근할 수 있으나 사용자 비밀번호 원문, 결제 민감정보, 토큰 원문은 볼 수 없다.

## 7. Architecture Direction

1차 구현은 Next.js 통합형을 권장한다.

- `app/(marketing)`: 랜딩, 구독플랜, 공개 고객센터
- `app/(auth)`: 로그인, 회원가입, 비밀번호 재설정
- `app/(user)`: 마이프로필, 구독정보, 알림, 내 문의
- `app/(chart)`: 기존 차트 앱 래핑
- `app/(admin)`: 관리자 백오피스
- `app/api`: 초기 서버 API
- `src/chart-core`: 기존 차트 관련 코드 재배치 또는 export 래핑
- `src/domain`: 권한, 구독, 결제, 알림 도메인 로직
- `src/server`: DB 접근, 인증 세션, 관리자 서버 로직

추후 백엔드 분리를 위해 프론트는 항상 API 클라이언트를 통해 서버와 통신한다.

## 8. Data Domains

필수 도메인:

- users
- profiles
- auth_sessions
- subscriptions
- subscription_plans
- payment_requests
- payment_accounts
- support_threads
- support_messages
- notices
- faqs
- notifications
- signal_events
- signal_delivery_logs
- symbols
- strategies
- strategy_assignments
- referrals
- referral_ledger
- admins
- audit_logs
- user_settings

## 9. Security Plan

- 비밀번호는 서버에서 해시 저장한다.
- 로그인은 userId 우회가 아니라 이메일/비밀번호 검증 후 세션을 발급한다.
- 관리자 계정은 별도 role과 감사로그를 가진다.
- 관리자 주요 액션은 `audit_logs`에 기록한다.
- 런타임 secret은 파일 커밋 대상에서 제거하고 환경변수로 이전한다.
- 프로필 이미지는 1차에서 `jpg`, `jpeg`, `png`, `webp`만 허용한다.
- `svg`, `gif` 업로드는 1차에서 제외한다.
- 업로드 크기는 200KB 제한을 유지하되 서버에서 재검증한다.
- 관리자 API, 로그인, 결제요청, 문의 등록은 rate limit을 둔다.
- 고객센터 비밀글은 작성자와 관리자만 조회 가능하게 서버에서 강제한다.
- 차트 시그널 API는 클라이언트 숨김이 아니라 서버 권한 검사를 통과해야 응답한다.

## 10. Implementation Phases

### Phase 1: Foundation

- Next.js 전환 구조 확정
- 라우팅 그룹 설계
- 인증/권한/RBAC 모델 작성
- 데이터 모델 작성
- 기존 차트 엔트리 래핑 방식 확정

### Phase 2: Auth and User Shell

- 회원가입/로그인
- 마이프로필
- 세션 유지
- 기본 네비게이션
- 사용자 설정 저장

### Phase 3: Subscription Operations

- 플랜 관리
- 결제요청
- 입금확인 대기
- 관리자 구독 승인
- 만료/취소/환불 상태 처리
- 구독 기반 접근 제어

### Phase 4: Chart Integration

- 기존 차트를 Next.js 화면에 탑재
- 시그널 표시 권한 가드
- 차트 미리보기 5분 제한
- 유료 전략/시그널 상태 연동

### Phase 5: Support and Notifications

- 공지/FAQ/Q&A/1:1 문의
- 관리자 답변
- 온사이트 알림
- 구독만료 D-3 알림
- 텔레그램 연동 준비

### Phase 6: Admin Backoffice

- 대시보드
- 회원관리
- 구독관리
- 결제요청 관리
- 심볼/전략/시그널 관리
- 영업자/추천포인트 관리
- 관리자관리
- 감사로그

### Phase 7: Hardening and Deploy

- 보안 점검
- rate limit
- `/api/health` readiness 확인
- 백업/복구
- 운영 환경변수 정리
- 빌드/테스트/배포 하네스

## 11. Agent Assignment

- Product/PM Agent: 요구사항, 화면 흐름, 운영 정책 관리
- Architecture Agent: Next.js 구조, 백엔드 분리 가능성, 도메인 경계 관리
- Auth/Security Agent: 인증, RBAC, 세션, 업로드, rate limit, 감사로그
- Subscription Agent: 플랜, 입금확인, 승인, 만료, 취소, 환불, 추천포인트
- Chart Integration Agent: 기존 차트 탑재, 시그널 권한, 사용자 설정
- Support/Notification Agent: 고객센터, 알림, 텔레그램 이벤트
- Admin Agent: 관리자 대시보드와 운영 화면
- QA/Harness Agent: 테스트 시나리오, 빌드, seed data, smoke test

단일 에이전트 모드에서는 위 역할을 순서대로 적용한다.

## 12. Harness Plan

- `npm run build`: 전체 타입/빌드 검증
- `npm run service:build`: Next.js 서비스 라우트/페이지 프로덕션 빌드 검증
- `npm run service:check`: 실서비스 환경변수와 저장소 어댑터 준비 상태 검증
- `npm run service:schema`: Postgres 적용용 SQL 스키마 생성
- `node --test tests/*.test.mjs`: 기존 차트/전략 테스트
- `npm run dev`: 통합 개발 서버
- seed data: 관리자, 일반회원, 체험회원, 정회원, 만료회원, 결제대기 사용자
- smoke tests:
  - Guest 랜딩 접근
  - Member 무료체험 신청
  - Admin 무료체험 승인
  - Trial 차트 시그널 접근
  - Member 구독 결제요청
  - Admin 입금확인 후 active 전환
  - Admin 대시보드 큐 카드에서 결제/구독/고객센터/회원관리 필터 이동
  - Expired 사용자의 시그널 차단
  - 1:1 문의 작성/관리자 답변/알림 생성

## 13. Success Criteria

- 기존 차트의 주요 기능이 유지된다.
- 구독 상태에 따라 차트/시그널 접근이 정확히 제어된다.
- 관리자가 입금확인, 구독승인, 취소, 환불을 처리할 수 있다.
- 고객센터 비밀글 권한이 서버에서 강제된다.
- 운영상 중요한 관리자 액션이 감사로그에 남는다.
- 추후 백엔드 분리가 가능하도록 API 계약과 도메인 로직이 UI에서 분리된다.
