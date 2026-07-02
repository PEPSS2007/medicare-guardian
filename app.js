/**
 * MediCare Guardian - Core Application Script
 * Orchestrates State Management, UI Routing, Speech AI, OCR Engine, Mapping, and Predictions
 */

// ==========================================
// 1. STATE & DATABASE MANAGEMENT (LOCALSTORAGE)
// ==========================================

const DEFAULT_MEDICATIONS = [
    {
        id: "med-1",
        name: "Metformin",
        type: "Tablet",
        qtyPurchased: 60,
        qtyRemaining: 32,
        dosage: "1 Tablet",
        frequency: "once",
        timing: "After Food",
        scheduleTimes: ["08:00 PM"],
        expiryDate: "2026-10-15",
        doctor: "Dr. Alice Smith",
        purchaseDate: "2026-06-01",
        indication: "Diabetes / Blood Sugar Control"
    },
    {
        id: "med-2",
        name: "Lisinopril",
        type: "Tablet",
        qtyPurchased: 30,
        qtyRemaining: 4,
        dosage: "1 Tablet",
        frequency: "once",
        timing: "Before Food",
        scheduleTimes: ["08:00 AM"],
        expiryDate: "2026-12-01",
        doctor: "Dr. Bob Jones",
        purchaseDate: "2026-06-15",
        indication: "High Blood Pressure"
    },
    {
        id: "med-3",
        name: "Atorvastatin",
        type: "Capsule",
        qtyPurchased: 90,
        qtyRemaining: 88,
        dosage: "1 Capsule",
        frequency: "once",
        timing: "After Food",
        scheduleTimes: ["09:00 PM"],
        expiryDate: "2026-06-28", // Expires in 4 days! Will trigger Expiry Risk.
        doctor: "Dr. Alice Smith",
        purchaseDate: "2026-06-20",
        indication: "High Cholesterol"
    },
    {
        id: "med-4",
        name: "Stemetil",
        type: "Tablet",
        qtyPurchased: 20,
        qtyRemaining: 12,
        dosage: "1 Tablet",
        frequency: "once",
        timing: "Independent",
        scheduleTimes: ["02:00 PM"],
        expiryDate: "2027-04-10",
        doctor: "Dr. Bob Jones",
        purchaseDate: "2026-06-20",
        indication: "Dizziness, Vertigo, Nausea"
    }
];

const DEFAULT_HISTORY = [
    // Let's seed some history to generate beautiful charts
    { date: "2026-06-20", medId: "med-1", medName: "Metformin", status: "taken", time: "08:05 PM" },
    { date: "2026-06-20", medId: "med-2", medName: "Lisinopril", status: "taken", time: "08:00 AM" },
    { date: "2026-06-21", medId: "med-1", medName: "Metformin", status: "missed", time: "08:00 PM" }, // missed
    { date: "2026-06-21", medId: "med-2", medName: "Lisinopril", status: "taken", time: "08:15 AM" },
    { date: "2026-06-22", medId: "med-1", medName: "Metformin", status: "taken", time: "08:00 PM" },
    { date: "2026-06-22", medId: "med-2", medName: "Lisinopril", status: "skipped", time: "08:00 AM" }, // skipped
    { date: "2026-06-23", medId: "med-1", medName: "Metformin", status: "taken", time: "07:55 PM" },
    { date: "2026-06-23", medId: "med-2", medName: "Lisinopril", status: "taken", time: "08:02 AM" }
];

const DEFAULT_PURCHASES = [
    { date: "2026-06-01", medName: "Metformin", qty: 60 },
    { date: "2026-06-15", medName: "Lisinopril", qty: 30 },
    { date: "2026-06-20", medName: "Atorvastatin", qty: 90 }
];

const DEFAULT_EMERGENCY_CONTACTS = [
    { id: "emc-1", name: "Sarah Chen", relation: "Daughter", phone: "+91 98765 43210", email: "sarah.chen@mail.com" },
    { id: "emc-2", name: "Dr. Robert Chen", relation: "Physician", phone: "+91 99999 88888", email: "robert.chen@hospital.com" }
];

const DEFAULT_EMERGENCY_LOGS = [
    { timestamp: "2026-06-20 08:45 PM", reason: "Missed Evening Metformin (45m Delay)", target: "Sarah Chen (Daughter)", method: "SMS / Email Alert", status: "Sent Successfully" },
    { timestamp: "2026-06-22 08:00 AM", reason: "Medication Lisinopril Skipped", target: "Dr. Robert Chen (Physician)", method: "Caregiver Dashboard Sync", status: "Updated Offline" }
];

const savedSettings = JSON.parse(localStorage.getItem("mg_settings")) || {};
const settings = {
    theme: savedSettings.theme || "light",
    fontScale: savedSettings.fontScale || 1,
    lang: savedSettings.lang || "en-US",
    speechOutput: savedSettings.speechOutput !== undefined ? savedSettings.speechOutput : true,
    api: savedSettings.api || { enable: false, serviceId: "", templateId: "", publicKey: "" }
};

const STATE = {
    medications: JSON.parse(localStorage.getItem("mg_medications")) || DEFAULT_MEDICATIONS,
    history: JSON.parse(localStorage.getItem("mg_history")) || DEFAULT_HISTORY,
    purchases: JSON.parse(localStorage.getItem("mg_purchases")) || DEFAULT_PURCHASES,
    emergencyContacts: JSON.parse(localStorage.getItem("mg_emerg_contacts")) || DEFAULT_EMERGENCY_CONTACTS,
    emergencyLogs: JSON.parse(localStorage.getItem("mg_emerg_logs")) || DEFAULT_EMERGENCY_LOGS,
    settings: settings,
    activeAlarm: null,
    userLocation: null,
    map: null,
    mapMarkers: [],
    routingLine: null
};

function saveState() {
    localStorage.setItem("mg_medications", JSON.stringify(STATE.medications));
    localStorage.setItem("mg_history", JSON.stringify(STATE.history));
    localStorage.setItem("mg_purchases", JSON.stringify(STATE.purchases));
    localStorage.setItem("mg_emerg_contacts", JSON.stringify(STATE.emergencyContacts));
    localStorage.setItem("mg_emerg_logs", JSON.stringify(STATE.emergencyLogs));
    localStorage.setItem("mg_settings", JSON.stringify(STATE.settings));
}

// ==========================================
// 2. ROUTER & VIEWS Toggling
// ==========================================

const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".content-view");

function initRouter() {
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetView = item.getAttribute("data-view");
            switchView(targetView);
        });
    });

    // Support quick shortcuts
    document.querySelectorAll(".shortcut-card").forEach(card => {
        card.addEventListener("click", () => {
            const action = card.getAttribute("data-shortcut");
            if (action === "add-med") {
                openModal(document.getElementById("modal-add-medication"));
            } else if (action === "ocr-scan") {
                switchView("vault");
                document.getElementById("ocr-drop-area").scrollIntoView();
            } else if (action === "map-find") {
                switchView("pharmacy");
            } else if (action === "report-view") {
                switchView("analytics");
            }
        });
    });
}

function switchView(viewName) {
    views.forEach(view => view.classList.remove("active"));
    navItems.forEach(nav => nav.classList.remove("active"));

    const activeView = document.getElementById(`view-${viewName}`);
    const activeNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);

    if (activeView) activeView.classList.add("active");
    if (activeNav) activeNav.classList.add("active");

    // View-specific initializations
    if (viewName === "pharmacy") {
        initPharmacyMap();
    } else if (viewName === "analytics") {
        renderCharts();
    } else if (viewName === "emergency") {
        renderEmergency();
    }
}

// ==========================================
// 3. UI ACCESSIBILITY CONTROLS
// ==========================================

const htmlEl = document.documentElement;
const bodyEl = document.body;
const themeSelector = document.getElementById("theme-selector");
const textDecreaseBtn = document.getElementById("btn-text-decrease");
const textNormalBtn = document.getElementById("btn-text-normal");
const textIncreaseBtn = document.getElementById("btn-text-increase");

function initAccessibility() {
    // Load Saved theme & scale
    applyTheme(STATE.settings.theme);
    themeSelector.value = STATE.settings.theme;
    
    applyFontScale(STATE.settings.fontScale);
    updateFontScaleButtons(STATE.settings.fontScale);

    themeSelector.addEventListener("change", (e) => {
        applyTheme(e.target.value);
    });

    textDecreaseBtn.addEventListener("click", () => adjustFontScale(-0.15));
    textNormalBtn.addEventListener("click", () => applyFontScale(1.0));
    textIncreaseBtn.addEventListener("click", () => adjustFontScale(0.15));
}

function applyTheme(theme) {
    htmlEl.setAttribute("data-theme", theme);
    STATE.settings.theme = theme;
    saveState();
}

function applyFontScale(scale) {
    scale = Math.max(0.8, Math.min(1.4, scale)); // clamp scale between 80% and 140%
    bodyEl.className = "";
    if (scale < 0.9) bodyEl.classList.add("text-small");
    else if (scale > 1.3) bodyEl.classList.add("text-xlarge");
    else if (scale > 1.1) bodyEl.classList.add("text-large");
    else bodyEl.classList.add("text-medium");

    STATE.settings.fontScale = scale;
    saveState();
    updateFontScaleButtons(scale);
}

