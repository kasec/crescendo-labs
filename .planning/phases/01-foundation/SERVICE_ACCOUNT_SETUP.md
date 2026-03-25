# Service Account Setup Guide

## Task 3: Create Dedicated Service Account

**Status:** REQUIRES MANUAL ACTION

This task cannot be automated and requires browser interaction.

---

## Steps to Complete

### Step 1: Create New Gmail Account

1. Go to https://gmail.com
2. Click "Create account"
3. Create account with naming convention: `lab-bot-{yourdomain}@gmail.com`
   - Example: `lab-bot-crescendo@gmail.com`
4. Complete account verification
5. **Document the email address** for configuration

### Step 2: Create Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Click "Create Project" or "New Project"
3. Project name: `imss-lab-appointments`
4. Click "Create"
5. Wait for project creation (may take a few moments)

### Step 3: Enable Gmail API

1. In Google Cloud Console, select your project (`imss-lab-appointments`)
2. Navigate to: `APIs & Services` > `Library`
3. Search for "Gmail API"
4. Click on "Gmail API"
5. Click "Enable"

### Step 4: Create OAuth 2.0 Credentials

1. Navigate to: `APIs & Services` > `Credentials`
2. Click "+ CREATE CREDENTIALS" > "OAuth client ID"
3. If prompted, configure "OAuth consent screen":
   - User Type: "External"
   - App name: "IMSS Lab Appointments Bot"
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Skip for now (we'll add in app)
   - Test users: Add your personal email for testing
4. Create OAuth Client ID:
   - Application type: "Other" (or "Desktop app")
   - Name: "IMSS Lab Bot CLI"
   - Click "Create"
5. Download the credentials JSON file

### Step 5: Install Credentials

1. Download the credentials JSON from Google Cloud Console
2. Move to OpenClaw directory:
   ```bash
   mv ~/Downloads/credentials-*.json ~/.openclaw/credentials.json
   ```
3. Set secure permissions:
   ```bash
   chmod 600 ~/.openclaw/credentials.json
   ```

---

## Verification

After completing these steps, verify:

```bash
# Check credentials file exists
ls -la ~/.openclaw/credentials.json

# Should show: -rw------- (600 permissions)
```

---

## Security Notes

- **NEVER** commit `credentials.json` to git
- **NEVER** use personal Gmail account for this bot
- Store backup of credentials in secure password manager
- Credentials file is excluded from git via `.gitignore`

---

## Next Steps

After completing this task:
1. Update gateway configuration with service account email
2. Proceed to Task 4: Configure Gmail OAuth
