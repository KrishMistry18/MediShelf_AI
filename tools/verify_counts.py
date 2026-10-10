import sqlite3

conn = sqlite3.connect("data/medicines/medicine_knowledge.db")
cur = conn.cursor()
m_cnt = cur.execute("SELECT COUNT(*) FROM medicines_master").fetchone()[0]
fts_cnt = cur.execute("SELECT COUNT(*) FROM medicines_fts").fetchone()[0]
ing_cnt = cur.execute("SELECT COUNT(*) FROM ingredient_index").fetchone()[0]
uniq_gen = cur.execute("SELECT COUNT(DISTINCT generic_name) FROM medicines_master").fetchone()[0]
curated = cur.execute("SELECT COUNT(*) FROM medicines_master WHERE concept_type = 'CURATED_MONOGRAPH'").fetchone()[0]
scd = cur.execute("SELECT COUNT(*) FROM medicines_master WHERE concept_type = 'CLINICAL_CONCEPT'").fetchone()[0]
sbd = cur.execute("SELECT COUNT(*) FROM medicines_master WHERE concept_type = 'BRANDED_DRUG'").fetchone()[0]

print(f"Master records: {m_cnt}")
print(f"FTS5 records: {fts_cnt}")
print(f"Ingredient index: {ing_cnt}")
print(f"Unique generic names: {uniq_gen}")
print(f"Breakdown: Curated={curated}, Clinical(SCD)={scd}, Branded(SBD)={sbd}")
conn.close()