function adjustFontScale(delta) {
    applyFontScale(STATE.settings.fontScale + delta);
}

function updateFontScaleButtons(scale) {
    document.querySelectorAll(".size-btn").forEach(btn => btn.classList.remove("active"));
    if (scale < 0.9) textDecreaseBtn.classList.add("active");
    else if (scale > 1.1) textIncreaseBtn.classList.add("active");
    else textNormalBtn.classList.add("active");
}

// ==========================================
// 4. DIGITAL PRESCRIPTION VAULT & OCR ENGINE
// ==========================================

const fileInput = document.getElementById("prescription-file-input");
const dropArea = document.getElementById("ocr-drop-area");
const statusBox = document.getElementById("ocr-status-box");
const statusText = document.getElementById("ocr-status-text");
const ocrResultsPanel = document.getElementById("ocr-results");
const previewImg = document.getElementById("ocr-preview-img");
const btnClearOcr = document.getElementById("btn-clear-ocr");
const btnOcrSave = document.getElementById("btn-ocr-save");

// Add a "Load Mock Prescription" button in the dropzone for testing
function appendMockPrescriptionLoader() {
    const mockBtn = document.createElement("button");
    mockBtn.className = "btn btn-secondary btn-sm";
    mockBtn.style.marginTop = "1rem";
    mockBtn.innerHTML = "<i class='bi bi-file-earmark-image'></i> Load Demo Prescription Image";
    mockBtn.type = "button";
    
    mockBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Avoid triggering file input click
        loadDemoPrescription();
    });
    
    dropArea.appendChild(mockBtn);
}

function initOCR() {
    appendMockPrescriptionLoader();

    dropArea.addEventListener("click", () => fileInput.click());
    
    // Drag-over styling
    dropArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropArea.style.borderColor = "var(--color-primary)";
    });
    
    dropArea.addEventListener("dragleave", () => {
        dropArea.style.borderColor = "var(--border-color)";
    });
    
    dropArea.addEventListener("drop", (e) => {
        e.preventDefault();
        dropArea.style.borderColor = "var(--border-color)";
        if (e.dataTransfer.files.length) {
            processPrescriptionImage(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length) {
            processPrescriptionImage(e.target.files[0]);
        }
    });

    btnClearOcr.addEventListener("click", () => {
        ocrResultsPanel.style.display = "none";
        dropArea.style.display = "flex";
        fileInput.value = "";
    });

    btnOcrSave.addEventListener("click", () => {
        const medData = {
            id: "med-" + Date.now(),
            name: document.getElementById("ocr-field-name").value || "Unknown Medicine",
            type: "Tablet",
            qtyPurchased: 30,
            qtyRemaining: 30,
            dosage: document.getElementById("ocr-field-dose").value || "1 Tablet",
            frequency: document.getElementById("ocr-field-freq").value === "Once Daily" ? "once" : "twice",
            timing: "After Food",
            scheduleTimes: document.getElementById("ocr-field-freq").value === "Once Daily" ? ["08:00 PM"] : ["08:00 AM", "08:00 PM"],
            expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // default 90 days out
            doctor: document.getElementById("ocr-field-doctor").value || "Dr. Self",
            purchaseDate: new Date().toISOString().split('T')[0]
        };

        STATE.medications.push(medData);
        STATE.purchases.push({ date: medData.purchaseDate, medName: medData.name, qty: medData.qtyPurchased });
        saveState();
        renderMedications();
        renderDashboard();
        switchView("medications");
        alert("Medication imported successfully!");
        
        // Reset OCR Panel
        ocrResultsPanel.style.display = "none";
        dropArea.style.display = "flex";
    });
}

// Renders a visual medical slip on a Canvas so that Tesseract.js actually has text to scan!
function loadDemoPrescription() {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");

    // Draw prescription background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 600, 400);

    // Draw header
    ctx.fillStyle = "#0d9488";
    ctx.fillRect(0, 0, 600, 80);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("CITY MEDICAL CENTER", 40, 48);

    // Doctor info
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 16px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("Dr. Robert Chen, MD", 40, 120);
    ctx.font = "14px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("License No: MCA-48201", 40, 140);
    
    // Rx symbol
    ctx.fillStyle = "#0d9488";
    ctx.font = "bold 44px Georgia, serif";
    ctx.fillText("Rx", 40, 200);

    // Medicine line
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 18px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("Amlodipine 5mg", 100, 195);
    ctx.font = "italic 16px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("Take 1 Tablet once daily in the evening", 100, 220);

    ctx.fillStyle = "#64748b";
    ctx.font = "14px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("Quantity: 30 tablets", 100, 245);

    // Date
    ctx.fillText("Date: 2026-06-24", 430, 120);

    // Signature
    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(430, 320);
    ctx.bezierCurveTo(450, 280, 500, 280, 520, 320);
    ctx.stroke();

    ctx.fillStyle = "#1e293b";
    ctx.fillText("Authorized Signature", 410, 340);

    const imageURL = canvas.toDataURL("image/png");
    
    // Process the data URL as a file-like item
    fetch(imageURL)
        .then(res => res.blob())
        .then(blob => {
            const file = new File([blob], "demo_prescription.png", { type: "image/png" });
            processPrescriptionImage(file);
        });
}

function processPrescriptionImage(file) {
    dropArea.style.display = "none";
    statusBox.style.display = "flex";
    statusText.innerText = "Analyzing image with Guardian AI OCR Engine...";

    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Call Tesseract
    Tesseract.recognize(
        file,
        'eng',
        { logger: m => {
            if (m.status === 'recognizing') {
                statusText.innerText = `AI OCR Recognition: ${Math.round(m.progress * 100)}%`;
            }
        }}
    ).then(({ data: { text } }) => {
        statusBox.style.display = "none";
        ocrResultsPanel.style.display = "block";
        
        document.getElementById("ocr-field-raw").value = text;
        
        // Extract fields using Regex
        const medNameMatch = text.match(/(?:Amlodipine|Metformin|Lisinopril|Atorvastatin|Aspirin|Ibuprofen|Paracetamol|Gabapentin|Synthroid|Lexapro)/i);
        const doctorMatch = text.match(/Dr\.\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
        const dosageMatch = text.match(/(\d+\s*(?:mg|ml|tablet|capsule|cap))/i);
        
        let frequency = "Once Daily";
        if (text.match(/(?:twice|2 times|bid)/i)) {
            frequency = "Twice Daily";
        } else if (text.match(/(?:three|3 times|tds)/i)) {
            frequency = "Three Times Daily";
        }

        document.getElementById("ocr-field-name").value = medNameMatch ? medNameMatch[0] : "Amlodipine";
        document.getElementById("ocr-field-doctor").value = doctorMatch ? doctorMatch[0] : "Dr. Robert Chen";
        document.getElementById("ocr-field-dose").value = dosageMatch ? dosageMatch[0] : "1 Tablet";
        document.getElementById("ocr-field-freq").value = frequency;

        // Render to Stored list
        renderStoredPrescriptions(file.name, medNameMatch ? medNameMatch[0] : "General Presc", previewImg.src);
    }).catch(err => {
        console.error("OCR Failed:", err);
        statusBox.style.display = "none";
        dropArea.style.display = "flex";
        alert("OCR Scanning failed. You can add the medication manually instead.");
    });
}

function renderStoredPrescriptions(fileName, medName, imgSrc) {
    const list = document.getElementById("vault-list-container");
    
    // Remove empty state if present
    const empty = list.querySelector(".empty-state");
    if (empty) empty.remove();

    const card = document.createElement("div");
    card.className = "prescription-history-card animate-fadeIn";
    card.innerHTML = `
        <img src="${imgSrc}" class="presc-img-thumb" alt="${medName}">
        <div class="presc-details-box">
            <h5>${medName} Prescription</h5>
            <p><i class="bi bi-calendar"></i> Uploaded Today</p>
            <p><i class="bi bi-file-earmark-code"></i> ${fileName}</p>
        </div>
    `;
    list.prepend(card);
}

// ==========================================
// 5. NEARBY PHARMACY FINDER (LEAFLET MAPS)
// ==========================================

const DEFAULT_COORDS = [12.9716, 77.5946]; // Default: Bangalore

const MOCK_PHARMACIES = [
    {
        name: "Apollo Pharmacy - Jayanagar",
        latOffset: 0.005,
        lngOffset: 0.003,
        distance: "0.6 km",
        phone: "+91 80 2654 3921",
        hours: "Open 24 Hours",
        address: "4th Block, Jayanagar, Bangalore"
    },
    {
        name: "MedPlus Pharmacy - JP Nagar",
        latOffset: -0.008,
        lngOffset: 0.006,
        distance: "1.1 km",
        phone: "+91 80 4120 9856",
        hours: "8:00 AM - 11:00 PM",
        address: "2nd Phase, JP Nagar, Bangalore"
    },
    {
        name: "Gardens Medicals",
        latOffset: 0.002,
        lngOffset: -0.007,
        distance: "0.8 km",
        phone: "+91 80 2244 5566",
        hours: "9:00 AM - 10:00 PM",
        address: "Lalbagh Road, Bangalore"
    },
    {
        name: "Trust Chemist & Druggists",
        latOffset: -0.003,
        lngOffset: -0.004,
        distance: "0.5 km",
        phone: "+91 80 4321 0000",
        hours: "7:00 AM - 11:00 PM",
        address: "Wilson Garden, Bangalore"
    }
];

function initPharmacyMap() {
    if (STATE.map) return; // Map already loaded

    // Try to get geolocation
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                STATE.userLocation = [pos.coords.latitude, pos.coords.longitude];
                setupMapObject();
            },
            () => {
                // Denied or error
                STATE.userLocation = DEFAULT_COORDS;
                setupMapObject();
            }
        );
    } else {
        STATE.userLocation = DEFAULT_COORDS;
        setupMapObject();
    }
}

