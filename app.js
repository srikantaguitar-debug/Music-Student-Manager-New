// --- 1. Firebase Config ---
const firebaseConfig = {
    apiKey: "AIzaSyBDr_ANRX57trE7_1pkH2BaOeQsG0B-3LI",
    authDomain: "student-management-syste-6a036.firebaseapp.com",
    projectId: "student-management-syste-6a036",
    storageBucket: "student-management-syste-6a036.firebasestorage.app",
    messagingSenderId: "198959369817",
    appId: "1:198959369817:web:f24dfd15b9d3d897d9eb48"
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- 2. ENABLE OFFLINE PERSISTENCE ---
if (!window.location.search.includes('student=')) {
    db.enablePersistence({ synchronizeTabs: true }).catch((err) => console.log(err));
}

const COLLECTION_NAME = 'music_classes';
let DOC_ID = 'main_data';

// --- 3. Optimized Database Functions ---
async function openDB() { return true; }

async function dbGet(key) {
    try {
        const docRef = db.collection(COLLECTION_NAME).doc(DOC_ID);
        const doc = await docRef.get(); 
        if (doc.exists) {
            const data = doc.data();
            return data[key] !== undefined ? data[key] : null;
        }
        return null;
    } catch (error) {
        console.log("Offline mode: Reading from cache...");
        return null;
    }
}

async function dbDelete(key) {
    try {
        const docRef = db.collection(COLLECTION_NAME).doc(DOC_ID);
        await docRef.update({ [key]: firebase.firestore.FieldValue.delete() });
    } catch (error) { console.error("Delete Error:", error); }
}

async function dbClear() {
    try { await db.collection(COLLECTION_NAME).doc(DOC_ID).delete(); }
    catch (error) { console.error("Clear Error:", error); }
}

async function syncOldDataToFirebase() {
    const docRef = db.collection(COLLECTION_NAME).doc(DOC_ID);
    const doc = await docRef.get();
    
    if (doc.exists) {
        console.log("Online data found. Skip migration.");
        return;
    }

    const lsPin = localStorage.getItem('app_pin');
    if (lsPin) {
        Swal.fire({ title: 'Syncing...', text: 'Uploading local data...', didOpen: () => Swal.showLoading() });
        
        const dataToUpload = {};
        if(localStorage.getItem('app_pin')) dataToUpload['app_pin'] = localStorage.getItem('app_pin');
        if(localStorage.getItem('students')) dataToUpload['students'] = JSON.parse(localStorage.getItem('students'));
        if(localStorage.getItem('attendance')) dataToUpload['attendance'] = JSON.parse(localStorage.getItem('attendance'));
        if(localStorage.getItem('fees')) dataToUpload['fees'] = JSON.parse(localStorage.getItem('fees'));
        if(localStorage.getItem('studentSerialCounter')) dataToUpload['studentSerialCounter'] = localStorage.getItem('studentSerialCounter');
        if(localStorage.getItem('instituteLogo')) dataToUpload['instituteLogo'] = localStorage.getItem('instituteLogo');
        if(localStorage.getItem('authorizedSignature')) dataToUpload['authorizedSignature'] = localStorage.getItem('authorizedSignature');

        await docRef.set(dataToUpload, { merge: true });
        Swal.fire('Success', 'Data synced!', 'success');
    } else {
        await dbSet('app_pin', '1234');
    }
}

// --- 4. Service Worker & Clock ---
if ('serviceWorker' in navigator) { 
    window.addEventListener('load', () => { navigator.serviceWorker.register('./serviceWorker.js').catch(console.error); }); 
}

let lastCheckedDate = new Date().toDateString();

function startClock() {
    setInterval(() => {
        const now = new Date();
        const options = { 
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', 
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
        };
        document.getElementById('liveClock').textContent = now.toLocaleString('en-IN', options);

        if (now.toDateString() !== lastCheckedDate) {
            lastCheckedDate = now.toDateString();
            document.getElementById('attendanceDate').valueAsDate = now;
            renderAttendance();
        }
    }, 1000);
}

// --- 5. Global Variables ---
const INSTITUTE_NAME = "Guitar, Bass Guitar, Piano, Keyboard, Mandolin Classes"; 
const MY_NAME = "Srikanta Banerjee"; 
const DEFAULT_FEE = 500, DUE_DATE = 10; 

let students = [], attendance = {}, fees = {}, reminders = [], globalMaterials = [], studentSerialCounter = 1; 
let financeChartInstance = null; 
let instituteLogo = null; 
let authorizedSignature = null;
let analyticsChartInstance = null; 
let currentlyViewingStudentId = null; 
let currentStudentView = 'active'; 
let html5QrcodeScanner = null;
let signaturePad = null;
let isDrawing = false;
let currentStudentSignature = null;
let sigRotation = 0;
let currentPhotoBase64 = null; 
let currentEditPhotoBase64 = null; 
let photoSelectionContext = 'add';
let isPhotoDeletedInEdit = false;
let studentDisplayLimit = 20;
let tempActiveStudents = []; 
let currentFilteredMaterials = [];
let currentLibDisplayCount = 0;
const LIB_ITEMS_PER_PAGE = 10; 
let pendingAction = null, pinInput = "";
let dismissedBirthdays = JSON.parse(localStorage.getItem('dismissedBirthdays')) || [];

// --- 6. Auth & Initialization ---
const auth = firebase.auth();

document.addEventListener('DOMContentLoaded', async () => {
    loadTheme();
    const urlParams = new URLSearchParams(window.location.search);
    const studentViewId = urlParams.get('student');
    const managerUid = urlParams.get('manager');

    if (studentViewId && managerUid) {
        document.getElementById('loginOverlay').style.display = 'none';
        handleStudentPortalLogin(studentViewId, managerUid);
        return; 
    }
    
    auth.onAuthStateChanged(async (user) => {
        const loginOverlay = document.getElementById('loginOverlay');
        const userDisplay = document.getElementById('currentUserDisplay');

        if (user) {
            console.log("Logged in:", user.email);
            if(userDisplay) userDisplay.textContent = `User: ${user.email}`;
            
            loginOverlay.style.display = 'none';
            DOC_ID = user.uid; 

            await syncOldDataToFirebase();
            await loadInstituteLogo();
            await loadAuthSignature();

            secureAction(() => { 
                initApp(); 
                startClock(); 
            }, true);
        } else {
            console.log("No user.");
            loginOverlay.style.display = 'flex';
            document.getElementById('securityOverlay').style.display = 'none';
        }
    });
});

async function initApp() { 
    const now = new Date();
    document.getElementById('attendanceDate').valueAsDate = now;
    document.getElementById('attendanceTime').value = now.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'});
    
    const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`; 
    const prevDate = new Date(now);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;

    document.getElementById('feeMonth').value = currentMonthStr; 
    document.getElementById('reportMonth').value = currentMonthStr; 
    document.getElementById('reportYear').value = now.getFullYear(); 
    document.getElementById('idCardIssueDate').valueAsDate = now; 
    document.getElementById('analyticsYear').value = now.getFullYear(); 
    document.getElementById('compMonth1').value = prevMonthStr;
    document.getElementById('compMonth2').value = currentMonthStr;

    toggleReportInputs(); 

    try {
        let loadedStudents = await loadStudentsFromSubCollection();

        if (loadedStudents.length === 0) {
            const legacyStudents = await dbGet('students');
            if (legacyStudents && Array.isArray(legacyStudents) && legacyStudents.length > 0) {
                console.log("Found legacy data, migrating...");
                loadedStudents = legacyStudents.map(migrateStudentData);
                loadedStudents.forEach(st => {
                     db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(st.id)).set(st);
                });
            }
        }

        const [aData, fData, rData, scData, gmData] = await Promise.all([
            dbGet('attendance'), dbGet('fees'), dbGet('reminders'),
            dbGet('studentSerialCounter'), dbGet('globalMaterials')
        ]);

        students = loadedStudents || []; 
        attendance = aData || {}; 
        fees = fData || {}; 
        reminders = rData || []; 
        globalMaterials = gmData || [];
        studentSerialCounter = parseInt(scData) || (students.length > 0 ? students.length + 1 : 1); 
        
        loadAllData(); 
    } catch(e) {
        console.error("Init Error:", e);
        if(!students) students = [];
        if(!attendance) attendance = {};
    }

    document.getElementById('attendanceDate').addEventListener('change', renderAttendance); 
    document.getElementById('feeMonth').addEventListener('change', renderFees); 
    
    comparePeriods(); 
    updateYearlyChart();
}

function loadAllData() { 
    renderDashboard(); 
    loadStudentsList(); 
    renderAttendance(); 
    renderFees(); 
    renderReminders(); 
}

// --- 7. Login & UI Core Functions ---
function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('loginError');

    if (!email || !password) {
        errorMsg.textContent = "Email and password required!";
        errorMsg.style.display = 'block';
        return;
    }

    const loginBtn = document.querySelector('#loginOverlay button');
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';

    auth.signInWithEmailAndPassword(email, password)
        .catch((error) => {
            console.error(error);
            errorMsg.textContent = "Error: " + error.message;
            errorMsg.style.display = 'block';
            loginBtn.innerHTML = originalText;
        });
}

function handleLogout() {
    Swal.fire({
        title: 'Logout?', text: "You need internet to login again.",
        icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#d33', confirmButtonText: 'Yes, Logout'
    }).then((result) => {
        if (result.isConfirmed) auth.signOut().then(() => window.location.reload());
    });
}

function toggleTheme() {
    const body = document.body;
    const newTheme = body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('app_theme', newTheme);
    updateThemeButton(newTheme);
}

function loadTheme() {
    const t = localStorage.getItem('app_theme') || 'light';
    document.body.setAttribute('data-theme', t);
    updateThemeButton(t);
}

function updateThemeButton(theme) {
    const btn = document.getElementById('themeToggleBtn');
    if(btn) btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i> Switch to Light Mode' : '<i class="fas fa-moon"></i> Switch to Dark Mode';
}

function openTab(tabName) { 
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active')); 
    document.querySelectorAll('.nav-item').forEach(button => button.classList.remove('active')); 
    document.getElementById(tabName).classList.add('active'); 
    const navBtns = document.querySelectorAll('.nav-item'); 
    navBtns.forEach(btn => { if(btn.getAttribute('onclick').includes(tabName)) btn.classList.add('active'); }); 
    if(tabName === 'dashboard') renderDashboard(); 
    if(tabName === 'analytics') updateYearlyChart(); 
    if(tabName === 'studentMgmt') { loadStudentsList(); currentStudentSignature = null; document.getElementById('signatureStatus').style.display = 'none'; }
    if(tabName === 'attendance') {
        const now = new Date();
        document.getElementById('attendanceTime').value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        renderAttendance();
    }
    if(tabName === 'fees') renderFees();
    if(tabName === 'reminders') { renderReminders(); renderGlobalMaterials(); }
}

function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }

// --- 8. Security & PIN ---
function secureAction(callback, isInit = false) { pendingAction = callback; pinInput = ""; updatePinDots(); document.querySelector('.close-pin').style.display = isInit ? 'none' : 'block'; document.getElementById('securityOverlay').style.display = 'flex'; }
function closePinScreen() { if (!students || students.length === 0) return; document.getElementById('securityOverlay').style.display = 'none'; pendingAction = null; pinInput = ""; }
function pressPin(key) { if (key === 'C') pinInput = ""; else if (pinInput.length < 4) pinInput += key; updatePinDots(); }
function updatePinDots() { document.querySelectorAll('.pin-dot').forEach((dot, index) => { index < pinInput.length ? dot.classList.add('filled') : dot.classList.remove('filled'); }); }

async function submitPin() {
    let currentPin = localStorage.getItem('app_pin') || await dbGet('app_pin') || '1234';
    if (pinInput === currentPin) {
        document.getElementById('securityOverlay').style.display = 'none';
        if (pendingAction) pendingAction();
        pendingAction = null; pinInput = "";
    } else {
        pinInput = ""; updatePinDots(); 
        if (navigator.vibrate) navigator.vibrate(200);
        Swal.fire({ icon: 'error', title: 'Incorrect PIN', toast: true, position: 'top', showConfirmButton: false, timer: 2000, background: '#ffe4e6', color: '#dc2626', customClass: { popup: 'high-z-index-popup' } });
    }
}

async function changeAppPin() { 
    const newPin = document.getElementById('newAppPin').value; 
    if (newPin.length === 4 && !isNaN(newPin)) { 
        await dbSet('app_pin', newPin); 
        localStorage.setItem('app_pin', newPin);
        Swal.fire('Success', 'PIN changed successfully.', 'success'); 
        document.getElementById('newAppPin').value = ''; 
    } else { Swal.fire('Error', 'PIN must be 4 digits.', 'error'); } 
}

// --- 9. Database Helpers ---
function sanitizeData(obj) {
    if (obj === undefined) return null;
    return JSON.parse(JSON.stringify(obj, (k, v) => v === undefined ? null : v));
}

async function dbSet(key, value) {
    try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error("User not logged in.");
        const docRef = db.collection(COLLECTION_NAME).doc(user.uid);
        await docRef.set({ [key]: sanitizeData(value) }, { merge: true });
    } catch (error) { console.error(`❌ Save Error (${key}):`, error); throw new Error(`Failed to save ${key}`); }
}

async function saveData() { 
    await dbSet('attendance', attendance); 
    await dbSet('fees', fees); 
    await dbSet('reminders', reminders);
    await dbSet('globalMaterials', globalMaterials); 
    await dbSet('studentSerialCounter', studentSerialCounter); 
}

async function loadStudentsFromSubCollection() {
    try {
        const snapshot = await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').get();
        if (snapshot.empty) return [];
        return snapshot.docs.map(doc => doc.data());
    } catch (error) { return []; }
}

function migrateStudentData(student) { 
    if (!student.status) student.status = { isActive: true, history: [] }; 
    if (student.status && !student.status.history) { const oldNote = student.status.note || 'Legacy data'; const oldDate = student.status.isActive ? (student.status.last_active_date || student.joining_date) : (student.status.last_inactive_date || student.joining_date); student.status.history = [{ status: student.status.isActive ? 'Active' : 'Inactive', date: oldDate, note: oldNote }]; } 
    if (student.fee_amount === undefined) student.fee_amount = DEFAULT_FEE; 
    if (!student.photo) student.photo = null; 
    if (!student.dob) student.dob = null; 
    if (!student.student_signature) student.student_signature = null; 
    return student; 
}

// --- 10. Core Application Features ---

/* Photo & Settings */
function openPhotoSourceModal(context) { photoSelectionContext = context; document.getElementById('photoSourceModal').style.display = 'flex'; }
function triggerCamera() { closeModal('photoSourceModal'); document.getElementById(photoSelectionContext === 'add' ? 'addStudentCamera' : 'editStudentCamera').click(); }
function triggerGallery() { closeModal('photoSourceModal'); document.getElementById(photoSelectionContext === 'add' ? 'addStudentGallery' : 'editStudentGallery').click(); }

function handlePhotoSelection(input, context) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const scaleSize = 120 / img.width;
                canvas.width = 120; canvas.height = img.height * scaleSize;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const base64 = canvas.toDataURL('image/jpeg', 0.4); 
                if (context === 'add') {
                    currentPhotoBase64 = base64;
                    document.getElementById('photoPreview').src = base64; document.getElementById('photoPreview').style.display = 'block'; document.getElementById('photoPlaceholder').style.display = 'none';
                } else {
                    currentEditPhotoBase64 = base64;
                    document.getElementById('editPhotoPreview').src = base64;
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}
function removeEditPhoto() { document.getElementById('editPhotoPreview').src = 'https://via.placeholder.com/100?text=No+Photo'; currentEditPhotoBase64 = null; isPhotoDeletedInEdit = true; }

async function saveInstituteLogo(input) { const file = input.files[0]; if (file) { const reader = new FileReader(); reader.onload = function(e) { const img = new Image(); img.onload = async function() { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const scaleSize = 200 / img.width; canvas.width = 200; canvas.height = img.height * scaleSize; ctx.drawImage(img, 0, 0, canvas.width, canvas.height); const logoBase64 = canvas.toDataURL('image/jpeg', 0.8); await dbSet('instituteLogo', logoBase64); await loadInstituteLogo(); Swal.fire('Success', 'Logo saved!', 'success'); }; img.src = e.target.result; }; reader.readAsDataURL(file); } }
async function loadInstituteLogo() { instituteLogo = await dbGet('instituteLogo'); const img = document.getElementById('logoPreview'); const headerLogo = document.getElementById('headerLogo'); const btn = document.getElementById('removeLogoBtn'); if (instituteLogo) { img.src = instituteLogo; img.style.display = 'block'; btn.style.display = 'inline-block'; headerLogo.src = instituteLogo; headerLogo.style.display = 'block'; } else { img.style.display = 'none'; btn.style.display = 'none'; headerLogo.style.display = 'none'; } }
async function removeLogo() { await dbDelete('instituteLogo'); instituteLogo = null; await loadInstituteLogo(); }

async function saveAuthSignature(input) { const file = input.files[0]; if (file) { const reader = new FileReader(); reader.onload = function(e) { const img = new Image(); img.onload = async function() { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const scaleSize = 150 / img.width; canvas.width = 150; canvas.height = img.height * scaleSize; ctx.drawImage(img, 0, 0, canvas.width, canvas.height); const sigBase64 = canvas.toDataURL('image/png'); await dbSet('authorizedSignature', sigBase64); await loadAuthSignature(); Swal.fire('Success', 'Signature saved!', 'success'); }; img.src = e.target.result; }; reader.readAsDataURL(file); } }
async function loadAuthSignature() { authorizedSignature = await dbGet('authorizedSignature'); const img = document.getElementById('authSigPreview'); const btn = document.getElementById('removeAuthSigBtn'); if (authorizedSignature) { img.src = authorizedSignature; img.style.display = 'block'; btn.style.display = 'inline-block'; } else { img.style.display = 'none'; btn.style.display = 'none'; } }
async function removeAuthSignature() { await dbDelete('authorizedSignature'); authorizedSignature = null; await loadAuthSignature(); }

/* Signature Pad Logic */
function openSignatureModal() {
    document.getElementById('signatureModal').style.display = 'flex';
    const canvas = document.getElementById('sigCanvas'); const wrapper = document.getElementById('sigWrapper');
    canvas.width = wrapper.clientWidth - 40; canvas.height = wrapper.clientHeight - 40;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = "#000"; ctx.lineWidth = 3; ctx.lineCap = "round";
    sigRotation = 0; document.querySelector('.sig-canvas-box').style.transform = `rotate(0deg)`;
    canvas.addEventListener('mousedown', startDraw); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('touchstart', startDraw, {passive: false}); canvas.addEventListener('touchmove', draw, {passive: false}); canvas.addEventListener('touchend', stopDraw);
}
function closeSignatureModal() { document.getElementById('signatureModal').style.display = 'none'; }
function startDraw(e) { isDrawing = true; draw(e); e.preventDefault(); }
function draw(e) {
    if (!isDrawing) return;
    const canvas = document.getElementById('sigCanvas'); const ctx = canvas.getContext('2d'); const rect = canvas.getBoundingClientRect();
    let x, y; if (e.type.includes('touch')) { x = e.touches[0].clientX - rect.left; y = e.touches[0].clientY - rect.top; } else { x = e.clientX - rect.left; y = e.clientY - rect.top; }
    ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y); e.preventDefault();
}
function stopDraw() { isDrawing = false; document.getElementById('sigCanvas').getContext('2d').beginPath(); }
function clearSignature() { const canvas = document.getElementById('sigCanvas'); const ctx = canvas.getContext('2d'); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
function saveSignature() { currentStudentSignature = document.getElementById('sigCanvas').toDataURL('image/png'); document.getElementById('signatureStatus').style.display = 'block'; closeSignatureModal(); Swal.fire('Saved', 'Signature captured successfully.', 'success'); }

/* Helper Functions */
function formatTime12H(timeStr) { if(!timeStr) return ''; const [h, m] = timeStr.split(':'); return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`; }
function calculateAge(dob) {
    if(!dob) return ""; const birthDate = new Date(dob); const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear(), months = today.getMonth() - birthDate.getMonth(), days = today.getDate() - birthDate.getDate();
    if (days < 0) { months--; days += new Date(today.getFullYear(), today.getMonth(), 0).getDate(); }
    if (months < 0) { years--; months += 12; }
    return `${years} Yrs, ${months} Mths, ${days} Days`;
}
function checkBirthday(dobString) { if (!dobString) return false; const today = new Date(), dob = new Date(dobString); return today.getDate() === dob.getDate() && today.getMonth() === dob.getMonth(); }
function isMonthDue(monthStr) { const now = new Date(); now.setHours(0,0,0,0); const [year, month] = monthStr.split('-').map(Number); const firstDayOfMonth = new Date(year, month - 1, 1); if (firstDayOfMonth > now) return false; const currentYear = now.getFullYear(), currentMonthIndex = now.getMonth(), currentDay = now.getDate(); if (year < currentYear) return true; if (year === currentYear && month - 1 < currentMonthIndex) return true; return year === currentYear && month - 1 === currentMonthIndex && currentDay > DUE_DATE; }
function formatMonthYear(monthStr) { return new Date(monthStr.split('-')[0], monthStr.split('-')[1] - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }); }
function getStudentHtml(student) { 
    return `
    <div class="student-cell">
        <img src="${student.photo || 'https://via.placeholder.com/40?text=S'}" class="student-thumb" loading="lazy">
        <div class="student-info">
            <span class="student-name-link" onclick="showStudentDetails(${student.id})">${student.name}</span>
            ${student.phone ? `<span class="student-phone-sub">${student.phone}</span>` : ''}
            ${student.class_day ? `<span class="student-time-sub">${student.class_day} ${student.class_time ? formatTime12H(student.class_time) : ''}</span>` : ''}
            <span style="display:none;">${student.address || ''}</span>
        </div>
    </div>`; 
}

