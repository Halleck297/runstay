-- RunStay Exchange - Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- REALTIME (enable for messages table)
-- ============================================
-- This enables realtime updates for the messages table
-- Run this if realtime isn't working:
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- ============================================
-- TABLES
-- ============================================

-- Profiles (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  short_id TEXT GENERATED ALWAYS AS (substring(replace(id::text, '-', '') from 1 for 12)) STORED UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  user_type TEXT NOT NULL DEFAULT 'private' CHECK (user_type IN ('tour_operator', 'private')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
  company_name TEXT,
  phone TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,

  -- Personal Information
  country TEXT,
  city TEXT,
  bio TEXT,

  -- Running Experience
  marathons_completed INTEGER DEFAULT 0,
  marathon_pb TEXT,
  marathon_pb_location TEXT,
  half_marathons_completed INTEGER DEFAULT 0,
  half_marathon_pb TEXT,
  half_marathon_pb_location TEXT,
  favorite_races TEXT,
  running_goals TEXT,

  -- Social Media
  instagram TEXT,
  strava TEXT,
  facebook TEXT,
  linkedin TEXT,
  website TEXT,
  preferred_language TEXT CHECK (preferred_language IN ('en', 'de', 'fr', 'it', 'es', 'nl', 'pt')),
  languages_spoken TEXT,
  years_experience INTEGER,
  specialties TEXT,
  is_team_leader BOOLEAN DEFAULT FALSE,
  referral_code TEXT UNIQUE,
  tl_welcome_message TEXT,
  created_by_admin UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MIGRATION: Add profile fields (run if table exists)
-- ============================================
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marathons_completed INTEGER DEFAULT 0;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marathon_pb TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marathon_pb_location TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS half_marathons_completed INTEGER DEFAULT 0;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS half_marathon_pb TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS half_marathon_pb_location TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS favorite_races TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS running_goals TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS strava TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS facebook TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website TEXT;

-- Events (marathons)
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  location TEXT NOT NULL,
  country TEXT NOT NULL,
  event_date DATE NOT NULL,
  -- Start/Finish line coordinates (for distance calculations)
  start_lat DECIMAL(10, 7),
  start_lng DECIMAL(10, 7),
  finish_lat DECIMAL(10, 7),
  finish_lng DECIMAL(10, 7),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MIGRATION: Add start/finish coordinates to events
-- ALTER TABLE public.events ADD COLUMN IF NOT EXISTS start_lat DECIMAL(10, 7);
-- ALTER TABLE public.events ADD COLUMN IF NOT EXISTS start_lng DECIMAL(10, 7);
-- ALTER TABLE public.events ADD COLUMN IF NOT EXISTS finish_lat DECIMAL(10, 7);
-- ALTER TABLE public.events ADD COLUMN IF NOT EXISTS finish_lng DECIMAL(10, 7);

-- MIGRATION: Se la tabella esiste già, esegui:
-- ALTER TABLE public.events ADD COLUMN slug TEXT UNIQUE;
-- UPDATE public.events SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'));

-- MIGRATION: Add distance fields to listings
-- ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS distance_to_finish INTEGER;
-- ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS walking_duration INTEGER;
-- ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS transit_duration INTEGER;
-- Hotels
CREATE TABLE public.hotels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  place_id TEXT UNIQUE,
  name TEXT NOT NULL,
  city TEXT,
  country TEXT,
  website TEXT,
  lat DECIMAL(10, 7),
  lng DECIMAL(10, 7),
  rating DECIMAL(3, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- Listings
CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_id TEXT GENERATED ALWAYS AS (substring(replace(id::text, '-', '') from 1 for 12)) STORED UNIQUE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('room', 'bib', 'room_and_bib')),
  title TEXT NOT NULL,
  description TEXT,
  hotel_name TEXT,
  hotel_stars INTEGER CHECK (hotel_stars >= 1 AND hotel_stars <= 5),
  hotel_website TEXT,
  hotel_place_id TEXT,
  hotel_city TEXT,
  hotel_country TEXT,
  hotel_lat DECIMAL(10, 7),
  hotel_lng DECIMAL(10, 7),
  hotel_rating DECIMAL(3, 2),
  hotel_id UUID REFERENCES public.hotels(id) ON DELETE SET NULL,


  room_count INTEGER,
  room_type TEXT CHECK (room_type IN ('single', 'twin', 'double', 'twin_shared', 'double_single_use', 'triple', 'quadruple')),
  check_in DATE,
  check_out DATE,
  bib_count INTEGER,
  price DECIMAL(10,2),
  currency TEXT DEFAULT 'EUR' CHECK (currency IN ('EUR', 'USD', 'GBP', 'JPY')),
  price_negotiable BOOLEAN DEFAULT FALSE,
  transfer_type TEXT CHECK (transfer_type IN ('official_process', 'package', 'contact')),
  associated_costs DECIMAL(10,2),
  cost_notes TEXT,

  -- Distance to finish line (calculated from hotel coordinates)
  distance_to_finish INTEGER,      -- meters (straight line)
  walking_duration INTEGER,        -- minutes
  transit_duration INTEGER,        -- minutes (only if > 1km)

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'sold', 'expired', 'rejected')),
  admin_note TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_id TEXT GENERATED ALWAYS AS (substring(replace(id::text, '-', '') from 1 for 12)) STORED UNIQUE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  participant_1 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activated BOOLEAN DEFAULT TRUE,  -- false = only visible to listing owner until they reply
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, participant_1, participant_2)
);

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'user' CHECK (message_type IN ('user', 'system', 'heart')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Translation fields (auto-populated by Google Translate API)
  detected_language TEXT,        -- Language code detected from content (e.g., 'it', 'en', 'de')
  translated_content TEXT,       -- Translated text in recipient's language
  translated_to TEXT             -- Target language code of translation
);

