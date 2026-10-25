import urllib.request
import json
import urllib.parse
from PIL import Image

classes = {
    'paracetamol_500mg_tablet': {'drug': 'acetaminophen', 'inc': ['acetaminophen', 'paracetamol'], 'form': ['tablet', 'caplet'], 'exc': ['liquid', 'suspension', 'drops', 'children']},
    'amoxicillin_500mg_capsule': {'drug': 'amoxicillin', 'inc': ['amoxicillin'], 'form': ['capsule'], 'exc': ['suspension', 'liquid']},
    'ibuprofen_400mg_tablet': {'drug': 'ibuprofen', 'inc': ['ibuprofen', 'advil', 'motrin'], 'form': ['tablet', 'caplet'], 'exc': ['suspension', 'liquid', 'gel']},
    'metformin_500mg_tablet': {'drug': 'metformin', 'inc': ['metformin'], 'form': ['tablet'], 'exc': ['solution', 'liquid']},
    'atorvastatin_20mg_tablet': {'drug': 'atorvastatin', 'inc': ['atorvastatin'], 'form': ['tablet'], 'exc': ['liquid']},
    'omeprazole_20mg_capsule': {'drug': 'omeprazole', 'inc': ['omeprazole'], 'form': ['capsule'], 'exc': ['injection', 'suspension']},
    'ciprofloxacin_500mg_tablet': {'drug': 'ciprofloxacin', 'inc': ['ciprofloxacin'], 'form': ['tablet'], 'exc': ['ophthalmic', 'otic', 'injection']},
    'cetirizine_10mg_tablet': {'drug': 'cetirizine', 'inc': ['cetirizine'], 'form': ['tablet'], 'exc': ['syrup', 'drops', 'liquid']},
    'losartan_50mg_tablet': {'drug': 'losartan', 'inc': ['losartan'], 'form': ['tablet'], 'exc': ['liquid', 'solution']},
    'humulin_r_100u_vial': {'drug': 'insulin human', 'inc': ['insulin', 'humulin', 'novolin'], 'form': ['vial', 'injection', 'solution'], 'exc': ['inhalation', 'powder']}
}

headers = {'User-Agent': 'MediShelfAI/1.0'}
for cls, cfg in classes.items():
    url = f"https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name={urllib.parse.quote(cfg['drug'])}&pagesize=100"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            spls = json.loads(r.read()).get('data', [])
        valid_spls = 0
        for s in spls:
            t = s.get('title', '').lower()
            if any(x in t for x in cfg['inc']) and any(x in t for x in cfg['form']) and not any(x in t for x in cfg['exc']):
                valid_spls += 1
        print(f"{cls:<30}: {valid_spls} matching SPL submissions")
    except Exception as e:
        print(f"{cls:<30}: error {e}")
