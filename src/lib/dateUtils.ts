/** Returns the later of two ISO datetime strings. */
export function laterOfIso(a: string, b: string): string {
	return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

/**
 * Formats an ISO datetime as a localized short date (e.g. "Jun 27, 2026").
 * Returns '' for empty or unparseable input so callers can render nothing.
 */
export function formatDate(iso: string): string {
	if (!iso) return '';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
