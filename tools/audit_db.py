import sqlite3
import json

print("=== CHECK 1: SQLITE DATABASE AUDIT ===")

for db_name, db_path in [
    ("Knowledge DB", "data/medicines/medicine_knowledge.db"),
    ("App DB (root dev.db)", "dev.db"),
    ("App DB (root medishelf.db)", "medishelf.db"),
    ("App DB (backend/dev.db)", "backend/dev.db"),
    ("App DB (backend/medishelf.db)", "backend/medishelf.db"),
]:
    print(f"\n--- {db_name}: {db_path} ---")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    print(f"Tables found: {tables}")
    for t in tables:
        try:
            cnt = cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            print(f"  {t}: {cnt} rows")
        except Exception as e:
            print(f"  {t}: Error: {e}")

    if "medicines_master" in tables:
        m_cnt = cur.execute("SELECT COUNT(*) FROM medicines_master").fetchone()[0]
        unique_ids = cur.execute("SELECT COUNT(DISTINCT medicine_id) FROM medicines_master").fetchone()[0]
        curated = cur.execute("SELECT COUNT(*) FROM medicines_master WHERE concept_type = 'CURATED_MONOGRAPH'").fetchone()[0]
        scd = cur.execute("SELECT COUNT(*) FROM medicines_master WHERE concept_type = 'CLINICAL_CONCEPT'").fetchone()[0]
        sbd = cur.execute("SELECT COUNT(*) FROM medicines_master WHERE concept_type = 'BRANDED_DRUG'").fetchone()[0]
        dups = cur.execute("SELECT medicine_id, COUNT(*) c FROM medicines_master GROUP BY medicine_id HAVING c > 1").fetchall()
        print(f"  Total records: {m_cnt}")
        print(f"  Unique medicine_ids: {unique_ids}")
        print(f"  Concept breakdown: CURATED={curated}, SCD={scd}, SBD={sbd}")
        print(f"  Duplicate medicine_ids count: {len(dups)}")

        # Categories
        cat_rows = cur.execute("SELECT category, COUNT(*) FROM medicines_master GROUP BY category ORDER BY COUNT(*) DESC").fetchall()
        print(f"  Total distinct categories: {len(cat_rows)}")
        print("  Top 5 categories:")
        for cat, c in cat_rows[:5]:
            print(f"    - {cat}: {c}")

    if "ingredient_index" in tables:
        ing_cnt = cur.execute("SELECT COUNT(*) FROM ingredient_index").fetchone()[0]
        uniq_ing = cur.execute("SELECT COUNT(DISTINCT ingredient) FROM ingredient_index").fetchone()[0]
        print(f"  ingredient_index total rows: {ing_cnt}")
        print(f"  Distinct ingredients indexed: {uniq_ing}")

    if "medicines_fts" in tables and "medicines_master" in tables:
        fts_cnt = cur.execute("SELECT COUNT(*) FROM medicines_fts").fetchone()[0]
        m_cnt = cur.execute("SELECT COUNT(*) FROM medicines_master").fetchone()[0]
        print(f"  FTS5 sync check: master={m_cnt}, fts={fts_cnt}, exactly_synced={m_cnt == fts_cnt}")

    if "medicines" in tables:
        med_cnt = cur.execute("SELECT COUNT(*) FROM medicines").fetchone()[0]
        uniq_med_ids = cur.execute("SELECT COUNT(DISTINCT medicine_id) FROM medicines").fetchone()[0]
        print(f"  medicines table rows: {med_cnt}, unique IDs: {uniq_med_ids}")

    conn.close()
