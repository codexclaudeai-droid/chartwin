create table if not exists users (
  id text primary key,
  email text not null,
  name text not null,
  password_hash text not null,
  role text not null,
  account_status text not null default 'active',
  constraint chk_users_role check (role in ('guest', 'member', 'trial', 'subscriber', 'salesperson', 'admin', 'super_admin')),
  constraint chk_users_account_status check (account_status in ('active', 'suspended'))
);

create index if not exists idx_users_email on users (email);

create index if not exists idx_users_role on users (role);

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

create table if not exists payment_requests (
  id text primary key,
  user_id text not null,
  plan_id text not null,
  subscription_id text not null,
  method text not null,
  amount_usd numeric(12,2) not null,
  amount_krw integer,
  exchange_rate numeric(12,4),
  referral_points_used numeric(12,2) not null default 0,
  status text not null,
  depositor_name text,
  admin_note text,
  confirmed_by_admin_id text,
  confirmed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  foreign key (user_id) references users(id),
  foreign key (plan_id) references subscription_plans(id),
  foreign key (subscription_id) references subscriptions(id),
  foreign key (confirmed_by_admin_id) references users(id)
);

create index if not exists idx_payment_requests_user_id on payment_requests (user_id);

create index if not exists idx_payment_requests_status on payment_requests (status);

create index if not exists idx_payment_requests_subscription_id on payment_requests (subscription_id);

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

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  category text not null,
  title text not null,
  body text not null,
  link_url text,
  read_at timestamptz,
  created_at timestamptz not null,
  foreign key (user_id) references users(id)
);

create index if not exists idx_notifications_user_id_read_at on notifications (user_id, read_at);

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
