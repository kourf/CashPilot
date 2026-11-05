import React from 'react';

/**
 * Utilitaires de recherche rapide dans les conversations du Coach IA
 */

export interface SearchMatchItem {
  messageId: string;
  messageIndex: number;
}

export interface SplitTextPart {
  text: string;
  isMatch: boolean;
}

/**
 * Découpe une chaîne en segments normaux et segments correspondant à la requête de recherche.
 * Résilient aux caractères spéciaux d'expressions régulières (?, *, +, $, (, ), [, ], /, €, etc.).
 */
export function splitTextBySearchQuery(text: string, searchQuery?: string): SplitTextPart[] {
  if (!text) {
    return [];
  }
  if (!searchQuery || !searchQuery.trim()) {
    return [{ text, isMatch: false }];
  }

  const query = searchQuery.trim();
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  if (parts.length <= 1) {
    return [{ text, isMatch: false }];
  }

  return parts.map((part) => ({
    text: part,
    isMatch: part.toLowerCase() === query.toLowerCase()
  }));
}

/**
 * Met en valeur visuellement un terme de recherche (Apple Liquid Glass amber glow)
 */
export function highlightSearchMatch(text: string, searchQuery?: string): React.ReactNode {
  const parts = splitTextBySearchQuery(text, searchQuery);
  if (parts.length === 0) {
    return text;
  }
  if (parts.length === 1 && !parts[0].isMatch) {
    return parts[0].text;
  }

  return parts.map((part, i) => {
    if (part.isMatch) {
      return React.createElement(
        'mark',
        {
          key: i,
          className:
            'bg-amber-400/35 text-amber-200 border-b-2 border-amber-400 px-0.5 rounded font-bold shadow-[0_0_10px_rgba(251,191,36,0.5)]'
        },
        part.text
      );
    }
    return part.text;
  });
}

/**
 * Recherche toutes les occurrences d'un terme dans une liste de messages de façon insensible à la casse.
 */
export function findSearchMatches(
  messages: Array<{ id: string; content: string }>,
  query: string
): SearchMatchItem[] {
  if (!query || !query.trim() || !messages || messages.length === 0) {
    return [];
  }

  const q = query.trim().toLowerCase();
  const matches: SearchMatchItem[] = [];

  messages.forEach((msg, idx) => {
    const contentLower = (msg.content || '').toLowerCase();
    let pos = 0;
    while ((pos = contentLower.indexOf(q, pos)) !== -1) {
      matches.push({
        messageId: msg.id,
        messageIndex: idx
      });
      pos += q.length;
    }
  });

  return matches;
}

/**
 * Calcule l'index suivant dans une boucle circulaire de résultats.
 */
export function getNextMatchIndex(currentIndex: number, totalMatches: number): number {
  if (totalMatches <= 0) return 0;
  return (currentIndex + 1) % totalMatches;
}

/**
 * Calcule l'index précédent dans une boucle circulaire de résultats.
 */
export function getPrevMatchIndex(currentIndex: number, totalMatches: number): number {
  if (totalMatches <= 0) return 0;
  return (currentIndex - 1 + totalMatches) % totalMatches;
}

/**
 * Filtre les conversations historiques par titre ou contenu d'un de leurs messages.
 */
export function filterConversations(
  conversations: Array<{ id: string; title?: string; messages?: Array<{ content: string }> }>,
  query: string
) {
  if (!query || !query.trim()) {
    return conversations;
  }
  const q = query.trim().toLowerCase();
  return conversations.filter((c) => {
    const titleMatch = (c.title || '').toLowerCase().includes(q);
    const msgMatch = (c.messages || []).some((m) => (m.content || '').toLowerCase().includes(q));
    return titleMatch || msgMatch;
  });
}
