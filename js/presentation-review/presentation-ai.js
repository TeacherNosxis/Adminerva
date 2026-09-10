import {
  GoogleGenerativeAI,
  SchemaType,
} from "https://esm.run/@google/generative-ai";

window.generateAI_SlideDeck = async function () {
  if (!window.selectedPlanData || !window.selectedSessionData) {
    alert("Please select a lesson plan and session first.");
    return;
  }

  const apiKey =
    localStorage.getItem("Adminerva_gemini_token") ||
    localStorage.getItem("repoReview_gemini_token");
  if (!apiKey) {
    alert("Gemini API Key missing. Please configure it in Global Settings.");
    return;
  }

  const slideSequence = JSON.parse(
    localStorage.getItem("presentation_slide_sequence"),
  ) || [
    { type: "title", label: "Title Slide" },
    { type: "objectives", label: "Objectives" },
    { type: "core", label: "Core Content" },
    { type: "evaluation", label: "Evaluation" },
  ];

  const genBtn = document.getElementById("btnGenerateSlides");
  if (genBtn) {
    genBtn.innerHTML = "⏳ Generating Slides...";
    genBtn.disabled = true;
  }

  if (typeof window.showLoader === "function") {
    window.showLoader(
      "Designing Slide Deck...",
      "Converting lesson plan into structured presentation blocks.",
    );
  }

  try {
    const aiModelName =
      localStorage.getItem("Adminerva_ai_model") || "gemini-1.5-flash";
    const prompt = `
            Act as an expert instructional designer. Convert the provided lesson plan session into a presentation slide deck.
            
            Lesson Context:
            Subject: ${window.selectedPlanData.subject_title}
            Grade: ${window.selectedPlanData.grade_level}
            Topic: ${window.selectedPlanData.weekly_overview.topic}
            
            Session Details:
            ${JSON.stringify(window.selectedSessionData, null, 2)}
            
            Requested Slide Sequence (Map your output EXACTLY to this flow):
            ${JSON.stringify(slideSequence, null, 2)}
            
            Instructions:
            1. Return a JSON array where each object matches the requested sequence.
            2. The 'content' field must contain valid HTML (<h1>, <h2>, <p>, <ul>, <li>). 
            3. Do NOT overload the 'content' field. If a core concept is too long, split it into two bullet points or summarize it. 
            4. Use KaTeX format (e.g., $E=mc^2$) for any mathematical equations.
        `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${aiModelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
            responseSchema: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  type: { type: "STRING" },
                  label: { type: "STRING" },
                  content: { type: "STRING" },
                },
                required: ["type", "label", "content"],
              },
            },
          },
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Google API Error (${response.status}): ${errBody}`);
    }

    const aiResult = await response.json();
    let rawJson = aiResult.candidates[0].content.parts[0].text
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    window.currentPresentationDeck = JSON.parse(rawJson);
    window.activeSlideIndex = 0;

    if (typeof window.renderSlideBlocks === "function") {
      window.renderSlideBlocks();
      window.selectSlide(0);
    }
  } catch (e) {
    console.error("AI Generation Failed:", e);
    alert(`Generation Failed: ${e.message}`);
  } finally {
    if (genBtn) {
      genBtn.innerHTML = "✨ Generate AI Slides";
      genBtn.disabled = false;
    }
    if (typeof window.hideLoader === "function") window.hideLoader();
  }
};
