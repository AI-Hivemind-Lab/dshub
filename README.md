# Team Hub

Shows each Digitization Squad member their ClickUp sub-tasks in flight on a chosen date, grouped by
fund task, with the CS/testing Slack links and attachments for each fund task.

## Local development

1. `cp .env.example .env.local` and fill in the values.
2. To find team and space IDs, run `curl -H "Authorization: $CLICKUP_TOKEN" https://api.clickup.com/api/v2/team`
   (team ID), then `.../team/<team_id>/space` (space ID).
3. In Google Cloud Console, add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
4. `npm install && npm run dev`, then open http://localhost:3000.

## Tests

`npm test`

## Deploy (Dokploy)

1. Create an Application from this git repo with build type **Dockerfile**.
2. Set environment variables from `.env.example`. Set `AUTH_URL` to the public URL (e.g. `https://hub.example.com`).
3. In Google Cloud Console, add `<AUTH_URL>/api/auth/callback/google` as a redirect URI.
4. Container port: `3000`. The image defines a Docker HEALTHCHECK against `/api/health`, so no Dokploy health-check setting is needed.
5. Deploy. Caches are in memory, so restarts only cost one slower first load.
