# Chart Service Fullstack Design

## 1. Design Summary

이 설계는 기존 차트 프로젝트를 구독형 풀스택 서비스로 확장하기 위한 기준 문서다.

핵심 원칙:

- 차트 코어는 가능한 한 수정하지 않는다.
- Next.js는 라우팅, 인증 화면, 관리자 화면, 서버 API의 외피를 담당한다.
- 도메인 로직은 UI와 분리해 추후 독립 백엔드로 이동 가능하게 만든다.
- 결제와 구독 활성화는 관리자 수동 확인을 기준으로 한다.
- 보안 검사는 클라이언트 표시 제어가 아니라 서버 권한 검사로 강제한다.

## 2. Target Architecture

```text
Browser
  -> Next.js Pages and Components
  -> API Client
  -> Next.js Route Handlers / Server Actions
  -> Domain Services
  -> Repository Layer
  -> Database / Existing Data Gateway / External APIs
```

장기 분리 구조:

```text
Browser
  -> Frontend App
  -> Stable REST API
  -> Separate Backend Service
  -> Database / Workers / Data Gateway
```

초기에는 Next.js 내부 API로 시작하지만, 프론트는 직접 DB 접근을 하지 않고 API client만 사용한다.

## 3. Proposed Directory Layout

```text
src/
  app/
    (marketing)/
      page.tsx
      pricing/page.tsx
      support/page.tsx
    (auth)/
      login/page.tsx
      signup/page.tsx
      forgot-password/page.tsx
    (user)/
      profile/page.tsx
      subscription/page.tsx
      notifications/page.tsx
      support/my/page.tsx
    (chart)/
      chart/page.tsx
    (admin)/
      admin/page.tsx
      admin/members/page.tsx
      admin/subscriptions/page.tsx
      admin/payments/page.tsx
      admin/support/page.tsx
      admin/symbols/page.tsx
      admin/strategies/page.tsx
      admin/signals/page.tsx
      admin/sales/page.tsx
      admin/settings/page.tsx
    api/
      auth/
      subscriptions/
      payments/
      support/
      notifications/
      admin/
      chart/
  chart-core/
    chart/
    strategy/
    data/
    ui/
  domain/
    auth/
    subscriptions/
    payments/
    support/
    notifications/
    signals/
    admin/
  server/
    db/
    repositories/
    services/
    security/
  components/
    layout/
    ui/
    admin/
    user/
```

기존 `src/chart`, `src/strategy`, `src/data`, `src/ui/workspace`는 바로 대규모 이동하지 않는다. 1차에서는 import boundary를 만들고, 안정화 후 `chart-core`로 정리한다.

## 4. Route Design

공개 라우트:

- `/`: 랜딩페이지
- `/pricing`: 구독플랜
- `/support`: 고객센터 공개 목록
- `/support/notices`: 공지사항
- `/support/faq`: FAQ
- `/chart/preview`: 5분 미리보기

인증 라우트:

- `/signup`
- `/login`
- `/forgot-password`

사용자 라우트:

- `/profile`
- `/subscription`
- `/notifications`
- `/support/my`
- `/chart`

관리자 라우트:

- `/admin`
- `/admin/members`
- `/admin/subscriptions`
- `/admin/payments`
- `/admin/support`
- `/admin/symbols`
- `/admin/strategies`
- `/admin/signals`
- `/admin/sales`
- `/admin/settings`
- `/admin/audit-logs`

## 5. Role and Permission Matrix

```text
Permission                         Guest  Member  Trial  Subscriber  Sales  Admin  SuperAdmin
View landing                       yes    yes     yes    yes         yes    yes    yes
View chart preview                 yes    yes     yes    yes         yes    yes    yes
Use full chart                     no     no      yes    yes         by sub yes    yes
View paid signals                  no     no      yes    yes         by sub yes    yes
Request trial                      no     yes     no     no          yes    yes    yes
Request subscription payment       no     yes     yes    yes         yes    yes    yes
Write 1:1 support                  no     yes     yes    yes         yes    yes    yes
View own private support           no     yes     yes    yes         yes    yes    yes
Manage members                     no     no      no     no          no     yes    yes
Approve subscription               no     no      no     no          no     yes    yes
Refund/cancel subscription         no     no      no     no          no     yes    yes
Manage admins                      no     no      no     no          no     no     yes
View audit logs                    no     no      no     no          no     yes    yes
```

## 6. Core Data Model

### users

- id
- email
- password_hash
- email_verified_at
- status: active, suspended, withdrawn
- created_at
- updated_at