function searchTable(inputId, tableId) { const filter = document.getElementById(inputId).value.toUpperCase(), tr = document.getElementById(tableId).getElementsByTagName("tr"); for (let i = 1; i < tr.length; i++) tr[i].style.display = (tr[i].textContent || tr[i].innerText).toUpperCase().indexOf(filter) > -1 ? "" : "none"; }

/* Student Management Core */
async function addStudent() { 
    const name = document.getElementById('studentName').value.trim(); 
    if (!name) { Swal.fire('Error', 'Name is required.', 'error'); return; } 

    const fee = parseFloat(document.getElementById('studentFee').value) || DEFAULT_FEE; 
    const time = document.getElementById('studentTime').value;
    
    const detailsHtml = `
        <div style="text-align: center;">${currentPhotoBase64 ? `<img src="${currentPhotoBase64}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #000; margin-bottom: 10px;">` : `<div style="width: 80px; height: 80px; border-radius: 50%; background: #eee; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px auto; border: 1px solid #ccc;">No Photo</div>`}</div>
        <div style="text-align: left; font-size: 14px; line-height: 1.6; background: var(--bg-input); padding: 15px; border-radius: 8px;">
            <div><strong>Name:</strong> ${name}</div>
            <div><strong>Class:</strong> ${document.getElementById('studentClass').value || '-'}</div>
            <div><strong>Time:</strong> ${document.getElementById('studentDay').value || ''} ${time ? formatTime12H(time) : ''}</div>
            <div><strong>Fee:</strong> ₹${fee}</div>
            <div><strong>Phone:</strong> ${document.getElementById('phone').value || '-'}</div>
        </div>
    `;

    const result = await Swal.fire({ title: 'Check Details', html: detailsHtml, icon: 'question', showCancelButton: true, confirmButtonText: 'Confirm & Save', cancelButtonText: 'Edit / Cancel', confirmButtonColor: 'var(--success)', cancelButtonColor: 'var(--danger)', allowOutsideClick: false });

    if (result.isConfirmed) {
        const newStudent = { 
            id: Date.now(), serial_no: studentSerialCounter++, name, 
            class: document.getElementById('studentClass').value, class_day: document.getElementById('studentDay').value, class_time: time, 
            fee_amount: fee, email: document.getElementById('studentEmail').value, guardian: document.getElementById('guardianName').value, 
            phone: document.getElementById('phone').value, address: document.getElementById('address').value, dob: document.getElementById('studentDOB').value, 
            photo: currentPhotoBase64, student_signature: currentStudentSignature, joining_date: new Date().toISOString().split('T')[0], 
            status: { isActive: true, history: [{ status: 'Active', date: new Date().toISOString().split('T')[0], note: 'Joined' }] } 
        }; 

        students.push(newStudent); 
        await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(newStudent.id)).set(newStudent);
        await dbSet('studentSerialCounter', studentSerialCounter);
        
        ['studentName','studentClass','studentFee','studentEmail','guardianName','phone','address','studentDOB','studentDay','studentTime'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('photoPreview').style.display = 'none'; document.getElementById('photoPlaceholder').style.display = 'block'; 
        currentPhotoBase64 = null; currentStudentSignature = null; document.getElementById('signatureStatus').style.display = 'none';
        
        loadAllData(); 
        
        Swal.fire({
            title: 'Student Added!',
            html: `
                <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin-top:15px;">
                    <button class="btn-whatsapp btn-like" onclick="sendWelcomeMsg('wa', ${newStudent.id})"><i class="fab fa-whatsapp"></i> WhatsApp</button>
                    <button class="btn-sms btn-like" onclick="sendWelcomeMsg('sms', ${newStudent.id})"><i class="fas fa-sms"></i> SMS</button>
                </div>
                <div style="margin-top:15px;">
                    <button class="btn-welcome btn-like" onclick="generateWelcomeNote(${newStudent.id})" style="width:100%;"><i class="fas fa-file-pdf"></i> Generate Bangla Welcome Note</button>
                </div>
            `,
            icon: 'success', showConfirmButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Done / Close', allowOutsideClick: false 
        });
    } 
}

