// --- Firebase Config ---
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

// ENABLE OFFLINE PERSISTENCE
if (!window.location.search.includes('student=')) {
    db.enablePersistence({ synchronizeTabs: true }).catch((err) => console.log(err));
}

const COLLECTION_NAME = 'music_classes';
let DOC_ID = 'main_data';

// --- Optimized Database Functions ---
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

const auth = firebase.auth();

document.addEventListener('DOMContentLoaded', async () => {
    loadTheme();
    const urlParams = new URLSearchParams(window.location.search);
    const studentViewId = urlParams.get('student');
    const managerUid = urlParams.get('manager');

    if (studentViewId && managerUid) {
        document.getElementById('loginOverlay').style.display = 'none';

        async function renderStudentPortal() {
            document.body.innerHTML = '<div style="display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column; background:#f8fafc;"><i class="fas fa-spinner fa-spin fa-3x" style="color:#6366f1; margin-bottom:15px;"></i><h3 style="color:#1e293b; font-family:Poppins;">Loading Portal...</h3></div>';
            
            try {
                const docRef = db.collection('music_classes').doc(managerUid);
                const [studentDoc, mainDoc] = await Promise.all([
                    docRef.collection('students').doc(studentViewId).get(),
                    docRef.get()
                ]);

                if(studentDoc.exists && mainDoc.exists) {
                    const s = studentDoc.data();
                    const globalData = mainDoc.data();
                    const globalAtt = globalData.attendance || {};
                    const globalFees = globalData.fees || {};
                    
                    if (s.allow_profile_view !== false) {
                        
                        // ১. Personal Notice
                        let noticeHtml = '';
                        if (s.personal_notice && s.personal_notice.trim() !== '') {
                            noticeHtml = `
                            <div style="background: linear-gradient(90deg, #fffbeb, #fef3c7); padding: 12px; border-radius: 12px; border-left: 4px solid #f59e0b; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-bell fa-shake" style="color: #d97706;"></i>
                                <marquee scrollamount="4" style="color: #b45309; font-weight: 600;">${s.personal_notice}</marquee>
                            </div>`;
                        }

                        // ২. Attendance Data
                        let attRecords = [];
                        Object.keys(globalAtt).forEach(date => { if(globalAtt[date][studentViewId]) attRecords.push({ date, data: globalAtt[date][studentViewId] }); });
                        attRecords.sort((a,b) => new Date(b.date) - new Date(a.date));
                        
                        let attHtml = attRecords.length > 0 ? attRecords.map(rec => {
                            let status = typeof rec.data === 'object' && rec.data !== null ? rec.data.status : rec.data;
                            let note = typeof rec.data === 'object' && rec.data !== null && rec.data.note ? rec.data.note : 'No note';
                            let time = typeof rec.data === 'object' && rec.data !== null && rec.data.time ? rec.data.time : '';
                            let clr = status === 'present' ? '#16a34a' : '#dc2626';
                            const d = new Date(rec.date);
                            const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' });
                            const formattedDate = d.toLocaleDateString('en-IN');
                            let timeDisplay = time ? formatTime12H(time) : '';
                            let timeBadge = timeDisplay ? `<span style="font-size:11px; color:#3b82f6; background:#eff6ff; padding:2px 6px; border-radius:4px; margin-left:5px;">🕒 ${timeDisplay}</span>` : '';

                            return `<div style="margin-bottom:10px; padding:12px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <strong style="color:#1e293b;">${formattedDate} (${dayName})</strong>${timeBadge}
                                    <br><span style="font-size:11px; color:#64748b;">📝 ${note}</span>
                                </div>
                                <div style="color:${clr}; font-weight:bold; text-transform:uppercase;">${status}</div>
                            </div>`;
                        }).join('') : '<p style="text-align:center; color:gray; font-size:13px;">No attendance records.</p>';

                        // ৩. Payment Data
                        let feeRecords = [];
                        Object.keys(globalFees).forEach(month => { if(globalFees[month][studentViewId]) feeRecords.push({ month, data: globalFees[month][studentViewId] }); });
                        feeRecords.sort((a,b) => new Date(b.month+'-01') - new Date(a.month+'-01')).reverse();
                        
                        let paidHtml = feeRecords.length > 0 ? feeRecords.map(rec => {
                            // ট্রানজ্যাকশন আইডি থাকলে দেখাবে
                            let txnHtml = rec.data.transactionId ? `<br><span style="font-size:11px; color:#047857; font-weight:600; display:inline-block; margin-top:6px; background:#d1fae5; padding:4px 8px; border-radius:6px; border:1px dashed #34d399;"><i class="fas fa-hashtag"></i> Txn ID: ${rec.data.transactionId}</span>` : '';
                            
                            // পেমেন্টের তারিখ ফরম্যাট করা (যেমন: 15 Oct, 2023)
                            let payDate = rec.data.date ? new Date(rec.data.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
                            
                            // মাসের নাম ফরম্যাট করা
                            let monthName = new Date(rec.month + '-01').toLocaleString('en-US', { month: 'long', year: 'numeric' });
                            
                            return `
                            <div style="margin-bottom:15px; padding:16px; background:#f0fdf4; border-radius:14px; border-left:6px solid #22c55e; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.1);">
                                <div>
                                    <strong style="color:#166534; font-size:16px; letter-spacing: 0.5px;">${monthName}</strong><br>
                                    <span style="font-size:12px; color:#15803d; display:flex; align-items:center; gap:5px; margin-top:4px; font-weight: 500;">
                                        <i class="fas fa-calendar-check" style="color:#22c55e;"></i> Paid on: ${payDate} (${rec.data.mode || 'Cash'})
                                    </span>
                                    ${txnHtml}
                                </div>
                                <div style="font-size:20px; font-weight:800; color:#166534; background:#dcfce7; padding:8px 14px; border-radius:10px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">₹${rec.data.amount}</div>
                            </div>`;
                        }).join('') : '<p style="text-align:center; color:gray; font-size:14px; padding:20px; background:#f8fafc; border-radius:12px; border:1px dashed #cbd5e1;">No payment records found.</p>';

                        // ৪. Due Data
                        let dueHtml = '';
                        let dueMonthsList = [];
                        const portalNow = new Date();
                        const portalToday = portalNow.getDate();
                        const portalDUE_DATE = 10;
                        
                        let iterDate = new Date(s.joining_date);
                        if (!isNaN(iterDate.getTime())) {
                            iterDate.setDate(1);
                            while (iterDate <= portalNow) {
                                const y = iterDate.getFullYear();
                                const m = iterDate.getMonth() + 1;
                                const monthStr = `${y}-${m.toString().padStart(2, '0')}`;
                                
                                let isPastDue = false;
                                if (y < portalNow.getFullYear()) isPastDue = true;
                                else if (y === portalNow.getFullYear() && m - 1 < portalNow.getMonth()) isPastDue = true;
                                else if (y === portalNow.getFullYear() && m - 1 === portalNow.getMonth() && portalToday > portalDUE_DATE) isPastDue = true;

                                let wasActive = false;
                                const monthEnd = new Date(y, m, 0, 23, 59, 59);
                                const joinDate = new Date(s.joining_date);
                                if (joinDate <= monthEnd) {
                                    const history = (s.status?.history || []).sort((a, b) => new Date(a.date) - new Date(b.date));
                                    let statusAtStart = 'Active'; 
                                    for (let i = 0; i < history.length; i++) { 
                                        if (new Date(history[i].date) < new Date(y, m - 1, 1)) statusAtStart = history[i].status; 
                                    }
                                    let changesInMonth = history.filter(h => { 
                                        const d = new Date(h.date); 
                                        return d >= new Date(y, m - 1, 1) && d <= monthEnd; 
                                    });
                                    
                                    if (changesInMonth.length === 0) {
                                        wasActive = (statusAtStart === 'Active');
                                    } else {
                                        const lastChange = changesInMonth[changesInMonth.length - 1];
                                        wasActive = lastChange.status === 'Inactive' ? new Date(lastChange.date).getDate() > 10 : true;
                                    }
                                }

                                if (isPastDue && wasActive) {
                                    if (globalFees[monthStr]?.[studentViewId]?.status !== 'paid') {
                                        const formattedMonth = new Date(y, m - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
                                        dueMonthsList.push(formattedMonth);
                                    }
                                }
                                iterDate.setMonth(iterDate.getMonth() + 1);
                            }
                        }

                        if(dueMonthsList.length > 0) {
                            const dueAmt = dueMonthsList.length * (s.fee_amount || 500);
                            dueHtml = `
                            <style>@keyframes pulseWarning { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }</style>
                            <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius:16px; padding:20px; margin-bottom:25px; border: 2px solid #f87171; text-align: center; animation: pulseWarning 2s infinite;">
                                <div style="background: #ef4444; color: white; width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 10px auto;">
                                    <i class="fas fa-exclamation-triangle"></i>
                                </div>
                                <h4 style="margin:0; color:#b91c1c; font-size:16px; font-weight: 800; text-transform:uppercase; letter-spacing: 1px;">Payment Overdue</h4>
                                <p style="margin:8px 0; font-size:32px; font-weight:900; color:#dc2626;">₹${dueAmt}</p>
                                <p style="margin:0; font-size:13px; color:#991b1b; font-weight: 600;">Due for: ${dueMonthsList.join(', ')}</p>
                            </div>`;
                        }

                        // ৫. Study Materials Data
                        let materialsHtml = '';
                        if (s.study_materials && s.study_materials.length > 0) {
                            materialsHtml = s.study_materials.sort((a,b) => new Date(b.date) - new Date(a.date)).map(mat => {
                                let icon = mat.type === 'video' ? '<i class="fab fa-youtube" style="color:#ef4444;"></i>' : (mat.type === 'pdf' ? '<i class="fas fa-file-pdf" style="color:#ef4444;"></i>' : '<i class="fas fa-music" style="color:#3b82f6;"></i>');
                                return `<div style="padding:12px; background:#f8fafc; border-radius:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border:1px solid #e2e8f0;">
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <div style="font-size:20px;">${icon}</div>
                                        <div>
                                            <div style="font-weight:600; color:#1e293b; font-size:13px;">${mat.title}</div>
                                            <div style="font-size:10px; color:#64748b;">Uploaded: ${new Date(mat.date).toLocaleDateString('en-IN')}</div>
                                        </div>
                                    </div>
                                    <a href="${mat.link}" target="_blank" style="background:#6366f1; color:#fff; padding:6px 12px; border-radius:8px; text-decoration:none; font-size:11px; font-weight:600;">View</a>
                                </div>`;
                            }).join('');
                        } else {
                            materialsHtml = '<p style="text-align:center; color:gray; font-size:12px;">No materials shared yet.</p>';
                        }

                        // ৬. HTML Structure (Injecting into body)
                        document.body.innerHTML = `
                            <style>
                                .modal-portal { display:none; position:fixed; z-index:20000; left:0; top:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.7); align-items:center; justify-content:center; backdrop-filter: blur(4px); }
                                .modal-content-portal { background:#fff; width:90%; max-width:400px; padding:25px; border-radius:24px; max-height:80vh; overflow-y:auto; position:relative; animation: slideUp 0.3s ease; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
                                .scroller-box { max-height: 350px; overflow-y: auto; padding-right: 5px; }
                                .scroller-box::-webkit-scrollbar { width: 4px; }
                                .scroller-box::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                                .close-btn { position:absolute; top:15px; right:20px; font-size:24px; cursor:pointer; color:#94a3b8; background: #f1f5f9; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
                            </style>
                            
                            <div style="background: #f4f7f6; min-height: 100vh; font-family: 'Poppins', sans-serif; padding-bottom: 100px;">
                                <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 40px 20px 90px 20px; text-align:center; color:#fff; border-radius: 0 0 35px 35px; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);">
                                    <h3 style="margin:0; font-size:12px; font-weight:400; opacity:0.9; letter-spacing: 1px;">STUDENT PORTAL</h3>
                                    <h2 style="margin:5px 0 0 0; font-size:24px; font-weight:700;">Welcome, ${s.name.split(' ')[0]}!</h2>
                                </div>

                                <div style="margin-top:-60px; padding:0 20px;">
                                    <div style="text-align: center; margin-bottom: 25px;">
                                        <img src="${s.photo || 'https://via.placeholder.com/150'}" style="width:110px; height:110px; border-radius:50%; border:5px solid #fff; object-fit:cover; background:#eee; box-shadow:0 8px 16px rgba(0,0,0,0.1);">
                                        <h2 style="margin:10px 0 5px 0; color:#1e293b; font-size:20px; font-weight: 700;">${s.name}</h2>
                                        <span style="background:#dcfce7; color:#166534; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; border: 1px solid #bbf7d0;">Active Student</span>
                                    </div>

                                    ${noticeHtml}

                                    <div style="display:flex; flex-direction:column; gap:12px; margin-bottom: 25px;">
                                        <button onclick="document.getElementById('m-profile').style.display='flex'" style="width:100%; background:#fff; padding:16px 20px; border-radius:16px; border:none; box-shadow:0 4px 15px rgba(0,0,0,0.04); display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                                            <div style="display:flex; align-items:center; gap:15px;">
                                                <div style="background:#eff6ff; width:45px; height:45px; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#3b82f6; font-size:18px;"><i class="fas fa-user"></i></div>
                                                <span style="font-size:15px; font-weight:600; color:#334155;">Complete Profile Details</span>
                                            </div>
                                            <i class="fas fa-chevron-right" style="color:#cbd5e1;"></i>
                                        </button>
                                        
                                        <button onclick="document.getElementById('m-att').style.display='flex'" style="width:100%; background:#fff; padding:16px 20px; border-radius:16px; border:none; box-shadow:0 4px 15px rgba(0,0,0,0.04); display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                                            <div style="display:flex; align-items:center; gap:15px;">
                                                <div style="background:#f3e8ff; width:45px; height:45px; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#a855f7; font-size:18px;"><i class="fas fa-calendar-check"></i></div>
                                                <span style="font-size:15px; font-weight:600; color:#334155;">Attendance History</span>
                                            </div>
                                            <i class="fas fa-chevron-right" style="color:#cbd5e1;"></i>
                                        </button>
                                        
                                        <button onclick="document.getElementById('m-pay').style.display='flex'" style="width:100%; background:#fff; padding:16px 20px; border-radius:16px; border:none; box-shadow:0 4px 15px rgba(0,0,0,0.04); display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                                            <div style="display:flex; align-items:center; gap:15px;">
                                                <div style="background:#dcfce7; width:45px; height:45px; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#22c55e; font-size:18px;"><i class="fas fa-receipt"></i></div>
                                                <span style="font-size:15px; font-weight:600; color:#334155;">Payment History</span>
                                            </div>
                                            <i class="fas fa-chevron-right" style="color:#cbd5e1;"></i>
                                        </button>
                                    </div>

                                    ${dueHtml}

                                    <div style="margin-top: 10px;">
                                        <h4 style="margin:0 0 15px 5px; color:#334155; font-size:16px;"><i class="fas fa-book-open" style="color:#6366f1; margin-right:5px;"></i> My Study Materials</h4>
                                        <div class="scroller-box" style="background:#fff; border-radius:16px; padding:15px; box-shadow:0 4px 15px rgba(0,0,0,0.04);">${materialsHtml}</div>
                                    </div>
                                </div>

                                <div id="m-profile" class="modal-portal"><div class="modal-content-portal">
                                    <div class="close-btn" onclick="document.getElementById('m-profile').style.display='none'">&times;</div>
                                    <h3 style="margin-top:5px; color:#334155; font-size:18px; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">Profile Details</h3>
                                    <div class="scroller-box" style="font-size: 14px; color: #475569;">
                                        <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px dashed #e2e8f0;">
                                            <span style="font-weight:600;">Joining Date:</span> <span style="color:#1e293b;">${s.joining_date ? new Date(s.joining_date).toLocaleDateString('en-IN') : 'N/A'}</span>
                                        </div>
                                        <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px dashed #e2e8f0;">
                                            <span style="font-weight:600;">ID No:</span> <span style="color:#1e40af; font-weight:700;">#${s.serial_no}</span>
                                        </div>
                                        <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px dashed #e2e8f0;">
                                            <span style="font-weight:600;">Class:</span> <span style="color:#1e293b;">${s.class || 'N/A'}</span>
                                        </div>
                                        <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px dashed #e2e8f0;">
                                            <span style="font-weight:600;">Fee Amount:</span> <span style="color:#10b981; font-weight:700;">₹${s.fee_amount || 500}</span>
                                        </div>
                                        <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px dashed #e2e8f0;">
                                            <span style="font-weight:600;">Phone:</span> <span style="color:#1e293b;">${s.phone || 'N/A'}</span>
                                        </div>
                                        <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px dashed #e2e8f0;">
                                            <span style="font-weight:600;">DOB:</span> <span style="color:#1e293b;">${s.dob ? new Date(s.dob).toLocaleDateString('en-IN') : 'N/A'}</span>
                                        </div>
                                        <div style="display:flex; justify-content:space-between; padding: 10px 0;">
                                            <span style="font-weight:600;">Address:</span> <span style="text-align: right; max-width: 60%; color:#1e293b;">${s.address || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div></div>

                                <div id="m-att" class="modal-portal"><div class="modal-content-portal">
                                    <div class="close-btn" onclick="document.getElementById('m-att').style.display='none'">&times;</div>
                                    <h3 style="margin-top:5px; color:#334155; font-size:18px; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">Attendance History</h3>
                                    <div class="scroller-box">${attHtml}</div>
                                </div></div>

                                <div id="m-pay" class="modal-portal"><div class="modal-content-portal">
                                    <div class="close-btn" onclick="document.getElementById('m-pay').style.display='none'">&times;</div>
                                    <h3 style="margin-top:5px; color:#334155; font-size:18px; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">Payment History</h3>
                                    <div class="scroller-box">${paidHtml}</div>
                                </div></div>

                                <div style="position:fixed; bottom:0; left:0; width:100%; background:#fff; padding:15px; display:flex; gap:12px; box-shadow:0 -10px 30px rgba(0,0,0,0.06); border-radius:24px 24px 0 0; box-sizing:border-box;">
                                    <button onclick="window.location.reload()" style="flex:0.7; background:#f1f5f9; color:#334155; border:none; border-radius:14px; height:50px; font-size:20px; cursor:pointer;"><i class="fas fa-home"></i></button>
                                    
                                    <a href="tel:7001471235" style="flex:1; background:#6366f1; color:#fff; text-decoration:none; display:flex; align-items:center; justify-content:center; border-radius:14px; font-weight:600; font-size:15px; box-shadow:0 4px 10px rgba(99,102,241,0.3);"><i class="fas fa-headset" style="margin-right:6px;"></i> Help</a>
                                    
                                    <button onclick="localStorage.removeItem('verified_student_${studentViewId}'); window.location.reload();" style="flex:1; background:#fff; color:#ef4444; border:2px solid #fecaca; border-radius:14px; font-weight:600; font-size:15px; cursor:pointer;">Log Out</button>
                                </div>
                            </div>`;
                    } else {
                        document.body.innerHTML = `<div style="display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column; background:#f8fafc;"><h2 style="color:#ef4444;">Profile Hidden</h2><p>Contact manager to enable access.</p><button onclick="localStorage.removeItem('verified_student_${studentViewId}'); window.location.reload();" style="padding:10px 20px; background:#1e293b; color:#fff; border:none; border-radius:8px;">Go Back</button></div>`;
                    }
                } else {
                    document.body.innerHTML = `<div style="display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column; background:#f8fafc;"><h2 style="color:#ef4444;">Student not found.</h2><button onclick="localStorage.removeItem('verified_student_${studentViewId}'); window.location.reload();" style="padding:10px 20px; background:#1e293b; color:#fff; border:none; border-radius:8px;">Go Back</button></div>`;
                }
            } catch(e) { 
                console.error(e); 
                document.body.innerHTML = `<div style="display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column; background:#f8fafc;"><h2 style="color:#ef4444;">Connection Error</h2><button onclick="window.location.reload();" style="padding:10px 20px; background:#1e293b; color:#fff; border:none; border-radius:8px;">Retry</button></div>`;
            }
        }

        if (localStorage.getItem(`verified_student_${studentViewId}`) === 'true') {
            renderStudentPortal();
        } else {
            const vOverlay = document.createElement('div');
            vOverlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:linear-gradient(135deg, #4f46e5, #7c3aed); z-index:10000; display:flex; align-items:center; justify-content:center;";
            vOverlay.innerHTML = `
                <div style="background:#fff; padding:35px 25px; border-radius:24px; width:85%; max-width:350px; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.2);">
                    <div style="background:#eff6ff; width:60px; height:60px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 15px auto;">
                        <i class="fas fa-user-graduate" style="color:#4f46e5; font-size:24px;"></i>
                    </div>
                    <h3 style="margin-bottom:5px; color:#1e293b; font-family:'Poppins', sans-serif;">Student Login</h3>
                    <p style="font-size:13px; color:#64748b; margin-bottom:25px;">Verify your identity to continue</p>
                    
                    <div style="text-align:left; margin-bottom:15px;">
                        <label style="font-size:12px; font-weight:600; color:#475569; margin-left:5px;">Phone Number</label>
                        <input type="tel" id="v_phone" placeholder="e.g. 9876543210" style="width:100%; padding:12px; margin-top:5px; border:2px solid #e2e8f0; border-radius:12px; box-sizing:border-box; outline:none; font-weight:bold;">
                    </div>
                    <div style="text-align:left; margin-bottom:25px;">
                        <label style="font-size:12px; font-weight:600; color:#475569; margin-left:5px;">Date of Birth</label>
                        <input type="date" id="v_dob" style="width:100%; padding:12px; margin-top:5px; border:2px solid #e2e8f0; border-radius:12px; box-sizing:border-box; outline:none; font-weight:bold;">
                    </div>
                    
                    <button id="v_btn" style="width:100%; padding:14px; background:#4f46e5; color:#fff; border:none; border-radius:12px; font-weight:bold; font-size:16px; cursor:pointer; box-shadow:0 4px 12px rgba(79, 70, 229, 0.3);">Access Portal <i class="fas fa-arrow-right" style="margin-left:5px;"></i></button>
                    <p id="v_err" style="color:#ef4444; font-size:12px; margin-top:15px; display:none; background:#fef2f2; padding:8px; border-radius:8px;"></p>
                </div>`;
            document.body.appendChild(vOverlay);
            
            document.getElementById('v_btn').onclick = async function() {
                const ph = document.getElementById('v_phone').value.trim();
                const dob = document.getElementById('v_dob').value;
                const err = document.getElementById('v_err');
                const btn = document.getElementById('v_btn');
                
                if(!ph || !dob) { err.textContent = "Please fill all fields"; err.style.display='block'; return; }
                
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
                btn.disabled = true;
                
                try {
                    const sDoc = await db.collection('music_classes').doc(managerUid).collection('students').doc(studentViewId).get();
                    if(sDoc.exists && sDoc.data().phone === ph && sDoc.data().dob === dob) {
                        localStorage.setItem(`verified_student_${studentViewId}`, 'true');
                        vOverlay.remove();
                        renderStudentPortal();
                    } else { 
                        err.textContent = "Incorrect details. Try again."; 
                        err.style.display='block'; 
                        btn.innerHTML = 'Access Portal <i class="fas fa-arrow-right"></i>';
                        btn.disabled = false;
                    }
                } catch(e) {
                    err.textContent = "Network error. Check internet."; 
                    err.style.display='block';
                    btn.innerHTML = 'Access Portal <i class="fas fa-arrow-right"></i>';
                    btn.disabled = false;
                }
            };
        }
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
        .then((userCredential) => {})
        .catch((error) => {
            console.error(error);
            errorMsg.textContent = "Error: " + error.message;
            errorMsg.style.display = 'block';
            loginBtn.innerHTML = originalText;
        });
}

function handleSignUp() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('loginError');

    if (!email || !password) {
        errorMsg.textContent = "Email and password required to create an account!";
        errorMsg.style.display = 'block';
        return;
    }

    const signUpBtn = document.querySelectorAll('#loginOverlay button')[1]; 
    const originalText = signUpBtn.innerHTML;
    signUpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Handled by onAuthStateChanged
        })
        .catch((error) => {
            console.error(error);
            errorMsg.textContent = "Error: " + error.message;
            errorMsg.style.display = 'block';
            signUpBtn.innerHTML = originalText;
        });
}

function handleLogout() {
    Swal.fire({
        title: 'Logout?',
        text: "You need internet to login again.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, Logout'
    }).then((result) => {
        if (result.isConfirmed) {
            auth.signOut().then(() => {
                window.location.reload();
            });
        }
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

let isPhotoDeletedInEdit = false;

function removeEditPhoto() {
    document.getElementById('editPhotoPreview').src = 'https://via.placeholder.com/100?text=No+Photo';
    currentEditPhotoBase64 = null; 
    isPhotoDeletedInEdit = true;
}

async function loadStudentsFromSubCollection() {
    try {
        const snapshot = await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').get();
        if (snapshot.empty) return [];
        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error("Error loading students:", error);
        return [];
    }
}

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
            dbGet('attendance'),
            dbGet('fees'),
            dbGet('reminders'),
            dbGet('studentSerialCounter'),
            dbGet('globalMaterials')
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

let dismissedBirthdays = JSON.parse(localStorage.getItem('dismissedBirthdays')) || [];

async function saveInstituteLogo(input) { const file = input.files[0]; if (file) { const reader = new FileReader(); reader.onload = function(e) { const img = new Image(); img.onload = async function() { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const maxWidth = 200; const scaleSize = maxWidth / img.width; canvas.width = maxWidth; canvas.height = img.height * scaleSize; ctx.drawImage(img, 0, 0, canvas.width, canvas.height); const logoBase64 = canvas.toDataURL('image/jpeg', 0.8); await dbSet('instituteLogo', logoBase64); await loadInstituteLogo(); Swal.fire('Success', 'Logo saved!', 'success'); }; img.src = e.target.result; }; reader.readAsDataURL(file); } }
async function loadInstituteLogo() { instituteLogo = await dbGet('instituteLogo'); const img = document.getElementById('logoPreview'); const headerLogo = document.getElementById('headerLogo'); const btn = document.getElementById('removeLogoBtn'); if (instituteLogo) { img.src = instituteLogo; img.style.display = 'block'; btn.style.display = 'inline-block'; headerLogo.src = instituteLogo; headerLogo.style.display = 'block'; } else { img.style.display = 'none'; btn.style.display = 'none'; headerLogo.style.display = 'none'; } }
async function removeLogo() { await dbDelete('instituteLogo'); instituteLogo = null; await loadInstituteLogo(); }
async function saveAuthSignature(input) { const file = input.files[0]; if (file) { const reader = new FileReader(); reader.onload = function(e) { const img = new Image(); img.onload = async function() { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const maxWidth = 150; const scaleSize = maxWidth / img.width; canvas.width = maxWidth; canvas.height = img.height * scaleSize; ctx.drawImage(img, 0, 0, canvas.width, canvas.height); const sigBase64 = canvas.toDataURL('image/png'); await dbSet('authorizedSignature', sigBase64); await loadAuthSignature(); Swal.fire('Success', 'Signature saved!', 'success'); }; img.src = e.target.result; }; reader.readAsDataURL(file); } }
async function loadAuthSignature() { authorizedSignature = await dbGet('authorizedSignature'); const img = document.getElementById('authSigPreview'); const btn = document.getElementById('removeAuthSigBtn'); if (authorizedSignature) { img.src = authorizedSignature; img.style.display = 'block'; btn.style.display = 'inline-block'; } else { img.style.display = 'none'; btn.style.display = 'none'; } }
async function removeAuthSignature() { await dbDelete('authorizedSignature'); authorizedSignature = null; await loadAuthSignature(); }

/* SIGNATURE PAD LOGIC */
let signaturePad = null;
let isDrawing = false;
let currentStudentSignature = null;
let sigRotation = 0;

function openSignatureModal() {
    const modal = document.getElementById('signatureModal');
    modal.style.display = 'flex';
    
    const canvas = document.getElementById('sigCanvas');
    const wrapper = document.getElementById('sigWrapper');
    
    canvas.width = wrapper.clientWidth - 40;
    canvas.height = wrapper.clientHeight - 40;
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    sigRotation = 0;
    document.querySelector('.sig-canvas-box').style.transform = `rotate(0deg)`;

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('touchstart', startDraw, {passive: false});
    canvas.addEventListener('touchmove', draw, {passive: false});
    canvas.addEventListener('touchend', stopDraw);
}

function closeSignatureModal() {
    document.getElementById('signatureModal').style.display = 'none';
}

function startDraw(e) {
    isDrawing = true;
    draw(e);
    e.preventDefault(); 
}

function draw(e) {
    if (!isDrawing) return;
    const canvas = document.getElementById('sigCanvas');
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    let x, y;
    if (e.type.includes('touch')) {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
    } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.preventDefault();
}

function stopDraw() {
    isDrawing = false;
    const canvas = document.getElementById('sigCanvas');
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
}

function clearSignature() {
    const canvas = document.getElementById('sigCanvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function rotateSignaturePad() {
    sigRotation = (sigRotation + 90) % 360;
    document.querySelector('.sig-canvas-box').style.transform = `rotate(${sigRotation}deg)`;
}

function saveSignature() {
    const canvas = document.getElementById('sigCanvas');
    currentStudentSignature = canvas.toDataURL('image/png');
    document.getElementById('signatureStatus').style.display = 'block';
    closeSignatureModal();
    Swal.fire('Saved', 'Signature captured successfully.', 'success');
}

function getFeeCalculationStartDate(student) { return new Date(student.joining_date); }

function wasStudentActiveDuringMonth(student, monthStr) {
    const [year, month] = monthStr.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    const joinDate = new Date(student.joining_date);
    if (joinDate > monthEnd) return false;
    
    const history = (student.status.history || []).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let statusAtStart = 'Active'; 
    for (let i = 0; i < history.length; i++) { 
        if (new Date(history[i].date) < monthStart) { 
            statusAtStart = history[i].status; 
        } 
    }
    
    let changesInMonth = history.filter(h => { 
        const d = new Date(h.date); 
        return d >= monthStart && d <= monthEnd; 
    });
    
    if (changesInMonth.length === 0) { return statusAtStart === 'Active'; }
    
    const lastChangeInMonth = changesInMonth[changesInMonth.length - 1];
    const changeDate = new Date(lastChangeInMonth.date);
    
    if (lastChangeInMonth.status === 'Inactive') { 
        return changeDate.getDate() > 10; 
    } else { 
        return true; 
    }
}

function checkGlobalDues(studentId) { 
    const s = students.find(x => x.id === studentId); 
    if (!s) return false; 
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();
    const today = now.getDate();
    let iterDate = new Date(s.joining_date);
    if(isNaN(iterDate.getTime())) return false;
    iterDate.setDate(1);
    while (iterDate <= now) { 
        const y = iterDate.getFullYear(); 
        const m = iterDate.getMonth() + 1; 
        const monthStr = `${y}-${m.toString().padStart(2, '0')}`; 
        if (wasStudentActiveDuringMonth(s, monthStr)) { 
            if (y < currentYear || (y === currentYear && m - 1 < currentMonthIndex)) { 
                if (fees[monthStr]?.[studentId]?.status !== 'paid') return true; 
            } else if (y === currentYear && m - 1 === currentMonthIndex && today > DUE_DATE) { 
                if (fees[monthStr]?.[studentId]?.status !== 'paid') return true; 
            } 
        } 
        iterDate.setMonth(iterDate.getMonth() + 1); 
    } 
    return false; 
}

function getDueMonthsList(studentId) { 
    const s = students.find(x => x.id === studentId); 
    if (!s) return []; 
    const dueMonths = []; 
    const now = new Date(); 
    let iterDate = new Date(s.joining_date);
    if(isNaN(iterDate.getTime())) return [];
    iterDate.setDate(1);
    while (iterDate <= now) { 
        const y = iterDate.getFullYear(); 
        const m = iterDate.getMonth() + 1; 
        const monthStr = `${y}-${m.toString().padStart(2, '0')}`; 
        if (wasStudentActiveDuringMonth(s, monthStr) && isMonthDue(monthStr) && fees[monthStr]?.[studentId]?.status !== 'paid') { 
            dueMonths.push(formatMonthYear(monthStr)); 
        } 
        iterDate.setMonth(iterDate.getMonth() + 1); 
    } 
    return dueMonths; 
}

function getDueMsg(student, month) { 
    const feePerMonth = student.fee_amount || DEFAULT_FEE; 
    const cls = student.class || 'Music'; 
    const dueMonthsArray = getDueMonthsList(student.id);

    if (dueMonthsArray.length > 1) {
        const totalDueAmount = dueMonthsArray.length * feePerMonth;
        const monthsStr = dueMonthsArray.join(", ");
        return `Dear ${student.name},\n\nThis is a friendly reminder that your total fee of ₹${totalDueAmount} for the months of [${monthsStr}] for your ${cls} class is due.\n\nPlease pay as soon as possible. Thank you.\n\nFrom ${MY_NAME}\n(${INSTITUTE_NAME})`;
    } else if (dueMonthsArray.length === 1) {
        return `Dear ${student.name},\n\nThis is a friendly reminder that your fee of ₹${feePerMonth} for ${dueMonthsArray[0]} for your ${cls} class is due.\n\nPlease pay as soon as possible. Thank you.\n\nFrom ${MY_NAME}\n(${INSTITUTE_NAME})`;
    } else {
        const monthName = formatMonthYear(month); 
        return `Dear ${student.name},\n\nThis is a friendly reminder that your fee of ₹${feePerMonth} for ${monthName} for your ${cls} class is due.\n\nPlease pay as soon as possible. Thank you.\n\nFrom ${MY_NAME}\n(${INSTITUTE_NAME})`;
    }
}

function getPaidMsg(student, monthsStr, amount, txnId) { 
    const cls = student.class || 'Music'; 
    const monthArray = monthsStr.split(',');
    const displayMonths = monthArray.map(m => formatMonthYear(m)).join(", ");
    
    let msg = `Dear ${student.name},\n\nYour fee payment of ₹${amount} for the month(s) of ${displayMonths} for your ${cls} class has been successfully received by ${MY_NAME} (${INSTITUTE_NAME}).`; 
    if(txnId) { msg += `\nTransaction ID: ${txnId}`; } 
    msg += `\n\nThank you.`; 
    return msg; 
}

function sendMsg(type, studentId, monthStr, amount = 0, isDue = true) { 
    const student = students.find(s => s.id === studentId); 
    if(!student) return; 
    
    let txnId = ""; 
    const firstMonth = monthStr.split(',')[0]; 
    
    if (!isDue && fees[firstMonth] && fees[firstMonth][studentId]) { 
        txnId = fees[firstMonth][studentId].transactionId || ""; 
    } 
    
    const msgBody = isDue ? getDueMsg(student, monthStr) : getPaidMsg(student, monthStr, amount, txnId); 
    
    if(type === 'wa') { 
        let cleanPhone = student.phone.replace(/[^0-9]/g, ''); 
        if(cleanPhone.length === 10) cleanPhone = '91' + cleanPhone; 
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgBody)}`, '_blank'); 
    } else if (type === 'sms') { 
        window.open(`sms:${student.phone}?body=${encodeURIComponent(msgBody)}`, '_self'); 
    } else if (type === 'mail') { 
        const subject = isDue ? "Fee Reminder" : "Payment Receipt"; 
        window.open(`mailto:${student.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msgBody)}`, '_self'); 
    } 
}

function sendBirthdayWish(type, studentId) { const student = students.find(s => s.id === studentId); if(!student) return; const msgBody = `Happy Birthday ${student.name}! Wishing you a fantastic day filled with music and joy. Best wishes from Srikanta Banerjee (Guitar, Bass Guitar, Piano, Keyboard, Mandolin Classes).`; if(type === 'wa') { let cleanPhone = student.phone.replace(/[^0-9]/g, ''); if(cleanPhone.length === 10) cleanPhone = '91' + cleanPhone; window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgBody)}`, '_blank'); } else if (type === 'sms') { window.open(`sms:${student.phone}?body=${encodeURIComponent(msgBody)}`, '_self'); } else if (type === 'mail') { window.open(`mailto:${student.email}?subject=${encodeURIComponent("Happy Birthday!")}&body=${encodeURIComponent(msgBody)}`, '_self'); } }

function dismissBirthday(studentId) {
    const currentYear = new Date().getFullYear();
    const uniqueKey = `${studentId}_${currentYear}`; 

    if (!dismissedBirthdays.includes(uniqueKey)) {
        dismissedBirthdays.push(uniqueKey);
        localStorage.setItem('dismissedBirthdays', JSON.stringify(dismissedBirthdays));
        
        renderDashboard();
        
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });
        Toast.fire({
            icon: 'success',
            title: 'Birthday dismissed'
        });
    }
}

