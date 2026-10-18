#!/usr/bin/env python3
"""
github_upload.py - Upload a project folder to a NEW GitHub repository, safely.

What it does:
  1. Asks for: project folder, repo name, public/private, GitHub token.
  2. Adds a security block to .gitignore (.env, keys, certificates, databases, ...).
  3. Scans every file that would be uploaded for secrets (API keys, passwords,
     private keys, DB connection strings) and big files (>95 MB).
  4. Lets you exclude flagged files, shows a summary, asks for confirmation.
  5. Creates the repo on GitHub, commits, and pushes.

Requirements: Python 3.7+ and git. No extra packages.
The token is NEVER saved to disk or into the git remote URL.

Run:  python github_upload.py
"""

import base64
import getpass
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.github.com"
MARK_BEGIN = "# >>> github_upload.py security block >>>"
MARK_END = "# <<< github_upload.py security block <<<"

IGNORE_BLOCK = f"""{MARK_BEGIN}
# Secrets & credentials
.env
.env.*
!.env.example
*.env
*.pem
*.key
*.p12
*.pfx
*.jks
*.keystore
*.crt
*.cer
id_rsa*
id_ed25519*
id_dsa*
*.ppk
.npmrc
.pypirc
.netrc
.htpasswd
secrets.*
secret.*
credentials*
*credentials.json
service-account*.json
serviceAccount*.json
firebase-adminsdk*.json
google-services.json
GoogleService-Info.plist
terraform.tfstate*
*.tfvars
.aws/
.ssh/
.gnupg/
.kube/

# Databases, dumps, backups
*.sqlite
*.sqlite3
*.db
*.sql
*.dump
*.bak
*.backup
*.old

# Logs & temp
*.log
logs/
tmp/
temp/
.cache/

# Dependencies & build output
node_modules/
vendor/
bower_components/
__pycache__/
*.pyc
.venv/
venv/
env/
dist/
build/
.next/
.nuxt/
.parcel-cache/
coverage/

# OS / editor junk
.DS_Store
Thumbs.db
desktop.ini
.idea/
.vscode/
*.swp
{MARK_END}
"""

SECRET_PATTERNS = [
    ("Private key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED )?PRIVATE KEY")),
    ("AWS access key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b")),
    ("GitHub fine-grained token", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{40,}\b")),
    ("Stripe live key", re.compile(r"\b[sr]k_live_[0-9a-zA-Z]{16,}\b")),
    ("OpenAI/Anthropic-style key", re.compile(r"\bsk-(?:ant-)?[A-Za-z0-9_\-]{32,}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b")),
    ("Slack token", re.compile(r"\bxox[baprs]-[0-9A-Za-z\-]{10,}\b")),
    ("DB connection string with password",
     re.compile(r"(?i)\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|amqps?)://[^\s:@/]+:[^\s@/]+@")),
    ("Hard-coded password/secret/token",
     re.compile(r"""(?i)\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\b\s*[:=]\s*['"][^'"\s]{8,}['"]""")),
]

MAX_SCAN_BYTES = 2 * 1024 * 1024      # don't scan files bigger than 2 MB
MAX_FILE_BYTES = 95 * 1024 * 1024     # GitHub rejects files > 100 MB


# ----------------------------------------------------------------- helpers
def die(msg):
    print(f"\nERROR: {msg}")
    sys.exit(1)


def ask(prompt, default=None):
    suffix = f" [{default}]" if default else ""
    val = input(f"{prompt}{suffix}: ").strip()
    return val or (default or "")


def ask_yes_no(prompt, default=True):
    d = "Y/n" if default else "y/N"
    val = input(f"{prompt} [{d}]: ").strip().lower()
    if not val:
        return default
    return val in ("y", "yes")


def git(args, cwd, check=True, extra=None):
    cmd = ["git"] + (extra or []) + args
    p = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if check and p.returncode != 0:
        die(f"'git {' '.join(args)}' failed:\n{p.stderr.strip() or p.stdout.strip()}")
    return p


def git_list(args, cwd):
    p = git(args + ["-z"], cwd)
    return [x for x in p.stdout.split("\0") if x]


def gh(method, path, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "github-upload-script",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read().decode() or "{}")
        except Exception:
            payload = {}
        return e.code, payload
    except urllib.error.URLError as e:
        die(f"Cannot reach GitHub: {e.reason}")


