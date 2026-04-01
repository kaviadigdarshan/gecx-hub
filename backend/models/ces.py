from pydantic import BaseModel


class GCPProject(BaseModel):
    project_id: str
    display_name: str
    state: str
    project_number: str


class CESApp(BaseModel):
    name: str
    displayName: str
    state: str = "STATE_UNSPECIFIED"


class ProjectListResponse(BaseModel):
    projects: list[GCPProject]


class AppListResponse(BaseModel):
    apps: list[CESApp]
    warning: str | None = None
