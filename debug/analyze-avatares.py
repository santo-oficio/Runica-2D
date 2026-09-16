import cv2
import numpy as np

img = cv2.imread("avatares.jpg")
h, w = img.shape[:2]
print(f"Imagen: {w}x{h}")

gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Detectar bordes
edges = cv2.Canny(gray, 50, 150)

# Encontrar contornos
contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

# Filtrar contornos grandes (posibles avatares)
boxes = []
for c in contours:
    x, y, cw, ch = cv2.boundingRect(c)
    area = cw * ch
    if area > 2000 and cw > 40 and ch > 40:  # filtro de tamano
        boxes.append((x, y, cw, ch, area))

# Ordenar por area descendente
boxes.sort(key=lambda b: -b[4])

print(f"\nContornos candidatos ({len(boxes)}):")
for i, (x, y, cw, ch, area) in enumerate(boxes[:40]):
    print(f"  [{i}] x={x} y={y} w={cw} h={ch} area={area}")

# Analizar si hay una cuadricula: histograma de bordes
# Lineas verticales y horizontales fuertes
print("\nHistograma de bordes verticales (picos = lineas verticales):")
colsum = edges.sum(axis=0)
# encontrar picos
peaks_v = []
for x in range(1, w-1):
    if colsum[x] > colsum[x-1] and colsum[x] >= colsum[x+1] and colsum[x] > edges.shape[0] * 2:
        peaks_v.append((x, int(colsum[x])))
print(f"  {len(peaks_v)} picos verticales")
for p in peaks_v[:30]:
    print(f"    x={p[0]} sum={p[1]}")

print("\nHistograma de bordes horizontales (picos = lineas horizontales):")
rowsum = edges.sum(axis=1)
peaks_h = []
for y in range(1, h-1):
    if rowsum[y] > rowsum[y-1] and rowsum[y] >= rowsum[y+1] and rowsum[y] > edges.shape[1] * 2:
        peaks_h.append((y, int(rowsum[y])))
print(f"  {len(peaks_h)} picos horizontales")
for p in peaks_h[:30]:
    print(f"    y={p[0]} sum={p[1]}")

# Guardar una version con los bounding boxes dibujados para referencia
vis = img.copy()
for i, (x, y, cw, ch, area) in enumerate(boxes[:40]):
    cv2.rectangle(vis, (x, y), (x+cw, y+ch), (0, 255, 0), 2)
    cv2.putText(vis, str(i), (x, y-5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,0), 1)
cv2.imwrite("debug/avatares-analyzed.png", vis)
print("\nGuardado debug/avatares-analyzed.png")
