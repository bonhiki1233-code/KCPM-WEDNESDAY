from __future__ import annotations
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.all_models import Task, Sprint
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, db: AsyncSession = Depends(deps.get_db)):
    if payload.sprint_id:
        res = await db.execute(select(Sprint).where(Sprint.sprint_id == payload.sprint_id))
        if not res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Sprint does not exist")
    task = Task(**payload.dict())
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.get("/", response_model=List[TaskResponse])
async def list_tasks(sprint_id: Optional[int] = None, assignee_id: Optional[str] = None, db: AsyncSession = Depends(deps.get_db)):
    q = select(Task)
    if sprint_id is not None:
        q = q.where(Task.sprint_id == sprint_id)
    if assignee_id is not None:
        q = q.where(Task.assignee_id == assignee_id)
    res = await db.execute(q)
    return res.scalars().all()


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: int, db: AsyncSession = Depends(deps.get_db)):
    res = await db.execute(select(Task).where(Task.task_id == task_id))
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: int, payload: TaskUpdate, db: AsyncSession = Depends(deps.get_db)):
    res = await db.execute(select(Task).where(Task.task_id == task_id))
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    data = payload.dict(exclude_unset=True)
    if "sprint_id" in data and data["sprint_id"] is not None:
        r = await db.execute(select(Sprint).where(Sprint.sprint_id == data["sprint_id"]))
        if not r.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Sprint does not exist")
    for k, v in data.items():
        setattr(task, k, v)
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: int, db: AsyncSession = Depends(deps.get_db)):
    res = await db.execute(select(Task).where(Task.task_id == task_id))
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    await db.commit()
    return None
