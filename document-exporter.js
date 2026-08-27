window.formatListForPrint = function(text, isOrdered = true) {
    if (!text) return '';
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return '';

    if (lines.length === 1 && !/^([-•*]|\d+[\.\)])/.test(lines[0])) {
        return text;
    }

    const tag = isOrdered ? 'ol' : 'ul';
    const type = isOrdered ? 'decimal' : 'disc';

    let html = `<${tag} style="margin: 0; padding-left: 20px; list-style-type: ${type};">`;
    lines.forEach(line => {
        let cleanLine = line.replace(/^([-•*]|\d+[\.\)])\s*/, '').trim();
        if (cleanLine) html += `<li style="margin-bottom: 4px;">${cleanLine}</li>`;
    });
    html += `</${tag}>`;
    return html;
};

window.buildDocumentLayout = function() {
    if (!window.currentPlan || window.currentPlan.length === 0 || !window.currentWeeklyOverview) {
        alert("Please generate a lesson plan first before exporting.");
        return false;
    }

    const headerImgUrl = localStorage.getItem('lessonReview_headerImage');
    const headerImgEl = document.getElementById('printHeaderImage');
    const headerContainer = document.getElementById('printHeaderBannerContainer');
    if (headerImgUrl && headerImgEl) {
        headerImgEl.src = headerImgUrl;
        headerImgEl.classList.remove('hidden');
        headerImgEl.style.display = 'block';
        headerImgEl.style.margin = '0 auto';
        if (headerContainer) headerContainer.classList.remove('hidden');
    }

    const rawSubject = document.getElementById('lpSubjectTitle').value || "SUBJECT";
    const rawSY = document.getElementById('lpSchoolYear').value || "2026-2027";

    document.getElementById('printMainTitle').textContent = `CURRICULUM MAP / LEARNING PLAN IN ${rawSubject.toUpperCase()}`;
    document.getElementById('printSYHeader').textContent = `SCHOOL YEAR ${rawSY}`;

    const textMap = {"1st": "First", "2nd": "Second", "3rd": "Third", "4th": "Fourth"};
    const formatOrdinal = (str) => str.replace(/1st|2nd|3rd|4th/g, match => textMap[match]);

    document.getElementById('printQuarter').textContent = formatOrdinal(document.getElementById('lpQuarter').value || "QUARTER");
    document.getElementById('printSemester').textContent = formatOrdinal(document.getElementById('lpSemester').value || "SEMESTER");

    const scopeWeek = document.getElementById('lpWeek').value;
    const dateRangeEl = document.getElementById('lpDateRange');
    const dateRange = dateRangeEl ? dateRangeEl.value : "";
    document.getElementById('printScopeHeader').textContent = `${scopeWeek} ${dateRange ? '(' + dateRange + ')' : ''}`;

    document.getElementById('printSig1Name').textContent = localStorage.getItem('lessonReview_sigTeacher') || "";
    document.getElementById('printSig1Title').textContent = localStorage.getItem('lessonReview_sigTeacherTitle') || "";
    document.getElementById('printSig2Name').textContent = localStorage.getItem('lessonReview_sigSubjectCoord') || "";
    document.getElementById('printSig2Title').textContent = localStorage.getItem('lessonReview_sigSubjectCoordTitle') || "";
    document.getElementById('printSig3Name').textContent = localStorage.getItem('lessonReview_sigGradeCoord') || "";
    document.getElementById('printSig3Title').textContent = localStorage.getItem('lessonReview_sigGradeCoordTitle') || "";
    document.getElementById('printSig4Name').textContent = localStorage.getItem('lessonReview_sigPrincipal') || "";
    document.getElementById('printSig4Title').textContent = localStorage.getItem('lessonReview_sigPrincipalTitle') || "";

    const tbody = document.getElementById('printTableBody');
    tbody.innerHTML = ''; 

    window.currentPlan.forEach((session, index) => {
        const isFlex = session.session_name.toLowerCase().includes('flex');
        const tr = document.createElement('tr');
        let rowHtml = ``;

        if (index === 0) {
            rowHtml += `
                <td style="font-weight: bold; text-align: center; vertical-align: middle;">${window.currentWeeklyOverview.topic || ''}</td>
                <td style="vertical-align: top;">
                    <strong>Content Standard:</strong><br>${window.currentWeeklyOverview.content_standard || ''}<br><br>
                    <strong>Performance Standard:</strong><br>${window.currentWeeklyOverview.performance_standard || ''}<br><br>
                    <strong>Formation Standard:</strong><br>${window.currentWeeklyOverview.formation_standard || ''}
                </td>
            `;
        } else {
            rowHtml += `<td></td><td></td>`;
        }

        const objText = window.formatListForPrint(session.objectives || 'N/A', true); 
        const matText = window.formatListForPrint(window.currentWeeklyOverview.materials || '', false); 
        const prelimText = window.formatListForPrint(session.preliminary || '', true);
        const activitiesText = window.formatListForPrint(session.learning_activities || '', true);

        rowHtml += `
            <td style="vertical-align: top;">
                <strong>Competencies:</strong><br>${session.competencies || 'N/A'}<br><br>
                <strong>Objectives:</strong><br>${objText}
            </td>
        `;

        let timeFrame = isFlex ? "Async" : "5 mins<br><br>5 mins<br><br>26 mins<br><br>10 mins<br><br>4 mins";
        if (session.session_name.includes("4-6")) {
            timeFrame = "10 mins<br><br>15 mins<br><br>40 mins<br><br>50 mins<br><br>25 mins<br><br>10 mins";
        }
        rowHtml += `<td style="text-align: center; font-weight: bold; vertical-align: middle; font-size: 10pt; line-height: 1.6;">${timeFrame}</td>`;

        let experiencesHTML = `<div style="font-weight: bold; margin-bottom: 4px;">${session.session_name}</div>`;
        if (!isFlex) {
            experiencesHTML += `
                <strong>Preliminary Activities:</strong><br><div style="padding-left: 8px;">${prelimText}</div><br>
                <strong>Motivation / Recall:</strong><br><div style="padding-left: 8px; white-space: pre-wrap;">${session.motivation || ''}</div><br>
            `;
        }

        experiencesHTML += `<strong>Learning Activities:</strong><br><div style="padding-left: 8px;">${activitiesText}</div>`;

        if (!isFlex) {
            experiencesHTML += `
                <br><strong>Evaluation:</strong><br><div style="padding-left: 8px; white-space: pre-wrap;">${session.evaluation || ''}</div><br>
                <strong>Closing Activities:</strong><br><div style="padding-left: 8px; white-space: pre-wrap;">${session.closing || ''}</div><br>
                <strong>Values Integration:</strong><br><div style="padding-left: 8px; white-space: pre-wrap;">${session.values_integration || ''}</div>
            `;
        }
        rowHtml += `<td style="vertical-align: top;">${experiencesHTML}</td>`;
        rowHtml += `<td style="vertical-align: top;">${matText}</td>`;

        const cleanRemarks = (session.remarks || '').replace(/\s*\|\s*/g, '<br>').replace(/;/g, '<br>').replace(/\n/g, '<br>');
        rowHtml += `<td style="vertical-align: top;">${cleanRemarks}</td>`;

        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });

    return true;
};

