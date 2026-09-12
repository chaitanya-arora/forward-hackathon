/**
 * "While you wait" — short explainers shown during the analysis run.
 *
 * These are drawn from the same AASB S2 / TCFD criteria the tool assesses
 * against (apps/api/src/agent2/rubric.ts), so the wait teaches you how to read
 * the report you are about to get.
 *
 * Every `href` below was checked to resolve before being added. Never add a
 * source link here without verifying it — a dead or invented citation in a
 * compliance tool is worse than no link at all.
 */

export interface LearnCard {
  tag: string;
  title: string;
  body: string;
  source: string;
  href: string;
}

export const LEARN_CARDS: LearnCard[] = [
  {
    tag: "Metrics & Targets",
    title: "Scope 3 is where most disclosures fall down",
    body:
      "Scope 1 covers what you burn and Scope 2 what you buy as energy — both are relatively easy to count. Scope 3 covers everything else in your value chain, across fifteen defined categories, and for most companies it dwarfs the other two combined. A first disclosure does not need to be precise: screening the fifteen categories, naming which are relevant to you, and publishing directional estimates for the largest is a materially stronger position than reporting nothing.",
    source: "GHG Protocol — Scope 3 Standard",
    href: "https://ghgprotocol.org/standards/scope-3-standard",
  },
  {
    tag: "Governance",
    title: "Name the committee, the cadence and the reporting line",
    body:
      "Governance is the pillar companies most often already satisfy without realising it. Assessors look for three specific things: which board or committee holds climate oversight, how often it actually considers climate matters, and how management escalates to it. If your board papers already show a risk committee reviewing climate quarterly, that is disclosable evidence today — it just has to be written down somewhere a reader can find it.",
    source: "TCFD Recommendations",
    href: "https://www.fsb-tcfd.org/recommendations/",
  },
  {
    tag: "Strategy",
    title: "Scenario analysis needs a name and a number",
    body:
      "Saying you have 'considered climate scenarios' scores as vague. What counts is naming the scenarios used — including at least one consistent with limiting warming to 1.5°C or well below 2°C — stating the time horizons in actual years, and describing what the analysis changed about your view of the business. The resilience conclusion matters more than the modelling sophistication.",
    source: "IFRS S2 — Climate-related Disclosures",
    href: "https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/ifrs-s2-climate-related-disclosures/",
  },
  {
    tag: "Risk Management",
    title: "Integration beats a separate climate process",
    body:
      "A standalone climate risk register scores worse than climate risks sitting in the enterprise register alongside everything else. The standard asks how climate risk processes are integrated into overall risk management — so the strongest evidence is usually that you already assess climate on the same likelihood-and-consequence matrix you use for every other material risk, with the same escalation thresholds.",
    source: "IFRS S2 — Climate-related Disclosures",
    href: "https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/ifrs-s2-climate-related-disclosures/",
  },
  {
    tag: "Metrics & Targets",
    title: "A target without a base year is not a target",
    body:
      "An intention to 'reduce emissions over time' does not meet the disclosure bar. A target needs a base year, a target year, whether it is absolute or intensity-based, and which scopes it covers. Adding those four facts to a commitment you have already made is often the single cheapest way to move this pillar from Partial to Well-substantiated.",
    source: "GHG Protocol — Corporate Standard",
    href: "https://ghgprotocol.org/corporate-standard",
  },
  {
    tag: "Context",
    title: "Who has to report, and when",
    body:
      "Australia's climate reporting regime phases in by entity size, with the largest entities captured first and smaller ones following in later groups. AASB S2 is the Australian implementation of the international climate standard, so preparing against it also prepares you for what global counterparties increasingly ask for. Knowing which group you fall into determines how much time you actually have.",
    source: "AASB",
    href: "https://aasb.gov.au/",
  },
  {
    tag: "Context",
    title: "Assurance is coming for the numbers",
    body:
      "Climate disclosures are moving toward the same assurance expectations as financial reporting, starting with limited assurance over parts of the disclosure and broadening over time. The practical implication is that emissions figures need an audit trail — a stated methodology, a defined consolidation boundary, and retained source data — not just a number in a report.",
    source: "ASIC — Sustainability Reporting",
    href: "https://asic.gov.au/regulatory-resources/sustainability-reporting/",
  },
];
