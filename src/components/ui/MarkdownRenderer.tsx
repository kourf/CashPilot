import React from 'react';
import { splitTextBySearchQuery, highlightSearchMatch } from '../../lib/conversationSearchUtils';

export { highlightSearchMatch };

interface MarkdownRendererProps {
  content: string;
  className?: string;
  searchQuery?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '', searchQuery }) => {
  // Découpage par blocs (paragraphes, tableaux, listes, titres, citations)
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];

  let inList = false;
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' = 'ul';

  const flushTable = (keyPrefix: string) => {
    if (tableHeader.length > 0 || tableRows.length > 0) {
      elements.push(
        <div key={`table-${keyPrefix}`} className="overflow-x-auto my-4 rounded-2xl border border-white/12 shadow-lg bg-[#151824]/70 backdrop-blur-xl">
          <table className="w-full text-xs sm:text-sm text-left">
            {tableHeader.length > 0 && (
              <thead className="bg-white/[0.05] text-slate-200 font-bold border-b border-white/10 uppercase tracking-wider text-[11px] sm:text-xs">
                <tr>
                  {tableHeader.map((th, i) => (
                    <th key={i} className="px-4 py-3 whitespace-nowrap">
                      {renderInlineFormatting(th, searchQuery)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-white/[0.06]">
              {tableRows.map((row, ri) => (
                <tr key={ri} className="hover:bg-white/[0.04] transition-colors">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-3 text-slate-100">
                      {renderInlineFormatting(cell, searchQuery)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    tableHeader = [];
    tableRows = [];
    inTable = false;
  };

  const flushList = (keyPrefix: string) => {
    if (listItems.length > 0) {
      if (listType === 'ol') {
        elements.push(
          <ol key={`ol-${keyPrefix}`} className="list-decimal list-inside space-y-2 my-3 text-[15px] sm:text-base text-slate-100 leading-relaxed pl-2">
            {listItems.map((item, idx) => (
              <li key={idx} className="marker:text-sky-400 marker:font-bold">
                {renderInlineFormatting(item, searchQuery)}
              </li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${keyPrefix}`} className="space-y-2 my-3 text-[15px] sm:text-base text-slate-100 leading-relaxed">
            {listItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 mt-2 shrink-0 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
                <span>{renderInlineFormatting(item, searchQuery)}</span>
              </li>
            ))}
          </ul>
        );
      }
      listItems = [];
      inList = false;
    }
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();

    // Table detection: line starting and containing |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (inList) flushList(`l-${idx}`);
      inTable = true;
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim());

      // Check if it's separator line (e.g. |---|---|)
      const isSeparator = cells.every(c => /^:?-+:?$/.test(c));
      if (isSeparator) {
        continue;
      }

      if (tableHeader.length === 0 && tableRows.length === 0) {
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable(`t-${idx}`);
    }

    // Numbered List (1. 2. etc.)
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (olMatch) {
      if (inList && listType !== 'ol') flushList(`fl-ol-${idx}`);
      inList = true;
      listType = 'ol';
      listItems.push(olMatch[2]);
      continue;
    }

    // Bullet List (- or *)
    const ulMatch = trimmed.match(/^[-*]\s+(.*)/);
    if (ulMatch) {
      if (inList && listType !== 'ul') flushList(`fl-ul-${idx}`);
      inList = true;
      listType = 'ul';
      listItems.push(ulMatch[1]);
      continue;
    }

    if (inList) {
      flushList(`l-${idx}`);
    }

    // Empty lines
    if (!trimmed) {
      continue;
    }

    // Horizontal Rule
    if (/^---$|^___$|^\*\*\*$/.test(trimmed)) {
      elements.push(<hr key={`hr-${idx}`} className="my-4 border-border/80 dark:border-white/10" />);
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={`h4-${idx}`} className="text-base sm:text-lg font-bold text-white mt-5 mb-2 flex items-center gap-2">
          {renderInlineFormatting(trimmed.substring(4), searchQuery)}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={`h3-${idx}`} className="text-lg sm:text-xl font-bold text-sky-300 mt-6 mb-2.5 flex items-center gap-2">
          {renderInlineFormatting(trimmed.substring(3), searchQuery)}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={`h2-${idx}`} className="text-xl sm:text-2xl font-extrabold text-white mt-7 mb-3">
          {renderInlineFormatting(trimmed.substring(2), searchQuery)}
        </h2>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      elements.push(
        <div key={`bq-${idx}`} className="border-l-4 border-sky-400/80 bg-sky-500/[0.08] p-4 rounded-r-2xl my-3 text-[15px] sm:text-base text-slate-200 italic shadow-sm">
          {renderInlineFormatting(trimmed.substring(2), searchQuery)}
        </div>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${idx}`} className="text-[15px] sm:text-base text-slate-100 leading-relaxed my-2.5">
        {renderInlineFormatting(trimmed, searchQuery)}
      </p>
    );
  }

  if (inTable) flushTable('end');
  if (inList) flushList('end');

  return <div className={`space-y-2.5 ${className}`}>{elements}</div>;
};

// Formateur de style en ligne pour le gras, l'italique, le code et les badges monétaires
function renderInlineFormatting(text: string, searchQuery?: string): React.ReactNode {
  if (!text) return null;

  // Split text by formatting tokens: **bold**, `code`, *italic*
  // Regex pattern matching: `code`, **bold**, *italic*
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(highlightCurrencies(text.substring(lastIndex, match.index), searchQuery));
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      const inner = token.slice(2, -2);
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {highlightCurrencies(inner, searchQuery)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      const inner = token.slice(1, -1);
      parts.push(
        <code key={match.index} className="px-1.5 py-0.5 rounded-md bg-secondary/80 dark:bg-white/10 font-mono text-[11px] text-primary">
          {highlightSearchMatch(inner, searchQuery)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      const inner = token.slice(1, -1);
      parts.push(<em key={match.index}>{highlightCurrencies(inner, searchQuery)}</em>);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(highlightCurrencies(text.substring(lastIndex), searchQuery));
  }

  return <>{parts}</>;
}

// Mise en valeur subtile des montants financiers (ex: 120,50 €, -45 €, 50/30/20)
function highlightCurrencies(str: string, searchQuery?: string): React.ReactNode {
  // Regex pour repérer les montants monétaires comme 120,50 € ou -45 €
  const currencyRegex = /([+-]?\d+([.,]\d+)?\s*(?:€|EUR|CHF))/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = currencyRegex.exec(str)) !== null) {
    if (match.index > lastIdx) {
      parts.push(highlightSearchMatch(str.substring(lastIdx, match.index), searchQuery));
    }
    const val = match[0];
    const isNegative = val.startsWith('-');
    const isPositive = val.startsWith('+');

    parts.push(
      <span
        key={match.index}
        className={`font-semibold px-1 rounded ${
          isNegative
            ? 'text-rose-500 bg-rose-500/10'
            : isPositive
            ? 'text-emerald-500 bg-emerald-500/10'
            : 'text-primary bg-primary/10'
        }`}
      >
        {highlightSearchMatch(val, searchQuery)}
      </span>
    );
    lastIdx = currencyRegex.lastIndex;
  }

  if (lastIdx < str.length) {
    parts.push(highlightSearchMatch(str.substring(lastIdx), searchQuery));
  }

  return <>{parts}</>;
}
