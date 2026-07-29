from typing import List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from app.models.all_models import Topic, User
from app.schemas.topic import TopicCreate, TopicUpdate
import datetime
import time

class TopicDAO:
    _cache = {}
    _cache_ttl = 60  # 60 seconds

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all_topics(self, status: Optional[str] = None) -> List[Topic]:
        """
        Get all topics with optional status filter.
        Optimized to eager load creator to avoid N+1.
        Includes simple in-memory caching.
        """
        cache_key = f"topics_{status}"
        now = time.time()
        
        if cache_key in self._cache:
            data, timestamp = self._cache[cache_key]
            if now - timestamp < self._cache_ttl:
                return data

        query = select(Topic).options(
            joinedload(Topic.creator)
        )

        if status:
            query = query.where(Topic.status == status)

        result = await self.db.execute(query)
        topics = result.scalars().all()
        
        # Update cache
        self._cache[cache_key] = (topics, now)
        
        return topics

    async def get_topic_by_id(self, topic_id: int) -> Optional[Topic]:
        """
        Get topic by ID with eager loaded relationships.
        """
        query = select(Topic).options(
            joinedload(Topic.creator),
            joinedload(Topic.department)
        ).where(Topic.topic_id == topic_id)

        result = await self.db.execute(query)
        return result.scalar()

    async def create_topic(self, topic_data: TopicCreate, creator_id: any, dept_id: Optional[int]) -> Topic:
        """
        Create a new topic. Invalidates cache.
        """
        new_topic = Topic(
            title=topic_data.title,
            description=topic_data.description,
            requirements=topic_data.requirements,
            objectives=topic_data.objectives,
            tech_stack=topic_data.tech_stack,
            status="DRAFT",
            creator_id=creator_id,
            created_by=creator_id, 
            dept_id=dept_id,
            created_at=datetime.datetime.now(datetime.timezone.utc)
        )
        
        self.db.add(new_topic)
        await self.db.commit()
        await self.db.refresh(new_topic)
        
        # Invalidate cache
        self._cache.clear()
        
        return new_topic

    async def update_topic_status(self, topic: Topic, status: str, approved_by: Optional[any] = None) -> Topic:
        topic.status = status
        if status == "APPROVED" or status == "REJECTED":
            topic.approved_by = approved_by
            topic.approved_at = datetime.datetime.now(datetime.timezone.utc)
        
        self.db.add(topic)
        await self.db.commit()
        await self.db.refresh(topic)
        
        # Invalidate cache
        self._cache.clear()
        
        return topic

    async def delete_topic(self, topic: Topic) -> None:
        await self.db.delete(topic)
        await self.db.commit()

        # Invalidate cache
        self._cache.clear()
