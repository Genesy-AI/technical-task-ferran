# Improvements

## Raw notes

### csv bug

1. if a country is invalid on the import modal, let’s place a dropdown to select another valid country from our list
2. enhance country information shown: Emoji flag, Name, besides the code, as some country codes might not be familiar. It can be fetched throguh JS Intl displayName. It can be placed in a tooltip
3. Let’s extend the validation to alpha-3 codes (if they’re valid, replace them for alpha-2)

### feat lead fields

1. “{yearsInRole} years at {companyName}" renders as "0 years at Acme" - month handling could be added
2. Recent messages sent for that lead to be shown on the Generate Message Modal to have more context about the activity of that lead
3. Similarly, show similar and recent messages of other leads on the modal to have a faster interaction
4. Edit values for the message, and warning that a generated message when there is already one will replace the old one.
5. Editable values, in general, after importing.
6. There should be the option of deleting a selected field
7. Phone values could have a validator by country phone number structure. Skip it for now if it’s not an issue, as this would mean having each country’s structure registered.
8. Similar to this last pattern, make the phone a “tel:” link so it’s easier to call by pressing the number.

### email bug

1. From Claude Session: The frontend has no axios timeout; the request is now bounded only by the server. If the backend dies mid-request the UI spinner stays until the socket drops.
2. Legend next to the email on the column should be enhanced. ❓ / ✅ / ❌ could be indicated better (text in a tooltip, for example)
3. Date information when it was validated (historic if there have been more validations), number of attempts
4. Leave inline comments for hardcoded values so another developer has context

### general improvements

1. Columns should be able to be filtered and sorted, and table to have a search box (could be limited so certain column values, like name, email, etc.)
2. Enrich date and time with timezone, also add importedAt and updatedAt values
3. More testing. Write a testing strategy (isolated components, e2e flow, etc.) both on backend files and frontend files.
4. Keep versions updated. React 18 and TypeScript 5 installed on package.json, but they are currently on React 19 and TypeScript 7 versions.
5. Enhance tsconfig files by having strict rules