function openEditStudentModal(id) { 
    const student = students.find(s => s.id === parseInt(id)); 
    if(!student) return; 
    isPhotoDeletedInEdit = false;
    document.getElementById('editStudentId').value = student.id; 
    document.getElementById('editStudentName').value = student.name || ''; 
    document.getElementById('editStudentClass').value = student.class || ''; 
    document.getElementById('editStudentDay').value = student.class_day || ''; 
    document.getElementById('editStudentTime').value = student.class_time || ''; 
    document.getElementById('editStudentFee').value = student.fee_amount || ''; 
    document.getElementById('editPhone').value = student.phone || ''; 
    document.getElementById('editGuardianName').value = student.guardian || ''; 
    document.getElementById('editStudentEmail').value = student.email || ''; 
    document.getElementById('editAddress').value = student.address || ''; 
    document.getElementById('editStudentDOB').value = student.dob || ""; 
    document.getElementById('editAllowProfile').checked = student.allow_profile_view !== false;
    currentEditPhotoBase64 = null; 
    document.getElementById('editPhotoPreview').src = student.photo ? student.photo : 'https://via.placeholder.com/100?text=No+Photo'; 
    document.getElementById('editStudentModal').style.display = 'flex'; 
}

async function saveStudentChanges() { 
    const id = parseInt(document.getElementById('editStudentId').value);
    const studentIndex = students.findIndex(s => s.id === id);
    if (studentIndex === -1) return;
    
    const student = students[studentIndex];
    student.name = document.getElementById('editStudentName').value.trim(); 
    if(!student.name) { Swal.fire('Error','Name required.', 'error'); return; } 

    student.class = document.getElementById('editStudentClass').value;
    student.class_day = document.getElementById('editStudentDay').value;
    student.class_time = document.getElementById('editStudentTime').value;
    student.fee_amount = parseFloat(document.getElementById('editStudentFee').value);
    student.phone = document.getElementById('editPhone').value;
    student.guardian = document.getElementById('editGuardianName').value;
    student.email = document.getElementById('editStudentEmail').value;
    student.address = document.getElementById('editAddress').value;
    student.dob = document.getElementById('editStudentDOB').value;
    student.allow_profile_view = document.getElementById('editAllowProfile').checked;
    
    if(currentEditPhotoBase64) student.photo = currentEditPhotoBase64; 
    else if (isPhotoDeletedInEdit) student.photo = null; 
    if(currentStudentSignature) student.student_signature = currentStudentSignature;

    students[studentIndex] = student;
    await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(id)).set(student);
    closeModal('editStudentModal'); loadAllData(); Swal.fire('Saved', 'Details updated successfully.', 'success'); 
}

function switchStudentView(view) {
    currentStudentView = view;
    const activeBtn = document.getElementById('btnShowActive'), inactiveBtn = document.getElementById('btnShowInactive');
    const activeDiv = document.getElementById('activeStudentsContainer'), inactiveDiv = document.getElementById('inactiveStudentsContainer');

    if (view === 'active') {
        activeBtn.style.background = 'var(--primary)'; activeBtn.style.color = 'white'; inactiveBtn.style.background = 'transparent'; inactiveBtn.style.color = 'var(--text-muted)';
        activeDiv.style.display = 'block'; inactiveDiv.style.display = 'none';
    } else {
        activeBtn.style.background = 'transparent'; activeBtn.style.color = 'var(--text-muted)'; inactiveBtn.style.background = 'var(--secondary)'; inactiveBtn.style.color = 'white';
        activeDiv.style.display = 'none'; inactiveDiv.style.display = 'block';
    }
}

function loadStudentsList(showAll = false) { 
    const activeList = document.getElementById('activeStudentsList'), inactiveList = document.getElementById('inactiveStudentsList');
    activeList.innerHTML = ''; inactiveList.innerHTML = '';
    let activeCount = 0, inactiveCount = 0;

    students.forEach(student => { 
        const isActive = student.status?.isActive;
        if (!showAll && ((isActive && activeCount >= studentDisplayLimit) || (!isActive && inactiveCount >= studentDisplayLimit))) return;

        const rowClass = !isActive ? 'inactive-student' : (checkGlobalDues(student.id) ? 'has-dues-alert' : ''); 
        const timeDisplay = student.class_time ? formatTime12H(student.class_time) : ''; 
        const row = document.createElement('tr'); if (rowClass) row.className = rowClass;
        
        row.innerHTML = `
            <td>${student.serial_no}</td><td>${getStudentHtml(student)}</td>
            <td>${student.class || 'N/A'}${student.class_day || student.class_time ? `<br><span class="student-time-sub">${student.class_day || ''} ${timeDisplay}</span>` : ''}</td>
            <td>₹${student.fee_amount || DEFAULT_FEE}</td><td style="min-width: 160px;">${getAllContactButtons(student)}</td>
            <td>${isActive ? 'Active' : 'Inactive'}</td>
            <td class="action-buttons">
                <button class="${isActive ? 'btn-info' : 'btn-success'}" onclick="openStatusChangeModal(${student.id}, ${!isActive})">${isActive ? 'Deactivate' : 'Activate'}</button> 
                <button class="btn-warning" onclick="openEditStudentModal(${student.id})">Edit</button>
            </td>`;
        
        if(isActive) { activeList.appendChild(row); activeCount++; } else { inactiveList.appendChild(row); inactiveCount++; }
    }); 

    if (!showAll) {
        if (students.filter(s => s.status?.isActive).length > studentDisplayLimit) activeList.innerHTML += `<tr><td colspan="7" style="text-align:center; padding:15px;"><button class="btn-secondary" onclick="studentDisplayLimit += 20; loadStudentsList();" style="width:100%; border-radius:8px;"><i class="fas fa-chevron-down"></i> Load More Students</button></td></tr>`;
        if (students.filter(s => !s.status?.isActive).length > studentDisplayLimit) inactiveList.innerHTML += `<tr><td colspan="7" style="text-align:center; padding:15px;"><button class="btn-secondary" onclick="studentDisplayLimit += 20; loadStudentsList();" style="width:100%; border-radius:8px;"><i class="fas fa-chevron-down"></i> Load More Students</button></td></tr>`;
    }
}

function filterStudentLists() {
    const filter = document.getElementById('searchStudents').value.toUpperCase();
    if (filter.length > 0) loadStudentsList(true); else { studentDisplayLimit = 20; loadStudentsList(false); }
    searchTable('searchStudents', 'activeStudentsTable'); searchTable('searchStudents', 'inactiveStudentsTable');
    if (filter.length > 0) { document.getElementById('activeStudentsContainer').style.display = 'block'; document.getElementById('inactiveStudentsContainer').style.display = 'block'; } 
    else switchStudentView(currentStudentView);
}

function openStatusChangeModal(id, toActive) { document.getElementById('statusChangeStudentId').value = id; document.getElementById('statusChangeToActive').value = toActive; document.getElementById('statusChangeTitle').textContent = toActive ? 'Activate Student' : 'Deactivate Student'; document.getElementById('statusDate').valueAsDate = new Date(); document.getElementById('statusNote').value = ''; document.getElementById('statusChangeModal').style.display = 'flex'; }
async function saveStatusChange() { 
    const id = parseInt(document.getElementById('statusChangeStudentId').value), toActive = document.getElementById('statusChangeToActive').value === 'true', statusDate = document.getElementById('statusDate').value; 
    if (!statusDate) { Swal.fire('Error', 'Please select a date.', 'error'); return; } 
    const student = students.find(s => s.id === id); 
    if (student) { 
        student.status.isActive = toActive; student.status.history.unshift({ status: toActive ? 'Active' : 'Inactive', date: statusDate, note: document.getElementById('statusNote').value.trim() || (toActive ? 'Re-activated' : 'Deactivated') }); 
        await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(id)).update({ status: student.status });
        await saveData(); loadAllData(); closeModal('statusChangeModal'); Swal.fire('Updated', `Status changed.`, 'success'); 
    } 
}        

