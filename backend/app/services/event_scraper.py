"""Main event scraper service that orchestrates different scraper implementations"""

from typing import List, Optional
from urllib.parse import urlparse

from app.services.scrapers.base import BaseEventScraper, ExtractedEventData
from app.services.scrapers.llm_scraper import LLMScraper
from app.services.llm_service import LLMService


class EventScraper:
    """
    Main orchestrator for event data extraction.
    
    Routes to appropriate scraper based on URL/platform.
    Designed to easily add traditional parsers in the future.
    """
    
    def __init__(self, llm_service: Optional[LLMService] = None):
        """
        Initialize event scraper
        
        Args:
            llm_service: Optional LLMService instance (creates new one if not provided)
        """
        # Initialize LLM service if needed
        if llm_service is None:
            llm_service = LLMService()
        
        # Initialize scrapers
        # Future: Add platform-specific parsers here
        # self.parsers = {
        #     "eventbrite": EventbriteScraper(),
        #     "ticketmaster": TicketmasterScraper(),
        #     ...
        # }
        
        # LLM scraper (fallback for all URLs)
        self.llm_scraper = LLMScraper(llm_service.client)
        
        # List of all scrapers (parsers first, then LLM as fallback)
        self.scrapers: List[BaseEventScraper] = [
            # Future: Add traditional parsers here
            # They will be tried first before LLM
            self.llm_scraper  # LLM as fallback
        ]
    
    async def extract_from_url(self, url: str) -> ExtractedEventData:
        """
        Extract event data from a single URL using appropriate scraper
        
        Args:
            url: Event website or ticketing URL
            
        Returns:
            ExtractedEventData with extracted fields
        """
        # Normalize URL
        url = self._normalize_url(url)
        
        # Try each scraper in order
        for scraper in self.scrapers:
            if scraper.can_handle(url):
                try:
                    print(f"Using {scraper.get_platform_name()} scraper for {url}")
                    result = await scraper.extract(url)
                    if result.has_data():
                        return result
                except Exception as e:
                    print(f"Scraper {scraper.get_platform_name()} failed: {e}")
                    # Continue to next scraper
                    continue
        
        # If all scrapers fail, return empty data
        return ExtractedEventData()
    
    async def extract_from_urls(self, urls: List[str]) -> ExtractedEventData:
        """
        Extract event data from multiple URLs and merge results
        
        Strategy:
        - Extract from each URL independently
        - Merge results intelligently:
          - Description: Use longest/most complete
          - Venue: Prefer non-null, merge if different
          - Lineup: Combine and deduplicate, preserve ranking
          - Pricing: Combine tiers, prefer more complete data
          - VIP: Merge VIP info from all sources
        
        Args:
            urls: List of event website or ticketing URLs
            
        Returns:
            Merged ExtractedEventData with combined fields
        """
        if not urls:
            return ExtractedEventData()
        
        # Extract from all URLs in parallel
        results = []
        for url in urls:
            try:
                result = await self.extract_from_url(url)
                if result.has_data():
                    results.append(result)
            except Exception as e:
                print(f"Failed to extract from {url}: {e}")
                continue
        
        if not results:
            return ExtractedEventData()
        
        # Merge results
        return self._merge_results(results)
    
    def _merge_results(self, results: List[ExtractedEventData]) -> ExtractedEventData:
        """
        Merge multiple extraction results into one
        
        Args:
            results: List of ExtractedEventData objects
            
        Returns:
            Merged ExtractedEventData
        """
        merged = ExtractedEventData()
        
        # Description: Use longest/most complete
        descriptions = [r.description for r in results if r.description]
        if descriptions:
            merged.description = max(descriptions, key=len)
        
        # Venue: Prefer first non-null, or combine if different
        venues = [r.venue for r in results if r.venue]
        if venues:
            # Use first venue, or combine unique venues
            unique_venues = list(dict.fromkeys(venues))  # Preserve order, remove duplicates
            merged.venue = " / ".join(unique_venues) if len(unique_venues) > 1 else unique_venues[0]
        
        # Lineup: Combine and deduplicate, preserve ranking
        all_lineup = []
        seen_artists = set()
        for result in results:
            for artist in result.lineup:
                artist_name_lower = artist.get("name", "").lower().strip()
                if artist_name_lower and artist_name_lower not in seen_artists:
                    all_lineup.append(artist)
                    seen_artists.add(artist_name_lower)
        
        # Sort by rank (lower rank = headliner)
        all_lineup.sort(key=lambda x: x.get("rank", 999))
        # Reassign ranks sequentially
        for i, artist in enumerate(all_lineup, 1):
            artist["rank"] = i
        merged.lineup = all_lineup
        
        # Pricing: Combine tiers, deduplicate by name
        all_tiers = []
        seen_tier_names = set()
        for result in results:
            for tier in result.pricing_tiers:
                tier_name_lower = tier.get("name", "").lower().strip()
                if tier_name_lower and tier_name_lower not in seen_tier_names:
                    all_tiers.append(tier)
                    seen_tier_names.add(tier_name_lower)
        merged.pricing_tiers = all_tiers
        
        # VIP: Merge VIP info
        vip_enabled = any(r.vip_info.get("enabled", False) for r in results)
        if vip_enabled:
            merged.vip_info = {"enabled": True, "tiers": [], "included": []}
            
            # Combine VIP tiers
            seen_vip_tiers = set()
            for result in results:
                if result.vip_info.get("enabled"):
                    for tier in result.vip_info.get("tiers", []):
                        tier_name_lower = tier.get("name", "").lower().strip()
                        if tier_name_lower and tier_name_lower not in seen_vip_tiers:
                            merged.vip_info["tiers"].append(tier)
                            seen_vip_tiers.add(tier_name_lower)
            
            # Combine VIP included items
            seen_included = set()
            for result in results:
                if result.vip_info.get("enabled"):
                    for item in result.vip_info.get("included", []):
                        item_lower = item.lower().strip()
                        if item_lower and item_lower not in seen_included:
                            merged.vip_info["included"].append(item)
                            seen_included.add(item_lower)
        else:
            merged.vip_info = {"enabled": False, "tiers": [], "included": []}
        
        return merged
    
    def _normalize_url(self, url: str) -> str:
        """
        Normalize URL for consistent handling
        
        Args:
            url: Raw URL string
            
        Returns:
            Normalized URL
        """
        url = url.strip()
        
        # Add protocol if missing
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        
        return url
    
    def _detect_platform(self, url: str) -> Optional[str]:
        """
        Detect platform from URL (for future use with parsers)
        
        Args:
            url: URL to analyze
            
        Returns:
            Platform name or None if unknown
        """
        domain = urlparse(url).netloc.lower()
        
        # Future: Add platform detection logic
        # if "eventbrite.com" in domain:
        #     return "eventbrite"
        # elif "ticketmaster.com" in domain:
        #     return "ticketmaster"
        # ...
        
        return None

