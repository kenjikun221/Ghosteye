from pathlib import Path
import tempfile

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import ghosteye_api


app = FastAPI(title="GhostEye Local Vision API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"chrome-extension://.*",
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ghosteye"
    }


@app.post("/analyze")
async def analyze(image: UploadFile = File(...)):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Please upload an image."
        )

    data = await image.read()

    if not data:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty."
        )

    suffix = Path(image.filename or "screenshot.png").suffix or ".png"

    with tempfile.NamedTemporaryFile(
        suffix=suffix,
        delete=False
    ) as temp:
        temp.write(data)
        temp_path = Path(temp.name)

    try:
        if hasattr(ghosteye_api, "analyze_image"):
            result = ghosteye_api.analyze_image(str(temp_path))

            if hasattr(result, "model_dump"):
                return result.model_dump()

            if isinstance(result, dict):
                return result

            return {
                "result": str(result)
            }

        if hasattr(ghosteye_api, "describe_image"):
            result = ghosteye_api.describe_image(str(temp_path))
            return {
                "description": result
            }

        raise HTTPException(
            status_code=500,
            detail=(
                "ghosteye_api.py must contain analyze_image() "
                "or describe_image()."
            )
        )

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc)
        )

    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except Exception:
            pass
