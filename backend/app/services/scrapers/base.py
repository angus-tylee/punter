"""Base scraper interface for event data extraction"""

from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from dataclasses import dataclass


@dataclass
class ExtractedEventData:
    """Structured data extracted from event URL"""
    description: Optional[str] = None
    venue: Optional[str] = None
    lineup: List[Dict[str, Any]] = None  # List of {name: str, rank: int}
    pricing_tiers: List[Dict[str, Any]] = None  # List of {name: str, price: str}
    vip_info: Optional[Dict[str, Any]] = None  # {enabled: bool, tiers: [], included: []}
    
    def __post_init__(self):
        """Initialize default values"""
        if self.lineup is None:
            self.lineup = []
        if self.pricing_tiers is None:
            self.pricing_tiers = []
        if self.vip_info is None:
            self.vip_info = {"enabled": False, "tiers": [], "included": []}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response"""
        return {
            "description": self.description,
            "venue": self.venue,
            "lineup": self.lineup,
            "pricing_tiers": self.pricing_tiers,
            "vip_info": self.vip_info
        }
    
    def has_data(self) -> bool:
        """Check if any data was extracted"""
        return bool(
            self.description or
            self.venue or
            self.lineup or
            self.pricing_tiers or
            (self.vip_info and self.vip_info.get("enabled"))
        )


class BaseEventScraper(ABC):
    """Abstract base class for event data scrapers"""
    
    @abstractmethod
    async def extract(self, url: str) -> ExtractedEventData:
        """
        Extract event data from the given URL
        
        Args:
            url: Event website or ticketing URL
            
        Returns:
            ExtractedEventData object with extracted fields
            
        Raises:
            Exception: If extraction fails
        """
        pass
    
    @abstractmethod
    def can_handle(self, url: str) -> bool:
        """
        Check if this scraper can handle the given URL
        
        Args:
            url: URL to check
            
        Returns:
            True if this scraper can handle the URL, False otherwise
        """
        pass
    
    def get_platform_name(self) -> str:
        """
        Get the name of the platform this scraper handles
        
        Returns:
            Platform name (e.g., "LLM", "Eventbrite", "Ticketmaster")
        """
        return self.__class__.__name__

