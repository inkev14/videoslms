from __future__ import annotations

import re
from datetime import date, timedelta


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_kw(kw: str) -> tuple[int, int]:
    """Parse a KW string to (year, week).

    Accepted formats:
      - "KW23"        → uses current year
      - "2024-KW23"   → explicit year
      - "KW2024-23"   → alternative explicit form (not primary but tolerated)
    """
    kw = kw.strip()

    # "2024-KW23"
    m = re.fullmatch(r"(\d{4})-KW(\d{1,2})", kw, re.IGNORECASE)
    if m:
        return int(m.group(1)), int(m.group(2))

    # "KW23" – no year: use current year
    m = re.fullmatch(r"KW(\d{1,2})", kw, re.IGNORECASE)
    if m:
        return date.today().isocalendar()[0], int(m.group(1))

    raise ValueError(f"Ungültiges KW-Format: '{kw}'. Erwartet 'KW23' oder '2024-KW23'.")


def _format_kw(year: int, week: int) -> str:
    """Return canonical KW string including year for unambiguous representation."""
    return f"{year}-KW{week:02d}"


def _weeks_in_year(year: int) -> int:
    """Return the number of ISO weeks in a given year (52 or 53)."""
    # The last day of the year; if it is in week 53, the year has 53 weeks.
    dec28 = date(year, 12, 28)
    return dec28.isocalendar()[1]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def kw_to_date_range(kw: str) -> dict:
    """Convert a KW string to the Monday–Sunday date range of that ISO week.

    Returns:
        {"start": date, "end": date}
    """
    year, week = _parse_kw(kw)
    # ISO week: Monday of that week
    jan4 = date(year, 1, 4)  # Jan 4 is always in week 1
    week1_monday = jan4 - timedelta(days=jan4.weekday())
    monday = week1_monday + timedelta(weeks=week - 1)
    sunday = monday + timedelta(days=6)
    return {"start": monday, "end": sunday}


def date_to_kw(d: date) -> str:
    """Convert a date to its canonical KW string (year-aware)."""
    iso = d.isocalendar()
    return _format_kw(iso[0], iso[1])


def kw_diff(kw1: str, kw2: str) -> int:
    """Return the signed difference in weeks: kw2 - kw1."""
    year1, week1 = _parse_kw(kw1)
    year2, week2 = _parse_kw(kw2)
    # Use the Monday of each week as anchor
    r1 = kw_to_date_range(_format_kw(year1, week1))
    r2 = kw_to_date_range(_format_kw(year2, week2))
    delta = r2["start"] - r1["start"]
    return delta.days // 7


def kw_add(kw: str, delta: int) -> str:
    """Add *delta* weeks to *kw*, handling year boundaries correctly."""
    year, week = _parse_kw(kw)
    r = kw_to_date_range(_format_kw(year, week))
    new_monday = r["start"] + timedelta(weeks=delta)
    return date_to_kw(new_monday)


def kw_to_sort_key(kw: str | None) -> int:
    """Return an integer sort key for a KW string.

    Null / None values return a very large number so they sort last.
    """
    if kw is None:
        return 999999
    try:
        year, week = _parse_kw(kw)
        return year * 100 + week
    except ValueError:
        return 999999
