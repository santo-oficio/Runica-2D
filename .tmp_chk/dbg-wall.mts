import { TIERS, mulberry32, solve, emptyBoardDistanceProbe } from "../generator/generate-screens.js";
// instrumentación rápida: réplica del tramo de randomCandidate para tier N
const t = TIERS.find((x) => x.level === Number(process.argv[2] || 10))!;
let tries = 0, noDist = 0, noEnemy = 0, solvableButDirect = 0, ok = 0;
// no puedo importar internals privados — parcheo vía randomCandidate + solve directo
import { randomCandidate, directPathCellsPub } from "../generator/generate-screens.js";
