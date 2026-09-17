import type { MetaFunction } from "react-router";

export const landingMeta: MetaFunction = () => [
  { title: "Your next start line | BibExchange by Runoot" },
  { name: "description", content: "Tell us which marathon you want to run. Get notified when a matching race entry becomes available." },
  { tagName: "link", rel: "canonical", href: "https://www.runoot.com/" },
];

export const BIB_CONSENT_VERSION = "2026-09-16";
export const BIB_CONSENT_TEXT = "I’d like email updates about matching race opportunities. I can withdraw my request by contacting support@runoot.com.";

export const bibRaces = [
  { name: "Tokyo", country: "Japan", code: "TYO" },
  { name: "Cardiff", country: "United Kingdom", code: "CDF" },
  { name: "London", country: "United Kingdom", code: "LON" },
  { name: "Cape Town", country: "South Africa", code: "CPT" },
  { name: "Chicago", country: "United States", code: "CHI" },
  { name: "New York", country: "United States", code: "NYC" },
  { name: "Sydney", country: "Australia", code: "SYD" },
  { name: "Another race", country: "Your next adventure", code: "+" },
];

export function isBibLandingPath(path: string) {
  return /^\/(?:go\/?|(?:en|de|fr|it|es|nl|pt)\/?)?$/.test(path);
}

export function bibRequestSource(path: string): "qr" | "site" {
  return /^\/go\/?$/.test(path) ? "qr" : "site";
}

export function validateBibRequest(form: FormData) {
  const read = (key: string) => String(form.get(key) ?? "").normalize("NFKC").trim();
  const firstName = read("firstName");
  const lastName = read("lastName");
  const email = read("email").toLowerCase();
  const selected = [...new Set(form.getAll("race").map(value => String(value).normalize("NFKC").trim()))];
  const races = selected.map(value => value === "Another race" ? read("otherRace").replace(/\s+/g, " ") : value);
  const preferences = [...new Set(form.getAll("preference").map(value => String(value)))];
  if (!selected.length || selected.some(value => !bibRaces.some(item => item.name === value)) || races.some(race => race.length < 2 || race.length > 120 || /[\u0000-\u001f]/.test(race))) {
    return { error: "Please choose at least one race and enter a name if you select Another race." } as const;
  }
  if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100 || /[\u0000-\u001f]/.test(firstName + lastName)) {
    return { error: "Please enter your first and last name (up to 100 characters each)." } as const;
  }
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    return { error: "Please enter a valid email address." } as const;
  }
  if (!preferences.length || preferences.some(value => value !== "bib" && value !== "package")) {
    return { error: "Please select Bib only, Full package, or both." } as const;
  }
  if (form.get("consent") !== "on") {
    return { error: "Please agree to receive updates about your request." } as const;
  }
  // A custom name may match a listed race; save each race only once.
  const uniqueRaces = [...new Map(races.map(race => [race.toLowerCase(), { race, race_key: race.toLowerCase() }])).values()];
  const preference = preferences.length === 2 ? "both" : preferences[0] as "bib" | "package";
  return { value: { first_name: firstName, last_name: lastName, email, races: uniqueRaces, preference } } as const;
}
