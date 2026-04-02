import urllib.request
import json
import os

token = os.environ.get('GH_TOKEN')
headers = {
    'Authorization': f'token {token}',
    'Accept': 'application/vnd.github.v3+json'
}

# React to general PR comments (Issue comments)
url = 'https://api.github.com/repos/primeproduction/ech-prime-web-v2/issues/412/comments'
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as response:
    comments = json.loads(response.read().decode())
    for c in comments:
        # User wants to dislike reviews not related to file changes
        # General comments are not tied to a file change.
        if "Chưa link issue" in c.get('body', '') or "Codex" in c.get('body', ''):
            print(f"Reacting -1 to issue comment {c['id']}")
            react_url = f"https://api.github.com/repos/primeproduction/ech-prime-web-v2/issues/comments/{c['id']}/reactions"
            req_react = urllib.request.Request(react_url, data=json.dumps({"content": "-1"}).encode(), headers=headers, method='POST')
            try: urllib.request.urlopen(req_react)
            except Exception as e: print(e)

# React to inline comments if they are not on our changed files
url = 'https://api.github.com/repos/primeproduction/ech-prime-web-v2/pulls/412/comments'
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as response:
    comments = json.loads(response.read().decode())
    valid_files = [
        "src/app/api/v1/sso/provision/route.ts",
        "src/app/api/v1/sso/reset-password/route.ts",
        "src/lib/auth.ts"
    ]
    for c in comments:
        if c.get('path') not in valid_files:
            print(f"Reacting -1 to inline comment {c['id']} on {c.get('path')}")
            react_url = f"https://api.github.com/repos/primeproduction/ech-prime-web-v2/pulls/comments/{c['id']}/reactions"
            req_react = urllib.request.Request(react_url, data=json.dumps({"content": "-1"}).encode(), headers=headers, method='POST')
            try: urllib.request.urlopen(req_react)
            except Exception as e: print(e)
