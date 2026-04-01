from pydantic import BaseModel


class User(BaseModel):
    id: str | None = None
    email: str
    name: str
    picture: str | None = None


class TokenExchangeRequest(BaseModel):
    code: str
    redirect_uri: str


class CallbackRequest(BaseModel):
    code: str


class TokenResponse(BaseModel):
    token: str
    user: User


class AuthUrlResponse(BaseModel):
    url: str
