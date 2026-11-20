/**
 * Sumber waktu "sekarang". Di-inject supaya test bisa memakai waktu tetap
 * dan tidak bergantung pada kapan test dijalankan.
 */
export type Clock = { now(): Date };

export const systemClock: Clock = { now: () => new Date() };
