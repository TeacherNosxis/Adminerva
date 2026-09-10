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
    genBtn.textContent = "⏳ Generating Slides...";
    genBtn.disabled = true;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const aiModelName =
      localStorage.getItem("Adminerva_ai_model") || "gemini-1.5-flash";

    const slideSchema = {
      type: SchemaType.ARRAY,
      description:
        "An array of slide objects representing the presentation deck.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: {
            type: SchemaType.STRING,
            description: "The slide type (e.g., 'title', 'core', 'evaluation')",
          },
          label: {
            type: SchemaType.STRING,
            description: "The title of the slide block for the UI navigation",
          },
          content: {
            type: SchemaType.STRING,
            description:
              "The actual HTML content of the slide formatted for Quill.js. Use h1, h2, p, ul, li, and format math as KaTeX formulas inline. Strictly limit text length to prevent 16:9 overflow.",
          },
        },
        required: ["type", "label", "content"],
      },
    };

    const model = genAI.getGenerativeModel({
      model: aiModelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: slideSchema,
        temperature: 0.2,
      },
    });

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
            2. The 'content' field must contain valid HTML (<h1>, <p>, <ul>). 
            3. Do NOT overload the 'content' field. If a core concept is too long, split it into two bullet points or summarize it. 
            4. Use KaTeX format (e.g., $E=mc^2$) for any mathematical equations.
        `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    window.currentPresentationDeck = JSON.parse(responseText);
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
      genBtn.textContent = "✨ Generate AI Slides";
      genBtn.disabled = false;
    }
  }
};
