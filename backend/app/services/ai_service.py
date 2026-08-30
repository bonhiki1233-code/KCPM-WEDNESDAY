"""
AI Service - Phase 4 BE1
Tích hợp Google Gemini API cho AI Mentoring

Author: BE1
Created: Feb 2026

Requires:
- google-generativeai>=0.8.0
- Set GOOGLE_GEMINI_API_KEY in .env
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
import asyncio
import json

from app.core.config import settings

logger = logging.getLogger(__name__)

# Rate limiting
_last_api_call: Optional[datetime] = None
_MIN_INTERVAL_SECONDS = 1.0  # Minimum time between API calls


class AIService:
    """
    Service tích hợp Google Gemini API cho mentoring suggestions.
    Supports fallback to mock responses khi không có API key.
    """
    
    def __init__(self):
        self.api_key = settings.GOOGLE_GEMINI_API_KEY
        self.model = None
        self._initialized = False
        
    def _initialize_client(self):
        """Lazy initialization of Gemini client"""
        if self._initialized:
            return
        
        if not self.api_key:
            logger.warning("GOOGLE_GEMINI_API_KEY not set. Using mock responses.")
            self._initialized = True
            return
        
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            self._initialized = True
            logger.info("Google Gemini API initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini API: {e}")
            self._initialized = True  # Mark as initialized to prevent retry
    
    async def _rate_limit(self):
        """Simple rate limiting"""
        global _last_api_call
        if _last_api_call:
            elapsed = (datetime.utcnow() - _last_api_call).total_seconds()
            if elapsed < _MIN_INTERVAL_SECONDS:
                await asyncio.sleep(_MIN_INTERVAL_SECONDS - elapsed)
        _last_api_call = datetime.utcnow()
    
    async def generate_mentoring_suggestions(
        self,
        team_name: str,
        sprint_velocity: float,
        tasks_done: int,
        tasks_total: int,
        days_remaining: int,
        peer_reviews: Optional[List[Dict]] = None,
        blockers: Optional[List[str]] = None,
        additional_context: Optional[str] = None
    ) -> str:
        """
        Tạo AI mentoring suggestions dựa trên team data.
        
        Args:
            team_name: Tên team
            sprint_velocity: % hoàn thành sprint
            tasks_done: Số tasks đã xong
            tasks_total: Tổng số tasks
            days_remaining: Số ngày còn lại
            peer_reviews: List peer reviews (anonymized)
            blockers: List blockers hiện tại
            additional_context: Context bổ sung từ mentor
        
        Returns:
            AI-generated suggestions string
        """
        self._initialize_client()
        
        # Build prompt
        prompt = self._build_mentoring_prompt(
            team_name=team_name,
            sprint_velocity=sprint_velocity,
            tasks_done=tasks_done,
            tasks_total=tasks_total,
            days_remaining=days_remaining,
            peer_reviews=peer_reviews,
            blockers=blockers,
            additional_context=additional_context
        )
        
        # If no API key, return mock response
        if not self.model:
            return self._generate_mock_response(
                sprint_velocity, tasks_done, tasks_total, days_remaining
            )
        
        try:
            await self._rate_limit()
            
            # Call Gemini API
            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt
            )
            
            if response and response.text:
                return response.text
            else:
                logger.warning("Empty response from Gemini API")
                return self._generate_mock_response(
                    sprint_velocity, tasks_done, tasks_total, days_remaining
                )
                
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return self._generate_mock_response(
                sprint_velocity, tasks_done, tasks_total, days_remaining
            )
    
    def _build_mentoring_prompt(
        self,
        team_name: str,
        sprint_velocity: float,
        tasks_done: int,
        tasks_total: int,
        days_remaining: int,
        peer_reviews: Optional[List[Dict]] = None,
        blockers: Optional[List[str]] = None,
        additional_context: Optional[str] = None
    ) -> str:
        """Build the prompt for Gemini API"""
        
        # Format peer reviews (anonymized)
        reviews_text = "No peer review data available."
        if peer_reviews:
            reviews_text = "\n".join([
                f"- Collaboration: {r.get('collaboration_score', 'N/A')}/5, "
                f"Communication: {r.get('communication_score', 'N/A')}/5, "
                f"Contribution: {r.get('contribution_score', 'N/A')}/5"
                f"{' - Comment: ' + r.get('comment', '') if r.get('comment') else ''}"
                for r in peer_reviews[:5]  # Limit to 5 reviews
            ])
        
        # Format blockers
        blockers_text = "No blockers reported."
        if blockers:
            blockers_text = "\n".join([f"- {b}" for b in blockers[:5]])
        
        prompt = f"""You are an experienced academic mentor helping a project-based learning team.

