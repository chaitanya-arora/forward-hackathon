# AASB readiness model v2

The primary output remains `AASB_S2_DRAFT`. SQLite uploads, immutable historical
reports, the secondary ESG output, JSON auto-export, exact citation validation,
and the shared 20-attempt process ceiling remain in place. No new provider,
package, web server or frontend is required.

## Processing

1. `requirements.js` defines conceptual information elements for all 64 criteria.
2. The existing single AASB request retrieves source excerpts for each element,
   distinguishing explicit support, partial support and human confirmation.
3. Local parsers extract typed source facts: fiscal dates, adoption/elections,
   emissions and units, scenario records, targets, monetary quantities and
   assurance information. A value without a reliable parse stays null. Qualitative
   element selections retain their source references and require judgement.
4. A consistency layer reconciles configured and extracted metadata. Conflicts
   preserve both alternatives and leave affected effective fields unresolved.
5. Local completeness rules and scoring produce findings, gaps and actions.

The model selects excerpt IDs; it does not write quotations or free-form findings.
Code derives all quotation wording from the source. AASB excerpts use a 350-character
target, and displayed criterion citations are capped at 220 original characters.
The evidence register retains full text. References retain evidence ID, document,
page(s), and source character offsets. A displayed excerpt can be a fragment;
review its referenced full context when interpreting it.

Agent 1 additionally retains reporting/adoption/assurance context chunks that were
not placed in a climate pillar. This uses local language checks and existing chunk
checkpoints, without extra classification calls. Both outputs continue to share
the same normalized run snapshot. No company name, committee name, fiscal dates,
emissions value, target, scenario set or assurance provider drives runtime logic.

## Completeness and scoring

Every criterion retains `status`, `citations`, `finding` and `requiredInformation`.
New fields are `completenessStatus`, `requiredElements`, `extractedFacts`,
`satisfiedElements`, `missingElements`, `evidenceIds`, `requiresHumanJudgement`
and `requiresHumanReview`.

| Completeness | Weight | Existing status mapping |
|---|---:|---|
| complete | 1 | present |
| evidence_found_requires_judgement | 0.75 | requires_human_judgement |
| partial | 0.5 | partial |
| requires_human_confirmation | 0.25 | requires_human_judgement |
| missing | 0 | missing |
| not_applicable | excluded | not_applicable |

Evidence alone cannot produce `complete`. Qualitative elements selected by a model
remain judgement-dependent, even when all elements have support. Partial element
support does not count as a satisfied element. Objective Scope 1/2/3 completeness
requires the relevant unambiguous value, unit, emissions period and boundary;
Scope 2 also requires contractual-instrument information. Low-confidence source
evidence caps otherwise full/evidence-supported completeness at partial. Explicit
non-applicability confirmations and reconciled relief elections are the only
exclusion routes. The model cannot exclude a criterion on its own authority.

Readiness is the rounded mean of included completeness weights times 100. An
entirely excluded rubric returns null, not 100. Caps apply after the mean:

- high-severity metadata conflict: maximum 75;
- unresolved standard version: maximum 90;
- unresolved requirement judgements: maximum 95.

`methodology.rawScore`, `weights` and `scoreCaps` expose this calculation. These
are application readiness weights, not AASB-prescribed compliance scores.
Applicability/cohort uncertainty is separately disclosed and does not itself
deduct points for missing disclosure. Human assurance and statutory preparation
remain necessary even for complete disclosure evidence.

## Metadata and source facts

Configured dates are compared with extracted fiscal periods. A stated week-count
period can supply a derived inclusive start date with explicit derivation metadata.
An ordinary “year ended” statement supplies an end date only. A report year alone
supplies neither date. Emissions periods are kept separate; differences produce
a review action for B19, not an automatic finding of non-compliance.

