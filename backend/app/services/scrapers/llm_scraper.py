"""LLM-based scraper for extracting event data from any website"""

import json
import re
from typing import Dict, Any, Optional, List
from urllib.parse import urlparse
import httpx
from openai import OpenAI
from playwright.async_api import async_playwright

from app.config import settings
from .base import BaseEventScraper, ExtractedEventData


class LLMScraper(BaseEventScraper):
    """LLM-based scraper that works with any website"""
    
    def __init__(self, openai_client: OpenAI):
        """
        Initialize LLM scraper
        
        Args:
            openai_client: OpenAI client instance
        """
        self.client = openai_client
        self._timeout = 30.0  # HTTP request timeout
    
    async def extract(self, url: str) -> ExtractedEventData:
        """
        Extract event data using LLM
        
        Args:
            url: Event website or ticketing URL
            
        Returns:
            ExtractedEventData with extracted fields
        """
        try:
            # Fetch HTML content
            html_content = await self._fetch_html(url)
            
            # Try static extraction first (JSON-LD, script data)
            static_data = self._extract_static_data(html_content)
            
            # Clean HTML (remove scripts, styles, etc. to reduce token count)
            cleaned_html = self._clean_html(html_content)
            
            # Extract data using LLM
            llm_data = await self._extract_with_llm(url, cleaned_html)
            
            # Merge static data with LLM data (static takes precedence for structured fields)
            merged_data = self._merge_static_and_llm(static_data, llm_data)
            
            # If pricing still missing, try pattern extraction on cleaned HTML as fallback
            if not merged_data.pricing_tiers:
                pattern_pricing = self._extract_pricing_patterns(cleaned_html)
                if pattern_pricing:
                    print(f"Found {len(pattern_pricing)} pricing tiers via pattern matching")
                    merged_data.pricing_tiers = pattern_pricing
            
            return merged_data
            
        except Exception as e:
            # Return empty data on error, but log it
            print(f"LLM extraction error for {url}: {e}")
            return ExtractedEventData()
    
    def can_handle(self, url: str) -> bool:
        """
        LLM scraper can handle any URL (used as fallback)
        
        Args:
            url: URL to check
            
        Returns:
            Always True (fallback scraper)
        """
        return True
    
    def _is_known_js_site(self, url: str) -> bool:
        """Check if URL is from a known JS-rendered site (skip httpx check)"""
        js_domains = ['flicket.co.nz', 'eventbrite.com', 'dice.fm', 'humanitix.com']
        return any(domain in url.lower() for domain in js_domains)
    
    async def _fetch_html(self, url: str) -> str:
        """Smart fetch: skip httpx for known JS sites, otherwise try httpx first"""
        # For known JS sites, go directly to Playwright (saves ~0.3s)
        if self._is_known_js_site(url):
            print(f"Known JS site, using Playwright directly: {url}")
            return await self._fetch_html_with_browser(url)
        
        # For other sites, try httpx first
        html = await self._fetch_html_simple(url)
        
        if self._needs_browser_rendering(html):
            print(f"JS-rendered page detected, using Playwright: {url}")
            html = await self._fetch_html_with_browser(url)
        
        return html
    
    async def _fetch_html_simple(self, url: str) -> str:
        """Fetch HTML content from URL using httpx (fast, for static sites)"""
        async with httpx.AsyncClient(timeout=self._timeout, follow_redirects=True) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.text
    
    async def _fetch_html_with_browser(self, url: str) -> str:
        """Fetch HTML using headless browser for JS-rendered pages"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # Block heavy resources to speed up page load
            await page.route("**/*.{png,jpg,jpeg,gif,webp,svg,ico}", lambda route: route.abort())
            await page.route("**/*.{woff,woff2,ttf,otf,eot}", lambda route: route.abort())
            await page.route("**/analytics*", lambda route: route.abort())
            await page.route("**/gtm.js*", lambda route: route.abort())
            await page.route("**/gtag*", lambda route: route.abort())
            await page.route("**/*google-analytics*", lambda route: route.abort())
            await page.route("**/*facebook*", lambda route: route.abort())
            await page.route("**/*hotjar*", lambda route: route.abort())
            
            # Use domcontentloaded (faster than networkidle)
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            
            # Wait briefly for React/JS to render content
            await page.wait_for_timeout(2000)
            
            html = await page.content()
            await browser.close()
            return html
    
    def _needs_browser_rendering(self, html: str) -> bool:
        """Detect if page is JS-rendered based on content signals"""
        body_match = re.search(r'<body[^>]*>(.*)</body>', html, re.DOTALL | re.IGNORECASE)
        body_content = body_match.group(1) if body_match else html
        
        # Count meaningful content indicators
        paragraph_count = len(re.findall(r'<p[^>]*>.*?</p>', body_content, re.DOTALL))
        has_react_shell = 'data-reactroot' in html or '__next' in html
        body_text_length = len(re.sub(r'<[^>]+>', '', body_content))
        
        # JS-rendered if: React/Next shell with minimal content
        return has_react_shell and (paragraph_count < 3 or body_text_length < 500)
    
    def _extract_static_data(self, html: str) -> ExtractedEventData:
        """
        Extract structured data from HTML before LLM processing
        
        Looks for:
        - JSON-LD structured data (Event schema)
        - JSON objects in script tags
        - Data attributes
        
        Args:
            html: Raw HTML content
            
        Returns:
            ExtractedEventData with any found structured data
        """
        data = ExtractedEventData()
        
        # Extract JSON-LD structured data
        json_ld_data = self._extract_json_ld(html)
        if json_ld_data:
            if json_ld_data.get("description"):
                data.description = json_ld_data["description"]
            if json_ld_data.get("venue"):
                data.venue = json_ld_data["venue"]
            if json_ld_data.get("pricing_tiers"):
                data.pricing_tiers = json_ld_data["pricing_tiers"]
        
        # Extract script tag data
        script_data = self._extract_script_data(html)
        if script_data:
            if script_data.get("description") and not data.description:
                data.description = script_data["description"]
            if script_data.get("venue") and not data.venue:
                data.venue = script_data["venue"]
            if script_data.get("lineup") and not data.lineup:
                data.lineup = script_data["lineup"]
            if script_data.get("pricing_tiers") and not data.pricing_tiers:
                data.pricing_tiers = script_data["pricing_tiers"]
        
        return data
    
    def _extract_json_ld(self, html: str) -> Optional[Dict[str, Any]]:
        """
        Extract JSON-LD structured data from HTML
        
        Args:
            html: HTML content
            
        Returns:
            Dictionary with extracted data or None
        """
        try:
            # Find all JSON-LD script tags
            json_ld_pattern = r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>'
            matches = re.findall(json_ld_pattern, html, re.DOTALL | re.IGNORECASE)
            
            for match in matches:
                try:
                    data = json.loads(match.strip())
                    
                    # Handle Event schema
                    if isinstance(data, dict) and data.get("@type") == "Event":
                        result = {}
                        
                        # Description
                        if "description" in data:
                            result["description"] = data["description"]
                        
                        # Venue/Location
                        if "location" in data:
                            location = data["location"]
                            if isinstance(location, dict):
                                if location.get("@type") == "Place":
                                    venue_name = location.get("name", "")
                                    address = location.get("address", {})
                                    if isinstance(address, dict):
                                        address_str = ", ".join(filter(None, [
                                            address.get("streetAddress"),
                                            address.get("addressLocality"),
                                            address.get("addressRegion"),
                                            address.get("postalCode")
                                        ]))
                                        if venue_name and address_str:
                                            result["venue"] = f"{venue_name}, {address_str}"
                                        elif venue_name:
                                            result["venue"] = venue_name
                                    elif venue_name:
                                        result["venue"] = venue_name
                        
                        # Offers (pricing)
                        if "offers" in data:
                            offers = data["offers"]
                            if isinstance(offers, dict):
                                offers = [offers]
                            
                            pricing_tiers = []
                            for offer in offers:
                                if isinstance(offer, dict):
                                    price = offer.get("price", "")
                                    currency = offer.get("priceCurrency", "")
                                    name = offer.get("name", "General Admission")
                                    
                                    if price:
                                        price_str = f"{currency} {price}".strip() if currency else str(price)
                                        pricing_tiers.append({"name": name, "price": price_str})
                            
                            if pricing_tiers:
                                result["pricing_tiers"] = pricing_tiers
                        
                        return result
                        
                except json.JSONDecodeError:
                    continue
                    
        except Exception as e:
            print(f"Error extracting JSON-LD: {e}")
        
        return None
    
    def _extract_script_data(self, html: str) -> Optional[Dict[str, Any]]:
        """
        Extract JSON data from script tags (common patterns)
        
        Args:
            html: HTML content
            
        Returns:
            Dictionary with extracted data or None
        """
        try:
            # Look for common patterns like window.__INITIAL_STATE__ or var eventData
            patterns = [
                r'window\.__INITIAL_STATE__\s*=\s*({.*?});',
                r'var\s+eventData\s*=\s*({.*?});',
                r'const\s+eventData\s*=\s*({.*?});',
                r'window\.eventData\s*=\s*({.*?});',
                r'window\.__NEXT_DATA__\s*=\s*({.*?});',  # Next.js apps
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, html, re.DOTALL)
                for match in matches:
                    try:
                        data = json.loads(match)
                        # Extract relevant fields if present
                        result = {}
                        if isinstance(data, dict):
                            if "description" in data or "eventDescription" in data:
                                result["description"] = data.get("description") or data.get("eventDescription")
                            if "venue" in data or "location" in data:
                                result["venue"] = data.get("venue") or data.get("location")
                            if "lineup" in data or "artists" in data:
                                lineup = data.get("lineup") or data.get("artists")
                                if isinstance(lineup, list):
                                    result["lineup"] = [
                                        {"name": item.get("name", str(item)), "rank": idx + 1}
                                        for idx, item in enumerate(lineup)
                                    ]
                            if "pricing" in data or "tickets" in data or "tiers" in data:
                                pricing = data.get("pricing") or data.get("tickets") or data.get("tiers")
                                if isinstance(pricing, list):
                                    result["pricing_tiers"] = [
                                        {"name": tier.get("name", tier.get("label", "Ticket")), "price": str(tier.get("price", tier.get("amount", "")))}
                                        for tier in pricing
                                    ]
                            # Also check nested structures (Next.js pattern)
                            if "props" in data and isinstance(data["props"], dict):
                                page_props = data["props"].get("pageProps", {})
                                if "event" in page_props:
                                    event_data = page_props["event"]
                                    if isinstance(event_data, dict):
                                        if "description" in event_data and not result.get("description"):
                                            result["description"] = event_data["description"]
                                        if "pricing" in event_data or "tickets" in event_data:
                                            pricing = event_data.get("pricing") or event_data.get("tickets")
                                            if isinstance(pricing, list) and not result.get("pricing_tiers"):
                                                result["pricing_tiers"] = [
                                                    {"name": tier.get("name", tier.get("label", "Ticket")), "price": str(tier.get("price", tier.get("amount", "")))}
                                                    for tier in pricing
                                                ]
                                
                            
                            if result:
                                return result
                    except json.JSONDecodeError:
                        continue
                        
        except Exception as e:
            print(f"Error extracting script data: {e}")
        
        return None
    
    def _format_price(self, price: str) -> str:
        """
        Format price string to ensure consistent format with 2 decimal places
        
        Args:
            price: Price string (may or may not have decimals)
            
        Returns:
            Formatted price string with 2 decimal places
        """
        price = price.strip()
        if '.' not in price:
            return f"{price}.00"
        else:
            parts = price.split('.')
            if len(parts) == 2:
                if len(parts[1]) == 1:
                    return f"{parts[0]}.{parts[1]}0"
                elif len(parts[1]) > 2:
                    return f"{parts[0]}.{parts[1][:2]}"
            return price
    
    def _extract_pricing_patterns(self, html: str) -> Optional[List[Dict[str, Any]]]:
        """
        Extract pricing tiers using pattern matching (fallback for LLM)
        
        Looks for tier names followed by prices within reasonable distance.
        Example: "Earlybird $149.00" or "Second Release $159.00"
        
        Args:
            html: HTML content
            
        Returns:
            List of pricing tiers or None
        """
        pricing_tiers = []
        
        try:
            # Simple pattern: tier name followed by price within reasonable distance
            # This catches cases where they're in separate elements
            pattern = r'([A-Za-z][A-Za-z\s]{2,30}(?:Release|Earlybird|Bird|Tier|Admission|GA|VIP|VVIP|General|Second|Third|Final|First|Early)[A-Za-z\s]*(?:\s+Release|\s+Tier)?).{0,100}?\$(\d+\.?\d{0,2})'
            matches = re.findall(pattern, html, re.IGNORECASE | re.DOTALL)
            
            for match in matches:
                tier_name = match[0].strip()
                price = match[1].strip()
                
                # Clean up tier name
                tier_name = re.sub(r'\s+', ' ', tier_name).strip()
                
                # Skip if too short or looks like noise
                if len(tier_name) < 3 or len(tier_name) > 50:
                    continue
                
                # Format price using helper
                formatted_price = self._format_price(price)
                
                pricing_tiers.append({
                    "name": tier_name,
                    "price": f"${formatted_price}"
                })
            
            # Remove duplicates by name (case-insensitive)
            if pricing_tiers:
                seen = set()
                unique_tiers = []
                for tier in pricing_tiers:
                    name_lower = tier["name"].lower()
                    if name_lower not in seen:
                        seen.add(name_lower)
                        unique_tiers.append(tier)
                return unique_tiers
                
        except Exception as e:
            print(f"Error in pattern-based pricing extraction: {e}")
        
        return None
    
    def _merge_static_and_llm(self, static_data: ExtractedEventData, llm_data: ExtractedEventData) -> ExtractedEventData:
        """
        Merge static extraction with LLM extraction
        
        Static data takes precedence for structured fields (pricing, venue)
        LLM data fills in gaps (description, lineup)
        
        Args:
            static_data: Data from static extraction
            llm_data: Data from LLM extraction
            
        Returns:
            Merged ExtractedEventData
        """
        merged = ExtractedEventData()
        
        # Description: Prefer LLM, fall back to static
        merged.description = llm_data.description or static_data.description
        
        # Venue: Prefer static (more reliable if found)
        merged.venue = static_data.venue or llm_data.venue
        
        # Lineup: Combine both, prefer LLM
        all_lineup = []
        seen_artists = set()
        # Add LLM lineup first
        for artist in llm_data.lineup:
            name_lower = artist.get("name", "").lower().strip()
            if name_lower and name_lower not in seen_artists:
                all_lineup.append(artist)
                seen_artists.add(name_lower)
        # Add static lineup if not already present
        for artist in static_data.lineup:
            name_lower = artist.get("name", "").lower().strip()
            if name_lower and name_lower not in seen_artists:
                all_lineup.append(artist)
                seen_artists.add(name_lower)
        merged.lineup = all_lineup
        
        # Pricing: Prefer static (more accurate if found)
        merged.pricing_tiers = static_data.pricing_tiers or llm_data.pricing_tiers
        
        # VIP: Prefer LLM (more comprehensive)
        if llm_data.vip_info.get("enabled"):
            merged.vip_info = llm_data.vip_info
        elif static_data.vip_info.get("enabled"):
            merged.vip_info = static_data.vip_info
        else:
            merged.vip_info = {"enabled": False, "tiers": [], "included": []}
        
        return merged
    
    def _clean_html(self, html: str, max_length: int = 80000) -> str:
        """
        Clean HTML to reduce token count while preserving important content
        
        Args:
            html: Raw HTML content
            max_length: Maximum length to keep (increased to preserve pricing sections)
            
        Returns:
            Cleaned HTML string
        """
        # Remove script and style tags (but preserve JSON-LD which we extract separately)
        # First, extract JSON-LD to preserve it
        json_ld_pattern = r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>.*?</script>'
        json_ld_matches = re.findall(json_ld_pattern, html, re.DOTALL | re.IGNORECASE)
        
        # Remove all script tags
        html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
        
        # Remove comments
        html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
        
        # Remove excessive whitespace
        html = re.sub(r'\s+', ' ', html)
        
        # Simple truncation if too long
        if len(html) > max_length:
            html = html[:max_length] + "..."
        
        return html
    
    async def _extract_with_llm(self, url: str, html: str) -> ExtractedEventData:
        """Extract event data using LLM with structured output"""
        
        system_prompt = """You are an expert at extracting event information from web pages.

