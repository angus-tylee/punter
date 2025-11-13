"""Simple in-memory cache manager for analytics results"""
from typing import Dict, Optional, Any
from datetime import datetime, timedelta
import hashlib
import json


class AnalyticsCacheManager:
    """Simple in-memory cache for analytics results"""
    
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
    
    def _generate_key(self, panorama_id: str, cache_type: str, response_count: int) -> str:
        """Generate cache key"""
        return f"{panorama_id}:{cache_type}:{response_count}"
    
    def get(self, panorama_id: str, cache_type: str, response_count: int) -> Optional[Any]:
        """Get cached value if valid"""
        key = self._generate_key(panorama_id, cache_type, response_count)
        
        if key not in self._cache:
            return None
        
        entry = self._cache[key]
        
        # Check if expired
        if entry.get('expires_at'):
            if datetime.now() > entry['expires_at']:
                del self._cache[key]
                return None
        
        # Check if response count matches (cache invalidated if responses changed)
        if entry.get('response_count') != response_count:
            del self._cache[key]
            return None
        
        return entry.get('data')
    
    def set(self, panorama_id: str, cache_type: str, response_count: int, data: Any, ttl_seconds: int = 3600):
        """Set cached value"""
        key = self._generate_key(panorama_id, cache_type, response_count)
        
        self._cache[key] = {
            'data': data,
            'response_count': response_count,
            'expires_at': datetime.now() + timedelta(seconds=ttl_seconds),
            'created_at': datetime.now()
        }
    
    def clear(self, panorama_id: str, cache_type: Optional[str] = None):
        """Clear cache for panorama (or specific cache type)"""
        keys_to_delete = []
        for key in self._cache.keys():
            parts = key.split(':')
            if len(parts) >= 2 and parts[0] == panorama_id:
                if cache_type is None or (len(parts) >= 2 and parts[1] == cache_type):
                    keys_to_delete.append(key)
        
        for key in keys_to_delete:
            del self._cache[key]


# Global cache instance
cache_manager = AnalyticsCacheManager()

