from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from supabase import create_client, Client
from app.config import settings
from app.services.event_scraper import EventScraper

router = APIRouter()


def get_supabase_client() -> Client:
    """Get Supabase client for backend operations"""
    if not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    # Use service role key for backend operations
    return create_client(settings.supabase_url, settings.supabase_key)


class EventCreate(BaseModel):
    """Request to create an event"""
    owner_id: str
    name: str
    event_type: Optional[str] = None
    date: Optional[str] = None
    capacity: Optional[int] = None
    venue: Optional[str] = None
    event_url: Optional[str] = None
    lineup: Optional[List[Dict[str, Any]]] = None
    pricing_tiers: Optional[List[Dict[str, Any]]] = None
    vip_info: Optional[Dict[str, Any]] = None
    bar_partners: Optional[List[Dict[str, Any]]] = None
    target_market: Optional[str] = None
    current_stage: str = "early_planning"
    promoter_name: Optional[str] = None


class EventUpdate(BaseModel):
    """Request to update an event"""
    name: Optional[str] = None
    event_type: Optional[str] = None
    date: Optional[str] = None
    capacity: Optional[int] = None
    venue: Optional[str] = None
    event_url: Optional[str] = None
    lineup: Optional[List[Dict[str, Any]]] = None
    pricing_tiers: Optional[List[Dict[str, Any]]] = None
    vip_info: Optional[Dict[str, Any]] = None
    bar_partners: Optional[List[Dict[str, Any]]] = None
    target_market: Optional[str] = None
    current_stage: Optional[str] = None
    promoter_name: Optional[str] = None


@router.post("/events")
async def create_event(event: EventCreate):
    """Create a new event"""
    try:
        supabase = get_supabase_client()
        
        event_data = {
            "owner_id": event.owner_id,
            "name": event.name,
            "event_type": event.event_type,
            "date": event.date,
            "capacity": event.capacity,
            "venue": event.venue,
            "event_url": event.event_url,
            "lineup": event.lineup or [],
            "pricing_tiers": event.pricing_tiers or [],
            "vip_info": event.vip_info or {},
            "bar_partners": event.bar_partners or [],
            "target_market": event.target_market,
            "current_stage": event.current_stage,
            "promoter_name": event.promoter_name
        }
        
        result = supabase.table("events").insert(event_data).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=500, detail="Failed to create event")
        
        return result.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating event: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create event: {str(e)}")


@router.get("/events")
async def list_events(owner_id: str):
    """List all events for a user"""
    try:
        supabase = get_supabase_client()
        
        result = supabase.table("events").select("*").eq("owner_id", owner_id).order("updated_at", ascending=False).execute()
        
        return result.data or []
        
    except Exception as e:
        print(f"Error listing events: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to list events: {str(e)}")


@router.get("/events/{event_id}")
async def get_event(event_id: str):
    """Get event details"""
    try:
        supabase = get_supabase_client()
        
        result = supabase.table("events").select("*").eq("id", event_id).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Event not found")
        
        return result.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting event: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get event: {str(e)}")


@router.put("/events/{event_id}")
async def update_event(event_id: str, event_update: EventUpdate):
    """Update an event"""
    try:
        supabase = get_supabase_client()
        
        # Build update dict with only provided fields
        update_data = {}
        if event_update.name is not None:
            update_data["name"] = event_update.name
        if event_update.event_type is not None:
            update_data["event_type"] = event_update.event_type
        if event_update.date is not None:
            update_data["date"] = event_update.date
        if event_update.capacity is not None:
            update_data["capacity"] = event_update.capacity
        if event_update.venue is not None:
            update_data["venue"] = event_update.venue
        if event_update.event_url is not None:
            update_data["event_url"] = event_update.event_url
        if event_update.lineup is not None:
            update_data["lineup"] = event_update.lineup
        if event_update.pricing_tiers is not None:
            update_data["pricing_tiers"] = event_update.pricing_tiers
        if event_update.vip_info is not None:
            update_data["vip_info"] = event_update.vip_info
        if event_update.bar_partners is not None:
            update_data["bar_partners"] = event_update.bar_partners
        if event_update.target_market is not None:
            update_data["target_market"] = event_update.target_market
        if event_update.current_stage is not None:
            update_data["current_stage"] = event_update.current_stage
        if event_update.promoter_name is not None:
            update_data["promoter_name"] = event_update.promoter_name
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        result = supabase.table("events").update(update_data).eq("id", event_id).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Event not found")
        
        return result.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating event: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update event: {str(e)}")


@router.delete("/events/{event_id}")
async def delete_event(event_id: str):
    """Delete an event (soft delete)"""
    try:
        supabase = get_supabase_client()
        
        from datetime import datetime
        result = supabase.table("events").update({"deleted_at": datetime.utcnow().isoformat()}).eq("id", event_id).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Event not found")
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting event: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to delete event: {str(e)}")


class ExtractDataRequest(BaseModel):
    """Request to extract event data from URL(s)"""
    urls: List[str]  # Can accept one or multiple URLs


@router.post("/events/extract-data")
async def extract_event_data(request: ExtractDataRequest):
    """
    Extract event data from one or more URLs (description, venue, lineup, pricing)
    
    Accepts multiple URLs to improve accuracy:
    - Main event website (better for description, lineup)
    - Ticketing site (better for pricing, venue details)
    
    Uses LLM-based extraction that works with any website.
    Merges results from multiple URLs intelligently.
    Returns extracted data for user review before auto-populating form.
    """
    try:
        if not request.urls:
            raise HTTPException(status_code=400, detail="At least one URL is required")
        
        # Initialize scraper
        scraper = EventScraper()
        
        # Extract data from all URLs and merge
        if len(request.urls) == 1:
            extracted_data = await scraper.extract_from_url(request.urls[0])
        else:
            extracted_data = await scraper.extract_from_urls(request.urls)
        
        # Return as dictionary
        return extracted_data.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error extracting event data: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to extract event data: {str(e)}"
        )

