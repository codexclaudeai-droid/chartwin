create table if not exists users (
  id text primary key,
  email text not null,
  name text not null,
  password_hash text not null,
  role text not null,
  account_status text not null default 'active',
  phone_number text,
  referral_code text not null,
  referred_by_user_id text,
  created_at timestamptz not null default now(),
  constraint chk_users_role check (role in ('guest', 'member', 'trial', 'subscriber', 'salesperson', 'admin', 'super_admin')),
  constraint chk_users_account_status check (account_status in ('active', 'suspended')),
  foreign key (referred_by_user_id) references users(id)
);

create index if not exists idx_users_email on users (email);

create index if not exists idx_users_role on users (role);

create index if not exists idx_users_referral_code on users (referral_code);

create index if not exists idx_users_referred_by_user_id on users (referred_by_user_id);

create table if not exists auth_sessions (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  foreign key (user_id) references users(id)
);

create index if not exists idx_auth_sessions_user_id on auth_sessions (user_id);

create index if not exists idx_auth_sessions_expires_at on auth_sessions (expires_at);

create table if not exists password_reset_tokens (
  id text primary key,
  user_id text not null,
  token_hash text not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  foreign key (user_id) references users(id)
);

create index if not exists idx_password_reset_tokens_token_hash on password_reset_tokens (token_hash);

create index if not exists idx_password_reset_tokens_user_id on password_reset_tokens (user_id);

create table if not exists subscription_plans (
  id text primary key,
  name text not null,
  duration_days integer not null,
  base_price_usd numeric(12,2) not null,
  discount_percent numeric(5,2) not null,
  is_active boolean not null default true
);

create table if not exists subscriptions (
  id text primary key,
  user_id text not null,
  plan_id text,
  status text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  approved_by_admin_id text,
  approved_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  foreign key (user_id) references users(id),
  foreign key (plan_id) references subscription_plans(id),
  foreign key (approved_by_admin_id) references users(id)
);

create index if not exists idx_subscriptions_user_id on subscriptions (user_id);

create index if not exists idx_subscriptions_status on subscriptions (status);

create table if not exists public_board_posts (
  id text primary key,
  category text not null,
  title text not null,
  body text not null,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_admin_id text,
  constraint chk_public_board_posts_category check (category in ('notice', 'qna', 'faq')),
  foreign key (updated_by_admin_id) references users(id)
);

create index if not exists idx_public_board_posts_category on public_board_posts (category);

create index if not exists idx_public_board_posts_is_published on public_board_posts (is_published);

create index if not exists idx_public_board_posts_updated_by_admin_id on public_board_posts (updated_by_admin_id);

create table if not exists support_threads (
  id text primary key,
  author_user_id text not null,
  category text not null,
  title text not null,
  visibility text not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  foreign key (author_user_id) references users(id)
);

create index if not exists idx_support_threads_author_user_id on support_threads (author_user_id);

create index if not exists idx_support_threads_status on support_threads (status);

create table if not exists support_messages (
  id text primary key,
  thread_id text not null,
  author_user_id text not null,
  body text not null,
  is_admin_reply boolean not null default false,
  created_at timestamptz not null,
  foreign key (thread_id) references support_threads(id),
  foreign key (author_user_id) references users(id)
);

create index if not exists idx_support_messages_thread_id on support_messages (thread_id);

create table if not exists payment_requests (
  id text primary key,
  user_id text not null,
  plan_id text not null,
  subscription_id text not null,
  support_thread_id text,
  method text not null,
  amount_usd numeric(12,2) not null,
  amount_krw integer,
  exchange_rate numeric(12,4),
  referral_points_used numeric(12,2) not null default 0,
  status text not null,
  depositor_name text,
  transaction_id text,
  transaction_verification_status text not null default 'unchecked',
  transaction_verification_message text,
  transaction_verified_at timestamptz,
  admin_note text,
  confirmed_by_admin_id text,
  confirmed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint chk_payment_requests_transaction_verification_status check (transaction_verification_status in ('unchecked', 'verified', 'mismatch', 'failed')),
  foreign key (user_id) references users(id),
  foreign key (plan_id) references subscription_plans(id),
  foreign key (subscription_id) references subscriptions(id),
  foreign key (support_thread_id) references support_threads(id),
  foreign key (confirmed_by_admin_id) references users(id)
);

