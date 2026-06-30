# Transferly Mini App

`miniapp/` is the React 18 + Vite + Tailwind frontend for the Transferly workspace. It is the Telegram Mini App surface for Transferly flows. The active backend lives under [`api/`](/workspaces/Transferly/api), and this frontend should use that API directly for auth, points, receipts, referrals, email delivery, Telegram-linked flows, and admin actions.

## Current Status

- The Mini App frontend source tree is present and bootstrapped with Vite.
- Much of the current app logic still reflects an older Supabase-backed scaffold.
- The target state is a Telegram-native Mini App shell that talks only to the shared `api/` backend.

## Directory Role

```text
miniapp/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── index.jsx
    ├── index.css
    ├── App.jsx
    ├── components/
    ├── context/
    ├── lib/
    └── pages/
```

## Development

Prerequisites:
- Node.js 18+
- The backend in `api/` configured separately when API-driven flows are being tested

Install and run:

```bash
cd miniapp
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

## Mini App Notes

The frontend is in transition. Until the Telegram Mini App migration is completed, assume the following:

- `src/context/` and `src/lib/` may still contain legacy data-access code.
- Public docs that described a completed localStorage-only or fully static app were removed because they no longer match the repo.
- The source of truth for backend behavior is the Express app in `api/`, not any legacy frontend persistence layer.
- Telegram Mini App behavior must follow the official docs at `https://docs.telegram-mini-apps.com/`, especially launch parameters, `initData` validation, theming, viewport, and back/main button behavior.

## Related Paths

- Backend runtime: [`api/`](/workspaces/Transferly/api)
- Backend setup and endpoints: [README.md](/workspaces/Transferly/README.md)
