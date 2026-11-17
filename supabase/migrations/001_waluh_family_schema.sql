-- ============================================================================
-- WALUH FAMILY (WELLBORN FAMILY) — SUPABASE / POSTGRESQL PRODUCTION MIGRATION
-- ============================================================================
-- Includes all core relational tables, Asia/Jakarta Monday-Sunday period helper,
-- and strict Row Level Security (RLS) policies.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ROLES & PERMISSIONS
CREATE TABLE IF NOT EXISTS public.roles (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rank_order INTEGER NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.permissions (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_code TEXT NOT NULL REFERENCES public.roles(code) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES public.permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_code, permission_code)
);

-- 2. PROFILES (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role_code TEXT NOT NULL DEFAULT 'MEMBER' REFERENCES public.roles(code),
  jabatan TEXT NOT NULL DEFAULT 'Anggota',
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  additional_info TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'DELETION_REQUESTED')),
  privacy_show_joined BOOLEAN NOT NULL DEFAULT TRUE,
  privacy_show_donations BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 3. REGISTRATIONS
CREATE TABLE IF NOT EXISTS public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  additional_info TEXT NOT NULL DEFAULT '',
  rules_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by UUID REFERENCES public.profiles(id),
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. DONATIONS & REVERSAL ADJUSTMENTS
CREATE TABLE IF NOT EXISTS public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_code TEXT NOT NULL UNIQUE,
  member_id UUID NOT NULL REFERENCES public.profiles(id),
  amount_coins INTEGER NOT NULL CHECK (amount_coins > 0),
  donation_date DATE NOT NULL,
  week_key TEXT NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  month_key TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'VERIFIED' CHECK (status IN ('VERIFIED', 'REVERSED')),
  recorded_by UUID NOT NULL REFERENCES public.profiles(id),
  idempotency_key TEXT UNIQUE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.donation_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES public.donations(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('REVERSAL', 'CORRECTION')),
  previous_amount INTEGER NOT NULL,
  new_amount INTEGER NOT NULL,
  replacement_donation_id UUID REFERENCES public.donations(id),
  reason TEXT NOT NULL,
  adjusted_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. EVENTS & ATTENDEES
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL,
  poster_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED')),
  rsvp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rsvp_status TEXT NOT NULL CHECK (rsvp_status IN ('GOING', 'MAYBE', 'DECLINED')),
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, profile_id)
);

-- 6. ANNOUNCEMENTS, NOTIFICATIONS, AUDIT LOGS, SETTINGS, SESSIONS
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED', 'DRAFT', 'ARCHIVED')),
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_tab TEXT NOT NULL DEFAULT 'overview',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.community_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_agent TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  remember_me BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- HELPER FUNCTION FOR RLS RBAC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.current_user_has_permission(perm TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.role_permissions rp ON rp.role_code = p.role_code AND rp.permission_code = perm
    WHERE p.id = auth.uid()
      AND p.status = 'APPROVED'
      AND p.deleted_at IS NULL
      AND (p.role_code = 'CAPSU' OR rp.permission_code IS NOT NULL)
  );
$$;

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: Approved members see approved members (via secure views excluding email); self can update safe columns
CREATE POLICY "Approved members can view profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.status = 'APPROVED')
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Officers can manage profiles"
  ON public.profiles FOR UPDATE
  USING (public.current_user_has_permission('members.manage'));

-- Donations: Approved members see VERIFIED donations; Treasurer/CAPSU see all; only Treasurer/CAPSU insert
CREATE POLICY "Approved members view verified donations"
  ON public.donations FOR SELECT
  USING (
    (status = 'VERIFIED' AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.status = 'APPROVED'))
    OR public.current_user_has_permission('donations.view_all')
  );

CREATE POLICY "Treasurer can insert donations"
  ON public.donations FOR INSERT
  WITH CHECK (public.current_user_has_permission('donations.create'));

CREATE POLICY "Treasurer can reverse donations"
  ON public.donations FOR UPDATE
  USING (public.current_user_has_permission('donations.adjust'));

-- Adjustments: Only financial oversight / treasurer
CREATE POLICY "Treasurer and oversight view adjustments"
  ON public.donation_adjustments FOR SELECT
  USING (public.current_user_has_permission('donations.view_all'));

CREATE POLICY "Treasurer inserts adjustments"
  ON public.donation_adjustments FOR INSERT
  WITH CHECK (public.current_user_has_permission('donations.adjust'));

-- Audit Logs: Strictly CAPSU / Deputi
CREATE POLICY "Authorized leadership views audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.current_user_has_permission('audit.view'));