let pendingAction = null, pinInput = "";
function secureAction(callback, isInit = false) { pendingAction = callback; pinInput = ""; updatePinDots(); document.querySelector('.close-pin').style.display = isInit ? 'none' : 'block'; document.getElementById('securityOverlay').style.display = 'flex'; }
function closePinScreen() { 
    if (!students || students.length === 0) {
        return; 
    }
    document.getElementById('securityOverlay').style.display = 'none'; 
    pendingAction = null; 
    pinInput = ""; 
}
function pressPin(key) { if (key === 'C') pinInput = ""; else if (pinInput.length < 4) pinInput += key; updatePinDots(); }
function updatePinDots() { document.querySelectorAll('.pin-dot').forEach((dot, index) => { index < pinInput.length ? dot.classList.add('filled') : dot.classList.remove('filled'); }); }

async function submitPin() {
    let currentPin = localStorage.getItem('app_pin');
    
    if (!currentPin) {
        currentPin = await dbGet('app_pin');
        if (currentPin) localStorage.setItem('app_pin', currentPin);
    }
    if (!currentPin) currentPin = '1234';

    if (pinInput === currentPin) {
        document.getElementById('securityOverlay').style.display = 'none';
        if (pendingAction) pendingAction();
        pendingAction = null;
        pinInput = "";
    } else {
        pinInput = ""; 
        updatePinDots(); 

        if (navigator.vibrate) navigator.vibrate(200);

        Swal.fire({
            icon: 'error',
            title: 'Incorrect PIN',
            text: 'Please try again!',
            toast: true,            
            position: 'top',        
            showConfirmButton: false,
            timer: 2000,            
            background: '#ffe4e6',  
            color: '#dc2626',       
            customClass: {
                popup: 'high-z-index-popup' 
            }
        });
    }
}

async function changeAppPin() { 
    const newPin = document.getElementById('newAppPin').value; 
    
    if (newPin.length === 4 && !isNaN(newPin)) { 
        await dbSet('app_pin', newPin); 
        
        localStorage.setItem('app_pin', newPin);
        
        Swal.fire('Success', 'PIN changed successfully.', 'success'); 
        document.getElementById('newAppPin').value = ''; 
    } else { 
        Swal.fire('Error', 'PIN must be 4 digits.', 'error'); 
    } 
}

