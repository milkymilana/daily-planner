# Daily Planner — GitHub Pages + Supabase

A private, responsive daily bug-bounty planner.

## Project layout

```text
index.html
app.js
styles.css
config.js
supabase/
  schema.sql
README.md
```

## Security model

- GitHub Pages hosts the public frontend.
- Supabase Auth controls login.
- PostgreSQL stores planner data.
- Row Level Security (RLS) restricts rows to `auth.uid() = user_id`.
- `config.js` contains only the Supabase URL and publishable/anon key.
- NEVER put a Supabase service-role/secret key in this project.
- The initial password is NOT stored in the frontend.

## Setup

### 1. Create GitHub repository

Create a public GitHub repository, for example:

`daily-planner`

Upload all files while preserving the folders.

Enable:

`Settings → Pages → Deploy from branch → main → / (root)`

### 2. Create Supabase project

Create a free Supabase project.

Open:

`SQL Editor → New query`

Paste the entire contents of:

`supabase/schema.sql`

Run it.

### 3. Create your private user

Open:

`Authentication → Users → Add user`

Create your email account.

For the initial password, use the password you requested:

`hunter99`

Treat this as a temporary password and change it immediately after first login from:

`Settings → Change password`

Do not put `hunter99` into `config.js`, `app.js`, GitHub, SQL, or any client-side file.

### 4. Get Supabase client settings

Open your Supabase project's API/connect settings and copy:

- Project URL
- Publishable/anon client key

Put them into `config.js`:

```js
window.PLANNER_CONFIG = {
  SUPABASE_URL: "YOUR_PROJECT_URL",
  SUPABASE_ANON_KEY: "YOUR_PUBLISHABLE_OR_ANON_KEY"
};
```

Do NOT use the service-role/secret key.

### 5. Commit and deploy

Push the updated `config.js` to GitHub.

Open your GitHub Pages URL.

You should see the login screen.

### 6. Login

Use the email you created in Supabase and the initial password:

`hunter99`

Immediately change it from Settings.

## What is public?

The HTML/CSS/JS frontend is public because GitHub Pages is static hosting.

That is normal.

Your planner records are protected by:

1. Supabase Auth
2. PostgreSQL
3. Row Level Security

A visitor who is not authenticated cannot read your planner rows through the Supabase API.

## Local cache

The application keeps a local cache so the UI remains useful during temporary connectivity problems.

Supabase is the cloud source of truth once configured.

Use Export occasionally as an additional backup.

## Important limitation

GitHub Pages does NOT make the source code private. Do not put:

- passwords
- service-role keys
- private API secrets
- recovery codes
- tokens

into the repository.

## Initial password

The requested initial password is `hunter99`.

It is deliberately documented only as a setup instruction and is NOT embedded in the application code.

Change it after the first login.