/* Student Details & History */
function showStudentDetails(studentId) { 
    const student = students.find(s => s.id === studentId); if (!student) return; 
    currentlyViewingStudentId = studentId;
    document.getElementById('modalStudentName').textContent = student.name; 
    document.getElementById('modalSerialNo').textContent = student.serial_no; 
    document.getElementById('modalClass').innerHTML = `<span style="display: inline-block; background: #000000; color: #ffffff; padding: 5px 15px; border-radius: 20px; font-size: 13px; font-weight: 500; margin-top: 5px;">🎵 ${student.class || 'Music Class'}</span>`;
    document.getElementById('modalDayTime').textContent = (student.class_day || '') + " " + (student.class_time ? formatTime12H(student.class_time) : ''); 
    document.getElementById('modalFeeAmount').textContent = `₹${student.fee_amount || DEFAULT_FEE}`; 
    document.getElementById('modalGuardianName').textContent = student.guardian || 'N/A'; 
    document.getElementById('modalPhone').innerHTML = student.phone || 'N/A'; 
    document.getElementById('modalEmail').innerHTML = student.email || 'N/A'; 
    document.getElementById('modalAddress').textContent = student.address || 'N/A'; 
    document.getElementById('currentNoticeDisplay').innerHTML = student.personal_notice ? `Current Notice: <span>${student.personal_notice}</span>` : 'No active notice.';
    document.getElementById('personalNoticeInput').value = student.personal_notice || '';
    document.getElementById('modalDOB').innerHTML = student.dob ? `${new Date(student.dob).toLocaleDateString('en-IN')} <br><span style="font-size:11px; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">(Age: ${calculateAge(student.dob)})</span>` : 'N/A'; 
    document.getElementById('modalJoiningDate').textContent = new Date(student.joining_date).toLocaleDateString('en-IN'); 
    document.getElementById('modalStudentPhoto').src = student.photo ? student.photo : 'https://via.placeholder.com/100?text=No+Photo'; 

    const viewSigBtn = document.getElementById('btnViewSignature');
    if (viewSigBtn) {
        viewSigBtn.onclick = function() {
            if (student.student_signature) Swal.fire({ title: 'Digital Signature', text: student.name, imageUrl: student.student_signature, imageWidth: 300, confirmButtonText: 'Close' });
            else Swal.fire({ title: 'No Signature Found', icon: 'warning', confirmButtonText: 'Okay' });
        };
    }
    
    const historyList = document.getElementById('modalStatusHistory'); historyList.innerHTML = ''; 
    if (student.status.history && student.status.history.length > 0) student.status.history.forEach(entry => { historyList.innerHTML += `<li><strong style="color:${entry.status === 'Active' ? 'green' : 'red'};">${entry.status}</strong> on ${new Date(entry.date).toLocaleDateString('en-IN')}<br><em style="font-size:0.9em;color:var(--text-muted);">Note: ${entry.note || 'No note'}</em></li>`; }); 
    else historyList.innerHTML = '<li>No history found.</li>'; 
    
    const yearSelect = document.getElementById('detailsFilterYear'), monthSelect = document.getElementById('detailsFilterMonth'); yearSelect.innerHTML = ''; monthSelect.innerHTML = '';
    const currentYear = new Date().getFullYear(); const joinYear = new Date(student.joining_date).getFullYear();
    for(let y = currentYear; y >= joinYear; y--) { const opt = document.createElement('option'); opt.value = y; opt.text = y; yearSelect.appendChild(opt); }
    ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].forEach((m, idx) => { const opt = document.createElement('option'); opt.value = idx + 1; opt.text = m; if(idx === new Date().getMonth()) opt.selected = true; monthSelect.appendChild(opt); });
    
    renderStudentDetailsHistory();
    document.getElementById('exportPdfBtn').onclick = () => exportStudentDetailsAsPDF(studentId); 
    renderStudentNotes(studentId);
    renderStudyMaterials(studentId); 
    document.getElementById('studentDetailsModal').style.display = 'flex'; 
}

function renderStudentDetailsHistory() {
    if(!currentlyViewingStudentId) return;
    const student = students.find(s => s.id === currentlyViewingStudentId); if(!student) return;
    const selectedYear = parseInt(document.getElementById('detailsFilterYear').value), selectedMonth = parseInt(document.getElementById('detailsFilterMonth').value);
    const presentList = document.getElementById('modalPresentList'), absentList = document.getElementById('modalAbsentList'); presentList.innerHTML = absentList.innerHTML = ''; 
    
    Object.keys(attendance).sort().reverse().forEach(date => { 
        const d = new Date(date);
        if(d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth) {
            const entry = attendance[date]?.[student.id];
            if(entry) {
                const status = (typeof entry === 'object' && entry !== null) ? entry.status : entry;
                const timeStr = (typeof entry === 'object' && entry !== null && entry.time) ? ` (${formatTime12H(entry.time)})` : '';
                const formattedDate = `${d.toLocaleDateString('en-IN')} (${d.toLocaleDateString('en-IN', { weekday: 'short' })})${timeStr}`;
                if (status === 'present') presentList.innerHTML += `<li style="padding:2px 0; border-bottom:1px solid #f9f9f9;">${formattedDate}</li>`; 
                else if (status === 'absent') absentList.innerHTML += `<li style="padding:2px 0; border-bottom:1px solid #f9f9f9;">${formattedDate}</li>`;
            }
        }
    }); 
    if(!presentList.innerHTML) presentList.innerHTML = '<li>No records found</li>'; 
    if(!absentList.innerHTML) absentList.innerHTML = '<li>No records found</li>'; 
    
    const paidList = document.getElementById('modalPaidList'); paidList.innerHTML = ''; 
    for (let i = 1; i <= 12; i++) {
        const monthStr = `${selectedYear}-${i.toString().padStart(2, '0')}`;
        const monthName = new Date(selectedYear, i - 1).toLocaleString('default', { month: 'short' });
        let content = '', style = 'padding: 8px 0; border-bottom: 1px solid #eee; font-size: 12px; display: flex; justify-content: space-between; align-items: flex-start;';

        if(wasStudentActiveDuringMonth(student, monthStr)) {
             const feeRecord = fees[monthStr]?.[student.id]; 
             if (feeRecord?.status === 'paid') { 
                 content = `<div style="flex:1;"><strong>${monthName}:</strong> <span style="color:var(--success);">Paid ₹${feeRecord.amount}</span>${feeRecord.mode ? ` <span style="color:#666; font-size:11px;">(${feeRecord.mode})</span>` : ''}${feeRecord.transactionId ? `<div style="font-size:10px; color:#4f46e5; margin-top:2px;">Txn: ${feeRecord.transactionId}</div>` : ''}</div><div style="font-size:10px; color:gray; text-align:right;">${new Date(feeRecord.date).toLocaleDateString('en-IN')}</div>`;
             } else if (isMonthDue(monthStr)) { 
                 content = `<span><strong>${monthName}:</strong> <span style="color:var(--danger); font-weight:bold;">Due</span></span>`; style += ' background-color: rgba(239, 68, 68, 0.05);'; 
             } else { 
                 content = new Date(selectedYear, i, 0) > new Date() ? `<span style="color:gray;">${monthName}: Upcoming</span>` : `<span>${monthName}: Pending/Not Due</span>`;
             }
        } else content = `<span style="color:#ccc;">${monthName}: Inactive</span>`;
        paidList.innerHTML += `<li style="${style}">${content}</li>`;
    }
}

/* Fees Management */
function getOldestUnpaidMonth(studentId, selectedMonthStr) {
    const s = students.find(x => x.id === studentId); if (!s) return selectedMonthStr;
    let iterDate = new Date(s.joining_date); if(isNaN(iterDate.getTime())) return selectedMonthStr;
    iterDate.setDate(1); const targetDate = new Date(selectedMonthStr + '-01');
    while (iterDate <= targetDate) {
        const monthStr = `${iterDate.getFullYear()}-${(iterDate.getMonth() + 1).toString().padStart(2, '0')}`;
        if (wasStudentActiveDuringMonth(s, monthStr) && fees[monthStr]?.[studentId]?.status !== 'paid') return monthStr; 
        iterDate.setMonth(iterDate.getMonth() + 1);
    }
    return selectedMonthStr; 
}

function getDueMonthsRawList(studentId) {
    const s = students.find(x => x.id === studentId); if (!s) return []; 
    const dueMonthsRaw = [], now = new Date(); let iterDate = new Date(s.joining_date);
    if(isNaN(iterDate.getTime())) return []; iterDate.setDate(1);
    while (iterDate <= now) { 
        const monthStr = `${iterDate.getFullYear()}-${(iterDate.getMonth() + 1).toString().padStart(2, '0')}`; 
        if (wasStudentActiveDuringMonth(s, monthStr) && isMonthDue(monthStr) && fees[monthStr]?.[studentId]?.status !== 'paid') dueMonthsRaw.push(monthStr); 
        iterDate.setMonth(iterDate.getMonth() + 1); 
    } 
    return dueMonthsRaw; 
}

function updateFeeAmountBasedOnType() {
    const select = document.getElementById('payTypeSelect');
    document.getElementById('feeAmount').value = select.value === 'all' ? select.dataset.allAmount : select.dataset.singleAmount;
    document.getElementById('feeModalTitle').textContent = select.value === 'all' ? `Record Fee (All Pending Dues)` : `Record Fee (${formatMonthYear(JSON.parse(select.dataset.dues || '[]')[0])})`;
}

function openFeeModal(studentId, month, isEdit = false) { 
    const modal = document.getElementById('feeModal'), amountInput = document.getElementById('feeAmount'), dateInput = document.getElementById('feeDate'), txnInput = document.getElementById('transactionId'), payTypeContainer = document.getElementById('payTypeContainer'), payTypeSelect = document.getElementById('payTypeSelect');
    let targetMonth = month; const student = students.find(s => s.id === studentId); if(!student) return;
    document.getElementById('feeStudentId').value = studentId; 

    if (!isEdit) {
        const dueMonthsRaw = getDueMonthsRawList(studentId);
        if (dueMonthsRaw.length > 1) {
            payTypeContainer.style.display = 'block'; payTypeSelect.value = 'single'; targetMonth = dueMonthsRaw[0]; 
            payTypeSelect.dataset.dues = JSON.stringify(dueMonthsRaw); payTypeSelect.dataset.singleAmount = student.fee_amount || DEFAULT_FEE; payTypeSelect.dataset.allAmount = dueMonthsRaw.length * (student.fee_amount || DEFAULT_FEE);
        } else { payTypeContainer.style.display = 'none'; if(dueMonthsRaw.length === 1) targetMonth = dueMonthsRaw[0]; }
    } else payTypeContainer.style.display = 'none';

    document.getElementById('feeRecordMonth').value = targetMonth; 
    
    if (isEdit) { 
        const record = fees[targetMonth]?.[studentId]; 
        document.getElementById('feeModalTitle').textContent = `Edit Fee (${formatMonthYear(targetMonth)})`; 
        amountInput.value = record ? record.amount : (student.fee_amount || DEFAULT_FEE); txnInput.value = record ? (record.transactionId || '') : ''; 
    } else { 
        document.getElementById('feeModalTitle').textContent = `Record Fee (${formatMonthYear(targetMonth)})`; 
        amountInput.value = payTypeContainer.style.display === 'block' && payTypeSelect.value === 'all' ? payTypeSelect.dataset.allAmount : (student.fee_amount || DEFAULT_FEE); txnInput.value = ''; 
    } 
    dateInput.valueAsDate = new Date(); modal.style.display = 'flex'; 
}

async function saveFee() { 
    const studentId = parseInt(document.getElementById('feeStudentId').value), amount = parseFloat(document.getElementById('feeAmount').value), date = document.getElementById('feeDate').value; 
    if (isNaN(amount) || amount <= 0) { Swal.fire('Error','Invalid amount.', 'error'); return; } 
    if (!date) { Swal.fire('Error','Select date.', 'error'); return; } 
    
    const payTypeContainer = document.getElementById('payTypeContainer'), payTypeSelect = document.getElementById('payTypeSelect');
    let monthsToPay = (payTypeContainer.style.display !== 'none' && payTypeSelect.value === 'all') ? JSON.parse(payTypeSelect.dataset.dues || '[]') : [document.getElementById('feeRecordMonth').value];
    const amountPerMonth = monthsToPay.length > 0 ? (amount / monthsToPay.length) : amount;
    const mode = document.getElementById('paymentMode').value, txnId = document.getElementById('transactionId').value.trim(), receiptNo = Date.now().toString().slice(-6); 

    monthsToPay.forEach(m => { if (!fees[m]) fees[m] = {}; fees[m][studentId] = { status: 'paid', amount: amountPerMonth, date, mode, transactionId: txnId, receiptNo }; });
    await saveData(); closeModal('feeModal'); renderFees();
    
    const joinedMonths = monthsToPay.join(',');
    Swal.fire({ 
        title: 'Payment Recorded!', 
        html: `<p>Payment successful.</p><div style="display:flex; gap:5px; justify-content:center; flex-wrap:wrap;"><button class="btn-like btn-receipt" onclick="generatePaymentReceipt(${studentId}, '${joinedMonths}')">Receipt</button><button class="btn-like btn-whatsapp" onclick="sendMsg('wa', ${studentId}, '${joinedMonths}', ${amount}, false)">WhatsApp</button><button class="btn-like btn-sms" onclick="sendMsg('sms', ${studentId}, '${joinedMonths}', ${amount}, false)">SMS</button></div>`, 
        icon: 'success', showConfirmButton: true, confirmButtonText: 'Close', confirmButtonColor: '#d33', allowOutsideClick: false 
    }); 
    loadAllData(); 
}

