# Student Council Project Structure

This workspace has been reorganized into separate `client` and `server` folders.

## client/
- `index.html` - Main front-end HTML page for students and admins.
- `styles.css` - Shared CSS styles for the front-end.
- `data.js` - LocalStorage data wrapper and initial seed data.
- `app.js` - Main front-end logic, routing, and UI behavior.
- `pic/` - Image assets used by the front-end.
- `artifact_link/` - Additional assets or links (preserved from original workspace).

> In `app.js`, there are section headers that separate different parts of the client logic:
> - `INITIALIZATION`
> - `NAVIGATION & ROUTING`
> - `AUTHENTICATION LOGIC`
> - `STUDENT VIEW RENDERERS`
> - `PUBLIC VIEW RENDERERS`
> - `ADMIN VIEW RENDERERS`
> - `MODALS CONTROL`
> - `FILE UPLOAD HANDLERS`
> - `HELPER UTILITIES`
> - `SONG REQUESTS LOGIC`

## server/
- `server.js` - Express backend API with JSON file persistence.
- `package.json` - Node dependencies for the backend.

## Notes
- Open `client/index.html` in VS Code to work on front-end pages.
- Open `server/server.js` to work on backend persistence and API.
- If you want, I can further split front-end logic into `client/admin.js`, `client/student.js`, and `client/chat.js`.
