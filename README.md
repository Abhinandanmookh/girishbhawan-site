# Girish Bhawan website

Site for girishbhawanofficial.com, hosted on Netlify.

- `/` home
- `/durga-puja-2026/` family wall: anyone can post a photo or a link with a comment
- `/durga-puja-2026/nirghonto/` schedule of the Pujo (edited by the admin on the page)
- `/tshirt/` T-shirt orders, payments and the size-wise count for the printer

Pages are plain HTML in `public/`. One Netlify Function (`netlify/functions/api.mjs`, logic in
`server/app.mjs`) handles the admin login and saves everything in Netlify Blobs. No database to set up.

## Put it live

1. **GitHub**: create a new private repository (for example `girishbhawan-site`) and upload every
   file and folder from this zip, keeping the folder structure. Do not upload `node_modules`.
2. **Netlify**: Add new site > Import an existing project > GitHub > pick the repository.
   Leave the build command empty. Publish directory is `public` (already set in `netlify.toml`).
3. **Admin password**: Site configuration > Environment variables > add
   `ADMIN_PASSWORD` with a password of your choice (12 or more characters). Then Deploys > Trigger deploy.
   Username is `admin`. To change the password later, change this variable and redeploy.
4. **Domain**: Domain management > Add a domain > `girishbhawanofficial.com`, then follow Netlify's
   instructions to point the GoDaddy DNS at Netlify. HTTPS is switched on by Netlify.

## Using it

- Click **Admin login** at the bottom of any page.
- **Wall**: new posts wait for your approval. Approve or delete them on the wall page. A checkbox there
  lets posts appear without approval if you prefer.
- **Nirghonto**: log in, then upload the Nirghonto card image (it replaces the placeholder at the top) and/or edit the text box. A line starting with `#` is a day (`# Maha Saptami | Sunday, 18 October`);
  each line under it is `time | event`.
- **T-shirts**: upload a CSV or paste a list, record payments, download the report.

## Limits built in

- Photos are shrunk in the visitor's browser to at most 1600 px before upload.
- A visitor can post 6 times an hour; 8 wrong admin passwords lock login from that network for 15 minutes.
- The T-shirt page is marked not to appear in search engines.