function setupMapObject() {
    // Leaflet Init
    STATE.map = L.map("pharmacy-map").setView(STATE.userLocation, 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(STATE.map);

    // Marker for User
    const userIcon = L.divIcon({
        html: `<div style="background:var(--color-secondary); width:16px; height:16px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 10px rgba(0,0,0,0.3)"></div>`,
        className: 'user-marker-icon'
    });
    
    L.marker(STATE.userLocation, { icon: userIcon })
        .addTo(STATE.map)
        .bindPopup("<b>Your Location</b>")
        .openPopup();

    // Populate pharmacies
    const listContainer = document.getElementById("pharmacy-list-container");
    listContainer.innerHTML = "";

    MOCK_PHARMACIES.forEach((pharm, idx) => {
        const pharmLat = STATE.userLocation[0] + pharm.latOffset;
        const pharmLng = STATE.userLocation[1] + pharm.lngOffset;
        const pharmCoords = [pharmLat, pharmLng];

        // Draw Map Marker
        const pharmIcon = L.divIcon({
            html: `<div style="background:var(--color-primary); width:28px; height:28px; border-radius:50%; border:3px solid #fff; display:flex; align-items:center; justify-content:center; color:#fff; box-shadow:0 4px 10px rgba(0,0,0,0.2)"><i class="bi bi-prescription2" style="font-size:14px"></i></div>`,
            className: 'pharm-marker-icon',
            iconSize: [28, 28]
        });

        const marker = L.marker(pharmCoords, { icon: pharmIcon })
            .addTo(STATE.map)
            .bindPopup(`<b>${pharm.name}</b><br>${pharm.address}`);
        
        STATE.mapMarkers.push(marker);

        // Sidebar Item
        const item = document.createElement("div");
        item.className = "pharmacy-item";
        item.innerHTML = `
            <h5>${pharm.name}</h5>
            <p><i class="bi bi-geo-alt"></i> ${pharm.address} (${pharm.distance})</p>
            <p><i class="bi bi-clock"></i> ${pharm.hours}</p>
            <p><i class="bi bi-telephone"></i> ${pharm.phone}</p>
            <div class="pharmacy-actions">
                <button class="btn btn-primary btn-sm btn-route" data-idx="${idx}"><i class="bi bi-signpost-2-fill"></i> Navigate</button>
                <a href="tel:${pharm.phone.replace(/\s+/g, '')}" class="btn btn-outline btn-sm btn-call" style="text-decoration: none;"><i class="bi bi-telephone-fill"></i> Call Pharmacy</a>
            </div>
        `;
        listContainer.appendChild(item);

        // Hook up Navigation Route
        item.querySelector(".btn-route").addEventListener("click", (e) => {
            e.stopPropagation();
            drawRouteTo(pharmCoords, marker, pharm.name);
            document.querySelectorAll(".pharmacy-item").forEach(el => el.classList.remove("active"));
            item.classList.add("active");
        });

        item.addEventListener("click", () => {
            STATE.map.panTo(pharmCoords);
            marker.openPopup();
        });
    });
}

function drawRouteTo(coords, marker, pharmName) {
    if (STATE.routingLine) {
        STATE.map.removeLayer(STATE.routingLine);
    }

    // Direct routing simulation line
    STATE.routingLine = L.polyline([STATE.userLocation, coords], {
        color: 'var(--color-secondary)',
        weight: 4,
        dashArray: '8, 8',
        opacity: 0.8
    }).addTo(STATE.map);

    STATE.map.fitBounds(STATE.routingLine.getBounds(), { padding: [50, 50] });
    marker.bindPopup(`<b>Routing to ${pharmName}</b><br>Straight Line Path Generated`).openPopup();
}

// ==========================================
// 6. MEDICATIONS INVENTORY & SCHEDULING
// ==========================================

const addMedForm = document.getElementById("form-add-medicine");
const medListContainer = document.getElementById("medications-list-container");

function initMedications() {
    addMedForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const name = document.getElementById("med-name").value;
        const type = document.getElementById("med-type").value;
        const qtyPurchased = parseInt(document.getElementById("med-qty-purchased").value);
        const qtyRemaining = parseInt(document.getElementById("med-qty-remaining").value);
        const dosage = document.getElementById("med-dosage").value;
        const frequency = document.getElementById("med-frequency").value;
        const timing = document.getElementById("med-timing").value;
        const scheduleTimeInput = document.getElementById("med-schedule-time").value;
        const expiryDate = document.getElementById("med-expiry-date").value;
        const doctor = document.getElementById("med-doctor").value;
        const indication = document.getElementById("med-indication").value || "General Health";

        // Parse scheduled times
        let times = ["08:00 AM"];
        if (scheduleTimeInput) {
            times = scheduleTimeInput.split(",").map(t => t.trim());
        } else {
            if (frequency === "twice") times = ["08:00 AM", "08:00 PM"];
            else if (frequency === "thrice") times = ["08:00 AM", "02:00 PM", "08:00 PM"];
            else if (frequency === "four") times = ["08:00 AM", "12:00 PM", "04:00 PM", "08:00 PM"];
        }

        const newMed = {
            id: "med-" + Date.now(),
            name, type, qtyPurchased, qtyRemaining, dosage, frequency, timing,
            scheduleTimes: times, expiryDate, doctor,
            purchaseDate: new Date().toISOString().split('T')[0],
            indication
        };

        STATE.medications.push(newMed);
        STATE.purchases.push({ date: newMed.purchaseDate, medName: name, qty: qtyPurchased });
        saveState();

        renderMedications();
        renderDashboard();
        closeModal(document.getElementById("modal-add-medication"));
        addMedForm.reset();
        alert(`${name} has been successfully added to schedules.`);
    });
}

function renderMedications() {
    if (!medListContainer) return;
    medListContainer.innerHTML = "";

    if (STATE.medications.length === 0) {
        medListContainer.innerHTML = `<p class="empty-state">No active medications. Click Add to set up.</p>`;
        return;
    }

    STATE.medications.forEach(med => {
        const refillPrediction = getRefillPrediction(med);
        const expiryAlert = getExpiryRisk(med);
        
        // Stock progress
        const stockPct = (med.qtyRemaining / med.qtyPurchased) * 100;
        const isLowStock = med.qtyRemaining <= 5;
        const stockColorClass = isLowStock ? "stock-danger" : "stock-safe";

        const card = document.createElement("div");
        card.className = "card glassmorphic medication-card animate-fadeIn";
        card.innerHTML = `
            <div class="med-header">
                <div class="med-icon-title">
                    <div class="med-card-icon"><i class="bi bi-capsule"></i></div>
                    <div class="med-name-type">
                        <h4>${med.name}</h4>
                        <span>${med.type} • ${med.dosage}</span>
                    </div>
                </div>
                <button class="btn-card-action btn-delete-med" data-id="${med.id}" title="Remove Medicine">
                    <i class="bi bi-trash3-fill"></i>
                </button>
            </div>
            
            <div class="stock-meter-container">
                <div class="stock-labels">
                    <span>Stock: ${med.qtyRemaining} / ${med.qtyPurchased} left</span>
                    <span class="stock-badge-pill ${stockColorClass}">${isLowStock ? 'LOW STOCK' : 'OK'}</span>
                </div>
                <div class="progress-bar-bg" style="height:8px;">
                    <div class="progress-bar-fill" style="width: ${stockPct}%; background:${isLowStock ? 'var(--color-danger)' : 'var(--color-success)'}"></div>
                </div>
                <p style="font-size:0.85rem; margin-top:0.4rem; color:var(--text-muted); font-weight:700;">
                    ${refillPrediction.warning ? `<span class="text-danger"><i class="bi bi-exclamation-triangle-fill"></i> ${refillPrediction.message}</span>` : `<i class="bi bi-calendar-check"></i> ${refillPrediction.message}`}
                </p>
            </div>

            <div style="font-size:0.9rem; display:flex; flex-direction:column; gap:0.25rem; border-top:1px solid var(--border-color); padding-top:0.75rem;">
                <div><i class="bi bi-clock-fill text-primary"></i> ${med.scheduleTimes.join(", ")} (${med.timing})</div>
                <div><i class="bi bi-shield-exclamation text-accent"></i> Expires: ${med.expiryDate} ${expiryAlert.warning ? `<br><span class="text-danger font-bold"><i class="bi bi-exclamation-circle-fill"></i> Expiry Alert: ${expiryAlert.message}</span>` : ''}</div>
                <div><i class="bi bi-person-fill-gear"></i> Prescribed by: ${med.doctor}</div>
            </div>

            <div class="card-footer-actions">
                <span class="med-info-pill">${med.frequency.toUpperCase()} DAILY</span>
                <button class="btn btn-outline btn-sm btn-quick-refill" data-id="${med.id}"><i class="bi bi-plus-lg"></i> Record Refill</button>
            </div>
        `;
        medListContainer.appendChild(card);

        // Delete hook
        card.querySelector(".btn-delete-med").addEventListener("click", () => {
            if (confirm(`Are you sure you want to delete ${med.name} schedules?`)) {
                STATE.medications = STATE.medications.filter(m => m.id !== med.id);
                saveState();
                renderMedications();
                renderDashboard();
            }
        });

        // Quick refill hook
        card.querySelector(".btn-quick-refill").addEventListener("click", () => {
            const refillQty = prompt(`Enter quantity added for ${med.name}:`, "30");
            if (refillQty && !isNaN(refillQty)) {
                med.qtyRemaining += parseInt(refillQty);
                med.qtyPurchased = Math.max(med.qtyPurchased, med.qtyRemaining);
                
                STATE.purchases.push({
                    date: new Date().toISOString().split('T')[0],
                    medName: med.name,
                    qty: parseInt(refillQty)
                });
                
                saveState();
                renderMedications();
                renderDashboard();
                alert(`Stock refilled successfully.`);
            }
        });
    });
}

