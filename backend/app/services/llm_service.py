import json
import re
from pathlib import Path
from typing import Dict, List, Optional
from openai import OpenAI
from app.config import settings
from app.services.universal_questions import get_universal_question_texts
from app.services.question_bank import (
    get_all_questions,
    get_required_questions,
    format_questions_for_prompt,
)
from app.services.pre_event_config import (
    get_bucket_question_counts,
    get_survey_constraints,
    format_config_for_prompt,
    is_forbidden_question,
)


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
        Analyze context to extract goals and prepare data for question generation.
        Uses 3-bucket goal system.
        """
        # Get goals from buckets
        must_have_goals = context.get("goals_must_have", [])
        interested_goals = context.get("goals_interested", [])
        
        # Calculate target question count: 4 per must_have + 2 per interested
        bucket_counts = get_bucket_question_counts()
        survey_constraints = get_survey_constraints()
        
        target_count = (
            len(must_have_goals) * bucket_counts["must_have"] +
            len(interested_goals) * bucket_counts["interested"]
        )
        # Ensure within bounds
        target_count = max(survey_constraints["min_questions"], 
                         min(target_count, survey_constraints["max_questions"]))
        
        # Load question bank examples and required questions
        question_bank_examples = get_all_questions()
        required_questions = get_required_questions()
        event_name = context.get("event_name", "the event")
        
        # Format question bank for prompt
        question_bank_prompt = format_questions_for_prompt(question_bank_examples, event_name)
        
        # Format required questions for prompt
        required_questions_prompt = format_questions_for_prompt(required_questions, event_name)
        
        # Get pre-event rules for prompt
        pre_event_rules = format_config_for_prompt()
        
        # additional_context is for customization only
        additional_context = context.get("additional_context", "")
        
        return {
            "additional_context": additional_context,
            "event_type": context.get("event_type", ""),
            "event_name": event_name,
            "audience": context.get("audience", ""),
            "timing": context.get("timing", ""),
            # Bucket goals
            "must_have_goals": must_have_goals,
            "interested_goals": interested_goals,
            "target_question_count": target_count,
            # Question bank data
            "question_bank_prompt": question_bank_prompt,
            "required_questions_prompt": required_questions_prompt,
            "required_questions": required_questions,
            # Pre-event rules
            "pre_event_rules": pre_event_rules,
        }
    
    def _build_prompt(self, context: Dict[str, str], context_analysis: Dict) -> str:
        """Build the prompt for question generation using 3-bucket goal system"""
        # Format goals by bucket with question counts
        must_have = context_analysis.get("must_have_goals", [])
        interested = context_analysis.get("interested_goals", [])
        
        focus_areas_text = "GOAL PRIORITIES (generate questions accordingly):\n\n"
        
        if must_have:
            focus_areas_text += "MUST HAVE (4 questions per goal):\n"
            for goal in must_have:
                focus_areas_text += f"  - {goal}\n"
        
        if interested:
            focus_areas_text += "\nINTERESTED TO KNOW (2 questions per goal):\n"
            for goal in interested:
                focus_areas_text += f"  - {goal}\n"
        
        if not must_have and not interested:
            focus_areas_text += "No specific goals provided - generate general pre-event survey questions.\n"
        
        focus_areas_text += f"\nTARGET TOTAL: {context_analysis.get('target_question_count', 15)} questions"
        
        # Format the template with context variables
        prompt = self._question_prompt_template.format(
            focus_areas=focus_areas_text,
            event_type=context_analysis.get('event_type', 'Music Festival'),
            event_name=context_analysis.get('event_name', 'Untitled Event'),
            audience=context_analysis.get('audience', 'Attendees'),
            timing=context_analysis.get('timing', 'Not specified'),
            additional_context=context_analysis.get('additional_context', 'None')
        )
        
        # Add pre-event rules (forbidden patterns, constraints)
        pre_event_rules = context_analysis.get("pre_event_rules", "")
        if pre_event_rules:
            prompt += f"\n\n{pre_event_rules}"
        
        # Add question bank examples as inspiration
        question_bank_prompt = context_analysis.get("question_bank_prompt", "")
        if question_bank_prompt:
            prompt += "\n\nQUESTION BANK (use these as inspiration, adapt and personalize for the event):\n"
            prompt += question_bank_prompt
        
        # Add required questions that MUST be included
        required_questions_prompt = context_analysis.get("required_questions_prompt", "")
        if required_questions_prompt:
            prompt += "\n\nREQUIRED QUESTIONS (must include these in every survey):\n"
            prompt += required_questions_prompt
        
        # Dynamically append universal questions list (demographics - already collected)
        universal_question_texts = get_universal_question_texts()
        prompt += "\n\nThe following DEMOGRAPHIC questions are automatically included. Do NOT create questions similar to these:\n"
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
            
            # Format goals by bucket for validation
            must_have = context_analysis.get("must_have_goals", [])
            interested = context_analysis.get("interested_goals", [])
            
            goals_text = ""
            if must_have:
                goals_text += "MUST HAVE (need 4 questions each):\n"
                for goal in must_have:
                    goals_text += f"  - {goal}\n"
            if interested:
                goals_text += "INTERESTED TO KNOW (need 2 questions each):\n"
                for goal in interested:
                    goals_text += f"  - {goal}\n"
            if not goals_text:
                goals_text = "- General pre-event survey"
            
            # Build validation prompt
            validation_prompt = self._validation_prompt_template.format(
                user_focus_areas=goals_text,
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
            
            # Format goals by bucket for refinement
            must_have = context_analysis.get("must_have_goals", [])
            interested = context_analysis.get("interested_goals", [])
            
            goals_text = ""
            if must_have:
                goals_text += "MUST HAVE (need 4 questions each):\n"
                for goal in must_have:
                    goals_text += f"  - {goal}\n"
            if interested:
                goals_text += "INTERESTED TO KNOW (need 2 questions each):\n"
                for goal in interested:
                    goals_text += f"  - {goal}\n"
            if not goals_text:
                goals_text = "- General pre-event survey"
            
            # Get refinement instructions from validation result
            refinement_instructions = validation_result.get("refinement_instructions", "Fix any issues identified in the validation feedback.")
            
            # Build refinement prompt
            refinement_prompt = self._refinement_prompt_template.format(
                original_questions=questions_json,
                validation_feedback=validation_json,
                refinement_instructions=refinement_instructions,
                context_topics=goals_text
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
        """Validate and normalize question structure, filter demographics and forbidden patterns"""
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
            
            # Check for forbidden patterns (post-event questions in pre-event survey)
            if is_forbidden_question(question_text):
                print(f"Warning: Removed forbidden question (pre-event rule): {question_text}")
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
        """Return pre-event appropriate fallback questions if LLM fails"""
        event_name = context.get("event_name", "this event")
        likert_scale = ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]
        
        # Get required questions from question bank
        required_questions = get_required_questions()
        fallback = []
        
        # Add required questions first
        for i, rq in enumerate(required_questions):
            q_text = rq.get("question_text_template", "").format(event_name=event_name)
            fallback.append({
                "question_text": q_text,
                "question_type": rq.get("question_type", "textarea"),
                "options": rq.get("options"),
                "required": True,
                "order": i
            })
        
        start_order = len(fallback)
        
        # Pre-event appropriate fallback questions
        pre_event_fallback = [
            # Expectations (3 questions)
            {
                "question_text": f"What are you most looking forward to at {event_name}?",
                "question_type": "Multi-select",
                "options": ["Music performances", "Meeting new people", "Food & drinks", "Overall atmosphere", "Discovering new artists", "Dancing"],
                "required": True,
                "order": start_order
            },
            {
                "question_text": f"How excited are you about attending {event_name}?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": True,
                "order": start_order + 1
            },
            {
                "question_text": f"What would make {event_name} a success for you?",
                "question_type": "textarea",
                "options": None,
                "required": False,
                "order": start_order + 2
            },
            # Preferences (3 questions)
            {
                "question_text": "What music genres are you most interested in?",
                "question_type": "Multi-select",
                "options": ["Electronic/Dance", "Hip-Hop/R&B", "Rock/Alternative", "Pop", "Indie", "House/Techno", "Other"],
                "required": True,
                "order": start_order + 3
            },
            {
                "question_text": "What time of day do you prefer to attend events?",
                "question_type": "Single-select",
                "options": ["Morning", "Afternoon", "Evening", "Late Night", "No preference"],
                "required": False,
                "order": start_order + 4
            },
            {
                "question_text": "How important is the food and beverage selection to your experience?",
                "question_type": "Likert",
                "options": likert_scale,
                "required": False,
                "order": start_order + 5
            },
            # Logistics (3 questions)
            {
                "question_text": f"How are you planning to get to {event_name}?",
                "question_type": "Single-select",
                "options": ["Driving myself", "Rideshare (Uber/Lyft)", "Public transport", "Walking/Cycling", "Getting dropped off", "Not sure yet"],
                "required": True,
                "order": start_order + 6
            },
            {
                "question_text": "What information would be most helpful to receive before the event?",
                "question_type": "Multi-select",
                "options": ["Lineup schedule", "Venue map", "Parking details", "Entry procedures", "Food options", "Weather updates"],
                "required": False,
                "order": start_order + 7
            },
            {
                "question_text": "Will you be attending alone or with others?",
                "question_type": "Single-select",
                "options": ["Alone", "With 1 other person", "With a small group (3-5)", "With a large group (6+)"],
                "required": False,
                "order": start_order + 8
            },
            # Marketing (2 questions)
            {
                "question_text": f"How did you hear about {event_name}?",
                "question_type": "Single-select",
                "options": ["Social media", "Friend/Word of mouth", "Email newsletter", "Online ads", "Event listing sites", "Other"],
                "required": True,
                "order": start_order + 9
            },
            {
                "question_text": "What made you decide to attend?",
                "question_type": "Multi-select",
                "options": ["The lineup", "Price/value", "Venue location", "Friend recommendation", "Past experience with organizer", "FOMO"],
                "required": False,
                "order": start_order + 10
            },
            # Pricing (2 questions)
            {
                "question_text": "How would you rate the ticket price compared to similar events?",
                "question_type": "Single-select",
                "options": ["Much better value", "Slightly better value", "About the same", "Slightly more expensive", "Much more expensive"],
                "required": False,
                "order": start_order + 11
            },
            {
                "question_text": "What ticket type did you purchase?",
                "question_type": "Single-select",
                "options": ["General Admission", "VIP", "Early Bird", "Group Package", "Other"],
                "required": False,
                "order": start_order + 12
            },
        ]
        
        fallback.extend(pre_event_fallback)
        return fallback

