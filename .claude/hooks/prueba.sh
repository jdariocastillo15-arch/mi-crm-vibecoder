#!/usr/bin/env bash
#
# Matriz de la guarda. Tres bloques:
#
#   1. DETECCIÓN — a la capa de Claude se le pasa el comando tal como se lo
#      pasaría Claude Code, y se comprueba si bloquea y POR QUÉ.
#   2. CICLO DEL VALE en la capa de Claude — además del código de salida se
#      comprueba si el vale sigue o se ha consumido.
#   3. CICLO COMPLETO de `.githooks/pre-push`, con refs por la entrada estándar.
#
# AVISO: los bloques 2 y 3 escriben vales REALES durante unos milisegundos.
# Hay un `trap` que los borra pase lo que pase, pero no ejecutes esto en mitad
# de un push.

RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$RAIZ" || exit 1

GUARDA="$RAIZ/.claude/hooks/guarda-push.sh"
PREPUSH="$RAIZ/.githooks/pre-push"
VALE="$RAIZ/.claude/push-autorizado"
CEROS=0000000000000000000000000000000000000000
SHA=$(git rev-parse HEAD)
OTRO=0123456789abcdef0123456789abcdef01234567

trap 'rm -f "$VALE"' EXIT INT TERM

fallos=0
total=0

# Empaqueta el comando como se lo entrega Claude Code al hook.
entrada() {
  python3 -c '
import json, sys
print(json.dumps({"tool_name": "Bash", "tool_input": {"command": sys.argv[1]}}))
' "$1"
}

# probar <pasa|BLOQUEA> <descripción> <comando> [texto esperado en la salida]
#
# El cuarto argumento importa más de lo que parece: sin él, "bloqueó por llevar
# dos publicaciones" y "bloqueó por falta de vale" son indistinguibles.
probar() {
  local esperado="$1" descripcion="$2" comando="$3" texto="${4:-}"
  local codigo real salida
  total=$((total + 1))
  salida=$(entrada "$comando" | bash "$GUARDA" 2>&1)
  codigo=$?
  real="pasa"; [ "$codigo" -ne 0 ] && real="BLOQUEA"

  if [ "$real" != "$esperado" ]; then
    printf '  FALLO esperaba %s, dio %s  ·  %s\n' "$esperado" "$real" "$descripcion"
    fallos=$((fallos + 1)); return
  fi
  if [ -n "$texto" ] && ! printf '%s' "$salida" | grep -qF -- "$texto"; then
    printf '  FALLO %s pero sin «%s»  ·  %s\n' "$real" "$texto" "$descripcion"
    fallos=$((fallos + 1)); return
  fi
  printf '  ok    %-8s  %s\n' "$real" "$descripcion"
}

# probar_vale <pasa|BLOQUEA> <sigue|borrado> <descripción> <comando> <sha del vale>
probar_vale() {
  local esperado="$1" vale_esperado="$2" descripcion="$3" comando="$4" sha_vale="$5"
  local codigo real real_vale
  total=$((total + 1))
  printf '%s' "$sha_vale" > "$VALE"
  entrada "$comando" | bash "$GUARDA" >/dev/null 2>&1
  codigo=$?
  real="pasa"; [ "$codigo" -ne 0 ] && real="BLOQUEA"
  real_vale="sigue"; [ -f "$VALE" ] || real_vale="borrado"
  rm -f "$VALE"

  if [ "$real" = "$esperado" ] && [ "$real_vale" = "$vale_esperado" ]; then
    printf '  ok    %-8s vale %-8s %s\n' "$real" "$real_vale" "$descripcion"
  else
    printf '  FALLO esperaba %s/%s, dio %s/%s  ·  %s\n' \
      "$esperado" "$vale_esperado" "$real" "$real_vale" "$descripcion"
    fallos=$((fallos + 1))
  fi
}

