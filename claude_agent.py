import asyncio
import json
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AssistantMessage, ToolUseBlock, TextBlock, ResultMessage, create_sdk_mcp_server, tool
import subprocess
import os
from pathlib import Path

async def main():
    # Skills and CLAUDE.md are loaded automatically by Claude SDK from cwd
    # No manual instruction loading needed - the SDK reads:
    # - /home/user/app/CLAUDE.md (copied from SANDBOX_PROMPT.md)
    # - /home/user/app/.claude/skills/ (copied from sandbox_skills/)

    # ============================================================
    # HELPER: Sort apps by dependencies for LivingApps creation
    # ============================================================
    def sort_apps_by_dependencies(apps):
        """Sort apps so those without applookup dependencies come first."""
        dependencies = {}
        app_map = {}
        
        for app in apps:
            identifier = app["identifier"]
            app_map[identifier] = app
            dependencies[identifier] = set()
            
            for ctrl in app.get("controls", {}).values():
                if "applookup" in ctrl.get("fulltype", ""):
                    ref = ctrl.get("lookup_app_ref")
                    if ref:
                        dependencies[identifier].add(ref)
        
        # Topological sort (Kahn's algorithm)
        sorted_apps = []
        in_degree = {app_id: len(deps) for app_id, deps in dependencies.items()}
        queue = [app_id for app_id, degree in in_degree.items() if degree == 0]
        
        while queue:
            current = queue.pop(0)
            if current in app_map:
                sorted_apps.append(app_map[current])
            
            for app_id, deps in dependencies.items():
                if current in deps:
                    in_degree[app_id] -= 1
                    if in_degree[app_id] == 0:
                        queue.append(app_id)
        
        return sorted_apps if len(sorted_apps) == len(apps) else apps

    def run_git_cmd(cmd: str):
        """Executes a Git command and throws an error on failure"""
        print(f"[DEPLOY] Executing: {cmd}")
        result = subprocess.run(
            cmd,
            shell=True,
            cwd="/home/user/app",
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            raise Exception(f"Git Error ({cmd}): {result.stderr}")
        return result.stdout

    @tool("deploy_to_github",
    "Initializes Git, commits EVERYTHING, and pushes it to the configured repository. Use this ONLY at the very end.",
    {})
    async def deploy_to_github(args):
        try:
            run_git_cmd("git config --global user.email 'lilo@livinglogic.de'")
            run_git_cmd("git config --global user.name 'Lilo'")
            
            git_push_url = os.getenv('GIT_PUSH_URL')
            appgroup_id = os.getenv('REPO_NAME')
            livingapps_api_key = os.getenv('LIVINGAPPS_API_KEY')
            
            # Prüfe ob Repo existiert und übernehme .git History
            print("[DEPLOY] Prüfe ob Repo bereits existiert...")
            try:
                run_git_cmd(f"git clone {git_push_url} /tmp/old_repo")
                run_git_cmd("cp -r /tmp/old_repo/.git /home/user/app/.git")
                print("[DEPLOY] ✅ History vom existierenden Repo übernommen")
            except:
                # Neues Repo - von vorne initialisieren
                print("[DEPLOY] ✅ Neues Repo wird initialisiert")
                run_git_cmd("git init")
                run_git_cmd("git checkout -b main")
                run_git_cmd(f"git remote add origin {git_push_url}")
            
            # Mit HOME=/home/user/app schreibt das SDK direkt nach /home/user/app/.claude/
            # Kein Kopieren nötig! .claude ist bereits im Repo-Ordner.
            print("[DEPLOY] 💾 Session wird mit Code gepusht (HOME=/home/user/app)")
            
            # Session ID wird später von ResultMessage gespeichert
            # Hier nur prüfen ob .claude existiert
            check_result = subprocess.run(
                "ls /home/user/app/.claude 2>&1",
                shell=True,
                capture_output=True,
                text=True
            )
            if check_result.returncode == 0:
                print("[DEPLOY] ✅ .claude/ vorhanden - wird mit gepusht")
            else:
                print("[DEPLOY] ⚠️ .claude/ nicht gefunden")
            
            # Neuen Code committen (includes .claude/ direkt im Repo)
            run_git_cmd("git add -A")
            # Force add .claude (exclude debug/ - may contain secrets)
            subprocess.run("git add -f .claude ':!.claude/debug' .claude_session_id 2>/dev/null", shell=True, cwd="/home/user/app")
            run_git_cmd("git commit -m 'Lilo Auto-Deploy' --allow-empty")
            run_git_cmd("git push origin main")
            
            print("[DEPLOY] ✅ Push erfolgreich!")
            
            # Ab hier: Warte auf Dashboard und aktiviere Links
            if livingapps_api_key and appgroup_id:
                import httpx
                import time
                
                headers = {
                    "X-API-Key": livingapps_api_key,
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
                
                try:
                    # 1. Hole alle App-IDs der Appgroup
                    print(f"[DEPLOY] Lade Appgroup: {appgroup_id}")
                    resp = httpx.get(
                        f"https://my.living-apps.de/rest/appgroups/{appgroup_id}",
                        headers=headers,
                        timeout=30
                    )
                    resp.raise_for_status()
                    appgroup = resp.json()
                    
                    app_ids = [app_data["id"] for app_data in appgroup.get("apps", {}).values()]
                    print(f"[DEPLOY] Gefunden: {len(app_ids)} Apps")
                    
                    if not app_ids:
                        print("[DEPLOY] ⚠️ Keine Apps gefunden")
                        return {"content": [{"type": "text", "text": "✅ Deployment erfolgreich!"}]}
                    
                    dashboard_url = f"https://my.living-apps.de/github/{appgroup_id}/"
                    
                    # 2. Warte bis Dashboard verfügbar ist
                    print(f"[DEPLOY] ⏳ Warte auf Dashboard: {dashboard_url}")
                    max_attempts = 180  # Max 180 Sekunden warten
                    for attempt in range(max_attempts):
                        try:
                            check_resp = httpx.get(dashboard_url, timeout=5)
                            if check_resp.status_code == 200:
                                print(f"[DEPLOY] ✅ Dashboard ist verfügbar!")
                                break
                        except:
                            pass
                        
                        if attempt < max_attempts - 1:
                            time.sleep(1)
                        else:
                            print("[DEPLOY] ⚠️ Timeout - Dashboard nicht erreichbar")
                            return {"content": [{"type": "text", "text": "✅ Deployment erfolgreich! Dashboard-Links konnten nicht aktiviert werden."}]}
                    
                    # 3. Aktiviere Dashboard-Links
                    print("[DEPLOY] 🎉 Aktiviere Dashboard-Links...")
                    for app_id in app_ids:
                        try:
                            # URL aktivieren
                            httpx.put(
                                f"https://my.living-apps.de/rest/apps/{app_id}/params/la_page_header_additional_url",
                                headers=headers,
                                json={"description": "dashboard_url", "type": "string", "value": dashboard_url},
                                timeout=10
                            )
                            # Title aktualisieren
                            httpx.put(
                                f"https://my.living-apps.de/rest/apps/{app_id}/params/la_page_header_additional_title",
                                headers=headers,
                                json={"description": "dashboard_title", "type": "string", "value": "Dashboard"},
                                timeout=10
                            )
                            print(f"[DEPLOY]   ✓ App {app_id} aktiviert")
                        except Exception as e:
                            print(f"[DEPLOY]   ✗ App {app_id}: {e}")
                    
                    print("[DEPLOY] ✅ Dashboard-Links erfolgreich hinzugefügt!")
                    
                except Exception as e:
                    print(f"[DEPLOY] ⚠️ Fehler beim Hinzufügen der Dashboard-Links: {e}")

            return {
                "content": [{"type": "text", "text": "✅ Deployment erfolgreich! Code wurde gepusht und Dashboard-Links hinzugefügt."}]
            }

        except Exception as e:
            return {"content": [{"type": "text", "text": f"Deployment Failed: {str(e)}"}], "is_error": True}

    # ============================================================
    # NEW TOOL: create_apps
    # Creates LivingApps apps from JSON specification
    # ============================================================
    @tool("create_apps",
        "Create LivingApps apps from a JSON specification. Call this AFTER building UI with mock data to add real data persistence. "
        "Returns metadata that you should pass to generate_typescript. "
        "Apps are created in dependency order (apps without applookup first).",
        {
            "type": "object",
            "properties": {
                "apps": {
                    "type": "array",
                    "description": "Array of app definitions",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string", "description": "Display name for the app"},
                            "identifier": {"type": "string", "description": "snake_case identifier (e.g. 'employees')"},
                            "controls": {"type": "object", "description": "Field definitions with fulltype, label, etc."}
                        },
                        "required": ["name", "identifier", "controls"]
                    }
                }
            },
            "required": ["apps"]
        }
    )
    async def create_apps(args):
        """Create LivingApps apps and return metadata for TypeScript generation."""
        import httpx
        
        apps = args.get("apps", [])
        api_key = os.environ.get("LIVINGAPPS_API_KEY")
        api_url = "https://my.living-apps.de/rest"
        
        if not apps:
            return {"content": [{"type": "text", "text": "Error: No apps specified"}], "is_error": True}
        
        if not api_key:
            return {"content": [{"type": "text", "text": "Error: LIVINGAPPS_API_KEY not set"}], "is_error": True}
        
        print(f"[LIVINGAPPS] 🏗️ Creating {len(apps)} apps...")
        
        # Sort by dependencies (apps without applookup first)
        sorted_apps = sort_apps_by_dependencies(apps)
        
        created = {}
        identifier_to_id = {}
        
        async with httpx.AsyncClient() as client:
            for app_def in sorted_apps:
                identifier = app_def["identifier"]
                
                # Build controls for API
                controls = {}
                for ctrl_name, ctrl in app_def.get("controls", {}).items():
                    ctrl_data = {
                        "fulltype": ctrl["fulltype"],
                        "label": ctrl["label"],
                        "required": ctrl.get("required", False),
                        "in_list": ctrl.get("in_list", False),
                        "in_text": ctrl.get("in_text", False),
                    }
                    
                    # Convert lookups array to dict format
                    # plan.md uses: [{"key": "x", "value": "Y"}]
                    # LivingApps API expects: {"x": "Y"}
                    if "lookups" in ctrl:
                        lookups = ctrl["lookups"]
                        if isinstance(lookups, list):
                            ctrl_data["lookups"] = {item["key"]: item["value"] for item in lookups}
                        else:
                            ctrl_data["lookups"] = lookups
                    
                    # Resolve applookup references to real app URLs
                    if "applookup" in ctrl.get("fulltype", ""):
                        ref = ctrl.get("lookup_app_ref")
                        if ref and ref in identifier_to_id:
                            ctrl_data["lookup_app"] = f"{api_url}/apps/{identifier_to_id[ref]}"
                    
                    controls[ctrl_name] = ctrl_data
                
                # Create app via LivingApps REST API
                try:
                    print(f"[LIVINGAPPS] Creating: {app_def['name']}...")
                    response = await client.post(
                        f"{api_url}/apps",
                        json={"name": app_def["name"], "controls": controls},
                        headers={"X-API-Key": api_key, "Content-Type": "application/json"},
                        timeout=60
                    )
                    response.raise_for_status()
                    result = response.json()
                    
                    app_id = result["id"]
                    identifier_to_id[identifier] = app_id
                    created[identifier] = {
                        "app_id": app_id,
                        "name": app_def["name"],
                        "controls": result.get("controls", {})
                    }
                    print(f"[LIVINGAPPS] ✅ Created: {app_def['name']} ({app_id})")
                    
                except httpx.HTTPStatusError as e:
                    error_msg = f"Error creating '{app_def['name']}': {e.response.text}"
                    print(f"[LIVINGAPPS] ❌ {error_msg}")
                    return {
                        "content": [{"type": "text", "text": error_msg}],
                        "is_error": True
                    }
                except Exception as e:
                    error_msg = f"Error creating '{app_def['name']}': {str(e)}"
                    print(f"[LIVINGAPPS] ❌ {error_msg}")
                    return {
                        "content": [{"type": "text", "text": error_msg}],
                        "is_error": True
                    }
        
        # Build metadata for TypeScript generator
        metadata = {
            "appgroup_id": None,
            "appgroup_name": "Auto-Generated",
            "apps": created,
            "metadata": {"apps_list": [app["name"] for app in created.values()]}
        }
        
        print(f"[LIVINGAPPS] ✅ All {len(created)} apps created successfully!")
        
        return {
            "content": [{
                "type": "text",
                "text": json.dumps({
                    "success": True,
                    "message": f"Created {len(created)} LivingApps apps",
                    "apps_created": list(created.keys()),
                    "metadata": metadata
                }, indent=2)
            }]
        }

    # ============================================================
    # NEW TOOL: generate_typescript
    # Generates TypeScript types and service from app metadata
    # ============================================================
    @tool("generate_typescript",
        "Generate TypeScript types and service from app metadata. "
        "Call this AFTER create_apps with the metadata it returned. "
        "Creates src/types/app.ts and src/services/livingAppsService.ts with type-safe CRUD operations.",
        {
            "type": "object",
            "properties": {
                "metadata": {
                    "type": "object",
                    "description": "The metadata object returned from create_apps (contains apps with app_id, name, controls)"
                }
            },
            "required": ["metadata"]
        }
    )
    async def generate_typescript(args):
        """Generate TypeScript files from app metadata."""
        metadata = args.get("metadata")
        
        if not metadata:
            return {"content": [{"type": "text", "text": "Error: No metadata provided"}], "is_error": True}
        
        print("[TYPESCRIPT] 📝 Generating TypeScript types and service...")
        
        try:
            # Import the generator (copied to sandbox by sandbox.py)
            from typescript_generator import TypeScriptGenerator
            
            generator = TypeScriptGenerator(metadata)
            types_code = generator.generate_types()
            service_code = generator.generate_service()
            
            # Ensure directories exist
            Path("src/types").mkdir(parents=True, exist_ok=True)
            Path("src/services").mkdir(parents=True, exist_ok=True)
            
            # Write files
            with open("src/types/app.ts", "w") as f:
                f.write(types_code)
            
            with open("src/services/livingAppsService.ts", "w") as f:
                f.write(service_code)
            
            print("[TYPESCRIPT] ✅ Generated src/types/app.ts")
            print("[TYPESCRIPT] ✅ Generated src/services/livingAppsService.ts")
            
            # List what was generated
            app_names = list(metadata.get("apps", {}).keys())
            
            return {
                "content": [{
                    "type": "text",
                    "text": f"TypeScript files generated successfully!\n\nFiles created:\n- src/types/app.ts\n- src/services/livingAppsService.ts\n\nGenerated types for: {', '.join(app_names)}\n\nYou can now import and use:\n- Types: import type {{ {', '.join([name.title() for name in app_names])} }} from '@/types/app'\n- Service: import {{ LivingAppsService }} from '@/services/livingAppsService'"
                }]
            }
            
        except ImportError:
            return {
                "content": [{"type": "text", "text": "Error: typescript_generator.py not found in sandbox. Make sure it was copied."}],
                "is_error": True
            }
        except Exception as e:
            return {
                "content": [{"type": "text", "text": f"Error generating TypeScript: {str(e)}"}],
                "is_error": True
            }

    # ============================================================
    # CREATE MCP SERVER WITH ALL TOOLS
    # ============================================================
    dashboard_tools_server = create_sdk_mcp_server(
        name="dashboard_tools",
        version="1.0.0",
        tools=[deploy_to_github, create_apps, generate_typescript]
    )

    # 3. Optionen konfigurieren
    # setting_sources=["project"] is REQUIRED to load CLAUDE.md and .claude/skills/ from cwd
    options = ClaudeAgentOptions(
        system_prompt={
            "type": "preset",
            "preset": "claude_code"
        },
        setting_sources=["project"],  # Required: loads CLAUDE.md and .claude/skills/
        mcp_servers={"dashboard_tools": dashboard_tools_server},
        permission_mode="acceptEdits",
        allowed_tools=[
            "Bash", "Write", "Read", "Edit", "Glob", "Grep", "Task", "TodoWrite",
            "mcp__dashboard_tools__deploy_to_github",
            "mcp__dashboard_tools__create_apps",
            "mcp__dashboard_tools__generate_typescript"
        ],
        cwd="/home/user/app",
        model="claude-opus-4-5-20251101", #"claude-sonnet-4-5-20250929"
    )

    # Session-Resume Unterstützung
    resume_session_id = os.getenv('RESUME_SESSION_ID')
    if resume_session_id:
        options.resume = resume_session_id
        print(f"[LILO] Resuming session: {resume_session_id}")

    # User Prompt - prefer file over env var (handles special chars better)
    user_prompt = None
    
    # First try reading from file (more reliable for special chars like umlauts)
    prompt_file = "/home/user/app/.user_prompt"
    if os.path.exists(prompt_file):
        try:
            with open(prompt_file, 'r') as f:
                user_prompt = f.read().strip()
            if user_prompt:
                print(f"[LILO] Prompt aus Datei gelesen: {len(user_prompt)} Zeichen")
        except Exception as e:
            print(f"[LILO] Fehler beim Lesen der Prompt-Datei: {e}")
    
    # Fallback to env var (for backwards compatibility)
    if not user_prompt:
        user_prompt = os.getenv('USER_PROMPT')
        if user_prompt:
            print(f"[LILO] Prompt aus ENV gelesen")
    
    if user_prompt:
        # Continue/Resume-Mode: Custom prompt vom User
        query = f"""🚨 AUFGABE: Du MUSST das existierende Dashboard ändern und deployen!

User-Anfrage: "{user_prompt}"

PFLICHT-SCHRITTE (alle müssen ausgeführt werden):

1. LESEN: Lies src/pages/Dashboard.tsx um die aktuelle Struktur zu verstehen
2. ÄNDERN: Implementiere die User-Anfrage mit dem Edit-Tool
3. TESTEN: Führe 'npm run build' aus um sicherzustellen dass es kompiliert
4. DEPLOYEN: Rufe deploy_to_github auf um die Änderungen zu pushen

⚠️ KRITISCH:
- Du MUSST Änderungen am Code machen (Edit-Tool verwenden!)
- Du MUSST am Ende deploy_to_github aufrufen!
- Beende NICHT ohne zu deployen!
- Analysieren alleine reicht NICHT - du musst HANDELN!

Das Dashboard existiert bereits. Mache NUR die angeforderten Änderungen, nicht mehr.
Starte JETZT mit Schritt 1!"""
        print(f"[LILO] Continue-Mode mit User-Prompt: {user_prompt}")
    else:
        # Normal-Mode: Neues Dashboard bauen
        query = (
            "Use frontend-design Skill to create analyse app structure and generate design_brief.md"
            "Build the Dashboard.tsx following design_brief.md exactly. "
            "Use existing types and services from src/types/ and src/services/. "
            "Deploy when done using the deploy_to_github tool."
        )
        print(f"[LILO] Build-Mode: Neues Dashboard erstellen")

    print(f"[LILO] Initialisiere Client")

    # 4. Der Client Lifecycle
    async with ClaudeSDKClient(options=options) as client:

        # Anfrage senden
        await client.query(query)

        # 5. Antwort-Schleife
        # receive_response() liefert alles bis zum Ende des Auftrags
        async for message in client.receive_response():
            
            # A. Wenn er denkt oder spricht
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        #als JSON-Zeile ausgeben
                        print(json.dumps({"type": "think", "content": block.text}), flush=True)
                    
                    elif isinstance(block, ToolUseBlock):
                        print(json.dumps({"type": "tool", "tool": block.name, "input": str(block.input)}), flush=True)

            # B. Wenn er fertig ist (oder Fehler)
            elif isinstance(message, ResultMessage):
                status = "success" if not message.is_error else "error"
                print(f"[LILO] Session ID: {message.session_id}")
                
                # Save session_id to file for future resume (AFTER ResultMessage)
                if message.session_id:
                    try:
                        with open("/home/user/app/.claude_session_id", "w") as f:
                            f.write(message.session_id)
                        print(f"[LILO] ✅ Session ID in Datei gespeichert")
                    except Exception as e:
                        print(f"[LILO] ⚠️ Fehler beim Speichern der Session ID: {e}")
                
                print(json.dumps({
                    "type": "result", 
                    "status": status, 
                    "cost": message.total_cost_usd,
                    "session_id": message.session_id
                }), flush=True)

if __name__ == "__main__":
    asyncio.run(main())