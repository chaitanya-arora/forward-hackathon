import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />

      <main className="page doc">
        <p className="eyebrow">Privacy &amp; data</p>
        <h1 className="doc-title">How GreenScreen handles your documents</h1>
        <p className="doc-lede">
          This is a plain description of what actually happens when you upload a document, not a
          legal notice. If any of this changes, this page should change with it.
        </p>

        <section className="doc-section">
          <h2>Nothing is stored</h2>
          <p>
            GreenScreen does not keep a database of uploads or reports. A file you upload is held in
            memory while it is being read, and discarded once the evidence has been extracted from
            it — it is never written to disk. The report that comes back exists only in the browser
            tab that generated it: reload the page, close the tab, or come back tomorrow, and it is
            gone. There is no history, no account, and no way to retrieve a report after the fact.
            If you want to keep one, download it before you navigate away.
          </p>
        </section>

        <section className="doc-section">
          <h2>What is sent to Anthropic</h2>
          <p>
            The text of your documents is sent to Anthropic&rsquo;s Claude API to be read and
            classified against the four AASB S2 / TCFD pillars, and again to generate the written
            assessment. This is the material fact about how the product works: your document content
            leaves this application and is processed by a third-party model. Anthropic&rsquo;s own
            terms govern how they handle that data on their side.
          </p>
        </section>

        <section className="doc-section">
          <h2>What actually persists, briefly</h2>
          <p>
            While a report is being generated, its progress and — once finished — the finished report
            itself sit in the server&rsquo;s memory under a temporary job id, so your browser can poll
            for status and collect the result. This is not a database: it holds at most the 20 most
            recent jobs across every visitor to the service, oldest evicted first, and all of it is
            lost on a server restart. It exists to make the upload-and-poll flow work, not to keep
            anything.
          </p>
        </section>

        <section className="doc-section">
          <h2>No accounts, no tracking</h2>
          <p>
            There is no sign-in, no analytics, and no cookies set by this application. Nothing about
            you or your visit is recorded beyond the ordinary server logs any web service produces
            while it is running.
          </p>
        </section>

        <section className="doc-section">
          <h2>A limitation worth stating plainly</h2>
          <p>
            The backend that receives uploads and hands back reports has no authentication. Anyone
            who can reach it while a report is being generated could, in principle, read that job&rsquo;s
            status while it exists. Given that nothing is retained afterward and each job is
            short-lived, the exposure is narrow — but it is real, and this page would rather say so
            than imply a guarantee the current build does not make.
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
