export function isAgency(profile: any): boolean {
  return profile?.user_type === "agency";
}

/** @deprecated use isAgency() */
export function isTourOperator(profile: any): boolean {
  return isAgency(profile);
}

export function isTeamLeader(profile: any): boolean {
  return profile?.platform_role === "team_leader";
}

export function isAmbassador(profile: any): boolean {
  return profile?.platform_role === "ambassador";
}

export function canInvite(profile: any): boolean {
  return isTeamLeader(profile) || isAmbassador(profile);
}

export function isAdmin(profile: any): boolean {
  return profile?.role === "admin" || profile?.role === "superadmin";
}

export function isSuperAdmin(profile: any): boolean {
  return profile?.role === "superadmin";
}

export function getUserRoleLabel(profile: any): string {
  if (isSuperAdmin(profile)) return "superadmin";
  if (isAdmin(profile)) return "admin";
  if (isTeamLeader(profile)) return "team leader";
  if (isAmbassador(profile)) return "ambassador";
  if (isAgency(profile)) return "agency";
  return "user";
}

export function getDefaultAppPath(profile: any): string {
  if (isTeamLeader(profile)) return "/tl-dashboard";
  if (isAgency(profile)) return "/to-panel";
  return "/listings";
}

export function needsAdminPhoneVerification(profile: any): boolean {
  if (!profile) return false;
  if (profile.user_type !== "private") return false;
  if (!Object.prototype.hasOwnProperty.call(profile, "phone_verified_at")) return false;
  return Boolean(profile.created_by_admin) && !profile.phone_verified_at;
}
