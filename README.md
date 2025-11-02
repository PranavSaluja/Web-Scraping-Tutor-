# Jira Scraper and Data Transformation Pipeline

This repository contains a Node.js-based data scraping and transformation pipeline that extracts public issue data from Apache’s Jira instance and converts it into a clean, structured JSONL format suitable for training Large Language Models (LLMs) or performing analytics.

---



## 🧩 High-Level Design

The following diagram illustrates the overall data flow of the system — from fetching issue data via the Jira REST API to producing the final JSONL dataset.

<img width="973" height="840" alt="Screenshot 2025-11-02 at 12 19 43 PM" src="https://github.com/user-attachments/assets/7c0b60bc-066f-43d2-abad-ec9f4cae9780" />


---

## 📘 Overview

The system connects to the public [Apache Jira](https://issues.apache.org/jira) REST API, fetches issues and their associated metadata (titles, descriptions, comments, priorities, assignees, timestamps, etc.), and processes the data into a consistent and LLM-ready structure.

It is built to be **fault-tolerant**, **resume from checkpoints**, and **respect rate limits**.  
The pipeline currently supports multiple Apache projects — such as **Spark**, **Kafka**, and **Airflow** — but can be extended to any project hosted on the Apache Jira instance.


---

## ⚙️ Features

- **Generic for all Apache Jira projects** — works with any project key (e.g., SPARK, KAFKA, HIVE).
- **Resumable scraping** — maintains checkpoints per project to continue from the last successful page.
- **Retry and rate limit handling** — exponential backoff and respect for HTTP 429 and 5xx responses.
- **Robust data transformation** — cleans HTML descriptions/comments to plain text and structures them for LLM use.
- **Extensible** — supports adding derived tasks like summarization or Q&A generation.

---

## 🏗️ Architecture

| Component | Responsibility |
|------------|----------------|
| **jiraClient.js** | Handles HTTP requests to Jira REST API with retry and backoff. |
| **scraper.js** | Paginates through Jira issues, saves raw pages, and updates checkpoints. |
| **transformer.js** | Reads raw data, cleans and normalizes it, and outputs JSONL. |
| **utils/htmlToText.js** | Converts HTML issue text and comments into plain text. |
| **checkpoints/** | Stores JSON files tracking progress for each project. |
| **raw/** | Stores raw pages fetched from Jira. |
| **out/** | Contains the final structured JSONL dataset. |

---

## 🧠 Data Flow Summary

1. **Scraper Phase**
   - Fetches issues via `/rest/api/2/search`.
   - Handles pagination (`startAt`, `maxResults`) and retries.
   - Saves each response to `raw/<PROJECT>/page_<n>.json`.
   - Updates checkpoint in `checkpoints/<PROJECT>.json`.

2. **Transformer Phase**
   - Reads all saved raw files.
   - Extracts and cleans relevant fields (summary, description, status, etc.).
   - Converts HTML to plain text and compiles structured JSON objects.
   - Writes one JSON object per line into `out/<PROJECT>.jsonl`.

---

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/PranavSaluja/jira-scraper-pipeline.git
cd jira-scraper-pipeline

# Install dependencies
npm install
```

## 📖 Usage

### Scrape Data for a Project

Fetch issues from Apache Jira and save them as raw JSON pages:
```bash
node src/scraper.js SPARK
```

This will:
- Fetch issues from the Apache SPARK Jira project
- Save raw JSON pages to `raw/SPARK/`
- Create or update a checkpoint in `checkpoints/SPARK.json`

**The system will automatically resume from the last saved page if interrupted.**

### Transform Raw Data into JSONL

Convert the raw scraped data into clean, structured JSONL format:
```bash
node src/transformer.js SPARK
```

This will:
- Read all raw JSON pages from `raw/SPARK/`
- Extract and clean metadata and comments
- Write structured JSON objects to `out/SPARK.jsonl`

---
## 🧠 Data Flow Summary

### 1. Scraper Phase
- Fetches issues via `/rest/api/2/search`
- Handles pagination (`startAt`, `maxResults`) and retries
- Saves each response to `raw/<PROJECT>/page_<n>.json`
- Updates checkpoint in `checkpoints/<PROJECT>.json`

### 2. Transformer Phase
- Reads all saved raw files
- Extracts and cleans relevant fields (summary, description, status, etc.)
- Converts HTML to plain text and compiles structured JSON objects
- Writes one JSON object per line into `out/<PROJECT>.jsonl`

---

## 📊 Output Schema

Each line in the generated JSONL file represents one issue:
```json
{
  "issue_id": "SPARK-12345",
  "project": "SPARK",
  "title": "Fix incorrect shuffle behavior",
  "status": "Resolved",
  "priority": "Major",
  "assignee": "Alice",
  "reporter": "Bob",
  "labels": ["bug", "shuffle"],
  "created_at": "2024-03-01T12:34:56Z",
  "updated_at": "2024-03-02T10:10:10Z",
  "description_plaintext": "The shuffle operation fails when...",
  "comments_plaintext": ["This was caused by...", "Fixed in PR #4567"],
  "derived": {
    "summary": "Fix shuffle behavior issue in Spark SQL."
  }
}
```
---

## ⚠️ Error Handling & Fault Tolerance

- **Network/Server errors (5xx)** → Automatic retries with exponential backoff
- **Rate limits (429)** → Honors `Retry-After` header and waits before retrying
- **Malformed data** → Logged and skipped gracefully
- **Checkpointing** → Ensures resumable scraping from last saved page

---

## 🧪 Example Projects Tested

| Project | Key | Result |
|---------|-----|--------|
| Apache Spark | `SPARK` | ✅ Successfully scraped and transformed |
| Apache Kafka | `KAFKA` | ✅ Successfully scraped and transformed |
| Apache Hadoop | `HADOOP` | ✅ Successfully scraped and transformed |

---

## 🔧 Extending

### To add more projects:

1. Find the project key on [Apache Jira Projects](https://issues.apache.org/jira)
2. Run:
```bash
node src/scraper.js 
node src/transformer.js 
```

3. The system will automatically generate raw and output data for that project.

---

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **HTTP Client:** Axios
- **Concurrency & Retry:** Custom exponential backoff
- **Data Cleaning:** html-to-text
- **File Handling:** fs/promises
- **Output Format:** JSONL

---

## 📞 Contact

**Pranav Saluja**  
- Email: pranavsaluja12345@gmail.com
- GitHub: [@PranavSaluja](https://github.com/PranavSaluja)
- Website: [pranavsaluja.in](https://www.pranavsaluja.in/)
- Location: Dadri, Uttar Pradesh, IN

