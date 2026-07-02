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
        indication: "Diabetes / Blood Sugar Control",
        course: "Daily",
        courseDuration: "Lifetime",
        startDate: "2026-06-01"
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
        indication: "High Blood Pressure",
        course: "Daily",
        courseDuration: "Lifetime",
        startDate: "2026-06-15"
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
        indication: "High Cholesterol",
        course: "Daily",
        courseDuration: "Lifetime",
        startDate: "2026-06-20"
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
        indication: "Dizziness, Vertigo, Nausea",
        course: "Daily",
        courseDuration: "Lifetime",
        startDate: "2026-06-20"
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

// Global Session and Security Variables
let currentProfileId = null;
let currentProfileKey = null; // Stored in-memory only
let inactivityTimer = null;
let isProfileLocked = false;
let enteredPinDigits = [];
let directoryFilterState = "all";
let editingMedicationId = null;

let PROFILES = JSON.parse(localStorage.getItem("mg_profiles")) || [];

const STATE = {
    medications: [],
    history: [],
    purchases: [],
    emergencyContacts: [],
    emergencyLogs: [],
    settings: {
        theme: "light",
        fontScale: 1,
        lang: "en-US",
        speechOutput: true,
        api: { enable: false, serviceId: "", templateId: "", publicKey: "" },
        firebase: { enable: false, apiKey: "", projectId: "", authDomain: "", appId: "" },
        gemini: { enable: false, apiKey: "" }
    },
    activeAlarm: null,
    userLocation: null,
    map: null,
    mapMarkers: [],
    routingLine: null
};

// ==========================================
// CRYPTOGRAPHIC UTILITIES (WEB CRYPTO API)
// ==========================================

function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function hexToBytes(hex) {
    if (!hex) return new Uint8Array(0);
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.slice(i, i + 2), 16));
    }
    return new Uint8Array(bytes);
}

async function deriveKeyFromPin(pin, saltHex) {
    if (!window.crypto || !window.crypto.subtle) {
        // SubtleCrypto fallback for non-secure (file://) local contexts
        return pin;
    }
    
    const encoder = new TextEncoder();
    const pinBytes = encoder.encode(pin);
    const saltBytes = hexToBytes(saltHex);
    
    const baseKey = await window.crypto.subtle.importKey(
        "raw",
        pinBytes,
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    
    return await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: saltBytes,
            iterations: 10000,
            hash: "SHA-256"
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptData(plaintext, key) {
    if (!window.crypto || !window.crypto.subtle) {
        // Fallback cipher: XOR-Vigenere obfuscator
        let ciphertext = "";
        for (let i = 0; i < plaintext.length; i++) {
            const charCode = plaintext.charCodeAt(i);
            const keyCode = key.charCodeAt(i % key.length);
            ciphertext += String.fromCharCode(charCode ^ keyCode);
        }
        const b64 = btoa(unescape(encodeURIComponent(ciphertext)));
        return {
            ciphertext: b64,
            iv: "fallback-mode"
        };
    }

    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(plaintext);
    const ivBytes = window.crypto.getRandomValues(new Uint8Array(12));
    
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: ivBytes
        },
        key,
        dataBytes
    );
    
    return {
        ciphertext: bufferToHex(ciphertextBuffer),
        iv: bufferToHex(ivBytes)
    };
}

async function decryptData(ciphertextHex, key, ivHex) {
    if (ivHex === "fallback-mode" || !window.crypto || !window.crypto.subtle) {
        // Fallback decryption
        const ciphertext = decodeURIComponent(escape(atob(ciphertextHex)));
        let plaintext = "";
        for (let i = 0; i < ciphertext.length; i++) {
            const charCode = ciphertext.charCodeAt(i);
            const keyCode = key.charCodeAt(i % key.length);
            plaintext += String.fromCharCode(charCode ^ keyCode);
        }
        return plaintext;
    }

    const ciphertextBytes = hexToBytes(ciphertextHex);
    const ivBytes = hexToBytes(ivHex);
    
    const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: ivBytes
        },
        key,
        ciphertextBytes
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
}

// Profile-aware State Persistence
async function saveState() {
    if (!currentProfileId) return;
    
    const profile = PROFILES.find(p => p.id === currentProfileId);
    if (!profile) return;
    
    const payload = {
        medications: STATE.medications,
        history: STATE.history,
        purchases: STATE.purchases,
        emergencyContacts: STATE.emergencyContacts,
        emergencyLogs: STATE.emergencyLogs,
        settings: STATE.settings
    };
    
    const payloadString = JSON.stringify(payload);
    
    if (profile.hasPin) {
        if (!currentProfileKey) {
            console.warn("Key is missing. Cannot save encrypted profile state.");
            return;
        }
        try {
            const encrypted = await encryptData(payloadString, currentProfileKey);
            const storageEnvelope = {
                encrypted: true,
                ciphertext: encrypted.ciphertext,
                iv: encrypted.iv
            };
            localStorage.setItem(`mg_profile_${currentProfileId}_data`, JSON.stringify(storageEnvelope));
        } catch (e) {
            console.error("Encryption failed:", e);
        }
    } else {
        localStorage.setItem(`mg_profile_${currentProfileId}_data`, payloadString);
    }
    
    // Auto sync to Cloud Firebase if configured and logged in
    if (typeof firebaseUser !== 'undefined' && firebaseUser && typeof firestoreInstance !== 'undefined' && firestoreInstance) {
        const path = `users/${firebaseUser.uid}/profiles/${currentProfileId || 'default'}`;
        firestoreInstance.doc(path).set(payload).catch(e => console.warn("Cloud auto-sync failed:", e));
    }
}

function saveProfilesList() {
    localStorage.setItem("mg_profiles", JSON.stringify(PROFILES));
}

async function loadProfileState(profileId, key = null) {
    const profile = PROFILES.find(p => p.id === profileId);
    if (!profile) return false;
    
    const rawData = localStorage.getItem(`mg_profile_${profileId}_data`);
    if (!rawData) return false;
    
    let parsedData = null;
    if (profile.hasPin) {
        if (!key) return false;
        try {
            const envelope = JSON.parse(rawData);
            const decryptedString = await decryptData(envelope.ciphertext, key, envelope.iv);
            parsedData = JSON.parse(decryptedString);
        } catch (e) {
            console.error("Decryption failed:", e);
            return false;
        }
    } else {
        try {
            parsedData = JSON.parse(rawData);
        } catch (e) {
            console.error("Plaintext JSON parse failed:", e);
            return false;
        }
    }
    
    if (parsedData) {
        STATE.medications = parsedData.medications || [];
        STATE.history = parsedData.history || [];
        STATE.purchases = parsedData.purchases || [];
        STATE.emergencyContacts = parsedData.emergencyContacts || [];
        STATE.emergencyLogs = parsedData.emergencyLogs || [];
        STATE.settings = { ...STATE.settings, ...(parsedData.settings || {}) };
        
        currentProfileId = profileId;
        currentProfileKey = key;
        
        sessionStorage.setItem("mg_active_profile_id", profileId);
        return true;
    }
    return false;
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
    } else if (viewName === "settings") {
        refreshSettingsUI();
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
            expiryDate: new Date(new Date("2026-06-24").getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // default 90 days out
            doctor: document.getElementById("ocr-field-doctor").value || "Dr. Self",
            purchaseDate: "2026-06-24",
            indication: document.getElementById("ocr-field-indication").value || "General Health",
            course: "Daily",
            courseDuration: "Lifetime",
            startDate: "2026-06-24"
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

        // Extract indication / cause keyword matches
        let indication = "General Health";
        const txtLower = text.toLowerCase();
        if (txtLower.includes("pressure") || txtLower.includes("hypertension") || txtLower.includes("blood pressure")) {
            indication = "High Blood Pressure";
        } else if (txtLower.includes("sugar") || txtLower.includes("diabetes") || txtLower.includes("glucose")) {
            indication = "Diabetes Control";
        } else if (txtLower.includes("cholesterol") || txtLower.includes("lipid") || txtLower.includes("lipids")) {
            indication = "High Cholesterol";
        } else if (txtLower.includes("pain") || txtLower.includes("fever") || txtLower.includes("inflammation") || txtLower.includes("headache")) {
            indication = "Pain & Fever Relief";
        } else if (txtLower.includes("dizzy") || txtLower.includes("vertigo") || txtLower.includes("nausea")) {
            indication = "Dizziness & Vertigo";
        } else if (medNameMatch) {
            const nameL = medNameMatch[0].toLowerCase();
            if (nameL === "metformin") indication = "Diabetes Control";
            else if (nameL === "lisinopril") indication = "High Blood Pressure";
            else if (nameL === "atorvastatin") indication = "High Cholesterol";
            else if (nameL === "stemetil") indication = "Dizziness & Vertigo";
        }

        document.getElementById("ocr-field-name").value = medNameMatch ? medNameMatch[0] : "Amlodipine";
        document.getElementById("ocr-field-doctor").value = doctorMatch ? doctorMatch[0] : "Dr. Robert Chen";
        document.getElementById("ocr-field-dose").value = dosageMatch ? dosageMatch[0] : "1 Tablet";
        document.getElementById("ocr-field-freq").value = frequency;
        document.getElementById("ocr-field-indication").value = indication;

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

        const courseEl = document.getElementById("med-course");
        const course = courseEl ? courseEl.value : "Daily";

        const isDaily = course === "Daily";
        let duration = "Lifetime";
        let startDate = "2026-06-24";

        if (isDaily) {
            const durationSelect = document.getElementById("med-duration");
            if (durationSelect) {
                if (durationSelect.value === "custom") {
                    const customDays = parseInt(document.getElementById("med-custom-duration-days").value);
                    duration = isNaN(customDays) ? "Lifetime" : customDays.toString();
                } else {
                    duration = durationSelect.value;
                }
            }
            const startDateInput = document.getElementById("med-start-date");
            if (startDateInput && startDateInput.value) {
                startDate = startDateInput.value;
            }
        }

        if (editingMedicationId) {
            const med = STATE.medications.find(m => m.id === editingMedicationId);
            if (med) {
                med.name = name;
                med.type = type;
                med.qtyPurchased = qtyPurchased;
                med.qtyRemaining = qtyRemaining;
                med.dosage = dosage;
                med.frequency = frequency;
                med.timing = timing;
                med.scheduleTimes = times;
                med.expiryDate = expiryDate;
                med.doctor = doctor;
                med.indication = indication;
                med.course = course;
                med.courseDuration = duration;
                med.startDate = startDate;
            }
            editingMedicationId = null;
            alert(`${name} has been successfully updated.`);
        } else {
            const newMed = {
                id: "med-" + Date.now(),
                name, type, qtyPurchased, qtyRemaining, dosage, frequency, timing,
                scheduleTimes: times, expiryDate, doctor,
                purchaseDate: "2026-06-24",
                indication,
                course,
                courseDuration: duration,
                startDate: startDate
            };
            STATE.medications.push(newMed);
            STATE.purchases.push({ date: newMed.purchaseDate, medName: name, qty: qtyPurchased });
            alert(`${name} has been successfully added to schedules.`);
        }

        saveState();
        renderMedications();
        renderDashboard();
        closeModal(document.getElementById("modal-add-medication"));
        addMedForm.reset();

        // Hide custom fields and restore opacity on form reset
        const customRow = document.getElementById("row-custom-duration");
        if (customRow) customRow.style.display = "none";
        const startDateRow = document.getElementById("row-start-date");
        if (startDateRow) startDateRow.style.display = "flex";
        const durationGroup = document.getElementById("group-course-duration");
        if (durationGroup) {
            durationGroup.style.opacity = "1";
            durationGroup.style.pointerEvents = "auto";
        }
    });

    // Course fields event listeners
    const courseSelect = document.getElementById("med-course");
    const durationSelect = document.getElementById("med-duration");
    const durationGroup = document.getElementById("group-course-duration");
    const customRow = document.getElementById("row-custom-duration");

    if (courseSelect && durationSelect && durationGroup && customRow) {
        // Init default dates on modal open
        const modalBtn = document.getElementById("btn-add-med-modal");
        if (modalBtn) {
            modalBtn.addEventListener("click", () => {
                editingMedicationId = null;
                addMedForm.reset();
                
                const title = document.querySelector("#modal-add-medication .modal-header h3");
                if (title) title.innerHTML = `<i class="bi bi-capsule-pill text-primary"></i> Add New Medicine`;
                
                const submitBtn = document.querySelector("#modal-add-medication button[type='submit']");
                if (submitBtn) submitBtn.innerHTML = `<i class="bi bi-save2"></i> Save Medication`;
                
                // Hide custom fields and restore opacity on form reset
                const customRow = document.getElementById("row-custom-duration");
                if (customRow) customRow.style.display = "none";
                const startDateRow = document.getElementById("row-start-date");
                if (startDateRow) startDateRow.style.display = "flex";
                const durationGroup = document.getElementById("group-course-duration");
                if (durationGroup) {
                    durationGroup.style.opacity = "1";
                    durationGroup.style.pointerEvents = "auto";
                }
                
                const startDateInput = document.getElementById("med-start-date");
                if (startDateInput) {
                    startDateInput.value = "2026-06-24";
                }
            });
        }

        courseSelect.addEventListener("change", () => {
            const startDateRow = document.getElementById("row-start-date");
            if (courseSelect.value === "Daily") {
                durationGroup.style.opacity = "1";
                durationGroup.style.pointerEvents = "auto";
                if (startDateRow) startDateRow.style.display = "flex";
                if (durationSelect.value === "custom") {
                    customRow.style.display = "flex";
                }
            } else {
                durationGroup.style.opacity = "0.4";
                durationGroup.style.pointerEvents = "none";
                customRow.style.display = "none";
                if (startDateRow) startDateRow.style.display = "none";
            }
        });

        durationSelect.addEventListener("change", () => {
            if (durationSelect.value === "custom") {
                customRow.style.display = "flex";
            } else {
                customRow.style.display = "none";
            }
            
            // Auto-default Start Date to system date if they change duration (starting a new course)
            if (durationSelect.value !== "Lifetime") {
                const startDateInput = document.getElementById("med-start-date");
                if (startDateInput) {
                    startDateInput.value = "2026-06-24";
                }
            }
        });
    }

    initMedicationsDirectoryFilters();
}

