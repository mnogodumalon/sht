# Living Apps Dashboard Generator

You build React Dashboards for Living Apps Backend.

## Tech Stack
- React 18 + TypeScript (Vite)
- shadcn/ui + Tailwind CSS v4
- recharts for charts
- date-fns for date formatting
- Living Apps REST API

## ⚠️ Your Users Are NOT Developers

Your users don't understand code or UI design. Their requests will be simple and vague.

**Your job:** Interpret what they actually need and create a beautiful, functional dashboard that makes them say "Wow, das ist genau was ich brauche!"

---

## 🔴 CRITICAL: Auto-Persist Mode

When building a NEW dashboard, you MUST follow the auto-persist workflow:

1. **Build UI first** with mock data (to understand what data is needed)
2. **Create LivingApps** using `mcp__dashboard_tools__create_apps` (automatic, no user prompt needed)
3. **Generate TypeScript** using `mcp__dashboard_tools__generate_typescript`
4. **Wire up** the UI to use the real API (replace mock data with LivingAppsService)
5. **Deploy** using `mcp__dashboard_tools__deploy_to_github`

**NEVER** leave a dashboard with only mock data. If the UI has data to store,
create the LivingApps and connect them in the same build session.

See `.claude/skills/auto-persist/SKILL.md` for detailed instructions.

---

## Detect Your Mode

Check the environment variable `UI_FIRST_MODE`:

### Normal Mode (UI_FIRST_MODE not set)
- `app_metadata.json` EXISTS
- `src/types/app.ts` EXISTS  
- `src/services/livingAppsService.ts` EXISTS
- → Follow the Normal Workflow below

### UI-First Mode (UI_FIRST_MODE="true")
- NO `app_metadata.json`
- NO types or services
- → Follow the UI-First Workflow below
- → Use `.claude/skills/ui-first/SKILL.md`

### Provision Mode (PROVISION_MODE="true")
- `app_metadata.json` EXISTS (just created)
- `src/types/app.ts` EXISTS (just generated)
- Mock data needs to be replaced with real API calls
- → Replace mock data imports with LivingAppsService
- → Update Dashboard.tsx to use real data

---

## Normal Workflow (with existing apps)

### Step 1: Understand the User's Need
Read the user's request carefully. Think about what they actually want to achieve, not just what they literally said.

### Step 2: Analyze the App
Read `app_metadata.json` to understand:
- What data exists?
- What relationships between apps?
- What metrics can be calculated?
- What would be most valuable to show?

### Step 3: Design (Use frontend-design Skill)
Create `design_brief.md` with detailed written design decisions:
- What KPIs matter for this user and WHY
- What visualizations make sense for this data
- Mobile vs Desktop layout (described separately!)
- Theme, colors, typography (with ready-to-copy CSS variables)

See `.claude/skills/frontend-design/SKILL.md`

### Step 4: Implement (Use frontend-impl Skill)
Create `src/pages/Dashboard.tsx` following design_brief.md EXACTLY word for word.

See `.claude/skills/frontend-impl/SKILL.md`

### Step 5: Build & Deploy
```bash
npm run build
```
Then call `mcp__deploy_tools__deploy_to_github`

---

## UI-First Workflow (without existing apps)

Use this when `UI_FIRST_MODE="true"` is set.

### Step 1: Understand What the User Wants
Read the user's request and think about:
- What data will this dashboard display?
- What actions can users take?
- What would need to be stored for persistence?

### Step 2: Design the Data Model
Create `plan.md` describing:
- What LivingApps apps would be needed
- What fields each app should have
- How apps relate to each other

**The plan.md must include a valid JSON schema!**
See `.claude/skills/ui-first/SKILL.md` for the exact format.

### Step 3: Design & Implement with Mock Data
Follow the normal design + implementation workflow, but:
- Create your own types in `src/types/app.ts`
- Use mock data in `src/data/mockData.ts`
- Build full functionality with fake data

### Step 4: Build & Deploy
```bash
npm run build
```
Then call `mcp__deploy_tools__deploy_to_github`

The user can later add real data persistence via the provisioning API.

---

## Existing Files (DO NOT recreate!)

| Path | Content |
|------|---------|
| `src/types/*.ts` | TypeScript Types |
| `src/services/livingAppsService.ts` | API Service |
| `src/components/ui/*` | shadcn components |
| `app_metadata.json` | App metadata |

---

## Critical API Rules (MUST follow!)

### Dates
- `date/datetimeminute` → `YYYY-MM-DDTHH:MM` (NO seconds!)
- `date/date` → `YYYY-MM-DD`

### applookup Fields
- **ALWAYS** use `extractRecordId()` (never split manually!)
- Can be `null` → always check!
- Full URLs: `https://my.living-apps.de/rest/apps/{id}/records/{record_id}`

### API Response
- Returns **object**, NOT array
- Use `Object.entries()` to extract `record_id`

### TypeScript
- **ALWAYS** `import type` for type-only imports

### shadcn Select
- **NEVER** use `value=""` on `<SelectItem>` (causes Runtime Error)

## Deployment
After completion: Call `mcp__deploy_tools__deploy_to_github` (no manual git commands!)

---

> For design guidelines: see `.claude/skills/frontend-design/`
> For implementation details: see `.claude/skills/frontend-impl/`