Extract:
- description: Full event description (what it's about, who's performing, what to expect)
- venue: Venue name and location
- lineup: Artists/performers with ranking (headliner = rank 1)
- pricing_tiers: Ticket tiers with names and prices (e.g., "Earlybird", "GA", "VIP")
- vip_info: VIP options and what's included

Return JSON:
{
  "description": "string or null",
  "venue": "string or null",
  "lineup": [{"name": "string", "rank": number}],
  "pricing_tiers": [{"name": "string", "price": "string"}],
  "vip_info": {"enabled": boolean, "tiers": [...], "included": [...]}
}

Do NOT extract bar/drink pricing."""

        user_prompt = f"""Extract event info from: {url}

HTML:
{html}"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=2000
            )
            
            content = response.choices[0].message.content
            if not content:
                return ExtractedEventData()
            
            # Parse JSON response
            data = json.loads(content)
            
            # Convert to ExtractedEventData
            return ExtractedEventData(
                description=data.get("description"),
                venue=data.get("venue"),
                lineup=data.get("lineup", []),
                pricing_tiers=data.get("pricing_tiers", []),
                vip_info=data.get("vip_info", {"enabled": False, "tiers": [], "included": []})
            )
            
        except json.JSONDecodeError as e:
            print(f"Failed to parse LLM JSON response: {e}")
            return ExtractedEventData()
        except Exception as e:
            print(f"LLM extraction error: {e}")
            return ExtractedEventData()

