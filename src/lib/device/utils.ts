import { m } from '$lib/paraglide/messages.js';

// Decimal places implied by a multiplier used to scale raw config values into
// human units. Powers of ten map cleanly: 10 -> 1, 100 -> 2, 1000 -> 3.
export function decimalsFor(multiplier: number): number {
	if (!Number.isFinite(multiplier) || multiplier <= 1) return 0;
	const fraction = (1 / multiplier).toString();
	const dot = fraction.indexOf('.');
	return dot === -1 ? 0 : fraction.length - dot - 1;
}

// Localized description for a config param, looked up by name via the i18n
// message `field_desc__<name>`. Params carry no description themselves.
export function fieldDesc(name: string): string | undefined {
	const messages = m as unknown as Record<string, (() => string) | undefined>;
	return messages[`field_desc__${name}`]?.() || undefined;
}

// Display label for a config param: the i18n message `field_label__<name>`,
// otherwise the device-provided label, otherwise the raw name.
export function fieldLabel(name: string, label?: string): string {
	const messages = m as unknown as Record<string, (() => string) | undefined>;
	return messages[`field_label__${name}`]?.() || label || name;
}
