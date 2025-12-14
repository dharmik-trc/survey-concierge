import type { Question } from "@/lib/api";

// Group questions by section_title, but put questions with null/empty/'Other' in their own section
export const getSections = (questions: Question[]) => {
  // Sort questions by their 'order' field first
  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);
  const sections: { title: string; questions: Question[] }[] = [];

  // Instead of grouping all 'Other' first, build sections in the order of sortedQuestions
  sortedQuestions.forEach(q => {
    const rawSection = q.section_title;
    const section =
      rawSection && rawSection.trim() && rawSection.toLowerCase() !== "other" ? rawSection : null;
    if (!section) {
      // Each question with no/empty/Other section_title gets its own section
      sections.push({ title: "Other", questions: [q] });
    } else {
      // If this is the first question in this section, create a new section in order
      const lastSection = sections.length > 0 ? sections[sections.length - 1] : null;
      if (!lastSection || lastSection.title !== section) {
        sections.push({ title: section, questions: [q] });
      } else {
        lastSection.questions.push(q);
      }
    }
  });
  return sections;
};
