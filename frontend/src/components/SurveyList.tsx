"use client";

import { useState, useEffect, useRef } from "react";
import { apiService, SurveyListItem } from "../lib/api";

interface SurveyListProps {
  onSurveySelect: (surveyId: string) => void;
}

export default function SurveyList({ onSurveySelect }: SurveyListProps) {
  const [surveys, setSurveys] = useState<SurveyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use ref to prevent duplicate requests
  const hasRequested = useRef(false);

  useEffect(() => {
    // Only make request if we haven't already
    if (hasRequested.current) return;
    hasRequested.current = true;

    const fetchSurveys = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiService.getSurveys();
        setSurveys(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch surveys"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSurveys();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  if (surveys.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No surveys available at the moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Available Surveys
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {surveys.map((survey) => (
          <div
            key={survey.id}
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onSurveySelect(survey.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                {survey.title}
              </h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {survey.question_count} questions
              </span>
            </div>

            <p className="text-gray-600 text-sm mb-4 line-clamp-3">
              {survey.description}
            </p>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                Created: {new Date(survey.created_at).toLocaleDateString()}
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                Active
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