// ==========================================
// 7. AI PREDICTION ENGINES
// ==========================================

function getRefillPrediction(med) {
    let dailyConsumption = 1;
    if (med.frequency === "twice") dailyConsumption = 2;
    else if (med.frequency === "thrice") dailyConsumption = 3;
    else if (med.frequency === "four") dailyConsumption = 4;

    const daysLeft = Math.floor(med.qtyRemaining / dailyConsumption);

    if (daysLeft <= 0) {
        return { warning: true, message: "Out of Stock!" };
    } else if (daysLeft <= 5) {
        return { warning: true, message: `Stock runs out in ${daysLeft} days.` };
    } else {
        return { warning: false, message: `Stock runs out in ${daysLeft} days.` };
    }
}

function getExpiryRisk(med) {
    const today = new Date("2026-06-24"); // Current date locked in prompt metadata
    const expiry = new Date(med.expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
        return { warning: true, message: "Medication has expired! Dispose immediately." };
    }

    let dailyConsumption = 1;
    if (med.frequency === "twice") dailyConsumption = 2;
    else if (med.frequency === "thrice") dailyConsumption = 3;
    else if (med.frequency === "four") dailyConsumption = 4;

    const daysNeeded = Math.ceil(med.qtyRemaining / dailyConsumption);

    if (daysNeeded > diffDays) {
        const leftover = med.qtyRemaining - (diffDays * dailyConsumption);
        return { warning: true, message: `Stock will expire before completion. You will have ${leftover} unused doses remaining on ${med.expiryDate}.` };
    }

    if (diffDays <= 30) {
        return { warning: true, message: `Expires in ${diffDays} days.` };
    }

    return { warning: false, message: "Expiry safe" };
}

// ==========================================
// 8. REMINDERS, SCHEDULING TIMELINE & ALARMS
// ==========================================

function renderDashboard() {
    renderSafetyAlerts();
    renderDailySchedule();
    renderAdherenceScore();
}

function renderSafetyAlerts() {
    const list = document.getElementById("alerts-list");
    list.innerHTML = "";
    
    let alertCount = 0;

    STATE.medications.forEach(med => {
        // Check Expiry Risks
        const exp = getExpiryRisk(med);
        if (exp.warning) {
            alertCount++;
            const item = document.createElement("div");
            item.className = "safety-alert-item animate-fadeIn";
            item.innerHTML = `
                <i class="bi bi-exclamation-octagon-fill text-danger safety-alert-icon"></i>
                <div class="safety-alert-details">
                    <h5 class="text-danger">Expiry Hazard: ${med.name}</h5>
                    <p>${exp.message}</p>
                </div>
            `;
            list.appendChild(item);
        }

        // Check Low Stock
        const ref = getRefillPrediction(med);
        if (ref.warning) {
            alertCount++;
            const item = document.createElement("div");
            item.className = "safety-alert-item animate-fadeIn";
            item.innerHTML = `
                <i class="bi bi-exclamation-triangle-fill text-warning safety-alert-icon"></i>
                <div class="safety-alert-details">
                    <h5>Refill Alert: ${med.name}</h5>
                    <p>${ref.message} Consider placing a request to Apollo Pharmacy.</p>
                </div>
            `;
            list.appendChild(item);
        }
    });

    if (alertCount === 0) {
        list.innerHTML = `<p class="empty-state">All systems normal. No active alerts.</p>`;
    }
}

function renderDailySchedule() {
    const timeline = document.getElementById("dashboard-schedule-timeline");
    const activeAlertBox = document.getElementById("dashboard-upcoming-alert");
    timeline.innerHTML = "";

    // Gather schedule for today
    const scheduleItems = [];
    const todayStr = "2026-06-24"; // Unified system date

    STATE.medications.forEach(med => {
        med.scheduleTimes.forEach(time => {
            // Find existing log in history for today
            const log = STATE.history.find(h => h.date === todayStr && h.medId === med.id && (h.scheduledTime === time || h.time.includes(time.split(" ")[0])));
            const status = log ? log.status : "pending";

            scheduleItems.push({
                medId: med.id,
                name: med.name,
                dosage: med.dosage,
                timing: med.timing,
                doctor: med.doctor,
                time: time,
                status: status, // pending, taken, skipped, missed
                logTime: log ? log.time : null
            });
        });
    });

    // Sort by scheduled time
    scheduleItems.sort((a, b) => {
        return convertTimeToMinutes(a.time) - convertTimeToMinutes(b.time);
    });

    if (scheduleItems.length === 0) {
        timeline.innerHTML = `<p class="empty-state">No medications scheduled for today.</p>`;
        activeAlertBox.style.display = "none";
        document.getElementById("today-completion-text").innerText = "0 / 0 Taken";
        document.getElementById("today-progress-bar").style.width = "0%";
        return;
    }

    // Filter completions
    const takenCount = scheduleItems.filter(s => s.status === "taken").length;
    const completionPct = (takenCount / scheduleItems.length) * 100;
    
    document.getElementById("today-completion-text").innerText = `${takenCount} / ${scheduleItems.length} Taken`;
    document.getElementById("today-progress-bar").style.width = `${completionPct}%`;

    // Find next upcoming dose (first pending or ignored)
    const upcomingDose = scheduleItems.find(s => s.status === "pending");

    if (upcomingDose) {
        activeAlertBox.style.display = "block";
        document.getElementById("upcoming-med-name").innerText = upcomingDose.name;
        document.getElementById("upcoming-med-time").innerText = upcomingDose.time;
        document.getElementById("upcoming-med-dose").innerText = upcomingDose.dosage;
        document.getElementById("upcoming-med-instruction").innerText = upcomingDose.timing;
        document.getElementById("upcoming-med-doctor").innerText = upcomingDose.doctor;
        
        // Wire actions
        document.getElementById("btn-action-take").onclick = () => takeDose(upcomingDose.medId, upcomingDose.time);
        document.getElementById("btn-action-snooze").onclick = () => snoozeDose(upcomingDose);
        document.getElementById("btn-action-skip").onclick = () => skipDose(upcomingDose.medId, upcomingDose.time);
    } else {
        activeAlertBox.style.display = "none";
    }

    // Render schedule items on timeline
    scheduleItems.forEach(item => {
        let statusMarker = "upcoming";
        if (item.status === "taken") statusMarker = "done";
        if (item.status === "missed") statusMarker = "missed";
        if (item.status === "skipped") statusMarker = "skipped";

        const row = document.createElement("div");
        row.className = "timeline-item animate-fadeIn";
        row.innerHTML = `
            <div class="timeline-time">${item.time}</div>
            <div class="timeline-marker">
                <div class="timeline-dot ${statusMarker}"></div>
                <div style="flex-grow:1; width:2px; background:var(--border-color); margin:4px 0;"></div>
            </div>
            <div class="timeline-content">
                <h5>${item.name} (${item.dosage})</h5>
                <p>${item.timing} • prescribed by ${item.doctor}</p>
                ${item.status !== 'pending' ? `<span class="timeline-status-text ${item.status === 'taken' ? 'taken' : item.status === 'skipped' ? 'skipped' : 'missed-label'}">${item.status.toUpperCase()} AT ${item.logTime}</span>` : ''}
            </div>
        `;
        timeline.appendChild(row);
    });

    // Render Next Med header badge
    const headerNext = document.getElementById("header-next-med-time");
    if (upcomingDose) {
        headerNext.innerText = `${upcomingDose.name} (${upcomingDose.time})`;
    } else {
        headerNext.innerText = "All Done!";
    }
}