Unknown adoption/election inputs now remain null instead of defaulting to false.
Explicit early adoption in evidence can select the later supported standard when
there is no conflicting input. A disagreement leaves version selection unresolved.
The [December 2025 AASB compilation](https://standards.aasb.gov.au/aasb-s2-dec-2025)
is operative for periods starting on or after 1 January 2027, with earlier
application permitted for periods starting on or after 1 January 2025. The
[September 2024 standard](https://standards.aasb.gov.au/aasb-s2-sep-2024)
remains a supported version. Selection is preparation metadata subject to review.

First-year eligibility does not establish an election. Use
`useComparativesFirstYearRelief` and `useScope3FirstYearRelief`, or explicit source
evidence. `expectedAssurance` optionally supplies provider, level and scope for
source/configuration comparison. The parser never creates an assurance opinion;
`sourceConclusion` contains only extracted source wording.

Emissions observations preserve original units, source text and provenance. When
the disclosed unit is recognized, optional normalization uses explicit scale
metadata (tCO2-e ×1, ktCO2-e ×1,000, MtCO2-e ×1,000,000). Multiple conflicting
observations stay as candidates with a null selected value. Targets retain their
individual source-backed records; incomplete properties stay null. Abbreviated
fiscal-year labels remain labels rather than guessed calendar dates.

Scenario names and temperatures are not fixed. The Australian scenario screen
reports whether a 1.5°C scenario and a scenario above 2°C were found, but leaves
“well above”, probability, assumptions, horizon and legal applicability to human
judgement. `appearsToAddressAustralianScenarioRequirement` is not a certification.

`reportIntegrity` exposes consistency issues, unresolved judgements, metadata
conflicts and evidence-validation issues. Invalid provenance still stops report
generation. `readinessConfidence` remains `requires_review` while external
verification and judgement are outstanding.

## Disclosure gaps versus completion steps

`missingDisclosures` lists missing/incomplete requirement elements.
`completionActions` separately lists metadata confirmation, eligibility/elections,
estimates, applicability, external assurance, director approval/declaration and
lodgement work. Thus an empty disclosure-gap list can still have completion steps.
`priorityActions` combines both and supplies issue, reason, reference, available
evidence IDs, needed information, severity and recommended next step.

No output changes `lodgement.lodgementReady=false` or
`directorsDeclaration.generatedOrApprovedBySystem=false`.

## Short before/after examples

These excerpts use the synthetic Harbour Mutual fixture. They illustrate fields,
not a new live model assessment or a legal-compliance conclusion.

Emissions:

```json
{"before":{"scope1":{"status":"present"}},"after":{"scope1":{"completenessStatus":"complete","value":12.5,"unit":"ktCO2-e"},"normalized":{"value":12500,"unit":"tCO2-e","conversionFactor":1000}}}
```

Scenario analysis:

```json
{"before":{"status":"present"},"after":{"temperatures":[1.6,3.8],"modelProvider":{"value":"Atlas Research"},"australianScenarioScreen":{"has1_5C":false,"hasAbove2C":true,"appearsToAddressAustralianScenarioRequirement":false}}}
```

Transition relief:

```json
{"before":{"transitionReliefStatus":"unknown_requires_confirmation"},"after":{"extracted":{"firstYearOfApplication":{"value":true},"comparativesRelief":{"value":true},"scope3Relief":{"value":false}},"metadata":{"comparatives":{"applied":true},"scope3":{"applied":false}}}}
```

Assurance:

```json
{"before":{"status":"requires_external_assurance_review"},"after":{"externalAssuranceEvidenceFound":true,"provider":{"value":"Meridian Verification LLP"},"reviewedAreas":{"value":"governance and scenario methods"},"requiresHumanVerification":true,"providedByApplication":false}}
```

Priority actions with a conflicting configured calendar period:

```json
{"before":{"priorityActions":[]},"after":{"priorityActions":[{"issue":"reportingPeriodStart","severity":"high","reference":"AASB S2 metadata / Appendix D","recommendedNextStep":"Confirm the authoritative reporting period and distinguish comparative periods."}]}}
```

## Compatibility and limits

Old persisted reports remain immutable and unchanged. New reports keep the old
section names and convenience fields; richer facts appear in `structuredFacts`,
`metricsAndTargets.greenhouseGasEmissions.structuredValues`,
`metricsAndTargets.extractedTargets`, scenario analysis, transition relief and
assurance readiness. Existing `targets` remains the criterion checklist.
Consumers should use `completenessStatus` and the new weight table for readiness.
`status=present` is now stricter and scores are not directly comparable with v1.
Criterion quotations are shorter. Unknown booleans may now be null. Supplying only
first-year application no longer automatically excludes comparative information.
Existing direct builder inputs without `elements` remain accepted, but receive no
assumed element completeness. The model request now requires element selections.

Local parsers are deliberately conservative English-language patterns, not an
exhaustive semantic or table-layout engine. Unrecognized wording, ambiguous
comparative periods, fragmented tables, fiscal labels and numeric associations
can remain null or require review. The system preserves source candidates rather
than guessing. Those limits are visible in missing elements and actions. Exact
source matching establishes provenance, not truth, relevance or sufficiency.

This change adds no live model passes: one AASB request and one ESG request after
cached extraction, excluding transport retries. The existing 20-attempt ceiling is
process-local, not a remaining daily quota meter. Tests and fixture validation
use no Gemini calls.

## Files and verification

Runtime changes:

- `src/aasb/requirements.js`: information elements and completeness weights.
- `src/aasb/extractFacts.js`: local typed facts and exact source offsets.
- `src/aasb/consistency.js`: configuration/evidence reconciliation.
- `src/aasb/readiness.js`: completeness, integrity, facts and actions.
- `src/aasb/generateAasbS2Report.js`: integrate these stages with one request.
- `src/aasb/context.js`: unknown inputs, explicit elections, assurance comparison.
- `src/aasb/examples/reportingContext.json`: neutral, unfilled context template.
- `src/agent1/agent1.js`: retain reporting/assurance context without extra calls.
- `src/agent2/normalizeEvidence.js`: accept that supplemental context.
- `src/agent2/sourceExcerpts.js`: configurable excerpt length and nested element citations.
- `src/pipeline/processCompany.js`: preserve supplemental upload provenance.

Tests/fixtures/docs:

- `tests/aasb.test.js`: update assertions for stricter completeness and explicit elections.
- `tests/aasbReadiness.test.js`: generic extraction, scoring, conflicts, quantities,
  assurance, non-calendar periods, provenance, actions and single-request tests.
- `tests/fixtures/aasb/harbour.json`: synthetic trustee/council, April–March fiscal
  year, kt/Mt units, two scenarios and limited assurance.
- `tests/fixtures/aasb/summit.json`: synthetic supervisory council, October–September
  fiscal year, different emissions period, three scenarios and mixed assurance.
- `tests/fixtures/aasb/coles-regression.json`: source-only regression from existing
  uploaded report evidence; never imported by production code.
- `README.md` and this document: updated behavior, examples and compatibility.
- `storage/reports/validation-aasb-v2/coles-offline-review.json`: diagnostic output
  using saved run 8 evidence and old assessment selections, without a new model call.
  It is labelled `validationOnly` and does not replace a persisted historical report.

Validation during implementation: all 44 tests passed. Cached extraction of the
actual upload reused all 96 classifications and retained 16 additional reporting
context chunks (51 normalized evidence items, about 304,000 characters) with zero
API calls. A separate diagnostic using the original run 8 evidence and its old
assessment selections changed the readiness score from 100 to 47 and exposed three
configuration conflicts. Because the old assessment has no element-level selections,
this is a conservative regression result, not a new AI assessment or a calibrated
benchmark score. Its 64 disclosure-gap entries reflect missing requirement-element
verification as well as incomplete facts, not 64 proven legal disclosure failures.

Run the complete offline suite from the project root:

```powershell
.\run-agent2.ps1 -Test
```
