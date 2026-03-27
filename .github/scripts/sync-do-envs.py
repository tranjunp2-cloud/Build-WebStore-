#!/usr/bin/env python3
"""
sync-do-envs.py — Auto-sync GitHub Secrets to DigitalOcean App env vars.

Usage (called from CI):
  python3 .github/scripts/sync-do-envs.py <app-name>

Uses DO REST API directly (not doctl CLI) to avoid YAML/JSON format issues.
"""

import json
import os
import subprocess
import sys
import urllib.request
import urllib.error


# Map: DO app env key → GitHub Secret env var name on runner
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
    "GITHUB_TOKEN":                    "GH_BOT_TOKEN",
    "MAIL_USERNAME":                   "MAIL_USERNAME",
    "MAIL_PASSWORD":                   "MAIL_PASSWORD",
    "ECH_DISTRIBUTION_API_URL":        "ECH_DISTRIBUTION_API_URL",
    "ECH_DISTRIBUTION_API_KEY":        "ECH_DISTRIBUTION_API_KEY",
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


def patch_envs(spec: dict) -> tuple[dict, list[str], list[str]]:
    """Inject secret values into the spec."""
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
                entry = env_list[env_index[do_key]]
                entry["value"] = value
                entry["type"] = "SECRET"
                updated.append(do_key)
            else:
                env_list.append({"key": do_key, "value": value, "type": "SECRET"})
                updated.append(f"{do_key} (added)")

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
