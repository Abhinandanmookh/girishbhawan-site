# Girish Bhawan website

Site for girishbhawanofficial.com, hosted on Netlify.

## Pages

- `/` home
- `/event/?e=...` photo wall for an event (Durga Puja 2026 to start with)
- `/nirghonto/?e=...` schedule for an event, with the Nirghonto card image
- `/tshirt/` dress orders (T-shirt, Kurti and any type you add): payments and the size-wise count for the printer
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
