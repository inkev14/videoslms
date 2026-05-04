from __future__ import annotations

from datetime import date
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Arbeitsschritt, Auftrag, Vorlage
from schemas import (
    AuftragCreateWithVorlage,
    AuftragResponse,
    AuftragUpdate,
    ArbeitsschrittResponse,
    ReorderRequest,
)
from kw_utils import kw_to_sort_key

router = APIRouter(prefix="/auftraege", tags=["auftraege"])

# ---------------------------------------------------------------------------
# Helper: compute status
# ---------------------------------------------------------------------------

VALID_AUFTRAG_TYPEN = {"Revision Inhouse", "Revision Auswärts", "Neugetriebe"}


def compute_auftrag_status(schritte: list) -> str:
    """Derive the Auftrag status from its Arbeitsschritte."""
    if not schritte:
        return "Eingang"
    if all(s.abgeschlossen for s in schritte):
        return "Fertig"
    if any(s.teile_status == "Fehlt" for s in schritte):
        return "Warten Teile"
    if any(s.eff_start is not None and not s.abgeschlossen for s in schritte):
        return "In Arbeit"
    return "Eingang"


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


def schritt_to_response(s) -> ArbeitsschrittResponse:
    resp = ArbeitsschrittResponse.model_validate(s)
    resp.ampel = compute_schritt_ampel(s)
    return resp


def auftrag_to_response(auftrag: Auftrag) -> AuftragResponse:
    resp = AuftragResponse.model_validate(auftrag)
    resp.status = compute_auftrag_status(auftrag.schritte)
    resp.schritte = [schritt_to_response(s) for s in sorted(auftrag.schritte, key=lambda x: x.position)]
    return resp


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=List[AuftragResponse])
def list_auftraege(db: Session = Depends(get_db)):
    auftraege = db.query(Auftrag).all()
    return [auftrag_to_response(a) for a in auftraege]


@router.post("", response_model=AuftragResponse, status_code=201)
def create_auftrag(payload: AuftragCreateWithVorlage, db: Session = Depends(get_db)):
    if payload.typ not in VALID_AUFTRAG_TYPEN:
        raise HTTPException(
            status_code=400,
            detail=f"Ungültiger Typ '{payload.typ}'. Erlaubt: {sorted(VALID_AUFTRAG_TYPEN)}",
        )

    auftrag_id = payload.id or f"REV-{str(uuid4())[:8].upper()}"

    # Check uniqueness
    if db.query(Auftrag).filter(Auftrag.id == auftrag_id).first():
        raise HTTPException(status_code=400, detail=f"Auftrag mit ID '{auftrag_id}' existiert bereits.")

    auftrag = Auftrag(
        id=auftrag_id,
        kunde=payload.kunde,
        typ=payload.typ,
        getriebe_bezeichnung=payload.getriebe_bezeichnung,
        liefertermin=payload.liefertermin.isoformat() if payload.liefertermin else None,
        anlieferung=payload.anlieferung.isoformat() if payload.anlieferung else None,
        bemerkungen=payload.bemerkungen or "",
        erstellt_am=date.today().isoformat(),
    )
    db.add(auftrag)
    db.flush()  # get the ID available for FK references

    # Copy schritte from vorlage if requested
    if payload.vorlage_id:
        vorlage = db.query(Vorlage).filter(Vorlage.id == payload.vorlage_id).first()
        if not vorlage:
            raise HTTPException(status_code=404, detail=f"Vorlage '{payload.vorlage_id}' nicht gefunden.")
        for vs in sorted(vorlage.schritte, key=lambda x: x.position):
            schritt = Arbeitsschritt(
                id=str(uuid4()),
                auftrag_id=auftrag_id,
                position=vs.position,
                typ=vs.typ,
                bezeichnung=vs.bezeichnung,
                teile_status="N/A",
                abgeschlossen=False,
                bemerkungen="",
            )
            db.add(schritt)

    db.commit()
    db.refresh(auftrag)
    return auftrag_to_response(auftrag)


@router.get("/{auftrag_id}", response_model=AuftragResponse)
def get_auftrag(auftrag_id: str, db: Session = Depends(get_db)):
    auftrag = db.query(Auftrag).filter(Auftrag.id == auftrag_id).first()
    if not auftrag:
        raise HTTPException(status_code=404, detail=f"Auftrag '{auftrag_id}' nicht gefunden.")
    return auftrag_to_response(auftrag)


@router.put("/{auftrag_id}", response_model=AuftragResponse)
def update_auftrag(auftrag_id: str, payload: AuftragUpdate, db: Session = Depends(get_db)):
    auftrag = db.query(Auftrag).filter(Auftrag.id == auftrag_id).first()
    if not auftrag:
        raise HTTPException(status_code=404, detail=f"Auftrag '{auftrag_id}' nicht gefunden.")

    if payload.typ is not None and payload.typ not in VALID_AUFTRAG_TYPEN:
        raise HTTPException(
            status_code=400,
            detail=f"Ungültiger Typ '{payload.typ}'. Erlaubt: {sorted(VALID_AUFTRAG_TYPEN)}",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if isinstance(value, date):
            setattr(auftrag, field, value.isoformat())
        else:
            setattr(auftrag, field, value)

    db.commit()
    db.refresh(auftrag)
    return auftrag_to_response(auftrag)


@router.delete("/{auftrag_id}", status_code=204)
def delete_auftrag(auftrag_id: str, db: Session = Depends(get_db)):
    auftrag = db.query(Auftrag).filter(Auftrag.id == auftrag_id).first()
    if not auftrag:
        raise HTTPException(status_code=404, detail=f"Auftrag '{auftrag_id}' nicht gefunden.")
    db.delete(auftrag)
    db.commit()


@router.put("/{auftrag_id}/reorder", response_model=AuftragResponse)
def reorder_schritte(auftrag_id: str, payload: ReorderRequest, db: Session = Depends(get_db)):
    auftrag = db.query(Auftrag).filter(Auftrag.id == auftrag_id).first()
    if not auftrag:
        raise HTTPException(status_code=404, detail=f"Auftrag '{auftrag_id}' nicht gefunden.")

    schritt_map = {s.id: s for s in auftrag.schritte}
    for item in payload.items:
        if item.id not in schritt_map:
            raise HTTPException(
                status_code=400,
                detail=f"Arbeitsschritt '{item.id}' gehört nicht zu Auftrag '{auftrag_id}'.",
            )
        schritt_map[item.id].position = item.position

    db.commit()
    db.refresh(auftrag)
    return auftrag_to_response(auftrag)
