"""
Question Strategies for Goal-Based Survey Generation

This module defines strategies for each survey goal, using placeholder tokens
that get replaced with real event data during post-processing.

Placeholder Tokens:
- {{EVENT_NAME}} - Event name
- {{LINEUP_ARTISTS}} - List of artist names (expands to options)
- {{HEADLINER}} - Headliner name (for question text)
- {{PRICING_TIERS}} - Formatted ticket tiers (expands to options)
- {{VIP_PERKS}} - VIP benefits list (for question text)
- {{BAR_BRANDS}} - Beverage partner brands (expands to options)
- {{VENUE}} - Venue name (for question text)
- {{EVENT_DATE}} - Formatted event date (for question text)

Usage:
1. Select strategies based on user's goals and available data
2. Format strategies into LLM prompt
3. LLM generates questions using tokens
4. Post-processor replaces tokens with real data (guaranteed)
"""

from typing import Dict, List, Optional


# ===========================================
# PLACEHOLDER TOKEN REGISTRY
# ===========================================

PLACEHOLDER_TOKENS = {
    "{{EVENT_NAME}}": {
        "source": "event_name",
        "type": "text",
        "description": "Event name for question text",
    },
    "{{LINEUP_ARTISTS}}": {
        "source": "lineup_artists",
        "type": "options",
        "description": "Artist names as multi-select options",
    },
    "{{HEADLINER}}": {
        "source": "headliner",
        "type": "text",
        "description": "Headliner name for question text",
    },
    "{{PRICING_TIERS}}": {
        "source": "pricing_tiers_formatted",
        "type": "options",
        "description": "Ticket tiers as single-select options",
    },
    "{{VIP_PERKS}}": {
        "source": "vip_perks",
        "type": "text_list",
        "description": "VIP perks list for question text",
    },
    "{{BAR_BRANDS}}": {
        "source": "bar_brands",
        "type": "options",
        "description": "Beverage brands as multi-select options",
    },
    "{{VENUE}}": {
        "source": "venue",
        "type": "text",
        "description": "Venue name for question text",
    },
    "{{EVENT_DATE}}": {
        "source": "date_formatted",
        "type": "text",
        "description": "Formatted date for question text",
    },
}


# ===========================================
# GOAL STRATEGIES
# ===========================================

