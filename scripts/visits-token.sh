#!/bin/zsh
# Jeton secret qui ouvre le journal des visites (VERDICT_VISITS_TOKEN), pour le propriétaire seulement.
#   zsh scripts/visits-token.sh            crée un jeton neuf, le range dans le trousseau macOS et le copie 60 s dans le
#                                          presse-papiers (rien ne s'affiche à l'écran)
#   zsh scripts/visits-token.sh --saisir   saisie masquée d'un jeton existant
#   zsh scripts/visits-token.sh --copier   recopie le jeton du trousseau dans le presse-papiers (60 s)
# Origine : Boite-a-outils/14-suivi-visites-demo/copies/visits-token.sh (19 oct. 2026), adapté à Verdict.
set -euo pipefail
SERVICE="verdict-visits"
ACCOUNT="verdict"

store() {
  # Passé à « security » par son entrée standard : le jeton n'apparaît jamais dans la liste des processus.
  print -r -- "add-generic-password -U -s $SERVICE -a $ACCOUNT -l \"Verdict visites\" -w $1" | security -i >/dev/null
}
clip() {
  print -rn -- "$1" | pbcopy
  ( sleep 60; [[ "$(pbpaste)" == "$1" ]] && print -n "" | pbcopy ) >/dev/null 2>&1 &!
}

case "${1:-}" in
  --saisir)
    print -n "Collez le jeton (rien ne s'affiche), puis Entrée : "
    read -rs TOKEN; print
    [[ ${#TOKEN} -ge 32 && "$TOKEN" =~ ^[A-Za-z0-9]+$ ]] || { print "Jeton refusé (32 caractères alphanumériques au moins)."; exit 1; }
    store "$TOKEN"
    print "Jeton rangé dans le trousseau (« $SERVICE »)."
    ;;
  --copier)
    TOKEN=$(security find-generic-password -s "$SERVICE" -a "$ACCOUNT" -w 2>/dev/null) || { print "Aucun jeton dans le trousseau : lancez ce script sans option."; exit 1; }
    clip "$TOKEN"
    print "Jeton copié (presse-papiers vidé dans 60 s)."
    ;;
  "")
    if security find-generic-password -s "$SERVICE" -a "$ACCOUNT" >/dev/null 2>&1; then
      print -n "Un jeton existe déjà. Le remplacer ? Il faudra aussi le changer sur l'hébergeur. [o/N] "
      read -r OK; [[ "$OK" == [oOyY]* ]] || { print "Rien n'a changé. (Pour le recopier : --copier)"; exit 0; }
    fi
    TOKEN=$(openssl rand -hex 32)
    store "$TOKEN"
    clip "$TOKEN"
    print "Jeton neuf rangé dans le trousseau (« $SERVICE ») et copié 60 s dans le presse-papiers."
    print "Le script de déploiement (scripts/deploy-vercel.sh) le pose tout seul sur l'hébergeur."
    ;;
  *) print "Options : (aucune) | --saisir | --copier"; exit 2 ;;
esac
