export const ListingStatus = {
  ACTIVE: "active",
  PENDING: "pending",
  SOLD: "sold",
  EXPIRED: "expired",
  DRAFT: "draft",
} as const;

export const ListingType = {
  ROOM: "room",
  BIB: "bib",
  ROOM_AND_BIB: "room_and_bib",
} as const;

export const UserType = {
  PRIVATE: "private",
  TOUR_OPERATOR: "agency",
  TEAM_LEADER: "team_leader",
  ADMIN: "admin",
  SUPERADMIN: "superadmin",
} as const;

export const ReferralStatus = {
  PENDING: "pending",
  REGISTERED: "registered",
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export const ConversationStatus = {
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;
