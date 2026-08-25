#!/usr/bin/env bash
# Matriz de la guarda: cada caso se le pasa al hook tal como se lo pasaría
# Claude Code, y se comprueba si bloquea (código != 0) o deja pasar.
cd "/Users/dariocastillo/Documents/proyectos web/VIBE CRM - PRD" || exit 1
GUARDA=.claude/hooks/guarda-push.sh
fallos=0

probar() {
  local esperado="$1" descripcion="$2" comando="$3"
  local codigo real
  python3 -c '
import json, sys
print(json.dumps({"tool_name": "Bash", "tool_input": {"command": sys.argv[1]}}))
' "$comando" | bash "$GUARDA" >/dev/null 2>&1
  codigo=$?
  real="pasa"; [ "$codigo" -ne 0 ] && real="BLOQUEA"
  if [ "$real" = "$esperado" ]; then
    printf '  ok    %-8s  %s\n' "$real" "$descripcion"
  else
    printf '  FALLO esperaba %s, dio %s  ·  %s\n' "$esperado" "$real" "$descripcion"
    fallos=$((fallos + 1))
  fi
}

echo "── git · debe DEJAR PASAR ──"
probar pasa    "rama con la palabra en el nombre"    'git checkout -b jdariocastillo15/guarda-de-push'
probar pasa    "heredoc que menciona el comando"     "$(printf 'cat > f <<%sFIN%s\nse hace git push -u origin x\nFIN\n' "'" "'")"
probar pasa    "ensayo, no escribe en el remoto"     'git push --dry-run origin main'
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

echo
if [ "$fallos" -eq 0 ]; then echo "TODOS EN VERDE"; else echo "$fallos FALLO(S)"; fi
