import path from "node:path";

/**
 * Dónde guarda `sesion.setup.ts` la sesión de cada cuenta de prueba, para que
 * el resto de pruebas la reutilice sin volver a entrar.
 *
 * Esos ficheros llevan los tokens de una sesión abierta, así que están
 * ignorados por git y no se suben nunca.
 */
export const SESION_PROPIETARIA = path.join(__dirname, ".auth", "propietaria.json");
export const SESION_COMERCIAL = path.join(__dirname, ".auth", "comercial.json");