create index if not exists idx_payment_requests_user_id on payment_requests (user_id);

create index if not exists idx_payment_requests_status on payment_requests (status);

create index if not exists idx_payment_requests_subscription_id on payment_requests (subscription_id);

create index if not exists idx_payment_requests_support_thread_id on payment_requests (support_thread_id);

create table if not exists referral_ledgers (
  id text primary key,
  referrer_user_id text not null,
  referred_user_id text not null,
  payment_request_id text not null,
  amount_usd numeric(12,2) not null,
  percent numeric(5,2) not null,
  points numeric(12,2) not null,
  status text not null,
  confirm_after timestamptz not null,
  confirmed_at timestamptz,
  reversed_at timestamptz,
  created_at timestamptz not null,
  foreign key (referrer_user_id) references users(id),
  foreign key (referred_user_id) references users(id),
  foreign key (payment_request_id) references payment_requests(id)
);

create index if not exists idx_referral_ledgers_payment_request_id on referral_ledgers (payment_request_id);

create table if not exists referral_program_settings (
  id text primary key,
  subscriber_cashback_percent numeric(5,2) not null default 3,
  reward_percent numeric(5,2) not null default 10,
  salesperson_reward_percent numeric(5,2) not null default 30,
  updated_by_admin_id text,
  updated_at timestamptz not null default now(),
  constraint chk_referral_program_settings_subscriber_cashback_percent check (subscriber_cashback_percent >= 0 and subscriber_cashback_percent <= 100),
  constraint chk_referral_program_settings_reward_percent check (reward_percent >= 0 and reward_percent <= 100),
  constraint chk_referral_program_settings_salesperson_reward_percent check (salesperson_reward_percent >= 0 and salesperson_reward_percent <= 100),
  foreign key (updated_by_admin_id) references users(id)
);

create table if not exists sales_teams (
  id text primary key,
  name text not null,
  commission_percent numeric(5,2) not null default 30,
  salesperson_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_admin_id text,
  constraint chk_sales_teams_commission_percent check (commission_percent >= 0 and commission_percent <= 100),
  foreign key (updated_by_admin_id) references users(id)
);

create index if not exists idx_sales_teams_updated_by_admin_id on sales_teams (updated_by_admin_id);

create table if not exists payment_transfer_settings (
  id text primary key,
  bank_name text not null,
  bank_account_number text not null,
  bank_account_holder text not null,
  bank_logo_url text not null,
  usdt_address text not null,
  usdt_network text not null,
  updated_by_admin_id text,
  updated_at timestamptz not null default now(),
  foreign key (updated_by_admin_id) references users(id)
);

create index if not exists idx_payment_transfer_settings_updated_by_admin_id on payment_transfer_settings (updated_by_admin_id);

create table if not exists web_info_settings (
  id text primary key,
  terms_content text not null,
  privacy_content text not null,
  plan_services_json jsonb not null default '{}'::jsonb,
  updated_by_admin_id text,
  updated_at timestamptz not null default now(),
  foreign key (updated_by_admin_id) references users(id)
);

create index if not exists idx_web_info_settings_updated_by_admin_id on web_info_settings (updated_by_admin_id);

create table if not exists chart_user_settings (
  user_id text primary key,
  settings_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  foreign key (user_id) references users(id)
);

create table if not exists signal_admin_settings (
  id text primary key,
  hidden_symbols_json jsonb not null default '[]'::jsonb,
  disabled_symbols_json jsonb not null default '[]'::jsonb,
  hidden_strategy_ids_json jsonb not null default '[]'::jsonb,
  strategy_mgmt_visible boolean not null default false,
  selected_strategy_id text not null default 'strategy_js_grid_martingale',
  updated_at timestamptz not null default now()
);

