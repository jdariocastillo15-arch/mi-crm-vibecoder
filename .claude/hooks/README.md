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

El asistente para, enseña **el comando exacto**, los commits y el diff que iban a
salir, y espera una palabra literal: **`push`**, **`sube`**, **`go push`** o
equivalente inequívoco. Un «adelante» o un «vale» dichos sobre otra cosa no
cuentan.

Con esa palabra se emite el vale —el SHA de `HEAD` escrito en
`.claude/push-autorizado`— y se repite la operación.

El vale es **de un solo uso**, **caduca a los 15 minutos**, está **atado al
commit exacto** que había al autorizarlo y **autoriza UNA publicación**. Si entra
un commit nuevo entremedias, deja de valer: se autorizó *ese* diff, no el
siguiente. Un vale inválido se destruye al rechazarlo, para que no se reintente.

### Dónde vive el vale, y quién lo consume

**Vive siempre en el worktree principal.** Las dos capas lo resuelven con
`git worktree list --porcelain`, no con `--show-toplevel`, que desde un worktree
devuelve el worktree: eran dos ficheros distintos y una autorización no valía
para las dos puertas.

**Lo consume la última puerta que cruza la operación:**

| Operación | Capa de Claude | Puerta de git |
| --- | --- | --- |
| `git push` | valida y **lo deja** | valida y **lo consume** |
| `gh` de escritura | valida y **lo consume** | no se ejecuta |

Antes lo borraban las dos, así que un `git push` necesitaba **dos vales**. Ahora
uno basta.

La capa de Claude lo valida contra el **HEAD del worktree en curso**, no contra
el de cualquiera: un vale emitido en un worktree no debe autorizar un
`gh pr merge` que no tiene nada que ver.

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

Se trocea el comando por `; & | salto de línea` y se mira **qué subcomando es
cada fragmento**, no qué palabras contiene el conjunto.

**`git`** — se exige que `push` sea el subcomando, no una palabra suelta. La
primera versión usaba una expresión laxa y se comió **dos falsos positivos en
cinco minutos**: un heredoc que solo *mencionaba* el comando, y un
`git checkout -b una-rama-con-push-en-el-nombre`.

**`gh`** — lista blanca de verbos de **lectura**; todo lo demás bloquea. Es el
lado seguro del error: un verbo nuevo que publique no se cuela por no estar
previsto, y como mucho molesta una lectura. Ampliar la lista es una línea en
`GH_LECTURA`. Pasan `list`, `view`, `status`, `diff`, `checks`, `checkout`,
`search`, `browse`, `download`, `clone`, `watch`, `logs`, `help`, `version`,
`completion`.

**`gh api`** — al revés que el resto: se enumeran los métodos que **leen**
(`GET`, `HEAD`, `OPTIONS`) y cualquier otro bloquea. Enumerar los de escritura
dejaba pasar un método inventado y un `-X` que se comía el endpoint
(`gh api -X repos/o/r`). Se reconocen las formas **pegadas, separadas y con
`=`**: `-XPOST`, `-X POST`, `--method=POST`, y los campos `-f`, `-fx=y`, `-F`,
`--field`, `--raw-field`, `--input` — la ayuda de `gh` dice que el método pasa a
`POST` en cuanto hay parámetros.

**Una publicación por comando.** Se cuentan **todas** las operaciones del
comando; con dos o más **bloquea siempre, y el vale no sirve**. Esta capa se
ejecuta una sola vez por comando: si `gh pr merge 1 && gh pr edit 2` pasara, se
ejecutarían las dos con un solo permiso.

**`--dry-run` no exime a nada, y conviene saber por qué.** Empezó eximiendo al
comando entero, que era un agujero —bastaba colarlo en cualquier parte para que
`git push --dry-run x && gh pr merge 1` pasara—. Luego eximía sólo a su propio
fragmento y sólo en `git`. Ahora no exime nada, por dos motivos comprobados:

- **Git ejecuta `pre-push` también en los ensayos.** Reproducido con un remoto
  local temporal: el hook corre. Así que un `git push --dry-run` no llegaba a
  completarse igualmente, y con un vale emitido la puerta de git **se lo comía
  sin publicar nada**. Se frena en la primera capa, que es donde se puede
  explicar y ofrecer la alternativa (`git log`/`git diff` contra el upstream).
- **En `gh` nunca fue seguro.** La ayuda de `gh pr create` dice literalmente que
  su `--dry-run` *«may still push git changes»*.

**Prefijos y envoltorios.** Se pelan las asignaciones `VAR=valor` y los
envoltorios que pasan argv tal cual —`env`, `command`, `builtin`, `exec`,
`nohup`, `time`, `sudo`, `nice`, `stdbuf`, `setsid`, `xargs`— con la tabla de
opciones que se comen un argumento de cada uno. Sin esto,
`GH_REPO=o/r gh pr merge 1` no se veía. Hay además una red de seguridad: si tras
pelar un envoltorio no se aterriza en `git`/`gh`, se busca el primero que quede
—así caen `nice -n 10 git push` y `xargs -I {} gh pr merge {}` aunque la tabla
de opciones se quede corta—.

