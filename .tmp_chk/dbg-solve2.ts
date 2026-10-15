import { TIERS } from "../generator/generate-screens.js";
import * as g from "../generator/generate-screens.js";
// randomCandidate no está exportado; uso generateTierBatch internamente?
// Mejor: reexportar acceso — parche rápido: contar por re-implementación mínima
// Acceso indirecto: llamar a validateCandidate sobre candidatos? randomCandidate no es export.
// Parche: leer las funciones vía reflexión no es posible en ESM. Exporto temporalmente:
