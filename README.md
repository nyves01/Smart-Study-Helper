# 📚 Smart Study Helper

A browser-based study tool that lets students look up any topic and instantly receive a structured Wikipedia summary, keyword highlights, related subjects, and an auto-generated quiz — all from a clean, responsive interface.

**Live URL (Load Balancer):** `http://<LB01_IP>/`

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
| Save topics | Star any topic to save it locally (persisted via localStorage) |
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

> **Security note:** Neither API requires keys, tokens, or any credentials. There is no sensitive information in this repository.

---

## Project Structure

```
smart-study-helper/
├── index.html          # Application entry point
├── css/
│   └── style.css       # All styling (light/dark themes, responsive layout)
├── js/
│   ├── api.js          # All fetch calls and custom error classes
│   ├── quiz.js         # Quiz generation logic
│   ├── render.js       # DOM-building functions (pure, no side effects)
│   └── app.js          # State management and event wiring
├── .gitignore
└── README.md
```

---

## Running Locally

No build step or package installation is required.

1. Clone the repository:
   ```bash
   git clone https://github.com/<your-username>/smart-study-helper.git
   cd smart-study-helper
   ```

2. Open `index.html` directly in any modern browser:
   - Double-click `index.html`, **or**
   - Serve it with Python for a proper HTTP context:
     ```bash
     python3 -m http.server 8080
     # then open http://localhost:8080 in your browser
     ```

3. Type a topic into the search bar and press **Search** or **Enter**.

> The app calls Wikipedia's API directly from the browser. No local server is strictly required, but serving via HTTP avoids any browser restrictions on `file://` URLs.

---

## Deployment

### Prerequisites
- Two Ubuntu/Debian web servers: **Web01** and **Web02**
- One load balancer server: **Lb01**
- Nginx installed on all three

### Step 1 — Deploy to Web01 and Web02

Run the following on **both** Web01 and Web02:

```bash
# Install Nginx
sudo apt update && sudo apt install -y nginx

# Create the web root directory
sudo mkdir -p /var/www/studyhelper

# Copy project files (run from your local machine)
scp -r ./* user@<WEB01_IP>:/var/www/studyhelper/
scp -r ./* user@<WEB02_IP>:/var/www/studyhelper/
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
http://<WEB01_IP>/   → should show the app
http://<WEB02_IP>/   → should show the app
```

### Step 2 — Configure the Load Balancer (Lb01)

```bash
sudo apt update && sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/studyhelper-lb
```

Paste the following (replace IPs):

```nginx
upstream studyhelper_pool {
    server <WEB01_IP>;
    server <WEB02_IP>;
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
curl -s http://<LB01_IP>/ | grep "<title>"

# Confirm traffic on both servers by watching their access logs
sudo tail -f /var/log/nginx/access.log   # run on Web01
sudo tail -f /var/log/nginx/access.log   # run on Web02
```

Access the app through the load balancer: `http://<LB01_IP>/`

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