function renderFees() { 
    const selectedMonth = document.getElementById('feeMonth').value, tableBody = document.querySelector('#feeTable tbody'); tableBody.innerHTML = ''; if (!selectedMonth) return; 
    let totalCollected = 0, totalDueAmount = 0, dueCount = 0, collectedCount = 0; const monthIsDue = isMonthDue(selectedMonth); 
    
    students.forEach(student => { 
        if (!wasStudentActiveDuringMonth(student, selectedMonth)) return; 
        const feeRecord = fees[selectedMonth]?.[student.id], isPaid = feeRecord?.status === 'paid', hasGlobalDue = checkGlobalDues(student.id); 
        let rowClass = 'pending', statusText = 'Pending'; 
        
        if (isPaid) { totalCollected += feeRecord.amount; collectedCount++; rowClass = 'paid'; statusText = `Paid (₹${feeRecord.amount})`; } 
        else if (monthIsDue) { dueCount++; totalDueAmount += student.fee_amount || DEFAULT_FEE; rowClass = 'unpaid'; statusText = 'Due'; } 
        
        if (hasGlobalDue) rowClass += ' has-dues-alert'; 
        const row = document.createElement('tr'); row.className = rowClass; 
        let actionButtons = isPaid ? `<button class="btn-receipt" onclick="generatePaymentReceipt(${student.id}, '${selectedMonth}')">Receipt</button> <button class="btn-warning" onclick="openFeeModal(${student.id}, '${selectedMonth}', true)">Edit</button><button class="btn-danger" onclick="unmarkFee(${student.id}, '${selectedMonth}')">Unmark</button>` : `<button class="btn-success" onclick="openFeeModal(${student.id}, '${selectedMonth}')">Record Payment</button>` + (monthIsDue ? getContactButtons(student.id, selectedMonth) : ''); 
        row.innerHTML = `<td>${getStudentHtml(student)}</td><td>${statusText}</td><td class="action-buttons">${actionButtons}</td>`; 
        tableBody.appendChild(row); 
    }); 
    
    document.getElementById('feeSummary').innerHTML = `<div onclick="showFeeBreakdown('collected')"><h4>Collected (${collectedCount} students)</h4><p class="summary-collected">₹${totalCollected}</p></div><div onclick="showFeeBreakdown('due')"><h4>Due (${dueCount} students)</h4><p class="summary-due">₹${totalDueAmount}</p></div>`; 
    searchTable('searchFees', 'feeTable'); 
}

async function unmarkFee(studentId, month) { 
    Swal.fire({ title: 'Unmark Payment?', text: "Are you sure you want to delete this payment?", icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, Delete', cancelButtonText: 'No', confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', allowOutsideClick: false }).then(async (result) => { 
        if (result.isConfirmed) {
            if (fees[month] && fees[month][studentId]) delete fees[month][studentId]; 
            renderFees(); 
            const user = firebase.auth().currentUser;
            if (user) db.collection(COLLECTION_NAME).doc(user.uid).update({ [`fees.${month}.${studentId}`]: firebase.firestore.FieldValue.delete() }).catch(err => console.log("Offline mode: Delete queued for sync."));
            Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 }).fire({ icon: 'success', title: 'Payment removed' });
        } 
    }); 
}

/* Attendance Logic */
function renderAttendance() { 
    const dateInput = document.getElementById('attendanceDate').value, tableBody = document.querySelector('#attendanceTable tbody'); tableBody.innerHTML = ''; if (!dateInput) return; 
    const currentDayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(dateInput).getDay()];

    if(!document.getElementById('attendanceTime').value) {
       const now = new Date(); document.getElementById('attendanceTime').value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }

    let totalActive = 0, presentCount = 0, absentCount = 0;
    const activeStudents = students.filter(s => s.status?.isActive).sort((a, b) => {
        const getScore = (student) => {
            const entry = attendance[dateInput]?.[student.id], status = (typeof entry === 'object' && entry !== null) ? entry.status : entry;
            if (status === 'present') return 4; if (status === 'absent') return 3; if (student.class_day === currentDayName) return 2; return 1; 
        };
        return getScore(b) - getScore(a); 
    });

    activeStudents.forEach(student => { 
        totalActive++; 
        const entry = attendance[dateInput]?.[student.id], status = (typeof entry === 'object' && entry !== null) ? entry.status : entry, note = (typeof entry === 'object' && entry?.note) ? entry.note : '';
        if (status === 'present') presentCount++; else if (status === 'absent') absentCount++;

        const row = document.createElement('tr');
        if (student.class_day === currentDayName) row.style.cssText = 'border: 1px solid var(--primary); background: rgba(79, 70, 229, 0.05);';
        if (checkGlobalDues(student.id)) row.classList.add('has-dues-alert'); 
        
        row.innerHTML = `<td>${getStudentHtml(student)}<div style="font-size:11px; color:#d97706; margin-top:2px; margin-left:55px;">${note ? '📝 ' + note : ''}</div></td><td class="${status === 'present' ? 'status-present' : (status === 'absent' ? 'status-absent' : '')}">${status === 'present' ? 'Present' : (status === 'absent' ? 'Absent' : 'Not Marked')}</td><td class="action-buttons"><button class="btn-success" onclick="markAttendance(${student.id}, 'present')">P</button><button class="btn-danger" onclick="markAttendance(${student.id}, 'absent')">A</button><button class="${note ? 'btn-warning' : 'btn-secondary'}" onclick="addAttendanceNote(${student.id})" title="Edit Note"><i class="fas fa-pencil-alt"></i></button><button class="btn-secondary" onclick="markAttendance(${student.id}, 'clear')">X</button></td>`;
        tableBody.appendChild(row);
    }); 

    if(document.getElementById('attTotalCount')) document.getElementById('attTotalCount').textContent = totalActive;
    if(document.getElementById('attPresentCount')) document.getElementById('attPresentCount').textContent = presentCount;
    if(document.getElementById('attAbsentCount')) document.getElementById('attAbsentCount').textContent = absentCount;
    searchTable('searchAttendance', 'attendanceTable'); 
}

