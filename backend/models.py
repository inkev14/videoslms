from __future__ import annotations

from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from database import Base


class Monteur(Base):
    __tablename__ = "monteure"

    id = Column(String, primary_key=True, index=True)
    name = Column(Text, nullable=False)
    aktiv = Column(Boolean, default=True, nullable=False)

    # relationships
    arbeitsschritte = relationship("Arbeitsschritt", back_populates="monteur")


class Auftrag(Base):
    __tablename__ = "auftraege"

    id = Column(String, primary_key=True, index=True)
    kunde = Column(Text, nullable=False)
    typ = Column(String, nullable=False)
    getriebe_bezeichnung = Column(Text, nullable=False)
    liefertermin = Column(String, nullable=True)   # stored as ISO date string
    anlieferung = Column(String, nullable=True)
    bemerkungen = Column(Text, nullable=True, default="")
    erstellt_am = Column(String, nullable=True)

    # relationships
    schritte = relationship(
        "Arbeitsschritt",
        back_populates="auftrag",
        cascade="all, delete-orphan",
        order_by="Arbeitsschritt.position",
    )


class Arbeitsschritt(Base):
    __tablename__ = "arbeitsschritte"

    id = Column(String, primary_key=True, index=True)
    auftrag_id = Column(String, ForeignKey("auftraege.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, nullable=False, default=0)
    typ = Column(String, nullable=False)
    bezeichnung = Column(Text, nullable=False)
    monteur_id = Column(String, ForeignKey("monteure.id", ondelete="SET NULL"), nullable=True)
    teile_status = Column(String, nullable=False, default="N/A")
    teile_erwartet = Column(String, nullable=True)
    geplant_kw = Column(String, nullable=True)
    geplant_start = Column(String, nullable=True)
    geplant_ende = Column(String, nullable=True)
    eff_start = Column(String, nullable=True)
    eff_ende = Column(String, nullable=True)
    abgeschlossen = Column(Boolean, default=False, nullable=False)
    bemerkungen = Column(Text, nullable=True, default="")

    # relationships
    auftrag = relationship("Auftrag", back_populates="schritte")
    monteur = relationship("Monteur", back_populates="arbeitsschritte")
    auswarts_info = relationship(
        "AuswärtsInfo",
        back_populates="schritt",
        uselist=False,
        cascade="all, delete-orphan",
    )


class AuswärtsInfo(Base):
    __tablename__ = "auswarts_info"

    schritt_id = Column(String, ForeignKey("arbeitsschritte.id", ondelete="CASCADE"), primary_key=True)
    dienstleister = Column(Text, nullable=True, default="")
    abgeschickt_am = Column(String, nullable=True)
    erw_rueckkehr = Column(String, nullable=True)
    tatsaechlich_zurueck = Column(String, nullable=True)
    auswarts_status = Column(String, nullable=False, default="Ausstehend")

    # relationship
    schritt = relationship("Arbeitsschritt", back_populates="auswarts_info")


class Vorlage(Base):
    __tablename__ = "vorlagen"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    beschreibung = Column(Text, nullable=True, default="")
    erstellt_am = Column(String, nullable=True)

    # relationships
    schritte = relationship(
        "VorlageSchritt",
        back_populates="vorlage",
        cascade="all, delete-orphan",
        order_by="VorlageSchritt.position",
    )


class VorlageSchritt(Base):
    __tablename__ = "vorlage_schritte"

    id = Column(String, primary_key=True, index=True)
    vorlage_id = Column(String, ForeignKey("vorlagen.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, nullable=False, default=0)
    typ = Column(String, nullable=False)
    bezeichnung = Column(Text, nullable=False)

    # relationship
    vorlage = relationship("Vorlage", back_populates="schritte")
