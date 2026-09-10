# Auditoría completa de Vibe CRM — hallazgos y plan de corrección

> **Revisión 3.** Cierra M5 en el punto correcto, precisa la prueba de M6 y
> **acota el plan**: S1+D6 salen como cambio independiente. No se amplía nada más.

> **Estado a 2026-09-10.** Cerradas la **tanda 1** (JES-94, PR #10, merge
> `25b97ba`, en producción) y la **tanda 3, dinero** (JES-98, D1 y D2). Siguen
> pendientes las tandas 2, 4, 5 y 6.
>
> Nota de numeración: durante la ejecución, «dinero» pasó a llamarse tanda 2 y el
> resto del servidor tanda 3, al revés de como están numeradas aquí abajo.
>
> JES-98 cerró además dos cosas que este documento no había visto: la tabla
> `limitesRecuperacion` crecía para siempre sin que nada la limpiara, y
> `interacciones.crear` y `ventas.crear` no validaban la fecha en el servidor.

## Contexto

CRM en producción (`vibe-crm-pro.net`, `main` en `9dfa972`), hito «Impl. 7 —
Equipo» cerrado. Auditado **todo lo construido**: los 13 ficheros de `convex/`,
8 pantallas, 12 overlays, sistema de diseño, configuración y las cabeceras reales
de producción. Sistema **sólido en lo estructural**, con grietas concretas en
seguridad, validación de entrada y accesibilidad. Son arreglos de una a cinco
líneas en primitivos compartidos; **no es un rediseño**.

**Comprobado y correcto** (no volver a mirar): cero funciones de negocio sin
guarda, cero escaladas de rol, cero filtración de hashes o códigos por queries,
`Overlay` cumple los ocho requisitos de foco y teclado, `prefers-reduced-motion`
respetado, **cero colores a mano**, ningún botón de icono sin `aria-label`,
estados de carga impecables, `tsc` + `eslint` + `npm audit` limpios.

---

## Hallazgos

🔴 grave · 🟠 alto · 🟡 medio · ⚪ menor

### Seguridad

| # | Sev | Dónde | Qué pasa |
|---|---|---|---|
| S1 | 🔴 | `signIn.js:62` vs `:79`; `recuperar.ts:126-134` | **Se puede invalidar el código de otra persona en bucle.** El código anterior se borra al generar el nuevo (`createVerificationCode.js:47`) y el cupo de 3/hora solo se mira después, dentro de `sendVerificationRequest`. Hay **dos entradas**: `estadoAcceso` (solo para fichas pendientes o sin credencial — a quien ya tiene contraseña le devuelve `"contrasena"` sin efectos, `acceso.ts:118-120`) y, sobre todo, **`auth:signIn` con `flow:"reset"`, que es público y sin sesión** y alcanza a cualquier cuenta con contraseña. **CERRADO en la tanda 1 (JES-94).** |
| S2 | 🟠 | `convex/auth.ts:418-420` | La puerta de `CODIGO_ALTA` **no comprueba `bajaEn`**; las otras dos sí (Google `:334`, servidor `:386`). Deja preparar credencial sobre una ficha de baja que se activa si un día se reactiva. Hoy no explotable: la variable no está puesta. |
| S3 | 🟠 | `recuperar.ts:31` + `createVerificationCode.js:53` | **JES-91 confirmado**: OTP de 8 dígitos con `sha256` sin sal. Online inofensivo; offline el espacio se tabula en minutos. → follow-up. |
| S5 | 🟡 | `helpers.ts:171-176` | El error «Hay N usuarios con el email X» viaja al navegador por un endpoint sin autenticar, rompiendo el disimulo del resto del fichero. |
| ~~S4~~ | — | — | **Retirado**: `estadoAcceso` escribiendo en ficha ajena es el flujo deliberado de JES-92, no un defecto nuevo. |

### Integridad de datos

