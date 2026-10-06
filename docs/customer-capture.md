# Customer capture

Deploy the backend to Railway and the website to Vercel, then open `/capture` on the website. The page is unlinked from the public navigation and marked noindex. Access to saving and viewing requires an existing production super-admin staff code/PIN; an obscure URL is not the access control.

The normal backend start command applies migration `054_customer_leads.sql`, creating `customer_leads`. No additional Stripe configuration or environment variables are needed. This route is disabled on demo deployments. Payment routes and subscriptions are untouched.

Use New customer, complete contact name and organisation plus email or telephone, then Save customer details. Only a successful server response displays Saved to Railway. An interrupted save can be retried using the same record ID without inserting a duplicate. Saved records are locked on screen; use New customer for the next conversation. The form requires internet. Unsaved details stay in page memory only, with a navigation warning; closing the tab or refreshing can lose them. No local persistent contact storage is used.

Saved leads supports searching by contact name, organisation or email and opening all collected fields, including optional marketing permission. Results are scoped to the signed-in administrator's organisation and paginated in groups of 50. It does not send messages, create binding orders or initiate payments. Use optional marketing consent separately from enquiry follow-up.

Validation: TypeScript build, JavaScript syntax check and `node backend/tests/customer-leads.mjs` (mock database: field validation, role guard, organisation scoping, duplicate retry conflict and pagination). Real Railway persistence and tablet browser verification remain deployment checks: save an agreed test record, sign out/in and retrieve it in Saved leads. Do not assume a local mock test verifies the hosted database.
