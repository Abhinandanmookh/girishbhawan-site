# Girish Bhawan website

Site for girishbhawanofficial.com, hosted on Netlify.

## Pages

- `/` home
- `/event/?e=...` photo wall for an event (Durga Puja 2026 to start with)
- `/nirghonto/?e=...` schedule for an event, with the Nirghonto card image
- `/album/?e=...` photos (from the event's Google Drive Images folder) and videos (from its YouTube playlist): thumbnails only, thumbs up/down, "ask for this photo" requests to the admin
- `/story/` Our story: a timeline anyone can add memories to, shown after admin approval
- `/tshirt/` (family login needed) dress orders (T-shirt, Kurti and any type you add): payments and the size-wise count for the printer
- `/section/?s=...` documents (Pujo Accounts, Bhog Accounts, and any you add)
- `/account/` family members register and log in
- `/admin/` approve members, manage groups, sections, events, links and backups

Pages are plain HTML in `public/`. One Netlify Function (`netlify/functions/api.mjs`, logic in
`server/app.mjs`) handles logins and saves everything in Netlify Blobs.

## What you can change without touching code

| Change | Where |
|---|---|
| Sizes, price, a different price for one size, GPay/UPI, for each dress type | Dress orders page, Admin section |
| Add a dress type (Kurti, Kurta, anything) with its own price, sizes, orders and report | Dress orders page, Admin section |
| Description, picture and whether a dress type shows on the home page as available | Dress orders page, Admin section |
| Approve requests to download full-size album photos | Admin page, Download requests |
| Add an event (next year's Pujo, Jagaddhatri Puja), who can see it, who can post | Admin page, Events |
| Add a documents section and choose which groups can open it | Admin page, Sections |
| Add or rename family groups | Admin page, Family groups |
| Approve, block or delete a member, set their groups, reset their password | Admin page, Family members |
| Facebook and Instagram links | Admin page, Social links |
| Nirghonto timings and card image | Nirghonto page, after admin login |

## Your data and code changes

Orders, members, posts, schedules, photos and documents are stored in Netlify Blobs, separately from
the code. Uploading new code to GitHub and redeploying does not touch them.

Deleting the Netlify site would delete them, so keep backups: Admin page > Backup > Download backup
gives one zip with everything. Restore from the same page.

## Put it live

1. **GitHub**: upload every file and folder from this zip to the repository, keeping the folder structure.
2. **Netlify**: the site is connected to the repository and redeploys by itself. Build command empty,
   publish directory `public`.
3. **Admin password**: environment variable `ADMIN_PASSWORD` in Netlify. Username is `admin`.
   Log in from "Log in or register" at the bottom of any page.

## Limits built in

- Photos are shrunk in the visitor's browser to at most 1600 px before upload.
- Documents: PDF, Excel, Word, PowerPoint, CSV, text and pictures, up to 4 MB each.
- A visitor can post 6 times an hour; 5 new accounts an hour per network; 8 wrong passwords lock
  login from that network for 15 minutes.
- Member accounts work only after the admin approves them. Blocking takes effect at once.
- There is no "forgot password" email. The admin sets a new password for the member.
- The T-shirt, section, account and admin pages are marked not to appear in search engines.

## Google Drive, YouTube and "Sign in with Google" (one-time setup, about 15 minutes)

Do this signed in as **abhi@wenpower.in** (the account that owns the Girish Bhawan Drive folder and manages the @GirishBhawan channel).

1. Go to https://console.cloud.google.com and create a project named **Girish Bhawan Website**.
2. **APIs & Services > Library**: enable **Google Drive API** and **YouTube Data API v3**.
3. **Google Auth Platform** (or "OAuth consent screen"):
   - App name **Girish Bhawan**, your support email, Audience **External**, your contact email. Save.
   - Under **Audience**, click **Publish app** so the status is **In production**. (In "Testing", the Drive connection
     stops after 7 days and only listed testers can sign in.)
4. **Clients > Create client > Web application**, name it "Girish Bhawan site", and add:
   - Authorized redirect URIs:
     - `https://girishbhawan.com/api/google/callback`
     - `https://www.girishbhawan.com/api/google/callback`
     - `https://YOUR-SITE.netlify.app/api/google/callback` (your Netlify address)
   - Create, then copy the **Client ID** and **Client secret**.
5. **Netlify > Site configuration > Environment variables**: add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
   (same way as ADMIN_PASSWORD), then **Deploys > Trigger deploy**.
6. On the site, **Admin page > Google Drive and YouTube > Connect Google Drive and YouTube**. Choose abhi@wenpower.in.
   Google will say the app is not verified: click **Advanced > Go to Girish Bhawan** and allow access. This warning is
   only for you as the admin; visitors who sign in only share their name and email and do not see it.
7. Open the Durga Puja 2026 album and check that the photos and the playlist videos appear.

If wenpower.in is a Google Workspace with app restrictions and Google blocks step 6, allow the app in
Google Admin console > Security > Access and data control > API controls.

### How the album works

- Photos are read from each event's `…_Images` Drive folder; videos from the event's YouTube playlist
  (Admin page > Events > YouTube playlist link). Visitors never get Drive links; only the admin does.
- Anyone signed in (Google or family login) can like or dislike and ask for a copy. Requests appear on the admin page
  with the person's name and email; share from Drive and mark as shared.
- Five or more thumbs down puts an item on the admin page to hide or keep.
- Photos uploaded on the site go into the Drive Images folder (from Google sign-ins: after admin approval).
  Videos uploaded on the site go into the Drive Videos folder for the admin to add to YouTube.
- **Number the photos** (album page, admin) renames the Drive photos in date order: DurgaPuja2026_0001.jpg and so on.
- New events get Drive folders `<Occasion><Year>`, `…_Images`, `…_Videos` under the Girish Bhawan folder when saved.
