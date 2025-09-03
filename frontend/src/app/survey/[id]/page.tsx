"use client";

import { useState, useEffect, useRef, use, useMemo } from "react";
import {
  apiService,
  Survey as SurveyType,
  Question,
  optionUtils,
} from "../../../lib/api";
import { cookieUtils, CookieData } from "../../../lib";
import React from "react"; // Added missing import for React
import Logo from "../../../components/Logo";
import SearchableDropdown from "../../../components/SearchableDropdown";

interface SurveyResponse {
  [questionId: string]:
    | string
    | number
    | string[]
    | null
    | { [subfield: string]: number | null }
    | { [row: string]: string };
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
  const [otherTexts, setOtherTexts] = useState<{
    [questionId: string]: string;
  }>({});
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  const [isRestoringProgress, setIsRestoringProgress] = useState(false);
  const [randomizedOptions, setRandomizedOptions] = useState<{
    [questionId: string]: string[];
  }>({});

  // Use ref to prevent duplicate requests
  const hasRequested = useRef(false);

  // Function to get or create randomized options for a question
  const getRandomizedOptions = (question: Question): string[] => {
    if (randomizedOptions[question.id]) {
      return randomizedOptions[question.id];
    }

    const options = optionUtils.getRandomizedOptions(question.options || []);
    setRandomizedOptions((prev) => ({
      ...prev,
      [question.id]: options,
    }));
    return options;
  };

  // Function to show save notification
  const displaySaveNotification = () => {
    setShowSaveNotification(true);
    setTimeout(() => setShowSaveNotification(false), 2000);
  };

  // Function to clear saved progress and start over
  const handleClearProgress = () => {
    cookieUtils.clearSurveyProgress(surveyId);
    setResponses({});
    setCurrentSectionIndex(0);
    setOtherTexts({});
    setValidationErrors({});
    setIsRestoringProgress(false);
    console.log("Cleared survey progress and reset to beginning");
  };

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

        // After survey is loaded, check for saved progress in cookies
        const savedProgress = cookieUtils.getSurveyProgress(surveyId);
        if (savedProgress) {
          console.log("Restoring survey progress from cookies:", savedProgress);
          setResponses(savedProgress.responses);
          setCurrentSectionIndex(savedProgress.currentSectionIndex);
          setOtherTexts(savedProgress.otherTexts);
          setIsRestoringProgress(true);
        } else {
          console.log("No saved progress found - starting fresh survey");
          setIsRestoringProgress(false);
        }
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
      // Allow any number including 0 and negative numbers
      const result = !isNaN(value) && isFinite(value);
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
      // For scale questions, allow 0 as valid (in case someone selects rating 0)
      // but for other number questions, 0 might be invalid
      if (questionType === "scale") {
        return true; // Any number is valid for scale
      }
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
        // Check if "Other" option is selected but no specification is provided
        const otherOption = question.options?.find((opt) =>
          opt.toLowerCase().includes("other")
        );
        if (value === otherOption && otherOption) {
          const otherText = otherTexts[questionId] || "";
          if (!otherText || otherText.trim() === "") {
            return "Please specify your other option";
          }
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
        // Check if "Other" option is selected but no specification is provided
        const checkboxOtherOption = question.options?.find((opt) =>
          opt.toLowerCase().includes("other")
        );
        if (
          checkboxOtherOption &&
          Array.isArray(value) &&
          value.includes(checkboxOtherOption)
        ) {
          const otherText = otherTexts[questionId] || "";
          if (!otherText || otherText.trim() === "") {
            return "Please specify your other option";
          }
        }
        break;

      case "matrix":
        if (typeof value !== "object" || Object.keys(value).length === 0) {
          console.log(
            `Question ${questionId} matrix validation failed:`,
            value
          );
          return "Please enter values for all subfields";
        }
        for (const subfield in value) {
          if (typeof value[subfield] !== "number") {
            console.log(
              `Question ${questionId} matrix subfield ${subfield} validation failed:`,
              value[subfield]
            );
            return `Please enter a valid number for ${subfield}`;
          }
        }
        break;

      case "cross_matrix":
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return "Please answer all rows";
        }
        if (question.is_required && question.rows) {
          for (const row of question.rows) {
            if (!value[row] || value[row].trim() === "") {
              return "Please answer all rows";
            }
          }
        }
        break;

