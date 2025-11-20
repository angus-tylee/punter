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
        self._core_questions = self._load_core_questions()
    
    def _load_prompt(self, filename: str) -> str:
        """Load prompt template from file"""
        prompt_path = self._prompts_dir / filename
        if not prompt_path.exists():
            raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
        return prompt_path.read_text()
    
    def _load_core_questions(self) -> Dict:
        """Load core best practice questions from JSON file"""
        core_questions_path = self._prompts_dir / "core_best_practice_questions.txt"
        if not core_questions_path.exists():
            return {"tier_1_always_required": [], "tier_2_high_priority": [], "tier_3_standard_practice": []}
        try:
            return json.loads(core_questions_path.read_text())
        except json.JSONDecodeError:
            print(f"Warning: Failed to parse core_best_practice_questions.txt, using empty structure")
            return {"tier_1_always_required": [], "tier_2_high_priority": [], "tier_3_standard_practice": []}
    
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
            # Step 1: Analyze context
            context_analysis = self._analyze_context(context)
            
            # Step 2: Build enriched prompt
            prompt = self._build_prompt(context, context_analysis)
            
            # Step 3: LLM Call #1 - Generate questions
            print("LLM Call #1: Generating questions...")
            questions = self._generate_questions_with_llm(prompt)
            
            if not questions:
                print("Failed to generate questions from LLM")
                return self._get_fallback_questions(context)
            
            # Step 4: LLM Call #2 - Validate response
            print("LLM Call #2: Validating questions...")
            validation_result = self._validate_response(questions, context_analysis)
            
            # Step 5: LLM Call #3 (if needed) - Refine questions
            if not validation_result.get("validation_passed", False):
                print("LLM Call #3: Refining questions based on validation feedback...")
                questions = self._refine_questions(questions, validation_result, context_analysis)
            
            # Final validation and normalization
            return self._validate_questions(questions)
            
        except Exception as e:
            print(f"Error generating questions: {e}")
            import traceback
            traceback.print_exc()
            # Return fallback questions
            return self._get_fallback_questions(context)
    
    def _analyze_context(self, context: Dict[str, str]) -> Dict:
        """
        Analyze context to extract topics and determine target question count.
        Uses programmatic analysis (no LLM call).
        """
        # Extract topics from each context field
        topics = []
        
        # Process goals
        goals = context.get("goals", "")
        if isinstance(goals, list):
            goals = ", ".join(goals)
        if goals and goals.lower() not in ["none", "not specified", ""]:
            # Split by common delimiters
            goal_topics = re.split(r'[,;]|\n', goals)
            topics.extend([g.strip() for g in goal_topics if g.strip()])
        
        # Process learning objectives
        learning_objectives = context.get("learning_objectives", "")
        if learning_objectives and learning_objectives.lower() not in ["general feedback", "none", "not specified", ""]:
            obj_topics = re.split(r'[,;]|\n', learning_objectives)
            topics.extend([o.strip() for o in obj_topics if o.strip()])
        
        # Add other context fields if they have meaningful content
        meaningful_fields = []
        for field in ["event_type", "event_name", "audience", "timing", "additional_context"]:
            value = context.get(field, "")
            if value and value.lower() not in ["none", "not specified", "untitled event", "attendees", ""]:
                meaningful_fields.append(field)
                if field in ["additional_context"]:
                    # Extract keywords from longer text
                    words = re.findall(r'\b\w{4,}\b', value.lower())
                    topics.extend(words[:5])  # Limit to top 5 keywords
        
        # Calculate context richness (simple heuristic)
        total_fields = 7  # event_type, event_name, goals, learning_objectives, audience, timing, additional_context
        filled_fields = len(meaningful_fields)
        if goals and goals.lower() not in ["none", "not specified", ""]:
            filled_fields += 1
        if learning_objectives and learning_objectives.lower() not in ["general feedback", "none", "not specified", ""]:
            filled_fields += 1
        
        # Determine target question count
        if filled_fields >= 5:  # Many fields filled
            target_count = 30
        elif filled_fields >= 3:  # Medium fields filled
            target_count = 27
        else:  # Few fields filled
            target_count = 25
        
        # Remove duplicates and empty topics
        topics = list(set([t for t in topics if t and len(t) > 2]))
        
        return {
            "topics": topics,
            "target_count": target_count,
            "filled_fields": filled_fields
        }
    
    def _build_prompt(self, context: Dict[str, str], context_analysis: Dict) -> str:
        """Build the enriched prompt for LLM with all requirements"""
        # Process goals - convert list to comma-separated string if needed
        goals = context.get("goals", "")
        if isinstance(goals, list):
            goals = ", ".join(goals)
        
        # Format tier questions for prompt
        tier_1_text = self._format_questions_for_prompt(self._core_questions.get("tier_1_always_required", []))
        tier_2_text = self._format_questions_for_prompt(self._core_questions.get("tier_2_high_priority", []))
        tier_3_text = self._format_questions_for_prompt(self._core_questions.get("tier_3_standard_practice", []))
        
        # Format context topics
        context_topics_text = "\n".join([f"- {topic}" for topic in context_analysis.get("topics", [])])
        if not context_topics_text:
            context_topics_text = "- General event feedback"
        
        # Format the template with context variables
        prompt = self._question_prompt_template.format(
            target_count=context_analysis.get("target_count", 25),
            context_topics=context_topics_text,
            event_type=context.get('event_type', 'Music Festival'),
            event_name=context.get('event_name', 'Untitled Event'),
            goals=goals,
            learning_objectives=context.get('learning_objectives', 'General feedback'),
            audience=context.get('audience', 'Attendees'),
            timing=context.get('timing', 'Not specified'),
            additional_context=context.get('additional_context', 'None'),
            tier_1_questions=tier_1_text,
            tier_2_questions=tier_2_text,
            tier_3_questions=tier_3_text
        )
        
        # Dynamically append universal questions list
        universal_question_texts = get_universal_question_texts()
        prompt += "\n\nThe following questions are automatically included in every survey. Do not create questions similar to these:\n"
        for i, q_text in enumerate(universal_question_texts, 1):
            prompt += f"{i}. {q_text}\n"
        
        return prompt
    
    def _format_questions_for_prompt(self, questions: List[Dict]) -> str:
        """Format questions for inclusion in prompt"""
        if not questions:
            return "None"
        formatted = []
        for q in questions:
            q_text = q.get("question_text", "")
            q_type = q.get("question_type", "")
            formatted.append(f"- {q_text} ({q_type})")
        return "\n".join(formatted)
    
    def _generate_questions_with_llm(self, prompt: str) -> List[Dict]:
        """Generate questions using LLM (LLM Call #1)"""
        try:
            response = self.client.chat.completions.create(
                model="gpt-4-turbo",
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
                max_tokens=8000
            )
            
            content = response.choices[0].message.content
            if not content:
                return []
            
            return self._parse_response(content)
        except Exception as e:
            print(f"Error in question generation LLM call: {e}")
            return []
    
    def _validate_response(self, questions: List[Dict], context_analysis: Dict) -> Dict:
        """Validate generated questions using LLM (LLM Call #2)"""
        try:
            # Format questions for validation prompt
            questions_json = json.dumps(questions, indent=2)
            
            # Format context topics
            context_topics_text = "\n".join([f"- {topic}" for topic in context_analysis.get("topics", [])])
            
            # Format tier questions
            tier_1_text = self._format_questions_for_prompt(self._core_questions.get("tier_1_always_required", []))
            tier_2_text = self._format_questions_for_prompt(self._core_questions.get("tier_2_high_priority", []))
            
            # Build validation prompt
            validation_prompt = self._validation_prompt_template.format(
                target_count=context_analysis.get("target_count", 25),
                context_topics=context_topics_text,
                tier_1_questions=tier_1_text,
                tier_2_questions=tier_2_text,
                generated_questions=questions_json
            )
            
            response = self.client.chat.completions.create(
                model="gpt-4-turbo",
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
    
    def _refine_questions(self, questions: List[Dict], validation_result: Dict, context_analysis: Dict) -> List[Dict]:
        """Refine questions based on validation feedback (LLM Call #3)"""
        try:
            # Format questions for refinement prompt
            questions_json = json.dumps(questions, indent=2)
            validation_json = json.dumps(validation_result, indent=2)
            
            # Format context topics
            context_topics_text = "\n".join([f"- {topic}" for topic in context_analysis.get("topics", [])])
            
            # Format tier questions
            tier_1_text = self._format_questions_for_prompt(self._core_questions.get("tier_1_always_required", []))
            tier_2_text = self._format_questions_for_prompt(self._core_questions.get("tier_2_high_priority", []))
            
            # Get refinement instructions from validation result
            refinement_instructions = validation_result.get("refinement_instructions", "Fix any issues identified in the validation feedback.")
            
            # Build refinement prompt
            refinement_prompt = self._refinement_prompt_template.format(
                original_questions=questions_json,
                validation_feedback=validation_json,
                refinement_instructions=refinement_instructions,
                context_topics=context_topics_text,
                tier_1_questions=tier_1_text,
                tier_2_questions=tier_2_text,
                target_count=context_analysis.get("target_count", 25)
            )
            
            response = self.client.chat.completions.create(
                model="gpt-4-turbo",
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
                max_tokens=8000
            )
            
            content = response.choices[0].message.content
            if not content:
                return questions  # Return original if refinement fails
            
            refined_questions = self._parse_response(content)
            return refined_questions if refined_questions else questions
        except Exception as e:
            print(f"Error in refinement LLM call: {e}")
            return questions  # Return original if refinement fails
    
    def _parse_response(self, content: str) -> List[Dict]:
        """Parse LLM response and extract questions"""
        try:
            # Try to parse as JSON
            data = json.loads(content)
            if "questions" in data:
                return data["questions"]
            elif isinstance(data, list):
                return data
            else:
                # Try to extract JSON from markdown code blocks
                json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group(1))
                    return data.get("questions", [])
        except json.JSONDecodeError:
            # Try to extract JSON array from text
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group(0))
                except:
                    pass
        
        # If all parsing fails, return empty
        return []
    
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

