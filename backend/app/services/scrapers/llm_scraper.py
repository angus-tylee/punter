"""LLM-based scraper for extracting event data from any website"""

import json
import re
from typing import Dict, Any, Optional
from urllib.parse import urlparse
import httpx
from openai import OpenAI

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
            
            # Clean HTML (remove scripts, styles, etc. to reduce token count)
            cleaned_html = self._clean_html(html_content)
            
            # Extract data using LLM
            extracted_data = await self._extract_with_llm(url, cleaned_html)
            
            return extracted_data
            
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
    
    async def _fetch_html(self, url: str) -> str:
        """Fetch HTML content from URL"""
        async with httpx.AsyncClient(timeout=self._timeout, follow_redirects=True) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.text
    
    def _clean_html(self, html: str, max_length: int = 50000) -> str:
        """
        Clean HTML to reduce token count while preserving important content
        
        Args:
            html: Raw HTML content
            max_length: Maximum length to keep
            
        Returns:
            Cleaned HTML string
        """
        # Remove script and style tags
        html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
        
        # Remove comments
        html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
        
        # Remove excessive whitespace
        html = re.sub(r'\s+', ' ', html)
        
        # Truncate if too long
        if len(html) > max_length:
            html = html[:max_length] + "..."
        
        return html
    
    async def _extract_with_llm(self, url: str, html: str) -> ExtractedEventData:
        """Extract event data using LLM with structured output"""
        
        system_prompt = """You are an expert at extracting event information from web pages. 
Extract the following information from the HTML content:
- Event description: A brief description of the event
- Venue: The venue name and/or location
- Lineup: List of artists/performers with their ranking (headliner = rank 1, support acts = higher ranks)
- Pricing: Regular ticket pricing tiers (name and price)
- VIP info: VIP pricing tiers and what's included (if available)

Return ONLY valid JSON matching this exact structure:
{
  "description": "string or null",
  "venue": "string or null",
  "lineup": [{"name": "string", "rank": number}],
  "pricing_tiers": [{"name": "string", "price": "string"}],
  "vip_info": {
    "enabled": boolean,
    "tiers": [{"name": "string", "price": "string"}],
    "included": ["string"]
  }
}

If information is not available, use null for strings, empty arrays for lists, and false for enabled.
Do NOT extract bar pricing or drink information - that is out of scope."""

        user_prompt = f"""Extract event information from this web page:

URL: {url}

HTML Content:
{html}

Extract: event description, venue, lineup (artists/performers with ranking), and pricing (regular and VIP tiers).
Do NOT extract bar pricing or drink information."""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3,  # Lower temperature for more consistent extraction
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