### profiles

- user_id
- name
- nickname
- phone_country
- phone_number
- avatar_url
- role: member, salesperson, admin, super_admin
- created_at
- updated_at

### subscription_plans

- id
- name
- duration_days
- base_price_usd
- discount_percent
- is_active
- created_at
- updated_at

### subscriptions

- id
- user_id
- plan_id
- status
- starts_at
- ends_at
- approved_by_admin_id
- approved_at
- cancelled_at
- refunded_at
- created_at
- updated_at

### payment_requests

- id
- user_id
- plan_id
- subscription_id
- method: bank_transfer, usdt
- amount_usd
- amount_krw
- exchange_rate
- referral_points_used
- status: requested, pending, confirmed, rejected, cancelled, refunded
- depositor_name
- admin_note
- confirmed_by_admin_id
- confirmed_at
- created_at
- updated_at

### payment_accounts

- id
- method
- bank_name
- account_number
- account_holder
- usdt_network
- usdt_address
- is_active
- updated_by_admin_id
- updated_at

### support_threads

- id
- author_user_id
- category: deposit, cancel, partnership, usage, signal, general
- title
- visibility: public, private
- status: waiting, answered, closed
- created_at
- updated_at

### support_messages

- id
- thread_id
- author_user_id
- body
- is_admin_reply
- created_at

### notifications

- id
- user_id
- category: support_reply, qna, subscription, signal, expiry, notice
- title
- body
- link_url
- read_at
- created_at

### signal_events

- id
- symbol
- timeframe
- strategy_id
- side: buy, sell
- entry_price
- stop_loss
- take_profit
- opened_at
- closed_at
- created_at

### referrals

- id
- referrer_user_id
- code
- is_approved
- approved_by_admin_id
- approved_at
- created_at

### referral_ledger

- id
- referrer_user_id
- referred_user_id
- payment_request_id
- amount_usd
- percent
- points
- status: pending, confirmed, reversed
- confirm_after
- confirmed_at
- reversed_at
- created_at

### audit_logs

- id
- actor_admin_id
- action
- target_type
- target_id
- before_json
- after_json
- ip_address
- user_agent
- created_at

### user_settings

- user_id
- chart_symbol
- chart_timeframe
- chart_layout_json
- notification_settings_json
- updated_at

## 7. API Contract Draft

Auth:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`

Profile:

- `GET /api/profile`
- `PATCH /api/profile`
- `POST /api/profile/avatar`

Subscriptions:

- `GET /api/subscription/plans`
- `GET /api/subscription/me`
- `POST /api/subscription/trial-request`
- `POST /api/payments/request`
- `POST /api/subscription/cancel-request`
- `POST /api/subscription/refund-request`

Chart:

- `GET /api/chart/access`
- `GET /api/chart/signals`
- `POST /api/chart/preview/start`
- `GET /api/chart/settings`
- `PATCH /api/chart/settings`

Support:

- `GET /api/support/notices`
- `GET /api/support/faq`
- `GET /api/support/threads`
- `POST /api/support/threads`
- `GET /api/support/threads/:id`
- `POST /api/support/threads/:id/messages`

Notifications:

- `GET /api/notifications`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/read-all`

Admin:

- `GET /api/admin/dashboard`
- `GET /api/admin/members`
- `PATCH /api/admin/members/:id`
- `GET /api/admin/payments`
- `POST /api/admin/payments/:id/confirm`
- `POST /api/admin/payments/:id/reject`
- `GET /api/admin/subscriptions`
- `POST /api/admin/subscriptions/:id/approve`
- `POST /api/admin/subscriptions/:id/cancel`
- `POST /api/admin/subscriptions/:id/refund`
- `GET /api/admin/support`
- `POST /api/admin/support/:id/reply`
- `GET /api/admin/signals`
- `GET /api/admin/audit-logs`

## 8. Manual Payment and Subscription Flow

1. 사용자가 플랜을 선택한다.
2. 사용자가 결제수단을 선택한다.
3. 서버가 환율과 추천포인트를 반영해 결제요청을 생성한다.
4. 상태는 `payment_pending`이 된다.
5. 관리자가 입금/USDT 수신을 확인한다.
6. 관리자가 `입금확인`을 누른다.
7. 서버가 payment request를 `confirmed`로 바꾼다.
8. 서버가 subscription을 `active`로 만들고 시작/종료일을 기록한다.
9. 서버가 사용자에게 `구독승인` 알림을 만든다.
10. 추천포인트가 있으면 `pending` ledger를 만들고 7일 후 확정한다.

