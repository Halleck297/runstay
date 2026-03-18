export function isTourOperator(profile: any): boolean {
  return profile?.user_type === "tour_operator";
}

export function isTeamLeader(profile: any): boolean {
  return profile?.user_type === "team_leader" || profile?.is_team_leader === true;
}

export function isAdmin(profile: any): boolean {
  return (
    profile?.user_type === "admin" ||
    profile?.user_type === "superadmin" ||
    profile?.role === "admin" ||
    profile?.role === "superadmin"
  );
}

export function isSuperAdmin(profile: any): boolean {
  return profile?.user_type === "superadmin" || profile?.role === "superadmin";
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

export function needsAdminPhoneVerification(profile: any): boolean {
  if (!profile) return false;
  if (profile.user_type !== "private") return false;
  if (!Object.prototype.hasOwnProperty.call(profile, "phone_verified_at")) return false;
  return Boolean(profile.created_by_admin) && !profile.phone_verified_at;
}