`bash`, `sh` y `zsh` **no** están en esa lista a propósito: no pasan argv tal
cual, y lo suyo lo cubre el escaneo de comillas.

**`--help` pasa**, y se mira **antes** de descartar opciones —era justo ahí donde
se lo comía, y `gh pr merge --help` acababa bloqueado—. **Sólo `--help`, nunca
`-h`**: en `gh auth login` el corto está tomado por `--hostname`, así que
tratarlo como ayuda abriría un agujero en vez de cerrar una molestia.

**`git push --no-verify` bloquea siempre**, ni con vale válido. Esa opción existe
para no ejecutar los hooks, y la puerta de git es la única capa que protege este
clon fuera de esta rama.

**Se mira dentro de las comillas**, aparte del comando entero: si no, un
`bash -c "…"` se cuela porque su primer token es `bash`.

**Y dentro de todo lo demás que la shell ejecuta por su cuenta:**

- **Sustituciones y subshells.** `$(…)`, `` `…` ``, `<(…)` y hasta un `(…)`
  suelto se ejecutan **antes** que el comando que los envuelve, así que
  `echo "$(gh pr merge 1)"` publica igual. Mirando sólo el primer token no se
  veía: era `$(gh`. Se extrae el interior, y en varias vueltas para los
  anidados. Un `$(git rev-parse HEAD)` sigue pasando, claro.
- **Heredoc, según quién lo reciba.** `cat > f <<FIN … FIN` escribe un fichero
  que MENCIONA el comando, y eso no es ejecutarlo — era uno de los dos falsos
  positivos originales—. Pero `bash <<FIN … FIN` lo **ejecuta**. Se mira el
  comando que abre el heredoc: si es una shell, el cuerpo se clasifica como
  cualquier otro fragmento; si no, se descarta.

### La puerta de git, en detalle

Git le pasa al hook las refs por la entrada estándar, una línea por ref
—`<ref local> <sha local> <ref remota> <sha remota>`—. Es más preciso que
`git rev-parse HEAD`: desde un worktree, o empujando una rama que no es la
actual, `HEAD` no es lo que sale.

- **Una sola ref no-cero.** Publicar el mismo commit en dos ramas remotas siguen
  siendo dos publicaciones, así que no basta con que todas apunten al SHA
  autorizado.
- **Borrar ramas del remoto no pasa por el vale.** Un borrado no tiene commit que
  autorizar, así que se bloquea con mensaje explícito en vez de caer a `HEAD` en
  silencio. Hazlo a mano si es lo que quieres.
- **Sin refs por stdin** se cae a `HEAD`, pero avisando en el mensaje.

## Límites conocidos

Están escritos porque conviene saberlos, no porque den igual:

- **`git push --no-verify` desde una terminal a mano no tiene ninguna puerta.**
  La de git no se ejecuta —para eso está la opción— y la de Claude no está. Es
  límite de los hooks de git, no de esta guarda.
- **`git push --dry-run` queda frenado.** No es un descuido: git ejecuta
  `pre-push` también en los ensayos, así que no podía completarse de todos
  modos. Para ver qué saldría, `git log` y `git diff` contra el upstream.
- **El vale está atado al SHA, no al comando.** Un vale válido podría autorizar
  una operación distinta con el mismo `HEAD`. Que el informe enseñe el comando
  exacto reduce el riesgo de autorizar a ciegas, pero no lo elimina.
- **Contar sin deduplicar bloquea de más.** Un `echo` de un comando de push
  cuenta como operación, así que `echo "git push" && git push` queda bloqueado
  sin remedio. Es deliberado: contar de menos publicaría de más.
- **Un envoltorio muy exótico puede escaparse** si su opción lleva un valor que
  no está en la tabla y además no queda ningún `git`/`gh` reconocible detrás.
- **La matriz crea vales reales** mientras corre, unos milisegundos, con un
  `trap` que los borra. No la ejecutes en mitad de un push.

## Probarla

```bash
bash .claude/hooks/prueba.sh
```

**86 casos** en tres bloques:

- **Detección** — incluidos los dos falsos positivos reales, los rodeos
  evidentes (`bash -c`, ruta absoluta, `--repo` delante del verbo, prefijos y
  envoltorios), las sustituciones de comando y subshells, los heredoc que
  ejecutan frente a los que solo escriben, las formas de `gh api`, y un verbo
  inventado para comprobar que lo desconocido cae del lado seguro. Cada caso puede exigir además **por qué**
  bloquea, no solo que bloquee.
- **Ciclo del vale en la capa de Claude** — comprueba si el vale sigue o se
  consume, que es donde estaba el defecto de las dos autorizaciones.
- **Ciclo completo de `.githooks/pre-push`** con refs por la entrada estándar:
  una ref, varias refs, borrados, vale de otro commit y sin vale.

Hay que dejarlos todos en verde antes de tocar la detección.

## Desactivar

Borrar el bloque `hooks` de `.claude/settings.json` y `rm .git/hooks/pre-push`.
