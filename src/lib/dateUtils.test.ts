import { describe, expect, it } from 'vitest';
import { formatDate, laterOfIso } from './dateUtils';

describe('laterOfIso', () => {
	const earlier = '2026-01-01T00:00:00.000Z';
	const later = '2026-06-27T12:00:00.000Z';

	it('returns the later date when a > b', () => {
		expect(laterOfIso(later, earlier)).toBe(later);
	});

	it('returns the later date when b > a', () => {
		expect(laterOfIso(earlier, later)).toBe(later);
	});

	it('returns either when the dates are equal', () => {
		expect(laterOfIso(later, later)).toBe(later);
	});
});

describe('formatDate', () => {
	it('returns a non-empty string for a valid ISO date', () => {
		expect(formatDate('2026-06-27T12:00:00.000Z')).not.toBe('');
	});

	it('returns empty string for empty input', () => {
		expect(formatDate('')).toBe('');
	});

	it('returns empty string for invalid input', () => {
		expect(formatDate('not-a-date')).toBe('');
	});
});
