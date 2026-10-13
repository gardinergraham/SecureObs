# Patient notes and handover review

Patient notes can be edited online only by their original author on the same Europe/London calendar day as the recorded note. The backend checks author, organisation, ward access, day and expected version while locking the note. Original authorship/time is unchanged. Each correction retains before/after text and editor/time in patient_note_revisions; the general audit event records version identifiers without duplicating clinical text. A stale editor receives a conflict instead of overwriting another correction. Saving notes remains available through the existing creation path; edits are not queued offline.

Apply migration 057_patient_note_revisions.sql before serving the updated API. The existing backend start command runs migrations automatically. It adds note version/edited_at and the revision table; existing notes start at version 1. These changes have not been applied to the hosted database by this task.

Shift handover has a Previous handovers selector and View handover actions. Historical views use stored patient summaries, overall summary and staff notes, even for patients no longer on the current list. They are read-only and print the selected saved record. Returning to the current handover preserves the draft. Save handover still creates the same signed record with staff identity; only the button wording has changed.

Each patient has a notes dropdown for the current UK day, or the saved handover's creation day when reviewing history. It displays notes for that patient and ward only. These note references display the current note text for that day; they do not change the saved handover snapshot. Patient Voice has a larger, labelled action button.

Validation: frontend/backend TypeScript, local route tests for note editing and audit rollback, rendered-component tests for historical handover display, Expo web export. Hosted migration and tablet interaction require deployment and an updated Expo build.