function markAttendance(studentId, status) {
    const date = document.getElementById('attendanceDate').value; if (!date) { Swal.fire('Alert','Please select a date.', 'warning'); return; } 
    if (!attendance[date]) attendance[date] = {}; 
    const currentEntry = attendance[date][studentId], existingNote = (typeof currentEntry === 'object' && currentEntry !== null && currentEntry.note) ? currentEntry.note : '';

    if (status === 'clear') { 
        if (existingNote) attendance[date][studentId] = { status: null, time: '', note: existingNote };
        else {
            delete attendance[date][studentId]; 
            const user = firebase.auth().currentUser;
            if(user) db.collection(COLLECTION_NAME).doc(user.uid).update({ [`attendance.${date}.${studentId}`]: firebase.firestore.FieldValue.delete() }).catch(e => console.log("Delete queued for offline sync."));
        }
    } else {
        let timeToSave = document.getElementById('attendanceTime').value; 
        if (!timeToSave) { const now = new Date(); timeToSave = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`; }
        attendance[date][studentId] = { status: status, time: timeToSave, note: existingNote }; 
    }
    renderAttendance(); saveData().catch(err => console.log("Background Sync Pending...")); 
}

async function addAttendanceNote(studentId) {
    const date = document.getElementById('attendanceDate').value; if (!date) { Swal.fire('Alert', 'Please select a date first.', 'warning'); return; }
    const currentEntry = attendance[date]?.[studentId] || {}, existingNote = currentEntry.note || '';

    const { value: text } = await Swal.fire({ title: 'Class Progress Note', input: 'textarea', inputLabel: 'আজ ক্লাসে কি শেখানো হলো?', inputValue: existingNote, placeholder: 'যেমন: C Major Scale শেখানো হয়েছে...', showCancelButton: true, confirmButtonText: 'Save Note', confirmButtonColor: 'var(--primary)', allowOutsideClick: false });

    if (text !== undefined) {
        if (!attendance[date]) attendance[date] = {};
        attendance[date][studentId] = { ...currentEntry, note: text };
        renderAttendance(); saveData().catch(e => console.log("Note saved locally, syncing later."));

        if (text.trim() !== "") {
            const student = students.find(s => s.id === studentId), safeNote = text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            Swal.fire({ title: 'Note Saved!', html: `<p style="font-size:14px; color:#666;">Send to <b>${student.name}</b>?</p><div style="display:flex; gap:10px; justify-content:center; margin-top:15px;"><button class="btn-whatsapp" onclick="sendNoteAction('wa', ${studentId}, '${safeNote}', '${date}')" style="padding:10px 20px !important;"><i class="fab fa-whatsapp"></i> WhatsApp</button><button class="btn-sms" onclick="sendNoteAction('sms', ${studentId}, '${safeNote}', '${date}')" style="padding:10px 20px !important;"><i class="fas fa-sms"></i> SMS</button></div>`, icon: 'success', showConfirmButton: true, confirmButtonText: 'Close', confirmButtonColor: '#d33' });
        } else Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 }).fire({ icon: 'success', title: 'Note cleared' });
    }
}

function renderStudentNotes(studentId) {
    const listContainer = document.getElementById('modalNotesList'); listContainer.innerHTML = '';
    let allNotes = [];
    Object.keys(attendance).forEach(date => { const entry = attendance[date][studentId]; if (entry && typeof entry === 'object' && entry.note && entry.note.trim() !== "") allNotes.push({ date: date, note: entry.note, status: entry.status }); });
    allNotes.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (allNotes.length === 0) { listContainer.innerHTML = '<li style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 12px;">No notes found.</li>'; return; }
    allNotes.forEach(item => {
        const li = document.createElement('li'); li.style.cssText = "padding: 8px 10px; border-bottom: 1px solid var(--border-color); font-size: 12px;";
        li.innerHTML = `<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="font-weight:bold; color:var(--primary); font-size: 13px;">${new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</span></div><div style="color:var(--text-main); line-height:1.5;">${item.note}</div>`;
        listContainer.appendChild(li);
    });
}

function filterStudentNotes() {
    const filter = document.getElementById('noteSearchInput').value.toUpperCase(), li = document.getElementById('modalNotesList').getElementsByTagName('li');
    for (let i = 0; i < li.length; i++) li[i].style.display = (li[i].textContent || li[i].innerText).toUpperCase().indexOf(filter) > -1 ? "" : "none";
}

function sendNoteAction(type, studentId, note, rawDate) {
    const student = students.find(s => s.id === studentId); if (!student) { Swal.fire('Error', 'Student not found!', 'error'); return; }
    const msgBody = `Dear ${student.name},\n\nHere is the note for today's ${student.class || 'Music'} class (${new Date(rawDate).toLocaleDateString('en-IN')}):\n\n"${note}"\n\nRegards,\nSrikanta Banerjee\n(Guitar, Bass Guitar, Piano, Keyboard, Mandolin Classes)`;
    if (type === 'wa') { let cleanPhone = student.phone.replace(/[^0-9]/g, ''); if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone; window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgBody)}`, '_blank'); } else if (type === 'sms') window.open(`sms:${student.phone}?body=${encodeURIComponent(msgBody)}`, '_self');
}

/* Global Material Library */
async function saveGlobalMaterial() {
    const title = document.getElementById('libMatTitle').value.trim(), category = document.getElementById('libMatCategory').value, type = document.getElementById('libMatType').value, link = document.getElementById('libMatLink').value.trim();
    if (!title || !link) { Swal.fire('Error', 'Title and Link are required!', 'error'); return; }
    globalMaterials.push({ id: Date.now(), title, category, type, link, date: new Date().toISOString().split('T')[0] });
    document.getElementById('libMatTitle').value = ''; document.getElementById('libMatLink').value = ''; renderGlobalMaterials();
    Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 }).fire({ icon: 'success', title: 'Saved to Library' });
    saveData().catch(e => console.log("Background sync pending"));
}

function renderGlobalMaterials() { document.getElementById('searchLibrary').value = ''; document.getElementById('filterLibCategory').value = 'All'; document.getElementById('filterLibType').value = 'All'; filterLibrary(); }

function filterLibrary() {
    const searchText = document.getElementById('searchLibrary').value.toLowerCase(), filterCat = document.getElementById('filterLibCategory').value, filterType = document.getElementById('filterLibType').value;
    const container = document.getElementById('globalLibraryList'); container.innerHTML = ''; currentLibDisplayCount = 0; 
    currentFilteredMaterials = globalMaterials.filter(mat => (mat.title.toLowerCase().includes(searchText) || mat.category.toLowerCase().includes(searchText) || mat.type.toLowerCase().includes(searchText)) && (filterCat === 'All' || mat.category === filterCat) && (filterType === 'All' || mat.type === filterType));
    if (currentFilteredMaterials.length === 0) { container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:13px; padding: 20px;">No materials found matching your search.</p>'; return; }
    currentFilteredMaterials.sort((a, b) => b.id - a.id); loadMoreLibraryItems();
}

function loadMoreLibraryItems() {
    const nextBatch = currentFilteredMaterials.slice(currentLibDisplayCount, currentLibDisplayCount + LIB_ITEMS_PER_PAGE); if (nextBatch.length === 0) return; 
    nextBatch.forEach(mat => {
        let icon = mat.type === 'video' ? '<i class="fab fa-youtube" style="color:#ef4444;"></i>' : mat.type === 'pdf' ? '<i class="fas fa-file-pdf" style="color:#ef4444;"></i>' : '<i class="fas fa-music" style="color:#3b82f6;"></i>';
        const div = document.createElement('div'); div.style.cssText = 'background: var(--bg-card); padding: 15px; border-radius: 12px; border-left: 4px solid var(--info); box-shadow: var(--shadow); display:flex; flex-direction:column; gap:10px; flex-shrink: 0; animation: fadeIn 0.4s ease;';
        div.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><span style="font-size:10px; background:var(--bg-input); padding:2px 8px; border-radius:4px; color:var(--text-muted); font-weight:600; text-transform:uppercase;">${mat.category}</span><span style="font-size:10px; background:var(--bg-input); padding:2px 8px; border-radius:4px; color:var(--text-muted); font-weight:600; text-transform:uppercase; margin-left:5px;">${mat.type}</span><div style="font-size:14px; font-weight:600; color:var(--text-main); margin-top:5px;">${icon} ${mat.title}</div></div><button onclick="deleteGlobalMaterial(${mat.id})" style="background:transparent; border:none; color:var(--danger); cursor:pointer; font-size:14px;"><i class="fas fa-trash"></i></button></div><div style="display:flex; gap:10px; margin-top:5px; align-items: stretch;"><button class="btn-info" onclick="openSendToStudentModal(${mat.id})" style="flex:2; font-size:12px; padding:8px 0; display:flex; align-items:center; justify-content:center; border-radius:8px; height: 35px; min-height: 35px; box-sizing: border-box; border: none;"><i class="fas fa-paper-plane" style="margin-right:5px;"></i> Send to Student</button><a href="${mat.link}" target="_blank" class="btn-success" style="flex:1; font-size:12px; padding:8px 0; display:flex; align-items:center; justify-content:center; text-decoration:none; border-radius:8px; height: 35px; min-height: 35px; box-sizing: border-box; text-align: center;"><i class="fas fa-eye" style="margin-right:5px;"></i> View</a></div>`;
        document.getElementById('globalLibraryList').appendChild(div);
    });
    currentLibDisplayCount += nextBatch.length;
}

function handleLibraryScroll() { const container = document.getElementById('globalLibraryList'); if (container.scrollTop + container.clientHeight >= container.scrollHeight - 15) loadMoreLibraryItems(); }

async function deleteGlobalMaterial(id) {
    Swal.fire({ title: 'Delete from Library?', text: "Are you sure? (This won't remove it from students who already received it)", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Yes, Delete' }).then(async (result) => {
        if (result.isConfirmed) { globalMaterials = globalMaterials.filter(m => m.id !== id); await saveData(); renderGlobalMaterials(); }
    });
}

async function openSendToStudentModal(matId) {
    const material = globalMaterials.find(m => m.id === matId); if (!material) return;
    tempActiveStudents = students.filter(s => s.status?.isActive).sort((a,b) => a.name.localeCompare(b.name));
    let optionsHtml = ''; tempActiveStudents.forEach(s => { optionsHtml += `<option value="${s.id}" style="padding: 10px; border-bottom: 1px solid var(--border-color); cursor:pointer;">${s.name} (${s.class || 'N/A'})</option>`; });

    const { value: selectedStudentId } = await Swal.fire({
        title: 'Send Material',
        html: `<div style="text-align:left; margin-bottom:15px; font-size:13px; color:var(--text-main);"><strong>Material:</strong> ${material.title} <br><span style="color:var(--info); font-weight:600;">${material.category}</span></div><input type="text" id="swal-search-student" class="swal2-input" placeholder="🔍 Search student by name..." style="width: 100%; margin: 0 0 10px 0; font-size: 14px; box-sizing: border-box;" onkeyup="filterSendStudentList()"><select id="send-mat-student" class="swal2-select" size="6" style="width:100%; font-size:14px; margin:0; padding:5px; box-sizing: border-box; overflow-y: auto; border-radius: 8px;">${optionsHtml}</select><div style="font-size:11px; color:var(--text-muted); text-align:left; margin-top:8px;">* Click on a student name to select</div>`,
        focusConfirm: false, showCancelButton: true, confirmButtonText: '<i class="fas fa-paper-plane"></i> Send to Portal', confirmButtonColor: 'var(--success)',
        preConfirm: () => { const val = document.getElementById('send-mat-student').value; if (!val) Swal.showValidationMessage('Please select a student from the list'); return val; }
    });

    if (selectedStudentId) assignMaterialToStudent(parseInt(selectedStudentId), material);
}

window.filterSendStudentList = function() {
    const filter = document.getElementById('swal-search-student').value.toUpperCase(), select = document.getElementById('send-mat-student'); select.innerHTML = ''; 
    tempActiveStudents.forEach(s => { const text = `${s.name} (${s.class || 'N/A'})`; if (text.toUpperCase().indexOf(filter) > -1) { const opt = document.createElement('option'); opt.value = s.id; opt.innerHTML = text; opt.style.cssText = 'padding: 10px; border-bottom: 1px solid #e2e8f0; cursor: pointer;'; select.appendChild(opt); } });
};

async function assignMaterialToStudent(studentId, material) {
    const studentIndex = students.findIndex(s => s.id === studentId); if (studentIndex === -1) return;
    const student = students[studentIndex]; if (!student.study_materials) student.study_materials = [];
    student.study_materials.push({ id: Date.now(), title: material.title, type: material.type, link: material.link, date: new Date().toISOString().split('T')[0] });
    Swal.fire({ title: 'Sent Fast!', text: `${material.title} added to ${student.name}'s portal.`, icon: 'success', timer: 1500, showConfirmButton: false });
    db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(studentId)).update({ study_materials: student.study_materials }).catch(e => console.log("Background sync pending"));
}

async function openAddMaterialModal(studentId) {
    const student = students.find(s => s.id === studentId); if (!student) return;
    const { value: formValues } = await Swal.fire({
        title: 'Add Study Material',
        html: `<input id="swal-mat-title" class="swal2-input" placeholder="Title (e.g. C Major Scale)" style="width: 85%;"><select id="swal-mat-type" class="swal2-select" style="width: 85%; margin-top: 10px;"><option value="video">🎬 Video Lesson </option><option value="pdf">📄 PDF / Notation</option><option value="audio">🎵 Audio Loop / Track </option></select><input id="swal-mat-link" class="swal2-input" placeholder="Paste Link Here" style="width: 85%; margin-top: 10px;">`,
        focusConfirm: false, showCancelButton: true, confirmButtonText: 'Save Material',
        preConfirm: () => { return { title: document.getElementById('swal-mat-title').value.trim(), type: document.getElementById('swal-mat-type').value, link: document.getElementById('swal-mat-link').value.trim() } }
    });

    if (formValues && formValues.title && formValues.link) {
        if (!student.study_materials) student.study_materials = [];
        student.study_materials.push({ id: Date.now(), title: formValues.title, type: formValues.type, link: formValues.link, date: new Date().toISOString().split('T')[0] });
        renderStudyMaterials(studentId);
        Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 }).fire({ icon: 'success', title: 'Material added instantly!' });
        db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(studentId)).update({ study_materials: student.study_materials }).catch(e => console.log("Will sync to Firebase automatically."));
    } else if (formValues) Swal.fire('Error', 'Title and Link are required.', 'error');
}

function renderStudyMaterials(studentId) {
    const student = students.find(s => s.id === studentId), listContainer = document.getElementById('modalStudyMaterialsList'); if (!listContainer || !student) return; listContainer.innerHTML = ''; 
    if (!student.study_materials || student.study_materials.length === 0) { listContainer.innerHTML = '<li style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 12px;">No materials shared yet.</li>'; return; }
    student.study_materials.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(mat => {
        let icon = mat.type === 'video' ? '<i class="fab fa-youtube" style="color:red;"></i>' : mat.type === 'pdf' ? '<i class="fas fa-file-pdf" style="color:red;"></i>' : '<i class="fas fa-music" style="color:blue;"></i>';
        listContainer.innerHTML += `<li style="padding: 8px 10px; border-bottom: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;"><div style="font-size:13px; color:var(--text-main);">${icon} <strong style="margin-left:5px;">${mat.title}</strong><br><span style="font-size:10px; color:var(--text-muted);">${new Date(mat.date).toLocaleDateString('en-IN')}</span></div><div><a href="${mat.link}" target="_blank" class="btn-info" style="padding:4px 8px; font-size:10px; text-decoration:none; border-radius: 4px;"><i class="fas fa-eye"></i> View</a><button class="btn-danger" onclick="deleteStudyMaterial(${studentId}, ${mat.id})" style="padding:4px 8px; font-size:10px; margin-left:5px; border-radius: 4px; border:none; cursor:pointer;"><i class="fas fa-trash"></i></button></div></li>`;
    });
}

