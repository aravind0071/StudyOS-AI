"use client";

import React from "react";
import { Copy, Check } from "lucide-react";

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

  // Split content by code blocks: ```[lang]\n[code]\n```
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className={`space-y-3 leading-relaxed text-xs sm:text-sm text-slate-800 dark:text-slate-100 break-words [overflow-wrap:anywhere] max-w-full overflow-hidden ${className}`}>
      {parts.map((part, pIdx) => {
        if (!part) return null;

        // Code block
        if (part.startsWith("```") && part.endsWith("```")) {
          const firstLineEnd = part.indexOf("\n");
          const lang = part.slice(3, firstLineEnd).trim() || "text";
          const code = part.slice(firstLineEnd + 1, -3);

          return (
            <div key={pIdx} className="my-3 rounded-xl overflow-hidden border border-slate-700/60 bg-slate-950 shadow-md">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
                <span>{lang}</span>
                <button
                  onClick={() => handleCopy(code, pIdx)}
                  className="flex items-center gap-1 hover:text-white transition-colors text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700"
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
              <pre className="p-3 text-[12px] sm:text-[13px] font-mono leading-relaxed text-emerald-300 overflow-x-auto whitespace-pre">
                {code}
              </pre>
            </div>
          );
        }

        // Regular text block: parse lines for headings, blockquotes, bullets, and inline formatting
        const lines = part.split("\n");
        return (
          <div key={pIdx} className="space-y-2">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) {
                return <div key={lIdx} className="h-1.5" />;
              }

              // Divider
              if (trimmed === "---") {
                return <hr key={lIdx} className="my-3 border-slate-200 dark:border-white/[0.08]" />;
              }

              // H3
              if (trimmed.startsWith("### ")) {
                return (
                  <h3 key={lIdx} className="text-sm sm:text-base font-bold text-slate-900 dark:text-white pt-2 pb-1 border-b border-slate-100 dark:border-white/[0.06] flex items-center gap-1.5">
                    {renderInline(trimmed.replace(/^###\s+/, ""))}
                  </h3>
                );
              }

              // H4
              if (trimmed.startsWith("#### ")) {
                return (
                  <h4 key={lIdx} className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 pt-1.5">
                    {renderInline(trimmed.replace(/^####\s+/, ""))}
                  </h4>
                );
              }

              // H5
              if (trimmed.startsWith("##### ")) {
                return (
                  <h5 key={lIdx} className="text-xs font-semibold text-slate-700 dark:text-slate-300 pt-1">
                    {renderInline(trimmed.replace(/^#####\s+/, ""))}
                  </h5>
                );
              }

              // Blockquote / Tip
              if (trimmed.startsWith("> ")) {
                return (
                  <blockquote
                    key={lIdx}
                    className="p-2.5 my-1.5 bg-emerald-500/[0.07] border-l-3 border-emerald-500 rounded-r-lg text-xs italic text-slate-700 dark:text-slate-300"
                  >
                    {renderInline(trimmed.replace(/^>\s+/, ""))}
                  </blockquote>
                );
              }

              // Bullet list (- or *)
              if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                    <span className="flex-1">{renderInline(trimmed.replace(/^[-*]\s+/, ""))}</span>
                  </div>
                );
              }

              // Numbered list
              const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
              if (numMatch) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0 text-xs">
                      {numMatch[1]}.
                    </span>
                    <span className="flex-1">{renderInline(numMatch[2])}</span>
                  </div>
                );
              }

              // Normal paragraph
              return <p key={lIdx}>{renderInline(trimmed)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

// Inline renderer for **bold**, `code`, and clean math strings
function renderInline(text: string): React.ReactNode {
  // Replace clean LaTeX approximations if present
  let cleanText = text
    .replace(/\\sim\((.*?)\)/g, "~($1)")
    .replace(/\\mathbf\{(.*?)\}/g, "$1")
    .replace(/\\text\{(.*?)\}/g, "$1")
    .replace(/\$\$(.*?)\$\$/g, "$1")
    .replace(/\$(.*?)\$/g, "$1");

  // Tokenize by `code` and **bold**
  const tokens = cleanText.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return tokens.map((token, i) => {
    if (!token) return null;

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
