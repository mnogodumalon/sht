---
name: ui-first
description: |
  Activate this skill when:
  - Building a dashboard WITHOUT existing LivingApps apps
  - No app_metadata.json exists
  - User wants to design UI first, add data persistence later
  - Creating plan.md for future app provisioning
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

# UI-First Dashboard Skill

You are building a dashboard **without existing LivingApps apps**. The user wants to see a working UI first, and may later add data persistence.

## Your Mission

1. **Build a fully functional UI** with mock data
2. **Write plan.md** describing what LivingApps apps would be needed for persistence
3. **Design the UI so it can easily connect** to real data later

---

## Workflow

### Step 1: Understand What the User Wants

Read the user's prompt carefully. Think about:
- What data will this dashboard display?
- What actions can users take?
- What would need to be stored?

### Step 2: Design the Data Model (plan.md)

Before building UI, create `plan.md` with:
1. Human-readable description of proposed apps
2. Machine-readable JSON schema for later provisioning

**IMPORTANT:** The JSON schema must be valid and complete. It will be used to automatically create LivingApps apps later.

### Step 3: Build UI with Mock Data

Create `Dashboard.tsx` using:
- Hardcoded mock data that matches plan.md schema
- Components that could easily connect to real API later
- Full functionality (all features work, just with fake data)

### Step 4: Deploy

Run `npm run build` and deploy with `mcp__deploy_tools__deploy_to_github`

---

## plan.md Format

Create `plan.md` in the project root with this exact structure:

```markdown
# Persistence Plan: {Dashboard Name}

## Summary

{1-2 sentences describing the dashboard and its data needs}

## Proposed Apps

{For each app, write a human-readable description}

### App: {identifier}
- **Name:** {Display name}
- **Purpose:** {What this app stores}
- **UI Components:** {Which dashboard components use this data}
- **Fields:**
  - `{field_name}` ({type}): {description}

## Relationships

{Describe how apps relate to each other}
- {app1}.{field} -> {app2} ({relationship type})

## JSON Schema

The following JSON is used for automatic app provisioning. **DO NOT EDIT MANUALLY.**

```json
{
  "apps": [
    {
      "name": "Display Name",
      "identifier": "snake_case_identifier",
      "controls": {
        "field_name": {
          "fulltype": "string/text",
          "label": "Field Label",
          "required": true,
          "in_list": true
        }
      }
    }
  ]
}
```
```

---

## Control Types Reference

Use these exact `fulltype` values in the JSON schema:

### Basic Types
| fulltype | Use for | Example |
|----------|---------|---------|
| `string/text` | Single-line text | Name, Title |
| `string/textarea` | Multi-line text | Description, Notes |
| `string/email` | Email addresses | email@example.com |
| `string/url` | URLs | https://example.com |
| `string/tel` | Phone numbers | +49 123 456789 |
| `number` | Numbers | Count, Amount |
| `bool` | Yes/No | Is Active, Completed |

### Date Types
| fulltype | Format | Example |
|----------|--------|---------|
| `date/date` | YYYY-MM-DD | 2025-01-30 |
| `date/datetimeminute` | YYYY-MM-DDTHH:MM | 2025-01-30T14:30 |

### Lookup Types (Predefined Options)
```json
{
  "fulltype": "lookup/select",
  "label": "Status",
  "lookups": [
    {"key": "active", "value": "Active"},
    {"key": "done", "value": "Done"},
    {"key": "cancelled", "value": "Cancelled"}
  ]
}
```

### App Lookup (Reference to Another App)
```json
{
  "fulltype": "applookup/select",
  "label": "Category",
  "lookup_app_ref": "categories"
}
```

**Note:** `lookup_app_ref` uses the identifier of another app in the same plan. The actual URL will be filled in during provisioning.

---

## Mock Data Pattern

Create mock data that matches your plan.md schema exactly:

```typescript
// Mock data matching plan.md schema
const mockWorkouts: Workout[] = [
  {
    record_id: 'mock-1',
    createdat: '2025-01-30T10:00:00Z',
    updatedat: null,
    fields: {
      name: 'Morning Run',
      duration: 30,
      date: '2025-01-30T10:00',  // Format matches date/datetimeminute
      category: null,  // Would be applookup URL in real data
    }
  },
  // ... more mock records
];

// Type that matches what LivingApps would return
interface Workout {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    name: string;
    duration: number;
    date: string;
    category: string | null;  // applookup can be null
  };
}
```

