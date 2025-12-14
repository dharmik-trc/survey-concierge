import type { ReactNode } from "react";

// Helper function to parse markdown-like formatting in question text (supports nesting)
export const parseQuestionText = (text: string, keyPrefix = ""): ReactNode[] => {
  const parts: ReactNode[] = [];
  let currentIndex = 0;
  let keyCounter = 0;

  // Regex to match **bold**, __underline__, or *italic* (ordered by precedence)
  const regex = /\*\*(.+?)\*\*|__(.+?)__|_(.+?)_|\*(.+?)\*/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > currentIndex) {
      parts.push(text.substring(currentIndex, match.index));
    }

    const key = `${keyPrefix}-${keyCounter++}`;

    // Add formatted text with recursive parsing for nested formatting
    if (match[1]) {
      // Bold text (matched **)
      parts.push(
        <strong key={`bold-${key}`} className="font-bold">
          {parseQuestionText(match[1], `${key}-inner`)}
        </strong>
      );
    } else if (match[2]) {
      // Underline text (matched __)
      parts.push(
        <u key={`underline-${key}`} className="underline">
          {parseQuestionText(match[2], `${key}-inner`)}
        </u>
      );
    } else if (match[3] || match[4]) {
      // Italic text (matched _ or *)
      const italicText = match[3] || match[4];
      parts.push(
        <em key={`italic-${key}`} className="italic">
          {parseQuestionText(italicText, `${key}-inner`)}
        </em>
      );
    }

    currentIndex = regex.lastIndex;
  }

  // Add remaining text
  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }

  return parts.length > 0 ? parts : [text];
};