취소/환불은 관리자 확인 후 처리한다.

- 취소 승인: 구독 상태를 `cancelled`로 변경하고 접근권한을 제거한다.
- 환불 완료: 결제요청을 `refunded`로 변경하고 추천포인트 ledger를 `reversed`로 변경한다.

## 9. Chart Integration Design

기존 차트는 다음 경계를 통해 서비스와 연결한다.

- `ChartAccessGate`: 구독/체험 상태 확인
- `SignalVisibilityGate`: 시그널 표시 가능 여부 확인
- `ChartSettingsAdapter`: 기존 localStorage 설정과 계정 설정 동기화
- `StrategyCatalogAdapter`: 관리자 전략 설정과 기존 전략 목록 연결
- `SymbolCatalogAdapter`: 관리자 심볼 설정과 기존 심볼 목록 연결

차트 코어 파일 수정 원칙:

- `SimpleChart.ts`에는 구독/인증 로직을 넣지 않는다.
- 차트 UI 상단에 서비스 네비게이션을 직접 섞지 않는다.
- 권한 체크는 차트 바깥 page/layout/service 레이어에서 처리한다.
- 필요한 경우 시그널 렌더러에 `visible: boolean` 같은 작은 입력값만 전달한다.

## 10. Admin Design

관리자 페이지는 운영자가 반복 업무를 빠르게 처리하도록 구성한다.

대시보드:

- 오늘 접속자
- 오늘 구독 신청
- 입금확인 대기
- 문의 답변 대기
- 구독만료 예정
- 최근 시그널

운영 화면:

- 회원관리: 검색, 상태, 권한, 구독상태, 탈퇴상태
- 결제관리: 입금대기, 입금확인, 반려, 환불
- 구독관리: 승인, 만료, 취소, 환불, 기간 보정
- 고객센터관리: 답변, 상태 변경, 비밀글 조회
- 심볼관리: 등록, 수정, 숨김, 비활성, 아이콘
- 전략관리: 등록, 적용, on/off, 심볼별 전략 지정
- 시그널관리: 기간 필터, 엑셀 출력, 텔레그램 전송 로그
- 영업관리: 추천코드 승인, 추천매출, 포인트율, 엑셀 출력
- 관리자관리: Super Admin 전용
- 감사로그: 주요 변경 추적

## 11. Notification Design

알림은 이벤트 기반으로 만든다.

이벤트 예시:

- `support.thread.created`
- `support.reply.created`
- `subscription.trial.approved`
- `subscription.payment.confirmed`
- `subscription.expiring_soon`
- `subscription.expired`
- `signal.created`
- `referral.points.confirmed`

채널:

- onsite: 기본
- telegram: 시그널 및 운영 알림
- email: 2차 확장

알림 배지는 읽지 않은 알림 수를 기준으로 표시한다.

## 12. Security Design

인증:

- 서버 세션 또는 안전한 JWT 쿠키 사용
- 회원 비밀번호는 PBKDF2-SHA256 해시로 저장하고 원문은 저장하지 않는다.
- httpOnly, secure, sameSite 쿠키 적용
- 로그인 실패 rate limit
- 비밀번호 재설정 토큰은 만료시간과 1회성 사용 적용

권한:

- 모든 관리자 API는 서버에서 role 검사
- 모든 비밀글/시그널/구독 정보는 서버에서 소유자 검사
- Super Admin 전용 API를 별도 guard로 분리

업로드:

- 1차 허용: jpg, jpeg, png, webp
- 1차 제외: svg, gif
- 서버에서 MIME, 확장자, 크기 재검증
- 업로드 파일명은 서버 생성 ID 사용

운영:

- secret은 `.env.local`과 배포 환경변수로 이동
- runtime config의 token은 git 추적 대상에서 제거
- 관리자 액션은 audit log에 기록
- webhook passphrase는 rotation 가능하게 구성

## 13. Testing and Harness

Unit tests:

- subscription state transition
- payment confirmation
- refund reversal
- referral ledger confirmation
- permission checks
- support visibility

Integration tests:

- signup/login/session
- trial request and admin approval
- payment request and admin confirmation
- expired subscription signal block
- private support thread access
- admin audit log creation

Smoke harness:

```text
seed: guest, member, trial, subscriber, expired, admin, super_admin
run: build
run: existing node tests
run: auth flow smoke
run: subscription flow smoke
run: chart access smoke
run: admin operation smoke
```

Existing verification remains:

