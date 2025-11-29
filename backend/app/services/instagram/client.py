import requests
from typing import Optional, Dict, Any
from app.config import settings


class InstagramClient:
    """Client for Instagram Graph API interactions"""
    
    def __init__(self):
        if not settings.instagram_access_token:
            raise ValueError("INSTAGRAM_ACCESS_TOKEN not configured")
        self.access_token = settings.instagram_access_token
        self.base_url = "https://graph.instagram.com"
    
    def send_dm(self, recipient_id: str, message: str) -> Dict[str, Any]:
        """
        Send a direct message to an Instagram user.
        
        Args:
            recipient_id: Instagram user ID (Instagram Business Account ID)
            message: Message text to send
        
        Returns:
            API response dictionary
        """
        # Note: Instagram Graph API DM sending requires:
        # 1. Instagram Business/Creator account
        # 2. Page access token with instagram_manage_messages permission
        # 3. User must have an existing conversation or be a follower
        
        url = f"{self.base_url}/v18.0/{settings.instagram_test_account_id}/messages"
        
        payload = {
            "recipient": {"id": recipient_id},
            "message": {"text": message}
        }
        
        params = {
            "access_token": self.access_token
        }
        
        response = requests.post(url, json=payload, params=params)
        response.raise_for_status()
        return response.json()
    
    def get_post_id_from_url(self, post_url: str) -> Optional[str]:
        """
        Extract post ID from Instagram URL.
        This is a helper method - actual extraction should be done via regex in the API layer.
        """
        # This is handled by extract_instagram_post_id in pulse.py
        # Keeping this for potential future use if we need to validate via API
        pass
    
    def get_post_info(self, post_id: str) -> Dict[str, Any]:
        """
        Get information about an Instagram post.
        
        Args:
            post_id: Instagram post ID
        
        Returns:
            Post information dictionary
        """
        url = f"{self.base_url}/v18.0/{post_id}"
        
        params = {
            "fields": "id,permalink,caption,media_type,timestamp",
            "access_token": self.access_token
        }
        
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()