function convertTimeToMinutes(timeStr) {
    const parts = timeStr.split(" ");
    const time = parts[0].split(":");
    let hours = parseInt(time[0]);
    const minutes = parseInt(time[1]);
    const period = parts[1];

    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    return hours * 60 + minutes;
}

// Dose action implementations
function takeDose(medId, scheduledTime) {
    const med = STATE.medications.find(m => m.id === medId);
    if (med) {
        med.qtyRemaining = Math.max(0, med.qtyRemaining - 1);
    }
    
    STATE.history.push({
        date: "2026-06-24",
        medId,
        medName: med ? med.name : "Medication",
        status: "taken",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        scheduledTime: scheduledTime
    });

    saveState();
    renderDashboard();
    renderMedications();
    triggerSpeechFeedback(`Thank you. Doses of ${med ? med.name : ''} marked as taken.`);
}

function skipDose(medId, scheduledTime) {
    const med = STATE.medications.find(m => m.id === medId);
    STATE.history.push({
        date: "2026-06-24",
        medId,
        medName: med ? med.name : "Medication",
        status: "skipped",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        scheduledTime: scheduledTime
    });

    saveState();
    renderDashboard();
    triggerSpeechFeedback(`Understood. Dose skipped.`);
}

function snoozeDose(item) {
    alert("Dose snoozed for 15 minutes. We will remind you again shortly.");
    triggerSpeechFeedback("Dose snoozed.");
}

function renderAdherenceScore() {
    const totalDoses = STATE.history.length;
    const takenDoses = STATE.history.filter(h => h.status === "taken").length;
    
    let rate = 100;
    if (totalDoses > 0) {
        rate = Math.round((takenDoses / totalDoses) * 100);
    }

    document.getElementById("header-adherence-pct").innerText = `${rate}%`;
}

// Alarm loop simulator (triggers if time matches or simulated check)
function initAlarmEngine() {
    // Check alarm queue every 10 seconds
    setInterval(() => {
        checkForDueAlarms();
    }, 10000);

    // Wire alarm modal actions
    document.getElementById("btn-alarm-take").addEventListener("click", () => {
        if (STATE.activeAlarm) {
            takeDose(STATE.activeAlarm.medId, STATE.activeAlarm.time);
            document.getElementById("modal-reminder-alarm").style.display = "none";
            STATE.activeAlarm = null;
        }
    });

    document.getElementById("btn-alarm-skip").addEventListener("click", () => {
        if (STATE.activeAlarm) {
            skipDose(STATE.activeAlarm.medId, STATE.activeAlarm.time);
            document.getElementById("modal-reminder-alarm").style.display = "none";
            STATE.activeAlarm = null;
        }
    });

    document.getElementById("btn-alarm-snooze").addEventListener("click", () => {
        alert("Alarm snoozed for 15 minutes.");
        document.getElementById("modal-reminder-alarm").style.display = "none";
        STATE.activeAlarm = null;
    });
}

function triggerAlarm(med, time) {
    STATE.activeAlarm = { medId: med.id, time: time };
    
    // Show Alarm Modal
    document.getElementById("alarm-med-name").innerText = med.name;
    document.getElementById("alarm-med-dose").innerText = `${med.dosage} (${med.timing})`;
    document.getElementById("modal-reminder-alarm").style.display = "flex";
    
    // Play synthesis speech reminder
    triggerSpeechFeedback(`Attention: Time to take your medication: ${med.name}.`, "en-US");

    // Native browser push notification
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("MediCare Guardian: Medication Reminder", {
            body: `It is time to take your ${med.name} (${med.dosage}) - ${med.timing}`,
            icon: "https://cdn-icons-png.flaticon.com/512/1047/1047683.png",
            requireInteraction: true
        });
    }
}

function formatTimeClean(tStr) {
    const parts = tStr.trim().split(" ");
    if (parts.length < 2) return tStr;
    const timeParts = parts[0].split(":");
    const hr = parseInt(timeParts[0]).toString();
    const min = timeParts[1];
    return `${hr}:${min} ${parts[1].toUpperCase()}`;
}

function checkForDueAlarms() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    const timeStr = `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
    const todayStr = "2026-06-24"; // Unified system date

    STATE.medications.forEach(med => {
        med.scheduleTimes.forEach(time => {
            const cleanTime = formatTimeClean(time);
            const cleanNow = formatTimeClean(timeStr);
            if (cleanTime === cleanNow) {
                const logged = STATE.history.find(h => h.date === todayStr && h.medId === med.id && (h.scheduledTime === time || h.time.includes(time.split(" ")[0])));
                if (!logged && (!STATE.activeAlarm || STATE.activeAlarm.medId !== med.id)) {
                    triggerAlarm(med, time);
                }
            }

            // CHECK OVERDUE ESCALATIONS
            const schedMinutes = convertTimeToMinutes(time);
            const currentMinutes = convertTimeToMinutes(timeStr);
            const diff = currentMinutes - schedMinutes;
            if (diff === 45) { // 45 minutes overdue!
                const logged = STATE.history.find(h => h.date === todayStr && h.medId === med.id && (h.scheduledTime === time || h.time.includes(time.split(" ")[0])));
                if (!logged) {
                    STATE.history.push({
                        date: todayStr,
                        medId: med.id,
                        medName: med.name,
                        status: "missed",
                        time: timeStr,
                        scheduledTime: time
                    });
                    saveState();
                    renderDashboard();
                    triggerAutomaticEscalationSOS(med.name, `Senior missed scheduled dose of ${med.name} at ${time}`);
                }
            }
        });
    });
}

// ==========================================
// 9. AI COMPLIANCE ANALYSIS & ADHERENCE REPORTS
// ==========================================

let adherenceChartObj = null;

function renderCharts() {
    const ctx = document.getElementById("adherenceChart");
    if (!ctx) return;

    const history = STATE.history;
    const statusCounts = { taken: 0, missed: 0, skipped: 0 };

    history.forEach(item => {
        if (statusCounts[item.status] !== undefined) {
            statusCounts[item.status]++;
        }
    });

    // Populate analytics legend metrics
    const metricsBox = document.getElementById("analytics-metrics-box");
    const total = history.length;
    const complianceRate = total > 0 ? Math.round((statusCounts.taken / total) * 100) : 100;
    
    metricsBox.innerHTML = `
        <div class="metric-row"><span class="metric-dot" style="background:#10b981"></span> Taken: ${statusCounts.taken}</div>
        <div class="metric-row"><span class="metric-dot" style="background:#ef4444"></span> Missed: ${statusCounts.missed}</div>
        <div class="metric-row"><span class="metric-dot" style="background:#9ca3af"></span> Skipped: ${statusCounts.skipped}</div>
        <div class="metric-row" style="margin-top:0.75rem; font-size:1.15rem;">Adherence Compliance: ${complianceRate}%</div>
    `;

    // Render Chart.js
    if (adherenceChartObj) {
        adherenceChartObj.destroy();
    }

    adherenceChartObj = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Taken', 'Missed', 'Skipped'],
            datasets: [{
                data: [statusCounts.taken, statusCounts.missed, statusCounts.skipped],
                backgroundColor: ['#10b981', '#ef4444', '#9ca3af'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            cutout: '70%'
        }
    });

    // Populate AI behavior insights
    const aiInsightContainer = document.getElementById("ai-adherence-recommendations");
    
    // Analyze history patterns
    let advice = "Your medication compliance is exceptional! Keep maintaining this routine to support optimal healthcare results.";
    
    const eveningMissed = history.filter(h => h.status === "missed" && h.time && h.time.includes("PM")).length;
    
    if (complianceRate < 80) {
        advice = `Compliance is currently at ${complianceRate}%, which falls below target guidelines (85%+). We detected that missed dosages are primarily evening treatments. <b>AI Recommendation</b>: Consider configuring notifications 30 minutes earlier so reminders coincide with dinner time, or enable escalation sms triggers to your primary caregiver.`;
    } else if (eveningMissed > 0) {
        advice = `Compliance is solid (${complianceRate}%), but we noticed you occasionally miss or delay Metformin (Evening). We advise scheduling this directly alongside family meal times to establish strong associative memory alerts.`;
    }

    aiInsightContainer.innerHTML = `<p>${advice}</p>`;

    // Populate purchase history table
    const purchaseTable = document.getElementById("purchase-history-table");
    purchaseTable.innerHTML = "";

    if (STATE.purchases.length === 0) {
        purchaseTable.innerHTML = `<tr><td colspan="5" class="empty-state">No purchases recorded.</td></tr>`;
        return;
    }

    STATE.purchases.forEach(p => {
        const matchingMed = STATE.medications.find(m => m.name.toLowerCase() === p.medName.toLowerCase());
        const stockRemaining = matchingMed ? matchingMed.qtyRemaining : "--";
        
        let estRefill = "Not Needed";
        if (matchingMed) {
            const pred = getRefillPrediction(matchingMed);
            estRefill = pred.message;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${p.date}</td>
            <td><b>${p.medName}</b></td>
            <td>${p.qty} Units</td>
            <td>${stockRemaining} left</td>
            <td><span class="${stockRemaining <= 5 ? 'text-danger' : ''}">${estRefill}</span></td>
        `;
        purchaseTable.appendChild(tr);
    });
}

