"""Main event scraper service that orchestrates different scraper implementations"""

import asyncio
import difflib
import hashlib
import time
from typing import List, Optional, Tuple
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
        
        # Cache for extraction results (in-memory, 1 hour TTL)
        self._cache: dict[str, Tuple[float, ExtractedEventData]] = {}
        self._cache_ttl = 3600  # 1 hour
    
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
        
        Args:
            urls: List of event website or ticketing URLs
            
        Returns:
            Merged ExtractedEventData with combined fields
        """
        if not urls:
            return ExtractedEventData()
        
        # Check cache first
        cache_key = self._get_cache_key(urls)
        cached = self._get_from_cache(cache_key)
        if cached:
            print("Cache hit! Returning cached result")
            return cached
        
        # Transform URLs for known providers
        expanded_urls = self._transform_urls_for_provider(urls)
        
        # Extract from all URLs in parallel for speed
        async def safe_extract(url: str) -> Optional[ExtractedEventData]:
            try:
                result = await self.extract_from_url(url)
                return result if result.has_data() else None
            except Exception as e:
                print(f"Failed to extract from {url}: {e}")
                return None
        
        extraction_tasks = [safe_extract(url) for url in expanded_urls]
        extraction_results = await asyncio.gather(*extraction_tasks)
        
        # Filter out None results
        results = [r for r in extraction_results if r is not None]
        
        if not results:
            return ExtractedEventData()
        
        # Merge results
        merged = await self._merge_results(results)
        
        # Cache result
        self._set_cache(cache_key, merged)
        return merged
    
    def _get_cache_key(self, urls: List[str]) -> str:
        """Generate cache key from URLs"""
        return hashlib.md5("".join(sorted(urls)).encode()).hexdigest()
    
    def _get_from_cache(self, key: str) -> Optional[ExtractedEventData]:
        """Get result from cache if valid"""
        if key in self._cache:
            timestamp, result = self._cache[key]
            if time.time() - timestamp < self._cache_ttl:
                return result
            del self._cache[key]
        return None
    
    def _set_cache(self, key: str, result: ExtractedEventData):
        """Store result in cache"""
        self._cache[key] = (time.time(), result)
    
    def _transform_urls_for_provider(self, urls: List[str]) -> List[str]:
        """
        Transform URLs for known providers to get better data
        
        Args:
            urls: List of original URLs
            
        Returns:
            Expanded list of URLs (original + transformed)
        """
        expanded_urls = []
        
        for url in urls:
            normalized = self._normalize_url(url)
            expanded_urls.append(normalized)
            
            # Flicket.co.nz: Add /reservation URL for pricing, or base URL if reservation provided
            if "flicket.co.nz" in normalized.lower():
                if normalized.endswith("/reservation"):
                    # If reservation URL provided, also fetch base event page
                    base_url = normalized.rsplit("/reservation", 1)[0]
                    expanded_urls.insert(0, base_url)  # Add base URL first
                    print(f"Added Flicket base URL: {base_url}")
                else:
                    # Append /reservation if not already present
                    reservation_url = normalized.rstrip("/") + "/reservation"
                    expanded_urls.append(reservation_url)
                    print(f"Added Flicket reservation URL: {reservation_url}")
        
        return expanded_urls
    
    async def _merge_results(self, results: List[ExtractedEventData]) -> ExtractedEventData:
        """
        Merge multiple extraction results into one with improved logic
        
        Args:
            results: List of ExtractedEventData objects
            
        Returns:
            Merged ExtractedEventData
        """
        merged = ExtractedEventData()
        
        # Description: Use LLM to select best event-specific description
        # Filter out very short descriptions (< 300 chars) as they're likely truncated meta tags
        descriptions = [r.description for r in results if r.description and len(r.description) >= 300]
        # If no long descriptions, fall back to all descriptions
        if not descriptions:
            descriptions = [r.description for r in results if r.description]
        if descriptions:
            merged.description = await self._select_best_description(descriptions)
        
        # Venue: Prefer ticketing site (last result, usually /reservation page)
        # Ticketing sites require venue as mandatory field → more reliable
        venues = [r.venue for r in results if r.venue]
        if venues:
            # Reverse order to prefer ticketing site (last URL processed)
            merged.venue = venues[-1] if venues else None
        
        # Lineup: Prefer first source (base page), add missing from others
        all_lineup = []
        seen_artists = set()
        # Process in order - first result (base page) gets priority
        for result in results:
            for artist in result.lineup:
                artist_name_lower = artist.get("name", "").lower().strip()
                if artist_name_lower and artist_name_lower not in seen_artists:
                    all_lineup.append(artist)
                    seen_artists.add(artist_name_lower)
        # Keep original ranks, don't reassign
        merged.lineup = all_lineup
        
        # Pricing: Fuzzy match to avoid duplicates, prefer ticketing site
        all_tiers = []
        for result in reversed(results):  # Reverse to prefer ticketing site (last)
            for tier in result.pricing_tiers:
                tier_name = tier.get("name", "").strip()
                if not tier_name:
                    continue
                
                # Check if similar tier already exists (fuzzy match)
                is_duplicate = False
                for existing_tier in all_tiers:
                    existing_name = existing_tier.get("name", "").strip()
                    similarity = difflib.SequenceMatcher(None, tier_name.lower(), existing_name.lower()).ratio()
                    if similarity >= 0.8:  # 80% similarity threshold
                        is_duplicate = True
                        break
                
                if not is_duplicate:
                    all_tiers.insert(0, tier)  # Insert at start to maintain order preference
        merged.pricing_tiers = all_tiers
        
        # VIP: Fuzzy match tiers, combine included items
        vip_enabled = any(r.vip_info.get("enabled", False) for r in results)
        if vip_enabled:
            merged.vip_info = {"enabled": True, "tiers": [], "included": []}
            
            # Combine VIP tiers with fuzzy matching
            for result in reversed(results):  # Prefer ticketing site
                if result.vip_info.get("enabled"):
                    for tier in result.vip_info.get("tiers", []):
                        tier_name = tier.get("name", "").strip()
                        if not tier_name:
                            continue
                        
                        # Fuzzy match check
                        is_duplicate = False
                        for existing_tier in merged.vip_info["tiers"]:
                            existing_name = existing_tier.get("name", "").strip()
                            similarity = difflib.SequenceMatcher(None, tier_name.lower(), existing_name.lower()).ratio()
                            if similarity >= 0.8:
                                is_duplicate = True
                                break
                        
                        if not is_duplicate:
                            merged.vip_info["tiers"].insert(0, tier)
            
            # Combine VIP included items (deduplicate)
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
    
    async def _select_best_description(self, descriptions: List[str]) -> str:
        """
        Use LLM to select the best event description from multiple sources
        
        Criteria: Event-specific content (not legal text, terms, generic info)
        
        Args:
            descriptions: List of description strings
            
        Returns:
            Best description string
        """
        if not descriptions:
            return ""
        
        if len(descriptions) == 1:
            return descriptions[0]
        
        # Use LLM to select best description
        try:
            llm_service = LLMService()
            prompt = f"""You are selecting the best event description from multiple sources.

