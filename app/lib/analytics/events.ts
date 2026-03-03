export const analyticsEvents = {
  PAGE_VIEW: "page_view",
  HOME_SEARCH_SUBMITTED: "home_search_submitted",
  HOME_SEARCH_SUGGESTION_CLICKED: "home_search_suggestion_clicked",
  HOME_VIEW_ALL_LISTINGS_CLICKED: "home_view_all_listings_clicked",
  HOME_VIEW_ALL_EVENTS_CLICKED: "home_view_all_events_clicked",
  LISTINGS_SEARCH_SUBMITTED: "listings_search_submitted",
  LISTINGS_SEARCH_SUGGESTION_CLICKED: "listings_search_suggestion_clicked",
  LISTINGS_SORT_CHANGED: "listings_sort_changed",
  CONTACT_FORM_SUBMITTED: "contact_form_submitted",
} as const;

export type AnalyticsEventName = (typeof analyticsEvents)[keyof typeof analyticsEvents] | (string & {});
