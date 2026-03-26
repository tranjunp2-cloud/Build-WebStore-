#!/usr/bin/env python3
"""
sync-do-envs.py — Auto-sync GitHub Secrets to DigitalOcean App env vars.

Usage (called from CI):
  python3 .github/scripts/sync-do-envs.py <app-name>

Reads secret values from environment variables (set via GitHub Secrets in CI),
patches the DO app spec, and updates via doctl — so env vars are always
in sync before each staging deploy. No manual DO Dashboard edits needed.

Required env on the runner (from GitHub Secrets):
  DIGITALOCEAN_ACCESS_TOKEN — DO API token (already used by deploy action)

Secret vars to sync (must exist in GitHub Secrets → repo → staging env):
  PAYLOAD_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, OPENAI_API_KEY,
  S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
  LARK_APP_ID, LARK_APP_SECRET, LARK_ENCRYPT_KEY,
  LARK_VERIFICATION_TOKEN, LARK_BOT_OPEN_ID,
  GH_BOT_TOKEN, MAIL_USERNAME, MAIL_PASSWORD,
  ECH_DISTRIBUTION_API_URL, ECH_DISTRIBUTION_API_KEY
"""

import json
import os
import subprocess
import sys


# Map: DO app env key → GitHub Secret env var name on runner
# For secrets that conflict with built-in GHA vars, we use a different name.
SECRET_MAP = {
    "PAYLOAD_SECRET":                  "PAYLOAD_SECRET",
    "STRIPE_SECRET_KEY":               "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET":           "STRIPE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "OPENAI_API_KEY":                  "OPENAI_API_KEY",
    "S3_ENDPOINT":                     "S3_ENDPOINT",
    "S3_ACCESS_KEY_ID":                "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY":            "S3_SECRET_ACCESS_KEY",
    "LARK_APP_ID":                     "LARK_APP_ID",
    "LARK_APP_SECRET":                 "LARK_APP_SECRET",
    "LARK_ENCRYPT_KEY":                "LARK_ENCRYPT_KEY",
    "LARK_VERIFICATION_TOKEN":         "LARK_VERIFICATION_TOKEN",
    "LARK_BOT_OPEN_ID":                "LARK_BOT_OPEN_ID",
    # GHA has a built-in GITHUB_TOKEN — use GH_BOT_TOKEN for our Lark bot's PAT
    "GITHUB_TOKEN":                    "GH_BOT_TOKEN",
    "MAIL_USERNAME":                   "MAIL_USERNAME",
    "MAIL_PASSWORD":                   "MAIL_PASSWORD",
    "ECH_DISTRIBUTION_API_URL":        "ECH_DISTRIBUTION_API_URL",
    "ECH_DISTRIBUTION_API_KEY":        "ECH_DISTRIBUTION_API_KEY",
}


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    print(f"$ {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, **kwargs)
    if result.returncode != 0:
        print(f"STDERR: {result.stderr}", file=sys.stderr)
        sys.exit(result.returncode)
    return result


def get_app_id(app_name: str) -> str:
    result = run(["doctl", "apps", "list", "--format", "ID,Spec.Name", "--no-header"])
    for line in result.stdout.strip().splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[1] == app_name:
            print(f"✅ Found app '{app_name}' → ID: {parts[0]}")
            return parts[0]
    print(f"❌ App '{app_name}' not found. Available apps:", file=sys.stderr)
    print(result.stdout, file=sys.stderr)
    sys.exit(1)


def get_app_spec(app_id: str) -> dict:
    result = run(["doctl", "apps", "spec", "get", app_id])
    return json.loads(result.stdout)


def patch_envs(spec: dict) -> tuple[dict, list[str], list[str]]:
    """Inject secret values into the spec. Returns (patched_spec, updated_keys, skipped_keys)."""
    updated, skipped = [], []

    for service in spec.get("services", []):
        if service.get("name") != "web":
            continue

        env_list = service.get("envs", [])
        env_index = {e["key"]: i for i, e in enumerate(env_list)}

        for do_key, runner_env in SECRET_MAP.items():
            value = os.getenv(runner_env, "")
            if not value:
                skipped.append(f"{do_key} (env var {runner_env!r} is empty)")
                continue

            if do_key in env_index:
                # Update existing entry: set value, keep as SECRET (encrypted at rest)
                entry = env_list[env_index[do_key]]
                entry["value"] = value
                entry["type"] = "SECRET"
                updated.append(do_key)
            else:
                # Key declared in SECRET_MAP but not yet in spec — add it
                env_list.append({"key": do_key, "value": value, "type": "SECRET"})
                updated.append(f"{do_key} (added)")

        service["envs"] = env_list

    return spec, updated, skipped


def update_app(app_id: str, spec: dict) -> None:
    spec_json = json.dumps(spec)
    result = subprocess.run(
        ["doctl", "apps", "update", app_id, "--spec", "-"],
        input=spec_json,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"❌ doctl apps update failed:\n{result.stderr}", file=sys.stderr)
        sys.exit(result.returncode)
    print("✅ DO app spec updated successfully.")


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: sync-do-envs.py <app-name>", file=sys.stderr)
        sys.exit(1)

    app_name = sys.argv[1]

    print(f"🔄 Syncing env vars → DO app '{app_name}'...")
    app_id   = get_app_id(app_name)
    spec     = get_app_spec(app_id)
    spec, updated, skipped = patch_envs(spec)

    if updated:
        print(f"📦 Updating {len(updated)} secret(s): {', '.join(updated)}")
        update_app(app_id, spec)
    else:
        print("⚠️  No secrets to update (all runner env vars are empty — check GitHub Secrets).")

    if skipped:
        print(f"⚠️  Skipped {len(skipped)} (empty/missing): {', '.join(skipped)}")

    print("✅ Env sync complete.")


if __name__ == "__main__":
    main()