// Open medication editor modal
function openEditMedicationModal(med) {
    editingMedicationId = med.id;
    
    document.getElementById("med-name").value = med.name || "";
    document.getElementById("med-type").value = med.type || "Tablet";
    document.getElementById("med-qty-purchased").value = med.qtyPurchased || 30;
    document.getElementById("med-qty-remaining").value = med.qtyRemaining || 30;
    document.getElementById("med-dosage").value = med.dosage || "";
    document.getElementById("med-frequency").value = med.frequency || "once";
    document.getElementById("med-timing").value = med.timing || "Before Food";
    document.getElementById("med-schedule-time").value = (med.scheduleTimes || []).join(", ");
    document.getElementById("med-expiry-date").value = med.expiryDate || "";
    document.getElementById("med-doctor").value = med.doctor || "";
    document.getElementById("med-indication").value = med.indication || "";
    
    const courseSelect = document.getElementById("med-course");
    if (courseSelect) {
        courseSelect.value = med.course || "Daily";
        courseSelect.dispatchEvent(new Event("change"));
    }
    
    const durationSelect = document.getElementById("med-duration");
    if (durationSelect) {
        const duration = med.courseDuration || "Lifetime";
        if (duration === "Lifetime" || duration === "7" || duration === "10" || duration === "14" || duration === "30") {
            durationSelect.value = duration;
        } else {
            durationSelect.value = "custom";
            const customInput = document.getElementById("med-custom-duration-days");
            if (customInput) customInput.value = duration;
        }
        durationSelect.dispatchEvent(new Event("change"));
    }
    
    const startDateInput = document.getElementById("med-start-date");
    if (startDateInput) {
        startDateInput.value = med.startDate || "2026-06-24";
    }
    
    const startDateRow = document.getElementById("row-start-date");
    if (startDateRow) {
        startDateRow.style.display = (med.course === "Daily") ? "flex" : "none";
    }

    const modal = document.getElementById("modal-add-medication");
    const title = modal.querySelector(".modal-header h3");
    if (title) title.innerHTML = `<i class="bi bi-pencil-square text-primary"></i> Edit Medication Details`;
    
    const submitBtn = modal.querySelector("button[type='submit']");
    if (submitBtn) submitBtn.innerHTML = `<i class="bi bi-save2"></i> Save Changes`;

    openModal(modal);
}

function initMedicationsDirectoryFilters() {
    const btnAll = document.getElementById("btn-filter-all");
    const btnDaily = document.getElementById("btn-filter-daily");
    const btnInactive = document.getElementById("btn-filter-inactive");

    if (btnAll && btnDaily && btnInactive) {
        btnAll.addEventListener("click", () => {
            directoryFilterState = "all";
            updateFilterButtons(btnAll);
            renderMedicationsDirectoryTable();
        });
        btnDaily.addEventListener("click", () => {
            directoryFilterState = "daily";
            updateFilterButtons(btnDaily);
            renderMedicationsDirectoryTable();
        });
        btnInactive.addEventListener("click", () => {
            directoryFilterState = "inactive";
            updateFilterButtons(btnInactive);
            renderMedicationsDirectoryTable();
        });
    }
}

function updateFilterButtons(activeBtn) {
    document.querySelectorAll(".directory-filters button").forEach(btn => btn.classList.remove("active"));
    activeBtn.classList.add("active");
}

function isMedicationCurrentlyActive(med) {
    if (!med) return false;
    // If the course is not daily, it's not active in the daily reminders/schedule
    if (med.course !== "Daily") return false;

    // If duration is lifetime, it is always active
    const duration = med.courseDuration || "Lifetime";
    if (duration === "Lifetime") return true;

    // Calculate elapsed days since start date
    const startStr = med.startDate || med.purchaseDate || "2026-06-24";
    const start = new Date(startStr);
    const today = new Date("2026-06-24");
    
    // Normalize to calendar days
    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = today - start;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // Days since start (Day 0, Day 1, etc.)

    const durationDays = parseInt(duration);
    if (isNaN(durationDays)) return true; // fallback

    // Active for durationDays starting from day 0 (e.g. 10 days course runs for day 0 to day 9, stops on day 10)
    return diffDays >= 0 && diffDays < durationDays;
}

function renderMedications() {
    const medListContainer = document.getElementById("medications-list-container");
    const medInactiveListContainer = document.getElementById("medications-inactive-list-container");
    
    if (!medListContainer || !medInactiveListContainer) return;
    
    medListContainer.innerHTML = "";
    medInactiveListContainer.innerHTML = "";

    const activeMeds = STATE.medications.filter(isMedicationCurrentlyActive);
    const inactiveMeds = STATE.medications.filter(m => !isMedicationCurrentlyActive(m));

    if (activeMeds.length === 0) {
        medListContainer.innerHTML = `<p class="empty-state">No active daily medications. Click Add to set up.</p>`;
    } else {
        activeMeds.forEach(med => renderMedCard(med, medListContainer));
    }

    if (inactiveMeds.length === 0) {
        medInactiveListContainer.innerHTML = `<p class="empty-state">No prescribed medications on hold or courses completed.</p>`;
    } else {
        inactiveMeds.forEach(med => renderMedCard(med, medInactiveListContainer));
    }

    renderMedicationsDirectoryTable();
}

