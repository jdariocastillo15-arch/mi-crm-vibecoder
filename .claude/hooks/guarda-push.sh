#!/usr/bin/env bash
#
# Guarda de push — subir al remoto exige autorización literal del owner.
#
# Se engancha como hook `PreToolUse` de Bash: ve el comando ANTES de que se
# ejecute y lo frena si es un push. Frenarlo no es el objetivo; el objetivo es
# que el asistente PARE, enseñe lo que iba a subir y espere un "go" literal.
#
# La autorización es un vale de un solo uso, atado al commit exacto y con
# caducidad. Ver `.claude/hooks/README.md` para el alcance real de esta guarda.

set -uo pipefail

MINUTOS_VALIDO=15

entrada=$(cat)

# ---------------------------------------------------------------------------
# Detección
#
# La primera versión buscaba "git ... push" con una expresión suelta y se comió
# dos falsos positivos en cinco minutos: un heredoc que MENCIONABA el comando, y
# un `git checkout -b una-rama-con-push-en-el-nombre`. Así que aquí se hace bien:
# se parte el comando en trozos y se exige que `push` sea EL SUBCOMANDO, no una
# palabra que pase por ahí.
# ---------------------------------------------------------------------------
veredicto=$(printf '%s' "$entrada" | python3 -c '
import json, re, sys

try:
    datos = json.load(sys.stdin)
except Exception:
    print("no"); sys.exit(0)

cmd = datos.get("tool_input", {}).get("command", "") or ""

# Fuera los cuerpos de heredoc: escribir un fichero que MENCIONA el comando no
# es ejecutarlo. Las comillas NO se limpian, a propósito: un `bash -c "..."`
# tiene que seguir cayendo en la red.
cmd = re.sub(r"<<-?\s*[\x27\"]?(\w+)[\x27\"]?.*?^\s*\1\s*$", " ", cmd, flags=re.S | re.M)

# Opciones globales de git que se comen el siguiente argumento.
CON_VALOR = {"-C", "-c", "--exec-path", "--git-dir", "--work-tree", "--namespace"}

def es_push(trozo):
    piezas = trozo.split()
    if not piezas:
        return False
    ejecutable = piezas[0].rsplit("/", 1)[-1]
    if ejecutable == "git-push":
        return True
    if ejecutable != "git":
        return False
    i = 1
    while i < len(piezas):
        p = piezas[i]
        if p in CON_VALOR:
            i += 2
            continue
        if p.startswith("-"):
            i += 1
            continue
        break                      # primer token que no es opción: el subcomando
    return i < len(piezas) and piezas[i] == "push"

# Un --dry-run no escribe en el remoto.
if "--dry-run" in cmd:
    print("no"); sys.exit(0)

# Se examina el comando entero Y, aparte, el contenido de cada cadena
# entrecomillada: ahí es donde se esconde un `bash -c "git push"`, que de otro
# modo pasa porque su primer token es `bash`.
candidatos = [cmd]
candidatos += re.findall(r"\x27([^\x27]*)\x27", cmd)
candidatos += re.findall(r"\"([^\"]*)\"", cmd)

for texto in candidatos:
    for trozo in re.split(r"[;&|\n]+", texto):
        if es_push(trozo.strip()):
            print("si"); sys.exit(0)

print("no")
' 2>/dev/null)

[ "$veredicto" = "si" ] || exit 0

raiz=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
vale="$raiz/.claude/push-autorizado"
sha=$(git -C "$raiz" rev-parse HEAD 2>/dev/null)

# ---- ¿Hay vale válido? ----
if [ -f "$vale" ]; then
  autorizado=$(head -n1 "$vale" | tr -d '[:space:]')
  reciente=$(find "$vale" -mmin "-$MINUTOS_VALIDO" 2>/dev/null)

  if [ "$autorizado" = "$sha" ] && [ -n "$reciente" ]; then
    rm -f "$vale"                       # de un solo uso
    echo "Vale de push consumido para ${sha:0:7}." >&2
    exit 0
  fi

  rm -f "$vale"                         # inválido: se destruye, no se reintenta

  if [ "$autorizado" != "$sha" ]; then
    cat >&2 <<FIN
BLOQUEADO — el vale no corresponde a este commit.

  Vale emitido para : ${autorizado:0:7}
  HEAD actual       : ${sha:0:7}

Han entrado commits nuevos desde que se autorizó. Se autorizó ESE diff, no el
de ahora: hay que volver a enseñar lo que se sube y pedir permiso otra vez.
FIN
    exit 2
  fi

  cat >&2 <<FIN
BLOQUEADO — el vale ha caducado (más de $MINUTOS_VALIDO minutos).

Vuelve a enseñar lo pendiente y pide autorización otra vez.
FIN
  exit 2
fi

# ---- Sin vale: parar y contar qué se iba a subir ----
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
  echo "BLOQUEADO — subir al remoto requiere autorización literal del owner."
  echo
  echo "Rama: $rama  ($origen)"
  echo
  echo "COMMITS PENDIENTES DE SUBIR ($recuento):"
  echo "${commits:-  (ninguno)}"
  echo
  echo "DIFF QUE SE SUBIRÍA:"
  echo "${resumen:-  (sin cambios)}"
  if [ -n "$sucio" ]; then
    echo
    echo "AVISO — hay cambios sin commitear que NO se subirían:"
    echo "$sucio"
  fi
  cat <<'FIN'

QUÉ TIENE QUE HACER EL ASISTENTE AHORA:

  1. PARAR. No reintentar ni buscar otra vía para llegar al remoto.
  2. Enseñar al owner los commits y el diff de arriba.
  3. Pedir autorización y ESPERAR una respuesta literal:
     "push" · "sube" · "go push" · o equivalente inequívoco.

  Un "adelante", un "vale" o un "sigue" dichos sobre otra cosa NO valen.
  Si no llega esa palabra, no se sube.

  Con el go literal en la mano se emite el vale —el SHA de HEAD escrito en
  `.claude/push-autorizado`— y se repite la operación. Un solo uso, caduca en
  15 minutos, atado al commit exacto. Ver `.claude/hooks/README.md`.
FIN
} >&2

exit 2
