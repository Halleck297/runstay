export function getPublicDisplayName(profile: any): string {
  if (!profile) return "User";

  if (profile.user_type === "tour_operator") {
    return profile.company_name || "Tour Operator";
  }

  return profile.full_name || profile.company_name || profile.email || "User";
}

export function getPublicInitial(profile: any): string {
  const name = getPublicDisplayName(profile);
  return name.charAt(0).toUpperCase() || "?";
}
