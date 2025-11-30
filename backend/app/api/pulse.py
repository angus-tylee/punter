# PULSE FEATURE - HIBERNATED
# This feature is currently hibernated due to Meta App Review requirements.
# See PULSE_HIBERNATION.md for re-enablement instructions.
# All code is intact and ready for use once App Review is completed.

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Union
from supabase import create_client, Client
from app.config import settings
from app.services.pulse_question_generator import PulseQuestionGenerator
import re
import uuid

router = APIRouter()


class PulseContext(BaseModel):
    """Context for generating Pulse from wizard"""
    user_id: str  # User ID from Supabase auth
    event_type: str
    event_name: str
    goals: List[str]
    learning_objectives: str
    audience: str
    timing: str
    instagram_post_url: str
    additional_context: Optional[str] = None


class StagingPulseQuestion(BaseModel):
    """Question structure for staging"""
    question_text: str
    question_type: str
    options: Optional[List[str]] = None
    required: bool = False
    order: int = 0


class PulseGenerateResponse(BaseModel):
    """Response from Pulse generation"""
    pulse_id: str
    questions_count: int
    questions: List[StagingPulseQuestion]


class SavePulseQuestionsRequest(BaseModel):
    """Request to save questions to Pulse"""
    questions: List[StagingPulseQuestion]


def get_supabase_client() -> Client:
    """Get Supabase client for backend operations"""
    if not settings.supabase_url or not settings.supabase_key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    # Use service role key for backend operations
    return create_client(settings.supabase_url, settings.supabase_key)


def extract_instagram_post_id(url: str) -> str:
    """Extract Instagram post ID from URL"""
    # Instagram post URLs can be in various formats:
    # https://www.instagram.com/p/ABC123/
    # https://www.instagram.com/reel/ABC123/
    # https://instagram.com/p/ABC123/
    
    patterns = [
        r'instagram\.com/p/([A-Za-z0-9_-]+)',
        r'instagram\.com/reel/([A-Za-z0-9_-]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    raise ValueError("Invalid Instagram post URL. Expected format: https://www.instagram.com/p/POST_ID/")


@router.post("/pulse/generate-from-context", response_model=PulseGenerateResponse)
async def generate_pulse_from_context(
    context: PulseContext
):
    """
    Generate a Pulse with questions based on event context.
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
            question_generator = PulseQuestionGenerator()
        except ValueError as e:
            print(f"Question generator initialization error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
        except Exception as e:
            print(f"Question generator initialization error: {e}")
            raise HTTPException(status_code=500, detail=f"Question generator error: {str(e)}")
        
        # Extract Instagram post ID from URL
        try:
            instagram_post_id = extract_instagram_post_id(context.instagram_post_url)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
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
            questions = question_generator.generate_pulse_questions(context_dict)
        except Exception as e:
            print(f"LLM question generation error: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(e)}")
        
        if not questions:
            raise HTTPException(status_code=500, detail="Failed to generate questions (empty result)")
        
        # Create Pulse
        pulse_data = {
            "owner_id": context.user_id,
            "name": context.event_name,
            "description": f"Pulse survey for {context.event_type}: {context.event_name}",
            "instagram_post_url": context.instagram_post_url,
            "instagram_post_id": instagram_post_id,
            "status": "draft",
            "context": context_dict
        }
        
        try:
            pulse_result = supabase.table("pulses").insert(pulse_data).execute()
        except Exception as e:
            print(f"Pulse creation error: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to create Pulse: {str(e)}")
        
        if not pulse_result.data or len(pulse_result.data) == 0:
            raise HTTPException(status_code=500, detail="Failed to create Pulse (no data returned)")
        
        pulse_id = pulse_result.data[0]["id"]
        
        # Prepare questions for staging (DO NOT save to database yet)
        staging_questions = []
        for i, q in enumerate(questions):
            staging_question = StagingPulseQuestion(
                question_text=q["question_text"],
                question_type=q["question_type"],
                options=q.get("options"),
                required=q.get("required", False),
                order=q.get("order", i)
            )
            staging_questions.append(staging_question)
        
        return PulseGenerateResponse(
            pulse_id=pulse_id,
            questions_count=len(questions),
            questions=staging_questions
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Unexpected error generating Pulse: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate Pulse: {str(e)}")


@router.post("/pulse/{pulse_id}/save-questions")
async def save_pulse_questions(
    pulse_id: str,
    request: SavePulseQuestionsRequest
):
    """
    Save questions to a Pulse after staging review.
    """
    try:
        supabase = get_supabase_client()
        
        # Verify Pulse exists and user has access
        pulse_result = supabase.table("pulses").select("id, owner_id").eq("id", pulse_id).execute()
        
        if not pulse_result.data or len(pulse_result.data) == 0:
            raise HTTPException(status_code=404, detail="Pulse not found")
        
        # Prepare questions data
        questions_data = []
        for i, q in enumerate(request.questions):
            question_data = {
                "pulse_id": pulse_id,
                "question_text": q.question_text,
                "question_type": q.question_type,
                "options": q.options,
                "required": q.required,
                "order": i
            }
            questions_data.append(question_data)
        
        if not questions_data:
            raise HTTPException(status_code=400, detail="No questions provided")
        
        # Insert questions
        try:
            supabase.table("pulse_questions").insert(questions_data).execute()
        except Exception as e:
            print(f"Questions creation error: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to save questions: {str(e)}")
        
        return {
            "success": True,
            "questions_saved": len(questions_data)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error saving Pulse questions: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to save questions: {str(e)}")


@router.get("/pulse/{pulse_id}/responses")
async def get_pulse_responses(pulse_id: str):
    """
    Get all responses for a Pulse with summary statistics.
    """
    try:
        supabase = get_supabase_client()
        
        # Verify Pulse exists
        pulse_result = supabase.table("pulses").select("id, name").eq("id", pulse_id).execute()
        if not pulse_result.data or len(pulse_result.data) == 0:
            raise HTTPException(status_code=404, detail="Pulse not found")
        
        # Get questions
        questions_result = supabase.table("pulse_questions").select("*").eq("pulse_id", pulse_id).order("order").execute()
        questions = questions_result.data if questions_result.data else []
        
        # Get responses
        responses_result = supabase.table("pulse_responses").select("*").eq("pulse_id", pulse_id).order("created_at", desc=True).execute()
        responses = responses_result.data if responses_result.data else []
        
        # Get conversations
        conversations_result = supabase.table("pulse_conversations").select("*").eq("pulse_id", pulse_id).execute()
        conversations = conversations_result.data if conversations_result.data else []
        
        # Calculate summary statistics
        total_responses = len(responses)
        unique_submissions = len(set(r["submission_id"] for r in responses))
        completed_conversations = len([c for c in conversations if c["status"] == "completed"])
        total_conversations = len(conversations)
        completion_rate = (completed_conversations / total_conversations * 100) if total_conversations > 0 else 0
        
        # Group responses by question
        responses_by_question = {}
        for response in responses:
            question_id = response["question_id"]
            if question_id not in responses_by_question:
                responses_by_question[question_id] = []
            responses_by_question[question_id].append(response)
        
        return {
            "pulse_id": pulse_id,
            "questions": questions,
            "responses": responses,
            "conversations": conversations,
            "summary": {
                "total_responses": total_responses,
                "unique_submissions": unique_submissions,
                "completed_conversations": completed_conversations,
                "total_conversations": total_conversations,
                "completion_rate": round(completion_rate, 2),
                "responses_by_question": responses_by_question
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error getting Pulse responses: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get responses: {str(e)}")
