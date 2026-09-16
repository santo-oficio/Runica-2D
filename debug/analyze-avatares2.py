import cv2
import numpy as np

img = cv2.imread("avatares.jpg")
h, w = img.shape[:2]
print(f"Imagen: {w}x{h}")

# Colores dominantes
pixels = img.reshape(-1, 3).astype(np.float32)
# Reducir colores via KMeans
from sklearn.cluster import KMeans
# usar subsample para velocidad
idx = np.random.choice(pixels.shape[0], 20000, replace=False)
sample = pixels[idx]

k = 12
km = KMeans(n_clusters=k, n_init=10, random_state=0)
km.fit(sample)
centers = km.cluster_centers_.astype(int)
labels = km.predict(pixels)
counts = np.bincount(labels, minlength=k)

print("\nColores dominantes (BGR -> RGB):")
for i in range(k):
    b, g, r = centers[i]
    pct = counts[i] / pixels.shape[0] * 100
    print(f"  cluster {i}: RGB=({r},{g},{b})  {pct:.1f}%")

# Encontrar regiones no-fondo: mascara de los clusters menos comunes
# El fondo suele ser el cluster mas grande y uniforme
background_cluster = int(np.argmax(counts))
print(f"\nCluster de fondo (mas comun): {background_cluster}")

# Mascara de avatares = todo lo que NO es el cluster de fondo
mask = (labels != background_cluster).astype(np.uint8).reshape(h, w) * 255

# Limpiar mascara
kernel = np.ones((3,3), np.uint8)
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)

# Componentes conexas
num_labels, labels_cc, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)

print(f"\nComponentes conexas (no-fondo): {num_labels-1}")
comps = []
for i in range(1, num_labels):
    x, y, cw, ch, area = stats[i]
    if area > 500:  # filtrar ruido
        comps.append((x, y, cw, ch, area))

comps.sort(key=lambda b: -b[4])
print(f"Componentes grandes ({len(comps)}):")
for i, (x, y, cw, ch, area) in enumerate(comps[:50]):
    print(f"  [{i}] x={x} y={y} w={cw} h={ch} area={area}")

cv2.imwrite("debug/avatares-mask.png", mask)
print("\nGuardado debug/avatares-mask.png")
