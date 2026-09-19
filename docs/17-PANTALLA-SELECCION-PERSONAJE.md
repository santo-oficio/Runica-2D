# 🧑‍🎤 Pantalla de selección de personaje y sistema de calibración

Documento vivo que describe la pantalla de selección de personaje: su demo,
sus calibradores visuales, el formato de los JSON que la alimentan y las reglas
de comportamiento. **El juego definitivo debe consumir estos mismos JSON de forma
dinámica** — ninguna coordenada, polígono ni zona va hardcodeada en el código.

## 1. Piezas del sistema

| Pieza | Archivo | Rol |
|---|---|---|
| Demo de selección | `demo-seleccion-personaje.html` | Vista previa interactiva idéntica a la pantalla final |
| Calibrador de avatares | `calibrate-selection-avatars.html` | Posiciona avatares, cuadros, bordes y zonas de cuerpo completo |
| Calibrador de botones | `calibrate-selection-buttons.html` | Polígonos de las teclas A–Z, Borrar, Atrás y Adelante |
| Calibrador del nombre | `calibrate-selection-name.html` | Zona donde se escribe el nombre |
| Calibrador global | `calibrate-selection-global.html` | Ajuste global del conjunto |
| Datos de avatares | `assets/menu principal/character-positions.json` | Polígonos, transforms, bordes y zonas full-body |
| Datos de botones | `assets/menu principal/selection-buttons.json` | 29 polígonos de botones |
| Datos del nombre | `assets/menu principal/selection-name-area.json` | Rectángulo del nombre |
| Fondo | `assets/menu principal/seleccion_personaje.png` | Imagen de fondo (no se modifica) |
| Avatares | `assets/avatars/avatar_01.png`–`avatar_08.png` | Originales 7680×7680 RGBA |
| Thumbnails | `assets/avatars/thumbs/avatar_01.png`–`avatar_08.png` | 512×512 RGBA para los cuadros |

API en `demo-server.ts` (un par load/save por cada JSON, patrón común):

```text
GET  /api/load-character-positions    POST /api/save-character-positions
GET  /api/load-selection-buttons      POST /api/save-selection-buttons
GET  /api/load-selection-name         POST /api/save-selection-name
```

La raíz del proyecto se resuelve desde la ubicación real de `demo-server.ts`
(nunca `process.cwd()`), así que las rutas son estables desde cualquier cwd.

## 2. Espacio de coordenadas: `image-content`

Todas las coordenadas están **normalizadas (0–1) respecto a la imagen visible**,
no al viewport. Con `object-fit: contain` y ratio 3:2 la imagen puede tener
letterbox; el rectángulo de contenido se calcula así:

```js
function contentRect() {
  const w = innerWidth, h = innerHeight, ratio = 1.5;
  let cw = w, ch = w / ratio;
  if (ch > h) { ch = h; cw = h * ratio; }
  return { left: (w - cw) / 2, top: (h - ch) / 2, width: cw, height: ch };
}
// píxel = rect.left + x*rect.width, rect.top + y*rect.height
```

Los JSON llevan `"coordinateSpace": "image-content"`. Si falta la marca
(JSON antiguos), el consumidor puede aplicar el espacio de viewport completo
como fallback (`legacy*` flags en la demo). **Cualquier pantalla nueva debe
escribir y leer siempre `image-content`.**

## 3. Esquemas JSON

### `character-positions.json`

```jsonc
{
  "coordinateSpace": "image-content",
  "polygons":        [ [[x,y],...] ×8 ],   // cuadro de recorte de cada avatar (clip-path)
  "borderPolygons":  [ [[x,y],...] ×8 ],   // marco de selección de cada avatar
  "avatarTransforms":[ {x,y,w,h} ×8 ],     // posición/tamaño del thumbnail dentro del cuadro
  "fullBodyAreas":   [ {x,y,w,h} ×8 ],     // zona del avatar a cuerpo completo, POR AVATAR
  "fullBodyArea":    {x,y,w,h}             // LEGACY: zona compartida; solo fallback
}
```

Reglas:

- Los cuatro arrays tienen **siempre 8 entradas** (una por avatar).
- Al guardar se reemplaza **solo la entrada del índice editado**; el resto se
  conserva (bug histórico: enviar el estado en memoria reseteaba los demás).
- `fullBodyAreas` es por avatar porque cada uno puede necesitar zona distinta.
  Si solo existe el `fullBodyArea` compartido, se usa como fallback para todos.
- Los polígonos tienen ≥3 puntos (habitualmente 4).

### `selection-buttons.json`

```jsonc
{
  "coordinateSpace": "image-content",
  "buttons": [ { "label": "A", "polygon": [[x,y],...] }, ... ]  // 29 botones
}
```

Orden: `A`–`Z` (26), `Borrar`, `Atrás`, `Adelante`.

### `selection-name-area.json`

```jsonc
{ "x": 0.35, "y": 0.55, "w": 0.18, "h": 0.05, "coordinateSpace": "image-content" }
```

## 4. Comportamiento de la demo (referencia para el juego)

### Precarga total

