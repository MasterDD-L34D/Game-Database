#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Uso: $(basename "$0") --repo <percorso_repo_evo> [--config <file_config>] [--dry-run]

Opzioni:
  --repo       Percorso locale al repository "Evo Tactics Pack MongoDB" (obbligatorio)
  --config     File di configurazione dei glob (default: scripts/ingest/evo-import.config.json)
  --dry-run    Esegue il parsing e gli upsert in modalità simulata senza scrivere sul DB
  --no-setup   Salta il comando npm run dev:setup (quando il database è già pronto)
USAGE
}

REPO=""
CONFIG="$(cd "$(dirname "$0")"/ingest && pwd)/evo-import.config.json"
DRY_RUN=""
RUN_SETUP=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --config)
      CONFIG="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="--dry-run"
      shift 1
      ;;
    --no-setup)
      RUN_SETUP=0
      shift 1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Argomento sconosciuto: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$REPO" ]]; then
  echo "Errore: specificare --repo" >&2
  usage
  exit 1
fi

if [[ ! -d "$REPO" ]]; then
  echo "Errore: la directory $REPO non esiste" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

pushd "$PROJECT_ROOT" >/dev/null

if [[ $RUN_SETUP -eq 1 ]]; then
  echo "[evo-pipeline] Esecuzione npm run dev:setup"
  npm run dev:setup
else
  echo "[evo-pipeline] Skip npm run dev:setup"
fi

CMD=(node scripts/ingest/import-taxonomy.js --repo "$REPO" --config "$CONFIG" --verbose)
if [[ -n "$DRY_RUN" ]]; then
  CMD+=(--dry-run)
fi

echo "[evo-pipeline] Esecuzione ${CMD[*]}"
"${CMD[@]}"

popd >/dev/null