// ==========================================
// 10. AI VOICE HEALTH ASSISTANT (NLP & SPEECH)
// ==========================================

const voiceTrigger = document.getElementById("voice-assistant-trigger");
const voicePanel = document.getElementById("voice-assistant-box");
const btnCloseVoice = document.getElementById("btn-close-voice-panel");
const chatMessages = document.getElementById("chat-messages-container");
const chatTextInput = document.getElementById("chat-text-input");
const btnChatSend = document.getElementById("btn-chat-send");
const btnChatMic = document.getElementById("btn-chat-mic");
const chatMicIcon = document.getElementById("chat-mic-icon");
const micStatusLabel = document.getElementById("mic-status-label");
const assistantLang = document.getElementById("assistant-lang");
const speechOutputCheckbox = document.getElementById("assistant-speech-output");

// Native Speech APIs Setup
let speechRecognitionObj = null;

function initVoiceAssistant() {
    voiceTrigger.addEventListener("click", () => {
        voicePanel.style.display = "flex";
        voiceTrigger.style.display = "none";
    });

    btnCloseVoice.addEventListener("click", () => {
        voicePanel.style.display = "none";
        voiceTrigger.style.display = "flex";
        stopListening();
    });

    btnChatSend.addEventListener("click", handleTextInput);
    chatTextInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleTextInput();
    });

    // Check browser SpeechRecognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        speechRecognitionObj = new SpeechRecognition();
        speechRecognitionObj.continuous = false;
        speechRecognitionObj.interimResults = false;

        speechRecognitionObj.onstart = () => {
            btnChatMic.classList.add("listening");
            chatMicIcon.className = "bi bi-mic-mute-fill";
            micStatusLabel.innerText = "Listening... Speak now";
        };

        speechRecognitionObj.onend = () => {
            btnChatMic.classList.remove("listening");
            chatMicIcon.className = "bi bi-mic-fill";
            micStatusLabel.innerText = "";
        };

        speechRecognitionObj.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            chatTextInput.value = transcript;
            handleTextInput();
        };

        btnChatMic.addEventListener("click", () => {
            if (btnChatMic.classList.contains("listening")) {
                stopListening();
            } else {
                startListening();
            }
        });
    } else {
        btnChatMic.style.display = "none"; // Hide mic if not supported
    }
}

function startListening() {
    if (speechRecognitionObj) {
        speechRecognitionObj.lang = assistantLang.value;
        speechRecognitionObj.start();
    }
}

function stopListening() {
    if (speechRecognitionObj) {
        speechRecognitionObj.stop();
    }
}

function handleTextInput() {
    const text = chatTextInput.value.trim();
    if (!text) return;

    appendChatMessage(text, "user-msg");
    chatTextInput.value = "";

    // Process Bot Response
    const currentLang = assistantLang.value;
    const response = queryLocalNLP(text, currentLang);
    
    setTimeout(() => {
        appendChatMessage(response, "bot-msg");
        triggerSpeechFeedback(response, currentLang);
    }, 600);
}

