---
name: auto-persist
description: |
  Activate this skill when building ANY dashboard that needs to store data.
  This is the DEFAULT mode for all dashboard builds.
  
  Triggers:
  - Building a new dashboard
  - User wants to track, store, or manage data
  - Dashboard has forms, lists, or editable content
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - mcp__dashboard_tools__create_apps
  - mcp__dashboard_tools__generate_typescript
  - mcp__dashboard_tools__deploy_to_github
---

# Auto-Persist Skill: UI-First with Automatic Data Persistence

You are building a dashboard. Follow this **3-phase workflow**:

1. **BUILD UI** with mock data (understand what's needed)
2. **CREATE APPS** based on what the UI uses (automatic)
3. **WIRE UP** the UI to use real API (replace mock data)

All three phases happen in ONE build. User does NOT need to ask for data persistence.

---

## Phase 1: Build UI with Mock Data

### Step 1.1: Understand the Request

Read the user's prompt. Think about:
- What will users SEE? (lists, cards, charts, calendars)
- What will users DO? (add, edit, delete, filter)
- What data flows through the UI?

### Step 1.2: Create Dashboard.tsx with Mock Data

Build the full UI using placeholder data:

```typescript
// Start with mock data to understand the shape
const mockEmployees = [
  { id: '1', name: 'Anna Schmidt', role: 'manager', email: 'anna@example.com' },
  { id: '2', name: 'Ben Mueller', role: 'employee', email: 'ben@example.com' },
];

const mockShifts = [
  { id: '1', date: '2025-01-30', employeeId: '1', type: 'morning' },
  { id: '2', date: '2025-01-30', employeeId: '2', type: 'evening' },
];

function Dashboard() {
  const [employees] = useState(mockEmployees);
  const [shifts] = useState(mockShifts);
  
  // Build complete UI with all features
  return (
    <div>
      <ShiftCalendar shifts={shifts} employees={employees} />
      <EmployeeList employees={employees} />
      <AddShiftDialog employees={employees} onAdd={...} />
    </div>
  );
}
```

### Step 1.3: Prepare App Definitions

After building UI, prepare the app definitions based on what data you actually used.

**Example for a shift planner:**

```json
{
  "apps": [
    {
      "name": "Employees",
      "identifier": "employees",
      "controls": {
        "name": {
          "fulltype": "string/text",
          "label": "Name",
          "required": true,
          "in_list": true,
          "in_text": true
        },
        "role": {
          "fulltype": "lookup/select",
          "label": "Role",
          "lookups": [
            {"key": "manager", "value": "Manager"},
            {"key": "employee", "value": "Employee"}
          ],
          "in_list": true
        },
        "email": {
          "fulltype": "string/email",
          "label": "Email",
          "required": true
        }
      }
    },
    {
      "name": "Shifts",
      "identifier": "shifts",
      "controls": {
        "date": {
          "fulltype": "date/date",
          "label": "Date",
          "required": true,
          "in_list": true
        },
        "employee": {
          "fulltype": "applookup/select",
          "label": "Employee",
          "lookup_app_ref": "employees"
        },
        "shift_type": {
          "fulltype": "lookup/select",
          "label": "Shift Type",
          "lookups": [
            {"key": "morning", "value": "Morning (6-14)"},
            {"key": "evening", "value": "Evening (14-22)"},
            {"key": "night", "value": "Night (22-6)"}
          ],
          "in_list": true
        }
      }
    }
  ]
}
```

**Important:** The JSON must match EXACTLY what your UI uses!

---

## Phase 2: Create LivingApps (Automatic)

### Step 2.1: Call create_apps Tool

Use the MCP tool to create real LivingApps apps:

```
mcp__dashboard_tools__create_apps({
  "apps": [
    // Your app definitions here
  ]
})
```

This:
- Creates real LivingApps apps via REST API
- Handles dependencies (employees before shifts because shifts reference employees)
- Returns metadata with real app IDs and controls

### Step 2.2: Call generate_typescript Tool

Use the returned metadata to generate type-safe code:

```
mcp__dashboard_tools__generate_typescript({
  "metadata": {
    // The metadata object from create_apps response
  }
})
```

This creates:
- `src/types/app.ts` - TypeScript interfaces matching your apps
- `src/services/livingAppsService.ts` - CRUD service with all methods

---

## Phase 3: Wire Up Real API

### Step 3.1: Read Generated Types

```bash
cat src/types/app.ts
cat src/services/livingAppsService.ts
```

Understand the available methods:
- `LivingAppsService.getEmployees()`
- `LivingAppsService.createEmployee(fields)`
- `LivingAppsService.updateEmployee(id, fields)`
- `LivingAppsService.deleteEmployee(id)`
- etc.

### Step 3.2: Replace Mock Data with Real API

**Before (mock):**
```typescript
const mockEmployees = [...];
const [employees] = useState(mockEmployees);
```

**After (real):**
```typescript
import { LivingAppsService } from '@/services/livingAppsService';
import type { Employee, Shift } from '@/types/app';

const [employees, setEmployees] = useState<Employee[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  LivingAppsService.getEmployees()
    .then(setEmployees)
    .finally(() => setLoading(false));
}, []);
```

### Step 3.3: Add CRUD Operations

```typescript
async function handleAddEmployee(data: CreateEmployee) {
  const created = await LivingAppsService.createEmployee(data);
  setEmployees(prev => [...prev, created]);
}

async function handleUpdateEmployee(id: string, data: Partial<CreateEmployee>) {
  await LivingAppsService.updateEmployee(id, data);
  // Refresh data
  const updated = await LivingAppsService.getEmployees();
  setEmployees(updated);
}

async function handleDeleteEmployee(id: string) {
  await LivingAppsService.deleteEmployee(id);
  setEmployees(prev => prev.filter(e => e.record_id !== id));
}
```

### Step 3.4: Handle Loading and Empty States

```typescript
if (loading) {
  return <div className="flex items-center justify-center p-8">
    <Loader2 className="h-8 w-8 animate-spin" />
  </div>;
}

if (employees.length === 0) {
  return <EmptyState 
    message="Noch keine Mitarbeiter" 
    actionLabel="Mitarbeiter hinzufügen"
    onAction={() => setShowAddDialog(true)} 
  />;
}
```

---

## Control Types Quick Reference

| UI Element | fulltype | Example |
|------------|----------|---------|
| Text input | `string/text` | Name, Title |
| Long text | `string/textarea` | Description, Notes |
| Email input | `string/email` | Contact email |
| Number input | `number` | Count, Price |
| Checkbox | `bool` | Is Active |
| Date picker | `date/date` | Due Date (YYYY-MM-DD) |
| DateTime picker | `date/datetimeminute` | Event Start (YYYY-MM-DDTHH:MM) |
| Dropdown (fixed options) | `lookup/select` | Status, Type |
| Reference to other data | `applookup/select` | Employee → Shift |

---

## Important Rules

1. **Create apps BEFORE wiring up UI** - you need the generated types
2. **Order matters for applookup** - create referenced apps first (the tool handles this automatically)
3. **Don't modify generated files** - `src/types/app.ts` and `src/services/livingAppsService.ts` are auto-generated
4. **Use real API calls** - `LivingAppsService.getX()`, not hardcoded arrays
5. **Handle loading states** - data is async, show loading indicator
6. **Handle empty states** - no data yet? Show helpful message with action

---

## Checklist Before Deploying

- [ ] UI fully functional with mock data
- [ ] LivingApps apps created via `create_apps` tool
- [ ] TypeScript generated via `generate_typescript` tool
- [ ] Mock data replaced with `LivingAppsService` calls
- [ ] Loading states added for async operations
- [ ] Empty states added for when no data exists
- [ ] CRUD operations work (add, edit, delete)
- [ ] `npm run build` passes without errors
- [ ] Deploy with `mcp__dashboard_tools__deploy_to_github`

---

## Definition of Done

The dashboard is complete when:

1. ✅ All UI features work
2. ✅ Data persists after page reload
3. ✅ Can create new records
4. ✅ Can edit existing records  
5. ✅ Can delete records
6. ✅ Beautiful, responsive design
7. ✅ No TypeScript errors
8. ✅ Deployed and accessible