# probar_prepush <pasa|BLOQUEA> <sigue|borrado> <descripción> <stdin> <sha del vale o vacío>
probar_prepush() {
  local esperado="$1" vale_esperado="$2" descripcion="$3" refs="$4" sha_vale="$5"
  local codigo real real_vale
  total=$((total + 1))
  if [ -n "$sha_vale" ]; then printf '%s' "$sha_vale" > "$VALE"; else rm -f "$VALE"; fi
  printf '%s\n' "$refs" | bash "$PREPUSH" origin git@github.com:o/r.git >/dev/null 2>&1
  codigo=$?
  real="pasa"; [ "$codigo" -ne 0 ] && real="BLOQUEA"
  real_vale="sigue"; [ -f "$VALE" ] || real_vale="borrado"
  rm -f "$VALE"

  if [ "$real" = "$esperado" ] && [ "$real_vale" = "$vale_esperado" ]; then
    printf '  ok    %-8s vale %-8s %s\n' "$real" "$real_vale" "$descripcion"
  else
    printf '  FALLO esperaba %s/%s, dio %s/%s  ·  %s\n' \
      "$esperado" "$vale_esperado" "$real" "$real_vale" "$descripcion"
    fallos=$((fallos + 1))
  fi
}

echo "── git · debe DEJAR PASAR ──"
probar pasa    "rama con la palabra en el nombre"    'git checkout -b jdariocastillo15/guarda-de-push'
probar pasa    "heredoc que MENCIONA el comando"     "$(printf 'cat > f <<%sFIN%s\nse hace git push -u origin x\nFIN\n' "'" "'")"
probar pasa    "lectura normal"                      'git log --oneline -5'
probar pasa    "commit"                              'git commit -m "arregla el push del formulario"'

echo "── git · debe BLOQUEAR ──"
probar BLOQUEA "push pelado"                         'git push'
probar BLOQUEA "push con destino"                    'git push -u origin mi-rama'
probar BLOQUEA "detrás de un cd"                     'cd /tmp/repo && git push'
probar BLOQUEA "con opción global -C"                'git -C /otro/sitio push origin main'
probar BLOQUEA "envuelto en bash -c"                 'bash -c "git push --force"'
probar BLOQUEA "ruta absoluta al binario"            '/usr/bin/git push origin main'

echo "── gh · debe DEJAR PASAR (lectura) ──"
probar pasa    "listar PR"                           'gh pr list --state open'
probar pasa    "ver un PR"                           'gh pr view 1 --json state'
probar pasa    "diff de un PR"                       'gh pr diff 2'
probar pasa    "estado"                              'gh pr status'
probar pasa    "traerse un PR en local"              'gh pr checkout 5'
probar pasa    "seguir una ejecución de CI"          'gh run watch'
probar pasa    "estado de la sesión"                 'gh auth status'
probar pasa    "clonar"                              'gh repo clone jdariocastillo15-arch/mi-crm-vibecoder'
probar pasa    "api de lectura (GET)"                'gh api repos/owner/repo/pulls'

echo "── gh · debe BLOQUEAR (escritura) ──"
probar BLOQUEA "abrir un PR"                         'gh pr create --title x --body y'
probar BLOQUEA "abrir PR con --repo delante"         'gh --repo owner/repo pr create --title x'
probar BLOQUEA "mergear"                             'gh pr merge 1 --squash'
probar BLOQUEA "comentar en un PR"                   'gh pr comment 1 --body hola'
probar BLOQUEA "editar un PR"                        'gh pr edit 1 --add-label bug'
probar BLOQUEA "publicar una release"                'gh release create v1.0.0'
probar BLOQUEA "sincronizar el repo"                 'gh repo sync'
probar BLOQUEA "api con método de escritura"         'gh api -X POST repos/owner/repo/issues'
probar BLOQUEA "api con campos"                      'gh api repos/owner/repo -f name=z'
probar BLOQUEA "verbo desconocido, lado seguro"      'gh pr inventado-manana'

