"""
Builds the offline venue index in data/places/ from Overture Maps Places
(CDLA-Permissive-2.0, https://overturemaps.org), so venue search finds small
local cafés and halls that OpenStreetMap lacks, with no API key.

1. Extract India's venue-type places (needs `pip install duckdb`, ~10 min):
     python scripts/build_places.py extract venues.parquet
2. Write the tiles:
     python scripts/build_places.py tiles venues.parquet data/places

Each tile covers 0.5° × 0.5° (about 55 km) and is a gzipped JSON array of
[name, kind, lat, lon, address, weight] rows. `weight` (0–1) says how
established a listing is: confidence, number of sources, website or socials.
"""

import gzip
import json
import math
import os
import re
import sys

RELEASE = "2026-10-21.0"
TILE = 0.5

EXTRACT_SQL = f"""
COPY (
SELECT names.primary AS name, basic_category AS cat, taxonomy.primary AS tax,
       addresses[1].freeform AS street, addresses[1].locality AS locality,
       round(bbox.xmin, 5) AS lon, round(bbox.ymin, 5) AS lat, confidence,
       len(coalesce(socials, [])) + len(coalesce(websites, [])) AS links, len(sources) AS nsources
FROM read_parquet('s3://overturemaps-us-west-2/release/{RELEASE}/theme=places/type=place/*', hive_partitioning=1)
WHERE bbox.xmin BETWEEN 68 AND 97.6 AND bbox.ymin BETWEEN 6.5 AND 35.8
  AND addresses[1].country = 'IN'
  AND coalesce(operating_status, 'open') = 'open'
  AND (taxonomy.hierarchy[1] IN ('food_and_drink', 'lodging')
       OR basic_category IN ('event_venue', 'festival_venue', 'fairgrounds', 'community_center', 'park',
                             'garden', 'convention_center', 'nightlife_venue', 'dance_club')
       OR regexp_matches(coalesce(taxonomy.primary, ''), 'banquet|wedding|party|convention|community_center|marriage'))
) TO '{{out}}' (FORMAT parquet)
"""


def extract(out):
    import duckdb

    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")
    con.execute(EXTRACT_SQL.format(out=out))


SKIP = {"political_organization", "behavioral_or_mental_health_clinic", "specialty_store", "distillery",
        "winery", "rv_park"}
# Many Indian banquet halls are listed as event planning; keep the ones whose name says venue.
VENUE_NAME = re.compile(
    r"banquet|hall|lawn|bhawan|bhavan|marriage|wedding|palace|mandap|kalyan|vivah|garden|resort|club|venue|party",
    re.I,
)


def kind_of(name, cat, tax):
    """A short, readable kind (e.g. 'indian restaurant', 'banquet hall'), or None to leave the place out."""
    if cat in SKIP:
        return None
    if cat == "event_or_party_service":
        return "banquet hall" if VENUE_NAME.search(name) else None
    return (tax or cat or "place").replace("_", " ")


def weight_of(confidence, links, nsources):
    conf = confidence or 0
    return round(min(1.0, 0.6 * conf + 0.15 * min(links or 0, 2) + 0.1 * min((nsources or 1) - 1, 1)), 2)


def tiles(src, out_dir):
    import duckdb

    rows = duckdb.connect().execute(
        f"""SELECT name, cat, tax, street, locality, lat, lon, confidence, links, nsources
            FROM '{src}' WHERE name IS NOT NULL AND length(name) BETWEEN 2 AND 80 AND confidence >= 0.4"""
    ).fetchall()
    buckets = {}
    kept = 0
    for name, cat, tax, street, locality, lat, lon, conf, links, nsources in rows:
        kind = kind_of(name, cat, tax)
        if not kind:
            continue
        kept += 1
        address = ", ".join(p for p in (street, locality) if p)[:120]
        key = f"{math.floor(lat / TILE)}_{math.floor(lon / TILE)}"
        buckets.setdefault(key, []).append(
            [name.strip(), kind, lat, lon, address, weight_of(conf, links, nsources)]
        )
    os.makedirs(out_dir, exist_ok=True)
    for key, items in buckets.items():
        with gzip.open(os.path.join(out_dir, f"{key}.json.gz"), "wt", encoding="utf-8", compresslevel=9) as f:
            json.dump(items, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{kept} places in {len(buckets)} tiles")


if __name__ == "__main__":
    {"extract": extract, "tiles": tiles}[sys.argv[1]](*sys.argv[2:])
