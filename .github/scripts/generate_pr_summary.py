#!/usr/bin/env python3
"""
SALBAR Monorepo - Automated PR Summary Generator
Generates a structured PR summary detecting affected monorepo subsystems,
commit history, and file diffs. If GEMINI_API_KEY is configured in GitHub
Secrets, it queries Google Gemini to provide an architectural impact summary.
"""

import os
import subprocess
import sys
import json
import urllib.request
import urllib.error

DELIMITER_START = "<!-- SALBAR_AUTOMATED_PR_SUMMARY_START -->"
DELIMITER_END = "<!-- SALBAR_AUTOMATED_PR_SUMMARY_END -->"

MONOREPO_SUBSYSTEMS = {
    "apps/mobile": ("📱 Mobile App", "Resident-facing offline-first Android app & BLE/Cloud relay"),
    "apps/web-dashboard": ("🖥️ Web Dashboard", "Incident Commander GIS map & HITL authorization"),
    "apps/cloud-relay": ("☁️ Cloud Relay", "Direct internet ingestion endpoint"),
    "services/backend": ("⚙️ Coordination Backend", "Central pipeline coordinator & database persistence"),
    "services/dispatcher-engine": ("🧮 Dispatcher Engine", "Google OR-Tools solver (fatigue & road uncertainty)"),
    "services/nlp-classifier": ("🧠 NLP Classifier", "Multilingual Transformer (EN / TL / CEB / code-switching)"),
    "services/serial-bridge": ("🔌 Serial Bridge", "Host PC <-> Gateway LoRa serial interface"),
    "firmware/field-terminal": ("📡 Field Terminal", "ESP32 TTGO T-Beam firmware (LoRa mesh, Kalman filter, BLE)"),
    "firmware/gateway": ("🗼 LoRa Gateway", "LilyGO TTGO LoRa32 gateway firmware"),
    "firmware/shared": ("💾 Firmware Shared", "Binary structs, message types & CRC utilities"),
    "packages/protocol": ("📦 Protocol Package", "Shared cross-platform data schemas"),
    "packages/config": ("🛠️ Config Package", "Shared linting, formatting & configs"),
    "docs": ("📚 Thesis Docs", "Academic manuscripts, circuit diagrams & flowcharts"),
    "tools": ("🧪 Tools & Simulators", "Mesh simulators, GPS jitter rigs & benchmarks"),
}


def run_cmd(cmd):
    """Executes a shell command and returns stdout."""
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=False)
    return res.stdout.strip()


def get_git_info(base_ref):
    """Retrieves changed files, commits, and diff stat against base branch."""
    # Ensure origin base is fetched
    run_cmd(f"git fetch origin {base_ref} --depth=50")
    
    # Target git range
    target_range = f"origin/{base_ref}...HEAD"
    
    changed_files = run_cmd(f"git diff --name-only {target_range}").splitlines()
    changed_files = [f.strip() for f in changed_files if f.strip()]
    
    diff_stat = run_cmd(f"git diff --stat {target_range}")
    raw_diff = run_cmd(f"git diff {target_range} -U2")
    
    # Truncate raw diff for API safety (max 25,000 characters)
    if len(raw_diff) > 25000:
        raw_diff = raw_diff[:25000] + "\n...[diff truncated for length]..."
        
    commits = run_cmd(f'git log origin/{base_ref}..HEAD --pretty=format:"* %h - %s (%an)"').splitlines()
    commits = [c.strip() for c in commits if c.strip()]
    
    return changed_files, diff_stat, raw_diff, commits


def detect_subsystems(changed_files):
    """Detects which monorepo components are affected."""
    affected = {}
    for file in changed_files:
        matched = False
        for prefix, (name, desc) in MONOREPO_SUBSYSTEMS.items():
            if file.startswith(prefix):
                if prefix not in affected:
                    affected[prefix] = {"name": name, "desc": desc, "count": 0}
                affected[prefix]["count"] += 1
                matched = True
                break
        if not matched:
            root_key = "root/misc"
            if root_key not in affected:
                affected[root_key] = {"name": "🔧 Root / Tooling", "desc": "Repository configs, CI/CD, and root files", "count": 0}
            affected[root_key]["count"] += 1
            
    return affected


def generate_gemini_summary(api_key, diff_stat, raw_diff, commits, affected_subsystems):
    """Invokes Google Gemini API to produce an architectural summary."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    
    subsystems_str = ", ".join([v["name"] for v in affected_subsystems.values()])
    
    prompt = f"""You are the automated CI/CD PR reviewer for SALBAR (System for Allocation and LoRa-Linked Barangay Assessment and Response).
SALBAR is an infrastructure-independent disaster response coordination platform combining:
- ESP32 TTGO T-Beam LoRa mesh field terminals with GPS Kalman filtering & BLE offline report ingestion
- LilyGO TTGO LoRa32 gateway with serial connection to host
- Central coordination backend orchestrating multi-source ingestion
- Fine-tuned Multilingual Transformer (English, Tagalog, Cebuano, code-switched text)
- Google OR-Tools optimization engine (stochastic routing under road uncertainty and responder fatigue)
- Constrained Propose-Only AI Agent for situation briefings
- Human-in-the-Loop (HITL) Operator Web Dashboard
- Offline-first resident Android mobile application

