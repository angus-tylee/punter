"""
Question Bank for Pre-Event Surveys

This module contains expert-curated question templates organized by category.
Questions can be used as inspiration for LLM-generated surveys.

Categories:
- expectations: What attendees expect/hope for
- preferences: Lineup, venue, schedule, format preferences
- registration: Why they're interested, decision factors
- accessibility: Mobility, sensory, dietary, communication needs
- lineup_interest: Artist interest, genre preferences
- pricing: Price sensitivity, value perception
- logistics: Date, time, venue, transport preferences
- marketing: How they heard about event, information needs

To add expert questions:
1. Add question dict to QUESTION_BANK list
2. Use {event_name} placeholder for event-specific customization
3. Set is_required=True for questions that should always be included
"""

from typing import Dict, List, Optional


# Question Bank - Add your expert questions here
# Format:
# {
#     "id": "unique_id",
#     "question_text_template": "Question with {event_name} placeholder",
#     "question_type": "Likert" | "Single-select" | "Multi-select" | "text" | "textarea",
#     "options": ["Option 1", "Option 2"] or None for text/textarea,
#     "category": "expectations" | "preferences" | "registration" | "accessibility" | "lineup_interest" | "pricing" | "logistics" | "marketing",
#     "is_required": False  # Set True for questions that must appear in every survey
# }

QUESTION_BANK: List[Dict] = [
    # ===========================================
    # REQUIRED QUESTIONS (always included)
    # ===========================================
    {
        "id": "req_accessibility",
        "question_text_template": "Do you have any accessibility requirements we should know about for {event_name}?",
        "question_type": "textarea",
        "options": None,
        "category": "accessibility",
        "is_required": True,
    },
    {
        "id": "req_catch_all",
        "question_text_template": "Is there anything else you'd like us to know about your expectations for {event_name}?",
        "question_type": "textarea",
        "options": None,
        "category": "expectations",
        "is_required": True,
    },
    
    # ===========================================
    # EXPECTATIONS
    # ===========================================
    {
        "id": "exp_001",
        "question_text_template": "What are you most hoping to experience at {event_name}?",
        "question_type": "Multi-select",
        "options": ["Live music performances", "Discovering new artists", "Social atmosphere", "Food and drinks", "Meeting like-minded people", "Unique venue experience"],
        "category": "expectations",
        "is_required": False,
    },
    {
        "id": "exp_002",
        "question_text_template": "How important is it that {event_name} delivers a unique experience compared to other events?",
        "question_type": "Likert",
        "options": ["Not Important", "Slightly Important", "Moderately Important", "Very Important", "Extremely Important"],
        "category": "expectations",
        "is_required": False,
    },
    
    # ===========================================
    # PREFERENCES
    # ===========================================
    {
        "id": "pref_001",
        "question_text_template": "What type of music or performances would you most like to see at {event_name}?",
        "question_type": "Multi-select",
        "options": ["Electronic/DJ", "Live bands", "Acoustic/Singer-songwriter", "Hip-hop/R&B", "Rock/Alternative", "Pop", "Jazz/Blues", "World music"],
        "category": "preferences",
        "is_required": False,
    },
    {
        "id": "pref_002",
        "question_text_template": "What is your preferred event format?",
        "question_type": "Single-select",
        "options": ["Single day event", "Multi-day festival", "Evening only", "All-day event", "No preference"],
        "category": "preferences",
        "is_required": False,
    },
    
    # ===========================================
    # REGISTRATION / MOTIVATION
    # ===========================================
    {
        "id": "reg_001",
        "question_text_template": "What motivated you to register interest in {event_name}?",
        "question_type": "Multi-select",
        "options": ["The lineup/artists", "The venue", "Recommendation from friends", "Previous positive experience", "Social media buzz", "Value for money", "Unique concept"],
        "category": "registration",
        "is_required": False,
    },
    {
        "id": "reg_002",
        "question_text_template": "How likely are you to attend {event_name} if tickets become available?",
        "question_type": "Likert",
        "options": ["Very Unlikely", "Unlikely", "Neutral", "Likely", "Very Likely"],
        "category": "registration",
        "is_required": False,
    },
    
    # ===========================================
    # ACCESSIBILITY
    # ===========================================
    {
        "id": "acc_001",
        "question_text_template": "Which accessibility features are important to you for {event_name}?",
        "question_type": "Multi-select",
        "options": ["Wheelchair access", "Accessible viewing areas", "Accessible toilets", "Quiet/low sensory spaces", "Sign language interpretation", "Hearing loops", "None needed"],
        "category": "accessibility",
        "is_required": False,
    },
    {
        "id": "acc_002",
        "question_text_template": "Do you have any dietary requirements we should consider for food offerings?",
        "question_type": "Multi-select",
        "options": ["Vegetarian", "Vegan", "Gluten-free", "Halal", "Kosher", "Nut allergies", "Other allergies", "No specific requirements"],
        "category": "accessibility",
        "is_required": False,
    },
    
    # ===========================================
    # LINEUP INTEREST
    # ===========================================
    {
        "id": "line_001",
        "question_text_template": "How important is it that the lineup features well-known headliners?",
        "question_type": "Likert",
        "options": ["Not Important", "Slightly Important", "Moderately Important", "Very Important", "Extremely Important"],
        "category": "lineup_interest",
        "is_required": False,
    },
    {
        "id": "line_002",
        "question_text_template": "How interested are you in discovering new/emerging artists at {event_name}?",
        "question_type": "Likert",
        "options": ["Not Interested", "Slightly Interested", "Moderately Interested", "Very Interested", "Extremely Interested"],
        "category": "lineup_interest",
        "is_required": False,
    },
    
    # ===========================================
    # PRICING
    # ===========================================
    {
        "id": "price_001",
        "question_text_template": "What price range would you consider reasonable for {event_name}?",
        "question_type": "Single-select",
        "options": ["Under $50", "$50-$100", "$100-$150", "$150-$200", "$200-$300", "Over $300"],
        "category": "pricing",
        "is_required": False,
    },
    {
        "id": "price_002",
        "question_text_template": "Which ticket type would you be most interested in?",
        "question_type": "Single-select",
        "options": ["General admission", "Early bird discount", "VIP/Premium", "Group discount", "Payment plan option"],
        "category": "pricing",
        "is_required": False,
    },
    
    # ===========================================
    # LOGISTICS
    # ===========================================
    {
        "id": "log_001",
        "question_text_template": "Which days of the week work best for you to attend {event_name}?",
        "question_type": "Multi-select",
        "options": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        "category": "logistics",
        "is_required": False,
    },
    {
        "id": "log_002",
        "question_text_template": "How will you most likely travel to {event_name}?",
        "question_type": "Single-select",
        "options": ["Drive and park", "Public transport", "Taxi/Rideshare", "Walk/Cycle", "Shuttle service if available", "Undecided"],
        "category": "logistics",
        "is_required": False,
    },
    
    # ===========================================
    # MARKETING
    # ===========================================
    {
        "id": "mkt_001",
        "question_text_template": "How did you first hear about {event_name}?",
        "question_type": "Single-select",
        "options": ["Instagram", "Facebook", "TikTok", "Friend/Word of mouth", "Email newsletter", "Website search", "Poster/Flyer", "Radio", "Other"],
        "category": "marketing",
        "is_required": False,
    },
    {
        "id": "mkt_002",
        "question_text_template": "What information would be most helpful to know before deciding to attend {event_name}?",
        "question_type": "Multi-select",
        "options": ["Full lineup announcement", "Ticket prices", "Venue details", "Schedule/Timetable", "Food and drink options", "Parking/Transport info", "What to bring/not bring"],
        "category": "marketing",
        "is_required": False,
    },
]


