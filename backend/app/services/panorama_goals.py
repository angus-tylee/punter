"""Service for providing panorama type-specific goal templates"""

from typing import List, Dict


def get_goals_for_type(panorama_type: str) -> List[Dict[str, str]]:
    """
    Get template goals for a panorama type.
    Returns list of goal dictionaries with 'id' and 'text' fields.
    """
    templates = {
        "plan": [
            {"id": "goal-1", "text": "Understand target audience preferences"},
            {"id": "goal-2", "text": "Gauge interest in potential lineup"},
            {"id": "goal-3", "text": "Assess pricing sensitivity"},
            {"id": "goal-4", "text": "Identify preferred event dates/times"},
            {"id": "goal-5", "text": "Evaluate venue preferences"},
            {"id": "goal-6", "text": "Measure brand awareness"},
            {"id": "goal-7", "text": "Assess marketing channel effectiveness"},
        ],
        "pulse": [
            {"id": "goal-1", "text": "Track real-time attendee sentiment"},
            {"id": "goal-2", "text": "Monitor campaign engagement"},
            {"id": "goal-3", "text": "Gather pre-event feedback"},
            {"id": "goal-4", "text": "Assess ticket sales drivers"},
            {"id": "goal-5", "text": "Identify last-minute concerns"},
            {"id": "goal-6", "text": "Measure social media buzz"},
            {"id": "goal-7", "text": "Evaluate promotional effectiveness"},
        ],
        "playback": [
            {"id": "goal-1", "text": "Measure overall event satisfaction"},
            {"id": "goal-2", "text": "Evaluate lineup performance"},
            {"id": "goal-3", "text": "Assess venue experience"},
            {"id": "goal-4", "text": "Gather improvement suggestions"},
            {"id": "goal-5", "text": "Measure value for money"},
            {"id": "goal-6", "text": "Collect testimonials"},
            {"id": "goal-7", "text": "Understand return attendance likelihood"},
        ],
    }
    
    return templates.get(panorama_type, [])


def get_type_description(panorama_type: str) -> Dict[str, str]:
    """
    Get description and expected outcomes for a panorama type.
    """
    descriptions = {
        "plan": {
            "name": "Plan",
            "description": "Pre-launch surveys to understand your audience and plan your event effectively.",
            "outcomes": "You'll get insights on audience preferences, pricing sensitivity, preferred dates, and lineup interest to help you make data-driven decisions before launch.",
        },
        "pulse": {
            "name": "Pulse",
            "description": "Real-time surveys during your campaign to track engagement and sentiment.",
            "outcomes": "You'll get real-time feedback on campaign performance, attendee sentiment, ticket sales drivers, and promotional effectiveness to optimize your campaign on the fly.",
        },
        "playback": {
            "name": "Playback",
            "description": "Post-event surveys to measure satisfaction and gather feedback for future improvements.",
            "outcomes": "You'll get comprehensive feedback on event satisfaction, lineup performance, venue experience, and improvement suggestions to make your next event even better.",
        },
    }
    
    return descriptions.get(panorama_type, {
        "name": panorama_type,
        "description": "",
        "outcomes": "",
    })

