/**
 * PDF Export Utility — StudyOS AI
 * Generates clean, lightweight, searchable, vector-quality A4 study notes PDFs.
 * Supports:
 * - Questions, answers, headings, tables, diagrams, sources, and page numbers.
 * - Print-optimized A4 CSS with page breaks and header/footer metadata.
 */

export interface ExportQAItem {
  questionNumber?: string;
  question: string;
  marks?: number | string;
  answer: string;
  sources?: Array<{
    material_title?: string;
    page_number?: number;
    material_type?: string;
  }>;
  sourceLabel?: string;
  sourceDetail?: string;
}

export interface ExportPdfOptions {
  title: string;
  subtitle?: string;
  subject?: string;
  studentName?: string;
  date?: string;
  items: ExportQAItem[];
  includeSources?: boolean;
}

/**
 * Basic markdown-to-HTML formatter specifically tuned for clean print documents.
 * Handles headings, tables, bold, italics, code, bullet lists, blockquotes, and Mermaid text.
 */
function markdownToPrintHtml(md: string): string {
  if (!md) return "";

  let html = md;

  // Escape basic HTML tags to prevent injection while allowing formatting
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks: ```[lang]\n[code]\n```
  html = html.replace(/```(?:mermaid)?([\s\S]*?)```/g, (match, code) => {
    // If it's a mermaid block, display as a styled architectural diagram box
    if (match.startsWith("```mermaid")) {
      return `
        <div class="print-diagram-box">
          <div class="print-diagram-header">📊 Educational Architecture / Flowchart</div>
          <pre class="print-diagram-content">${code.trim()}</pre>
        </div>
      `;
    }
    return `<pre class="print-code-block"><code>${code.trim()}</code></pre>`;
  });

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code class="print-inline-code">$1</code>');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3 class="print-h3">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="print-h2">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="print-h1">$1</h1>');
  html = html.replace(/^#### (.*$)/gim, '<h4 class="print-h4">$1</h4>');

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Blockquotes
  html = html.replace(/^>\s?(.*$)/gim, '<blockquote class="print-blockquote">$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr class="print-hr" />');

  // Tables
  const lines = html.split("\n");
  const processedLines: string[] = [];
  let inTable = false;
  let tableRows: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(line);
    } else {
      if (inTable) {
        processedLines.push(convertTableRowsToHtml(tableRows));
        inTable = false;
        tableRows = [];
      }
      processedLines.push(lines[i]);
    }
  }
  if (inTable) {
    processedLines.push(convertTableRowsToHtml(tableRows));
  }

  html = processedLines.join("\n");

  // Lists: unordered & ordered
  html = html.replace(/^[•\-\*]\s+(.*$)/gim, '<li class="print-li">$1</li>');
  html = html.replace(/^(\d+)\.\s+(.*$)/gim, '<li class="print-li-num"><span class="print-num">$1.</span> $2</li>');

  // Paragraphs
  html = html
    .split(/\n\n+/)
    .map((para) => {
      const p = para.trim();
      if (
        !p ||
        p.startsWith("<h") ||
        p.startsWith("<pre") ||
        p.startsWith("<div") ||
        p.startsWith("<table") ||
        p.startsWith("<blockquote") ||
        p.startsWith("<hr") ||
        p.startsWith("<li")
      ) {
        return p;
      }
      return `<p class="print-p">${p.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");

  return html;
}

function convertTableRowsToHtml(rows: string[]): string {
  if (rows.length < 2) return rows.join("\n");

  const headers = rows[0]
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
  const bodyRows = rows.slice(2); // Skip separator row

  let html = '<div class="print-table-wrapper"><table class="print-table"><thead><tr>';
  for (const h of headers) {
    html += `<th>${h}</th>`;
  }
  html += "</tr></thead><tbody>";

  for (const r of bodyRows) {
    const cells = r
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    html += "<tr>";
    for (const cell of cells) {
      html += `<td>${cell}</td>`;
    }
    html += "</tr>";
  }

  html += "</tbody></table></div>";
  return html;
}

/**
 * Builds the complete self-contained printable HTML document with embedded CSS.
 */
export function buildPrintableHtml(options: ExportPdfOptions): string {
  const {
    title,
    subtitle = "University Examination & Concept Study Notes",
    subject = "StudyOS AI Tutoring",
    studentName = "StudyOS Student",
    date = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    items,
    includeSources = true,
  } = options;

  const itemsHtml = items
    .map((item, idx) => {
      const qNum = item.questionNumber || `Q${idx + 1}`;
      const marksBadge = item.marks
        ? `<span class="print-badge print-badge-marks">${item.marks} Marks</span>`
        : "";
      const formattedAnswer = markdownToPrintHtml(item.answer);

      let sourcesHtml = "";
      if (includeSources) {
        if (item.sources && item.sources.length > 0) {
          const sourcesList = item.sources
            .map(
              (s) =>
                `• <strong>${s.material_title || "Course Material"}</strong>${
                  s.page_number ? ` (Page ${s.page_number})` : ""
                }`
            )
            .join(" &nbsp;|&nbsp; ");
          sourcesHtml = `
            <div class="print-sources-box">
              <span class="print-sources-label">📚 Grounded Primary Source:</span>
              <span class="print-sources-content">${sourcesList}</span>
            </div>
          `;
        } else if (item.sourceLabel) {
          sourcesHtml = `
            <div class="print-sources-box print-sources-curriculum">
              <span class="print-sources-label">🏛️ Verified Curriculum:</span>
              <span class="print-sources-content">${item.sourceLabel}</span>
            </div>
          `;
        }
      }

      return `
        <div class="print-qa-card">
          <div class="print-question-header">
            <div class="print-q-title">
              <span class="print-q-num">${qNum}</span>
              <span class="print-q-text">${item.question}</span>
            </div>
            ${marksBadge}
          </div>
          <div class="print-answer-body">
            ${formattedAnswer}
          </div>
          ${sourcesHtml}
        </div>
      `;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} — StudyOS AI</title>
  <style>
    /* ── A4 Page Specifications ────────────────────────────────────────── */
    @page {
      size: A4 portrait;
      margin: 15mm 14mm 15mm 14mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 8.5pt;
        color: #64748b;
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.55;
      color: #0f172a;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }

    /* ── Document Header ─────────────────────────────────────────────── */
    .print-doc-header {
      border-bottom: 2px solid #059669;
      padding-bottom: 10px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .print-branding {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .print-logo-mark {
      background-color: #059669;
      color: #ffffff;
      font-weight: 800;
      font-size: 11pt;
      padding: 4px 8px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }

    .print-brand-title {
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
    }

    .print-subtitle {
      font-size: 9pt;
      color: #475569;
      margin-top: 2px;
    }

    .print-meta-right {
      text-align: right;
      font-size: 8.5pt;
      color: #64748b;
      line-height: 1.4;
    }

    .print-subject-tag {
      display: inline-block;
      background-color: #ecfdf5;
      color: #047857;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      border: 1px solid #a7f3d0;
      margin-bottom: 3px;
    }

    /* ── Q&A Cards ────────────────────────────────────────────────────── */
    .print-qa-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 16px;
      page-break-inside: avoid;
      break-inside: avoid;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
      overflow: hidden;
    }

    .print-question-header {
      background-color: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .print-q-title {
      display: flex;
      align-items: baseline;
      gap: 8px;
      font-size: 10.5pt;
      font-weight: 700;
      color: #0f172a;
    }

    .print-q-num {
      background-color: #059669;
      color: #ffffff;
      font-size: 8.5pt;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .print-badge-marks {
      background-color: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
      font-size: 8.5pt;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
      white-space: nowrap;
    }

    .print-answer-body {
      padding: 14px;
    }

    /* ── Typography & Elements ────────────────────────────────────────── */
    .print-h1 { font-size: 12.5pt; font-weight: 800; color: #047857; margin: 12px 0 6px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .print-h2 { font-size: 11.5pt; font-weight: 700; color: #0f172a; margin: 10px 0 5px 0; }
    .print-h3 { font-size: 10.5pt; font-weight: 700; color: #1e293b; margin: 8px 0 4px 0; }
    .print-h4 { font-size: 9.5pt; font-weight: 700; color: #334155; margin: 6px 0 3px 0; }

    .print-p {
      margin: 6px 0;
      color: #1e293b;
      font-size: 9.5pt;
      line-height: 1.5;
    }

    .print-li {
      margin: 3px 0 3px 18px;
      color: #1e293b;
      font-size: 9.5pt;
    }

    .print-li-num {
      list-style-type: none;
      margin: 3px 0 3px 4px;
      color: #1e293b;
      font-size: 9.5pt;
    }

    .print-num {
      font-weight: 700;
      color: #059669;
    }

    .print-blockquote {
      background-color: #f1f5f9;
      border-left: 3.5px solid #059669;
      margin: 8px 0;
      padding: 6px 12px;
      font-style: italic;
      color: #334155;
      font-size: 9pt;
      border-radius: 0 4px 4px 0;
    }

    .print-hr {
      border: 0;
      border-top: 1px solid #e2e8f0;
      margin: 10px 0;
    }

    .print-inline-code {
      background-color: #f1f5f9;
      color: #0f766e;
      padding: 1px 4px;
      border-radius: 3px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 8.5pt;
    }

    .print-code-block {
      background-color: #0f172a;
      color: #34d399;
      padding: 10px 12px;
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 8.5pt;
      line-height: 1.45;
      overflow-x: auto;
      margin: 8px 0;
    }

    /* ── Tables ───────────────────────────────────────────────────────── */
    .print-table-wrapper {
      margin: 8px 0;
      overflow-x: auto;
    }

    .print-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      text-align: left;
    }

    .print-table th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
    }

    .print-table td {
      border: 1px solid #cbd5e1;
      padding: 5px 8px;
      color: #1e293b;
    }

    .print-table tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    /* ── Diagrams ─────────────────────────────────────────────────────── */
    .print-diagram-box {
      border: 1.5px dashed #059669;
      background-color: #f0fdf4;
      border-radius: 6px;
      padding: 8px 12px;
      margin: 10px 0;
    }

    .print-diagram-header {
      font-size: 8.5pt;
      font-weight: 700;
      color: #047857;
      margin-bottom: 4px;
    }

    .print-diagram-content {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 8pt;
      color: #065f46;
      margin: 0;
      white-space: pre-wrap;
    }

    /* ── Sources ──────────────────────────────────────────────────────── */
    .print-sources-box {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 6px 14px;
      font-size: 8pt;
      color: #475569;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .print-sources-label {
      font-weight: 700;
      color: #047857;
      flex-shrink: 0;
    }

    .print-sources-curriculum .print-sources-label {
      color: #4f46e5;
    }

    /* ── Footer ───────────────────────────────────────────────────────── */
    .print-doc-footer {
      border-top: 1px solid #e2e8f0;
      margin-top: 20px;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #94a3b8;
    }
  </style>
</head>
<body>

  <!-- Document Header -->
  <div class="print-doc-header">
    <div>
      <div class="print-branding">
        <span class="print-logo-mark">StudyOS AI</span>
        <span class="print-brand-title">${title}</span>
      </div>
      <div class="print-subtitle">${subtitle}</div>
    </div>
    <div class="print-meta-right">
      <div class="print-subject-tag">${subject}</div>
      <div>Student: <strong>${studentName}</strong></div>
      <div>Date: ${date}</div>
    </div>
  </div>

  <!-- Document Content -->
  <div class="print-content">
    ${itemsHtml}
  </div>

  <!-- Document Footer -->
  <div class="print-doc-footer">
    <div>StudyOS AI — Verified Student Learning Platform</div>
    <div>Confidential & For Personal Educational Use</div>
  </div>

  <script>
    // Automatically trigger print dialog when loaded in print iframe or popup
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;
}

/**
 * Triggers PDF export by rendering the printable document into an isolated iframe
 * and executing browser print-to-PDF.
 */
export function exportStudyNotesToPdf(options: ExportPdfOptions): void {
  if (typeof window === "undefined") return;

  const htmlContent = buildPrintableHtml(options);

  // Create an invisible iframe for seamless print triggering
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    // Fallback: open print window directly
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  // Cleanup iframe after printing
  setTimeout(() => {
    try {
      document.body.removeChild(iframe);
    } catch {}
  }, 60000);
}