function sendWelcomeMsg(type, studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const msgBody = `Welcome ${student.name} to the ${student.class || 'Music'} class! We are glad to have you with us. Your classes are on ${student.class_day || 'scheduled day'} at ${student.class_time ? formatTime12H(student.class_time) : 'scheduled time'}. Regards, Srikanta Banerjee (Guitar, Bass Guitar, Piano, Keyboard & Mandolin Classes)`;
    
    if (type === 'wa') {
        let cleanPhone = student.phone.replace(/[^0-9]/g, '');
        if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgBody)}`, '_blank');
    } else if (type === 'sms') {
        window.open(`sms:${student.phone}?body=${encodeURIComponent(msgBody)}`, '_self');
    } else if (type === 'mail') {
        window.open(`mailto:${student.email}?subject=${encodeURIComponent("Welcome to Music Classes")}&body=${encodeURIComponent(msgBody)}`, '_self');
    }
}

window.shareWelcomePdf = async function(fileName) {
    const file = window.tempPdfFile;
    if (navigator.canShare && navigator.share && file) {
        try {
            await navigator.share({
                files: [file],
                title: 'Welcome Note',
                text: 'Welcome to Music Classes'
            });
        } catch (err) {
            console.log("Share failed", err);
            alert("Share not supported or cancelled.");
        }
    } else {
        alert("Sharing not supported on this device/browser.");
    }
};

window.downloadWelcomePdf = function(fileName) {
     const pdf = window.tempPdfObj;
     if(pdf) pdf.save(fileName);
};

window.sendWelcomeSmsFromModal = function(studentId) {
    sendWelcomeMsg('sms', studentId);
};

async function generateWelcomeNote(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    Swal.fire({
        title: 'Generating PDF...',
        text: 'Please wait...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    document.getElementById('wnStudentName').textContent = student.name;
    document.getElementById('wnStudentNameSig').textContent = student.name; 
    document.getElementById('wnClass').textContent = student.class || 'Music';
    
    let timeStr = (student.class_day || '') + ' ' + (student.class_time ? formatTime12H(student.class_time) : '');
    document.getElementById('wnTime').textContent = timeStr;
    document.getElementById('wnFee').textContent = '₹' + (student.fee_amount || DEFAULT_FEE) + '/-';
    document.getElementById('wnAddress').textContent = student.address || '';
    document.getElementById('wnPhone').textContent = student.phone || '';
    document.getElementById('wnFooterDate').textContent = new Date().toLocaleDateString('en-GB');

    const photoImg = document.getElementById('wnStudentPhoto');
    if (student.photo) { photoImg.src = student.photo; photoImg.style.display = 'block'; } 
    else { photoImg.style.display = 'none'; }

    const studSigImg = document.getElementById('wnStudentSig');
    if (student.student_signature) { 
        studSigImg.src = student.student_signature; 
        studSigImg.style.display = 'block'; 
    } else { 
        studSigImg.style.display = 'none'; 
    }

    if (instituteLogo) {
        document.getElementById('wnHeaderLogo').src = instituteLogo;
        document.getElementById('wnWatermarkImg').src = instituteLogo;
    }
    if (authorizedSignature) {
        document.getElementById('wnSigImg').src = authorizedSignature;
    }

    setTimeout(async () => {
        const element = document.getElementById('welcomeNoteTemplate');
        
        try {
            const canvas = await html2canvas(element, { 
                scale: 1.5, 
                useCORS: true, 
                logging: false,
                backgroundColor: '#ffffff'
            });
            
            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            
            const fileName = `Welcome_${student.name.replace(/\s+/g, '_')}.pdf`;
            window.tempPdfObj = pdf;
            const pdfBlob = pdf.output('blob');
            window.tempPdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });

            Swal.close();

            Swal.fire({
                title: 'Welcome Note Ready!',
                html: `
                    <div class="swal-custom-actions" style="display:flex; flex-direction:column; gap:10px;">
                        <button class="btn-whatsapp" onclick="shareWelcomePdf('${fileName}')" style="padding:10px; width:100%;">
                            <i class="fab fa-whatsapp"></i> Share PDF
                        </button>
                        
                        <div style="display:flex; gap:5px;">
                            <button class="btn-whatsapp" style="background: #128C7E; flex:1;" onclick="sendWelcomeMsg('wa', ${studentId})">
                                <i class="fab fa-whatsapp"></i> Msg (WA)
                            </button>
                            <button class="btn-sms" style="flex:1;" onclick="sendWelcomeSmsFromModal(${studentId})">
                                <i class="fas fa-sms"></i> Send SMS
                            </button>
                        </div>

                        <button class="btn-primary" onclick="downloadWelcomePdf('${fileName}')" style="padding:10px; width:100%;">
                            <i class="fas fa-download"></i> Download PDF
                        </button>
                    </div>
                `,
                icon: 'success',
                showConfirmButton: true,
                confirmButtonText: 'Close',
                confirmButtonColor: '#d33',
                allowOutsideClick: false
            });

        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Failed to generate PDF.', 'error');
        }
    }, 200);
}

async function addStudent() { 
    const name = document.getElementById('studentName').value; 
    const className = document.getElementById('studentClass').value; 
    const day = document.getElementById('studentDay').value; 
    const time = document.getElementById('studentTime').value; 
    const fee = parseFloat(document.getElementById('studentFee').value) || DEFAULT_FEE; 
    const email = document.getElementById('studentEmail').value; 
    const guardian = document.getElementById('guardianName').value; 
    const phone = document.getElementById('phone').value; 
    const address = document.getElementById('address').value; 
    const dob = document.getElementById('studentDOB').value; 

    if (name.trim() === '') { 
        Swal.fire('Error', 'Name is required.', 'error'); 
        return; 
    } 

    let photoDisplay = '';
    if (currentPhotoBase64) {
        photoDisplay = `<img src="${currentPhotoBase64}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #000; margin-bottom: 10px;">`;
    } else {
        photoDisplay = `<div style="width: 80px; height: 80px; border-radius: 50%; background: #eee; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px auto; border: 1px solid #ccc;">No Photo</div>`;
    }

    let timeDisplay = time;
    if(time) {
        const [h, m] = time.split(':');
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        timeDisplay = `${h12}:${m} ${ampm}`;
    }
    
    let sigDisplay = currentStudentSignature 
        ? `<div style="margin-top:5px;"><img src="${currentStudentSignature}" style="max-height: 40px; border:1px solid #ddd; padding:2px;"></div>` 
        : '<span style="color:red;">No</span>';

    const detailsHtml = `
        <div style="text-align: center;">${photoDisplay}</div>
        <div style="text-align: left; font-size: 14px; line-height: 1.6; background: var(--bg-input); padding: 15px; border-radius: 8px;">
            <div><strong>Name:</strong> ${name}</div>
            <div><strong>Class:</strong> ${className || '-'}</div>
            <div><strong>Time:</strong> ${day || ''} ${timeDisplay || ''}</div>
            <div><strong>Fee:</strong> ₹${fee}</div>
            <div><strong>Phone:</strong> ${phone || '-'}</div>
            <div><strong>Guardian:</strong> ${guardian || '-'}</div>
            <div><strong>Address:</strong> ${address || '-'}</div>
            <div><strong>Signature:</strong> ${sigDisplay}</div>
        </div>
        <div style="margin-top: 10px; font-size: 12px; color: var(--danger);">
            * Please check carefully before saving.
        </div>
    `;

    const result = await Swal.fire({
        title: 'Check Details',
        html: detailsHtml,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Confirm & Save',
        cancelButtonText: 'Edit / Cancel',
        confirmButtonColor: 'var(--success)',
        cancelButtonColor: 'var(--danger)',
        allowOutsideClick: false 
    });

    if (result.isConfirmed) {
        
        const newStudent = { 
            id: Date.now(), 
            serial_no: studentSerialCounter++, 
            name, 
            class: className, 
            class_day: day, 
            class_time: time, 
            fee_amount: fee, 
            email, 
            guardian, 
            phone, 
            address, 
            dob: dob, 
            photo: currentPhotoBase64, 
            student_signature: currentStudentSignature, 
            joining_date: new Date().toISOString().split('T')[0], 
            status: { isActive: true, history: [{ status: 'Active', date: new Date().toISOString().split('T')[0], note: 'Joined' }] } 
        }; 

        students.push(newStudent); 
        
        await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(newStudent.id)).set(newStudent);
        
        await dbSet('studentSerialCounter', studentSerialCounter);
        
        document.getElementById('studentName').value = ''; 
        document.getElementById('studentClass').value = ''; 
        document.getElementById('studentFee').value = ''; 
        document.getElementById('studentEmail').value = ''; 
        document.getElementById('guardianName').value = ''; 
        document.getElementById('phone').value = ''; 
        document.getElementById('address').value = ''; 
        document.getElementById('studentDOB').value = ''; 
        document.getElementById('studentDay').value = ''; 
        document.getElementById('studentTime').value = ''; 
        document.getElementById('photoPreview').style.display = 'none'; 
        document.getElementById('photoPlaceholder').style.display = 'block'; 
        currentPhotoBase64 = null; 
        currentStudentSignature = null;
        document.getElementById('signatureStatus').style.display = 'none';
        document.getElementById('addStudentCamera').value = ''; 
        document.getElementById('addStudentGallery').value = ''; 
        
        loadAllData(); 
        
        Swal.fire({
            title: 'Student Added!',
            html: `
                <p>Send Welcome Message via:</p>
                <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin-top:15px;">
                    <button class="btn-whatsapp btn-like" onclick="sendWelcomeMsg('wa', ${newStudent.id})"><i class="fab fa-whatsapp"></i> WhatsApp</button>
                    <button class="btn-sms btn-like" onclick="sendWelcomeMsg('sms', ${newStudent.id})"><i class="fas fa-sms"></i> SMS</button>
                </div>
                <div style="margin-top:15px;">
                    <button class="btn-welcome btn-like" onclick="generateWelcomeNote(${newStudent.id})" style="width:100%;"><i class="fas fa-file-pdf"></i> Generate Bangla Welcome Note</button>
                </div>
            `,
            icon: 'success',
            showConfirmButton: true,
            confirmButtonColor: '#d33', 
            confirmButtonText: 'Done / Close',
            showCloseButton: true,
            allowOutsideClick: false 
        });
    } 
}

async function saveData() { 
    await dbSet('attendance', attendance); 
    await dbSet('fees', fees); 
    await dbSet('reminders', reminders);
    await dbSet('globalMaterials', globalMaterials); 
    await dbSet('studentSerialCounter', studentSerialCounter); 
}

function loadAllData() { renderDashboard(); loadStudentsList(); renderAttendance(); renderFees(); renderReminders(); }
        
async function exportData() { 
    const currentPin = localStorage.getItem('app_pin') || await dbGet('app_pin') || '1234';

    const data = { 
        students: students || [], 
        attendance: attendance || {}, 
        fees: fees || {}, 
        reminders: reminders || [], 
        globalMaterials: globalMaterials || [], /* 🟢 এটি নতুন অ্যাড করা হলো */
        studentSerialCounter: studentSerialCounter || 1,
        instituteLogo: instituteLogo || null, 
        authorizedSignature: authorizedSignature || null,
        app_pin: currentPin 
    }; 
    
    const jsonStr = JSON.stringify(data); 
    const defaultDate = new Date().toISOString().split('T')[0]; 
    const defaultName = `MusicClass_FullBackup_${defaultDate}.json`; 
    
    try { 
        if (window.showSaveFilePicker) { 
            const handle = await window.showSaveFilePicker({ 
                suggestedName: defaultName, 
                types: [{ description: 'JSON Backup File', accept: { 'application/json': ['.json'] }, }], 
            }); 
            const writable = await handle.createWritable(); 
            await writable.write(jsonStr); 
            await writable.close(); 
        } else { 
            const blob = new Blob([jsonStr], { type: "application/json" }); 
            const url = URL.createObjectURL(blob); 
            const a = document.createElement('a'); 
            a.href = url; 
            a.download = defaultName; 
            document.body.appendChild(a); 
            a.click(); 
            document.body.removeChild(a); 
            URL.revokeObjectURL(url); 
        } 
        
        dbSet('lastBackupDate', new Date().toISOString()).catch(e => console.log('Offline backup done'));

        Swal.fire({ 
            title: 'Full Backup Successful!', 
            text: 'All data (Students, Photos, Fees, Materials, Signature & PIN) saved offline.', 
            icon: 'success' 
        }); 
    } catch (err) { 
        if (err.name !== 'AbortError') { 
            console.error(err); 
            Swal.fire('Error', 'Failed to save backup.', 'error'); 
        } 
    } 
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = ''; 

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const json = e.target.result;
            const importedData = JSON.parse(json);

            if (!importedData || !importedData.students) {
                Swal.fire('Error', 'Invalid backup file.', 'error');
                return;
            }

            const totalStudents = importedData.students.length;
            let loadedCount = 0;

            Swal.fire({
                title: 'Restoring Data...',
                html: `
                    <div style="margin-bottom: 15px;">
                        <i class="fas fa-cloud-upload-alt fa-3x" style="color: var(--primary);"></i>
                    </div>
                    <h1 style="color: var(--success); font-weight: bold; font-size: 40px; margin: 0;" id="live-counter">0</h1>
                    <p style="margin: 5px 0 15px 0; color: var(--text-muted); font-size: 14px;">
                        STUDENTS RESTORED OUT OF <b>${totalStudents}</b>
                    </p>
                    <div style="width: 100%; background-color: #e2e8f0; border-radius: 10px; overflow: hidden; height: 10px; margin-bottom: 10px;">
                        <div id="live-progress-bar" style="width: 0%; height: 100%; background-color: var(--primary); transition: width 0.1s;"></div>
                    </div>
                    <div id="restore-status" style="font-size: 12px; color: var(--danger); font-weight: 500;">
                        Initializing...
                    </div>
                `,
                showConfirmButton: false,
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            students = importedData.students.map(migrateStudentData);
            attendance = importedData.attendance || {};
            fees = importedData.fees || {};
            reminders = importedData.reminders || [];
            globalMaterials = importedData.globalMaterials || []; /* 🟢 এটি নতুন অ্যাড করা হলো */
            studentSerialCounter = importedData.studentSerialCounter || 1;
            
            if(importedData.instituteLogo) instituteLogo = importedData.instituteLogo;
            if(importedData.authorizedSignature) authorizedSignature = importedData.authorizedSignature;
            if(importedData.app_pin) localStorage.setItem('app_pin', importedData.app_pin);

            const user = firebase.auth().currentUser;
            if (user) {
                document.getElementById('restore-status').innerText = "Cleaning old database...";
                
                dbSet('attendance', attendance).catch(console.error);
                dbSet('fees', fees).catch(console.error);
                dbSet('reminders', reminders).catch(console.error);
                dbSet('globalMaterials', globalMaterials).catch(console.error); /* 🟢 এটি নতুন অ্যাড করা হলো */
                dbSet('studentSerialCounter', studentSerialCounter).catch(console.error);
                if(instituteLogo) dbSet('instituteLogo', instituteLogo).catch(console.error);
                if(authorizedSignature) dbSet('authorizedSignature', authorizedSignature).catch(console.error);
                if(importedData.app_pin) dbSet('app_pin', importedData.app_pin).catch(console.error);

                const snapshot = await db.collection(COLLECTION_NAME).doc(user.uid).collection('students').get();
                const deleteBatch = db.batch();
                snapshot.docs.forEach(doc => { deleteBatch.delete(doc.ref); });
                await deleteBatch.commit();

                document.getElementById('restore-status').innerText = "Uploading students...";
                
                let writeBatch = db.batch();
                let batchCount = 0;

                for (const s of students) {
                    const ref = db.collection(COLLECTION_NAME).doc(user.uid).collection('students').doc(String(s.id));
                    writeBatch.set(ref, s);
                    
                    batchCount++;
                    loadedCount++;

                    const counterEl = document.getElementById('live-counter');
                    const progressEl = document.getElementById('live-progress-bar');
                    
                    if(counterEl) counterEl.innerText = loadedCount;
                    if(progressEl) {
                        const percentage = (loadedCount / totalStudents) * 100;
                        progressEl.style.width = percentage + "%";
                    }

                    if (batchCount >= 400) {
                        await writeBatch.commit();
                        writeBatch = db.batch();
                        batchCount = 0;
                    }
                }
                if (batchCount > 0) await writeBatch.commit();
            }

            loadAllData();
            
            if(authorizedSignature) {
                const sigPreview = document.getElementById('authSigPreview');
                if(sigPreview) {
                    sigPreview.src = authorizedSignature;
                    sigPreview.style.display = 'block';
                    document.getElementById('removeAuthSigBtn').style.display = 'inline-block';
                }
            }

            Swal.fire({
                title: 'Restore Complete!',
                html: `Successfully restored <b>${loadedCount}</b> students.<br>You can now use the app.`,
                icon: 'success',
                confirmButtonColor: 'var(--primary)'
            });

        } catch (error) {
            console.error("Restore Error:", error);
            Swal.fire('Error', 'Failed to restore. Check console.', 'error');
        }
    };
    reader.readAsText(file);
}

function openTab(tabName) { 
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active')); 
    document.querySelectorAll('.nav-item').forEach(button => button.classList.remove('active')); 
    document.getElementById(tabName).classList.add('active'); 
    const navBtns = document.querySelectorAll('.nav-item'); 
    navBtns.forEach(btn => { if(btn.getAttribute('onclick').includes(tabName)) btn.classList.add('active'); }); 
    if(tabName === 'dashboard') renderDashboard(); 
    if(tabName === 'analytics') updateYearlyChart(); 
    if(tabName === 'studentMgmt') {
        loadStudentsList();
        currentStudentSignature = null;
        document.getElementById('signatureStatus').style.display = 'none';
    }
    if(tabName === 'attendance') {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const mins = now.getMinutes().toString().padStart(2, '0');
        document.getElementById('attendanceTime').value = `${hours}:${mins}`;
        renderAttendance();
    }
    if(tabName === 'fees') renderFees();
    if(tabName === 'reminders') {
        renderReminders();
        renderGlobalMaterials();
    }
}

function migrateStudentData(student) { 
    if (!student.status) { student.status = { isActive: true, history: [] }; }
    if (student.status && !student.status.history) { const oldNote = student.status.note || 'Legacy data'; const oldDate = student.status.isActive ? (student.status.last_active_date || student.joining_date) : (student.status.last_inactive_date || student.joining_date); student.status.history = [{ status: student.status.isActive ? 'Active' : 'Inactive', date: oldDate, note: oldNote }]; } 
    if (student.fee_amount === undefined) student.fee_amount = DEFAULT_FEE; 
    if (!student.photo) student.photo = null; 
    if (!student.dob) student.dob = null; 
    if (!student.student_signature) student.student_signature = null; 
    return student; 
}

let currentPhotoBase64 = null; let currentEditPhotoBase64 = null; let photoSelectionContext = 'add';
function openPhotoSourceModal(context) { photoSelectionContext = context; document.getElementById('photoSourceModal').style.display = 'flex'; }
function triggerCamera() { closeModal('photoSourceModal'); const id = photoSelectionContext === 'add' ? 'addStudentCamera' : 'editStudentCamera'; document.getElementById(id).click(); }
function triggerGallery() { closeModal('photoSourceModal'); const id = photoSelectionContext === 'add' ? 'addStudentGallery' : 'editStudentGallery'; document.getElementById(id).click(); }

function handlePhotoSelection(input, context) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                const maxWidth = 120; 
                const scaleSize = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scaleSize;
                
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                const base64 = canvas.toDataURL('image/jpeg', 0.4); 

                if (context === 'add') {
                    currentPhotoBase64 = base64;
                    document.getElementById('photoPreview').src = base64;
                    document.getElementById('photoPreview').style.display = 'block';
                    document.getElementById('photoPlaceholder').style.display = 'none';
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

function sanitizeData(obj) {
    if (obj === undefined) return null;
    return JSON.parse(JSON.stringify(obj, (k, v) => v === undefined ? null : v));
}

async function dbSet(key, value) {
    try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error("User not logged in.");
        
        const docRef = db.collection(COLLECTION_NAME).doc(user.uid);
        const cleanValue = sanitizeData(value);
        
        await docRef.set({ [key]: cleanValue }, { merge: true });
        console.log(`✅ Saved: ${key}`);
    } catch (error) {
        console.error(`❌ Save Error (${key}):`, error);
        throw new Error(`Failed to save ${key}`);
    }
}

function openStatusChangeModal(id, toActive) { document.getElementById('statusChangeStudentId').value = id; document.getElementById('statusChangeToActive').value = toActive; document.getElementById('statusChangeTitle').textContent = toActive ? 'Activate Student' : 'Deactivate Student'; document.getElementById('statusDate').valueAsDate = new Date(); document.getElementById('statusNote').value = ''; document.getElementById('statusChangeModal').style.display = 'flex'; }

async function saveStatusChange() { 
    const id = parseInt(document.getElementById('statusChangeStudentId').value); 
    const toActive = document.getElementById('statusChangeToActive').value === 'true'; 
    const note = document.getElementById('statusNote').value.trim(); 
    const statusDate = document.getElementById('statusDate').value; 
    
    if (!statusDate) { Swal.fire('Error', 'Please select a date.', 'error'); return; } 
    
    const student = students.find(s => s.id === id); 
    if (student) { 
        student.status.isActive = toActive; 
        student.status.history.unshift({ status: toActive ? 'Active' : 'Inactive', date: statusDate, note: note || (toActive ? 'Re-activated' : 'Deactivated') }); 
        
        await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(id)).update({
            status: student.status
        });

        await saveData(); 
        loadAllData(); 
        closeModal('statusChangeModal'); 
        Swal.fire('Updated', `Status changed.`, 'success'); 
    } 
}        

function formatTime12H(timeStr) {
    if(!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
}

function getStudentHtml(student) { 
    const photoSrc = student.photo ? student.photo : 'https://via.placeholder.com/40?text=S'; 
    const phoneText = student.phone ? `<span class="student-phone-sub">${student.phone}</span>` : ''; 
    const formattedTime = student.class_time ? formatTime12H(student.class_time) : '';
    const dayText = student.class_day ? `<span class="student-time-sub">${student.class_day} ${formattedTime}</span>` : ''; 
    const hiddenAddress = `<span style="display:none;">${student.address || ''}</span>`;
    return `
    <div class="student-cell">
        <img src="${photoSrc}" class="student-thumb" loading="lazy">
        <div class="student-info">
            <span class="student-name-link" onclick="showStudentDetails(${student.id})">${student.name}</span>
            ${phoneText}
            ${dayText}
            ${hiddenAddress}
        </div>
    </div>`; 
}

function isMonthDue(monthStr) { const now = new Date(); now.setHours(0,0,0,0); const [year, month] = monthStr.split('-').map(Number); const firstDayOfMonth = new Date(year, month - 1, 1); if (firstDayOfMonth > now) return false; const currentYear = now.getFullYear(), currentMonthIndex = now.getMonth(), currentDay = now.getDate(); if (year < currentYear) return true; if (year === currentYear && month - 1 < currentMonthIndex) return true; return year === currentYear && month - 1 === currentMonthIndex && currentDay > DUE_DATE; }

function formatMonthYear(monthStr) { const [year, month] = monthStr.split('-'); const date = new Date(year, month - 1); return date.toLocaleString('en-US', { month: 'long', year: 'numeric' }); }

function getContactButtons(studentId, month) { const student = students.find(s => s.id === studentId); if (!student) return 'N/A'; let b = ''; const isDue = month && isMonthDue(month) && wasStudentActiveDuringMonth(student, month) && !(fees[month]?.[student.id]?.status === 'paid'); if (student.phone || student.email) { if(isDue) { b += `<button class="btn-whatsapp" onclick="sendMsg('wa', ${student.id}, '${month}')">WhatsApp</button>`; b += `<button class="btn-sms" onclick="sendMsg('sms', ${student.id}, '${month}')">SMS</button>`; b += `<button class="btn-mail" onclick="sendMsg('mail', ${student.id}, '${month}')">Email</button>`; b += `<a href="tel:${student.phone}" class="btn-like btn-call">Call</a>`; } else { b += `<a href="tel:${student.phone}" class="btn-like btn-call">Call</a>`; } } return b || 'N/A'; }

function getAllContactButtons(student) { let b = ''; if (student.phone) { b += `<a href="tel:${student.phone}" class="btn-like btn-call">Call</a>`; b += `<button class="btn-whatsapp" onclick="sendGeneralMsg('wa', ${student.id})">WhatsApp</button>`; b += `<button class="btn-sms" onclick="sendGeneralMsg('sms', ${student.id})">SMS</button>`; } if (student.email) { b += `<button class="btn-mail" onclick="sendGeneralMsg('mail', ${student.id})">Mail</button>`; } return b || 'N/A'; }

function showFeeBreakdown(type, specificMonth = null) {
    const selectedMonth = specificMonth || document.getElementById('feeMonth').value;
    if(!selectedMonth) return;
    const monthIsDue = isMonthDue(selectedMonth);
    
    const list = students.filter(s => {
        if(!wasStudentActiveDuringMonth(s, selectedMonth)) return false;
        const feeRecord = fees[selectedMonth]?.[s.id];
        const isPaid = feeRecord?.status === 'paid';
        if (type === 'collected') return isPaid;
        if (type === 'due') return !isPaid && monthIsDue;
        return false;
    });

    if (type === 'collected') {
        list.sort((a, b) => {
            const dateA = new Date(fees[selectedMonth][a.id].date);
            const dateB = new Date(fees[selectedMonth][b.id].date);
            return dateB - dateA; 
        });
    } else if (type === 'due') {
        list.sort((a, b) => {
            const duesA = getDueMonthsList(a.id).length;
            const duesB = getDueMonthsList(b.id).length;
            return duesB - duesA;
        });
    }
    
    document.getElementById('classStudentsTitle').textContent = type === 'collected' ? `Paid Students (${formatMonthYear(selectedMonth)})` : `Due Students (${formatMonthYear(selectedMonth)})`;
    const tableBody = document.querySelector('#classStudentsTable tbody');
    const tableHead = document.querySelector('#classStudentsTable thead tr');
    
    tableHead.innerHTML = '<th>ID</th><th>Student</th><th>Contact</th>';
    tableBody.innerHTML = '';
    
    if(list.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">No students found.</td></tr>';
    } else {
        list.forEach(s => {
            const feeRecord = fees[selectedMonth]?.[s.id];
            let info = '';
            if(type === 'collected') info = `<br><span style="font-size:10px; color:green;">₹${feeRecord.amount} on ${new Date(feeRecord.date).toLocaleDateString()}</span>`;
            else {
                const totalDueMonths = getDueMonthsList(s.id).length;
                info = `<br><span style="font-size:10px; color:red;">Due: ₹${s.fee_amount || DEFAULT_FEE} (${totalDueMonths} Months Pending)</span>`;
            }
            
            tableBody.innerHTML += `<tr><td>${s.serial_no}</td><td>${getStudentHtml(s)}${info}</td><td>${type === 'due' ? getContactButtons(s.id, selectedMonth) : getAllContactButtons(s)}</td></tr>`;
        });
    }
    document.getElementById('classStudentsModal').style.display = 'flex';
}

function showYearlyBreakdown(type, year) {
    let reportData = [];
    students.forEach(student => {
        let monthsDetails = [];
        let studentTotal = 0;

        for(let i=1; i<=12; i++) {
             const monthStr = `${year}-${i.toString().padStart(2, '0')}`;
             const monthName = new Date(year, i-1).toLocaleString('default', { month: 'short' });

             if (wasStudentActiveDuringMonth(student, monthStr)) {
                 if (type === 'collected') {
                     if (fees[monthStr]?.[student.id]?.status === 'paid') {
                         const amt = fees[monthStr][student.id].amount;
                         monthsDetails.push(`${monthName}: ₹${amt}`);
                         studentTotal += amt;
                     }
                 } else if (type === 'due') {
                     if (isMonthDue(monthStr) && fees[monthStr]?.[student.id]?.status !== 'paid') {
                         const amt = student.fee_amount || DEFAULT_FEE;
                         monthsDetails.push(`${monthName}: ₹${amt}`);
                         studentTotal += amt;
                     }
                 }
             }
        }

        if (studentTotal > 0) {
            reportData.push({ student, months: monthsDetails, total: studentTotal });
        }
    });

    reportData.sort((a, b) => b.total - a.total);

    const title = type === 'collected' ? `Collected Breakdown (${year})` : `Due Breakdown (${year})`;
    document.getElementById('classStudentsTitle').textContent = title;
    const tableBody = document.querySelector('#classStudentsTable tbody');
    const tableHead = document.querySelector('#classStudentsTable thead tr');

    tableHead.innerHTML = '<th>Student</th><th>Monthly Breakdown</th><th>Total</th>';
    tableBody.innerHTML = '';

    if(reportData.length === 0) {
         tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">No data found for this year.</td></tr>';
    } else {
        reportData.forEach(item => {
            const breakdownHtml = item.months.map(m => `<span style="font-size:11px; display:inline-block; background:var(--bg-input); padding:2px 5px; margin:2px; border-radius:4px; border:1px solid var(--border-color);">${m}</span>`).join(' ');

            tableBody.innerHTML += `
                <tr>
                    <td>${getStudentHtml(item.student)}</td>
                    <td>${breakdownHtml}</td>
                    <td style="font-weight:bold; color:${type==='collected'?'var(--success)':'var(--danger)'}">₹${item.total}</td>
                </tr>
            `;
        });
    }

    document.getElementById('classStudentsModal').style.display = 'flex';
}

function showClassStudents(className) { 
    document.getElementById('classStudentsTitle').textContent = `Students in ${className} Class`; 
    const tableBody = document.querySelector('#classStudentsTable tbody'); 
    const tableHead = document.querySelector('#classStudentsTable thead tr');
    tableHead.innerHTML = '<th>ID</th><th>Student</th><th>Contact</th>'; 
    tableBody.innerHTML = ''; 
    
    const classStudents = students.filter(s => s.status?.isActive && (s.class ? s.class.trim() : 'Unassigned') === className); 
    
    classStudents.forEach(s => { tableBody.innerHTML += `<tr><td>${s.serial_no}</td><td>${getStudentHtml(s)}</td><td>${getContactButtons(s.id)}</td></tr>`; }); 
    document.getElementById('classStudentsModal').style.display = 'flex'; 
}
function showCategoryList(type) { 
    const list = students.filter(s => type === 'active' ? s.status?.isActive : !s.status?.isActive); 
    document.getElementById('classStudentsTitle').textContent = type === 'active' ? 'Active Students' : 'Inactive Students'; 
    const tableBody = document.querySelector('#classStudentsTable tbody'); 
    const tableHead = document.querySelector('#classStudentsTable thead tr');
    tableHead.innerHTML = '<th>ID</th><th>Student</th><th>Contact</th>'; 
    tableBody.innerHTML = ''; 
    if(list.length === 0) { tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">No students found.</td></tr>'; } 
    else { list.forEach(s => { tableBody.innerHTML += `<tr><td>${s.serial_no}</td><td>${getStudentHtml(s)}</td><td>${getAllContactButtons(s)}</td></tr>`; }); } 
    document.getElementById('classStudentsModal').style.display = 'flex'; 
}

function checkBirthday(dobString) { if (!dobString) return false; const today = new Date(); const dob = new Date(dobString); return today.getDate() === dob.getDate() && today.getMonth() === dob.getMonth(); }

function updateReminderDay() { const dateVal = document.getElementById('reminderDate').value; if (dateVal) { const date = new Date(dateVal); const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']; document.getElementById('reminderDay').value = days[date.getDay()]; } }

async function addReminder() { 
    const text = document.getElementById('reminderText').value.trim(); 
    const day = document.getElementById('reminderDay').value; 
    const dateVal = document.getElementById('reminderDate').value; 

    if(!text) { 
        Swal.fire('Error', 'Please enter reminder text.', 'error'); 
        return; 
    } 

    reminders.push({ id: Date.now(), text: text, day: day, date: dateVal }); 
    
    // UI সাথে সাথে আপডেট হবে
    document.getElementById('reminderText').value = ''; 
    document.getElementById('reminderDate').value = ''; 
    renderReminders(); 
    
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Reminder added!', showConfirmButton: false, timer: 1500 });
    
    // ব্যাকগ্রাউন্ডে সেভ হবে (কোনো ল্যাগ করবে না)
    saveData().catch(e => console.log("Background sync pending")); 
}

async function deleteReminder(id) { reminders = reminders.filter(r => r.id !== id); await saveData(); renderReminders(); }

function renderReminders() { 
    const listContainer = document.getElementById('reminderListContainer'); 
    listContainer.innerHTML = ''; 
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]; 
    
    days.forEach(day => { 
        const dayReminders = reminders.filter(r => r.day === day); 
        
        if(dayReminders.length > 0) { 
            const dayHeader = document.createElement('h4'); 
            dayHeader.style.cssText = "margin: 15px 0 5px 0; color: var(--primary); font-size:14px; border-bottom:1px solid var(--border-color); padding-bottom: 5px;"; 
            dayHeader.textContent = day; 
            listContainer.appendChild(dayHeader); 
            
            dayReminders.forEach(r => { 
                let dateDisplay = "";
                if(r.date) {
                    const d = new Date(r.date);
                    dateDisplay = `<div style="font-size:10px; color:var(--text-muted); margin-top:2px;">📅 ${d.toLocaleDateString('en-IN')}</div>`;
                }

                const div = document.createElement('div'); 
                div.className = 'reminder-item'; 
                div.innerHTML = `
                    <div style="flex:1;">
                        <span style="font-weight:500;">${r.text}</span>
                        ${dateDisplay}
                    </div> 
                    <button class="btn-danger" style="padding:5px 10px; height:30px;" onclick="deleteReminder(${r.id})">
                        <i class="fas fa-trash"></i>
                    </button>`; 
                listContainer.appendChild(div); 
            }); 
        } 
    }); 
    
    if(reminders.length === 0) { 
        listContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:12px; margin-top:20px;">No reminders set.</p>'; 
    } 
}

function renderDashboard() { 
    const activeStudents = students.filter(s => s.status?.isActive); 
    document.getElementById('studentStatsSummary').innerHTML = `<div class="clickable-stat" onclick="showCategoryList('active')"><h4>Active</h4><p class="summary-collected">${activeStudents.length}</p></div><div class="clickable-stat" onclick="showCategoryList('inactive')"><h4>Inactive</h4><p class="summary-due">${students.length - activeStudents.length}</p></div><div><h4>Total</h4><p class="summary-total" style="color:var(--text-main);">${students.length}</p></div>`; 
    
    const birthdayBox = document.getElementById('birthdayAlertBox'); const birthdayList = document.getElementById('birthdayList'); 
    const currentYearForCheck = new Date().getFullYear();
    const birthdayStudents = activeStudents.filter(s => 
        checkBirthday(s.dob) && 
        !dismissedBirthdays.includes(`${s.id}_${currentYearForCheck}`)
    ); 
    if (birthdayStudents.length > 0) { birthdayList.innerHTML = ''; birthdayStudents.forEach(s => { birthdayList.innerHTML += `<div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-input); padding:10px; border-radius:8px; margin-bottom:5px; border:1px solid #ffe4e6; color:var(--text-main);"><div style="display:flex; align-items:center;"><img src="${s.photo || 'https://via.placeholder.com/40?text=S'}" style="width:40px; height:40px; border-radius:50%; margin-right:10px; object-fit:cover; border: 2px solid #000 !important;"><div><strong>${s.name}</strong><br><span style="font-size:11px; color:var(--text-muted);">${s.class || 'Student'}</span></div></div><div style="display:flex; gap:5px;"><button class="btn-whatsapp btn-like" onclick="sendBirthdayWish('wa', ${s.id})"><i class="fab fa-whatsapp"></i></button><button class="btn-sms btn-like" onclick="sendBirthdayWish('sms', ${s.id})"><i class="fas fa-sms"></i></button><button class="btn-success btn-like" onclick="dismissBirthday(${s.id})" title="Dismiss"><i class="fas fa-check"></i></button></div></div>`; }); birthdayBox.style.display = 'block'; } else { birthdayBox.style.display = 'none'; }
    
    const classCounts = activeStudents.reduce((acc, student) => { const className = student.class ? student.class.trim() : 'Unassigned'; acc[className] = (acc[className] || 0) + 1; return acc; }, {}); const classListEl = document.getElementById('classStrengthList'); classListEl.innerHTML = ''; Object.entries(classCounts).sort().forEach(([className, count]) => { classListEl.innerHTML += `<li onclick="showClassStudents('${className}')" style="cursor:pointer; color:var(--text-main);"><strong>${className}:</strong> <span>${count} students</span></li>`; }); 
    
    let monthlyCollected = 0, monthlyDueAmount = 0, yearlyCollected = 0, yearlyDueAmount = 0; 
    let monthlyPaidCount = 0, monthlyDueCount = 0; 
    const currentYear = new Date().getFullYear(), currentMonthStr = `${currentYear}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`; 
    
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]; const todayName = days[new Date().getDay()]; const todaysReminders = reminders.filter(r => r.day === todayName);
    const rBox = document.getElementById('dashboardRemindersBox'); 
    const rList = document.getElementById('dashboardReminderList'); 

    if(todaysReminders.length > 0) { 
        rList.innerHTML = ''; 
        rList.className = 'dashboard-reminder-list'; 
        todaysReminders.forEach(r => { 
            rList.innerHTML += `
                <div class="d-reminder-card">
                    <div class="d-rem-content">
                        <div class="d-rem-icon"><i class="fas fa-bell"></i></div>
                        <div class="d-rem-text">${r.text}</div>
                    </div>
                    <button class="d-rem-btn" onclick="markReminderDone(${r.id})" title="Mark as Done">
                        <i class="fas fa-check"></i>
                    </button>
                </div>
            `; 
        }); 
        rBox.style.display = 'block'; 
        rBox.style.background = 'transparent'; 
        rBox.style.boxShadow = 'none';
        rBox.style.border = 'none';
        rBox.style.padding = '0';
    } else { 
        rBox.style.display = 'none'; 
    }
    
    students.forEach(student => { 
        for (let i = 0; i < 12; i++) { 
            const monthStr = `${currentYear}-${(i + 1).toString().padStart(2, '0')}`; 
            if (wasStudentActiveDuringMonth(student, monthStr)) { 
                if (fees[monthStr]?.[student.id]?.status === 'paid') { 
                    if (monthStr === currentMonthStr) {
                        monthlyCollected += fees[monthStr][student.id].amount; 
                        monthlyPaidCount++; 
                    }
                    yearlyCollected += fees[monthStr][student.id].amount; 
                } else if (isMonthDue(monthStr)) { 
                    const studentFee = student.fee_amount || DEFAULT_FEE; 
                    if (monthStr === currentMonthStr) {
                        monthlyDueAmount += studentFee; 
                        monthlyDueCount++; 
                    }
                    yearlyDueAmount += studentFee; 
                } 
            } 
        } 
    });

    document.getElementById('dashboardYearlySummary').innerHTML = `<div onclick="showYearlyBreakdown('collected', '${currentYear}')" style="cursor:pointer;"><h4>Yearly Collected</h4><p class="summary-collected">₹${yearlyCollected}</p></div><div onclick="showYearlyBreakdown('due', '${currentYear}')" style="cursor:pointer;"><h4>Yearly Due (Active)</h4><p class="summary-due">₹${yearlyDueAmount}</p></div>`; 
    
    document.getElementById('financeOverviewNumbers').innerHTML = `
        <div onclick="showFeeBreakdown('collected')">
            <h4 style="line-height: 1.4; margin-bottom: 8px;">Collected <br><span style="font-size: 10px; text-transform: none; font-weight: 500; color: var(--secondary);">(${monthlyPaidCount} Students)</span></h4>
            <p class="summary-collected">₹${monthlyCollected}</p>
        </div>
        <div onclick="showFeeBreakdown('due')">
            <h4 style="line-height: 1.4; margin-bottom: 8px;">Due <br><span style="font-size: 10px; text-transform: none; font-weight: 500; color: var(--secondary);">(${monthlyDueCount} Students)</span></h4>
            <p class="summary-due">₹${monthlyDueAmount}</p>
        </div>`;

    const dueTableBody = document.querySelector('#dueFeeTable tbody'); const dueMessageEl = document.getElementById('dueFeeMessage'); dueTableBody.innerHTML = ''; 
    
    const defaulters = students.filter(s => s.status?.isActive).map(s => { return { student: s, months: getDueMonthsList(s.id) }; }).filter(item => item.months.length > 0); 
    
    if (defaulters.length === 0) { 
        dueMessageEl.textContent = "No pending dues."; 
    } else { 
        dueMessageEl.textContent = `(${defaulters.length}) students have pending dues.`; 
        defaulters.sort((a, b) => b.months.length - a.months.length);
        defaulters.forEach(item => { 
            const monthsStr = item.months.join(", "); 
            const studentHtml = getStudentHtml(item.student); 
            const dueDisplay = `<div style="margin-top:5px; font-size:11px; color:#dc2626; font-weight:600; line-height:1.4;">Due: ${monthsStr}</div>`; 
            
            const oldestDueMonthRaw = getOldestUnpaidMonth(item.student.id, currentMonthStr); 
            
            const payBtn = `<button class="btn-success btn-like" onclick="openFeeModal(${item.student.id}, '${oldestDueMonthRaw}')" style="padding: 4px 8px; font-size: 11px; margin: 2px;"><i class="fas fa-rupee-sign"></i> Pay</button>`;
            
            const contactBtns = getContactButtons(item.student.id, oldestDueMonthRaw); 
            
            dueTableBody.innerHTML += `<tr>
                <td>${studentHtml}${dueDisplay}</td>
                <td class="action-buttons">
                    ${payBtn} 
                    ${contactBtns}
                </td>
            </tr>`; 
        }); 
    }
    
    const ctx = document.getElementById('financeChart').getContext('2d'); if (financeChartInstance) financeChartInstance.destroy(); financeChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: ['Collected', 'Due'], datasets: [{ data: [monthlyCollected, monthlyDueAmount], backgroundColor: ['#28a745', '#dc3545'], hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: getComputedStyle(document.body).getPropertyValue('--text-main') } }, title: { display: true, text: `Summary for ${formatMonthYear(currentMonthStr)}`, color: getComputedStyle(document.body).getPropertyValue('--text-main') } } } });
}

