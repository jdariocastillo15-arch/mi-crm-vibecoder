# Guarda de publicación

Sacar algo a GitHub **exige autorización literal del owner**. Cubre las dos vías
reales: `git push` y los `gh` de escritura —abrir un PR, mergear, comentar,
publicar una release—.

| Capa | Fichero | Frena |
| --- | --- | --- |
| Claude Code | `.claude/hooks/guarda-push.sh` + `.claude/settings.json` | Cualquier intento del asistente, antes de ejecutarlo. `git` **y** `gh` |
| Git | `.git/hooks/pre-push` · copia versionada en `.githooks/` | Cualquier envío al remoto, venga de donde venga. Solo `git push` |

## Ojo: las dos capas no tienen el mismo alcance

La capa de Claude vive en ficheros **versionados**, así que **solo está activa en
las ramas que la contienen**. Mientras esta rama no se mergee a `main`, cambiar
de rama la apaga.

Por eso la capa de git está instalada en **`.git/hooks/pre-push`**, que no viaja
con la rama y está siempre activa en este clon. El reparto mientras tanto:

- **Lo que impide llegar al remoto** funciona siempre.
- **El informe detallado y la cobertura de `gh`** siguen a la rama.

Cuando esto entre en `main`, `git config core.hooksPath .githooks` da la versión
compartida para todo el equipo. Es configuración local: cada clon la repite.

## Cómo se autoriza

El asistente para, enseña los commits y el diff que iban a salir, y espera una
palabra literal: **`push`**, **`sube`**, **`go push`** o equivalente inequívoco.
Un «adelante» o un «vale» dichos sobre otra cosa no cuentan.

Con esa palabra se emite el vale —el SHA de `HEAD` escrito en
`.claude/push-autorizado`— y se repite la operación.

El vale es **de un solo uso**, **caduca a los 15 minutos** y está **atado al
commit exacto** que había al autorizarlo. Si entra un commit nuevo entremedias,
deja de valer: se autorizó *ese* diff, no el siguiente. Un vale inválido se
destruye al rechazarlo, para que no se reintente.

## Qué frena de verdad, y qué no

**Sí frena** que algo se escape por olvido, por inercia o por rutina. Ese es el
fallo que ocurrió el 24 de agosto —dos ramas subidas y dos PR abiertos sin pasar
por auditoría— y es el que esto hace imposible: el bloqueo es el estado por
defecto y no hay forma de llegar a GitHub sin cruzarlo.

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

## Cómo decide

**`git`** — se trocea el comando y se exige que `push` sea **el subcomando**, no
una palabra suelta. La primera versión buscaba «git … push» con una expresión
laxa y se comió **dos falsos positivos en cinco minutos**: un heredoc que solo
*mencionaba* el comando, y un `git checkout -b una-rama-con-push-en-el-nombre`.

**`gh`** — lista blanca de verbos de **lectura**; todo lo demás bloquea. Es el
lado seguro del error: un verbo nuevo que publique no se cuela por no estar
previsto, y como mucho molesta una lectura. Ampliar la lista es una línea en
`GH_LECTURA`. Pasan `list`, `view`, `status`, `diff`, `checks`, `checkout`,
`search`, `browse`, `download`, `clone`, `watch`, `logs`. `gh api` pasa si es
`GET`; bloquea con `-X POST/PUT/PATCH/DELETE` o con campos `-f`/`-F`.

Además:

- **Los cuerpos de heredoc se ignoran.** Documentar el comando no es ejecutarlo.
- **Se mira dentro de las comillas**, aparte del comando entero: si no, un
  `bash -c "…"` se cuela porque su primer token es `bash`. El precio es que un
  `echo` del comando también se bloquea.
- **`--dry-run` pasa libre**: no escribe en el remoto.

## Probarla

```bash
bash .claude/hooks/prueba.sh
```

**30 casos** — 14 que deben pasar, 16 que deben bloquear—, incluidos los dos
falsos positivos reales, los rodeos evidentes (`bash -c`, ruta absoluta,
`--repo` delante del verbo) y un verbo de `gh` inventado, para comprobar que lo
desconocido cae del lado seguro. Hay que dejarlos todos en verde antes de tocar
la detección.

## Desactivar

Borrar el bloque `hooks` de `.claude/settings.json` y `rm .git/hooks/pre-push`.
