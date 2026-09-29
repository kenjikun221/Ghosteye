import os
import sys
import time
import json
from pathlib import Path

from google import genai
from google.genai import types
from PIL import Image
from pydantic import BaseModel, Field


# =========================================================
# CONFIGURATION
# =========================================================

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is not set.\n"
        "Set it before running the script."
    )

client = genai.Client(api_key=API_KEY)

MODEL = "gemini-3.5-flash-lite"

# IMPORTANT:
# True  = return actual sensitive text for controlled dataset creation
# False = return [REDACTED] instead
TRAINING_MODE = True


# =========================================================
# STRUCTURED OUTPUT MODELS
# =========================================================

class UIElement(BaseModel):
    type: str = Field(
        description="button, input, link, checkbox, menu, tab, icon, image, text, etc."
    )
    label: str = Field(
        description="Visible label or short description."
    )
    bbox: list[int] = Field(
        description="[x1,y1,x2,y2], normalized to 0-1000."
    )
    confidence: float = Field(
        description="Confidence from 0.0 to 1.0."
    )


class TextRegion(BaseModel):
    text: str
    text_type: str = Field(
        description="heading, paragraph, button, label, URL, watermark, etc."
    )
    bbox: list[int] = Field(
        description="[x1,y1,x2,y2], normalized to 0-1000."
    )
    confidence: float


class ObjectInfo(BaseModel):
    object_type: str
    name: str
    description: str
    bbox: list[int] = Field(
        description="[x1,y1,x2,y2], normalized to 0-1000."
    )
    confidence: float


class SensitiveRegion(BaseModel):
    category: str
    description: str

    detected_text: str = Field(
        description="Exact sensitive value in TRAINING_MODE, otherwise [REDACTED]."
    )

    bbox: list[int] = Field(
        description="[x1,y1,x2,y2], normalized to 0-1000."
    )

    confidence: float
    needs_redaction: bool


class ImageAnalysis(BaseModel):
    image_type: str

    short_summary: str

    detailed_description: list[str]

    ui_elements: list[UIElement]

    objects: list[ObjectInfo]

    visible_text: list[TextRegion]

    sensitive_information: list[SensitiveRegion]


# =========================================================
# IMAGE ANALYSIS
# =========================================================