GOAL_STRATEGIES: Dict[str, Dict] = {
    # -----------------------------------------
    # LINEUP PERCEPTION
    # -----------------------------------------
    "lineup_perception": {
        "description": "Understand attendee perception of the lineup",
        "relevant_data": ["lineup", "headliner"],
        "strategies": [
            {
                "id": "artist_excitement",
                "purpose": "Which specific artists drive excitement",
                "requires_data": "lineup",
                "template": {
                    "question_text": "Which artists are you most excited to see at {{EVENT_NAME}}?",
                    "question_type": "Multi-select",
                    "options": ["{{LINEUP_ARTISTS}}", "All equally excited", "Other"],
                }
            },
            {
                "id": "headliner_influence",
                "purpose": "Measure headliner's impact on attendance decision",
                "requires_data": "headliner",
                "template": {
                    "question_text": "How much did {{HEADLINER}} headlining influence your decision to attend {{EVENT_NAME}}?",
                    "question_type": "Likert",
                    "options": ["Not at all", "Slightly", "Moderately", "Significantly", "It was the main reason"],
                }
            },
            {
                "id": "discovery_balance",
                "purpose": "Preference for known vs new artists",
                "requires_data": None,
                "template": {
                    "question_text": "At {{EVENT_NAME}}, what's more important to you?",
                    "question_type": "Single-select",
                    "options": ["Seeing artists I already love", "Discovering new artists", "A good mix of both"],
                }
            },
            {
                "id": "lineup_match",
                "purpose": "How well lineup matches taste",
                "requires_data": None,
                "template": {
                    "question_text": "How well does the announced lineup for {{EVENT_NAME}} match your music taste?",
                    "question_type": "Likert",
                    "options": ["Not at all", "Slightly", "Moderately", "Very well", "Perfectly"],
                }
            },
        ]
    },

    # -----------------------------------------
    # PRICING PERCEPTION
    # -----------------------------------------
    "pricing_perception": {
        "description": "Understand price sensitivity and value perception",
        "relevant_data": ["pricing_tiers", "vip_info"],
        "strategies": [
            {
                "id": "tier_preference",
                "purpose": "Which ticket tier appeals most",
                "requires_data": "pricing_tiers",
                "template": {
                    "question_text": "Which ticket option best fits your needs for {{EVENT_NAME}}?",
                    "question_type": "Single-select",
                    "options": ["{{PRICING_TIERS}}", "Undecided"],
                }
            },
            {
                "id": "vip_appeal",
                "purpose": "Interest in VIP/premium experience",
                "requires_data": "vip_info",
                "template": {
                    "question_text": "VIP tickets for {{EVENT_NAME}} include {{VIP_PERKS}}. How appealing is this to you?",
                    "question_type": "Likert",
                    "options": ["Not appealing", "Slightly appealing", "Moderately appealing", "Very appealing", "Extremely appealing"],
                }
            },
            {
                "id": "price_barrier",
                "purpose": "Is price a barrier to attendance",
                "requires_data": None,
                "template": {
                    "question_text": "How does ticket pricing affect your decision to attend {{EVENT_NAME}}?",
                    "question_type": "Single-select",
                    "options": ["Price doesn't affect my decision", "I'd attend if reasonably priced", "Price is a major factor", "I'm waiting for discounts/deals"],
                }
            },
            {
                "id": "value_perception",
                "purpose": "Perceived value for money",
                "requires_data": None,
                "template": {
                    "question_text": "Based on what you know about {{EVENT_NAME}}, how would you rate the expected value for money?",
                    "question_type": "Likert",
                    "options": ["Very poor value", "Poor value", "Fair value", "Good value", "Excellent value"],
                }
            },
        ]
    },

    # -----------------------------------------
    # FOOD & BEVERAGE INTEREST
    # -----------------------------------------
    "food_beverage_interest": {
        "description": "F&B expectations and preferences",
        "relevant_data": ["bar_partners"],
        "strategies": [
            {
                "id": "brand_interest",
                "purpose": "Interest in specific beverage partners",
                "requires_data": "bar_partners",
                "template": {
                    "question_text": "We're partnering with beverage brands for {{EVENT_NAME}}. Which interest you most?",
                    "question_type": "Multi-select",
                    "options": ["{{BAR_BRANDS}}", "None of these", "Other"],
                }
            },
            {
                "id": "food_importance",
                "purpose": "How important is food quality",
                "requires_data": None,
                "template": {
                    "question_text": "How important is the food and drink offering to your {{EVENT_NAME}} experience?",
                    "question_type": "Likert",
                    "options": ["Not important", "Slightly important", "Moderately important", "Very important", "Extremely important"],
                }
            },
            {
                "id": "dietary_needs",
                "purpose": "Dietary requirements",
                "requires_data": None,
                "template": {
                    "question_text": "Do you have any dietary requirements we should consider for {{EVENT_NAME}}?",
                    "question_type": "Multi-select",
                    "options": ["Vegetarian", "Vegan", "Gluten-free", "Halal", "Kosher", "Nut allergy", "Other allergies", "No specific requirements"],
                }
            },
            {
                "id": "spending_expectation",
                "purpose": "Expected F&B spend",
                "requires_data": None,
                "template": {
                    "question_text": "Approximately how much do you expect to spend on food and drinks at {{EVENT_NAME}}?",
                    "question_type": "Single-select",
                    "options": ["Under $20", "$20-$50", "$50-$100", "$100-$150", "Over $150"],
                }
            },
        ]
    },

    # -----------------------------------------
    # LOGISTICS PLANNING
    # -----------------------------------------
    "logistics_planning": {
        "description": "Transport, timing, and logistical preferences",
        "relevant_data": ["venue", "date"],
        "strategies": [
            {
                "id": "transport_method",
                "purpose": "How attendees will travel",
                "requires_data": "venue",
                "template": {
                    "question_text": "How are you planning to travel to {{VENUE}} for {{EVENT_NAME}}?",
                    "question_type": "Single-select",
                    "options": ["Drive and park", "Public transport", "Taxi/Rideshare", "Walk/Cycle", "Shuttle service if available", "Undecided"],
                }
            },
            {
                "id": "arrival_time",
                "purpose": "When they plan to arrive",
                "requires_data": None,
                "template": {
                    "question_text": "When do you plan to arrive at {{EVENT_NAME}}?",
                    "question_type": "Single-select",
                    "options": ["As early as possible", "In time for specific acts", "Whenever I can make it", "Haven't decided yet"],
                }
            },
            {
                "id": "group_size",
                "purpose": "Who they're attending with",
                "requires_data": None,
                "template": {
                    "question_text": "Who are you planning to attend {{EVENT_NAME}} with?",
                    "question_type": "Single-select",
                    "options": ["By myself", "With a partner", "Small group (3-5)", "Large group (6+)", "Meeting friends there"],
                }
            },
            {
                "id": "day_preference",
                "purpose": "Preferred day if multi-day",
                "requires_data": None,
                "template": {
                    "question_text": "Which days work best for you to attend {{EVENT_NAME}}?",
                    "question_type": "Multi-select",
                    "options": ["Friday", "Saturday", "Sunday", "Any day works", "Weekday if available"],
                }
            },
        ]
    },

    # -----------------------------------------
    # MARKETING EFFECTIVENESS
    # -----------------------------------------
    "marketing_effectiveness": {
        "description": "How they heard about the event and information needs",
        "relevant_data": [],
        "strategies": [
            {
                "id": "discovery_channel",
                "purpose": "How they found out about the event",
                "requires_data": None,
                "template": {
                    "question_text": "How did you first hear about {{EVENT_NAME}}?",
                    "question_type": "Single-select",
                    "options": ["Instagram", "Facebook", "TikTok", "Friend/Word of mouth", "Email newsletter", "Website search", "Poster/Flyer", "Radio", "Other"],
                }
            },
            {
                "id": "information_needs",
                "purpose": "What info would help their decision",
                "requires_data": None,
                "template": {
                    "question_text": "What information would be most helpful before deciding to attend {{EVENT_NAME}}?",
                    "question_type": "Multi-select",
                    "options": ["Full lineup announcement", "Ticket prices", "Venue details", "Schedule/Timetable", "Food and drink options", "Parking/Transport info", "What to bring"],
                }
            },
            {
                "id": "social_sharing",
                "purpose": "Likelihood to share/promote",
                "requires_data": None,
                "template": {
                    "question_text": "How likely are you to share {{EVENT_NAME}} with friends or on social media?",
                    "question_type": "Likert",
                    "options": ["Very unlikely", "Unlikely", "Neutral", "Likely", "Very likely"],
                }
            },
            {
                "id": "registration_motivation",
                "purpose": "Why they registered interest",
                "requires_data": None,
                "template": {
                    "question_text": "What motivated you to register interest in {{EVENT_NAME}}?",
                    "question_type": "Multi-select",
                    "options": ["The lineup/artists", "The venue", "Friend recommendation", "Social media buzz", "Value for money", "Unique concept", "Previous experience with organizer"],
                }
            },
        ]
    },

    # -----------------------------------------
    # ATTENDEE EXPECTATIONS
    # -----------------------------------------
    "attendee_expectations": {
        "description": "What attendees hope to experience",
        "relevant_data": [],
        "strategies": [
            {
                "id": "experience_hopes",
                "purpose": "What they're most looking forward to",
                "requires_data": None,
                "template": {
                    "question_text": "What are you most looking forward to at {{EVENT_NAME}}?",
                    "question_type": "Multi-select",
                    "options": ["Live music performances", "Discovering new artists", "Social atmosphere", "Food and drinks", "Meeting like-minded people", "The venue experience", "Other"],
                }
            },
            {
                "id": "excitement_level",
                "purpose": "Overall excitement level",
                "requires_data": None,
                "template": {
                    "question_text": "How excited are you about attending {{EVENT_NAME}}?",
                    "question_type": "Likert",
                    "options": ["Not excited", "Slightly excited", "Moderately excited", "Very excited", "Extremely excited"],
                }
            },
            {
                "id": "success_criteria",
                "purpose": "What would make it a success for them",
                "requires_data": None,
                "template": {
                    "question_text": "What would make {{EVENT_NAME}} a great experience for you?",
                    "question_type": "textarea",
                    "options": None,
                }
            },
            {
                "id": "unique_experience",
                "purpose": "Importance of unique experience",
                "requires_data": None,
                "template": {
                    "question_text": "How important is it that {{EVENT_NAME}} delivers a unique experience compared to other events?",
                    "question_type": "Likert",
                    "options": ["Not important", "Slightly important", "Moderately important", "Very important", "Extremely important"],
                }
            },
        ]
    },

    # -----------------------------------------
    # ACCESSIBILITY NEEDS
    # -----------------------------------------
    "accessibility_needs": {
        "description": "Accessibility requirements and needs",
        "relevant_data": ["venue"],
        "strategies": [
            {
                "id": "accessibility_features",
                "purpose": "Which accessibility features are needed",
                "requires_data": None,
                "template": {
                    "question_text": "Which accessibility features are important to you for {{EVENT_NAME}}?",
                    "question_type": "Multi-select",
                    "options": ["Wheelchair access", "Accessible viewing areas", "Accessible toilets", "Quiet/low sensory spaces", "Sign language interpretation", "Hearing loops", "None needed"],
                }
            },
            {
                "id": "accessibility_requirements",
                "purpose": "Open-ended accessibility needs",
                "requires_data": None,
                "template": {
                    "question_text": "Do you have any accessibility requirements we should know about for {{EVENT_NAME}}?",
                    "question_type": "textarea",
                    "options": None,
                }
            },
            {
                "id": "venue_accessibility_concern",
                "purpose": "Concerns about venue accessibility",
                "requires_data": "venue",
                "template": {
                    "question_text": "Do you have any concerns about accessibility at {{VENUE}}?",
                    "question_type": "Single-select",
                    "options": ["No concerns", "Some concerns - please contact me", "Prefer not to say"],
                }
            },
            {
                "id": "companion_needs",
                "purpose": "Carer/companion ticket needs",
                "requires_data": None,
                "template": {
                    "question_text": "Will you need a companion/carer ticket for {{EVENT_NAME}}?",
                    "question_type": "Single-select",
                    "options": ["Yes", "No", "Maybe - need more information"],
                }
            },
        ]
    },
}


