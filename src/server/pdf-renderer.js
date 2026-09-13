import PDFDocument from "pdfkit";

const PAGE = { margin: 54 };

function text(value, fallback = "Not available") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function score(report) {
  return report.reportType === "AASB_S2_DRAFT"
    ? report.presentation?.executiveSummary?.readinessScore ?? report.aasbS2ReadinessScore
    : report.presentation?.executiveSummary?.readinessScore ?? report.overallESGReadinessScore ?? report.overallESGScore;
}

function addHeader(document, report, label) {
  document.fillColor("#17324d").fontSize(9).text("FORWARD / READINESS ASSESSMENT", PAGE.margin, 34, { characterSpacing: 1.2 });
  document.moveTo(PAGE.margin, 48).lineTo(558, 48).strokeColor("#b8c5ce").stroke();
  document.fillColor("#17324d").fontSize(24).font("Helvetica-Bold").text(label, PAGE.margin, 78);
  document.font("Helvetica").fillColor("#243746").fontSize(14).text(text(report.company), PAGE.margin, 112);
  document.fillColor("#5c6d78").fontSize(10).text(
    report.reportType === "AASB_S2_DRAFT"
      ? `Reporting period: ${text(report.reportingPeriod?.year)} | Status: ${text(report.status)}`
      : `Reporting year: ${text(report.reportYear)} | Evidence-readiness assessment`,
    PAGE.margin,
    136,
  );
  document.y = 172;
}

function heading(document, title) {
  document.moveDown(0.8);
  document.fillColor("#17324d").font("Helvetica-Bold").fontSize(15).text(title, { continued: false });
  document.moveDown(0.25);
  document.font("Helvetica").fillColor("#243746").fontSize(10);
}

function paragraph(document, value) {
  document.font("Helvetica").fillColor("#243746").fontSize(10).text(text(value), { lineGap: 3 });
  document.moveDown(0.35);
}

function bullets(document, values) {
  for (const value of list(values)) {
    document.font("Helvetica").fontSize(10).fillColor("#243746").text(`- ${text(value)}`, { indent: 10, lineGap: 2 });
  }
  document.moveDown(0.25);
}

function addPresentation(document, report) {
  const presentation = report.presentation ?? {};
  const summary = presentation.executiveSummary ?? {};
  const readiness = score(report);
  heading(document, "Executive summary");
  document.font("Helvetica-Bold").fontSize(18).fillColor("#17324d").text(readiness == null ? "Readiness: not scored" : `Readiness: ${readiness}/100`);
  document.moveDown(0.25);
  paragraph(document, summary.headline ?? summary.summary ?? report.executiveSummary);
  paragraph(document, summary.summary ?? report.executiveSummary);
  paragraph(document, summary.scoreDisclaimer ?? report.methodology?.scoreMeaning);

  heading(document, "Key findings");
  const findings = list(presentation.keyFindings);
  findings.length
    ? findings.forEach((finding) => paragraph(document, `${text(finding.title)}: ${text(finding.summary)}`))
    : paragraph(document, "No key findings were identified from the supplied documents.");

  heading(document, "Priority actions");
  const actions = list(presentation.priorityActions);
  actions.length
    ? actions.forEach((action) => paragraph(document, `${text(action.title)}: ${text(action.description)}`))
    : paragraph(document, "No priority actions were identified from the supplied documents.");
}

function addAasbDetails(document, report) {
  heading(document, "AASB S2 assessment");
  paragraph(document, `Standard: ${text(report.standard?.name)} | Version: ${text(report.standard?.version)} | Methodology: ${text(report.methodology?.version)}`);
  paragraph(document, `Readiness status: ${text(report.status)}. This is an AI-assisted preparation draft and requires management, director and assurance review.`);
  const sections = [
    ["Governance", report.governance],
    ["Strategy", report.strategy],
    ["Risk management", report.riskManagement],
    ["Metrics and targets", report.metricsAndTargets],
    ["General requirements", report.generalRequirements],
  ];
  for (const [name, section] of sections) {
    if (!section) continue;
    document.font("Helvetica-Bold").fontSize(11).fillColor("#17324d").text(`${name}: ${text(section.overallStatus)}`);
    const criteria = list(section.criteria);
    for (const criterion of criteria.slice(0, 18)) {
      paragraph(document, `${text(criterion.key ?? criterion.id)} [${text(criterion.status)}] - ${text(criterion.finding ?? criterion.description)}`);
    }
  }
  heading(document, "Review and assurance");
  bullets(document, report.assuranceReadiness?.issues);
  bullets(document, report.warnings);
  heading(document, "Major evidence gaps");
  bullets(document, list(report.missingDisclosures).map((gap) => `${text(gap.criterionId)}: ${list(gap.requiredInformation).join(" ")}`));
}

function addEsgDetails(document, report) {
  heading(document, "ESG evidence readiness");
  paragraph(document, report.methodology?.scoreMeaning ?? "This score reflects evidence readiness, not company ESG performance or compliance.");
  for (const [name, section] of [["Environmental", report.environmental], ["Social", report.social], ["Governance", report.governance]]) {
    if (!section) continue;
    document.font("Helvetica-Bold").fontSize(11).fillColor("#17324d").text(`${name}: ${text(section.score)}/100 (${text(section.status)})`);
    bullets(document, list(section.gaps).map((gap) => `${text(gap.criterionId)}: ${text(gap.message)}`));
  }
  heading(document, "Follow-up and limitations");
  bullets(document, report.warnings);
  paragraph(document, "This is an evidence-readiness assessment. It does not rate company ESG performance and requires human review of source material and conclusions.");
}

export function renderReportPdf(report) {
  const document = new PDFDocument({ size: "A4", margins: PAGE, bufferPages: true });
  const chunks = [];
  document.on("data", (chunk) => chunks.push(chunk));
  const result = new Promise((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
  const label = report.reportType === "AASB_S2_DRAFT" ? "AASB S2 readiness report" : "ESG readiness report";
  addHeader(document, report, label);
  addPresentation(document, report);
  if (report.reportType === "AASB_S2_DRAFT") addAasbDetails(document, report);
  else addEsgDetails(document, report);
  const pageRange = document.bufferedPageRange();
  for (let page = pageRange.start; page < pageRange.start + pageRange.count; page += 1) {
    document.switchToPage(page);
    document.fontSize(8).fillColor("#5c6d78").text(`Page ${page - pageRange.start + 1} | AI-assisted draft. Source evidence, applicability, materiality and all conclusions require human review.`, PAGE.margin, 770, { width: 488, align: "center" });
  }
  document.end();
  return result;
}
