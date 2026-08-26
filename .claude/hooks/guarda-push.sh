#!/usr/bin/env bash
#
# Guarda de publicación — sacar algo a GitHub exige autorización literal del owner.
#
# Cubre las dos vías reales:
#   · `git push`      — sube commits
#   · `gh` de escritura — abre PR, mergea, comenta, publica releases…
#
# Se engancha como hook `PreToolUse` de Bash: ve el comando ANTES de que se
# ejecute y lo frena. Frenarlo no es el objetivo; el objetivo es que el
# asistente PARE, enseñe lo que iba a salir y espere un "go" literal.
#
# Ver `.claude/hooks/README.md` para el alcance real de esta guarda.

set -uo pipefail

MINUTOS_VALIDO=15

entrada=$(cat)

# ---------------------------------------------------------------------------
# Detección
#
# Se trocea el comando y se mira QUÉ SUBCOMANDO es, no qué palabras contiene.
# La primera versión buscaba "git ... push" con una expresión suelta y se comió
# dos falsos positivos en cinco minutos: un heredoc que MENCIONABA el comando, y
# un `git checkout -b una-rama-con-push-en-el-nombre`.
#
# Con `gh` el criterio es del lado seguro: lista blanca de verbos de LECTURA y
# todo lo demás bloquea.
#
# Se emite UNA LÍNEA POR OPERACIÓN encontrada, con el formato
#
#     <clase>|<motivo>|<fragmento literal>
#
# porque contar cuántas hay es parte de la decisión: un vale autoriza UNA
# publicación, y esta capa se ejecuta una sola vez por comando.
# ---------------------------------------------------------------------------
operaciones=$(printf '%s' "$entrada" | python3 -c '
import json, re, sys

try:
    datos = json.load(sys.stdin)
except Exception:
    sys.exit(0)

cmd = datos.get("tool_input", {}).get("command", "") or ""

# Shells que EJECUTAN lo que les llega por la entrada estándar. Importa para
# los heredoc: `cat > f <<FIN` escribe un fichero, pero `bash <<FIN` ejecuta.
SHELLS = {"bash", "sh", "zsh", "dash", "ksh", "csh", "tcsh", "fish"}

# Opciones globales que se comen el siguiente argumento.
GIT_CON_VALOR = {"-C", "-c", "--exec-path", "--git-dir", "--work-tree", "--namespace"}
GH_CON_VALOR  = {"-R", "--repo", "--hostname"}

# Verbos de `gh` que solo LEEN. Todo lo que no esté aquí se considera escritura.
GH_LECTURA = {
    "list", "view", "status", "diff", "checks", "checkout", "search",
    "browse", "download", "clone", "watch", "logs", "help", "version",
    "completion",
}

# Del lado seguro: se enumeran los métodos que LEEN, y cualquier otro bloquea.
# Enumerar los de escritura dejaba pasar dos cosas: un método inventado, y un
# `-X` que se comía el endpoint como si fuera el método (`gh api -X repos/o/r`).
METODOS_LECTURA = {"GET", "HEAD", "OPTIONS"}

# Envoltorios que pasan argv tal cual al siguiente comando, con las opciones
# de cada uno que se comen el argumento siguiente. Sin esto,
# `GH_REPO=o/r gh pr merge 1` no se veía: el primer token era la asignación.
#
# `bash`, `sh` y `zsh` NO están aquí a propósito: esos no pasan argv tal cual,
# y lo suyo ya lo cubre el escaneo de cadenas entrecomilladas.
ENVOLTORIOS = {
    "env":     {"-u", "--unset"},
    "sudo":    {"-u", "--user", "-g", "--group", "-p", "--prompt", "-C"},
    "nice":    {"-n", "--adjustment"},
    "xargs":   {"-I", "-i", "-L", "-n", "-P", "-s", "-E", "-d", "-a",
                "--replace", "--max-lines", "--max-args", "--max-procs",
                "--max-chars", "--delimiter", "--eof", "--arg-file"},
    "stdbuf":  {"-i", "-o", "-e", "--input", "--output", "--error"},
    "nohup":   set(),
    "time":    set(),
    "command": set(),
    "builtin": set(),
    "exec":    set(),
    "setsid":  set(),
}

REALES = ("git", "gh", "git-push")


def desenvolver(piezas):
    """Quita asignaciones y envoltorios hasta dar con el ejecutable real."""
    i, hubo_envoltorio = 0, False
    while i < len(piezas):
        p = piezas[i]
        if re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", p):        # VAR=valor
            i += 1
            continue
        nombre = p.rsplit("/", 1)[-1]
        if nombre in ENVOLTORIOS:
            hubo_envoltorio = True
            con_valor = ENVOLTORIOS[nombre]
            i += 1
            while i < len(piezas) and piezas[i].startswith("-"):
                i += 2 if piezas[i] in con_valor else 1
            continue
        break

    resto = piezas[i:]

    # Red de seguridad. Si tras un envoltorio no hemos aterrizado en git/gh,
    # puede ser que una opción suya llevara un valor que no está en la tabla
    # —`nice -n 10 git push`, `xargs -I {} gh pr merge {}`—. Se busca el primer
    # git/gh que quede. Cuesta algún falso positivo (`nice -n 10 echo git`),
    # que es el lado bueno del error.
    if hubo_envoltorio and (not resto or resto[0].rsplit("/", 1)[-1] not in REALES):
        for j, p in enumerate(resto):
            if p.rsplit("/", 1)[-1] in REALES:
                return resto[j:]
    return resto


def sin_opciones(piezas, con_valor):
    """Tokens que no son opciones, en orden."""
    fuera, i = [], 0
    while i < len(piezas):
        p = piezas[i]
        if p in con_valor:
            i += 2
            continue
        if p.startswith("-"):
            i += 1
            continue
        fuera.append(p)
        i += 1
    return fuera


def api_escribe(piezas):
    """Motivo si este `gh api` escribe, o None si es un GET.

    Hay que cubrir las formas pegadas y con `=`, no solo las separadas:
    `-XPOST` y `-fbody=x` se colaban enteros por comparar con igualdad exacta.
    """
    for i, p in enumerate(piezas):
        # Método: -X POST · -XPOST · --method POST · --method=POST
        if p in ("-X", "--method"):
            valor = piezas[i + 1] if i + 1 < len(piezas) else ""
        elif p.startswith("--method="):
            valor = p.split("=", 1)[1]
        elif p.startswith("-X"):
            valor = p[2:]
        else:
            valor = None
        if valor is not None and valor.upper() not in METODOS_LECTURA:
            return "gh api metodo " + (valor.upper() if valor else "sin valor")

        # Campos: -f x=y · -fx=y · -F… · --field… · --raw-field… · --input…
        # `gh api` documenta que el método pasa a POST en cuanto hay
        # parámetros, así que cualquiera de estas formas es escritura.
        if re.match(r"^(-[fF]|--field|--raw-field|--input)", p):
            return "gh api con campos"
    return None


def clasificar(trozo):
    """(clase, motivo) del fragmento, o None si no publica."""
    piezas = desenvolver(trozo.split())
    if not piezas:
        return None
    ejecutable = piezas[0].rsplit("/", 1)[-1]

    # ---- git ----
    if ejecutable in ("git", "git-push"):
        if ejecutable == "git-push":
            es_push = True
        else:
            resto = sin_opciones(piezas[1:], GIT_CON_VALOR)
            es_push = bool(resto) and resto[0] == "push"
        if not es_push:
            return None
        # `--no-verify` existe para no ejecutar los hooks, y `pre-push` es la
        # única capa que protege este clon fuera de esta rama.
        if "--no-verify" in piezas:
            return ("push-no-verify", "git push --no-verify")
        # El ensayo no toca el remoto, pero TAMPOCO llega a completarse con la
        # guarda puesta: comprobado que git ejecuta `pre-push` también en
        # `--dry-run`. Si además hubiera un vale emitido, esa puerta se lo
        # comería sin publicar nada. Así que se frena aquí, que es donde se
        # puede explicar, en vez de dejarlo fallar más abajo.
        #
        # En `gh` no hay exención de ninguna clase: la ayuda de `gh pr create`
        # dice que su `--dry-run` "may still push git changes".
        if "--dry-run" in piezas:
            return ("push-dry-run", "git push --dry-run")
        return ("push", "git push")

    # ---- gh ----
    if ejecutable == "gh":
        # `--help` imprime la ayuda y no ejecuta el verbo. Se mira AQUÍ, antes
        # de `sin_opciones`, que es donde se lo comía por empezar con guion.
        #
        # Sólo `--help`, nunca `-h`: en `gh auth login` el corto está tomado
        # por `--hostname`. Tratarlo como ayuda abriría un agujero.
        if "--help" in piezas:
            return None

        resto = sin_opciones(piezas[1:], GH_CON_VALOR)
        if not resto:
            return None                       # `gh` a secas imprime la ayuda

        if resto[0] == "api":
            m = api_escribe(piezas)
            return ("gh", m) if m else None

        # `gh <grupo> <verbo>` o `gh <verbo>`
        if any(t in GH_LECTURA for t in resto[:2]):
            return None
        return ("gh", "gh " + " ".join(resto[:2]))

    return None


# ---------------------------------------------------------------------------
# Heredoc: depende de QUIÉN lo recibe
#
# `cat > f <<FIN … FIN` escribe un fichero que MENCIONA el comando, y eso no es
# ejecutarlo. Pero `bash <<FIN … FIN` lo EJECUTA, y ahí el cuerpo es tan real
# como cualquier otro fragmento. Borrarlos todos por igual dejaba pasar una
# publicación entera.
#
# Así que se mira el comando que abre cada heredoc: si es una shell, el cuerpo
# se guarda para clasificarlo; si no, se descarta como hasta ahora.
# ---------------------------------------------------------------------------
cuerpos = []


def _heredoc(m):
    inicio = m.string.rfind("\n", 0, m.start()) + 1
    cabecera = m.string[inicio:m.start()]
    piezas = desenvolver(cabecera.split())
    ejecutable = piezas[0].rsplit("/", 1)[-1] if piezas else ""
    if ejecutable in SHELLS:
        cuerpos.append(m.group(0))
    return " "


cmd = re.sub(r"<<-?\s*[\x27\"]?(\w+)[\x27\"]?.*?^\s*\1\s*$", _heredoc, cmd,
             flags=re.S | re.M)


def anidados(texto, vueltas=6):
    """Lo que va dentro de paréntesis o comillas invertidas.

    La shell ejecuta `$(…)`, `` `…` ``, `<(…)` y hasta un `(…)` suelto ANTES
    que el comando que los envuelve, así que `echo "$(gh pr merge 1)"` publica
    igual. Mirando solo el primer token no se veía: era `$(gh`.
    """
    fuera, pendiente = [], [texto]
    for _ in range(vueltas):
        nuevos = []
        for t in pendiente:
            nuevos += re.findall(r"\(([^()]*)\)", t)
            nuevos += re.findall(r"`([^`]*)`", t)
        nuevos = [n for n in nuevos if n.strip()]
        if not nuevos:
            break
        fuera += nuevos
        pendiente = nuevos
    return fuera


# Se examina el comando entero Y el contenido de cada cadena entrecomillada:
# ahí se esconde un `bash -c "git push"`, que si no pasa porque su primer token
# es `bash`. El precio es que un `echo` del comando también se bloquea.
#
# NO se deduplica: contar de más bloquea de más, y contar de menos publica de
# más. Dos `gh pr comment` idénticos son dos escrituras.
candidatos = [cmd] + cuerpos
candidatos += re.findall(r"\x27([^\x27]*)\x27", cmd)
candidatos += re.findall(r"\"([^\"]*)\"", cmd)
for base in list(candidatos):
    candidatos += anidados(base)

for texto in candidatos:
    for trozo in re.split(r"[;&|\n]+", texto):
        trozo = trozo.strip()
        c = clasificar(trozo)
        if c:
            limpio = re.sub(r"[|\n\r]+", " ", trozo).strip()[:200]
            print(c[0] + "|" + c[1] + "|" + limpio)
' 2>/dev/null)

[ -n "$operaciones" ] || exit 0

cuantas=$(printf '%s\n' "$operaciones" | grep -c .)

# ---- `--no-verify`: se salta la puerta de git. No hay vale que lo salve ----
if printf '%s\n' "$operaciones" | grep -q '^push-no-verify|'; then
  cat >&2 <<'FIN'
BLOQUEADO — `--no-verify` se salta la puerta de git.

Esa opción existe para no ejecutar los hooks, y `.git/hooks/pre-push` es la
única capa que protege este clon fuera de la rama de la guarda. Aquí no hay
otros hooks de pre-push que justifiquen saltársela.

Quita la opción y vuelve a intentarlo. El vale no cambia nada: esto no es
falta de permiso, es una vía que no se usa.
FIN
  exit 2
fi

# ---- El ensayo no llega a completarse con la guarda puesta ----
# Se mira antes que el recuento sólo si es lo único que hay: si además viene un
# `gh` de escritura detrás, lo que importa es el otro mensaje.
if [ "$cuantas" -eq 1 ] && printf '%s\n' "$operaciones" | grep -q '^push-dry-run|'; then
  cat >&2 <<'FIN'
BLOQUEADO — `git push --dry-run` no llega a completarse con la guarda puesta.

Git ejecuta `pre-push` también en los ensayos —comprobado—, así que la puerta
de git lo frenaría igual unos pasos más abajo. Y si hubiera un vale emitido, se
lo comería sin publicar nada.

Para ver qué saldría, sin tocar el remoto ni gastar el vale:

    git log  --oneline @{upstream}..HEAD
    git diff --stat    @{upstream}..HEAD
FIN
  exit 2
fi

# ---- Más de una publicación en el mismo comando ----
if [ "$cuantas" -ge 2 ]; then
  {
    echo "BLOQUEADO — el comando lleva $cuantas operaciones de publicación."
    echo
    printf '%s\n' "$operaciones" | nl -w3 -s'. ' | while IFS= read -r linea; do
      echo "  ${linea#*|*|}"
    done
    cat <<'FIN'

Un vale autoriza UNA. Esta capa se ejecuta una sola vez por comando: si
pasara, se ejecutarían todas con un solo permiso.

Sepáralas en comandos distintos y autoriza cada una.
FIN
  } >&2
  exit 2
fi

clase=${operaciones%%|*}
sinclase=${operaciones#*|}
que=${sinclase%%|*}
fragmento=${sinclase#*|}

# ---------------------------------------------------------------------------
# El vale
#
# Vive SIEMPRE en el worktree principal, para que esta capa y la de git miren
# el mismo fichero. `--show-toplevel` no sirve: desde un worktree devuelve el
# worktree, y entonces son dos ficheros distintos.
#
# Se valida contra el HEAD del worktree EN CURSO, que es el commit que se va a
# publicar. No se acepta el de otros worktrees: un vale de un worktree no debe
# autorizar un `gh pr merge` que no tiene nada que ver.
# ---------------------------------------------------------------------------
raiz=$(git worktree list --porcelain 2>/dev/null | sed -n '1s/^worktree //p')
[ -n "$raiz" ] || raiz=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
vale="$raiz/.claude/push-autorizado"
sha=$(git rev-parse HEAD 2>/dev/null)

if [ -f "$vale" ]; then
  autorizado=$(head -n1 "$vale" | tr -d '[:space:]')
  reciente=$(find "$vale" -mmin "-$MINUTOS_VALIDO" 2>/dev/null)

  if [ "$autorizado" = "$sha" ] && [ -n "$reciente" ]; then
    if [ "$clase" = "push" ]; then
      # NO se consume aquí. Un `git push` cruza DOS puertas —esta y
      # `.git/hooks/pre-push`— y si esta lo borrase, la segunda lo encontraría
      # vacío: haría falta autorizar dos veces el mismo push. Lo consume la
      # puerta de git, que es la última y la que de verdad llega al remoto.
      echo "Vale válido para ${sha:0:7} · $que — lo consumirá .git/hooks/pre-push" >&2
    else
      # Un `gh` de escritura no pasa por ningún hook de git: aquí o nunca.
      rm -f "$vale"
      echo "Vale consumido para ${sha:0:7} · $que" >&2
    fi
    exit 0
  fi

  rm -f "$vale"                         # inválido: se destruye, no se reintenta

  if [ "$autorizado" != "$sha" ]; then
    cat >&2 <<FIN
BLOQUEADO ($que) — el vale no corresponde a este commit.

  Vale emitido para : ${autorizado:0:7}
  HEAD actual       : ${sha:0:7}

Han entrado commits nuevos desde que se autorizó, o el vale se emitió desde
otro worktree. Se autorizó ESE diff, no el de ahora: hay que volver a enseñar
lo que sale y pedir permiso otra vez.
FIN
    exit 2
  fi

  cat >&2 <<FIN
BLOQUEADO ($que) — el vale ha caducado (más de $MINUTOS_VALIDO minutos).

Vuelve a enseñar lo pendiente y pide autorización otra vez.
FIN
  exit 2
fi

# ---- Sin vale: parar y contar qué se iba a publicar ----
rama=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
upstream=$(git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null)

if [ -n "$upstream" ]; then
  rango="$upstream..HEAD"
  origen="frente a $upstream"
else
  base=$(git merge-base HEAD main 2>/dev/null || echo "")
  rango="${base:+$base..}HEAD"
  origen="rama sin upstream — comparada con main"
fi

commits=$(git log --oneline "$rango" 2>/dev/null | head -20)
recuento=$(git rev-list --count "$rango" 2>/dev/null || echo "?")
resumen=$(git diff --stat "$rango" 2>/dev/null | tail -25)
sucio=$(git status --short 2>/dev/null | head -10)

{
  echo "BLOQUEADO — publicar en GitHub requiere autorización literal del owner."
  echo
  echo "Operación frenada: $que"
  # El comando literal importa: un `gh pr merge 1 -R otro/repo` se autorizaría
  # a ciegas si aquí solo pusiera "gh pr merge".
  echo "Comando exacto:    $fragmento"
  echo "Rama:              $rama  ($origen)"
  echo
  echo "COMMITS PENDIENTES ($recuento):"
  echo "${commits:-  (ninguno)}"
  echo
  echo "DIFF QUE SALDRÍA:"
  echo "${resumen:-  (sin cambios)}"
  if [ -n "$sucio" ]; then
    echo
    echo "AVISO — hay cambios sin commitear que NO saldrían:"
    echo "$sucio"
  fi
  cat <<'FIN'

QUÉ TIENE QUE HACER EL ASISTENTE AHORA:

  1. PARAR. No reintentar ni buscar otra vía para llegar a GitHub.
  2. Enseñar al owner los commits y el diff de arriba.
  3. Pedir autorización y ESPERAR una respuesta literal:
     "push" · "sube" · "go push" · o equivalente inequívoco.

  Un "adelante", un "vale" o un "sigue" dichos sobre otra cosa NO valen.
  Si no llega esa palabra, no sale nada.

  Con el go literal en la mano se emite el vale —el SHA de HEAD escrito en
  `.claude/push-autorizado`— y se repite la operación. Un solo uso, caduca en
  15 minutos, atado al commit exacto. Ver `.claude/hooks/README.md`.
FIN
} >&2

exit 2