- `npm.cmd run build`
- `node --test tests\*.test.mjs`

## 14. Migration Strategy

Step 1: Keep current app working.

- 기존 Vite 앱을 그대로 빌드 가능하게 유지한다.
- Next.js 전환 브랜치에서 라우팅/인증 shell을 만든다.

Step 2: Wrap chart entry.

- 기존 차트 초기화 코드를 Next.js client component에서 mount한다.
- 차트 코어 import 경계를 만든다.

Step 3: Move server responsibilities.

- 기존 `server/data-gateway.mjs`는 시세 수집/조회 역할로 유지한다.
- 회원/구독/고객센터/관리자는 Next.js API에서 시작한다.

Step 4: Prepare future backend split.

- API contract 문서를 유지한다.
- domain service는 framework 의존을 최소화한다.
- repository interface를 두어 DB 교체가 가능하게 한다.

## 15. Key Risks

- Next.js 전환 중 기존 차트 번들/DOM 초기화 충돌
- 관리자 수동 결제 처리에서 누락/중복 승인
- 시그널 접근 제어를 UI 숨김으로만 처리하는 실수
- 추천포인트 환불/취소 역정산 누락
- 업로드와 관리자 API 보안 미흡
- 기존 runtime secret의 저장소 잔류

## 16. Decisions

- 1차는 Next.js 통합형으로 진행한다.
- 차트 코어는 재작성하지 않는다.
- 구독/결제는 관리자 수동 승인 기반으로 진행한다.
- Tailwind는 필수가 아니며, 도입 여부는 UI 구현 단계에서 결정한다.
- 백엔드 분리를 위해 API client와 domain service 경계를 먼저 만든다.

## 17. Foundation Slice Completion Criteria

Before starting the Next.js migration, the repository should contain framework-neutral domain modules for:

- role and subscription status constants
- chart and signal access checks
- subscription approval, cancellation, and refund transitions
- manual payment confirmation, rejection, and refund transitions
- referral ledger confirmation and reversal
- seed-style fixtures for smoke tests
- password policy validation
- profile image upload validation
- admin and super admin guard helpers
- audit log draft creation for admin actions

These modules should pass `npm.cmd run build` and `node --test tests\chart-service-domain.test.mjs`.

## 18. Next.js Migration Checkpoint

The first Next.js migration slice should consume the framework-neutral domain layer instead of duplicating rules inside route components.

Required guard usage:

- Signup and password reset should call `validatePasswordPolicy`.
- Profile avatar upload should call `validateProfileImageUpload`.
- Admin route handlers should call `assertAdminActor`.
- Super admin route handlers should call `assertSuperAdminActor`.
- Admin mutations should call `createAuditLogDraft` before persistence.
- Chart pages and signal APIs should call `canUseFullChart` and `canViewPaidSignals`.

The initial Next.js shell should not move chart rendering internals. It should mount or link to the existing chart entry while server-side access rules mature around it.

## 19. Next.js Shell Completion Criteria

The initial service shell is complete when:

- `next`, `react`, and `react-dom` are installed.
- `service:dev` runs the Next.js shell separately from the existing Vite chart app.
- `service:build` passes without changing the existing `build` script behavior.
- Root `app/` routes exist for landing, pricing, support, login, signup, chart gate, and admin preview.
- API route stubs consume the domain layer for chart access and audit preview.
- The existing Vite chart build still passes with `npm.cmd run build`.
- Existing Node tests still pass with `node --test tests\*.test.mjs`.

The shell is not the final UI design. It is the routing and guard integration checkpoint before implementing real auth sessions, persistence, and admin workflows.

## 20. Mock Operation API Completion Criteria

Before adding a real database, the service should expose a mock repository and operation layer that can be replaced by persistent repositories later.

Required operation coverage:

- list subscription plans
- derive chart access from repository user/subscription state
- create manual payment requests with pending subscriptions
- confirm payment and activate subscription in one admin operation
- refund payment and subscription in one admin operation
- reverse referral ledger entries when refunding
- append audit log drafts for admin mutations

Required API stubs:

- `GET /api/subscription/plans`
- `GET /api/subscription/me?userId=...`
- `GET /api/chart/access?userId=...`
- `POST /api/payments/request`
- `POST /api/admin/payments/confirm`
- `POST /api/admin/payments/refund`
- `GET /api/admin/audit-preview`

These APIs are mock-backed and should not be treated as production persistence. The next persistence slice should replace only the repository implementation, not the domain or route-level operation contracts.

