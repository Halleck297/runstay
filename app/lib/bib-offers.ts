export const BIB_OFFER_CONSENT = "I agree that Runoot may contact me about this offer. Submitting it does not guarantee a sale or an approved transfer.";
export const BIB_OFFER_VERSION = "2026-09-17";

export function validateBibOffer(form: FormData) {
  const read = (key: string) => String(form.get(key) ?? "").normalize("NFKC").trim();
  const first_name = read("firstName"), last_name = read("lastName"), email = read("email").toLowerCase();
  const phone = read("phone");
  const race = read("race"), race_date = read("raceDate"), deadline = read("deadline");
  const entry_type = read("entryType"), transfer_status = read("transferStatus");
  const price = read("price").replace(",", "."), currency = read("currency"), notes = read("notes");
  const validText = (value: string, min: number, max: number) => value.length >= min && value.length <= max && !/[\u0000-\u001f]/.test(value);
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!validText(race, 2, 120) || !validDate(race_date)) return { error: "Please enter the race name and its date." } as const;
  if (entry_type !== "bib" && entry_type !== "package") return { error: "Please choose the type of entry." } as const;
  if (!["official_transfer", "unknown"].includes(transfer_status)) return { error: "Please choose how the entry can be assigned or transferred." } as const;
  if (deadline && (!validDate(deadline) || deadline > race_date)) return { error: "The transfer deadline must be a valid date on or before race day." } as const;
  if (price && (!/^\d{1,6}(\.\d{1,2})?$/.test(price) || Number(price) > 100000)) return { error: "Please enter a valid price, or leave it empty." } as const;
  if (!["EUR", "GBP", "USD", "JPY", "AUD", "CAD", "ZAR"].includes(currency)) return { error: "Please choose a currency." } as const;
  if (!validText(first_name, 1, 100) || !validText(last_name, 1, 100)) return { error: "Please enter your first and last name." } as const;
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return { error: "Please enter a valid email address." } as const;
  if (!phone || phone.length > 40 || !/^[+0-9().\s-]+$/.test(phone) || phone.replace(/\D/g, "").length < 6 || phone.replace(/\D/g, "").length > 20) return { error: "Please enter a valid phone number, including the country code." } as const;
  if (notes.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(notes)) return { error: "Please keep your notes under 2,000 characters." } as const;
  if (form.get("consent") !== "on") return { error: "Please agree to be contacted about your offer." } as const;
  return { value: { first_name, last_name, email, phone, race, race_date, entry_type, transfer_status: transfer_status as "official_transfer" | "unknown", deadline: deadline || null, price: price ? Number(price) : null, currency, notes: notes || null } } as const;
}
