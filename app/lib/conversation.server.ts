import { isUuid } from "~/lib/publicIds";

export function applyConversationPublicIdFilter<TQuery extends { eq: (column: string, value: string) => TQuery }>(
  query: TQuery,
  publicId: string
): TQuery {
  return isUuid(publicId) ? query.eq("id", publicId) : query.eq("short_id", publicId);
}
