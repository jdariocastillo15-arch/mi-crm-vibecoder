# Vibe CRM

CRM web responsive (PWA) en español para un negocio pequeño de ventas digitales.
Móvil-primero. Lo usan **Marta** (dueña) y **Carlos** (atención y ventas), y
existe para una sola cosa: que no se pierdan ventas por falta de seguimiento.

**Next.js · React · Tailwind CSS v4 · Convex · Railway**

---

## Antes de tocar código

Estas tres fuentes mandan, en este orden:

| Qué | Dónde |
| --- | --- |
| **Requisitos de producto** | [CRM - PRD](https://app.notion.com/p/3b2c808ed5e680288c81efb0096ff0d3) en Notion |
| **Design system** | [design](https://app.notion.com/p/3bbc808ed5e6806bbf1af3e26902294c) en Notion |
| **Prototipo de todas las pantallas** | `DESING/design_handoff_crm_pwa/CRM Shell.dc.html` |
| **Tareas** | Linear → proyecto **CRM MVP**, fases `Impl. 1` a `Impl. 8` |

El prototipo es **referencia de comportamiento y estilo, no código que portar**:
está construido sobre un runtime de previsualización propietario. Cada issue de
Linear trae una tabla "Dónde está el diseño" con el fichero y las **líneas
exactas** que tiene que reproducir.

> Las tareas de las fases `Fase 0` a `Fase 4` de Linear son **histórico**. Varias
> describen un producto que el diseño cambió (había un pipeline kanban y un
> catálogo de productos que ya no existen). Llevan un aviso al principio.

---

## Arrancar en local

Hace falta Node 22 o superior.

```bash
npm install
```

### Este repositorio tiene su propia conexión a Convex

La credencial vive en `.env.local`, **dentro de la carpeta**, no en la sesión
global de la máquina (`~/.convex/config.json`). Es a propósito: así este
repositorio no comparte cuenta ni despliegue con ningún otro proyecto, y
`npx convex` ejecutado desde aquí solo puede tocar este despliegue.

El CLI resuelve credenciales por prioridad, y una deploy key gana sobre la
sesión global. Mientras `CONVEX_DEPLOY_KEY` esté en `.env.local`, este repo es
autónomo.

**Alta, una sola vez.** En [dashboard.convex.dev](https://dashboard.convex.dev)
crea el proyecto (`vibe-crm`), entra en **Settings → Deploy Keys**, genera una
clave para el despliegue de **desarrollo** y pégala en `.env.local`:

```bash
cp .env.example .env.local
# pega la clave en CONVEX_DEPLOY_KEY
```

Luego:

```bash
npx convex dev --once     # sincroniza el esquema y genera convex/_generated/
npx @convex-dev/auth      # claves de firma de sesión, una vez por despliegue
```

Si prefieres hacerlo desde el terminal en vez del panel, `npx convex dev` sin
más te pide login en el navegador y crea el proyecto — pero eso **sí** escribe
la sesión global en `~/.convex`. Si tomas ese camino, genera después la clave
propia del repo y ya quedas aislado:

```bash
npm run convex:key        # escribe CONVEX_DEPLOY_KEY en .env.local
```

### Sobre el servidor MCP de Convex

Convex trae un servidor MCP (`npx convex mcp start`) que expone el despliegue a
herramientas de IA. **Este repositorio no lo usa**, y es una decisión, no un
olvido: el servidor MCP exige la sesión de cuenta global (`~/.convex/config.json`)
y **no acepta la deploy key del repositorio**. Probado: devuelve
`Not Authorized` incluso con `CONVEX_DEPLOY_KEY` en el entorno.

Usarlo obligaría a crear la credencial compartida que este repositorio existe
para evitar. Y no hace falta: el CLI da el mismo acceso con la clave propia —
`npx convex data`, `npx convex run`, `npx convex logs`, `npx convex env list`.

Si algún día prefieres la comodidad del MCP sobre el aislamiento, basta con
`npx convex login` y añadir un `.mcp.json` con
`{"mcpServers":{"convex":{"command":"npx","args":["convex","mcp","start","--project-dir","."]}}}`.

### El día a día

Dos procesos a la vez:

```bash
npx convex dev     # backend: sincroniza esquema y funciones
npm run dev        # frontend: http://localhost:3000
```

O los dos de golpe: `npm run dev:all`.

La primera vez, entra en `/login` y usa **"Crear la primera cuenta"** para darte
de alta como Dueña. Ese enlace es andamio temporal: desaparece cuando
[JES-69](https://linear.app/jesus-dario-castillo-betacourt/issue/JES-69/overlay-anadir-usuario-editar-usuario)
resuelva cómo se invita a alguien al equipo.

### Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo de Next |
| `npm run dev:all` | Convex y Next a la vez |
| `npx convex dev` | Sincroniza el backend y observa cambios |
| `npm run convex:key` | Genera la deploy key de desarrollo en `.env.local` |
| `npm run convex:key:prod` | Genera la deploy key de producción, para Railway |
| `npm run build` | Compilación de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir |

---

## Cómo está organizado

```
app/
  layout.tsx            Fuentes, metadatos, providers de Convex Auth
  globals.css           TODO el design system: tokens, modo oscuro, animaciones
  login/                Inicio de sesión (JES-46) — ya funciona
  (app)/                Pantallas con sesión, dentro del armazón
    hoy/  clientes/  clientes/[id]/  ventas/  equipo/  cuenta/
components/
  ui/                   Los primitivos del design system
  shell/                Navegación adaptativa y barra superior
convex/
  schema.ts             Las cinco entidades del PRD
  auth.ts               Email y contraseña, con el rol en el alta
  clientes.ts  seguimientos.ts  interacciones.ts  ventas.ts  users.ts
  helpers.ts            requireUser / requirePropietaria y utilidades de fecha
lib/
  constants.ts          Vocabulario de la interfaz: estados, canales, avisos
  format.ts             Euros, fechas relativas, iniciales
  seguimientos.ts       Clasificación en Atrasados / Para hoy / Próximas
DESING/                 El paquete de diseño. No se toca: es la referencia.
```

### Los tokens

`app/globals.css` define el design system con **los mismos nombres semánticos que
usa el prototipo**, para poder leer `CRM Shell.dc.html` y traducirlo sin traducir
además los nombres. Se convierten en utilidades de Tailwind:

| Token | Utilidad |
| --- | --- |
| `--color-primary` | `bg-primary` `text-primary` `border-primary` |
| `--color-surface` `--color-surface-2` | `bg-surface` `bg-surface-2` |
| `--color-text` `--color-text-muted` `--color-text-subtle` | `text-text` `text-text-muted` `text-text-subtle` |
| `--color-success` `-bg` `-text` | `bg-success-bg` `text-success-text` |
| `--radius-md` (6px) `--radius-xl` (10px) | `rounded-md` `rounded-xl` |
| `--shadow-xs` | `shadow-xs` |

**Ningún color, sombra, radio o espaciado debe escribirse a pelo en un
componente.** Si algo no cambia al activar el modo oscuro, es que no usa un token.

Modo oscuro: `<html data-theme="dark">`. Redefine solo los semánticos, así que
ningún componente necesita saber en qué modo está.

---

## Decisiones que ya están tomadas

Vienen del PRD, sección "Cabos sueltos". Están así a propósito:

- **Las fechas de calendario se guardan como texto `YYYY-MM-DD`**, no como marca
  de tiempo. Un seguimiento vence "el día 27", no "el 27 a las 00:00 de una zona
  horaria": guardarlo como fecha evita que cambie de sección según dónde esté
  quien lo mira.
- **La autoría se guarda por identificador de usuario**, nunca por nombre. Si
  Marta cambia su nombre en "Mi cuenta", su historial la sigue reconociendo.
- **El estado del cliente se guarda con su nombre de negocio** (`nuevo_lead`,
  `ganado`…), no con el del color. El color es presentación.
- **El buscador de clientes filtra en el cliente, no en el servidor.** A la
  escala de este producto es lo correcto, y es lo único que permite filtrar
  según se escribe. Si la lista crece de verdad, ahí entra un índice de búsqueda.
- **Las protecciones de borrado de usuarios se comprueban en el servidor**
  (`convex/users.ts`). Ocultar un botón no es una regla de seguridad.

---

## Publicar

### GitHub

El remoto ya existe y ya está configurado como `origin`:

```
https://github.com/jdariocastillo15-arch/mi-crm-vibecoder
```

Railway está enganchado a él, así que **cada envío a `main` despliega**. Con eso
en mente, subir es:

```bash
git push origin main
```

> El primer envío tuvo que ir con `--force`: el remoto guardaba una prueba
> anterior sin relación con este proyecto y su historia no empalmaba con la de
> aquí. A partir de ahí, envíos normales.

**Este repositorio es público.** No es lo que pedía la nota original de este
README, y conviene decidirlo a conciencia, porque lo que se sube incluye la
carpeta `DESING/` entera —el paquete de diseño con su sistema de componentes— y
las referencias al PRD y a las tareas. Para cambiarlo:

```bash
gh repo edit jdariocastillo15-arch/mi-crm-vibecoder --visibility private
```

### Convex (producción)

Genera la clave de producción, que es **distinta** de la de desarrollo que
usa tu `.env.local`:

```bash
npm run convex:key:prod
```

También se puede desde el panel: **Settings → Deploy Keys → Generate Production
Deploy Key**. Esta clave va solo en Railway, nunca en el repositorio.

### Railway

Crea el servicio desde el repositorio de GitHub y añade **una sola variable**:

| Variable | Valor |
| --- | --- |
| `CONVEX_DEPLOY_KEY` | La clave de producción de Convex |

`railway.json` ya trae el resto. El build ejecuta
`npx convex deploy --cmd 'npm run build'`, que despliega las funciones de Convex
a producción **y** compila Next con la `NEXT_PUBLIC_CONVEX_URL` correcta ya
inyectada. Por eso esa variable no hay que configurarla a mano.

**Después del primer despliegue**, en Convex → Settings → Environment Variables
del despliegue de **producción**, pon `SITE_URL` con el dominio que te dé
Railway. No es opcional: Convex Auth lo usa para las redirecciones, y sin él el
inicio de sesión no funciona en producción aunque todo lo demás compile.

### Comprobar que el despliegue está sano

```bash
curl -I https://<tu-dominio>.up.railway.app/hoy   # 307 a /login sin sesión
curl -I https://<tu-dominio>.up.railway.app/login # 200
```

Si `/login` responde 200 pero entrar da error, casi siempre es la `SITE_URL` que
falta arriba.