Your goal: Choose the description that best describes the EVENT ITSELF - what it is, what attendees will experience, who's performing, what makes it special.

AVOID descriptions that are:
- Legal text, terms and conditions
- Generic ticket purchase instructions
- Website navigation text
- Boilerplate marketing copy

PREFER descriptions that contain:
- Specific event details (artists, lineup, activities)
- What attendees will experience
- Event-specific information
- Paragraphs or sentences about the event itself

Here are the descriptions to choose from:

{chr(10).join(f"{i+1}. {desc}" for i, desc in enumerate(descriptions))}

Return ONLY the number (1-{len(descriptions)}) of the best description. No explanation."""

            response = llm_service.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are an expert at identifying event-specific content. Return only a number."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=10
            )
            
            content = response.choices[0].message.content.strip()
            # Extract number
            import re
            match = re.search(r'\d+', content)
            if match:
                index = int(match.group()) - 1
                if 0 <= index < len(descriptions):
                    return descriptions[index]
        except Exception as e:
            print(f"Error selecting best description with LLM: {e}")
        
        # Fallback: return longest (better than random)
        return max(descriptions, key=len)
    
    def _normalize_url(self, url: str) -> str:
        """
        Normalize URL for consistent handling
        
        Args:
            url: Raw URL string
            
        Returns:
            Normalized URL
        """
        url = url.strip()
        
        # Remove query parameters (e.g., ?fbclid=, ?utm_source=)
        if "?" in url:
            url = url.split("?")[0]
        
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

