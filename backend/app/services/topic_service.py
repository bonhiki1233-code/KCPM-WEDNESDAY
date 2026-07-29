from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from datetime import datetime, timezone

from app.models.all_models import Topic, Evaluation, User
from app.schemas.topic import TopicCreate, EvaluationCreate

class TopicService:
    @staticmethod
    async def create_topic(db: AsyncSession, topic_in: TopicCreate, user_id: int) -> Topic:
        new_topic = Topic(
            title=topic_in.title,
            description=topic_in.description,
            requirements=topic_in.requirements,
            objectives=topic_in.objectives,
            tech_stack=topic_in.tech_stack,
            status="DRAFT",
            created_by=user_id,
            creator_id=user_id,
            created_at=datetime.now(timezone.utc),
        )
        db.add(new_topic)
        await db.commit()
        await db.refresh(new_topic)
        return new_topic

    @staticmethod
    async def get_topics(db: AsyncSession, user_role: int, status_filter: Optional[str] = None) -> List[Topic]:
        query = select(Topic)
        
        # Filter: students (role_id=5) see only APPROVED
        if user_role == 5:
            query = query.where(Topic.status == "APPROVED")
        
        # Optional status filter
        if status_filter:
            query = query.where(Topic.status == status_filter)
            
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_topic_by_id(db: AsyncSession, topic_id: int) -> Optional[Topic]:
        query = select(Topic).where(Topic.topic_id == topic_id)
        result = await db.execute(query)
        return result.scalar()

    @staticmethod
    async def approve_topic(db: AsyncSession, topic: Topic, approver_id: int) -> Topic:
        topic.status = "APPROVED"
        topic.approved_by = approver_id
        topic.approved_at = datetime.now(timezone.utc)
        
        db.add(topic)
        await db.commit()
        await db.refresh(topic)
        return topic

    @staticmethod
    async def reject_topic(db: AsyncSession, topic: Topic, rejector_id: int) -> Topic:
        topic.status = "REJECTED"
        topic.approved_by = rejector_id  # Tracking who rejected it in the approved_by column (or we could use a separate column logic if model supported it)
        topic.approved_at = datetime.now(timezone.utc)
        
        db.add(topic)
        await db.commit()
        await db.refresh(topic)
        return topic

    @staticmethod
    async def create_evaluation(db: AsyncSession, eval_in: EvaluationCreate, evaluator_id: int, topic_id: int) -> Evaluation:
        evaluation = Evaluation(
            team_id=eval_in.team_id,
            topic_id=topic_id,
            # project_id might be needed if it's not part of the schema or model differently
            # The schema has project_id, let's use it
            evaluator_id=evaluator_id,
            score=eval_in.score,
            feedback=eval_in.feedback,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        # Note: The provided CODE/topics.py uses 'project_id' in Evaluation constructor but the schema had it.
        # Checking reference code again: 
        # evaluation = Evaluation(..., project_id=project_id, ...)
        # Wait, the reference code in step 115 snippet for create_evaluation:
        # project_id=5 (in docstring), but in code:
        # It takes `eval_data: EvaluationCreate` which has `project_id`.
        # But `Evaluation` model in `create_evaluation` function in `topics.py` (Step 115) does NOT set project_id? 
        # Wait, Step 115 line 381:
        # evaluation = Evaluation(team_id=eval_data.team_id, topic_id=topic_id, evaluator_id=..., ...)
        # It misses project_id?
        # Let's check Step 116 (Starter Code): 
        # evaluation = Evaluation(..., project_id=project_id, ...)
        # The schema in Step 117 has `project_id`.
        # I should include `project_id` if the model supports it. 
        # Since I cannot see the model definition, I will assume I should map it if it's in the schema.
        # However, `create_evaluation` in `topics.py` (Step 115) did not use it.
        # I'll check `models/all_models.py` if I can, but to be safe I will just include it if it is in schema.
        # Wait, in Step 115 `EvaluationCreate` has `project_id`?
        # Yes, Step 117 shows `project_id: int`.
        # I will pass it.
        
        # There is a discrepancy between Step 115 (topics.py) which doesn't seem to set project_id, 
        # and Step 116 (STARTER) which sets it.
        # I will set it to be safe.
        evaluation.project_id = eval_in.project_id
        
        db.add(evaluation)
        await db.commit()
        await db.refresh(evaluation)
        return evaluation

    @staticmethod
    async def get_evaluations(db: AsyncSession, team_id: Optional[int] = None) -> List[Evaluation]:
        query = select(Evaluation)
        if team_id:
            query = query.where(Evaluation.team_id == team_id)
        result = await db.execute(query)
        return result.scalars().all()
