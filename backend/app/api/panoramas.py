from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from supabase import create_client, Client
from app.config import settings
from app.services.llm_service import LLMService

router = APIRouter()


class PanoramaContext(BaseModel):
    """Context for generating panorama from wizard"""
    user_id: str  # User ID from Supabase auth
    event_type: str
    event_name: str
    goals: List[str]
    learning_objectives: str
    audience: str
    timing: str
    additional_context: Optional[str] = None


class PanoramaGenerateResponse(BaseModel):
    """Response from panorama generation"""
    panorama_id: str
    questions_count: int


def get_supabase_client() -> Client:
    """Get Supabase client for backend operations"""
    if not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    # Use service role key for backend operations
    return create_client(settings.supabase_url, settings.supabase_key)


@router.post("/panoramas/generate-from-context", response_model=PanoramaGenerateResponse)
async def generate_panorama_from_context(
    context: PanoramaContext
):
    """
    Generate a panorama with questions based on event context.
    User ID is passed in the request body.
    """
    try:
        # Initialize services
        try:
            supabase = get_supabase_client()
        except Exception as e:
            print(f"Supabase initialization error: {e}")
            raise HTTPException(status_code=500, detail=f"Database configuration error: {str(e)}")
        
        try:
            llm_service = LLMService()
        except ValueError as e:
            print(f"LLM service initialization error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
        except Exception as e:
            print(f"LLM service initialization error: {e}")
            raise HTTPException(status_code=500, detail=f"LLM service error: {str(e)}")
        
        # Generate questions using LLM
        context_dict = {
            "event_type": context.event_type,
            "event_name": context.event_name,
            "goals": context.goals,
            "learning_objectives": context.learning_objectives,
            "audience": context.audience,
            "timing": context.timing,
            "additional_context": context.additional_context or ""
        }
        
        try:
            questions = llm_service.generate_survey_questions(context_dict)
        except Exception as e:
            print(f"LLM question generation error: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(e)}")
        
        if not questions:
            raise HTTPException(status_code=500, detail="Failed to generate questions (empty result)")
        
        # Create panorama
        panorama_data = {
            "owner_id": context.user_id,
            "name": context.event_name,
            "description": f"Survey for {context.event_type}: {context.event_name}",
            "status": "draft"
        }
        
        try:
            panorama_result = supabase.table("panoramas").insert(panorama_data).execute()
        except Exception as e:
            print(f"Panorama creation error: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to create panorama: {str(e)}")
        
        if not panorama_result.data or len(panorama_result.data) == 0:
            raise HTTPException(status_code=500, detail="Failed to create panorama (no data returned)")
        
        panorama_id = panorama_result.data[0]["id"]
        
        # Create questions
        questions_data = []
        for q in questions:
            question_data = {
                "panorama_id": panorama_id,
                "question_text": q["question_text"],
                "question_type": q["question_type"],
                "options": q.get("options"),
                "required": q.get("required", False),
                "order": q.get("order", len(questions_data))
            }
            questions_data.append(question_data)
        
        if questions_data:
            try:
                supabase.table("questions").insert(questions_data).execute()
            except Exception as e:
                print(f"Questions creation error: {e}")
                import traceback
                traceback.print_exc()
                # Panorama was created, so we should still return success but log the error
                print(f"Warning: Panorama {panorama_id} created but questions failed to insert")
        
        return PanoramaGenerateResponse(
            panorama_id=panorama_id,
            questions_count=len(questions)
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Unexpected error generating panorama: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate panorama: {str(e)}")