def analyze_image(image_path: str) -> ImageAnalysis:

    path = Path(image_path)

    if not path.exists():
        raise FileNotFoundError(
            f"Image not found: {image_path}"
        )

    image = Image.open(path)

    if TRAINING_MODE:
        privacy_instruction = """
TRAINING MODE IS ENABLED.

For sensitive information:
- report the category
- report the exact visible value if readable
- provide its bounding box
- provide confidence
- state whether it should be redacted

This is for controlled dataset generation.
"""
    else:
        privacy_instruction = """
PRIVACY MODE IS ENABLED.

Never output actual sensitive values.

For sensitive information:
- identify the category
- describe the information
- set detected_text to "[REDACTED]"
- provide the bounding box
- provide confidence
- state whether redaction is required
"""

    prompt = f"""
You are GhostEye.

You are a visual-perception engine for a browser agent and
a dataset annotation system.

Analyze the supplied image carefully.

========================================================
1. IMAGE TYPE
========================================================

Classify the image.

Possible examples:

- wallpaper
- photograph
- webpage
- browser screenshot
- application UI
- document
- poster
- landscape
- portrait
- infographic
- product image
- social media image
- other

========================================================
2. SHORT SUMMARY
========================================================

Give a concise summary of the image.

========================================================
3. DETAILED DESCRIPTION
========================================================

Generate AT LEAST 30 DISTINCT observations.

Each observation must be a separate list item.

For ordinary images or wallpapers describe:

- composition
- foreground
- background
- main subject
- secondary subjects
- objects
- colors
- lighting
- shadows
- textures
- environment
- spatial relationships
- perspective
- shapes
- visual style
- atmosphere
- important details

For screenshots or webpages describe:

- layout
- header
- navigation
- panels
- buttons
- input fields
- menus
- cards
- text hierarchy
- visible state
- important content

Do not repeat observations.

========================================================
4. UI ELEMENTS
========================================================

Identify important UI elements if present.

Examples:

- buttons
- input fields
- links
- checkboxes
- radio buttons
- tabs
- menus
- icons
- images
- headings
- text blocks

For each element provide:

type
label
bounding box
confidence

========================================================
5. OBJECT DETECTION
========================================================

Identify important objects.

For each object provide:

object type
name
description
bounding box
confidence

========================================================
6. VISIBLE TEXT
========================================================

Extract clearly readable text.

Do not invent text.

For each text region provide:

text
text type
bounding box
confidence

========================================================
7. SENSITIVE INFORMATION
========================================================

Look for:

- passwords
- email addresses
- phone numbers
- personal names
- home addresses
- bank account numbers
- credit card numbers
- debit card numbers
- UPI IDs
- transaction IDs
- government ID numbers
- license plates
- faces
- usernames
- API keys
- access tokens
- private URLs
- dates of birth
- medical information
- confidential business information

For every detected item provide:

category
description
detected_text
bounding box
confidence
needs_redaction

{privacy_instruction}

========================================================
8. BOUNDING BOX FORMAT
========================================================

All bounding boxes MUST be:

[x1, y1, x2, y2]

Coordinates are normalized from 0 to 1000.

0,0 = top-left
1000,1000 = bottom-right

========================================================
IMPORTANT
========================================================

Do not hallucinate.

Only report information that is actually visible.

Use lower confidence when uncertain.

Return structured JSON matching the schema.
"""

    for attempt in range(4):

        try:

            response = client.models.generate_content(
                model=MODEL,
                contents=[
                    prompt,
                    image
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ImageAnalysis
                )
            )

            if not response.text:
                raise RuntimeError(
                    "Gemini returned an empty response."
                )

            result = ImageAnalysis.model_validate_json(
                response.text
            )

            # Make sure we received the requested depth.
            if len(result.detailed_description) < 30:

                if attempt < 3:

                    prompt += """

IMPORTANT:
You returned fewer than 30 observations.

Generate at least 30 DISTINCT detailed observations.
"""

                    continue

                raise RuntimeError(
                    "Gemini returned fewer than 30 observations."
                )

            return result

        except Exception as e:

            error_text = str(e)

            retryable = any(
                code in error_text
                for code in [
                    "503",
                    "UNAVAILABLE",
                    "429",
                    "RESOURCE_EXHAUSTED"
                ]
            )

            if not retryable:
                raise

            if attempt == 3:
                raise RuntimeError(
                    "Gemini remained unavailable after retries."
                )

            wait_time = 2 ** attempt

            print(
                f"Gemini temporarily unavailable. "
                f"Retrying in {wait_time} seconds..."
            )

            time.sleep(wait_time)

    raise RuntimeError("Analysis failed.")


# =========================================================
# SAVE ANNOTATION
# =========================================================

def save_annotation(
    result: ImageAnalysis,
    image_path: str
):

    path = Path(image_path)

    output_path = path.with_name(
        path.stem + "_annotation.json"
    )

    with open(
        output_path,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            result.model_dump(),
            f,
            indent=2,
            ensure_ascii=False
        )

    return output_path


# =========================================================
# MAIN
# =========================================================

def main():

    if len(sys.argv) < 2:

        print(
            "Usage: python ghosteye_api.py image.png"
        )

        sys.exit(1)

    image_path = sys.argv[1]

    try:

        result = analyze_image(
            image_path
        )

        print(
            json.dumps(
                result.model_dump(),
                indent=2,
                ensure_ascii=False
            )
        )

        output = save_annotation(
            result,
            image_path
        )

        print(
            f"\nAnnotation saved to: {output}"
        )

    except Exception as e:

        print(
            f"\nERROR: {e}"
        )

        sys.exit(1)


if __name__ == "__main__":
    main()