function getMonthStrFromFormat(formattedMonth) { const parts = formattedMonth.split(' '); if (parts.length !== 2) return null; const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]; const monthIndex = monthNames.findIndex(name => name === parts[0]); if (monthIndex === -1) return null; const month = (monthIndex + 1).toString().padStart(2, '0'); const year = parts[1]; return `${year}-${month}`; }

function addPageFooter(doc, dateStr) {
    const pageCount = doc.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const footerY = pageHeight - 20; 

    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        if (instituteLogo) {
            doc.saveGraphicsState();
            doc.setGState(new doc.GState({ opacity: 0.05 })); 
            const imgSize = 100;
            doc.addImage(instituteLogo, 'JPEG', (pageWidth - imgSize) / 2, (pageHeight - imgSize) / 2, imgSize, imgSize);
            doc.restoreGraphicsState();
        }

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50);
        doc.text(`Generated Date: ${dateStr}`, margin, footerY + 5);
        
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, footerY + 15, { align: 'center' });

        if (authorizedSignature) {
            doc.addImage(authorizedSignature, 'PNG', pageWidth - 50, footerY - 10, 35, 12);
        }
        
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("Authorized Signature", pageWidth - 15, footerY + 5, { align: "right" });
        doc.setFont("helvetica", "italic");
        doc.text(`(${MY_NAME})`, pageWidth - 15, footerY + 9, { align: "right" });
    }
}

function exportStudentDetailsAsPDF(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const currentDate = new Date().toLocaleDateString('en-IN');

    let y = 20;
    const leftMargin = 15;
    const lineHeight = 7;

    if (instituteLogo) {
        const logoSize = 20; 
        doc.addImage(instituteLogo, 'JPEG', leftMargin, 15, logoSize, logoSize);
    }

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    
    const titleLines = doc.splitTextToSize(INSTITUTE_NAME, 130); 
    const titleY = 20; 
    
    doc.text(titleLines, pageWidth / 2, titleY, { align: 'center' });
    y += (titleLines.length * 8) + 8; 

    doc.setFontSize(14);
    doc.setTextColor(80);
    doc.text("STUDENT PROFILE REPORT", pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setDrawColor(100);
    doc.setLineWidth(0.5);
    doc.line(leftMargin, y, pageWidth - leftMargin, y);
    y += 15;

    if (student.photo) {
        const photoSize = 35;
        const photoX = pageWidth - leftMargin - photoSize;
        const photoY = y;
        doc.addImage(student.photo, 'JPEG', photoX, photoY, photoSize, photoSize);
        doc.setDrawColor(0, 0, 0); 
        doc.setLineWidth(1.0);     
        doc.rect(photoX, photoY, photoSize, photoSize); 
    } else {
        doc.setDrawColor(200);
        doc.setFillColor(240);
        doc.rect(pageWidth - leftMargin - 35, y, 35, 35, 'FD');
        doc.setFontSize(8);
        doc.text("No Photo", pageWidth - leftMargin - 17.5, y + 17.5, {align:'center'});
    }

    doc.setFontSize(11);
    doc.setTextColor(0);
    const addInfo = (label, value) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, leftMargin, y);
        doc.setFont("helvetica", "normal");
        doc.text(value || 'N/A', leftMargin + 35, y);
        y += lineHeight;
    };

    addInfo("Name:", student.name);
    addInfo("ID No:", student.serial_no.toString());
    addInfo("Class:", student.class);
    addInfo("Fees:", `Rs. ${student.fee_amount || DEFAULT_FEE}/-`);
    addInfo("Joined:", new Date(student.joining_date).toLocaleDateString('en-IN'));
    y += 5;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Contact Info", leftMargin, y);
    y += 8;
    
    doc.setFontSize(11);
    addInfo("Phone:", student.phone);
    addInfo("Guardian:", student.guardian);
    
    doc.setFont("helvetica", "bold");
    doc.text("Address:", leftMargin, y);
    doc.setFont("helvetica", "normal");
    const addrLines = doc.splitTextToSize(student.address || 'N/A', 80);
    doc.text(addrLines, leftMargin + 35, y);
    y += (addrLines.length * 6) + 10;

    doc.setDrawColor(200); doc.setLineWidth(0.2);
    doc.line(leftMargin, y, pageWidth - leftMargin, y);
    y += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Fee Payment History (Recent)", leftMargin, y);
    y += 8;

    doc.setFillColor(230);
    doc.rect(leftMargin, y, pageWidth - (leftMargin*2), 8, 'F');
    doc.setFontSize(10);
    doc.text("Month", leftMargin + 5, y + 5);
    doc.text("Amount", leftMargin + 50, y + 5);
    doc.text("Status", leftMargin + 100, y + 5);
    y += 12;

    doc.setFont("helvetica", "normal");
    let hasFees = false;
    Object.keys(fees).sort().reverse().slice(0, 12).forEach(month => { 
        if (wasStudentActiveDuringMonth(student, month)) {
            const rec = fees[month]?.[student.id];
            if (rec?.status === 'paid' || isMonthDue(month)) {
                hasFees = true;
                const monthName = new Date(month + '-01').toLocaleString('default', { month: 'short', year: 'numeric' });
                doc.text(monthName, leftMargin + 5, y);
                
                if (rec?.status === 'paid') {
                    doc.text(`Rs. ${rec.amount}`, leftMargin + 50, y);
                    doc.setTextColor(0, 100, 0); 
                    
                    let payMode = rec.mode || 'Cash';
                    let txnText = rec.transactionId ? ` (Txn: ${rec.transactionId})` : '';
                    
                    doc.setFontSize(8.5); 
                    doc.text(`Paid on ${new Date(rec.date).toLocaleDateString('en-IN')} [${payMode}]${txnText}`, leftMargin + 100, y);
                    doc.setFontSize(10); 
                    
                } else {
                    doc.text(`Rs. ${student.fee_amount}`, leftMargin + 50, y);
                    doc.setTextColor(200, 0, 0); 
                    doc.text("Due", leftMargin + 100, y);
                }
                doc.setTextColor(0);
                y += 7;
            }
        }
    });
    if (!hasFees) doc.text("No recent records.", leftMargin + 5, y);
    y += 10;

    if (y > 220) { addPageFooter(doc, currentDate); doc.addPage(); y = 20; }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Attendance & Class Notes", leftMargin, y);
    y += 8;

    doc.setFillColor(230);
    doc.rect(leftMargin, y, pageWidth - (leftMargin*2), 8, 'F');
    doc.setFontSize(10);
    // Modified Date column text to Date & Time
    doc.text("Date & Time", leftMargin + 5, y + 5);
    doc.text("Status", leftMargin + 50, y + 5);
    doc.text("Topic / Note", leftMargin + 80, y + 5);
    y += 12;

    doc.setFont("helvetica", "normal");
    let hasAttendance = false;
    
    const sortedDates = Object.keys(attendance).sort().reverse();

    sortedDates.forEach(date => {
        const entry = attendance[date]?.[student.id];
        if (entry) {
            hasAttendance = true;
            const d = new Date(date);
            const dateStr = d.toLocaleDateString('en-IN');
            const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' });
            
            const status = (typeof entry === 'object') ? entry.status : entry;
            const note = (typeof entry === 'object' && entry.note) ? entry.note : '';
            let timeStr = (typeof entry === 'object' && entry.time) ? formatTime12H(entry.time) : '';
            
            doc.setTextColor(0);
            const fullDateText = `${dateStr} ${dayName} ${timeStr}`;
            doc.text(fullDateText, leftMargin + 5, y);

            if(status === 'present') {
                doc.setTextColor(0, 128, 0); 
                doc.text("Present", leftMargin + 50, y);
            } else if(status === 'absent') {
                doc.setTextColor(200, 0, 0); 
                doc.text("Absent", leftMargin + 50, y);
            }

            doc.setTextColor(80); 
            const noteText = note ? note : '-';
            const noteLines = doc.splitTextToSize(noteText, 95); 
            doc.text(noteLines, leftMargin + 80, y);

            const rowHeight = Math.max(7, noteLines.length * 5);
            y += rowHeight;

            if (y > 270) {
                addPageFooter(doc, currentDate);
                doc.addPage();
                y = 20;
            }
        }
    });

    if (!hasAttendance) {
        doc.setTextColor(0);
        doc.text("No attendance records found.", leftMargin + 5, y);
    }

    addPageFooter(doc, currentDate);
    doc.save(`${student.name}_Profile.pdf`);
}

function calculateMonthStats(monthStr) { let income = 0; let studentCount = 0; if(fees[monthStr]) { Object.values(fees[monthStr]).forEach(record => { if(record.status === 'paid') income += record.amount; }); } students.forEach(student => { if(wasStudentActiveDuringMonth(student, monthStr)) { studentCount++; } }); return { income, studentCount }; }