# ===========================================
# API FUNCTIONS
# ===========================================

def get_strategies_for_goal(goal: str) -> Optional[Dict]:
    """
    Get all strategies for a specific goal.
    
    Args:
        goal: Goal identifier (e.g., "lineup_perception")
    
    Returns:
        Strategy dict with description, relevant_data, and strategies list,
        or None if goal not found
    """
    return GOAL_STRATEGIES.get(goal)


def get_all_goal_ids() -> List[str]:
    """Get list of all available goal identifiers."""
    return list(GOAL_STRATEGIES.keys())


def select_applicable_strategies(
    goal: str, 
    available_data: Dict[str, bool],
    max_strategies: int = 4
) -> List[Dict]:
    """
    Select strategies for a goal based on what data is available.
    
    Prioritizes strategies that can use available data, but includes
    fallback strategies that don't require data.
    
    Args:
        goal: Goal identifier
        available_data: Dict mapping data types to availability (e.g., {"lineup": True, "headliner": False})
        max_strategies: Maximum number of strategies to return
    
    Returns:
        List of applicable strategy dicts
    """
    goal_config = GOAL_STRATEGIES.get(goal)
    if not goal_config:
        return []
    
    strategies = goal_config.get("strategies", [])
    applicable = []
    
    # First pass: strategies that can use available data
    for strategy in strategies:
        requires = strategy.get("requires_data")
        if requires and available_data.get(requires, False):
            applicable.append(strategy)
    
    # Second pass: strategies that don't require data (always applicable)
    for strategy in strategies:
        if strategy.get("requires_data") is None:
            if strategy not in applicable:
                applicable.append(strategy)
    
    # Third pass: if we still need more, include strategies even if data is missing
    # (they'll use fallback options)
    if len(applicable) < max_strategies:
        for strategy in strategies:
            if strategy not in applicable:
                applicable.append(strategy)
                if len(applicable) >= max_strategies:
                    break
    
    return applicable[:max_strategies]


