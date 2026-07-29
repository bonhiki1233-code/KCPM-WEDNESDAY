from pydantic import BaseModel

class JoinTeamRequest(BaseModel):
    join_code: str
