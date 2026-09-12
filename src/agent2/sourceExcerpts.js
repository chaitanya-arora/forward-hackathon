// References are selected by the model; quotation text is always owned by code.
export function sourceExcerpts(input, schema) {
  const lookup = new Map();
  const evidence = input.evidence.map(source => {
    const excerpts = [];
    let start = 0;
    while (start < source.text.length) {
      let end = Math.min(start + 1000, source.text.length);
      if (end < source.text.length) {
        const boundary = source.text.lastIndexOf(" ", end);
        if (boundary > start + 500) end = boundary;
      }
      // Keep a short final tail with its preceding excerpt.
      if (source.text.length - end < 12) end = source.text.length;
      const excerptId = `${source.id}_${excerpts.length + 1}`;
      const text = source.text.slice(start, end);
      lookup.set(excerptId, { evidenceId: source.id, quote: text });
      excerpts.push({ excerptId, text });
      start = end;
    }
    const { text, ...metadata } = source;
    return { ...metadata, excerpts };
  });
  const responseJsonSchema = structuredClone(schema);
  responseJsonSchema.properties.assessments.items.properties.citations.items = {
    type: "object", additionalProperties: false, required: ["excerptId"],
    properties: { excerptId: { type: "string", enum: [...lookup.keys()] } },
  };
  return { evidence, responseJsonSchema, resolve(result) {
    if (!Array.isArray(result?.assessments)) return result; // Builder supplies structural errors.
    return { ...result, assessments: result.assessments.map(item => ({ ...item,
      citations: Array.isArray(item?.citations) ? item.citations.map(c => {
        if (!c || !Object.hasOwn(c, "excerptId")) throw new Error("Citation must select a supplied excerptId; model-written quotations are not accepted.");
        const source = lookup.get(c.excerptId);
        if (!source) throw new Error("Unknown source excerpt ID; no report was saved.");
        return { ...source };
      }) : item?.citations,
    })) };
  } };
}
