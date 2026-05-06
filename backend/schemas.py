from __future__ import annotations

from datetime import date
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Monteur
# ---------------------------------------------------------------------------

class MonteurCreate(BaseModel):
    id: str
    name: str
    aktiv: bool = True


class MonteurUpdate(BaseModel):
    name: Optional[str] = None
    aktiv: Optional[bool] = None


class MonteurResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    aktiv: bool


# ---------------------------------------------------------------------------
# AuswärtsInfo
# ---------------------------------------------------------------------------

class AuswärtsInfoCreate(BaseModel):
    schritt_id: str
    dienstleister: Optional[str] = ""
    abgeschickt_am: Optional[date] = None
    erw_rueckkehr: Optional[date] = None
    tatsaechlich_zurueck: Optional[date] = None
    auswarts_status: str = "Ausstehend"


class AuswärtsInfoUpdate(BaseModel):
    dienstleister: Optional[str] = None
    abgeschickt_am: Optional[date] = None
    erw_rueckkehr: Optional[date] = None
    tatsaechlich_zurueck: Optional[date] = None
    auswarts_status: Optional[str] = None


class AuswärtsInfoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    schritt_id: str
    dienstleister: Optional[str] = None
    abgeschickt_am: Optional[date] = None
    erw_rueckkehr: Optional[date] = None
    tatsaechlich_zurueck: Optional[date] = None
    auswarts_status: str


# ---------------------------------------------------------------------------
# VorlageSchritt
# ---------------------------------------------------------------------------

class VorlageSchrittCreate(BaseModel):
    position: int = 0
    typ: str
    bezeichnung: str


class VorlageSchrittUpdate(BaseModel):
    position: Optional[int] = None
    typ: Optional[str] = None
    bezeichnung: Optional[str] = None


class VorlageSchrittResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    vorlage_id: str
    position: int
    typ: str
    bezeichnung: str


# ---------------------------------------------------------------------------
# Vorlage
# ---------------------------------------------------------------------------

class VorlageCreate(BaseModel):
    id: Optional[str] = None
    name: str
    beschreibung: Optional[str] = ""
    schritte: Optional[List[VorlageSchrittCreate]] = []


class VorlageUpdate(BaseModel):
    name: Optional[str] = None
    beschreibung: Optional[str] = None


class VorlageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    beschreibung: Optional[str] = None
    erstellt_am: Optional[date] = None
    schritte: List[VorlageSchrittResponse] = []


# ---------------------------------------------------------------------------
# Arbeitsschritt
# ---------------------------------------------------------------------------

class ArbeitsschrittCreate(BaseModel):
    auftrag_id: str
    position: int = 0
    typ: str
    bezeichnung: str
    monteur_id: Optional[str] = None
    teile_status: str = "N/A"
    teile_erwartet: Optional[date] = None
    geplant_kw: Optional[str] = None
    geplant_start: Optional[date] = None
    geplant_ende: Optional[date] = None
    eff_start: Optional[date] = None
    eff_ende: Optional[date] = None
    abgeschlossen: bool = False
    bemerkungen: Optional[str] = ""


class ArbeitsschrittUpdate(BaseModel):
    position: Optional[int] = None
    typ: Optional[str] = None
    bezeichnung: Optional[str] = None
    monteur_id: Optional[str] = None
    teile_status: Optional[str] = None
    teile_erwartet: Optional[date] = None
    geplant_kw: Optional[str] = None
    geplant_start: Optional[date] = None
    geplant_ende: Optional[date] = None
    eff_start: Optional[date] = None
    eff_ende: Optional[date] = None
    abgeschlossen: Optional[bool] = None
    bemerkungen: Optional[str] = None


class ArbeitsschrittResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    auftrag_id: str
    position: int
    typ: str
    bezeichnung: str
    monteur_id: Optional[str] = None
    teile_status: str
    teile_erwartet: Optional[date] = None
    geplant_kw: Optional[str] = None
    geplant_start: Optional[date] = None
    geplant_ende: Optional[date] = None
    eff_start: Optional[date] = None
    eff_ende: Optional[date] = None
    abgeschlossen: bool
    bemerkungen: Optional[str] = None
    auswarts_info: Optional[AuswärtsInfoResponse] = None
    ampel: Optional[str] = None  # computed field
    # Optional auftrag meta (populated in list view)
    kunde: Optional[str] = None
    liefertermin: Optional[date] = None


# ---------------------------------------------------------------------------
# Auftrag
# ---------------------------------------------------------------------------

class AuftragCreate(BaseModel):
    id: Optional[str] = None
    kunde: str
    typ: str
    getriebe_bezeichnung: str
    liefertermin: Optional[date] = None
    anlieferung: Optional[date] = None
    bemerkungen: Optional[str] = ""


class AuftragCreateWithVorlage(AuftragCreate):
    vorlage_id: Optional[str] = None


class AuftragUpdate(BaseModel):
    kunde: Optional[str] = None
    typ: Optional[str] = None
    getriebe_bezeichnung: Optional[str] = None
    liefertermin: Optional[date] = None
    anlieferung: Optional[date] = None
    bemerkungen: Optional[str] = None


class AuftragResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    kunde: str
    typ: str
    getriebe_bezeichnung: str
    liefertermin: Optional[date] = None
    anlieferung: Optional[date] = None
    status: Optional[str] = None  # computed
    bemerkungen: Optional[str] = None
    erstellt_am: Optional[date] = None
    schritte: List[ArbeitsschrittResponse] = []


# ---------------------------------------------------------------------------
# Reorder
# ---------------------------------------------------------------------------

class ReorderItem(BaseModel):
    id: str
    position: int


class ReorderRequest(BaseModel):
    items: List[ReorderItem]


# ---------------------------------------------------------------------------
# Verschieben (cascade shift)
# ---------------------------------------------------------------------------

class VerschiebenRequest(BaseModel):
    neue_kw: str