async function deleteStudyMaterial(studentId, matId) {
    const student = students.find(s => s.id === studentId); if (!student) return;
    Swal.fire({ title: 'Delete Material?', text: "Are you sure you want to remove this?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Yes, delete it' }).then(async (result) => {
        if (result.isConfirmed) {
            student.study_materials = student.study_materials.filter(m => m.id !== matId);
            await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(studentId)).update({ study_materials: student.study_materials });
            renderStudyMaterials(studentId); Swal.fire('Deleted!', 'Material has been removed.', 'success');
        }
    });
}

async function savePersonalNotice() {
    const text = document.getElementById('personalNoticeInput').value.trim(); if (!text) { Swal.fire('Error', 'Write a notice first!', 'error'); return; }
    const studentIndex = students.findIndex(s => s.id === currentlyViewingStudentId);
    if(studentIndex !== -1) {
        students[studentIndex].personal_notice = text; 
        await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(currentlyViewingStudentId)).update({ personal_notice: text });
        Swal.fire('Saved', 'Notice added successfully', 'success'); showStudentDetails(currentlyViewingStudentId); 
    }
}

async function deletePersonalNotice() {
    const studentIndex = students.findIndex(s => s.id === currentlyViewingStudentId);
    if(studentIndex !== -1) {
        students[studentIndex].personal_notice = ""; 
        await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(currentlyViewingStudentId)).update({ personal_notice: "" });
        document.getElementById('personalNoticeInput').value = ''; Swal.fire('Deleted', 'Notice removed', 'success'); showStudentDetails(currentlyViewingStudentId);
    }
}

function openBulkMessageModal() { document.getElementById('bulkMsgFilter').value = 'All'; document.getElementById('bulkMsgText').value = ''; document.getElementById('waBulkList').style.display = 'none'; document.getElementById('bulkMsgModal').style.display = 'flex'; }

function sendBulkMsg(type) {
    const filter = document.getElementById('bulkMsgFilter').value, text = document.getElementById('bulkMsgText').value.trim();
    if(!text) { Swal.fire('Error', 'Message cannot be empty', 'error'); return; }
    let targetStudents = students.filter(s => s.status?.isActive); if(filter !== 'All') targetStudents = targetStudents.filter(s => s.class_day === filter);
    if(targetStudents.length === 0) { Swal.fire('Info', 'No active students found for this batch.', 'info'); return; }

    if(type === 'sms') {
        let phones = targetStudents.map(s => s.phone).filter(p => p).join(',');
        if(phones) window.open(`sms:${phones}?body=${encodeURIComponent(text)}`, '_self'); else Swal.fire('Error', 'No valid phone numbers found.', 'error');
    } else if(type === 'wa') {
        const waList = document.getElementById('waBulkList'); waList.innerHTML = '<h4 style="margin-top:0; font-size:14px; color:var(--text-muted);">Click below to send WhatsApp messages:</h4>';
        targetStudents.forEach(s => {
            if(s.phone) {
                let cleanPhone = s.phone.replace(/[^0-9]/g, ''); if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
                waList.innerHTML += `<div style="margin-bottom:8px;"><a href="https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}" target="_blank" class="btn-whatsapp" style="text-decoration:none; display:inline-block; padding:10px; width:100%; text-align:center; border-radius:8px; font-size:14px;"><i class="fab fa-whatsapp"></i> Send to ${s.name}</a></div>`;
            }
        });
        waList.style.display = 'block';
    }
}

function shareQRCode(studentId) {
    const student = students.find(s => s.id === studentId); if(!student) return;
    const baseUrl = window.location.origin + window.location.pathname, qrText = `${baseUrl}?student=${student.id}&manager=${DOC_ID}`;
    const qrImg = new QRious({ value: qrText, size: 250, level: 'H' }).toDataURL();
    
    let cleanPhone = student.phone ? student.phone.replace(/[^0-9]/g, '') : ''; if (cleanPhone && cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello ${student.name},\n\nHere is your Digital ID Card link for Music Classes. Click the link below to view your profile, attendance, and fees:\n\n${qrText}\n\nRegards,\nSrikanta Banerjee`)}`;

    window.tempDownloadQR = function() { const link = document.createElement('a'); link.download = `QR_${student.name}.png`; link.href = qrImg; link.click(); };
    window.tempShareQRImage = async function() {
        try { const blob = await (await fetch(qrImg)).blob(); const file = new File([blob], `QR_${student.name}.png`, { type: blob.type });
            if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) await navigator.share({ title: 'Student QR Code', text: `Digital ID QR Code for ${student.name}`, files: [file] });
            else Swal.fire('Oops', 'Direct image sharing is not supported on this browser. Please use the Download button instead.', 'info');
        } catch(e) { console.log(e); }
    };

    Swal.fire({
        title: `${student.name}'s ID`, imageUrl: qrImg, imageWidth: 180, imageHeight: 180, imageAlt: 'QR Code',
        html: `<p style="font-size:13px; color:gray; margin-bottom: 15px;">Share this profile link or QR code with the student.</p><div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">${cleanPhone ? `<a href="${waUrl}" target="_blank" style="background:#25D366; color:white; padding:12px 15px; border-radius:8px; text-decoration:none; font-size:14px; width: 85%; font-weight:bold; box-shadow: 0 4px 6px rgba(37, 211, 102, 0.3);"><i class="fab fa-whatsapp" style="font-size:16px;"></i> Send Link to WhatsApp</a>` : `<p style="color:red; font-size:12px; margin:0; font-weight:bold;">Student phone number is missing!</p>`}<div style="display:flex; gap:10px; width: 85%; justify-content: center;"><button onclick="tempShareQRImage()" style="flex:1; background:#3b82f6; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:bold;"><i class="fas fa-share-alt"></i> Share QR Image</button><button onclick="tempDownloadQR()" style="flex:1; background:#10b981; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:bold;"><i class="fas fa-download"></i> Download</button></div></div>`,
        showConfirmButton: false, showCancelButton: true, cancelButtonText: 'Close Window', cancelButtonColor: '#6b7280'
    });
}

function startQRScanner() { document.getElementById('qrScannerModal').style.display = 'flex'; if(!html5QrcodeScanner) { html5QrcodeScanner = new Html5QrcodeScanner("qr-reader-box", { fps: 10, qrbox: 250 }); html5QrcodeScanner.render(onScanSuccess, () => {}); } }
function closeQRScanner() { document.getElementById('qrScannerModal').style.display = 'none'; if(html5QrcodeScanner) html5QrcodeScanner.clear().then(() => html5QrcodeScanner = null).catch(console.error); }
function onScanSuccess(decodedText) {
    let studentId = null;
    if(decodedText.includes("student=")) try { studentId = parseInt(new URL(decodedText).searchParams.get("student")); } catch(e) {} 
    else if(decodedText.includes("[APP_ID:")) { const match = decodedText.match(/\[APP_ID:(\d+)\]/); if(match && match[1]) studentId = parseInt(match[1]); }

    if(studentId) {
        const student = students.find(s => s.id === studentId);
        if(student) { closeQRScanner(); markAttendance(studentId, 'present'); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `${student.name} Marked Present!`, showConfirmButton: false, timer: 2500 }); } 
        else Swal.fire({ toast: true, position: 'top', icon: 'error', title: 'Student not found.', showConfirmButton: false, timer: 2000 });
    } else Swal.fire({ toast: true, position: 'bottom', icon: 'warning', title: 'Invalid QR Code.', showConfirmButton: false, timer: 1500 });
}

/* Reports & Analytics */
function exportToExcel() {
    const studentData = students.map(s => ({ ID: s.serial_no, Name: s.name, Class: s.class, Fee: s.fee_amount, Phone: s.phone, Guardian: s.guardian, Status: s.status?.isActive ? 'Active' : 'Inactive', JoiningDate: s.joining_date }));
    const feeData = []; Object.keys(fees).forEach(month => { Object.keys(fees[month]).forEach(studentId => { const s = students.find(st => st.id == studentId); if (s) { const rec = fees[month][studentId]; feeData.push({ Month: month, StudentName: s.name, Amount: rec.amount, Date: rec.date, Mode: rec.mode, TxnID: rec.transactionId || '' }); } }); });
    const attendData = []; Object.keys(attendance).forEach(date => { Object.keys(attendance[date]).forEach(studentId => { const s = students.find(st => st.id == studentId); if (s) { const entry = attendance[date][studentId]; attendData.push({ Date: date, StudentName: s.name, Status: (typeof entry === 'object') ? entry.status : entry, ProgressNote: (typeof entry === 'object') ? entry.note : '' }); } }); });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentData), "Students List");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(feeData), "Fee Records");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attendData), "Attendance & Notes");

    const fileName = `MusicClass_Data_${new Date().toISOString().split('T')[0]}.xlsx`;
    try {
        if (window.showSaveFilePicker) {
            window.showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'Excel File', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }] })
            .then(handle => handle.createWritable())
            .then(writable => { writable.write(XLSX.write(wb, { bookType: 'xlsx', type: 'array' })); writable.close(); Swal.fire('Success', 'Excel file exported successfully!', 'success'); });
        } else { XLSX.writeFile(wb, fileName); Swal.fire('Success', 'File downloaded successfully.', 'success'); }
    } catch (err) { if (err.name !== 'AbortError') { XLSX.writeFile(wb, fileName); } }
}

function calculateMonthStats(monthStr) { let income = 0; let studentCount = 0; if(fees[monthStr]) Object.values(fees[monthStr]).forEach(record => { if(record.status === 'paid') income += record.amount; }); students.forEach(student => { if(wasStudentActiveDuringMonth(student, monthStr)) studentCount++; }); return { income, studentCount }; }

function updateYearlyChart() { 
    const year1 = parseInt(document.getElementById('analyticsYear').value), year2 = parseInt(document.getElementById('compareYear').value); if(!year1) return; 
    const currentYear = new Date().getFullYear(), currentMonthNum = new Date().getMonth() + 1, labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; 
    const inc1 = [], stu1 = []; let sumInc1 = 0, sumStu1 = 0, countMonths1 = 0;
    
    for(let i=1; i<=12; i++) { 
        const s = calculateMonthStats(`${year1}-${i.toString().padStart(2, '0')}`); inc1.push(s.income); stu1.push(s.studentCount); 
        if (year1 < currentYear || (year1 === currentYear && i <= currentMonthNum)) { sumInc1 += s.income; sumStu1 += s.studentCount; countMonths1++; }
    } 
    
    let statsHtml = `<div><h4>Monthly Avg Income (${year1})</h4><p class="summary-collected">₹${(sumInc1 / (countMonths1||1)).toFixed(0)}</p></div><div><h4>Monthly Avg Students (${year1})</h4><p class="summary-total" style="color:var(--text-main);">${Math.round(sumStu1 / (countMonths1||1))}</p></div>`; 
    const datasets = [ { label: `Income ${year1}`, data: inc1, backgroundColor: 'rgba(16, 185, 129, 0.6)', borderColor: '#10b981', borderWidth: 1, type: 'bar', yAxisID: 'y' }, { label: `Students ${year1}`, data: stu1, borderColor: '#3b82f6', borderWidth: 2, type: 'line', tension: 0.3, yAxisID: 'y1' } ]; 
    
    if (year2) { 
        const inc2 = [], stu2 = []; let sumInc2 = 0, sumStu2 = 0, countMonths2 = 0;
        for(let i=1; i<=12; i++) { 
            const s = calculateMonthStats(`${year2}-${i.toString().padStart(2, '0')}`); inc2.push(s.income); stu2.push(s.studentCount); 
            if (year2 < currentYear || (year2 === currentYear && i <= currentMonthNum)) { sumInc2 += s.income; sumStu2 += s.studentCount; countMonths2++; }
        } 
        statsHtml += `<div><h4>Monthly Avg Income (${year2})</h4><p class="summary-collected">₹${(sumInc2 / (countMonths2||1)).toFixed(0)}</p></div><div><h4>Monthly Avg Students (${year2})</h4><p class="summary-total" style="color:var(--text-main);">${Math.round(sumStu2 / (countMonths2||1))}</p></div>`; 
        datasets.push({ label: `Income ${year2}`, data: inc2, backgroundColor: 'rgba(239, 68, 68, 0.6)', borderColor: '#ef4444', borderWidth: 1, type: 'bar', yAxisID: 'y' }, { label: `Students ${year2}`, data: stu2, borderColor: '#f97316', borderWidth: 2, type: 'line', tension: 0.3, pointRadius: 3, yAxisID: 'y1' }); 
    } 
    
    document.getElementById('yearlyAverages').innerHTML = statsHtml; document.getElementById('yearlyAverages').style.display = 'flex'; 
    if(analyticsChartInstance) analyticsChartInstance.destroy(); 
    analyticsChartInstance = new Chart(document.getElementById('yearlyChart').getContext('2d'), { type: 'bar', data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { color: getComputedStyle(document.body).getPropertyValue('--text-main') } }, title: { display: true, text: year2 ? `${year1} vs ${year2}` : `Overview ${year1}`, color: getComputedStyle(document.body).getPropertyValue('--text-main') } }, scales: { y: { beginAtZero: true, position: 'left', title: {display:true, text:'Income (₹)', color: getComputedStyle(document.body).getPropertyValue('--text-muted')}, ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-muted') } }, y1: { beginAtZero: true, position: 'right', grid: {drawOnChartArea: false}, title: {display:true, text:'Students', color: getComputedStyle(document.body).getPropertyValue('--text-muted')}, ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-muted') } }, x: { ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-muted') } } } } }); 
}