| # | Sev | Dónde | Qué pasa |
|---|---|---|---|
| D1 | 🔴 | `OverlayRegistrarVenta.tsx:50-52` | **Factor 100 en dinero.** `euros()` quita todo lo que no sea dígito: «1.200,50» → **120.050 €**. El comentario contempla el punto de millar, no la coma decimal — y el campo es `type="tel"`, con coma en el teclado. **CERRADO en la tanda 3 (JES-98).** |
| D2 | 🔴 | `convex/ventas.ts:92-101` | **Valida antes de redondear.** `0.4` pasa `<= 0` y `Math.round` guarda **0**, violando `schema.ts:165`. Sin tope superior: dos ventas de `1e308` pintan **«€Infinity»**. **CERRADO en la tanda 3 (JES-98)**, salvo el tope superior, que sigue pendiente. |
| D3 | 🔴 | `interacciones.ts:50,63`; `ventas.ts:103` | **`fecha` sin validar** en ambas, mientras `seguimientos.ts:131` sí lo hace. Solo la **interacción** toca `ultimoContacto`; la **venta no lo modifica** y su daño es de orden y presentación. No es irreversible: falta **vía de corrección desde la aplicación**. **CERRADO en JES-98**: las dos rechazan ahora formato inválido y fecha futura. La vía de corrección sigue sin existir, pero ya no hace falta para este caso. |
| D4 | 🟠 | `users.ts:145-154` + `seguimientos.ts:205` | **Un seguimiento cerrado por alguien a quien luego dan de baja no se puede reabrir nunca.** La baja solo reasigna los *sin hacer*; `deshacer` exige ser quien lo cerró, y esa persona ya no entra. Ni la propietaria puede. |
| D5 | 🟡 | todas las mutations | **Ninguna cadena tiene límite de longitud.** Riesgo **acumulado**, no de un documento suelto: Convex limita documento a 1 MiB y lectura a 16 MiB. |
| D6 | 🟡 | `recuperar.ts:126-171` | El cupo se consume **aunque el correo nunca salga**: se registra antes del `fetch`, en una `action`, sin revertir. Resend caído → una hora sin poder entrar sin haber recibido nada. **CERRADO en la tanda 1 (JES-94).** |
| D7 | 🟡 | `clientes.ts:88-99` | `actualizar` no reaplica «al menos un teléfono o un email» que el alta sí exige (`:49-52`); `patch` con ambos `undefined` los borra. |
| D8 | 🟡 | `users.ts:26-35` | `me` se traga **cualquier** error, no solo «no hay sesión». Un fallo transitorio enseña **«Acceso restringido»** a la propietaria (`equipo/page.tsx:55`). |
| D9 | ⚪ | `schema.ts:120,121,159,173` | Cuatro índices nunca usados; `ultimoContacto` obligatorio e inicializado al alta → un cliente nunca contactado dice «Último contacto: Hoy». → follow-up. |

### Accesibilidad y color

**Listón:** WCAG 2.2 **AA** pide 24×24px de objetivo táctil; 44×44 es **AAA**. A5
se corrige porque **JES-73 lo exige**, no por incumplimiento AA. A2 y A3 sí son
incumplimientos de AA.

