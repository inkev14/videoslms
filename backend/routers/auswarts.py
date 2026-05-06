from __future__ import annotations

from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Arbeitsschritt, AuswärtsInfo
from schemas import (
    AuswärtsInfoCreate,
    AuswärtsInfoResponse,
    AuswärtsInfoUpdate,
)

router = APIRouter(prefix="/auswarts", tags=["auswarts"])

VALID_STATUS = {"Ausstehend", "Unterwegs", "Zurück", "Verzögert"}


class AuswärtsInfoDetailResponse(AuswärtsInfoResponse):
    """Extended response that includes schritt and auftrag info."""
    schritt_typ: str | None = None
    schritt_bezeichnung: str | None = None
    auftrag_id: str | None = None
    auftrag_kunde: str | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=List[AuswärtsInfoDetailResponse])
def list_auswarts(db: Session = Depends(get_db)):
    """List all AuswärtsInfo with schritt and auftrag info."""
    infos = db.query(AuswärtsInfo).all()
    result = []
    for info in infos:
        resp = AuswärtsInfoDetailResponse.model_validate(info)
        if info.schritt:
            resp.schritt_typ = info.schritt.typ
            resp.schritt_bezeichnung = info.schritt.bezeichnung
            if info.schritt.auftrag:
                resp.auftrag_id = info.schritt.auftrag.id
                resp.auftrag_kunde = info.schritt.auftrag.kunde
        result.append(resp)
    return result


@router.post("", response_model=AuswärtsInfoResponse, status_code=201)
def create_auswarts(payload: AuswärtsInfoCreate, db: Session = Depends(get_db)):
    # Verify schritt exists
    schritt = db.query(Arbeitsschritt).filter(Arbeitsschritt.id == payload.schritt_id).first()
    if not schritt:
        raise HTTPException(
            status_code=404,
            detail=f"Arbeitsschritt '{payload.schritt_id}' nicht gefunden.",
        )

    # Check schritt type
    if schritt.typ != "Auswärts":
        raise HTTPException(
            status_code=400,
            detail=f"Arbeitsschritt '{payload.schritt_id}' ist kein Auswärts-Schritt (Typ: '{schritt.typ}').",
        )

    # Check if AuswärtsInfo already exists
    existing = db.query(AuswärtsInfo).filter(AuswärtsInfo.schritt_id == payload.schritt_id).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"AuswärtsInfo für Schritt '{payload.schritt_id}' existiert bereits.",
        )

    if payload.auswarts_status not in VALID_STATUS:
        raise HTTPException(
            status_code=400,
            detail=f"Ungültiger Status '{payload.auswarts_status}'. Erlaubt: {sorted(VALID_STATUS)}",
        )

    info = AuswärtsInfo(
        schritt_id=payload.schritt_id,
        dienstleister=payload.dienstleister or "",
        abgeschickt_am=payload.abgeschickt_am.isoformat() if payload.abgeschickt_am else None,
        erw_rueckkehr=payload.erw_rueckkehr.isoformat() if payload.erw_rueckkehr else None,
        tatsaechlich_zurueck=payload.tatsaechlich_zurueck.isoformat() if payload.tatsaechlich_zurueck else None,
        auswarts_status=payload.auswarts_status,
    )
    db.add(info)
    db.commit()
    db.refresh(info)
    return info


@router.put("/{schritt_id}", response_model=AuswärtsInfoResponse)
def update_auswarts(
    schritt_id: str, payload: AuswärtsInfoUpdate, db: Session = Depends(get_db)
):
    info = db.query(AuswärtsInfo).filter(AuswärtsInfo.schritt_id == schritt_id).first()
    if not info:
        raise HTTPException(
            status_code=404,
            detail=f"AuswärtsInfo für Schritt '{schritt_id}' nicht gefunden.",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "auswarts_status" in update_data and update_data["auswarts_status"] not in VALID_STATUS:
        raise HTTPException(
            status_code=400,
            detail=f"Ungültiger Status '{update_data['auswarts_status']}'. Erlaubt: {sorted(VALID_STATUS)}",
        )

    date_fields = {"abgeschickt_am", "erw_rueckkehr", "tatsaechlich_zurueck"}
    for field, value in update_data.items():
        if field in date_fields and isinstance(value, date):
            setattr(info, field, value.isoformat())
        else:
            setattr(info, field, value)

    db.commit()
    db.refresh(info)
    return info


@router.delete("/{schritt_id}", status_code=204)
def delete_auswarts(schritt_id: str, db: Session = Depends(get_db)):
    info = db.query(AuswärtsInfo).filter(AuswärtsInfo.schritt_id == schritt_id).first()
    if not info:
        raise HTTPException(
            status_code=404,
            detail=f"AuswärtsInfo für Schritt '{schritt_id}' nicht gefunden.",
        )
    db.delete(info)
    db.commit()
