"use client";

import React from "react";
import { Copy, Check, Lightbulb, AlertCircle, Info, BookOpen } from "lucide-react";
import { MermaidDiagram } from "@/components/ui/MermaidDiagram";
import clsx from "clsx";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const handleCopy = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Split content safely by code blocks: ```[lang]\n[code]\n```
  const safeContent = typeof content === "string" ? content : String(content || "");
  const parts = safeContent.split(/(```[\s\S]*?```)/g);

  return (
    <div
      className={clsx(
        "space-y-3 leading-relaxed text-xs sm:text-sm text-slate-800 dark:text-slate-100 break-words [overflow-wrap:anywhere] max-w-full overflow-hidden",
        className
      )}
    >
      {parts.map((part, pIdx) => {
        if (!part) return null;

        // Code block or Mermaid diagram
        if (part.startsWith("```") && part.endsWith("```")) {
          const firstLineEnd = part.indexOf("\n");
          const lang = part.slice(3, firstLineEnd).trim().toLowerCase() || "text";
          const code = part.slice(firstLineEnd + 1, -3);

          if (lang === "mermaid") {
            return <MermaidDiagram key={pIdx} chart={code} />;
          }

          return (
            <div
              key={pIdx}
              className="my-3 rounded-xl overflow-hidden border border-slate-200 dark:border-white/[0.1] bg-[#0c1222] shadow-sm"
            >
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-white/[0.06] text-[11px] text-slate-400 font-mono">
                <span className="font-medium text-slate-300">{lang}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(code, pIdx)}
                  className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors text-[10px] px-2 py-0.5 rounded bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.06]"
                >
                  {copiedIndex === pIdx ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 text-[12px] sm:text-[13px] font-mono leading-relaxed text-emerald-300 overflow-x-auto whitespace-pre">
                {code}
              </pre>
            </div>
          );
        }

        // Regular text block: parse paragraphs, headings, tables, blockquotes, lists
        return <TextChunk key={pIdx} text={part} />;
      })}
    </div>
  );
}

// ── Text Chunk Parser: Groups Tables, Lists, Headings, and Blockquotes ─────────