window.exportPDF = function() {
    if (window.buildDocumentLayout()) {
        setTimeout(() => { window.print(); }, 300);
    }
};

window.saveAndPrint = async function() {
    const isSaved = await window.saveLessonPlan();
    if (isSaved && window.buildDocumentLayout()) {
        setTimeout(() => { window.print(); }, 300);
    }
};

window.exportToWordDoc = async function() {
    if (typeof htmlDocx === 'undefined') return alert("The Word Document generator is still loading. Please wait.");
    if (!window.buildDocumentLayout()) return;

    const anchoredWeek = window.currentAnchoredWeek || 1; 
    const rawGrade = window.currentTargetGrade.replace(/\D/g, "") || "11";
    const semNum = /2|second/i.test(document.getElementById('lpSemester')?.value || "") ? "2" : "1";

    let qtrNum = "1";
    const rawQtr = document.getElementById('lpQuarter')?.value || "";
    if(/2|second/i.test(rawQtr)) qtrNum = "2";
    if(/3|third/i.test(rawQtr)) qtrNum = "3";
    if(/4|fourth/i.test(rawQtr)) qtrNum = "4";

    const rawSubject = document.getElementById('lpSubjectTitle')?.value || "Subject";
    const shortSubject = rawSubject.split(/\s+/).map(w => w.match(/\d+/) ? w : w.substring(0, 4)).join('').replace(/[^a-zA-Z0-9]/g, "");

    const filename = `${rawGrade}-Sem${semNum},Qtr${qtrNum},W${anchoredWeek}(${shortSubject}).docx`;

    const printWrapper = document.getElementById('printDocumentWrapper');
    let cleanHtml = printWrapper.innerHTML.replace(/<thead.*?>/gi, '').replace(/<\/thead>/gi, '');
    cleanHtml = cleanHtml.replace(/<img /gi, '<img height="80" ');

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                @page WordSection1 { size: 13.0in 8.5in; mso-page-orientation: landscape; margin: 0.5in; }
                div.WordSection1 { page: WordSection1; }
                body { font-family: 'Arial Narrow', Arial, sans-serif; font-size: 10pt; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #000; padding: 6px 8px; font-size: 10pt; vertical-align: top; }
                th { background-color: #f2f2f2; text-align: center; font-weight: bold; }
                img { max-height: 80px; display: block; margin: 0 auto 10px auto; }
            </style>
        </head>
        <body>
            <div class="WordSection1">${cleanHtml}</div>
        </body> 
        </html>
    `;

    const blob = htmlDocx.asBlob(htmlContent, { orientation: 'landscape', margins: { top: 720, right: 720, bottom: 720, left: 720 } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};