# Swing Lab

Softball and baseball hitting and pitching metrics from phone video. Coaches see every player; each player signs in and sees only their own swings and pitches.

## One-time setup
1. **Upload** every file in this folder to the `swing-lab` repo (keep the `js/` and `tests/` folders).
2. **GitHub Pages:** repo → Settings → Pages → Source: *Deploy from a branch* → `main` / root → Save. The site appears at `https://cphelps1122.github.io/swing-lab/`.
3. **Firebase sign-in:** Firebase console → Build → Authentication → Get started → turn on **Email/Password**. Then Authentication → Settings → Authorized domains → add `cphelps1122.github.io`.
4. **Database rules:** Firestore Database → Rules → replace everything with `firestore.rules` → Publish.
5. **Video storage:** Build → Storage → Get started (needs the pay-as-you-go plan) → Rules → replace with `storage.rules` → Publish.
6. **Budget alert (recommended):** Google Cloud console → Billing → Budgets & alerts → $5.

## Using it
- Owner (`rice.chris.p4991@gmail.com`) taps **Create account** the first time, then signs in.
- **Team** button → add each player's name (exactly as typed on swings) and email. Add other coaches by email.
- Players open the site, tap **Create account** with that same email, and see only their clips.
- **Team → Bring over old library records** copies the 7 test records from the Claude version (numbers only).

## Tests (after any change)
- `node tests/filecheck.js`
- `python3 tests/ui/smoke.py <path to this folder>` (sign-in gate and home screen with Firebase stubbed)