Review the following pull request diff and commits:

AFFECTED SUBSYSTEMS:
{subsystems_str}

DIFF STAT:
{diff_stat}

COMMITS:
{chr(10).join(commits[:20])}

RAW DIFF PREVIEW:
{raw_diff}

Generate a concise, professional GitHub pull request summary formatted in Markdown with:
1. ### 🚀 Executive Overview (1-3 sentences highlighting the core purpose of this PR)
2. ### 🔍 Key Subsystem Updates (bullet points explaining what was changed and why)
3. ### ⚠️ Operational & Integration Notes (highlight any hardware, schema, network, or breaking changes if applicable)
4. ### 🧪 Recommended Verification (suggest 2-4 specific test drills or checks for reviewers)

Keep it direct, technical, and without fluff. Do not wrap in generic conversational greetings.
"""

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1024
        }
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            candidates = res_body.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "").strip()
    except Exception as e:
        print(f"Warning: Gemini API call failed: {e}. Falling back to deterministic summary.", file=sys.stderr)
        return None

    return None


def build_markdown_summary(gemini_summary, affected_subsystems, commits, diff_stat, changed_files):
    """Assembles the final markdown document."""
    lines = [
        DELIMITER_START,
        "## 🤖 Automated PR Summary & Monorepo Changelog",
        ""
    ]
    
    if gemini_summary:
        lines.append(gemini_summary)
        lines.append("")
        lines.append("---")
        lines.append("### 🗺️ Monorepo Impact Matrix")
    else:
        lines.append("### 🗺️ Monorepo Impact Matrix")
        
    lines.append("| Subsystem | Component | Files Modified |")
    lines.append("| :--- | :--- | :---: |")
    for k, v in affected_subsystems.items():
        lines.append(f"| **{v['name']}** | {v['desc']} | `{v['count']}` |")
        
    lines.append("")
    lines.append("### 📝 Commits Included")
    if commits:
        for c in commits[:15]:
            lines.append(c)
        if len(commits) > 15:
            lines.append(f"*...and {len(commits) - 15} more commit(s)*")
    else:
        lines.append("_No new commits detected._")
        
    lines.append("")
    lines.append("<details>")
    lines.append("<summary>📊 Click to expand File Diff Statistics</summary>")
    lines.append("")
    lines.append("```text")
    lines.append(diff_stat if diff_stat else "No file changes detected.")
    lines.append("```")
    lines.append("</details>")
    lines.append("")
    lines.append(DELIMITER_END)
    
    return "\n".join(lines)


def update_pr_body(pr_number, new_summary_block):
    """Fetches existing PR body, updates or appends the summary block, and saves it."""
    # Read current PR body via gh CLI
    current_body = run_cmd(f"gh pr view {pr_number} --json body -q .body")
    
    if DELIMITER_START in current_body and DELIMITER_END in current_body:
        # Replace existing automated block
        before = current_body.split(DELIMITER_START)[0].rstrip()
        after = current_body.split(DELIMITER_END)[1].lstrip()
        updated_body = f"{before}\n\n{new_summary_block}\n\n{after}".strip()
    elif current_body.strip():
        # Append below author's original description
        updated_body = f"{current_body.strip()}\n\n---\n\n{new_summary_block}"
    else:
        # Empty body, use summary block directly
        updated_body = new_summary_block
        
    # Write to temp file to preserve newlines and quotes
    with open("temp_pr_body.md", "w", encoding="utf-8") as f:
        f.write(updated_body)
        
    run_cmd(f"gh pr edit {pr_number} --body-file temp_pr_body.md")
    if os.path.exists("temp_pr_body.md"):
        os.remove("temp_pr_body.md")
    print(f"Successfully updated PR #{pr_number} body.")


def main():
    base_ref = os.environ.get("BASE_REF", "develop")
    pr_number = os.environ.get("PR_NUMBER")
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    
    if not pr_number:
        print("Error: PR_NUMBER environment variable is required.", file=sys.stderr)
        sys.exit(1)
        
    changed_files, diff_stat, raw_diff, commits = get_git_info(base_ref)
    affected_subsystems = detect_subsystems(changed_files)
    
    gemini_summary = None
    if gemini_key:
        print("Querying Google Gemini for AI PR analysis...")
        gemini_summary = generate_gemini_summary(gemini_key, diff_stat, raw_diff, commits, affected_subsystems)
    else:
        print("GEMINI_API_KEY not found in environment. Generating deterministic monorepo matrix...")
        
    summary_block = build_markdown_summary(gemini_summary, affected_subsystems, commits, diff_stat, changed_files)
    update_pr_body(pr_number, summary_block)


if __name__ == "__main__":
    main()