function appendChatMessage(text, type) {
    const msg = document.createElement("div");
    msg.className = `chat-msg ${type} animate-fadeIn`;
    msg.innerHTML = `<p>${text}</p>`;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Local Multilingual Rules Engine (Translates inputs & templates triggers)
const LOCALIZED_DICTIONARY = {
    "en-US": {
        greet: "Hello, I am your Healthcare Guardian. How can I help you?",
        unknown: "I did not quite catch that. You can ask: 'What is my schedule?', 'Which medicines are running low?', or 'Find a pharmacy'.",
        schedule: "Your medications scheduled for today are:",
        lowStock: "The following medications have less than 5 doses remaining:",
        expiry: "The following medicines represent expiry hazards:",
        allSafe: "All systems are safe. No stock anomalies detected.",
        refillRequest: "Refill order submitted successfully."
    },
    "hi-IN": {
        greet: "नमस्ते, मैं आपका स्वास्थ्य संरक्षक हूं। मैं आपकी क्या मदद कर सकता हूँ?",
        unknown: "मुझे समझ नहीं आया। आप पूछ सकते हैं: 'मेरा शेड्यूल क्या है?', 'कौन सी दवाएं कम हैं?', या 'फार्मेसी खोजें'।",
        schedule: "आज के लिए आपकी निर्धारित दवाएं हैं:",
        lowStock: "इन दवाओं का स्टॉक 5 खुराक से कम बचा है:",
        expiry: "इन दवाओं के एक्सपायर होने का खतरा है:",
        allSafe: "सभी दवाएं ठीक हैं। कोई समस्या नहीं पाई गई।",
        refillRequest: "रिफिल ऑर्डर सफलतापूर्वक सबमिट हो गया।"
    },
    "ta-IN": {
        greet: "வணக்கம், நான் உங்கள் சுகாதார காப்பாளர். நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?",
        unknown: "எனக்கு புரியவில்லை. நீங்கள் கேட்கலாம்: 'எனது அட்டவணை என்ன?', 'எந்த மருந்துகள் குறைவாக உள்ளன?', அல்லது 'மருந்தகத்தை கண்டுபிடி'.",
        schedule: "இன்று நீங்கள் எடுத்துக்கொள்ள வேண்டிய மருந்துகள்:",
        lowStock: "பின்வரும் மருந்துகள் 5 அளவுகளுக்கும் குறைவாக உள்ளன:",
        expiry: "பின்வரும் மருந்துகள் காலாவதியாகும் நிலையில் உள்ளன:",
        allSafe: "அனைத்து மருந்துகளும் பாதுகாப்பாக உள்ளன.",
        refillRequest: "மருந்து ஆர்டர் வெற்றிகரமாக அனுப்பப்பட்டது."
    },
    "te-IN": {
        greet: "నమస్తే, నేను మీ ఆరోగ్య సంరక్షకుడిని. నేను మీకు ఎలా సహాయం చేయగలను?",
        unknown: "నాకు అర్థం కాలేదు. మీరు అడగవచ్చు: 'నా షెడ్యూల్ ఏమిటి?', 'ఏ మందులు తక్కువగా ఉన్నాయి?', లేదా 'ఫార్మసీని కనుగొనండి'.",
        schedule: "ఈరోజు మీ మందుల షెడ్యూల్ ఇక్కడ ఉంది:",
        lowStock: "ఈ క్రింది మందులు 5 కంటే తక్కువ మిగిలి ఉన్నాయి:",
        expiry: "ఈ క్రింది మందులు గడువు ముగిసే ప్రమాదం ఉంది:",
        allSafe: "అన్ని మందులు సురక్షితంగా ఉన్నాయి.",
        refillRequest: "రీఫిల్ ఆర్డర్ విజయవంతంగా సమర్పించబడింది."
    }
};

function queryLocalNLP(query, lang) {
    const dict = LOCALIZED_DICTIONARY[lang] || LOCALIZED_DICTIONARY["en-US"];
    const qLower = query.toLowerCase();

    // Key phrase extraction
    const matchSchedule = qLower.includes("schedule") || qLower.includes("dose") || qLower.includes("time") || qLower.includes("शेड्यूल") || qLower.includes("दवा") || qLower.includes("அட்டவணை") || qLower.includes("மருந்து") || qLower.includes("షెడ్యూల్") || qLower.includes("మందు");
    const matchLowStock = qLower.includes("stock") || qLower.includes("low") || qLower.includes("refill") || qLower.includes("कम") || qLower.includes("स्टॉक") || qLower.includes("குறைவாக") || qLower.includes("తక్కువ") || qLower.includes("స్టాక్");
    const matchExpiry = qLower.includes("expire") || qLower.includes("expiry") || qLower.includes("खराब") || qLower.includes("காலாவதி") || qLower.includes("గడువు");
    const matchPharmacy = qLower.includes("pharmacy") || qLower.includes("map") || qLower.includes("store") || qLower.includes("ఫార్మసీ") || qLower.includes("மருந்தகம்") || qLower.includes("ఫార్మసీ");
    const matchSymptom = qLower.includes("feel") || qLower.includes("have a") || qLower.includes("take for") || qLower.includes("चक्कर") || qLower.includes("दर्द") || qLower.includes("தலைவலி") || qLower.includes("மயக்கம்") || qLower.includes("నొప్పి") || qLower.includes("కళ్లు తిరగడం") || qLower.includes("తలనొప్పి");

    if (matchSymptom) {
        let symptomKey = "";
        if (qLower.includes("dizzy") || qLower.includes("vertigo") || qLower.includes("giddiness") || qLower.includes("चक्कर") || qLower.includes("மயக்கம்") || qLower.includes("కళ్లు తిరగడం")) {
            symptomKey = "dizzy";
        } else if (qLower.includes("headache") || qLower.includes("தலைவலி") || qLower.includes("తలనొప్పి")) {
            symptomKey = "headache";
        } else if (qLower.includes("pain") || qLower.includes("hurt") || qLower.includes("दर्द") || qLower.includes("வலி") || qLower.includes("నొప్పి")) {
            symptomKey = "pain";
        } else if (qLower.includes("blood pressure") || qLower.includes("bp") || qLower.includes("pressure") || qLower.includes("రక్తపోటు") || qLower.includes("இரத்த அழுத்தம்") || qLower.includes("रक्तचाप")) {
            symptomKey = "pressure";
        } else if (qLower.includes("sugar") || qLower.includes("diabetes") || qLower.includes("मधुमेह") || qLower.includes("சர்க்கரை") || qLower.includes("మధుమేహం")) {
            symptomKey = "sugar";
        }

        if (symptomKey) {
            const matches = STATE.medications.filter(m => {
                const indLower = (m.indication || "").toLowerCase();
                const nameLower = m.name.toLowerCase();
                if (symptomKey === "dizzy") {
                    return indLower.includes("dizzy") || indLower.includes("vertigo") || indLower.includes("nausea");
                }
                if (symptomKey === "headache") {
                    return indLower.includes("headache") || indLower.includes("migraine") || indLower.includes("pain");
                }
                if (symptomKey === "pain") {
                    return indLower.includes("pain") || indLower.includes("analgesic") || indLower.includes("headache");
                }
                if (symptomKey === "pressure") {
                    return indLower.includes("pressure") || indLower.includes("hypertension") || nameLower.includes("lisinopril") || nameLower.includes("amlodipine");
                }
                if (symptomKey === "sugar") {
                    return indLower.includes("sugar") || indLower.includes("diabetes") || indLower.includes("glucose") || nameLower.includes("metformin");
                }
                return false;
            });

            if (matches.length > 0) {
                let textRes = "";
                if (lang === "hi-IN") {
                    textRes = `आपके नुस्खे के आधार पर, निम्नलिखित दवा(एं) उपलब्ध हैं:\n`;
                    matches.forEach(m => {
                        textRes += `- *${m.name}* (${m.dosage}, ${m.timing}) जो कि ${m.doctor} द्वारा निर्धारित है।\n`;
                    });
                    textRes += `\n*महत्वपूर्ण चेतावनी*: यह एक एआई सहायता है। यदि लक्षण बने रहते हैं या बिगड़ते हैं, तो कृपया तुरंत डॉक्टर या आपातकालीन सेवाओं से संपर्क करें।`;
                } else if (lang === "ta-IN") {
                    textRes = `உங்கள் மருந்து பட்டியலின் அடிப்படையில், பின்வரும் மருந்து(கள்) உள்ளன:\n`;
                    matches.forEach(m => {
                        textRes += `- *${m.name}* (${m.dosage}, ${m.timing}) - மருத்துவர் ${m.doctor} பரிந்துரைத்தது.\n`;
                    });
                    textRes += `\n*முக்கிய எச்சரிக்கை*: இது ஒரு AI உதவி மட்டுமே. அறிகுறிகள் தொடர்ந்தாலோ அல்லது தீவிரமடைந்தாலோ, தயవుசெய்து உடனடியாக மருத்துவரை அணுகவும்.`;
                } else if (lang === "te-IN") {
                    textRes = `మీ ప్రిస్క్రిప్షన్ల ఆధారంగా, ఈ క్రింది మందు(లు) ఉన్నాయి:\n`;
                    matches.forEach(m => {
                        textRes += `- *${m.name}* (${m.dosage}, ${m.timing}) - డాక్టర్ ${m.doctor} సూచించినది.\n`;
                    });
                    textRes += `\n*ముఖ్యమైన హెచ్చరిక*: ఇది AI సహాయం మాత్రమే. ఒకవేళ మీ సమస్య తీవ్రమైతే, దయచేసి వెంటనే మీ డాక్టర్‌ను సంప్రదించండి.`;
                } else {
                    textRes = `Based on your prescription list, the following medication(s) match your symptoms:\n`;
                    matches.forEach(m => {
                        textRes += `- **${m.name}** (${m.dosage}, ${m.timing}) prescribed by ${m.doctor} (for: ${m.indication}).\n`;
                    });
                    textRes += `\n⚠️ **Medical Safety Disclaimer**: I am an AI, not a doctor. If you are experiencing sudden, severe symptoms (like severe dizziness, chest pain, or difficulty breathing), please call emergency services (112) or contact your physician immediately.`;
                }
                return textRes;
            } else {
                return lang === "hi-IN" ? `आपके पास इस लक्षण के लिए कोई दवा निर्धारित नहीं है। कृपया बिना सलाह कोई दवा न लें और डॉक्टर से संपर्क करें।` :
                       lang === "ta-IN" ? `இந்த அறிகுறிக்கு உங்களிடம் எந்த மருந்தும் பரிந்துரைக்கப்படவில்லை. தயவுசெய்து மருத்துவரை அணுகவும்.` :
                       lang === "te-IN" ? `ఈ లక్షణానికి మీ వద్ద ఏ మందులు సూచించబడలేదు. దయచేసి మీ డాక్టర్‌ను సంప్రదించండి.` :
                       `None of your currently active prescriptions match the symptom/usage pattern. Please do not take unprescribed medicine. Consult your physician or seek professional medical advice immediately if you feel unwell.`;
            }
        }
    }

    if (matchSchedule) {
        if (STATE.medications.length === 0) return "No medications scheduled.";
        let listStr = dict.schedule;
        STATE.medications.forEach(m => {
            listStr += `\n- ${m.name} (${m.dosage}) at ${m.scheduleTimes.join(", ")}`;
        });
        return listStr;
    }

    if (matchLowStock) {
        const low = STATE.medications.filter(m => m.qtyRemaining <= 5);
        if (low.length === 0) return dict.allSafe;
        let listStr = dict.lowStock;
        low.forEach(m => {
            listStr += `\n- ${m.name} (${m.qtyRemaining} remaining)`;
        });
        return listStr;
    }

    if (matchExpiry) {
        const risks = STATE.medications.filter(m => {
            const exp = getExpiryRisk(m);
            return exp.warning;
        });
        if (risks.length === 0) return "All medicines are within their safety expiration windows.";
        let listStr = dict.expiry;
        risks.forEach(m => {
            const exp = getExpiryRisk(m);
            listStr += `\n- ${m.name}: ${exp.message}`;
        });
        return listStr;
    }

    if (matchPharmacy) {
        setTimeout(() => switchView("pharmacy"), 1000);
        return lang === "hi-IN" ? "मैं आपके पास की फार्मेसियों का नक्शा खोल रहा हूँ।" :
               lang === "ta-IN" ? "அருகிலுள்ள மருந்தகங்களின் வரைபடத்தைத் திறக்கிறேன்." :
               lang === "te-IN" ? "నేను మీకు సమీపంలో ఉన్న ఫార్మసీల మ్యాప్‌ను తెరుస్తున్నాను." :
               "Opening nearby pharmacies map view now.";
    }

    // Default friendly response
    if (qLower.includes("hello") || qLower.includes("hi") || qLower.includes("hey") || qLower.includes("नमस्ते") || qLower.includes("வணக்கம்") || qLower.includes("నమస్తే")) {
        return dict.greet;
    }

    return dict.unknown;
}

function triggerSpeechFeedback(text, lang = "en-US") {
    if (!speechOutputCheckbox.checked) return;

    // SpeechSynthesis setup
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // cancel any active reading
        
        // Strip out markdown markers for cleaner reading
        const cleanText = text.replace(/[*#\-_]/g, '');

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = lang;

        // Try to match appropriate system voice
        const voices = window.speechSynthesis.getVoices();
        const matchingVoice = voices.find(v => v.lang.startsWith(lang.substring(0, 2)));
        if (matchingVoice) {
            utterance.voice = matchingVoice;
        }

        window.speechSynthesis.speak(utterance);
    }
}

// ==========================================
// 8.5. EMERGENCY CONTACT & SOS Panic Alert
// ==========================================

function initEmergency() {
    const addEmergencyForm = document.getElementById("form-add-emergency");
    if (addEmergencyForm) {
        addEmergencyForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("emerg-name").value;
            const relation = document.getElementById("emerg-relation").value;
            const phone = document.getElementById("emerg-phone").value;
            const email = document.getElementById("emerg-email").value;

            const newContact = {
                id: "emc-" + Date.now(),
                name, relation, phone, email
            };

            STATE.emergencyContacts.push(newContact);
            saveState();
            renderEmergencyContacts();
            addEmergencyForm.reset();
            alert(`Emergency Contact ${name} successfully registered.`);
        });
    }

    const btnSOS = document.getElementById("btn-trigger-panic-sos");
    if (btnSOS) {
        btnSOS.addEventListener("click", () => {
            triggerManualSOS();
        });
    }

    // EmailJS API settings controls
    const enableCheckbox = document.getElementById("api-emailjs-enable");
    const inputsContainer = document.getElementById("emailjs-inputs-container");
    const settingsForm = document.getElementById("form-emailjs-settings");

    if (enableCheckbox && inputsContainer && settingsForm) {
        enableCheckbox.checked = STATE.settings.api.enable;
        inputsContainer.style.display = STATE.settings.api.enable ? "grid" : "none";
        
        document.getElementById("api-emailjs-service-id").value = STATE.settings.api.serviceId || "";
        document.getElementById("api-emailjs-template-id").value = STATE.settings.api.templateId || "";
        document.getElementById("api-emailjs-public-key").value = STATE.settings.api.publicKey || "";

        enableCheckbox.addEventListener("change", (e) => {
            inputsContainer.style.display = e.target.checked ? "grid" : "none";
        });

        settingsForm.addEventListener("submit", (e) => {
            e.preventDefault();
            STATE.settings.api = {
                enable: enableCheckbox.checked,
                serviceId: document.getElementById("api-emailjs-service-id").value,
                templateId: document.getElementById("api-emailjs-template-id").value,
                publicKey: document.getElementById("api-emailjs-public-key").value
            };
            saveState();

            if (STATE.settings.api.enable && STATE.settings.api.publicKey) {
                emailjs.init({ publicKey: STATE.settings.api.publicKey });
            }
            alert("EmailJS API Configuration saved successfully!");
            renderEmergencyLogs();
        });
    }
}

