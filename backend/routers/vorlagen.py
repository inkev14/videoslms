from __future__ import annotations

from datetime import date
from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Vorlage, VorlageSchritt
from schemas import (
    ReorderRequest,
    VorlageCreate,
    VorlageResponse,
    VorlageSchrittCreate,
    VorlageSchrittResponse,
    VorlageSchrittUpdate,
    VorlageUpdate,
)

router = APIRouter(prefix="/vorlagen", tags=["vorlagen"])

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


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=List[VorlageResponse])
def list_vorlagen(db: Session = Depends(get_db)):
    return db.query(Vorlage).all()


@router.post("", response_model=VorlageResponse, status_code=201)
def create_vorlage(payload: VorlageCreate, db: Session = Depends(get_db)):
    # Validate unique name
    existing = db.query(Vorlage).filter(Vorlage.name == payload.name).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Eine Vorlage mit dem Namen '{payload.name}' existiert bereits.",
        )

    vorlage_id = payload.id or str(uuid4())

    if db.query(Vorlage).filter(Vorlage.id == vorlage_id).first():
        raise HTTPException(
            status_code=400,
            detail=f"Vorlage mit ID '{vorlage_id}' existiert bereits.",
        )

    vorlage = Vorlage(
        id=vorlage_id,
        name=payload.name,
        beschreibung=payload.beschreibung or "",
        erstellt_am=date.today().isoformat(),
    )
    db.add(vorlage)
    db.flush()

    for schritt_data in (payload.schritte or []):
        if schritt_data.typ not in VALID_TYPEN:
            raise HTTPException(
                status_code=400,
                detail=f"Ungültiger Schritt-Typ '{schritt_data.typ}'. Erlaubt: {sorted(VALID_TYPEN)}",
            )
        schritt = VorlageSchritt(
            id=str(uuid4()),
            vorlage_id=vorlage_id,
            position=schritt_data.position,
            typ=schritt_data.typ,
            bezeichnung=schritt_data.bezeichnung,
        )
        db.add(schritt)

    db.commit()
    db.refresh(vorlage)
    return vorlage


@router.get("/{vorlage_id}", response_model=VorlageResponse)
def get_vorlage(vorlage_id: str, db: Session = Depends(get_db)):
    vorlage = db.query(Vorlage).filter(Vorlage.id == vorlage_id).first()
    if not vorlage:
        raise HTTPException(status_code=404, detail=f"Vorlage '{vorlage_id}' nicht gefunden.")
    return vorlage


