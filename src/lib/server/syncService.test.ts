import { describe, expect, it } from 'vitest';
import { syncCooldownRemainingMs } from './syncService';

describe('syncCooldownRemainingMs', () => {
	const intervalMs = 5 * 60 * 1000;
	const now = new Date('2026-06-27T12:00:00.000Z');

	it('returns 0 when there is no prior sync', () => {
		expect(syncCooldownRemainingMs(null, now, intervalMs)).toBe(0);
	});

	it('returns 0 exactly at the interval boundary', () => {
		const last = new Date(now.getTime() - intervalMs);
		expect(syncCooldownRemainingMs(last, now, intervalMs)).toBe(0);
	});

	it('returns the positive remaining time just under the interval', () => {
		const last = new Date(now.getTime() - (intervalMs - 1000));
		expect(syncCooldownRemainingMs(last, now, intervalMs)).toBe(1000);
	});

	it('returns 0 well past the interval', () => {
		const last = new Date(now.getTime() - intervalMs * 10);
		expect(syncCooldownRemainingMs(last, now, intervalMs)).toBe(0);
	});
});