function updateYearlyChart() { 
    const year1 = parseInt(document.getElementById('analyticsYear').value); 
    const year2 = parseInt(document.getElementById('compareYear').value); 
    if(!year1) return; 

    const currentYear = new Date().getFullYear();
    const currentMonthNum = new Date().getMonth() + 1;

    const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; 
    const inc1 = []; const stu1 = []; 
    let sumInc1 = 0; let sumStu1 = 0; let countMonths1 = 0;
    
    for(let i=1; i<=12; i++) { 
        const m = `${year1}-${i.toString().padStart(2, '0')}`; 
        const s = calculateMonthStats(m); 
        
        inc1.push(s.income); 
        stu1.push(s.studentCount); 
        
        if (year1 < currentYear || (year1 === currentYear && i <= currentMonthNum)) {
            sumInc1 += s.income; 
            sumStu1 += s.studentCount; 
            countMonths1++;
        }
    } 
    
    countMonths1 = countMonths1 === 0 ? 1 : countMonths1;
    
    const avgInc1 = sumInc1 / countMonths1; 
    const avgStu1 = sumStu1 / countMonths1; 
    
    const statsDiv = document.getElementById('yearlyAverages'); 
    let statsHtml = `
        <div><h4>Monthly Avg Income (${year1})</h4><p class="summary-collected">₹${avgInc1.toFixed(0)}</p></div>
        <div><h4>Monthly Avg Students (${year1})</h4><p class="summary-total" style="color:var(--text-main);">${Math.round(avgStu1)}</p></div>
    `; 
    
    const datasets = [ 
        { label: `Income ${year1}`, data: inc1, backgroundColor: 'rgba(16, 185, 129, 0.6)', borderColor: '#10b981', borderWidth: 1, type: 'bar', yAxisID: 'y' }, 
        { label: `Students ${year1}`, data: stu1, borderColor: '#3b82f6', borderWidth: 2, type: 'line', tension: 0.3, yAxisID: 'y1' } 
    ]; 
    
    if (year2) { 
        const inc2 = []; const stu2 = []; 
        let sumInc2 = 0; let sumStu2 = 0; let countMonths2 = 0;
        
        for(let i=1; i<=12; i++) { 
            const m = `${year2}-${i.toString().padStart(2, '0')}`; 
            const s = calculateMonthStats(m); 
            inc2.push(s.income); 
            stu2.push(s.studentCount); 
            
            if (year2 < currentYear || (year2 === currentYear && i <= currentMonthNum)) {
                sumInc2 += s.income; 
                sumStu2 += s.studentCount; 
                countMonths2++;
            }
        } 
        
        countMonths2 = countMonths2 === 0 ? 1 : countMonths2;
        const avgInc2 = sumInc2 / countMonths2; 
        const avgStu2 = sumStu2 / countMonths2; 
        
        statsHtml += `
            <div><h4>Monthly Avg Income (${year2})</h4><p class="summary-collected">₹${avgInc2.toFixed(0)}</p></div>
            <div><h4>Monthly Avg Students (${year2})</h4><p class="summary-total" style="color:var(--text-main);">${Math.round(avgStu2)}</p></div>
        `; 
        
        datasets.push({ label: `Income ${year2}`, data: inc2, backgroundColor: 'rgba(239, 68, 68, 0.6)', borderColor: '#ef4444', borderWidth: 1, type: 'bar', yAxisID: 'y' }); 
        datasets.push({ label: `Students ${year2}`, data: stu2, borderColor: '#f97316', borderWidth: 2, type: 'line', tension: 0.3, pointRadius: 3, yAxisID: 'y1' }); 
    } 
    
    statsDiv.innerHTML = statsHtml; 
    statsDiv.style.display = 'flex'; 
    
    const ctx = document.getElementById('yearlyChart').getContext('2d'); 
    if(analyticsChartInstance) analyticsChartInstance.destroy(); 
    analyticsChartInstance = new Chart(ctx, { 
        type: 'bar', 
        data: { labels: labels, datasets: datasets }, 
        options: { 
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, 
            plugins: { 
                legend: { position: 'bottom', labels: { color: getComputedStyle(document.body).getPropertyValue('--text-main') } }, 
                title: { display: true, text: year2 ? `${year1} vs ${year2}` : `Overview ${year1}`, color: getComputedStyle(document.body).getPropertyValue('--text-main') } 
            }, 
            scales: { 
                y: { beginAtZero: true, position: 'left', title: {display:true, text:'Income (₹)', color: getComputedStyle(document.body).getPropertyValue('--text-muted')}, ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-muted') } }, 
                y1: { beginAtZero: true, position: 'right', grid: {drawOnChartArea: false}, title: {display:true, text:'Students', color: getComputedStyle(document.body).getPropertyValue('--text-muted')}, ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-muted') } }, 
                x: { ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-muted') } } 
            } 
        } 
    }); 
}

function comparePeriods() { const m1 = document.getElementById('compMonth1').value; const m2 = document.getElementById('compMonth2').value; if(!m1 || !m2) { return; } const s1 = calculateMonthStats(m1); const s2 = calculateMonthStats(m2); document.getElementById('compIncome1').textContent = `₹${s1.income}`; document.getElementById('compIncome2').textContent = `₹${s2.income}`; document.getElementById('compStudent1').textContent = s1.studentCount; document.getElementById('compStudent2').textContent = s2.studentCount; const incDiff = s2.income - s1.income; const stuDiff = s2.studentCount - s1.studentCount; const incDiffEl = document.getElementById('compIncomeDiff'); incDiffEl.innerHTML = incDiff > 0 ? `<i class="fas fa-arrow-up"></i> ₹${incDiff}` : (incDiff < 0 ? `<i class="fas fa-arrow-down"></i> ₹${Math.abs(incDiff)}` : '-'); incDiffEl.className = 'comp-diff ' + (incDiff >= 0 ? 'diff-up' : 'diff-down'); const stuDiffEl = document.getElementById('compStudentDiff'); stuDiffEl.innerHTML = stuDiff > 0 ? `<i class="fas fa-arrow-up"></i> ${stuDiff}` : (stuDiff < 0 ? `<i class="fas fa-arrow-down"></i> ${Math.abs(stuDiff)}` : '-'); stuDiffEl.className = 'comp-diff ' + (stuDiff >= 0 ? 'diff-up' : 'diff-down'); document.getElementById('comparisonResults').style.display = 'block'; }

function exportDashboardPDF() { 
    const activeStudents = students.filter(s => s.status?.isActive); 
    const currentYear = new Date().getFullYear(); 
    const currentMonthStr = `${currentYear}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`; 
    let monthlyCollected = 0, monthlyDueAmount = 0, yearlyCollected = 0, yearlyDueAmount = 0; 
    
    students.forEach(student => { 
        for (let i = 0; i < 12; i++) { 
            const monthStr = `${currentYear}-${(i + 1).toString().padStart(2, '0')}`; 
            if (wasStudentActiveDuringMonth(student, monthStr)) { 
                if (fees[monthStr]?.[student.id]?.status === 'paid') { 
                    if (monthStr === currentMonthStr) monthlyCollected += fees[monthStr][student.id].amount; 
                    yearlyCollected += fees[monthStr][student.id].amount; 
                } else if (isMonthDue(monthStr)) { 
                    const studentFee = student.fee_amount || DEFAULT_FEE; 
                    if (monthStr === currentMonthStr) monthlyDueAmount += studentFee; 
                    yearlyDueAmount += studentFee; 
                } 
            } 
        } 
    }); 
    
    const classCounts = activeStudents.reduce((acc, student) => { const className = student.class || 'Unassigned'; acc[className] = (acc[className] || 0) + 1; return acc; }, {}); 
    const { jsPDF } = window.jspdf; const doc = new jsPDF(); let y = 20; doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.text(INSTITUTE_NAME, 105, y, {align: "center"}); y += 10; doc.setFontSize(14); doc.text("Complete Dashboard Report", 105, y, {align: "center"}); y += 8; doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 105, y, {align: "center"}); y += 15; doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Student Statistics", 15, y); y += 7; doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.text(`Total Students: ${students.length}`, 20, y); y += 6; doc.text(`Active Students: ${activeStudents.length}`, 20, y); y += 6; doc.text(`Inactive Students: ${students.length - activeStudents.length}`, 20, y); y += 12; doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Financial Overview", 15, y); y += 7; doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.text(`Current Month (${formatMonthYear(currentMonthStr)}) Collected: Rs. ${monthlyCollected}`, 20, y); y += 6; doc.text(`Current Month Due: Rs. ${monthlyDueAmount}`, 20, y); y += 6; doc.text(`Yearly Collected: Rs. ${yearlyCollected}`, 20, y); y += 6; doc.text(`Yearly Due: Rs. ${yearlyDueAmount}`, 20, y); y += 12; doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Class Strength", 15, y); y += 7; doc.setFontSize(11); doc.setFont("helvetica", "normal"); Object.entries(classCounts).sort().forEach(([className, count]) => { doc.text(`${className}: ${count} students`, 20, y); y += 6; }); addWatermarkAndSignatureToPdf(doc); doc.save(`Dashboard_Full_Report_${currentMonthStr}.pdf`); 
}

function toggleReportInputs() {
    const type = document.getElementById('reportType').value;
    if(type === 'monthly') {
        document.getElementById('reportMonth-group').style.display = 'block';
        document.getElementById('reportYear-group').style.display = 'none';
    } else {
        document.getElementById('reportMonth-group').style.display = 'none';
        document.getElementById('reportYear-group').style.display = 'block';
    }
}

function generateReport() { 
    const type = document.getElementById('reportType').value; 
    const summaryEl = document.getElementById('reportSummary'); 
    const tableEl = document.getElementById('reportTable'); 
    const searchBoxEl = document.getElementById('reportSearchBox'); 
    const tableHead = tableEl.querySelector('thead'); 
    const tableBody = tableEl.querySelector('tbody'); 
    const exportBtn = document.getElementById('exportReportBtn'); 
    
    tableHead.innerHTML = ''; tableBody.innerHTML = ''; 
    summaryEl.style.display = 'flex'; 
    tableEl.style.display = 'table'; 
    searchBoxEl.style.display = 'block'; 
    exportBtn.style.display = 'inline-block'; 
    
    let totalCollected = 0, totalDue = 0; 
    let collectedCount = 0, dueCount = 0; 
    
    if (type === 'monthly') { 
        const month = document.getElementById('reportMonth').value; 
        if (!month) return; 
        
        tableHead.innerHTML = `<tr><th>Student Name</th><th>Status</th><th>Amount</th><th>Action</th></tr>`; 
        const monthIsDue = isMonthDue(month); 
        
        students.forEach(student => { 
            if (!wasStudentActiveDuringMonth(student, month)) return; 
            
            const feeRecord = fees[month]?.[student.id]; 
            let status = 'Pending', amount = `₹0`, rowClass = 'pending'; 
            
            if (feeRecord?.status === 'paid') { 
                status = `Paid on ${new Date(feeRecord.date).toLocaleDateString('en-IN')}`; 
                amount = `₹${feeRecord.amount}`; 
                rowClass = 'paid'; 
                totalCollected += feeRecord.amount; 
                collectedCount++; 
            } else if (monthIsDue) { 
                status = 'Due'; 
                const studentFee = student.fee_amount || DEFAULT_FEE; 
                amount = `₹${studentFee}`; 
                rowClass = 'unpaid'; 
                totalDue += studentFee; 
                dueCount++; 
            } 
            
            tableBody.innerHTML += `<tr class="${rowClass}"><td>${getStudentHtml(student)}</td><td>${status}</td><td>${amount}</td><td class="action-buttons">${status === 'Due' ? getContactButtons(student.id, month) : ''}</td></tr>`; 
        }); 
        
        summaryEl.innerHTML = `
            <div onclick="showFeeBreakdown('collected', '${month}')" style="cursor:pointer; border:1px solid var(--success);">
                <h4>Total Collected</h4>
                <p class="summary-collected">₹${totalCollected} <span style="font-size:12px; color:var(--text-muted); display:block;">(${collectedCount} Students)</span></p>
            </div>
            <div onclick="showFeeBreakdown('due', '${month}')" style="cursor:pointer; border:1px solid var(--danger);">
                <h4>Total Due</h4>
                <p class="summary-due">₹${totalDue} <span style="font-size:12px; color:var(--text-muted); display:block;">(${dueCount} Students)</span></p>
            </div>
        `; 
        
    } else if (type === 'yearly') { 
        const year = document.getElementById('reportYear').value; 
        if (!year) return; 
        
        tableHead.innerHTML = `<tr><th>Student</th><th>Monthly History</th><th>Summary</th></tr>`; 
        
        students.forEach(student => { 
            let studentTotalPaid = 0; 
            let studentTotalDue = 0;
            let historyHtml = '';
            let hasActivityInYear = false; 

            for(let i=1; i<=12; i++) { 
                const monthStr = `${year}-${i.toString().padStart(2, '0')}`; 
                const monthName = new Date(year, i-1).toLocaleString('default', { month: 'short' });

                if (wasStudentActiveDuringMonth(student, monthStr)) { 
                    hasActivityInYear = true; 
                    
                    if (fees[monthStr]?.[student.id]?.status === 'paid') { 
                        const amt = fees[monthStr][student.id].amount;
                        studentTotalPaid += amt; 
                        historyHtml += `<span style="font-size:11px; color:var(--success); margin-right:5px;">${monthName}: ₹${amt} <i class="fas fa-check"></i></span><br>`;
                    } else if (isMonthDue(monthStr)) { 
                        const amt = student.fee_amount || DEFAULT_FEE;
                        studentTotalDue += amt;
                        historyHtml += `<span style="font-size:11px; color:var(--danger); margin-right:5px;">${monthName}: ₹${amt} (Due)</span><br>`;
                    } else {
                        historyHtml += `<span style="font-size:11px; color:var(--text-muted); margin-right:5px;">${monthName}: -</span><br>`;
                    }
                } 
            } 
            
            if(hasActivityInYear) { 
                totalCollected += studentTotalPaid; 
                totalDue += studentTotalDue; 
                
                if (studentTotalPaid > 0) collectedCount++; 
                if (studentTotalDue > 0) dueCount++; 
                
                tableBody.innerHTML += `
                    <tr>
                        <td>${getStudentHtml(student)}</td>
                        <td style="line-height:1.4;">${historyHtml || '<span style="color:var(--text-muted);">No Activity</span>'}</td>
                        <td>
                            <div style="font-size:12px;">
                                <div style="color:var(--success); font-weight:bold;">Paid: ₹${studentTotalPaid}</div>
                                <div style="color:var(--danger); font-weight:bold; margin-top:2px;">Due: ₹${studentTotalDue}</div>
                            </div>
                        </td>
                    </tr>`; 
            } 
        }); 
        
        summaryEl.innerHTML = `
            <div onclick="showYearlyBreakdown('collected', '${year}')" style="cursor:pointer; border:1px solid var(--success);">
                <h4>Total Collected</h4>
                <p class="summary-collected">₹${totalCollected} <span style="font-size:12px; color:var(--text-muted); display:block;">(${collectedCount} Students)</span></p>
            </div>
            <div onclick="showYearlyBreakdown('due', '${year}')" style="cursor:pointer; border:1px solid var(--danger);">
                <h4>Total Due</h4>
                <p class="summary-due">₹${totalDue} <span style="font-size:12px; color:var(--text-muted); display:block;">(${dueCount} Students)</span></p>
            </div>
        `; 
    } 
}

function exportReportPDF() { 
    const type = document.getElementById('reportType').value; const { jsPDF } = window.jspdf; const doc = new jsPDF(); let y = 20; 
    doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text(INSTITUTE_NAME, 105, y, {align: "center"}); y += 10; 
    
    if (type === 'monthly') { 
        const month = document.getElementById('reportMonth').value; if(!month) return; 
        doc.setFontSize(12); doc.text(`Monthly Report: ${formatMonthYear(month)}`, 105, y, {align: "center"}); y += 15; 
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); 
        doc.text("Student Name", 15, y); doc.text("Status", 80, y); doc.text("Amount", 150, y); 
        doc.line(15, y+2, 195, y+2); y += 8; 
        const monthIsDue = isMonthDue(month); let totalCollected = 0, totalDue = 0; 
        doc.setFont("helvetica", "normal"); 
        
        students.forEach(student => { 
            if (!wasStudentActiveDuringMonth(student, month)) return; 
            const feeRecord = fees[month]?.[student.id]; 
            let status = 'Pending', amount = '0'; 
            if (feeRecord?.status === 'paid') { 
                status = `Paid (${feeRecord.mode || 'Cash'})`; amount = `${feeRecord.amount}`; totalCollected += feeRecord.amount; 
            } else if (monthIsDue) { 
                status = 'Due'; const f = student.fee_amount || DEFAULT_FEE; amount = `${f}`; totalDue += f; 
            } 
            doc.text(student.name, 15, y); doc.text(status, 80, y); doc.text(amount, 150, y); y += 6; 
            if(y > 280) { doc.addPage(); y = 20; } 
        }); 
        
        y += 5; doc.line(15, y, 195, y); y += 8; doc.setFont("helvetica", "bold"); 
        doc.text(`Total Collected: ${totalCollected}`, 15, y); doc.text(`Total Due: ${totalDue}`, 80, y); 
        addWatermarkAndSignatureToPdf(doc); doc.save(`Monthly_Report_${month}.pdf`); 
        
    } else if (type === 'yearly') { 
        const year = document.getElementById('reportYear').value; if(!year) return; 
        doc.setFontSize(12); doc.text(`Yearly Report: ${year}`, 105, y, {align: "center"}); y += 15; 
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); 
        doc.text("Student Name", 15, y); doc.text("Total Paid", 90, y); doc.text("Total Due", 140, y); 
        doc.line(15, y+2, 195, y+2); y += 8; 
        let totalCollected = 0, totalDue = 0;
        doc.setFont("helvetica", "normal"); 
        
        students.forEach(student => { 
            let studentTotal = 0; let studentDue = 0; let hasActivity = false; 
            for(let i=1; i<=12; i++) { 
                const m = `${year}-${i.toString().padStart(2, '0')}`; 
                if (wasStudentActiveDuringMonth(student, m)) { 
                    hasActivity = true; 
                    if(fees[m]?.[student.id]?.status === 'paid') studentTotal += fees[m][student.id].amount; 
                    else if(isMonthDue(m)) studentDue += (student.fee_amount || DEFAULT_FEE);
                } 
            } 
            if(hasActivity) { 
                totalCollected += studentTotal; 
                totalDue += studentDue;
                doc.text(student.name, 15, y); doc.text(`${studentTotal}`, 90, y); doc.text(`${studentDue}`, 140, y); y += 6; 
                if(y > 280) { doc.addPage(); y = 20; } 
            } 
        }); 
        
        y += 5; doc.line(15, y, 195, y); y += 8; doc.setFont("helvetica", "bold"); 
        doc.text(`Grand Total Collected: ${totalCollected}`, 15, y); 
        doc.text(`Grand Total Due: ${totalDue}`, 90, y); 
        addWatermarkAndSignatureToPdf(doc); doc.save(`Yearly_Report_${year}.pdf`); 
    } 
}

function searchTable(inputId, tableId) { const input = document.getElementById(inputId), filter = input.value.toUpperCase(), table = document.getElementById(tableId), tr = table.getElementsByTagName("tr"); for (let i = 1; i < tr.length; i++) { const rowText = tr[i].textContent || tr[i].innerText; if (rowText.toUpperCase().indexOf(filter) > -1) { tr[i].style.display = ""; } else { tr[i].style.display = "none"; } } }

function switchStudentView(view) {
    currentStudentView = view;
    const activeBtn = document.getElementById('btnShowActive');
    const inactiveBtn = document.getElementById('btnShowInactive');
    const activeDiv = document.getElementById('activeStudentsContainer');
    const inactiveDiv = document.getElementById('inactiveStudentsContainer');

    if (view === 'active') {
        activeBtn.style.background = 'var(--primary)';
        activeBtn.style.color = 'white';
        inactiveBtn.style.background = 'transparent';
        inactiveBtn.style.color = 'var(--text-muted)';
        activeDiv.style.display = 'block';
        inactiveDiv.style.display = 'none';
    } else {
        activeBtn.style.background = 'transparent';
        activeBtn.style.color = 'var(--text-muted)';
        inactiveBtn.style.background = 'var(--secondary)';
        inactiveBtn.style.color = 'white';
        activeDiv.style.display = 'none';
        inactiveDiv.style.display = 'block';
    }
}
let studentDisplayLimit = 20;

function loadStudentsList(showAll = false) { 
    const activeList = document.getElementById('activeStudentsList');
    const inactiveList = document.getElementById('inactiveStudentsList');
    activeList.innerHTML = ''; inactiveList.innerHTML = '';
    
    let activeCount = 0;
    let inactiveCount = 0;

    students.forEach(student => { 
        const isActive = student.status?.isActive;
        
        if (!showAll) {
            if (isActive && activeCount >= studentDisplayLimit) return;
            if (!isActive && inactiveCount >= studentDisplayLimit) return;
        }

        const statusBtnText = isActive ? 'Deactivate' : 'Activate'; 
        const hasGlobalDue = checkGlobalDues(student.id); 
        
        let rowClass = '';
        if (!isActive) rowClass = 'inactive-student';
        if (isActive && hasGlobalDue) rowClass += ' has-dues-alert'; 
        
        let timeDisplay = ''; 
        if(student.class_time) { 
            const [h, m] = student.class_time.split(':'); const ampm = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 || 12; timeDisplay = `${h12}:${m} ${ampm}`; 
        } 
        const dayTimeStr = (student.class_day || student.class_time) ? `<br><span class="student-time-sub">${student.class_day || ''} ${timeDisplay}</span>` : ''; 
        
        const row = document.createElement('tr');
        if (rowClass) row.className = rowClass;
        
        row.innerHTML = `
            <td>${student.serial_no}</td>
            <td>${getStudentHtml(student)}</td>
            <td>${student.class || 'N/A'}${dayTimeStr}</td>
            <td>₹${student.fee_amount || DEFAULT_FEE}</td>
            <td style="min-width: 160px;">${getAllContactButtons(student)}</td>
            <td>${isActive ? 'Active' : 'Inactive'}</td>
            <td class="action-buttons">
                <button class="${isActive ? 'btn-info' : 'btn-success'}" onclick="openStatusChangeModal(${student.id}, ${!isActive})">${statusBtnText}</button> 
                <button class="btn-warning" onclick="openEditStudentModal(${student.id})">Edit</button>
            </td>`;
        
        if(isActive) { 
            activeList.appendChild(row); 
            activeCount++;
        } else { 
            inactiveList.appendChild(row); 
            inactiveCount++;
        }
    }); 

    if (!showAll) {
        const activeTotal = students.filter(s => s.status?.isActive).length;
        const inactiveTotal = students.filter(s => !s.status?.isActive).length;

        if (activeTotal > studentDisplayLimit) {
            activeList.innerHTML += `<tr><td colspan="7" style="text-align:center; padding:15px;"><button class="btn-secondary" onclick="loadMoreStudents()" style="width:100%; border-radius:8px;"><i class="fas fa-chevron-down"></i> Load More Students</button></td></tr>`;
        }
        if (inactiveTotal > studentDisplayLimit) {
            inactiveList.innerHTML += `<tr><td colspan="7" style="text-align:center; padding:15px;"><button class="btn-secondary" onclick="loadMoreStudents()" style="width:100%; border-radius:8px;"><i class="fas fa-chevron-down"></i> Load More Students</button></td></tr>`;
        }
    }
}

