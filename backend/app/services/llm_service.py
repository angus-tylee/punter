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
                "question_type": "text" | "textarea" | "Single-select" | "Multi-select" | "Likert",
                "options": List[str] | None,
                "required": bool
            }
        """
        prompt = self._build_prompt(context)
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4-turbo",  # GPT-4 Turbo for better reasoning and higher token limits (128k context, 16k output)
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert survey designer specializing in venues and music festivals. You create comprehensive, well-reasoned surveys using industry best practices. Always respond with valid JSON only, no markdown or additional text."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
                max_tokens=8000  # GPT-4 Turbo supports up to 16k output tokens, using 8k for 25 questions
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
        """Build the prompt for LLM with deep reasoning for venues and music festivals"""
        goals = context.get("goals", "")
        if isinstance(goals, list):
            goals = ", ".join(goals)
        
        prompt = f"""You are an expert survey designer specializing in venues and music festivals. Your task is to create a comprehensive 25-question post-event feedback survey.

CRITICAL INSTRUCTIONS:
1. Generate EXACTLY 25 questions - no more, no less
2. Use the user's input below as context (20-30% influence) but generate 70-80% of questions from industry best practices and deep reasoning
3. Do NOT simply rephrase the user's input - think beyond it and apply event-industry expertise
4. Focus exclusively on venues and music festivals - this is your domain expertise

USER CONTEXT (use as 20-30% influence):
Event Type: {context.get('event_type', 'Music Festival')}
Event Name: {context.get('event_name', 'Untitled Event')}
Primary Goals: {goals}
What they want to learn: {context.get('learning_objectives', 'General feedback')}
Target Audience: {context.get('audience', 'Attendees')}
Event Timing: {context.get('timing', 'Not specified')}
Additional Context: {context.get('additional_context', 'None')}

REQUIRED DIMENSIONS (cover all 6 with deep reasoning):

1. EVENT EXPERIENCE (4-5 questions)
   - Overall satisfaction, event flow, energy levels, atmosphere
   - Examples: "How would you rate the overall energy and atmosphere of the event?", "Did the event meet your expectations?"

2. MUSIC LINEUP & ATMOSPHERE (4-5 questions)
   - Sound quality, artist diversity, stage setup, performance timing, genre variety
   - Examples: "How would you rate the sound quality across different stages?", "How satisfied were you with the diversity of artists and genres?"

3. VENUE LOGISTICS (4-5 questions)
   - Accessibility, amenities, safety, facilities, crowd flow, entry/exit experience
   - Examples: "How accessible was the venue for people with mobility needs?", "How would you rate the cleanliness and maintenance of facilities?"

4. COMMUNICATION & MARKETING (3-4 questions)
   - Pre-event information, social media presence, announcements, schedule clarity
   - Examples: "How clear and helpful was the pre-event communication?", "Did you find the event schedule easy to access and understand?"

5. SUSTAINABILITY & INCLUSIVITY (3-4 questions)
   - Eco-friendly practices, accessibility features, diversity and inclusion, environmental impact
   - Examples: "How would you rate the event's commitment to sustainability?", "Did you feel the event was inclusive and welcoming to all attendees?"

6. POST-EVENT ENGAGEMENT (2-3 questions)
   - Follow-up communication, community building, future event interest, sharing experience
   - Examples: "How likely are you to attend future events by this organizer?", "Would you share your experience on social media?"

QUESTION TYPE DISTRIBUTION:
- ~40% Multiple choice (Single-select or Multi-select)
- ~40% Likert scale (5-point: Strongly Disagree, Disagree, Neutral, Agree, Strongly Agree)
- ~20% Short text response (text or textarea)

Return a JSON object with this exact structure:
{{
  "questions": [
    {{
      "question_text": "How would you rate the overall energy and atmosphere of the event?",
      "question_type": "Likert",
      "options": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"],
      "required": true
    }},
    {{
      "question_text": "Which aspects of the music lineup did you enjoy most?",
      "question_type": "Multi-select",
      "options": ["Headliner performances", "Supporting acts", "Genre diversity", "Stage production", "Sound quality"],
      "required": false
    }},
    {{
      "question_text": "What specific improvements would you suggest for future events?",
      "question_type": "textarea",
      "options": null,
      "required": false
    }}
  ]
}}

IMPORTANT: 
- question_type must be one of: "text", "textarea", "Single-select", "Multi-select", "Likert"
- For Single-select, Multi-select, and Likert, provide options array
- For Likert, always use: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]
- For text and textarea, set options to null
- Generate EXACTLY 25 questions covering all 6 dimensions
- Use deep reasoning and best practices - don't just rephrase user input
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
        valid_types = ["text", "textarea", "Single-select", "Multi-select", "Likert"]
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