## Team Information
- **Team Name:** {team_name}
- **Sprint Completion Rate:** {sprint_velocity:.1f}%
- **Tasks Completed:** {tasks_done} / {tasks_total}
- **Days Until Deadline:** {days_remaining}

## Recent Peer Reviews (Anonymized)
{reviews_text}

## Current Blockers
{blockers_text}

{f"## Additional Context from Mentor" if additional_context else ""}
{additional_context or ""}

---

Based on the above information, provide **3-5 specific, actionable recommendations** for this team. Focus on:

1. **Team Collaboration** - How can they work together more effectively?
2. **Skill Development** - What skills should they focus on improving?
3. **Project Progress** - How can they meet their deadline?
4. **Communication** - How can they communicate better?

Guidelines:
- Be constructive and supportive in tone
- Give specific, actionable advice (not generic)
- Consider the urgency if deadline is near
- If peer reviews indicate issues, address them tactfully
- Use Vietnamese language for the response

Format each recommendation with a clear heading and explanation."""

        return prompt
    
    def _generate_mock_response(
        self,
        sprint_velocity: float,
        tasks_done: int,
        tasks_total: int,
        days_remaining: int
    ) -> str:
        """Generate mock response when API is unavailable"""
        
        recommendations = []
        
        # Based on sprint velocity
        if sprint_velocity < 50:
            recommendations.append("""### 1. Tăng tốc độ hoàn thành Sprint
Team hiện đang hoàn thành dưới 50% sprint. Đề xuất:
- Tổ chức daily standup ngắn (15 phút) để track tiến độ
- Chia nhỏ tasks lớn thành sub-tasks dễ quản lý hơn
- Identify và remove blockers ngay khi phát hiện""")
        else:
            recommendations.append("""### 1. Duy trì momentum tốt
Team đang có tốc độ hoàn thành tốt. Để duy trì:
- Celebrate small wins để boost morale
- Document lessons learned cho sprint tiếp theo
- Tiếp tục daily sync để maintain progress""")
        
        # Based on remaining days
        if days_remaining <= 7:
            recommendations.append("""### 2. Ưu tiên cho deadline gần
Deadline sắp đến! Đề xuất:
- Tập trung vào must-have features, defer nice-to-have
- Pair programming cho tasks critical
- Code review nhanh hơn để unblock teammates""")
        else:
            recommendations.append("""### 2. Lập kế hoạch dài hạn
Còn thời gian để improve:
- Review và refine backlog
- Allocate time cho technical debt
- Plan for testing và documentation""")
        
        # Task completion rate
        completion_rate = (tasks_done / tasks_total * 100) if tasks_total > 0 else 0
        if completion_rate < 30:
            recommendations.append("""### 3. Cải thiện task management
Số tasks hoàn thành còn thấp:
- Review estimation - có thể tasks đang bị estimate quá lớn?
- Sử dụng Definition of Done rõ ràng
- Focus on finishing tasks thay vì starting new ones""")
        else:
            recommendations.append("""### 3. Tiếp tục momentum
Tiến độ task tốt:
- Maintain code quality với reviews
- Update documentation song song
- Prepare cho demo/presentation""")
        
        recommendations.append("""### 4. Giao tiếp trong team
Để team hoạt động hiệu quả:
- Sử dụng chat channel cho quick updates
- Schedule weekly retrospective
- Encourage mọi người voice concerns sớm""")
        
        recommendations.append("""### 5. Học hỏi và phát triển
Để team phát triển skills:
- Share knowledge sessions ngắn (15-30 mins)
- Pair junior với senior members
- Review code cùng nhau để learn best practices""")
        
        return "\n\n".join(recommendations)
    
    async def analyze_peer_reviews(
        self,
        reviews: List[Dict],
        team_name: str
    ) -> str:
        """
        Phân tích peer reviews và đưa ra insights.
        
        Args:
            reviews: List of peer review data
            team_name: Tên team
        
        Returns:
            Analysis string
        """
        self._initialize_client()
        
        if not reviews:
            return "Không có dữ liệu peer review để phân tích."
        
        # Calculate averages
        avg_collab = sum(r.get('collaboration_score', 0) for r in reviews) / len(reviews)
        avg_comm = sum(r.get('communication_score', 0) for r in reviews) / len(reviews)
        avg_contrib = sum(r.get('contribution_score', 0) for r in reviews) / len(reviews)
        
        prompt = f"""Analyze these anonymized peer review scores for team "{team_name}":

