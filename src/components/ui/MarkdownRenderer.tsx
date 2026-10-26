import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
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
        <div key={`table-${keyPrefix}`} className="overflow-x-auto my-3 rounded-xl border border-border/80 dark:border-white/10 shadow-sm bg-card/60 backdrop-blur-md">
          <table className="w-full text-xs text-left">
            {tableHeader.length > 0 && (
              <thead className="bg-secondary/60 dark:bg-white/[0.04] text-foreground font-semibold border-b border-border/80 dark:border-white/10 uppercase tracking-wider text-[11px]">
                <tr>
                  {tableHeader.map((th, i) => (
                    <th key={i} className="px-3.5 py-2.5 whitespace-nowrap">
                      {renderInlineFormatting(th)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-border/60 dark:divide-white/[0.06]">
              {tableRows.map((row, ri) => (
                <tr key={ri} className="hover:bg-secondary/30 dark:hover:bg-white/[0.02] transition-colors">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3.5 py-2 text-foreground/90">
                      {renderInlineFormatting(cell)}
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
          <ol key={`ol-${keyPrefix}`} className="list-decimal list-inside space-y-1 my-2 text-xs md:text-sm text-foreground/90 leading-relaxed pl-1">
            {listItems.map((item, idx) => (
              <li key={idx} className="marker:text-primary marker:font-bold">
                {renderInlineFormatting(item)}
              </li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${keyPrefix}`} className="space-y-1.5 my-2 text-xs md:text-sm text-foreground/90 leading-relaxed">
            {listItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <span>{renderInlineFormatting(item)}</span>
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
        <h4 key={`h4-${idx}`} className="text-sm md:text-base font-bold text-foreground mt-4 mb-1.5 flex items-center gap-2">
          {renderInlineFormatting(trimmed.substring(4))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={`h3-${idx}`} className="text-base md:text-lg font-bold text-foreground mt-4 mb-2 flex items-center gap-2">
          {renderInlineFormatting(trimmed.substring(3))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={`h2-${idx}`} className="text-lg md:text-xl font-extrabold text-foreground mt-4 mb-2">
          {renderInlineFormatting(trimmed.substring(2))}
        </h2>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      elements.push(
        <div key={`bq-${idx}`} className="border-l-2 border-primary/70 bg-primary/[0.04] p-3 rounded-r-xl my-2 text-xs md:text-sm text-foreground/90 italic">
          {renderInlineFormatting(trimmed.substring(2))}
        </div>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${idx}`} className="text-xs md:text-sm text-foreground/90 leading-relaxed my-1.5">
        {renderInlineFormatting(trimmed)}
      </p>
    );
  }

  if (inTable) flushTable('end');
  if (inList) flushList('end');

  return <div className={`space-y-1 ${className}`}>{elements}</div>;
};

// Formateur de style en ligne pour le gras, l'italique, le code et les badges monétaires
function renderInlineFormatting(text: string): React.ReactNode {
  if (!text) return null;

  // Split text by formatting tokens: **bold**, `code`, *italic*
  // Regex pattern matching: `code`, **bold**, *italic*
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(highlightCurrencies(text.substring(lastIndex, match.index)));
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      const inner = token.slice(2, -2);
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {highlightCurrencies(inner)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      const inner = token.slice(1, -1);
      parts.push(
        <code key={match.index} className="px-1.5 py-0.5 rounded-md bg-secondary/80 dark:bg-white/10 font-mono text-[11px] text-primary">
          {inner}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      const inner = token.slice(1, -1);
      parts.push(<em key={match.index}>{highlightCurrencies(inner)}</em>);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(highlightCurrencies(text.substring(lastIndex)));
  }

  return <>{parts}</>;
}

// Mise en valeur subtile des montants financiers (ex: 120,50 €, -45 €, 50/30/20)
function highlightCurrencies(str: string): React.ReactNode {
  // Regex pour repérer les montants monétaires comme 120,50 € ou -45 €
  const currencyRegex = /([+-]?\d+([.,]\d+)?\s*(?:€|EUR|CHF))/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = currencyRegex.exec(str)) !== null) {
    if (match.index > lastIdx) {
      parts.push(str.substring(lastIdx, match.index));
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
        {val}
      </span>
    );
    lastIdx = currencyRegex.lastIndex;
  }

  if (lastIdx < str.length) {
    parts.push(str.substring(lastIdx));
  }

  return <>{parts}</>;
}