echo "── defectos 1, 4 y 12 · el ensayo ──"
probar BLOQUEA "el ensayo tampoco llega de punta a punta" \
       'git push --dry-run origin main' 'no llega a completarse'
probar BLOQUEA "ensayo de git + merge de gh: son dos" \
       'git push --dry-run origin main && gh pr merge 1 --merge' '2 operaciones'
probar BLOQUEA "el mismo par, al revés" \
       'gh pr merge 1 && git push --dry-run' '2 operaciones'
probar BLOQUEA "gh pr create --dry-run: puede empujar igual" 'gh pr create --dry-run --title x'
probar BLOQUEA "gh pr merge --dry-run"                       'gh pr merge 1 --dry-run'
probar BLOQUEA "ensayo + push de verdad detrás" \
       'git push --dry-run && git push' '2 operaciones'

echo "── defecto 13 · heredoc que SE EJECUTA ──"
probar BLOQUEA "bash <<EOF con un merge dentro" \
       "$(printf 'bash <<%sEOF%s\ngh pr merge 1 --merge\nEOF\n' "'" "'")" 'gh pr merge'
probar BLOQUEA "sh <<EOF con un push dentro" \
       "$(printf 'sh <<%sEOF%s\ngit push -u origin x\nEOF\n' "'" "'")"
probar BLOQUEA "zsh, sin comillas en la etiqueta" \
       "$(printf 'zsh <<EOF\ngh release create v1\nEOF\n' )"
probar pasa    "tee de un fichero: sigue siendo texto" \
       "$(printf 'tee f <<%sFIN%s\ngit push -u origin x\nFIN\n' "'" "'")"

echo "── defecto 15 · el comando fuera de la posición 0 ──"
probar BLOQUEA "agrupación con llaves"         '{ gh pr merge 1 --merge; }'      'gh pr merge'
probar BLOQUEA "dentro de un if"               'if true; then gh pr merge 1 --merge; fi'
probar BLOQUEA "dentro de un for"              'for p in 1; do gh pr merge $p --merge; done'
probar BLOQUEA "dentro de un while"            'while true; do git push; done'
probar BLOQUEA "dentro de un case"             'case x in a) gh pr merge 1;; esac'
probar BLOQUEA "negado con !"                  '! gh pr merge 1'
probar BLOQUEA "eval"                          'eval gh pr merge 1'
probar BLOQUEA "envoltorio que nadie previó"   'envoltorio-inventado git push'
probar BLOQUEA "sudo -u foo: el límite que se cierra" 'sudo -u foo git push'

echo "── defecto 16 · quién recibe el heredoc ──"
probar BLOQUEA "cd && bash <<EOF" \
       "$(printf 'cd /tmp && bash <<%sEOF%s\ngh pr merge 1 --merge\nEOF\n' "'" "'")" 'gh pr merge'
probar BLOQUEA "then bash <<EOF" \
       "$(printf 'if true; then bash <<%sEOF%s\ngit push -u origin x\nEOF\nfi\n' "'" "'")"
probar BLOQUEA "bash -s <<EOF" \
       "$(printf 'bash -s <<%sEOF%s\ngh pr merge 1 --merge\nEOF\n' "'" "'")"
probar pasa    "cd && cat <<FIN sigue siendo texto" \
       "$(printf 'cd /tmp && cat > f <<%sFIN%s\ngit push -u origin x\nFIN\n' "'" "'")"

echo "── defecto 17 · metacaracteres pegados al comando ──"
probar BLOQUEA "case sin espacio tras el paréntesis" 'case x in x)gh pr merge 1 --merge;;esac' 'gh pr merge'
probar BLOQUEA "case sin espacio, con git"          'case x in x)git push;;esac'
probar BLOQUEA "llaves pegadas"                     '{gh pr merge 1;}'
probar BLOQUEA "paréntesis pegado"                  '(gh pr merge 1)'
probar BLOQUEA "alias en línea con ! pegado"        'git -c alias.m="!gh pr merge 1 --merge" m' 'gh pr merge'
probar BLOQUEA "heredoc dentro de un case" \
       "$(printf 'case x in x) bash <<%sEOF%s\ngh pr merge 1 --merge\nEOF\n;; esac\n' "'" "'")" 'gh pr merge'
