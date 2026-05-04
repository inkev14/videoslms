from __future__ import annotations

from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Arbeitsschritt, Monteur
from schemas import MonteurCreate, MonteurResponse, MonteurUpdate

router = APIRouter(prefix="/monteure", tags=["monteure"])


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=List[MonteurResponse])
def list_monteure(
    aktiv: Optional[bool] = Query(None, description="Filter by aktiv status"),
    db: Session = Depends(get_db),
):
    q = db.query(Monteur)
    if aktiv is not None:
        q = q.filter(Monteur.aktiv == aktiv)
    return q.all()


@router.post("", response_model=MonteurResponse, status_code=201)
def create_monteur(payload: MonteurCreate, db: Session = Depends(get_db)):
    existing = db.query(Monteur).filter(Monteur.id == payload.id).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Monteur mit ID '{payload.id}' existiert bereits.",
        )

    monteur = Monteur(
        id=payload.id,
        name=payload.name,
        aktiv=payload.aktiv,
    )
    db.add(monteur)
    db.commit()
    db.refresh(monteur)
    return monteur


@router.get("/{monteur_id}", response_model=MonteurResponse)
def get_monteur(monteur_id: str, db: Session = Depends(get_db)):
    monteur = db.query(Monteur).filter(Monteur.id == monteur_id).first()
    if not monteur:
        raise HTTPException(status_code=404, detail=f"Monteur '{monteur_id}' nicht gefunden.")
    return monteur


@router.put("/{monteur_id}", response_model=MonteurResponse)
def update_monteur(monteur_id: str, payload: MonteurUpdate, db: Session = Depends(get_db)):
    monteur = db.query(Monteur).filter(Monteur.id == monteur_id).first()
    if not monteur:
        raise HTTPException(status_code=404, detail=f"Monteur '{monteur_id}' nicht gefunden.")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(monteur, field, value)

    db.commit()
    db.refresh(monteur)
    return monteur


@router.delete("/{monteur_id}", status_code=204)
def delete_monteur(monteur_id: str, db: Session = Depends(get_db)):
    monteur = db.query(Monteur).filter(Monteur.id == monteur_id).first()
    if not monteur:
        raise HTTPException(status_code=404, detail=f"Monteur '{monteur_id}' nicht gefunden.")
    db.delete(monteur)
    db.commit()


@router.get("/{monteur_id}/auslastung", response_model=Dict[str, int])
def get_auslastung(monteur_id: str, db: Session = Depends(get_db)):
    """Return workload per KW: dict of kw → count of non-abgeschlossen schritte."""
    monteur = db.query(Monteur).filter(Monteur.id == monteur_id).first()
    if not monteur:
        raise HTTPException(status_code=404, detail=f"Monteur '{monteur_id}' nicht gefunden.")

    schritte = (
        db.query(Arbeitsschritt)
        .filter(
            Arbeitsschritt.monteur_id == monteur_id,
            Arbeitsschritt.abgeschlossen == False,
            Arbeitsschritt.geplant_kw.isnot(None),
        )
        .all()
    )

    auslastung: Dict[str, int] = {}
    for s in schritte:
        kw = s.geplant_kw
        auslastung[kw] = auslastung.get(kw, 0) + 1

    return auslastung
