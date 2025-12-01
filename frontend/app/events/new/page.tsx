"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DataExtractionModal from "@/components/events/DataExtractionModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

type LineupItem = {
  id: string;
  name: string;
  rank: number;
};

type PricingTier = {
  id: string;
  name: string;
  price: string;
};

type DrinkItem = {
  id: string;
  name: string;
  price: string;
};

type BarPartner = {
  id: string;
  brand: string;
  drinks: DrinkItem[];
};

export default function NewEventPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Basic Info
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState("");
  const [date, setDate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [venue, setVenue] = useState("");
  const [eventUrl, setEventUrl] = useState("");
  const [ticketingUrl, setTicketingUrl] = useState("");
  
  // Data extraction
  const [showExtractionModal, setShowExtractionModal] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [extracting, setExtracting] = useState(false);

  // Step 2: Lineup
  const [lineup, setLineup] = useState<LineupItem[]>([]);
  const [newArtist, setNewArtist] = useState("");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Step 3: Pricing
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [newTierName, setNewTierName] = useState("");
  const [newTierPrice, setNewTierPrice] = useState("");
  const [vipEnabled, setVipEnabled] = useState(false);
  const [vipTiers, setVipTiers] = useState<PricingTier[]>([]);
  const [vipIncluded, setVipIncluded] = useState("");

  // Step 4: Bar Partners
  const [barPartners, setBarPartners] = useState<BarPartner[]>([]);
  const [newBrand, setNewBrand] = useState("");
  const [newDrinkName, setNewDrinkName] = useState("");
  const [newDrinkPrice, setNewDrinkPrice] = useState("");
  const [currentPartnerDrinks, setCurrentPartnerDrinks] = useState<DrinkItem[]>([]);

  // Step 5: Target Market
  const [targetMarket, setTargetMarket] = useState("");

  // Step 6: Current Stage
  const [currentStage, setCurrentStage] = useState<"early_planning" | "mid_campaign" | "post_event">("early_planning");

  const eventTypeOptions = [
    "Music Festival",
    "Venue Event"
  ];

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return name.trim() && eventType;
      case 2:
        return true; // Lineup is optional
      case 3:
        return true; // Pricing is optional
      case 4:
        return true; // Bar partners are optional
      case 5:
        return true; // Target market is optional
      case 6:
        return true; // Stage is always set
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed() && currentStep < 6) {
      setCurrentStep((currentStep + 1) as WizardStep);
      setError(null);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as WizardStep);
      setError(null);
    }
  };

  const addArtist = () => {
    if (newArtist.trim()) {
      const newItem: LineupItem = {
        id: `lineup-${Date.now()}`,
        name: newArtist.trim(),
        rank: lineup.length + 1
      };
      setLineup([...lineup, newItem]);
      setNewArtist("");
    }
  };

  const removeArtist = (id: string) => {
    const updated = lineup.filter(item => item.id !== id).map((item, index) => ({
      ...item,
      rank: index + 1
    }));
    setLineup(updated);
  };

  const handleDragStart = (id: string) => {
    setDraggedItemId(id);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    if (!draggedItemId) return;

    const dragIndex = lineup.findIndex(item => item.id === draggedItemId);
    if (dragIndex === -1 || dragIndex === dropIndex) {
      setDraggedItemId(null);
      return;
    }

    const newLineup = [...lineup];
    const [draggedItem] = newLineup.splice(dragIndex, 1);
    newLineup.splice(dropIndex, 0, draggedItem);

    // Update ranks
    newLineup.forEach((item, i) => {
      item.rank = i + 1;
    });

    setLineup(newLineup);
    setDraggedItemId(null);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverIndex(null);
  };

  const addPricingTier = () => {
    if (newTierName.trim() && newTierPrice.trim()) {
      const newTier: PricingTier = {
        id: `tier-${Date.now()}`,
        name: newTierName.trim(),
        price: newTierPrice.trim()
      };
      setPricingTiers([...pricingTiers, newTier]);
      setNewTierName("");
      setNewTierPrice("");
    }
  };

  const removePricingTier = (id: string) => {
    setPricingTiers(pricingTiers.filter(tier => tier.id !== id));
  };

  const addVipTier = () => {
    if (newTierName.trim() && newTierPrice.trim()) {
      const newTier: PricingTier = {
        id: `vip-${Date.now()}`,
        name: newTierName.trim(),
        price: newTierPrice.trim()
      };
      setVipTiers([...vipTiers, newTier]);
      setNewTierName("");
      setNewTierPrice("");
    }
  };

  const removeVipTier = (id: string) => {
    setVipTiers(vipTiers.filter(tier => tier.id !== id));
  };

  const addDrinkToPartner = () => {
    if (newDrinkName.trim() && newDrinkPrice.trim()) {
      const newDrink: DrinkItem = {
        id: `drink-${Date.now()}`,
        name: newDrinkName.trim(),
        price: newDrinkPrice.trim()
      };
      setCurrentPartnerDrinks([...currentPartnerDrinks, newDrink]);
      setNewDrinkName("");
      setNewDrinkPrice("");
    }
  };

  const removeDrinkFromPartner = (id: string) => {
    setCurrentPartnerDrinks(currentPartnerDrinks.filter(drink => drink.id !== id));
  };

  const addBarPartner = () => {
    if (newBrand.trim()) {
      const newPartner: BarPartner = {
        id: `bar-${Date.now()}`,
        brand: newBrand.trim(),
        drinks: [...currentPartnerDrinks]
      };
      setBarPartners([...barPartners, newPartner]);
      setNewBrand("");
      setNewDrinkName("");
      setNewDrinkPrice("");
      setCurrentPartnerDrinks([]);
    }
  };

  const removeBarPartner = (id: string) => {
    setBarPartners(barPartners.filter(partner => partner.id !== id));
  };

  const handleExtractData = async () => {
    setExtracting(true);
    setError(null);
    setShowExtractionModal(true);
    setExtractedData(null);

    try {
      // Collect URLs (filter out empty ones)
      const urls = [eventUrl.trim(), ticketingUrl.trim()].filter(url => url.length > 0);
      
      if (urls.length === 0) {
        setError("Please enter at least one URL");
        setExtracting(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/events/extract-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ urls }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Failed to extract data" }));
        throw new Error(errorData.detail || "Failed to extract event data");
      }

      const data = await response.json();
      setExtractedData(data);
    } catch (err: any) {
      setError(err.message || "Failed to extract event data");
      setExtractedData(null);
    } finally {
      setExtracting(false);
    }
  };

  const handleConfirmExtraction = (data: any) => {
    // Populate form fields with extracted data
    if (data.description) {
      // Could set as description or use for name if name is empty
      if (!name.trim()) {
        // Try to extract event name from description (first sentence or first 50 chars)
        const firstSentence = data.description.split(/[.!?]/)[0].trim();
        if (firstSentence.length > 0 && firstSentence.length < 100) {
          setName(firstSentence);
        }
      }
      // Store description in target_market for now (or add description field later)
      setTargetMarket(data.description);
    }
    
    if (data.venue) {
      setVenue(data.venue);
    }
    
    if (data.lineup && data.lineup.length > 0) {
      const lineupItems: LineupItem[] = data.lineup.map((item: any, index: number) => ({
        id: `lineup-${Date.now()}-${index}`,
        name: item.name || "",
        rank: item.rank || index + 1,
      }));
      setLineup(lineupItems);
    }
    
    if (data.pricing_tiers && data.pricing_tiers.length > 0) {
      const tiers: PricingTier[] = data.pricing_tiers.map((tier: any, index: number) => ({
        id: `tier-${Date.now()}-${index}`,
        name: tier.name || "",
        price: tier.price || "",
      }));
      setPricingTiers(tiers);
    }
    
    if (data.vip_info) {
      setVipEnabled(data.vip_info.enabled || false);
      if (data.vip_info.tiers && data.vip_info.tiers.length > 0) {
        const vipTiersList: PricingTier[] = data.vip_info.tiers.map((tier: any, index: number) => ({
          id: `vip-${Date.now()}-${index}`,
          name: tier.name || "",
          price: tier.price || "",
        }));
        setVipTiers(vipTiersList);
      }
      if (data.vip_info.included && data.vip_info.included.length > 0) {
        setVipIncluded(data.vip_info.included.join(", "));
      }
    }
    
    setShowExtractionModal(false);
    setExtractedData(null);
  };

  const handleCancelExtraction = () => {
    setShowExtractionModal(false);
    setExtractedData(null);
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Not signed in");
        setLoading(false);
        return;
      }

      const eventData = {
        owner_id: session.user.id,
        name: name.trim(),
        event_type: eventType,
        date: date || null,
        capacity: capacity ? parseInt(capacity) : null,
        venue: venue.trim() || null,
        event_url: eventUrl.trim() || null,
        lineup: lineup.map(item => ({ name: item.name, rank: item.rank })),
        pricing_tiers: pricingTiers.map(tier => ({ name: tier.name, price: tier.price })),
        vip_info: {
          enabled: vipEnabled,
          tiers: vipTiers.map(tier => ({ name: tier.name, price: tier.price })),
          included: vipIncluded.split(",").map(i => i.trim()).filter(i => i)
        },
        bar_partners: barPartners.map(partner => ({
          brand: partner.brand,
          drinks: partner.drinks.map(drink => ({
            name: drink.name,
            price: drink.price
          }))
        })),
        target_market: targetMarket.trim() || null,
        current_stage: currentStage,
        promoter_name: "Promoter Name" // Stubbed for now
      };

      const { data, error: insertError } = await supabase
        .from("events")
        .insert(eventData)
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      router.push(`/events/${data.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create event. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-4">
        <Link className="underline text-sm" href="/events">Back</Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Create New Event</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Set up your event details to start creating panoramas
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {[1, 2, 3, 4, 5, 6].map((step) => (
            <div key={step} className="flex items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step <= currentStep
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "bg-gray-200 dark:bg-gray-800 text-gray-500"
                }`}
              >
                {step}
              </div>
              {step < 6 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    step < currentStep
                      ? "bg-black dark:bg-white"
                      : "bg-gray-200 dark:bg-gray-800"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>Basic</span>
          <span>Lineup</span>
          <span>Pricing</span>
          <span>Bar</span>
          <span>Market</span>
          <span>Stage</span>
        </div>
      </div>

      {/* Step Content */}
      <div className="mb-6">
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Event Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                placeholder="e.g., Summer Music Festival 2024"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Event Type *</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                required
              >
                <option value="">Select event type</option>
                {eventTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Capacity</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                placeholder="e.g., 5000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Venue</label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                placeholder="e.g., Central Park"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Event Website URL</label>
              <input
                type="url"
                value={eventUrl}
                onChange={(e) => setEventUrl(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                placeholder="https://example.com/event"
              />
              <p className="text-xs text-gray-500 mt-1">Main event website (for lineup, description)</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Ticketing/Event Listing URL (Optional)</label>
              <input
                type="url"
                value={ticketingUrl}
                onChange={(e) => setTicketingUrl(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                placeholder="https://tickets.example.com/event"
              />
              <p className="text-xs text-gray-500 mt-1">Ticketing site (for pricing, venue details)</p>
            </div>
            {(eventUrl.trim() || ticketingUrl.trim()) && (
              <div>
                <button
                  type="button"
                  onClick={handleExtractData}
                  disabled={extracting}
                  className="w-full rounded-md bg-black text-white dark:bg-white dark:text-black py-2 px-4 font-medium disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {extracting ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white dark:border-black"></div>
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <span>Auto-fill from URL(s)</span>
                  )}
                </button>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  Extract event description, venue, lineup, and pricing from the URLs above
                </p>
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Lineup (Optional)</label>
              <p className="text-xs text-gray-500 mb-3">
                Add artists and rank them from headline to support acts
              </p>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newArtist}
                  onChange={(e) => setNewArtist(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addArtist())}
                  className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                  placeholder="Artist name"
                />
                <button
                  type="button"
                  onClick={addArtist}
                  className="rounded-md border border-gray-300 dark:border-gray-700 py-2 px-4"
                >
                  Add
                </button>
              </div>
              {lineup.length > 0 && (
                <div className="space-y-2">
                  {lineup.map((item, index) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => handleDragStart(item.id)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 p-2 border rounded cursor-move transition-all ${
                        draggedItemId === item.id
                          ? "opacity-50 border-gray-400 dark:border-gray-600"
                          : dragOverIndex === index
                          ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-800"
                      }`}
                    >
                      <span className="text-gray-400 dark:text-gray-600 select-none">⋮⋮</span>
                      <span className="text-sm text-gray-500 w-8">#{item.rank}</span>
                      <span className="flex-1">{item.name}</span>
                      <button
                        type="button"
                        onClick={() => removeArtist(item.id)}
                        className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Regular Pricing Tiers (Optional)</label>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newTierName}
                  onChange={(e) => setNewTierName(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                  placeholder="Tier name"
                />
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="text"
                    value={newTierPrice}
                    onChange={(e) => setNewTierPrice(e.target.value)}
                    className="w-32 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 pl-6 outline-none"
                    placeholder="0.00"
                  />
                </div>
                <button
                  type="button"
                  onClick={addPricingTier}
                  className="rounded-md border border-gray-300 dark:border-gray-700 py-2 px-4"
                >
                  Add
                </button>
              </div>
              {pricingTiers.length > 0 && (
                <div className="space-y-2 mb-4">
                  {pricingTiers.map((tier) => (
                    <div
                      key={tier.id}
                      className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-800 rounded"
                    >
                      <span>{tier.name} - ${tier.price}</span>
                      <button
                        type="button"
                        onClick={() => removePricingTier(tier.id)}
                        className="text-sm text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={vipEnabled}
                  onChange={(e) => setVipEnabled(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium">VIP Available</span>
              </label>
              {vipEnabled && (
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">VIP Tiers</label>
                    <div className="flex gap-2 mb-4">
                      <input
                        type="text"
                        value={newTierName}
                        onChange={(e) => setNewTierName(e.target.value)}
                        className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                        placeholder="VIP tier name"
                      />
                      <input
                        type="text"
                        value={newTierPrice}
                        onChange={(e) => setNewTierPrice(e.target.value)}
                        className="w-32 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                        placeholder="Price"
                      />
                      <button
                        type="button"
                        onClick={addVipTier}
                        className="rounded-md border border-gray-300 dark:border-gray-700 py-2 px-4"
                      >
                        Add
                      </button>
                    </div>
                    {vipTiers.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {vipTiers.map((tier) => (
                          <div
                            key={tier.id}
                            className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-800 rounded"
                          >
                            <span>{tier.name} - ${tier.price}</span>
                            <button
                              type="button"
                              onClick={() => removeVipTier(tier.id)}
                              className="text-sm text-red-500"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">What's Included in VIP</label>
                    <textarea
                      value={vipIncluded}
                      onChange={(e) => setVipIncluded(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none min-h-[80px]"
                      placeholder="Comma-separated list: e.g., Backstage access, Meet & greet, Free drinks"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Bar Partners (Optional)</label>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Brand Name</label>
                  <input
                    type="text"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                    placeholder="Brand name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Add Drinks</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newDrinkName}
                      onChange={(e) => setNewDrinkName(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addDrinkToPartner())}
                      className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none"
                      placeholder="Drink name"
                    />
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="text"
                        value={newDrinkPrice}
                        onChange={(e) => setNewDrinkPrice(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addDrinkToPartner())}
                        className="w-32 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 pl-6 outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addDrinkToPartner}
                      className="rounded-md border border-gray-300 dark:border-gray-700 py-2 px-4"
                    >
                      Add Drink
                    </button>
                  </div>
                  {currentPartnerDrinks.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="text-xs text-gray-500 mb-1">Drinks for this partner:</div>
                      <div className="border border-gray-200 dark:border-gray-800 rounded overflow-hidden">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-2 p-2 bg-gray-50 dark:bg-gray-900/50 text-xs font-medium border-b border-gray-200 dark:border-gray-800">
                          <div>Drink</div>
                          <div className="text-right">Price</div>
                          <div></div>
                        </div>
                        {currentPartnerDrinks.map((drink) => (
                          <div
                            key={drink.id}
                            className="grid grid-cols-[1fr_auto_auto] gap-2 p-2 border-b border-gray-200 dark:border-gray-800 last:border-b-0 items-center"
                          >
                            <div>{drink.name}</div>
                            <div className="text-right">${drink.price}</div>
                            <button
                              type="button"
                              onClick={() => removeDrinkFromPartner(drink.id)}
                              className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addBarPartner}
                  disabled={!newBrand.trim()}
                  className="rounded-md border border-gray-300 dark:border-gray-700 py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Partner
                </button>
              </div>
              {barPartners.length > 0 && (
                <div className="space-y-3 mt-6">
                  <div className="text-sm font-medium mb-2">Added Partners:</div>
                  {barPartners.map((partner) => (
                    <div
                      key={partner.id}
                      className="p-4 border border-gray-200 dark:border-gray-800 rounded"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-base">{partner.brand}</span>
                        <button
                          type="button"
                          onClick={() => removeBarPartner(partner.id)}
                          className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400"
                        >
                          ×
                        </button>
                      </div>
                      {partner.drinks.length > 0 ? (
                        <div className="border border-gray-200 dark:border-gray-800 rounded overflow-hidden">
                          <div className="grid grid-cols-[1fr_auto] gap-2 p-2 bg-gray-50 dark:bg-gray-900/50 text-xs font-medium border-b border-gray-200 dark:border-gray-800">
                            <div>Drink</div>
                            <div className="text-right">Price</div>
                          </div>
                          {partner.drinks.map((drink) => (
                            <div
                              key={drink.id}
                              className="grid grid-cols-[1fr_auto] gap-2 p-2 border-b border-gray-200 dark:border-gray-800 last:border-b-0"
                            >
                              <div className="text-sm">{drink.name}</div>
                              <div className="text-sm text-right">${drink.price}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">No drinks added</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Target Market (Optional)</label>
              <textarea
                value={targetMarket}
                onChange={(e) => setTargetMarket(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 outline-none min-h-[120px]"
                placeholder="Describe your target audience for this event..."
              />
            </div>
          </div>
        )}

        {currentStep === 6 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Current Stage *</label>
              <p className="text-xs text-gray-500 mb-3">
                What stage is this event currently at?
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-800 rounded cursor-pointer">
                  <input
                    type="radio"
                    name="stage"
                    value="early_planning"
                    checked={currentStage === "early_planning"}
                    onChange={(e) => setCurrentStage(e.target.value as any)}
                    className="rounded"
                  />
                  <div>
                    <div className="font-medium">Early Planning (Pre Launch)</div>
                    <div className="text-xs text-gray-500">Event is in planning phase, before launch</div>
                  </div>
                </label>
                <label className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-800 rounded cursor-pointer">
                  <input
                    type="radio"
                    name="stage"
                    value="mid_campaign"
                    checked={currentStage === "mid_campaign"}
                    onChange={(e) => setCurrentStage(e.target.value as any)}
                    className="rounded"
                  />
                  <div>
                    <div className="font-medium">Mid Campaign</div>
                    <div className="text-xs text-gray-500">Event is launched and campaign is in progress</div>
                  </div>
                </label>
                <label className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-800 rounded cursor-pointer">
                  <input
                    type="radio"
                    name="stage"
                    value="post_event"
                    checked={currentStage === "post_event"}
                    onChange={(e) => setCurrentStage(e.target.value as any)}
                    className="rounded"
                  />
                  <div>
                    <div className="font-medium">Post Event</div>
                    <div className="text-xs text-gray-500">Event has already taken place</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <div>
          {currentStep > 1 && (
            <button
              onClick={handleBack}
              disabled={loading}
              className="rounded-md border border-gray-300 dark:border-gray-700 py-2 px-4 font-medium disabled:opacity-60"
            >
              Back
            </button>
          )}
        </div>
        <div className="flex gap-3">
          {currentStep < 6 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed() || loading}
              className="rounded-md bg-black text-white dark:bg-white dark:text-black py-2 px-4 font-medium disabled:opacity-60"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-md bg-black text-white dark:bg-white dark:text-black py-2 px-4 font-medium disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create Event"}
            </button>
          )}
        </div>
      </div>

      {/* Data Extraction Modal */}
      <DataExtractionModal
        isOpen={showExtractionModal}
        extractedData={extractedData}
        onConfirm={handleConfirmExtraction}
        onCancel={handleCancelExtraction}
        isLoading={extracting}
      />
    </main>
  );
}