## 21. Mock Auth Session Completion Criteria

Before real authentication persistence is added, the service should provide a cookie-based mock session layer that proves route guards and API contracts.

Required auth coverage:

- create session records for known mock users
- verify login by email and password hash before creating a session
- issue `HttpOnly`, `SameSite=Lax` session cookies
- parse session IDs from cookie headers
- resolve actors from valid sessions
- reject missing or expired sessions
- clear sessions on logout
- require admin sessions for admin mutations

Required API stubs:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Admin mutation routes should derive the actor from the session cookie instead of trusting request body fields such as `adminId`.

## 22. Mock UI Operation Wiring Completion Criteria

The first clickable UI slice should prove the full manual operation loop without introducing permanent persistence yet.

Implemented scope:

- Login page issues and clears the mock `HttpOnly` session cookie through `/api/auth/login` and `/api/auth/logout`.
- Login now requires email/password credentials and no longer accepts userId-only mock login.
- Signup page validates password policy, rejects duplicate emails, creates a mock member account, and issues a session through `/api/auth/signup`.
- Signup stores a password hash instead of the raw password.
- Pricing page reads plans from the repository and sends authenticated payment requests to `/api/payments/request`.
- Payment request creation derives `userId` from the session actor, not from client supplied body fields.
- Admin page fetches `/api/admin/payments` and requires an admin session before exposing the payment queue.
- Admin page can call confirm and refund endpoints, which still derive the admin actor from the session cookie.
- Landing, chart, signup, support, pricing, login, and admin pages use readable Korean labels after the initial shell encoding cleanup.

Deferred scope:

- Signup persistence, email verification, 2FA, and password reset.
- Real database repository.
- Production payment proof uploads and accounting reconciliation.
- KIS and MetaTrader data provider changes.
- Final visual design polish.

## 23. Mock Support Center Completion Criteria

The customer support slice should cover public notices and private 1:1 inquiries before a real database is introduced.

Implemented scope:

- Support thread and message records are part of the framework-neutral service model.
- Guests can view public support threads.
- Signed-in users can create public or private support threads.
- Private support threads are visible only to the owner and admins.
- Admins can reply to support threads.
- Admin replies mark the thread as answered and append an audit log draft.
- `/support` exposes inquiry creation and visible thread reading.
- `/admin` exposes support thread reading and admin reply actions.

Deferred scope:

- File attachments.
- Rich text editing.
- Thread closing/reopening.
- Notification fanout for replies.
- Real DB persistence and pagination.

## 24. Mock Subscription Request Queue Completion Criteria

The subscription operations slice should let members request subscription changes while keeping final approval in the admin workflow.

Implemented scope:

- Signed-in users can request subscription cancellation through `/api/subscription/cancel-request`.
- Signed-in users can request subscription refund through `/api/subscription/refund-request`.
- User requests transition active subscriptions to `cancel_requested` or `refund_requested`.
- Admins can list pending subscription requests through `/api/admin/subscriptions`.
- Admins can approve cancellation requests through `/api/admin/subscriptions/cancel`.
- Admins can approve refund requests through `/api/admin/subscriptions/refund`.
- Refund approval updates the related confirmed payment to `refunded`.
- Admin cancellation and refund approvals append audit log drafts.
- The pricing page exposes member-facing subscription status and request buttons.
- The admin page exposes subscription request queue actions.

Deferred scope:

- Admin rejection flow.
- User-facing reason fields and evidence uploads.
- Partial refunds and accounting settlement fields.
- Notification fanout after admin approval.
- Real DB persistence and pagination.

## 25. Mock Admin Rejection Completion Criteria

The admin workflow should support rejection as well as approval so manual operations can stop invalid requests safely.

Implemented scope:

- Admins can reject pending payment requests through `/api/admin/payments/reject`.
- Payment rejection changes the payment to `rejected` and cancels the pending subscription.
- Admins can reject subscription cancel/refund requests through `/api/admin/subscriptions/reject`.
- Subscription request rejection restores the subscription to `active`.
- Payment and subscription rejections append audit log drafts with the admin note.
- The admin payment panel exposes a `반려` action.
- The admin subscription panel exposes a `반려` action for cancel/refund requests.

Deferred scope:

- Custom rejection reason input per row.
- User notification after rejection.
- Rejection categories for reporting.
- Re-open flow after a rejected request.

## 26. Mock Notification Completion Criteria

The notification slice should make admin and support outcomes visible to users before external channels such as email or Telegram are introduced.

Implemented scope:

