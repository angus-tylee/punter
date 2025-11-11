import json
import re
from typing import Dict, List, Optional
from openai import OpenAI
from app.config import settings


class LLMService:
    """Service for interacting with LLM to generate survey questions"""
    
    def __init__(self):
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY not configured. Please set it in your .env file.")
        self.client = OpenAI(api_key=settings.openai_api_key)
    
    def generate_survey_questions(self, context: Dict[str, str]) -> List[Dict]:
        """
        Generate survey questions based on event context.
        
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
                "question_type": "text" | "textarea" | "Single-select" | "Multi-select",
                "options": List[str] | None,
                "required": bool
            }
        """
        prompt = self._build_prompt(context)
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert survey designer specializing in event feedback surveys. Always respond with valid JSON only, no markdown or additional text."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
                max_tokens=2000
            )
            
            content = response.choices[0].message.content
            if not content:
                print("Empty response from LLM")
                return self._get_fallback_questions(context)
            
            questions = self._parse_response(content)
            
            if not questions:
                print("Failed to parse questions from LLM response")
                return self._get_fallback_questions(context)
            
            # Validate and set defaults
            return self._validate_questions(questions)
            
        except Exception as e:
            print(f"Error generating questions: {e}")
            import traceback
            traceback.print_exc()
            # Return fallback questions
            return self._get_fallback_questions(context)
    
    def _build_prompt(self, context: Dict[str, str]) -> str:
        """Build the prompt for LLM"""
        goals = context.get("goals", "")
        if isinstance(goals, list):
            goals = ", ".join(goals)
        
        prompt = f"""You are helping create a survey for an event. Based on the following information, generate 5-8 relevant survey questions.

Event Type: {context.get('event_type', 'Event')}
Event Name: {context.get('event_name', 'Untitled Event')}
Primary Goals: {goals}
What they want to learn: {context.get('learning_objectives', 'General feedback')}
Target Audience: {context.get('audience', 'Attendees')}
Event Timing: {context.get('timing', 'Not specified')}
Additional Context: {context.get('additional_context', 'None')}

Generate questions that:
- Are appropriate for the event type
- Help achieve the stated goals
- Are relevant to the target audience
- Mix question types (some multiple choice, some open-ended)
- Are clear and easy to understand

Return a JSON object with this exact structure:
{{
  "questions": [
    {{
      "question_text": "How would you rate the overall event?",
      "question_type": "Single-select",
      "options": ["Excellent", "Good", "Fair", "Poor"],
      "required": true
    }},
    {{
      "question_text": "What was your favorite part of the event?",
      "question_type": "textarea",
      "options": null,
      "required": false
    }}
  ]
}}

Important: 
- question_type must be one of: "text", "textarea", "Single-select", "Multi-select"
- For Single-select and Multi-select, provide options array
- For text and textarea, set options to null
- Return valid JSON only, no markdown formatting"""
        
        return prompt
    
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
        """Validate and normalize question structure"""
        valid_types = ["text", "textarea", "Single-select", "Multi-select"]
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
            if question_type in ["Single-select", "Multi-select"]:
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
        
        return validated
    
    def _get_fallback_questions(self, context: Dict[str, str]) -> List[Dict]:
        """Return basic fallback questions if LLM fails"""
        event_name = context.get("event_name", "this event")
        return [
            {
                "question_text": f"How would you rate {event_name}?",
                "question_type": "Single-select",
                "options": ["Excellent", "Good", "Fair", "Poor"],
                "required": True,
                "order": 0
            },
            {
                "question_text": "What did you enjoy most?",
                "question_type": "textarea",
                "options": None,
                "required": False,
                "order": 1
            },
            {
                "question_text": "What could be improved?",
                "question_type": "textarea",
                "options": None,
                "required": False,
                "order": 2
            },
            {
                "question_text": "Would you recommend this event to others?",
                "question_type": "Single-select",
                "options": ["Yes", "No", "Maybe"],
                "required": True,
                "order": 3
            }
        ]