Average Scores (out of 5):
- Collaboration: {avg_collab:.2f}
- Communication: {avg_comm:.2f}
- Contribution: {avg_contrib:.2f}

Individual comments (anonymized):
{chr(10).join([f"- {r.get('comment', 'No comment')}" for r in reviews if r.get('comment')])}

Provide:
1. Summary of team dynamics
2. Potential areas of concern
3. Recommendations for improvement

Use Vietnamese language. Be constructive."""

        if not self.model:
            # Mock analysis
            analysis = f"""## Phân tích Peer Review - {team_name}

### Tổng quan điểm số
- **Hợp tác:** {avg_collab:.2f}/5 {'✅ Tốt' if avg_collab >= 4 else '⚠️ Cần cải thiện' if avg_collab >= 3 else '❌ Cần chú ý'}
- **Giao tiếp:** {avg_comm:.2f}/5 {'✅ Tốt' if avg_comm >= 4 else '⚠️ Cần cải thiện' if avg_comm >= 3 else '❌ Cần chú ý'}
- **Đóng góp:** {avg_contrib:.2f}/5 {'✅ Tốt' if avg_contrib >= 4 else '⚠️ Cần cải thiện' if avg_contrib >= 3 else '❌ Cần chú ý'}

### Đề xuất
- Tổ chức team building activities nếu collaboration score thấp
- Cải thiện kênh giao tiếp nếu communication score thấp
- Review lại phân công công việc nếu contribution không đều"""
            return analysis
        
        try:
            await self._rate_limit()
            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt
            )
            return response.text if response and response.text else self._generate_mock_response(0, 0, 1, 7)
        except Exception as e:
            logger.error(f"Gemini API error in analyze_peer_reviews: {e}")
            return f"Không thể phân tích: {str(e)}"
    
    async def generate_task_breakdown(
        self,
        task_title: str,
        task_description: str,
        estimated_hours: int = 8
    ) -> str:
        """
        AI gợi ý cách chia nhỏ task.
        
        Args:
            task_title: Tên task
            task_description: Mô tả task
            estimated_hours: Thời gian ước tính
        
        Returns:
            Suggested subtasks
        """
        self._initialize_client()
        
        prompt = f"""Break down this development task into smaller subtasks:

**Task:** {task_title}
**Description:** {task_description}
**Estimated Hours:** {estimated_hours}

Provide 3-6 subtasks with:
- Clear, actionable title
- Estimated time for each
- Dependencies if any

Use Vietnamese language. Format as a checklist."""

        if not self.model:
            return f"""## Chia nhỏ task: {task_title}

- [ ] **Phân tích requirements** (~1h)
  - Đọc và hiểu yêu cầu
  - Liệt kê edge cases

- [ ] **Design/Planning** (~1h)  
  - Vẽ flow chart nếu cần
  - Xác định data structures

- [ ] **Implementation** (~{max(1, estimated_hours - 4)}h)
  - Code logic chính
  - Handle edge cases

- [ ] **Testing** (~1h)
  - Viết unit tests
  - Manual testing

- [ ] **Code Review & Fix** (~1h)
  - Request review
  - Fix feedback"""

        try:
            await self._rate_limit()
            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt
            )
            return response.text if response and response.text else "Không thể generate subtasks."
        except Exception as e:
            logger.error(f"Gemini API error in generate_task_breakdown: {e}")
            return f"Lỗi: {str(e)}"


# Singleton instance
ai_service = AIService()


# Convenience function for use in endpoints
async def get_ai_suggestions(context: str) -> str:
    """
    Simple wrapper for AI suggestions.
    Used by mentoring endpoints.
    """
    # Parse context and generate suggestions
    return await ai_service.generate_mentoring_suggestions(
        team_name="Team",
        sprint_velocity=50.0,
        tasks_done=5,
        tasks_total=10,
        days_remaining=7,
        additional_context=context
    )
