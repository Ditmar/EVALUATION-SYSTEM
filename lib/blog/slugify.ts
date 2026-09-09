const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

/** Lowercase, accent-stripped, hyphenated slug — used for both article slugs and heading anchor ids. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
