# How to Configure Unity License for GitHub Actions

To build this project using GitHub Actions, you need to provide your Unity credentials and license file as **GitHub Secrets**.

## 1. Gather Required Information

You will need three pieces of information:

1.  **UNITY_EMAIL**: The email address you use to log in to Unity.
2.  **UNITY_PASSWORD**: The password for your Unity account.
3.  **UNITY_LICENSE**: A specialized XML string containing your license details.

---

## 2. How to Get the `UNITY_LICENSE`

The easiest way to generate the license file needed for CI/CD (GameCI) is to use the **GameCI Activation Action**. However, since you might not have that set up, here is the manual method:

### Method A: Using the GameCI Portal (Recommended)
1.  Go to the [GameCI Activation Request Page](https://license.game.ci/).
2.  Log in with your Unity ID.
3.  Request a **Personal License** (Free) or Pro license.
4.  Copy the content of the generated license file (XML format).

### Method B: Extracting from Local Machine (Windows/Mac)
If you have Unity Hub and Unity installed locally:
1.  Open Unity Hub and ensure you are logged in and have an active license.
2.  Locate the license file (`.ulf`):
    *   **Windows:** `C:\ProgramData\Unity\Unity_lic.ulf`
    *   **Mac:** `/Library/Application Support/Unity/Unity_lic.ulf`
3.  Open this file in a text editor (Notepad, TextEdit).
4.  Copy the **entire content** of the file.

---

## 3. Setting Up GitHub Secrets

Once you have the data, add them to your GitHub Repository:

1.  Go to your GitHub Repository page.
2.  Click **Settings** (top tab).
3.  In the left sidebar, go to **Secrets and variables** > **Actions**.
4.  Click the **New repository secret** button.
5.  Add the following secrets one by one:

| Name | Value |
| :--- | :--- |
| `UNITY_EMAIL` | Your Unity account email. |
| `UNITY_PASSWORD` | Your Unity account password. |
| `UNITY_LICENSE` | Paste the **entire content** of the license file (`.ulf`) you copied earlier. |

### Important Note
The `UNITY_LICENSE` content usually starts with `<root>` or `<license>` and contains many lines of XML. Ensure you copy everything including the tags.
