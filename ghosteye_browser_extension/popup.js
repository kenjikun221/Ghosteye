const API_URL = "http://127.0.0.1:8000/analyze";

const analyzeBtn = document.getElementById("analyzeBtn");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");


// =========================================================
// UTILITY
// =========================================================

function setStatus(message) {
    statusEl.textContent = message;
}


// =========================================================
// CAPTURE CURRENT TAB
// =========================================================

async function captureCurrentTab() {

    const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    if (!tabs.length) {
        throw new Error("No active tab found.");
    }

    const tab = tabs[0];

    return await chrome.tabs.captureVisibleTab(
        tab.windowId,
        {
            format: "png"
        }
    );
}


// =========================================================
// DATA URL -> BLOB
// =========================================================

async function dataURLToBlob(dataURL) {

    const response = await fetch(dataURL);

    if (!response.ok) {
        throw new Error(
            "Could not convert screenshot."
        );
    }

    return await response.blob();
}


// =========================================================
// SEND SCREENSHOT TO PYTHON SERVER
// =========================================================

async function analyzeScreenshot(dataURL) {

    const blob =
        await dataURLToBlob(dataURL);

    const formData =
        new FormData();

    formData.append(
        "image",
        blob,
        "ghosteye-screenshot.png"
    );

    const response =
        await fetch(
            API_URL,
            {
                method: "POST",
                body: formData
            }
        );

    if (!response.ok) {

        const errorText =
            await response.text();

        throw new Error(
            `Server returned ${response.status}: ${errorText}`
        );
    }

    return await response.json();
}


// =========================================================
// DRAW SCREENSHOT + BOUNDING BOXES
// =========================================================

function drawAnalysis(
    dataURL,
    analysis
) {

    const canvas =
        document.getElementById(
            "screenCanvas"
        );

    if (!canvas) {
        console.error(
            "screenCanvas not found."
        );
        return;
    }

    const ctx =
        canvas.getContext("2d");

    const img =
        new Image();

    img.onload = function () {

        const maxWidth = 430;

        const scale =
            Math.min(
                1,
                maxWidth / img.width
            );

        canvas.width =
            Math.round(
                img.width * scale
            );

        canvas.height =
            Math.round(
                img.height * scale
            );

        ctx.drawImage(
            img,
            0,
            0,
            canvas.width,
            canvas.height
        );


        // ---------------------------------------------
        // BLUE = UI ELEMENTS
        // ---------------------------------------------

        for (
            const element
            of (analysis.ui_elements || [])
        ) {

            drawBoundingBox(
                ctx,
                element.bbox,
                img.width,
                img.height,
                scale,
                "#38bdf8",
                element.label || element.type || "UI"
            );
        }


        // ---------------------------------------------
        // RED = SENSITIVE INFORMATION
        // ---------------------------------------------

        for (
            const item
            of (analysis.sensitive_information || [])
        ) {

            drawBoundingBox(
                ctx,
                item.bbox,
                img.width,
                img.height,
                scale,
                "#ef4444",
                item.category || "Sensitive"
            );
        }
    };

    img.onerror = function () {

        console.error(
            "Could not load screenshot into canvas."
        );
    };

    img.src = dataURL;
}


// =========================================================
// DRAW ONE BOUNDING BOX
// =========================================================

function drawBoundingBox(
    ctx,
    bbox,
    imageWidth,
    imageHeight,
    scale,
    color,
    label
) {

    if (
        !Array.isArray(bbox) ||
        bbox.length !== 4
    ) {
        return;
    }

    const x1 =
        (bbox[0] / 1000) *
        imageWidth *
        scale;

    const y1 =
        (bbox[1] / 1000) *
        imageHeight *
        scale;

    const x2 =
        (bbox[2] / 1000) *
        imageWidth *
        scale;

    const y2 =
        (bbox[3] / 1000) *
        imageHeight *
        scale;

    const width =
        x2 - x1;

    const height =
        y2 - y1;

    // Box
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    ctx.strokeRect(
        x1,
        y1,
        width,
        height
    );


    // Label
    ctx.font =
        "11px Arial";

    const textWidth =
        ctx.measureText(
            label
        ).width;

    const labelWidth =
        Math.max(
            60,
            textWidth + 12
        );

    const labelY =
        Math.max(
            0,
            y1 - 19
        );

    ctx.fillStyle =
        color;

    ctx.fillRect(
        x1,
        labelY,
        labelWidth,
        19
    );

    ctx.fillStyle =
        "#ffffff";

    ctx.fillText(
        label,
        x1 + 6,
        labelY + 13
    );
}


