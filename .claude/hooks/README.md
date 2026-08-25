# Guarda de push

Subir a GitHub **exige autorización literal del owner**. Hay dos capas y las dos
comparten el mismo vale.

| Capa | Fichero | Frena |
| --- | --- | --- |
| Claude Code | `.claude/hooks/guarda-push.sh` + `.claude/settings.json` | Cualquier intento del asistente, antes de ejecutarlo |
| Git | `.githooks/pre-push` | Cualquier envío al remoto, venga de donde venga |

La segunda capa necesita `git config core.hooksPath .githooks`, ya puesto en
este clon. **Cada clon nuevo tiene que repetirlo**: `core.hooksPath` es
configuración local y no viaja en el repositorio.

## Cómo se autoriza

El asistente para, enseña los commits y el diff que iba a subir, y espera una
palabra literal: **`push`**, **`sube`**, **`go push`** o equivalente inequívoco.
Un «adelante» o un «vale» dichos sobre otra cosa no cuentan.

Con esa palabra se emite el vale —escribiendo el SHA de `HEAD` en
`.claude/push-autorizado`— y se repite la operación.

El vale es **de un solo uso**, **caduca a los 15 minutos** y está **atado al
commit exacto** que había al autorizarlo. Si entra un commit nuevo entremedias,
deja de valer: autorizaste *ese* diff, no el siguiente.

## Qué frena de verdad, y qué no

**Sí frena** que se escape por olvido, por inercia o por rutina. Ese es el fallo
que ocurrió el 24 de agosto —dos ramas subidas y dos PR abiertos sin pasar por
auditoría— y es el que esto hace imposible: el bloqueo es el estado por defecto
y no hay forma de llegar al remoto sin cruzarlo.

**No frena** a un asistente que decida saltárselo a propósito: tiene acceso al
intérprete de comandos, así que puede escribir el vale él mismo. Con esa
herramienta en la mano no existe una barrera técnica dentro de la sesión.

Lo que sí queda es **rastro**: la emisión del vale aparece en la transcripción,
justo antes del intento, y es trivial de auditar a posteriori.

### Si quieres una barrera de verdad

Que el vale lo emita el owner, no el asistente. En el terminal de Claude Code,
el prefijo `!` ejecuta el comando de tu mano y no de la suya:

```
! printf '%s' "$(git rev-parse HEAD)" > .claude/push-autorizado
```

Mismo hook, misma caducidad; cambia de quién es la mano. Esa versión sí es un
límite y no una convención.

## Detalles de la detección

La primera versión buscaba «git … push» con una expresión suelta y se comió
**dos falsos positivos en cinco minutos**: un heredoc que *mencionaba* el
comando, y un `git checkout -b una-rama-con-push-en-el-nombre`. La versión
actual trocea el comando y exige que `push` sea **el subcomando**, no una
palabra que pase por ahí.

- **Los cuerpos de heredoc se ignoran.** Escribir un fichero que menciona el
  comando —esta misma documentación— no se bloquea.
- **`push` tiene que ser el subcomando.** Se saltan las opciones globales que
  se comen un argumento (`-C`, `-c`, `--git-dir`…) antes de mirar cuál es.
- **Se mira dentro de las comillas**, aparte del comando entero: si no, un
  `bash -c "…"` se cuela porque su primer token es `bash`. El precio es que un
  `echo` del comando también se bloquea; es el lado seguro del error.
- **`--dry-run` pasa libre**: no escribe en el remoto.

La matriz de 13 casos —seis que deben pasar, siete que deben bloquear— está en
el guion de prueba usado al construirla; incluye los dos falsos positivos
reales y los dos rodeos evidentes (`bash -c` y ruta absoluta al binario).

## Qué NO cubre

La guarda mira `git push`. **`gh pr create` no está cubierto** y también
publica: abre un pull request visible en GitHub. Si la regla es «nada sale sin
autorización», hay que añadir su patrón a `guarda-push.sh`.

## Desactivar

```bash
git config --unset core.hooksPath
```

Y borrar el bloque `hooks` de `.claude/settings.json`.
