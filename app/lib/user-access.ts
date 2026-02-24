export function isTourOperator(profile: any): boolean {
  return profile?.user_type === "tour_operator";
}

export function isTeamLeader(profile: any): boolean {
  return profile?.user_type === "team_leader";
}

export function isAdmin(profile: any): boolean {
  return profile?.user_type === "admin" || profile?.user_type === "superadmin";
}

export function isSuperAdmin(profile: any): boolean {
  return profile?.user_type === "superadmin";
}

export function getUserRoleLabel(profile: any): string {
  if (profile?.user_type === "superadmin") return "superadmin";
  if (profile?.user_type === "admin") return "admin";
  if (profile?.user_type === "team_leader") return "team leader";
  if (profile?.user_type === "tour_operator") return "tour operator";
  return "user";
}

export function getDefaultAppPath(profile: any): string {
  if (isTeamLeader(profile)) return "/tl-dashboard";
  if (isTourOperator(profile)) return "/to-panel";
  return "/listings";
}
