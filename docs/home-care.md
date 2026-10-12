# Home Care

Home Care is an additional service setting in the Expo application, backed by PostgreSQL. Hospital and care-home records retain their current workflow. It uses existing ward IDs as home location IDs so patient notes, care plans, medication, observations, staff permissions and handovers continue to work without copying patient records.

## Setup

1. Deploy the backend with migration `055_home_care.sql` (the normal start command runs migrations), then distribute a new app build. The marketing website deployment alone does not update the Expo app.
2. In SecureObs admin settings, select the customer's organisation/site and create a location with service type **Home care** and a recognisable home name. Existing ward licence limits still apply; no pricing changes are included.
3. Managers with management access to an existing home can now use **Add home location** in Home Care to create further locations in that same site. The creator automatically receives manager access, and **Add / manage patient at this home** opens patient management with the new location selected. Existing subscription/location allowances still apply. A new site still needs its first home configured by SecureObs admin.
4. Assign staff, including managers, to the home using the existing staff access settings. A manager sees only their authorised homes; a super-admin sees homes belonging to the organisation on their authenticated staff account.
5. Set up the patient through existing patient management for that location.
6. Open **Home Care** from the main menu, select the home and save its address, access instructions, emergency contact, care needs, required carer count and whether continuous cover is required.
7. Schedule duties using local date/time (`YYYY-MM-DD HH:MM`). Day, waking-night, sleep-in, live-in and wellness are available. Each live-in duty period is limited to 24 hours; create separate periods for a multi-day assignment, with relief cover. Recurring rota generation is not included in this version.

## Using it

The overview shows residents, carer-confirmed current attendance, late arrivals, overdue check-outs, next cover, first planned gap in the next 24 hours and outstanding/overdue care tasks. Wellness duties do not count towards continuous cover. A duty that has passed its planned end does not count as current cover, even if the carer has forgotten to check out. Breaks reduce current confirmed coverage. The planned-gap calculation uses scheduled cover, separately from actual check-ins.

The assigned carer checks in up to 30 minutes before a duty starts and before it ends. Signing into SecureObs does not record arrival. Only the assigned carer can record attendance, breaks, handover and wellness outcomes. Check-out requires handover notes. A manager can cancel a planned duty; active duties cannot be cancelled to erase attendance. To change a planned duty, cancel and create its replacement.

Wellness outcomes are well, concern or no answer. Notes are required. Concern/no-answer events remain visible for review in the recent events window. Staff must follow the provider's existing escalation procedure: recording an outcome does not dispatch alerts, emergency services or messages.

The dashboard refreshes every 30 seconds and displays the last successful refresh. Attendance requires a successful online server response; it is not queued as offline confirmation. Attendance is self-reported, not GPS/NFC-verified presence. Returning to an existing clinical screen gives access to care records and formal shift handovers.

## Data and access

Tables: `home_care_profiles`, `home_care_duties`, `home_care_events`. Attendance events retain the authenticated actor, server timestamp, action, notes and outcome. Schedule writes check active staff, home permission, time bounds and overlapping home-care duties. Database locking serialises scheduling for each carer; a unique index prevents simultaneous checked-in duties. Retries reuse write IDs. Read results are organisation-scoped and limited to allowed homes; mutations recheck the stored home's organisation and staff role.

The schedule shown here is the home-care duty schedule. The legacy ward rota remains separate; cross-check staff also assigned to institutional rotas when arranging mixed-setting work. The dashboard displays duties for the previous seven and next 31 days, plus unfinished duties; events show the most recent 500 within seven days. Records remain in the database beyond this display window. SQL Server support is not part of this PostgreSQL migration.

## Verification and release

Passed locally: app type check, backend build, Expo web export, focused tests (`node backend/tests/home-care.mjs`) for cover counts, gaps, overdue duties, breaks, wellness exclusion, date validation, attendance transitions, authentication, organisation isolation, own-attendance restriction and replay handling. Tests use a mocked database and do not establish production persistence.

Before real care use, validate on a test deployment with a manager and two carers: create two homes, assign patients/staff, save profiles, schedule relief and two-person cover, check in/out, take breaks, record handover and wellness concerns, reopen the dashboard and confirm data persists. Verify that staff without access cannot read or update the other home, and that interrupted connectivity clearly leaves attendance unconfirmed. Check tablet layouts and overnight/DST dates. No production deployment or Android release was performed during implementation.

The sign-in screen shows Home Care as the primary action only when the selected site has a Home care location, with Home location wording and a secondary entry to the selected home’s clinical records. This update requires a backend deployment and a new Expo build, but no additional migration beyond 055. Manager location creation is transactional, respects organisation and site boundaries and subscription limits, and records an audit event.
