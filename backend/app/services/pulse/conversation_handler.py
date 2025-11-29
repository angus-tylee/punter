import uuid
from typing import Optional, Dict, Any
from supabase import Client
from app.services.instagram.client import InstagramClient
from datetime import datetime


class PulseConversationHandler:
    """Handles Pulse survey conversations via Instagram DMs"""
    
    def __init__(self, supabase: Client, instagram_client: InstagramClient):
        self.supabase = supabase
        self.instagram = instagram_client
    
    def handle_incoming_message(
        self,
        pulse_id: str,
        instagram_user_id: str,
        instagram_username: Optional[str],
        message_text: str
    ) -> Dict[str, Any]:
        """
        Handle an incoming DM message from an Instagram user.
        
        Args:
            pulse_id: Pulse survey ID
            instagram_user_id: Instagram user ID
            instagram_username: Instagram username (optional)
            message_text: Message text from user
        
        Returns:
            Response dictionary with next action
        """
        # Get or create conversation
        conversation = self._get_or_create_conversation(
            pulse_id, instagram_user_id, instagram_username
        )
        
        # Check if user is accepting invitation
        if conversation["status"] == "invited":
            if message_text.strip().upper() in ["YES", "Y", "OK", "OKAY", "SURE", "START"]:
                # User accepted, start survey
                return self._start_survey(conversation)
            else:
                # User didn't accept, send reminder
                return {
                    "action": "remind",
                    "message": "Hi! Would you like to participate in a quick survey? Reply YES to start."
                }
        
        # User is in progress, process their response
        if conversation["status"] == "in_progress":
            return self._process_response(conversation, message_text)
        
        # Conversation completed or abandoned
        return {
            "action": "ignore",
            "message": None
        }
    
    def _get_or_create_conversation(
        self,
        pulse_id: str,
        instagram_user_id: str,
        instagram_username: Optional[str]
    ) -> Dict[str, Any]:
        """Get existing conversation or create new one"""
        # Try to get existing conversation
        result = self.supabase.table("pulse_conversations").select("*").eq(
            "pulse_id", pulse_id
        ).eq("instagram_user_id", instagram_user_id).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]
        
        # Create new conversation
        submission_id = str(uuid.uuid4())
        new_conversation = {
            "pulse_id": pulse_id,
            "instagram_user_id": instagram_user_id,
            "instagram_username": instagram_username,
            "status": "invited",
            "current_question_index": 0,
            "submission_id": submission_id
        }
        
        result = self.supabase.table("pulse_conversations").insert(new_conversation).execute()
        return result.data[0]
    
    def _start_survey(self, conversation: Dict[str, Any]) -> Dict[str, Any]:
        """Start the survey by sending the first question"""
        # Get questions for this pulse
        questions_result = self.supabase.table("pulse_questions").select("*").eq(
            "pulse_id", conversation["pulse_id"]
        ).order("order").execute()
        
        if not questions_result.data or len(questions_result.data) == 0:
            return {
                "action": "error",
                "message": "No questions found for this survey."
            }
        
        questions = questions_result.data
        first_question = questions[0]
        
        # Update conversation status
        self.supabase.table("pulse_conversations").update({
            "status": "in_progress",
            "current_question_index": 0,
            "last_interaction_at": datetime.utcnow().isoformat()
        }).eq("id", conversation["id"]).execute()
        
        # Format first question
        question_text = self._format_question(first_question, 1, len(questions))
        
        return {
            "action": "send_question",
            "message": question_text,
            "question_id": first_question["id"],
            "question_index": 0
        }
    
    def _process_response(
        self,
        conversation: Dict[str, Any],
        response_text: str
    ) -> Dict[str, Any]:
        """Process user's response and send next question"""
        # Get questions
        questions_result = self.supabase.table("pulse_questions").select("*").eq(
            "pulse_id", conversation["pulse_id"]
        ).order("order").execute()
        
        questions = questions_result.data
        current_index = conversation["current_question_index"]
        current_question = questions[current_index]
        
        # Validate and save response
        validated_response = self._validate_response(
            current_question, response_text
        )
        
        if not validated_response["valid"]:
            # Invalid response, ask again
            question_text = self._format_question(
                current_question, current_index + 1, len(questions)
            )
            return {
                "action": "send_question",
                "message": f"{validated_response['error']}\n\n{question_text}",
                "question_id": current_question["id"],
                "question_index": current_index
            }
        
        # Save response
        self.supabase.table("pulse_responses").insert({
            "pulse_id": conversation["pulse_id"],
            "question_id": current_question["id"],
            "submission_id": conversation["submission_id"],
            "instagram_user_id": conversation["instagram_user_id"],
            "instagram_username": conversation["instagram_username"],
            "response_text": validated_response["response_text"]
        }).execute()
        
        # Check if there are more questions
        next_index = current_index + 1
        if next_index >= len(questions):
            # Survey complete
            self.supabase.table("pulse_conversations").update({
                "status": "completed",
                "last_interaction_at": datetime.utcnow().isoformat()
            }).eq("id", conversation["id"]).execute()
            
            return {
                "action": "complete",
                "message": "Thanks for participating! Your responses have been recorded."
            }
        
        # Send next question
        next_question = questions[next_index]
        question_text = self._format_question(next_question, next_index + 1, len(questions))
        
        # Update conversation
        self.supabase.table("pulse_conversations").update({
            "current_question_index": next_index,
            "last_interaction_at": datetime.utcnow().isoformat()
        }).eq("id", conversation["id"]).execute()
        
        return {
            "action": "send_question",
            "message": question_text,
            "question_id": next_question["id"],
            "question_index": next_index
        }
    
    def _format_question(self, question: Dict[str, Any], question_num: int, total: int) -> str:
        """Format question for DM display"""
        text = f"Question {question_num}/{total}:\n{question['question_text']}"
        
        if question["question_type"] == "Single-select" and question.get("options"):
            text += "\n\nOptions:"
            for i, option in enumerate(question["options"], 1):
                text += f"\n{i}. {option}"
            text += "\n\nReply with the number or option text."
        
        return text
    
    def _validate_response(
        self,
        question: Dict[str, Any],
        response_text: str
    ) -> Dict[str, Any]:
        """Validate user's response"""
        response_text = response_text.strip()
        
        if question["question_type"] == "Single-select":
            options = question.get("options", [])
            if not options:
                return {"valid": True, "response_text": response_text}
            
            # Check if response is a number
            try:
                option_num = int(response_text)
                if 1 <= option_num <= len(options):
                    return {
                        "valid": True,
                        "response_text": options[option_num - 1]
                    }
            except ValueError:
                pass
            
            # Check if response matches an option (case-insensitive)
            response_lower = response_text.lower()
            for option in options:
                if option.lower() == response_lower:
                    return {"valid": True, "response_text": option}
            
            # Invalid response
            return {
                "valid": False,
                "error": "Please reply with a valid option number or text."
            }
        
        # Text question - any response is valid
        if not response_text:
            return {
                "valid": False,
                "error": "Please provide a response."
            }
        
        return {"valid": True, "response_text": response_text}
    
    def send_invitation(
        self,
        pulse_id: str,
        instagram_user_id: str,
        instagram_username: Optional[str]
    ) -> Dict[str, Any]:
        """Send DM invitation to user"""
        # Create conversation if it doesn't exist
        conversation = self._get_or_create_conversation(
            pulse_id, instagram_user_id, instagram_username
        )
        
        # Send invitation message
        message = "Hi! Would you like to participate in a quick survey? Reply YES to start."
        
        try:
            self.instagram.send_dm(instagram_user_id, message)
            return {"success": True, "conversation_id": conversation["id"]}
        except Exception as e:
            print(f"Error sending DM invitation: {e}")
            return {"success": False, "error": str(e)}

