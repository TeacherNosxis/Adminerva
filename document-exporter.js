import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

window.formatListForPrint = function(text, isOrdered = true) {
    if (!text) return '';
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return '';
    if (lines.length === 1 && !/^([-•*]|\d+[\.\)])/.test(lines[0])) return text;

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

window.buildDocumentLayout = async function() {
    if (!window.currentPlan || window.currentPlan.length === 0 || !window.currentWeeklyOverview) {
        alert("Please generate a lesson plan first before exporting.");
        return false;
    }

    let headerImgUrl = localStorage.getItem('lessonReview_headerImage') || "";
    let rawSubject = localStorage.getItem('lessonReview_defaultSubject') || "SUBJECT";
    let rawTeacher = localStorage.getItem('lessonReview_defaultTeacher') || "TEACHER";
    
    let s1Name = localStorage.getItem('lessonReview_sig1Name') || rawTeacher;
    let s1Title = localStorage.getItem('lessonReview_sig1Title') || "Subject Teacher";
    let s2Name = localStorage.getItem('lessonReview_sig2Name') || "";
    let s2Title = localStorage.getItem('lessonReview_sig2Title') || "";
    let s3Name = localStorage.getItem('lessonReview_sig3Name') || "";
    let s3Title = localStorage.getItem('lessonReview_sig3Title') || "";
    let s4Name = localStorage.getItem('lessonReview_sig4Name') || "";
    let s4Title = localStorage.getItem('lessonReview_sig4Title') || "";

    if (window.db) {
        try {
            const docSnap = await getDoc(doc(window.db, "global_settings", "lesson_review_config"));
            if (docSnap.exists()) {
                const data = docSnap.data();
                headerImgUrl = data.header_image_base64 || headerImgUrl;
                rawSubject = data.subject_title || rawSubject;
                rawTeacher = data.teacher_name || rawTeacher;
                s1Name = data.sig_teacher || s1Name;
                s1Title = data.sig_teacher_title || s1Title;
                s2Name = data.sig_subject_coord || s2Name;
                s2Title = data.sig_subject_coord_title || s2Title;
                s3Name = data.sig_grade_coord || s3Name;
                s3Title = data.sig_grade_coord_title || s3Title;
                s4Name = data.sig_principal || s4Name;
                s4Title = data.sig_principal_title || s4Title;

                localStorage.setItem('lessonReview_headerImage', headerImgUrl);
                localStorage.setItem('lessonReview_defaultSubject', rawSubject);
                localStorage.setItem('lessonReview_defaultTeacher', rawTeacher);
                localStorage.setItem('lessonReview_sig1Name', s1Name);
                localStorage.setItem('lessonReview_sig1Title', s1Title);
                localStorage.setItem('lessonReview_sig2Name', s2Name);
                localStorage.setItem('lessonReview_sig2Title', s2Title);
                localStorage.setItem('lessonReview_sig3Name', s3Name);
                localStorage.setItem('lessonReview_sig3Title', s3Title);
                localStorage.setItem('lessonReview_sig4Name', s4Name);
                localStorage.setItem('lessonReview_sig4Title', s4Title);
            }
        } catch(e) {
            console.warn("Firestore fetch failed, using local defaults.", e);
        }
    }

    const headerImgEl = document.getElementById('printHeaderImage');
    const headerContainer = document.getElementById('printHeaderBannerContainer');
    if (headerImgUrl && headerImgEl) {
        headerImgEl.src = headerImgUrl;
        headerImgEl.classList.remove('hidden');
        headerImgEl.style.display = 'block';
        headerImgEl.style.margin = '0 auto';
        if (headerContainer) headerContainer.classList.remove('hidden');
    }

    const rawSY = document.getElementById('lpSchoolYear').value || "2026-2027";
    document.getElementById('printMainTitle').textContent = `CURRICULUM MAP / LEARNING PLAN IN ${rawSubject.toUpperCase()}`;
    document.getElementById('printSYHeader').textContent = `SCHOOL YEAR ${rawSY}`;

    const termStr = document.getElementById('lpAcademicTerm').value;
    const [semStr, qtrStr] = termStr.split('/');
    document.getElementById('printSemester').textContent = semStr;
    document.getElementById('printQuarter').textContent = qtrStr;

    const courseWeek = document.getElementById('lpCourseWeek').value;
    const dateRange = document.getElementById('lpDateRange').value;
    document.getElementById('printScopeHeader').textContent = `${courseWeek}: ${dateRange}`;

    document.getElementById('printSig1Name').textContent = s1Name;
    document.getElementById('printSig1Title').textContent = s1Title;
    document.getElementById('printSig2Name').textContent = s2Name;
    document.getElementById('printSig2Title').textContent = s2Title;
    document.getElementById('printSig3Name').textContent = s3Name;
    document.getElementById('printSig3Title').textContent = s3Title;
    document.getElementById('printSig4Name').textContent = s4Name;
    document.getElementById('printSig4Title').textContent = s4Title;

    const tbody = document.getElementById('printTableBody');
    tbody.innerHTML = ''; 

    // 🚀 NEW NATIVE ROWSPAN LOGIC
    window.currentPlan.forEach((session, index) => {
        const isFlex = session.session_name.toLowerCase().includes('flex');
        const isLab = session.session_name.includes("4-6");

        const objText = window.formatListForPrint(session.objectives || 'N/A', true); 
        const matText = window.formatListForPrint(window.currentWeeklyOverview.materials || '', false); 
        const prelimText = window.formatListForPrint(session.preliminary || '', true);
        const activitiesText = window.formatListForPrint(session.learning_activities || '', true);
        const cleanRemarks = (session.remarks || '').replace(/\s*\|\s*/g, '<br>').replace(/;/g, '<br>').replace(/\n/g, '<br>');

        // 1. Break the session into sequential row parts
        let parts = [];
        parts.push({ time: '', content: `<div style="font-weight: bold;">${session.session_name}</div>` });

        if (isFlex) {
            parts.push({ time: 'Async', content: `<strong>Learning Activities:</strong><br><div style="padding-left: 8px;">${activitiesText}</div>` });
        } else {
            parts.push({ time: isLab ? '10 mins' : '5 mins', content: `<strong>Preliminary Activities:</strong><br><div style="padding-left: 8px;">${prelimText}</div>` });
            parts.push({ time: isLab ? '15 mins' : '5 mins', content: `<strong>Motivation / Recall:</strong><br><div style="padding-left: 8px; white-space: pre-wrap;">${session.motivation || ''}</div>` });
            parts.push({ time: isLab ? '115 mins' : '26 mins', content: `<strong>Learning Activities:</strong><br><div style="padding-left: 8px;">${activitiesText}</div>` });
            parts.push({ time: isLab ? '10 mins' : '10 mins', content: `<strong>Evaluation:</strong><br><div style="padding-left: 8px; white-space: pre-wrap;">${session.evaluation || ''}</div>` });
            
            if (session.closing) {
                parts.push({ time: isLab ? '' : '4 mins', content: `<strong>Closing Activities:</strong><br><div style="padding-left: 8px; white-space: pre-wrap;">${session.closing || ''}</div>` });
            }
            if (session.values_integration) {
                parts.push({ time: '', content: `<strong>Values Integration:</strong><br><div style="padding-left: 8px; white-space: pre-wrap;">${session.values_integration || ''}</div>` });
            }
        }

        const rowCount = parts.length;

        // 2. Loop through parts and assign native HTML rows
        parts.forEach((part, pIndex) => {
            const tr = document.createElement('tr');
            let rowHtml = '';

            if (pIndex === 0) {
                // First sub-row gets the outer columns with rowspan
                if (index === 0) {
                    rowHtml += `
                        <td rowspan="${rowCount}" style="font-weight: bold; text-align: center; vertical-align: middle;">${window.currentWeeklyOverview.topic || ''}</td>
                        <td rowspan="${rowCount}" style="vertical-align: top;">
                            <strong>Content Standard:</strong><br>${window.currentWeeklyOverview.content_standard || ''}<br><br>
                            <strong>Performance Standard:</strong><br>${window.currentWeeklyOverview.performance_standard || ''}<br><br>
                            <strong>Formation Standard:</strong><br>${window.currentWeeklyOverview.formation_standard || ''}
                        </td>
                    `;
                } else {
                    rowHtml += `<td rowspan="${rowCount}"></td><td rowspan="${rowCount}"></td>`;
                }

                rowHtml += `
                    <td rowspan="${rowCount}" style="vertical-align: top;">
                        <strong>Competencies:</strong><br>${session.competencies || 'N/A'}<br><br>
                        <strong>Objectives:</strong><br>${objText}
                    </td>
                `;

                // Add Time & Content for the very first part
                rowHtml += `<td style="text-align: center; font-weight: bold; vertical-align: top; font-size: 10pt; padding: 6px;">${part.time}</td>`;
                rowHtml += `<td style="vertical-align: top; font-size: 10pt; padding: 6px;">${part.content}</td>`;

                // Finish outer columns
                rowHtml += `<td rowspan="${rowCount}" style="vertical-align: top;">${matText}</td>`;
                rowHtml += `<td rowspan="${rowCount}" style="vertical-align: top;">${cleanRemarks}</td>`;
            } else {
                // Subsequent rows strictly output Time & Activity cells
                rowHtml += `<td style="text-align: center; font-weight: bold; vertical-align: top; font-size: 10pt; padding: 6px;">${part.time}</td>`;
                rowHtml += `<td style="vertical-align: top; font-size: 10pt; padding: 6px;">${part.content}</td>`;
            }

            tr.innerHTML = rowHtml;
            tbody.appendChild(tr);
        });
    });

    return true;
};

