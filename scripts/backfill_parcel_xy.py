"""Add cx/cy centroids so map queries cover the viewport evenly."""
from pymongo import MongoClient, UpdateOne

MONGO_URL = "mongodb://127.0.0.1:27017"
DB_NAME = "quyhoach"


def representative_xy(geom):
    if not geom:
        return None
    try:
        coords = geom.get("coordinates")
        kind = geom.get("type")
        if kind == "Polygon":
            ring = coords[0]
        elif kind == "MultiPolygon":
            ring = coords[0][0]
        else:
            return None
        n = len(ring)
        if n < 1:
            return None
        sx = sum(float(p[0]) for p in ring)
        sy = sum(float(p[1]) for p in ring)
        return sx / n, sy / n
    except Exception:
        return None


def main() -> int:
    db = MongoClient(MONGO_URL, serverSelectionTimeoutMS=8000)[DB_NAME]
    ops = []
    updated = 0
    for doc in db.parcels.find({}, {"geometry": 1}):
        pt = representative_xy(doc.get("geometry"))
        if not pt:
            continue
        ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": {"cx": pt[0], "cy": pt[1]}}))
        if len(ops) >= 1000:
            db.parcels.bulk_write(ops, ordered=False)
            updated += len(ops)
            ops = []
            if updated % 20000 == 0:
                print(f"  {updated}…")
    if ops:
        db.parcels.bulk_write(ops, ordered=False)
        updated += len(ops)
    db.parcels.create_index([("cx", 1), ("cy", 1)], name="parcels_cx_cy")
    missing = db.parcels.count_documents({"cx": {"$exists": False}})
    print({"updated": updated, "missing_cx": missing})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
