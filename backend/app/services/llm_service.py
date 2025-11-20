import json
import re
from pathlib import Path
from typing import Dict, List, Optional
from openai import OpenAI
from app.config import settings
from app.services.universal_questions import get_universal_question_texts


class LLMService:
    """Service for interacting with LLM to generate survey questions"""
    
    def __init__(self):
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY not configured. Please set it in your .env file.")
        self.client = OpenAI(api_key=settings.openai_api_key)
        self._prompts_dir = Path(__file__).parent.parent / "prompts"
        self._question_system_prompt = self._load_prompt("question_generation_system.txt")
        self._question_prompt_template = self._load_prompt("question_generation.txt")
        self._validation_prompt_template = self._load_prompt("response_validation.txt")
        self._refinement_prompt_template = self._load_prompt("response_refinement.txt")
    
    def _load_prompt(self, filename: str) -> str:
        """Load prompt template from file"""
        prompt_path = self._prompts_dir / filename
        if not prompt_path.exists():
            raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
        return prompt_path.read_text()
    
    def generate_survey_questions(self, context: Dict[str, str]) -> List[Dict]:
        """
        Generate survey questions based on event context using streamlined 2-3 LLM call pipeline.
        
        Args:
            context: Dictionary with event information:
                - event_type: Type of event
                - event_name: Name of the event
                - goals: Primary goals (comma-separated or list)
                - learning_objectives: What they want to learn
                - audience: Target audience
                - timing: Event timing/date
                - additional_context: Optional additional context
        
        Returns:
            List of question dictionaries with structure:
            {
                "question_text": str,
                "question_type": "text" | "textarea" | "Single-select" | "Multi-select" | "Likert",
                "options": List[str] | None,
                "required": bool
            }
        """
        try:
            # Step 1: Analyze context (extract focus areas)
            context_analysis = self._analyze_context(context)
            
            # Step 2: Build prompt for question expansion
            prompt = self._build_prompt(context, context_analysis)
            
            # Step 3: LLM Call #1 - Generate questions (expansion + formatting)
            print("LLM Call #1: Generating questions...")
            questions_data = self._generate_questions_with_llm(prompt)
            
            if not questions_data or not questions_data.get("sections"):
                print("Failed to generate questions from LLM")
                return self._get_fallback_questions(context)
            
            # Step 4: LLM Call #2 - Validate focus area coverage
            print("LLM Call #2: Validating questions...")
            # Pass sections structure so validator can check organization
            validation_result = self._validate_response(questions_data, context_analysis)
            
            # Flatten sections for refinement if needed
            all_questions = self._flatten_sections(questions_data["sections"])
            
            # Step 5: LLM Call #3 (if needed) - Refine questions
            if not validation_result.get("validation_passed", False):
                print("LLM Call #3: Refining questions based on validation feedback...")
                questions_data = self._refine_questions(questions_data, validation_result, context_analysis)
                # Re-flatten after refinement
                all_questions = self._flatten_sections(questions_data.get("sections", []))
            
            # Final validation and normalization (returns flat list for backward compatibility)
            return self._validate_questions(all_questions)
            
        except Exception as e:
            print(f"Error generating questions: {e}")
            import traceback
            traceback.print_exc()
            # Return fallback questions
            return self._get_fallback_questions(context)
    
    def _analyze_context(self, context: Dict[str, str]) -> Dict:
        """
        Analyze context to extract user's focus areas/questions from goals and learning_objectives.
        Uses programmatic analysis (no LLM call).
        """
        # Extract focus areas from goals and learning_objectives (these are user's actual questions)
        focus_areas = []
        
        # Process goals (Primary Goals) - these are user's focus areas/questions
        goals = context.get("goals", "")
        if isinstance(goals, list):
            goals = ", ".join(goals)
        if goals and goals.lower() not in ["none", "not specified", ""]:
            # Split by common delimiters (commas, semicolons, newlines, bullets)
            goal_items = re.split(r'[,;]|\n|[-•*]', goals)
            for item in goal_items:
                item = item.strip()
                if item and len(item) > 3:  # Filter out very short items
                    focus_areas.append(item)
        
        # Process learning_objectives (What do you want to learn?) - these are also user's focus areas/questions
        learning_objectives = context.get("learning_objectives", "")
        if learning_objectives and learning_objectives.lower() not in ["general feedback", "none", "not specified", ""]:
            # Split by common delimiters
            obj_items = re.split(r'[,;]|\n|[-•*]', learning_objectives)
            for item in obj_items:
                item = item.strip()
                if item and len(item) > 3:  # Filter out very short items
                    focus_areas.append(item)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_focus_areas = []
        for area in focus_areas:
            area_lower = area.lower()
            if area_lower not in seen:
                seen.add(area_lower)
                unique_focus_areas.append(area)
        
        # additional_context is NOT parsed as questions - it's for customization only
        additional_context = context.get("additional_context", "")
        
        return {
            "focus_areas": unique_focus_areas,
            "additional_context": additional_context,
            "event_type": context.get("event_type", ""),
            "event_name": context.get("event_name", ""),
            "audience": context.get("audience", ""),
            "timing": context.get("timing", "")
        }
    
    def _build_prompt(self, context: Dict[str, str], context_analysis: Dict) -> str:
        """Build the prompt for question expansion approach"""
        # Format user's focus areas
        focus_areas = context_analysis.get("focus_areas", [])
        if not focus_areas:
            focus_areas = ["General event feedback"]
        focus_areas_text = "\n".join([f"- {area}" for area in focus_areas])
        
        # Format the template with context variables
        prompt = self._question_prompt_template.format(
            focus_areas=focus_areas_text,
            event_type=context_analysis.get('event_type', 'Music Festival'),
            event_name=context_analysis.get('event_name', 'Untitled Event'),
            audience=context_analysis.get('audience', 'Attendees'),
            timing=context_analysis.get('timing', 'Not specified'),
            additional_context=context_analysis.get('additional_context', 'None')
        )
        
        # Dynamically append universal questions list
        universal_question_texts = get_universal_question_texts()
        prompt += "\n\nThe following questions are automatically included in every survey. Do not create questions similar to these:\n"
        for i, q_text in enumerate(universal_question_texts, 1):
            prompt += f"{i}. {q_text}\n"
        
        return prompt
    
    def _generate_questions_with_llm(self, prompt: str) -> Dict:
        """Generate questions using LLM (LLM Call #1) - returns sections structure"""
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",  # Upgraded for better reasoning and instruction following
                messages=[
                    {
                        "role": "system",
                        "content": self._question_system_prompt
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
                max_tokens=8192  # Increased for questions with sections: ~150 tokens/question × 30 = 4500 + buffer
            )
            
            content = response.choices[0].message.content
            if not content:
                return {"sections": []}
            
            return self._parse_response(content)
        except Exception as e:
            print(f"Error in question generation LLM call: {e}")
            return {"sections": []}
    
    def _flatten_sections(self, sections: List[Dict]) -> List[Dict]:
        """Flatten sections structure into a flat list of questions"""
        all_questions = []
        for section in sections:
            questions = section.get("questions", [])
            all_questions.extend(questions)
        return all_questions
    
    def _validate_response(self, questions_data: Dict, context_analysis: Dict) -> Dict:
        """Validate generated questions using LLM (LLM Call #2)"""
        try:
            # Format questions for validation prompt (can be sections structure or flat list)
            questions_json = json.dumps(questions_data, indent=2)
            
            # Format user focus areas
            focus_areas = context_analysis.get("focus_areas", [])
            focus_areas_text = "\n".join([f"- {area}" for area in focus_areas]) if focus_areas else "- General event feedback"
            
            # Build validation prompt
            validation_prompt = self._validation_prompt_template.format(
                user_focus_areas=focus_areas_text,
                generated_questions=questions_json
            )
            
            response = self.client.chat.completions.create(
                model="gpt-4o",  # Upgraded for better reasoning in validation
                messages=[
                    {
                        "role": "system",
                        "content": "You are a quality assurance expert for survey question generation. Analyze questions and provide structured validation feedback in JSON format."
                    },
                    {
                        "role": "user",
                        "content": validation_prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=2000
            )
            
            content = response.choices[0].message.content
            if not content:
                return {"validation_passed": True}  # Default to pass if validation fails
            
            return json.loads(content)
        except Exception as e:
            print(f"Error in validation LLM call: {e}")
            return {"validation_passed": True}  # Default to pass if validation fails
    
    def _refine_questions(self, questions_data: Dict, validation_result: Dict, context_analysis: Dict) -> Dict:
        """Refine questions based on validation feedback (LLM Call #3)"""
        try:
            # Format questions for refinement prompt
            questions_json = json.dumps(questions_data, indent=2)
            validation_json = json.dumps(validation_result, indent=2)
            
            # Format user focus areas
            focus_areas = context_analysis.get("focus_areas", [])
            focus_areas_text = "\n".join([f"- {area}" for area in focus_areas]) if focus_areas else "- General event feedback"
            
            # Get refinement instructions from validation result
            refinement_instructions = validation_result.get("refinement_instructions", "Fix any issues identified in the validation feedback.")
            
            # Build refinement prompt
            refinement_prompt = self._refinement_prompt_template.format(
                original_questions=questions_json,
                validation_feedback=validation_json,
                refinement_instructions=refinement_instructions,
                context_topics=focus_areas_text
            )
            
            response = self.client.chat.completions.create(
                model="gpt-4o",  # Upgraded for better reasoning in refinement
                messages=[
                    {
                        "role": "system",
                        "content": "You are a survey question refinement expert. Improve questions based on validation feedback. Always respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": refinement_prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.5,
                max_tokens=8192  # Increased for 25-30 refined questions: ~150 tokens/question × 30 = 4500 + buffer
            )
            
            content = response.choices[0].message.content
            if not content:
                return questions_data  # Return original if refinement fails
            
            refined_data = self._parse_response(content)
            return refined_data if refined_data.get("sections") else questions_data
        except Exception as e:
            print(f"Error in refinement LLM call: {e}")
            return questions_data  # Return original if refinement fails
    
    def _parse_response(self, content: str) -> Dict:
        """Parse LLM response and extract questions with sections"""
        try:
            # Try to parse as JSON
            data = json.loads(content)
            
            # Check if response has sections structure
            if "sections" in data:
                return data  # Return full structure with sections
            elif "questions" in data:
                # Legacy format - convert to sections structure
                return {
                    "sections": [{
                        "section_name": "Survey Questions",
                        "questions": data["questions"]
                    }]
                }
            elif isinstance(data, list):
                # Legacy format - list of questions
                return {
                    "sections": [{
                        "section_name": "Survey Questions",
                        "questions": data
                    }]
                }
            else:
                # Try to extract JSON from markdown code blocks
                json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group(1))
                    if "sections" in data:
                        return data
                    elif "questions" in data:
                        return {
                            "sections": [{
                                "section_name": "Survey Questions",
                                "questions": data["questions"]
                            }]
                        }
        except json.JSONDecodeError:
            # Try to extract JSON array from text
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                try:
                    questions = json.loads(json_match.group(0))
                    return {
                        "sections": [{
                            "section_name": "Survey Questions",
                            "questions": questions
                        }]
                    }
                except:
                    pass
        
        # If all parsing fails, return empty structure
        return {"sections": []}
    
    def _validate_questions(self, questions: List[Dict]) -> List[Dict]:
        """Validate and normalize question structure, and filter out demographic questions"""
        valid_types = ["text", "textarea", "Single-select", "Multi-select", "Likert"]
        validated = []
        
        # Get universal question texts for deduplication
        universal_question_texts = get_universal_question_texts()
        universal_texts_lower = [q.lower() for q in universal_question_texts]
        
        # Keywords to detect demographic questions
        demographic_keywords = [
            "name", "email", "phone", "age", "location", "occupation", "demographic",
            "where did you grow up", "where do you live", "home base", "grow up", "currently live"
        ]
        
        for i, q in enumerate(questions):
            if not isinstance(q, dict):
                continue
            
            question_text = q.get("question_text", "").strip()
            if not question_text:
                continue
            
            # Post-processing filter: check for demographic questions
            question_text_lower = question_text.lower()
            
            # Check for exact matches with universal questions
            if question_text_lower in universal_texts_lower:
                print(f"Warning: Removed duplicate demographic question: {question_text}")
                continue
            
            # Check for keyword matches
            if any(keyword in question_text_lower for keyword in demographic_keywords):
                print(f"Warning: Removed demographic question (keyword match): {question_text}")
                continue
            
            question_type = q.get("question_type", "text")
            if question_type not in valid_types:
                question_type = "text"
            
            options = q.get("options")
            if question_type in ["Single-select", "Multi-select", "Likert"]:
                if not options or not isinstance(options, list):
                    # Convert to text if options missing
                    question_type = "text"
                    options = None
                elif question_type == "Likert":
                    # Ensure Likert has standard 5-point scale
                    likert_scale = ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]
                    if options != likert_scale:
                        # Use standard scale if provided options don't match
                        options = likert_scale
            else:
                options = None
            
            validated.append({
                "question_text": question_text,
                "question_type": question_type,
                "options": options,
                "required": bool(q.get("required", False)),
                "order": i
            })
        
        return validated
    
    def _get_fallback_questions(self, context: Dict[str, str]) -> List[Dict]:
        """Return comprehensive 25-question fallback if LLM fails"""
        event_name = context.get("event_name", "this event")
        likert_scale = ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]
        
        return [
            # Event Experience (4-5 questions)
            {
                "question_text": f"How would you rate the overall energy and atmosphere of {event_name}?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": True,
                "order": 0
            },
            {
                "question_text": f"Did {event_name} meet your expectations?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": True,
                "order": 1
            },
            {
                "question_text": "How would you rate the overall event experience?",
                "question_type": "Single-select",
                "options": ["Excellent", "Very Good", "Good", "Fair", "Poor"],
                "required": True,
                "order": 2
            },
            {
                "question_text": "What was the highlight of your experience?",
                "question_type": "textarea",
                "options": None,
                "required": False,
                "order": 3
            },
            {
                "question_text": "How would you describe the overall event flow and pacing?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": False,
                "order": 4
            },
            # Music Lineup & Atmosphere (4-5 questions)
            {
                "question_text": "How would you rate the sound quality across different stages?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": True,
                "order": 5
            },
            {
                "question_text": "How satisfied were you with the diversity of artists and genres?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": True,
                "order": 6
            },
            {
                "question_text": "Which aspects of the music lineup did you enjoy most?",
                "question_type": "Multi-select",
                "options": ["Headliner performances", "Supporting acts", "Genre diversity", "Stage production", "Sound quality", "Artist discovery"],
                "required": False,
                "order": 7
            },
            {
                "question_text": "How would you rate the stage setup and visual production?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": False,
                "order": 8
            },
            {
                "question_text": "Were there any scheduling conflicts that affected your experience?",
                "question_type": "text",
                "options": None,
                "required": False,
                "order": 9
            },
            # Venue Logistics (4-5 questions)
            {
                "question_text": "How accessible was the venue for people with mobility needs?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": False,
                "order": 10
            },
            {
                "question_text": "How would you rate the cleanliness and maintenance of facilities?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": True,
                "order": 11
            },
            {
                "question_text": "How would you rate the entry and exit process?",
                "question_type": "Single-select",
                "options": ["Very Smooth", "Smooth", "Average", "Difficult", "Very Difficult"],
                "required": False,
                "order": 12
            },
            {
                "question_text": "Which amenities were most important to your experience?",
                "question_type": "Multi-select",
                "options": ["Food & Beverage", "Restrooms", "First Aid", "Water stations", "Charging stations", "Seating areas"],
                "required": False,
                "order": 13
            },
            {
                "question_text": "How safe did you feel throughout the event?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": True,
                "order": 14
            },
            # Communication & Marketing (3-4 questions)
            {
                "question_text": "How clear and helpful was the pre-event communication?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": True,
                "order": 15
            },
            {
                "question_text": "Did you find the event schedule easy to access and understand?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": False,
                "order": 16
            },
            {
                "question_text": "How would you rate the event's social media presence and updates?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": False,
                "order": 17
            },
            {
                "question_text": "What information would have been helpful to know before the event?",
                "question_type": "textarea",
                "options": None,
                "required": False,
                "order": 18
            },
            # Sustainability & Inclusivity (3-4 questions)
            {
                "question_text": "How would you rate the event's commitment to sustainability?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": False,
                "order": 19
            },
            {
                "question_text": "Did you feel the event was inclusive and welcoming to all attendees?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": True,
                "order": 20
            },
            {
                "question_text": "Which sustainability practices did you notice?",
                "question_type": "Multi-select",
                "options": ["Recycling programs", "Compostable materials", "Water refill stations", "Public transport options", "Carbon offset initiatives", "None"],
                "required": False,
                "order": 21
            },
            {
                "question_text": "How would you rate the event's diversity and representation?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": False,
                "order": 22
            },
            # Post-Event Engagement (2-3 questions)
            {
                "question_text": f"How likely are you to attend future events by this organizer?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": True,
                "order": 23
            },
            {
                "question_text": "Would you share your experience on social media?",
                "question_type": "Single-select",
                "options": ["Definitely", "Probably", "Maybe", "Probably Not", "Definitely Not"],
                "required": False,
                "order": 24
            }
        ]

