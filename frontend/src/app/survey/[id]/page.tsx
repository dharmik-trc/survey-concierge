"use client";

import { useState, useEffect, useRef, use, useMemo } from "react";
import {
  apiService,
  Survey as SurveyType,
  Question,
  optionUtils,
  OTHER_OPTION,
  DEFAULT_NONE_OPTION,
} from "../../../lib/api";
import { cookieUtils, CookieData } from "../../../lib";
import React from "react"; // Added missing import for React
import ConciergeLogo from "../../../components/ConciergeLogo";
import SurveyLogo from "../../../components/SurveyLogo";
import SearchableDropdown from "../../../components/SearchableDropdown";

interface SurveyResponse {
  [questionId: string]:
    | string
    | number
    | string[]
    | null
    | { [subfield: string]: number | null }
    | { [row: string]: string }
    | { [row: string]: string[] };
}

interface ValidationErrors {
  [questionId: string | number]: string;
}

// Helper function to parse markdown-like formatting in question text (supports nesting)
const parseQuestionText = (text: string, keyPrefix = ""): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  let keyCounter = 0;

  // Regex to match **bold**, __underline__, or *italic* (ordered by precedence)
  const regex = /\*\*(.+?)\*\*|__(.+?)__|_(.+?)_|\*(.+?)\*/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > currentIndex) {
      parts.push(text.substring(currentIndex, match.index));
    }

    const key = `${keyPrefix}-${keyCounter++}`;

    // Add formatted text with recursive parsing for nested formatting
    if (match[1]) {
      // Bold text (matched **)
      parts.push(
        <strong key={`bold-${key}`} className="font-bold">
          {parseQuestionText(match[1], `${key}-inner`)}
        </strong>
      );
    } else if (match[2]) {
      // Underline text (matched __)
      parts.push(
        <u key={`underline-${key}`} className="underline">
          {parseQuestionText(match[2], `${key}-inner`)}
        </u>
      );
    } else if (match[3] || match[4]) {
      // Italic text (matched _ or *)
      const italicText = match[3] || match[4];
      parts.push(
        <em key={`italic-${key}`} className="italic">
          {parseQuestionText(italicText, `${key}-inner`)}
        </em>
      );
    }

    currentIndex = regex.lastIndex;
  }

  // Add remaining text
  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }

  return parts.length > 0 ? parts : [text];
};

