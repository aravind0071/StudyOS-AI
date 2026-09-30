"use client";

import React, { useEffect, useRef, useState, useId } from "react";
import { Copy, Check, Eye, Code } from "lucide-react";
import clsx from "clsx";

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

export function MermaidDiagram({ chart, className = "" }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [renderError, setRenderError] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [showRaw, setShowRaw] = useState<boolean>(false);
  const uniqueId = useId().replace(/:/g, "m_");

  useEffect(() => {
    let isMounted = true;

    async function renderChart() {
      if (!chart.trim()) return;

      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default;

        const isDark = document.documentElement.classList.contains("dark");

        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "neutral",
          securityLevel: "loose",
          fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
          themeVariables: isDark
            ? {
                primaryColor: "#059669",
                primaryTextColor: "#ffffff",
                primaryBorderColor: "#10b981",
                lineColor: "#34d399",
                secondaryColor: "#0f172a",
                tertiaryColor: "#1e293b",
                mainBkg: "#0f172a",
                nodeBorder: "#10b981",
              }
            : {
                primaryColor: "#d1fae5",
                primaryTextColor: "#065f46",
                primaryBorderColor: "#10b981",
                lineColor: "#059669",
                secondaryColor: "#f8fafc",
                tertiaryColor: "#f1f5f9",
                mainBkg: "#ffffff",
                nodeBorder: "#059669",
              },
        });

        // Clean chart code if needed
        const cleanChart = chart.trim();
        const renderId = `mermaid_${uniqueId}_${Date.now()}`;
        const { svg } = await mermaid.render(renderId, cleanChart);

        if (isMounted) {
          setSvgContent(svg);
          setRenderError(false);
        }
      } catch (err) {
        console.warn("Mermaid render fallback:", err);
        if (isMounted) {
          setRenderError(true);
        }
      }
    }

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart, uniqueId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(chart);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // If there's a render error or user toggled raw, show styled code block
  if (renderError || showRaw) {
    return (
      <div className={clsx("my-3 rounded-xl overflow-hidden border border-slate-200 dark:border-white/[0.1] bg-[#0c1220] shadow-sm", className)}>
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-white/[0.06] text-[11px] text-slate-400 font-mono">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <Code className="w-3.5 h-3.5 text-emerald-400" />
            Diagram Definition
          </span>
          <div className="flex items-center gap-2">
            {!renderError && (
              <button
                type="button"
                onClick={() => setShowRaw(false)}
                className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-white/[0.06] transition-colors flex items-center gap-1"
              >
                <Eye className="w-3 h-3 text-emerald-400" />
                View Diagram
              </button>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className="text-[10px] text-slate-300 hover:text-white px-2 py-0.5 rounded bg-white/[0.08] transition-colors flex items-center gap-1"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>
        <pre className="p-3 text-[12px] font-mono leading-relaxed text-emerald-300 overflow-x-auto whitespace-pre">
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div className={clsx("my-3 rounded-xl overflow-hidden border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#0c1220] shadow-sm", className)}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-white/[0.06] text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
          <Eye className="w-3.5 h-3.5 text-emerald-500" />
          Concept Architecture Diagram
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRaw(true)}
            className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors flex items-center gap-1"
            title="View raw diagram code"
          >
            <Code className="w-3 h-3 text-slate-400" />
            <span>Code</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors flex items-center gap-1"
            title="Copy diagram code"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="p-4 sm:p-6 overflow-x-auto flex justify-center items-center [&_svg]:max-w-full [&_svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}
