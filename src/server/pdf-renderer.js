import PDFDocument from "pdfkit";
import { buildAasbPdfViewModel } from "./aasb-pdf-view-model.js";

const PAGE = { top: 54, bottom: 62, left: 54, right: 54 };
const WIDTH = 487.28;
function space(doc, height) {
  if (doc.y + height > doc.page.height - PAGE.bottom) doc.addPage();
  doc.x = PAGE.left;
}
function text(doc, value, size = 10, bold = false, after = 5) {
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(bold ? "#17324d" : "#344957");
  doc.text(String(value), PAGE.left, doc.y, { width: WIDTH, lineGap: 2 });
  doc.y += after;
}
function heading(doc, value) { space(doc, 62); text(doc, value, 16, true, 9); }
function block(doc, lines) {
  const height = lines.reduce((total, [value, size = 10, bold = false, after = 5]) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
    return total + doc.heightOfString(String(value), { width: WIDTH, lineGap: 2 }) + after;
  }, 0);
  space(doc, Math.min(height, doc.page.height - PAGE.top - PAGE.bottom));
  for (const line of lines) text(doc, ...line);
}

export function renderReportPdf(report) {
  if (report?.reportType !== "AASB_S2_DRAFT") throw new Error("Only AASB S2 reports can be exported.");
  const view = buildAasbPdfViewModel(report);
  const doc = new PDFDocument({ size: "A4", margins: PAGE, bufferPages: true });
  const chunks = [];
  doc.on("data", chunk => chunks.push(chunk));
  const result = new Promise((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  text(doc, "FORWARD / AASB S2 READINESS", 9, true, 12);
  text(doc, "AASB S2 readiness report", 24, true);
  text(doc, view.header.company, 16, true);
  text(doc, `${view.header.standard} | ${view.header.standardVersion} | Reporting period: ${view.header.reportingPeriod}`, 9, false, 12);
  heading(doc, "Executive summary");
  text(doc, view.executiveSummary.readinessScore == null ? "Readiness unavailable" : `${view.executiveSummary.readinessScore}/100 Readiness`, 24, true);
  text(doc, view.executiveSummary.headline, 11, true);
  text(doc, view.executiveSummary.summary, 9);
  text(doc, view.executiveSummary.disclaimer, 8, false, 10);
  heading(doc, "Section readiness overview");
  for (const section of view.sectionSummary) {
    block(doc, [[`${section.label}: ${section.supported} complete / ${section.unresolved} unresolved / ${section.total} checks`, 9, false, 4]]);
  }
  doc.y += 5;
  heading(doc, "Key findings");
  for (const finding of view.keyFindings) block(doc, [[finding.title, 10, true, 2], [finding.summary, 9, false, 6]]);
  if (!view.keyFindings.length) text(doc, "No key findings were identified from the supplied evidence.");

  doc.addPage();
  heading(doc, "Priority actions");
  text(doc, "Related follow-ups are grouped below, highest priority first. Each description is a representative next step; the detailed assessment retains requirement-level follow-ups.", 9, false, 9);
  for (const action of view.priorityActions) block(doc, [
    [`${action.title} (${action.priority} priority; ${action.count} related ${action.count === 1 ? "item" : "items"})`, 10, true, 2],
    [action.description, 9, false, 7],
  ]);
  if (!view.priorityActions.length) text(doc, "No priority actions identified in the stored assessment.");
  heading(doc, "Major evidence gaps");
  for (const gap of view.majorEvidenceGaps) block(doc, [[gap.title, 10, true, 2], [gap.detail, 9, false, 5]]);
  if (!view.majorEvidenceGaps.length) text(doc, "No missing disclosures recorded; review unresolved judgements in the detailed assessment.", 9);
  heading(doc, "Review and assurance requirements");
  for (const item of view.reviewAndAssurance) block(doc, [[item, 9, false, 5]]);
  if (!view.reviewAndAssurance.length) text(doc, "No additional review notes recorded. This remains a draft evidence-readiness assessment.", 9);

  doc.addPage();
  for (const section of view.detailedSections) {
    heading(doc, section.label);
    for (const criterion of section.criteria) {
      block(doc, [
        [criterion.title, 11, true, 3],
        [`Assessment: ${criterion.status}`, 9, true, 3],
        [criterion.finding, 9, false, 4],
        ...(criterion.supportingValues.length ? [[`Supporting values: ${criterion.supportingValues.join("; ")}`, 9, false, 4]] : []),
        ...(criterion.requiredInformation.length ? [[`Follow-up: ${criterion.requiredInformation.join(" ")}`, 9, false, 4]] : []),
        ...(criterion.references.length ? [[`Standard reference: ${criterion.references.join(", ")}`, 8, false, 3]] : []),
        ...(criterion.sources.length ? [[`Evidence: ${criterion.sources.join("; ")}`, 8, false, 3]] : []),
        ["", 8, false, 8],
      ]);
    }
    if (!section.criteria.length) text(doc, "No detailed criteria recorded for this section.");
    doc.y += 8;
  }
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    // Footer is outside the body margin. Disable wrapping so PDFKit cannot
    // create a new page while decorating already buffered pages.
    const bodyBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(8).fillColor("#5c6d78").text(
      `Forward | Draft evidence readiness | Page ${i + 1} of ${range.count}`,
      PAGE.left, doc.page.height - 34, { width: WIDTH, align: "center", lineBreak: false },
    );
    doc.page.margins.bottom = bodyBottom;
  }
  doc.end();
  return result;
}
