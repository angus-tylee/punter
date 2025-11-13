"use client";

type NavigationButtonsProps = {
  onNext: () => void;
  onBack: () => void;
  canGoBack: boolean;
  isLastQuestion: boolean;
  isSubmitting?: boolean;
};

export default function NavigationButtons({
  onNext,
  onBack,
  canGoBack,
  isLastQuestion,
  isSubmitting = false,
}: NavigationButtonsProps) {
  return (
    <div className="flex items-center justify-between gap-4 mt-6">
      <button
        type="button"
        onClick={onBack}
        disabled={!canGoBack}
        className={`px-6 py-3 rounded-md font-medium transition-colors ${
          canGoBack
            ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
            : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
        }`}
      >
        Back
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={isSubmitting}
        className="px-6 py-3 rounded-md bg-black dark:bg-white text-white dark:text-black font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isSubmitting
          ? "Submitting..."
          : isLastQuestion
          ? "Submit"
          : "Next"}
      </button>
    </div>
  );
}