- Notification records are part of the framework-neutral service model.
- Payment confirmation creates a subscription notification.
- Payment rejection creates a payment notification with the admin note.
- Payment refund creates a payment notification with the admin note.
- Subscription cancel/refund approval creates a subscription notification.
- Subscription request rejection creates a subscription notification with the admin note.
- Support admin replies create a `support_reply` notification for the thread owner.
- Signed-in users can fetch their notifications through `/api/notifications`.
- `/notifications` shows the signed-in user's notification list.

Deferred scope:

- Mark single notification as read.
- Mark all notifications as read.
- Notification badge counts in the global nav.
- Email and Telegram delivery.
- Notification pagination and retention policy.

## 27. Mock Notification Read-State Completion Criteria

The notification read-state slice should let users clear operational alerts after review.

Implemented scope:

- Notification summary reports total and unread counts.
- Signed-in users can mark one own notification as read.
- Signed-in users can mark all own notifications as read.
- `/api/notifications` returns both notifications and summary counts.
- `/api/notifications/:id/read` marks a single notification read.
- `/api/notifications/read-all` marks all user notifications read.
- `/notifications` exposes unread counts, single read action, and all-read action.

Deferred scope:

- Global navigation unread badge.
- Server-side pagination.
- Notification filtering by category.
- Realtime push updates.

## 28. Mock Notification Badge Completion Criteria

The notification badge slice should surface unread notification state before users enter the notifications page.

Implemented scope:

- Unread count formatting hides zero unread notifications.
- Counts from 1 to 99 render as numbers.
- Counts over 99 render as `99+`.
- The global navigation uses `/api/notifications` summary data to show an unread badge.
- The root layout Korean labels were restored after encoding cleanup.

Deferred scope:

- Badge polling or realtime updates.
- Server-rendered session-aware badge.
- Badge count refresh after read actions without navigating.

## 29. Mock Profile Dashboard Completion Criteria

The profile dashboard slice should give signed-in users one operational hub for account, subscription, payment, notification, and support state.

Implemented scope:

- `getUserDashboardSummary` aggregates the signed-in user's account, chart access, subscription, own payments, notification summary, and visible support counts.
- The dashboard summary excludes other users' private support threads and payments.
- `/api/profile` returns the authenticated user's dashboard summary from the session cookie.
- `/profile` renders the member-facing account dashboard with links to subscription management, notifications, and customer support.
- Domain presentation helpers format subscription, payment, chart access, and USD amount labels for user-facing UI.

Deferred scope:

- Profile image upload UI and storage integration.
- Account settings edit flow.
- Session device management.
- Dashboard server-side rendering from a persistent auth provider.

## 30. Mock Admin Dashboard Completion Criteria

The admin dashboard slice should help operators see manual work queues before entering detailed payment, subscription, and support tables.

Implemented scope:

- `getAdminDashboardSummary` aggregates payment counts, subscription queue counts, support counts, and audit log counts.
- `/api/admin/dashboard` requires an admin session before returning the operational summary.
- `/admin` renders an operations dashboard panel above detailed admin tables.
- The dashboard highlights pending deposits, subscription approval/change queues, waiting support threads, and audit-log coverage.
- Priority and summary cards route operators to anchored admin panels and dispatch matching quick-filter presets for payments, subscriptions, support, users, and audit logs.
- Dashboard-routed filters show a dismissible visual notice so operators can tell when a table has been narrowed by a dashboard queue action.

Deferred scope:

- Date-range filters for dashboard metrics.
- Revenue charts and cohort metrics.
- Admin notification center for high-priority queues.

## 31. Mock Admin User Directory Completion Criteria

The admin user directory slice should let operators find members and inspect account state before taking manual subscription or support actions.

Implemented scope:

- `listUsers` is available on the chart service repository abstraction.
- `getAdminUserDirectory` returns searchable users with subscription, access, latest payment, payment count, support count, and unread notification count.
- `/api/admin/users` requires an admin session and supports `query`, `role`, and account-status filters.
- `/admin` renders a member search panel above detailed payment/subscription/support tables.

Deferred scope:

- Pagination for large user lists.
- Detailed user profile drawer for admin notes.
- Exportable CSV reports.

## 32. Mock Admin Audit Log Completion Criteria

The admin audit log slice should make manual operator actions reviewable from the admin backoffice.

Implemented scope:

