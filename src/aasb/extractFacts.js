// Conservative local parsers. Ambiguous/table-layout values remain candidates;
// missing values are null, never inferred from company identity or reportYear.
const number = text => Number(text.replace(/[,\s]/g, ""));
const datePattern = "(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{4})";
function isoDate(text) {
  const months=["january","february","march","april","may","june","july","august","september","october","november","december"];
  const named=text.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  const iso=named ? `${named[3]}-${String(months.indexOf(named[2].toLowerCase())+1).padStart(2,"0")}-${named[1].padStart(2,"0")}` : text;
  const parsed=Date.parse(iso);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0,10)===iso ? iso : null;
}
export function sourceReference(source, start, end) {
  const markers = [...source.text.slice(0, start + 1).matchAll(/\[Page (\d+)\]/g)];
  const through = [...source.text.slice(start, end).matchAll(/\[Page (\d+)\]/g)].map(m => Number(m[1]));
  const pages = [...new Set([...(markers.length ? [Number(markers.at(-1)[1])] : source.pages ?? []), ...through])];
  return { evidenceId: source.id, documentId: source.documentId ?? null, source: source.source ?? null,
    pages, start, end, excerpt: source.text.slice(start, Math.min(end, start + 220)) };
}
function record(source, match, value) {
  return { value, rawValue: match[0], evidenceIds: [source.id],
    sourceReferences: [sourceReference(source, match.index, match.index + match[0].length)],
    status: value === null ? "requires_human_confirmation" : "extracted_requires_verification" };
}
function collect(input, pattern, convert = m => m[1]?.trim() ?? m[0].trim()) {
  return input.evidence.flatMap(source => {
    // PDF layout whitespace is normalized only for matching; offsets map back
    // to the exact, untouched source text for provenance and quotations.
    let text=""; const offsets=[];
    for(const token of source.text.matchAll(/\s+|\S/g)) {text+=/^\s/.test(token[0]) ? " " : token[0];offsets.push(token.index);}
    offsets.push(source.text.length);
    return [...text.matchAll(new RegExp(pattern,"gim"))].map(match=>{
      const value=convert(match); const start=offsets[match.index],end=offsets[match.index+match[0].length];
      const original=[source.text.slice(start,end)];original.index=start;
      return record(source,original,value);
    });
  });
}
function select(candidates) {
  const distinct = [...new Set(candidates.map(c => JSON.stringify(c.value)))];
  return { value: distinct.length === 1 ? candidates[0].value : null,
    status: !candidates.length ? "missing" : distinct.length > 1 ? "requires_human_confirmation" : "extracted_requires_verification",
    evidenceIds: [...new Set(candidates.flatMap(c => c.evidenceIds))], candidates };
}
const definitions = {
  governingBody: /(?:the\s+)?([A-Z][\w &'’-]*(?:Board|Committee|Council|Trustees)|Board|Council|Trustees)\s+(?:has|have|holds?|oversees?|reviews?|is responsible)[^.!?\n]{0,180}(?:climate|sustainability)[^.!?\n]*/.source,
  boundary: /(?:organisational|organizational|emissions|reporting)\s+boundary\s*(?:is|:|covers|includes)\s*([^.;\n]+)/.source,
  methodology: /(?:methodology|measurement approach|emissions methodology)\s*(?:is|:|uses?)\s*([^.;\n]+)/.source,
  emissionsFactors: /(?:emission(?:s)? factors?)\s*(?:are|:|from|based on)\s*([^.;\n]+)/.source,
  assumptions: /(?:key |physical |transition )?assumptions?\s*(?:are|:|include)\s*([^.;\n]+)/.source,
  estimationApproaches: /(?:estimation approach|estimation method)\s*(?:is|:|uses?)\s*([^.;\n]+)/.source,
  dataLimitations: /(?:data limitations?|data quality limitations?)\s*(?:are|:|include)\s*([^.;\n]+)/.source,
  recalculations: /(?:base.year recalculation|recalculations?)\s*(?:is|are|:|planned)\s*([^.;\n]+)/.source,
  categories: /Scope\s*3\s+categories\s*(?:include|are|:)\s*([^.;\n]+)/.source,
  modelProvider: /(?:model provider|scenario provider|climate model)\s*(?:is|:|was)\s*([^.;\n]+)/.source,
  dataSources: /(?:data sources?|scenario sources?)\s*(?:are|:|include)\s*([^.;\n]+)/.source,
  timeHorizons: /((?:short|medium|long)[ -]term\s*(?:is|:|means|horizon)?\s*\d+[^.;\n]{0,100})/.source,
  results: /(?:scenario results?|resilience conclusion|scenario implications?)\s*(?:are|:|is|include)\s*([^.;\n]+)/.source,
  financialEffects: /(?:current |anticipated )?financial effects?\s*(?:are|:|include)\s*([^;\n]+)/.source,
  physicalRiskExposure: /(?:physical.risk exposure)\s*(?:is|:|was)\s*([^;\n]+)/.source,
  transitionRiskExposure: /(?:transition.risk exposure)\s*(?:is|:|was)\s*([^;\n]+)/.source,
  capitalDeployment: /(?:capital deployment|climate capital expenditure)\s*(?:is|:|was)\s*([^;\n]+)/.source,
  internalCarbonPrice: /(?:internal carbon price)\s*(?:is|:|of|was)\s*([^;\n]+)/.source,
  executiveRemuneration: /((?:climate|sustainability)[^.;\n]{0,90}\d+(?:\.\d+)?\s*%[^.;\n]{0,70}(?:remuneration|pay|scorecard)|(?:remuneration|pay|scorecard)[^.;\n]{0,90}\d+(?:\.\d+)?\s*%[^.;\n]{0,70}(?:climate|sustainability))/.source,
  assuranceProvider: /(?:assurance provider|independent (?:auditor|assurance practitioner))\s*(?:is|:|was)\s*([^.;\n]+)|(?:limited|reasonable) assurance (?:was )?(?:provided|performed) by\s+([^.;\n]+)/.source,
  assuranceFramework: /(?:assurance (?:standard|framework))\s*(?:is|:|was)\s*([^.;\n]+)/.source,
  reviewedAreas: /(?:reviewed disclosures|reviewed areas|limited assurance (?:over|on|covers))\s*:?\s*([^.;\n]+)/.source,
  auditedAreas: /(?:audited disclosures|audited areas|reasonable assurance (?:over|on|covers))\s*:?\s*([^.;\n]+)/.source,
  assuranceConclusion: /(?:assurance conclusion|auditor.s opinion|review conclusion)\s*:\s*([^;\n]+)/.source,
};

export function extractStructuredFacts(input) {
  const fields = Object.fromEntries(Object.entries(definitions).map(([key, pattern]) =>
    [key, select(collect(input, pattern, m => (m[1] || m[2] || m[0]).trim()))]));
  const supplement=(key,pattern,convert)=>{const found=collect(input,pattern,convert);if(found.length)fields[key]=select([...fields[key].candidates,...found]);};
  supplement("modelProvider",/(?:used|uses?)\s+([\w &’-]+?)\s+to (?:perform|conduct) (?:the )?modell?ing (?:of )?climate data/.source,m=>m[1]);
  supplement("boundary",/(?:adopts?|uses?)\s+(?:an? )?(operational control|financial control|equity share)\s+approach\s+to\s+set\s+(?:its|the)\s+boundary/.source,m=>m[1]);
  for(const key of ["financialEffects","physicalRiskExposure","transitionRiskExposure","capitalDeployment","internalCarbonPrice","executiveRemuneration"]) {
    const converted=fields[key].candidates.map(c=>{
      const text=c.value;
      const amount=text.match(/(AUD|USD|EUR|GBP|A\$|US\$|\$|€|£)\s*([\d,]+(?:\.\d+)?)\s*(million|billion|thousand)?/i);
      const percent=text.match(/(\d+(?:\.\d+)?)\s*%/);
      const factor=amount ? ({million:1e6,billion:1e9,thousand:1e3})[amount[3]?.toLowerCase()] ?? 1 : null;
      return {...c,value:{description:text,amount:amount ? number(amount[2]) : null,currency:amount?.[1]??null,
        scale:amount?.[3]??null,normalizedAmount:amount ? number(amount[2])*factor : null,
        conversion:amount ? {method:"explicit currency amount scale",factor,currencyInferred:false} : null,
        percentage:percent ? Number(percent[1]) : null,explicitNonUse:/\b(?:not used|do not use|no internal carbon price)\b/i.test(text),period:null,boundary:null}};
    });
    fields[key]=select(converted);
  }
  const periods = collect(input, `((?:(?:financial|reporting|emissions|GHG)\\s+(?:year|period)|\\d{1,2}[ -]weeks?(?:\\s+period)?|year|period)\\s+(?:ended|ending)\\s+(${datePattern}))`, m => ({ startDate: null, endDate: isoDate(m[2]), disclosedPeriod: m[1],
    kind: /emissions|GHG/i.test(m.input.slice(Math.max(0,m.index-70),m.index)+m[1]) ? "emissions" : "reporting" }));
  periods.push(...collect(input, `((?:financial|reporting|emissions|GHG)\\s+(?:year|period)\\s*(?:is|:|from)?\\s*(${datePattern})\\s+(?:to|through|–|-)\\s*(${datePattern}))`, m => ({startDate:isoDate(m[2]),endDate:isoDate(m[3]),disclosedPeriod:m[1],kind:/emissions|GHG/i.test(m[1]) ? "emissions" : "reporting"})));
  periods.push(...collect(input, `((?:Scope\\s*[123][^.;]{0,70}|GHG |emissions )emissions?[^.;]{0,60}?period\\s+(${datePattern})\\s+to\\s+(${datePattern}))`,m=>({startDate:isoDate(m[2]),endDate:isoDate(m[3]),disclosedPeriod:m[1],kind:"emissions"})));
  for(const p of periods) {
    const weeks=p.value.disclosedPeriod.match(/^(\d{1,2})[ -]weeks?/i);
    if(weeks && p.value.endDate) {
      p.value.startDate=new Date(Date.parse(p.value.endDate)-(Number(weeks[1])*7-1)*86400000).toISOString().slice(0,10);
      p.value.derivation={method:"inclusive interval from explicitly disclosed week count",weeks:Number(weeks[1])};
    }
  }
  const emissions = collect(input, /Scope\s*([123])\s*(?:GHG\s*)?(?:emissions\s*)?(?:\(?(location[ -]based|market[ -]based)\)?\s*)?(?:emissions\s*)?(?:=|:|were|was|of)?\s*([\d,]+(?:\.\d+)?)\s*(MtCO[2₂][ -]?[eE]|ktCO[2₂][ -]?[eE]|tCO[2₂][ -]?[eE]|tonnes?\s+CO[2₂][ -]?[eE])/i.source, m => {
    const factor = /^Mt/.test(m[4]) ? 1e6 : /^kt/i.test(m[4]) ? 1000 : 1;
    return {scope:Number(m[1]),basis:m[2]?.toLowerCase().replace(" ","-") ?? null,value:number(m[3]),unit:m[4],
      normalized:{value:number(m[3])*factor,unit:"tCO2-e",conversionFactor:factor,method:"disclosed unit scale only"}};
  });
  const adoption = {
    earlyAmendmentAdoption: select(collect(input, /((?:(?:did not |have not |has not |not )(?:yet )?(?:elect(?:ed)? to )?early[ -]adopt(?:ed)?\b|elected to early[ -]adopt\b|early[ -]adopted\b)[^.!?\n]{0,140}(?:December\s+2025|2025\s+amendments|S2025-1)[^.!?\n]*)/.source, m => !/\bnot\b/i.test(m[0]))),
    firstYearOfApplication: select(collect(input, /((?:not (?:the |our |its |their )?)?first (?:annual |reporting )?(?:period|year)[^.!?\n]{0,100}(?:AASB\s*S2|ASRS))/.source, m => !/\bnot\b/i.test(m[0]))),
    comparativesRelief: select(collect(input, /((?:did not |have not |has not )?(?:elect(?:ed)?|appl(?:y|ied)|use[ds]?)\s+(?:the\s+)?(?:first.year\s+)?comparative(?:-information| information|s)?\s+relief)/.source, m => !/\bnot\b/i.test(m[0]))),
    scope3Relief: select(collect(input, /((?:did not |have not |has not )?(?:elect(?:ed)?|appl(?:y|ied)|use[ds]?)\s+(?:the\s+)?(?:first.year\s+)?Scope\s*3\s+relief)/.source, m => !/\bnot\b/i.test(m[0]))),
    otherReliefs: collect(input, /((?:elected|applied|used)[^.!?\n]{0,100}(?:transition relief|methodology relief)[^.!?\n]*)/.source),
  };
  const tableEmissions=collect(input,/Scope\s*([123])\s*(?:\((location[ -]based|market[ -]based)\)\s*)?(?:GHG\s*)?emissions\s+([Mk]?tCO\s*[2₂]\s*-?\s*e)\s+(?:(?:Category\b(?:(?!Scope\s*[123]|Total).){0,2000})\s*)?Total\s+([\d,]+(?:\s*[,\.]\s*\d+)*)/.source,m=>{
    const unit=m[3],factor=/^Mt/.test(unit)?1e6:/^kt/i.test(unit)?1000:1,value=number(m[4]);
    return {scope:Number(m[1]),basis:m[2]?.toLowerCase().replace(" ","-")??null,value,unit,
      normalized:{value:value*factor,unit:"tCO2-e",conversionFactor:factor,method:"disclosed unit scale; PDF numeric whitespace removed"}};
  });
  emissions.push(...tableEmissions);
  const electedComparatives=collect(input,/((?:has |have )?elected to apply (?:the )?transition relief to not disclose comparative information)/.source,()=>true);
  if(electedComparatives.length)adoption.comparativesRelief=select([...adoption.comparativesRelief.candidates,...electedComparatives]);
  const scenarios = collect(input, /((?:scenario|pathway)\s+["“]?([^"”\n;:]{1,90})["”]?\s*[:(]\s*(\d+(?:\.\d+)?)\s*°\s*C)/.source,
    m => ({name:m[2].trim(),temperatureC:Number(m[3]),socioeconomicPathway:null}));
  const temperatures = collect(input, /(\d+(?:\.\d+)?)\s*°\s*C/.source, m => Number(m[1]));
  const scenarioInput={evidence:input.evidence.filter(e=>/scenario|climate resilience/i.test(e.text))};
  const scenarioTemperatures = scenarios.map(s=>({...s,value:s.value.temperatureC}));
  scenarioTemperatures.push(...collect(scenarioInput,/(\d+(?:\.\d+)?)\s*°\s*C\s+scenario/.source,m=>Number(m[1])));
  const temperatureTables=collect(scenarioInput,/Temperature increase by\s+\d{4}\s*(?:\d\s+)?((?:\d+(?:\.\d+)?\s*°\s*C\s*){2,})/.source,m=>[...m[1].matchAll(/(\d+(?:\.\d+)?)\s*°\s*C/g)].map(v=>Number(v[1])));
  scenarioTemperatures.push(...temperatureTables.flatMap(t=>t.value.map(value=>({...t,value}))));
  const pathways = collect(input, /\b(SSP\d(?:[-–]\d(?:\.\d)?)?|RCP\s*\d(?:\.\d)?)\b/.source);
  const targets = collect(input, /((?:target|ambition|goal)\s*[:\-]?\s*[^\n;]{12,600})/.source, m => {
    const t=m[1];
    return { description:t.trim(), metric:t.match(/(?:metric|measure)\s*:\s*([^.;]+)/i)?.[1]?.trim() ?? null,
      baselineYear:Number(t.match(/(?:baseline|base year|from a?)\s*(?:year|of|:)?\s*((?:19|20)\d{2})/i)?.[1]) || null,
      baselinePeriodLabel:t.match(/\bFY\d{2,4}\s+baseline|baseline\s+FY\d{2,4}\b/i)?.[0] ?? null,
      baselineValue:t.match(/baseline value\s*[:=]\s*([\d,.]+\s*[^.;]+)/i)?.[1] ?? null,
      targetYear:Number(t.match(/(?:by|target year\s*:?)\s*((?:19|20)\d{2})/i)?.[1]) || null,
      targetPeriodLabel:t.match(/\bby\s+(?:the end of\s+)?FY\d{2,4}\b/i)?.[0] ?? null,
      targetReductionPercent:t.match(/(?:reduce|reduction|cut)[^.;]{0,55}?(\d+(?:\.\d+)?)\s*%/i)?.[1] ? Number(t.match(/(?:reduce|reduction|cut)[^.;]{0,55}?(\d+(?:\.\d+)?)\s*%/i)[1]) : null,
      targetValue:t.match(/(?:target value|reach)\s*[:=]?\s*([\d,.]+\s*[^.;]+)/i)?.[1] ?? null,
      absoluteOrIntensity:t.match(/\b(absolute|intensity)\b/i)?.[1]?.toLowerCase() ?? null,
      grossOrNet:t.match(/\b(gross|net)\b/i)?.[1]?.toLowerCase() ?? null,
      boundary:t.match(/boundary\s*:\s*([^.;]+)/i)?.[1] ?? null,
      gasesCovered:t.match(/gases covered\s*:\s*([^.;]+)/i)?.[1] ?? null,
      milestones:t.match(/milestones?\s*:\s*([^.;]+)/i)?.[1] ?? null,
      methodology:t.match(/methodology\s*:\s*([^.;]+)/i)?.[1] ?? null,
      alignment:t.match(/(?:Paris|SBTi|1\.5\s*°C)[^.;]{0,60}/i)?.[0] ?? null,
      progress:t.match(/progress\s*:\s*([^.;]+)/i)?.[1] ?? null,
      baseYearRecalculation:t.match(/recalculation\s*:\s*([^.;]+)/i)?.[1] ?? null,
      carbonCredits:t.match(/carbon credits\s*:\s*([^.;]+)/i)?.[1] ?? null,
    };
  });
  return { ...fields, reportingPeriods:periods.filter(p=>p.value.kind==="reporting"), emissionsReportingPeriods:periods.filter(p=>p.value.kind==="emissions"),
    emissions, adoption, targets,
    scenarios, scenarioTemperatures, temperatureMentions:temperatures, socioeconomicPathways:pathways,
    assuranceLevels:collect(input, /\b(limited assurance|reasonable assurance|review|audit)\b/.source),
  };
}
