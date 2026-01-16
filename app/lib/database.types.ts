export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ListingType = "room" | "bib" | "room_and_bib";
export type UserType = "tour_operator" | "private";
export type ListingStatus = "active" | "sold" | "expired";
export type TransferType = "official_process" | "package" | "contact";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          user_type: UserType;
          company_name: string | null;
          phone: string | null;
          is_verified: boolean;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          user_type?: UserType;
          company_name?: string | null;
          phone?: string | null;
          is_verified?: boolean;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          user_type?: UserType;
          company_name?: string | null;
          phone?: string | null;
          is_verified?: boolean;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          name: string;
          location: string;
          country: string;
          event_date: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          location: string;
          country: string;
          event_date: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          location?: string;
          country?: string;
          event_date?: string;
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
    // DEPRECATI (mantieni per backward compatibility)
    price: number | null;
    price_negotiable: boolean;
    
    // NUOVI CAMPI - aggiungere dopo riga 94
    transfer_type: TransferType | null;
    associated_costs: number | null;
    cost_notes: string | null;
    
    
    status: ListingStatus;
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
  price_negotiable?: boolean;
  
  // NUOVI - aggiungere dopo riga 113
  transfer_type?: TransferType | null;
  associated_costs?: number | null;
  cost_notes?: string | null;
  
  
  status?: ListingStatus;
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
  price_negotiable?: boolean;
  
  // NUOVI - aggiungere dopo riga 129
  transfer_type?: TransferType | null;
  associated_costs?: number | null;
  cost_notes?: string | null;
  
  
  status?: ListingStatus;
  updated_at?: string;
};

      };
      conversations: {
        Row: {
          id: string;
          listing_id: string;
          participant_1: string;
          participant_2: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          participant_1: string;
          participant_2: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
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
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          read_at?: string | null;
        };
      };
    };
  };
}
