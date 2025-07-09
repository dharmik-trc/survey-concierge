"use client";

import { useState, useEffect, useRef, use } from "react";
import { apiService, Survey as SurveyType, Question } from "@/lib/api";

interface SurveyResponse {
  [questionId: number]: string | string[] | number;
}

interface ValidationErrors {
  [questionId: number]: string;
}

export default function SurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: surveyId } = use(params);
  const [survey, setSurvey] = useState<SurveyType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<SurveyResponse>({});
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {}
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

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

  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateNumber = (value: string | number): boolean => {
    console.log("validateNumber called with:", value, "type:", typeof value);
    if (typeof value === "number") {
      const result = value !== 0;
      console.log("Number validation result:", result);
      return result;
    }
    if (typeof value === "string") {
      const result = !isNaN(Number(value)) && value.trim() !== "";
      console.log("String validation result:", result);
      return result;
    }
    console.log("Invalid type for number validation");
    return false;
  };

  const validateRequired = (value: any, questionType: string): boolean => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === "string") {
      return value.trim() !== "";
    }
    if (typeof value === "number") {
      return value !== 0;
    }
    return value !== undefined && value !== null && value !== "";
  };

  const validateQuestion = (
    questionId: number,
    value: any,
    questionType: string
  ): string | null => {
    const question = survey?.questions.find((q) => q.id === questionId);
    if (!question) return null;

    console.log(`Validating question ${questionId}:`, {
      value,
      type: questionType,
      required: question.is_required,
      questionText: question.question_text,
    });

    // Check if required
    if (question.is_required && !validateRequired(value, questionType)) {
      console.log(`Question ${questionId} is required but not answered`);
      return "This field is required";
    }

    // If not required and empty, it's valid
    if (!question.is_required && !validateRequired(value, questionType)) {
      console.log(`Question ${questionId} is optional and empty - valid`);
      return null;
    }

    // Type-specific validation
    switch (questionType) {
      case "email":
        if (!validateEmail(value as string)) {
          console.log(`Question ${questionId} email validation failed`);
          return "Please enter a valid email address";
        }
        break;

      case "number":
        if (!validateNumber(value)) {
          console.log(
            `Question ${questionId} number validation failed:`,
            value
          );
          return "Please enter a valid number";
        }
        break;

      case "rating":
        if (typeof value !== "number" || value < 1 || value > 5) {
          console.log(
            `Question ${questionId} rating validation failed:`,
            value
          );
          return "Please select a rating between 1 and 5";
        }
        break;

      case "multiple_choice":
        if (!value || value.trim() === "") {
          console.log(
            `Question ${questionId} multiple choice validation failed`
          );
          return "Please select an option";
        }
        break;

      case "checkbox":
        if (!Array.isArray(value) || value.length === 0) {
          console.log(
            `Question ${questionId} checkbox validation failed:`,
            value
          );
          return "Please select at least one option";
        }
        break;
    }

    console.log(`Question ${questionId} validation passed`);
    return null;
  };

  const handleResponseChange = (
    questionId: number,
    value: string | string[] | number
  ) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));

    // Clear validation error when user starts typing
    if (validationErrors[questionId]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const handleBlur = (questionId: number, value: any, questionType: string) => {
    const error = validateQuestion(questionId, value, questionType);
    setValidationErrors((prev) => ({
      ...prev,
      [questionId]: error || "",
    }));
  };

  const handleNext = () => {
    if (!survey) return;

    const currentQuestion = survey.questions[currentQuestionIndex];
    const currentValue = responses[currentQuestion.id];

    // Validate current question before proceeding
    const error = validateQuestion(
      currentQuestion.id,
      currentValue,
      currentQuestion.question_type
    );

    if (error) {
      setValidationErrors((prev) => ({
        ...prev,
        [currentQuestion.id]: error,
      }));
      return; // Don't proceed if validation fails
    }

    if (currentQuestionIndex < survey.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!survey) return;

    console.log("Starting submission process...");
    console.log("Current responses:", responses);
    console.log("Survey questions:", survey.questions);

    // Validate all questions before submitting
    const errors: ValidationErrors = {};
    let hasErrors = false;

    survey.questions.forEach((question) => {
      const value = responses[question.id];
      console.log(`Validating question ${question.id}:`, {
        value,
        type: question.question_type,
        required: question.is_required,
      });

      const error = validateQuestion(
        question.id,
        value,
        question.question_type
      );

      if (error) {
        console.log(`Validation error for question ${question.id}:`, error);
        errors[question.id] = error;
        hasErrors = true;
      }
    });

    console.log("Validation errors:", errors);
    console.log("Has errors:", hasErrors);

    if (hasErrors) {
      setValidationErrors(errors);
      // Jump to the first question with an error
      const firstErrorIndex = survey.questions.findIndex((q) => errors[q.id]);
      if (firstErrorIndex !== -1) {
        setCurrentQuestionIndex(firstErrorIndex);
      }
      console.log("Submission blocked due to validation errors");
      return;
    }

    console.log("All validation passed, proceeding with submission...");
    setSubmitting(true);
    try {
      // Send the responses to the backend
      const result = await apiService.submitSurveyResponse(surveyId, responses);
      console.log("Survey submitted successfully:", result);
      setSubmitted(true);
    } catch (error) {
      console.error("Failed to submit survey:", error);
      setError(
        error instanceof Error ? error.message : "Failed to submit survey"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isCurrentQuestionAnswered = () => {
    if (!survey) return false;
    const currentQuestion = survey.questions[currentQuestionIndex];
    const response = responses[currentQuestion.id];

    if (currentQuestion.is_required) {
      if (Array.isArray(response)) {
        return response.length > 0;
      }
      return response !== undefined && response !== "" && response !== 0;
    }
    return true; // Optional questions are always considered "answered"
  };

  const renderQuestion = (question: Question) => {
    const value = responses[question.id];
    const error = validationErrors[question.id];

    const inputClasses = `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-black ${
      error
        ? "border-red-500 focus:ring-red-500"
        : "border-gray-300 focus:ring-blue-500"
    }`;

    switch (question.question_type) {
      case "text":
        return (
          <div>
            <textarea
              className={inputClasses}
              rows={3}
              placeholder="Enter your answer..."
              value={(value as string) || ""}
              onChange={(e) =>
                handleResponseChange(question.id, e.target.value)
              }
              onBlur={(e) =>
                handleBlur(question.id, e.target.value, question.question_type)
              }
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
        );

      case "email":
        return (
          <div>
            <input
              type="email"
              className={inputClasses}
              placeholder="Enter your email..."
              value={(value as string) || ""}
              onChange={(e) =>
                handleResponseChange(question.id, e.target.value)
              }
              onBlur={(e) =>
                handleBlur(question.id, e.target.value, question.question_type)
              }
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
        );

      case "number":
        return (
          <div>
            <input
              type="number"
              className={inputClasses}
              placeholder="Enter a number..."
              value={(value as number) || ""}
              onChange={(e) => {
                const numValue =
                  e.target.value === "" ? 0 : parseInt(e.target.value) || 0;
                handleResponseChange(question.id, numValue);
              }}
              onBlur={(e) =>
                handleBlur(question.id, e.target.value, question.question_type)
              }
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
        );

      case "rating":
        return (
          <div>
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
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
        );

      case "multiple_choice":
        return (
          <div>
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
                    onBlur={() =>
                      handleBlur(question.id, value, question.question_type)
                    }
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{option}</span>
                </label>
              ))}
            </div>
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
        );

      case "checkbox":
        return (
          <div>
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
                    onBlur={() =>
                      handleBlur(question.id, value, question.question_type)
                    }
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{option}</span>
                </label>
              ))}
            </div>
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
        );

      default:
        return <p className="text-gray-500">Unsupported question type</p>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading survey...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
          <h2 className="text-xl font-semibold text-red-800 mb-2">
            Survey Not Found
          </h2>
          <p className="text-red-700 mb-4">{error}</p>
          <p className="text-gray-600 text-sm">
            Please check the survey link or contact the survey administrator.
          </p>
        </div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Survey not found.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 max-w-md text-center">
          <div className="text-green-600 text-6xl mb-4">✓</div>
          <h2 className="text-xl font-semibold text-green-800 mb-2">
            Thank You!
          </h2>
          <p className="text-green-700">
            Your survey response has been submitted successfully.
          </p>
        </div>
      </div>
    );
  }

  const currentQuestion = survey.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === survey.questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;
  const progressPercentage =
    ((currentQuestionIndex + 1) / survey.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {survey.title}
            </h1>
            <p className="text-gray-600 mb-4">{survey.description}</p>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>
                  Question {currentQuestionIndex + 1} of{" "}
                  {survey.questions.length}
                </span>
                <span>{Math.round(progressPercentage)}% Complete</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Current Question */}
          <div className="mb-8">
            <div className="mb-4">
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                Question {currentQuestionIndex + 1}
              </h3>
              <p className="text-gray-700 mb-2">
                {currentQuestion.question_text}
              </p>
              {currentQuestion.is_required && (
                <span className="text-red-500 text-sm">* Required</span>
              )}
            </div>

            <div className="mt-6">{renderQuestion(currentQuestion)}</div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={isFirstQuestion}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <div className="flex gap-3">
              {!isLastQuestion ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Submit Survey"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
