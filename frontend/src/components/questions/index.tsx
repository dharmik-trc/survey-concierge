import type { Question } from "@/lib/api";
import { optionUtils } from "@/lib/api";
import { QuestionText } from "./QuestionText";
import { QuestionEmail } from "./QuestionEmail";
import { QuestionNumber } from "./QuestionNumber";
import { QuestionSlider } from "./QuestionSlider";
import { QuestionDate } from "./QuestionDate";
import { QuestionTime } from "./QuestionTime";
import { QuestionMultipleChoice } from "./QuestionMultipleChoice";
import { QuestionRadio } from "./QuestionRadio";
import { QuestionFields } from "./QuestionFields";
import { QuestionFormFields } from "./QuestionFormFields";
import { QuestionGridRadio } from "./QuestionGridRadio";
import { QuestionGridMulti } from "./QuestionGridMulti";

interface QuestionRendererProps {
  question: Question;
  value: any;
  error?: string;
  surveyId: string;
  randomizedOptions: string[];
  otherText: string;
  onChange: (questionId: number | string, value: any) => void;
  onBlur: (questionId: number | string, value: any, questionType: string) => void;
  onOtherTextChange: (questionId: number | string, text: string) => void;
  getRandomizedOptions: (question: Question) => string[];
}

export const QuestionRenderer = ({
  question,
  value,
  error,
  surveyId,
  randomizedOptions,
  otherText,
  onChange,
  onBlur,
  onOtherTextChange,
  getRandomizedOptions,
}: QuestionRendererProps) => {
  const questionType = question.secondary_type || question.question_type || "text";

  const handleChange = (newValue: any) => {
    onChange(question.id, newValue);
  };

  const handleBlur = () => {
    onBlur(question.id, value, questionType);
  };

  const handleOtherTextChange = (text: string) => {
    onOtherTextChange(question.id, text);
  };

  switch (questionType) {
    case "text":
      return (
        <QuestionText
          question={question}
          value={value as string}
          error={error}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      );

    case "paragraph":
      return (
        <QuestionText
          question={question}
          value={value as string}
          error={error}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={3}
        />
      );

    case "email":
      return (
        <QuestionEmail
          question={question}
          value={value as string}
          error={error}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      );

    case "number":
    case "positive_number":
    case "negative_number":
      return (
        <QuestionNumber
          question={question}
          value={value as number | string}
          error={error}
          onChange={handleChange}
          onBlur={handleBlur}
          questionType={questionType as "number" | "positive_number" | "negative_number"}
        />
      );

    case "slider":
      return (
        <QuestionSlider
          question={question}
          value={value as number}
          error={error}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      );

    case "date":
      return (
        <QuestionDate
          question={question}
          value={value as string}
          error={error}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      );

    case "time":
      return (
        <QuestionTime
          question={question}
          value={value as string}
          error={error}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      );

    case "multiple_choices":
      return (
        <QuestionMultipleChoice
          question={question}
          value={value as string[]}
          error={error}
          otherText={otherText}
          surveyId={surveyId}
          randomizedOptions={randomizedOptions}
          onChange={handleChange}
          onBlur={handleBlur}
          onOtherTextChange={handleOtherTextChange}
        />
      );

    case "radio":
    case "dropdown":
    case "yes_no":
      return (
        <QuestionRadio
          question={question}
          value={value as string}
          error={error}
          otherText={otherText}
          surveyId={surveyId}
          randomizedOptions={randomizedOptions}
          questionType={questionType as "radio" | "dropdown" | "yes_no"}
          onChange={handleChange}
          onBlur={handleBlur}
          onOtherTextChange={handleOtherTextChange}
        />
      );

    case "fields":
      return (
        <QuestionFields
          question={question}
          value={value as string[]}
          error={error}
          otherText={otherText}
          randomizedOptions={randomizedOptions}
          onChange={handleChange}
          onBlur={handleBlur}
          onOtherTextChange={handleOtherTextChange}
        />
      );

    case "form_fields":
      return (
        <QuestionFormFields
          question={question}
          value={value as { [subfield: string]: number | null | string } | null}
          error={error}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      );

    case "cross_matrix":
    case "grid_radio":
      return (
        <QuestionGridRadio
          question={question}
          value={value as { [row: string]: string } | null}
          error={error}
          surveyId={surveyId}
          onChange={handleChange}
        />
      );

    case "cross_matrix_checkbox":
    case "grid_multi":
      return (
        <QuestionGridMulti
          question={question}
          value={value as { [row: string]: string[] } | null}
          error={error}
          surveyId={surveyId}
          onChange={handleChange}
        />
      );

    default:
      return <p className="text-gray-500">Unsupported question type: {questionType}</p>;
  }
};
