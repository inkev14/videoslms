from __future__ import annotations

from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db
from kw_utils import date_to_kw
from models import Arbeitsschritt, Auftrag, Monteur
from schemas import ArbeitsschrittResponse

router = APIRouter(prefix="/planning", tags=["planning"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class ScheduleAuftragResponse(BaseModel):
    auftrag_id: str
    schritte: List[ArbeitsschrittResponse]
    liefertermin_gefaehrdet: bool
    warning: Optional[str] = None


class ScheduleAllItem(BaseModel):
    auftrag_id: str
    schritte_updated: int
    liefertermin_gefaehrdet: bool


class ConflictItem(BaseModel):
    auftrag_id: str
    schritt_id: str
    type: str
    description: str


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def next_working_day(d: date) -> date:
    """Skip weekends (Mon-Fri only)."""
    while d.weekday() >= 5:  # 5=Sat, 6=Sun
        d += timedelta(days=1)
    return d


def add_working_days(start: date, days: int) -> date:
    """Add N working days to a date, skipping weekends."""
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:
            added += 1
    return current


def is_monteur_free(
    monteur_id: str,
    start: date,
    end: date,
    exclude_schritt_id: str,
    db: Session,
) -> bool:
    """Check if monteur has no overlapping non-abgeschlossen schritte in the date range."""
    conflicts = (
        db.query(Arbeitsschritt)
        .filter(
            Arbeitsschritt.monteur_id == monteur_id,
            Arbeitsschritt.id != exclude_schritt_id,
            Arbeitsschritt.abgeschlossen == False,  # noqa: E712
            Arbeitsschritt.geplant_start != None,  # noqa: E711
            Arbeitsschritt.geplant_ende != None,  # noqa: E711
        )
        .all()
    )
    for c in conflicts:
        try:
            cs = date.fromisoformat(c.geplant_start)
            ce = date.fromisoformat(c.geplant_ende)
            # overlap check: ranges overlap when start ≤ ce AND end ≥ cs
            if cs <= end and ce >= start:
                return False
        except (ValueError, TypeError):
            pass
    return True


def find_free_start(
    monteur_id: str,
    earliest: date,
    dauer_tage: int,
    exclude_id: str,
    db: Session,
) -> date:
    """Find the earliest start date where monteur is free for dauer_tage working days."""
    start = next_working_day(earliest)
    for _ in range(365):  # max 1 year search
        end = add_working_days(start, dauer_tage - 1)
        if is_monteur_free(monteur_id, start, end, exclude_id, db):
            return start
        start = next_working_day(start + timedelta(days=1))
    return start


def _schedule_auftrag(auftrag: Auftrag, db: Session) -> tuple[List[Arbeitsschritt], bool]:
    """
    Schedule all non-abgeschlossen steps of one order in-place.

    Returns (updated_schritte, liefertermin_gefaehrdet).
    """
    today = date.today()
    prev_end: Optional[date] = None

    # Determine auftrag.anlieferung as a date, if set
    anlieferung: Optional[date] = None
    if auftrag.anlieferung:
        try:
            anlieferung = date.fromisoformat(auftrag.anlieferung)
        except (ValueError, TypeError):
            pass

    liefertermin: Optional[date] = None
    if auftrag.liefertermin:
        try:
            liefertermin = date.fromisoformat(auftrag.liefertermin)
        except (ValueError, TypeError):
            pass

    # Sort steps by position (relationship already ordered, but be explicit)
    schritte = sorted(auftrag.schritte, key=lambda s: s.position)

    for schritt in schritte:
        if schritt.abgeschlossen:
            # Keep existing end date as anchor for the next step
            if schritt.geplant_ende:
                try:
                    prev_end = date.fromisoformat(schritt.geplant_ende)
                except (ValueError, TypeError):
                    prev_end = today
            else:
                prev_end = today
            continue

        # Determine earliest_start
        candidates: list[date] = [today]
        if prev_end is not None:
            candidates.append(prev_end + timedelta(days=1))
        if anlieferung is not None:
            candidates.append(anlieferung)
        earliest_start = max(candidates)

        # Can't plan if parts are missing
        if schritt.teile_status == "Fehlt":
            # Leave dates as-is; do NOT update prev_end so next step anchors here too
            continue

        # If parts are ordered, wait until they arrive
        if schritt.teile_status == "Bestellt" and schritt.teile_erwartet:
            try:
                te = date.fromisoformat(schritt.teile_erwartet)
                earliest_start = max(earliest_start, te + timedelta(days=1))
            except (ValueError, TypeError):
                pass

        dauer = schritt.dauer_tage if schritt.dauer_tage and schritt.dauer_tage >= 1 else 1

        # Find actual start (accounting for monteur availability)
        if schritt.monteur_id:
            start = find_free_start(schritt.monteur_id, earliest_start, dauer, schritt.id, db)
        else:
            start = next_working_day(earliest_start)

        end = add_working_days(start, dauer - 1)

        schritt.geplant_start = start.isoformat()
        schritt.geplant_ende = end.isoformat()
        schritt.geplant_kw = date_to_kw(start)

        prev_end = end

    db.commit()

    # Determine liefertermin_gefaehrdet
    liefertermin_gefaehrdet = False
    if liefertermin is not None:
        for schritt in schritte:
            if schritt.geplant_ende:
                try:
                    ende = date.fromisoformat(schritt.geplant_ende)
                    if ende > liefertermin:
                        liefertermin_gefaehrdet = True
                        break
                except (ValueError, TypeError):
                    pass

    return schritte, liefertermin_gefaehrdet


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/schedule/{auftrag_id}", response_model=ScheduleAuftragResponse)
def schedule_auftrag(auftrag_id: str, db: Session = Depends(get_db)):
    """Schedule all non-abgeschlossen steps of a single order."""
    auftrag = db.query(Auftrag).filter(Auftrag.id == auftrag_id).first()
    if auftrag is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")

    schritte, liefertermin_gefaehrdet = _schedule_auftrag(auftrag, db)

    # Refresh so response schemas see updated values
    db.refresh(auftrag)

    warning: Optional[str] = None
    if liefertermin_gefaehrdet:
        warning = (
            f"Liefertermin {auftrag.liefertermin} wird voraussichtlich nicht eingehalten."
        )

    return ScheduleAuftragResponse(
        auftrag_id=auftrag_id,
        schritte=[ArbeitsschrittResponse.model_validate(s) for s in auftrag.schritte],
        liefertermin_gefaehrdet=liefertermin_gefaehrdet,
        warning=warning,
    )


@router.post("/schedule-all", response_model=List[ScheduleAllItem])
def schedule_all(db: Session = Depends(get_db)):
    """
    Schedule all orders whose status is not 'Fertig', sorted by liefertermin ascending
    (most urgent first). Returns a summary list.
    """
    auftraege = db.query(Auftrag).all()

    # Filter out "Fertig" orders (status is computed: all schritte abgeschlossen)
    def compute_status(a: Auftrag) -> str:
        if not a.schritte:
            return "Neu"
        if all(s.abgeschlossen for s in a.schritte):
            return "Fertig"
        if any(s.abgeschlossen for s in a.schritte):
            return "In Bearbeitung"
        return "Neu"

    active = [a for a in auftraege if compute_status(a) != "Fertig"]

    # Sort by liefertermin ascending; orders without liefertermin go last
    def liefertermin_key(a: Auftrag):
        if a.liefertermin:
            try:
                return date.fromisoformat(a.liefertermin)
            except (ValueError, TypeError):
                pass
        return date(9999, 12, 31)

    active.sort(key=liefertermin_key)

    results: List[ScheduleAllItem] = []
    for auftrag in active:
        schritte, gefaehrdet = _schedule_auftrag(auftrag, db)
        updated = sum(
            1 for s in schritte if not s.abgeschlossen and s.geplant_start is not None
        )
        results.append(
            ScheduleAllItem(
                auftrag_id=auftrag.id,
                schritte_updated=updated,
                liefertermin_gefaehrdet=gefaehrdet,
            )
        )

    return results


@router.get("/conflicts", response_model=List[ConflictItem])
def get_conflicts(db: Session = Depends(get_db)):
    """
    Find scheduling conflicts:
    - Monteur has overlapping schritte in the same date range
    - Step's geplant_ende > auftrag.liefertermin
    - Step blocked by missing parts but has a KW assigned
    """
    conflicts: List[ConflictItem] = []

    # Collect all non-abgeschlossen schritte with dates
    schritte_with_dates = (
        db.query(Arbeitsschritt)
        .filter(
            Arbeitsschritt.abgeschlossen == False,  # noqa: E712
            Arbeitsschritt.geplant_start != None,  # noqa: E711
            Arbeitsschritt.geplant_ende != None,  # noqa: E711
        )
        .all()
    )

    # --- Conflict type 1: monteur overlaps ---
    # Group by monteur_id
    from collections import defaultdict

    monteur_schritte: dict[str, list[Arbeitsschritt]] = defaultdict(list)
    for s in schritte_with_dates:
        if s.monteur_id:
            monteur_schritte[s.monteur_id].append(s)

    for monteur_id, ms in monteur_schritte.items():
        # Check each pair
        for i in range(len(ms)):
            for j in range(i + 1, len(ms)):
                a, b = ms[i], ms[j]
                try:
                    a_start = date.fromisoformat(a.geplant_start)
                    a_end = date.fromisoformat(a.geplant_ende)
                    b_start = date.fromisoformat(b.geplant_start)
                    b_end = date.fromisoformat(b.geplant_ende)
                except (ValueError, TypeError):
                    continue

                if a_start <= b_end and a_end >= b_start:
                    # Overlap — report for both schritte
                    conflicts.append(
                        ConflictItem(
                            auftrag_id=a.auftrag_id,
                            schritt_id=a.id,
                            type="monteur_overlap",
                            description=(
                                f"Monteur {monteur_id} ist gleichzeitig für Schritt {b.id} "
                                f"(Auftrag {b.auftrag_id}) eingeplant "
                                f"[{b.geplant_start} – {b.geplant_ende}]"
                            ),
                        )
                    )
                    conflicts.append(
                        ConflictItem(
                            auftrag_id=b.auftrag_id,
                            schritt_id=b.id,
                            type="monteur_overlap",
                            description=(
                                f"Monteur {monteur_id} ist gleichzeitig für Schritt {a.id} "
                                f"(Auftrag {a.auftrag_id}) eingeplant "
                                f"[{a.geplant_start} – {a.geplant_ende}]"
                            ),
                        )
                    )

    # --- Conflict type 2: geplant_ende > liefertermin ---
    auftraege = db.query(Auftrag).all()
    auftrag_map = {a.id: a for a in auftraege}

    for s in schritte_with_dates:
        auftrag = auftrag_map.get(s.auftrag_id)
        if auftrag is None or not auftrag.liefertermin:
            continue
        try:
            ende = date.fromisoformat(s.geplant_ende)
            lt = date.fromisoformat(auftrag.liefertermin)
        except (ValueError, TypeError):
            continue
        if ende > lt:
            conflicts.append(
                ConflictItem(
                    auftrag_id=s.auftrag_id,
                    schritt_id=s.id,
                    type="liefertermin_ueberschritten",
                    description=(
                        f"Geplantes Ende {s.geplant_ende} überschreitet "
                        f"den Liefertermin {auftrag.liefertermin}"
                    ),
                )
            )

    # --- Conflict type 3: missing parts but KW assigned ---
    all_schritte = db.query(Arbeitsschritt).filter(
        Arbeitsschritt.abgeschlossen == False  # noqa: E712
    ).all()
    for s in all_schritte:
        if s.teile_status == "Fehlt" and s.geplant_kw is not None:
            conflicts.append(
                ConflictItem(
                    auftrag_id=s.auftrag_id,
                    schritt_id=s.id,
                    type="fehlende_teile_mit_kw",
                    description=(
                        f"Schritt hat KW {s.geplant_kw} zugewiesen, "
                        f"aber Teile fehlen (teile_status='Fehlt')"
                    ),
                )
            )

    return conflicts
