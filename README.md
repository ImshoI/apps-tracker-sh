# apps-tracker-sh

Private, noindex tracker for prepared and submitted applications.

Live site: https://imshoi.github.io/apps-tracker-sh/

## Update after an application

From this directory:

```bash
# Option A — merge a new/updated record, copy assets, commit, and push
./update.sh /path/to/record.json

# Option B — edit data/applications.json (and copy files) yourself, then
./update.sh
```

A record looks like:

```json
{
  "id": "company-slug",
  "company": "Company Name",
  "role": "Role title",
  "roleType": "Estimating | Project Coordination | Drafting / CAD",
  "location": "City, Country",
  "country": "UK or USA",
  "pay": "Pay as posted",
  "appliedVia": "Company site form | Jobvite | Lever | Zoho Recruit | Email draft | LinkedIn",
  "status": "Prepared | Submitted | Email draft for owner | Posting removed | Interview | Rejected | Offer",
  "date": "2026-11-22",
  "jobUrl": "https://...",
  "notes": "Optional",
  "resumeSource": "/path/to/resume.pdf",
  "screenshotSource": "/path/to/confirmation.png"
}
```

`resumeSource` and `screenshotSource` are local paths used only by the script. Screenshots are resized (max width 1200px) and saved as WebP. Do not put phone numbers, personal email, home address, or salary asks into the JSON or into screenshots.

The script refuses to copy a resume PDF if `pdftotext` finds a phone number in it.
