const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function applyConversationPublicIdFilter<TQuery extends { eq: (column: string, value: string) => TQuery }>(
  query: TQuery,
  publicId: string
): TQuery {
  return isUuid(publicId) ? query.eq("id", publicId) : query.eq("short_id", publicId);
}
