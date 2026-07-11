# Synex — Deploy Console

Your own internal tool: log in, pick a project, select its folder on your
computer, click **Push to GitHub**. Any host connected to that GitHub repo
(Vercel, Render, etc.) redeploys automatically — no terminal, no `git`
commands.

## What it does — and its one honest limitation

- Pushes new/changed files straight to a GitHub branch using GitHub's API
  (creates blobs → a tree → a commit → moves the branch pointer).
- Lets you also list specific paths to delete from the repo.
- Automatically skips `node_modules`, `.git`, `.vercel`, `.env`, and similar
  junk so you never accidentally upload secrets or huge folders.
- **Best for regular updates** (a handful of changed files). A giant
  first-time upload of a large project (hundreds of files/images) can be
  slow through a browser and may hit serverless time limits — for that
  one-time initial import, use `git push` once, then use Synex for every
  update after that.

## One-time setup

1. **MongoDB** — reuse an existing Atlas cluster (like the one from your
   Enifa project) or make a new free one. This only stores your project
   list (name, repo, branch) — nothing about the actual site code.
2. **GitHub Token** — go to `github.com/settings/tokens` → generate a
   classic token with the **`repo`** scope. This is what lets Synex push
   on your behalf.
3. Copy `.env.example` to `.env` and fill in:
   ```
   MONGODB_URI=...
   JWT_SECRET=...       (generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
   ADMIN_USERNAME=...   (only you should know this)
   ADMIN_PASSWORD=...
   GITHUB_TOKEN=...
   ```

## Deploy (Vercel, since that's your main platform)

1. Push this folder to its own new GitHub repo (e.g. `synex-deploy-console`).
2. In Vercel: **Add New → Project** → select that repo.
3. Add the 5 environment variables above under Settings → Environment
   Variables (check "Production").
4. Deploy. Visit `your-project.vercel.app` and log in.

## Using it

1. Log in.
2. **New Project** → give it a name, the GitHub owner (e.g. `Jonathan97k`),
   repo name (e.g. `Enifa-website`), and branch (`main`).
3. Click **Push** on that project → select the project's folder on your
   computer → review the file count shown → click **Push to GitHub**.
4. Watch the log — it'll show each batch uploading, then the final commit.
5. Whatever host is connected to that GitHub repo (Vercel, Render, etc.)
   will pick up the new commit and redeploy on its own.

## Local development
```bash
npm install
cp .env.example .env   # fill in real values
npm start
```
Visit `http://localhost:3000`.