      case "scale":
        if (
          question.is_required &&
          (value === null || value === undefined || value === "")
        ) {
          return "This field is required";
        }
        if (value !== null && value !== undefined && value !== "") {
          if (typeof value === "number") {
            if (value < 1 || value > 5) {
              return "Please select a rating between 1 and 5";
            }
          } else if (typeof value === "string") {
            // Validate exclusion options
            const exclusionOptions = optionUtils.getScaleExclusions(question);
            if (!exclusionOptions.includes(value)) {
              return "Please select a valid option";
            }
          }
        }
        break;

      case "cross_matrix_checkbox":
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return "Please answer all rows";
        }
        if (question.is_required && question.rows) {
          for (const row of question.rows) {
            if (!Array.isArray(value[row]) || value[row].length === 0) {
              return "Please answer all rows";
            }
          }
        }
        break;
    }

    console.log(`Question ${questionId} validation passed`);
    return null;
  };

  const handleResponseChange = (
    questionId: number,
    value:
      | string
      | string[]
      | number
      | null
      | { [subfield: string]: number | null }
      | { [row: string]: string }
      | { [row: string]: string[] }
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

  const handleBlur = (
    questionId: number,
    value: any,
    _questionType: string
  ) => {
    const error = validateQuestion(questionId, value, _questionType);
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
      // Sanitize matrix answers: ensure all subfields are numbers
      const sanitizedResponses: SurveyResponse = {};
      for (const [qid, ans] of Object.entries(responses)) {
        const question = survey?.questions.find((q) => String(q.id) === qid);
        if (question?.question_type === "multiple_choice") {
          const otherOption = question.options?.find((opt) =>
            opt.toLowerCase().includes("other")
          );
          if (ans === otherOption) {
            const otherTextValue = otherTexts[qid] || "";
            if (otherTextValue && otherTextValue.trim() !== "") {
              sanitizedResponses[qid as string] = `Other: ${otherTextValue}`;
            } else {
              // If "Other" is selected but no text is provided, this should have been caught by validation
              // But as a safety net, we'll skip this response rather than send incomplete data
              console.warn(
                `Skipping incomplete "Other" response for question ${qid}`
              );
            }
            continue;
          }
        }
        if (ans && typeof ans === "object" && !Array.isArray(ans)) {
          // cross_matrix or matrix
          if (
            survey?.questions.find((q) => String(q.id) === qid)
              ?.question_type === "cross_matrix"
          ) {
            sanitizedResponses[qid as string] = ans;
          } else {
            // matrix
            const sanitized: { [subfield: string]: number } = {};
            let hasValidData = false;
            for (const [sub, val] of Object.entries(ans)) {
              if (
                val !== undefined &&
                val !== null &&
                val !== "" &&
                val !== 0
              ) {
                sanitized[sub as string] =
                  typeof val === "number" ? val : Number(val);
                hasValidData = true;
              }
            }
            // Only add matrix response if it has valid data
            if (hasValidData) {
              sanitizedResponses[qid as string] = sanitized;
            }
          }
        } else if (Array.isArray(ans)) {
          // Handle checkbox with 'Other, please specify' as string[] for backend
          const question = survey?.questions.find((q) => String(q.id) === qid);
          const otherOption = question?.options?.find((opt) =>
            opt.toLowerCase().includes("other")
          );
          let newAns = ans.map((v) =>
            typeof v === "object" && v !== null && "other" in v
              ? `Other: ${(v as any).other}`
              : v
          );

          // Handle "Other" option in checkbox arrays
          if (otherOption && newAns.includes(otherOption)) {
            const otherTextValue = otherTexts[qid] || "";
            if (otherTextValue && otherTextValue.trim() !== "") {
              // Replace the generic "Other" with the specified text
              newAns = newAns.map((v) =>
                v === otherOption ? `Other: ${otherTextValue}` : v
              );
            } else {
              // Remove empty 'Other' if not filled
              newAns = newAns.filter((v) => v !== otherOption);
              console.warn(
                `Removed incomplete "Other" option from checkbox question ${qid}`
              );
            }
          }
          sanitizedResponses[qid as string] = newAns;
        } else {
          sanitizedResponses[qid as string] = ans;
        }
        if (
          question?.question_type === "cross_matrix_checkbox" &&
          question.rows
        ) {
          const answerObj =
            typeof ans === "object" && !Array.isArray(ans) ? { ...ans } : {};
          if (!question.rows) continue;
          // Only include rows that have actual answers
          const filteredAnswerObj: { [row: string]: string[] } = {};
          question.rows.forEach((row) => {
            if (
              answerObj[row] &&
              Array.isArray(answerObj[row]) &&
              answerObj[row].length > 0
            ) {
              filteredAnswerObj[row] = answerObj[row];
            }
          });
          // Only add if there are actual answers
          if (Object.keys(filteredAnswerObj).length > 0) {
            sanitizedResponses[qid as string] = filteredAnswerObj as any;
          }
          continue;
        }
        if (question?.question_type === "cross_matrix" && question.rows) {
          const answerObj =
            typeof ans === "object" && !Array.isArray(ans) ? { ...ans } : {};
          if (!question.rows) continue;
          // Only include rows that have actual answers
          const filteredAnswerObj: { [row: string]: string } = {};
          question.rows.forEach((row) => {
            if (
              answerObj[row] &&
              typeof answerObj[row] === "string" &&
              answerObj[row].trim() !== ""
            ) {
              filteredAnswerObj[row] = answerObj[row];
            }
          });
          // Only add if there are actual answers
          if (Object.keys(filteredAnswerObj).length > 0) {
            sanitizedResponses[qid as string] = filteredAnswerObj as any;
          }
          continue;
        }
      }
      const result = await apiService.submitSurveyResponse(
        surveyId,
        sanitizedResponses
      );
      console.log("Survey submitted successfully:", result);

      // Clear saved progress from cookies after successful submission
      cookieUtils.clearSurveyProgress(surveyId);
      console.log(
        "Cleared survey progress cookies after successful submission"
      );

      setSubmitted(true);
    } catch (error) {
      console.error("Failed to submit survey:", error);

      // Handle different types of errors
      let errorMessage = "Failed to submit survey";

      if (error instanceof Error) {
        if (error.message.includes("Missing subfield")) {
          errorMessage =
            "Please complete all required fields in the current section before proceeding.";
        } else if (error.message.includes("This field is required")) {
          errorMessage =
            "Please answer all required questions before submitting.";
        } else if (error.message.includes("Bad Request")) {
          errorMessage =
            "There was an issue with your responses. Please check all required fields.";
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question: Question) => {
    const value = responses[question.id];
    const error = validationErrors[question.id];

    const inputClasses = `w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:outline-none focus:ring-2 text-black transition-colors duration-200 text-sm sm:text-base ${
      error
        ? "border-red-500 focus:ring-red-500 focus:border-red-500"
        : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
    }`;

    switch (question.question_type) {
      case "text":
        return (
          <div>
            <textarea
              className={inputClasses}
              rows={4}
              placeholder="Enter your answer..."
              value={(value as string) || ""}
              onChange={(e) =>
                handleResponseChange(question.id, e.target.value)
              }
              onBlur={(e) =>
                handleBlur(question.id, e.target.value, question.question_type)
              }
            />
            {error && (
              <p className="text-red-500 text-sm mt-2 flex items-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </p>
            )}
          </div>
        );

      case "email":
        return (
          <div>
            <input
              type="email"
              className={inputClasses}
              placeholder="Enter your email address..."
              value={(value as string) || ""}
              onChange={(e) =>
                handleResponseChange(question.id, e.target.value)
              }
              onBlur={(e) =>
                handleBlur(question.id, e.target.value, question.question_type)
              }
            />
            {error && (
              <p className="text-red-500 text-sm mt-2 flex items-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </p>
            )}
          </div>
        );

      case "number":
        return (
          <div>
            <input
              type="number"
              step="any"
              className={inputClasses}
              placeholder="Enter a number (positive or negative)..."
              value={(value as number) || ""}
              onChange={(e) => {
                const numValue =
                  e.target.value === "" ? 0 : parseFloat(e.target.value) || 0;
                handleResponseChange(question.id, numValue);
              }}
              onBlur={(e) =>
                handleBlur(question.id, e.target.value, question.question_type)
              }
            />
            {error && (
              <p className="text-red-500 text-sm mt-2 flex items-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </p>
            )}
          </div>
        );

      case "rating":
        return (
          <div>
            <div className="flex gap-2 sm:gap-3 justify-center">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 flex items-center justify-center transition-all duration-200 font-semibold text-sm sm:text-base ${
                    value === rating
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-600 text-white shadow-lg"
                      : "border-gray-300 hover:border-indigo-300 hover:bg-gray-50 text-gray-600"
                  }`}
                  onClick={() => handleResponseChange(question.id, rating)}
                >
                  {rating}
                </button>
              ))}
            </div>
            {error && (
              <p className="text-red-500 text-sm mt-2 flex items-center justify-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </p>
            )}
          </div>
        );

      case "scale": {
        const scaleLabels = optionUtils.getScaleLabels(question);
        const exclusionOptions = optionUtils.getScaleExclusions(question);
        const isExclusionSelected = exclusionOptions.some(
          (opt: string) => value === opt
        );

        return (
          <div className="space-y-6">
            {/* Scale Section */}
            <div
              className={`transition-opacity duration-300 ${isExclusionSelected ? "opacity-50" : "opacity-100"}`}
            >
              <div className="flex justify-between text-sm text-gray-600 mb-4">
                <span>{scaleLabels[0]}</span>
                <span>{scaleLabels[1]}</span>
              </div>
              <div className="flex gap-1 sm:gap-2 justify-between">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    disabled={isExclusionSelected}
                    className={`flex-1 h-10 sm:h-12 rounded-lg border-2 flex items-center justify-center transition-all duration-200 font-semibold text-sm sm:text-base ${
                      value === rating
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-600 text-white shadow-lg"
                        : "border-gray-300 hover:border-indigo-300 hover:bg-gray-50 text-gray-600"
                    } ${isExclusionSelected ? "cursor-not-allowed" : "cursor-pointer"}`}
                    onClick={() => handleResponseChange(question.id, rating)}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            </div>

            {/* Exclusion Options */}
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-3">
                Or select one of the following:
              </p>
              <div className="space-y-2">
                {exclusionOptions.map((option: string) => (
                  <label
                    key={option}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={value === option}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleResponseChange(question.id, option);
                        } else {
                          handleResponseChange(question.id, null);
                        }
                      }}
                      className="w-4 h-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="text-gray-700">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm mt-2 flex items-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </p>
            )}
          </div>
        );
      }

      case "multiple_choice": {
        // Get randomized options with special handling - only randomize once
        const randomizedOptions = getRandomizedOptions(question);
        const otherOption = randomizedOptions.find((opt) =>
          opt.toLowerCase().includes("other")
        );
        const isOtherSelected = value === otherOption;
        const otherText = otherTexts[question.id] || "";
        const setOtherText = (text: string) =>
          setOtherTexts((prev) => ({ ...prev, [question.id]: text }));

        // Use searchable dropdown if admin marked question as dropdown
        if (question.is_dropdown) {
          return (
            <div>
              <SearchableDropdown
                value={typeof value === "string" ? value : ""}
                onChange={(selectedValue: string) =>
                  handleResponseChange(question.id, selectedValue)
                }
                onBlur={() =>
                  handleBlur(question.id, value, question.question_type)
                }
                options={randomizedOptions}
                placeholder="Select an option..."
                className="w-full"
              />
              {error && (
                <p className="text-red-500 text-sm mt-2 flex items-center">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {error}
                </p>
              )}
            </div>
          );
        }

        // Standard layout for all multiple choice questions
        const columns =
          optionUtils.organizeOptionsIntoColumns(randomizedOptions);

        if (columns.length === 1) {
          // Single column layout - one option below the other
          return (
            <div>
              <div className="space-y-3">
                {columns[0].map((option) => (
                  <label
                    key={option}
                    className="flex items-center px-3 sm:px-4 py-2 sm:py-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option}
                      checked={
                        value === option ||
                        (option === otherOption &&
                          typeof value === "string" &&
                          value.startsWith("Other:"))
                      }
                      onChange={(e) => {
                        if (option === otherOption) {
                          setOtherText("");
                        }
                        handleResponseChange(question.id, option);
                      }}
                      onBlur={() =>
                        handleBlur(question.id, value, question.question_type)
                      }
                      className="w-4 h-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <span className="ml-2 sm:ml-3 text-gray-700 font-medium text-sm sm:text-base">
                      {option}
                    </span>
                  </label>
                ))}
              </div>
              {/* Show text input if 'Other' is selected */}
              {otherOption && isOtherSelected && (
                <div className="mt-4">
                  <input
                    type="text"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-black border-gray-300 focus:ring-indigo-500"
                    placeholder="Please specify..."
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                  />
                </div>
              )}
              {error && (
                <p className="text-red-500 text-sm mt-2 flex items-center">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {error}
                </p>
              )}
            </div>
          );
        } else {
          // Multi-column layout
          return (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {columns.map((column, colIndex) => (
                  <div key={colIndex} className="space-y-2 sm:space-y-3">
                    {column.map((option) => (
                      <label
                        key={option}
                        className="flex items-center p-2 sm:p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={option}
                          checked={
                            value === option ||
                            (option === otherOption &&
                              typeof value === "string" &&
                              value.startsWith("Other:"))
                          }
                          onChange={(e) => {
                            if (option === otherOption) {
                              setOtherText("");
                            }
                            handleResponseChange(question.id, option);
                          }}
                          onBlur={() =>
                            handleBlur(
                              question.id,
                              value,
                              question.question_type
                            )
                          }
                          className="w-4 h-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <span className="ml-3 text-gray-700 font-medium">
                          {option}
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              {/* Show text input if 'Other' is selected */}
              {otherOption && isOtherSelected && (
                <div className="mt-4">
                  <input
                    type="text"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-black border-gray-300 focus:ring-indigo-500"
                    placeholder="Please specify..."
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                  />
                </div>
              )}
              {error && (
                <p className="text-red-500 text-sm mt-2 flex items-center">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {error}
                </p>
              )}
            </div>
          );
        }
      }

      case "checkbox": {
        const otherOption = question.options?.find((opt) =>
          opt.toLowerCase().includes("other")
        );
        const selectedValues = Array.isArray(value) ? value : [];
        const isOtherChecked = otherOption
          ? selectedValues.includes(otherOption)
          : false;
        const otherText = otherTexts[question.id] || "";
        const setOtherText = (text: string) =>
          setOtherTexts((prev) => ({ ...prev, [question.id]: text }));
        const optionPairs = chunkArray(question.options || [], 2);
        return (
          <div>
            <div className="space-y-3">
              {optionPairs.map((pair, rowIdx) => (
                <div
                  key={rowIdx}
                  className="flex flex-col sm:flex-row gap-2 sm:gap-4"
                >
                  {pair.map((option) => (
                    <label
                      key={option}
                      className="flex items-center flex-1 p-2 sm:p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                    >
                      <input
                        type="checkbox"
                        value={option}
                        checked={selectedValues.includes(option)}
                        onChange={(e) => {
                          let newValues = Array.isArray(value) ? value : [];
                          if (e.target.checked) {
                            newValues = [...newValues, option];
                          } else {
                            newValues = newValues.filter((v) => v !== option);
                          }
                          if (option === otherOption && !e.target.checked) {
                            setOtherText("");
                          }
                          const safeValues: string[] = newValues.map((v) =>
                            typeof v === "object" && v !== null && "other" in v
                              ? `Other: ${(v as any).other}`
                              : v
                          );
                          handleResponseChange(question.id, safeValues);
                        }}
                        onBlur={() =>
                          handleBlur(question.id, value, question.question_type)
                        }
                        className="w-4 h-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="ml-3 text-gray-700 font-medium">
                        {option}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
              {otherOption && isOtherChecked && (
                <div className="ml-8 mt-2">
                  <input
                    type="text"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-black border-gray-300 focus:ring-indigo-500"
                    placeholder="Please specify..."
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                  />
                </div>
              )}
            </div>
            {error && (
              <p className="text-red-500 text-sm mt-2 flex items-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </p>
            )}
          </div>
        );
      }

      case "matrix":
        if (!question.subfields) return null;
        const subfields = question.subfields;
        const lastSubfield = subfields[subfields.length - 1];
        const isAutoSum =
          lastSubfield && lastSubfield.trim().toLowerCase().startsWith("total");
        return (
          <div>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg">
                <thead>{/* No header row */}</thead>
                <tbody>
                  {subfields.map((subfield, idx) => {
                    const isTotal = isAutoSum && idx === subfields.length - 1;
                    if (isTotal) {
                      // Calculate total as sum of all previous subfields
                      const total = subfields.slice(0, -1).reduce((sum, sf) => {
                        const v =
                          value &&
                          typeof value === "object" &&
                          !Array.isArray(value) &&
                          value[sf] !== undefined
                            ? value[sf]
                            : 0;
                        return sum + (typeof v === "number" ? v : 0);
                      }, 0);
                      return (
                        <tr key={subfield}>
                          <td className="px-4 py-2 text-gray-800">
                            {subfield}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              className={inputClasses + " bg-gray-100"}
                              value={total}
                              readOnly
                              tabIndex={-1}
                            />
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={subfield}>
                        <td className="px-4 py-2 text-gray-800">{subfield}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            className={inputClasses}
                            placeholder={`Amount for ${subfield}`}
                            value={
                              value &&
                              typeof value === "object" &&
                              !Array.isArray(value) &&
                              subfield in value &&
                              value[subfield] !== null &&
                              typeof value[subfield] === "number"
                                ? value[subfield].toString()
                                : ""
                            }
                            onChange={(e) => {
                              const numValue =
                                e.target.value === ""
                                  ? null
                                  : parseFloat(e.target.value);
                              const prev =
                                typeof value === "object" &&
                                !Array.isArray(value) &&
                                value
                                  ? value
                                  : {};
                              const filteredPrev: {
                                [sub: string]: number | null;
                              } = Object.fromEntries(
                                Object.entries(prev).filter(
                                  ([, v]) => v !== null && v !== ""
                                )
                              );
                              const next: { [sub: string]: number | null } = {
                                ...filteredPrev,
                                [subfield]: numValue,
                              };
                              // Only recalculate and include the total if isAutoSum
                              if (isAutoSum) {
                                const totalField =
                                  subfields[subfields.length - 1];
                                const total = subfields
                                  .slice(0, -1)
                                  .reduce((sum, sf) => {
                                    const v = next[sf];
                                    return (
                                      sum +
                                      (typeof v === "number" && v !== null
                                        ? v
                                        : 0)
                                    );
                                  }, 0);
                                next[totalField] = total;
                              }
                              handleResponseChange(question.id, next);
                            }}
                            onBlur={(e) => {
                              const numValue =
                                e.target.value === ""
                                  ? null
                                  : parseFloat(e.target.value);
                              const prev =
                                typeof value === "object" &&
                                !Array.isArray(value) &&
                                value
                                  ? value
                                  : {};
                              const filteredPrev: {
                                [sub: string]: number | null;
                              } = Object.fromEntries(
                                Object.entries(prev).filter(
                                  ([, v]) => v !== null && v !== ""
                                )
                              );
                              const next: { [sub: string]: number | null } = {
                                ...filteredPrev,
                                [subfield]: numValue,
                              };
                              if (isAutoSum) {
                                const totalField =
                                  subfields[subfields.length - 1];
                                const total = subfields
                                  .slice(0, -1)
                                  .reduce((sum, sf) => {
                                    const v = next[sf];
                                    return (
                                      sum +
                                      (typeof v === "number" && v !== null
                                        ? v
                                        : 0)
                                    );
                                  }, 0);
                                next[totalField] = total;
                              }
                              handleBlur(
                                question.id,
                                next,
                                question.question_type
                              );
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {error && (
              <p className="text-red-500 text-sm mt-2 flex items-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </p>
            )}
          </div>
        );

      case "cross_matrix": {
        if (!question.rows || !question.columns) return null;
        const rawValue = responses[question.id];
        const matrixValue: { [row: string]: string } =
          rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)
            ? (rawValue as { [row: string]: string })
            : {};
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg">
              <thead>
                <tr>
                  <th className="px-4 py-2"></th>
                  {question.columns?.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2 text-sm font-semibold text-gray-700 text-center whitespace-normal"
                      style={{ minWidth: 120, maxWidth: 140, width: 130 }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {question.rows.map((row) => (
                  <tr key={row}>
                    <td className="px-4 py-2 text-gray-800 font-medium">
                      {row}
                    </td>
                    {question.columns?.map((col) => (
                      <td
                        key={col}
                        className="px-4 py-2 text-center"
                        style={{ minWidth: 120, maxWidth: 140, width: 130 }}
                      >
                        <input
                          type="radio"
                          name={`matrix-radio-${question.id}-${row}`}
                          value={col}
                          checked={matrixValue[row] === col}
                          onChange={() => {
                            const next = { ...matrixValue, [row]: col };
                            handleResponseChange(question.id, next);
                          }}
                          className="w-4 h-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {error && (
              <p className="text-red-500 text-sm mt-2 flex items-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </p>
            )}
          </div>
        );
      }

      case "cross_matrix_checkbox": {
        if (!question.rows || !question.columns) return null;
        const rawValue = responses[question.id];
        // Type guard: only use rawValue if all values are arrays
        const isValidMatrixCheckbox =
          rawValue &&
          typeof rawValue === "object" &&
          !Array.isArray(rawValue) &&
          Object.values(rawValue).every((v) => Array.isArray(v));
        const matrixValue: { [row: string]: string[] } = isValidMatrixCheckbox
          ? (rawValue as unknown as { [row: string]: string[] })
          : {};
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg">
              <thead>
                <tr>
                  <th className="px-4 py-2"></th>
                  {question.columns?.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2 text-sm font-semibold text-gray-700 text-center whitespace-normal"
                      style={{ minWidth: 120, maxWidth: 140, width: 130 }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {question.rows.map((row) => (
                  <tr key={row}>
                    <td className="px-4 py-2 text-gray-800 font-medium">
                      {row}
                    </td>
                    {question.columns?.map((col) => (
                      <td
                        key={col}
                        className="px-4 py-2 text-center"
                        style={{ minWidth: 120, maxWidth: 140, width: 130 }}
                      >
                        <input
                          type="checkbox"
                          name={`matrix-checkbox-${question.id}-${row}`}
                          value={col}
                          checked={
                            Array.isArray(matrixValue[row]) &&
                            matrixValue[row].includes(col)
                          }
                          onChange={(e) => {
                            const prevRow = Array.isArray(matrixValue[row])
                              ? matrixValue[row]
                              : [];
                            let nextRow: string[];
                            if (e.target.checked) {
                              nextRow = [...prevRow, col];
                            } else {
                              nextRow = prevRow.filter((v) => v !== col);
                            }
                            const next = { ...matrixValue, [row]: nextRow };
                            // Ensure all rows are present as arrays
                            question.rows?.forEach((r) => {
                              if (!Array.isArray(next[r])) next[r] = [];
                            });
                            handleResponseChange(
                              question.id,
                              next as unknown as { [row: string]: string[] }
                            );
                          }}
                          className="w-4 h-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {error && (
              <p className="text-red-500 text-sm mt-2 flex items-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </p>
            )}
          </div>
        );
      }

      default:
        return <p className="text-gray-500">Unsupported question type</p>;
    }
  };

  // Group questions by section_title, but put questions with null/empty/'Other' in their own section
  const getSections = (questions: Question[]) => {
    // Sort questions by their 'order' field first
    const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);
    const sectionMap: { [section: string]: Question[] } = {};
    const sections: { title: string; questions: Question[] }[] = [];
    // Instead of grouping all 'Other' first, build sections in the order of sortedQuestions
    sortedQuestions.forEach((q) => {
      const rawSection = q.section_title;
      const section =
        rawSection && rawSection.trim() && rawSection.toLowerCase() !== "other"
          ? rawSection
          : null;
      if (!section) {
        // Each question with no/empty/Other section_title gets its own section
        sections.push({ title: "Other", questions: [q] });
      } else {
        // If this is the first question in this section, create a new section in order
        const lastSection =
          sections.length > 0 ? sections[sections.length - 1] : null;
        if (!lastSection || lastSection.title !== section) {
          sections.push({ title: section, questions: [q] });
        } else {
          lastSection.questions.push(q);
        }
      }
    });
    return sections;
  };

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  let sections: { title: string; questions: Question[] }[] = [];
  if (survey) {
    sections = getSections(survey.questions);
  }

  // Build a flat, ordered array of all questions as they will be displayed
  const orderedQuestions: Question[] = sections.flatMap(
    (section) => section.questions
  );

  const handleNextSection = () => {
    if (currentSectionIndex < sections.length - 1) {
      // Save current progress to cookies before moving to next section
      const progressData: CookieData = {
        responses,
        currentSectionIndex: currentSectionIndex + 1, // Save the next section index
        otherTexts,
        timestamp: Date.now(),
      };
      cookieUtils.saveSurveyProgress(surveyId, progressData);
      console.log("Saved survey progress to cookies:", progressData);
      displaySaveNotification();

      setCurrentSectionIndex((prev) => prev + 1);
    }
  };

  const handlePreviousSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex((prev) => prev - 1);
    }
  };

  const handleSectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate all questions in the current section
    const errors: ValidationErrors = {};
    let hasErrors = false;
    const currentSection = sections[currentSectionIndex];
    currentSection.questions.forEach((question) => {
      const value = responses[question.id];
      const error = validateQuestion(
        question.id,
        value,
        question.question_type
      );
      if (error) {
        errors[question.id] = error;
        hasErrors = true;
      }
    });
    if (hasErrors) {
      setValidationErrors(errors);
      return;
    }
    // If last section, submit survey
    if (currentSectionIndex === sections.length - 1) {
      handleSubmit();
    } else {
      handleNextSection();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mx-auto mb-6"></div>
          <p className="text-gray-600 text-lg font-medium">Loading survey...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="bg-white border border-red-200 rounded-xl p-8 max-w-md shadow-lg">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Survey not found.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-12 max-w-md text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Thank You!</h2>
          <p className="text-gray-600 mb-6">
            Your survey response has been submitted successfully.
          </p>
          <p className="text-gray-500 text-sm">
            You can now close this browser window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, #eef2ff 0%, #ffffff 50%, #faf5ff 100%)",
      }}
    >
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo on the left */}
            <Logo size="md" tafSrc={survey?.logo_url} />

            {/* Survey info on the right */}
            <div className="text-right">
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Survey Concierge
              </h1>
              <p className="text-gray-500 text-xs sm:text-sm">
                Professional Survey Platform
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Top-Right Save Notification */}
      {showSaveNotification && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center animate-fade-in">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium">Progress saved!</span>
        </div>
      )}

      <div
        className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8"
        style={{ paddingBottom: "200px" }}
      >
        <div className="max-w-4xl lg:max-w-6xl mx-auto">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8">
            {/* Survey Header with Logo */}
            <div className="mb-8">
              <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
                  {survey.title}
                </h1>
                <p className="text-gray-600 text-base sm:text-lg">
                  {survey.description}
                </p>
              </div>

              {/* Resume Progress Notification */}
              {isRestoringProgress && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center">
                    <svg
                      className="w-5 h-5 text-blue-600 mr-2"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-blue-800 text-sm font-medium">
                      Welcome back! Your previous progress has been restored.
                    </span>
                  </div>
                  <button
                    onClick={handleClearProgress}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors duration-200"
                  >
                    Start Over
                  </button>
                </div>
              )}

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Question {currentSectionIndex + 1} of {sections.length}
                  </span>
                  <span className="text-sm text-gray-500">
                    {Math.round((currentSectionIndex / sections.length) * 100)}%
                    Complete
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        (currentSectionIndex / sections.length) * 100
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Sectioned Questions */}
            {sections.length > 0 && (
              <form onSubmit={handleSectionSubmit}>
                <div className="mb-8">
                  {sections[currentSectionIndex].title.toLowerCase() !==
                    "other" && (
                    <h2 className="text-gray-600 text-base sm:text-lg mb-4 sm:mb-6 font-medium">
                      {sections[currentSectionIndex].title}
                    </h2>
                  )}
                  {sections[currentSectionIndex].questions.map((question) => {
                    // Find the index of this question in the flat, orderedQuestions array for continuous numbering
                    const globalIdx = orderedQuestions.findIndex(
                      (q) => q.id === question.id
                    );
                    return (
                      <div key={question.id} className="mb-6 sm:mb-8 relative">
                        <div className="mb-3 sm:mb-4 flex flex-col items-start">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 leading-relaxed">
                            <span className="text-indigo-600 font-bold">
                              {globalIdx + 1}.
                            </span>{" "}
                            {question.question_text
                              .split("\n")
                              .map((line, idx) => (
                                <React.Fragment key={idx}>
                                  {line}
                                  <br />
                                </React.Fragment>
                              ))}
                          </h3>
                          {question.is_required && (
                            <span className="inline-flex items-center mt-1 px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Required
                            </span>
                          )}
                        </div>
                        {renderQuestion(question)}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={handlePreviousSection}
                    disabled={currentSectionIndex === 0}
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium text-sm sm:text-base"
                  >
                    Previous
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-sm hover:shadow-md text-sm sm:text-base"
                  >
                    {submitting && currentSectionIndex === sections.length - 1
                      ? "Submitting..."
                      : currentSectionIndex === sections.length - 1
                        ? "Submit Survey"
                        : "Save & Next"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