Antes de mostrar la pantalla se precarga TODO con una pantalla de carga que
informa de la fase y el progreso (nunca un spinner a secas):

1. Fondo + 8 thumbnails.
2. Los 8 PNG 8K de cuerpo completo (pesan 5–21 MB cada uno).
3. Sonidos del selector (mover, seleccionar, teclear).
4. Los tres JSON de calibración.

### Renderizado

- Cada thumbnail se posiciona con su `avatarTransforms[i]` y se recorta con
  `clip-path: polygon(...)` a su `polygons[i]` (porcentajes relativos al avatar).
- Los `avatarTransforms` se usan **tal cual están guardados** — no se
  reemplazan por el cuadro ni se recentran automáticamente.

### Bordes de selección (irregulares)

- Se dibujan como `<polygon>` SVG dentro de un `<g>` con filtro
  `feTurbulence` + `feDisplacementMap` (`seed` fija, `scale≈18`,
  `baseFrequency≈0.022`) → trazo orgánico que disimula imprecisiones.
- Estilos: **click (seleccionado) = dorado fuerte con resplandor**;
  **hover/foco = dorado suave**. Si el puntero sale del avatar, el borde de
  hover desaparece (usa el hover real, no el foco).

### Cuerpo completo

- Se muestra en `fullBodyAreas[i]` con el PNG 8K `avatar_{i}.png`.
- Al cambiar de avatar la imagen se oculta hasta que `img.decode()` confirma
  el nuevo src — así el avatar anterior nunca se ve con el tamaño de la zona
  nueva (bug histórico del "fantasma").
- **Regla de hover**: si el puntero está sobre un avatar → ese avatar. Si el
  puntero no está sobre ningún avatar → el **seleccionado** (si hay) o vacío.
  Con teclado, el foco sobre un avatar lo muestra. Se distingue foco puesto
  por ratón (no persiste al salir) de foco de teclado.

### Navegación por teclado

Orden lineal para `←`/`→`:

```text
Avatar 1→…→8 → A→…→Z → Borrar → Atrás → Adelante
```

`↑`/`↓` son por filas explícitas con memoria de retorno **solo al cambiar de
bloque** (avatares ↔ letras ↔ flechas):

```text
Avatar 1–4 ↓ Avatar 5–8 (misma columna)
Avatar 5 ↓ A · 6 ↓ D · 7 ↓ G · 8 ↓ I
Grupos al subir: A-C→5 · D-F→6 · G-H→7 · I-J→8
Letras: A-J ↔ K-T (misma columna) ↔ U-Z/Borrar
Q ↓ Z · R/S/T ↓ Borrar · Z ↑ Q
Borrar ↑ → vuelve a R/S/T según origen; si venía de Z → T
```

## 5. Calibrador de avatares — modos

`calibrate-selection-avatars.html` muestra los 8 avatares a la vez sobre el
fondo. Modos:

| Modo | Qué edita | Controles clave |
|---|---|---|
| Avatares | `avatarTransforms[i]` | arrastrar / flechas / `Shift` fino / `+` `-` tamaño / toggle recorte |
| Cuadros | `polygons[i]` | clic añade punto (≥4), doble clic o botón cierra, `Z` deshace, `Esc` cancela |
| Bordes | `borderPolygons[i]` | igual que cuadros + "Copiar del cuadro" |
| Cuerpo completo | `fullBodyAreas[i]` | arrastrar dibuja el rect, flechas mueven, `+` `-` tamaño |

- Clic sobre un avatar lo selecciona; **Guardar y siguiente** guarda solo el
  índice actual y avanza.
- El guardado fusiona con el estado del servidor: lee el JSON actual, reemplaza
  la entrada `[i]` y escribe el objeto completo — nunca resetea los otros 7.

## 6. Pipeline de assets

- Originales de avatar: **7680×7680 RGBA**. Thumbs: **512×512**.
- Si llega un PNG a 1900×1900 se sube a 7680. Para máxima calidad usar
  **Real-ESRGAN x4plus** en `.sam-venv` (GPU): 1900→7600→7680, con el canal
  alfa escalado aparte por Lanczos. El modelo queda en
  `.sam-venv/.../weights/RealESRGAN_x4plus.pth`.
- Los `<img>` llevan cache-busting `?v=avatars-N`; **incrementar N** en demo y
  calibrador cada vez que se regeneren avatares para forzar recarga.
- La demo pide los JSON con `cache: 'no-store'`.

## 7. Reglas para el juego definitivo

1. Toda la geometría viene de los JSON — **prohibido hardcodear coordenadas**
   de cuadros, bordes, zonas de cuerpo completo, botones o nombre.
2. Cargar los tres JSON al arrancar (con la precarga), espacio
   `image-content` en todos.
3. Mantener la semántica por índice: avatar *i* usa `polygons[i]`,
   `borderPolygons[i]`, `avatarTransforms[i]`, `fullBodyAreas[i]`.
4. Misma lógica de foco/hover, navegación y estilos de borde descritas arriba.
5. Recalibrar = editar los JSON con los calibradores; el juego no necesita
   cambios de código.
