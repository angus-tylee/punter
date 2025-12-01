"use client";

import { useState, useEffect } from "react";

type ExtractedData = {
  description?: string | null;
  venue?: string | null;
  lineup?: Array<{ name: string; rank: number }>;
  pricing_tiers?: Array<{ name: string; price: string }>;
  vip_info?: {
    enabled: boolean;
    tiers?: Array<{ name: string; price: string }>;
    included?: string[];
  };
};

type DataExtractionModalProps = {
  isOpen: boolean;
  extractedData: ExtractedData | null;
  onConfirm: (data: ExtractedData) => void;
  onCancel: () => void;
  isLoading?: boolean;
};

export default function DataExtractionModal({
  isOpen,
  extractedData,
  onConfirm,
  onCancel,
  isLoading = false,
}: DataExtractionModalProps) {
  const [editedData, setEditedData] = useState<ExtractedData | null>(extractedData);

  // Update edited data when extractedData changes
  useEffect(() => {
    if (extractedData) {
      setEditedData(extractedData);
    }
  }, [extractedData]);

  if (!isOpen) return null;

  const data = editedData || extractedData;

  const handleConfirm = () => {
    if (data) {
      onConfirm(data);
    }
  };

  const updateDescription = (value: string) => {
    setEditedData((prev) => ({ ...prev, description: value }));
  };

  const updateVenue = (value: string) => {
    setEditedData((prev) => ({ ...prev, venue: value }));
  };

  const updateLineupItem = (index: number, field: "name" | "rank", value: string | number) => {
    setEditedData((prev) => {
      if (!prev) return prev;
      const newLineup = [...(prev.lineup || [])];
      newLineup[index] = { ...newLineup[index], [field]: value };
      return { ...prev, lineup: newLineup };
    });
  };

  const removeLineupItem = (index: number) => {
    setEditedData((prev) => {
      if (!prev) return prev;
      const newLineup = [...(prev.lineup || [])];
      newLineup.splice(index, 1);
      // Reassign ranks
      newLineup.forEach((item, i) => {
        item.rank = i + 1;
      });
      return { ...prev, lineup: newLineup };
    });
  };

  const updatePricingTier = (index: number, field: "name" | "price", value: string) => {
    setEditedData((prev) => {
      if (!prev) return prev;
      const newTiers = [...(prev.pricing_tiers || [])];
      newTiers[index] = { ...newTiers[index], [field]: value };
      return { ...prev, pricing_tiers: newTiers };
    });
  };

  const removePricingTier = (index: number) => {
    setEditedData((prev) => {
      if (!prev) return prev;
      const newTiers = [...(prev.pricing_tiers || [])];
      newTiers.splice(index, 1);
      return { ...prev, pricing_tiers: newTiers };
    });
  };

  const updateVipTier = (index: number, field: "name" | "price", value: string) => {
    setEditedData((prev) => {
      if (!prev || !prev.vip_info) return prev;
      const newTiers = [...(prev.vip_info.tiers || [])];
      newTiers[index] = { ...newTiers[index], [field]: value };
      return {
        ...prev,
        vip_info: { ...prev.vip_info, tiers: newTiers },
      };
    });
  };

  const removeVipTier = (index: number) => {
    setEditedData((prev) => {
      if (!prev || !prev.vip_info) return prev;
      const newTiers = [...(prev.vip_info.tiers || [])];
      newTiers.splice(index, 1);
      return {
        ...prev,
        vip_info: { ...prev.vip_info, tiers: newTiers },
      };
    });
  };

  const updateVipIncluded = (value: string) => {
    setEditedData((prev) => {
      if (!prev || !prev.vip_info) return prev;
      return {
        ...prev,
        vip_info: {
          ...prev.vip_info,
          included: value.split(",").map((i) => i.trim()).filter((i) => i),
        },
      };
    });
  };

  const hasData = data && (
    data.description ||
    data.venue ||
    (data.lineup && data.lineup.length > 0) ||
    (data.pricing_tiers && data.pricing_tiers.length > 0) ||
    (data.vip_info?.enabled && data.vip_info.tiers && data.vip_info.tiers.length > 0)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Review Extracted Event Data</h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              disabled={isLoading}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                Extracting event data...
              </p>
            </div>
          ) : !hasData ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No event data could be extracted from the provided URL(s).
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Please try different URLs or enter the information manually.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Description */}
              {data.description && (
                <div>
                  <label className="block text-sm font-medium mb-2">Event Description</label>
                  <textarea
                    value={data.description || ""}
                    onChange={(e) => updateDescription(e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none min-h-[80px]"
                    placeholder="Event description"
                  />
                </div>
              )}

              {/* Venue */}
              {data.venue && (
                <div>
                  <label className="block text-sm font-medium mb-2">Venue</label>
                  <input
                    type="text"
                    value={data.venue || ""}
                    onChange={(e) => updateVenue(e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                    placeholder="Venue name"
                  />
                </div>
              )}

              {/* Lineup */}
              {data.lineup && data.lineup.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Lineup</label>
                  <div className="space-y-2">
                    {data.lineup.map((artist, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 w-8">#{artist.rank}</span>
                        <input
                          type="text"
                          value={artist.name}
                          onChange={(e) => updateLineupItem(index, "name", e.target.value)}
                          className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none text-sm"
                          placeholder="Artist name"
                        />
                        <button
                          type="button"
                          onClick={() => removeLineupItem(index)}
                          className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pricing Tiers */}
              {data.pricing_tiers && data.pricing_tiers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Regular Pricing Tiers</label>
                  <div className="space-y-2">
                    {data.pricing_tiers.map((tier, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={tier.name}
                          onChange={(e) => updatePricingTier(index, "name", e.target.value)}
                          className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none text-sm"
                          placeholder="Tier name"
                        />
                        <input
                          type="text"
                          value={tier.price}
                          onChange={(e) => updatePricingTier(index, "price", e.target.value)}
                          className="w-32 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none text-sm"
                          placeholder="Price"
                        />
                        <button
                          type="button"
                          onClick={() => removePricingTier(index)}
                          className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* VIP Info */}
              {data.vip_info?.enabled && (
                <div>
                  <label className="block text-sm font-medium mb-2">VIP Information</label>
                  {data.vip_info.tiers && data.vip_info.tiers.length > 0 && (
                    <div className="mb-3">
                      <label className="block text-xs text-gray-500 mb-1">VIP Tiers</label>
                      <div className="space-y-2">
                        {data.vip_info.tiers.map((tier, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={tier.name}
                              onChange={(e) => updateVipTier(index, "name", e.target.value)}
                              className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none text-sm"
                              placeholder="VIP tier name"
                            />
                            <input
                              type="text"
                              value={tier.price}
                              onChange={(e) => updateVipTier(index, "price", e.target.value)}
                              className="w-32 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none text-sm"
                              placeholder="Price"
                            />
                            <button
                              type="button"
                              onClick={() => removeVipTier(index)}
                              className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.vip_info.included && data.vip_info.included.length > 0 && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">What's Included</label>
                      <textarea
                        value={data.vip_info.included.join(", ")}
                        onChange={(e) => updateVipIncluded(e.target.value)}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none min-h-[60px] text-sm"
                        placeholder="Comma-separated list"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="rounded-md border border-gray-300 dark:border-gray-700 py-2 px-4 font-medium disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading || !hasData}
              className="rounded-md bg-black text-white dark:bg-white dark:text-black py-2 px-4 font-medium disabled:opacity-60"
            >
              Use This Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

