"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import ProgressBar from "./ProgressBar";
import NavigationButtons from "./NavigationButtons";
import QuestionRenderer from "../questions/QuestionRenderer";

type Question = {
  id: string;
  question_text: string;
  question_type: "text" | "textarea" | "Single-select" | "Multi-select" | "Likert" | "budget-allocation";
  options: string[] | any | null;
  required: boolean;
  order: number;
};

type SurveyLayoutProps = {
  questions: Question[];
  responses: { [questionId: string]: any };
  onResponseChange: (questionId: string, value: any) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
};

export default function SurveyLayout({
  questions,
  responses,
  onResponseChange,
  onSubmit,
  isSubmitting = false,
}: SurveyLayoutProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0); // 1 for forward, -1 for backward

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const canGoBack = currentIndex > 0;

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setDirection(1);
      setCurrentIndex(currentIndex + 1);
    } else {
      onSubmit();
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Swipe handlers
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentIndex < questions.length - 1) {
        handleNext();
      }
    },
    onSwipedRight: () => {
      if (currentIndex > 0) {
        handleBack();
      }
    },
    trackMouse: false,
    trackTouch: true,
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        if (currentIndex < questions.length - 1) {
          setDirection(1);
          setCurrentIndex(currentIndex + 1);
        }
      } else if (e.key === "ArrowLeft") {
        if (currentIndex > 0) {
          setDirection(-1);
          setCurrentIndex(currentIndex - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentIndex, questions.length]);

  if (!currentQuestion) {
    return <div>No questions available</div>;
  }

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -1000 : 1000,
      opacity: 0,
    }),
  };

  return (
    <div className="w-full min-h-screen bg-white dark:bg-gray-900" {...swipeHandlers}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Progress Bar */}
        <div className="mb-8">
          <ProgressBar current={currentIndex + 1} total={questions.length} />
        </div>

        {/* Question Content */}
        <div className="relative min-h-[400px]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentQuestion.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
              }}
              className="w-full"
            >
              <div className="mb-6">
                <QuestionRenderer
                  question={currentQuestion}
                  value={responses[currentQuestion.id] || null}
                  onChange={(value) => onResponseChange(currentQuestion.id, value)}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <NavigationButtons
          onNext={handleNext}
          onBack={handleBack}
          canGoBack={canGoBack}
          isLastQuestion={isLastQuestion}
          isSubmitting={isSubmitting}
        />

        {/* Swipe hint for mobile */}
        {questions.length > 1 && (
          <div className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
            Swipe left/right or use buttons to navigate
          </div>
        )}
      </div>
    </div>
  );
}

