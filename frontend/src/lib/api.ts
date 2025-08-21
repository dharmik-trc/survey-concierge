// API service for communicating with Django backend

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api/survey";

export interface Question {
  id: number;
  question_text: string;
  question_type: string;
  is_required: boolean;
  order: number;
  options?: string[];
  section_title?: string | null;
  subfields?: string[];
  rows?: string[];
  columns?: string[];
}

export interface Survey {
  id: string;
  title: string;
  description: string;
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
    | { [subfield: string]: number }
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