function loadMoreStudents() {
    studentDisplayLimit += 20; 
    loadStudentsList(false);
}

function filterStudentLists() {
    const input = document.getElementById('searchStudents');
    const filter = input.value.toUpperCase();
    
    if (filter.length > 0) {
        loadStudentsList(true); 
    } else {
        studentDisplayLimit = 20; 
        loadStudentsList(false);
    }

    searchTable('searchStudents', 'activeStudentsTable');
    searchTable('searchStudents', 'inactiveStudentsTable');
    
    const activeDiv = document.getElementById('activeStudentsContainer');
    const inactiveDiv = document.getElementById('inactiveStudentsContainer');
    
    if (filter.length > 0) {
        activeDiv.style.display = 'block';
        inactiveDiv.style.display = 'block';
    } else {
        switchStudentView(currentStudentView);
    }
}

async function saveFee() { 
    const studentId = parseInt(document.getElementById('feeStudentId').value); 
    let month = document.getElementById('feeRecordMonth').value; 
    const amount = parseFloat(document.getElementById('feeAmount').value); 
    const date = document.getElementById('feeDate').value; 
    const mode = document.getElementById('paymentMode').value; 
    const txnId = document.getElementById('transactionId').value.trim(); 
    
    if (isNaN(amount) || amount <= 0) { Swal.fire('Error','Invalid amount.', 'error'); return; } 
    if (!date) { Swal.fire('Error','Select date.', 'error'); return; } 
    
    const payTypeContainer = document.getElementById('payTypeContainer');
    const payTypeSelect = document.getElementById('payTypeSelect');
    let receiptNo = Date.now().toString().slice(-6); 
    
    let monthsToPay = [month];
    
    if (payTypeContainer.style.display !== 'none' && payTypeSelect.value === 'all') {
        monthsToPay = JSON.parse(payTypeSelect.dataset.dues || '[]');
    }

    const amountPerMonth = monthsToPay.length > 0 ? (amount / monthsToPay.length) : amount;

    monthsToPay.forEach(m => {
        if (!fees[m]) fees[m] = {}; 
        fees[m][studentId] = { status: 'paid', amount: amountPerMonth, date, mode: mode, transactionId: txnId, receiptNo: receiptNo }; 
    });

    await saveData(); 
    closeModal('feeModal'); 
    renderFees();
    
    const joinedMonths = monthsToPay.join(',');
    
    Swal.fire({ 
        title: 'Payment Recorded!', 
        html: `<p>Payment successful.</p>
               <div style="display:flex; gap:5px; justify-content:center; flex-wrap:wrap;">
                   <button class="btn-like btn-receipt" onclick="generatePaymentReceipt(${studentId}, '${joinedMonths}')">Receipt</button>
                   <button class="btn-like btn-whatsapp" onclick="sendMsg('wa', ${studentId}, '${joinedMonths}', ${amount}, false)">WhatsApp</button>
                   <button class="btn-like btn-sms" onclick="sendMsg('sms', ${studentId}, '${joinedMonths}', ${amount}, false)">SMS</button>
               </div>`, 
        icon: 'success', 
        showConfirmButton: true, 
        confirmButtonText: 'Close',
        confirmButtonColor: '#d33',
        allowOutsideClick: false 
    }); 
    loadAllData(); 
}

function renderFees() { 
    const selectedMonth = document.getElementById('feeMonth').value, tableBody = document.querySelector('#feeTable tbody'); 
    tableBody.innerHTML = ''; 
    if (!selectedMonth) return; 
    
    let totalCollected = 0, totalDueAmount = 0, dueCount = 0, collectedCount = 0; 
    const monthIsDue = isMonthDue(selectedMonth); 
    
    students.forEach(student => { 
        const wasActive = wasStudentActiveDuringMonth(student, selectedMonth); 
        if (!wasActive) return; 
        
        const feeRecord = fees[selectedMonth]?.[student.id];
        const isPaid = feeRecord?.status === 'paid'; 
        const hasGlobalDue = checkGlobalDues(student.id); 
        
        let rowClass = 'pending', statusText = 'Pending'; 
        
        if (isPaid) { 
            totalCollected += feeRecord.amount; 
            collectedCount++; 
            rowClass = 'paid'; 
            statusText = `Paid (₹${feeRecord.amount})`; 
        } else if (monthIsDue) { 
            dueCount++; 
            totalDueAmount += student.fee_amount || DEFAULT_FEE; 
            rowClass = 'unpaid'; 
            statusText = 'Due'; 
        } 
        
        if (hasGlobalDue) rowClass += ' has-dues-alert'; 
        
        const row = document.createElement('tr'); 
        row.className = rowClass; 
        
        let actionButtons = isPaid ? 
            `<button class="btn-receipt" onclick="generatePaymentReceipt(${student.id}, '${selectedMonth}')">Receipt</button> <button class="btn-warning" onclick="openFeeModal(${student.id}, '${selectedMonth}', true)">Edit</button><button class="btn-danger" onclick="unmarkFee(${student.id}, '${selectedMonth}')">Unmark</button>` 
            : `<button class="btn-success" onclick="openFeeModal(${student.id}, '${selectedMonth}')">Record Payment</button>` + (monthIsDue ? getContactButtons(student.id, selectedMonth) : ''); 
        
        row.innerHTML = `<td>${getStudentHtml(student)}</td><td>${statusText}</td><td class="action-buttons">${actionButtons}</td>`; 
        tableBody.appendChild(row); 
    }); 
    
    document.getElementById('feeSummary').innerHTML = `
        <div onclick="showFeeBreakdown('collected')">
            <h4>Collected (${collectedCount} students)</h4>
            <p class="summary-collected">₹${totalCollected}</p>
        </div>
        <div onclick="showFeeBreakdown('due')">
            <h4>Due (${dueCount} students)</h4>
            <p class="summary-due">₹${totalDueAmount}</p>
        </div>`; 
        
    searchTable('searchFees', 'feeTable'); 
}

async function generatePaymentReceipt(studentId, monthStrOrList) { 
    const student = students.find(s => s.id === studentId); 
    const monthArray = monthStrOrList.split(',');
    const baseMonth = monthArray[0];
    const feeRecord = fees[baseMonth]?.[studentId]; 
    if (!student || !feeRecord) return; 
    
    let totalPaidAmount = 0;
    monthArray.forEach(m => {
        if(fees[m]?.[studentId]?.status === 'paid') {
            totalPaidAmount += fees[m][studentId].amount;
        }
    });
    
    const displayMonths = monthArray.map(m => formatMonthYear(m)).join(", ");

    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [105, 148] }); 
    
    if (instituteLogo) { 
        doc.saveGraphicsState(); 
        doc.setGState(new doc.GState({ opacity: 0.08 })); 
        const imgDim = 80; const pageWidth = 105; const pageHeight = 148; 
        doc.addImage(instituteLogo, 'JPEG', (pageWidth - imgDim) / 2, (pageHeight - imgDim) / 2, imgDim, imgDim); 
        doc.restoreGraphicsState(); 
    } 
    
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.rect(5, 5, 95, 138); 
    let y = 15; 
    
    if (instituteLogo) { doc.addImage(instituteLogo, 'JPEG', 42.5, 8, 20, 20); y = 32; } 
    
    doc.setFontSize(13); doc.setFont("helvetica", "bold"); 
    const titleLines = doc.splitTextToSize(INSTITUTE_NAME, 90); 
    doc.text(titleLines, 52.5, y, {align: "center"}); 
    y += (titleLines.length * 5) + 2; 
    
    doc.setFontSize(11); doc.setFont("helvetica", "normal"); 
    doc.text("PAYMENT RECEIPT", 52.5, y, {align: "center"}); 
    doc.setLineWidth(0.2); doc.line(30, y+1, 75, y+1); y += 10; 
    
    const labelX = 12; const valueX = 48; const lineH = 7; 
    doc.setFontSize(10); 
    
    doc.setFont("helvetica", "normal"); doc.text(`Receipt No:`, labelX, y); 
    const rNo = feeRecord.receiptNo || "LEGACY-" + Math.floor(new Date(feeRecord.date).getTime()/10000).toString().slice(-4);
    doc.setFont("helvetica", "bold"); doc.text(`${rNo}`, valueX, y); y += lineH; 
    
    doc.setFont("helvetica", "normal"); doc.text(`Date:`, labelX, y); 
    const paymentDate = feeRecord.date ? new Date(feeRecord.date).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
    doc.setFont("helvetica", "bold"); doc.text(`${paymentDate}`, valueX, y); y += lineH; 
    
    doc.setFont("helvetica", "normal"); doc.text(`Student Name:`, labelX, y); 
    doc.setFont("helvetica", "bold"); doc.text(student.name, valueX, y); y += lineH; 
    
    doc.setFont("helvetica", "normal"); doc.text(`Class/Instrument:`, labelX, y); 
    doc.setFont("helvetica", "bold"); doc.text(student.class || 'N/A', valueX, y); y += lineH; 
    
    doc.setFont("helvetica", "normal"); doc.text(`Fees For Month(s):`, labelX, y); 
    doc.setFont("helvetica", "bold"); 
    const monthLines = doc.splitTextToSize(displayMonths, 45); 
    doc.text(monthLines, valueX, y); 
    y += (monthLines.length * 4) + 3; 
    
    doc.setFont("helvetica", "normal"); doc.text(`Payment Mode:`, labelX, y); 
    doc.setFont("helvetica", "bold"); doc.text(feeRecord.mode || 'Cash', valueX, y); y += lineH; 
    
    if (feeRecord.transactionId) { 
        doc.setFont("helvetica", "normal"); doc.text(`Transaction ID:`, labelX, y); 
        doc.setFont("helvetica", "bold"); 
        const txnLines = doc.splitTextToSize(feeRecord.transactionId, 50); 
        doc.text(txnLines, valueX, y); y += (txnLines.length * 5) + 2; 
    } else { y += 2; }
    
    y += 2; doc.setDrawColor(200); doc.setFillColor(245, 247, 250);
    doc.rect(10, y, 85, 12, 'FD'); 
    doc.setTextColor(0); doc.setFontSize(11); doc.setFont("helvetica", "normal"); 
    doc.text(`Amount Received:`, 15, y+8); 
    doc.setFontSize(14); doc.setFont("helvetica", "bold"); 
    doc.text(`Rs. ${totalPaidAmount}/-`, 90, y+8, {align: 'right'}); 
    
    let sigBaseY = 135; 
    if (authorizedSignature) { doc.addImage(authorizedSignature, 'PNG', 55, sigBaseY - 16, 35, 12); } 
    
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); 
    doc.text(`Authorized Signature`, 72, sigBaseY, {align:"center"}); 
    doc.setFont("helvetica", "italic"); 
    doc.text(`(${MY_NAME})`, 72, sigBaseY + 4, {align:"center"}); 

    const fileName = `Receipt_${student.name.replace(/\s+/g, '_')}.pdf`; 
    if (navigator.canShare && navigator.share) { 
        const pdfBlob = doc.output('blob'); const file = new File([pdfBlob], fileName, { type: 'application/pdf' }); 
        if (navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Fee Receipt', text: `Payment receipt for ${student.name}` }); } catch (err) { doc.save(fileName); } } else { doc.save(fileName); } 
    } else { doc.save(fileName); } 
}

async function generateIDCard() { 
    const name = document.getElementById('modalStudentName').textContent; 
    const serial = document.getElementById('modalSerialNo').textContent; 
    const student = students.find(s => s.serial_no == serial); 
    if (!student) return; 
    
    const issueDateInput = document.getElementById('idCardIssueDate').value; 
    const endDateInput = document.getElementById('idCardEndDate').value; 
    const issueDateStr = issueDateInput ? new Date(issueDateInput).toLocaleDateString('en-IN') : 'N/A'; 
    const endDateStr = endDateInput ? new Date(endDateInput).toLocaleDateString('en-IN') : null; 
    const dobStr = student.dob ? new Date(student.dob).toLocaleDateString('en-IN') : '-'; 
    
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [86, 54] }); 
    
    doc.setFillColor(24, 75, 115);
    doc.rect(0, 0, 30, 54, 'F'); 
    
    if (student.photo) { 
        doc.addImage(student.photo, 'JPEG', 5, 5, 20, 20); 
        doc.setDrawColor(0, 0, 0); 
        doc.setLineWidth(0.6);
        doc.rect(5, 5, 20, 20);
    } else { 
        doc.setFillColor(200, 200, 200); 
        doc.rect(5, 5, 20, 20, 'F');
        doc.setFontSize(8); 
        doc.setTextColor(0);
        doc.text("No Photo", 15, 16, {align: 'center'}); 
    } 

    try {
        const baseUrl = window.location.origin + window.location.pathname;
        const qrText = `${baseUrl}?student=${student.id}&manager=${DOC_ID}`;
        const qr = new QRious({ value: qrText, size: 250, level: 'M' });
        doc.addImage(qr.toDataURL('image/jpeg'), 'JPEG', 6, 28, 18, 18);
    } catch(e) { console.error("QR Code generation failed for ID Card", e); }
    
    if (instituteLogo) { 
        doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: 0.1 })); 
        doc.addImage(instituteLogo, 'JPEG', 40, 9, 36, 36); doc.restoreGraphicsState(); 
    } 
    
    doc.setTextColor(0, 0, 0); doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); 
    const headerLines = doc.splitTextToSize(INSTITUTE_NAME, 52); 
    doc.text(headerLines, 58, 6, {align: "center"}); 
    doc.setDrawColor(24, 75, 115); doc.setLineWidth(0.5); doc.line(33, 12, 83, 12); 
    
    let yText = 16; const labelX = 33; const valX = 46; 
    const addField = (label, val) => { 
        doc.setFont("helvetica", "bold"); doc.text(label, labelX, yText); 
        doc.setFont("helvetica", "normal"); 
        const valLines = doc.splitTextToSize(val, 38);
        doc.text(valLines, valX, yText); 
        yText += (valLines.length * 3.5); 
    };
    
    addField("Name:", student.name); 
    addField("ID No:", student.serial_no.toString()); 
    addField("Class:", student.class || '-'); 
    addField("Phone:", student.phone || '-');
    
    doc.setFont("helvetica", "bold"); doc.text("Addr:", labelX, yText); doc.setFont("helvetica", "normal"); 
    const addrLines = doc.splitTextToSize(student.address || '-', 38); 
    doc.text(addrLines, valX, yText); 
    yText += (addrLines.length * 3) + 1; 
    
    doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); 
    let validText = `Issued: ${issueDateStr}`; if (endDateStr) validText += ` | Valid: ${endDateStr}`; 
    doc.text(validText, 33, yText); 

    if (authorizedSignature) { doc.addImage(authorizedSignature, 'PNG', 65, 36, 18, 6); } 
    doc.setFontSize(6); doc.setFont("helvetica", "bold"); doc.text("Auth. Signature:", 83, 43, {align: "right"}); 
    doc.setFont("helvetica", "italic"); doc.text("Srikanta Banerjee", 83, 46, {align: "right"}); 
    
    doc.setFillColor(67, 160, 130); doc.rect(30, 49, 56, 5, 'F'); 
    doc.setTextColor(255, 255, 255); doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.text("AUTHORIZED STUDENT CARD", 58, 52.5, {align: "center"}); 

    const fileName = `ID_Card_${student.name}.pdf`; 
    if (navigator.canShare && navigator.share) { 
        const pdfBlob = doc.output('blob'); const file = new File([pdfBlob], fileName, { type: 'application/pdf' }); 
        if (navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Student ID Card', text: `ID Card for ${student.name}` }); } catch (err) { doc.save(fileName); } } else { doc.save(fileName); } 
    } else { doc.save(fileName); } 
}

function renderAttendance() { 
    const dateInput = document.getElementById('attendanceDate').value;
    const tableBody = document.querySelector('#attendanceTable tbody'); 
    tableBody.innerHTML = ''; 
    if (!dateInput) return; 

    const selectedDate = new Date(dateInput);
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = days[selectedDate.getDay()];

    const timeInput = document.getElementById('attendanceTime');
    if(!timeInput.value) {
       const now = new Date(); 
       timeInput.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }

    let totalActive = 0, presentCount = 0, absentCount = 0;

    const activeStudents = students.filter(s => s.status?.isActive);

    activeStudents.sort((a, b) => {
        const getScore = (student) => {
            const entry = attendance[dateInput]?.[student.id];
            const status = (typeof entry === 'object' && entry !== null) ? entry.status : entry;
            
            if (status === 'present') return 4; 
            if (status === 'absent') return 3;  
            if (student.class_day === currentDayName) return 2; 
            return 1; 
        };
        return getScore(b) - getScore(a); 
    });

    activeStudents.forEach(student => { 
        totalActive++; 

        const entry = attendance[dateInput]?.[student.id];
        const status = (typeof entry === 'object' && entry !== null) ? entry.status : entry; 
        const note = (typeof entry === 'object' && entry?.note) ? entry.note : '';
        
        if (status === 'present') presentCount++;
        else if (status === 'absent') absentCount++;

        const statusText = status === 'present' ? 'Present' : (status === 'absent' ? 'Absent' : 'Not Marked');
        const statusClass = status === 'present' ? 'status-present' : (status === 'absent' ? 'status-absent' : ''); 
        
        const isToday = student.class_day === currentDayName;
        const highlightStyle = isToday ? 'border: 1px solid var(--primary); background: rgba(79, 70, 229, 0.05);' : '';

        const noteBtnColor = note ? 'btn-warning' : 'btn-secondary';
        const row = document.createElement('tr');
        if (highlightStyle) row.style.cssText = highlightStyle;
        
        if (checkGlobalDues(student.id)) row.classList.add('has-dues-alert'); 
        
        row.innerHTML = `
            <td>
                ${getStudentHtml(student)}
                <div style="font-size:11px; color:#d97706; margin-top:2px; margin-left:55px;">
                    ${note ? '📝 ' + note : ''}
                </div>
            </td>
            <td class="${statusClass}">${statusText}</td>
            <td class="action-buttons">
                <button class="btn-success" onclick="markAttendance(${student.id}, 'present')">P</button>
                <button class="btn-danger" onclick="markAttendance(${student.id}, 'absent')">A</button>
                <button class="${noteBtnColor}" onclick="addAttendanceNote(${student.id})" title="Edit Note"><i class="fas fa-pencil-alt"></i></button>
                <button class="btn-secondary" onclick="markAttendance(${student.id}, 'clear')">X</button>
            </td>`;
        tableBody.appendChild(row);
    }); 

    if(document.getElementById('attTotalCount')) document.getElementById('attTotalCount').textContent = totalActive;
    if(document.getElementById('attPresentCount')) document.getElementById('attPresentCount').textContent = presentCount;
    if(document.getElementById('attAbsentCount')) document.getElementById('attAbsentCount').textContent = absentCount;

    searchTable('searchAttendance', 'attendanceTable'); 
}