function comparePeriods() { 
    const m1 = document.getElementById('compMonth1').value, m2 = document.getElementById('compMonth2').value; if(!m1 || !m2) return; 
    const s1 = calculateMonthStats(m1), s2 = calculateMonthStats(m2); 
    document.getElementById('compIncome1').textContent = `₹${s1.income}`; document.getElementById('compIncome2').textContent = `₹${s2.income}`; document.getElementById('compStudent1').textContent = s1.studentCount; document.getElementById('compStudent2').textContent = s2.studentCount; 
    const incDiff = s2.income - s1.income, stuDiff = s2.studentCount - s1.studentCount; 
    document.getElementById('compIncomeDiff').innerHTML = incDiff > 0 ? `<i class="fas fa-arrow-up"></i> ₹${incDiff}` : (incDiff < 0 ? `<i class="fas fa-arrow-down"></i> ₹${Math.abs(incDiff)}` : '-'); document.getElementById('compIncomeDiff').className = 'comp-diff ' + (incDiff >= 0 ? 'diff-up' : 'diff-down'); 
    document.getElementById('compStudentDiff').innerHTML = stuDiff > 0 ? `<i class="fas fa-arrow-up"></i> ${stuDiff}` : (stuDiff < 0 ? `<i class="fas fa-arrow-down"></i> ${Math.abs(stuDiff)}` : '-'); document.getElementById('compStudentDiff').className = 'comp-diff ' + (stuDiff >= 0 ? 'diff-up' : 'diff-down'); 
    document.getElementById('comparisonResults').style.display = 'block'; 
}

function exportDashboardPDF() { 
    const activeStudents = students.filter(s => s.status?.isActive), currentYear = new Date().getFullYear(), currentMonthStr = `${currentYear}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`; 
    let monthlyCollected = 0, monthlyDueAmount = 0, yearlyCollected = 0, yearlyDueAmount = 0; 
    
    students.forEach(student => { 
        for (let i = 0; i < 12; i++) { 
            const monthStr = `${currentYear}-${(i + 1).toString().padStart(2, '0')}`; 
            if (wasStudentActiveDuringMonth(student, monthStr)) { 
                if (fees[monthStr]?.[student.id]?.status === 'paid') { if (monthStr === currentMonthStr) monthlyCollected += fees[monthStr][student.id].amount; yearlyCollected += fees[monthStr][student.id].amount; } 
                else if (isMonthDue(monthStr)) { const studentFee = student.fee_amount || DEFAULT_FEE; if (monthStr === currentMonthStr) monthlyDueAmount += studentFee; yearlyDueAmount += studentFee; } 
            } 
        } 
    }); 
    
    const classCounts = activeStudents.reduce((acc, student) => { const className = student.class || 'Unassigned'; acc[className] = (acc[className] || 0) + 1; return acc; }, {}); 
    const doc = new window.jspdf.jsPDF(); let y = 20; 
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.text(INSTITUTE_NAME, 105, y, {align: "center"}); y += 10; 
    doc.setFontSize(14); doc.text("Complete Dashboard Report", 105, y, {align: "center"}); y += 8; 
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 105, y, {align: "center"}); y += 15; 
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Student Statistics", 15, y); y += 7; 
    doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.text(`Total Students: ${students.length}`, 20, y); y += 6; doc.text(`Active Students: ${activeStudents.length}`, 20, y); y += 6; doc.text(`Inactive Students: ${students.length - activeStudents.length}`, 20, y); y += 12; 
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Financial Overview", 15, y); y += 7; 
    doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.text(`Current Month (${formatMonthYear(currentMonthStr)}) Collected: Rs. ${monthlyCollected}`, 20, y); y += 6; doc.text(`Current Month Due: Rs. ${monthlyDueAmount}`, 20, y); y += 6; doc.text(`Yearly Collected: Rs. ${yearlyCollected}`, 20, y); y += 6; doc.text(`Yearly Due: Rs. ${yearlyDueAmount}`, 20, y); y += 12; 
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Class Strength", 15, y); y += 7; 
    doc.setFontSize(11); doc.setFont("helvetica", "normal"); Object.entries(classCounts).sort().forEach(([className, count]) => { doc.text(`${className}: ${count} students`, 20, y); y += 6; }); 
    addWatermarkAndSignatureToPdf(doc); doc.save(`Dashboard_Full_Report_${currentMonthStr}.pdf`); 
}

function toggleReportInputs() { document.getElementById('reportMonth-group').style.display = document.getElementById('reportType').value === 'monthly' ? 'block' : 'none'; document.getElementById('reportYear-group').style.display = document.getElementById('reportType').value === 'yearly' ? 'block' : 'none'; }

function generateReport() { 
    const type = document.getElementById('reportType').value, summaryEl = document.getElementById('reportSummary'), tableEl = document.getElementById('reportTable'), searchBoxEl = document.getElementById('reportSearchBox'), tableHead = tableEl.querySelector('thead'), tableBody = tableEl.querySelector('tbody'), exportBtn = document.getElementById('exportReportBtn'); 
    tableHead.innerHTML = ''; tableBody.innerHTML = ''; summaryEl.style.display = 'flex'; tableEl.style.display = 'table'; searchBoxEl.style.display = 'block'; exportBtn.style.display = 'inline-block'; 
    let totalCollected = 0, totalDue = 0, collectedCount = 0, dueCount = 0; 
    
    if (type === 'monthly') { 
        const month = document.getElementById('reportMonth').value; if (!month) return; 
        tableHead.innerHTML = `<tr><th>Student Name</th><th>Status</th><th>Amount</th><th>Action</th></tr>`; 
        const monthIsDue = isMonthDue(month); 
        
        students.forEach(student => { 
            if (!wasStudentActiveDuringMonth(student, month)) return; 
            const feeRecord = fees[month]?.[student.id]; let status = 'Pending', amount = `₹0`, rowClass = 'pending'; 
            if (feeRecord?.status === 'paid') { status = `Paid on ${new Date(feeRecord.date).toLocaleDateString('en-IN')}`; amount = `₹${feeRecord.amount}`; rowClass = 'paid'; totalCollected += feeRecord.amount; collectedCount++; } 
            else if (monthIsDue) { status = 'Due'; const studentFee = student.fee_amount || DEFAULT_FEE; amount = `₹${studentFee}`; rowClass = 'unpaid'; totalDue += studentFee; dueCount++; } 
            tableBody.innerHTML += `<tr class="${rowClass}"><td>${getStudentHtml(student)}</td><td>${status}</td><td>${amount}</td><td class="action-buttons">${status === 'Due' ? getContactButtons(student.id, month) : ''}</td></tr>`; 
        }); 
        
        summaryEl.innerHTML = `<div onclick="showFeeBreakdown('collected', '${month}')" style="cursor:pointer; border:1px solid var(--success);"><h4>Total Collected</h4><p class="summary-collected">₹${totalCollected} <span style="font-size:12px; color:var(--text-muted); display:block;">(${collectedCount} Students)</span></p></div><div onclick="showFeeBreakdown('due', '${month}')" style="cursor:pointer; border:1px solid var(--danger);"><h4>Total Due</h4><p class="summary-due">₹${totalDue} <span style="font-size:12px; color:var(--text-muted); display:block;">(${dueCount} Students)</span></p></div>`; 
    } else if (type === 'yearly') { 
        const year = document.getElementById('reportYear').value; if (!year) return; 
        tableHead.innerHTML = `<tr><th>Student</th><th>Monthly History</th><th>Summary</th></tr>`; 
        
        students.forEach(student => { 
            let studentTotalPaid = 0, studentTotalDue = 0, historyHtml = '', hasActivityInYear = false; 
            for(let i=1; i<=12; i++) { 
                const monthStr = `${year}-${i.toString().padStart(2, '0')}`, monthName = new Date(year, i-1).toLocaleString('default', { month: 'short' });
                if (wasStudentActiveDuringMonth(student, monthStr)) { 
                    hasActivityInYear = true; 
                    if (fees[monthStr]?.[student.id]?.status === 'paid') { const amt = fees[monthStr][student.id].amount; studentTotalPaid += amt; historyHtml += `<span style="font-size:11px; color:var(--success); margin-right:5px;">${monthName}: ₹${amt} <i class="fas fa-check"></i></span><br>`; } 
                    else if (isMonthDue(monthStr)) { const amt = student.fee_amount || DEFAULT_FEE; studentTotalDue += amt; historyHtml += `<span style="font-size:11px; color:var(--danger); margin-right:5px;">${monthName}: ₹${amt} (Due)</span><br>`; } 
                    else { historyHtml += `<span style="font-size:11px; color:var(--text-muted); margin-right:5px;">${monthName}: -</span><br>`; }
                } 
            } 
            if(hasActivityInYear) { 
                totalCollected += studentTotalPaid; totalDue += studentTotalDue; 
                if (studentTotalPaid > 0) collectedCount++; if (studentTotalDue > 0) dueCount++; 
                tableBody.innerHTML += `<tr><td>${getStudentHtml(student)}</td><td style="line-height:1.4;">${historyHtml || '<span style="color:var(--text-muted);">No Activity</span>'}</td><td><div style="font-size:12px;"><div style="color:var(--success); font-weight:bold;">Paid: ₹${studentTotalPaid}</div><div style="color:var(--danger); font-weight:bold; margin-top:2px;">Due: ₹${studentTotalDue}</div></div></td></tr>`; 
            } 
        }); 
        
        summaryEl.innerHTML = `<div onclick="showYearlyBreakdown('collected', '${year}')" style="cursor:pointer; border:1px solid var(--success);"><h4>Total Collected</h4><p class="summary-collected">₹${totalCollected} <span style="font-size:12px; color:var(--text-muted); display:block;">(${collectedCount} Students)</span></p></div><div onclick="showYearlyBreakdown('due', '${year}')" style="cursor:pointer; border:1px solid var(--danger);"><h4>Total Due</h4><p class="summary-due">₹${totalDue} <span style="font-size:12px; color:var(--text-muted); display:block;">(${dueCount} Students)</span></p></div>`; 
    } 
}
