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
# La primera versión buscaba "git ... push" con una expresión suelta y se comió
# dos falsos positivos en cinco minutos: un heredoc que MENCIONABA el comando, y
# un `git checkout -b una-rama-con-push-en-el-nombre`. Así que aquí se hace bien:
# se trocea el comando y se mira QUÉ SUBCOMANDO es, no qué palabras contiene.
#
# Con `gh` el criterio es del lado seguro: lista blanca de verbos de LECTURA y
# todo lo demás bloquea. Un verbo nuevo que publique no se cuela por no estar
# previsto; como mucho molesta una lectura, y ampliar la lista es una línea.
# ---------------------------------------------------------------------------
veredicto=$(printf '%s' "$entrada" | python3 -c '
import json, re, sys

try:
    datos = json.load(sys.stdin)
except Exception:
    print("no"); sys.exit(0)

cmd = datos.get("tool_input", {}).get("command", "") or ""

# Fuera los cuerpos de heredoc: escribir un fichero que MENCIONA el comando no
# es ejecutarlo.
cmd = re.sub(r"<<-?\s*[\x27\"]?(\w+)[\x27\"]?.*?^\s*\1\s*$", " ", cmd, flags=re.S | re.M)

# Opciones globales que se comen el siguiente argumento.
GIT_CON_VALOR = {"-C", "-c", "--exec-path", "--git-dir", "--work-tree", "--namespace"}
GH_CON_VALOR  = {"-R", "--repo", "--hostname"}

# Verbos de `gh` que solo LEEN. Todo lo que no esté aquí se considera escritura.
GH_LECTURA = {
    "list", "view", "status", "diff", "checks", "checkout", "search",
    "browse", "download", "clone", "watch", "logs", "help", "version",
    "completion",
}

# `gh api` sin estas señales es un GET.
API_ESCRIBE = {"-X", "--method", "-f", "-F", "--field", "--raw-field", "--input"}
METODOS_ESCRITURA = {"POST", "PUT", "PATCH", "DELETE"}


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


def motivo(trozo):
    piezas = trozo.split()
    if not piezas:
        return None
    ejecutable = piezas[0].rsplit("/", 1)[-1]

    # ---- git ----
    if ejecutable == "git-push":
        return "git push"
    if ejecutable == "git":
        resto = sin_opciones(piezas[1:], GIT_CON_VALOR)
        if resto and resto[0] == "push":
            return "git push"
        return None

    # ---- gh ----
    if ejecutable == "gh":
        resto = sin_opciones(piezas[1:], GH_CON_VALOR)
        if not resto:
            return None                       # `gh` a secas imprime la ayuda

        if resto[0] == "api":
            for i, p in enumerate(piezas):
                if p in ("-X", "--method"):
                    if i + 1 < len(piezas) and piezas[i + 1].upper() in METODOS_ESCRITURA:
                        return "gh api " + piezas[i + 1].upper()
                elif p.split("=")[0] in API_ESCRIBE:
                    return "gh api con campos"
            return None                       # GET

        # `gh <grupo> <verbo>` o `gh <verbo>`
        if any(t in GH_LECTURA for t in resto[:2]):
            return None
        return "gh " + " ".join(resto[:2])

    return None


# Un --dry-run no escribe en el remoto.
if "--dry-run" in cmd:
    print("no"); sys.exit(0)

# Se examina el comando entero Y el contenido de cada cadena entrecomillada:
# ahí se esconde un `bash -c "git push"`, que si no pasa porque su primer token
# es `bash`.
candidatos = [cmd]
candidatos += re.findall(r"\x27([^\x27]*)\x27", cmd)
candidatos += re.findall(r"\"([^\"]*)\"", cmd)

for texto in candidatos:
    for trozo in re.split(r"[;&|\n]+", texto):
        m = motivo(trozo.strip())
        if m:
            print("si|" + m); sys.exit(0)

print("no")
' 2>/dev/null)

case "$veredicto" in
  si\|*) que="${veredicto#si|}" ;;
  *)     exit 0 ;;
esac

raiz=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
vale="$raiz/.claude/push-autorizado"
sha=$(git -C "$raiz" rev-parse HEAD 2>/dev/null)

# ---- ¿Hay vale válido? ----
if [ -f "$vale" ]; then
  autorizado=$(head -n1 "$vale" | tr -d '[:space:]')
  reciente=$(find "$vale" -mmin "-$MINUTOS_VALIDO" 2>/dev/null)

  if [ "$autorizado" = "$sha" ] && [ -n "$reciente" ]; then
    rm -f "$vale"                       # de un solo uso
    echo "Vale consumido para ${sha:0:7} · $que" >&2
    exit 0
  fi

  rm -f "$vale"                         # inválido: se destruye, no se reintenta

  if [ "$autorizado" != "$sha" ]; then
    cat >&2 <<FIN
BLOQUEADO ($que) — el vale no corresponde a este commit.

  Vale emitido para : ${autorizado:0:7}
  HEAD actual       : ${sha:0:7}

Han entrado commits nuevos desde que se autorizó. Se autorizó ESE diff, no el
de ahora: hay que volver a enseñar lo que sale y pedir permiso otra vez.
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
rama=$(git -C "$raiz" rev-parse --abbrev-ref HEAD 2>/dev/null)
upstream=$(git -C "$raiz" rev-parse --abbrev-ref '@{upstream}' 2>/dev/null)

if [ -n "$upstream" ]; then
  rango="$upstream..HEAD"
  origen="frente a $upstream"
else
  base=$(git -C "$raiz" merge-base HEAD main 2>/dev/null || echo "")
  rango="${base:+$base..}HEAD"
  origen="rama sin upstream — comparada con main"
fi

commits=$(git -C "$raiz" log --oneline "$rango" 2>/dev/null | head -20)
recuento=$(git -C "$raiz" rev-list --count "$rango" 2>/dev/null || echo "?")
resumen=$(git -C "$raiz" diff --stat "$rango" 2>/dev/null | tail -25)
sucio=$(git -C "$raiz" status --short 2>/dev/null | head -10)

{
  echo "BLOQUEADO — publicar en GitHub requiere autorización literal del owner."
  echo
  echo "Operación frenada: $que"
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
