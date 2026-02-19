export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ListingType = "room" | "bib" | "room_and_bib";
export type UserType = "tour_operator" | "private";
export type UserRole = "user" | "admin" | "superadmin";
export type ListingStatus = "pending" | "active" | "sold" | "expired" | "rejected";
export type TransferType = "official_process" | "package" | "contact";
export type Currency = "EUR" | "USD" | "GBP" | "JPY";
export type ReferralStatus = "registered" | "active";
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
          // Team Leader
          is_team_leader: boolean;
          referral_code: string | null;
          tl_welcome_message: string | null;
          // Admin tracking
          created_by_admin: string | null;
          created_at: string;
          updated_at: string;
        };

        Insert: {
          id: string;
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
          is_team_leader?: boolean;
          referral_code?: string | null;
          tl_welcome_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
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
          is_team_leader?: boolean;
          referral_code?: string | null;
          tl_welcome_message?: string | null;
          updated_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          country: string;
          event_date: string;
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
          slug?: string | null;
          country: string;
          event_date: string;
          start_lat?: number | null;
          start_lng?: number | null;
          finish_lat?: number | null;
          finish_lng?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string | null;
          country?: string;
          event_date?: string;
          start_lat?: number | null;
          start_lng?: number | null;
          finish_lat?: number | null;
          finish_lng?: number | null;
        };
      };

            hotels: {
        Row: {
          id: string;
          place_id: string | null;
          name: string;
          city: string | null;
          country: string | null;
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
          city?: string | null;
          country?: string | null;
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
          city?: string | null;
          country?: string | null;
          website?: string | null;
          lat?: number | null;
          lng?: number | null;
          rating?: number | null;
          updated_at?: string;
        };
      };

      listings: {
  Row: {
    id: string;
    author_id: string;
    event_id: string;
    listing_type: ListingType;
    title: string;
    description: string | null;
    hotel_name: string | null;
    hotel_website: string | null;
    hotel_place_id: string | null;
    hotel_city: string | null;
    hotel_country: string | null;
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
  author_id: string;
  event_id: string;
  listing_type: ListingType;
  title: string;
  description?: string | null;
  hotel_name?: string | null;
  hotel_stars?: number | null;
  hotel_website?: string | null;
  hotel_place_id?: string | null;
  hotel_city?: string | null;
  hotel_country?: string | null;
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
  listing_type?: ListingType;
  title?: string;
  description?: string | null;
  hotel_name?: string | null;
  hotel_website?: string | null;
  hotel_place_id?: string | null;
  hotel_city?: string | null;
  hotel_country?: string | null;
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

      };
            conversations: {
        Row: {
          id: string;
          listing_id: string;
          participant_1: string;
          participant_2: string;
          deleted_by_1: boolean;
          deleted_by_2: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          participant_1: string;
          participant_2: string;
          deleted_by_1?: boolean;
          deleted_by_2?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          deleted_by_1?: boolean;
          deleted_by_2?: boolean;
          updated_at?: string;
        };
      };

      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
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
          read_at?: string | null;
          created_at?: string;
          detected_language?: string | null;
          translated_content?: string | null;
          translated_to?: string | null;
        };
        Update: {
          read_at?: string | null;
          detected_language?: string | null;
          translated_content?: string | null;
          translated_to?: string | null;
        };
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
        Delete: {
          id?: string;
          user_id?: string;
          listing_id?: string;
        };
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
        Delete: {
          id?: string;
          blocker_id?: string;
          blocked_id?: string;
        };
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
      };

    };
  };
}