probar pasa    "un ! que no esconde nada"           '[ ! -f x ] && git log --oneline'
probar pasa    "redirección normal"                 'git log --oneline > /tmp/x'
probar pasa    "comprobar si gh está instalado"     'which gh'
probar pasa    "lo mismo en una sustitución"        'echo "$(which gh)"'
probar pasa    "command -v en una sustitución"      'test -n "$(command -v git)"'
probar pasa    "lectura de gh dentro de un subshell" '(gh pr list --state open)'

echo "── defecto 18 · espacios escapados y comillas de relleno ──"
probar BLOQUEA "bash -c con espacios escapados"  'bash -c gh\ pr\ merge\ 1\ --merge' 'gh pr merge'
probar BLOQUEA "sh -c con espacios escapados"    'sh -c gh\ pr\ merge\ 1\ --merge'
probar BLOQUEA "alias en línea escapado"         'git -c alias.m=!gh\ pr\ merge\ 1\ --merge m' 'gh pr merge'
probar BLOQUEA "barra dentro del nombre"         'g\h pr merge 1'
probar BLOQUEA "comillas vacías de relleno"      'g""h pr merge 1'
probar BLOQUEA "comillas partiendo el nombre"    'g"h" pr merge 1'
probar BLOQUEA "push con el nombre escapado"     'gi\t push'
probar pasa    "ruta con espacios escapados"     'git add mi\ fichero.txt'
probar pasa    "cd a una ruta con espacios"      'cd /ruta/con\ espacios && git log --oneline'

echo "── el precio del barrido, comprobado a propósito ──"
probar pasa    "mensaje que menciona «el push»"  'git commit -m "arregla el push del formulario"'
probar BLOQUEA "mensaje que menciona el verbo"   'git commit -m "arregla el gh pr merge"'

echo "── defecto 14 · sustitución de comando y subshells ──"
probar BLOQUEA 'sustitución con $( )'          'echo "$(gh pr merge 1 --merge)"'  'gh pr merge'
probar BLOQUEA "comillas invertidas"           'echo `gh pr merge 1`'
probar BLOQUEA "subshell suelto"               '(gh pr merge 1)'
probar BLOQUEA "sustitución anidada"           'echo "$(echo $(git push))"'
probar BLOQUEA "sustitución de proceso"        'diff <(gh pr merge 1) f'
probar pasa    "sustitución inocente: rev-parse" 'printf "%s" "$(git rev-parse HEAD)" > /tmp/x'
probar pasa    "paréntesis en un mensaje"      'git commit -m "arregla (el push) del formulario"'

echo "── defectos 2 y 5 · un vale, una publicación ──"
probar BLOQUEA "dos escrituras distintas"      'gh pr merge 1 && gh pr edit 2'         '2 operaciones'
probar BLOQUEA "dos escrituras IDÉNTICAS"      'gh pr comment 1 --body hola && gh pr comment 1 --body hola' '2 operaciones'
probar BLOQUEA "tres seguidas"                 'gh pr merge 1 ; gh pr edit 2 ; gh pr close 3' '3 operaciones'
probar BLOQUEA "echo del comando: el precio documentado" 'echo "git push" && git push' '2 operaciones'
probar BLOQUEA "un PR normal NO se infla a 2"  'gh pr create --title "algo" --body "otro"' 'COMMITS PENDIENTES'