function TextChunk({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      elements.push(<div key={`empty-${i}`} className="h-1" />);
      i++;
      continue;
    }

    // Divider
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      elements.push(
        <hr key={`hr-${i}`} className="my-3 border-slate-200 dark:border-white/[0.08]" />
      );
      i++;
      continue;
    }

    // Markdown Table Detection (lines starting and containing '|')
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      elements.push(<MarkdownTable key={`table-${i}`} lines={tableLines} />);
      continue;
    }

    // Headings
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1
          key={`h1-${i}`}
          className="text-base sm:text-lg font-bold text-slate-900 dark:text-white pt-2.5 pb-1 border-b border-slate-200 dark:border-white/[0.08]"
        >
          {renderInline(trimmed.replace(/^#\s+/, ""))}
        </h1>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2
          key={`h2-${i}`}
          className="text-sm sm:text-base font-bold text-slate-900 dark:text-white pt-2 pb-0.5 border-b border-slate-100 dark:border-white/[0.06] flex items-center gap-1.5"
        >
          {renderInline(trimmed.replace(/^##\s+/, ""))}
        </h2>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3
          key={`h3-${i}`}
          className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white pt-1.5 pb-0.5 flex items-center gap-1.5"
        >
          {renderInline(trimmed.replace(/^###\s+/, ""))}
        </h3>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("#### ")) {
      elements.push(
        <h4
          key={`h4-${i}`}
          className="text-xs font-bold text-emerald-600 dark:text-emerald-400 pt-1"
        >
          {renderInline(trimmed.replace(/^####\s+/, ""))}
        </h4>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("##### ")) {
      elements.push(
        <h5
          key={`h5-${i}`}
          className="text-xs font-semibold text-slate-700 dark:text-slate-300 pt-1"
        >
          {renderInline(trimmed.replace(/^#####\s+/, ""))}
        </h5>
      );
      i++;
      continue;
    }

    // Blockquote (Notes, Exam Tips, Warnings)
    if (trimmed.startsWith("> ")) {
      const quoteText = trimmed.replace(/^>\s+/, "");
      const isTip = quoteText.toLowerCase().includes("tip") || quoteText.toLowerCase().includes("memory");
      const isWarning = quoteText.toLowerCase().includes("note") || quoteText.toLowerCase().includes("warning");

      elements.push(
        <blockquote
          key={`quote-${i}`}
          className={clsx(
            "p-3 my-2 rounded-xl text-xs leading-relaxed flex items-start gap-2.5 border",
            isTip
              ? "bg-emerald-500/[0.08] border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
              : isWarning
              ? "bg-amber-500/[0.08] border-amber-500/30 text-amber-900 dark:text-amber-200"
              : "bg-slate-100 dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300"
          )}
        >
          <div className="flex-shrink-0 mt-0.5">
            {isTip ? (
              <Lightbulb className="w-4 h-4 text-emerald-500" />
            ) : isWarning ? (
              <AlertCircle className="w-4 h-4 text-amber-500" />
            ) : (
              <Info className="w-4 h-4 text-slate-400" />
            )}
          </div>
          <div className="flex-1 min-w-0 font-medium">{renderInline(quoteText)}</div>
        </blockquote>
      );
      i++;
      continue;
    }

    // Bullet list (- or * or •)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
      elements.push(
        <div key={`bullet-${i}`} className="flex items-start gap-2 pl-1.5 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
          <span className="flex-1 leading-normal text-slate-700 dark:text-slate-200">
            {renderInline(trimmed.replace(/^[-*•]\s+/, ""))}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      elements.push(
        <div key={`num-${i}`} className="flex items-start gap-2 pl-1.5 py-0.5">
          <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0 text-xs">
            {numMatch[1]}.
          </span>
          <span className="flex-1 leading-normal text-slate-700 dark:text-slate-200">
            {renderInline(numMatch[2])}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // Normal paragraph
    elements.push(
      <p key={`p-${i}`} className="text-slate-700 dark:text-slate-200 leading-relaxed">
        {renderInline(trimmed)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1.5">{elements}</div>;
}

// ── Markdown Table Component ──────────────────────────────────────────────────

function MarkdownTable({ lines }: { lines: string[] }) {
  if (lines.length < 2) return null;

  // Header row
  const headerCells = lines[0]
    .split("|")
    .map((c) => c.trim())
    .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

  // Skip delimiter row (e.g. | :--- | :--- |)
  const rowLines = lines.slice(1).filter((l) => !l.replace(/[|\-:\s]/g, "").length === false || l.includes("---"));
  const dataLines = lines.slice(1).filter((l) => !l.match(/^[|\-:\s]+$/));

  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-100/90 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 font-semibold">
          <tr>
            {headerCells.map((h, idx) => (
              <th key={idx} className="py-2.5 px-3 whitespace-nowrap">
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] bg-white dark:bg-[#0c1220]">
          {dataLines.map((rowStr, rIdx) => {
            const cells = rowStr
              .split("|")
              .map((c) => c.trim())
              .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

            return (
              <tr
                key={rIdx}
                className={clsx(
                  "transition-colors",
                  rIdx % 2 === 1
                    ? "bg-slate-50/50 dark:bg-white/[0.015]"
                    : "bg-transparent",
                  "hover:bg-emerald-500/[0.03]"
                )}
              >
                {cells.map((cell, cIdx) => (
                  <td key={cIdx} className="py-2 px-3 text-slate-700 dark:text-slate-300">
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Inline Renderer for Bold, Code, Math, and Formulas ────────────────────────

function renderInline(text: string): React.ReactNode {
  // Clean LaTeX approximations & special characters
  let cleanText = text
    .replace(/\\sim\((.*?)\)/g, "~($1)")
    .replace(/\\mathbf\{(.*?)\}/g, "$1")
    .replace(/\\text\{(.*?)\}/g, "$1")
    .replace(/\\quad/g, " ")
    .replace(/\\implies/g, "=>")
    .replace(/\\le/g, "<=")
    .replace(/\\ge/g, ">=")
    .replace(/\\times/g, "x")
    .replace(/\\dots/g, "...");

  // Tokenize by `code` and **bold** and math $...$
  const tokens = cleanText.split(/(`[^`]+`|\*\*[^*]+\*\*|\$[^$]+\$)/g);

  return tokens.map((token, i) => {
    if (!token) return null;

    // Code snippet `...`
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code
          key={i}
          className="font-mono text-[11px] sm:text-xs bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/[0.08]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    // Math inline $...$
    if (token.startsWith("$") && token.endsWith("$") && token.length > 2) {
      return (
        <span
          key={i}
          className="font-mono text-[11px] sm:text-xs text-sky-600 dark:text-sky-400 font-semibold px-1 py-0.5 rounded bg-sky-500/10 border border-sky-500/20"
        >
          {token.slice(1, -1)}
        </span>
      );
    }

    // Bold **...**
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-slate-900 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }

    return <React.Fragment key={i}>{token}</React.Fragment>;
  });
}
