# GhostEye Chrome Extension

This starter connects a Chrome Manifest V3 extension to the local
`ghosteye_api.py` vision script.

## Architecture

Chrome tab
  -> captureVisibleTab()
  -> local FastAPI server
  -> ghosteye_api.py
  -> Gemini
  -> JSON result
  -> extension popup

## 1. Install backend dependencies

```powershell
pip install -r requirements.txt
```

## 2. Set your Gemini key

Do NOT put the key in the extension.

PowerShell:

```powershell
$env:GEMINI_API_KEY="YOUR_NEW_KEY"
```

## 3. Start the local API

Make sure `ghosteye_api.py` is in the same folder as `server.py`.

```powershell
uvicorn server:app --host 127.0.0.1 --port 8000
```

Test:

```text
http://127.0.0.1:8000/health
```

You should see:

```json
{"status":"ok","service":"ghosteye"}
```

## 4. Load the extension

Open:

```text
chrome://extensions
```

Enable:

```text
Developer mode
```

Choose:

```text
Load unpacked
```

Select the `ghosteye_browser_extension` folder.

## 5. Test

Open an ordinary webpage.

Click the GhostEye extension icon.

Click:

```text
Analyze Current Tab
```

The extension captures the visible tab and sends it to the local
GhostEye service.

## Important privacy note

This starter version sends the captured screenshot from the extension
to the local Python service, and the current `ghosteye_api.py` then sends
that image to Gemini.

That is useful for the first integration test, but it is NOT yet the
final ISRO privacy architecture.

The next stage should be:

```text
Screenshot
  -> local PII detection
  -> local redaction
  -> sanitized screenshot
  -> Gemini/server
```
