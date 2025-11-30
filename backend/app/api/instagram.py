# PULSE FEATURE - HIBERNATED
# This feature is currently hibernated due to Meta App Review requirements.
# See PULSE_HIBERNATION.md for re-enablement instructions.
# All code is intact and ready for use once App Review is completed.

from fastapi import APIRouter, HTTPException, Header, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
from supabase import create_client, Client
from app.config import settings
from app.services.instagram.client import InstagramClient
from app.services.pulse.conversation_handler import PulseConversationHandler
import hmac
import hashlib
import json

router = APIRouter()


class WebhookEvent(BaseModel):
    """Instagram webhook event structure"""
    object: str
    entry: list


def get_supabase_client() -> Client:
    """Get Supabase client for backend operations"""
    if not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(settings.supabase_url, settings.supabase_key)


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """
    Verify Instagram webhook signature.
    
    Args:
        payload: Raw request body
        signature: X-Hub-Signature-256 header value
    
    Returns:
        True if signature is valid
    """
    if not settings.instagram_app_secret:
        return False
    
    # Instagram sends signature as "sha256=<hash>"
    if not signature.startswith("sha256="):
        return False
    
    expected_signature = signature[7:]  # Remove "sha256=" prefix
    
    # Calculate HMAC
    calculated_signature = hmac.new(
        settings.instagram_app_secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    # Constant-time comparison
    return hmac.compare_digest(calculated_signature, expected_signature)


@router.get("/instagram/webhook")
async def verify_webhook(request: Request):
    """
    Webhook verification endpoint (GET request from Instagram).
    Instagram will call this to verify the webhook URL.
    """
    # Facebook sends query params with dots: hub.mode, hub.verify_token, hub.challenge
    query_params = request.query_params
    hub_mode = query_params.get("hub.mode")
    hub_verify_token = query_params.get("hub.verify_token")
    hub_challenge = query_params.get("hub.challenge")
    
    if hub_mode == "subscribe" and hub_verify_token == settings.instagram_webhook_verify_token:
        return PlainTextResponse(hub_challenge)
    else:
        raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/instagram/webhook")
async def handle_webhook(
    request: Request,
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256")
):
    """
    Handle Instagram webhook events (comments, messages, etc.).
    """
    try:
        # Get raw body for signature verification
        body = await request.body()
        
        # Verify webhook signature
        if x_hub_signature_256 and not verify_webhook_signature(body, x_hub_signature_256):
            print("Webhook signature verification failed")
            raise HTTPException(status_code=403, detail="Invalid signature")
        
        # Parse JSON payload
        data = await request.json()
        
        # Debug: Print the entire webhook payload
        print("=" * 50)
        print("WEBHOOK RECEIVED:")
        print(json.dumps(data, indent=2))
        print("=" * 50)
        
        # Process webhook events - Instagram can send different object types
        object_type = data.get("object")
        print(f"Webhook object type: {object_type}")
        
        if object_type == "instagram":
            entries = data.get("entry", [])
            print(f"Processing {len(entries)} entries")
            for entry in entries:
                await process_webhook_entry(entry)
        elif object_type == "page":  # Sometimes comments come through page webhooks
            print("Received page webhook - checking for Instagram events")
            entries = data.get("entry", [])
            for entry in entries:
                # Page webhooks might contain Instagram events
                if "instagram" in entry:
                    await process_webhook_entry(entry.get("instagram", {}))
                else:
                    await process_webhook_entry(entry)
        else:
            print(f"Unknown webhook object type: {object_type}")
            print("Attempting to process anyway...")
            entries = data.get("entry", [])
            if entries:
                for entry in entries:
                    await process_webhook_entry(entry)
        
        return {"success": True}
        
    except Exception as e:
        print(f"Error processing webhook: {e}")
        import traceback
        traceback.print_exc()
        # Return 200 to prevent Instagram from retrying
        return {"success": False, "error": str(e)}


async def process_webhook_entry(entry: Dict[str, Any]):
    """Process a single webhook entry"""
    try:
        supabase = get_supabase_client()
        instagram_client = InstagramClient()
        conversation_handler = PulseConversationHandler(supabase, instagram_client)
        
        print(f"Processing entry: {json.dumps(entry, indent=2)}")
        
        # Handle messaging events (DMs)
        messaging = entry.get("messaging", [])
        if messaging:
            print(f"Found {len(messaging)} messaging events")
            for message_event in messaging:
                await process_message_event(message_event, conversation_handler, supabase)
        
        # Handle comment events - Instagram sends them in 'changes' array
        changes = entry.get("changes", [])
        if changes:
            print(f"Found {len(changes)} changes")
            for change in changes:
                change_value = change.get("value", {})
                change_field = change.get("field", "")
                
                # Comment events have field = "comments"
                if change_field == "comments":
                    print("Processing comment change")
                    # Comment structure: change.value contains the comment data
                    comment_data = change_value
                    await process_comment_event(comment_data, conversation_handler, supabase)
        
        # Legacy: Also check for direct comments key (unlikely but keeping for compatibility)
        if "comments" in entry:
            print("Found legacy comments structure")
            comments = entry.get("comments", [])
            for comment in comments:
                await process_comment_event(comment, conversation_handler, supabase)
                
    except Exception as e:
        print(f"Error processing webhook entry: {e}")
        import traceback
        traceback.print_exc()


async def process_message_event(
    event: Dict[str, Any],
    conversation_handler: PulseConversationHandler,
    supabase: Client
):
    """Process an incoming message event"""
    try:
        sender_id = event.get("sender", {}).get("id")
        recipient_id = event.get("recipient", {}).get("id")
        message = event.get("message", {})
        message_text = message.get("text", "")
        
        if not sender_id or not message_text:
            return
        
        # Find active pulses that might be related to this conversation
        # For MVP, we'll need to track which pulse a conversation belongs to
        # This is simplified - in production, you'd need better conversation tracking
        
        # Get all active pulses
        pulses_result = supabase.table("pulses").select("id").eq("status", "active").execute()
        
        if not pulses_result.data:
            return
        
        # Try to find conversation for this user
        # In a real implementation, you'd have better conversation tracking
        for pulse in pulses_result.data:
            pulse_id = pulse["id"]
            
            # Check if there's an existing conversation
            conv_result = supabase.table("pulse_conversations").select("*").eq(
                "pulse_id", pulse_id
            ).eq("instagram_user_id", sender_id).execute()
            
            if conv_result.data:
                # Handle message in existing conversation
                result = conversation_handler.handle_incoming_message(
                    pulse_id=pulse_id,
                    instagram_user_id=sender_id,
                    instagram_username=None,  # Could extract from event if available
                    message_text=message_text
                )
                
                # Send response if needed
                if result.get("action") in ["send_question", "complete", "remind"]:
                    instagram_client = InstagramClient()
                    try:
                        instagram_client.send_dm(sender_id, result["message"])
                    except Exception as e:
                        print(f"Error sending DM response: {e}")
                
                break  # Found conversation, stop searching
                
    except Exception as e:
        print(f"Error processing message event: {e}")
        import traceback
        traceback.print_exc()


async def process_comment_event(
    comment: Dict[str, Any],
    conversation_handler: PulseConversationHandler,
    supabase: Client
):
    """Process a comment event and send DM invitation if needed"""
    try:
        print(f"Processing comment event: {json.dumps(comment, indent=2)}")
        
        # Extract comment data - Instagram comment structure varies
        # Try different possible structures
        comment_id = comment.get("id")
        
        # Post ID might be in different places
        post_id = None
        if "media" in comment:
            post_id = comment.get("media", {}).get("id")
        elif "media_id" in comment:
            post_id = comment.get("media_id")
        elif "id" in comment and comment.get("id", "").startswith("178"):  # Instagram media IDs start with 178
            post_id = comment.get("id")
        
        # User ID and username
        user_id = None
        username = None
        if "from" in comment:
            user_id = comment.get("from", {}).get("id")
            username = comment.get("from", {}).get("username")
        elif "user_id" in comment:
            user_id = comment.get("user_id")
        elif "commenter" in comment:
            user_id = comment.get("commenter", {}).get("id")
            username = comment.get("commenter", {}).get("username")
        
        comment_text = comment.get("text", "") or comment.get("message", "")
        
        print(f"Extracted - Post ID: {post_id}, User ID: {user_id}, Username: {username}, Text: {comment_text}")
        
        if not post_id or not user_id:
            print(f"Missing required data - post_id: {post_id}, user_id: {user_id}")
            return
        
        # Find pulse associated with this post
        pulse_result = supabase.table("pulses").select("id").eq(
            "instagram_post_id", post_id
        ).eq("status", "active").execute()
        
        print(f"Found {len(pulse_result.data) if pulse_result.data else 0} active pulses for post {post_id}")
        
        if not pulse_result.data or len(pulse_result.data) == 0:
            print(f"No active pulse found for post ID: {post_id}")
            return
        
        pulse_id = pulse_result.data[0]["id"]
        print(f"Sending DM invitation for pulse {pulse_id} to user {user_id}")
        
        # Send DM invitation
        result = conversation_handler.send_invitation(
            pulse_id=pulse_id,
            instagram_user_id=user_id,
            instagram_username=username
        )
        
        if not result.get("success"):
            print(f"Failed to send invitation: {result.get('error')}")
        else:
            print(f"Successfully sent invitation: {result}")
            
    except Exception as e:
        print(f"Error processing comment event: {e}")
        import traceback
        traceback.print_exc()


@router.post("/instagram/message")
async def send_message(
    recipient_id: str,
    message: str
):
    """
    Internal endpoint to send a DM (used by conversation handler).
    Requires service authentication in production.
    """
    try:
        instagram_client = InstagramClient()
        result = instagram_client.send_dm(recipient_id, message)
        return {"success": True, "result": result}
    except Exception as e:
        print(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail=str(e))
