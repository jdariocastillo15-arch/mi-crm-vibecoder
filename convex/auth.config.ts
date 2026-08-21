/**
 * Emisor de los tokens de sesión de Convex Auth.
 *
 * `CONVEX_SITE_URL` la pone Convex sola en cada despliegue: no hay que
 * configurarla a mano ni en local ni en producción.
 *
 * Las claves de firma (`JWT_PRIVATE_KEY` y `JWKS`) SÍ hay que generarlas una
 * vez por despliegue, con `npx @convex-dev/auth`. Sin ellas el login falla.
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
