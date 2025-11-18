from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Union
from supabase import create_client, Client
from app.config import settings
from app.services.llm_service import LLMService
import csv
import io
import re
import json
from datetime import datetime

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


class StagingQuestion(BaseModel):
    """Question structure for staging"""
    question_text: str
    question_type: str
    options: Optional[Union[List[str], dict]] = None  # Can be list of strings or dict for budget-allocation
    required: bool = False
    order: int = 0


class PanoramaGenerateResponse(BaseModel):
    """Response from panorama generation"""
    panorama_id: str
    questions_count: int
    questions: List[StagingQuestion]


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
        
        # Prepare questions for staging (DO NOT save to database yet)
        staging_questions = []
        for i, q in enumerate(questions):
            staging_question = StagingQuestion(
                question_text=q["question_text"],
                question_type=q["question_type"],
                options=q.get("options"),
                required=q.get("required", False),
                order=q.get("order", i)
            )
            staging_questions.append(staging_question)
        
        return PanoramaGenerateResponse(
            panorama_id=panorama_id,
            questions_count=len(questions),
            questions=staging_questions
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


class SaveQuestionsRequest(BaseModel):
    """Request to save questions to panorama"""
    questions: List[StagingQuestion]


@router.post("/panoramas/{panorama_id}/save-questions")
async def save_questions(
    panorama_id: str,
    request: SaveQuestionsRequest
):
    """
    Save questions to a panorama after staging review.
    """
    try:
        supabase = get_supabase_client()
        
        # Verify panorama exists and user has access
        panorama_result = supabase.table("panoramas").select("id, owner_id").eq("id", panorama_id).execute()
        
        if not panorama_result.data or len(panorama_result.data) == 0:
            raise HTTPException(status_code=404, detail="Panorama not found")
        
        # Prepare questions data
        questions_data = []
        for q in request.questions:
            question_data = {
                "panorama_id": panorama_id,
                "question_text": q.question_text,
                "question_type": q.question_type,
                "options": q.options,
                "required": q.required,
                "order": q.order
            }
            questions_data.append(question_data)
        
        if not questions_data:
            raise HTTPException(status_code=400, detail="No questions provided")
        
        # Insert questions
        try:
            supabase.table("questions").insert(questions_data).execute()
        except Exception as e:
            print(f"Questions creation error: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to save questions: {str(e)}")
        
        return {"success": True, "questions_saved": len(questions_data)}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error saving questions: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to save questions: {str(e)}")


def generate_slug(text: str) -> str:
    """Generate a URL-friendly slug from text"""
    # Convert to lowercase
    slug = text.lower()
    # Replace spaces and special characters with underscores
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[-\s]+', '_', slug)
    # Remove leading/trailing underscores
    slug = slug.strip('_')
    return slug


@router.get("/panoramas/{panorama_id}/export/csv")
async def export_panorama_csv(panorama_id: str):
    """
    Export all responses for a panorama as CSV.
    Returns a streaming CSV response with all response data.
    """
    try:
        supabase = get_supabase_client()
        
        # Verify panorama exists
        panorama_result = supabase.table("panoramas").select("id, name").eq("id", panorama_id).execute()
        
        if not panorama_result.data or len(panorama_result.data) == 0:
            raise HTTPException(status_code=404, detail="Panorama not found")
        
        panorama_name = panorama_result.data[0]["name"]
        
        # Fetch all questions ordered by order field
        questions_result = supabase.table("questions").select("id, question_text, question_type, options, order").eq("panorama_id", panorama_id).order("order", ascending=True).execute()
        
        if not questions_result.data:
            raise HTTPException(status_code=400, detail="No questions found for this panorama")
        
        questions = questions_result.data
        
        # Fetch all responses
        responses_result = supabase.table("responses").select("id, question_id, submission_id, response_text, respondent_id, created_at").eq("panorama_id", panorama_id).order("created_at", ascending=True).execute()
        
        responses = responses_result.data if responses_result.data else []
        
        # If no responses, return empty CSV with headers
        if not responses:
            # Create empty CSV with headers
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write headers
            headers = ["submission_id", "submitted_at", "respondent_id"]
            for q in questions:
                slug = generate_slug(q["question_text"])
                headers.append(f"question_{q['id']}_{slug}")
            writer.writerow(headers)
            
            output.seek(0)
            filename = f"{panorama_name}_results_{datetime.now().strftime('%Y-%m-%d')}.csv"
            
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv; charset=utf-8",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "Content-Type": "text/csv; charset=utf-8"
                }
            )
        
        # Group responses by submission_id
        submissions: dict = {}
        for response in responses:
            submission_id = response["submission_id"]
            if submission_id not in submissions:
                submissions[submission_id] = {
                    "submission_id": submission_id,
                    "submitted_at": response["created_at"],
                    "respondent_id": response.get("respondent_id") or "",
                    "responses": {}
                }
            
            question_id = response["question_id"]
            if question_id not in submissions[submission_id]["responses"]:
                submissions[submission_id]["responses"][question_id] = []
            
            submissions[submission_id]["responses"][question_id].append(response)
        
        # Create CSV
        output = io.StringIO()
        # Add UTF-8 BOM for Excel compatibility
        output.write('\ufeff')
        writer = csv.writer(output)
        
        # Write headers
        headers = ["submission_id", "submitted_at", "respondent_id"]
        question_map = {}
        for q in questions:
            slug = generate_slug(q["question_text"])
            column_name = f"question_{q['id']}_{slug}"
            headers.append(column_name)
            question_map[q["id"]] = {
                "column": column_name,
                "type": q["question_type"],
                "options": q.get("options")
            }
        writer.writerow(headers)
        
        # Write data rows
        for submission_id, submission_data in submissions.items():
            row = [
                submission_data["submission_id"],
                submission_data["submitted_at"],
                submission_data["respondent_id"] or ""
            ]
            
            # Add answer for each question
            for q in questions:
                question_id = q["id"]
                question_responses = submission_data["responses"].get(question_id, [])
                
                if not question_responses:
                    row.append("")
                else:
                    question_info = question_map[question_id]
                    question_type = question_info["type"]
                    
                    if question_type == "Multi-select":
                        # Combine multiple responses with comma delimiter
                        values = [r["response_text"] for r in question_responses]
                        row.append(", ".join(values))
                    elif question_type == "budget-allocation":
                        # Format budget allocation as readable string
                        try:
                            # Get the first response (should only be one for budget-allocation)
                            response_text = question_responses[0]["response_text"]
                            if response_text:
                                allocation = json.loads(response_text) if isinstance(response_text, str) else response_text
                                options = question_info["options"]
                                if options and isinstance(options, dict) and "artists" in options:
                                    artist_list = options["artists"]
                                    formatted = []
                                    if isinstance(allocation, dict):
                                        for artist_id, amount in allocation.items():
                                            artist = next((a for a in artist_list if a.get("id") == artist_id), None)
                                            if artist:
                                                formatted.append(f"{artist.get('name', 'Unknown')}: ${amount}")
                                            else:
                                                formatted.append(f"Unknown: ${amount}")
                                    row.append(", ".join(formatted) if formatted else response_text)
                                else:
                                    # Fallback to JSON string
                                    row.append(response_text)
                            else:
                                row.append("")
                        except:
                            # If parsing fails, use raw text
                            row.append(question_responses[0]["response_text"])
                    else:
                        # Single value (text, textarea, Single-select, Likert)
                        row.append(question_responses[0]["response_text"])
            
            writer.writerow(row)
        
        output.seek(0)
        filename = f"{panorama_name}_results_{datetime.now().strftime('%Y-%m-%d')}.csv"
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Type": "text/csv; charset=utf-8"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error exporting CSV: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to export CSV: {str(e)}")

