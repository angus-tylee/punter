"use client";

import TextQuestion from "./TextQuestion";
import TextareaQuestion from "./TextareaQuestion";
import SingleSelectQuestion from "./SingleSelectQuestion";
import MultiSelectQuestion from "./MultiSelectQuestion";
import LikertQuestion from "./LikertQuestion";
import BudgetAllocation from "./BudgetAllocation";

type Question = {
  id: string;
  question_text: string;
  question_type: "text" | "textarea" | "Single-select" | "Multi-select" | "Likert" | "budget-allocation";
  options: string[] | any | null;
  required: boolean;
  order: number;
};

type QuestionRendererProps = {
  question: Question;
  value: string | string[] | { [key: string]: number } | null;
  onChange: (value: any) => void;
};

export default function QuestionRenderer({ question, value, onChange }: QuestionRendererProps) {
  switch (question.question_type) {
    case "text":
      return (
        <TextQuestion
          questionId={question.id}
          questionText={question.question_text}
          value={value as string | null}
          onChange={(val) => onChange(val)}
          required={question.required}
        />
      );

    case "textarea":
      return (
        <TextareaQuestion
          questionId={question.id}
          questionText={question.question_text}
          value={value as string | null}
          onChange={(val) => onChange(val)}
          required={question.required}
        />
      );

    case "Single-select":
      return (
        <SingleSelectQuestion
          questionId={question.id}
          questionText={question.question_text}
          options={(question.options as string[]) || []}
          value={value as string | null}
          onChange={(val) => onChange(val)}
          required={question.required}
        />
      );

    case "Multi-select":
      return (
        <MultiSelectQuestion
          questionId={question.id}
          questionText={question.question_text}
          options={(question.options as string[]) || []}
          value={value as string[] | null}
          onChange={(val) => onChange(val)}
          required={question.required}
        />
      );

    case "Likert":
      return (
        <LikertQuestion
          questionId={question.id}
          questionText={question.question_text}
          options={(question.options as string[]) || []}
          value={value as string | null}
          onChange={(val) => onChange(val)}
          required={question.required}
        />
      );

    case "budget-allocation":
      const budgetOptions = question.options as { budget: number; artists: Array<{ id: string; name: string; imageUrl: string }> } | null;
      if (!budgetOptions) {
        return <div className="text-red-500">Invalid budget allocation question configuration</div>;
      }
      return (
        <BudgetAllocation
          questionId={question.id}
          questionText={question.question_text}
          budget={budgetOptions.budget || 100}
          artists={budgetOptions.artists || []}
          value={value as { [key: string]: number } | null}
          onChange={(val) => onChange(val)}
          required={question.required}
        />
      );

    default:
      return <div className="text-red-500">Unknown question type: {question.question_type}</div>;
  }
}

