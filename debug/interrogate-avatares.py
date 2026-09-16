import base64
import json
import urllib.request

with open("avatares.jpg", "rb") as f:
    b64 = base64.b64encode(f.read()).decode("ascii")

payload = json.dumps({"image": b64, "model": "clip"}).encode("utf-8")

req = urllib.request.Request(
    "http://localhost:7860/sdapi/v1/interrogate",
    data=payload,
    headers={"Content-Type": "application/json"},
)
try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        print("CLIP description:", data.get("caption", "(sin caption)"))
except Exception as e:
    print("Error:", e)
