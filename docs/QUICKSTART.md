# LLM Wiki CLI — Step-by-Step Guide for Beginners

This guide assumes you have never used a command-line tool before. We will go very slowly. If you already know how to use a terminal, you may prefer `docs/USAGE.md`.

---

## What this tool does

LLM Wiki CLI turns a folder of PDFs into a small website-like collection of notes written in Markdown. Each PDF becomes pages you can read, click through, and search. This is useful if you are a journalist, researcher, or anyone who needs to find connections between many documents.

Each group of PDFs is called a **wiki**. You can have many wikis, and the tool builds a top-level index called **index-of-indexes** that lists them all.

---

## Before you start

You need:

1. **A computer** with Windows, macOS, or Linux.
2. **Node.js** installed. This is the runtime that runs the tool.
   - Check if you have it by opening a terminal and typing:
     ```bash
     node --version
     ```
   - If you see a number like `v20.0.0` or higher, you are good.
   - If you see nothing or an error, download Node.js from [https://nodejs.org](https://nodejs.org) and install it. The LTS (Long Term Support) version is recommended.
3. **PDFs** you want to analyze.

---

## Step 1: Open a terminal

A terminal is a text window where you type commands.

- **Windows:** Press `Win + R`, type `cmd`, and press Enter. Or use Git Bash if you have it.
- **Mac:** Press `Cmd + Space`, type `Terminal`, and press Enter.
- **Linux:** Search for `Terminal` in your applications menu.

You should see a window with a blinking cursor and some text.

---

## Step 2: Navigate to the project folder

The project folder is where the LLM Wiki CLI code lives. In this example, it is called `Wiki v4`.

Type this command and press Enter:

```bash
cd "C:\Users\atavi\Projects\Wiki v4"
```

Or on Mac/Linux:

```bash
cd /path/to/Wiki\ v4
```

You can find the path by right-clicking the folder in your file explorer and choosing "Copy as path" (Windows) or by dragging the folder into the terminal (Mac).

---

## Step 3: Install the tool

Before the tool can run, it needs to download some helper libraries. Type this and press Enter:

```bash
npm install
```

Wait for it to finish. You will see lots of text. It may take a minute or two. When it finishes, you will see the command prompt again.

---

## Step 4: Build the tool

The tool is written in TypeScript. It needs to be compiled into JavaScript so Node can run it. Type:

```bash
npm run build
```

After this finishes, there will be a `dist/` folder in the project directory. Do not worry about editing anything in there.

---

## Step 5: Create a workspace

A **workspace** is just a folder on your computer where your wikis and their output will live. It can be anywhere. In this example, we will create one on your Desktop.

Type:

```bash
mkdir -p "C:\Users\atavi\Desktop\my-wiki-workspace"
```

On Mac/Linux:

```bash
mkdir -p ~/Desktop/my-wiki-workspace
```

---

## Step 6: Create your first wiki

A wiki is a group of related PDFs. In this example, we will make a wiki called `acme-reports` for yearly reports from a company called Acme.

Type:

```bash
mkdir -p "C:\Users\atavi\Desktop\my-wiki-workspace\wikis\acme-reports\raw"
```

On Mac/Linux:

```bash
mkdir -p ~/Desktop/my-wiki-workspace/wikis/acme-reports/raw
```

The `raw` folder is where you put the PDFs.

---

## Step 7: Copy your PDFs into the raw folder

Use your file explorer to copy your PDFs into the `raw` folder you just created.

Or you can do it in the terminal. For example:

```bash
cp "C:\Users\atavi\Downloads\acme-2022-annual.pdf" "C:\Users\atavi\Desktop\my-wiki-workspace\wikis\acme-reports\raw\"
cp "C:\Users\atavi\Downloads\acme-2023-annual.pdf" "C:\Users\atavi\Desktop\my-wiki-workspace\wikis\acme-reports\raw\"
```

On Mac/Linux:

```bash
cp ~/Downloads/acme-2022-annual.pdf ~/Desktop/my-wiki-workspace/wikis/acme-reports/raw/
cp ~/Downloads/acme-2023-annual.pdf ~/Desktop/my-wiki-workspace/wikis/acme-reports/raw/
```

You can add as many PDFs as you want.

---

## Step 8: Pick one PDF to analyze

The tool has a special command called `sample`. It looks at one PDF, learns about its structure, and writes a few starter files for the wiki. Pick the most typical PDF in your group.

In this example, our PDF is called `acme-2022-annual.pdf`.

Type this command:

```bash
npm run dev -- sample acme-reports "C:\Users\atavi\Desktop\my-wiki-workspace\wikis\acme-reports\raw\acme-2022-annual.pdf" -w "C:\Users\atavi\Desktop\my-wiki-workspace"
```

On Mac/Linux:

```bash
npm run dev -- sample acme-reports ~/Desktop/my-wiki-workspace/wikis/acme-reports/raw/acme-2022-annual.pdf -w ~/Desktop/my-wiki-workspace
```

What this command means:

- `npm run dev --` = run the tool in development mode
- `sample` = the command to analyze one PDF
- `acme-reports` = the name of your wiki
- the long path = the PDF to analyze
- `-w` = "workspace", the folder containing your wikis

Press Enter and wait. The tool will print progress. When it finishes, you will see a summary.

---

## Step 9: Look at what `sample` created

Open the folder `my-wiki-workspace/wikis/acme-reports` in your file explorer. You should see new files:

- `config.json` — settings for this wiki
- `chunking-strategy.md` — a report explaining how the PDF was split
- `AGENTS.md` — rules for the wiki pages
- `output/documents/...` — one or more pages extracted from the PDF
- `output/sources/...` — a source page describing the PDF
- `output/raw/...` — only appears if some pages were scanned images

Open `chunking-strategy.md` in any text editor and read it. It tells you how the PDF was understood and how it was split into chunks.

Also open the generated document page in `output/documents/`. It contains the extracted text and tables.

---

## Step 10: Enable full ingestion

Before the tool will process all your PDFs, you must tell it that the wiki is ready.

Open `my-wiki-workspace/wikis/acme-reports/config.json` in a text editor.

Find this line:

```json
"status": "draft"
```

Change it to:

```json
"status": "ready"
```

Save the file and close the editor.

---

## Step 11: Run full ingestion

Now the tool will process every PDF in the `raw` folder.

Type:

```bash
npm run dev -- ingest acme-reports -w "C:\Users\atavi\Desktop\my-wiki-workspace"
```

On Mac/Linux:

```bash
npm run dev -- ingest acme-reports -w ~/Desktop/my-wiki-workspace
```

Wait for it to finish. It will tell you:

- how many PDFs it processed
- how many document pages it created
- how many entity pages it created
- how many topic pages it created
- any warnings

---

## Step 12: Explore the results

Open these files in any text editor:

1. `my-wiki-workspace/index-of-indexes.md`
   - This is the roadmap. It lists all your wikis.
2. `my-wiki-workspace/wikis/acme-reports/output/index.md`
   - This is the wiki-level index. It lists all the pages inside this wiki.

From the wiki-level index, you can follow `[[Page Title]]` links to:

- **document pages** — the actual text from the PDFs
- **source pages** — metadata about each PDF
- **entity pages** — people, organizations, or places mentioned often
- **topic pages** — recurring themes
- **raw pages** — pages that could not be read cleanly

---

## Step 13: Add a new PDF later

When you get a new PDF:

1. Copy it into the `raw` folder.
2. Run the same ingest command again:

   ```bash
   npm run dev -- ingest acme-reports -w "C:\Users\atavi\Desktop\my-wiki-workspace"
   ```

The tool will detect the new PDF and only re-process what changed. It will not delete your existing pages.

---

## Step 14: Check the status of your workspace

To see a quick summary of all wikis and how many pages they have, type:

```bash
npm run dev -- status -w "C:\Users\atavi\Desktop\my-wiki-workspace"
```

On Mac/Linux:

```bash
npm run dev -- status -w ~/Desktop/my-wiki-workspace
```

---

## Step 15: Add more wikis

If you have a different group of PDFs, create another wiki:

```bash
mkdir -p "C:\Users\atavi\Desktop\my-wiki-workspace\wikis\legal-depositions\raw"
```

Copy PDFs into that folder, run `sample` for it, then run `ingest`. You can run `ingest-all` to process every wiki at once:

```bash
npm run dev -- ingest-all -w "C:\Users\atavi\Desktop\my-wiki-workspace"
```

---

## If something goes wrong

| Problem | What to do |
|---|---|
| `node --version` does not work | Install Node.js from [https://nodejs.org](https://nodejs.org). |
| `npm install` fails | Check your internet connection and try again. |
| The command is very long | You can use shorter paths, but make sure they are correct. |
| It says "Wiki is not marked as ready" | Open `config.json` and change `"status": "draft"` to `"status": "ready"`. |
| It says "Workspace not found" | Make sure the `-w` path points to an existing folder. |
| Some pages look empty | The PDF pages may be scanned images. The tool will save them as `raw` pages instead of dropping them. |

---

## Optional: use an LLM

If you want the CLI to use an LLM for structure discovery, enable it in your workspace config.

The easiest way is to run the interactive wizard:

```bash
npm run dev -- configure-llm -w "C:\Users\atavi\Desktop\my-wiki-workspace"
```

The wizard will ask you for:

1. Provider (default: `kimi`)
2. Model (default: `k2.7-code`)
3. Base URL (default: `https://api.kimi.com/coding`)
4. API key (hidden while you type)

After saving the config, it asks if you want to test the connection. If you say yes, it sends a test prompt and prints the response.

> **Note:** If `test-llm` prints `Connection successful.` but the response text is empty, the model may have returned only a non-text block (e.g., a thinking block). Run `test-llm --verbose` to inspect the raw response.

For scripts or if you already know the values, you can pass them as flags:

```bash
npm run dev -- configure-llm --provider kimi --api-key "sk-kimi-..." -w "C:\Users\atavi\Desktop\my-wiki-workspace"
```

You can also test the connection manually:

```bash
npm run dev -- test-llm -w "C:\Users\atavi\Desktop\my-wiki-workspace"
```

Or with a custom prompt:

```bash
npm run dev -- test-llm -w "C:\Users\atavi\Desktop\my-wiki-workspace" --prompt "Summarize the purpose of this tool."
```

Never commit the `.kimi-code/config.json` file. The CLI works without an LLM if you leave it disabled.

- Do not put API keys in files you share with others.
- You can always delete the `output/` folder and re-run `ingest` to regenerate the pages.
