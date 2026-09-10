window.exportToPPTX = async function () {
  if (
    !window.currentPresentationDeck ||
    window.currentPresentationDeck.length === 0
  ) {
    alert("No slides to export. Generate or add slides first.");
    return;
  }

  const exportBtn = document.querySelector('button[onclick="exportToPPTX()"]');
  const originalText = exportBtn.innerText;
  exportBtn.innerText = "⏳ Compiling PPTX...";
  exportBtn.disabled = true;

  try {
    // 1. Initialize 16:9 Presentation
    let pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";

    // 2. Fetch Global Theme Data
    const bgBase64 = localStorage.getItem("presentation_logo");
    const lessonData = window.selectedPlanData || {};
    const subjectTitle = lessonData.subject_title || "Adminerva Presentation";
    const topic = lessonData.weekly_overview
      ? lessonData.weekly_overview.topic
      : "Lesson Topic";

    // 3. Loop through every slide in the deck
    window.currentPresentationDeck.forEach((slideData) => {
      let slide = pptx.addSlide();

      // Apply Background
      if (bgBase64 && bgBase64.length > 50) {
        slide.background = { data: bgBase64 };
      } else {
        slide.background = { color: "F8FAFC" }; // Adminerva Gray-50 fallback
      }

      // Apply Top Ribbon (Skip if it's a Media Slide)
      if (slideData.layout !== "media") {
        slide.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: "100%",
          h: 0.6,
          fill: { color: "EFF6FF" },
        });
        slide.addText(subjectTitle.toUpperCase(), {
          x: 0.3,
          y: 0.1,
          w: "50%",
          h: 0.25,
          fontSize: 12,
          bold: true,
          color: "1E3A8A",
          align: "left",
        });
        slide.addText(topic, {
          x: 0.3,
          y: 0.3,
          w: "50%",
          h: 0.2,
          fontSize: 9,
          color: "6B7280",
          align: "left",
        });
      }

      // Render Layouts
      if (slideData.layout === "standard") {
        let textElements = parseHtmlToPptx(slideData.content);
        slide.addText(textElements, {
          x: 0.5,
          y: 0.8,
          w: "90%",
          h: 4.5,
          valign: "top",
        });
      } else if (slideData.layout === "split") {
        let leftElements = parseHtmlToPptx(slideData.contentLeft);
        let rightElements = parseHtmlToPptx(slideData.contentRight);

        // Left Column
        slide.addText(leftElements, {
          x: 0.5,
          y: 0.8,
          w: "43%",
          h: 4.5,
          valign: "top",
        });
        // Right Column
        slide.addText(rightElements, {
          x: 5.2,
          y: 0.8,
          w: "43%",
          h: 4.5,
          valign: "top",
        });
      } else if (slideData.layout === "media") {
        if (slideData.mediaUrl) {
          slide.addImage({
            data: slideData.mediaUrl,
            x: 0.2,
            y: 0.2,
            w: "9.6",
            h: "5.2",
            sizing: { type: "contain" },
          });
        } else {
          slide.addText("No Media Uploaded", {
            x: 0,
            y: "40%",
            w: "100%",
            h: "20%",
            align: "center",
            fontSize: 24,
            color: "999999",
          });
        }
      }
    });

    // 4. Download File
    const fileName = `${subjectTitle.replace(/[^a-z0-9]/gi, "_")}_Presentation.pptx`;
    await pptx.writeFile({ fileName: fileName });
  } catch (error) {
    console.error("PPTX Export Error:", error);
    alert("Failed to export PPTX: " + error.message);
  } finally {
    exportBtn.innerText = originalText;
    exportBtn.disabled = false;
  }
};

// ==================================================
// HTML TO PPTX PARSER (Translates Quill formatting)
// ==================================================
function parseHtmlToPptx(htmlString) {
  if (!htmlString) return [{ text: "" }];

  let tempDiv = document.createElement("div");
  tempDiv.innerHTML = htmlString;
  let pptxTextArray = [];

  Array.from(tempDiv.children).forEach((node) => {
    let text = node.innerText || "";
    if (!text.trim() && node.nodeName !== "BR") return;

    let fontSize = 18;
    let isBold = false;

    // Match Quill Font Sizes
    if (node.classList.contains("ql-size-huge") || node.nodeName === "H1") {
      fontSize = 32;
      isBold = true;
    } else if (
      node.classList.contains("ql-size-large") ||
      node.nodeName === "H2"
    ) {
      fontSize = 24;
      isBold = true;
    } else if (node.classList.contains("ql-size-small")) {
      fontSize = 12;
    }

    // Match Inline Bold
    if (node.querySelector("strong") || node.querySelector("b")) isBold = true;

    // Handle Lists
    if (node.nodeName === "UL" || node.nodeName === "OL") {
      Array.from(node.children).forEach((li) => {
        let liSize = 18;
        let liBold = !!(li.querySelector("strong") || li.querySelector("b"));

        if (li.classList.contains("ql-size-huge")) {
          liSize = 32;
          liBold = true;
        } else if (li.classList.contains("ql-size-large")) {
          liSize = 24;
          liBold = true;
        } else if (li.classList.contains("ql-size-small")) {
          liSize = 12;
        }

        pptxTextArray.push({
          text: li.innerText,
          options: {
            fontSize: liSize,
            bold: liBold,
            bullet: true,
            breakLine: true,
            color: "333333",
          },
        });
      });
    } else {
      // Handle Paragraphs and Headers
      pptxTextArray.push({
        text: text,
        options: {
          fontSize: fontSize,
          bold: isBold,
          breakLine: true,
          color: "333333",
        },
      });
    }
  });

  if (pptxTextArray.length === 0) {
    pptxTextArray.push({
      text: tempDiv.innerText,
      options: { fontSize: 18, color: "333333" },
    });
  }

  return pptxTextArray;
}