function markAttendance(studentId, status) {
    const date = document.getElementById('attendanceDate').value; 
    if (!date) { Swal.fire('Alert','Please select a date.', 'warning'); return; } 
    
    if (!attendance[date]) attendance[date] = {}; 
    
    const currentEntry = attendance[date][studentId];
    let existingNote = '';
    
    if (typeof currentEntry === 'object' && currentEntry !== null && currentEntry.note) {
        existingNote = currentEntry.note;
    }

    if (status === 'clear') { 
        if (existingNote) {
            attendance[date][studentId] = { status: null, time: '', note: existingNote };
        } else {
            delete attendance[date][studentId]; 

            const user = firebase.auth().currentUser;
            if(user) {
                const deletePath = `attendance.${date}.${studentId}`;
                db.collection(COLLECTION_NAME).doc(user.uid).update({
                    [deletePath]: firebase.firestore.FieldValue.delete()
                }).catch(e => console.log("Delete queued for offline sync."));
            }
        }
    } else {
        let timeToSave = document.getElementById('attendanceTime').value; 
        if (!timeToSave) { 
            const now = new Date(); 
            timeToSave = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`; 
        }
        
        attendance[date][studentId] = { 
            status: status, 
            time: timeToSave,
            note: existingNote 
        }; 
    }
    
    renderAttendance(); 
    saveData().catch(err => console.log("Background Sync Pending...")); 
}

async function addAttendanceNote(studentId) {
    const date = document.getElementById('attendanceDate').value;
    if (!date) { Swal.fire('Alert', 'Please select a date first.', 'warning'); return; }
    
    const currentEntry = attendance[date]?.[studentId] || {};
    const existingNote = currentEntry.note || '';

    const { value: text } = await Swal.fire({
        title: 'Class Progress Note',
        input: 'textarea',
        inputLabel: 'আজ ক্লাসে কি শেখানো হলো?',
        inputValue: existingNote,
        placeholder: 'যেমন: C Major Scale শেখানো হয়েছে...',
        showCancelButton: true,
        confirmButtonText: 'Save Note',
        confirmButtonColor: 'var(--primary)',
        allowOutsideClick: false 
    });

    if (text !== undefined) {
        if (!attendance[date]) attendance[date] = {};
        
        attendance[date][studentId] = {
            ...currentEntry, 
            note: text
        };
        
        renderAttendance();
        saveData().catch(e => console.log("Note saved locally, syncing later."));

        if (text.trim() !== "") {
            const student = students.find(s => s.id === studentId);
            const safeNote = text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            
            Swal.fire({
                title: 'Note Saved!',
                html: `
                    <p style="font-size:14px; color:#666;">Send to <b>${student.name}</b>?</p>
                    <div style="display:flex; gap:10px; justify-content:center; margin-top:15px;">
                        <button class="btn-whatsapp" onclick="sendNoteAction('wa', ${studentId}, '${safeNote}', '${date}')" style="padding:10px 20px !important;">
                            <i class="fab fa-whatsapp"></i> WhatsApp
                        </button>
                        <button class="btn-sms" onclick="sendNoteAction('sms', ${studentId}, '${safeNote}', '${date}')" style="padding:10px 20px !important;">
                            <i class="fas fa-sms"></i> SMS
                        </button>
                    </div>
                `,
                icon: 'success',
                showConfirmButton: true,
                confirmButtonText: 'Close',
                confirmButtonColor: '#d33'
            });
        } else {
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
            Toast.fire({ icon: 'success', title: 'Note cleared' });
        }
    }
}

async function unmarkFee(studentId, month) { 
    Swal.fire({ 
        title: 'Unmark Payment?', 
        text: "Are you sure you want to delete this payment?", 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonText: 'Yes, Delete',
        cancelButtonText: 'No',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        allowOutsideClick: false 
    }).then(async (result) => { 
        if (result.isConfirmed) {
            
            if (fees[month] && fees[month][studentId]) { 
                delete fees[month][studentId]; 
            }
            
            renderFees(); 

            const user = firebase.auth().currentUser;
            if (user) {
                const fieldPath = `fees.${month}.${studentId}`;
                db.collection(COLLECTION_NAME).doc(user.uid).update({
                    [fieldPath]: firebase.firestore.FieldValue.delete()
                }).catch(err => console.log("Offline mode: Delete queued for sync."));
            }

            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
            Toast.fire({ icon: 'success', title: 'Payment removed' });
        } 
    }); 
}
        
function getOldestUnpaidMonth(studentId, selectedMonthStr) {
    const s = students.find(x => x.id === studentId);
    if (!s) return selectedMonthStr;
    
    let iterDate = new Date(s.joining_date);
    if(isNaN(iterDate.getTime())) return selectedMonthStr;
    
    iterDate.setDate(1); 
    const targetDate = new Date(selectedMonthStr + '-01');

    while (iterDate <= targetDate) {
        const y = iterDate.getFullYear();
        const m = iterDate.getMonth() + 1;
        const monthStr = `${y}-${m.toString().padStart(2, '0')}`;
        
        if (wasStudentActiveDuringMonth(s, monthStr)) {
            if (fees[monthStr]?.[studentId]?.status !== 'paid') {
                return monthStr; 
            }
        }
        iterDate.setMonth(iterDate.getMonth() + 1);
    }
    return selectedMonthStr; 
}

function getDueMonthsRawList(studentId) {
    const s = students.find(x => x.id === studentId); 
    if (!s) return []; 
    const dueMonthsRaw = []; 
    const now = new Date(); 
    let iterDate = new Date(s.joining_date);
    if(isNaN(iterDate.getTime())) return [];
    iterDate.setDate(1);
    while (iterDate <= now) { 
        const y = iterDate.getFullYear(); 
        const m = iterDate.getMonth() + 1; 
        const monthStr = `${y}-${m.toString().padStart(2, '0')}`; 
        if (wasStudentActiveDuringMonth(s, monthStr) && isMonthDue(monthStr) && fees[monthStr]?.[studentId]?.status !== 'paid') { 
            dueMonthsRaw.push(monthStr); 
        } 
        iterDate.setMonth(iterDate.getMonth() + 1); 
    } 
    return dueMonthsRaw; 
}

function updateFeeAmountBasedOnType() {
    const select = document.getElementById('payTypeSelect');
    const amountInput = document.getElementById('feeAmount');
    const title = document.getElementById('feeModalTitle');
    if (select.value === 'all') {
        amountInput.value = select.dataset.allAmount;
        title.textContent = `Record Fee (All Pending Dues)`;
    } else {
        amountInput.value = select.dataset.singleAmount;
        const rawDues = JSON.parse(select.dataset.dues || '[]');
        if(rawDues.length > 0) {
            title.textContent = `Record Fee (${formatMonthYear(rawDues[0])})`;
        }
    }
}

function openFeeModal(studentId, month, isEdit = false) { 
    const modal = document.getElementById('feeModal');
    const amountInput = document.getElementById('feeAmount');
    const dateInput = document.getElementById('feeDate'); 
    const txnInput = document.getElementById('transactionId'); 
    const payTypeContainer = document.getElementById('payTypeContainer');
    const payTypeSelect = document.getElementById('payTypeSelect');
    
    let targetMonth = month;
    const student = students.find(s => s.id === studentId); 
    if(!student) return;

    document.getElementById('feeStudentId').value = studentId; 

    if (!isEdit) {
        const dueMonthsRaw = getDueMonthsRawList(studentId);
        if (dueMonthsRaw.length > 1) {
            payTypeContainer.style.display = 'block';
            payTypeSelect.value = 'single';
            targetMonth = dueMonthsRaw[0]; 
            payTypeSelect.dataset.dues = JSON.stringify(dueMonthsRaw);
            payTypeSelect.dataset.singleAmount = student.fee_amount || DEFAULT_FEE;
            payTypeSelect.dataset.allAmount = dueMonthsRaw.length * (student.fee_amount || DEFAULT_FEE);
        } else {
            payTypeContainer.style.display = 'none';
            if(dueMonthsRaw.length === 1) targetMonth = dueMonthsRaw[0];
        }
    } else {
        payTypeContainer.style.display = 'none';
    }

    document.getElementById('feeRecordMonth').value = targetMonth; 
    
    if (isEdit) { 
        const record = fees[targetMonth]?.[studentId]; 
        document.getElementById('feeModalTitle').textContent = `Edit Fee (${formatMonthYear(targetMonth)})`; 
        amountInput.value = record ? record.amount : (student.fee_amount || DEFAULT_FEE); 
        txnInput.value = record ? (record.transactionId || '') : ''; 
    } else { 
        document.getElementById('feeModalTitle').textContent = `Record Fee (${formatMonthYear(targetMonth)})`; 
        amountInput.value = payTypeContainer.style.display === 'block' && payTypeSelect.value === 'all' 
                          ? payTypeSelect.dataset.allAmount 
                          : (student.fee_amount || DEFAULT_FEE); 
        txnInput.value = ''; 
    } 
    
    dateInput.valueAsDate = new Date(); 
    modal.style.display = 'flex'; 
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
    
    const previewImg = document.getElementById('editPhotoPreview');
    if(student.photo) { previewImg.src = student.photo; } 
    else { previewImg.src = 'https://via.placeholder.com/100?text=No+Photo'; } 
    
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
    
    let studentAtt = [];
    Object.keys(attendance).forEach(date => { if (attendance[date]?.[id]) studentAtt.push({ date, data: attendance[date][id] }); });
    let studentFees = [];
    Object.keys(fees).forEach(month => { if (fees[month]?.[id]) studentFees.push({ month, data: fees[month][id] }); });
    student.portal_data = { attendance: studentAtt, fees: studentFees };
    
    if(currentEditPhotoBase64) { student.photo = currentEditPhotoBase64; } 
    else if (isPhotoDeletedInEdit) { student.photo = null; }
    
    if(currentStudentSignature) { student.student_signature = currentStudentSignature; }

    students[studentIndex] = student;

    await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(id)).set(student);
    
    closeModal('editStudentModal'); 
    loadAllData(); 
    Swal.fire('Saved', 'Details updated successfully.', 'success'); 
}

function showStudentDetails(studentId) { 
    const student = students.find(s => s.id === studentId); 
    if (!student) return; 
    currentlyViewingStudentId = studentId;

    document.getElementById('modalStudentName').textContent = student.name; 
    document.getElementById('modalSerialNo').textContent = student.serial_no; 
    
    const className = student.class || 'Music Class';
    document.getElementById('modalClass').innerHTML = `<span style="display: inline-block; background: #000000; color: #ffffff; padding: 5px 15px; border-radius: 20px; font-size: 13px; font-weight: 500; margin-top: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">🎵 ${className}</span>`;
    document.getElementById('modalDayTime').textContent = (student.class_day || '') + " " + (student.class_time ? formatTime12H(student.class_time) : ''); 
    document.getElementById('modalFeeAmount').textContent = `₹${student.fee_amount || DEFAULT_FEE}`; 
    document.getElementById('modalGuardianName').textContent = student.guardian || 'N/A'; 
    document.getElementById('modalPhone').innerHTML = student.phone ? `${student.phone}` : 'N/A'; 
    document.getElementById('modalEmail').innerHTML = student.email ? `${student.email}` : 'N/A'; 
    document.getElementById('modalAddress').textContent = student.address || 'N/A'; 
    const currentNotice = student.personal_notice || '';
    document.getElementById('currentNoticeDisplay').innerHTML = currentNotice ? `Current Notice: <span>${currentNotice}</span>` : 'No active notice.';
    document.getElementById('personalNoticeInput').value = currentNotice;
    
    let dobDisplay = 'N/A';
    if(student.dob) {
        const dateStr = new Date(student.dob).toLocaleDateString('en-IN');
        const ageStr = calculateAge(student.dob);
        
        dobDisplay = `${dateStr} <br><span style="font-size:11px; color: #000000; font-weight:600; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block;">(Age: ${ageStr})</span>`;
    }
    document.getElementById('modalDOB').innerHTML = dobDisplay; 
    
    document.getElementById('modalJoiningDate').textContent = new Date(student.joining_date).toLocaleDateString('en-IN'); 
    
    const modalImg = document.getElementById('modalStudentPhoto'); 
    if(student.photo) { modalImg.src = student.photo; modalImg.style.display = 'inline-block'; } 
    else { modalImg.src = 'https://via.placeholder.com/100?text=No+Photo'; } 

    const viewSigBtn = document.getElementById('btnViewSignature');
    if (viewSigBtn) {
        viewSigBtn.onclick = function() {
            if (student.student_signature) {
                Swal.fire({
                    title: 'Digital Signature',
                    text: student.name,
                    imageUrl: student.student_signature,
                    imageWidth: 300,
                    imageAlt: 'Signature',
                    confirmButtonText: 'Close',
                    background: '#fff',
                    position: 'center',
                    target: 'body'
                });
            } else {
                Swal.fire({
                    title: 'No Signature Found',
                    text: 'This student has not added a digital signature yet.',
                    icon: 'warning',
                    confirmButtonText: 'Okay',
                    position: 'center',
                    target: 'body'
                });
            }
        };
    }
    
    const historyList = document.getElementById('modalStatusHistory'); historyList.innerHTML = ''; 
    if (student.status.history && student.status.history.length > 0) { 
        student.status.history.forEach(entry => { const color = entry.status === 'Active' ? 'green' : 'red'; historyList.innerHTML += `<li><strong style="color:${color};">${entry.status}</strong> on ${new Date(entry.date).toLocaleDateString('en-IN')}<br><em style="font-size:0.9em;color:var(--text-muted);">Note: ${entry.note || 'No note'}</em></li>`; }); 
    } else { historyList.innerHTML = '<li>No history found.</li>'; } 
    
    const yearSelect = document.getElementById('detailsFilterYear'); const monthSelect = document.getElementById('detailsFilterMonth'); yearSelect.innerHTML = ''; monthSelect.innerHTML = '';
    const currentYear = new Date().getFullYear(); const joinYear = new Date(student.joining_date).getFullYear();
    for(let y = currentYear; y >= joinYear; y--) { const opt = document.createElement('option'); opt.value = y; opt.text = y; yearSelect.appendChild(opt); }
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthNames.forEach((m, idx) => { const opt = document.createElement('option'); opt.value = idx + 1; opt.text = m; if(idx === new Date().getMonth()) opt.selected = true; monthSelect.appendChild(opt); });
    renderStudentDetailsHistory();
    document.getElementById('exportPdfBtn').onclick = () => exportStudentDetailsAsPDF(studentId); 
    renderStudentNotes(studentId);
    renderStudyMaterials(studentId); 
    document.getElementById('studentDetailsModal').style.display = 'flex'; 
}

function renderStudentDetailsHistory() {
    if(!currentlyViewingStudentId) return;
    const student = students.find(s => s.id === currentlyViewingStudentId); if(!student) return;
    
    const selectedYear = parseInt(document.getElementById('detailsFilterYear').value);
    const selectedMonth = parseInt(document.getElementById('detailsFilterMonth').value);
    
    const presentList = document.getElementById('modalPresentList'), absentList = document.getElementById('modalAbsentList'); 
    presentList.innerHTML = absentList.innerHTML = ''; 
    
    Object.keys(attendance).sort().reverse().forEach(date => { 
        const d = new Date(date);
        if(d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth) {
            const entry = attendance[date]?.[student.id];
            if(entry) {
                const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' });
                let timeStr = ''; let status = entry;
                if(typeof entry === 'object' && entry !== null) {
                    status = entry.status;
                    if(entry.time) { timeStr = ` (${formatTime12H(entry.time)})`; }
                }
                const formattedDate = `${d.toLocaleDateString('en-IN')} (${dayName})${timeStr}`;
                if (status === 'present') { presentList.innerHTML += `<li style="padding:2px 0; border-bottom:1px solid #f9f9f9;">${formattedDate}</li>`; } 
                else if (status === 'absent') { absentList.innerHTML += `<li style="padding:2px 0; border-bottom:1px solid #f9f9f9;">${formattedDate}</li>`; }
            }
        }
    }); 
    
    if(!presentList.innerHTML) presentList.innerHTML = '<li>No records found</li>'; 
    if(!absentList.innerHTML) absentList.innerHTML = '<li>No records found</li>'; 
    
    const paidList = document.getElementById('modalPaidList'); 
    paidList.innerHTML = ''; 

    for (let i = 1; i <= 12; i++) {
        const monthNum = i.toString().padStart(2, '0');
        const monthStr = `${selectedYear}-${monthNum}`;
        const monthName = new Date(selectedYear, i - 1).toLocaleString('default', { month: 'short' });
        
        let content = '';
        let style = 'padding: 8px 0; border-bottom: 1px solid #eee; font-size: 12px; display: flex; justify-content: space-between; align-items: flex-start;';

        if(wasStudentActiveDuringMonth(student, monthStr)) {
             const feeRecord = fees[monthStr]?.[student.id]; 
             
             if (feeRecord?.status === 'paid') { 
                 let modeInfo = feeRecord.mode ? ` <span style="color:#666; font-size:11px;">(${feeRecord.mode})</span>` : '';
                 
                 let txnDisplay = '';
                 if(feeRecord.transactionId) {
                     txnDisplay = `<div style="font-size:10px; color:#4f46e5; margin-top:2px;">Txn: ${feeRecord.transactionId}</div>`;
                 }

                 content = `
                    <div style="flex:1;">
                        <strong>${monthName}:</strong> <span style="color:var(--success);">Paid ₹${feeRecord.amount}</span>${modeInfo}
                        ${txnDisplay}
                    </div>
                    <div style="font-size:10px; color:gray; text-align:right;">
                        ${new Date(feeRecord.date).toLocaleDateString('en-IN')}
                    </div>
                 `;
             } 
             else if (isMonthDue(monthStr)) { 
                 content = `<span><strong>${monthName}:</strong> <span style="color:var(--danger); font-weight:bold;">Due</span></span>`;
                 style += ' background-color: rgba(239, 68, 68, 0.05);'; 
             }
             else { 
                 const today = new Date();
                 const checkDate = new Date(selectedYear, i, 0);
                 if (checkDate > today) {
                     content = `<span style="color:gray;">${monthName}: Upcoming</span>`;
                 } else {
                     content = `<span>${monthName}: Pending/Not Due</span>`;
                 }
             }
        } else {
             content = `<span style="color:#ccc;">${monthName}: Inactive</span>`;
        }

        paidList.innerHTML += `<li style="${style}">${content}</li>`;
    }
}
        
function resetApp() { 
    Swal.fire({ title: 'Are you sure?', text: "This will permanently delete ALL data!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Yes, Reset Everything!' }).then(async (result) => { 
        if (result.isConfirmed) { await dbClear(); localStorage.clear(); Swal.fire('Deleted!', 'Application has been reset. Reloading...', 'success').then(() => { window.location.reload(); }); } 
    }) 
}

function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }

async function exportToExcel() {
    const studentData = students.map(s => ({
        ID: s.serial_no,
        Name: s.name,
        Class: s.class,
        Fee: s.fee_amount,
        Phone: s.phone,
        Guardian: s.guardian,
        Status: s.status?.isActive ? 'Active' : 'Inactive',
        JoiningDate: s.joining_date
    }));

    const feeData = [];
    Object.keys(fees).forEach(month => {
        Object.keys(fees[month]).forEach(studentId => {
            const s = students.find(st => st.id == studentId);
            if (s) {
                const rec = fees[month][studentId];
                feeData.push({
                    Month: month,
                    StudentName: s.name,
                    Amount: rec.amount,
                    Date: rec.date,
                    Mode: rec.mode,
                    TxnID: rec.transactionId || ''
                });
            }
        });
    });

    const attendData = [];
    Object.keys(attendance).forEach(date => {
        Object.keys(attendance[date]).forEach(studentId => {
            const s = students.find(st => st.id == studentId);
            if (s) {
                const entry = attendance[date][studentId];
                const status = (typeof entry === 'object') ? entry.status : entry;
                const note = (typeof entry === 'object') ? entry.note : '';
                attendData.push({
                    Date: date,
                    StudentName: s.name,
                    Status: status,
                    ProgressNote: note 
                });
            }
        });
    });

    const wb = XLSX.utils.book_new();
    
    const wsStudents = XLSX.utils.json_to_sheet(studentData);
    XLSX.utils.book_append_sheet(wb, wsStudents, "Students List");

    const wsFees = XLSX.utils.json_to_sheet(feeData);
    XLSX.utils.book_append_sheet(wb, wsFees, "Fee Records");

    const wsAttend = XLSX.utils.json_to_sheet(attendData);
    XLSX.utils.book_append_sheet(wb, wsAttend, "Attendance & Notes");

    const fileName = `MusicClass_Data_${new Date().toISOString().split('T')[0]}.xlsx`;

    try {
        if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{
                    description: 'Excel File',
                    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
                }],
            });
            const writable = await handle.createWritable();
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            await writable.write(wbout);
            await writable.close();
            Swal.fire('Success', 'Excel file exported successfully!', 'success');
        } else {
            XLSX.writeFile(wb, fileName);
            Swal.fire('Success', 'File downloaded successfully to your Downloads folder.', 'success');
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error(err);
            XLSX.writeFile(wb, fileName);
        }
    }
}

function renderStudentNotes(studentId) {
    const listContainer = document.getElementById('modalNotesList');
    listContainer.innerHTML = '';
    
    let allNotes = [];
    
    Object.keys(attendance).forEach(date => {
        const entry = attendance[date][studentId];
        if (entry && typeof entry === 'object' && entry.note && entry.note.trim() !== "") {
            allNotes.push({
                date: date,
                note: entry.note,
                status: entry.status
            });
        }
    });

    allNotes.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (allNotes.length === 0) {
        listContainer.innerHTML = '<li style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 12px;">No notes found.</li>';
        return;
    }

    allNotes.forEach(item => {
        const d = new Date(item.date);
        const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
        
        const li = document.createElement('li');
        li.style.cssText = "padding: 8px 10px; border-bottom: 1px solid var(--border-color); font-size: 12px;";
        
        li.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="font-weight:bold; color:var(--primary); font-size: 13px;">${dateStr}</span>
            </div>
            <div style="color:var(--text-main); line-height:1.5;">${item.note}</div>
        `;
        listContainer.appendChild(li);
    });
}

function filterStudentNotes() {
    const input = document.getElementById('noteSearchInput');
    const filter = input.value.toUpperCase();
    const ul = document.getElementById('modalNotesList');
    const li = ul.getElementsByTagName('li');

    for (let i = 0; i < li.length; i++) {
        const textValue = li[i].textContent || li[i].innerText;
        if (textValue.toUpperCase().indexOf(filter) > -1) {
            li[i].style.display = "";
        } else {
            li[i].style.display = "none";
        }
    }
}

function addWatermarkAndSignatureToPdf(doc) {
    const pageCount = doc.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        if (instituteLogo) {
            doc.saveGraphicsState();
            doc.setGState(new doc.GState({ opacity: 0.1 })); 
            const imgDim = 80; 
            doc.addImage(instituteLogo, 'JPEG', (pageWidth - imgDim) / 2, (pageHeight - imgDim) / 2, imgDim, imgDim);
            doc.restoreGraphicsState();
        }

        const footerY = pageHeight - 20;

        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.setFont("helvetica", "normal");
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, footerY + 10, { align: 'center' });

        const dateStr = new Date().toLocaleDateString('en-IN');
        doc.text(`Generated: ${dateStr}`, 15, footerY + 10);

        if (authorizedSignature) {
            doc.addImage(authorizedSignature, 'PNG', pageWidth - 50, footerY - 10, 35, 12);
            doc.text("Authorized Signature", pageWidth - 15, footerY + 5, { align: "right" });
        }
    }
}

