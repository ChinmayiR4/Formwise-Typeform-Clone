"""FastAPI entrypoint: `uvicorn app.main:app --reload`."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import ai, forms, public, results, workspaces
from .seed import init_db

logging.basicConfig(level=logging.INFO)
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db(seed_if_empty=settings.seed_on_startup)
    yield


app = FastAPI(
    title="Formwise API",
    version="1.0.0",
    description="Backend for a Typeform-style form builder: forms, questions, logic, responses, AI.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

for r in (workspaces.router, forms.router, results.router, public.router, ai.router):
    app.include_router(r)


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def root():
    return {"name": "Formwise API", "docs": "/docs"}