echo "── defecto 7 · prefijos y envoltorios ──"
probar BLOQUEA "asignación delante"            'GH_REPO=o/r gh pr merge 1'
probar BLOQUEA "dos asignaciones"              'FOO=1 BAR=2 git push'
probar BLOQUEA "env"                           'env gh pr merge 1'
probar BLOQUEA "env con -u"                    'env -u GIT_DIR git push'
probar BLOQUEA "command"                       'command git push'
probar BLOQUEA "sudo"                          'sudo git push'
probar BLOQUEA "nice con -n 10"                'nice -n 10 git push'
probar BLOQUEA "xargs con -I {}"               'xargs -I {} gh pr merge {}'
probar BLOQUEA "envoltorio + asignación"       'env GH_TOKEN=x gh release create v1'

echo "── defecto 3 · gh api en todas sus formas ──"
probar BLOQUEA "método pegado -XPOST"          'gh api -XPOST repos/o/r/issues'
probar BLOQUEA "método con = "                 'gh api --method=POST repos/o/r'
probar BLOQUEA "método separado en minúscula"  'gh api -X delete repos/o/r'
probar BLOQUEA "campo pegado -fbody=x"         'gh api repos/o/r -fbody=x'
probar BLOQUEA "campo pegado -Fbody=x"         'gh api repos/o/r -Fbody=x'
probar BLOQUEA "--input con = "                'gh api repos/o/r --input=fichero.json'
probar BLOQUEA "-X se come el endpoint como método" 'gh api -X repos/o/r'
probar BLOQUEA "método inventado"              'gh api -X FUSIONAR repos/o/r'
probar pasa    "-X GET sí es lectura"          'gh api -X GET repos/o/r'

echo "── defectos 10 y 11 · ayuda y --no-verify ──"
probar pasa    "la ayuda de un verbo de escritura"   'gh pr merge --help'
probar pasa    "la ayuda de pr create"               'gh pr create --help'
probar pasa    "la ayuda general"                    'gh --help'
probar BLOQUEA "--help entrecomillado como valor"    'gh pr create --title "--help"'
probar BLOQUEA "--no-verify pelado"                  'git push --no-verify'          'no-verify'
probar BLOQUEA "--no-verify con destino"             'git push --no-verify origin main' 'no-verify'

echo "── el informe enseña el comando exacto ──"
probar BLOQUEA "el destino -R sale en el informe"    'gh pr merge 1 -R otro/repo'    '-R otro/repo'

echo "── ciclo del vale · capa de Claude ──"
probar_vale pasa    sigue   "git push NO consume: lo hará pre-push"  'git push'              "$SHA"
probar_vale pasa    borrado "gh de escritura sí consume"             'gh pr create -t x'     "$SHA"
probar_vale BLOQUEA sigue   "--no-verify: el vale no lo salva"       'git push --no-verify'  "$SHA"
probar_vale BLOQUEA borrado "vale de otro commit: se destruye"       'git push'              "$OTRO"

echo "── ciclo completo · .githooks/pre-push con refs por stdin ──"
probar_prepush pasa    borrado "una ref con el SHA autorizado" \
  "refs/heads/x $SHA refs/heads/x $CEROS" "$SHA"
probar_prepush BLOQUEA borrado "dos refs, una con otro SHA" \
  "refs/heads/x $SHA refs/heads/x $CEROS
refs/heads/y $OTRO refs/heads/y $CEROS" "$SHA"
probar_prepush BLOQUEA borrado "dos refs con el MISMO SHA autorizado" \
  "refs/heads/x $SHA refs/heads/x $CEROS
refs/heads/y $SHA refs/heads/y $CEROS" "$SHA"
probar_prepush BLOQUEA borrado "vale de otro commit" \
  "refs/heads/x $SHA refs/heads/x $CEROS" "$OTRO"
probar_prepush BLOQUEA borrado "borrado de rama (SHA a ceros)" \
  "(delete) $CEROS refs/heads/x $SHA" "$SHA"
probar_prepush BLOQUEA borrado "sin vale" \
  "refs/heads/x $SHA refs/heads/x $CEROS" ""

echo
echo "$total casos"
if [ "$fallos" -eq 0 ]; then echo "TODOS EN VERDE"; else echo "$fallos FALLO(S)"; exit 1; fi
