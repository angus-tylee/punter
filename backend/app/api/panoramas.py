from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Union
from supabase import create_client, Client
from app.config import settings
from app.services.llm_service import LLMService
from app.services.universal_questions import get_universal_questions
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
    Automatically prepends universal questions.
    """
    try:
        supabase = get_supabase_client()
        
        # Verify panorama exists and user has access, fetch config
        panorama_result = supabase.table("panoramas").select("id, owner_id, universal_questions_config").eq("id", panorama_id).execute()
        
        if not panorama_result.data or len(panorama_result.data) == 0:
            raise HTTPException(status_code=404, detail="Panorama not found")
        
        panorama = panorama_result.data[0]
        config = panorama.get("universal_questions_config", {}) or {}
        
        # Delete existing universal questions for this panorama
        try:
            supabase.table("questions").delete().eq("panorama_id", panorama_id).eq("is_universal", True).execute()
        except Exception as e:
            print(f"Warning: Error deleting existing universal questions: {e}")
        
        # Generate universal questions
        universal_questions = get_universal_questions(panorama_id, config)
        
        # Prepare universal questions data
        universal_questions_data = []
        for q in universal_questions:
            universal_questions_data.append({
                "panorama_id": panorama_id,
                "question_text": q["question_text"],
                "question_type": q["question_type"],
                "options": q.get("options"),
                "required": q["required"],
                "order": q["order"],
                "is_universal": True
            })
        
        # Prepare LLM-generated questions data, adjusting order to start at 0
        llm_questions_data = []
        for i, q in enumerate(request.questions):
            question_data = {
                "panorama_id": panorama_id,
                "question_text": q.question_text,
                "question_type": q.question_type,
                "options": q.options,
                "required": q.required,
                "order": i,  # Start at 0, universal questions have negative orders
                "is_universal": False
            }
            llm_questions_data.append(question_data)
        
        # Combine all questions (universal first, then LLM)
        all_questions_data = universal_questions_data + llm_questions_data
        
        # Allow saving even if only universal questions (no LLM questions yet)
        if not all_questions_data:
            raise HTTPException(status_code=400, detail="No questions provided")
        
        # If only universal questions, that's fine - they'll be created
        if not llm_questions_data and universal_questions_data:
            # Just insert universal questions
            try:
                supabase.table("questions").insert(universal_questions_data).execute()
            except Exception as e:
                print(f"Questions creation error: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Failed to save universal questions: {str(e)}")
            
            return {
                "success": True,
                "questions_saved": len(universal_questions_data),
                "universal_questions": len(universal_questions_data),
                "llm_questions": 0
            }
        
        # Insert all questions
        try:
            supabase.table("questions").insert(all_questions_data).execute()
        except Exception as e:
            print(f"Questions creation error: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to save questions: {str(e)}")
        
        return {
            "success": True,
            "questions_saved": len(all_questions_data),
            "universal_questions": len(universal_questions_data),
            "llm_questions": len(llm_questions_data)
        }
        
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


def format_timestamp(timestamp_str: str) -> str:
    """Format ISO timestamp to human-readable format that still works for date/time columns"""
    try:
        # Handle different timestamp formats
        ts = timestamp_str.strip()
        
        # Replace Z with +00:00 for timezone handling (Python's fromisoformat needs explicit timezone)
        if ts.endswith('Z'):
            ts = ts[:-1] + '+00:00'
        
        # Parse ISO format timestamp (handles both with and without timezone)
        dt = datetime.fromisoformat(ts)
        
        # Format as YYYY-MM-DD HH:MM:SS (works well in Excel/Sheets as date-time)
        # This format is recognized by Excel and Google Sheets as a date-time column
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except Exception as e:
        # If parsing fails, return original
        print(f"Error formatting timestamp {timestamp_str}: {e}")
        return timestamp_str


def format_question_header(question_text: str) -> str:
    """Convert question text to human-readable header without underscores"""
    # Remove trailing question marks and whitespace
    header = question_text.strip().rstrip('?')
    # Replace underscores with spaces
    header = header.replace('_', ' ')
    # Capitalize first letter of each word
    return ' '.join(word.capitalize() for word in header.split())


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
        questions_result = supabase.table("questions").select("id, question_text, question_type, options, order, is_universal").eq("panorama_id", panorama_id).order("order").execute()
        
        if not questions_result.data:
            raise HTTPException(status_code=400, detail="No questions found for this panorama")
        
        all_questions = questions_result.data
        
        # Separate universal and main questions
        universal_questions = [q for q in all_questions if q.get("is_universal", False)]
        main_questions = [q for q in all_questions if not q.get("is_universal", False)]
        
        # Map universal question texts to friendly column names
        universal_column_map = {
            "First Name": "First Name",
            "Last Name": "Last Name",
            "Email Address": "Email",
            "Phone Number": "Phone",
            "Where is your home base / where did you grow up?": "Home Base",
            "Where do you currently live?": "Current Location",
            "Age bracket": "Age Bracket",
            "Occupation / Field of Work": "Occupation"
        }
        
        # Fetch all responses
        responses_result = supabase.table("responses").select("id, question_id, submission_id, response_text, respondent_id, created_at").eq("panorama_id", panorama_id).order("created_at").execute()
        
        responses = responses_result.data if responses_result.data else []
        
        # If no responses, return empty CSV with headers
        if not responses:
            # Create empty CSV with headers
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write headers
            headers = ["Submission ID", "Submitted At", "Respondent ID"]
            # Add universal question columns
            for q in universal_questions:
                column_name = universal_column_map.get(q["question_text"], format_question_header(q["question_text"]))
                headers.append(column_name)
            # Add main survey question columns
            for q in main_questions:
                header = format_question_header(q["question_text"])
                headers.append(header)
            writer.writerow(headers)
            
            output.seek(0)
            # Sanitize panorama name for filename (remove special characters)
            safe_name = re.sub(r'[^\w\s-]', '', panorama_name).strip()
            safe_name = re.sub(r'[-\s]+', '_', safe_name)
            filename = f"{safe_name}_results_{datetime.now().strftime('%Y-%m-%d')}.csv"
            
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
        headers = ["Submission ID", "Submitted At", "Respondent ID"]
        question_map = {}
        
        # Add universal question columns
        for q in universal_questions:
            column_name = universal_column_map.get(q["question_text"], format_question_header(q["question_text"]))
            headers.append(column_name)
            question_map[q["id"]] = {
                "column": column_name,
                "type": q["question_type"],
                "options": q.get("options"),
                "question_text": q["question_text"]
            }
        
        # Add main survey question columns
        for q in main_questions:
            header = format_question_header(q["question_text"])
            headers.append(header)
            question_map[q["id"]] = {
                "column": header,
                "type": q["question_type"],
                "options": q.get("options"),
                "question_text": q["question_text"]
            }
        writer.writerow(headers)
        
        # Write data rows
        for submission_id, submission_data in submissions.items():
            row = [
                submission_data["submission_id"],
                format_timestamp(submission_data["submitted_at"]),
                submission_data["respondent_id"] or ""
            ]
            
            # Add answer for each question (universal first, then main)
            for q in universal_questions + main_questions:
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
                        # Format budget allocation alphabetically by artist name, including $0 for unselected artists
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
                                        # Create a map of all artists with their amounts (default to 0)
                                        artist_amounts = {}
                                        for artist in artist_list:
                                            artist_id = artist.get("id")
                                            artist_name = artist.get("name", "Unknown")
                                            # Get amount from allocation if artist was selected, otherwise 0
                                            amount = allocation.get(artist_id, 0)
                                            artist_amounts[artist_name] = amount
                                        
                                        # Sort alphabetically by artist name
                                        sorted_artists = sorted(artist_amounts.items())
                                        
                                        # Format as "Artist Name: $amount"
                                        formatted = [f"{name}: ${amount}" for name, amount in sorted_artists]
                                    
                                    row.append(", ".join(formatted) if formatted else response_text)
                                else:
                                    # Fallback to JSON string
                                    row.append(response_text)
                            else:
                                # No response - show all artists with $0
                                options = question_info["options"]
                                if options and isinstance(options, dict) and "artists" in options:
                                    artist_list = options["artists"]
                                    formatted = []
                                    for artist in sorted(artist_list, key=lambda x: x.get("name", "")):
                                        artist_name = artist.get("name", "Unknown")
                                        formatted.append(f"{artist_name}: $0")
                                    row.append(", ".join(formatted))
                                else:
                                    row.append("")
                        except Exception as e:
                            # If parsing fails, use raw text
                            print(f"Error formatting budget allocation: {e}")
                            row.append(question_responses[0]["response_text"])
                    else:
                        # Single value (text, textarea, Single-select, Likert)
                        row.append(question_responses[0]["response_text"])
            
            writer.writerow(row)
        
        output.seek(0)
        # Sanitize panorama name for filename (remove special characters)
        safe_name = re.sub(r'[^\w\s-]', '', panorama_name).strip()
        safe_name = re.sub(r'[-\s]+', '_', safe_name)
        filename = f"{safe_name}_results_{datetime.now().strftime('%Y-%m-%d')}.csv"
        
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