@router.put("/{vorlage_id}", response_model=VorlageResponse)
def update_vorlage(vorlage_id: str, payload: VorlageUpdate, db: Session = Depends(get_db)):
    vorlage = db.query(Vorlage).filter(Vorlage.id == vorlage_id).first()
    if not vorlage:
        raise HTTPException(status_code=404, detail=f"Vorlage '{vorlage_id}' nicht gefunden.")

    update_data = payload.model_dump(exclude_unset=True)

    if "name" in update_data:
        existing = (
            db.query(Vorlage)
            .filter(Vorlage.name == update_data["name"], Vorlage.id != vorlage_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Eine Vorlage mit dem Namen '{update_data['name']}' existiert bereits.",
            )

    for field, value in update_data.items():
        setattr(vorlage, field, value)

    db.commit()
    db.refresh(vorlage)
    return vorlage


@router.delete("/{vorlage_id}", status_code=204)
def delete_vorlage(vorlage_id: str, db: Session = Depends(get_db)):
    vorlage = db.query(Vorlage).filter(Vorlage.id == vorlage_id).first()
    if not vorlage:
        raise HTTPException(status_code=404, detail=f"Vorlage '{vorlage_id}' nicht gefunden.")
    db.delete(vorlage)
    db.commit()


# ---------------------------------------------------------------------------
# Schritt sub-resource
# ---------------------------------------------------------------------------

@router.post("/{vorlage_id}/schritte", response_model=VorlageSchrittResponse, status_code=201)
def add_vorlage_schritt(
    vorlage_id: str, payload: VorlageSchrittCreate, db: Session = Depends(get_db)
):
    vorlage = db.query(Vorlage).filter(Vorlage.id == vorlage_id).first()
    if not vorlage:
        raise HTTPException(status_code=404, detail=f"Vorlage '{vorlage_id}' nicht gefunden.")

    if payload.typ not in VALID_TYPEN:
        raise HTTPException(
            status_code=400,
            detail=f"Ungültiger Typ '{payload.typ}'. Erlaubt: {sorted(VALID_TYPEN)}",
        )

    schritt = VorlageSchritt(
        id=str(uuid4()),
        vorlage_id=vorlage_id,
        position=payload.position,
        typ=payload.typ,
        bezeichnung=payload.bezeichnung,
    )
    db.add(schritt)
    db.commit()
    db.refresh(schritt)
    return schritt


@router.put("/{vorlage_id}/schritte/{schritt_id}", response_model=VorlageSchrittResponse)
def update_vorlage_schritt(
    vorlage_id: str,
    schritt_id: str,
    payload: VorlageSchrittUpdate,
    db: Session = Depends(get_db),
):
    vorlage = db.query(Vorlage).filter(Vorlage.id == vorlage_id).first()
    if not vorlage:
        raise HTTPException(status_code=404, detail=f"Vorlage '{vorlage_id}' nicht gefunden.")

    schritt = (
        db.query(VorlageSchritt)
        .filter(VorlageSchritt.id == schritt_id, VorlageSchritt.vorlage_id == vorlage_id)
        .first()
    )
    if not schritt:
        raise HTTPException(
            status_code=404,
            detail=f"VorlageSchritt '{schritt_id}' in Vorlage '{vorlage_id}' nicht gefunden.",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "typ" in update_data and update_data["typ"] not in VALID_TYPEN:
        raise HTTPException(
            status_code=400,
            detail=f"Ungültiger Typ '{update_data['typ']}'. Erlaubt: {sorted(VALID_TYPEN)}",
        )

    for field, value in update_data.items():
        setattr(schritt, field, value)

    db.commit()
    db.refresh(schritt)
    return schritt


@router.delete("/{vorlage_id}/schritte/{schritt_id}", status_code=204)
def delete_vorlage_schritt(
    vorlage_id: str, schritt_id: str, db: Session = Depends(get_db)
):
    vorlage = db.query(Vorlage).filter(Vorlage.id == vorlage_id).first()
    if not vorlage:
        raise HTTPException(status_code=404, detail=f"Vorlage '{vorlage_id}' nicht gefunden.")

    schritt = (
        db.query(VorlageSchritt)
        .filter(VorlageSchritt.id == schritt_id, VorlageSchritt.vorlage_id == vorlage_id)
        .first()
    )
    if not schritt:
        raise HTTPException(
            status_code=404,
            detail=f"VorlageSchritt '{schritt_id}' in Vorlage '{vorlage_id}' nicht gefunden.",
        )

    db.delete(schritt)
    db.commit()


@router.put("/{vorlage_id}/reorder", response_model=VorlageResponse)
def reorder_vorlage_schritte(
    vorlage_id: str, payload: ReorderRequest, db: Session = Depends(get_db)
):
    vorlage = db.query(Vorlage).filter(Vorlage.id == vorlage_id).first()
    if not vorlage:
        raise HTTPException(status_code=404, detail=f"Vorlage '{vorlage_id}' nicht gefunden.")

    schritt_map = {s.id: s for s in vorlage.schritte}
    for item in payload.items:
        if item.id not in schritt_map:
            raise HTTPException(
                status_code=400,
                detail=f"VorlageSchritt '{item.id}' gehört nicht zu Vorlage '{vorlage_id}'.",
            )
        schritt_map[item.id].position = item.position

    db.commit()
    db.refresh(vorlage)
    return vorlage


@router.post("/{vorlage_id}/duplizieren", response_model=VorlageResponse, status_code=201)
def duplizieren(vorlage_id: str, db: Session = Depends(get_db)):
    """Copy a Vorlage with name 'Kopie von {name}'. Requires at least 1 Schritt."""
    vorlage = db.query(Vorlage).filter(Vorlage.id == vorlage_id).first()
    if not vorlage:
        raise HTTPException(status_code=404, detail=f"Vorlage '{vorlage_id}' nicht gefunden.")

    if not vorlage.schritte:
        raise HTTPException(
            status_code=400,
            detail="Die Vorlage hat keine Schritte. Bitte mindestens einen Schritt hinzufügen, bevor sie dupliziert werden kann.",
        )

    new_name = f"Kopie von {vorlage.name}"
    # Ensure uniqueness by appending a counter if needed
    base_name = new_name
    counter = 1
    while db.query(Vorlage).filter(Vorlage.name == new_name).first():
        counter += 1
        new_name = f"{base_name} ({counter})"

    new_vorlage = Vorlage(
        id=str(uuid4()),
        name=new_name,
        beschreibung=vorlage.beschreibung,
        erstellt_am=date.today().isoformat(),
    )
    db.add(new_vorlage)
    db.flush()

    for vs in sorted(vorlage.schritte, key=lambda x: x.position):
        new_schritt = VorlageSchritt(
            id=str(uuid4()),
            vorlage_id=new_vorlage.id,
            position=vs.position,
            typ=vs.typ,
            bezeichnung=vs.bezeichnung,
        )
        db.add(new_schritt)

    db.commit()
    db.refresh(new_vorlage)
    return new_vorlage
