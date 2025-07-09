"use client";

import { useState, useEffect, useRef } from "react";
import { apiService, SurveyListItem } from "@/lib/api";

export default function Home() {
  const [surveys, setSurveys] = useState<SurveyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const copySurveyLink = async (surveyId: string) => {
    const surveyUrl = `${window.location.origin}/survey/${surveyId}`;
    try {
      await navigator.clipboard.writeText(surveyUrl);
      setCopiedId(surveyId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading surveys...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
          <p className="text-red-800">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Survey Platform
          </h1>
          <p className="text-gray-600">Manage and share your surveys</p>
        </header>

        <main>
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Available Surveys
            </h2>

            {surveys.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  No surveys available at the moment.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {surveys.map((survey) => (
                  <div
                    key={survey.id}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
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

                    <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                      <span>
                        Created:{" "}
                        {new Date(survey.created_at).toLocaleDateString()}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                        Active
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <a
                        href={`/survey/${survey.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 text-center"
                      >
                        Take Survey
                      </a>
                      <button
                        onClick={() => copySurveyLink(survey.id)}
                        className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
                        title="Copy survey link"
                      >
                        {copiedId === survey.id ? "✓ Copied" : "🔗"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
