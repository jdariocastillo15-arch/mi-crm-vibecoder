import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

/**
 * Control de acceso en el borde — implementa parte de JES-47.
 *
 * Sin sesión, cualquier ruta lleva a /login. Con sesión, /login lleva a /hoy.
 * La comprobación de ROL (la pantalla de Equipo) no va aquí: va en el servidor
 * de Convex, que es donde de verdad importa. Ver `convex/helpers.ts`.
 */

// Dos listas y no una, aunque hoy `esLogin` sea un subconjunto de `esPublica`.
// Son dos preguntas distintas: "¿esta ruta sobra si ya has entrado?" y "¿esta
// ruta se puede ver sin entrar?". Mezclarlas hacía que /galeria, al añadirla,
// mandase a /hoy a cualquiera con sesión —incluidas sus propias pruebas—.
const esLogin = createRouteMatcher(["/login"]);
const esPublica = createRouteMatcher(["/login", "/galeria"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const autenticado = await convexAuth.isAuthenticated();

  if (esLogin(request) && autenticado) {
    return nextjsMiddlewareRedirect(request, "/hoy");
  }

  if (!esPublica(request) && !autenticado) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
});

export const config = {
  // Todo menos ficheros estáticos, las entrañas de Next y el túnel de errores.
  //
  // EL TÚNEL es `/registro-de-errores`, la ruta que `next.config.ts` reescribe
  // hacia Sentry para que el navegador mande allí lo que se rompe. No lleva
  // punto, así que sin sacarla a mano el guardia la trataría como una pantalla
  // más y, sin sesión, la mandaría a /login: se perderían justo los errores de
  // la pantalla de acceso, que es donde nadie tiene sesión todavía.
  matcher: [
    "/((?!.*\\..*|_next|registro-de-errores).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