- `getAdminAuditLogEntries` returns audit log entries newest first and joins each entry with the admin actor record.
- Audit logs can be filtered by action text and target type.
- `/api/admin/audit-logs` requires an admin session before returning audit log entries.
- The legacy `/api/admin/audit-preview` route is now admin protected.
- `/admin` renders a filterable audit log panel with before/after JSON details.

Deferred scope:

- Persistent timestamp and IP metadata on audit log records.
- Pagination and retention policy.
- CSV export and compliance report download.
- Tamper-evident append-only audit storage.

## 33. Mock Profile Settings Completion Criteria

The profile settings slice should let signed-in users safely manage basic account presentation before storage-backed profile media is introduced.

Implemented scope:

- `updateAuthenticatedUserProfile` updates only the authenticated user's display name.
- Blank and overlong display names are rejected before saving.
- `PATCH /api/profile` requires a signed-in session and returns the refreshed dashboard summary.
- `/api/profile/image-policy` requires a signed-in session and validates filename, MIME type, and size metadata through the existing upload policy.
- `/profile` renders display-name editing and profile-image policy validation controls.

Deferred scope:

- Actual profile image binary upload and storage.
- Presigned URL generation.
- Image resizing and malware scanning.
- Account email change and re-verification flow.

## 34. Mock Admin User Detail and Role Change Completion Criteria

The admin user detail slice should let operators inspect a specific member before changing safe account-level role metadata.

Implemented scope:

- `getAdminUserDetail` returns a user's subscription, access, payments, support threads, and notifications.
- `updateAdminUserRole` lets admins change non-admin user roles and writes an audit log.
- Admin role grants and changes to admin accounts require a super admin actor.
- `/api/admin/users/[id]` supports admin-protected detail lookup and role update.
- `/admin` exposes a member detail panel with role-change controls from the user directory.
- Role and account-status changes require explicit confirmation before the mutation is posted.

Deferred scope:

- Admin notes on user accounts.
- Dedicated user-detail page with pagination for long histories.

## 35. Mock Admin Account Suspension Completion Criteria

The account suspension slice should let operators block risky accounts while protecting active sessions and auditability.

Implemented scope:

- User records include `accountStatus` with `active` and `suspended` states.
- `updateAdminUserAccountStatus` suspends or reactivates users and writes an audit log with the reason.
- Normal admins cannot suspend admin accounts and cannot suspend themselves.
- Suspended users cannot create new sessions.
- Existing suspended-user sessions are deleted when reused.
- `/api/admin/users/[id]` supports account status updates from the admin user detail workflow.
- `/admin` exposes account suspend/reactivate controls in the member detail panel.

Deferred scope:

- Suspension expiry dates.
- User-facing suspension appeal flow.
- Bulk suspension tooling.
- Risk scoring and automated lock rules.

## 36. Database Schema Readiness Completion Criteria

The database schema readiness slice should freeze the repository-backed data model before selecting a concrete database adapter.

Implemented scope:

- `getChartServiceDatabaseTables` describes the core persistence tables for users, sessions, plans, subscriptions, payments, referrals, support, notifications, and audit logs.
- `renderChartServicePostgresSchema` renders a Postgres-compatible SQL schema draft from the table metadata.
- The schema includes account suspension state, foreign keys, check constraints, and operational indexes.
- The schema is tested so future repository or table changes can be detected before a database migration is generated.

Deferred scope:

- Applying the schema to a live database.
- Choosing Prisma, Drizzle, direct `pg`, Supabase, or another adapter.
- Data migration from mock memory state to persistent storage.
- Production backup, retention, and recovery policy.

## 37. Repository Adapter Boundary Completion Criteria

The repository adapter boundary should keep the current mock service usable while making the future persistence swap explicit and testable.

Implemented scope:

