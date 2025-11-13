"""Analytics API endpoints"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
from supabase import create_client, Client
from app.config import settings
from app.services.llm_service import LLMService
from app.services.analytics.summary_generator import SummaryGenerator
from app.services.analytics.cache_manager import cache_manager
from app.api.panoramas import get_supabase_client

router = APIRouter()


class SummaryRequest(BaseModel):
    """Request for generating summary"""
    panorama: Dict[str, Any]
    questions: List[Dict[str, Any]]
    aggregated_stats: Dict[str, Any]
    text_samples: Dict[str, List[str]]
    response_count: int


class SummaryResponse(BaseModel):
    """Response with summary"""
    summary: str
    keyMetrics: List[Dict[str, Any]]


@router.post("/panoramas/{panorama_id}/analytics/summary", response_model=SummaryResponse)
async def get_analytics_summary(
    panorama_id: str,
    request: SummaryRequest
):
    """
    Generate LLM-powered executive summary for panorama analytics.
    Frontend sends pre-aggregated data; backend generates narrative summary.
    Results are cached based on response count.
    """
    try:
        # Check cache first
        cached = cache_manager.get(
            panorama_id=panorama_id,
            cache_type="summary",
            response_count=request.response_count
        )
        
        if cached:
            return SummaryResponse(**cached)
        
        # Verify panorama exists
        supabase = get_supabase_client()
        panorama_result = supabase.table("panoramas").select("id, name, description").eq("id", panorama_id).execute()
        
        if not panorama_result.data or len(panorama_result.data) == 0:
            raise HTTPException(status_code=404, detail="Panorama not found")
        
        # Get full panorama data
        panorama_data = panorama_result.data[0]
        if not request.panorama.get("name"):
            request.panorama["name"] = panorama_data.get("name", "Event")
        
        # Initialize services
        try:
            llm_service = LLMService()
        except ValueError as e:
            raise HTTPException(status_code=500, detail=str(e))
        
        summary_generator = SummaryGenerator(llm_service)
        
        # Generate summary
        result = await summary_generator.generate_summary(
            panorama=request.panorama,
            questions=request.questions,
            aggregated_stats=request.aggregated_stats,
            text_samples=request.text_samples,
            response_count=request.response_count
        )
        
        # Cache result
        cache_manager.set(
            panorama_id=panorama_id,
            cache_type="summary",
            response_count=request.response_count,
            data=result,
            ttl_seconds=3600  # 1 hour
        )
        
        return SummaryResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating analytics summary: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")

