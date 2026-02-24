export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ListingType = "room" | "bib" | "room_and_bib";
export type UserType = "private" | "team_leader" | "tour_operator" | "admin" | "superadmin";
export type UserRole = "user" | "admin" | "superadmin";
export type ListingStatus = "pending" | "active" | "sold" | "expired" | "rejected";
export type TransferType = "official_process" | "package" | "contact";
export type Currency = "EUR" | "USD" | "GBP" | "JPY";
export type ReferralStatus = "registered" | "active" | "inactive";
export type NotificationType = "referral_signup" | "referral_active" | "tl_promoted" | "system" | "listing_approved" | "listing_rejected";
// Estendi il tipo Profile con unreadCount (usato nel root loader)
export type ProfileWithUnread = Database["public"]["Tables"]["profiles"]["Row"] & {
  unreadCount?: number;
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          short_id: string;
          email: string;
          full_name: string | null;
          user_type: UserType;
          role: UserRole;
          company_name: string | null;
          phone: string | null;
          is_verified: boolean;
          avatar_url: string | null;
          // Personal Information
          country: string | null;
          city: string | null;
          bio: string | null;
          // Running Experience
          marathons_completed: number | null;
          marathon_pb: string | null;
          marathon_pb_location: string | null;
          half_marathons_completed: number | null;
          half_marathon_pb: string | null;
          half_marathon_pb_location: string | null;
          favorite_races: string | null;
          running_goals: string | null;
          // Social Media
          instagram: string | null;
          strava: string | null;
          facebook: string | null;
          linkedin: string | null;
          website: string | null;
          preferred_language: string | null;
          languages_spoken: string | null;
          years_experience: number | null;
          specialties: string | null;
          public_profile_enabled: boolean;
          public_show_personal_info: boolean;
          public_show_experience: boolean;
          public_show_social: boolean;
          // Team Leader
          is_team_leader: boolean;
          referral_code: string | null;
          tl_welcome_message: string | null;
          last_login_at: string | null;
          // Admin tracking
          created_by_admin: string | null;
          created_at: string;
          updated_at: string;
        };

        Insert: {
          id: string;
          short_id?: string;
          email: string;
          full_name?: string | null;
          user_type?: UserType;
          role?: UserRole;
          company_name?: string | null;
          phone?: string | null;
          is_verified?: boolean;
          avatar_url?: string | null;
          country?: string | null;
          city?: string | null;
          bio?: string | null;
          marathons_completed?: number | null;
          marathon_pb?: string | null;
          marathon_pb_location?: string | null;
          half_marathons_completed?: number | null;
          half_marathon_pb?: string | null;
          half_marathon_pb_location?: string | null;
          favorite_races?: string | null;
          running_goals?: string | null;
          instagram?: string | null;
          strava?: string | null;
          facebook?: string | null;
          linkedin?: string | null;
          website?: string | null;
          preferred_language?: string | null;
          languages_spoken?: string | null;
          years_experience?: number | null;
          specialties?: string | null;
          public_profile_enabled?: boolean;
          public_show_personal_info?: boolean;
          public_show_experience?: boolean;
          public_show_social?: boolean;
          is_team_leader?: boolean;
          referral_code?: string | null;
          tl_welcome_message?: string | null;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          short_id?: string;
          email?: string;
          full_name?: string | null;
          user_type?: UserType;
          role?: UserRole;
          company_name?: string | null;
          phone?: string | null;
          is_verified?: boolean;
          avatar_url?: string | null;
          country?: string | null;
          city?: string | null;
          bio?: string | null;
          marathons_completed?: number | null;
          marathon_pb?: string | null;
          marathon_pb_location?: string | null;
          half_marathons_completed?: number | null;
          half_marathon_pb?: string | null;
          half_marathon_pb_location?: string | null;
          favorite_races?: string | null;
          running_goals?: string | null;
          instagram?: string | null;
          strava?: string | null;
          facebook?: string | null;
          linkedin?: string | null;
          website?: string | null;
          preferred_language?: string | null;
          languages_spoken?: string | null;
          years_experience?: number | null;
          specialties?: string | null;
          public_profile_enabled?: boolean;
          public_show_personal_info?: boolean;
          public_show_experience?: boolean;
          public_show_social?: boolean;
          is_team_leader?: boolean;
          referral_code?: string | null;
          tl_welcome_message?: string | null;
          last_login_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          name: string;
          name_i18n: Json | null;
          slug: string | null;
          location: string | null;
          location_i18n: Json | null;
          country: string;
          country_i18n: Json | null;
          event_date: string;
          card_image_url: string | null;
          start_lat: number | null;
          start_lng: number | null;
          finish_lat: number | null;
          finish_lng: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          name_i18n?: Json | null;
          slug?: string | null;
          location?: string | null;
          location_i18n?: Json | null;
          country: string;
          country_i18n?: Json | null;
          event_date: string;
          card_image_url?: string | null;
          start_lat?: number | null;
          start_lng?: number | null;
          finish_lat?: number | null;
          finish_lng?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          name_i18n?: Json | null;
          slug?: string | null;
          location?: string | null;
          location_i18n?: Json | null;
          country?: string;
          country_i18n?: Json | null;
          event_date?: string;
          card_image_url?: string | null;
          start_lat?: number | null;
          start_lng?: number | null;
          finish_lat?: number | null;
          finish_lng?: number | null;
        };
        Relationships: [];
      };

            hotels: {
        Row: {
          id: string;
          place_id: string | null;
          name: string;
          name_i18n: Json | null;
          city: string | null;
          city_i18n: Json | null;
          country: string | null;
          country_i18n: Json | null;
          website: string | null;
          lat: number | null;
          lng: number | null;
          rating: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          place_id?: string | null;
          name: string;
          name_i18n?: Json | null;
          city?: string | null;
          city_i18n?: Json | null;
          country?: string | null;
          country_i18n?: Json | null;
          website?: string | null;
          lat?: number | null;
          lng?: number | null;
          rating?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          place_id?: string | null;
          name?: string;
          name_i18n?: Json | null;
          city?: string | null;
          city_i18n?: Json | null;
          country?: string | null;
          country_i18n?: Json | null;
          website?: string | null;
          lat?: number | null;
          lng?: number | null;
          rating?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      listings: {
  Row: {
    id: string;
    short_id: string;
    author_id: string;
    event_id: string;
    listing_type: ListingType;
    title: string;
    title_i18n: Json | null;
    description: string | null;
    description_i18n: Json | null;
    hotel_name: string | null;
    hotel_name_i18n: Json | null;
    hotel_website: string | null;
    hotel_place_id: string | null;
    hotel_city: string | null;
    hotel_city_i18n: Json | null;
    hotel_country: string | null;
    hotel_country_i18n: Json | null;
    hotel_stars: number | null;
    hotel_lat: number | null;
    hotel_lng: number | null;
    hotel_rating: number | null;
    hotel_id: string | null;
    room_count: number | null;
    check_in: string | null;
    check_out: string | null;
    bib_count: number | null;
    room_type: "single" | "twin" | "double" | "twin_shared" | "double_single_use" | "triple" | "quadruple" |null;
    price: number | null;
    currency: Currency;
    price_negotiable: boolean;
    
    // NUOVI CAMPI - aggiungere dopo riga 94
    transfer_type: TransferType | null;
    associated_costs: number | null;
    cost_notes: string | null;

    // Distance to finish line
    distance_to_finish: number | null;
    walking_duration: number | null;
    transit_duration: number | null;

    status: ListingStatus;
    admin_note: string | null;
    reviewed_at: string | null;
    reviewed_by: string | null;
    created_at: string;
    updated_at: string;
  };

        Insert: {
  id?: string;
  short_id?: string;
  author_id: string;
  event_id: string;
  listing_type: ListingType;
    title: string;
    title_i18n?: Json | null;
    description?: string | null;
    description_i18n?: Json | null;
    hotel_name?: string | null;
    hotel_name_i18n?: Json | null;
  hotel_stars?: number | null;
  hotel_website?: string | null;
  hotel_place_id?: string | null;
    hotel_city?: string | null;
    hotel_city_i18n?: Json | null;
    hotel_country?: string | null;
    hotel_country_i18n?: Json | null;
  hotel_lat?: number | null; 
  hotel_lng?: number | null;
  hotel_rating?: number | null;
  hotel_id: string | null;
  room_count?: number | null;
  room_type: "single" | "twin" | "double" | "twin_shared" | "double_single_use" | "triple" | "quadruple" |null;
  check_in?: string | null;
  check_out?: string | null;
  bib_count?: number | null;
  price?: number | null;
  currency?: Currency;
  price_negotiable?: boolean;
  transfer_type?: TransferType | null;
  associated_costs?: number | null;
  cost_notes?: string | null;

  // Distance to finish line
  distance_to_finish?: number | null;
  walking_duration?: number | null;
  transit_duration?: number | null;

  status?: ListingStatus;
  admin_note?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

        Update: {
  short_id?: string;
  listing_type?: ListingType;
    title?: string;
    title_i18n?: Json | null;
    description?: string | null;
    description_i18n?: Json | null;
    hotel_name?: string | null;
    hotel_name_i18n?: Json | null;
  hotel_website?: string | null;
  hotel_place_id?: string | null;
    hotel_city?: string | null;
    hotel_city_i18n?: Json | null;
    hotel_country?: string | null;
    hotel_country_i18n?: Json | null;
  hotel_lat?: number | null;
  hotel_lng?: number | null;
  hotel_rating?: number | null;
  hotel_id: string | null;
  hotel_stars?: number | null;
  room_count?: number | null;
  room_type: "single" | "twin" | "double" | "twin_shared" | "double_single_use" | "triple" | "quadruple" |null;
  check_in?: string | null;
  check_out?: string | null;
  bib_count?: number | null;
  price?: number | null;
  currency?: Currency;
  price_negotiable?: boolean;
  transfer_type?: TransferType | null;
  associated_costs?: number | null;
  cost_notes?: string | null;

  // Distance to finish line
  distance_to_finish?: number | null;
  walking_duration?: number | null;
  transit_duration?: number | null;

  status?: ListingStatus;
  admin_note?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  updated_at?: string;
};
        Relationships: [];

      };
      conversations: {
        Row: {
          id: string;
          short_id: string;
          listing_id: string;
          participant_1: string;
          participant_2: string;
          activated: boolean;
          deleted_by_1: boolean;
          deleted_by_2: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          short_id?: string;
          listing_id: string;
          participant_1: string;
          participant_2: string;
          activated?: boolean;
          deleted_by_1?: boolean;
          deleted_by_2?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          short_id?: string;
          activated?: boolean;
          deleted_by_1?: boolean;
          deleted_by_2?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };

      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          message_type: "user" | "system" | "heart";
          read_at: string | null;
          created_at: string;
          detected_language: string | null;
          translated_content: string | null;
          translated_to: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          message_type?: "user" | "system" | "heart";
          read_at?: string | null;
          created_at?: string;
          detected_language?: string | null;
          translated_content?: string | null;
          translated_to?: string | null;
        };
        Update: {
          message_type?: "user" | "system" | "heart";
          read_at?: string | null;
          detected_language?: string | null;
          translated_content?: string | null;
          translated_to?: string | null;
        };
        Relationships: [];
      };
            saved_listings: {
        Row: {
          id: string;
          user_id: string;
          listing_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          listing_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          listing_id?: string;
        };
        Relationships: [];
      };
             blocked_users: {
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          blocker_id?: string;
          blocked_id?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_user_id: string | null;
          reported_listing_id: string | null;
          report_type: 'user' | 'listing' | 'bug' | 'other';
          reason: string;
          description: string | null;
          status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          reported_user_id?: string | null;
          reported_listing_id?: string | null;
          report_type: 'user' | 'listing' | 'bug' | 'other';
          reason: string;
          description?: string | null;
          status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          id: string;
          admin_id: string;
          action: string;
          target_user_id: string | null;
          target_listing_id: string | null;
          details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          action: string;
          target_user_id?: string | null;
          target_listing_id?: string | null;
          details?: Json | null;
          created_at?: string;
        };
        Update: {
          action?: string;
          target_user_id?: string | null;
          target_listing_id?: string | null;
          details?: Json | null;
        };
        Relationships: [];
      };
      referrals: {
        Row: {
          id: string;
          team_leader_id: string;
          referred_user_id: string;
          referral_code_used: string;
          status: ReferralStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_leader_id: string;
          referred_user_id: string;
          referral_code_used: string;
          status?: ReferralStatus;
          created_at?: string;
        };
        Update: {
          status?: ReferralStatus;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          message: string;
          data: Json | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          message: string;
          data?: Json | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          read_at?: string | null;
        };
        Relationships: [];
      };
      tl_invite_tokens: {
        Row: {
          id: string;
          token: string;
          created_by: string;
          used_by: string | null;
          used_at: string | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          token: string;
          created_by: string;
          used_by?: string | null;
          used_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          used_by?: string | null;
          used_at?: string | null;
        };
        Relationships: [];
      };
      referral_invites: {
        Row: {
          id: string;
          team_leader_id: string;
          email: string;
          status: "pending" | "accepted";
          invite_type: "new_runner" | "existing_runner";
          personal_message: string | null;
          claimed_by: string | null;
          claimed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_leader_id: string;
          email: string;
          status?: "pending" | "accepted";
          invite_type?: "new_runner" | "existing_runner";
          personal_message?: string | null;
          claimed_by?: string | null;
          claimed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          team_leader_id?: string;
          email?: string;
          status?: "pending" | "accepted";
          invite_type?: "new_runner" | "existing_runner";
          personal_message?: string | null;
          claimed_by?: string | null;
          claimed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          email: string;
          subject: string | null;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          email: string;
          subject?: string | null;
          message: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          email?: string;
          subject?: string | null;
          message?: string;
        };
        Relationships: [];
      };
      event_requests: {
        Row: {
          id: string;
          team_leader_id: string;
          status:
            | "under_review"
            | "quoting"
            | "changes_requested"
            | "approved"
            | "scheduled"
            | "rejected"
            | "published";
          event_name: string;
          event_location: string;
          event_date: string;
          request_type: "bib" | "hotel" | "package";
          people_count: number;
          public_note: string | null;
          notes: string | null;
          desired_deadline: string | null;
          quote_summary: string | null;
          selected_agency_name: string | null;
          internal_admin_note: string | null;
          tl_event_details: string | null;
          published_listing_url: string | null;
          selected_quote_id: string | null;
          selected_quote_at: string | null;
          event_image_url: string | null;
          event_image_path: string | null;
          tl_last_seen_update_at: string | null;
          admin_last_seen_update_at: string | null;
          archived_at: string | null;
          archived_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_leader_id: string;
          status?:
            | "under_review"
            | "quoting"
            | "changes_requested"
            | "approved"
            | "scheduled"
            | "rejected"
            | "published";
          event_name: string;
          event_location: string;
          event_date: string;
          request_type: "bib" | "hotel" | "package";
          people_count: number;
          public_note?: string | null;
          notes?: string | null;
          desired_deadline?: string | null;
          quote_summary?: string | null;
          selected_agency_name?: string | null;
          internal_admin_note?: string | null;
          tl_event_details?: string | null;
          published_listing_url?: string | null;
          selected_quote_id?: string | null;
          selected_quote_at?: string | null;
          event_image_url?: string | null;
          event_image_path?: string | null;
          tl_last_seen_update_at?: string | null;
          admin_last_seen_update_at?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          team_leader_id?: string;
          status?:
            | "under_review"
            | "quoting"
            | "changes_requested"
            | "approved"
            | "scheduled"
            | "rejected"
            | "published";
          event_name?: string;
          event_location?: string;
          event_date?: string;
          request_type?: "bib" | "hotel" | "package";
          people_count?: number;
          public_note?: string | null;
          notes?: string | null;
          desired_deadline?: string | null;
          quote_summary?: string | null;
          selected_agency_name?: string | null;
          internal_admin_note?: string | null;
          tl_event_details?: string | null;
          published_listing_url?: string | null;
          selected_quote_id?: string | null;
          selected_quote_at?: string | null;
          event_image_url?: string | null;
          event_image_path?: string | null;
          tl_last_seen_update_at?: string | null;
          admin_last_seen_update_at?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_request_quotes: {
        Row: {
          id: string;
          event_request_id: string;
          agency_name: string;
          package_title: string | null;
          total_price: number;
          currency: string;
          summary: string | null;
          includes: string | null;
          excludes: string | null;
          cancellation_policy: string | null;
          payment_terms: string | null;
          valid_until: string | null;
          attachment_url: string | null;
          attachment_path: string | null;
          attachment_name: string | null;
          attachment_mime: string | null;
          is_recommended: boolean;
          is_selected: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_request_id: string;
          agency_name: string;
          package_title?: string | null;
          total_price: number;
          currency?: string;
          summary?: string | null;
          includes?: string | null;
          excludes?: string | null;
          cancellation_policy?: string | null;
          payment_terms?: string | null;
          valid_until?: string | null;
          attachment_url?: string | null;
          attachment_path?: string | null;
          attachment_name?: string | null;
          attachment_mime?: string | null;
          is_recommended?: boolean;
          is_selected?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          agency_name?: string;
          package_title?: string | null;
          total_price?: number;
          currency?: string;
          summary?: string | null;
          includes?: string | null;
          excludes?: string | null;
          cancellation_policy?: string | null;
          payment_terms?: string | null;
          valid_until?: string | null;
          attachment_url?: string | null;
          attachment_path?: string | null;
          attachment_name?: string | null;
          attachment_mime?: string | null;
          is_recommended?: boolean;
          is_selected?: boolean;
          display_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_request_updates: {
        Row: {
          id: string;
          event_request_id: string;
          actor_id: string | null;
          actor_role: string;
          action: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_request_id: string;
          actor_id?: string | null;
          actor_role: string;
          action: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          actor_id?: string | null;
          actor_role?: string;
          action?: string;
          note?: string | null;
        };
        Relationships: [];
      };

    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
