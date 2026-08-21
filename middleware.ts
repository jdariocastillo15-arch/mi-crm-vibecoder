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

const esLogin = createRouteMatcher(["/login"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const autenticado = await convexAuth.isAuthenticated();

  if (esLogin(request) && autenticado) {
    return nextjsMiddlewareRedirect(request, "/hoy");
  }

  if (!esLogin(request) && !autenticado) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
});

export const config = {
  // Todo menos ficheros estáticos y las entrañas de Next.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