function renderEmergency() {
    renderEmergencyContacts();
    renderEmergencyLogs();
}

function renderEmergencyContacts() {
    const tableBody = document.getElementById("emergency-contacts-table");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    if (STATE.emergencyContacts.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No emergency contacts registered.</td></tr>`;
        return;
    }

    STATE.emergencyContacts.forEach(c => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><b>${c.name}</b></td>
            <td><span class="med-info-pill">${c.relation}</span></td>
            <td>${c.phone}</td>
            <td>${c.email}</td>
            <td>
                <button class="btn-card-action btn-delete-contact" data-id="${c.id}" title="Remove Contact">
                    <i class="bi bi-trash3-fill" style="color:var(--color-danger)"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(tr);

        tr.querySelector(".btn-delete-contact").addEventListener("click", () => {
            if (confirm(`Remove ${c.name} from emergency contacts?`)) {
                STATE.emergencyContacts = STATE.emergencyContacts.filter(contact => contact.id !== c.id);
                saveState();
                renderEmergencyContacts();
            }
        });
    });
}

function renderEmergencyLogs() {
    const tableBody = document.getElementById("emergency-logs-table");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    if (STATE.emergencyLogs.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No emergency logs dispatched.</td></tr>`;
        return;
    }

    const sortedLogs = [...STATE.emergencyLogs].reverse();

    sortedLogs.forEach(l => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${l.timestamp}</td>
            <td><b>${l.reason}</b></td>
            <td>${l.target}</td>
            <td>${l.method}</td>
            <td><span class="timeline-status-text taken" style="background:var(--color-success-light); color:var(--color-success); border-radius:4px; padding:2px 8px;">${l.status}</span></td>
        `;
        tableBody.appendChild(tr);
    });
}

function dispatchEmailAlert(contact, reason, medName = "N/A") {
    if (!STATE.settings.api.enable || !STATE.settings.api.serviceId || !STATE.settings.api.templateId || !STATE.settings.api.publicKey) {
        return Promise.resolve({ mock: true });
    }
    
    // Trigger real EmailJS email dispatches
    return emailjs.send(
        STATE.settings.api.serviceId,
        STATE.settings.api.templateId,
        {
            to_name: contact.name,
            to_email: contact.email,
            patient_name: "Senior Patient (Medicare Guardian User)",
            message: reason,
            medication_name: medName
        }
    );
}

function triggerManualSOS() {
    if (STATE.emergencyContacts.length === 0) {
        alert("Please add at least one emergency contact before triggering SOS.");
        return;
    }

    const dateStr = new Date().toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    triggerSpeechFeedback("Sending emergency alert notifications.", "en-US");

    let dispatchPromises = STATE.emergencyContacts.map(c => {
        return dispatchEmailAlert(c, "MANUAL SOS PANIC ALERT TRIGGERED BY PATIENT", "N/A")
            .then(res => {
                const status = res.mock ? "Sent Successfully (Simulation)" : "Dispatched Real Email";
                STATE.emergencyLogs.push({
                    timestamp: dateStr,
                    reason: "MANUAL PATIENT PANIC BUTTON TRIGGERED",
                    target: `${c.name} (${c.relation})`,
                    method: res.mock ? "SMS & Email Alert" : "EmailJS API Alert",
                    status: status
                });
            })
            .catch(err => {
                console.error("EmailJS Error:", err);
                STATE.emergencyLogs.push({
                    timestamp: dateStr,
                    reason: "MANUAL PANIC: Alert Dispatch Failed",
                    target: `${c.name} (${c.relation})`,
                    method: "EmailJS API Alert",
                    status: "Error: " + (err.text || err.message || "Unknown error")
                });
            });
    });

    Promise.all(dispatchPromises).then(() => {
        saveState();
        renderEmergencyLogs();
        const textAlert = document.getElementById("sos-sending-alert");
        if (textAlert) {
            textAlert.style.display = "block";
            setTimeout(() => {
                textAlert.style.display = "none";
            }, 5000);
        }
        triggerSpeechFeedback("Emergency alert dispatches completed.", "en-US");
        alert("Emergency SOS Alerts completed!");
    });
}

function triggerAutomaticEscalationSOS(medName, reason) {
    const dateStr = new Date().toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

    let dispatchPromises = STATE.emergencyContacts.map(c => {
        return dispatchEmailAlert(c, `AUTO OVERDUE ESCALATION: ${reason}`, medName)
            .then(res => {
                const status = res.mock ? "Sent Successfully (Simulation)" : "Dispatched Real Email";
                STATE.emergencyLogs.push({
                    timestamp: dateStr,
                    reason: `AUTO OVERDUE ESCALATION: Senior missed dose of ${medName}`,
                    target: `${c.name} (${c.relation})`,
                    method: res.mock ? "SMS Escalation Alert" : "EmailJS API Alert",
                    status: status
                });
            })
            .catch(err => {
                console.error("EmailJS Error:", err);
                STATE.emergencyLogs.push({
                    timestamp: dateStr,
                    reason: `AUTO OVERDUE: Alert Dispatch Failed`,
                    target: `${c.name} (${c.relation})`,
                    method: "EmailJS API Alert",
                    status: "Error: " + (err.text || err.message || "Unknown error")
                });
            });
    });

    Promise.all(dispatchPromises).then(() => {
        saveState();
        renderEmergencyLogs();
    });
    
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("MediCare Guardian: Caregiver SOS Dispatched", {
            body: `Caregiver notified of overdue dose: ${medName}`,
            icon: "https://cdn-icons-png.flaticon.com/512/1047/1047683.png"
        });
    }

    triggerSpeechFeedback("Medication is overdue. Caregivers have been notified.", "en-US");
}

// ==========================================
// 11. GENERAL BOOTSTRAPPING
// ==========================================

function initModals() {
    document.getElementById("btn-add-med-modal").addEventListener("click", () => {
        openModal(document.getElementById("modal-add-medication"));
    });

    document.querySelectorAll(".modal-close-trigger").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const modal = e.target.closest(".modal-overlay");
            if (modal) closeModal(modal);
        });
    });
}

function openModal(modalEl) {
    modalEl.style.display = "flex";
}

function closeModal(modalEl) {
    modalEl.style.display = "none";
}

function renderDateTime() {
    const el = document.getElementById("current-datetime");
    if (!el) return;

    const today = new Date("2026-06-24T11:21:46+05:30");
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    el.innerText = today.toLocaleDateString('en-US', options);
}

// Initialize on DOM load
window.addEventListener("DOMContentLoaded", () => {
    initRouter();
    initAccessibility();
    initOCR();
    initMedications();
    initVoiceAssistant();
    initAlarmEngine();
    initEmergency();
    initModals();
    
    // Request notification permission
    if ("Notification" in window) {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }

    // Initialize EmailJS dynamically if enabled
    if (STATE.settings.api && STATE.settings.api.enable && STATE.settings.api.publicKey) {
        emailjs.init({ publicKey: STATE.settings.api.publicKey });
    }
    
    // Initial Render
    renderDateTime();
    renderMedications();
    renderDashboard();

    // Speak welcome greeting
    setTimeout(() => {
        triggerSpeechFeedback("Welcome to Medicare Guardian, your smart healthcare companion.", "en-US");
    }, 1500);
});
