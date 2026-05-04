from __future__ import annotations

from database import SessionLocal
from models import Monteur


INITIAL_MONTEURE = [
    {"id": "M1", "name": "Max Mustermann", "aktiv": True},
    {"id": "M2", "name": "Hans Schmidt", "aktiv": True},
    {"id": "M3", "name": "Peter Weber", "aktiv": True},
    {"id": "M4", "name": "Klaus Müller", "aktiv": True},
    {"id": "M5", "name": "Thomas Fischer", "aktiv": True},
    {"id": "auswärts", "name": "Auswärts", "aktiv": True},
]


def seed_monteure() -> None:
    """Seed initial Monteure if the table is empty."""
    db = SessionLocal()
    try:
        count = db.query(Monteur).count()
        if count == 0:
            for data in INITIAL_MONTEURE:
                monteur = Monteur(
                    id=data["id"],
                    name=data["name"],
                    aktiv=data["aktiv"],
                )
                db.add(monteur)
            db.commit()
            print(f"[seed] {len(INITIAL_MONTEURE)} Monteure eingefügt.")
        else:
            print(f"[seed] Monteure bereits vorhanden ({count} Einträge), übersprungen.")
    finally:
        db.close()


if __name__ == "__main__":
    from database import engine
    from models import Base

    Base.metadata.create_all(bind=engine)
    seed_monteure()
