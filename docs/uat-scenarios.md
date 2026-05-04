# GECX Hub — UAT Acceptance Scenarios
## Scenario A: Riya — New Project Pipeline
### SA-1: Landing → Scaffolder
- [ ] After login, user lands on /home
- [ ] "Start a New Project" card is visible and clickable
- [ ] Clicking it navigates to /scaffolder
- [ ] Scaffolder form renders immediately with all fields empty and
editable
### SA-2: Source Upload (Optional)
- [ ] "Import Context" button visible on Scaffolder page header
- [ ] Uploading a text/PDF populates form fields with AI badges showing
confidence %
- [ ] User can dismiss any AI-populated field to revert to manual entry
- [ ] Skipping upload entirely still allows full manual form completion
### SA-3: Scaffold → Instructions Pipeline
- [ ] After generating scaffold, sidebar shows completion badge for
Scaffolder
- [ ] Navigating to /instructions shows all agents pre-filled from
ScaffoldContext
- [ ] Agent selector lists all agents from scaffold topology
- [ ] Each agent's identity fields are pre-populated
### SA-4: Instructions → Guardrails Pipeline
- [ ] After applying instructions, sidebar shows completion for
Instructions
- [ ] Navigating to /guardrails shows industry vertical pre-filled from
context
- [ ] Generating guardrails works with pre-filled values
- [ ] Sidebar shows full pipeline completion after guardrails apply
### SA-5: Download
- [ ] ZIP download works from Step4Preview
- [ ] ZIP contains valid AppSnapshot structure
## Scenario B: Arjun — Standalone Tool
### SB-1: Landing → Direct Accelerator
- [ ] After login, user lands on /home
- [ ] "Use a Tool" grid shows all built accelerators as clickable cards
- [ ] Clicking "Guardrails Generator" navigates to /guardrails
### SB-2: Standalone Guardrails
- [ ] /guardrails renders full form with no empty state or blocker
- [ ] No "Run the App Scaffolder first" message anywhere
- [ ] All fields are blank and manually editable
- [ ] Industry vertical dropdown works without ScaffoldContext
- [ ] Generating guardrails ZIP works without any prior scaffold
### SB-3: Standalone Instructions
- [ ] /instructions renders with manual agent entry option
- [ ] User can type agent name and type manually when no ScaffoldContext
exists
- [ ] Full instruction wizard works end-to-end without scaffold context
### SB-4: Browser Navigation
- [ ] Direct URL /guardrails works (no redirect to dashboard)
- [ ] Browser back/forward between accelerators works
- [ ] Page refresh preserves form state (Zustand persist)
### SB-5: No Pipeline Chrome
- [ ] Sidebar does NOT show pipeline progress panel when no
ScaffoldContext exists
- [ ] No step numbers or pipeline sequence indicators visible in
standalone mode
- [ ] Sidebar uses group labels ("Core Pipeline" / "Roadmap") not ordinal
numbers
### SB-6: Error Recovery
- [ ] If an accelerator throws a runtime error, ErrorBoundary catches it
- [ ] User sees "Something went wrong" with Reset and Go Home buttons
- [ ] Other accelerators remain functional after one crashes
## Scenario C: Demo Mode
### SC-1: Demo Entry
- [ ] Login page shows "Explore without GCP credentials →" link
- [ ] Clicking it enables demo mode and navigates to /home
- [ ] Demo badge visible in TopBar
### SC-2: Demo + Standalone
- [ ] Demo mode works with direct accelerator URLs
- [ ] All accelerator forms render in demo mode without ScaffoldContext
- [ ] ImportContextButton gracefully shows error when backend is
unavailable
## Scenario D: Sidebar Quality
### SD-1: Progress Detail
- [ ] Sidebar pipeline progress shows specific incomplete agent names on
hover
- [ ] "Instructions 3/4" tooltip says "Missing: Billing Agent"
- [ ] Completed items show green checkmark, incomplete show amber ring
## Verify
wc -l ~/gecx-hub/docs/uat-scenarios.md
☐ File exists with > 60 lines of acceptance criteria
