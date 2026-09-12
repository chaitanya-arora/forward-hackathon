// Shared evidence contract for both outputs. Never trust model-written provenance.
export function validateCitations(citations, input, criterionId) {
  if (!Array.isArray(citations)) throw new Error(`Invalid citations for ${criterionId}.`);
  return citations.map(citation => {
    const source = input.evidence.find(e => e.id === citation?.evidenceId);
    if (!source || typeof citation.quote !== "string" || citation.quote.trim().length < 12 || !source.text.includes(citation.quote)) {
      const error = new Error(`Unverifiable citation for ${criterionId}.`);
      error.code = "UNVERIFIABLE_CITATION";
      throw error;
    }
    return { evidenceId: source.id, quote: citation.quote };
  });
}

// One correction request for the entire assessment, never an unbounded retry.
// The same strict builder validates the corrected result before it can be saved.
export async function buildWithCitationRepair(result, build, repair) {
  try { return build(result); }
  catch (error) {
    if (error.code !== "UNVERIFIABLE_CITATION") throw error;
    return build(await repair(result));
  }
}
