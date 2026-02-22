# daily tasks

React app for personal tasks with Firebase login and themed UI.

## Features

- Sign in with Google
- Sign in with email/username + password
- Create task lists with title and auto-created date
- Instant strike-through on complete toggle
- Sidebar sorted by latest updated
- Dark/light mode with saved preference
- Per-user local storage persistence

## Run

1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
```

## Auth setup

1. Create a Firebase project.
2. Enable Authentication providers:
- Google
- Email/Password
3. Copy `.env.example` to `.env`.
4. Fill values in `.env`:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

## Current storage mode

Tasks are currently persisted in browser local storage, namespaced per logged-in user ID.

Theme is stored in:

- `daily_tasks_theme_v1`

## Free deployment

You can deploy this app for free on Vercel or Netlify.

Typical flow:

1. Push this project to GitHub.
2. Import repo in Vercel/Netlify.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Connect custom domain `dailytasks.in` in your hosting dashboard DNS settings.

## License

This project is licensed under the MIT License. See `LICENSE`.

What others can do:

- Use this code for personal or commercial projects
- Copy, modify, and redistribute it
- Include it inside paid products

What they must do:

- Keep the copyright notice and MIT license text

What is not guaranteed:

- No warranty or liability from the author

## Contributing

- Open an issue for bugs or feature requests
- Submit a pull request with clear change notes
