import argparse
import shutil
import sqlite3
import time
from pathlib import Path


DEFAULT_DATABASES = [
    "logs_2.sqlite",
    "state_5.sqlite",
    "goals_1.sqlite",
    "memories_1.sqlite",
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Optimize Codex SQLite state safely.")
    parser.add_argument("--codex-root", default=str(Path.home() / ".codex"))
    parser.add_argument("--log-file", default="")
    parser.add_argument("--remove-maintenance-backups", action="store_true")
    args = parser.parse_args()

    codex_root = Path(args.codex_root).resolve()
    log_file = Path(args.log_file).resolve() if args.log_file else codex_root / "sqlite-maintenance.log"
    lines: list[str] = [f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Codex SQLite maintenance started"]

    if args.remove_maintenance_backups:
        remove_maintenance_backups(codex_root, lines)

    for name in DEFAULT_DATABASES:
        optimize_database(codex_root / name, lines)

    lines.append(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Codex SQLite maintenance finished")
    log_file.parent.mkdir(parents=True, exist_ok=True)
    with log_file.open("a", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")

    print("\n".join(lines))
    return 0


def remove_maintenance_backups(codex_root: Path, lines: list[str]) -> None:
    backup_root = codex_root / "sqlite-maintenance-backups"
    if not backup_root.exists():
        return
    resolved = backup_root.resolve()
    if codex_root not in resolved.parents:
        raise RuntimeError(f"Unsafe backup path: {resolved}")
    size = sum(path.stat().st_size for path in resolved.rglob("*") if path.is_file())
    shutil.rmtree(resolved)
    lines.append(f"removed maintenance backups bytes={size}")


def optimize_database(database_path: Path, lines: list[str]) -> None:
    if not database_path.exists():
        lines.append(f"skip missing {database_path.name}")
        return

    before = database_path.stat().st_size
    try:
        connection = sqlite3.connect(str(database_path), timeout=5)
        connection.execute("PRAGMA busy_timeout=5000")
        journal_mode = connection.execute("PRAGMA journal_mode").fetchone()[0]
        checkpoint_before = safe_checkpoint(connection)
        safe_optimize(connection)
        connection.execute("VACUUM")
        checkpoint_after = safe_checkpoint(connection)
        connection.close()
        after = database_path.stat().st_size
        wal_size = sidecar_size(database_path, "-wal")
        lines.append(
            f"ok {database_path.name} journal={journal_mode} before={before} after={after} "
            f"wal={wal_size} saved={before - after} checkpoint_before={checkpoint_before} checkpoint_after={checkpoint_after}"
        )
    except sqlite3.OperationalError as error:
        lines.append(f"busy_or_locked {database_path.name}: {error}")
    except Exception as error:
        lines.append(f"failed {database_path.name}: {type(error).__name__}: {error}")


def safe_checkpoint(connection: sqlite3.Connection) -> str:
    try:
        return str(connection.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchall())
    except Exception as error:
        return f"skipped:{type(error).__name__}:{error}"


def safe_optimize(connection: sqlite3.Connection) -> None:
    try:
        connection.execute("PRAGMA optimize")
    except Exception:
        return


def sidecar_size(database_path: Path, suffix: str) -> int:
    sidecar = database_path.with_name(f"{database_path.name}{suffix}")
    return sidecar.stat().st_size if sidecar.exists() else 0


if __name__ == "__main__":
    raise SystemExit(main())