window.exportPDF = async function() {
    const isReady = await window.buildDocumentLayout();
    if (isReady) {
        setTimeout(() => { window.print(); }, 300);
    }
};

window.saveAndPrint = async function() {
    const isSaved = await window.saveLessonPlan();
    const isReady = await window.buildDocumentLayout();
    if (isSaved && isReady) {
        setTimeout(() => { window.print(); }, 300);
    }
};

window.exportToWordDoc = async function() {
    if (typeof htmlDocx === 'undefined') return alert("The Word Document generator is still loading. Please wait.");
    
    const isReady = await window.buildDocumentLayout();
    if (!isReady) return;

    const rawGrade = window.currentTargetGrade.replace(/\D/g, "") || "11";
    const rawSubject = localStorage.getItem('lessonReview_defaultSubject') || "Subject";
    const shortSubject = rawSubject.split(/\s+/).map(w => w.match(/\d+/) ? w : w.substring(0, 4)).join('').replace(/[^a-zA-Z0-9]/g, "");

    const term = document.getElementById('lpAcademicTerm').value;
    const semNum = term.includes("SECOND SEMESTER") ? "2" : "1";
    let qtrNum = "1";
    if(term.includes("SECOND QUARTER")) qtrNum = "2";
    if(term.includes("THIRD QUARTER")) qtrNum = "3";
    if(term.includes("FOURTH QUARTER")) qtrNum = "4";

    const anchoredWeek = document.getElementById('lpCourseWeek').value.replace(/\D/g, "");
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
                th { background-color: #b4c6e7; text-align: center; font-weight: bold; }
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