create table if not exists signup_agreements (
  id text primary key,
  user_id text not null,
  terms_accepted_at timestamptz not null,
  privacy_accepted_at timestamptz not null,
  terms_content text not null,
  privacy_content text not null,
  terms_settings_updated_at timestamptz not null,
  privacy_settings_updated_at timestamptz not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  foreign key (user_id) references users(id)
);

create index if not exists idx_signup_agreements_user_id on signup_agreements (user_id);

create index if not exists idx_signup_agreements_created_at on signup_agreements (created_at);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  category text not null,
  title text not null,
  body text not null,
  link_url text,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null,
  foreign key (user_id) references users(id)
);

create index if not exists idx_notifications_user_id_read_at on notifications (user_id, read_at);

create index if not exists idx_notifications_user_id_archived_at on notifications (user_id, archived_at);

create table if not exists email_outbox (
  id text primary key,
  recipient_email text not null,
  template text not null,
  subject text not null,
  body text not null,
  status text not null,
  created_at timestamptz not null,
  sent_at timestamptz,
  last_error text,
  constraint chk_email_outbox_status check (status in ('queued', 'sent', 'failed'))
);

create index if not exists idx_email_outbox_status_created_at on email_outbox (status, created_at);

create table if not exists audit_logs (
  id bigserial primary key,
  actor_admin_id text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  before_json jsonb not null,
  after_json jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (actor_admin_id) references users(id)
);

create index if not exists idx_audit_logs_actor_admin_id on audit_logs (actor_admin_id);

create index if not exists idx_audit_logs_target on audit_logs (target_type, target_id);

alter table if exists notifications add column if not exists archived_at timestamptz;

alter table if exists payment_requests add column if not exists support_thread_id text;

alter table if exists payment_requests add column if not exists transaction_id text;

alter table if exists payment_requests add column if not exists transaction_verification_status text;

alter table if exists payment_requests add column if not exists transaction_verification_message text;

alter table if exists payment_requests add column if not exists transaction_verified_at timestamptz;

update payment_requests set transaction_verification_status = 'unchecked' where transaction_verification_status is null or transaction_verification_status = '';

create index if not exists idx_payment_requests_support_thread_id on payment_requests (support_thread_id);

alter table if exists users add column if not exists phone_number text;

alter table if exists users add column if not exists referral_code text;

alter table if exists users add column if not exists referred_by_user_id text;

alter table if exists users add column if not exists created_at timestamptz;

update users set referral_code = upper(substr(md5(id), 1, 6)) where referral_code is null or referral_code = '' or referral_code !~ '^[A-Z0-9]{6}$';

update users set created_at = now() where created_at is null;

create index if not exists idx_users_referral_code on users (referral_code);

create index if not exists idx_users_referred_by_user_id on users (referred_by_user_id);

create table if not exists referral_program_settings (id text primary key, subscriber_cashback_percent numeric(5,2) not null default 3, reward_percent numeric(5,2) not null default 10, salesperson_reward_percent numeric(5,2) not null default 30, updated_by_admin_id text, updated_at timestamptz not null default now());

alter table if exists referral_program_settings add column if not exists subscriber_cashback_percent numeric(5,2);

alter table if exists referral_program_settings add column if not exists reward_percent numeric(5,2);

alter table if exists referral_program_settings add column if not exists salesperson_reward_percent numeric(5,2);

alter table if exists referral_program_settings add column if not exists updated_by_admin_id text;

alter table if exists referral_program_settings add column if not exists updated_at timestamptz;

update referral_program_settings set subscriber_cashback_percent = 3 where subscriber_cashback_percent is null;

update referral_program_settings set reward_percent = 10 where reward_percent is null;

update referral_program_settings set salesperson_reward_percent = 30 where salesperson_reward_percent is null;

insert into referral_program_settings (id, subscriber_cashback_percent, reward_percent, salesperson_reward_percent, updated_at) values ('default', 3, 10, 30, now()) on conflict (id) do nothing;

create table if not exists sales_teams (id text primary key, name text not null, commission_percent numeric(5,2) not null default 30, salesperson_ids jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by_admin_id text);

alter table if exists sales_teams add column if not exists name text;