| # | Sev | Dónde | Qué pasa |
|---|---|---|---|
| A1 | 🔴 | `AccionesRapidas.tsx:37`, `AccionesFicha.tsx:34`, `ListaClientes.tsx:210` | **Ocho controles sin anillo de foco.** Las utilidades `shadow-*` (`@layer utilities`) reescriben `box-shadow` entero y ganan por capa al anillo de `@layer base` (`globals.css:220-224`). **El repo ya documenta este mecanismo** en `Chips.tsx:192-196` y lo esquiva con `outline`; estos tres quedaron fuera. |
| A2 | 🔴 | `globals.css:43,47,55` | **Contraste bajo AA en modo claro** (medido, confirmado por auditoría): blanco sobre botón primario **3,30:1**, verde como texto **3,30:1**, nav activa **3,15:1**, `text-subtle` **2,99–3,35:1**. En oscuro pasa todo salvo `text-subtle` (3,66–4,24:1). El botón se lee **mejor al pasar el ratón** (5,02:1) que en reposo. |
| A3 | 🟠 | `globals.css:52,53` + `Field.tsx:23` | Bordes de campo a **1,39:1** y 1,21:1. En un overlay: blanco sobre blanco con una línea invisible. Aplica a bordes **que delimitan controles**. |
| A4 | 🟠 | `Field.tsx:63` | **Los errores no se anuncian.** `htmlFor`/`aria-describedby`/`aria-invalid` están bien, pero el error no está en región viva y nadie enfoca el primer campo inválido. Con lector: pulsas «Guardar» y **no oyes nada**. El login ya lo hace bien (`login/page.tsx:303`). |
| A5 | 🟠 | `AppShell.tsx:117-123`; `login/page.tsx:399-403`, `:488-492` | «Mi cuenta» en móvil mide **32×32** y es el único acceso; los dos enlaces del login, **35,5px**. |
| A6 | 🟠 | todo `app/` | **El modo oscuro no se activa nunca**: nadie escribe `data-theme`, así que `globals.css:154-181` es código muerto. Y `layout.tsx:41-44` **sí** declara `themeColor` oscuro → barra negra sobre app blanca. |
| A7 | 🟡 | `Chips.tsx:206-211` | Chip seleccionado **solo por color** (fondos a 1,05:1). Afecta al filtro de Ventas. La variante con tono del mismo fichero sí cambia de forma. |
| A8 | 🟡 | `Toast.tsx:113-142` | «Deshacer» **inalcanzable con teclado**: al final del documento y 3.800 ms. La red contra el toque accidental solo existe para quien toca la pantalla. |
| A9 | 🟡 | `Avatar.tsx:23-25` | **De quién es cada seguimiento es invisible para un lector**: avatar con `aria-hidden` y un `title` inerte. |

### Robustez e infraestructura

| # | Sev | Dónde | Qué pasa |
|---|---|---|---|
| R1 | 🔴 | no existe | **Ninguna barrera de error en toda la app**: ni `error.tsx`, ni `global-error.tsx`, ni `ErrorBoundary`. Convex *lanza* y las pantallas solo distinguen `undefined`. Cualquier error da página genérica. |
| R2 | 🟠 | producción, medido | **Cero cabeceras de seguridad** y `x-powered-by`. Matiz: clickjacking mitigado por `SameSite=Lax` y `http://` ya redirige; queda la primera visita sin HSTS y la falta de CSP. |
| R3 | 🟠 | todo el repo | **Cero tests automatizados.** → follow-up. |
| R4 | ⚪ | `AppShell.tsx:98` | **Corregido**: la librería ya captura el fallo de `auth:signOut` y borra los tokens fuera del `try` (`react/client.js:164-174`). Mi escenario era incorrecto. Sin escenario demostrado. |
| R5 | ⚪ | JES-86 | `www` no responde. |

---

## Plan de corrección — seis tandas

Rama, PR y auditoría por tanda. **Dependencias:** D1+D2 comparten contrato del
importe; **D8 va con R1** (mismo tratamiento de errores, para no dejar un
intervalo sin manejo); A6+R2 comparten el script de tema y la CSP.

### Tanda 1 — Recuperación: cupo y envío · CERRADA (JES-94, PR #10)

Sale **sola**, sin el resto de correcciones del servidor.

**M5 — la reserva debe cruzarse en el endpoint público, no en el consumidor.**
El fallo de la revisión 2 era cambiar «Olvidé mi contraseña»: `auth:signIn` es
**público y acepta `flow:"reset"` sin sesión**, así que la llamada directa seguía
sustituyendo el código.

*Cómo acabó cerrándose, que no fue donde decía este plan:* no se envolvió la
exportación de `signIn` —por ahí pasan también la renovación con `refreshToken`,
el redirect de Google y el login normal— sino el **envoltorio de `authorize`**
de `convex/auth.ts`, que es por donde `providers/Password.js:88` mete el flujo
`"reset"`. Cubre las tres vías y es más estrecho.

1. Ante `flow:"reset"`, **reservar cupo antes** de delegar en la librería.
2. **Reserva atómica en una `mutation`.**
3. **Si el envío falla**, liberar **solo la propia reserva**, condicionada a la
   misma ventana. *(D6.)*
4. Corregir el comentario de `schema.ts:183-185`.

