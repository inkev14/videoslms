from __future__ import annotations

from datetime import date
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Arbeitsschritt, Auftrag
from schemas import (
    ArbeitsschrittCreate,
    ArbeitsschrittResponse,
    ArbeitsschrittUpdate,
    VerschiebenRequest,
)
from kw_utils import kw_to_sort_key, kw_add, kw_diff

router = APIRouter(prefix="/arbeitsschritte", tags=["arbeitsschritte"])

VALID_TYPEN = {
    "Demontage",
    "Reinigen",
    "Sandstrahlen",
    "Montage Baugruppe",
    "Montage",
    "Auswärts",
    "Qualitätskontrolle",
    "Sonstiges",
}

VALID_TEILE_STATUS = {"Vorhanden", "Bestellt", "Fehlt", "N/A"}


def compute_schritt_ampel(schritt) -> str:
    """Compute the traffic-light status for a single Arbeitsschritt."""
    if schritt.abgeschlossen:
        return "Erledigt"
    if schritt.eff_start is not None:
        return "Läuft"
    if schritt.teile_status == "Fehlt":
        return "Blockiert"
    if schritt.geplant_kw is not None:
        return "Geplant"
    return "Offen"


def schritt_to_response(schritt, auftrag=None) -> ArbeitsschrittResponse:
    resp = ArbeitsschrittResponse.model_validate(schritt)
    resp.ampel = compute_schritt_ampel(schritt)
    # Attach auftrag info if passed (for list view)
    if auftrag is not None:
        resp.kunde = auftrag.kunde
        resp.liefertermin = date.fromisoformat(auftrag.liefertermin) if auftrag.liefertermin else None
    return resp


def _sort_key(schritt) -> tuple:
    """Multi-level sort key: kw_sort, geplant_start, liefertermin (from auftrag), position."""
    kw_sort = kw_to_sort_key(schritt.geplant_kw)
    geplant_start = schritt.geplant_start or "9999-99-99"
    # liefertermin comes from the linked auftrag
    liefertermin = "9999-99-99"
    if schritt.auftrag and schritt.auftrag.liefertermin:
        liefertermin = schritt.auftrag.liefertermin
    return (kw_sort, geplant_start, liefertermin, schritt.position)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=List[ArbeitsschrittResponse])
def list_arbeitsschritte(
    auftrag_id: Optional[str] = Query(None),
    monteur_id: Optional[str] = Query(None),
    geplant_kw: Optional[str] = Query(None),
    typ: Optional[str] = Query(None),
    teile_status: Optional[str] = Query(None),
    abgeschlossen: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Arbeitsschritt)
    if auftrag_id is not None:
        q = q.filter(Arbeitsschritt.auftrag_id == auftrag_id)
    if monteur_id is not None:
        q = q.filter(Arbeitsschritt.monteur_id == monteur_id)
    if geplant_kw is not None:
        q = q.filter(Arbeitsschritt.geplant_kw == geplant_kw)
    if typ is not None:
        q = q.filter(Arbeitsschritt.typ == typ)
    if teile_status is not None:
        q = q.filter(Arbeitsschritt.teile_status == teile_status)
    if abgeschlossen is not None:
        q = q.filter(Arbeitsschritt.abgeschlossen == abgeschlossen)

    schritte = q.all()
    schritte_sorted = sorted(schritte, key=_sort_key)

    result = []
    for s in schritte_sorted:
        resp = ArbeitsschrittResponse.model_validate(s)
        resp.ampel = compute_schritt_ampel(s)
        # Attach auftrag meta
        if s.auftrag:
            resp.kunde = s.auftrag.kunde
            resp.liefertermin = (
                date.fromisoformat(s.auftrag.liefertermin) if s.auftrag.liefertermin else None
            )
        result.append(resp)
    return result


@router.post("", response_model=ArbeitsschrittResponse, status_code=201)
def create_arbeitsschritt(payload: ArbeitsschrittCreate, db: Session = Depends(get_db)):
    if payload.typ not in VALID_TYPEN:
        raise HTTPException(
            status_code=400,
            detail=f"Ungültiger Typ '{payload.typ}'. Erlaubt: {sorted(VALID_TYPEN)}",
        )
    if payload.teile_status not in VALID_TEILE_STATUS:
        raise HTTPException(
            status_code=400,
            detail=f"Ungültiger Teile-Status '{payload.teile_status}'. Erlaubt: {sorted(VALID_TEILE_STATUS)}",
        )

    auftrag = db.query(Auftrag).filter(Auftrag.id == payload.auftrag_id).first()
    if not auftrag:
        raise HTTPException(status_code=404, detail=f"Auftrag '{payload.auftrag_id}' nicht gefunden.")

    schritt = Arbeitsschritt(
        id=str(uuid4()),
        auftrag_id=payload.auftrag_id,
        position=payload.position,
        typ=payload.typ,
        bezeichnung=payload.bezeichnung,
        monteur_id=payload.monteur_id,
        teile_status=payload.teile_status,
        teile_erwartet=payload.teile_erwartet.isoformat() if payload.teile_erwartet else None,
        geplant_kw=payload.geplant_kw,
        geplant_start=payload.geplant_start.isoformat() if payload.geplant_start else None,
        geplant_ende=payload.geplant_ende.isoformat() if payload.geplant_ende else None,
        eff_start=payload.eff_start.isoformat() if payload.eff_start else None,
        eff_ende=payload.eff_ende.isoformat() if payload.eff_ende else None,
        abgeschlossen=payload.abgeschlossen,
        bemerkungen=payload.bemerkungen or "",
    )
    db.add(schritt)
    db.commit()
    db.refresh(schritt)

    resp = ArbeitsschrittResponse.model_validate(schritt)
    resp.ampel = compute_schritt_ampel(schritt)
    return resp


