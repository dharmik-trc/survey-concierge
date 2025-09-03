// API service for communicating with Django backend

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:9000/api/survey";

export interface Question {
  id: number;
  question_text: string;
  question_type: string;
  is_required: boolean;
  is_dropdown: boolean;
  order: number;
  options?: string[];
  section_title?: string | null;
  subfields?: string[];
  rows?: string[];
  columns?: string[];
  scale_options?: string[]; // For scale questions: list of scale options
  scale_exclusions?: string[]; // For scale questions: list of exclusion options
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  logo_url?: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  questions: Question[];
}

export interface SurveyListItem {
  id: string;
  title: string;
  description: string;
  created_at: string;
  question_count: number;
  is_active: boolean;
}

export interface SurveyResponse {
  [questionId: string]:
    | string
    | number
    | string[]
    | null
    | { [subfield: string]: number | null }
    | { [row: string]: string }
    | { [row: string]: string[] };
}

export interface SubmitResponse {
  message: string;
  response_id: string;
}

class ApiService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  // Get list of all surveys
  async getSurveys(signal?: AbortSignal): Promise<SurveyListItem[]> {
    return this.request<SurveyListItem[]>("/surveys/", { signal });
  }

  // Get a specific survey with all its questions
  async getSurvey(surveyId: string, signal?: AbortSignal): Promise<Survey> {
    return this.request<Survey>(`/surveys/${surveyId}/`, { signal });
  }

  // Get all questions for a specific survey
  async getSurveyQuestions(
    surveyId: string,
    signal?: AbortSignal
  ): Promise<Question[]> {
    return this.request<Question[]>(`/surveys/${surveyId}/questions/`, {
      signal,
    });
  }

  // Get a specific question
  async getQuestion(
    surveyId: string,
    questionId: number,
    signal?: AbortSignal
  ): Promise<Question> {
    return this.request<Question>(
      `/surveys/${surveyId}/questions/${questionId}/`,
      { signal }
    );
  }

  // Submit survey responses
  async submitSurveyResponse(
    surveyId: string,
    responses: SurveyResponse
  ): Promise<SubmitResponse> {
    return this.request<SubmitResponse>(`/surveys/${surveyId}/submit/`, {
      method: "POST",
      body: JSON.stringify({ responses }),
    });
  }
}

export const apiService = new ApiService();

// Simplified utility functions for option handling
export const optionUtils = {
  /**
   * Simple randomization that excludes special options
   */
  getRandomizedOptions: (options: string[]): string[] => {
    if (!options || options.length === 0) return options;

    // Simple exclusions - no need to store these
    const specialOptions = ["other", "don't know", "none"];

    // Separate regular and special options
    const regular = options.filter(
      (opt) =>
        !specialOptions.some((special) => opt.toLowerCase().includes(special))
    );
    const special = options.filter((opt) =>
      specialOptions.some((special) => opt.toLowerCase().includes(special))
    );

    // Randomize regular options only
    const shuffled = [...regular].sort(() => Math.random() - 0.5);

    // Keep special options at the end
    return [...shuffled, ...special];
  },

  /**
   * Simple check for exclusive options
   */
  isExclusiveOption: (option: string): boolean => {
    return (
      option.toLowerCase().includes("don't know") ||
      option.toLowerCase().includes("none")
    );
  },

  /**
   * Check if a question should be rendered as a scale
   */
  shouldRenderAsScale: (question: Question): boolean => {
    return (
      question.question_type === "scale" ||
      (question.question_type === "multiple_choice" &&
        question.options &&
        question.options.length === 5 &&
        question.question_text.toLowerCase().includes("experience")) ||
      false
    );
  },

  /**
   * Organize options into columns (up to 3 per column, balanced when splitting)
   */
  organizeOptionsIntoColumns: (
    options: string[],
    maxPerColumn: number = 3
  ): string[][] => {
    if (options.length <= maxPerColumn) {
      return [options]; // Single column for 3 or fewer options
    }

    // For 4 or more options, split into 2 balanced columns
    const midPoint = Math.ceil(options.length / 2);
    return [options.slice(0, midPoint), options.slice(midPoint)];
  },

  /**
   * Get scale labels for a question
   */
  getScaleLabels: (question: Question): [string, string] => {
    if (question.scale_options && question.scale_options.length >= 2) {
      return [
        question.scale_options[0],
        question.scale_options[question.scale_options.length - 1],
      ];
    }

    // Default labels based on question content
    if (question.question_text.toLowerCase().includes("recruitment")) {
      return ["Much harder", "Much easier"];
    }
    if (question.question_text.toLowerCase().includes("experience")) {
      return ["Much worse", "Much better"];
    }

    return ["Strongly disagree", "Strongly agree"];
  },

  /**
   * Get exclusion options for scale questions
   */
  getScaleExclusions: (question: Question): string[] => {
    if (question.scale_exclusions) {
      return question.scale_exclusions;
    }

    // Default exclusions
    return ["Not applicable", "Don't know", "Did not recruit"];
  },
};
