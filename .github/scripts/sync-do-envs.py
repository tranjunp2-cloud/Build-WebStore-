#!/usr/bin/env python3
"""
sync-do-envs.py — Auto-sync GitHub Secrets to DigitalOcean App env vars.

Usage (called from CI):
  python3 .github/scripts/sync-do-envs.py <app-name>

How it works:
  1. Reads ALL_SECRETS env var (JSON of all GitHub Secrets)
  2. Filters to only app-relevant keys (skips CI-only secrets like LARK_WEBHOOK_*)
  3. Syncs matching secrets to DO app as encrypted env vars

Adding a new env var:
  1. gh secret set MY_KEY --body "value"
  2. That's it! Script auto-syncs all secrets to DO on next deploy.
     Only CI-only secrets (webhooks, tokens for notifications) are excluded.
"""

import json
import os
import sys
import urllib.request
import urllib.error


# Secrets to SKIP — these are CI-only (notifications, testing) and not needed on DO app
CI_ONLY_SECRETS = {
    "DIGITALOCEAN_ACCESS_TOKEN",
    "BOT_NOTIFY_URL",
    "BOT_SECRET",
    "LARK_WEBHOOK_URL",
    "LARK_WEBHOOK_CI",
    "LARK_WEBHOOK_REPORT",
    "LARK_WEBHOOK_TASK",
    "LARK_SIGN_KEY",
    "LARK_SIGN_KEY_CI",
    "E2E_TEST_EMAIL",
    "E2E_TEST_PASSWORD",
    "GITHUB_TOKEN",  # Built-in GHA token, not app secret
}


def do_api(method: str, path: str, data: dict | None = None) -> dict:
    """Call DigitalOcean REST API. Always returns JSON."""
    token = os.getenv("DIGITALOCEAN_ACCESS_TOKEN", "")
    if not token:
        print("❌ DIGITALOCEAN_ACCESS_TOKEN not set", file=sys.stderr)
        sys.exit(1)

    url = f"https://api.digitalocean.com/v2{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method, headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"❌ DO API {method} {path} → {e.code}: {e.read().decode()[:300]}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"❌ DO API request failed: {e}", file=sys.stderr)
        sys.exit(1)


def get_app_id(app_name: str) -> str:
    """Find app ID by name using REST API."""
    data = do_api("GET", "/apps")
    for app in data.get("apps", []):
        if app.get("spec", {}).get("name") == app_name:
            app_id = app["id"]
            print(f"✅ Found app '{app_name}' → ID: {app_id}")
            return app_id
    print(f"❌ App '{app_name}' not found", file=sys.stderr)
    sys.exit(1)


def get_app_spec(app_id: str) -> dict:
    """Get app spec via REST API (always JSON)."""
    data = do_api("GET", f"/apps/{app_id}")
    spec = data.get("app", {}).get("spec", {})
    if not spec:
        print("❌ Empty spec returned from DO API", file=sys.stderr)
        sys.exit(1)
    return spec


def get_secrets_from_env() -> dict[str, str]:
    """Parse ALL_SECRETS JSON env var, filter out CI-only secrets."""
    raw = os.getenv("ALL_SECRETS", "{}")
    try:
        all_secrets = json.loads(raw)
    except json.JSONDecodeError:
        print("❌ Failed to parse ALL_SECRETS JSON", file=sys.stderr)
        sys.exit(1)

    # Filter: only app secrets, skip CI-only
    app_secrets = {}
    for key, value in all_secrets.items():
        if key in CI_ONLY_SECRETS:
            continue
        if not value or value == "***":
            continue
        app_secrets[key] = value

    return app_secrets


def patch_envs(spec: dict, secrets: dict[str, str]) -> tuple[dict, list[str], list[str]]:
    """Inject secret values into the spec."""
    updated, skipped = [], []

    services = spec.get("services", [])
    if not services:
        print("❌ No services found in app spec", file=sys.stderr)
        sys.exit(1)

    # Use first service (primary web app)
    service = services[0]
    env_list = service.get("envs", [])
    env_index = {e["key"]: i for i, e in enumerate(env_list)}

    for key, value in secrets.items():
        if key in env_index:
            entry = env_list[env_index[key]]
            entry["value"] = value
            entry["type"] = "SECRET"
            updated.append(key)
        else:
            env_list.append({"key": key, "value": value, "type": "SECRET", "scope": "RUN_AND_BUILD_TIME"})
            updated.append(f"{key} (added)")

    service["envs"] = env_list
    return spec, updated, skipped


def update_app(app_id: str, spec: dict) -> None:
    """Update app spec via REST API."""
    do_api("PUT", f"/apps/{app_id}", {"spec": spec})
    print("✅ DO app spec updated successfully.")


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: sync-do-envs.py <app-name>", file=sys.stderr)
        sys.exit(1)

    app_name = sys.argv[1]

    print(f"🔄 Syncing env vars → DO app '{app_name}'...")
    app_id = get_app_id(app_name)
    spec = get_app_spec(app_id)

    secrets = get_secrets_from_env()
    print(f"📦 Found {len(secrets)} app secret(s) to sync")

    spec, updated, skipped = patch_envs(spec, secrets)

    if updated:
        print(f"📦 Updating {len(updated)} secret(s): {', '.join(updated)}")
        update_app(app_id, spec)
    else:
        print("⚠️  No secrets to update.")

    print("✅ Env sync complete.")


if __name__ == "__main__":
    main()
