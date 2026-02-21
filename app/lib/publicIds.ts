const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function getProfilePublicId(profile: { id: string; short_id?: string | null }): string {
  return profile.short_id || profile.id;
}

export function getListingPublicId(listing: { id: string; short_id?: string | null }): string {
  return listing.short_id || listing.id;
}

export function applyProfilePublicIdFilter<TQuery extends { eq: (column: string, value: string) => TQuery }>(
  query: TQuery,
  publicId: string
): TQuery {
  return isUuid(publicId) ? query.eq("id", publicId) : query.eq("short_id", publicId);
}

export function applyListingPublicIdFilter<TQuery extends { eq: (column: string, value: string) => TQuery }>(
  query: TQuery,
  publicId: string
): TQuery {
  return isUuid(publicId) ? query.eq("id", publicId) : query.eq("short_id", publicId);
}
