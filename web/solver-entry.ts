// Entry del solver para el bundle de navegador (TV/Tizen).
// Re-exporta solo lo que necesitan los endpoints simulados por web/api-shim.js.
export {
  screenToLevelData,
  solvePath,
  nextMoveFrom,
  countSolutionsOfMinLength,
} from "../generator/generate-screens.js";
