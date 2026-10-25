import urllib.request
import json
import urllib.parse
from PIL import Image
import io

headers = {'User-Agent': 'MediShelfAI/1.0'}

def test_class(drug, inc, form, exc):
    url = f"https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name={urllib.parse.quote(drug)}&pagesize=100"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as r:
        spls = json.loads(r.read()).get('data', [])
    
    total_imgs = 0
    for s in spls:
        t = s.get('title', '').lower()
        if any(x in t for x in inc) and any(x in t for x in form) and not any(x in t for x in exc):
            setid = s.get('setid')
            m_url = f"https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/{setid}/media.json"
            try:
                m_req = urllib.request.Request(m_url, headers=headers)
                with urllib.request.urlopen(m_req, timeout=8) as mr:
                    media = json.loads(mr.read()).get('data', {}).get('media', [])
                for item in media:
                    mime = item.get('mime_type', '').lower()
                    name = item.get('name', '').lower()
                    if 'image' in mime or name.endswith(('.jpg', '.png', '.jpeg')):
                        total_imgs += 1
            except Exception:
                pass
    return len(spls), total_imgs

print("Checking humulin_r...")
spls, imgs = test_class('insulin human', ['insulin', 'humulin', 'novolin'], ['vial', 'injection', 'solution'], ['inhalation', 'powder'])
print(f"humulin_r: {spls} spls, {imgs} total image items in media")

print("Checking paracetamol...")
spls, imgs = test_class('acetaminophen', ['acetaminophen', 'paracetamol'], ['tablet', 'caplet'], ['liquid', 'suspension', 'drops', 'children'])
print(f"paracetamol: {spls} spls, {imgs} total image items in media")