-- Saved Listings (user favorites)
CREATE TABLE IF NOT EXISTS public.saved_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

-- Contact Messages
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blocked users
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- Reports
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('user', 'listing', 'bug', 'other')),
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES public.profiles(id),
  target_listing_id UUID REFERENCES public.listings(id),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team leader referrals
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_leader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code_used TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'active')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_user_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('referral_signup', 'referral_active', 'tl_promoted', 'system', 'listing_approved', 'listing_rejected')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team leader invite tokens
CREATE TABLE IF NOT EXISTS public.tl_invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  used_by UUID REFERENCES public.profiles(id),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_listings_author ON public.listings(author_id);
CREATE INDEX idx_listings_event ON public.listings(event_id);
CREATE INDEX idx_listings_status ON public.listings(status);
CREATE INDEX idx_listings_type ON public.listings(listing_type);
CREATE INDEX idx_listings_created ON public.listings(created_at DESC);
CREATE INDEX idx_listings_hotel ON public.listings(hotel_id);
CREATE INDEX idx_hotels_place_id ON public.hotels(place_id);
CREATE INDEX idx_hotels_city ON public.hotels(city);
CREATE INDEX idx_hotels_country ON public.hotels(country);

CREATE INDEX idx_conversations_participants ON public.conversations(participant_1, participant_2);
CREATE INDEX idx_conversations_listing ON public.conversations(listing_id);
CREATE INDEX idx_conversations_updated ON public.conversations(updated_at DESC);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_created ON public.messages(created_at);
CREATE INDEX idx_saved_listings_user ON public.saved_listings(user_id);
CREATE INDEX idx_saved_listings_listing ON public.saved_listings(listing_id);
CREATE INDEX idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX idx_blocked_users_blocked ON public.blocked_users(blocked_id);
CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_created ON public.reports(created_at DESC);
CREATE INDEX idx_audit_log_admin ON public.admin_audit_log(admin_id);
CREATE INDEX idx_audit_log_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX idx_referrals_team_leader ON public.referrals(team_leader_id);
CREATE INDEX idx_referrals_created ON public.referrals(created_at DESC);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX idx_tl_invite_token ON public.tl_invite_tokens(token);
CREATE INDEX idx_listings_pending ON public.listings(created_at DESC) WHERE status = 'pending';

CREATE INDEX idx_events_date ON public.events(event_date);
CREATE INDEX idx_contact_messages_created ON public.contact_messages(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tl_invite_tokens ENABLE ROW LEVEL SECURITY;


-- Profiles: anyone can read, users can update their own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK ((select auth.uid()) = id);

-- Events: anyone can read and create
CREATE POLICY "Events are viewable by everyone" ON public.events
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create events" ON public.events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Hotels: everyone can read, only service role can write
CREATE POLICY "Hotels are viewable by everyone" ON public.hotels
  FOR SELECT USING (true);

CREATE POLICY "Service role can insert hotels" ON public.hotels
  FOR INSERT TO service_role
  WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "Service role can update hotels" ON public.hotels
  FOR UPDATE TO service_role
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- Listings: authenticated users can read active listings; authors can CRUD their own
CREATE POLICY "Authenticated users can read active listings" ON public.listings
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    OR (select auth.uid()) = author_id
  );

