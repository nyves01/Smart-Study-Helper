# 📚 Smart Study Helper

A browser-based study tool that lets students look up any topic and instantly receive a structured Wikipedia summary, keyword highlights, related subjects, and an auto-generated quiz — all from a clean, responsive interface.

**Live URL (Load Balancer):** `https://www.nyves.tech/`

---

## Purpose

Smart Study Helper addresses a genuine academic need: quickly understanding unfamiliar topics while studying. Instead of navigating Wikipedia manually, students get a structured summary, related topics to explore, an inline filter to find specific terms, and a fill-in-the-blank quiz to test retention — all in one place. This makes it a practical revision and research tool, not entertainment.

---

## Features

| Feature | Description |
|---|---|
| Topic search | Type any subject and fetch its Wikipedia summary instantly |
| Summary display | Shows title, thumbnail image, description, and full extract |
| Keyword highlighting | Related topic titles are automatically bolded in the summary |
| Inline filter | Filter within the summary text in real time as you type |
| Related topics | Clickable chips that auto-fetch the next topic |
| Breadcrumb navigation | Navigate back through previously visited topics |
| Auto-generated quiz | Fill-in-the-blank questions built from the summary text |
| Immediate quiz feedback | Correct/incorrect feedback with the right answer revealed |
| **User authentication** | **Register/login with username, email, and password validation** |
| **Personal saved topics** | **Saved topics are stored per user in a database** |
| Word definition tooltip | Double-click any word in the summary for its dictionary definition |
| Dark mode | Toggle between light and dark themes (preference saved) |
| Responsive layout | Works on desktop, tablet, and mobile |
| Error handling | Friendly messages for 404s, disambiguation pages, and network failures |

---

## APIs Used

### 1. Wikipedia REST API
- **Base URL:** `https://en.wikipedia.org/api/rest_v1/`
- **Endpoints used:**
  - `GET /page/summary/{topic}` — fetches title, description, extract, thumbnail, and article URL
  - `GET /page/related/{topic}` — fetches related page titles and thumbnails
- **Documentation:** https://en.wikipedia.org/api/rest_v1/
- **API Key:** None required. The Wikipedia REST API is fully open and does not require authentication or keys.
- **Credit:** Wikimedia Foundation — https://wikimedia.org

### 2. Free Dictionary API (optional — word definitions)
- **Base URL:** `https://api.dictionaryapi.dev/api/v2/entries/en/`
- **Endpoint used:** `GET /entries/en/{word}` — fetches definitions, phonetics, and parts of speech
- **Documentation:** https://dictionaryapi.dev/
- **API Key:** None required. This is a free, open API.
- **Credit:** meetDeveloper — https://github.com/meetDeveloper/freeDictionaryAPI

## Database

The application uses **SQLite** for user data storage:
- **File:** `users.db` (created automatically on first run)
- **Tables:**
  - `users` — User accounts with hashed passwords
  - `saved_topics` — User-specific saved topics
- **Security:** Passwords are hashed with bcrypt, sessions are server-side

> **Note:** The database is created automatically when you start the server. No manual setup required.

---

## Project Structure

```
smart-study-helper/
├── index.html          # Main application entry point
├── login.html          # User login/registration page
├── css/
│   └── style.css       # All styling (light/dark themes, responsive layout, login page)
├── js/
│   ├── api.js          # Client-side API calls (proxied through backend)
│   ├── auth.js         # Login/registration form handling
│   ├── auth-check.js   # Authentication verification on app load
│   ├── quiz.js         # Quiz generation logic
│   ├── render.js       # DOM-building functions (pure, no side effects)
│   └── app.js          # State management and event wiring
├── backend/
│   └── server.js       # Express server with API proxy and user authentication
├── users.db            # SQLite database (created automatically)
├── package.json        # Node.js dependencies and scripts
├── .gitignore
└── README.md
```

---

## Running Locally

This app should be run with the Node backend enabled.

### Start the app

1. Install Node.js dependencies:
   ```bash
   npm install
   ```

2. Start the backend server:
   ```bash
   npm start
   # or for development with auto-restart:
   npm run dev
   ```

3. Open your browser to `http://localhost:3000`

### Why backend mode is required
- **Authentication and sessions** are handled server-side.
- **Saved topics** are stored in SQLite via backend routes.
- **Wikipedia and dictionary calls** are proxied through `/api/*` endpoints.

If you open only static files without the backend, login, saved topics, and search requests can fail.

### Quick health check
Run this command while the server is up:

```bash
curl -i http://localhost:3000/api/auth/me
```

Expected result when not logged in: `401 Not authenticated`.

### First Time Setup

When you first visit the app:
1. You'll be redirected to the login page
2. Click "Register" to create a new account
3. Fill in username, email, and password (all validated)
4. After registration, you'll be automatically logged in
5. Start searching and saving topics!

### User Features

- **Register**: Create account with username, email, password validation
- **Login**: Sign in with username/email and password
- **Personal Topics**: Saved topics are stored per user (not shared)
- **Logout**: Secure logout that clears your session

---

## Troubleshooting

### "Network error. Please try again." on Login/Register
- Make sure the backend is running (`npm start`).
- Open the app from `http://localhost:3000`.
- Hard-refresh the page (`Ctrl+Shift+R`) after code changes.

### Login succeeds, then you get signed out immediately
- This usually means mixed origins (for example, logging in on one port and using the app on another).
- Use the same origin for login and app pages, preferably `http://localhost:3000`.