---

## Making UI "Persistence-Ready"

Design your components so they can easily switch from mock to real data:

### 1. Centralize Data Access

```typescript
// src/data/mockData.ts
export const mockWorkouts: Workout[] = [...];

// Dashboard.tsx - easy to replace later
import { mockWorkouts } from '@/data/mockData';
// Later becomes: import { LivingAppsService } from '@/services/livingAppsService';

function Dashboard() {
  const [workouts, setWorkouts] = useState<Workout[]>(mockWorkouts);
  // Later: useEffect(() => { LivingAppsService.getWorkouts().then(setWorkouts) }, []);
}
```

### 2. Use Consistent Types

Define types that match the plan.md schema:

```typescript
// src/types/app.ts (you create this manually for UI-first)
export interface Workout {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    name: string;
    duration: number;
    date: string;
    category: string | null;
  };
}
```

### 3. Handle Null Values

applookup fields can be null. Always check:

```typescript
const categoryId = workout.fields.category;
if (categoryId) {
  // Show category name
} else {
  // Show "Uncategorized"
}
```

---

## Example plan.md

```markdown
# Persistence Plan: Fitness Tracker

## Summary

A personal fitness dashboard for tracking workouts and exercises. Users can log workouts, track progress over time, and manage their exercise library.

## Proposed Apps

### App: workouts
- **Name:** Workouts
- **Purpose:** Stores individual workout sessions
- **UI Components:** WorkoutList, AddWorkoutDialog, WeeklyChart
- **Fields:**
  - `name` (string): Workout name/title
  - `duration` (number): Duration in minutes
  - `date` (date/datetimeminute): When the workout occurred
  - `exercise` (applookup): Link to exercise type
  - `notes` (textarea): Optional notes

### App: exercises
- **Name:** Exercises
- **Purpose:** Master data for exercise types
- **UI Components:** ExerciseSelector, ExerciseManager
- **Fields:**
  - `name` (string): Exercise name
  - `category` (lookup): Type of exercise
  - `calories_per_minute` (number): Average calories burned

## Relationships

- workouts.exercise -> exercises (many-to-one)

## JSON Schema

```json
{
  "apps": [
    {
      "name": "Exercises",
      "identifier": "exercises",
      "controls": {
        "name": {
          "fulltype": "string/text",
          "label": "Name",
          "required": true,
          "in_list": true,
          "in_text": true
        },
        "category": {
          "fulltype": "lookup/select",
          "label": "Category",
          "lookups": [
            {"key": "cardio", "value": "Cardio"},
            {"key": "strength", "value": "Strength"},
            {"key": "flexibility", "value": "Flexibility"}
          ],
          "in_list": true
        },
        "calories_per_minute": {
          "fulltype": "number",
          "label": "Calories per Minute",
          "required": false
        }
      }
    },
    {
      "name": "Workouts",
      "identifier": "workouts",
      "controls": {
        "name": {
          "fulltype": "string/text",
          "label": "Name",
          "required": true,
          "in_list": true,
          "in_text": true
        },
        "duration": {
          "fulltype": "number",
          "label": "Duration (min)",
          "required": true,
          "in_list": true
        },
        "date": {
          "fulltype": "date/datetimeminute",
          "label": "Date",
          "required": true,
          "in_list": true
        },
        "exercise": {
          "fulltype": "applookup/select",
          "label": "Exercise",
          "lookup_app_ref": "exercises"
        },
        "notes": {
          "fulltype": "string/textarea",
          "label": "Notes",
          "required": false
        }
      }
    }
  ]
}
```
```

---

## Checklist Before Completing

- [ ] `plan.md` created with valid JSON schema
- [ ] JSON schema includes all fields shown in UI
- [ ] Mock data matches schema structure
- [ ] Types defined in `src/types/app.ts`
- [ ] Mock data centralized in `src/data/mockData.ts`
- [ ] All UI features work with mock data
- [ ] `npm run build` passes
- [ ] Deployed to GitHub Pages

---

## Definition of Done

The UI-first dashboard is complete when:

1. ✅ Dashboard fully functional with mock data
2. ✅ `plan.md` exists with valid JSON schema
3. ✅ Types and mock data organized for easy replacement
4. ✅ All features work (not just display - actions too!)
5. ✅ Beautiful, distinctive design (not AI slop)
6. ✅ Mobile + Desktop responsive
7. ✅ No TypeScript errors
8. ✅ Deployed to GitHub Pages

