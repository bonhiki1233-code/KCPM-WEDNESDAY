"""Models package for CollabSphere application."""
from app.models.all_models import (
    AcademicClass,
    AuditLog,
    Channel,
    Checkpoint,
    ClassEnrollment,
    Department,
    Evaluation,
    EvaluationCriterion,
    EvaluationDetail,
    Meeting,
    MentoringLog,
    Message,
    Milestone,
    PeerReview,
    Project,
    Resource,
    Role,
    Semester,
    Sprint,
    Submission,
    Subject,
    Syllabus,
    SystemSetting,
    Task,
    Team,
    TeamMember,
    Topic,
    User,
)

__all__ = [
    # Cluster 1: System Identity & Access
    "Role",
    "Department",
    "User",
    "SystemSetting",
    "AuditLog",
    # Cluster 2: Academic Management
    "Semester",
    "Subject",
    "Syllabus",
    "AcademicClass",
    "ClassEnrollment",
    # Cluster 3: Project & Team Formation
    "Topic",
    "Project",
    "Team",
    "TeamMember",
    # Cluster 4: Agile & Collaboration
    "Sprint",
    "Task",
    "Meeting",
    "Channel",
    "Message",
    # Cluster 5: Milestones & Submissions
    "Milestone",
    "Checkpoint",
    "Submission",
    # Cluster 6: Evaluation & Resources
    "EvaluationCriterion",
    "Evaluation",
    "EvaluationDetail",
    "PeerReview",
    "MentoringLog",
    "Resource",
]

