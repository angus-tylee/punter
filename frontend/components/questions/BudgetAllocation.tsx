"use client";

import { useMemo } from "react";

type Artist = {
  id: string;
  name: string;
  imageUrl: string;
};

type BudgetAllocationProps = {
  questionId: string;
  questionText: string;
  budget: number;
  artists: Artist[];
  value: { [artistId: string]: number } | null;
  onChange: (allocation: { [artistId: string]: number }) => void;
  required: boolean;
};

const BILL_VALUE = 5; // Each emoji represents $5

export default function BudgetAllocation({
  questionId,
  questionText,
  budget,
  artists,
  value,
  onChange,
  required,
}: BudgetAllocationProps) {
  const allocation = value || {};

  // Calculate how many bills are in the pool
  const totalAllocated = useMemo(() => {
    return Object.values(allocation).reduce((sum, amount) => sum + amount, 0);
  }, [allocation]);

  const remainingBudget = budget - totalAllocated;
  const billsInPool = Math.floor(remainingBudget / BILL_VALUE);
  const billsOnArtists = useMemo(() => {
    const counts: { [artistId: string]: number } = {};
    artists.forEach((artist) => {
      counts[artist.id] = Math.floor((allocation[artist.id] || 0) / BILL_VALUE);
    });
    return counts;
  }, [allocation, artists]);

  // Tap-to-allocate handler (primary mobile interaction)
  const handleArtistTap = (artistId: string) => {
    if (remainingBudget >= BILL_VALUE) {
      const newAllocation = { ...allocation };
      newAllocation[artistId] = (newAllocation[artistId] || 0) + BILL_VALUE;
      onChange(newAllocation);
    }
  };

  // Remove one bill from artist
  const handleArtistRemove = (artistId: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const newAllocation = { ...allocation };
    if (newAllocation[artistId] >= BILL_VALUE) {
      newAllocation[artistId] = newAllocation[artistId] - BILL_VALUE;
      if (newAllocation[artistId] <= 0) {
        delete newAllocation[artistId];
      }
      onChange(newAllocation);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium mb-4">
        {questionText}
        {required && <span className="text-red-500 ml-1">*</span>}
      </div>

      {/* Budget Pool */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 border-2 border-dashed border-gray-300 dark:border-gray-700">
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          Your Budget: ${budget} | Remaining: ${remainingBudget}
        </div>
        <div className="flex flex-wrap gap-2 min-h-[60px] items-center">
          {Array.from({ length: billsInPool }).map((_, i) => (
            <div key={`bill-${i}`} className="text-3xl select-none">
              💵
            </div>
          ))}
          {billsInPool === 0 && (
            <div className="text-sm text-gray-400 italic">All allocated!</div>
          )}
        </div>
      </div>

      {/* Artist Cards */}
      <div className="grid grid-cols-2 gap-3">
        {artists.map((artist) => {
          const artistBills = billsOnArtists[artist.id] || 0;
          const artistAmount = allocation[artist.id] || 0;

          return (
            <div
              key={artist.id}
              className="relative bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-3 min-h-[160px] flex flex-col touch-manipulation"
            >
              {/* Artist Image */}
              <div className="w-full aspect-square rounded-md overflow-hidden mb-2 bg-gray-100 dark:bg-gray-700">
                {artist.imageUrl ? (
                  <img
                    src={artist.imageUrl}
                    alt={artist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Artist Name */}
              <div className="text-xs font-medium text-center mb-2 line-clamp-2">
                {artist.name}
              </div>

              {/* Allocation Display */}
              <div className="mt-auto">
                <div className="flex flex-wrap gap-1 justify-center min-h-[40px] items-center mb-1">
                  {Array.from({ length: artistBills }).map((_, i) => (
                    <div key={`artist-bill-${i}`} className="text-2xl select-none">
                      💵
                    </div>
                  ))}
                </div>
                <div className="text-xs text-center text-gray-600 dark:text-gray-400 font-medium">
                  ${artistAmount}
                </div>
              </div>

              {/* Remove button */}
              {artistAmount > 0 && (
                <button
                  type="button"
                  onClick={(e) => handleArtistRemove(artist.id, e)}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleArtistRemove(artist.id, e);
                  }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white text-sm flex items-center justify-center opacity-90 hover:opacity-100 active:opacity-100 touch-manipulation z-10"
                  aria-label="Remove $5"
                >
                  −
                </button>
              )}

              {/* Tap to add (primary interaction) */}
              {remainingBudget >= BILL_VALUE && (
                <button
                  type="button"
                  onClick={() => handleArtistTap(artist.id)}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleArtistTap(artist.id);
                  }}
                  className="absolute inset-0 w-full h-full bg-transparent touch-manipulation"
                  aria-label={`Add $5 to ${artist.name}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Instructions */}
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
        {remainingBudget > 0
          ? `Tap artists to allocate $${BILL_VALUE} at a time. Tap the − button to remove.`
          : "All budget allocated! Tap the − button on artists to reallocate."}
      </div>
    </div>
  );
}

