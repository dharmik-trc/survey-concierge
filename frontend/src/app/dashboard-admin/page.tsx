"use client";

import { useState, useEffect, useRef } from "react";
import { apiService, SurveyListItem } from "../../lib/api";
import ConciergeLogo from "../../components/ConciergeLogo";

export default function Dashboard() {
  const [surveys, setSurveys] = useState<SurveyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Use ref to prevent duplicate requests
  const hasRequested = useRef(false);

  // Check authentication on component mount
  useEffect(() => {
    const authStatus = localStorage.getItem("surveyConciergeAuth");
    if (authStatus === "authenticated") {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    // Only make request if we haven't already and user is authenticated
    if (hasRequested.current || !isAuthenticated) return;
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
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple password check - in production, this should be server-side
    if (password === "admin123") {
      setIsAuthenticated(true);
      localStorage.setItem("surveyConciergeAuth", "authenticated");
      setAuthError("");
    } else {
      setAuthError("Invalid password");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("surveyConciergeAuth");
    setSurveys([]);
    setLoading(true);
    hasRequested.current = false;
  };

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

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Survey Concierge
            </h1>
            <p className="text-gray-600">Admin Dashboard Access</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Admin Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-black"
                placeholder="Enter admin password"
                required
              />
            </div>

            {authError && (
              <div className="text-red-600 text-sm text-center">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200"
            >
              Access Dashboard
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              This area is restricted to authorized personnel only.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mx-auto mb-6"></div>
          <p className="text-gray-600 text-lg font-medium">
            Loading surveys...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="bg-white border border-red-200 rounded-xl p-8 max-w-md shadow-lg">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <p className="text-red-800 font-medium">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <ConciergeLogo size="lg" />
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Available Surveys
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Discover and participate in our collection of surveys. Each survey
            is designed to gather valuable insights and feedback.
          </p>
        </div>

        <main>
          {surveys.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-12 h-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Surveys Available
              </h3>
              <p className="text-gray-500">
                Check back later for new surveys or contact the administrator.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {surveys.map((survey) => (
                <div
                  key={survey.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-xl font-semibold text-gray-900 line-clamp-2 leading-tight">
                        {survey.title}
                      </h3>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-100 to-emerald-100 text-green-800">
                        {survey.question_count} questions
                      </span>
                    </div>

                    <p className="text-gray-600 text-sm mb-6 line-clamp-3 leading-relaxed">
                      {survey.description || "No description available"}
                    </p>

                    <div className="flex items-center justify-between text-xs text-gray-500 mb-6">
                      <span className="flex items-center">
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        {new Date(survey.created_at).toLocaleDateString()}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 font-medium">
                        Active
                      </span>
                    </div>

                    <div className="flex gap-3">
                      <a
                        href={`/survey/${survey.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-lg hover:from-indigo-700 hover:to-purple-700 text-center transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        Take Survey
                      </a>
                      <button
                        onClick={() => copySurveyLink(survey.id)}
                        className="px-4 py-3 bg-gray-50 text-gray-700 text-sm rounded-lg hover:bg-gray-100 transition-colors duration-200 border border-gray-200"
                        title="Copy survey link"
                      >
                        {copiedId === survey.id ? (
                          <span className="flex items-center">
                            <svg
                              className="w-4 h-4 mr-1 text-green-600"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Copied
                          </span>
                        ) : (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-16 text-center">
          <div className="border-t border-gray-200 pt-8">
            <p className="text-gray-500 text-sm">
              © 2024 Survey Concierge. Professional survey platform for data
              collection and insights.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
