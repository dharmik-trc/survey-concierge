import type { Question } from "@/lib/api";

export interface ValidationErrors {
  [questionId: string | number]: string;
}

// Validation function for individual subfields
export const validateSubfield = (
  fieldName: string,
  value: any,
  type: "positive_number" | "negative_number" | "all_numbers" | "email" | "text" | "auto_calculate"
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
    case "auto_calculate":
      // Text fields and auto-calculated fields don't need special validation beyond required check
      break;

    default:
      break;
  }

  return null;
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateNumber = (value: string | number): boolean => {
  if (typeof value === "number") {
    // Allow any number including 0 and negative numbers
    return !isNaN(value) && isFinite(value);
  }
  if (typeof value === "string") {
    return !isNaN(Number(value)) && value.trim() !== "";
  }
  return false;
};

export const validateRequired = (value: any, questionType: string): boolean => {
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

export const validateQuestion = (
  question: Question,
  value: any,
  otherTexts: { [questionId: string]: string }
): string | null => {
  const questionType = question.secondary_type || question.question_type || "text";

  // Check if required
  if (question.is_required && !validateRequired(value, questionType)) {
    return "This field is required";
  }

  // If not required and empty, it's valid
  if (!question.is_required && !validateRequired(value, questionType)) {
    return null;
  }

  // Type-specific validation
  switch (questionType) {
    case "email":
      if (!validateEmail(value as string)) {
        return "Please enter a valid email address";
      }
      break;

    case "number":
      if (!validateNumber(value)) {
        return "Please enter a valid number";
      }
      break;

    case "positive_number":
      if (!validateNumber(value)) {
        return "Please enter a valid number";
      }
      // Additional validation for positive numbers (including 0)
      if (typeof value === "number" && value < 0) {
        return "Please enter a positive number or zero";
      }
      break;

    case "negative_number":
      if (!validateNumber(value)) {
        return "Please enter a valid number";
      }
      // Additional validation for negative numbers (including 0)
      if (typeof value === "number" && value > 0) {
        return "Please enter a negative number or zero";
      }
      break;

    case "multiple_choices":
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return "Please select at least one option";
        }
      } else if (!value || (typeof value === "string" && value.trim() === "")) {
        return "Please select at least one option";
      }
      break;

    case "radio":
    case "dropdown":
    case "yes_no":
      if (!value || value.trim() === "") {
        return "Please select an option";
      }
      // Check if "Other" option is selected but no specification is provided
      const otherOption = question.options?.find(opt => opt.toLowerCase().includes("other"));
      if (value === otherOption && otherOption) {
        const otherText = otherTexts[question.id] || "";
        if (!otherText || otherText.trim() === "") {
          return "Please specify your other option";
        }
      }
      break;

    case "fields":
      if (!Array.isArray(value) || value.length === 0) {
        return "Please select at least one option";
      }
      // Check if "Other" option is selected but no specification is provided
      const checkboxOtherOption = question.options?.find(opt =>
        opt.toLowerCase().includes("other")
      );
      if (checkboxOtherOption && Array.isArray(value) && value.includes(checkboxOtherOption)) {
        const otherText = otherTexts[question.id] || "";
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
            (fieldValue === undefined || fieldValue === null || fieldValue === "")
          ) {
            return `${subfield} is required`;
          }

          // Skip validation if field is empty and not required
          if (fieldValue === undefined || fieldValue === null || fieldValue === "") {
            continue;
          }

          // Validate based on field type
          const validationType = validation?.type || "all_numbers";
          const error = validateSubfield(subfield, fieldValue, validationType);
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

  return null;
};
