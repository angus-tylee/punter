"""Service for generating executive summaries using LLM"""
import json
from typing import Dict, List, Any, Optional
from app.services.llm_service import LLMService


class SummaryGenerator:
    """Generate executive summaries from survey data"""
    
    def __init__(self, llm_service: LLMService):
        self.llm_service = llm_service
    
    async def generate_summary(
        self,
        panorama: Dict[str, Any],
        questions: List[Dict[str, Any]],
        aggregated_stats: Dict[str, Any],
        text_samples: Dict[str, List[str]],
        response_count: int
    ) -> Dict[str, Any]:
        """
        Generate executive summary using LLM.
        
        Args:
            panorama: Panorama metadata (name, description, etc.)
            questions: List of questions
            aggregated_stats: Pre-aggregated statistics from frontend
            text_samples: Sample text responses by question_id
            response_count: Total number of responses
        
        Returns:
            {
                "summary": str,  # 2-3 sentence narrative
                "keyMetrics": List[Dict]  # Key metrics extracted
            }
        """
        try:
            prompt = self._build_prompt(
                panorama, questions, aggregated_stats, text_samples, response_count
            )
            
            response = self.llm_service.client.chat.completions.create(
                model="gpt-4-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert data analyst specializing in event feedback and survey analysis. You create concise, insightful executive summaries that tell a story from the data. Always respond with valid JSON only, no markdown or additional text."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
                max_tokens=500
            )
            
            content = response.choices[0].message.content
            if not content:
                return self._get_fallback_summary(panorama, aggregated_stats)
            
            try:
                result = json.loads(content)
                return {
                    "summary": result.get("summary", ""),
                    "keyMetrics": result.get("keyMetrics", [])
                }
            except json.JSONDecodeError:
                return self._get_fallback_summary(panorama, aggregated_stats)
                
        except Exception as e:
            print(f"Error generating summary: {e}")
            import traceback
            traceback.print_exc()
            return self._get_fallback_summary(panorama, aggregated_stats)
    
    def _build_prompt(
        self,
        panorama: Dict[str, Any],
        questions: List[Dict[str, Any]],
        aggregated_stats: Dict[str, Any],
        text_samples: Dict[str, List[str]],
        response_count: int
    ) -> str:
        """Build prompt for LLM"""
        
        # Extract key statistics
        overall_satisfaction = aggregated_stats.get("overall_satisfaction")
        top_positive = aggregated_stats.get("top_positive_question")
        top_negative = aggregated_stats.get("top_negative_question")
        
        # Build text samples summary
        text_summary = []
        for question_id, samples in text_samples.items():
            if samples:
                question = next((q for q in questions if q.get("id") == question_id), None)
                if question:
                    text_summary.append(f"Question: {question.get('question_text', '')}")
                    text_summary.append(f"Sample responses: {', '.join(samples[:3])}")
        
        prompt = f"""Analyze this event feedback survey and create a concise executive summary.

EVENT CONTEXT:
Event Name: {panorama.get('name', 'Event')}
Total Responses: {response_count}

KEY STATISTICS:
{self._format_stats(aggregated_stats)}

TOP POSITIVE AREA:
{self._format_question_summary(top_positive) if top_positive else 'None identified'}

TOP CONCERN AREA:
{self._format_question_summary(top_negative) if top_negative else 'None identified'}

TEXT RESPONSE SAMPLES:
{chr(10).join(text_summary) if text_summary else 'No text responses'}

Create a 2-3 sentence executive summary that:
1. Captures the overall sentiment
2. Highlights the main strength
3. Identifies the primary area for improvement
4. Uses natural, conversational language (not robotic)

Also extract 2-3 key metrics that stand out.

Return JSON in this format:
{{
  "summary": "Your 2-3 sentence narrative summary here",
  "keyMetrics": [
    {{"label": "Metric name", "value": "metric value", "type": "positive|negative|neutral"}},
    ...
  ]
}}"""
        
        return prompt
    
    def _format_stats(self, stats: Dict[str, Any]) -> str:
        """Format statistics for prompt"""
        lines = []
        if stats.get("overall_satisfaction") is not None:
            lines.append(f"Overall Satisfaction: {stats['overall_satisfaction']:.1%}")
        if stats.get("response_rate"):
            lines.append(f"Response Rate: {stats['response_rate']:.1%}")
        return "\n".join(lines) if lines else "No statistics available"
    
    def _format_question_summary(self, question_data: Dict[str, Any]) -> str:
        """Format question summary for prompt"""
        if not question_data:
            return "None"
        return f"Question: {question_data.get('question_text', '')}\nSentiment: {question_data.get('sentiment_score', 0):.1%}"
    
    def _get_fallback_summary(
        self,
        panorama: Dict[str, Any],
        aggregated_stats: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Fallback summary if LLM fails"""
        event_name = panorama.get('name', 'this event')
        satisfaction = aggregated_stats.get('overall_satisfaction', 0)
        
        if satisfaction > 0.7:
            summary = f"Attendees were very satisfied with {event_name}. The feedback indicates strong positive sentiment overall."
        elif satisfaction > 0.5:
            summary = f"Attendees had a mixed experience with {event_name}. While some aspects were well-received, there are areas for improvement."
        else:
            summary = f"Attendees expressed concerns about {event_name}. The feedback highlights several areas that need attention."
        
        return {
            "summary": summary,
            "keyMetrics": [
                {
                    "label": "Overall Satisfaction",
                    "value": f"{satisfaction:.0%}",
                    "type": "positive" if satisfaction > 0.7 else "negative" if satisfaction < 0.5 else "neutral"
                }
            ]
        }

