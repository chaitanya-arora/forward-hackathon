// Visual mapping belongs only to the overall frontend score, never findings/actions.
export function readinessTone(score: number | null): "neutral" | "red" | "amber" | "green" {
  if (score == null || !Number.isFinite(score)) return "neutral";
  return score < 50 ? "red" : score < 80 ? "amber" : "green";
}
