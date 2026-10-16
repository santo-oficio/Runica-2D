// Stub de builtins de Node para el bundle de navegador (esbuild --alias).
// Las funciones que los usan (guardado de bancos, workers, CLI) nunca se
// ejecutan en la versión web/TV — el solver solo usa lógica pura.
export const writeFileSync = () => {};
export const readFileSync = () => "";
export const mkdirSync = () => {};
export const existsSync = () => false;
export const readdirSync = () => [];
export const statSync = () => ({ isDirectory: () => false });
export const createReadStream = () => null;
export const dirname = (p) => p;
export const join = (...a) => a.join("/");
export const basename = (p) => p;
export const extname = () => "";
export const resolve = (...a) => a.join("/");
export const fileURLToPath = (u) => String(u ?? "");
export const pathToFileURL = (p) => ({ href: String(p) });
export const spawn = () => {
  throw new Error("spawn no disponible en la versión web");
};
