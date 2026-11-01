CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS cadastre;
CREATE SCHEMA IF NOT EXISTS survey;

-- VN-2000 / TM-3 105° (Đồng Tháp / Cao Lãnh). Override at import if GDB SRS differs.
CREATE TABLE IF NOT EXISTS cadastre.parcels (
    id              TEXT PRIMARY KEY,
    so_to           TEXT,
    so_thua         TEXT,
    loai_dat        TEXT,
    allow_build     BOOLEAN NOT NULL DEFAULT FALSE,
    dien_tich       DOUBLE PRECISION,
    xa              TEXT,
    source_layer    TEXT,
    geom            geometry(MultiPolygon, 3405) NOT NULL
);

CREATE INDEX IF NOT EXISTS parcels_geom_idx ON cadastre.parcels USING GIST (geom);
CREATE INDEX IF NOT EXISTS parcels_loai_dat_idx ON cadastre.parcels (loai_dat);

CREATE TABLE IF NOT EXISTS cadastre.buildings (
    id              TEXT PRIMARY KEY,
    parcel_id       TEXT,
    source_layer    TEXT,
    geom            geometry(MultiPolygon, 3405) NOT NULL
);

CREATE INDEX IF NOT EXISTS cadastre_buildings_geom_idx ON cadastre.buildings USING GIST (geom);

CREATE TABLE IF NOT EXISTS survey.missions (
    id              TEXT PRIMARY KEY,
    flight_date     DATE NOT NULL,
    area_name       TEXT,
    crs             TEXT NOT NULL DEFAULT 'EPSG:3405',
    gsd_cm          DOUBLE PRECISION,
    cog_path        TEXT,
    bbox            geometry(Polygon, 4326),
    status          TEXT NOT NULL DEFAULT 'queued',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS survey.detected_buildings (
    id              TEXT PRIMARY KEY,
    mission_id      TEXT NOT NULL REFERENCES survey.missions(id) ON DELETE CASCADE,
    confidence      DOUBLE PRECISION,
    geom            geometry(MultiPolygon, 3405) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS detected_buildings_geom_idx ON survey.detected_buildings USING GIST (geom);
CREATE INDEX IF NOT EXISTS detected_buildings_mission_idx ON survey.detected_buildings (mission_id);

CREATE TABLE IF NOT EXISTS survey.violation_geoms (
    id              TEXT PRIMARY KEY,
    mission_id      TEXT NOT NULL REFERENCES survey.missions(id) ON DELETE CASCADE,
    building_id     TEXT,
    parcel_id       TEXT,
    so_to           TEXT,
    so_thua         TEXT,
    loai_dat        TEXT,
    rule_id         TEXT NOT NULL,
    area_m2         DOUBLE PRECISION NOT NULL,
    confidence      DOUBLE PRECISION,
    geom            geometry(MultiPolygon, 3405) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS violation_geoms_geom_idx ON survey.violation_geoms USING GIST (geom);
CREATE INDEX IF NOT EXISTS violation_geoms_mission_idx ON survey.violation_geoms (mission_id);

-- Legal residential land-use codes used by overlay rules.
CREATE OR REPLACE VIEW cadastre.legal_land AS
SELECT * FROM cadastre.parcels
WHERE upper(btrim(loai_dat)) IN ('ODT', 'ONT');