function sendNoteAction(type, studentId, note, rawDate) {
    const student = students.find(s => s.id === studentId);
    if (!student) {
        Swal.fire('Error', 'Student not found!', 'error');
        return;
    }

    const dateObj = new Date(rawDate);
    const dateStr = dateObj.toLocaleDateString('en-IN');

    const subject = student.class ? student.class : 'Music';

    const msgBody = `Dear ${student.name},\n\n` +
                    `Here is the note for today's ${subject} class (${dateStr}):\n\n` +
                    `"${note}"\n\n` +
                    `Regards,\n` +
                    `Srikanta Banerjee\n` +
                    `(Guitar, Bass Guitar, Piano, Keyboard, Mandolin Classes)`;
    
    if (type === 'wa') {
        let cleanPhone = student.phone.replace(/[^0-9]/g, '');
        if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
        
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgBody)}`, '_blank');
    } else if (type === 'sms') {
        window.open(`sms:${student.phone}?body=${encodeURIComponent(msgBody)}`, '_self');
    }
}

function calculateAge(dob) {
    if(!dob) return "";
    const birthDate = new Date(dob);
    const today = new Date();

    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();

    if (days < 0) {
        months--;
        const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        days += lastMonth.getDate();
    }
    
    if (months < 0) {
        years--;
        months += 12;
    }

    return `${years} Yrs, ${months} Mths, ${days} Days`;
}

function showAttendanceList(type) {
    const date = document.getElementById('attendanceDate').value;
    if (!date) return;

    let list = [];
    let title = '';
    const activeStudents = students.filter(s => s.status?.isActive);

    if (type === 'total') {
        list = activeStudents;
        title = `Total Active Students`;
    } else if (type === 'present') {
        list = activeStudents.filter(s => {
            const entry = attendance[date]?.[s.id];
            const status = (typeof entry === 'object' && entry !== null) ? entry.status : entry;
            return status === 'present';
        });
        title = `Present Students (${new Date(date).toLocaleDateString('en-IN')})`;
    } else if (type === 'absent') {
        list = activeStudents.filter(s => {
            const entry = attendance[date]?.[s.id];
            const status = (typeof entry === 'object' && entry !== null) ? entry.status : entry;
            return status === 'absent';
        });
        title = `Absent Students (${new Date(date).toLocaleDateString('en-IN')})`;
    }

    document.getElementById('classStudentsTitle').textContent = title;
    const tableBody = document.querySelector('#classStudentsTable tbody');
    const tableHead = document.querySelector('#classStudentsTable thead tr');

    tableHead.innerHTML = '<th>ID</th><th>Student</th><th>Contact</th>';
    tableBody.innerHTML = '';

    if(list.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">No students found.</td></tr>';
    } else {
        list.forEach(s => {
            tableBody.innerHTML += `<tr><td>${s.serial_no}</td><td>${getStudentHtml(s)}</td><td>${getAllContactButtons(s)}</td></tr>`;
        });
    }
    
    document.getElementById('classStudentsModal').style.display = 'flex';
}

function openBulkMessageModal() {
    document.getElementById('bulkMsgFilter').value = 'All';
    document.getElementById('bulkMsgText').value = '';
    document.getElementById('waBulkList').style.display = 'none';
    document.getElementById('bulkMsgModal').style.display = 'flex';
}

function sendBulkMsg(type) {
    const filter = document.getElementById('bulkMsgFilter').value;
    const text = document.getElementById('bulkMsgText').value.trim();
    if(!text) {
        Swal.fire('Error', 'Message cannot be empty', 'error');
        return;
    }

    let targetStudents = students.filter(s => s.status?.isActive);
    if(filter !== 'All') {
        targetStudents = targetStudents.filter(s => s.class_day === filter);
    }

    if(targetStudents.length === 0) {
        Swal.fire('Info', 'No active students found for this batch.', 'info');
        return;
    }

    if(type === 'sms') {
        let phones = targetStudents.map(s => s.phone).filter(p => p).join(',');
        if(phones) {
            window.open(`sms:${phones}?body=${encodeURIComponent(text)}`, '_self');
        } else {
            Swal.fire('Error', 'No valid phone numbers found.', 'error');
        }
    } else if(type === 'wa') {
        const waList = document.getElementById('waBulkList');
        waList.innerHTML = '<h4 style="margin-top:0; font-size:14px; color:var(--text-muted);">Click below to send WhatsApp messages:</h4>';
        targetStudents.forEach(s => {
            if(s.phone) {
                let cleanPhone = s.phone.replace(/[^0-9]/g, '');
                if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
                const link = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
                waList.innerHTML += `<div style="margin-bottom:8px;"><a href="${link}" target="_blank" class="btn-whatsapp" style="text-decoration:none; display:inline-block; padding:10px; width:100%; text-align:center; border-radius:8px; font-size:14px;"><i class="fab fa-whatsapp"></i> Send to ${s.name}</a></div>`;
            }
        });
        waList.style.display = 'block';
    }
}

function shareQRCode(studentId) {
    const student = students.find(s => s.id === studentId);
    if(!student) return;
    
    const baseUrl = window.location.origin + window.location.pathname;
    const qrText = `${baseUrl}?student=${student.id}&manager=${DOC_ID}`;
    
    const qr = new QRious({ value: qrText, size: 250, level: 'H' });
    const qrImg = qr.toDataURL();
    
    let cleanPhone = student.phone ? student.phone.replace(/[^0-9]/g, '') : '';
    if (cleanPhone && cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
    
    const waMsg = `Hello ${student.name},\n\nHere is your Digital ID Card link for Music Classes. Click the link below to view your profile, attendance, and fees:\n\n${qrText}\n\nRegards,\nSrikanta Banerjee`;
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}`;

    window.tempDownloadQR = function() {
        const link = document.createElement('a');
        link.download = `QR_${student.name}.png`;
        link.href = qrImg;
        link.click();
    };

    window.tempShareQRImage = async function() {
        try {
            const blob = await (await fetch(qrImg)).blob();
            const file = new File([blob], `QR_${student.name}.png`, { type: blob.type });
            if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Student QR Code',
                    text: `Digital ID QR Code for ${student.name}`,
                    files: [file]
                });
            } else {
                Swal.fire('Oops', 'Direct image sharing is not supported on this browser. Please use the Download button instead.', 'info');
            }
        } catch(e) { console.log(e); }
    };

    Swal.fire({
        title: `${student.name}'s ID`,
        imageUrl: qrImg,
        imageWidth: 180,
        imageHeight: 180,
        imageAlt: 'QR Code',
        html: `
            <p style="font-size:13px; color:gray; margin-bottom: 15px;">Share this profile link or QR code with the student.</p>
            
            <div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
                ${cleanPhone ? `<a href="${waUrl}" target="_blank" style="background:#25D366; color:white; padding:12px 15px; border-radius:8px; text-decoration:none; font-size:14px; width: 95%; font-weight:bold; box-shadow: 0 4px 6px rgba(37, 211, 102, 0.3); box-sizing:border-box;">
                    <i class="fab fa-whatsapp" style="font-size:16px;"></i> Send Link to WhatsApp
                </a>` : `<p style="color:red; font-size:12px; margin:0; font-weight:bold;">Student phone number is missing!</p>`}
                
                <div style="display:flex; gap:8px; width: 95%; justify-content: center; box-sizing:border-box;">
                    <button onclick="tempShareQRImage()" style="flex:1; background:#3b82f6; color:white; border:none; padding:10px 2px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:13px; white-space: nowrap;">
                        <i class="fas fa-share-alt"></i> Share Image
                    </button>
                    <button onclick="tempDownloadQR()" style="flex:1; background:#10b981; color:white; border:none; padding:10px 2px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:13px; white-space: nowrap;">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Close Window',
        cancelButtonColor: '#6b7280'
    });
}

function startQRScanner() {
    document.getElementById('qrScannerModal').style.display = 'flex';
    if(!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5QrcodeScanner("qr-reader-box", { fps: 10, qrbox: 250 });
        html5QrcodeScanner.render(onScanSuccess, onScanError);
    }
}

function closeQRScanner() {
    document.getElementById('qrScannerModal').style.display = 'none';
    if(html5QrcodeScanner) {
        html5QrcodeScanner.clear().then(() => {
            html5QrcodeScanner = null;
        }).catch(error => {
            console.error("Failed to clear scanner", error);
        });
    }
}

function onScanSuccess(decodedText, decodedResult) {
    let studentId = null;
    
    if(decodedText.includes("student=")) {
        try {
            const url = new URL(decodedText);
            studentId = parseInt(url.searchParams.get("student"));
        } catch(e) {}
    } 
    else if(decodedText.includes("[APP_ID:")) {
        const match = decodedText.match(/\[APP_ID:(\d+)\]/);
        if(match && match[1]) studentId = parseInt(match[1]);
    }

    if(studentId) {
        const student = students.find(s => s.id === studentId);
        if(student) {
            closeQRScanner();
            markAttendance(studentId, 'present');
            Swal.fire({
                toast: true, position: 'top-end',
                icon: 'success', title: `${student.name} Marked Present!`,
                showConfirmButton: false, timer: 2500
            });
        } else {
            Swal.fire({
                toast: true, position: 'top',
                icon: 'error', title: 'Student not found.',
                showConfirmButton: false, timer: 2000
            });
        }
    } else {
         Swal.fire({
             toast: true, position: 'bottom',
             icon: 'warning', title: 'Invalid QR Code.',
             showConfirmButton: false, timer: 1500
         });
    }
}

function onScanError(errorMessage) {
    // Ignore minor scan errors
}

async function openAddMaterialModal(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const { value: formValues } = await Swal.fire({
        title: 'Add Study Material',
        html: `
            <input id="swal-mat-title" class="swal2-input" placeholder="Title (e.g. C Major Scale)" style="width: 85%;">
            <select id="swal-mat-type" class="swal2-select" style="width: 85%; margin-top: 10px;">
                <option value="video">🎬 Video Lesson </option>
                <option value="pdf">📄 PDF / Notation</option>
                <option value="audio">🎵 Audio Loop / Track </option>
            </select>
            <input id="swal-mat-link" class="swal2-input" placeholder="Paste Link Here" style="width: 85%; margin-top: 10px;">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Save Material',
        preConfirm: () => {
            return {
                title: document.getElementById('swal-mat-title').value.trim(),
                type: document.getElementById('swal-mat-type').value,
                link: document.getElementById('swal-mat-link').value.trim()
            }
        }
    });

    if (formValues && formValues.title && formValues.link) {
        if (!student.study_materials) student.study_materials = [];
        
        student.study_materials.push({
            id: Date.now(),
            title: formValues.title,
            type: formValues.type,
            link: formValues.link,
            date: new Date().toISOString().split('T')[0]
        });

        renderStudyMaterials(studentId);
        
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
        Toast.fire({ icon: 'success', title: 'Material added instantly!' });

        db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(studentId)).update({
            study_materials: student.study_materials
        }).catch(e => console.log("Will sync to Firebase automatically."));

    } else if (formValues) {
        Swal.fire('Error', 'Title and Link are required.', 'error');
    }
}

function renderStudyMaterials(studentId) {
    const student = students.find(s => s.id === studentId);
    const listContainer = document.getElementById('modalStudyMaterialsList');
    if (!listContainer || !student) return;

    listContainer.innerHTML = '';
    
    if (!student.study_materials || student.study_materials.length === 0) {
        listContainer.innerHTML = '<li style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 12px;">No materials shared yet.</li>';
        return;
    }

    student.study_materials.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(mat => {
        let icon = mat.type === 'video' ? '<i class="fab fa-youtube" style="color:red;"></i>' : 
                   mat.type === 'pdf' ? '<i class="fas fa-file-pdf" style="color:red;"></i>' : 
                   '<i class="fas fa-music" style="color:blue;"></i>';

        listContainer.innerHTML += `
            <li style="padding: 8px 10px; border-bottom: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:13px; color:var(--text-main);">
                    ${icon} <strong style="margin-left:5px;">${mat.title}</strong><br>
                    <span style="font-size:10px; color:var(--text-muted);">${new Date(mat.date).toLocaleDateString('en-IN')}</span>
                </div>
                <div>
                    <a href="${mat.link}" target="_blank" class="btn-info" style="padding:4px 8px; font-size:10px; text-decoration:none; border-radius: 4px;"><i class="fas fa-eye"></i> View</a>
                    <button class="btn-danger" onclick="deleteStudyMaterial(${studentId}, ${mat.id})" style="padding:4px 8px; font-size:10px; margin-left:5px; border-radius: 4px; border:none; cursor:pointer;"><i class="fas fa-trash"></i></button>
                </div>
            </li>
        `;
    });
}

async function deleteStudyMaterial(studentId, matId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    Swal.fire({
        title: 'Delete Material?',
        text: "Are you sure you want to remove this?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it'
    }).then(async (result) => {
        if (result.isConfirmed) {
            student.study_materials = student.study_materials.filter(m => m.id !== matId);
            await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(studentId)).update({
                study_materials: student.study_materials
            });
            renderStudyMaterials(studentId);
            Swal.fire('Deleted!', 'Material has been removed.', 'success');
        }
    });
}

async function savePersonalNotice() {
    const text = document.getElementById('personalNoticeInput').value.trim();
    if (!text) { Swal.fire('Error', 'Write a notice first!', 'error'); return; }

    const studentIndex = students.findIndex(s => s.id === currentlyViewingStudentId);
    if(studentIndex !== -1) {
        students[studentIndex].personal_notice = text; 
        
        await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(currentlyViewingStudentId)).update({ 
            personal_notice: text 
        });
        
        Swal.fire('Saved', 'Notice added successfully', 'success');
        showStudentDetails(currentlyViewingStudentId); 
    }
}

async function deletePersonalNotice() {
    const studentIndex = students.findIndex(s => s.id === currentlyViewingStudentId);
    if(studentIndex !== -1) {
        students[studentIndex].personal_notice = ""; 
        
        await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(currentlyViewingStudentId)).update({ 
            personal_notice: "" 
        });
        
        document.getElementById('personalNoticeInput').value = '';
        Swal.fire('Deleted', 'Notice removed', 'success');
        showStudentDetails(currentlyViewingStudentId);
    }
}

async function saveGlobalMaterial() {
    const title = document.getElementById('libMatTitle').value.trim();
    const category = document.getElementById('libMatCategory').value;
    const type = document.getElementById('libMatType').value;
    const link = document.getElementById('libMatLink').value.trim();

    if (!title || !link) {
        Swal.fire('Error', 'Title and Link are required!', 'error');
        return;
    }

    const newMaterial = {
        id: Date.now(),
        title: title,
        category: category,
        type: type,
        link: link,
        date: new Date().toISOString().split('T')[0]
    };

    globalMaterials.push(newMaterial);
    
    document.getElementById('libMatTitle').value = '';
    document.getElementById('libMatLink').value = '';
    renderGlobalMaterials();
    
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
    Toast.fire({ icon: 'success', title: 'Saved to Library' });

    saveData().catch(e => console.log("Background sync pending"));
}

let currentFilteredMaterials = [];
let currentLibDisplayCount = 0;
const LIB_ITEMS_PER_PAGE = 10; 

function renderGlobalMaterials() {
    document.getElementById('searchLibrary').value = '';
    document.getElementById('filterLibCategory').value = 'All';
    document.getElementById('filterLibType').value = 'All';
    filterLibrary();
}

function filterLibrary() {
    const searchText = document.getElementById('searchLibrary').value.toLowerCase();
    const filterCat = document.getElementById('filterLibCategory').value;
    const filterType = document.getElementById('filterLibType').value;
    
    const container = document.getElementById('globalLibraryList');
    container.innerHTML = '';
    currentLibDisplayCount = 0; 

    currentFilteredMaterials = globalMaterials.filter(mat => {
        const matchText = mat.title.toLowerCase().includes(searchText) || 
                          mat.category.toLowerCase().includes(searchText) ||
                          mat.type.toLowerCase().includes(searchText);
                          
        const matchCat = filterCat === 'All' || mat.category === filterCat;
        const matchType = filterType === 'All' || mat.type === filterType;
        
        return matchText && matchCat && matchType;
    });

    if (currentFilteredMaterials.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:13px; padding: 20px;">No materials found matching your search.</p>';
        return;
    }

    currentFilteredMaterials.sort((a, b) => b.id - a.id);

    loadMoreLibraryItems();
}

function loadMoreLibraryItems() {
    const container = document.getElementById('globalLibraryList');
    
    const nextBatch = currentFilteredMaterials.slice(currentLibDisplayCount, currentLibDisplayCount + LIB_ITEMS_PER_PAGE);
    
    if (nextBatch.length === 0) return; 

    nextBatch.forEach(mat => {
        let icon = mat.type === 'video' ? '<i class="fab fa-youtube" style="color:#ef4444;"></i>' : 
                   mat.type === 'pdf' ? '<i class="fas fa-file-pdf" style="color:#ef4444;"></i>' : 
                   '<i class="fas fa-music" style="color:#3b82f6;"></i>';
                   
        const div = document.createElement('div');
        div.style.cssText = 'background: var(--bg-card); padding: 15px; border-radius: 12px; border-left: 4px solid var(--info); box-shadow: var(--shadow); display:flex; flex-direction:column; gap:10px; flex-shrink: 0; animation: fadeIn 0.4s ease;';
        
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <span style="font-size:10px; background:var(--bg-input); padding:2px 8px; border-radius:4px; color:var(--text-muted); font-weight:600; text-transform:uppercase;">${mat.category}</span>
                    <span style="font-size:10px; background:var(--bg-input); padding:2px 8px; border-radius:4px; color:var(--text-muted); font-weight:600; text-transform:uppercase; margin-left:5px;">${mat.type}</span>
                    <div style="font-size:14px; font-weight:600; color:var(--text-main); margin-top:5px;">${icon} ${mat.title}</div>
                </div>
                <button onclick="deleteGlobalMaterial(${mat.id})" style="background:transparent; border:none; color:var(--danger); cursor:pointer; font-size:14px;"><i class="fas fa-trash"></i></button>
            </div>
            
            <div style="display:flex; gap:10px; margin-top:5px; align-items: stretch;">
                <button class="btn-info" onclick="openSendToStudentModal(${mat.id})" style="flex:2; font-size:12px; padding:8px 0; display:flex; align-items:center; justify-content:center; border-radius:8px; height: 35px; min-height: 35px; box-sizing: border-box; border: none;">
                    <i class="fas fa-paper-plane" style="margin-right:5px;"></i> Send to Student
                </button>
                <a href="${mat.link}" target="_blank" class="btn-success" style="flex:1; font-size:12px; padding:8px 0; display:flex; align-items:center; justify-content:center; text-decoration:none; border-radius:8px; height: 35px; min-height: 35px; box-sizing: border-box; text-align: center;">
                    <i class="fas fa-eye" style="margin-right:5px;"></i> View
                </a>
            </div>
        `;
        container.appendChild(div);
    });

    currentLibDisplayCount += nextBatch.length;
}

function handleLibraryScroll() {
    const container = document.getElementById('globalLibraryList');
    
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 15) {
        loadMoreLibraryItems();
    }
}

async function deleteGlobalMaterial(id) {
    Swal.fire({
        title: 'Delete from Library?',
        text: "Are you sure? (This won't remove it from students who already received it)",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, Delete'
    }).then(async (result) => {
        if (result.isConfirmed) {
            globalMaterials = globalMaterials.filter(m => m.id !== id);
            await saveData();
            renderGlobalMaterials();
        }
    });
}

// 🟢 Send Material to Student Portal Logic (Searchable with Profile Photos & WhatsApp)
let tempActiveStudents = []; 

// 1. Helper function to generate custom HTML list with photos
window.generateStudentListHtml = function(studentsList) {
    let html = '';
    studentsList.forEach(s => {
        const photoSrc = s.photo ? s.photo : 'https://via.placeholder.com/40?text=S';
        html += `
            <div class="student-select-item" onclick="selectStudentForMaterial(${s.id}, this)" style="display:flex; align-items:center; padding: 10px; border-bottom: 1px solid var(--border-color); border-left: 4px solid transparent; cursor:pointer; transition: all 0.2s; background: var(--bg-card);">
                <img src="${photoSrc}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0; margin-right: 12px; flex-shrink: 0;">
                <div style="flex-grow: 1; text-align: left;">
                    <div style="font-weight: 600; font-size: 14px; color: var(--text-main);">${s.name}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${s.class || 'N/A'}</div>
                </div>
            </div>
        `;
    });
    if(studentsList.length === 0) {
        html = `<div style="padding: 15px; text-align: center; color: var(--text-muted); font-size: 13px;">No student found</div>`;
    }
    return html;
};

// 2. Function to handle selection highlighting
window.selectStudentForMaterial = function(studentId, divElement) {
    document.getElementById('selected-student-id').value = studentId;
    const allItems = document.querySelectorAll('.student-select-item');
    allItems.forEach(item => {
        item.style.backgroundColor = 'var(--bg-card)';
        item.style.borderColor = 'transparent';
    });
    divElement.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
    divElement.style.borderColor = 'var(--primary)';
};

// 3. Open Send Modal
async function openSendToStudentModal(matId) {
    const material = globalMaterials.find(m => m.id === matId);
    if (!material) return;

    tempActiveStudents = students.filter(s => s.status?.isActive).sort((a,b) => a.name.localeCompare(b.name));
    let listHtml = generateStudentListHtml(tempActiveStudents);

    const result = await Swal.fire({
        title: 'Send Material',
        html: `
            <div style="text-align:left; margin-bottom:15px; font-size:13px; color:var(--text-main); background: var(--bg-input); padding: 10px; border-radius: 8px;">
                <strong>Material:</strong> ${material.title} <br>
                <span style="color:var(--info); font-weight:600;">${material.category}</span>
            </div>
            
            <input type="text" id="swal-search-student" class="swal2-input" placeholder="🔍 Search student by name..." style="width: 100%; margin: 0 0 10px 0; font-size: 14px; box-sizing: border-box;" onkeyup="filterSendStudentList()">
            
            <input type="hidden" id="selected-student-id" value="">
            
            <div id="send-mat-student-list" style="width:100%; max-height: 220px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">
                ${listHtml}
            </div>
            <div style="font-size:11px; color:var(--text-muted); text-align:left; margin-top:8px;">* Click on a student to select</div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '<i class="fas fa-paper-plane"></i> To Portal',
        denyButtonText: '<i class="fab fa-whatsapp"></i> WhatsApp',
        cancelButtonText: 'Cancel',
        confirmButtonColor: 'var(--primary)',
        denyButtonColor: '#25D366',
        preConfirm: () => {
            const val = document.getElementById('selected-student-id').value;
            if (!val) { Swal.showValidationMessage('Please select a student from the list'); return false; }
            return val;
        },
        preDeny: () => {
            const val = document.getElementById('selected-student-id').value;
            if (!val) { Swal.showValidationMessage('Please select a student from the list'); return false; }
            return val;
        }
    });

    if (result.isConfirmed && result.value) {
        assignMaterialToStudent(parseInt(result.value), material);
    } else if (result.isDenied && result.value) {
        sendMaterialViaWhatsApp(parseInt(result.value), material);
    }
}

// 4. WhatsApp-এ সরাসরি মেসেজ পাঠানোর ফাংশন
window.sendMaterialViaWhatsApp = function(studentId, material) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    let cleanPhone = student.phone ? student.phone.replace(/[^0-9]/g, '') : '';
    if (cleanPhone && cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    if (!cleanPhone) {
        Swal.fire('Error', 'Student phone number is missing!', 'error');
        return;
    }

    const waMsg = `Hello ${student.name},\n\nHere is your study material for Music Classes:\n\n*Topic:* ${material.title}\n*Category:* ${material.category}\n*Type:* ${material.type}\n\n*Link:* ${material.link}\n\nRegards,\nSrikanta Banerjee`;
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}`;
    
    window.open(waUrl, '_blank');
};

// 5. Search Box Filter Function (Updated for Photos)
window.filterSendStudentList = function() {
    const filter = document.getElementById('swal-search-student').value.toUpperCase();
    const listContainer = document.getElementById('send-mat-student-list');
    
    const filteredStudents = tempActiveStudents.filter(s => {
        const text = `${s.name} (${s.class || 'N/A'})`.toUpperCase();
        return text.indexOf(filter) > -1;
    });
    
    listContainer.innerHTML = generateStudentListHtml(filteredStudents);
    document.getElementById('selected-student-id').value = ''; 
};

// 6. Assign Material to Portal
async function assignMaterialToStudent(studentId, material) {
    const studentIndex = students.findIndex(s => s.id === studentId);
    if (studentIndex === -1) return;

    const student = students[studentIndex];
    if (!student.study_materials) student.study_materials = [];

    student.study_materials.push({
        id: Date.now(), 
        title: material.title,
        type: material.type,
        link: material.link,
        date: new Date().toISOString().split('T')[0]
    });

    Swal.fire({
        title: 'Sent Fast!',
        text: `${material.title} added to ${student.name}'s portal.`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
    });

    db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(studentId)).update({
        study_materials: student.study_materials
    }).catch(e => console.log("Background sync pending"));
}
