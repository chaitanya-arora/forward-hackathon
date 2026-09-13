import { redirect } from "next/navigation";
import { DEMO_REPORT_URL } from "@/lib/demo";

// The example uses the same Express HTTP flow as every report; no JSON imports.
export default function ReportPreviewPage() { redirect(DEMO_REPORT_URL); }