alter table if exists sales_teams add column if not exists commission_percent numeric(5,2);

alter table if exists sales_teams add column if not exists salesperson_ids jsonb;

alter table if exists sales_teams add column if not exists created_at timestamptz;

alter table if exists sales_teams add column if not exists updated_at timestamptz;

alter table if exists sales_teams add column if not exists updated_by_admin_id text;

update sales_teams set salesperson_ids = '[]'::jsonb where salesperson_ids is null;

create index if not exists idx_sales_teams_updated_by_admin_id on sales_teams (updated_by_admin_id);

create table if not exists payment_transfer_settings (id text primary key, bank_name text not null, bank_account_number text not null, bank_account_holder text not null, bank_logo_url text not null default '/bank-logos/generic-bank.svg', usdt_address text not null, usdt_network text not null, updated_by_admin_id text, updated_at timestamptz not null default now());

alter table if exists payment_transfer_settings add column if not exists bank_name text;

alter table if exists payment_transfer_settings add column if not exists bank_account_number text;

alter table if exists payment_transfer_settings add column if not exists bank_account_holder text;

alter table if exists payment_transfer_settings add column if not exists bank_logo_url text;

alter table if exists payment_transfer_settings add column if not exists usdt_address text;

alter table if exists payment_transfer_settings add column if not exists usdt_network text;

alter table if exists payment_transfer_settings add column if not exists updated_by_admin_id text;

alter table if exists payment_transfer_settings add column if not exists updated_at timestamptz;

update payment_transfer_settings set bank_logo_url = '/bank-logos/generic-bank.svg' where bank_logo_url is null or bank_logo_url = '';

create index if not exists idx_payment_transfer_settings_updated_by_admin_id on payment_transfer_settings (updated_by_admin_id);

create table if not exists public_board_posts (id text primary key, category text not null, title text not null, body text not null, is_published boolean not null default true, sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by_admin_id text);

alter table if exists public_board_posts add column if not exists category text;

alter table if exists public_board_posts add column if not exists title text;

alter table if exists public_board_posts add column if not exists body text;

alter table if exists public_board_posts add column if not exists is_published boolean;

alter table if exists public_board_posts add column if not exists sort_order integer;

alter table if exists public_board_posts add column if not exists created_at timestamptz;

alter table if exists public_board_posts add column if not exists updated_at timestamptz;

alter table if exists public_board_posts add column if not exists updated_by_admin_id text;

update public_board_posts set is_published = true where is_published is null;

update public_board_posts set sort_order = 0 where sort_order is null;

update public_board_posts set created_at = now() where created_at is null;

update public_board_posts set updated_at = now() where updated_at is null;

insert into public_board_posts (id, category, title, body, is_published, sort_order, created_at, updated_at, updated_by_admin_id) values ('public_board_notice', 'notice', '서비스 운영 공지', '구독 운영, 결제 안내, 차트 접근 정책 변경 사항을 공개 게시판으로 안내합니다.', true, 10, now(), now(), null) on conflict (id) do nothing;

insert into public_board_posts (id, category, title, body, is_published, sort_order, created_at, updated_at, updated_by_admin_id) values ('public_board_qna', 'qna', '공개 질문답변', '자주 반복되는 질문은 공개 답변으로 정리하고, 개인정보가 필요한 내용은 1:1 문의로 처리합니다.', true, 20, now(), now(), null) on conflict (id) do nothing;

insert into public_board_posts (id, category, title, body, is_published, sort_order, created_at, updated_at, updated_by_admin_id) values ('public_board_faq', 'faq', '자주 묻는 질문', '결제, 승인, 무료체험, 시그널 접근 기준을 가장 앞에서 확인할 수 있게 정리합니다.', true, 30, now(), now(), null) on conflict (id) do nothing;

create index if not exists idx_public_board_posts_category on public_board_posts (category);

create index if not exists idx_public_board_posts_is_published on public_board_posts (is_published);

create index if not exists idx_public_board_posts_updated_by_admin_id on public_board_posts (updated_by_admin_id);