// =========================================================
// UPDATE DASHBOARD
// =========================================================

function renderDashboard(result) {

    // -----------------------------------------------------
    // IMAGE TYPE
    // -----------------------------------------------------

    const imageType =
        document.getElementById(
            "imageType"
        );

    if (imageType) {

        imageType.textContent =
            result.image_type ||
            "Unknown";
    }


    // -----------------------------------------------------
    // SHORT SUMMARY
    // -----------------------------------------------------

    const imageSummary =
        document.getElementById(
            "imageSummary"
        );

    if (imageSummary) {

        imageSummary.textContent =
            result.short_summary ||
            "No summary available.";
    }


    // -----------------------------------------------------
    // COUNTS
    // -----------------------------------------------------

    const objectCount =
        document.getElementById(
            "objectCount"
        );

    if (objectCount) {

        objectCount.textContent =
            `Objects: ${
                (result.objects || []).length
            }`;
    }


    const uiCount =
        document.getElementById(
            "uiCount"
        );

    if (uiCount) {

        uiCount.textContent =
            `UI Elements: ${
                (result.ui_elements || []).length
            }`;
    }


    const textCount =
        document.getElementById(
            "textCount"
        );

    if (textCount) {

        textCount.textContent =
            `Text: ${
                (result.visible_text || []).length
            }`;
    }

        // -----------------------------------------------------
    // UI ELEMENTS
    // -----------------------------------------------------

    const uiElementList =
        document.getElementById(
            "uiElementList"
        );

    if (uiElementList) {

        uiElementList.innerHTML = "";

        const elements =
            result.ui_elements || [];

        if (!elements.length) {

            uiElementList.className =
                "list empty";

            uiElementList.textContent =
                "No UI elements detected.";

        } else {

            uiElementList.className =
                "list";

            elements.forEach(
                (element, index) => {

                    const div =
                        document.createElement(
                            "div"
                        );

                    div.className =
                        "sensitive-item";

                    div.textContent =
                        `${index + 1}. ${
                            element.type
                        } — ${
                            element.label
                        } — ${
                            Number(
                                element.confidence || 0
                            ).toFixed(2)
                        }`;

                    uiElementList.appendChild(
                        div
                    );
                }
            );
        }
    }


    // -----------------------------------------------------
    // OBJECTS
    // -----------------------------------------------------

    const objectList =
        document.getElementById(
            "objectList"
        );

    if (objectList) {

        objectList.innerHTML = "";

        const objects =
            result.objects || [];

        if (!objects.length) {

            objectList.className =
                "list empty";

            objectList.textContent =
                "No objects detected.";

        } else {

            objectList.className =
                "list";

            objects.forEach(
                (object, index) => {

                    const div =
                        document.createElement(
                            "div"
                        );

                    div.className =
                        "sensitive-item";

                    div.textContent =
                        `${index + 1}. ${
                            object.name ||
                            object.object_type
                        } — ${
                            object.description
                        }`;

                    objectList.appendChild(
                        div
                    );
                }
            );
        }
    }


    // -----------------------------------------------------
    // VISIBLE TEXT
    // -----------------------------------------------------

    const textList =
        document.getElementById(
            "textList"
        );

    if (textList) {

        textList.innerHTML = "";

        const textRegions =
            result.visible_text || [];

        if (!textRegions.length) {

            textList.className =
                "list empty";

            textList.textContent =
                "No visible text detected.";

        } else {

            textList.className =
                "list";

            textRegions.forEach(
                (item, index) => {

                    const div =
                        document.createElement(
                            "div"
                        );

                    div.className =
                        "sensitive-item";

                    div.textContent =
                        `${index + 1}. ${
                            item.text
                        } — ${
                            item.text_type
                        }`;

                    textList.appendChild(
                        div
                    );
                }
            );
        }
    }


    // -----------------------------------------------------
    // SENSITIVE INFORMATION
    // -----------------------------------------------------

    const sensitiveList =
        document.getElementById(
            "sensitiveList"
        );

    if (sensitiveList) {

        sensitiveList.innerHTML = "";

        const sensitive =
            result.sensitive_information || [];

        if (sensitive.length === 0) {

            sensitiveList.className =
                "list empty";

            sensitiveList.textContent =
                "None detected.";

        } else {

            sensitiveList.className =
                "list";

            sensitive.forEach(
                (item, index) => {

                    const div =
                        document.createElement(
                            "div"
                        );

                    div.className =
                        "sensitive-item";

                    const category =
                        document.createElement(
                            "strong"
                        );

                    category.textContent =
                        `${index + 1}. ${
                            item.category || "Unknown"
                        }`;

                    const description =
                        document.createElement(
                            "div"
                        );

                    description.textContent =
                        item.description || "";

                    const detected =
                        document.createElement(
                            "div"
                        );

                    detected.textContent =
                        `Detected: ${
                            item.detected_text ||
                            "[REDACTED]"
                        }`;

                    const confidence =
                        document.createElement(
                            "div"
                        );

                    confidence.textContent =
                        `Confidence: ${
                            Number(
                                item.confidence || 0
                            ).toFixed(2)
                        }`;

                    const redact =
                        document.createElement(
                            "div"
                        );

                    redact.textContent =
                        `Redaction: ${
                            item.needs_redaction
                                ? "YES"
                                : "NO"
                        }`;

                    div.appendChild(
                        category
                    );

                    div.appendChild(
                        description
                    );

                    div.appendChild(
                        detected
                    );

                    div.appendChild(
                        confidence
                    );

                    div.appendChild(
                        redact
                    );

                    sensitiveList.appendChild(
                        div
                    );
                }
            );
        }
    }


    // -----------------------------------------------------
    // DETAILED DESCRIPTION
    // -----------------------------------------------------

    const descriptionList =
        document.getElementById(
            "descriptionList"
        );

    if (descriptionList) {

        descriptionList.innerHTML = "";

        const descriptions =
            result.detailed_description || [];

        descriptions.forEach(
            (description, index) => {

                const li =
                    document.createElement(
                        "li"
                    );

                li.textContent =
                    description;

                descriptionList.appendChild(
                    li
                );
            }
        );

        if (descriptions.length === 0) {

            const li =
                document.createElement(
                    "li"
                );

            li.textContent =
                "No detailed description returned.";

            descriptionList.appendChild(
                li
            );
        }
    }


    // -----------------------------------------------------
    // RAW JSON
    // -----------------------------------------------------

    if (resultEl) {

        resultEl.textContent =
            JSON.stringify(
                result,
                null,
                2
            );
    }
}


// =========================================================
// ANALYZE BUTTON
// =========================================================

analyzeBtn.addEventListener(
    "click",
    async function () {

        analyzeBtn.disabled = true;

        const startTime =
            performance.now();

        try {

            setStatus(
                "Capturing current tab..."
            );

            const screenshot =
                await captureCurrentTab();


            setStatus(
                "Sending to GhostEye..."
            );

            const result =
                await analyzeScreenshot(
                    screenshot
                );


            // Draw screenshot
            drawAnalysis(
                screenshot,
                result
            );


            // Fill dashboard
            renderDashboard(
                result
            );


            const elapsed =
                (
                    performance.now() -
                    startTime
                ) / 1000;


            setStatus(
                `Analysis complete — ${elapsed.toFixed(2)} seconds`
            );

        }
        catch (error) {

            console.error(
                error
            );

            setStatus(
                `Error: ${error.message}`
            );

            if (resultEl) {

                resultEl.textContent =
                    error.stack ||
                    error.message;
            }

        }
        finally {

            analyzeBtn.disabled =
                false;
        }
    }
);