*Y una lección que costó tres NO-GO:* devolver la reserva ante **cualquier**
excepción abrió un agujero nuevo. Como el código ajeno ya está borrado en
`signIn.js:62`, un error provocado a propósito después de esa línea lo tiraba y
encima recuperaba el cupo. Se cerró rechazando `redirectTo` al entrar y
condicionando el reembolso a la marca `FALLO_DE_ENVIO`. **Compensar un fallo es
incorrecto cuando el daño ya ocurrió antes del fallo.**

### Tanda 2 — Resto del servidor

1. **D4 (M6)** — excepción explícita de autorización **para la propietaria** en
   `seguimientos.deshacer`, sin tocar `completadoPorId`. *(Reasignarlo en el
   recorrido `by_responsable` no arreglaba el caso Ana-completa-tarea-de-Bea y
   habría atribuido el cierre a quien no lo hizo.)*
   *Prueba:* Ana cierra una tarea **de Bea** → baja de Ana → la propietaria puede
   reabrirla, y `completadoPorId` **sigue siendo Ana hasta la reapertura**; tras
   ella se limpia conforme al contrato actual (`seguimientos.ts:212`).
2. **S2** — corte por `bajaEn` en `auth.ts:418-420`, calcado del de `:386-388`.
3. ~~**D3**~~ — **CERRADA en JES-98.** Las dos mutaciones validan formato y
   rechazan fecha futura, y los dos overlays lo comprueban también en local
   porque el `max` del campo no frena nada: `Overlay` no monta un `<form>`.
   Comprobado antes de tocar nada que **no había registros afectados** en
   desarrollo; queda pendiente mirarlo en producción desde el panel.
4. **D5** — límites de longitud en toda cadena, con helper compartido.
5. **D7** — reaplicar teléfono-o-email en `clientes.ts:88-99`.
6. **S5** — mensaje genérico hacia fuera en `helpers.ts:173`, detalle al log.

### Tanda 3 — Dinero · CERRADA (JES-98)

**D1 + D2 juntas**, un contrato: importes **enteros en euros**.

**El resultado fijado aquí cambió, y esto ya no describe lo implementado.** Este
plan decía «redondea primero y valida después» y daba «1.200,50» → **1.201**. El
dueño descartó ese redondeo: guardar en silencio un importe distinto del tecleado
deja a alguien descubriendo semanas después que su venta no es la suya. **Se
rechaza la fracción y se avisa**, en el navegador y en la API.

Lo implementado, en JES-98:

- `llevaCentimos()` busca la fracción **después de quitar la decoración y antes
  de quitar los separadores**. Ese orden importa: buscarla al final del texto tal
  cual dejaba pasar «1.200,50 €» y el mismo texto con un espacio, justo lo que
  `euros()` admite a propósito. Lo encontró auditoría (DAT-M1).
- `ventas.crear` exige `Number.isInteger` y guarda el importe recibido sin
  transformarlo. Redondear antes de validar seguía aceptando `49,9` y guardando
  `50` (DAT-M2). `Number.isInteger` ya descarta `NaN` e infinitos, así que
  sustituye a la comprobación de finitud.

*Resultado real:* «1.200,50», «1.200,50 €» y «49,9» **avisan y no guardan**;
«1200» y «1.200» siguen valiendo mil doscientos; `0,4`, `0,6` y `49,9` por API se
rechazan.

**El tope superior de importes NO entró** y sigue pendiente: dos ventas de `1e308`
todavía pintan «€Infinity». Queda como deuda declarada.

### Tanda 4 — Robustez del cliente

1. **R1 + D8 juntos.** Dos niveles, porque `AppShell` vive en el **layout** y un
   `error.tsx` de segmento **no lo envuelve**: hace falta `app/global-error.tsx`
   además del de segmento. Para **sesión revocada**, ofrecer salida al acceso en
   vez de reintentar la consulta indefinidamente. `users.me` deja de tragarse
   cualquier error, coordinado con el nuevo manejo para no dejar hueco.
2. **Los cuatro campos de fecha**, con semánticas distintas:
   `OverlayRegistrarVenta.tsx:177` y `OverlayRegistrarInteraccion.tsx:126`
   registran **pasado**; `OverlayNuevaTarea.tsx:125` y
   `OverlayProgramarSeguimiento.tsx:94` **planifican futuro** y deben seguir
   aceptándolo. Complemento del servidor, no sustituto.