create table if not exists web_info_settings (id text primary key, terms_content text not null, privacy_content text not null, plan_services_json jsonb not null default '{}'::jsonb, updated_by_admin_id text, updated_at timestamptz not null default now());

alter table if exists web_info_settings add column if not exists terms_content text;

alter table if exists web_info_settings add column if not exists privacy_content text;

alter table if exists web_info_settings add column if not exists plan_services_json jsonb;

alter table if exists web_info_settings add column if not exists updated_by_admin_id text;

alter table if exists web_info_settings add column if not exists updated_at timestamptz;

update web_info_settings set plan_services_json = '{}'::jsonb where plan_services_json is null;

insert into web_info_settings (id, terms_content, privacy_content, updated_at) values ('default', 'TradingCore 서비스 이용약관', 'TradingCore 개인정보보호정책', now()) on conflict (id) do nothing;

create index if not exists idx_web_info_settings_updated_by_admin_id on web_info_settings (updated_by_admin_id);

create table if not exists chart_user_settings (user_id text primary key references users(id), settings_json jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());

alter table if exists chart_user_settings add column if not exists settings_json jsonb;

alter table if exists chart_user_settings add column if not exists updated_at timestamptz;

update chart_user_settings set settings_json = '{}'::jsonb where settings_json is null;

update chart_user_settings set updated_at = now() where updated_at is null;

create table if not exists signal_admin_settings (id text primary key, hidden_symbols_json jsonb not null default '[]'::jsonb, disabled_symbols_json jsonb not null default '[]'::jsonb, hidden_strategy_ids_json jsonb not null default '[]'::jsonb, strategy_mgmt_visible boolean not null default false, selected_strategy_id text not null default 'strategy_js_grid_martingale', updated_at timestamptz not null default now());

alter table if exists signal_admin_settings add column if not exists hidden_symbols_json jsonb;

alter table if exists signal_admin_settings add column if not exists disabled_symbols_json jsonb;

alter table if exists signal_admin_settings add column if not exists hidden_strategy_ids_json jsonb;

alter table if exists signal_admin_settings add column if not exists strategy_mgmt_visible boolean;

alter table if exists signal_admin_settings add column if not exists selected_strategy_id text;

alter table if exists signal_admin_settings add column if not exists updated_at timestamptz;

update signal_admin_settings set hidden_symbols_json = '[]'::jsonb where hidden_symbols_json is null;

update signal_admin_settings set disabled_symbols_json = '[]'::jsonb where disabled_symbols_json is null;

update signal_admin_settings set hidden_strategy_ids_json = '[]'::jsonb where hidden_strategy_ids_json is null;

update signal_admin_settings set strategy_mgmt_visible = false where strategy_mgmt_visible is null;

update signal_admin_settings set selected_strategy_id = 'strategy_js_grid_martingale' where selected_strategy_id is null or selected_strategy_id = '';

update signal_admin_settings set updated_at = now() where updated_at is null;

create table if not exists signup_agreements (id text primary key, user_id text not null, terms_accepted_at timestamptz not null, privacy_accepted_at timestamptz not null, terms_content text not null, privacy_content text not null, terms_settings_updated_at timestamptz not null, privacy_settings_updated_at timestamptz not null, ip_address text, user_agent text, created_at timestamptz not null default now());

alter table if exists signup_agreements add column if not exists user_id text;

alter table if exists signup_agreements add column if not exists terms_accepted_at timestamptz;

alter table if exists signup_agreements add column if not exists privacy_accepted_at timestamptz;

alter table if exists signup_agreements add column if not exists terms_content text;

alter table if exists signup_agreements add column if not exists privacy_content text;

alter table if exists signup_agreements add column if not exists terms_settings_updated_at timestamptz;

alter table if exists signup_agreements add column if not exists privacy_settings_updated_at timestamptz;

alter table if exists signup_agreements add column if not exists ip_address text;

alter table if exists signup_agreements add column if not exists user_agent text;

alter table if exists signup_agreements add column if not exists created_at timestamptz;

create index if not exists idx_signup_agreements_user_id on signup_agreements (user_id);

create index if not exists idx_signup_agreements_created_at on signup_agreements (created_at);
