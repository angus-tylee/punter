from typing import Dict, List

UNIVERSAL_QUESTIONS = {
    "first_name": {
        "question_text": "First Name",
        "question_type": "text",
        "required": True,
        "order": -10
    },
    "last_name": {
        "question_text": "Last Name",
        "question_type": "text",
        "required": True,
        "order": -9
    },
    "email": {
        "question_text": "Email Address",
        "question_type": "email",
        "required": True,
        "order": -8
    },
    "phone": {
        "question_text": "Phone Number",
        "question_type": "phone",
        "required": False,
        "order": -7
    },
    "home_base": {
        "question_text": "Where is your home base / where did you grow up?",
        "question_type": "text",
        "required": False,
        "order": -6
    },
    "current_location": {
        "question_text": "Where do you currently live?",
        "question_type": "text",
        "required": False,
        "order": -5
    },
    "age_bracket": {
        "question_text": "Age bracket",
        "question_type": "Single-select",
        "options": ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
        "required": False,
        "order": -4
    },
    "occupation": {
        "question_text": "Occupation / Field of Work",
        "question_type": "text",
        "required": False,
        "order": -3
    }
}


def get_universal_question_texts() -> List[str]:
    """Return list of all universal question texts for deduplication"""
    return [q["question_text"] for q in UNIVERSAL_QUESTIONS.values()]


def get_universal_questions(panorama_id: str, config: dict) -> List[Dict]:
    """
    Generate universal questions based on panorama config.
    
    Args:
        panorama_id: The panorama ID
        config: Dictionary with optional question flags, e.g. {"phone": True, "home_base": True}
    
    Returns:
        List of question dictionaries with is_universal=True flag
    """
    questions = []
    
    # Always include required questions
    for key in ["first_name", "last_name", "email"]:
        q = UNIVERSAL_QUESTIONS[key].copy()
        q["panorama_id"] = panorama_id
        q["is_universal"] = True
        questions.append(q)
    
    # Include optional questions based on config
    optional_keys = ["phone", "home_base", "current_location", "age_bracket", "occupation"]
    for key in optional_keys:
        if config.get(key, False):
            q = UNIVERSAL_QUESTIONS[key].copy()
            q["panorama_id"] = panorama_id
            q["is_universal"] = True
            questions.append(q)
    
    return questions