// Validation function for individual subfields
const validateSubfield = (
  fieldName: string,
  value: any,
  type:
    | "positive_number"
    | "negative_number"
    | "all_numbers"
    | "email"
    | "text"
    | "auto_calculate"
): string | null => {
  const stringValue = String(value).trim();

  switch (type) {
    case "positive_number":
      const positiveNum = parseFloat(stringValue);
      if (isNaN(positiveNum) || positiveNum < 0) {
        return `${fieldName} must be 0 or a positive number`;
      }
      break;

    case "negative_number":
      const negativeNum = parseFloat(stringValue);
      if (isNaN(negativeNum) || negativeNum > 0) {
        return `${fieldName} must be 0 or a negative number`;
      }
      break;

    case "all_numbers":
      const anyNum = parseFloat(stringValue);
      if (isNaN(anyNum)) {
        return `${fieldName} must be a valid number`;
      }
      break;

    case "email":
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(stringValue)) {
        return `${fieldName} must be a valid email address`;
      }
      break;

    case "text":
      // Text fields don't need special validation beyond required check
      break;

    case "auto_calculate":
      // Auto-calculated fields shouldn't be validated by user input
      break;

    default:
      break;
  }

  return null;
};

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
  const [sessionId, setSessionId] = useState<string>("");

  // Use ref to prevent duplicate requests
  const hasRequested = useRef(false);

  // Function to get or create processed options for a question
  const getRandomizedOptions = (question: Question): string[] => {
    if (randomizedOptions[question.id]) {
      return randomizedOptions[question.id];
    }

    const { options } = optionUtils.getOptionsWithSpecialHandling(question);
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
    // Get or create session ID from cookies
    const currentSessionId = cookieUtils.getOrCreateSessionId(surveyId);
    setSessionId(currentSessionId);

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
      // Allow 0 as valid for all number questions
      return true;
    }
    // For number fields, empty string should be considered invalid for required fields
    if (questionType === "number" && value === "") {
      return false;
    }
    return value !== undefined && value !== null && value !== "";
  };

  const validateQuestion = (
    questionId: number | string,
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

      case "multiple_choices":
        if (Array.isArray(value)) {
          if (value.length === 0) {
            console.log(
              `Question ${questionId} multiple choice validation failed: no options selected`
            );
            return "Please select at least one option";
          }
        } else if (
          !value ||
          (typeof value === "string" && value.trim() === "")
        ) {
          console.log(
            `Question ${questionId} multiple choice validation failed: empty value`
          );
          return "Please select at least one option";
        }
        break;

      case "radio":
      case "dropdown":
      case "yes_no":
        if (!value || value.trim() === "") {
          console.log(`Question ${questionId} single choice validation failed`);
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

      case "fields":
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

      case "form_fields":
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          // Only require form_fields if the question itself is required
          if (question.is_required) {
            return "Please enter values for all subfields";
          }
          // If not required, allow empty form_fields
          break;
        }

        // If form_fields is empty object, check if any subfields are explicitly required
        if (typeof value === "object" && Object.keys(value).length === 0) {
          if (question.is_required) {
            // Check if any subfields are explicitly required
            let hasRequiredSubfields = false;
            if (question.subfield_validations) {
              for (const subfield of question.subfields || []) {
                const validation = question.subfield_validations[subfield];
                if (validation?.required === true) {
                  hasRequiredSubfields = true;
                  break;
                }
              }
            }
            if (hasRequiredSubfields) {
              return "Please enter values for all subfields";
            }
          }
          // If no required subfields, allow empty form_fields
          break;
        }

        // Validate each subfield based on its validation rules
        if (question.subfields) {
          for (const subfield of question.subfields) {
            const fieldValue = value[subfield];
            const validation = question.subfield_validations?.[subfield];

            // Skip validation for auto-calculated fields
            if (validation?.type === "auto_calculate") {
              continue;
            }

            if (
              validation?.required == true &&
              (fieldValue === undefined ||
                fieldValue === null ||
                fieldValue === "")
            ) {
              return `${subfield} is required`;
            }

            // Skip validation if field is empty and not required
            if (
              fieldValue === undefined ||
              fieldValue === null ||
              fieldValue === ""
            ) {
              continue;
            }

            // Validate based on field type
            const validationType = validation?.type || "all_numbers";
            const error = validateSubfield(
              subfield,
              fieldValue,
              validationType
            );
            if (error) {
              return error;
            }
          }
        }
        break;

      case "cross_matrix":
      case "grid_radio":
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

      case "cross_matrix_checkbox":
      case "grid_multi":
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
    questionId: number | string,
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
    questionId: number | string,
    value: any,
    _questionType: string
  ) => {
    const error = validateQuestion(questionId, value, _questionType);
    setValidationErrors((prev) => ({
      ...prev,
      [questionId]: error || "",
    }));
  };

  const handleNext = async () => {
    if (!survey) return;

    const currentQuestion = survey.questions[currentQuestionIndex];
    const currentValue = responses[currentQuestion.id];

    // Validate current question before proceeding
    const error = validateQuestion(
      currentQuestion.id,
      currentValue,
      currentQuestion.secondary_type || currentQuestion.question_type || "text"
    );

    if (error) {
      setValidationErrors((prev) => ({
        ...prev,
        [currentQuestion.id]: error,
      }));
      return; // Don't proceed if validation fails
    }

    // Save partial response if survey has store_basic_details enabled and question has store_on_next enabled
    if (
      survey.store_basic_details &&
      currentQuestion.store_on_next &&
      currentValue !== null &&
      currentValue !== undefined
    ) {
      try {
        await apiService.savePartialResponse(
          survey.id,
          currentQuestion.id,
          currentValue,
          sessionId
        );
        console.log(
          `Partial response saved for question ${currentQuestion.id}:`,
          currentValue
        );
      } catch (error) {
        console.error("Failed to save partial response:", error);
        // Don't block the user flow if partial save fails
      }
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
        type: question.secondary_type || question.question_type,
        required: question.is_required,
      });

      const error = validateQuestion(
        question.id,
        value,
        question.secondary_type || question.question_type || "text"
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

    setSubmitting(true);
    try {
      // Send the responses to the backend
      // Sanitize form_fields answers: ensure proper data types
      const sanitizedResponses: SurveyResponse = {};
      for (const [qid, ans] of Object.entries(responses)) {
        // Skip comment box responses - they should be handled separately
        if (qid.endsWith("_comment")) {
          continue;
        }
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
          // cross_matrix, grid_radio or form_fields
          const questionType =
            survey?.questions.find((q) => String(q.id) === qid)
              ?.secondary_type ||
            survey?.questions.find((q) => String(q.id) === qid)?.question_type;
          if (
            questionType === "cross_matrix" ||
            questionType === "grid_radio"
          ) {
            sanitizedResponses[qid as string] = ans;
          } else if (questionType === "form_fields") {
            // form_fields
            const sanitized: { [subfield: string]: any } = {};
            let hasValidData = false;
            for (const [sub, val] of Object.entries(ans)) {
              if (
                val !== undefined &&
                val !== null &&
                val !== "" &&
                val !== 0
              ) {
                // For form_fields, preserve the original data type
                if (questionType === "form_fields") {
                  sanitized[sub as string] = val;
                } else {
                  // Legacy: convert to number (backward compatibility for old matrix questions)
                  sanitized[sub as string] =
                    typeof val === "number" ? val : Number(val);
                }
                hasValidData = true;
              }
            }
            // Only add form_fields response if it has valid data
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
          (question?.secondary_type === "cross_matrix_checkbox" ||
            question?.question_type === "cross_matrix_checkbox" ||
            question?.secondary_type === "grid_multi") &&
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
        if (
          (question?.secondary_type === "cross_matrix" ||
            question?.question_type === "cross_matrix" ||
            question?.secondary_type === "grid_radio") &&
          question.rows
        ) {
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

      // Add comment box responses separately
      for (const [qid, comment] of Object.entries(responses)) {
        if (
          qid.endsWith("_comment") &&
          comment &&
          String(comment).trim() !== ""
        ) {
          sanitizedResponses[qid] = comment;
        }
      }

      const result = await apiService.submitSurveyResponse(
        surveyId,
        sanitizedResponses,
        sessionId
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

    const inputClasses = `w-full px-2 sm:px-4 py-2 sm:py-3 border rounded-lg focus:outline-none focus:ring-2 text-black transition-colors duration-200 text-xs sm:text-base ${
      error
        ? "border-red-500 focus:ring-red-500 focus:border-red-500"
        : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
    }`;

    const questionType =
      question.secondary_type || question.question_type || "text";

    switch (questionType) {
      case "text":
      case "paragraph":
        return (
          <div>
            <textarea
              className={inputClasses}
              rows={4}
              placeholder="Enter your answer..."
              value={(value as string) || ""}
              maxLength={99999}
              onChange={(e) =>
                handleResponseChange(question.id, e.target.value)
              }
              onBlur={(e) =>
                handleBlur(question.id, e.target.value, questionType)
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
                handleBlur(question.id, e.target.value, questionType)
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
                const inputValue = e.target.value;
                if (inputValue === "") {
                  handleResponseChange(question.id, "");
                } else {
                  const numValue = parseFloat(inputValue);
                  if (!isNaN(numValue)) {
                    handleResponseChange(question.id, numValue);
                  }
                }
              }}
              onBlur={(e) =>
                handleBlur(question.id, e.target.value, questionType)
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

      case "slider":
        const scaleMin = question.scale_min ?? 0;
        const scaleMax = question.scale_max ?? 10;
        const scaleStep = question.scale_step ?? 1;
        const scaleMinLabel = question.scale_min_label || "";
        const scaleMaxLabel = question.scale_max_label || "";
        const currentValue = typeof value === "number" ? value : scaleMin;

        return (
          <div className="space-y-4">
            <div className="px-2">
              <input
                type="range"
                min={scaleMin}
                max={scaleMax}
                step={scaleStep}
                value={currentValue}
                onChange={(e) =>
                  handleResponseChange(question.id, parseInt(e.target.value))
                }
                onBlur={() =>
                  handleBlur(question.id, currentValue, questionType)
                }
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
                style={{
                  background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${
                    ((currentValue - scaleMin) / (scaleMax - scaleMin)) * 100
                  }%, #e5e7eb ${
                    ((currentValue - scaleMin) / (scaleMax - scaleMin)) * 100
                  }%, #e5e7eb 100%)`,
                }}
              />
              <style jsx>{`
                .slider-thumb {
                  outline: none !important;
                  border: none !important;
                }
                .slider-thumb:focus {
                  outline: none !important;
                  border: none !important;
                  box-shadow: none !important;
                }
                .slider-thumb::-webkit-slider-thumb {
                  appearance: none;
                  width: 24px;
                  height: 24px;
                  border-radius: 50%;
                  background: #6366f1;
                  cursor: pointer;
                  border: 3px solid white;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                }
                .slider-thumb::-webkit-slider-thumb:focus {
                  outline: none;
                }
                .slider-thumb::-moz-range-thumb {
                  width: 24px;
                  height: 24px;
                  border-radius: 50%;
                  background: #6366f1;
                  cursor: pointer;
                  border: 3px solid white;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                }
                .slider-thumb::-moz-range-thumb:focus {
                  outline: none;
                }
              `}</style>
            </div>

            <div className="flex justify-between items-center px-2">
              <div className="flex flex-col items-start">
                <span className="text-2xl font-bold text-indigo-600">
                  {currentValue}
                </span>
                {scaleMinLabel && (
                  <span className="text-xs text-gray-500 mt-1">
                    {scaleMinLabel}
                  </span>
                )}
              </div>
              {scaleMaxLabel && (
                <span className="text-xs text-gray-500 text-right max-w-[150px]">
                  {scaleMaxLabel}
                </span>
              )}
            </div>

            <div className="flex justify-between text-xs text-gray-400 px-2">
              <span>{scaleMin}</span>
              <span>{scaleMax}</span>
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

      case "date":
        return (
          <div>
            <input
              type="date"
              className={inputClasses}
              value={(value as string) || ""}
              onChange={(e) =>
                handleResponseChange(question.id, e.target.value)
              }
              onBlur={(e) =>
                handleBlur(question.id, e.target.value, questionType)
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

      case "time":
        return (
          <div>
            <input
              type="time"
              className={inputClasses}
              value={(value as string) || ""}
              onChange={(e) =>
                handleResponseChange(question.id, e.target.value)
              }
              onBlur={(e) =>
                handleBlur(question.id, e.target.value, questionType)
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

      case "multiple_choices": {
        // Get processed options with special handling
        const randomizedOptions = getRandomizedOptions(question);
        const { hasOtherOption, hasNoneOption } =
          optionUtils.getOptionsWithSpecialHandling(question);

        const otherOption = OTHER_OPTION;
        const noneOption = question.none_option_text || DEFAULT_NONE_OPTION;
        const exclusiveOption = question.exclusive_column;
        const selectedValues = Array.isArray(value) ? value : [];
        const isOtherSelected =
          selectedValues.includes(otherOption) ||
          selectedValues.some(
            (v) => typeof v === "string" && v.startsWith("Other:")
          );
        const isNoneSelected = selectedValues.includes(noneOption);
        const isExclusiveSelected = exclusiveOption
          ? selectedValues.includes(exclusiveOption)
          : false;
        const otherText = otherTexts[question.id] || "";
        const setOtherText = (text: string) =>
          setOtherTexts((prev) => ({ ...prev, [question.id]: text }));

        // Handle checkbox selection with mutual exclusion logic
        const handleCheckboxChange = (
          selectedOption: string,
          isChecked: boolean
        ) => {
          let newValues = [...selectedValues];

          // Check if this is "None of the above" - always exclusive
          const isNoneOfTheAbove = selectedOption === noneOption;
          // Check if this is a custom exclusive option
          const isCustomExclusive =
            exclusiveOption && selectedOption === exclusiveOption;
          const isExclusiveOption = isNoneOfTheAbove || isCustomExclusive;

          if (isExclusiveOption) {
            // If any exclusive option is checked, clear all other selections
            if (isChecked) {
              newValues = [selectedOption];
              setOtherText("");
            } else {
              newValues = [];
            }
          } else {
            // If any non-exclusive option is selected, remove "None of the above" and custom exclusive options
            if (isNoneSelected) {
              newValues = newValues.filter((v) => v !== noneOption);
            }
            if (isExclusiveSelected && exclusiveOption) {
              newValues = newValues.filter((v) => v !== exclusiveOption);
            }

            if (isChecked) {
              // Add the option if it's not already there
              if (!newValues.includes(selectedOption)) {
                newValues.push(selectedOption);
              }
            } else {
              // Remove the option
              if (selectedOption === otherOption) {
                // Remove both raw 'Other' and any 'Other: ...' value
                newValues = newValues.filter(
                  (v) =>
                    v !== otherOption &&
                    !(typeof v === "string" && v.startsWith("Other:"))
                );
                setOtherText("");
              } else {
                newValues = newValues.filter((v) => v !== selectedOption);
              }
            }
          }

          handleResponseChange(question.id, newValues);
        };

        // Standard layout for multiple choice questions (checkboxes)
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
                      type="checkbox"
                      name={`question-${question.id}`}
                      value={option}
                      checked={
                        selectedValues.includes(option) ||
                        (option === otherOption &&
                          selectedValues.some(
                            (v) =>
                              typeof v === "string" && v.startsWith("Other:")
                          ))
                      }
                      onChange={(e) =>
                        handleCheckboxChange(option, e.target.checked)
                      }
                      onBlur={() =>
                        handleBlur(question.id, selectedValues, questionType)
                      }
                      className="w-4 h-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 sm:ml-3 text-gray-700 font-medium text-xs sm:text-base">
                      {option}
                    </span>
                  </label>
                ))}
              </div>
              {/* Show text input if 'Other' is selected */}
              {hasOtherOption && isOtherSelected && (
                <div className="mt-4">
                  <input
                    type="text"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-black border-gray-300 focus:ring-indigo-500"
                    placeholder="Please specify..."
                    value={otherText}
                    maxLength={99999}
                    onChange={(e) => setOtherText(e.target.value)}
                    onBlur={() => {
                      if (otherText.trim()) {
                        // Update the array to replace "Other (please specify)" with "Other: [text]"
                        const newValues = selectedValues.filter(
                          (v) => v !== otherOption
                        );
                        newValues.push(`Other: ${otherText.trim()}`);
                        handleResponseChange(question.id, newValues);
                      }
                    }}
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
          // Two column layout
          return (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {columns.map((column, colIndex) => (
                  <div key={colIndex} className="space-y-2 sm:space-y-3">
                    {column.map((option) => (
                      <label
                        key={option}
                        className="flex items-center px-3 sm:px-4 py-2 sm:py-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                      >
                        <input
                          type="checkbox"
                          name={`question-${question.id}`}
                          value={option}
                          checked={
                            selectedValues.includes(option) ||
                            (option === otherOption &&
                              selectedValues.some(
                                (v) =>
                                  typeof v === "string" &&
                                  v.startsWith("Other:")
                              ))
                          }
                          onChange={(e) =>
                            handleCheckboxChange(option, e.target.checked)
                          }
                          onBlur={() =>
                            handleBlur(
                              question.id,
                              selectedValues,
                              questionType
                            )
                          }
                          className="w-4 h-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 sm:ml-3 text-gray-700 font-medium text-xs sm:text-base">
                          {option}
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              {/* Show text input if 'Other' is selected */}
              {hasOtherOption && isOtherSelected && (
                <div className="mt-4">
                  <input
                    type="text"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-black border-gray-300 focus:ring-indigo-500"
                    placeholder="Please specify..."
                    value={otherText}
                    maxLength={99999}
                    onChange={(e) => setOtherText(e.target.value)}
                    onBlur={() => {
                      if (otherText.trim()) {
                        // Update the array to replace "Other (please specify)" with "Other: [text]"
                        const newValues = selectedValues.filter(
                          (v) => v !== otherOption
                        );
                        newValues.push(`Other: ${otherText.trim()}`);
                        handleResponseChange(question.id, newValues);
                      }
                    }}
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

      case "radio":
      case "dropdown":
      case "yes_no": {
        // Get processed options with special handling
        const randomizedOptions = getRandomizedOptions(question);
        const { hasOtherOption, hasNoneOption } =
          optionUtils.getOptionsWithSpecialHandling(question);

        const otherOption = OTHER_OPTION;
        const noneOption = question.none_option_text || DEFAULT_NONE_OPTION;
        const exclusiveOption = question.exclusive_column;
        const isOtherSelected =
          value === otherOption ||
          (typeof value === "string" && value.startsWith("Other:"));
        const isNoneSelected = value === noneOption;
        const otherText = otherTexts[question.id] || "";
        const setOtherText = (text: string) =>
          setOtherTexts((prev) => ({ ...prev, [question.id]: text }));

        // Handle option selection with mutual exclusion logic
        const handleOptionChange = (selectedOption: string) => {
          // Check if this is an exclusive option (custom exclusive only)
          // NOTA is only exclusive if it's specifically set as the exclusive column
          // Other option is NOT exclusive - it can be selected with other options
          const isExclusiveOption =
            exclusiveOption && selectedOption === exclusiveOption;

          if (isExclusiveOption) {
            // If any exclusive option is selected, clear other text
            handleResponseChange(question.id, selectedOption);
            setOtherText("");
          } else {
            // If any non-exclusive option is selected, clear "Other" text
            handleResponseChange(question.id, selectedOption);
            setOtherText("");
          }
        };

        // Use searchable dropdown if question type is dropdown
        if (questionType === "dropdown") {
          return (
            <div>
              <SearchableDropdown
                value={typeof value === "string" ? value : ""}
                onChange={(selectedValue: string) =>
                  handleOptionChange(selectedValue)
                }
                onBlur={() => handleBlur(question.id, value, questionType)}
                options={randomizedOptions}
                placeholder="Start typing..."
                className="w-full"
              />
              {/* Show text input if 'Other' is selected */}
              {hasOtherOption && isOtherSelected && (
                <div className="mt-4">
                  <input
                    type="text"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-black border-gray-300 focus:ring-indigo-500"
                    placeholder="Please specify..."
                    value={otherText}
                    maxLength={99999}
                    onChange={(e) => setOtherText(e.target.value)}
                    onBlur={() => {
                      if (otherText.trim()) {
                        handleResponseChange(
                          question.id,
                          `Other: ${otherText.trim()}`
                        );
                      }
                    }}
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
                      onChange={(e) => handleOptionChange(option)}
                      onBlur={() =>
                        handleBlur(question.id, value, questionType)
                      }
                      className="w-4 h-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <span className="ml-2 sm:ml-3 text-gray-700 font-medium text-xs sm:text-base">
                      {option}
                    </span>
                  </label>
                ))}
              </div>
              {/* Show text input if 'Other' is selected */}
              {hasOtherOption && isOtherSelected && (
                <div className="mt-4">
                  <input
                    type="text"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-black border-gray-300 focus:ring-indigo-500"
                    placeholder="Please specify..."
                    value={otherText}
                    maxLength={99999}
                    onChange={(e) => setOtherText(e.target.value)}
                    onBlur={() => {
                      if (otherText.trim()) {
                        handleResponseChange(
                          question.id,
                          `Other: ${otherText.trim()}`
                        );
                      }
                    }}
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
                          onChange={(e) => handleOptionChange(option)}
                          onBlur={() =>
                            handleBlur(
                              question.id,
                              value,
                              question.secondary_type ||
                                question.question_type ||
                                "text"
                            )
                          }
                          className="w-4 h-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <span className="ml-3 text-gray-700 font-medium text-xs sm:text-base">
                          {option}
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              {/* Show text input if 'Other' is selected */}
              {hasOtherOption && isOtherSelected && (
                <div className="mt-4">
                  <input
                    type="text"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-black border-gray-300 focus:ring-indigo-500"
                    placeholder="Please specify..."
                    value={otherText}
                    maxLength={99999}
                    onChange={(e) => setOtherText(e.target.value)}
                    onBlur={() => {
                      if (otherText.trim()) {
                        handleResponseChange(
                          question.id,
                          `Other: ${otherText.trim()}`
                        );
                      }
                    }}
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

      case "fields": {
        // Get processed options with special handling (includes Other and None if enabled)
        const randomizedOptions = getRandomizedOptions(question);
        const { hasOtherOption, hasNoneOption } =
          optionUtils.getOptionsWithSpecialHandling(question);

        const otherOption = OTHER_OPTION;
        const noneOption = question.none_option_text || DEFAULT_NONE_OPTION;
        const selectedValues = Array.isArray(value) ? value : [];
        const isOtherChecked =
          selectedValues.includes(otherOption) ||
          selectedValues.some(
            (v) => typeof v === "string" && v.startsWith("Other:")
          );
        const otherText = otherTexts[question.id] || "";
        const setOtherText = (text: string) =>
          setOtherTexts((prev) => ({ ...prev, [question.id]: text }));
        const optionPairs = chunkArray(randomizedOptions, 2);
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

                          // Check if this is "None of the above" option
                          const isNoneOfTheAbove = option === noneOption;
                          console.log("isNoneOfTheAbove", isNoneOfTheAbove);

                          if (e.target.checked) {
                            if (isNoneOfTheAbove) {
                              // If "None of the above" is selected, clear all other options
                              newValues = [option];
                              setOtherText("");
                            } else {
                              // If any other option is selected, remove "None of the above"
                              newValues = [
                                ...newValues.filter((v) => v !== noneOption),
                                option,
                              ];
                            }
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
                          handleBlur(question.id, value, questionType)
                        }
                        className="w-4 h-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="ml-3 text-gray-700 font-medium text-xs sm:text-base">
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
                    maxLength={99999}
                    onChange={(e) => setOtherText(e.target.value)}
                    onBlur={() => {
                      if (otherText.trim()) {
                        handleResponseChange(
                          question.id,
                          `Other: ${otherText.trim()}`
                        );
                      }
                    }}
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

      case "form_fields":
        if (!question.subfields) return null;
        const subfields = question.subfields;
        // Check for auto-calculated fields using validation rules
        const hasAutoCalculate = subfields.some(
          (sf) => question.subfield_validations?.[sf]?.type === "auto_calculate"
        );
        return (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 rounded-lg">
                <thead>{/* No header row */}</thead>
                <tbody>
                  {subfields.map((subfield, idx) => {
                    const validation =
                      question.subfield_validations?.[subfield];
                    const isAutoCalculated =
                      validation?.type === "auto_calculate";

                    if (isAutoCalculated) {
                      // Calculate based on formula or default sum
                      const formula = validation?.formula || "sum_all_previous";
                      let calculatedValue = 0;

                      if (formula === "sum_all_previous") {
                        calculatedValue = subfields
                          .slice(0, idx)
                          .reduce((sum, sf) => {
                            const v =
                              value &&
                              typeof value === "object" &&
                              !Array.isArray(value) &&
                              value[sf] !== undefined
                                ? value[sf]
                                : 0;
                            return sum + (typeof v === "number" ? v : 0);
                          }, 0);
                      }

                      return (
                        <tr key={subfield}>
                          <td className="px-2 sm:px-4 py-2 text-gray-800 text-xs sm:text-base font-medium w-1/2">
                            {subfield}
                          </td>
                          <td className="px-2 sm:px-4 py-2 w-1/2">
                            <input
                              type="number"
                              className={inputClasses + " bg-gray-100"}
                              value={calculatedValue}
                              readOnly
                              tabIndex={-1}
                            />
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={subfield}>
                        <td className="px-2 sm:px-4 py-2 text-gray-800 text-xs sm:text-base font-medium w-1/2">
                          {subfield}
                        </td>
                        <td className="px-2 sm:px-4 py-2 w-1/2">
                          <input
                            type={
                              validation?.type === "email"
                                ? "email"
                                : validation?.type?.includes("number")
                                ? "number"
                                : "text"
                            }
                            className={inputClasses}
                            placeholder={
                              validation?.type === "email"
                                ? `Enter email for ${subfield}`
                                : validation?.type?.includes("number")
                                ? `Enter Response`
                                : `Enter ${subfield}`
                            }
                            value={
                              value &&
                              typeof value === "object" &&
                              !Array.isArray(value) &&
                              subfield in value &&
                              value[subfield] !== null
                                ? String(value[subfield])
                                : ""
                            }
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              let processedValue: any;

                              if (inputValue === "") {
                                processedValue = null;
                              } else if (validation?.type?.includes("number")) {
                                processedValue = parseFloat(inputValue);
                                if (isNaN(processedValue))
                                  processedValue = null;
                              } else {
                                processedValue = inputValue;
                              }

                              const prev =
                                typeof value === "object" &&
                                !Array.isArray(value) &&
                                value
                                  ? value
                                  : {};
                              const filteredPrev: { [sub: string]: any } =
                                Object.fromEntries(
                                  Object.entries(prev).filter(
                                    ([, v]) => v !== null && v !== ""
                                  )
                                );
                              const next: { [sub: string]: any } = {
                                ...filteredPrev,
                                [subfield]: processedValue,
                              };
                              // Only recalculate and include the total if hasAutoCalculate
                              if (hasAutoCalculate) {
                                const totalField = subfields.find(
                                  (sf) =>
                                    question.subfield_validations?.[sf]
                                      ?.type === "auto_calculate"
                                );
                                if (totalField) {
                                  const totalFieldIndex =
                                    subfields.indexOf(totalField);
                                  const total = subfields
                                    .slice(0, totalFieldIndex)
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
                              if (hasAutoCalculate) {
                                const totalField = subfields.find(
                                  (sf) =>
                                    question.subfield_validations?.[sf]
                                      ?.type === "auto_calculate"
                                );
                                if (totalField) {
                                  const totalFieldIndex =
                                    subfields.indexOf(totalField);
                                  const total = subfields
                                    .slice(0, totalFieldIndex)
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
                              }
                              handleBlur(
                                question.id,
                                next,
                                question.secondary_type ||
                                  question.question_type ||
                                  "text"
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

      case "cross_matrix":
      case "grid_radio": {
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
                      className="px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700 text-center whitespace-normal"
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
                    <td className="px-2 sm:px-4 py-2 text-gray-800 text-xs sm:text-sm font-medium">
                      {row}
                    </td>
                    {question.columns?.map((col) => (
                      <td
                        key={col}
                        className="px-2 sm:px-4 py-2 text-center"
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

      case "cross_matrix_checkbox":
      case "grid_multi":
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

  const handleNextSection = async () => {
    console.log("handleNextSection", sessionId);
    console.log("survey", survey);

    console.log("currentSectionIndex", currentSectionIndex);
    console.log("sections", sections);
    console.log("sections.length", sections.length);

    if (currentSectionIndex < sections.length - 1) {
      console.log(
        "currentSectionIndex < sections.length - 1",
        currentSectionIndex < sections.length - 1
      );
      console.log("survey?.store_basic_details", survey?.store_basic_details);
      // Save partial responses for questions in current section that have store_on_next enabled
      if (survey?.store_basic_details) {
        console.log("survey.store_basic_details", survey.store_basic_details);
        const currentSection = sections[currentSectionIndex];
        for (const question of currentSection.questions) {
          if (
            question.store_on_next &&
            responses[question.id] !== null &&
            responses[question.id] !== undefined
          ) {
            try {
              console.log("question", question);
              console.log("responses[question.id]", responses[question.id]);
              console.log("sessionId", sessionId);
              await apiService.savePartialResponse(
                survey.id,
                question.id,
                responses[question.id],
                sessionId
              );
              console.log(
                `Partial response saved for question ${question.id}:`,
                responses[question.id]
              );
            } catch (error) {
              console.error("Failed to save partial response:", error);
              // Don't block the user flow if partial save fails
            }
          }
        }
      }

      // Save current progress to cookies before moving to next section
      const progressData: CookieData = {
        responses,
        currentSectionIndex: currentSectionIndex + 1, // Save the next section index
        otherTexts,
        timestamp: Date.now(),
        sessionId: sessionId, // Include session ID for partial response tracking
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
        question.secondary_type || question.question_type || "text"
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
          <p className="text-gray-600 text-sm sm:text-lg font-medium">
            Loading survey...
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
      className="min-h-screen flex flex-col"
      style={{
        background:
          "linear-gradient(135deg, #eef2ff 0%, #ffffff 50%, #faf5ff 100%)",
      }}
    >
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100 flex-shrink-0">
        <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-1 sm:py-1">
          <div className="flex items-center justify-between">
            {/* Survey Company Logo on the left */}
            <div className="flex-shrink-0">
              <SurveyLogo size="md" logoSrc={survey?.logo_url} />
            </div>

            {/* TSC Concierge Logo on the right */}
            <div className="flex-shrink-0 ml-auto">
              <ConciergeLogo size="md" />
            </div>
          </div>
        </div>
      </header>

      {/* Bottom-Right Save Notification */}
      {showSaveNotification && (
        <div className="fixed bottom-4 right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center animate-fade-in">
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

      <div className="flex-1 flex items-start justify-center px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="w-full max-w-4xl lg:max-w-6xl">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8">
            {/* Survey Header with Logo */}
            <div className="mb-8">
              {/* Show title and description only on first question */}
              {currentSectionIndex === 0 && (
                <div className="mb-6">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-3">
                    {survey.title}
                  </h1>
                  <p className="text-gray-600 text-sm sm:text-base whitespace-pre-line">
                    {survey.description}
                  </p>
                </div>
              )}

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
                    <span className="text-blue-800 text-xs sm:text-base font-medium">
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
                <div className="flex items-center justify-end mb-2">
                  {/* <span className="text-xs sm:text-base font-medium text-gray-700">
                    Question {currentSectionIndex + 1} of {sections.length}
                  </span> */}
                  <span className="text-xs sm:text-base text-gray-500">
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
                    <h2 className="text-gray-600 text-xs sm:text-base mb-4 sm:mb-6 font-medium">
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
                          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 leading-relaxed">
                            <span className="text-gray-900 font-bold">
                              {globalIdx + 1}.
                            </span>{" "}
                            {question.question_text
                              .split("\n")
                              .map((line, idx) => (
                                <React.Fragment key={idx}>
                                  {parseQuestionText(line)}
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

                        {/* Comment Box - separate from Other option */}
                        {question.has_comment_box && (
                          <div className="mt-4">
                            {question.comment_box_label && (
                              <label className="block text-xs sm:text-base font-medium text-gray-700 mb-2">
                                {question.comment_box_label}
                              </label>
                            )}
                            <textarea
                              className="w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:outline-none focus:ring-2 text-black transition-colors duration-200 text-xs sm:text-base border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                              rows={question.comment_box_rows || 3}
                              placeholder="Enter your comments..."
                              value={
                                (responses[
                                  `${question.id}_comment`
                                ] as string) || ""
                              }
                              maxLength={99999}
                              onChange={(e) =>
                                handleResponseChange(
                                  `${question.id}_comment`,
                                  e.target.value
                                )
                              }
                              onBlur={(e) =>
                                handleBlur(
                                  `${question.id}_comment`,
                                  e.target.value,
                                  "text"
                                )
                              }
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={handlePreviousSection}
                    disabled={currentSectionIndex === 0}
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium text-xs sm:text-sm"
                  >
                    Previous
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-sm hover:shadow-md text-xs sm:text-sm"
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