# ===========================================
# API FUNCTIONS
# ===========================================

def get_all_questions() -> List[Dict]:
    """Get all questions from the question bank."""
    return QUESTION_BANK.copy()


def get_questions_by_category(category: str) -> List[Dict]:
    """
    Get all questions for a specific category.
    
    Args:
        category: One of: expectations, preferences, registration, 
                  accessibility, lineup_interest, pricing, logistics, marketing
    
    Returns:
        List of question dictionaries matching the category
    """
    return [q for q in QUESTION_BANK if q["category"] == category]


def get_required_questions() -> List[Dict]:
    """
    Get all questions marked as required (is_required=True).
    These questions should always be included in every survey.
    
    Returns:
        List of required question dictionaries
    """
    return [q for q in QUESTION_BANK if q.get("is_required", False)]


def get_categories() -> List[str]:
    """Get list of all available categories."""
    return [
        "expectations",
        "preferences", 
        "registration",
        "accessibility",
        "lineup_interest",
        "pricing",
        "logistics",
        "marketing",
    ]


def format_question(question: Dict, event_name: str) -> Dict:
    """
    Format a question template with event-specific details.
    
    Args:
        question: Question dictionary from the bank
        event_name: Name of the event to insert into template
    
    Returns:
        Question dictionary with formatted question_text
    """
    formatted = question.copy()
    formatted["question_text"] = question["question_text_template"].format(
        event_name=event_name
    )
    return formatted


def format_questions_for_prompt(questions: List[Dict], event_name: str) -> str:
    """
    Format multiple questions for inclusion in an LLM prompt.
    
    Args:
        questions: List of question dictionaries
        event_name: Name of the event
    
    Returns:
        Formatted string suitable for LLM prompt
    """
    lines = []
    for q in questions:
        formatted = format_question(q, event_name)
        line = f"- [{q['category']}] {formatted['question_text']} ({q['question_type']})"
        if q.get("options"):
            line += f" Options: {q['options']}"
        lines.append(line)
    return "\n".join(lines)