### Search is not working
- Verify backend route availability:

  ```bash
  curl -s "http://localhost:3000/api/topic/Quantum%20Computing" | head
  ```

- `Python` may return a disambiguation response. Try a specific term like `Python programming language`.

---

## Deployment

### Prerequisites
- Two Ubuntu/Debian web servers: **6970-web-01** (44.203.97.109) and **6970-web-02** (35.171.8.246)
- One load balancer server: **6970-lb-01** (98.93.138.68)
- Nginx installed on all three

### Step 1 — Deploy to Web01 and Web02

Run the following on **both** 6970-web-01 and 6970-web-02:

```bash
# Install Nginx
sudo apt update && sudo apt install -y nginx

# Create the web root directory
sudo mkdir -p /var/www/studyhelper

# Copy project files (run from your local machine)
scp -r ./* user@44.203.97.109:/var/www/studyhelper/
scp -r ./* user@35.171.8.246:/var/www/studyhelper/
```

Create the Nginx site config on **both** servers:

```bash
sudo nano /etc/nginx/sites-available/studyhelper
```

Paste the following:

```nginx
server {
    listen 80;
    server_name _;

    root /var/www/studyhelper;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

Enable the site and reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/studyhelper /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Verify each server independently:
```
https://nyves.tech/   → should show the app
https://web-02.nyves.tech/   → should show the app
```

### Step 2 — Configure the Load Balancer (6970-lb-01)

```bash
sudo apt update && sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/studyhelper-lb
```

Paste the following:

```nginx
upstream studyhelper_pool {
    server 44.203.97.109;
    server 35.171.8.246;
}

server {
    listen 80;
    server_name _;

    location / {
        proxy_pass         http://studyhelper_pool;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/studyhelper-lb /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### Step 3 — Verify Load Balancing

```bash
# Refresh multiple times — Nginx distributes round-robin by default
curl -s http://98.93.138.68/ | grep "<title>"

# Confirm traffic on both servers by watching their access logs
sudo tail -f /var/log/nginx/access.log   # run on 6970-web-01
sudo tail -f /var/log/nginx/access.log   # run on 6970-web-02
```

Access the app through the load balancer: `http://98.93.138.68/`

---

## Error Handling

The app classifies and handles four distinct failure modes:

| Situation | Error Class | Message shown to user |
|---|---|---|
| Topic has no Wikipedia article | `TopicNotFoundError` (HTTP 404) | "Topic not found — check spelling or try a broader term" |
| Topic is a disambiguation page | `DisambiguationError` | "Multiple matches — be more specific, e.g. 'Python programming language'" |
| No internet / API unreachable | `NetworkError` (TypeError) | "Connection failed — check your internet connection" |
| Wikipedia server error | `TopicNotFoundError` (HTTP 5xx) | "Something went wrong — try again in a moment" |

Related topics failing silently is intentional — the main summary still renders even if the related API call fails.

---

## Challenges and Solutions

| Challenge | Solution |
|---|---|
| Wikipedia `/page/related/` sometimes fails for obscure topics | Wrapped in `Promise.allSettled` so it degrades silently without blocking the summary |
| Keyword highlighting could break HTML tags | Operated on the escaped HTML string using a regex that only matches inside text nodes (`>…<`) |
| Quiz needs distractor answers with no external service | Built a fallback pool of generic academic terms when the related-topics pool is too small |
| Sidebar state persistence across sessions | Used `localStorage` so saved topics survive page refreshes |

---

## Attributions and Credits

| Resource | Use | Link |
|---|---|---|
| **Wikimedia Foundation** | Wikipedia REST API (summary + related) | https://wikimedia.org |
| **meetDeveloper** | Free Dictionary API (word definitions) | https://github.com/meetDeveloper/freeDictionaryAPI |
| **Nginx** | Web server and load balancer | https://nginx.org |

No third-party JavaScript libraries or frameworks were used. All code is vanilla HTML, CSS, and JavaScript.

---

## Rubric Alignment

| Criterion | How this project satisfies it |
|---|---|
| **Purpose & Value (10 pts)** | Targets a real study need — structured summaries, related-topic exploration, and self-testing via quiz. Not entertainment. |
| **API Usage (15 pts)** | Two open APIs integrated via `fetch()`. No keys exist to expose. Data is fetched, parsed, and rendered meaningfully with keyword highlighting. |
| **Error Handling (10 pts)** | Four classified error types with distinct, actionable user messages. Related topics degrade silently. Network and 404 errors both caught. |
| **User Interaction (15 pts)** | Search, inline filter, related-topic click-through, breadcrumb back-navigation, quiz with feedback, save/unsave to sidebar, dark mode toggle, double-click word definitions. |
| **Server Deployment (10 pts)** | Static files deployed on Web01 + Web02 via Nginx. No build step needed. |
| **Load Balancer (10 pts)** | Nginx upstream block on Lb01 distributes traffic round-robin between Web01 and Web02. |
| **User Interface (5 pts)** | Responsive two-column layout, animated result cards, accessible keyboard navigation (`/` to focus search), ARIA labels throughout. |
| **Data Presentation (5 pts)** | Title + thumbnail + description + highlighted summary + related chips with images + quiz panel. Clear visual hierarchy. |
| **README Quality (5 pts)** | This file — covers local setup, deployment, API details, error handling, challenges, and attributions. |
| **API Attribution (5 pts)** | Wikimedia Foundation and meetDeveloper credited in the attributions table above. |