def looks_binary(chunk):
    return b"\0" in chunk


def scan_file(path):
    """Return list of finding names for a file."""
    try:
        size = path.stat().st_size
        if size == 0 or size > MAX_SCAN_BYTES:
            return []
        raw = path.read_bytes()
        if looks_binary(raw[:2048]):
            return []
        text = raw.decode("utf-8", errors="ignore")
    except OSError:
        return []
    found = []
    for name, rx in SECRET_PATTERNS:
        if rx.search(text):
            found.append(name)
    return found


def add_to_gitignore(root, rel_paths, header):
    gi = root / ".gitignore"
    existing = gi.read_text(encoding="utf-8", errors="ignore") if gi.exists() else ""
    lines = [f"\n# {header}"] + ["/" + p for p in rel_paths]
    with open(gi, "a", encoding="utf-8", newline="\n") as f:
        if existing and not existing.endswith("\n"):
            f.write("\n")
        f.write("\n".join(lines) + "\n")


def candidate_files(root):
    """Files that would end up in the commit (tracked + untracked, not ignored)."""
    tracked = set(git_list(["ls-files"], root))
    untracked = set(git_list(["ls-files", "--others", "--exclude-standard"], root))
    return sorted(tracked | untracked), tracked


# -------------------------------------------------------------------- main
def main():
    print("=== Upload project to GitHub ===\n")

    if subprocess.run(["git", "--version"], capture_output=True).returncode != 0:
        die("git is not installed. Install it from https://git-scm.com/downloads and run again.")

    # --- token
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if not token:
        print("You need a GitHub token (one time):")
        print("  https://github.com/settings/tokens/new  ->  tick the 'repo' scope  ->  Generate")
        token = getpass.getpass("Paste token here (hidden while typing): ").strip()
    if not token:
        die("No token provided.")

    status, me = gh("GET", "/user", token)
    if status != 200:
        die("GitHub rejected the token (wrong, expired, or missing the 'repo' scope).")
    login = me["login"]
    print(f"Logged in as: {login}\n")

    # --- inputs
    folder = ask("Project folder path", os.getcwd())
    root = Path(folder.strip('"').strip("'")).expanduser().resolve()
    if not root.is_dir():
        die(f"Folder not found: {root}")

    default_name = re.sub(r"[^A-Za-z0-9._-]+", "-", root.name).strip("-.") or "my-project"
    repo = ask("Repository name", default_name)
    repo = re.sub(r"[^A-Za-z0-9._-]+", "-", repo).strip("-")
    if not repo:
        die("Invalid repository name.")
    private = ask("Visibility: public or private?", "public").lower().startswith("pri")
    description = ask("Short description (optional)", "")

    # --- security: .gitignore
    gi = root / ".gitignore"
    existing_gi = gi.read_text(encoding="utf-8", errors="ignore") if gi.exists() else ""
    if MARK_BEGIN not in existing_gi:
        with open(gi, "a", encoding="utf-8", newline="\n") as f:
            if existing_gi and not existing_gi.endswith("\n"):
                f.write("\n")
            f.write(("\n" if existing_gi else "") + IGNORE_BLOCK)
        print("\n[+] Security block added to .gitignore")
    else:
        print("\n[=] .gitignore already has the security block")

    # --- git init
    fresh = not (root / ".git").exists()
    if fresh:
        git(["init", "-q"], root)
        git(["symbolic-ref", "HEAD", "refs/heads/main"], root)
        print("[+] git repository initialised")

    # --- scan
    print("[*] Scanning files for secrets and oversized files...")
    files, tracked = candidate_files(root)
    flagged = {}   # rel -> [reasons]
    too_big = []
    for rel in files:
        p = root / rel
        if not p.is_file():
            continue
        try:
            if p.stat().st_size > MAX_FILE_BYTES:
                too_big.append(rel)
                continue
        except OSError:
            continue
        if rel == ".gitignore":
            continue
        hits = scan_file(p)
        if hits:
            flagged[rel] = hits

    to_exclude = list(too_big)
    if too_big:
        print(f"\n[!] {len(too_big)} file(s) over 95 MB (GitHub limit is 100 MB) - excluded automatically:")
        for f in too_big:
            print("    -", f)

    if flagged:
        print(f"\n[!] {len(flagged)} file(s) look like they contain secrets:")
        for rel, reasons in flagged.items():
            print(f"    - {rel}   ({', '.join(reasons)})")
        print("\nWhat to do with them?")
        print("  [Y] exclude all of them (recommended)")
        print("  [n] upload all of them anyway")
        print("  [c] choose one by one")
        choice = ask("Choice", "Y").lower()
        if choice.startswith("c"):
            for rel in flagged:
                if ask_yes_no(f"  Exclude '{rel}'?", True):
                    to_exclude.append(rel)
        elif not choice.startswith("n"):
            to_exclude.extend(flagged.keys())

    extra_pat = ask("\nAny other files/folders to exclude? (comma-separated, Enter to skip)", "")
    for item in [x.strip().strip("/\\") for x in extra_pat.split(",") if x.strip()]:
        to_exclude.append(item.replace("\\", "/"))

    if to_exclude:
        to_exclude = sorted(set(to_exclude))
        add_to_gitignore(root, to_exclude, "Excluded by github_upload.py")
        # make sure none of them stay tracked from earlier history
        for rel in to_exclude:
            git(["rm", "-r", "--cached", "--ignore-unmatch", "-q", "--", rel], root, check=False)
        print(f"[+] {len(to_exclude)} path(s) added to .gitignore")

    # --- summary
    final_files, _ = candidate_files(root)
    final_files = [f for f in final_files if (root / f).is_file()]
    if not final_files:
        die("Nothing to upload (all files are ignored).")
    print(f"\n=== Summary ===")
    print(f"Repository : {login}/{repo}  ({'PRIVATE' if private else 'PUBLIC'})")
    print(f"Folder     : {root}")
    print(f"Files      : {len(final_files)} will be uploaded")
    for f in final_files[:25]:
        print("   ", f)
    if len(final_files) > 25:
        print(f"    ... and {len(final_files) - 25} more")
    if not private:
        print("\nREMINDER: the repository is PUBLIC - everyone on the internet can see these files.")
    if not fresh:
        print("\nNOTE: this folder already had git history. Old commits may still contain secrets.")
    if not ask_yes_no("\nProceed with upload?", True):
        die("Cancelled. Nothing was uploaded (only .gitignore was updated).")

    # --- create the repo
    status, info = gh("GET", f"/repos/{login}/{repo}", token)
    if status == 200:
        print(f"\n[=] Repository {login}/{repo} already exists.")
        if not ask_yes_no("Push into the existing repository?", False):
            die("Cancelled. Choose a different repository name and run again.")
    else:
        body = {"name": repo, "private": private, "description": description, "auto_init": False}
        status, info = gh("POST", "/user/repos", token, body)
        if status not in (200, 201):
            msg = info.get("message", "unknown error")
            die(f"Could not create repository ({status}): {msg}")
        print(f"\n[+] Repository created: {info['html_url']}")

    remote_url = f"https://github.com/{login}/{repo}.git"
    if git(["remote", "get-url", "origin"], root, check=False).returncode == 0:
        git(["remote", "set-url", "origin", remote_url], root)
    else:
        git(["remote", "add", "origin", remote_url], root)

    # --- commit
    git(["add", "-A"], root)
    if git(["status", "--porcelain"], root).stdout.strip():
        ident = []
        if not git(["config", "user.name"], root, check=False).stdout.strip():
            ident += ["-c", f"user.name={me.get('name') or login}"]
        if not git(["config", "user.email"], root, check=False).stdout.strip():
            ident += ["-c", f"user.email={login}@users.noreply.github.com"]
        git(["commit", "-q", "-m", "Initial commit"], root, extra=ident)
        print("[+] Commit created")
    else:
        print("[=] Nothing new to commit")

    # --- push (token passed only for this command, never stored)
    branch = git(["rev-parse", "--abbrev-ref", "HEAD"], root).stdout.strip() or "main"
    auth = base64.b64encode(f"x-access-token:{token}".encode()).decode()
    print("[*] Pushing to GitHub...")
    git(["push", "-u", "origin", branch], root,
        extra=["-c", f"http.extraheader=AUTHORIZATION: basic {auth}"])

    print(f"\nDone!  https://github.com/{login}/{repo}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(1)