function renderMedCard(med, container) {
    const refillPrediction = getRefillPrediction(med);
    const expiryAlert = getExpiryRisk(med);
    
    const stockPct = (med.qtyRemaining / med.qtyPurchased) * 100;
    const isLowStock = med.qtyRemaining <= 5;
    const stockColorClass = isLowStock ? "stock-danger" : "stock-safe";

    const card = document.createElement("div");
    card.className = "card glassmorphic medication-card animate-fadeIn";
    
    const isDaily = med.course === "Daily";
    const isActive = isMedicationCurrentlyActive(med);
    let statusBadge = "";
    if (isDaily) {
        if (isActive) {
            const duration = med.courseDuration || "Lifetime";
            const durationText = duration === "Lifetime" ? "Lifetime" : `${duration} Days`;
            statusBadge = `<span class="med-info-pill" style="background:rgba(16,185,129,0.1); color:var(--color-success); border:1px solid rgba(16,185,129,0.2);">Daily (${durationText})</span>`;
        } else {
            statusBadge = `<span class="med-info-pill" style="background:rgba(239,68,68,0.1); color:var(--color-danger); border:1px solid rgba(239,68,68,0.2);">Course Completed</span>`;
        }
    } else {
        statusBadge = `<span class="med-info-pill" style="background:rgba(107,114,128,0.1); color:var(--text-muted); border:1px solid rgba(107,114,128,0.2);">Prescribed</span>`;
    }

    card.innerHTML = `
        <div class="med-header">
            <div class="med-icon-title">
                <div class="med-card-icon" style="background:${isActive ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)'}; color:${isActive ? 'var(--color-success)' : 'var(--text-muted)'}"><i class="bi bi-capsule"></i></div>
                <div class="med-name-type">
                    <h4 style="display:flex; align-items:center; gap:0.5rem;">${med.name} ${statusBadge}</h4>
                    <span>${med.type} • ${med.dosage}</span>
                </div>
            </div>
            <div style="display: flex; gap: 0.25rem;">
                <button class="btn-card-action btn-edit-med" data-id="${med.id}" title="Edit Medicine" style="color: var(--color-primary);">
                    <i class="bi bi-pencil-square"></i>
                </button>
                <button class="btn-card-action btn-delete-med" data-id="${med.id}" title="Remove Medicine">
                    <i class="bi bi-trash3-fill"></i>
                </button>
            </div>
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
    container.appendChild(card);

    // Edit hook
    card.querySelector(".btn-edit-med").addEventListener("click", () => {
        openEditMedicationModal(med);
    });

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
                date: "2026-06-24",
                medName: med.name,
                qty: parseInt(refillQty)
            });
            
            saveState();
            renderMedications();
            renderDashboard();
            alert(`Stock refilled successfully.`);
        }
    });
}

function renderMedicationsDirectoryTable() {
    const tableDirectory = document.getElementById("medications-table-directory");
    if (!tableDirectory) return;
    tableDirectory.innerHTML = "";

    let medsToRender = STATE.medications;
    if (directoryFilterState === "daily") {
        medsToRender = STATE.medications.filter(isMedicationCurrentlyActive);
    } else if (directoryFilterState === "inactive") {
        medsToRender = STATE.medications.filter(m => !isMedicationCurrentlyActive(m));
    }

    if (medsToRender.length === 0) {
        tableDirectory.innerHTML = `<tr><td colspan="9" class="empty-state">No matching medications in the directory.</td></tr>`;
        return;
    }

    medsToRender.forEach(med => {
        const tr = document.createElement("tr");
        const isLowStock = med.qtyRemaining <= 5;
        const expiryAlert = getExpiryRisk(med);
        
        const isDaily = med.course === "Daily";
        const isActive = isMedicationCurrentlyActive(med);
        let statusBadge = "";
        if (isDaily) {
            if (isActive) {
                const duration = med.courseDuration || "Lifetime";
                const durationText = duration === "Lifetime" ? "Lifetime" : `${duration} Days`;
                statusBadge = `<span class="badge-tag" style="background:rgba(16,185,129,0.1); color:var(--color-success); border:1px solid rgba(16,185,129,0.2);">Daily Active (${durationText})</span>`;
            } else {
                statusBadge = `<span class="badge-tag" style="background:rgba(239,68,68,0.1); color:var(--color-danger); border:1px solid rgba(239,68,68,0.2);">Course Completed</span>`;
            }
        } else {
            statusBadge = `<span class="badge-tag" style="background:rgba(107,114,128,0.1); color:var(--text-muted); border:1px solid rgba(107,114,128,0.2);">Prescribed (Not in Use)</span>`;
        }

        tr.innerHTML = `
            <td><b>${med.name}</b></td>
            <td>${statusBadge}</td>
            <td><span class="med-info-pill" style="background:rgba(14,165,233,0.1); color:var(--color-primary); border-radius:4px; padding:2px 8px; font-weight:700;">${med.indication || 'General Health'}</span></td>
            <td>${med.dosage}</td>
            <td>${med.frequency.toUpperCase()} DAILY</td>
            <td>${med.timing}</td>
            <td>${med.doctor}</td>
            <td><span class="${expiryAlert.warning ? 'text-danger font-bold' : ''}">${med.expiryDate}</span></td>
            <td>
                <span class="badge-tag ${isLowStock ? 'stock-danger' : 'stock-safe'}" style="background:${isLowStock ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'}; color:${isLowStock ? 'var(--color-danger)' : 'var(--color-success)'}; font-weight:800; border-radius:4px; padding:2px 8px;">
                    ${med.qtyRemaining} / ${med.qtyPurchased} Left
                </span>
            </td>
            <td>
                <button class="btn btn-outline btn-sm btn-edit-dir-med" data-id="${med.id}" style="padding: 2px 6px; font-size: 0.8rem;"><i class="bi bi-pencil-square"></i> Edit</button>
            </td>
        `;
        tableDirectory.appendChild(tr);

        tr.querySelector(".btn-edit-dir-med").addEventListener("click", () => {
            openEditMedicationModal(med);
        });
    });
}

// ==========================================
// 7. AI PREDICTION ENGINES

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
    const greetingEl = document.getElementById("greeting");
    if (greetingEl) {
        const activeProf = PROFILES.find(p => p.id === currentProfileId);
        const name = activeProf ? activeProf.name : "Senior";
        
        const hour = new Date().getHours();
        let greetingText = "Good Morning";
        if (hour >= 12 && hour < 17) {
            greetingText = "Good Afternoon";
        } else if (hour >= 17 || hour < 5) {
            greetingText = "Good Evening";
        }
        greetingEl.innerText = `${greetingText}, ${name}`;
    }

    renderSafetyAlerts();
    renderDailySchedule();
    renderAdherenceScore();
}

function renderSafetyAlerts() {
    const list = document.getElementById("alerts-list");
    list.innerHTML = "";
    
    let alertCount = 0;

    STATE.medications.filter(isMedicationCurrentlyActive).forEach(med => {
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

    STATE.medications.filter(isMedicationCurrentlyActive).forEach(med => {
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
    const medName = med ? med.name : "Medication";
    STATE.history.push({
        date: "2026-06-24",
        medId,
        medName: medName,
        status: "skipped",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        scheduledTime: scheduledTime
    });

    saveState();
    renderDashboard();
    triggerSpeechFeedback(`Understood. Dose skipped.`);

    // Trigger alert dispatch to emergency contacts/caretakers
    triggerSkipDoseAlert(medName, scheduledTime);
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
    if (!currentProfileId || isProfileLocked) return;
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    const timeStr = `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
    const todayStr = "2026-06-24"; // Unified system date

    STATE.medications.filter(isMedicationCurrentlyActive).forEach(med => {
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

async function queryGeminiAdherenceAnalysis(apiKey, activeProf, activeMeds, complianceRate, statusCounts) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `
You are a private medical adherence analyst. Analyze the following compliance data for patient "${activeProf ? activeProf.name : 'Senior'}" (Age: ${activeProf ? activeProf.age : 75}, Gender: ${activeProf ? activeProf.gender : 'Male'}, Allergies: ${activeProf && activeProf.allergies ? activeProf.allergies.join(", ") : 'None'}).

Medications List:
${activeMeds.map(m => `- ${m.name} (dosage: ${m.dosage}, indication: ${m.indication || 'General Health'})`).join("\n")}

Compliance Statistics:
- Adherence Rate: ${complianceRate}%
- Doses Taken: ${statusCounts.taken}
- Doses Missed: ${statusCounts.missed}
- Doses Skipped: ${statusCounts.skipped}

Provide a detailed, professional, yet senior-friendly report containing exactly these four sections:
1. **Adherence Statistics & Summary**: Summarize the compliance rate and comment on whether it is optimal (85%+), sub-optimal, or high risk.
2. **Possible Side Effects (Risks of Skipped Doses)**: Detail the specific side effects/complications of skipping or delaying the patient's active medications (e.g., blood sugar spikes for Metformin, blood pressure spikes/rebound hypertension for Lisinopril, cholesterol accumulation for Atorvastatin).
3. **Long-term Health Consequences**: Explain what will happen if this status continues (cardiovascular events, stroke risks, kidney damage, neuropathy, etc. depending on their medications).
4. **Home Remedies & Lifestyle Adjustments**: Suggest practical lifestyle changes, routine associative memory triggers (e.g. taking meds with dinner), and healthy habits (low-sodium diet, light exercise, hydration) to help improve adherence and condition management.

Format using clean bold tags, line breaks, and bullet lists. Ensure you do NOT leak any passwords or system API keys. Keep recommendations practical and clear.
`;

    const requestBody = {
        contents: [
            {
                role: "user",
                parts: [{ text: prompt }]
            }
        ]
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

function generateLocalAdherenceAnalysis(activeProf, activeMeds, complianceRate, statusCounts) {
    let html = "";
    
    // Section 1: Summary Statistics
    let statusClass = "taken"; // green
    let statusRating = "Excellent Compliance";
    let statusDesc = "Your medication compliance is exceptional! You are maintaining your therapeutic levels perfectly.";
    if (complianceRate < 70) {
        statusClass = "missed-label"; // red
        statusRating = "Critical Risk Adherence";
        statusDesc = "Your compliance is critically low. Missing doses puts you at high risk of symptom flare-ups and complications.";
    } else if (complianceRate < 85) {
        statusClass = "skipped"; // orange
        statusRating = "Sub-optimal Adherence";
        statusDesc = "Your compliance is solid but below the recommended target (85%+). Establishing regular routine associations can help.";
    }
    
    html += `
        <div style="margin-bottom:1.5rem;">
            <h5 style="color:var(--color-primary); border-bottom:1px solid var(--border-color); padding-bottom:0.4rem; margin-bottom:0.75rem; font-size:1.05rem;">📊 Adherence Statistics & Rating</h5>
            <p>Your current adherence rate is <b>${complianceRate}%</b> (<span class="timeline-status-text ${statusClass}" style="padding:2px 8px; border-radius:4px; font-weight:700;">${statusRating}</span>).</p>
            <p style="margin-top:0.5rem; color:var(--text-muted);">${statusDesc}</p>
            <p style="font-size:0.9rem; margin-top:0.4rem;">• Taken: <b>${statusCounts.taken}</b> | Missed: <b>${statusCounts.missed}</b> | Skipped: <b>${statusCounts.skipped}</b></p>
        </div>
    `;
    
    // Section 2: Possible Side Effects (Skipped Doses)
    html += `
        <div style="margin-bottom:1.5rem;">
            <h5 style="color:var(--color-primary); border-bottom:1px solid var(--border-color); padding-bottom:0.4rem; margin-bottom:0.75rem; font-size:1.05rem;">⚠️ Potential Side Effects of Missed Doses</h5>
            <ul style="padding-left:1.25rem; margin:0; line-height:1.6;">
    `;
    
    let hasSpecificMeds = false;
    activeMeds.forEach(med => {
        const nameL = med.name.toLowerCase();
        if (nameL.includes("metformin")) {
            hasSpecificMeds = true;
            html += `<li><b>Metformin</b>: Skipping doses causes blood glucose spikes, lethargy, blurred vision, and stomach upset.</li>`;
        } else if (nameL.includes("lisinopril")) {
            hasSpecificMeds = true;
            html += `<li><b>Lisinopril</b>: Skipping doses triggers rebound high blood pressure, leading to dizziness, headaches, and chest tightness.</li>`;
        } else if (nameL.includes("atorvastatin")) {
            hasSpecificMeds = true;
            html += `<li><b>Atorvastatin</b>: Skipping doses allows cholesterol levels to rise silently, increasing plaque instability.</li>`;
        } else if (nameL.includes("stemetil")) {
            hasSpecificMeds = true;
            html += `<li><b>Stemetil</b>: Skipping doses can cause rebound dizziness, intense vertigo, nausea, and loss of balance.</li>`;
        }
    });
    
    if (!hasSpecificMeds) {
        html += `<li>Skipping or delaying doses prevents the medication from maintaining a steady level in your blood, reducing its effectiveness and causing symptoms to return.</li>`;
    }
    
    html += `
            </ul>
        </div>
    `;
    
    // Section 3: Risks of Continuing Non-Adherence
    html += `
        <div style="margin-bottom:1.5rem;">
            <h5 style="color:var(--color-primary); border-bottom:1px solid var(--border-color); padding-bottom:0.4rem; margin-bottom:0.75rem; font-size:1.05rem;">⏳ Long-term Health Impact (If Status Continues)</h5>
            <ul style="padding-left:1.25rem; margin:0; line-height:1.6;">
    `;
    
    let hasSpecificRisks = false;
    activeMeds.forEach(med => {
        const nameL = med.name.toLowerCase();
        if (nameL.includes("metformin")) {
            hasSpecificRisks = true;
            html += `<li><b>Diabetes/Metformin</b>: Persistent high blood sugar leads to permanent nerve damage (neuropathy), vision impairment, and kidney strain.</li>`;
        } else if (nameL.includes("lisinopril")) {
            hasSpecificRisks = true;
            html += `<li><b>Hypertension/Lisinopril</b>: Chronic high blood pressure hardens arteries, leading directly to strokes, heart attacks, and chronic heart failure.</li>`;
        } else if (nameL.includes("atorvastatin")) {
            hasSpecificRisks = true;
            html += `<li><b>Cholesterol/Atorvastatin</b>: Long-term cholesterol build-up leads to coronary artery disease, blood clots, and vascular blockages.</li>`;
        }
    });
    
    if (!hasSpecificRisks) {
        html += `<li>Prolonged non-adherence can lead to chronic disease progression, increased emergency room visits, and reduction in overall quality of life.</li>`;
    }
    
    html += `
            </ul>
        </div>
    `;
    
    // Section 4: Home Remedies & Lifestyle Changes
    html += `
        <div style="margin-bottom:0.5rem;">
            <h5 style="color:var(--color-primary); border-bottom:1px solid var(--border-color); padding-bottom:0.4rem; margin-bottom:0.75rem; font-size:1.05rem;">🌿 Lifestyle Changes & Home Support</h5>
            <ul style="padding-left:1.25rem; margin:0; line-height:1.6;">
                <li><b>Associative Anchoring</b>: Place your pill organizer next to something you do daily (e.g. coffee maker, toothbrush, or beside the dining table).</li>
                <li><b>Dietary Sync</b>: Take medications like Metformin right after meals to decrease stomach irritation. For Lisinopril, limit sodium intake.</li>
                <li><b>Hydration & Light Activity</b>: Drink plenty of water throughout the day. Engaging in 15-30 minutes of light walking helps naturally manage blood pressure and blood sugar.</li>
                <li><b>Caregiver Integration</b>: If you struggle to remember, enable our caregiver alert integrations to send a supportive SMS reminder when a dose is skipped.</li>
            </ul>
        </div>
    `;
    
    return html;
}

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
    if (aiInsightContainer) {
        aiInsightContainer.innerHTML = `<div style="display:flex; justify-content:center; padding:2rem;"><div class="spinner animate-spin" style="width:24px; height:24px; border:3px solid var(--border-color); border-top-color:var(--color-primary); border-radius:50%;"></div></div>`;
        
        const activeMeds = STATE.medications.filter(isMedicationCurrentlyActive);
        const activeProf = PROFILES.find(p => p.id === currentProfileId);
        
        if (STATE.settings.gemini && STATE.settings.gemini.enable && STATE.settings.gemini.apiKey) {
            queryGeminiAdherenceAnalysis(STATE.settings.gemini.apiKey, activeProf, activeMeds, complianceRate, statusCounts)
                .then(report => {
                    const formatted = report
                        .replace(/\n/g, '<br>')
                        .replace(/\*\*(.*?)\*\//g, '<b>$1</b>')
                        .replace(/\* /g, '• ');
                    aiInsightContainer.innerHTML = `<div style="font-size:0.95rem; line-height:1.5;">${formatted}</div>`;
                })
                .catch(err => {
                    console.warn("Gemini adherence analysis failed, using local model:", err);
                    const localReport = generateLocalAdherenceAnalysis(activeProf, activeMeds, complianceRate, statusCounts);
                    aiInsightContainer.innerHTML = localReport;
                });
        } else {
            const localReport = generateLocalAdherenceAnalysis(activeProf, activeMeds, complianceRate, statusCounts);
            aiInsightContainer.innerHTML = localReport;
        }
    }

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

async function handleTextInput() {
    const text = chatTextInput.value.trim();
    if (!text) return;

    appendChatMessage(text, "user-msg");
    chatTextInput.value = "";

    const currentLang = assistantLang.value;
    
    // Check if Gemini is enabled and has an API key configured
    if (STATE.settings.gemini && STATE.settings.gemini.enable && STATE.settings.gemini.apiKey) {
        const loadingMsgId = "loading-" + Date.now();
        const loadingEl = document.createElement("div");
        loadingEl.className = "chat-msg bot-msg animate-fadeIn";
        loadingEl.id = loadingMsgId;
        loadingEl.innerHTML = `<p><i class="bi bi-cpu animate-pulse"></i> <i>Guardian AI is preparing response...</i></p>`;
        chatMessages.appendChild(loadingEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            const activeProf = PROFILES.find(p => p.id === currentProfileId);
            const activeMeds = STATE.medications.filter(isMedicationCurrentlyActive);
            const response = await queryGeminiAPI(text, STATE.settings.gemini.apiKey, activeProf, activeMeds);
            
            loadingEl.remove();
            appendChatMessage(response, "bot-msg");
            triggerSpeechFeedback(response, currentLang);
        } catch (err) {
            console.error("Gemini AI API Call Failed:", err);
            loadingEl.remove();
            const fallback = "I encountered an error connecting to my AI processor: " + err.message + ". Fallback: " + queryLocalNLP(text, currentLang);
            appendChatMessage(fallback, "bot-msg");
            triggerSpeechFeedback(fallback, currentLang);
        }
    } else {
        const response = queryLocalNLP(text, currentLang);
        setTimeout(() => {
            appendChatMessage(response, "bot-msg");
            triggerSpeechFeedback(response, currentLang);
        }, 600);
    }
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

    // Check active profile context for custom AI personalization and allergy warnings
    const activeProf = PROFILES.find(p => p.id === currentProfileId);
    if (activeProf && activeProf.allergies && activeProf.allergies.length > 0) {
        const matchingAllergy = activeProf.allergies.find(allg => qLower.includes(allg.toLowerCase()));
        if (matchingAllergy) {
            return `⚠️ **CRITICAL ALLERGY ALERT**: You are allergic to **${matchingAllergy}**! Please do NOT take this or any related medication under any circumstances! Contact your doctor immediately for a safe alternative.`;
        }
    }

    // Check if query mentions a specific medicine name dynamically
    const matchedMedByName = STATE.medications.find(m => qLower.includes(m.name.toLowerCase()));
    if (matchedMedByName) {
        if (lang === "hi-IN") {
            return `*${matchedMedByName.name}* (${matchedMedByName.dosage}) को ${matchedMedByName.doctor} द्वारा ${matchedMedByName.indication || 'सामान्य स्वास्थ्य'} के लिए निर्धारित किया गया है। निर्देश: दिन में ${matchedMedByName.frequency} बार (${matchedMedByName.scheduleTimes.join(", ")}), ${matchedMedByName.timing}। स्टॉक: ${matchedMedByName.qtyRemaining} बचे हैं।`;
        } else if (lang === "ta-IN") {
            return `*${matchedMedByName.name}* (${matchedMedByName.dosage}) என்பது மருத்துவர் ${matchedMedByName.doctor} ஆல் ${matchedMedByName.indication || 'பொது ஆரோக்கியம்'}க்காக பரிந்துரைக்கப்பட்டது. வழிமுறைகள்: ஒரு நாளைக்கு ${matchedMedByName.frequency} முறை (${matchedMedByName.scheduleTimes.join(", ")}), ${matchedMedByName.timing}. இருப்பு: ${matchedMedByName.qtyRemaining} மாத்திரைகள் உள்ளன.`;
        } else if (lang === "te-IN") {
            return `*${matchedMedByName.name}* (${matchedMedByName.dosage}) అనేది డాక్టర్ ${matchedMedByName.doctor} చే ${matchedMedByName.indication || 'సాధారణ ఆరోగ్యం'} కొరకు సూచించబడింది. సూచనలు: రోజుకు ${matchedMedByName.frequency} సార్లు (${matchedMedByName.scheduleTimes.join(", ")}), ${matchedMedByName.timing}. నిల్వ: ${matchedMedByName.qtyRemaining} మిగిలి ఉన్నాయి.`;
        } else {
            return `**${matchedMedByName.name}** (${matchedMedByName.dosage}) is prescribed by ${matchedMedByName.doctor} for: **${matchedMedByName.indication || 'General Health'}**. Directions: Take ${matchedMedByName.frequency} daily (${matchedMedByName.scheduleTimes.join(", ")}), ${matchedMedByName.timing}. Current stock: ${matchedMedByName.qtyRemaining} units remaining.`;
        }
    }

    // Check if query matches any indication keywords dynamically
    const words = qLower.split(/[\s,\.\?\!]+/);
    const matchedMedsByIndication = STATE.medications.filter(m => {
        const ind = (m.indication || "").toLowerCase();
        return words.some(w => w.length > 3 && ind.includes(w));
    });

    if (matchedMedsByIndication.length > 0) {
        let textRes = "";
        if (lang === "hi-IN") {
            textRes = `आपके लक्षण/आवश्यकता के आधार पर, निम्नलिखित दवा(एं) उपलब्ध हैं:\n`;
            matchedMedsByIndication.forEach(m => {
                textRes += `- *${m.name}* (${m.dosage}, ${m.timing}) जो कि ${m.doctor} द्वारा ${m.indication} के लिए है।\n`;
            });
            textRes += `\n*महत्वपूर्ण चेतावनी*: यह एक एआई सहायता है। यदि लक्षण गंभीर हैं, तो कृपया तुरंत डॉक्टर से संपर्क करें।`;
        } else if (lang === "ta-IN") {
            textRes = `உங்கள் அறிகுறிகளின் அடிப்படையில், பின்வரும் மருந்து(கள்) உள்ளன:\n`;
            matchedMedsByIndication.forEach(m => {
                textRes += `- *${m.name}* (${m.dosage}, ${m.timing}) - மருத்துவர் ${m.doctor} பரிந்துரைத்தது (காரணம்: ${m.indication}).\n`;
            });
            textRes += `\n*முக்கிய எச்சரிக்கை*: இது ஒரு AI உதவி மட்டுமே. அவசர காலங்களில் மருத்துவரை அணுகவும்.`;
        } else if (lang === "te-IN") {
            textRes = `మీ లక్షణాల ఆధారంగా, ఈ క్రింది మందు(లు) ఉన్నాయి:\n`;
            matchedMedsByIndication.forEach(m => {
                textRes += `- *${m.name}* (${m.dosage}, ${m.timing}) - డాక్టర్ ${m.doctor} సూచించినది (కారణం: ${m.indication}).\n`;
            });
            textRes += `\n*ముఖ్యమైన హెచ్చరిక*: ఇది AI సహాయం మాత్రమే. ఒకవేళ మీ సమస్య తీవ్రమైతే డాక్టర్‌ను సంప్రదించండి.`;
        } else {
            textRes = `Based on your query, the following active medication(s) match your symptoms/usage:\n`;
            matchedMedsByIndication.forEach(m => {
                textRes += `- **${m.name}** (${m.dosage}, ${m.timing}) prescribed by ${m.doctor} for: **${m.indication}**.\n`;
            });
            textRes += `\n⚠️ **Medical Safety Disclaimer**: I am a helper AI, not a doctor. If your symptoms are severe or persist, please consult your physician immediately or call emergency services (112).`;
        }
        return textRes;
    }

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
                        const isActive = isMedicationCurrentlyActive(m);
                        const statusText = m.course === "Daily" 
                            ? (isActive ? `Daily Active (${m.courseDuration || 'Lifetime'})` : "Daily Active (Course Completed)") 
                            : "Prescribed (Not in Use)";
                        textRes += `- **${m.name}** (${m.dosage}, ${m.timing}) [Status: ${statusText}] prescribed by ${m.doctor} (for: ${m.indication}).\n`;
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
        const dailyMeds = STATE.medications.filter(isMedicationCurrentlyActive);
        if (dailyMeds.length === 0) return "No active daily medications scheduled.";
        let listStr = dict.schedule;
        dailyMeds.forEach(m => {
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
        if (activeProf) {
            const allgsStr = activeProf.allergies && activeProf.allergies.length > 0 ? activeProf.allergies.join(", ") : "None";
            if (lang === "hi-IN") {
                return `नमस्ते ${activeProf.name}, मैं आपका स्वास्थ्य संरक्षक हूं। मुझे पता है कि आपकी उम्र ${activeProf.age} वर्ष है और आपको इन चीज़ों से एलर्जी है: ${allgsStr}। मैं आज आपकी क्या सहायता कर सकता हूँ?`;
            } else if (lang === "ta-IN") {
                return `வணக்கம் ${activeProf.name}, நான் உங்கள் சுகாதார காப்பாளர். உங்கள் வயது ${activeProf.age} மற்றும் உங்களுக்கு இருக்கும் ஒவ்வாமைகள்: ${allgsStr}. நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?`;
            } else if (lang === "te-IN") {
                return `నమస్తే ${activeProf.name}, నేను మీ ఆరోగ్య సంరక్షకుడిని. మీ వయస్సు ${activeProf.age} సంవత్సరాలు మరియు మీ అలెర్జీలు: ${allgsStr}. నేను మీకు ఎలా సహాయం చేయగలను?`;
            } else {
                return `Hello ${activeProf.name}! I am your Healthcare Guardian. I note that you are ${activeProf.age} years old (Gender: ${activeProf.gender}) and are allergic to: **${allgsStr}**. How can I help you customize your health management today?`;
            }
        }
        return dict.greet;
    }

    return dict.unknown;
}

function triggerSpeechFeedback(text, lang = "en-US") {
    if (isProfileLocked) return;
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
            <td>
                <a href="tel:${c.phone}" class="btn btn-sm btn-success" style="padding:0.35rem 0.75rem; font-size:0.85rem; border-radius:6px; display:inline-flex; align-items:center; gap:0.4rem; font-weight:700; text-decoration:none; color:white; background:var(--color-success) !important; border:none; box-shadow:0 2px 5px rgba(16,185,129,0.2);">
                    <i class="bi bi-telephone-fill"></i> Call Caregiver
                </a>
            </td>
            <td>
                <a href="sms:${c.phone}?body=Hello%20${encodeURIComponent(c.name)},%20this%20is%20an%20urgent%20alert%20from%20MediCare%20Guardian." class="btn btn-sm btn-primary" style="padding:0.35rem 0.75rem; font-size:0.85rem; border-radius:6px; display:inline-flex; align-items:center; gap:0.4rem; font-weight:700; text-decoration:none; color:white; background:var(--color-primary) !important; border:none; box-shadow:0 2px 5px rgba(59,130,246,0.2);">
                    <i class="bi bi-chat-fill"></i> Send Message
                </a>
            </td>
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
    
    const activeProf = PROFILES.find(p => p.id === currentProfileId);
    const patientName = activeProf ? `${activeProf.name} (Medicare Guardian User)` : "Senior Patient (Medicare Guardian User)";
    
    // Trigger real EmailJS email dispatches
    return emailjs.send(
        STATE.settings.api.serviceId,
        STATE.settings.api.templateId,
        {
            to_name: contact.name,
            to_email: contact.email,
            patient_name: patientName,
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
    const activeProf = PROFILES.find(p => p.id === currentProfileId);
    const patientName = activeProf ? activeProf.name : "Senior";
    const customizedReason = reason.replace(/\bSenior\b/g, patientName);

    let dispatchPromises = STATE.emergencyContacts.map(c => {
        return dispatchEmailAlert(c, `AUTO OVERDUE ESCALATION: ${customizedReason}`, medName)
            .then(res => {
                const status = res.mock ? "Sent Successfully (Simulation)" : "Dispatched Real Email";
                STATE.emergencyLogs.push({
                    timestamp: dateStr,
                    reason: `AUTO OVERDUE ESCALATION: ${patientName} missed dose of ${medName}`,
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

function triggerSkipDoseAlert(medName, scheduledTime) {
    const dateStr = new Date().toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const activeProf = PROFILES.find(p => p.id === currentProfileId);
    const patientName = activeProf ? activeProf.name : "Senior";
    const reason = `PATIENT SKIP ALERT: ${patientName} has manually skipped the dose of ${medName} scheduled for ${scheduledTime}.`;

    let dispatchPromises = STATE.emergencyContacts.map(c => {
        return dispatchEmailAlert(c, reason, medName)
            .then(res => {
                const status = res.mock ? "Sent Successfully (Simulation)" : "Dispatched Real Email";
                STATE.emergencyLogs.push({
                    timestamp: dateStr,
                    reason: `DOSE SKIPPED ALERT: ${patientName} skipped dose of ${medName}`,
                    target: `${c.name} (${c.relation})`,
                    method: res.mock ? "SMS Skip Alert" : "EmailJS API Alert",
                    status: status
                });
            })
            .catch(err => {
                console.error("EmailJS Error:", err);
                STATE.emergencyLogs.push({
                    timestamp: dateStr,
                    reason: `DOSE SKIPPED: Alert Dispatch Failed`,
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
        new Notification("MediCare Guardian: Caregiver Skip Alert Dispatched", {
            body: `Caregiver notified of skipped dose: ${medName}`,
            icon: "https://cdn-icons-png.flaticon.com/512/1047/1047683.png"
        });
    }

    triggerSpeechFeedback("Dose skipped. Caregivers have been notified.", "en-US");
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

    const today = new Date();
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    el.innerText = today.toLocaleDateString('en-US', options);
}

function refreshSettingsUI() {
    themeSelector.value = STATE.settings.theme;
    updateFontScaleButtons(STATE.settings.fontScale);
    
    document.getElementById("assistant-lang").value = STATE.settings.lang || "en-US";
    document.getElementById("assistant-speech-output").checked = STATE.settings.speechOutput;
    
    const enableCheckbox = document.getElementById("api-emailjs-enable");
    const inputsContainer = document.getElementById("emailjs-inputs-container");
    if (enableCheckbox && inputsContainer) {
        enableCheckbox.checked = STATE.settings.api.enable;
        inputsContainer.style.display = STATE.settings.api.enable ? "grid" : "none";
        document.getElementById("api-emailjs-service-id").value = STATE.settings.api.serviceId || "";
        document.getElementById("api-emailjs-template-id").value = STATE.settings.api.templateId || "";
        document.getElementById("api-emailjs-public-key").value = STATE.settings.api.publicKey || "";
    }

    // Refresh Firebase UI
    if (!STATE.settings.firebase) {
        STATE.settings.firebase = { enable: false, apiKey: "", projectId: "", authDomain: "", appId: "" };
    }
    const fbEnable = document.getElementById("api-firebase-enable");
    const fbInputs = document.getElementById("firebase-inputs-container");
    if (fbEnable && fbInputs) {
        fbEnable.checked = STATE.settings.firebase.enable;
        fbInputs.style.display = STATE.settings.firebase.enable ? "grid" : "none";
        document.getElementById("api-firebase-key").value = STATE.settings.firebase.apiKey || "";
        document.getElementById("api-firebase-project-id").value = STATE.settings.firebase.projectId || "";
        document.getElementById("api-firebase-auth-domain").value = STATE.settings.firebase.authDomain || "";
        document.getElementById("api-firebase-app-id").value = STATE.settings.firebase.appId || "";
        updateFirebaseAuthUI();
    }

    // Refresh Gemini UI
    if (!STATE.settings.gemini) {
        STATE.settings.gemini = { enable: false, apiKey: "" };
    }
    const geminiEnable = document.getElementById("api-gemini-enable");
    const geminiInputs = document.getElementById("gemini-inputs-container");
    if (geminiEnable && geminiInputs) {
        geminiEnable.checked = STATE.settings.gemini.enable;
        geminiInputs.style.display = STATE.settings.gemini.enable ? "grid" : "none";
        document.getElementById("api-gemini-key").value = STATE.settings.gemini.apiKey || "";
    }
    
    const activeProf = PROFILES.find(p => p.id === currentProfileId);
    if (activeProf) {
        document.getElementById("settings-auto-lock").value = activeProf.timeoutMinutes || 0;
        
        const nameInput = document.getElementById("settings-profile-name");
        if (nameInput) nameInput.value = activeProf.name || "";
        const ageInput = document.getElementById("settings-profile-age");
        if (ageInput) ageInput.value = activeProf.age || "";
        const genderInput = document.getElementById("settings-profile-gender");
        if (genderInput) genderInput.value = activeProf.gender || "Male";
        const allergiesInput = document.getElementById("settings-profile-allergies");
        if (allergiesInput) allergiesInput.value = (activeProf.allergies || []).join(", ") || "";

        const statusBadge = document.getElementById("encryption-status-badge");
        if (statusBadge) {
            if (activeProf.hasPin) {
                statusBadge.innerHTML = `<span class="badge-tag" style="background:rgba(16,185,129,0.1); color:var(--color-success); border:1px solid rgba(16,185,129,0.2);"><i class="bi bi-shield-fill-check"></i> Encrypted (AES-GCM)</span>`;
            } else {
                statusBadge.innerHTML = `<span class="badge-tag" style="background:rgba(239,68,68,0.1); color:var(--color-danger); border:1px solid rgba(239,68,68,0.2);"><i class="bi bi-unlock-fill"></i> Unencrypted (No PIN)</span>`;
            }
        }
    }
}

// Global Firebase auth state
let firebaseAppInstance = null;
let firestoreInstance = null;
let firebaseUser = null;

// Dynamic Gemini API query with RAG context injection
async function queryGeminiAPI(query, apiKey, activeProf, activeMeds) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const systemInstruction = `
You are "Guardian AI", a highly secure, private medical health companion for seniors.
The user is logged in as: ${activeProf ? activeProf.name : 'Senior'}.
Patient profile: Age: ${activeProf ? activeProf.age : 75}, Gender: ${activeProf ? activeProf.gender : 'Male'}, Allergies: ${activeProf && activeProf.allergies ? activeProf.allergies.join(", ") : 'None'}.
Active Medications:
${activeMeds.map(m => `- ${m.name} (${m.dosage}, ${m.timing}), prescribed by ${m.doctor} for: ${m.indication}. Dose times: ${m.scheduleTimes.join(", ")}`).join("\n")}

Always keep responses senior-friendly, extremely clear, simple, and concise. Use clean markdown formatting (no bold lists unless necessary, focus on short lines).
CRITICAL PRIVACY RULE: Under no circumstances should you leak, output, or disclose any sensitive configuration data, personal identification details (like security PINs or passwords), browser localStorage dump values, or raw API keys (such as the Gemini or Firebase keys). You must protect the user's data privacy at all costs.
CRITICAL SAFETY RULE: You are an AI, not a doctor. If the user asks about dangerous symptom configurations, warn them and suggest calling emergency services or their caregiver. If they ask about taking a medication they are allergic to, issue a critical warning!
    `;

    const requestBody = {
        contents: [
            {
                role: "user",
                parts: [{ text: query }]
            }
        ],
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        },
        generationConfig: {
            maxOutputTokens: 250,
            temperature: 0.4
        }
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.candidates[0].content.parts[0].text;
}

// Firebase Cloud Sync Setup & Handlers
function initFirebase() {
    if (!STATE.settings.firebase || !STATE.settings.firebase.enable) {
        const authContainer = document.getElementById("firebase-auth-container");
        if (authContainer) authContainer.style.display = "none";
        return;
    }

    const config = {
        apiKey: STATE.settings.firebase.apiKey,
        authDomain: STATE.settings.firebase.authDomain,
        projectId: STATE.settings.firebase.projectId,
        appId: STATE.settings.firebase.appId
    };

    if (!config.apiKey || !config.projectId) {
        const authContainer = document.getElementById("firebase-auth-container");
        if (authContainer) authContainer.style.display = "none";
        return;
    }

    try {
        if (firebase.apps.length === 0) {
            firebaseAppInstance = firebase.initializeApp(config);
        } else {
            firebaseAppInstance = firebase.app();
        }
        firestoreInstance = firebase.firestore();
        
        const authContainer = document.getElementById("firebase-auth-container");
        if (authContainer) authContainer.style.display = "block";
        
        firebase.auth().onAuthStateChanged((user) => {
            firebaseUser = user;
            updateFirebaseAuthUI();
            if (user) {
                syncFromCloudSilent();
            }
        });
    } catch (error) {
        console.error("Firebase Initialization Failed:", error);
        const statusDisplay = document.getElementById("firebase-status-display");
        if (statusDisplay) statusDisplay.innerText = "Init Error: " + error.message;
        const authContainer = document.getElementById("firebase-auth-container");
        if (authContainer) authContainer.style.display = "block";
    }
}

function updateFirebaseAuthUI() {
    const statusDisplay = document.getElementById("firebase-status-display");
    const authForm = document.getElementById("form-firebase-auth");
    const signedInActions = document.getElementById("firebase-signed-in-actions");

    if (!statusDisplay) return;

    if (firebaseUser) {
        statusDisplay.className = "badge-tag";
        statusDisplay.style.background = "rgba(16,185,129,0.1)";
        statusDisplay.style.color = "var(--color-success)";
        statusDisplay.style.border = "1px solid rgba(16,185,129,0.2)";
        statusDisplay.innerHTML = `<i class="bi bi-cloud-check-fill"></i> Connected: ${firebaseUser.email}`;
        
        if (authForm) authForm.style.display = "none";
        if (signedInActions) signedInActions.style.display = "flex";
    } else {
        statusDisplay.className = "badge-tag";
        statusDisplay.style.background = "rgba(239,68,68,0.1)";
        statusDisplay.style.color = "var(--color-danger)";
        statusDisplay.style.border = "1px solid rgba(239,68,68,0.2)";
        statusDisplay.innerHTML = `<i class="bi bi-cloud-slash-fill"></i> Cloud Disconnected`;
        
        if (authForm) authForm.style.display = "block";
        if (signedInActions) signedInActions.style.display = "none";
    }
}

async function backupToCloud() {
    if (!firebaseUser || !firestoreInstance) {
        alert("Please sign in to a cloud account first.");
        return;
    }

    try {
        const payload = {
            medications: STATE.medications,
            history: STATE.history,
            purchases: STATE.purchases,
            emergencyContacts: STATE.emergencyContacts,
            emergencyLogs: STATE.emergencyLogs,
            settings: STATE.settings,
            lastSynced: new Date().toISOString()
        };

        const path = `users/${firebaseUser.uid}/profiles/${currentProfileId || 'default'}`;
        await firestoreInstance.doc(path).set(payload);
        alert("Backup uploaded successfully to Firestore Cloud!");
    } catch (error) {
        console.error("Cloud Backup Failed:", error);
        alert("Backup failed: " + error.message);
    }
}

async function restoreFromCloud() {
    if (!firebaseUser || !firestoreInstance) {
        alert("Please sign in to a cloud account first.");
        return;
    }

    if (!confirm("Are you sure you want to restore? This will overwrite all local settings, medications, and schedule logs for the active profile.")) {
        return;
    }

    try {
        const path = `users/${firebaseUser.uid}/profiles/${currentProfileId || 'default'}`;
        const doc = await firestoreInstance.doc(path).get();
        if (doc.exists) {
            const data = doc.data();
            
            STATE.medications = data.medications || [];
            STATE.history = data.history || [];
            STATE.purchases = data.purchases || [];
            STATE.emergencyContacts = data.emergencyContacts || [];
            STATE.emergencyLogs = data.emergencyLogs || [];
            STATE.settings = { ...STATE.settings, ...(data.settings || {}) };
            
            saveState();
            renderMedications();
            renderDashboard();
            renderEmergency();
            refreshSettingsUI();
            
            alert("Data restored successfully from Firestore Cloud!");
        } else {
            alert("No backup document found in the cloud for this profile.");
        }
    } catch (error) {
        console.error("Cloud Restore Failed:", error);
        alert("Restore failed: " + error.message);
    }
}

async function syncFromCloudSilent() {
    if (!firebaseUser || !firestoreInstance) return;
    try {
        const path = `users/${firebaseUser.uid}/profiles/${currentProfileId || 'default'}`;
        const doc = await firestoreInstance.doc(path).get();
        if (doc.exists) {
            const data = doc.data();
            if (STATE.medications.length === 0 && data.medications && data.medications.length > 0) {
                STATE.medications = data.medications;
                STATE.history = data.history || [];
                STATE.purchases = data.purchases || [];
                STATE.emergencyContacts = data.emergencyContacts || [];
                STATE.emergencyLogs = data.emergencyLogs || [];
                saveState();
                renderMedications();
                renderDashboard();
                renderEmergency();
            }
        }
    } catch (e) {
        console.warn("Silent sync error:", e);
    }
}

function initFirebaseUIListeners() {
    const fbEnable = document.getElementById("api-firebase-enable");
    if (fbEnable) {
        fbEnable.addEventListener("change", (e) => {
            const inputs = document.getElementById("firebase-inputs-container");
            if (inputs) inputs.style.display = e.target.checked ? "grid" : "none";
        });
    }

    const fbSettingsForm = document.getElementById("form-firebase-settings");
    if (fbSettingsForm) {
        fbSettingsForm.addEventListener("submit", (e) => {
            e.preventDefault();
            
            const enable = document.getElementById("api-firebase-enable").checked;
            const apiKey = document.getElementById("api-firebase-key").value.trim();
            const projectId = document.getElementById("api-firebase-project-id").value.trim();
            const authDomain = document.getElementById("api-firebase-auth-domain").value.trim();
            const appId = document.getElementById("api-firebase-app-id").value.trim();
            
            if (!STATE.settings.firebase) {
                STATE.settings.firebase = {};
            }
            
            STATE.settings.firebase = {
                enable,
                apiKey,
                projectId,
                authDomain,
                appId
            };
            
            saveState();
            
            if (enable) {
                initFirebase();
                alert("Firebase Cloud configuration saved and initialized!");
            } else {
                alert("Firebase Cloud integration disabled.");
                const authContainer = document.getElementById("firebase-auth-container");
                if (authContainer) authContainer.style.display = "none";
            }
        });
    }

    const btnSignIn = document.getElementById("btn-firebase-signin");
    const btnSignUp = document.getElementById("btn-firebase-signup");
    const btnSignOut = document.getElementById("btn-firebase-signout");
    const btnBackup = document.getElementById("btn-firebase-backup");
    const btnRestore = document.getElementById("btn-firebase-restore");

    if (btnSignIn) {
        btnSignIn.addEventListener("click", async () => {
            const email = document.getElementById("firebase-email").value.trim();
            const password = document.getElementById("firebase-password").value;
            if (!email || !password) {
                alert("Please enter both email and password.");
                return;
            }
            try {
                await firebase.auth().signInWithEmailAndPassword(email, password);
                alert("Successfully signed in to Medicare Cloud!");
            } catch (err) {
                alert("Sign In Failed: " + err.message);
            }
        });
    }

    if (btnSignUp) {
        btnSignUp.addEventListener("click", async () => {
            const email = document.getElementById("firebase-email").value.trim();
            const password = document.getElementById("firebase-password").value;
            if (!email || !password) {
                alert("Please enter both email and password.");
                return;
            }
            if (password.length < 6) {
                alert("Password must be at least 6 characters.");
                return;
            }
            try {
                await firebase.auth().createUserWithEmailAndPassword(email, password);
                alert("Cloud Account successfully created! You are now logged in.");
                backupToCloud();
            } catch (err) {
                alert("Registration Failed: " + err.message);
            }
        });
    }

    if (btnSignOut) {
        btnSignOut.addEventListener("click", async () => {
            try {
                await firebase.auth().signOut();
                firebaseUser = null;
                updateFirebaseAuthUI();
                alert("Signed out from cloud session.");
            } catch (err) {
                alert("Sign Out Failed: " + err.message);
            }
        });
    }

    if (btnBackup) {
        btnBackup.addEventListener("click", () => backupToCloud());
    }

    if (btnRestore) {
        btnRestore.addEventListener("click", () => restoreFromCloud());
    }
}

function initGeminiUIListeners() {
    const enableCheckbox = document.getElementById("api-gemini-enable");
    const inputsContainer = document.getElementById("gemini-inputs-container");
    const settingsForm = document.getElementById("form-gemini-settings");

    if (enableCheckbox && inputsContainer && settingsForm) {
        if (!STATE.settings.gemini) {
            STATE.settings.gemini = { enable: false, apiKey: "" };
        }

        enableCheckbox.addEventListener("change", (e) => {
            inputsContainer.style.display = e.target.checked ? "grid" : "none";
        });

        settingsForm.addEventListener("submit", (e) => {
            e.preventDefault();
            STATE.settings.gemini = {
                enable: enableCheckbox.checked,
                apiKey: document.getElementById("api-gemini-key").value.trim()
            };
            saveState();
            alert("Gemini AI API Configuration saved successfully!");
        });
    }
}

function handlePinInputDigit(num) {
    if (enteredPinDigits.length < 4) {
        enteredPinDigits.push(num);
        updatePinDots();
        document.getElementById("pin-error-msg").style.display = "none";
    }
    
    if (enteredPinDigits.length === 4) {
        setTimeout(validatePinEntry, 200);
    }
}

function updatePinDots() {
    const dots = document.querySelectorAll("#pin-dots .pin-dot");
    dots.forEach((dot, idx) => {
        if (idx < enteredPinDigits.length) {
            dot.classList.add("active");
        } else {
            dot.classList.remove("active");
        }
    });
}

async function validatePinEntry() {
    const pinStr = enteredPinDigits.join("");
    const profile = PROFILES.find(p => p.id === currentProfileId);
    if (!profile) return;

    try {
        const key = await deriveKeyFromPin(pinStr, profile.salt);
        const success = await loadProfileState(currentProfileId, key);
        if (success) {
            sessionStorage.setItem("mg_active_profile_pin", pinStr);
            isProfileLocked = false;
            enteredPinDigits = [];
            updatePinDots();
            
            document.getElementById("pin-lock-overlay").style.display = "none";
            document.getElementById("sidebar-profile-card").style.display = "flex";
            
            renderMedications();
            renderDashboard();
            renderEmergency();
            refreshSettingsUI();
            
            resetInactivityTimer();
            
            triggerSpeechFeedback(`Welcome back, ${profile.name}`, STATE.settings.lang || "en-US");
        } else {
            throw new Error("Incorrect decryption key");
        }
    } catch (err) {
        const card = document.querySelector(".pin-card");
        card.classList.add("shake-error");
        document.getElementById("pin-error-msg").style.display = "block";
        
        enteredPinDigits = [];
        updatePinDots();
        
        setTimeout(() => {
            card.classList.remove("shake-error");
        }, 350);
    }
}

async function selectProfile(profileId) {
    const profile = PROFILES.find(p => p.id === profileId);
    if (!profile) return;

    if (profile.hasPin) {
        currentProfileId = profileId;
        enteredPinDigits = [];
        updatePinDots();
        
        document.getElementById("lock-profile-name").innerText = profile.name;
        document.getElementById("lock-avatar").className = "profile-avatar-circle " + (profile.avatar || "avatar-blue");
        document.getElementById("pin-error-msg").style.display = "none";
        
        document.getElementById("profile-select-overlay").style.display = "none";
        document.getElementById("pin-lock-overlay").style.display = "flex";
    } else {
        const success = await loadProfileState(profileId);
        if (success) {
            isProfileLocked = false;
            document.getElementById("sidebar-profile-name").innerText = profile.name;
            document.getElementById("sidebar-avatar").className = "profile-avatar-circle " + (profile.avatar || "avatar-blue");
            document.getElementById("sidebar-profile-card").style.display = "flex";
            
            document.getElementById("profile-select-overlay").style.display = "none";
            
            renderMedications();
            renderDashboard();
            renderEmergency();
            refreshSettingsUI();
            
            resetInactivityTimer();
            
            triggerSpeechFeedback(`Welcome back, ${profile.name}`, STATE.settings.lang || "en-US");
        }
    }
}

function renderProfilesGrid() {
    const grid = document.getElementById("profiles-list-grid");
    if (!grid) return;
    grid.innerHTML = "";
    
    PROFILES.forEach(profile => {
        const item = document.createElement("div");
        item.className = "profile-select-item animate-fadeIn";
        item.innerHTML = `
            <div class="profile-avatar-circle ${profile.avatar || 'avatar-blue'}">
                <i class="bi bi-person-fill"></i>
            </div>
            <h4>${profile.name}</h4>
            ${profile.hasPin ? '<div class="profile-lock-badge" title="PIN Protected"><i class="bi bi-lock-fill"></i></div>' : '<div class="profile-lock-badge" title="Open Access"><i class="bi bi-unlock-fill"></i></div>'}
        `;
        
        item.addEventListener("click", () => {
            selectProfile(profile.id);
        });
        
        grid.appendChild(item);
    });
}

async function lockProfile() {
    if (!currentProfileId || isProfileLocked) return;
    
    await saveState();
    
    isProfileLocked = true;
    enteredPinDigits = [];
    currentProfileKey = null;
    sessionStorage.removeItem("mg_active_profile_pin");
    
    const profile = PROFILES.find(p => p.id === currentProfileId);
    if (profile) {
        document.getElementById("lock-profile-name").innerText = profile.name;
        document.getElementById("lock-avatar").className = "profile-avatar-circle " + (profile.avatar || "avatar-blue");
        document.getElementById("pin-error-msg").style.display = "none";
    }
    
    updatePinDots();
    
    document.querySelectorAll(".modal-overlay").forEach(m => m.style.display = "none");
    document.getElementById("pin-lock-overlay").style.display = "flex";
    
    triggerSpeechFeedback("Screen locked.", STATE.settings.lang || "en-US");
}

function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    
    if (!currentProfileId || isProfileLocked) return;
    
    const activeProf = PROFILES.find(p => p.id === currentProfileId);
    if (!activeProf || !activeProf.hasPin || activeProf.timeoutMinutes === 0) return;
    
    inactivityTimer = setTimeout(() => {
        lockProfile();
    }, activeProf.timeoutMinutes * 60 * 1000);
}

function initInactivityListeners() {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(evt => {
        window.addEventListener(evt, () => {
            resetInactivityTimer();
        });
    });
}

function initSecurity() {
    document.getElementById("btn-trigger-add-profile").addEventListener("click", () => {
        openModal(document.getElementById("modal-add-profile"));
    });

    const settingsProfileSwitch = document.getElementById("btn-settings-profile-switch");
    if (settingsProfileSwitch) {
        settingsProfileSwitch.addEventListener("click", () => {
            const sidebarSwitch = document.getElementById("btn-sidebar-profile-switch");
            if (sidebarSwitch) sidebarSwitch.click();
        });
    }

    document.getElementById("btn-close-add-profile").addEventListener("click", () => {
        closeModal(document.getElementById("modal-add-profile"));
    });

    document.getElementById("btn-cancel-create-profile").addEventListener("click", () => {
        closeModal(document.getElementById("modal-add-profile"));
    });

    document.getElementById("profile-pin-enable").addEventListener("change", (e) => {
        const pinInputs = document.getElementById("profile-pin-inputs-container");
        pinInputs.style.display = e.target.checked ? "block" : "none";
        if (e.target.checked) {
            document.getElementById("new-profile-pin").required = true;
            document.getElementById("new-profile-pin-confirm").required = true;
        } else {
            document.getElementById("new-profile-pin").required = false;
            document.getElementById("new-profile-pin-confirm").required = false;
        }
    });

    document.getElementById("form-create-profile").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("new-profile-name").value.trim();
        const avatar = document.querySelector('input[name="profile-avatar"]:checked').value;
        const pinEnabled = document.getElementById("profile-pin-enable").checked;
        const timeout = parseInt(document.getElementById("profile-timeout").value) || 0;
        const age = parseInt(document.getElementById("new-profile-age").value) || 75;
        const gender = document.getElementById("new-profile-gender").value || "Male";
        const allergiesVal = document.getElementById("new-profile-allergies").value.trim();
        const allergies = allergiesVal ? allergiesVal.split(",").map(s => s.trim()).filter(s => s.length > 0) : [];
        
        let pin = null;
        let salt = null;
        let derivedKey = null;

        if (pinEnabled) {
            const pinVal = document.getElementById("new-profile-pin").value;
            const confirmVal = document.getElementById("new-profile-pin-confirm").value;
            
            if (pinVal.length !== 4 || !/^\d+$/.test(pinVal)) {
                alert("PIN must be exactly 4 digits.");
                return;
            }
            if (pinVal !== confirmVal) {
                alert("PIN and Confirm PIN do not match.");
                return;
            }
            pin = pinVal;
            
            const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
            salt = bufferToHex(saltBytes);
            derivedKey = await deriveKeyFromPin(pin, salt);
        }

        const newProfile = {
            id: "prof-" + Date.now(),
            name: name,
            avatar: avatar,
            hasPin: pinEnabled,
            salt: salt,
            timeoutMinutes: timeout,
            age: age,
            gender: gender,
            allergies: allergies
        };

        PROFILES.push(newProfile);
        saveProfilesList();

        // Starts completely clean
        const initialData = {
            medications: [],
            history: [],
            purchases: [],
            emergencyContacts: [],
            emergencyLogs: [],
            settings: {
                theme: "light",
                fontScale: 1,
                lang: "en-US",
                speechOutput: true,
                api: { enable: false, serviceId: "", templateId: "", publicKey: "" }
            }
        };

        const initialString = JSON.stringify(initialData);

        if (pinEnabled && derivedKey) {
            const encrypted = await encryptData(initialString, derivedKey);
            localStorage.setItem(`mg_profile_${newProfile.id}_data`, JSON.stringify({
                encrypted: true,
                ciphertext: encrypted.ciphertext,
                iv: encrypted.iv
            }));
        } else {
            localStorage.setItem(`mg_profile_${newProfile.id}_data`, initialString);
        }

        closeModal(document.getElementById("modal-add-profile"));
        e.target.reset();
        document.getElementById("profile-pin-inputs-container").style.display = "none";
        
        // Dynamic redirection to dashboard of newly created user profile
        sessionStorage.setItem("mg_active_profile_id", newProfile.id);
        if (pinEnabled) {
            sessionStorage.setItem("mg_active_profile_pin", pin);
        }
        
        const success = await loadProfileState(newProfile.id, derivedKey || null);
        if (success) {
            isProfileLocked = false;
            document.getElementById("sidebar-profile-name").innerText = newProfile.name;
            document.getElementById("sidebar-avatar").className = "profile-avatar-circle " + (newProfile.avatar || "avatar-blue");
            document.getElementById("sidebar-profile-card").style.display = "flex";
            
            document.getElementById("profile-select-overlay").style.display = "none";
            
            // Re-enable modal dismiss controls if they were onboarding blocked
            const closeBtn = document.getElementById("btn-close-add-profile");
            const cancelBtn = document.getElementById("btn-cancel-create-profile");
            if (closeBtn) closeBtn.style.display = "block";
            if (cancelBtn) cancelBtn.style.display = "inline-block";
            
            renderProfilesGrid();
            renderMedications();
            renderDashboard();
            renderEmergency();
            refreshSettingsUI();
            resetInactivityTimer();
            
            alert(`Welcome to MediCare Guardian, ${newProfile.name}!`);
            triggerSpeechFeedback(`Welcome to MediCare Guardian, ${newProfile.name}`, STATE.settings.lang || "en-US");
        } else {
            renderProfilesGrid();
            alert(`Profile created! Click card in selection list to log in.`);
        }
    });

    document.querySelectorAll(".numpad-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const num = btn.getAttribute("data-num");
            if (num !== null) {
                handlePinInputDigit(num);
            }
        });
    });

    document.getElementById("btn-pin-clear").addEventListener("click", () => {
        enteredPinDigits = [];
        updatePinDots();
        document.getElementById("pin-error-msg").style.display = "none";
    });

    document.getElementById("btn-pin-back").addEventListener("click", () => {
        enteredPinDigits.pop();
        updatePinDots();
        document.getElementById("pin-error-msg").style.display = "none";
    });

    document.getElementById("btn-lock-cancel").addEventListener("click", () => {
        currentProfileId = null;
        currentProfileKey = null;
        isProfileLocked = false;
        enteredPinDigits = [];
        
        sessionStorage.clear();
        
        document.getElementById("pin-lock-overlay").style.display = "none";
        document.getElementById("profile-select-overlay").style.display = "flex";
        document.getElementById("sidebar-profile-card").style.display = "none";
        
        renderProfilesGrid();
    });

    document.getElementById("btn-sidebar-profile-switch").addEventListener("click", async () => {
        if (currentProfileId) {
            await saveState();
        }
        
        currentProfileId = null;
        currentProfileKey = null;
        isProfileLocked = false;
        enteredPinDigits = [];
        
        sessionStorage.clear();
        
        document.getElementById("sidebar-profile-card").style.display = "none";
        document.getElementById("profile-select-overlay").style.display = "flex";
        
        renderProfilesGrid();
    });

    const changePinCheckbox = document.getElementById("change-pin-enable");
    if (changePinCheckbox) {
        changePinCheckbox.addEventListener("change", (e) => {
            document.getElementById("change-pin-new-container").style.display = e.target.checked ? "block" : "none";
        });
    }

    const changePinTrigger = document.getElementById("btn-change-pin-trigger");
    if (changePinTrigger) {
        changePinTrigger.addEventListener("click", () => {
            const activeProf = PROFILES.find(p => p.id === currentProfileId);
            if (!activeProf) return;

            document.getElementById("change-pin-enable").checked = activeProf.hasPin;
            document.getElementById("change-pin-new-container").style.display = activeProf.hasPin ? "block" : "none";
            document.getElementById("group-current-pin").style.display = activeProf.hasPin ? "block" : "none";
            
            document.getElementById("change-pin-current").value = "";
            document.getElementById("change-pin-new").value = "";
            document.getElementById("change-pin-new-confirm").value = "";

            openModal(document.getElementById("modal-change-pin"));
        });
    }

    document.getElementById("btn-close-change-pin").addEventListener("click", () => {
        closeModal(document.getElementById("modal-change-pin"));
    });
    document.getElementById("btn-cancel-change-pin").addEventListener("click", () => {
        closeModal(document.getElementById("modal-change-pin"));
    });

    document.getElementById("form-update-pin").addEventListener("submit", async (e) => {
        e.preventDefault();
        const activeProf = PROFILES.find(p => p.id === currentProfileId);
        if (!activeProf) return;

        const pinEnabled = document.getElementById("change-pin-enable").checked;
        let newKey = null;
        let newSaltHex = null;

        if (activeProf.hasPin) {
            const currentPinInput = document.getElementById("change-pin-current").value;
            try {
                const testKey = await deriveKeyFromPin(currentPinInput, activeProf.salt);
                const rawDataEnvelope = localStorage.getItem(`mg_profile_${currentProfileId}_data`);
                const envelope = JSON.parse(rawDataEnvelope);
                await decryptData(envelope.ciphertext, testKey, envelope.iv);
            } catch (err) {
                alert("Current PIN verification failed! PIN is incorrect.");
                return;
            }
        }

        if (pinEnabled) {
            const newPin = document.getElementById("change-pin-new").value;
            const newPinConfirm = document.getElementById("change-pin-new-confirm").value;

            if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
                alert("New PIN must be exactly 4 digits.");
                return;
            }
            if (newPin !== newPinConfirm) {
                alert("New PIN and Confirm PIN do not match.");
                return;
            }

            const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
            newSaltHex = bufferToHex(saltBytes);
            newKey = await deriveKeyFromPin(newPin, newSaltHex);

            activeProf.hasPin = true;
            activeProf.salt = newSaltHex;
            currentProfileKey = newKey;
            sessionStorage.setItem("mg_active_profile_pin", newPin);
        } else {
            activeProf.hasPin = false;
            activeProf.salt = null;
            currentProfileKey = null;
            sessionStorage.removeItem("mg_active_profile_pin");
        }

        saveProfilesList();
        await saveState();
        closeModal(document.getElementById("modal-change-pin"));
        refreshSettingsUI();
        alert("PIN security configuration updated successfully!");
    });

    document.getElementById("form-security-settings").addEventListener("submit", async (e) => {
        e.preventDefault();
        const activeProf = PROFILES.find(p => p.id === currentProfileId);
        if (!activeProf) return;

        const timeout = parseInt(document.getElementById("settings-auto-lock").value) || 0;
        activeProf.timeoutMinutes = timeout;
        
        saveProfilesList();
        resetInactivityTimer();
        alert("Security timeout updated successfully!");
    });

    document.getElementById("form-personal-settings").addEventListener("submit", async (e) => {
        e.preventDefault();
        const activeProf = PROFILES.find(p => p.id === currentProfileId);
        if (!activeProf) return;

        const name = document.getElementById("settings-profile-name").value.trim();
        const age = parseInt(document.getElementById("settings-profile-age").value) || activeProf.age;
        const gender = document.getElementById("settings-profile-gender").value;
        const allergiesVal = document.getElementById("settings-profile-allergies").value.trim();
        const allergies = allergiesVal ? allergiesVal.split(",").map(s => s.trim()).filter(s => s.length > 0) : [];

        if (!name) {
            alert("Profile Name cannot be empty.");
            return;
        }

        activeProf.name = name;
        activeProf.age = age;
        activeProf.gender = gender;
        activeProf.allergies = allergies;

        saveProfilesList();
        await saveState();

        document.getElementById("sidebar-profile-name").innerText = name;
        renderDashboard();
        alert("Personal information updated successfully!");
    });

    document.getElementById("btn-delete-profile").addEventListener("click", async () => {
        const activeProf = PROFILES.find(p => p.id === currentProfileId);
        if (!activeProf) return;

        const confirm1 = confirm(`WARNING: Are you sure you want to permanently delete the profile "${activeProf.name}"?\nAll associated prescriptions, medications, and caregiver alert logs will be lost forever.`);
        if (!confirm1) return;

        const confirmText = prompt(`Please type "DELETE" to confirm the deletion of "${activeProf.name}":`);
        if (confirmText !== "DELETE") {
            alert("Profile deletion cancelled.");
            return;
        }

        PROFILES = PROFILES.filter(p => p.id !== currentProfileId);
        saveProfilesList();

        // Delete from Cloud Firebase if logged in
        if (typeof firebaseUser !== 'undefined' && firebaseUser && typeof firestoreInstance !== 'undefined' && firestoreInstance) {
            const path = `users/${firebaseUser.uid}/profiles/${currentProfileId}`;
            firestoreInstance.doc(path).delete().catch(e => console.warn("Cloud profile deletion failed:", e));
        }

        localStorage.removeItem(`mg_profile_${currentProfileId}_data`);

        currentProfileId = null;
        currentProfileKey = null;
        sessionStorage.removeItem("mg_active_profile_id");
        sessionStorage.removeItem("mg_active_profile_pin");

        alert(`Profile "${activeProf.name}" has been permanently deleted.`);
        location.reload();
    });

    const radioAvatars = document.querySelectorAll('input[name="profile-avatar"]');
    radioAvatars.forEach(rad => {
        rad.addEventListener("change", () => {
            document.querySelectorAll(".avatar-circle-preview").forEach(div => div.classList.remove("active"));
            rad.closest(".avatar-theme-option").querySelector(".avatar-circle-preview").classList.add("active");
        });
    });
}

// Initialize on DOM load
window.addEventListener("DOMContentLoaded", () => {
    initRouter();
    initAccessibility();
    initOCR();
    initVoiceAssistant();
    initAlarmEngine();
    initEmergency();
    initModals();
    initSecurity();
    initMedications();
    initInactivityListeners();
    initFirebase();
    initFirebaseUIListeners();
    initGeminiUIListeners();
    
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
    
    renderDateTime();
    setInterval(renderDateTime, 1000);

    // Auto-onboarding if there are no user profiles
    if (PROFILES.length === 0) {
        setTimeout(() => {
            const addProfileModal = document.getElementById("modal-add-profile");
            const modalHeaderTitle = addProfileModal.querySelector(".modal-header h3");
            if (modalHeaderTitle) {
                modalHeaderTitle.innerHTML = `<i class="bi bi-shield-check text-primary"></i> Welcome to MediCare Guardian! Set Up Your Profile`;
            }
            const closeBtn = document.getElementById("btn-close-add-profile");
            const cancelBtn = document.getElementById("btn-cancel-create-profile");
            if (closeBtn) closeBtn.style.display = "none";
            if (cancelBtn) cancelBtn.style.display = "none";
            
            openModal(addProfileModal);
        }, 100);
    }

    renderProfilesGrid();

    // Session Restore
    const activeId = sessionStorage.getItem("mg_active_profile_id");
    const activePin = sessionStorage.getItem("mg_active_profile_pin");
    
    if (activeId) {
        const profObj = PROFILES.find(p => p.id === activeId);
        if (profObj) {
            if (!profObj.hasPin) {
                selectProfile(activeId);
            } else if (activePin) {
                (async () => {
                    try {
                        const key = await deriveKeyFromPin(activePin, profObj.salt);
                        const success = await loadProfileState(activeId, key);
                        if (success) {
                            isProfileLocked = false;
                            document.getElementById("sidebar-profile-name").innerText = profObj.name;
                            document.getElementById("sidebar-avatar").className = "profile-avatar-circle " + (profObj.avatar || "avatar-blue");
                            document.getElementById("sidebar-profile-card").style.display = "flex";
                            document.getElementById("profile-select-overlay").style.display = "none";
                            
                            renderMedications();
                            renderDashboard();
                            renderEmergency();
                            refreshSettingsUI();
                            
                            resetInactivityTimer();
                        } else {
                            document.getElementById("profile-select-overlay").style.display = "flex";
                        }
                    } catch (e) {
                        document.getElementById("profile-select-overlay").style.display = "flex";
                    }
                })();
            } else {
                selectProfile(activeId);
            }
        } else {
            document.getElementById("profile-select-overlay").style.display = "flex";
        }
    } else {
        document.getElementById("profile-select-overlay").style.display = "flex";
    }
});

