from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, get_db, SessionLocal
from models import Base, Monteur
from routers import auftraege, arbeitsschritte, monteure, vorlagen, auswarts
from seed import seed_monteure


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create all tables
    Base.metadata.create_all(bind=engine)
    # Seed initial data if needed
    seed_monteure()
    yield
    # Shutdown: nothing special needed


app = FastAPI(
    title="Getriebe Planungssystem API",
    description="Backend für das Getriebe Planungssystem (Gear Planning System)",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(auftraege.router)
app.include_router(arbeitsschritte.router)
app.include_router(monteure.router)
app.include_router(vorlagen.router)
app.include_router(auswarts.router)


# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    return {"status": "ok"}