CREATE POLICY "Users can insert their own listings" ON public.listings
  FOR INSERT WITH CHECK ((select auth.uid()) = author_id);

CREATE POLICY "Users can update their own listings" ON public.listings
  FOR UPDATE
  USING ((select auth.uid()) = author_id)
  WITH CHECK ((select auth.uid()) = author_id);

CREATE POLICY "Users can delete their own listings" ON public.listings
  FOR DELETE USING ((select auth.uid()) = author_id);

-- Conversations: only participants can see/create
CREATE POLICY "Participants can view conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Authenticated users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Participants can update conversations" ON public.conversations
  FOR UPDATE USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- Messages: only conversation participants can see/create
CREATE POLICY "Participants can view messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

CREATE POLICY "Participants can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

CREATE POLICY "Recipients can mark messages as read" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );
-- Saved Listings: users can only see and manage their own
CREATE POLICY "Users can view own saved listings" ON public.saved_listings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can save listings" ON public.saved_listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave listings" ON public.saved_listings
  FOR DELETE USING (auth.uid() = user_id);

-- Contact Messages: validated submit, admin-only read/update/delete
CREATE POLICY "Contact form validated insert" ON public.contact_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(trim(name)) BETWEEN 2 AND 120
    AND length(trim(email)) BETWEEN 5 AND 254
    AND position('@' in email) > 1
    AND length(trim(message)) BETWEEN 10 AND 5000
    AND coalesce(subject, 'general') IN ('general', 'support', 'bug', 'partnership')
    AND (
      (auth.uid() IS NULL AND user_id IS NULL)
      OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
    )
  );

CREATE POLICY "Admins can view contact messages" ON public.contact_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can update contact messages" ON public.contact_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can delete contact messages" ON public.contact_messages
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role IN ('admin', 'superadmin')
    )
  );

-- Blocked Users: users can manage their own block list
CREATE POLICY "Users can view own blocked users" ON public.blocked_users
  FOR SELECT USING ((select auth.uid()) = blocker_id);

CREATE POLICY "Users can block users" ON public.blocked_users
  FOR INSERT WITH CHECK ((select auth.uid()) = blocker_id);

CREATE POLICY "Users can unblock users" ON public.blocked_users
  FOR DELETE USING ((select auth.uid()) = blocker_id);

-- Reports: users can create/view own reports
CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT WITH CHECK ((select auth.uid()) = reporter_id);

CREATE POLICY "Users can view own reports" ON public.reports
  FOR SELECT USING ((select auth.uid()) = reporter_id);

-- Referrals: team leaders can see their own referrals
CREATE POLICY "TLs can view own referrals" ON public.referrals
  FOR SELECT USING (team_leader_id = auth.uid());

-- Notifications: users can view/update their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Admin audit log: admin/superadmin access
CREATE POLICY "Admins can read audit log" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can insert audit log" ON public.admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role IN ('admin', 'superadmin')
    )
  );

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_listings_updated
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_conversations_updated
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

  CREATE TRIGGER on_hotels_updated
  BEFORE UPDATE ON public.hotels
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- SAMPLE DATA (optional - remove in production)
-- ============================================

-- Insert some sample events
INSERT INTO public.events (name, location, country, event_date, created_by) VALUES
  ('Berlin Marathon 2025', 'Berlin', 'Germany', '2025-09-28', NULL),
  ('New York City Marathon 2025', 'New York', 'USA', '2025-11-02', NULL),
  ('London Marathon 2025', 'London', 'UK', '2025-04-27', NULL),
  ('Tokyo Marathon 2025', 'Tokyo', 'Japan', '2025-03-02', NULL),
  ('Chicago Marathon 2025', 'Chicago', 'USA', '2025-10-12', NULL),
  ('Boston Marathon 2025', 'Boston', 'USA', '2025-04-21', NULL),
  ('Rome Marathon 2025', 'Rome', 'Italy', '2025-03-16', NULL),
  ('Paris Marathon 2025', 'Paris', 'France', '2025-04-06', NULL),
  ('Valencia Marathon 2025', 'Valencia', 'Spain', '2025-12-07', NULL),
  ('Amsterdam Marathon 2025', 'Amsterdam', 'Netherlands', '2025-10-19', NULL);
