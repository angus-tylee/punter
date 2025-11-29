import json
import re
from pathlib import Path
from typing import Dict, List
from openai import OpenAI
from app.config import settings


class PulseQuestionGenerator:
    """Service for generating Pulse survey questions (simplified for Instagram DM format)"""
    
    def __init__(self):
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY not configured. Please set it in your .env file.")
        self.client = OpenAI(api_key=settings.openai_api_key)
        self._prompts_dir = Path(__file__).parent.parent / "prompts"
        self._system_prompt = self._load_prompt("pulse_question_generation_system.txt")
        self._question_prompt_template = self._load_prompt("pulse_question_generation.txt")
    
    def _load_prompt(self, filename: str) -> str:
        """Load prompt template from file"""
        prompt_path = self._prompts_dir / filename
        if not prompt_path.exists():
            raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
        return prompt_path.read_text()
    
    def generate_pulse_questions(self, context: Dict[str, str]) -> List[Dict]:
        """
        Generate Pulse survey questions based on event context.
        Returns 3-7 questions suitable for Instagram DM format.
        
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
                "question_type": "text" | "Single-select",
                "options": List[str] | None,
                "required": bool
            }
        """
        try:
            # Format goals as string if it's a list
            goals = context.get("goals", "")
            if isinstance(goals, list):
                goals = ", ".join(goals)
            
            # Build prompt
            prompt = self._question_prompt_template.format(
                event_type=context.get('event_type', 'Music Festival'),
                event_name=context.get('event_name', 'Untitled Event'),
                goals=goals or "Gather feedback",
                learning_objectives=context.get('learning_objectives', 'General feedback'),
                audience=context.get('audience', 'Attendees'),
                timing=context.get('timing', 'Not specified'),
                additional_context=context.get('additional_context', 'None')
            )
            
            # Generate questions using LLM
            print("Generating Pulse questions...")
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": self._system_prompt
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
                max_tokens=2000  # Shorter for 3-7 questions
            )
            
            content = response.choices[0].message.content
            if not content:
                return self._get_fallback_questions(context)
            
            # Parse response
            data = json.loads(content)
            questions = data.get("questions", [])
            
            if not questions:
                return self._get_fallback_questions(context)
            
            # Validate and normalize questions
            return self._validate_questions(questions)
            
        except Exception as e:
            print(f"Error generating Pulse questions: {e}")
            import traceback
            traceback.print_exc()
            return self._get_fallback_questions(context)
    
    def _validate_questions(self, questions: List[Dict]) -> List[Dict]:
        """Validate and normalize question structure"""
        valid_types = ["text", "Single-select"]
        validated = []
        
        for i, q in enumerate(questions):
            if not isinstance(q, dict):
                continue
            
            question_text = q.get("question_text", "").strip()
            if not question_text:
                continue
            
            question_type = q.get("question_type", "text")
            if question_type not in valid_types:
                question_type = "text"
            
            options = q.get("options")
            if question_type == "Single-select":
                if not options or not isinstance(options, list):
                    # Convert to text if options missing
                    question_type = "text"
                    options = None
            else:
                options = None
            
            validated.append({
                "question_text": question_text,
                "question_type": question_type,
                "options": options,
                "required": bool(q.get("required", False)),
                "order": i
            })
        
        # Ensure we have 3-7 questions
        if len(validated) < 3:
            # Add fallback questions if too few
            validated.extend(self._get_fallback_questions({})[:3 - len(validated)])
        elif len(validated) > 7:
            # Limit to 7 questions max
            validated = validated[:7]
        
        return validated
    
    def _get_fallback_questions(self, context: Dict[str, str]) -> List[Dict]:
        """Return fallback questions if LLM fails"""
        event_name = context.get("event_name", "this event")
        
        return [
            {
                "question_text": f"How would you rate your overall experience at {event_name}?",
                "question_type": "Single-select",
                "options": ["Excellent", "Very Good", "Good", "Fair", "Poor"],
                "required": True,
                "order": 0
            },
            {
                "question_text": "What was your favorite part of the event?",
                "question_type": "text",
                "options": None,
                "required": False,
                "order": 1
            },
            {
                "question_text": "Would you attend this event again?",
                "question_type": "Single-select",
                "options": ["Definitely", "Probably", "Maybe", "Probably Not", "Definitely Not"],
                "required": True,
                "order": 2
            }
        ]

