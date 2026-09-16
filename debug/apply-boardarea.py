"""Aplica el boardArea 8x6 determinista (una columna izq + una der, misma celda) a los 8 mundos."""
import json
from pathlib import Path

WORLDS = ["ESPACIO", "AGUA", "TIERRA", "FUEGO", "HIELO", "VIENTO", "INFRAMUNDO", "MAZMORRA"]

# Board 6x6 antiguo (referencia normalizada)
OLD = {"x": 0.3485321978021978, "y": 0.2636722500000005, "width": 0.30736060439560436, "height": 0.539062}
CELL_W = OLD["width"] / 6.0

# 8 columnas: una columna añadida a la izquierda y otra a la derecha, misma celda.
NEW = {
    "x": OLD["x"] - CELL_W,
    "y": OLD["y"],
    "width": CELL_W * 8.0,
    "height": OLD["height"],
}

for world in WORLDS:
    p = Path(f"assets/backgrounds/{world}/board-detection.json")
    det = json.loads(p.read_text(encoding="utf-8"))
    det["width"] = 7680
    det["height"] = 4320
    det["boardArea"] = {k: round(v, 8) for k, v in NEW.items()}
    det["boardSize"] = [8, 6]
    det["cellSize"] = round((NEW["width"] * 7680 / 8 + NEW["height"] * 4320 / 6) / 2, 2)
    det.pop("arScore", None)
    det.pop("rectangularity", None)
    det.pop("gridScore", None)
    det.pop("totalScore", None)
    p.write_text(json.dumps(det, indent=2) + "\n", encoding="utf-8")
    print(f"{world}: {det['boardArea']} cell={det['cellSize']}px")
