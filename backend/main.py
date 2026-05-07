from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text

from database import engine, get_db, SessionLocal
from models import Base, Monteur
from routers import auftraege, arbeitsschritte, monteure, vorlagen, auswarts
from routers.planning import router as planning_router
from seed import seed_monteure


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create all tables
    Base.metadata.create_all(bind=engine)
    # Migrate: add new columns if they don't exist yet
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE arbeitsschritte ADD COLUMN dauer_tage INTEGER DEFAULT 1"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE arbeitsschritte ADD COLUMN lieferant TEXT"))
            conn.commit()
        except Exception:
            pass
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
app.include_router(planning_router)


# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    return {"status": "ok"}