def format_strategies_for_prompt(
    goal_strategies: Dict[str, List[Dict]],
    extracted_data: Dict,
    must_have_goals: List[str],
    interested_goals: List[str]
) -> str:
    """
    Format selected strategies into LLM prompt instructions.
    
    Args:
        goal_strategies: Dict mapping goal to list of selected strategies
        extracted_data: Extracted event data for preview
        must_have_goals: Goals in must_have bucket (4 questions each)
        interested_goals: Goals in interested bucket (2 questions each)
    
    Returns:
        Formatted string for LLM prompt
    """
    lines = [
        "QUESTION STRATEGIES TO IMPLEMENT:",
        "",
        "Use placeholder tokens exactly as shown. The system will replace them with real data.",
        "",
    ]
    
    # Must Have goals (4 questions each)
    if must_have_goals:
        lines.append("=" * 50)
        lines.append("MUST HAVE GOALS (generate 4 questions per goal)")
        lines.append("=" * 50)
        
        for goal in must_have_goals:
            strategies = goal_strategies.get(goal, [])
            lines.append(f"\n### GOAL: {goal.replace('_', ' ').title()}")
            lines.append(f"Generate 4 questions using these strategies:\n")
            
            for i, s in enumerate(strategies[:4], 1):
                template = s.get("template", {})
                lines.append(f"{i}. PURPOSE: {s.get('purpose', 'General question')}")
                lines.append(f"   TEMPLATE: \"{template.get('question_text', '')}\"")
                lines.append(f"   TYPE: {template.get('question_type', 'Single-select')}")
                if template.get("options"):
                    lines.append(f"   OPTIONS: {template.get('options')}")
                lines.append("")
    
    # Interested goals (2 questions each)
    if interested_goals:
        lines.append("=" * 50)
        lines.append("INTERESTED TO KNOW (generate 2 questions per goal)")
        lines.append("=" * 50)
        
        for goal in interested_goals:
            strategies = goal_strategies.get(goal, [])
            lines.append(f"\n### GOAL: {goal.replace('_', ' ').title()}")
            lines.append(f"Generate 2 questions using these strategies:\n")
            
            for i, s in enumerate(strategies[:2], 1):
                template = s.get("template", {})
                lines.append(f"{i}. PURPOSE: {s.get('purpose', 'General question')}")
                lines.append(f"   TEMPLATE: \"{template.get('question_text', '')}\"")
                lines.append(f"   TYPE: {template.get('question_type', 'Single-select')}")
                if template.get("options"):
                    lines.append(f"   OPTIONS: {template.get('options')}")
                lines.append("")
    
    # Show available data for reference
    lines.append("=" * 50)
    lines.append("AVAILABLE EVENT DATA (for reference)")
    lines.append("=" * 50)
    
    if extracted_data.get("lineup_artists"):
        lines.append(f"LINEUP_ARTISTS: {extracted_data['lineup_artists'][:5]}{'...' if len(extracted_data.get('lineup_artists', [])) > 5 else ''}")
    if extracted_data.get("headliner"):
        lines.append(f"HEADLINER: {extracted_data['headliner']}")
    if extracted_data.get("pricing_tiers_formatted"):
        lines.append(f"PRICING_TIERS: {extracted_data['pricing_tiers_formatted']}")
    if extracted_data.get("vip_perks"):
        lines.append(f"VIP_PERKS: {', '.join(extracted_data['vip_perks'][:3])}{'...' if len(extracted_data.get('vip_perks', [])) > 3 else ''}")
    if extracted_data.get("bar_brands"):
        lines.append(f"BAR_BRANDS: {extracted_data['bar_brands']}")
    if extracted_data.get("venue"):
        lines.append(f"VENUE: {extracted_data['venue']}")
    
    return "\n".join(lines)


def get_placeholder_tokens() -> Dict:
    """Get the placeholder token registry."""
    return PLACEHOLDER_TOKENS.copy()
