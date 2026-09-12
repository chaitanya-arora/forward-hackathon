// Shared evidence contract for both outputs. Never trust model-written provenance.
export function validateCitations(citations, input, criterionId) {
  if (!Array.isArray(citations)) throw new Error(`Invalid citations for ${criterionId}.`);
  return citations.map(citation => {
    const source = input.evidence.find(e => e.id === citation?.evidenceId);
    if (!source || typeof citation.quote !== "string" || citation.quote.trim().length < 12 || !source.text.includes(citation.quote)) throw new Error(`Unverifiable citation for ${criterionId}.`);
    return { evidenceId: source.id, quote: citation.quote };
  });
}