- `resolveChartServiceRepositoryAdapter` normalizes repository adapter selection.
- `memory` remains the default adapter and creates isolated mock repositories.
- `mock` is accepted as a compatibility alias for `memory`.
- `postgres` and `postgresql` are accepted as future persistent adapter names.
- `postgres` selection requires `CHART_SERVICE_DATABASE_URL` before the adapter can be resolved.
- Postgres row mappers cover users, sessions, plans, subscriptions, payments, referrals, support, notifications, and audit logs.
- Parameterized Postgres select, upsert, and delete statement builders are available for the future repository implementation.
- Parameterized Postgres insert-only statements are available for append-only audit logs.
- Postgres connection settings normalize `postgres` and `postgresql` URLs, redact credentials from safe labels, and produce credential-safe repository signatures.
- Postgres SSL mode is normalized from `sslmode` or `CHART_SERVICE_DATABASE_SSL_MODE`, with production defaulting to `require`.
- A query-executor-injected Postgres async repository implements the full chart-service repository contract.
- A `pg` Pool-compatible executor adapter translates `query(sql, values)` clients into the repository query executor contract.
- An async repository boundary wraps the current synchronous repository methods in awaited `runRead` and `runMutation` scopes.
- `getAsyncChartServicePersistence` provides a config-keyed singleton for route-by-route migration to awaited repository access.
- The async persistence factory can create Postgres persistence when a runtime query executor is injected, and fails clearly when Postgres is selected without that executor.
- `/api/subscription/plans` is the first route migrated to the async persistence scope, proving read-only APIs can move without changing response contracts.
- Memory-backed async singleton wraps the same underlying repository as the existing sync singleton, so login/session state survives route-by-route migration.
- `/api/subscription/me` now uses async read scope while preserving authenticated-session precedence over mock preview query fallback.
- `/api/chart/access` now uses async read scope and the same authenticated-session precedence, keeping the chart gate ready for a persistent repository.
- `/api/auth/me` now uses async read scope for session, user summary, and chart-access hydration.
- `/api/profile` now uses async read and mutation scopes for dashboard loading and display-name updates.
- Admin read routes for dashboard, payments, subscriptions, audit logs, audit preview, and user directory now use async read scopes.
- Admin mutation routes for payment confirmation/rejection/refund, subscription cancellation/refund/rejection, support replies, and user role/status changes now use async mutation scopes.
- User-facing auth, payment request, subscription request, notification, profile image policy, and support thread routes now use async read/mutation scopes instead of direct sync singleton access.
- Session cookies now carry signed `sessionId/userId/expiresAt` claims, so local route workers can validate login state even when mock memory sessions are isolated before the real database adapter lands.
- Login and signup API responses strip `passwordHash` before JSON serialization.
- Profile dashboard user payloads strip `passwordHash` before JSON serialization.
- Admin read API user payloads and audit log payloads redact `passwordHash` before JSON serialization.
- Admin mutation routes share consistent auth failure status mapping: session/admin failures return 401, super-admin permission failures return 403, and domain validation failures return 400.
- Unknown adapter names fail early with a clear configuration error.
- `getChartServiceRepository` now creates the global repository through the adapter config boundary instead of directly importing the mock repository.

Deferred scope:

- Installing/choosing the final database client package, such as `pg`.
- Installing and wiring the runtime Postgres client package to the selected deployment platform.
- Keeping future API routes on the async persistence scope as new real-service endpoints are added.
- Running migrations against a live database.
- Connection pooling, transaction boundaries, and retry policy.

## 37.1 Production Runtime Readiness Completion Criteria

The production runtime readiness slice should prevent the service from being deployed with local-only persistence or missing operational checks.

Implemented scope:

- Runtime readiness reports the active mode, selected repository adapter, and pass/warn/fail checks without leaking database credentials.
- `/api/health` returns readiness JSON and a failing status code when required production checks fail.
- `npm run service:check` runs the same readiness checks from the deployment harness.
- `npm run service:schema` exports the current Postgres schema to `docs/02-design/features/chart-service-schema.sql`.
- `.env.production.example` documents the minimum persistence variables for production.
- State-changing API routes use a shared mutation guard that combines same-origin protection and route-aware rate limiting.
- When Postgres is selected, readiness now distinguishes the completed mapping contract from the still-missing database client/repository implementation.
- When Postgres is selected, readiness reports a redacted database target and fails unsafe production SSL modes such as `disable`.
- Runtime readiness reports the async repository boundary as available so future database work has a visible migration checkpoint.

Deferred scope:

- Actual Postgres repository implementation.
- Deployment-provider health check integration.
- External rate-limit backend for multi-instance deployments.
- Secret rotation policy and managed production secret provisioning.

## 38. Quick Support Operation Completion Criteria

The support operation slice should let the admin validate the customer-support notification loop even when no rich text editor or attachment flow exists yet.

Implemented scope:

- Members can create a support request with a default quick inquiry draft.
- Admins can answer a support thread with a default quick reply.
- Quick replies still use the same server-side admin reply API and audit logging path.
- Admin support replies create member notifications.
- The admin dashboard, support panel, and audit log refresh together after support replies.
- Browser smoke verified member inquiry, admin reply, audit log update, and member notification visibility.

Deferred scope:

- Custom reply templates by support category.
- Rich text, attachments, and saved canned responses.
- Reply assignment, SLA timers, and close/reopen workflow.
