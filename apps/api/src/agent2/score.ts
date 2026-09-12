import type { Completeness, Evidence } from "@climate/contract";

/**
 * Pillar scores are computed here, in code — not asked of the model (spec §4.2).
 * The spec calls for a score "explainable from the completeness rating +
 * evidence count/confidence", and computing it deterministically is what makes
 * the demo beat in §8.2 legible: when a second document is added, the score
 * moves because the evidence moved, not because the model felt different today.
 */

const BASE: Record<Completeness, number> = {
  "Well-substantiated": 78,
  "Partial / Vague": 48,
  Missing: 12,
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function scorePillar(completeness: Completeness, evidence: Evidence[]): number {
  const base = BASE[completeness];

  // More corroborating evidence raises confidence in the rating, with fast
  // diminishing returns — the 9th citation says much less than the 2nd.
  const volume = clamp(Math.round(Math.log2(evidence.length + 1) * 5), 0, 12);

  const meanConfidence =
    evidence.length === 0
      ? 0
      : evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length;
  const quality = evidence.length === 0 ? 0 : clamp(Math.round((meanConfidence - 0.7) * 25), -6, 10);

  return clamp(base + volume + quality, 0, 100);
}

export function overallScore(pillarScores: number[]): number {
  if (pillarScores.length === 0) return 0;
  return Math.round(pillarScores.reduce((a, b) => a + b, 0) / pillarScores.length);
}