### Tanda 5 — Accesibilidad · arranca de `ad7983b`

Parte del commit del 27 de agosto, escrito y sin subir, ya **rebasado limpio**
sobre `9dfa972` y **verificado**: sus medidas (2,77:1 → 5,39:1) son exactas.
**Ojo: `main` ya no está en `9dfa972`, así que hay que volver a rebasarlo.**

1. **A1** — quitar `shadow-*` de los tres focalizables o replicar el `outline` de
   `ListRow.tsx:42-45`. Una línea por sitio, ocho controles recuperan el foco.
2. **A2 (verde)** — solo en el bloque **claro**: `primary` a `#15803D` (5,02:1),
   `hover` a `#166534`, `active` a `#14532D`. Los tres ya están en la paleta; el
   oscuro no se toca. *Desviación consciente del handoff (`#16A34A`), declarada.*
3. **A2 (gris)** — no se cambia el token, se cambian sus usos: lo que es **texto**
   pasa a `text-text-muted`. Los iconos **esenciales** también necesitan
   contraste; solo los decorativos se quedan en `text-subtle`.
4. **A3** — subir `--color-border-strong` a ≥3:1 en bordes que delimitan controles.
5. **A4** — región viva en el error de `Field.tsx:63` y enfocar el primer campo
   inválido: **una corrección arregla los doce formularios**. Sin abusar de
   `assertive` ni duplicar anuncios.
6. **A5** — `min-h-11` en los dos enlaces del login y altura real en «Mi cuenta».
7. **A6** — activar el oscuro por preferencia del sistema, con script mínimo en el
   layout antes de pintar. **Decide y documenta el mecanismo del criterio 7 de
   JES-72.** Coordinar con la CSP de la tanda 6.
8. **A7, A8, A9** — forma además de color en el chip; «Deshacer» alcanzable con
   teclado; nombre accesible para el responsable.

JES-72 y JES-73 **no se cierran**: quedan el recorrido completo con teclado, la
auditoría con lector y la prueba en móvil real.

### Tanda 6 — Infraestructura

1. **R2** — cabeceras en `next.config.ts` y `poweredByHeader: false`. La **CSP
   entra en `Report-Only`** y debe contemplar el script de tema de A6, Convex y
   Google OAuth antes de bloquear.
2. **R5 / JES-86** — `www` y confirmar SSL en Full.

### Follow-up, fuera del plan

**S3 (JES-91)**, registro de cambios en `users`, **R3 (tests)**, reapertura
permanente de seguimientos y **D9**.

---

## Verificación

- **M5:** cupo agotado → `auth:signIn` directo con `flow:"reset"` sin sesión deja
  el código **intacto**; ídem con concurrencia y vía `estadoAcceso`; un fallo de
  envío no libera reservas ajenas. **Hecho.**
- **M6:** Ana cierra tarea **de Bea** → baja de Ana → la propietaria reabre;
  `completadoPorId` sigue siendo Ana **hasta** la reapertura.
- **Dinero:** «1.200,50» → 1.201; `0,4` rechazada; negativos y texto inválido.
- **Servidor:** `npx convex run` contra **desarrollo** (**`--prod` no llega a
  producción desde este terminal**: ignora el flag y usa `CONVEX_DEPLOY_KEY`).
- **Contraste:** recalcular con el mismo método, ambos modos.
- **Foco (A1):** recorrer «Hoy» y la ficha solo con Tab, en claro y en oscuro.
- **A4/A8:** con VoiceOver de verdad, no por inspección.
- **R1:** dar de baja a alguien **mientras navega** → mensaje con salida al
  acceso, no página de error.
- **R2:** `curl -I https://vibe-crm-pro.net/login`.
- Cada tanda: `npm run typecheck` y `npm run lint` limpios antes del PR.

## Cómo se sube

Rama por tanda, nada sube sin OK de auditoría, las tres autorizaciones literales
para `push`, PR y merge, merge commit, las ramas no se borran, y al cerrar los
criterios uno a uno diciendo de dónde sale la prueba de cada uno.
