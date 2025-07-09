"use client";

import { useState, useEffect, useRef } from "react";
import { apiService, Survey as SurveyType, Question } from "@/lib/api";

interface SurveyProps {
  surveyId: string;
  onBack: () => void;
}

interface SurveyResponse {
  [questionId: number]: string | string[] | number;
}

export default function Survey({ surveyId, onBack }: SurveyProps) {
  const [survey, setSurvey] = useState<SurveyType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<SurveyResponse>({});
  const [submitting, setSubmitting] = useState(false);

  // Use ref to prevent duplicate requests
  const hasRequested = useRef(false);

  useEffect(() => {
    // Only make request if we haven't already
    if (hasRequested.current) return;
    hasRequested.current = true;

    const fetchSurvey = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiService.getSurvey(surveyId);
        setSurvey(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch survey");
      } finally {
        setLoading(false);
      }
    };

    fetchSurvey();
  }, [surveyId]);

  const handleResponseChange = (
    questionId: number,
    value: string | string[] | number
  ) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    // Here you would typically send the responses to your backend
    console.log("Survey responses:", responses);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    alert("Thank you for completing the survey!");
    onBack();
    setSubmitting(false);
  };

  const renderQuestion = (question: Question) => {
    const value = responses[question.id];

    switch (question.question_type) {
      case "text":
        return (
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Enter your answer..."
            value={(value as string) || ""}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
          />
        );

      case "email":
        return (
          <input
            type="email"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your email..."
            value={(value as string) || ""}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
          />
        );

      case "number":
        return (
          <input
            type="number"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter a number..."
            value={(value as number) || ""}
            onChange={(e) =>
              handleResponseChange(question.id, parseInt(e.target.value) || 0)
            }
          />
        );

      case "rating":
        return (
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors ${
                  value === rating
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "border-gray-300 hover:border-blue-300"
                }`}
                onClick={() => handleResponseChange(question.id, rating)}
              >
                {rating}
              </button>
            ))}
          </div>
        );

      case "multiple_choice":
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <label
                key={index}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option}
                  checked={value === option}
                  onChange={(e) =>
                    handleResponseChange(question.id, e.target.value)
                  }
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );

      case "checkbox":
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <label
                key={index}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  value={option}
                  checked={Array.isArray(value) && value.includes(option)}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    const newValues = e.target.checked
                      ? [...currentValues, option]
                      : currentValues.filter((v) => v !== option);
                    handleResponseChange(question.id, newValues);
                  }}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );

      default:
        return <p className="text-gray-500">Unsupported question type</p>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
        <button
          onClick={onBack}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Survey not found.</p>
        <button
          onClick={onBack}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Back to Surveys
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {survey.title}
        </h1>
        <p className="text-gray-600 mb-6">{survey.description}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="space-y-8"
      >
        {survey.questions.map((question, index) => (
          <div
            key={question.id}
            className="bg-white border border-gray-200 rounded-lg p-6"
          >
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Question {index + 1}
              </h3>
              <p className="text-gray-700 mb-2">{question.question_text}</p>
              {question.is_required && (
                <span className="text-red-500 text-sm">* Required</span>
              )}
            </div>

            <div className="mt-4">{renderQuestion(question)}</div>
          </div>
        ))}

        <div className="flex justify-end pt-6">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit Survey"}
          </button>
        </div>
      </form>
    </div>
  );
}
