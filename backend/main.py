import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class CORSSafeErrorMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        try:
            return await call_next(request)
        except Exception:
            logger.exception("Unhandled server error")
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=500,
                content={"error": "internal_server_error", "detail": "An unexpected error occurred."},
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("gecx-hub-api starting up")
    yield
    logger.info("gecx-hub-api shutting down")


app = FastAPI(
    title="GECX Accelerator Hub API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(CORSSafeErrorMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers.auth import router as auth_router
from routers.context import router as context_router
from routers.projects import router as projects_router
from routers.downloads import router as downloads_router
from routers.accelerators.callbacks import router as callbacks_router
from routers.accelerators.guardrails import router as guardrails_router
from routers.accelerators.instructions import router as instructions_router
from routers.accelerators.scaffolder import router as scaffolder_router
from routers.accelerators.tools import router as tools_router
from routers.source_extraction import router as source_extraction_router

app.include_router(auth_router)
app.include_router(context_router)
app.include_router(projects_router)
app.include_router(downloads_router)
app.include_router(callbacks_router)
app.include_router(guardrails_router)
app.include_router(instructions_router)
app.include_router(scaffolder_router)
app.include_router(tools_router)
app.include_router(source_extraction_router)

# Router registrations (uncomment as modules are implemented)
# from routers import apps
# app.include_router(apps.router, prefix="/apps", tags=["apps"])


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "service": "gecx-hub-api", "version": "1.0.0"}


@app.exception_handler(404)
async def not_found_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=404, content={"error": "not_found", "detail": str(exc)})
