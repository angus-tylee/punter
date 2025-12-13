"""
Pre-Event Survey Configuration

Configurable rules and best practices for pre-event ("plan") surveys.
This config is used to:
1. Validate generated questions (reject post-event questions)
2. Guide LLM generation with appropriate constraints
3. Ensure survey quality and length

To customize:
- Update forbidden_patterns to block unwanted question types
- Adjust survey constraints (min/max questions)
- Modify recommended_type_mix for question variety
"""

from typing import Dict, List


# ===========================================
# PRE-EVENT SURVEY CONFIGURATION
# ===========================================

PRE_EVENT_CONFIG: Dict = {
    # Forbidden patterns - questions matching these are rejected
    # These indicate post-event or inappropriate questions for pre-event surveys
    "forbidden_patterns": [
        # NPS (Net Promoter Score) - post-event only
        "how likely are you to recommend",
        "would you recommend",
        "net promoter",
        
        # Post-event satisfaction - not applicable for pre-event
        "how satisfied were you",
        "how satisfied are you with",
        "rate your satisfaction",
        "overall satisfaction",
        
        # Retrospective questions - asking about past experience at THIS event
        "what did you like most",
        "what did you like least",
        "what did you enjoy",
        "what could be improved",
        "what would you change",
        "what was the highlight",
        "what was your favorite",
        "what disappointed you",
        
        # Post-event feedback
        "how was your experience",
        "how would you rate the event",
        "did the event meet your expectations",  # past tense
        "was the event worth",
    ],
    
    # Categories available for pre-event surveys
    # These should match the categories in question_bank.py
    "allowed_categories": [
        "expectations",
        "preferences",
        "registration",
        "accessibility",
        "lineup_interest",
        "pricing",
        "logistics",
        "marketing",
    ],
    
    # Survey constraints
    "min_questions": 10,
    "max_questions": 25,
    
    # Question type mix (soft guidance for variety, not strict)
    # Values represent approximate target percentages
    "recommended_type_mix": {
        "Likert": 0.30,          # 30% - Rating scales
        "Single-select": 0.25,   # 25% - Single choice
        "Multi-select": 0.25,    # 25% - Multiple choice
        "text": 0.10,            # 10% - Short text
        "textarea": 0.10,        # 10% - Long text/open-ended
    },
    
    # Bucket-based question counts
    # Used when goals are assigned to priority buckets
    "bucket_question_counts": {
        "must_have": 4,      # 4 questions per must_have goal
        "interested": 2,     # 2 questions per interested goal
        "not_important": 0,  # 0 questions (unless filling gaps)
    },
    
    # Maximum goals allowed in must_have bucket
    "max_must_have_goals": 3,
}


# ===========================================
# API FUNCTIONS
# ===========================================

def is_forbidden_question(question_text: str) -> bool:
    """
    Check if a question contains forbidden patterns.
    
    Args:
        question_text: The question text to check
    
    Returns:
        True if the question matches any forbidden pattern, False otherwise
    """
    question_lower = question_text.lower()
    for pattern in PRE_EVENT_CONFIG["forbidden_patterns"]:
        if pattern.lower() in question_lower:
            return True
    return False


def get_forbidden_patterns() -> List[str]:
    """Get list of forbidden patterns for pre-event surveys."""
    return PRE_EVENT_CONFIG["forbidden_patterns"].copy()


def get_allowed_categories() -> List[str]:
    """Get list of allowed categories for pre-event surveys."""
    return PRE_EVENT_CONFIG["allowed_categories"].copy()


def get_survey_constraints() -> Dict:
    """
    Get survey constraints (min/max questions, type mix).
    
    Returns:
        Dictionary with min_questions, max_questions, recommended_type_mix
    """
    return {
        "min_questions": PRE_EVENT_CONFIG["min_questions"],
        "max_questions": PRE_EVENT_CONFIG["max_questions"],
        "recommended_type_mix": PRE_EVENT_CONFIG["recommended_type_mix"].copy(),
    }


def get_bucket_question_counts() -> Dict[str, int]:
    """
    Get the number of questions to generate per goal bucket.
    
    Returns:
        Dictionary mapping bucket names to question counts
    """
    return PRE_EVENT_CONFIG["bucket_question_counts"].copy()


def get_max_must_have_goals() -> int:
    """Get maximum number of goals allowed in must_have bucket."""
    return PRE_EVENT_CONFIG["max_must_have_goals"]


def validate_question_for_pre_event(question_text: str) -> Dict:
    """
    Validate a question for pre-event appropriateness.
    
    Args:
        question_text: The question text to validate
    
    Returns:
        Dictionary with:
        - is_valid: bool
        - reason: str (if invalid)
        - matched_pattern: str (if matched forbidden pattern)
    """
    question_lower = question_text.lower()
    
    for pattern in PRE_EVENT_CONFIG["forbidden_patterns"]:
        if pattern.lower() in question_lower:
            return {
                "is_valid": False,
                "reason": "Question matches forbidden pattern for pre-event surveys",
                "matched_pattern": pattern,
            }
    
    return {
        "is_valid": True,
        "reason": None,
        "matched_pattern": None,
    }


def format_config_for_prompt() -> str:
    """
    Format the config as a string for inclusion in LLM prompts.
    
    Returns:
        Formatted string describing rules and constraints
    """
    lines = [
        "PRE-EVENT SURVEY RULES:",
        "",
        "FORBIDDEN - Do NOT generate questions that:",
    ]
    
    for pattern in PRE_EVENT_CONFIG["forbidden_patterns"][:10]:  # First 10
        lines.append(f"  - Contain: \"{pattern}\"")
    
    lines.extend([
        "",
        "ALLOWED CATEGORIES:",
        f"  {', '.join(PRE_EVENT_CONFIG['allowed_categories'])}",
        "",
        "SURVEY CONSTRAINTS:",
        f"  - Minimum questions: {PRE_EVENT_CONFIG['min_questions']}",
        f"  - Maximum questions: {PRE_EVENT_CONFIG['max_questions']}",
        "",
        "QUESTION TYPE MIX (approximate):",
    ])
    
    for qtype, pct in PRE_EVENT_CONFIG["recommended_type_mix"].items():
        lines.append(f"  - {qtype}: {int(pct * 100)}%")
    
    return "\n".join(lines)