@router.put("/{schritt_id}", response_model=ArbeitsschrittResponse)
def update_arbeitsschritt(
    schritt_id: str, payload: ArbeitsschrittUpdate, db: Session = Depends(get_db)
):
    schritt = db.query(Arbeitsschritt).filter(Arbeitsschritt.id == schritt_id).first()
    if not schritt:
        raise HTTPException(status_code=404, detail=f"Arbeitsschritt '{schritt_id}' nicht gefunden.")

    update_data = payload.model_dump(exclude_unset=True)

    if "typ" in update_data and update_data["typ"] not in VALID_TYPEN:
        raise HTTPException(
            status_code=400,
            detail=f"Ungültiger Typ '{update_data['typ']}'. Erlaubt: {sorted(VALID_TYPEN)}",
        )
    if "teile_status" in update_data and update_data["teile_status"] not in VALID_TEILE_STATUS:
        raise HTTPException(
            status_code=400,
            detail=f"Ungültiger Teile-Status '{update_data['teile_status']}'. Erlaubt: {sorted(VALID_TEILE_STATUS)}",
        )

    date_fields = {
        "teile_erwartet", "geplant_start", "geplant_ende", "eff_start", "eff_ende"
    }
    for field, value in update_data.items():
        if field in date_fields and isinstance(value, date):
            setattr(schritt, field, value.isoformat())
        else:
            setattr(schritt, field, value)

    db.commit()
    db.refresh(schritt)

    resp = ArbeitsschrittResponse.model_validate(schritt)
    resp.ampel = compute_schritt_ampel(schritt)
    return resp


@router.delete("/{schritt_id}", status_code=204)
def delete_arbeitsschritt(schritt_id: str, db: Session = Depends(get_db)):
    schritt = db.query(Arbeitsschritt).filter(Arbeitsschritt.id == schritt_id).first()
    if not schritt:
        raise HTTPException(status_code=404, detail=f"Arbeitsschritt '{schritt_id}' nicht gefunden.")
    db.delete(schritt)
    db.commit()


@router.put("/{schritt_id}/verschieben", response_model=List[ArbeitsschrittResponse])
def verschieben(
    schritt_id: str, payload: VerschiebenRequest, db: Session = Depends(get_db)
):
    """Cascade-shift this schritt and all following (higher position) schritte of the same Auftrag."""
    schritt = db.query(Arbeitsschritt).filter(Arbeitsschritt.id == schritt_id).first()
    if not schritt:
        raise HTTPException(status_code=404, detail=f"Arbeitsschritt '{schritt_id}' nicht gefunden.")

    if not schritt.geplant_kw:
        raise HTTPException(
            status_code=400,
            detail="Der Arbeitsschritt hat keine geplante KW. Bitte zuerst eine KW setzen.",
        )

    try:
        delta = kw_diff(schritt.geplant_kw, payload.neue_kw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # All schritte of same auftrag with position >= this schritt's position
    siblings = (
        db.query(Arbeitsschritt)
        .filter(
            Arbeitsschritt.auftrag_id == schritt.auftrag_id,
            Arbeitsschritt.position >= schritt.position,
        )
        .all()
    )

    updated = []
    for s in siblings:
        if s.geplant_kw:
            try:
                s.geplant_kw = kw_add(s.geplant_kw, delta)
            except ValueError:
                pass  # skip if KW is malformed

        # Shift geplant_start / geplant_ende by the same delta in days
        if s.geplant_start:
            try:
                gs = date.fromisoformat(s.geplant_start)
                s.geplant_start = (gs + __import__("datetime").timedelta(weeks=delta)).isoformat()
            except (ValueError, TypeError):
                pass
        if s.geplant_ende:
            try:
                ge = date.fromisoformat(s.geplant_ende)
                s.geplant_ende = (ge + __import__("datetime").timedelta(weeks=delta)).isoformat()
            except (ValueError, TypeError):
                pass
        updated.append(s)

    db.commit()
    for s in updated:
        db.refresh(s)

    result = []
    for s in sorted(updated, key=lambda x: x.position):
        resp = ArbeitsschrittResponse.model_validate(s)
        resp.ampel = compute_schritt_ampel(s)
        result.append(resp)
    return result
