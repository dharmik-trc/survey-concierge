// API service for communicating with Django backend

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:9000/api/survey";

export interface Question {
  id: number;
  question_text: string;
  primary_type: string;
  secondary_type: string;
  // Backward compatibility - will be removed later
  question_type?: string;
  is_required: boolean;
  order: number;
  randomize_options: boolean;
  has_none_option: boolean;
  none_option_text?: string | null;
  has_other_option: boolean;
  exclusive_column?: string | null;
  has_comment_box: boolean;
  comment_box_rows: number;
  comment_box_label?: string | null;
  store_on_next: boolean;
  options?: string[];
  section_title?: string | null;
  subfields?: string[];
  subfield_validations?: {
    [fieldName: string]: {
      type:
        | "positive_number"
        | "negative_number"
        | "all_numbers"
        | "email"
        | "text"
        | "auto_calculate";
      required?: boolean;
      formula?: string; // For auto-calculated fields like "Total"
    };
  };
  rows?: string[];
  columns?: string[];
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  logo_url?: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  store_basic_details: boolean;
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
    responses: SurveyResponse,
    sessionId?: string
  ): Promise<SubmitResponse> {
    return this.request<SubmitResponse>(`/surveys/${surveyId}/submit/`, {
      method: "POST",
      body: JSON.stringify({ responses, session_id: sessionId }),
    });
  }

  // Save partial response when user clicks Next
  async savePartialResponse(
    surveyId: string,
    questionId: number,
    answer: any,
    sessionId?: string
  ): Promise<{
    message: string;
    response_id: string;
    question_id: number;
    answer: any;
    session_id: string;
  }> {
    return this.request<{
      message: string;
      response_id: string;
      question_id: number;
      answer: any;
      session_id: string;
    }>(`/surveys/${surveyId}/questions/${questionId}/save-partial/`, {
      method: "POST",
      body: JSON.stringify({ answer, session_id: sessionId }),
    });
  }
}

export const apiService = new ApiService();

// Constants for special options
export const OTHER_OPTION = "Other, please specify";
export const DEFAULT_NONE_OPTION = "None of the Above";

// Simplified utility functions for option handling
export const optionUtils = {
  /**
   * Get options with proper hierarchy: regular options (randomized if needed) + Other + None of the Above
   */
  getOptionsWithSpecialHandling: (
    question: Question
  ): { options: string[]; hasOtherOption: boolean; hasNoneOption: boolean } => {
    const baseOptions = question.options || [];

    // If randomization is enabled, randomize only the base options
    let processedOptions = [...baseOptions];
    if (question.randomize_options && baseOptions.length > 0) {
      processedOptions = [...baseOptions].sort(() => Math.random() - 0.5);
    }

    // Build final options array with proper hierarchy
    const finalOptions = [...processedOptions];

    // Add "Other (please specify)" if enabled
    if (question.has_other_option) {
      finalOptions.push(OTHER_OPTION);
    }

    // Add "None of the Above" if enabled (always last)
    if (question.has_none_option) {
      const noneText = question.none_option_text || DEFAULT_NONE_OPTION;
      finalOptions.push(noneText);
    }

    return {
      options: finalOptions,
      hasOtherOption: question.has_other_option,
      hasNoneOption: question.has_none_option,
    };
  },

  /**
   * Legacy function for backward compatibility
   */
  getRandomizedOptions: (
    options: string[],
    shouldRandomize: boolean = false
  ): string[] => {
    if (!options || options.length === 0) return options;

    // If randomization is disabled, return original order
    if (!shouldRandomize) {
      return [...options];
    }

    // Randomize regular options only
    return [...options].sort(() => Math.random() - 0.5);
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
    // Scale questions are no longer supported in the current QUESTION_HIERARCHY
    return false;
  },

  /**
   * Organize options into columns (up to 6 per column, balanced when splitting)
   */
  organizeOptionsIntoColumns: (
    options: string[],
    maxPerColumn: number = 6
  ): string[][] => {
    if (options.length <= maxPerColumn) {
      return [options]; // Single column for 6 or fewer options
    }

    // For 7 or more options, split into 2 balanced columns
    const midPoint = Math.ceil(options.length / 2);
    return [options.slice(0, midPoint), options.slice(midPoint)];
  },
};
