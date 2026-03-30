// --- 2. Firebase Config ---
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

// --- 3. ENABLE OFFLINE PERSISTENCE (Fast & Offline) ---
// WhatsApp বা In-app ব্রাউজারের সমস্যার জন্য স্টুডেন্ট পোর্টালে অফলাইন ক্যাশে বন্ধ রাখা হলো
if (!window.location.search.includes('student=')) {
    db.enablePersistence({ synchronizeTabs: true }).catch((err) => console.log(err));
}

const COLLECTION_NAME = 'music_classes';
let DOC_ID = 'main_data';

// --- 4. Optimized Database Functions ---
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

// --- 5. Data Migration (One time) ---
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

// --- 6. App Logic & Initialization ---

if ('serviceWorker' in navigator) { 
    window.addEventListener('load', () => { navigator.serviceWorker.register('./serviceWorker.js').catch(console.error); }); 
}

let lastCheckedDate = new Date().toDateString();

function startClock() {
    setInterval(() => {
        const now = new Date();
        const options = { 
            weekday: 'short',
            day: 'numeric',  
            month: 'short',  
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit', 
            hour12: true 
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
        // 🟢 Manager-এর সবকিছু সাথে সাথে রিমুভ করে দেওয়া হচ্ছে যাতে ব্যাকগ্রাউন্ডে কিছু না দেখায়
        document.body.innerHTML = ''; 
        document.body.style.background = '#f8fafc';

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

                        // ২. Attendance Data (ফাঁকা এন্ট্রি হাইড করার লজিক)
                        let attRecords = [];
                        Object.keys(globalAtt).forEach(date => { if(globalAtt[date][studentViewId]) attRecords.push({ date, data: globalAtt[date][studentViewId] }); });
                        attRecords.sort((a,b) => new Date(b.date) - new Date(a.date));
                        
                        // 🟢 NEW: শুধুমাত্র আসল ডেটা (Present/Absent বা Note থাকলে) ফিল্টার করা হচ্ছে
                        let validAttRecords = attRecords.filter(rec => {
                            let status = typeof rec.data === 'object' && rec.data !== null ? rec.data.status : (typeof rec.data === 'string' ? rec.data : null);
                            let note = typeof rec.data === 'object' && rec.data !== null && rec.data.note ? rec.data.note.trim() : '';
                            
                            // যদি status বা note-এর যেকোনো একটি থাকে, তবেই লিস্টে দেখাবে
                            return (status === 'present' || status === 'absent' || note !== '');
                        });

                        let attHtml = validAttRecords.length > 0 ? validAttRecords.map(rec => {
                            let status = typeof rec.data === 'object' && rec.data !== null && rec.data.status ? rec.data.status : (typeof rec.data === 'string' ? rec.data : 'Not Marked');
                            let note = typeof rec.data === 'object' && rec.data !== null && rec.data.note ? rec.data.note : '';
                            let time = typeof rec.data === 'object' && rec.data !== null && rec.data.time ? rec.data.time : '';

                            // কালার লজিক
                            let clr = status === 'present' ? '#16a34a' : (status === 'absent' ? '#dc2626' : '#f59e0b');

                            // Date & Time ফরম্যাট
                            const d = new Date(rec.date);
                            const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' });
                            const formattedDate = d.toLocaleDateString('en-IN');

                            let timeDisplay = time ? formatTime12H(time) : '';
                            let timeBadge = timeDisplay ? `<span style="font-size:11px; color:#3b82f6; background:#eff6ff; padding:2px 6px; border-radius:4px; margin-left:5px;">🕒 ${timeDisplay}</span>` : '';
                            
                            let noteDisplay = note ? `<br><span style="font-size:11px; color:#64748b;">📝 ${note}</span>` : '';

                            return `<div style="margin-bottom:10px; padding:12px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <strong style="color:#1e293b;">${formattedDate} (${dayName})</strong>${timeBadge}
                                    ${noteDisplay}
                                </div>
                                <div style="color:${clr}; font-weight:bold; text-transform:uppercase;">${status}</div>
                            </div>`;
                        }).join('') : '<p style="text-align:center; color:gray; font-size:13px;">No attendance records.</p>';

                        // ৩. Payment Data
                        let feeRecords = [];
                        Object.keys(globalFees).forEach(month => { if(globalFees[month][studentViewId]) feeRecords.push({ month, data: globalFees[month][studentViewId] }); });
                        feeRecords.sort((a,b) => new Date(b.month+'-01') - new Date(a.month+'-01')).reverse();
                        
                        let paidHtml = feeRecords.length > 0 ? feeRecords.map(rec => {
                            let txnHtml = rec.data.transactionId ? `<br><span style="font-size:11px; color:#047857; font-weight:600; display:inline-block; margin-top:6px; background:#d1fae5; padding:4px 8px; border-radius:6px; border:1px dashed #34d399;"><i class="fas fa-hashtag"></i> Txn ID: ${rec.data.transactionId}</span>` : '';
                            let payDate = rec.data.date ? new Date(rec.data.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
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

                        // ৪. Due Data (Fixed for Standalone Portal View)
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

                        // ৬. HTML Structure
                        document.body.innerHTML = `
                            <style>
                                .modal-portal { display:none; position:fixed; z-index:20000; left:0; top:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.7); align-items:center; justify-content:center; backdrop-filter: blur(4px); }
                                .modal-content-portal { background:#fff; width:90%; max-width:400px; padding:25px; border-radius:24px; max-height:80vh; overflow-y:auto; position:relative; animation: slideUp 0.3s ease; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
                                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
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
                                    <div style="margin-top: 25px; background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.04); border-top: 4px solid #10b981;">
                                        <h4 style="margin:0 0 15px 0; color:#334155; font-size:16px;">
                                            <i class="fas fa-stopwatch" style="color:#10b981; margin-right:5px;"></i> Daily Practice Log
                                        </h4>
                                        
                                        <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px dashed #cbd5e1;">
                                            <span style="font-size: 13px; color: #64748b; font-weight: 600;"><i class="fas fa-clock"></i> Time:</span>
                                            <input type="time" id="practiceTimeInput" style="flex: 1; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; outline: none; color: #1e293b; background: white;">
                                            <span style="font-size: 10px; color: #94a3b8;">(Optional)</span>
                                        </div>

                                        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                                            <input type="number" id="practiceMinutes" placeholder="Mins (e.g. 45)" style="width: 35%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; outline: none; box-sizing: border-box;">
                                            <input type="text" id="practiceTopic" placeholder="Topic (e.g. C Major Scale)" style="width: 65%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; outline: none; box-sizing: border-box;">
                                        </div>
                                        
                                        <button onclick="submitPracticeLog(${studentViewId})" style="width: 100%; background: #10b981; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);">
                                            <i class="fas fa-check-circle"></i> Log Practice
                                        </button>
                                        <div id="practiceHistoryPortal" style="margin-top: 15px; max-height: 150px; overflow-y: auto;"></div>
                                    </div>

                                    <div style="display:flex; flex-direction:column; gap:12px; margin-bottom: 25px;">
                                        <button onclick="document.getElementById('m-profile').style.display='flex'" style="width:100%; background:#fff; padding:16px 20px; border-radius:16px; border:none; box-shadow:0 4px 15px rgba(0,0,0,0.04); display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                                            <div style="display:flex; align-items:center; gap:15px;">
                                                <div style="background:#eff6ff; width:45px; height:45px; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#3b82f6; font-size:18px;"><i class="fas fa-user"></i></div>
                                                <span style="font-size:15px; font-weight:600; color:#334155;">Profile Details</span>
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

                                <div id="m-teacher" class="modal-portal">
                                    <div class="modal-content-portal">
                                        <div class="close-btn" onclick="document.getElementById('m-teacher').style.display='none'">&times;</div>
                                        <h3 style="margin-top:5px; color:#334155; font-size:18px; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">Teacher Details</h3>
                                        <div style="text-align: center; padding: 15px 0;">
                                            <div style="background:#eff6ff; width:70px; height:70px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#3b82f6; font-size:30px; margin: 0 auto 15px auto; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2);">
                                                <i class="fas fa-user-tie"></i>
                                            </div>
                                            <h2 style="margin: 0 0 5px 0; color: #1e293b;">Srikanta Banerjee</h2>
                                            <p style="margin: 0; color: #64748b; font-size: 13px; font-weight: 600;">Owner & Instructor</p>
                                            
                                            <div style="margin-top: 20px; text-align: left; font-size: 14px; color: #334155; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px dashed #cbd5e1; line-height: 1.6;">
                                                <div style="margin-bottom: 12px; display: flex; align-items: flex-start; gap: 10px;">
                                                    <i class="fas fa-map-marker-alt" style="color: #ef4444; font-size: 16px; margin-top: 3px;"></i> 
                                                    <div>
                                                        <strong>Address:</strong><br>
                                                        <span style="color: #475569;">Moyna, Nabagram,<br>Purba Bardhaman</span>
                                                    </div>
                                                </div>
                                                <div style="margin-bottom: 12px; display: flex; align-items: flex-start; gap: 10px;">
                                                    <i class="fas fa-phone-alt" style="color: #10b981; font-size: 16px; margin-top: 3px;"></i> 
                                                    <div>
                                                        <strong>Contact:</strong><br>
                                                        <span style="color: #475569;">7001471235 / 9475311199</span>
                                                    </div>
                                                </div>
                                                <div style="display: flex; align-items: flex-start; gap: 10px;">
                                                    <i class="fas fa-music" style="color: #8b5cf6; font-size: 16px; margin-top: 3px;"></i> 
                                                    <div>
                                                        <strong>Classes:</strong><br>
                                                        <span style="color: #475569;">Guitar, Bass Guitar, Piano, Keyboard, Mandolin</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>                   
                                <div id="m-profile" class="modal-portal">
                                    <div class="modal-content-portal">
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
                                    </div>
                                </div>

                                <div id="m-att" class="modal-portal">
                                    <div class="modal-content-portal">
                                        <div class="close-btn" onclick="document.getElementById('m-att').style.display='none'">&times;</div>
                                        <h3 style="margin-top:5px; color:#334155; font-size:18px; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">Attendance History</h3>
                                        <div class="scroller-box">${attHtml}</div>
                                    </div>
                                </div>

                                <div id="m-pay" class="modal-portal">
                                    <div class="modal-content-portal">
                                        <div class="close-btn" onclick="document.getElementById('m-pay').style.display='none'">&times;</div>
                                        <h3 style="margin-top:5px; color:#334155; font-size:18px; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">Payment History</h3>
                                        <div class="scroller-box">${paidHtml}</div>
                                    </div>
                                </div>

                                <div style="position:fixed; bottom:0; left:0; width:100%; background:#fff; padding:15px 20px; display:flex; gap:12px; box-shadow:0 -10px 30px rgba(0,0,0,0.06); border-radius:24px 24px 0 0; box-sizing:border-box;">
                                    <button onclick="document.getElementById('m-teacher').style.display='flex'" style="width: 65px; height: 55px; flex-shrink: 0; background: #f1f5f9; border: none; border-radius: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                        <i class="fas fa-user-tie" style="font-size: 24px; color: #334155;"></i>
                                    </button>
                                    
                                    <button onclick="showHelpOptions()" style="flex: 1; height: 55px; background: #6366f1; color: #fff; border: none; display: flex; align-items: center; justify-content: center; border-radius: 16px; font-weight: 700; font-size: 16px; box-shadow: 0 6px 15px rgba(99,102,241,0.25); cursor: pointer;">
                                        <i class="fas fa-headset" style="margin-right: 8px;"></i> Help
                                    </button>
                                    
                                    <button onclick="localStorage.removeItem('verified_student_${studentViewId}'); window.location.reload();" style="flex: 1; height: 55px; background: #fff; color: #ef4444; border: 2px solid #fecaca; display: flex; align-items: center; justify-content: center; border-radius: 16px; font-weight: 700; font-size: 16px; cursor: pointer;">
                                        Log Out
                                    </button>
                                </div>
                            </div>
                        `;
                        
                        setTimeout(() => { renderPracticeHistoryPortal(s); }, 500);

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

window.showHelpOptions = function() {
    Swal.fire({
        title: 'Contact Teacher',
        text: 'How would you like to connect?',
        showConfirmButton: false,
        showCloseButton: true,
        html: `
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:15px;">
                <a href="tel:7001471235" style="background:#3b82f6; color:white; padding:12px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:15px;">
                    <i class="fas fa-phone-alt"></i> Call Now
                </a>
                <a href="https://wa.me/917001471235" target="_blank" style="background:#25D366; color:white; padding:12px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:15px;">
                    <i class="fab fa-whatsapp"></i> WhatsApp
                </a>
                <a href="sms:7001471235" style="background:#f59e0b; color:white; padding:12px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:15px;">
                    <i class="fas fa-sms"></i> Send SMS
                </a>
            </div>
        `
    });
};

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

// 🟢 NEW: Future Date Inactive Logic (Time Machine)
window.isStudentCurrentlyActive = function(student, targetDateStr = null) {
    if (!student) return false;
    if (!student.status || !student.status.history || student.status.history.length === 0) {
        return isStudentCurrentlyActive(student) !== false;
    }
    
    let targetDate = new Date(); 
    if (targetDateStr) targetDate = new Date(targetDateStr);
    targetDate.setHours(23, 59, 59, 999); 
    
    const joinDate = new Date(student.joining_date);
    joinDate.setHours(0, 0, 0, 0);
    if (targetDate < joinDate) return false;
    
    const history = [...student.status.history].sort((a, b) => new Date(a.date) - new Date(b.date));
    let currentStatus = 'Active'; 
    
    for (let i = 0; i < history.length; i++) {
        const hDate = new Date(history[i].date);
        hDate.setHours(0, 0, 0, 0);
        
        if (hDate <= targetDate) {
            currentStatus = history[i].status; 
        } else {
            break; 
        }
    }
    return currentStatus === 'Active';
};

async function saveInstituteLogo(input) { 
    const file = input.files[0]; 
    if (file) { 
        const reader = new FileReader(); 
        reader.onload = function(e) { 
            const img = new Image(); 
            img.onload = async function() { 
                const canvas = document.createElement('canvas'); 
                const ctx = canvas.getContext('2d'); 
                const maxWidth = 200; 
                const scaleSize = maxWidth / img.width; 
                canvas.width = maxWidth; 
                canvas.height = img.height * scaleSize; 
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height); 
                const logoBase64 = canvas.toDataURL('image/jpeg', 0.8); 
                await dbSet('instituteLogo', logoBase64); 
                await loadInstituteLogo(); 
                Swal.fire('Success', 'Logo saved!', 'success'); 
            }; 
            img.src = e.target.result; 
        }; 
        reader.readAsDataURL(file); 
    } 
}

async function loadInstituteLogo() { 
    instituteLogo = await dbGet('instituteLogo'); 
    const img = document.getElementById('logoPreview'); 
    const headerLogo = document.getElementById('headerLogo'); 
    const btn = document.getElementById('removeLogoBtn'); 
    if (instituteLogo) { 
        img.src = instituteLogo; img.style.display = 'block'; 
        btn.style.display = 'inline-block'; 
        headerLogo.src = instituteLogo; headerLogo.style.display = 'block'; 
    } else { 
        img.style.display = 'none'; btn.style.display = 'none'; headerLogo.style.display = 'none'; 
    } 
}

async function removeLogo() { await dbDelete('instituteLogo'); instituteLogo = null; await loadInstituteLogo(); }

async function saveAuthSignature(input) { 
    const file = input.files[0]; 
    if (file) { 
        const reader = new FileReader(); 
        reader.onload = function(e) { 
            const img = new Image(); 
            img.onload = async function() { 
                const canvas = document.createElement('canvas'); 
                const ctx = canvas.getContext('2d'); 
                const maxWidth = 150; 
                const scaleSize = maxWidth / img.width; 
                canvas.width = maxWidth; 
                canvas.height = img.height * scaleSize; 
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height); 
                const sigBase64 = canvas.toDataURL('image/png'); 
                await dbSet('authorizedSignature', sigBase64); 
                await loadAuthSignature(); 
                Swal.fire('Success', 'Signature saved!', 'success'); 
            }; 
            img.src = e.target.result; 
        }; 
        reader.readAsDataURL(file); 
    } 
}

async function loadAuthSignature() { 
    authorizedSignature = await dbGet('authorizedSignature'); 
    const img = document.getElementById('authSigPreview'); 
    const btn = document.getElementById('removeAuthSigBtn'); 
    if (authorizedSignature) { 
        img.src = authorizedSignature; img.style.display = 'block'; btn.style.display = 'inline-block'; 
    } else { 
        img.style.display = 'none'; btn.style.display = 'none'; 
    } 
}

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

// 🟢 NEW: নির্দিষ্ট তারিখে স্টুডেন্ট অ্যাক্টিভ ছিল কিনা তা চেক করার ফাংশন
function isStudentActiveOnDate(student, targetDateStr) {
    if (!targetDateStr) return isStudentCurrentlyActive(student) !== false;
    
    const targetDate = new Date(targetDateStr);
    targetDate.setHours(23, 59, 59, 999); 
    
    const joinDate = new Date(student.joining_date);
    joinDate.setHours(0, 0, 0, 0);

    if (targetDate < joinDate) return false; 

    if (!student.status || !student.status.history || student.status.history.length === 0) {
        return isStudentCurrentlyActive(student) !== false;
    }

    const history = [...student.status.history].sort((a, b) => new Date(a.date) - new Date(b.date));
    let currentStatus = 'Active'; 

    for (let i = 0; i < history.length; i++) {
        const hDate = new Date(history[i].date);
        hDate.setHours(0, 0, 0, 0);
        if (hDate <= targetDate) {
            currentStatus = history[i].status; 
        } else {
            break; 
        }
    }
    return currentStatus === 'Active';
}

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

function sendBirthdayWish(type, studentId) { 
    const student = students.find(s => s.id === studentId); 
    if(!student) return; 
    const msgBody = `Happy Birthday ${student.name}! Wishing you a fantastic day filled with music and joy. Best wishes from Srikanta Banerjee (Guitar, Bass Guitar, Piano, Keyboard, Mandolin Classes).`; 
    if(type === 'wa') { 
        let cleanPhone = student.phone.replace(/[^0-9]/g, ''); 
        if(cleanPhone.length === 10) cleanPhone = '91' + cleanPhone; 
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgBody)}`, '_blank'); 
    } else if (type === 'sms') { 
        window.open(`sms:${student.phone}?body=${encodeURIComponent(msgBody)}`, '_self'); 
    } else if (type === 'mail') { 
        window.open(`mailto:${student.email}?subject=${encodeURIComponent("Happy Birthday!")}&body=${encodeURIComponent(msgBody)}`, '_self'); 
    } 
}

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
function secureAction(callback, isInit = false) { 
    pendingAction = callback; 
    pinInput = ""; 
    updatePinDots(); 
    document.querySelector('.close-pin').style.display = isInit ? 'none' : 'block'; 
    document.getElementById('securityOverlay').style.display = 'flex'; 
}

function closePinScreen() { 
    if (!students || students.length === 0) {
        return; 
    }
    document.getElementById('securityOverlay').style.display = 'none'; 
    pendingAction = null; 
    pinInput = ""; 
}

function pressPin(key) { 
    if (key === 'C') pinInput = ""; 
    else if (pinInput.length < 4) pinInput += key; 
    updatePinDots(); 
}

function updatePinDots() { 
    document.querySelectorAll('.pin-dot').forEach((dot, index) => { 
        index < pinInput.length ? dot.classList.add('filled') : dot.classList.remove('filled'); 
    }); 
}

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
        
        // 🟢 FIX: PDF স্ক্যান করার ঠিক আগে পেজটিকে দৃশ্যমান করা হলো
        element.style.display = 'block';  
        element.style.opacity = '1';
        
        try {
            const canvas = await html2canvas(element, { 
                scale: 1.5, 
                useCORS: true, 
                logging: false,
                backgroundColor: '#ffffff',
                windowWidth: 800 
            });
            
            // 🟢 FIX: PDF তৈরি হয়ে গেলে পেজটিকে আবার লুকিয়ে ফেলা হলো
            element.style.opacity = '0';
            element.style.display = 'none'; 
            
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

function loadAllData() { 
    renderDashboard(); 
    loadStudentsList(); 
    renderAttendance(); 
    renderFees(); 
    renderReminders(); 
}

async function exportData() { 
    const currentPin = localStorage.getItem('app_pin') || await dbGet('app_pin') || '1234';

    const data = { 
        students: students || [], 
        attendance: attendance || {}, 
        fees: fees || {}, 
        reminders: reminders || [], 
        globalMaterials: globalMaterials || [], 
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
            globalMaterials = importedData.globalMaterials || []; 
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
                dbSet('globalMaterials', globalMaterials).catch(console.error); 
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
    
    const classStudents = students.filter(s => isStudentCurrentlyActive(s) && (s.class ? s.class.trim() : 'Unassigned') === className); 
    
    classStudents.forEach(s => { tableBody.innerHTML += `<tr><td>${s.serial_no}</td><td>${getStudentHtml(s)}</td><td>${getContactButtons(s.id)}</td></tr>`; }); 
    document.getElementById('classStudentsModal').style.display = 'flex'; 
}

function showCategoryList(type) { 
    const list = students.filter(s => type === 'active' ? isStudentCurrentlyActive(s) : !isStudentCurrentlyActive(s)); 
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
    
    document.getElementById('reminderText').value = ''; 
    document.getElementById('reminderDate').value = ''; 
    renderReminders(); 
    
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Reminder added!', showConfirmButton: false, timer: 1500 });
    
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
    const activeStudents = students.filter(s => isStudentCurrentlyActive(s)); 
    document.getElementById('studentStatsSummary').innerHTML = `<div class="clickable-stat" onclick="showCategoryList('active')"><h4>Active</h4><p class="summary-collected">${activeStudents.length}</p></div><div class="clickable-stat" onclick="showCategoryList('inactive')"><h4>Inactive</h4><p class="summary-due">${students.length - activeStudents.length}</p></div><div><h4>Total</h4><p class="summary-total" style="color:var(--text-main);">${students.length}</p></div>`; 
    
    const birthdayBox = document.getElementById('birthdayAlertBox'); const birthdayList = document.getElementById('birthdayList'); 
    const currentYearForCheck = new Date().getFullYear();
    const birthdayStudents = activeStudents.filter(s => 
        checkBirthday(s.dob) && 
        !dismissedBirthdays.includes(`${s.id}_${currentYearForCheck}`)
    ); 
    if (birthdayStudents.length > 0) { birthdayList.innerHTML = ''; birthdayStudents.forEach(s => { birthdayList.innerHTML += `<div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-input); padding:10px; border-radius:8px; margin-bottom:5px; border:1px solid #ffe4e6; color:var(--text-main);"><div style="display:flex; align-items:center;"><img src="${s.photo || 'https://via.placeholder.com/40?text=S'}" style="width:40px; height:40px; border-radius:50%; margin-right:10px; object-fit:cover; border: 2px solid #000 !important;"><div><strong>${s.name}</strong><br><span style="font-size:11px; color:var(--text-muted);">${s.class || 'Student'}</span></div></div><div style="display:flex; gap:5px;"><button class="btn-whatsapp btn-like" onclick="sendBirthdayWish('wa', ${s.id})"><i class="fab fa-whatsapp"></i></button><button class="btn-sms btn-like" onclick="sendBirthdayWish('sms', ${s.id})"><i class="fas fa-sms"></i></button><button class="btn-success btn-like" onclick="dismissBirthday(${s.id})" title="Dismiss"><i class="fas fa-check"></i></button></div></div>`; }); birthdayBox.style.display = 'block'; } else { birthdayBox.style.display = 'none'; }
    
    // 🟢 NEW: Today's Practice Logs Logic (Updated)
    const pracBox = document.getElementById('todaysPracticeBox');
    const pracList = document.getElementById('todaysPracticeList');
    const pracCountEl = document.getElementById('todaysPracticeCount');
    const todayDateStr = new Date().toLocaleDateString('en-IN');
    let todaysLogs = [];

    students.forEach(s => {
        if(s.practice_log && s.practice_log.length > 0) {
            s.practice_log.forEach(log => {
                if(log.date === todayDateStr) {
                    todaysLogs.push({
                        studentId: s.id,
                        studentName: s.name,
                        studentPhoto: s.photo,
                        topic: log.topic,
                        minutes: log.minutes,
                        time: log.time
                    });
                }
            });
        }
    });

    const uniquePracticingStudents = [...new Set(todaysLogs.map(item => item.studentId))];

    if(todaysLogs.length > 0) {
        if(pracCountEl) pracCountEl.textContent = uniquePracticingStudents.length;
        pracList.innerHTML = '';
        todaysLogs.forEach(log => {
            const photoSrc = log.studentPhoto ? log.studentPhoto : 'https://via.placeholder.com/40?text=S';
            pracList.innerHTML += `
            <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-card); padding:8px 10px; border-radius:8px; margin-bottom:6px; border-left: 3px solid var(--success); box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${photoSrc}" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:1px solid #e2e8f0; cursor:pointer;" onclick="showStudentDetails(${log.studentId})">
                    <div>
                        <div style="font-weight:700; font-size:13px; color:var(--primary); cursor:pointer; line-height: 1.2;" onclick="showStudentDetails(${log.studentId})">${log.studentName}</div>
                        <div style="font-size:10px; color:var(--text-muted); margin-top: 2px;"><i class="fas fa-book"></i> ${log.topic} &nbsp; <i class="fas fa-clock"></i> ${log.time}</div>
                    </div>
                </div>
                <div style="background:var(--success); color:white; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:bold; white-space: nowrap;">
                    ${log.minutes} mins
                </div>
            </div>
        `;
        });
        pracBox.style.display = 'block';
    } else {
        pracBox.style.display = 'none';
    }
    
    const classCounts = activeStudents.reduce((acc, student) => { const className = student.class ? student.class.trim() : 'Unassigned'; acc[className] = (acc[className] || 0) + 1; return acc; }, {}); const classListEl = document.getElementById('classStrengthList'); classListEl.innerHTML = ''; Object.entries(classCounts).sort().forEach(([className, count]) => { classListEl.innerHTML += `<li onclick="showClassStudents('${className}')" style="cursor:pointer; color:var(--text-main);"><strong>${className}:</strong> <span>${count} students</span></li>`; }); 
    
    let monthlyCollected = 0, monthlyDueAmount = 0, yearlyCollected = 0, yearlyDueAmount = 0; 
    let monthlyPaidCount = 0, monthlyDueCount = 0; 
    const currentYear = new Date().getFullYear(), currentMonthStr = `${currentYear}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`; 
    
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]; const todayName = days[new Date().getDay()]; const todaysReminders = reminders.filter(r => r.day === todayName);
    const rBox = document.getElementById('dashboardRemindersBox'); 
    const rList = document.getElementById('dashboardReminderList');
    
if(todaysReminders.length > 0) {
        rList.innerHTML = '<div class="dashboard-reminder-list"></div>';
        const dListContainer = rList.querySelector('.dashboard-reminder-list');
        
        todaysReminders.forEach(r => {
            const rCard = document.createElement('div');
            rCard.className = 'd-reminder-card';
            
            let dateDisplay = "";
            if(r.date) {
                const d = new Date(r.date);
                dateDisplay = `<div style="font-size:11px; color:var(--text-muted); margin-top:4px;"><i class="fas fa-calendar-alt"></i> ${d.toLocaleDateString('en-IN')}</div>`;
            }

            rCard.innerHTML = `
                <div class="d-rem-content">
                    <div class="d-rem-icon"><i class="fas fa-exclamation"></i></div>
                    <div>
                        <div class="d-rem-text">${r.text}</div>
                        ${dateDisplay}
                    </div>
                </div>
                <button class="d-rem-btn" onclick="deleteReminderFromDashboard(${r.id}, this)" title="Mark as Done">
                    <i class="fas fa-check"></i>
                </button>
            `;
            dListContainer.appendChild(rCard);
        });
        rBox.style.display = 'block';
    } else {
        rBox.style.display = 'none';
    }

    students.forEach(student => { 
        let studentMonthlyTotal = 0, studentYearlyTotal = 0, studentYearlyDue = 0; 
        for (let i = 1; i <= 12; i++) { 
            const monthStr = `${currentYear}-${i.toString().padStart(2, '0')}`; 
            
            if (wasStudentActiveDuringMonth(student, monthStr)) {
                if (fees[monthStr]?.[student.id]?.status === 'paid') { 
                    const amt = fees[monthStr][student.id].amount; 
                    studentYearlyTotal += amt; 
                    if (monthStr === currentMonthStr) { studentMonthlyTotal += amt; monthlyPaidCount++; } 
                } else if (isMonthDue(monthStr)) { 
                    const amt = student.fee_amount || DEFAULT_FEE; 
                    studentYearlyDue += amt; 
                    if (monthStr === currentMonthStr) { monthlyDueCount++; monthlyDueAmount += amt; } 
                } 
            }
        } 
        yearlyCollected += studentYearlyTotal; yearlyDueAmount += studentYearlyDue; monthlyCollected += studentMonthlyTotal; 
    }); 
    
    document.getElementById('financeOverviewNumbers').innerHTML = `<div class="clickable-stat" onclick="showFeeBreakdown('collected', '${currentMonthStr}')"><h4>This Month</h4><p class="summary-collected">₹${monthlyCollected}</p></div><div class="clickable-stat" onclick="showFeeBreakdown('due', '${currentMonthStr}')"><h4>Due Now</h4><p class="summary-due">₹${monthlyDueAmount}</p></div>`; document.getElementById('dashboardYearlySummary').innerHTML = `<div class="clickable-stat" onclick="showYearlyBreakdown('collected', ${currentYear})"><h4>Year Collected</h4><p class="summary-collected">₹${yearlyCollected}</p></div><div class="clickable-stat" onclick="showYearlyBreakdown('due', ${currentYear})"><h4>Yearly Due</h4><p class="summary-due">₹${yearlyDueAmount}</p></div>`; 
    
    updateFinanceChart(monthlyPaidCount, monthlyDueCount); 
    renderDueFeesTable(); 
}

window.deleteReminderFromDashboard = async function(id, btnElement) {
    const card = btnElement.closest('.d-reminder-card');
    card.style.transform = 'scale(0.95)';
    card.style.opacity = '0.5';
    
    setTimeout(async () => {
        reminders = reminders.filter(r => r.id !== id);
        await saveData();
        renderReminders();
        renderDashboard();
    }, 300);
};

window.showTodaysPracticingStudentsModal = function() {
    const todayDateStr = new Date().toLocaleDateString('en-IN');
    let todaysLogs = [];

    students.forEach(s => {
        if(s.practice_log && s.practice_log.length > 0) {
            s.practice_log.forEach(log => {
                if(log.date === todayDateStr) {
                    todaysLogs.push({
                        studentId: s.id,
                        studentName: s.name,
                        studentPhoto: s.photo,
                        topic: log.topic,
                        minutes: log.minutes,
                        time: log.time,
                        class_name: s.class || 'Music'
                    });
                }
            });
        }
    });

    if (todaysLogs.length === 0) return;

    let htmlContent = `<div style="max-height: 60vh; overflow-y: auto; text-align: left; padding: 10px 0;">`;
    todaysLogs.forEach(log => {
        const photoSrc = log.studentPhoto ? log.studentPhoto : 'https://via.placeholder.com/40?text=S';
        htmlContent += `
            <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-input); padding:10px; border-radius:10px; margin-bottom:10px; border:1px solid var(--border-color);">
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="${photoSrc}" style="width:45px; height:45px; border-radius:50%; object-fit:cover; border:2px solid #000 !important; cursor:pointer;" onclick="Swal.close(); showStudentDetails(${log.studentId})">
                    <div>
                        <div style="font-weight:700; color:var(--text-main); font-size:15px; cursor:pointer;" onclick="Swal.close(); showStudentDetails(${log.studentId})">${log.studentName}</div>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:3px;"><i class="fas fa-book"></i> ${log.topic}</div>
                        <div style="font-size:11px; color:var(--text-muted);"><i class="fas fa-clock"></i> Logged at: ${log.time}</div>
                    </div>
                </div>
                <div style="background:var(--success); color:white; padding:6px 12px; border-radius:8px; font-weight:bold; font-size: 14px; text-align:center;">
                    ${log.minutes}<br><span style="font-size:10px; font-weight:normal;">Mins</span>
                </div>
            </div>
        `;
    });
    htmlContent += `</div>`;

    Swal.fire({
        title: "Today's Practice Sessions",
        html: htmlContent,
        showCloseButton: true,
        showConfirmButton: false,
        width: '450px'
    });
};

function renderDueFeesTable() { 
    const tbody = document.querySelector('#dueFeeTable tbody'); 
    tbody.innerHTML = ''; 
    const msg = document.getElementById('dueFeeMessage');
    
    const activeStudents = students.filter(s => isStudentCurrentlyActive(s));
    
    let dueList = activeStudents.map(student => {
        const dueMonths = getDueMonthsList(student.id);
        return { student, dueMonths, count: dueMonths.length };
    }).filter(item => item.count > 0);
    
    dueList.sort((a, b) => b.count - a.count);
    
    if (dueList.length === 0) { 
        msg.textContent = 'All active students are cleared up to date.'; 
        return; 
    }
    
    msg.textContent = `Showing ${dueList.length} active students with pending dues.`;
    
    dueList.forEach(({ student, dueMonths, count }) => {
        const totalDueAmount = count * (student.fee_amount || DEFAULT_FEE);
        
        let dueWarningStyle = '';
        if (count >= 3) {
            dueWarningStyle = 'animation: pulseWarning 2s infinite; border-left: 4px solid #dc2626 !important; background-color: rgba(239, 68, 68, 0.05);';
        }
        
        tbody.innerHTML += `
        <tr style="${dueWarningStyle}">
            <td style="padding: 10px;">
                <div style="display:flex; align-items:center;">
                    <img src="${student.photo || 'https://via.placeholder.com/40?text=S'}" style="width:40px; height:40px; border-radius:50%; margin-right:15px; object-fit:cover; border: 2px solid #000 !important; cursor:pointer;" onclick="showStudentDetails(${student.id})">
                    <div>
                        <span style="font-weight:bold; color:var(--text-main); display:block; cursor:pointer;" onclick="showStudentDetails(${student.id})">${student.name}</span>
                        <span style="font-size:11px; color:#dc2626; font-weight:bold; display:block; margin-top:2px;">
                            ${count} Months Due (₹${totalDueAmount})
                        </span>
                        <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:2px;">
                            ${dueMonths.join(', ')}
                        </span>
                    </div>
                </div>
            </td>
            <td style="vertical-align: middle; text-align: right; padding-right: 10px;">
                <div style="display:flex; flex-direction:column; gap:5px; align-items:flex-end;">
                    <button class="btn-success" onclick="openFeeModal(${student.id}, null)" style="padding: 6px 10px; font-size: 11px; width: 80px;">Pay Now</button>
                    ${getContactButtons(student.id, dueMonths[0].split(' ')[0] + '-' + new Date(dueMonths[0]).getMonth() + 1)}
                </div>
            </td>
        </tr>`; 
    }); 
}

function updateFinanceChart(paid, due) { 
    const ctx = document.getElementById('financeChart'); 
    if(!ctx) return; 
    if(financeChartInstance) financeChartInstance.destroy(); 
    financeChartInstance = new Chart(ctx, { 
        type: 'doughnut', 
        data: { labels: ['Paid', 'Due'], datasets: [{ data: [paid, due], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0, hoverOffset: 4 }] }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: document.body.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#6b7280', font: { size: 12, family: "'Poppins', sans-serif" } } } }, cutout: '70%' } 
    }); 
}

function loadStudentsList() { 
    const aList = document.getElementById('activeStudentsList'); 
    const iList = document.getElementById('inactiveStudentsList'); 
    if(!aList || !iList) return; 
    aList.innerHTML = ''; iList.innerHTML = ''; 
    
    if (students.length === 0) { 
        aList.innerHTML = '<tr><td colspan="7" style="text-align:center;">No students found.</td></tr>'; 
        return; 
    } 
    
    const activeStudents = students.filter(s => isStudentCurrentlyActive(s)); 
    const inactiveStudents = students.filter(s => !isStudentCurrentlyActive(s));
    
    [...activeStudents].sort((a,b) => a.serial_no - b.serial_no).forEach(s => aList.innerHTML += createStudentRow(s, true)); 
    [...inactiveStudents].sort((a,b) => a.serial_no - b.serial_no).forEach(s => iList.innerHTML += createStudentRow(s, false)); 
}

function switchStudentView(view) { 
    currentStudentView = view; 
    const btnActive = document.getElementById('btnShowActive'); 
    const btnInactive = document.getElementById('btnShowInactive'); 
    const cActive = document.getElementById('activeStudentsContainer'); 
    const cInactive = document.getElementById('inactiveStudentsContainer'); 
    if (view === 'active') { 
        btnActive.style.background = 'var(--primary)'; btnActive.style.color = 'white'; 
        btnInactive.style.background = 'transparent'; btnInactive.style.color = 'var(--text-muted)'; 
        cActive.style.display = 'block'; cInactive.style.display = 'none'; 
    } else { 
        btnInactive.style.background = 'var(--secondary)'; btnInactive.style.color = 'white'; 
        btnActive.style.background = 'transparent'; btnActive.style.color = 'var(--text-muted)'; 
        cInactive.style.display = 'block'; cActive.style.display = 'none'; 
    } 
}

function createStudentRow(s, isActive) { 
    const isDueAlert = isActive && checkGlobalDues(s.id); 
    const dueClass = isDueAlert ? 'has-dues-alert' : ''; 
    const inactiveClass = isActive ? '' : 'inactive-student'; 
    
    return `<tr class="${dueClass} ${inactiveClass}">
        <td>#${s.serial_no}</td>
        <td>${getStudentHtml(s)}</td>
        <td>${s.class || 'N/A'}</td>
        <td style="font-weight:bold; color:var(--success);">₹${s.fee_amount || DEFAULT_FEE}</td>
        <td>${getAllContactButtons(s)}</td>
        <td>${isActive ? '<span style="color:var(--success); font-weight:bold;">Active</span>' : '<span style="color:var(--danger); font-weight:bold;">Inactive</span>'}</td>
        <td class="action-buttons">
            <button class="btn-info" onclick="openEditStudentModal(${s.id})"><i class="fas fa-edit"></i> Edit</button>
            <button class="btn-warning" onclick="openStatusChangeModal(${s.id}, ${!isActive})"><i class="fas fa-exchange-alt"></i> ${isActive ? 'Deactivate' : 'Activate'}</button>
            <button class="btn-danger" onclick="deleteStudent(${s.id})"><i class="fas fa-trash"></i> Delete</button>
        </td>
    </tr>`; 
}

async function deleteStudent(id) { 
    Swal.fire({ title: 'Delete Student?', text: "This action cannot be undone!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Yes, delete it!' }).then(async (result) => { 
        if (result.isConfirmed) { 
            secureAction(async () => {
                const sIndex = students.findIndex(s => s.id === id);
                if(sIndex !== -1) {
                    students.splice(sIndex, 1);
                    
                    try {
                        await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(id)).delete();
                        Object.keys(attendance).forEach(date => { if (attendance[date][id]) delete attendance[date][id]; }); 
                        Object.keys(fees).forEach(month => { if (fees[month][id]) delete fees[month][id]; }); 
                        
                        await saveData(); 
                        loadAllData(); 
                        closeModal('studentDetailsModal'); 
                        Swal.fire('Deleted!', 'Student removed.', 'success'); 
                    } catch(e) {
                        console.error(e);
                        Swal.fire('Error', 'Failed to delete student.', 'error');
                    }
                }
            });
        } 
    }); 
}

function filterStudentLists() { 
    const input = document.getElementById('searchStudents').value.toLowerCase(); 
    const targetTableId = currentStudentView === 'active' ? 'activeStudentsTable' : 'inactiveStudentsTable'; 
    const trs = document.getElementById(targetTableId).getElementsByTagName('tr'); 
    
    for (let i = 1; i < trs.length; i++) { 
        const tds = trs[i].getElementsByTagName('td'); 
        let textValue = ""; 
        if (tds.length > 1) { 
            const studentInfoDiv = tds[1].querySelector('.student-info'); 
            if (studentInfoDiv) textValue = studentInfoDiv.textContent || studentInfoDiv.innerText; 
        } 
        trs[i].style.display = textValue.toLowerCase().indexOf(input) > -1 ? "" : "none"; 
    } 
}

function searchTable(inputId, tableId) { 
    const input = document.getElementById(inputId).value.toLowerCase(); 
    const trs = document.getElementById(tableId).getElementsByTagName('tr'); 
    for (let i = 1; i < trs.length; i++) { 
        const textValue = trs[i].textContent || trs[i].innerText; 
        trs[i].style.display = textValue.toLowerCase().indexOf(input) > -1 ? "" : "none"; 
    } 
}

function showAttendanceList(type) {
    const targetDate = document.getElementById('attendanceDate').value;
    if(!targetDate) return;

    const currentAttendance = attendance[targetDate] || {};
    let list = [];

    const studentsToConsider = students.filter(s => isStudentActiveOnDate(s, targetDate));

    if (type === 'total') {
        list = studentsToConsider;
    } else if (type === 'present') {
        list = studentsToConsider.filter(s => currentAttendance[s.id] && currentAttendance[s.id].status === 'present');
    } else if (type === 'absent') {
        list = studentsToConsider.filter(s => currentAttendance[s.id] && currentAttendance[s.id].status === 'absent');
    }

    let titleText = type === 'total' ? 'Total Students' : (type === 'present' ? 'Present Students' : 'Absent Students');
    document.getElementById('classStudentsTitle').textContent = `${titleText} (${new Date(targetDate).toLocaleDateString('en-IN')})`;
    
    const tableBody = document.querySelector('#classStudentsTable tbody');
    const tableHead = document.querySelector('#classStudentsTable thead tr');
    tableHead.innerHTML = '<th>Student</th><th>Time</th><th>Action</th>';
    tableBody.innerHTML = '';
    
    if(list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:20px;">No students found for this category.</td></tr>`;
    } else {
        list.forEach(s => {
            const attData = currentAttendance[s.id];
            let timeStr = '-';
            let markBtn = '';
            
            if (type === 'total') {
                if(attData && attData.status === 'present') {
                    timeStr = attData.time ? formatTime12H(attData.time) : '-';
                    markBtn = `<span style="color:var(--success); font-weight:bold;">Present</span>`;
                } else if (attData && attData.status === 'absent') {
                    markBtn = `<span style="color:var(--danger); font-weight:bold;">Absent</span>`;
                } else {
                    markBtn = `<button class="btn-success" style="padding:4px 8px; font-size:11px;" onclick="markSingleAttendance(${s.id}, 'present', this); Swal.close();">Mark Present</button>`;
                }
            } else {
                timeStr = (attData && attData.time) ? formatTime12H(attData.time) : '-';
                if(type === 'present') markBtn = `<button class="btn-danger" style="padding:4px 8px; font-size:11px;" onclick="markSingleAttendance(${s.id}, 'absent', this); Swal.close();">Change to Absent</button>`;
                else if(type === 'absent') markBtn = `<button class="btn-success" style="padding:4px 8px; font-size:11px;" onclick="markSingleAttendance(${s.id}, 'present', this); Swal.close();">Change to Present</button>`;
            }

            tableBody.innerHTML += `
            <tr>
                <td>${getStudentHtml(s)}</td>
                <td style="font-size:12px; color:var(--text-muted);">${timeStr}</td>
                <td>${markBtn}</td>
            </tr>`;
        });
    }
    
    document.getElementById('classStudentsModal').style.display = 'flex';
}

function renderAttendance() { 
    const date = document.getElementById('attendanceDate').value; 
    const tableBody = document.querySelector('#attendanceTable tbody'); 
    tableBody.innerHTML = ''; 
    if (!date) return; 
    
    if (!attendance[date]) attendance[date] = {}; 
    const currentAttendance = attendance[date]; 
    
    // 🟢 NEW: নির্দিষ্ট তারিখে যে স্টুডেন্টরা অ্যাক্টিভ ছিল, শুধু তাদের লিস্ট দেখাবে
    const studentsToDisplay = students.filter(s => isStudentActiveOnDate(s, date));
    studentsToDisplay.sort((a,b) => a.serial_no - b.serial_no);

    let presentCount = 0, absentCount = 0; 
    
    if(studentsToDisplay.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No active students found for this date.</td></tr>';
    } else {
        studentsToDisplay.forEach(s => { 
            let data = currentAttendance[s.id] || null;
            if(typeof data === 'string') {
                data = { status: data, note: '', time: '' };
                currentAttendance[s.id] = data;
            }

            let status = data ? data.status : null; 
            let note = data ? data.note : '';
            let timeMarked = data && data.time ? `<div style="font-size:10px; color:var(--primary); margin-top:2px;">🕒 Marked: ${formatTime12H(data.time)}</div>` : '';

            if (status === 'present') presentCount++; 
            if (status === 'absent') absentCount++; 
            
            let statusText = status === 'present' ? '<span class="status-present">Present</span>' : (status === 'absent' ? '<span class="status-absent">Absent</span>' : '<span style="color:var(--text-muted);">Not Marked</span>'); 
            let rowClass = status ? (status === 'present' ? 'paid' : 'unpaid') : ''; 
            
            tableBody.innerHTML += `
            <tr class="${rowClass}">
                <td style="width: 50%;">
                    ${getStudentHtml(s)}
                    ${timeMarked}
                </td>
                <td style="width: 20%; cursor: pointer;" onclick="addAttendanceNote(${s.id}, '${date}')">
                    ${statusText}
                    ${note ? `<div style="font-size:10px; color:var(--info); margin-top:3px;"><i class="fas fa-sticky-note"></i> Note added</div>` : `<div style="font-size:10px; color:var(--text-muted); margin-top:3px; text-decoration:underline;">+ Add Note</div>`}
                </td>
                <td class="action-buttons" style="width: 30%;">
                    <button class="${status === 'present' ? 'btn-secondary' : 'btn-success'}" onclick="markSingleAttendance(${s.id}, 'present', this)" ${status === 'present' ? 'disabled' : ''}>P</button>
                    <button class="${status === 'absent' ? 'btn-secondary' : 'btn-danger'}" onclick="markSingleAttendance(${s.id}, 'absent', this)" ${status === 'absent' ? 'disabled' : ''}>A</button>
                    <button class="btn-warning" onclick="clearSingleAttendance(${s.id}, this)" title="Clear"><i class="fas fa-eraser"></i></button>
                </td>
            </tr>`; 
        }); 
    }

    document.getElementById('attTotalCount').textContent = studentsToDisplay.length; 
    document.getElementById('attPresentCount').textContent = presentCount; 
    document.getElementById('attAbsentCount').textContent = absentCount; 
}

async function markSingleAttendance(studentId, status, btnElement) { 
    const date = document.getElementById('attendanceDate').value; 
    let manualTime = document.getElementById('attendanceTime').value;
    
    if (!manualTime) {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const mins = now.getMinutes().toString().padStart(2, '0');
        manualTime = `${hours}:${mins}`;
    }

    if (!attendance[date]) attendance[date] = {}; 
    
    const existingData = attendance[date][studentId];
    let note = '';
    if(typeof existingData === 'object' && existingData !== null && existingData.note) {
        note = existingData.note;
    }
    
    attendance[date][studentId] = { status: status, note: note, time: manualTime }; 
    
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 
    try { 
        await saveData(); 
        renderAttendance(); 
        renderDashboard(); 
    } catch(e) { 
        console.error(e); 
        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Saved offline.', showConfirmButton: false, timer: 1500 }); 
        renderAttendance(); 
        renderDashboard(); 
    } 
}

async function clearSingleAttendance(studentId, btnElement) { 
    const date = document.getElementById('attendanceDate').value; 
    if (attendance[date] && attendance[date][studentId]) { 
        btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 
        delete attendance[date][studentId]; 
        try { 
            await saveData(); 
            renderAttendance(); 
            renderDashboard(); 
        } catch(e) { 
            console.error(e); 
            renderAttendance(); 
            renderDashboard(); 
        } 
    } 
}

async function addAttendanceNote(studentId, date) {
    let existingNote = '';
    if (attendance[date] && attendance[date][studentId] && typeof attendance[date][studentId] === 'object') {
        existingNote = attendance[date][studentId].note || '';
    }

    const { value: text } = await Swal.fire({
        title: 'Add Class Note',
        input: 'textarea',
        inputLabel: `Note for ${new Date(date).toLocaleDateString()}`,
        inputPlaceholder: 'Type your note here...',
        inputValue: existingNote,
        showCancelButton: true,
        confirmButtonText: 'Save Note',
        confirmButtonColor: 'var(--primary)',
        inputAttributes: {
            'aria-label': 'Type your note here'
        }
    });

    if (text !== undefined) {
        if (!attendance[date]) attendance[date] = {};
        
        let currentData = attendance[date][studentId];
        
        if (!currentData) {
            attendance[date][studentId] = { status: null, note: text.trim(), time: '' };
        } else if (typeof currentData === 'string') {
            attendance[date][studentId] = { status: currentData, note: text.trim(), time: '' };
        } else {
            currentData.note = text.trim();
        }

        try { 
            await saveData(); 
            renderAttendance();
            
            if(document.getElementById('studentDetailsModal').style.display === 'flex' && currentlyViewingStudentId === studentId) {
                renderStudentDetailsHistory();
            }

            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Note saved', showConfirmButton: false, timer: 1500 });
        } catch(e) { 
            console.error(e); 
            Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Note saved offline', showConfirmButton: false, timer: 1500 });
            renderAttendance();
        } 
    }
}

// 🟢 NEW: QR Code Scanner Integration (Optimized)
function startQRScanner() {
    const modal = document.getElementById('qrScannerModal');
    modal.style.display = 'flex';
    
    html5QrcodeScanner = new Html5QrcodeScanner("qr-reader-box", { 
        fps: 10, 
        qrbox: {width: 250, height: 250},
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        rememberLastUsedCamera: true
    }, false);

    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
}

function closeQRScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(error => {
            console.error("Failed to clear html5QrcodeScanner. ", error);
        });
        html5QrcodeScanner = null;
    }
    document.getElementById('qrScannerModal').style.display = 'none';
}

function onScanSuccess(decodedText, decodedResult) {
    if (decodedText && decodedText.startsWith("STU-")) {
        const parts = decodedText.split('-');
        if(parts.length >= 2) {
            const studentId = parseInt(parts[1]);
            const student = students.find(s => s.id === studentId);
            
            if (student) {
                html5QrcodeScanner.pause(true);
                
                Swal.fire({
                    title: `Mark Present?`,
                    html: `
                        <div style="display:flex; flex-direction:column; align-items:center; gap:10px;">
                            <img src="${student.photo || 'https://via.placeholder.com/80?text=S'}" style="width:80px; height:80px; border-radius:50%; object-fit:cover; border:2px solid #000 !important;">
                            <h3 style="margin:0; font-size:18px;">${student.name}</h3>
                            <p style="margin:0; font-size:14px; color:var(--text-muted);">${student.class || ''}</p>
                        </div>
                    `,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, Mark Present',
                    cancelButtonText: 'Cancel',
                    confirmButtonColor: 'var(--success)'
                }).then((result) => {
                    if (result.isConfirmed) {
                        const tempBtn = document.createElement('button');
                        markSingleAttendance(student.id, 'present', tempBtn).then(() => {
                            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `${student.name} Marked Present`, showConfirmButton: false, timer: 2000 });
                            html5QrcodeScanner.resume();
                        });
                    } else {
                        html5QrcodeScanner.resume();
                    }
                });
            } else {
                Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Student not found in database', showConfirmButton: false, timer: 2000 });
            }
        }
    } else {
        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Invalid QR Code', showConfirmButton: false, timer: 2000 });
    }
}

function onScanFailure(error) { }

function renderFees() { 
    const month = document.getElementById('feeMonth').value; 
    const tableBody = document.querySelector('#feeTable tbody'); 
    tableBody.innerHTML = ''; 
    if (!month) return; 
    
    if (!fees[month]) fees[month] = {}; 
    const currentFees = fees[month]; 
    
    const studentsToDisplay = students.filter(s => wasStudentActiveDuringMonth(s, month));
    
    let paidCount = 0, dueCount = 0, collectedAmount = 0, dueAmount = 0; 
    const monthIsDue = isMonthDue(month);
    
    if(studentsToDisplay.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No active students found for this month.</td></tr>';
    } else {
        studentsToDisplay.sort((a,b) => a.serial_no - b.serial_no).forEach(s => { 
            const data = currentFees[s.id] || { status: 'pending', amount: 0 }; 
            const sFeeAmt = s.fee_amount || DEFAULT_FEE; 
            
            if (data.status === 'paid') { paidCount++; collectedAmount += parseFloat(data.amount); } 
            else if (monthIsDue) { dueCount++; dueAmount += sFeeAmt; } 
            
            let statusBadge = ''; let actionBtn = ''; let rowClass = ''; 
            
            if (data.status === 'paid') { 
                statusBadge = `<span class="status-present">Paid <br><small style="font-size:10px; color:var(--text-muted);">(₹${data.amount})</small></span>`; 
                actionBtn = `<button class="btn-warning" style="font-size:11px; padding:4px 8px;" onclick="clearFee(${s.id}, '${month}')"><i class="fas fa-undo"></i> Undo</button> <button class="btn-receipt" onclick="generateReceiptPDF(${s.id}, '${month}')" title="Download Receipt"><i class="fas fa-file-pdf"></i></button>`; 
                rowClass = 'paid'; 
            } else { 
                statusBadge = monthIsDue ? '<span class="status-absent">Due</span>' : '<span style="color:var(--warning); font-weight:bold;">Pending</span>'; 
                actionBtn = `<button class="btn-success" style="font-size:11px; padding:6px 12px; font-weight:bold;" onclick="openFeeModal(${s.id}, '${month}')">Pay Now</button>`; 
                if(monthIsDue) rowClass = 'unpaid'; else rowClass = 'pending'; 
            } 
            
            tableBody.innerHTML += `<tr class="${rowClass}"><td>${getStudentHtml(s)}</td><td>${statusBadge}</td><td class="action-buttons">${actionBtn}</td></tr>`; 
        }); 
    }

    document.getElementById('feeSummary').innerHTML = `<div class="clickable-stat" onclick="showFeeBreakdown('collected')"><h4>Collected</h4><p class="summary-collected">₹${collectedAmount} <span style="font-size:12px;">(${paidCount})</span></p></div><div class="clickable-stat" onclick="showFeeBreakdown('due')"><h4>Due</h4><p class="summary-due">₹${dueAmount} <span style="font-size:12px;">(${dueCount})</span></p></div>`; 
}

function openFeeModal(studentId, specificMonth = null) { 
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    let targetMonth = specificMonth;
    if (!targetMonth) {
        const dueMonths = getDueMonthsList(studentId);
        if (dueMonths.length > 0) {
            targetMonth = dueMonths[dueMonths.length - 1]; 
            const d = new Date(targetMonth);
            targetMonth = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        } else {
            targetMonth = document.getElementById('feeMonth').value;
        }
    }

    document.getElementById('feeStudentId').value = studentId; 
    document.getElementById('feeRecordMonth').value = targetMonth;
    document.getElementById('feeModalTitle').textContent = `Pay Fee - ${student.name}`; 
    document.getElementById('feeDate').valueAsDate = new Date(); 
    document.getElementById('transactionId').value = ''; 
    document.getElementById('paymentMode').value = 'Cash'; 
    
    const feeAmt = student.fee_amount || DEFAULT_FEE;
    const dueMonthsCount = getDueMonthsList(studentId).length;
    
    const payTypeContainer = document.getElementById('payTypeContainer');
    const payTypeSelect = document.getElementById('payTypeSelect');
    const amountInput = document.getElementById('feeAmount');
    
    if (dueMonthsCount > 1) {
        payTypeContainer.style.display = 'block';
        payTypeSelect.innerHTML = `
            <option value="single">Pay 1 Month Only (₹${feeAmt})</option>
            <option value="all">Pay All ${dueMonthsCount} Due Months Together (₹${feeAmt * dueMonthsCount})</option>
        `;
        payTypeSelect.value = 'single'; 
        amountInput.value = feeAmt;
    } else {
        payTypeContainer.style.display = 'none';
        payTypeSelect.value = 'single';
        amountInput.value = feeAmt;
    }
    
    document.getElementById('feeModal').style.display = 'flex'; 
}

function updateFeeAmountBasedOnType() {
    const studentId = parseInt(document.getElementById('feeStudentId').value);
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    const feeAmt = student.fee_amount || DEFAULT_FEE;
    const dueMonthsCount = getDueMonthsList(studentId).length;
    const payType = document.getElementById('payTypeSelect').value;
    
    if (payType === 'all' && dueMonthsCount > 1) {
        document.getElementById('feeAmount').value = feeAmt * dueMonthsCount;
    } else {
        document.getElementById('feeAmount').value = feeAmt;
    }
}

async function saveFee() { 
    const studentId = parseInt(document.getElementById('feeStudentId').value); 
    const amount = parseFloat(document.getElementById('feeAmount').value); 
    const mode = document.getElementById('paymentMode').value; 
    const transactionId = document.getElementById('transactionId').value.trim(); 
    const date = document.getElementById('feeDate').value; 
    const payType = document.getElementById('payTypeSelect').value;
    const baseMonthStr = document.getElementById('feeRecordMonth').value; 

    if (isNaN(amount) || amount <= 0 || !date) { 
        Swal.fire('Error', 'Valid amount and date required.', 'error'); 
        return; 
    } 

    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const feePerMonth = student.fee_amount || DEFAULT_FEE;

    const dueMonthsStrs = [];
    if (payType === 'all') {
        const now = new Date();
        let iterDate = new Date(student.joining_date);
        if(!isNaN(iterDate.getTime())) {
            iterDate.setDate(1);
            while (iterDate <= now) {
                const y = iterDate.getFullYear();
                const m = iterDate.getMonth() + 1;
                const mStr = `${y}-${m.toString().padStart(2, '0')}`;
                if (wasStudentActiveDuringMonth(student, mStr) && isMonthDue(mStr) && fees[mStr]?.[studentId]?.status !== 'paid') {
                    dueMonthsStrs.push(mStr);
                }
                iterDate.setMonth(iterDate.getMonth() + 1);
            }
        }
    } else {
        dueMonthsStrs.push(baseMonthStr);
    }

    if (dueMonthsStrs.length === 0) {
        Swal.fire('Notice', 'No dues found to clear.', 'info');
        closeModal('feeModal');
        return;
    }

    const calculatedTotal = dueMonthsStrs.length * feePerMonth;
    let actualPaidStrs = [];

    if (amount >= calculatedTotal) {
        dueMonthsStrs.forEach(mStr => {
            if (!fees[mStr]) fees[mStr] = {};
            fees[mStr][studentId] = { status: 'paid', amount: feePerMonth, mode, transactionId, date };
            actualPaidStrs.push(mStr);
        });
    } else {
        if (!fees[baseMonthStr]) fees[baseMonthStr] = {};
        fees[baseMonthStr][studentId] = { status: 'paid', amount: amount, mode, transactionId, date };
        actualPaidStrs.push(baseMonthStr);
    }

    try { 
        await saveData(); 
        renderFees(); 
        renderDashboard(); 
        closeModal('feeModal'); 
        
        let msgMonthStr = actualPaidStrs.join(',');

        Swal.fire({ 
            title: 'Payment Saved!', 
            text: `₹${amount} recorded for ${student.name}.`,
            icon: 'success', 
            showConfirmButton: true, 
            confirmButtonText: 'Done',
            showCancelButton: true,
            cancelButtonText: 'Generate Receipt',
            cancelButtonColor: '#7c3aed'
        }).then((result) => {
            if(result.dismiss === Swal.DismissReason.cancel) {
                generateReceiptPDF(studentId, msgMonthStr);
            } else {
                Swal.fire({
                    title: 'Send Notification?',
                    text: 'Do you want to send a payment confirmation to the student?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: '<i class="fab fa-whatsapp"></i> WhatsApp',
                    confirmButtonColor: '#25D366',
                    cancelButtonText: 'No Thanks',
                    showDenyButton: true,
                    denyButtonText: '<i class="fas fa-sms"></i> SMS',
                    denyButtonColor: '#d97706'
                }).then((msgResult) => {
                    if (msgResult.isConfirmed) {
                        sendMsg('wa', studentId, msgMonthStr, amount, false);
                    } else if (msgResult.isDenied) {
                        sendMsg('sms', studentId, msgMonthStr, amount, false);
                    }
                });
            }
        });
    } catch(e) { 
        console.error(e); 
        Swal.fire('Saved Offline', 'Payment recorded locally.', 'info'); 
        renderFees(); 
        renderDashboard(); 
        closeModal('feeModal'); 
    } 
}

async function clearFee(studentId, month) { 
    if (fees[month] && fees[month][studentId]) { 
        delete fees[month][studentId]; 
        try { 
            await saveData(); 
            renderFees(); 
            renderDashboard(); 
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Payment undone', showConfirmButton: false, timer: 1500 }); 
        } catch(e) { 
            console.error(e); 
            renderFees(); 
            renderDashboard(); 
        } 
    } 
}

function sendGeneralMsg(type, studentId) {
    const student = students.find(s => s.id === studentId);
    if(!student) return;
    
    if(type === 'wa') {
        let cleanPhone = student.phone.replace(/[^0-9]/g, '');
        if(cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
    } else if (type === 'sms') {
        window.open(`sms:${student.phone}`, '_self');
    } else if (type === 'mail') {
        window.open(`mailto:${student.email}`, '_self');
    }
}

function openBulkMessageModal() {
    document.getElementById('bulkMsgText').value = '';
    document.getElementById('waBulkList').style.display = 'none';
    document.getElementById('bulkMsgModal').style.display = 'flex';
}

function sendBulkMsg(type) {
    const filter = document.getElementById('bulkMsgFilter').value;
    const text = document.getElementById('bulkMsgText').value.trim();
    
    if(!text) {
        Swal.fire('Error', 'Please enter a message to send.', 'error');
        return;
    }

    let targetStudents = students.filter(s => isStudentCurrentlyActive(s));
    
    if(filter !== 'All') {
        targetStudents = targetStudents.filter(s => s.class_day === filter);
    }
    
    if(targetStudents.length === 0) {
        Swal.fire('Info', 'No active students found for this filter.', 'info');
        return;
    }

    const fullMsg = `${text}\n\n- ${MY_NAME}\n(${INSTITUTE_NAME})`;

    if(type === 'sms') {
        const phones = targetStudents.map(s => s.phone).filter(p => p).join(',');
        if(!phones) { Swal.fire('Error', 'No valid phone numbers found.', 'error'); return; }
        
        let isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        let separator = isIOS ? '&' : '?';
        window.open(`sms:${phones}${separator}body=${encodeURIComponent(fullMsg)}`, '_self');
        
    } else if (type === 'wa') {
        const waListDiv = document.getElementById('waBulkList');
        waListDiv.innerHTML = '<h4 style="margin:0 0 10px 0; font-size:14px; color:var(--text-main);">Click individually to send WhatsApp:</h4>';
        
        targetStudents.forEach(s => {
            if(s.phone) {
                let cleanPhone = s.phone.replace(/[^0-9]/g, '');
                if(cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
                
                const btn = document.createElement('button');
                btn.className = 'btn-whatsapp';
                btn.style.cssText = 'display:block; width:100%; margin-bottom:8px; text-align:left; padding:8px 12px; font-size:13px; font-weight:bold;';
                btn.innerHTML = `<i class="fab fa-whatsapp"></i> Send to ${s.name}`;
                btn.onclick = function() {
                    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(fullMsg)}`, '_blank');
                    this.style.opacity = '0.5';
                    this.innerHTML += ' <i class="fas fa-check" style="float:right;"></i>';
                };
                waListDiv.appendChild(btn);
            }
        });
        
        waListDiv.style.display = 'block';
    }
}

// 🟢 NEW: Global Study Materials Logic
async function saveGlobalMaterial() {
    const title = document.getElementById('libMatTitle').value.trim();
    const category = document.getElementById('libMatCategory').value;
    const type = document.getElementById('libMatType').value;
    const link = document.getElementById('libMatLink').value.trim();

    if(!title || !link) {
        Swal.fire('Error', 'Title and Link are required.', 'error');
        return;
    }

    const newMat = {
        id: Date.now(),
        title: title,
        category: category,
        type: type,
        link: link,
        date: new Date().toISOString()
    };

    globalMaterials.push(newMat);
    
    document.getElementById('libMatTitle').value = '';
    document.getElementById('libMatLink').value = '';
    
    try {
        await saveData();
        renderGlobalMaterials();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Saved to Library!', showConfirmButton: false, timer: 1500 });
    } catch(e) {
        console.error(e);
        Swal.fire('Saved Offline', 'Will sync later.', 'info');
    }
}

let libraryLimit = 10;
function renderGlobalMaterials() {
    const listDiv = document.getElementById('globalLibraryList');
    const searchVal = document.getElementById('searchLibrary').value.toLowerCase();
    const catFilter = document.getElementById('filterLibCategory').value;
    const typeFilter = document.getElementById('filterLibType').value;

    let filteredList = globalMaterials.filter(mat => {
        const matchSearch = mat.title.toLowerCase().includes(searchVal);
        const matchCat = catFilter === 'All' ? true : mat.category === catFilter;
        const matchType = typeFilter === 'All' ? true : mat.type === typeFilter;
        return matchSearch && matchCat && matchType;
    });

    filteredList.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    const displayList = filteredList.slice(0, libraryLimit);

    if(filteredList.length === 0) {
        listDiv.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:12px; margin-top:20px;">No materials found.</p>';
        return;
    }

    listDiv.innerHTML = '';
    displayList.forEach(mat => {
        let iconHtml = mat.type === 'video' ? '<i class="fab fa-youtube" style="color:#ef4444;"></i>' : (mat.type === 'pdf' ? '<i class="fas fa-file-pdf" style="color:#ef4444;"></i>' : '<i class="fas fa-music" style="color:#3b82f6;"></i>');
        let d = new Date(mat.date);
        
        listDiv.innerHTML += `
            <div style="background:var(--bg-card); padding:12px 15px; border-radius:12px; border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 5px rgba(0,0,0,0.02);">
                <div style="display:flex; align-items:center; gap:15px; flex:1; overflow:hidden;">
                    <div style="font-size:24px; background:var(--bg-input); width:45px; height:45px; display:flex; align-items:center; justify-content:center; border-radius:10px;">${iconHtml}</div>
                    <div style="flex:1; overflow:hidden;">
                        <div style="font-weight:600; color:var(--text-main); font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${mat.title}</div>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:3px; display:flex; gap:10px;">
                            <span><i class="fas fa-tag"></i> ${mat.category}</span>
                            <span><i class="fas fa-calendar-alt"></i> ${d.toLocaleDateString('en-IN')}</span>
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:8px; margin-left:10px;">
                    <a href="${mat.link}" target="_blank" style="background:var(--primary); color:white; padding:8px 12px; border-radius:8px; font-size:12px; font-weight:bold; text-decoration:none;"><i class="fas fa-external-link-alt"></i></a>
                    <button class="btn-warning" style="padding:8px 12px; border-radius:8px;" onclick="shareGlobalMaterial(${mat.id})" title="Share to Students"><i class="fas fa-share"></i></button>
                    <button class="btn-danger" style="padding:8px 12px; border-radius:8px;" onclick="deleteGlobalMaterial(${mat.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    });

    if (filteredList.length > libraryLimit) {
        listDiv.innerHTML += `<button onclick="libraryLimit += 10; renderGlobalMaterials();" style="width:100%; padding:10px; background:var(--bg-input); color:var(--primary); border:1px solid var(--border-color); border-radius:8px; font-weight:bold; cursor:pointer; margin-top:10px;">Load More</button>`;
    }
}

function handleLibraryScroll() {
    const listDiv = document.getElementById('globalLibraryList');
    if (listDiv.scrollTop + listDiv.clientHeight >= listDiv.scrollHeight - 10) {
        if (libraryLimit < globalMaterials.length) {
            libraryLimit += 10;
            renderGlobalMaterials();
        }
    }
}

function filterLibrary() { libraryLimit = 10; renderGlobalMaterials(); }

async function deleteGlobalMaterial(id) {
    Swal.fire({
        title: 'Delete from Library?',
        text: "This won't delete it from students who already received it.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, delete'
    }).then(async (result) => {
        if(result.isConfirmed) {
            globalMaterials = globalMaterials.filter(m => m.id !== id);
            try {
                await saveData();
                renderGlobalMaterials();
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Deleted', showConfirmButton: false, timer: 1500 });
            } catch(e) { console.error(e); }
        }
    });
}

async function shareGlobalMaterial(matId) {
    const mat = globalMaterials.find(m => m.id === matId);
    if(!mat) return;

    let optionsHtml = '<div style="max-height: 250px; overflow-y: auto; text-align: left; background: var(--bg-input); padding: 10px; border-radius: 8px;">';
    const activeStudents = students.filter(s => isStudentCurrentlyActive(s));
    
    const uniqueClasses = [...new Set(activeStudents.map(s => s.class || 'Music'))];
    
    optionsHtml += `
        <label style="display:flex; align-items:center; gap:10px; margin-bottom:10px; padding:10px; background:var(--bg-card); border-radius:8px; border:1px solid var(--border-color);">
            <input type="checkbox" id="shareToAllCheck" value="ALL" style="width:20px; height:20px; cursor:pointer;">
            <span style="font-weight:bold; color:var(--text-main);">Share to ALL Active Students</span>
        </label>
        <h4 style="margin:10px 0 5px 0; font-size:13px; color:var(--text-muted);">Or share to specific classes:</h4>
    `;

    uniqueClasses.forEach(c => {
        optionsHtml += `
        <label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; cursor:pointer;">
            <input type="checkbox" class="share-class-check" value="${c}" style="width:16px; height:16px;">
            <span style="color:var(--text-main); font-size:14px;">${c} Class</span>
        </label>`;
    });
    optionsHtml += '</div>';

    const { value: formValues } = await Swal.fire({
        title: 'Share Material',
        html: `
            <div style="margin-bottom:15px; text-align:left;">
                <strong>${mat.title}</strong><br>
                <span style="font-size:11px; color:var(--text-muted);">${mat.type.toUpperCase()} - ${mat.category}</span>
            </div>
            ${optionsHtml}
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-paper-plane"></i> Share Now',
        confirmButtonColor: 'var(--primary)',
        preConfirm: () => {
            const isAll = document.getElementById('shareToAllCheck').checked;
            const checkedClasses = Array.from(document.querySelectorAll('.share-class-check:checked')).map(cb => cb.value);
            if(!isAll && checkedClasses.length === 0) {
                Swal.showValidationMessage('Please select at least one target');
            }
            return { isAll, checkedClasses };
        }
    });

    if (formValues) {
        let targets = [];
        if (formValues.isAll) {
            targets = activeStudents;
        } else {
            targets = activeStudents.filter(s => formValues.checkedClasses.includes(s.class || 'Music'));
        }

        let sharedCount = 0;
        
        Swal.fire({ title: 'Sharing...', didOpen: () => { Swal.showLoading(); }});

        for (const student of targets) {
            if(!student.study_materials) student.study_materials = [];
            
            const exists = student.study_materials.find(sm => sm.link === mat.link);
            if(!exists) {
                student.study_materials.push({
                    title: mat.title,
                    type: mat.type,
                    link: mat.link,
                    date: new Date().toISOString()
                });
                
                try {
                    await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(student.id)).update({
                        study_materials: student.study_materials
                    });
                    sharedCount++;
                } catch(e) { console.log(e); }
            }
        }
        
        Swal.fire('Success!', `Material shared with ${sharedCount} new students.`, 'success');
    }
}

async function openAddMaterialModal(studentId) {
    const student = students.find(s => s.id === studentId);
    if(!student) return;

    Swal.close(); 

    let libraryOptionsHtml = '<option value="">-- Or Select From Library --</option>';
    globalMaterials.forEach(m => {
        libraryOptionsHtml += `<option value='${JSON.stringify(m)}'>${m.title} (${m.type})</option>`;
    });

    const { value: formValues } = await Swal.fire({
        title: `Add Material for ${student.name.split(' ')[0]}`,
        html: `
            <div style="display:flex; flex-direction:column; gap:10px; text-align:left;">
                <select id="mat-lib-select" class="swal2-select" style="width: 100%; font-size:13px; margin:0;" onchange="
                    if(this.value){
                        const obj = JSON.parse(this.value);
                        document.getElementById('mat-title').value = obj.title;
                        document.getElementById('mat-type').value = obj.type;
                        document.getElementById('mat-link').value = obj.link;
                    }
                ">
                    ${libraryOptionsHtml}
                </select>
                <div style="text-align:center; font-size:12px; color:var(--text-muted); margin:5px 0;">-- OR CREATE NEW --</div>
                <input id="mat-title" class="swal2-input" placeholder="Title (e.g. C Major Scale)" style="width: 100%; font-size:14px; margin:0;">
                <select id="mat-type" class="swal2-select" style="width: 100%; font-size:14px; margin:0;">
                    <option value="video">🎬 Video Link</option>
                    <option value="pdf">📄 PDF Link</option>
                    <option value="audio">🎵 Audio Link</option>
                </select>
                <input id="mat-link" type="url" class="swal2-input" placeholder="Paste URL here..." style="width: 100%; font-size:14px; margin:0;">
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Save Material',
        confirmButtonColor: 'var(--info)',
        preConfirm: () => {
            const title = document.getElementById('mat-title').value.trim();
            const type = document.getElementById('mat-type').value;
            const link = document.getElementById('mat-link').value.trim();
            if (!title || !link) {
                Swal.showValidationMessage('Title and Link are required!');
            }
            return { title, type, link };
        }
    });

    if (formValues) {
        if (!student.study_materials) student.study_materials = [];
        student.study_materials.push({
            title: formValues.title,
            type: formValues.type,
            link: formValues.link,
            date: new Date().toISOString()
        });

        try {
            await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(studentId)).update({
                study_materials: student.study_materials
            });
            
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Material Added!', showConfirmButton: false, timer: 1500 });
            
            setTimeout(() => { showStudentDetails(studentId); }, 500);
            
        } catch(e) {
            console.error(e);
            Swal.fire('Error', 'Failed to save online.', 'error');
        }
    } else {
        setTimeout(() => { showStudentDetails(studentId); }, 200);
    }
}

async function deleteMaterial(studentId, index) {
    const student = students.find(s => s.id === studentId);
    if(!student || !student.study_materials) return;

    Swal.fire({
        title: 'Delete Material?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, delete'
    }).then(async (result) => {
        if(result.isConfirmed) {
            student.study_materials.splice(index, 1);
            try {
                await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(studentId)).update({
                    study_materials: student.study_materials
                });
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Deleted', showConfirmButton: false, timer: 1000 });
                showStudentDetails(studentId); 
            } catch(e) { console.error(e); }
        }
    });
}

function showStudentDetails(id) { 
    const student = students.find(s => s.id === id); 
    if (!student) return; 
    
    currentlyViewingStudentId = id; 
    
    document.getElementById('modalStudentPhoto').src = student.photo || 'https://via.placeholder.com/100?text=S'; 
    document.getElementById('modalStudentName').textContent = student.name; 
    document.getElementById('modalClass').textContent = student.class || 'N/A'; 
    document.getElementById('modalSerialNo').textContent = `#${student.serial_no}`; 
    document.getElementById('modalFeeAmount').textContent = `₹${student.fee_amount || DEFAULT_FEE}`; 
    
    let timeDisplay = student.class_time ? formatTime12H(student.class_time) : '';
    document.getElementById('modalDayTime').textContent = `${student.class_day || '-'} ${timeDisplay}`; 
    
    document.getElementById('modalJoiningDate').textContent = student.joining_date ? new Date(student.joining_date).toLocaleDateString('en-IN') : 'N/A'; 
    document.getElementById('modalPhone').textContent = student.phone || 'N/A'; 
    document.getElementById('modalEmail').textContent = student.email || 'N/A'; 
    document.getElementById('modalGuardianName').textContent = student.guardian || 'N/A'; 
    document.getElementById('modalAddress').textContent = student.address || 'N/A'; 
    document.getElementById('modalDOB').textContent = student.dob ? new Date(student.dob).toLocaleDateString('en-IN') : 'N/A'; 
    
    const sigBtn = document.getElementById('btnViewSignature');
    if(student.student_signature) {
        sigBtn.style.display = 'block';
        sigBtn.onclick = () => {
            Swal.fire({
                title: 'Digital Signature',
                imageUrl: student.student_signature,
                imageAlt: 'Signature',
                customClass: { popup: 'high-z-index-popup' },
                didClose: () => { showStudentDetails(id); }
            });
        };
    } else {
        sigBtn.style.display = 'none';
    }

    // 🟢 Notice Board
    const noticeDisplay = document.getElementById('currentNoticeDisplay');
    const noticeInput = document.getElementById('personalNoticeInput');
    if(student.personal_notice) {
        noticeDisplay.innerHTML = `<i class="fas fa-bullhorn" style="color:var(--warning);"></i> Active Notice: <br><span style="font-weight:normal;">${student.personal_notice}</span>`;
        noticeInput.value = student.personal_notice;
    } else {
        noticeDisplay.innerHTML = '<span style="color:var(--text-muted); font-weight:normal;">No active notice.</span>';
        noticeInput.value = '';
    }

    const sHistory = document.getElementById('modalStatusHistory');
    sHistory.innerHTML = '';
    if(student.status && student.status.history) {
        [...student.status.history].sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(h => {
            let clr = h.status === 'Active' ? 'var(--success)' : 'var(--danger)';
            sHistory.innerHTML += `<li><span style="color:${clr}; font-weight:bold;">${h.status}</span> on ${new Date(h.date).toLocaleDateString('en-IN')}${h.note ? ` - ${h.note}` : ''}</li>`;
        });
    }

    const yearSelect = document.getElementById('detailsFilterYear');
    const monthSelect = document.getElementById('detailsFilterMonth');
    yearSelect.innerHTML = ''; monthSelect.innerHTML = '<option value="all">All Months</option>';
    
    const currentYear = new Date().getFullYear();
    for(let y = currentYear - 2; y <= currentYear; y++) {
        yearSelect.innerHTML += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`;
    }
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    months.forEach((m, index) => {
        let mVal = (index + 1).toString().padStart(2, '0');
        monthSelect.innerHTML += `<option value="${mVal}">${m}</option>`;
    });

    renderStudentDetailsHistory();
    renderStudentNotes();

    const matList = document.getElementById('modalStudyMaterialsList');
    matList.innerHTML = '';
    if(student.study_materials && student.study_materials.length > 0) {
        const sortedMat = [...student.study_materials].sort((a,b) => new Date(b.date) - new Date(a.date));
        sortedMat.forEach((mat, index) => {
            let icon = mat.type === 'video' ? '<i class="fab fa-youtube" style="color:#ef4444;"></i>' : (mat.type === 'pdf' ? '<i class="fas fa-file-pdf" style="color:#ef4444;"></i>' : '<i class="fas fa-music" style="color:#3b82f6;"></i>');
            let d = new Date(mat.date);
            matList.innerHTML += `
                <li style="padding:10px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px; flex:1; overflow:hidden;">
                        <div style="font-size:18px;">${icon}</div>
                        <div style="flex:1; overflow:hidden;">
                            <div style="font-weight:600; font-size:12px; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${mat.title}</div>
                            <div style="font-size:10px; color:var(--text-muted);">${d.toLocaleDateString('en-IN')}</div>
                        </div>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <a href="${mat.link}" target="_blank" style="background:var(--info); color:white; padding:4px 8px; border-radius:4px; text-decoration:none; font-size:11px;"><i class="fas fa-external-link-alt"></i></a>
                        <button class="btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteMaterial(${student.id}, ${student.study_materials.indexOf(mat)})"><i class="fas fa-trash"></i></button>
                    </div>
                </li>
            `;
        });
    } else {
        matList.innerHTML = '<li style="padding:10px; text-align:center; font-size:12px; color:var(--text-muted);">No materials shared yet.</li>';
    }

    const pracList = document.getElementById('modalPracticeList');
    pracList.innerHTML = '';
    if(student.practice_log && student.practice_log.length > 0) {
        const sortedLogs = [...student.practice_log].sort((a,b) => {
            const dateA = new Date(a.date.split('/').reverse().join('-') + ' ' + (a.time || '00:00'));
            const dateB = new Date(b.date.split('/').reverse().join('-') + ' ' + (b.time || '00:00'));
            return dateB - dateA;
        });

        sortedLogs.forEach((log, index) => {
            const actualIndex = student.practice_log.indexOf(log);
            pracList.innerHTML += `
                <li style="padding:10px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:600; font-size:12px; color:var(--text-main);"><i class="fas fa-calendar-alt"></i> ${log.date} ${log.time ? `<span style="color:var(--text-muted); font-weight:normal; font-size:10px; margin-left:5px;">(${log.time})</span>` : ''}</div>
                        <div style="font-size:11px; color:var(--primary); margin-top:3px;"><i class="fas fa-book"></i> ${log.topic || 'Regular Practice'}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="background:var(--success); color:white; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold;">${log.minutes} mins</span>
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            <button onclick="editManagerPracticeLog(${student.id}, ${actualIndex})" style="background:none; border:none; color:var(--info); cursor:pointer; padding:2px;"><i class="fas fa-edit"></i></button>
                            <button onclick="deleteManagerPracticeLog(${student.id}, ${actualIndex})" style="background:none; border:none; color:var(--danger); cursor:pointer; padding:2px;"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </li>
            `;
        });
    } else {
        pracList.innerHTML = '<li style="padding:10px; text-align:center; font-size:12px; color:var(--text-muted);">No practice logs recorded yet.</li>';
    }

    document.getElementById('studentDetailsModal').style.display = 'flex'; 
}

// 🟢 NEW: Manager Practice Edit/Delete
async function editManagerPracticeLog(studentId, logIndex) {
    const student = students.find(s => s.id === studentId);
    if(!student || !student.practice_log) return;

    Swal.close();

    const log = student.practice_log[logIndex];

    const { value: formValues } = await Swal.fire({
        title: 'Edit Practice Log',
        html: `
            <input id="edit-prac-mins" type="number" class="swal2-input" value="${log.minutes}" placeholder="Minutes" style="width: 85%;">
            <input id="edit-prac-topic" type="text" class="swal2-input" value="${log.topic}" placeholder="Topic (Optional)" style="width: 85%; margin-top: 10px;">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Save Changes',
        confirmButtonColor: 'var(--success)',
        preConfirm: () => {
            const mins = document.getElementById('edit-prac-mins').value;
            let topic = document.getElementById('edit-prac-topic').value.trim();
            if (!topic) topic = "Regular Practice";
            if (!mins || mins <= 0) Swal.showValidationMessage('Please enter valid minutes');
            return { minutes: parseInt(mins), topic: topic };
        }
    });

    if (formValues) {
        log.minutes = formValues.minutes;
        log.topic = formValues.topic;

        try {
            await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(studentId)).update({
                practice_log: student.practice_log
            });
        } catch(e) { console.log("Will sync later."); }

        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Updated successfully!', showConfirmButton: false, timer: 1500 });
        setTimeout(() => { showStudentDetails(studentId); }, 500);
    } else {
        setTimeout(() => { showStudentDetails(studentId); }, 200);
    }
}

async function deleteManagerPracticeLog(studentId, logIndex) {
    const student = students.find(s => s.id === studentId);
    if(!student || !student.practice_log) return;

    Swal.fire({
        title: 'Delete this log?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, delete'
    }).then(async (result) => {
        if(result.isConfirmed) {
            student.practice_log.splice(logIndex, 1);
            
            try {
                await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(studentId)).update({
                    practice_log: student.practice_log
                });
            } catch(e) { console.log("Will sync later."); }

            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Deleted', showConfirmButton: false, timer: 1000 });
            showStudentDetails(studentId);
        }
    });
}

// 🟢 NEW: Notice Logic
async function savePersonalNotice() {
    const text = document.getElementById('personalNoticeInput').value.trim();
    const student = students.find(s => s.id === currentlyViewingStudentId);
    if(!student) return;

    student.personal_notice = text;
    try {
        await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(student.id)).update({
            personal_notice: text
        });
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Notice saved!', showConfirmButton: false, timer: 1500 });
        showStudentDetails(currentlyViewingStudentId);
    } catch(e) {
        console.error(e);
        Swal.fire('Error', 'Failed to save online.', 'error');
    }
}

async function deletePersonalNotice() {
    const student = students.find(s => s.id === currentlyViewingStudentId);
    if(!student) return;

    student.personal_notice = "";
    try {
        await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(student.id)).update({
            personal_notice: firebase.firestore.FieldValue.delete()
        });
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Notice removed!', showConfirmButton: false, timer: 1500 });
        showStudentDetails(currentlyViewingStudentId);
    } catch(e) {
        console.error(e);
    }
}

function renderStudentDetailsHistory() {
    const id = currentlyViewingStudentId;
    const year = document.getElementById('detailsFilterYear').value;
    const month = document.getElementById('detailsFilterMonth').value;
    
    const paidList = document.getElementById('modalPaidList');
    const presentList = document.getElementById('modalPresentList');
    const absentList = document.getElementById('modalAbsentList');
    
    paidList.innerHTML = ''; presentList.innerHTML = ''; absentList.innerHTML = '';
    
    let hasPaid = false, hasPresent = false, hasAbsent = false;

    Object.keys(fees).forEach(mStr => {
        const [y, m] = mStr.split('-');
        if(y === year && (month === 'all' || m === month)) {
            if(fees[mStr][id] && fees[mStr][id].status === 'paid') {
                const datePaid = new Date(fees[mStr][id].date).toLocaleDateString('en-IN');
                paidList.innerHTML += `<li>${formatMonthYear(mStr)} <br><span style="font-size:10px; color:var(--text-muted);">Paid on ${datePaid}</span></li>`;
                hasPaid = true;
            }
        }
    });

    Object.keys(attendance).forEach(dStr => {
        const [y, m, d] = dStr.split('-');
        if(y === year && (month === 'all' || m === month)) {
            const attData = attendance[dStr][id];
            if(attData) {
                let status = typeof attData === 'string' ? attData : attData.status;
                let note = typeof attData === 'object' && attData.note ? `<br><span style="font-size:10px; color:var(--info);"><i class="fas fa-sticky-note"></i> ${attData.note}</span>` : '';
                
                const formattedDate = new Date(dStr).toLocaleDateString('en-IN');
                
                if(status === 'present') {
                    let time = typeof attData === 'object' && attData.time ? `<span style="font-size:10px; color:var(--text-muted); margin-left:5px;">(${formatTime12H(attData.time)})</span>` : '';
                    presentList.innerHTML += `<li>${formattedDate} ${time} ${note}</li>`;
                    hasPresent = true;
                } else if(status === 'absent') {
                    absentList.innerHTML += `<li>${formattedDate} ${note}</li>`;
                    hasAbsent = true;
                }
            }
        }
    });

    if(!hasPaid) paidList.innerHTML = '<li>No payments found</li>';
    if(!hasPresent) presentList.innerHTML = '<li>No present records</li>';
    if(!hasAbsent) absentList.innerHTML = '<li>No absent records</li>';
}

function renderStudentNotes() {
    const id = currentlyViewingStudentId;
    const notesList = document.getElementById('modalNotesList');
    notesList.innerHTML = '';
    
    let allNotes = [];
    
    Object.keys(attendance).forEach(dStr => {
        const attData = attendance[dStr][id];
        if(attData && typeof attData === 'object' && attData.note) {
            allNotes.push({ date: dStr, note: attData.note });
        }
    });
    
    allNotes.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    if(allNotes.length === 0) {
        notesList.innerHTML = '<li style="padding:10px; text-align:center; color:var(--text-muted); font-size:12px;">No notes found for this student.</li>';
        return;
    }
    
    allNotes.forEach(item => {
        const formattedDate = new Date(item.date).toLocaleDateString('en-IN');
        notesList.innerHTML += `
            <li class="note-item" style="padding: 10px; border-bottom: 1px solid var(--border-color);">
                <div style="font-size:11px; color:var(--primary); font-weight:bold; margin-bottom:4px;">
                    <i class="fas fa-calendar-alt"></i> ${formattedDate}
                </div>
                <div class="note-text" style="font-size:13px; color:var(--text-main); line-height:1.4;">
                    ${item.note}
                </div>
            </li>
        `;
    });
}

function filterStudentNotes() {
    const input = document.getElementById('noteSearchInput').value.toLowerCase();
    const items = document.querySelectorAll('#modalNotesList .note-item');
    
    items.forEach(item => {
        const text = item.innerText || item.textContent;
        if(text.toLowerCase().indexOf(input) > -1) {
            item.style.display = "";
        } else {
            item.style.display = "none";
        }
    });
}

// 🟢 NEW: Portal View Share/QR Code
function shareQRCode(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    Swal.close(); 
    
    const qrText = `STU-${student.id}`;
    const portalUrl = `${window.location.origin}${window.location.pathname}?student=${student.id}&manager=${DOC_ID}`;

    const tempDiv = document.createElement('div');
    tempDiv.style.padding = '20px';
    tempDiv.style.background = '#fff';
    tempDiv.style.display = 'inline-block';
    tempDiv.style.textAlign = 'center';
    tempDiv.style.borderRadius = '16px';
    
    const titleEl = document.createElement('h3');
    titleEl.textContent = student.name;
    titleEl.style.margin = '0 0 5px 0';
    titleEl.style.color = '#1e293b';
    tempDiv.appendChild(titleEl);
    
    const classEl = document.createElement('p');
    classEl.textContent = student.class || 'Music';
    classEl.style.margin = '0 0 15px 0';
    classEl.style.color = '#64748b';
    classEl.style.fontSize = '14px';
    tempDiv.appendChild(classEl);

    const qrContainer = document.createElement('div');
    qrContainer.style.margin = '0 auto';
    const qr = new QRious({
        element: qrContainer,
        value: qrText,
        size: 200,
        background: '#ffffff',
        foreground: '#000000',
        level: 'H'
    });
    
    const imgEl = document.createElement('img');
    imgEl.src = qr.toDataURL();
    imgEl.style.width = '200px';
    imgEl.style.height = '200px';
    imgEl.style.display = 'block';
    imgEl.style.margin = '0 auto';
    tempDiv.appendChild(imgEl);
    
    const scanText = document.createElement('p');
    scanText.textContent = "Scan for Attendance";
    scanText.style.margin = '15px 0 0 0';
    scanText.style.color = '#10b981';
    scanText.style.fontWeight = 'bold';
    tempDiv.appendChild(scanText);

    document.body.appendChild(tempDiv);

    html2canvas(tempDiv).then(canvas => {
        const qrImageBase64 = canvas.toDataURL('image/png');
        document.body.removeChild(tempDiv);
        
        let profileStatusHtml = '';
        if(student.allow_profile_view === false) {
            profileStatusHtml = `<div style="margin-top:15px; background:#fef2f2; color:#ef4444; padding:8px; border-radius:8px; font-size:12px; font-weight:bold;">Student Portal View is Disabled</div>`;
        }

        Swal.fire({
            title: 'Student QR Code & Portal',
            html: `
                <img src="${qrImageBase64}" style="width: 250px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); margin-bottom: 20px;">
                
                <div style="background: var(--bg-input); padding: 15px; border-radius: 12px; border: 1px solid var(--border-color); text-align:left;">
                    <h4 style="margin: 0 0 10px 0; font-size: 14px; color: var(--text-main);">Personal Portal Link:</h4>
                    <input type="text" value="${portalUrl}" id="portalLinkInput" readonly style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 11px; background: var(--bg-card); color: var(--text-muted); margin-bottom: 10px; box-sizing:border-box;">
                    <div style="display:flex; gap:10px;">
                        <button class="btn-info" onclick="copyPortalLink()" style="flex:1; padding:8px; font-size:12px;"><i class="fas fa-copy"></i> Copy Link</button>
                        <button class="btn-whatsapp" onclick="sharePortalLinkWA('${student.phone}', '${portalUrl}', '${student.name}')" style="flex:1; padding:8px; font-size:12px;"><i class="fab fa-whatsapp"></i> Send Link</button>
                    </div>
                    ${profileStatusHtml}
                </div>
            `,
            showCloseButton: true,
            showCancelButton: true,
            cancelButtonText: 'Download QR',
            cancelButtonColor: '#10b981',
            showConfirmButton: false,
            allowOutsideClick: false,
        }).then((result) => {
            if (result.dismiss === Swal.DismissReason.cancel) {
                const link = document.createElement('a');
                link.download = `QR_${student.name.replace(/\s+/g, '_')}.png`;
                link.href = qrImageBase64;
                link.click();
                setTimeout(() => { showStudentDetails(studentId); }, 500);
            } else {
                setTimeout(() => { showStudentDetails(studentId); }, 200);
            }
        });
    });
}

window.copyPortalLink = function() {
    const copyText = document.getElementById("portalLinkInput");
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Link Copied!', showConfirmButton: false, timer: 1500 });
}

window.sharePortalLinkWA = function(phone, url, name) {
    if(!phone) {
        Swal.fire('Error', 'No phone number available.', 'error');
        return;
    }
    const msg = `Hello ${name},\nHere is your personal student portal link. You can check your attendance, fees, practice logs and study materials here:\n\n${url}\n\n- ${MY_NAME}\n(${INSTITUTE_NAME})`;
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if(cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function openEditStudentModal(id) { 
    const student = students.find(s => s.id === id); 
    if (!student) return; 
    
    document.getElementById('editStudentId').value = student.id; 
    document.getElementById('editStudentName').value = student.name; 
    document.getElementById('editStudentClass').value = student.class || ''; 
    document.getElementById('editStudentFee').value = student.fee_amount || DEFAULT_FEE; 
    document.getElementById('editPhone').value = student.phone || ''; 
    document.getElementById('editStudentEmail').value = student.email || ''; 
    document.getElementById('editGuardianName').value = student.guardian || ''; 
    document.getElementById('editAddress').value = student.address || ''; 
    document.getElementById('editStudentDOB').value = student.dob || ''; 
    document.getElementById('editStudentDay').value = student.class_day || ''; 
    document.getElementById('editStudentTime').value = student.class_time || ''; 
    
    // 🟢 NEW: Allow Profile View Checkbox
    const allowProfileBox = document.getElementById('editAllowProfile');
    allowProfileBox.checked = student.allow_profile_view !== false; 

    currentEditPhotoBase64 = student.photo || null; 
    isPhotoDeletedInEdit = false;
    document.getElementById('editPhotoPreview').src = currentEditPhotoBase64 || 'https://via.placeholder.com/100?text=No+Photo'; 
    
    currentStudentSignature = student.student_signature || null;
    if(currentStudentSignature) {
        document.getElementById('signatureStatus').innerHTML = 'Signature Present <i class="fas fa-check-circle"></i>';
        document.getElementById('signatureStatus').style.display = 'block';
    } else {
        document.getElementById('signatureStatus').style.display = 'none';
    }

    document.getElementById('editStudentModal').style.display = 'flex'; 
}

async function saveStudentChanges() { 
    const id = parseInt(document.getElementById('editStudentId').value); 
    const student = students.find(s => s.id === id); 
    if (!student) return; 
    
    student.name = document.getElementById('editStudentName').value; 
    student.class = document.getElementById('editStudentClass').value; 
    student.fee_amount = parseFloat(document.getElementById('editStudentFee').value) || DEFAULT_FEE; 
    student.phone = document.getElementById('editPhone').value; 
    student.email = document.getElementById('editStudentEmail').value; 
    student.guardian = document.getElementById('editGuardianName').value; 
    student.address = document.getElementById('editAddress').value; 
    student.dob = document.getElementById('editStudentDOB').value; 
    student.class_day = document.getElementById('editStudentDay').value; 
    student.class_time = document.getElementById('editStudentTime').value; 
    
    // 🟢 NEW: Save Profile View Permission
    student.allow_profile_view = document.getElementById('editAllowProfile').checked;

    if (currentEditPhotoBase64) student.photo = currentEditPhotoBase64; 
    else if (isPhotoDeletedInEdit) student.photo = null;

    if (currentStudentSignature) student.student_signature = currentStudentSignature;

    if (student.name.trim() === '') { Swal.fire('Error', 'Name is required.', 'error'); return; } 

    await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(id)).set(student);

    await saveData(); 
    loadAllData(); 
    closeModal('editStudentModal'); 
    Swal.fire('Updated!', 'Student updated successfully.', 'success'); 
}

function generateReport() { 
    const type = document.getElementById('reportType').value; 
    const monthStr = document.getElementById('reportMonth').value; 
    const year = parseInt(document.getElementById('reportYear').value); 
    const tableHead = document.querySelector('#reportTable document.thead'); 
    const tableBody = document.querySelector('#reportTable tbody'); 
    tableHead.innerHTML = ''; 
    tableBody.innerHTML = ''; 
    
    document.getElementById('reportSummary').style.display = 'flex';
    document.getElementById('reportTable').style.display = 'table';
    document.getElementById('reportSearchBox').style.display = 'block';
    document.getElementById('exportReportBtn').style.display = 'block';

    if (type === 'monthly') { 
        if (!monthStr) return; 
        tableHead.innerHTML = '<tr><th>Student ID</th><th>Name</th><th>Class</th><th>Fee Amount</th><th>Status</th></tr>'; 
        let totalExpected = 0, totalCollected = 0, collectedCount = 0, dueCount = 0; 
        
        const sortedStudents = [...students].sort((a,b) => a.serial_no - b.serial_no);

        sortedStudents.forEach(s => { 
            if (wasStudentActiveDuringMonth(s, monthStr)) { 
                const sFee = s.fee_amount || DEFAULT_FEE; 
                totalExpected += sFee; 
                const fData = fees[monthStr] ? fees[monthStr][s.id] : null; 
                let statusHtml = ''; let rowClass = '';
                
                if (fData && fData.status === 'paid') { 
                    totalCollected += parseFloat(fData.amount); 
                    collectedCount++; 
                    statusHtml = `<span style="color:var(--success); font-weight:bold;">Paid (₹${fData.amount})</span><br><span style="font-size:10px; color:var(--text-muted);">${new Date(fData.date).toLocaleDateString()}</span>`; 
                    rowClass = 'paid';
                } else if(isMonthDue(monthStr)) { 
                    dueCount++; 
                    statusHtml = `<span style="color:var(--danger); font-weight:bold;">Due (₹${sFee})</span>`; 
                    rowClass = 'unpaid';
                } else {
                    statusHtml = `<span style="color:var(--warning); font-weight:bold;">Pending</span>`;
                    rowClass = 'pending';
                }
                
                tableBody.innerHTML += `<tr class="${rowClass}"><td>#${s.serial_no}</td><td>${s.name}</td><td>${s.class || '-'}</td><td>₹${sFee}</td><td>${statusHtml}</td></tr>`; 
            } 
        }); 
        
        document.getElementById('reportSummary').innerHTML = `
            <div><h4 style="font-size:10px; color:var(--text-muted);">Total Expected</h4><p style="font-size:14px; color:var(--text-main);">₹${totalExpected}</p></div>
            <div><h4 style="font-size:10px; color:var(--success);">Total Collected</h4><p style="font-size:14px; color:var(--success);">₹${totalCollected} (${collectedCount})</p></div>
            <div><h4 style="font-size:10px; color:var(--danger);">Total Due</h4><p style="font-size:14px; color:var(--danger);">₹${totalExpected - totalCollected} (${dueCount})</p></div>
        `;
    } else { 
        if (!year) return; 
        tableHead.innerHTML = '<tr><th>Student ID</th><th>Name</th><th>Total Paid</th><th>Total Due</th></tr>'; 
        let grandTotalPaid = 0, grandTotalDue = 0; 
        
        const sortedStudents = [...students].sort((a,b) => a.serial_no - b.serial_no);

        sortedStudents.forEach(s => { 
            let sTotalPaid = 0, sTotalDue = 0; 
            for (let i = 1; i <= 12; i++) { 
                const mStr = `${year}-${i.toString().padStart(2, '0')}`; 
                if (wasStudentActiveDuringMonth(s, mStr)) { 
                    if (fees[mStr] && fees[mStr][s.id] && fees[mStr][s.id].status === 'paid') { 
                        sTotalPaid += parseFloat(fees[mStr][s.id].amount); 
                    } else if (isMonthDue(mStr)) { 
                        sTotalDue += s.fee_amount || DEFAULT_FEE; 
                    } 
                } 
            } 
            grandTotalPaid += sTotalPaid; 
            grandTotalDue += sTotalDue; 
            if(sTotalPaid > 0 || sTotalDue > 0 || isStudentCurrentlyActive(s)) {
                tableBody.innerHTML += `<tr><td>#${s.serial_no}</td><td>${s.name}</td><td style="color:var(--success); font-weight:bold;">₹${sTotalPaid}</td><td style="color:var(--danger); font-weight:bold;">₹${sTotalDue}</td></tr>`; 
            }
        }); 
        
        document.getElementById('reportSummary').innerHTML = `
            <div><h4 style="font-size:10px; color:var(--success);">Yearly Collected</h4><p style="font-size:14px; color:var(--success);">₹${grandTotalPaid}</p></div>
            <div><h4 style="font-size:10px; color:var(--danger);">Yearly Due</h4><p style="font-size:14px; color:var(--danger);">₹${grandTotalDue}</p></div>
        `;
    } 
}

function toggleReportInputs() { const type = document.getElementById('reportType').value; if (type === 'monthly') { document.getElementById('reportMonth-group').style.display = 'block'; document.getElementById('reportYear-group').style.display = 'none'; } else { document.getElementById('reportMonth-group').style.display = 'none'; document.getElementById('reportYear-group').style.display = 'block'; } }

async function exportReportPDF() { 
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF(); 
    
    if(instituteLogo) {
        doc.addImage(instituteLogo, 'JPEG', 14, 10, 30, 30);
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18); 
    doc.text(INSTITUTE_NAME, 50, 20); 
    doc.setFontSize(10); 
    doc.setFont("helvetica", "normal");
    doc.text(`Owner: ${MY_NAME}`, 50, 26);
    
    const type = document.getElementById('reportType').value; 
    let title = ""; let dateStr = "";
    
    if (type === 'monthly') { 
        dateStr = document.getElementById('reportMonth').value; 
        title = `Monthly Fee Report - ${formatMonthYear(dateStr)}`; 
    } else { 
        dateStr = document.getElementById('reportYear').value; 
        title = `Yearly Fee Report - ${dateStr}`; 
    } 
    
    doc.setFontSize(14); 
    doc.text(title, 14, 50); 
    
    const tableRows = []; 
    const trs = document.getElementById('reportTable').getElementsByTagName('tr'); 
    
    const headers = [];
    const headerCells = trs[0].getElementsByTagName('th');
    for(let j=0; j<headerCells.length; j++) { headers.push(headerCells[j].innerText); }
    
    for (let i = 1; i < trs.length; i++) { 
        if(trs[i].style.display !== 'none') {
            const row = []; 
            const tds = trs[i].getElementsByTagName('td'); 
            for (let j = 0; j < tds.length; j++) { row.push(tds[j].innerText.replace(/\n/g, ' ')); } 
            tableRows.push(row); 
        }
    } 
    
    doc.autoTable({ 
        startY: 55, 
        head: [headers], 
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 8 }
    }); 
    
    const finalY = doc.lastAutoTable.finalY || 55;
    
    const summaryDivs = document.getElementById('reportSummary').getElementsByTagName('div');
    let summaryText = "Summary: ";
    for(let i=0; i<summaryDivs.length; i++) {
        summaryText += summaryDivs[i].innerText.replace(/\n/g, ': ') + " | ";
    }
    
    doc.setFontSize(10);
    doc.text(summaryText, 14, finalY + 10);
    
    if(authorizedSignature) {
        doc.addImage(authorizedSignature, 'PNG', 150, finalY + 20, 40, 20);
        doc.text("Authorized Sign", 155, finalY + 45);
    }
    
    doc.save(`Report_${title.replace(/\s+/g, '_')}.pdf`); 
}

function updateYearlyChart() {
    const year1 = document.getElementById('analyticsYear').value;
    const year2 = document.getElementById('compareYear').value;
    if(!year1) return;

    const data1 = getYearlyData(parseInt(year1));
    let datasets = [
        {
            label: `Income ${year1}`,
            data: data1.income,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4,
            fill: true,
            yAxisID: 'y'
        },
        {
            label: `Students ${year1}`,
            data: data1.students,
            borderColor: '#3b82f6',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            tension: 0.4,
            yAxisID: 'y1'
        }
    ];

    if(year2 && year2 !== year1) {
        const data2 = getYearlyData(parseInt(year2));
        datasets.push({
            label: `Income ${year2}`,
            data: data2.income,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            tension: 0.4,
            yAxisID: 'y'
        });
    }

    const ctx = document.getElementById('yearlyChart');
    if(!ctx) return;
    if(analyticsChartInstance) analyticsChartInstance.destroy();

    analyticsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { ticks: { color: document.body.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#6b7280' } },
                y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Income (₹)', color: '#10b981' }, ticks: { color: document.body.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#6b7280' } },
                y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Active Students', color: '#3b82f6' }, grid: { drawOnChartArea: false }, ticks: { stepSize: 1, color: document.body.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#6b7280' } }
            },
            plugins: { legend: { labels: { color: document.body.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#6b7280' } } }
        }
    });

    const totalInc = data1.income.reduce((a,b)=>a+b,0);
    const avgInc = Math.round(totalInc/12);
    const maxStu = Math.max(...data1.students);
    
    document.getElementById('yearlyAverages').innerHTML = `
        <div><h4>Avg Monthly Income</h4><p style="color:var(--success);">₹${avgInc}</p></div>
        <div><h4>Total Year Income</h4><p style="color:var(--primary);">₹${totalInc}</p></div>
        <div><h4>Max Students/Month</h4><p style="color:var(--info);">${maxStu}</p></div>
    `;
    document.getElementById('yearlyAverages').style.display = 'flex';
}

function getYearlyData(year) {
    let incomeData = new Array(12).fill(0);
    let studentsData = new Array(12).fill(0);

    for(let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        let activeCount = 0;
        let incCount = 0;

        students.forEach(s => {
            if(wasStudentActiveDuringMonth(s, monthStr)) {
                activeCount++;
                if(fees[monthStr] && fees[monthStr][s.id] && fees[monthStr][s.id].status === 'paid') {
                    incCount += parseFloat(fees[monthStr][s.id].amount);
                }
            }
        });
        
        incomeData[m-1] = incCount;
        studentsData[m-1] = activeCount;
    }
    return { income: incomeData, students: studentsData };
}

function comparePeriods() {
    const m1 = document.getElementById('compMonth1').value;
    const m2 = document.getElementById('compMonth2').value;
    if(!m1 || !m2) return;

    let inc1 = 0, stu1 = 0;
    let inc2 = 0, stu2 = 0;

    students.forEach(s => {
        if(wasStudentActiveDuringMonth(s, m1)) {
            stu1++;
            if(fees[m1] && fees[m1][s.id] && fees[m1][s.id].status === 'paid') inc1 += parseFloat(fees[m1][s.id].amount);
        }
        if(wasStudentActiveDuringMonth(s, m2)) {
            stu2++;
            if(fees[m2] && fees[m2][s.id] && fees[m2][s.id].status === 'paid') inc2 += parseFloat(fees[m2][s.id].amount);
        }
    });

    document.getElementById('compIncome1').textContent = `₹${inc1}`;
    document.getElementById('compIncome2').textContent = `₹${inc2}`;
    document.getElementById('compStudent1').textContent = stu1;
    document.getElementById('compStudent2').textContent = stu2;

    const incDiff = inc2 - inc1;
    const stuDiff = stu2 - stu1;

    const incDiffEl = document.getElementById('compIncomeDiff');
    if(incDiff > 0) { incDiffEl.innerHTML = `<i class="fas fa-arrow-up diff-up"></i> ₹${incDiff}`; }
    else if(incDiff < 0) { incDiffEl.innerHTML = `<i class="fas fa-arrow-down diff-down"></i> ₹${Math.abs(incDiff)}`; }
    else { incDiffEl.innerHTML = `<span style="color:var(--text-muted)">No Change</span>`; }

    const stuDiffEl = document.getElementById('compStudentDiff');
    if(stuDiff > 0) { stuDiffEl.innerHTML = `<i class="fas fa-arrow-up diff-up"></i> ${stuDiff}`; }
    else if(stuDiff < 0) { stuDiffEl.innerHTML = `<i class="fas fa-arrow-down diff-down"></i> ${Math.abs(stuDiff)}`; }
    else { stuDiffEl.innerHTML = `<span style="color:var(--text-muted)">No Change</span>`; }

    document.getElementById('comparisonResults').style.display = 'block';
}

function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }

function generateIDCard() {
    const student = students.find(s => s.id === currentlyViewingStudentId);
    if (!student) return;

    const issueDate = document.getElementById('idCardIssueDate').value;
    const endDate = document.getElementById('idCardEndDate').value;
    
    if(!issueDate) { Swal.fire('Error', 'Issue date is required', 'error'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', [85.6, 53.98]); 

    doc.setFillColor(79, 70, 229); 
    doc.rect(0, 0, 53.98, 15, 'F');
    
    if(instituteLogo) {
        doc.addImage(instituteLogo, 'JPEG', 2, 2, 11, 11);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("STUDENT ID CARD", 15, 6);
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.text(INSTITUTE_NAME, 15, 10, {maxWidth: 35});

    if(student.photo) {
        doc.addImage(student.photo, 'JPEG', 17, 18, 20, 20);
    } else {
        doc.setFillColor(200, 200, 200);
        doc.rect(17, 18, 20, 20, 'F');
    }
    
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.5);
    doc.rect(17, 18, 20, 20, 'S');

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(student.name, 27, 43, {align: "center"});
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`ID: #${student.serial_no}`, 27, 47, {align: "center"});
    doc.text(`Class: ${student.class || 'Music'}`, 27, 51, {align: "center"});
    
    doc.setFontSize(6);
    doc.text(`DOB: ${student.dob ? new Date(student.dob).toLocaleDateString('en-GB') : 'N/A'}`, 5, 58);
    doc.text(`Blood Grp: ______`, 30, 58);
    
    doc.text(`Phone: ${student.phone || 'N/A'}`, 5, 62);
    
    let timeStr = student.class_time ? formatTime12H(student.class_time) : '';
    doc.text(`Batch: ${student.class_day || ''} ${timeStr}`, 5, 66);
    
    doc.text(`Address: ${student.address ? student.address.substring(0, 30) : 'N/A'}`, 5, 70);

    doc.setFillColor(240, 240, 240);
    doc.rect(0, 75, 53.98, 10.6, 'F');
    
    doc.setFontSize(5);
    doc.text(`Issue: ${new Date(issueDate).toLocaleDateString('en-GB')}`, 2, 78);
    if(endDate) doc.text(`Valid Till: ${new Date(endDate).toLocaleDateString('en-GB')}`, 2, 82);

    if(authorizedSignature) {
        doc.addImage(authorizedSignature, 'PNG', 35, 75, 15, 6);
    }
    doc.text("Auth. Sign", 38, 83);

    doc.save(`ID_Card_${student.name.replace(/\s+/g, '_')}.pdf`);
}

document.getElementById('exportPdfBtn').addEventListener('click', () => {
    const student = students.find(s => s.id === currentlyViewingStudentId);
    if (!student) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    if(instituteLogo) {
        doc.addImage(instituteLogo, 'JPEG', 14, 10, 30, 30);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(INSTITUTE_NAME, 50, 20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Instructor: ${MY_NAME} | Phone: 7001471235`, 50, 28);
    
    doc.setLineWidth(0.5);
    doc.line(14, 42, 196, 42);

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Student Profile Report", 105, 50, { align: "center" });

    if(student.photo) {
        doc.addImage(student.photo, 'JPEG', 150, 55, 35, 35);
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Personal Information", 14, 60);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Name: ${student.name}`, 14, 70);
    doc.text(`ID Number: #${student.serial_no}`, 14, 77);
    doc.text(`Class/Instrument: ${student.class || 'N/A'}`, 14, 84);
    
    let timeStr = student.class_time ? formatTime12H(student.class_time) : '';
    doc.text(`Batch Details: ${student.class_day || '-'} ${timeStr}`, 14, 91);
    doc.text(`Joining Date: ${student.joining_date ? new Date(student.joining_date).toLocaleDateString('en-IN') : 'N/A'}`, 14, 98);
    doc.text(`Date of Birth: ${student.dob ? new Date(student.dob).toLocaleDateString('en-IN') : 'N/A'}`, 14, 105);
    
    doc.text(`Phone: ${student.phone || 'N/A'}`, 90, 70);
    doc.text(`Email: ${student.email || 'N/A'}`, 90, 77);
    doc.text(`Guardian: ${student.guardian || 'N/A'}`, 90, 84);
    
    const splitAddress = doc.splitTextToSize(`Address: ${student.address || 'N/A'}`, 90);
    doc.text(splitAddress, 90, 91);
    
    doc.text(`Monthly Fee: Rs. ${student.fee_amount || DEFAULT_FEE}`, 90, 105);

    doc.setLineWidth(0.2);
    doc.line(14, 115, 196, 115);

    let currentY = 125;
    
    doc.setFont("helvetica", "bold");
    doc.text("Attendance Summary (Current Year)", 14, currentY);
    
    const currentYear = new Date().getFullYear();
    let pCount = 0, aCount = 0;
    
    Object.keys(attendance).forEach(dStr => {
        if(dStr.startsWith(currentYear.toString())) {
            const att = attendance[dStr][student.id];
            if(att) {
                let status = typeof att === 'string' ? att : att.status;
                if(status === 'present') pCount++;
                if(status === 'absent') aCount++;
            }
        }
    });
    
    currentY += 10;
    doc.setFont("helvetica", "normal");
    doc.text(`Total Present: ${pCount} days`, 14, currentY);
    doc.text(`Total Absent: ${aCount} days`, 90, currentY);

    currentY += 15;
    doc.setFont("helvetica", "bold");
    doc.text("Fee Payment History (Current Year)", 14, currentY);
    
    const feeRows = [];
    for(let m=1; m<=12; m++) {
        const mStr = `${currentYear}-${m.toString().padStart(2, '0')}`;
        if (wasStudentActiveDuringMonth(student, mStr)) {
            const mName = formatMonthYear(mStr);
            if(fees[mStr] && fees[mStr][student.id] && fees[mStr][student.id].status === 'paid') {
                const fData = fees[mStr][student.id];
                feeRows.push([mName, "Paid", `Rs. ${fData.amount}`, new Date(fData.date).toLocaleDateString('en-IN')]);
            } else if(isMonthDue(mStr)) {
                feeRows.push([mName, "Due", `Rs. ${student.fee_amount || DEFAULT_FEE}`, "-"]);
            }
        }
    }
    
    currentY += 5;
    if(feeRows.length > 0) {
        doc.autoTable({
            startY: currentY,
            head: [['Month', 'Status', 'Amount', 'Date Paid']],
            body: feeRows,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] },
            margin: { left: 14 }
        });
        currentY = doc.lastAutoTable.finalY + 15;
    } else {
        currentY += 5;
        doc.setFont("helvetica", "normal");
        doc.text("No fee records found for current year.", 14, currentY);
        currentY += 15;
    }

    if(authorizedSignature) {
        if(currentY > 250) { doc.addPage(); currentY = 20; }
        doc.addImage(authorizedSignature, 'PNG', 150, currentY, 40, 20);
        doc.setFontSize(10);
        doc.text("Authorized Signature", 155, currentY + 25);
    }
    
    if(student.student_signature) {
        doc.addImage(student.student_signature, 'PNG', 14, currentY, 40, 20);
        doc.text("Student Signature", 15, currentY + 25);
    }

    doc.save(`Profile_${student.name.replace(/\s+/g, '_')}.pdf`);
});

async function exportDashboardPDF() {
    Swal.fire({ title: 'Generating PDF...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    if(instituteLogo) doc.addImage(instituteLogo, 'JPEG', 14, 10, 25, 25);
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text(INSTITUTE_NAME, 45, 20);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`Instructor: ${MY_NAME} | Date: ${new Date().toLocaleDateString('en-IN')}`, 45, 28);
    
    doc.setLineWidth(0.5); doc.line(14, 38, 196, 38);
    
    doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text("Institute Dashboard Report", 105, 48, { align: "center" });

    const currentMonthStr = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    let mCol = 0, mDue = 0, yCol = 0, yDue = 0;
    let mPaidC = 0, mDueC = 0, activeCount = 0;

    students.forEach(s => {
        if(isStudentCurrentlyActive(s)) activeCount++;
        for(let i=1; i<=12; i++) {
            const mStr = `${new Date().getFullYear()}-${i.toString().padStart(2, '0')}`;
            if(wasStudentActiveDuringMonth(s, mStr)) {
                if(fees[mStr]?.[s.id]?.status === 'paid') {
                    const amt = parseFloat(fees[mStr][s.id].amount);
                    yCol += amt;
                    if(mStr === currentMonthStr) { mCol += amt; mPaidC++; }
                } else if(isMonthDue(mStr)) {
                    const amt = s.fee_amount || DEFAULT_FEE;
                    yDue += amt;
                    if(mStr === currentMonthStr) { mDue += amt; mDueC++; }
                }
            }
        }
    });

    doc.autoTable({
        startY: 55,
        head: [['Metric', 'Current Month', 'Current Year']],
        body: [
            ['Total Collected', `Rs. ${mCol}`, `Rs. ${yCol}`],
            ['Total Due', `Rs. ${mDue}`, `Rs. ${yDue}`],
            ['Paid Students', `${mPaidC}`, '-'],
            ['Due Students', `${mDueC}`, '-']
        ],
        theme: 'grid', headStyles: { fillColor: [79, 70, 229] }
    });

    let currentY = doc.lastAutoTable.finalY + 15;
    doc.setFont("helvetica", "bold"); doc.text(`Student Strength: ${activeCount} Active / ${students.length} Total`, 14, currentY);
    currentY += 10;

    const classCounts = {};
    students.filter(s => isStudentCurrentlyActive(s)).forEach(s => { const c = s.class || 'Music'; classCounts[c] = (classCounts[c]||0)+1; });
    const classRows = Object.entries(classCounts).map(([c, n]) => [c, n]);
    
    doc.autoTable({ startY: currentY, head: [['Class/Batch', 'Number of Students']], body: classRows, theme: 'striped' });

    currentY = doc.lastAutoTable.finalY + 15;
    const chartCanvas = document.getElementById('financeChart');
    if(chartCanvas && mCol>0 || mDue>0) {
        if(currentY > 200) { doc.addPage(); currentY = 20; }
        doc.text("Current Month Ratio", 14, currentY);
        doc.addImage(chartCanvas.toDataURL('image/png', 1.0), 'PNG', 14, currentY+5, 60, 60);
    }

    Swal.close();
    doc.save(`Dashboard_${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.pdf`);
}

async function exportToExcel() {
    Swal.fire({ title: 'Preparing Excel...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    
    try {
        const wb = XLSX.utils.book_new();

        const studentData = students.map(s => ({
            "ID": s.serial_no,
            "Name": s.name,
            "Class": s.class || '-',
            "Batch Day": s.class_day || '-',
            "Time": s.class_time ? formatTime12H(s.class_time) : '-',
            "Fee Amount": s.fee_amount || DEFAULT_FEE,
            "Phone": s.phone || '-',
            "Email": s.email || '-',
            "Guardian": s.guardian || '-',
            "DOB": s.dob ? new Date(s.dob).toLocaleDateString('en-IN') : '-',
            "Join Date": s.joining_date ? new Date(s.joining_date).toLocaleDateString('en-IN') : '-',
            "Status": isStudentCurrentlyActive(s) ? "Active" : "Inactive"
        }));
        const wsStudents = XLSX.utils.json_to_sheet(studentData);
        XLSX.utils.book_append_sheet(wb, wsStudents, "All Students");

        const year = new Date().getFullYear();
        const feeData = [];
        students.forEach(s => {
            let row = { "ID": s.serial_no, "Name": s.name };
            let sTotal = 0;
            for(let m=1; m<=12; m++) {
                const mStr = `${year}-${m.toString().padStart(2, '0')}`;
                const mName = new Date(year, m-1).toLocaleString('default', { month: 'short' });
                if(wasStudentActiveDuringMonth(s, mStr)) {
                    if(fees[mStr]?.[s.id]?.status === 'paid') {
                        row[mName] = `Paid (${fees[mStr][s.id].amount})`;
                        sTotal += parseFloat(fees[mStr][s.id].amount);
                    } else if(isMonthDue(mStr)) {
                        row[mName] = "Due";
                    } else {
                        row[mName] = "Pending";
                    }
                } else {
                    row[mName] = "N/A";
                }
            }
            row["Year Total"] = sTotal;
            feeData.push(row);
        });
        const wsFees = XLSX.utils.json_to_sheet(feeData);
        XLSX.utils.book_append_sheet(wb, wsFees, `Fees ${year}`);

        XLSX.writeFile(wb, `MusicClasses_Data_${new Date().toISOString().split('T')[0]}.xlsx`);
        Swal.close();
        Swal.fire('Success', 'Excel file downloaded successfully!', 'success');
    } catch(err) {
        console.error(err);
        Swal.close();
        Swal.fire('Error', 'Failed to generate Excel file.', 'error');
    }
}

async function generateReceiptPDF(studentId, monthStr) {
    const student = students.find(s => s.id === studentId);
    if(!student) return;
    
    const multipleMonths = monthStr.split(',');
    
    let totalAmt = 0;
    let paymentDateStr = '';
    let modeStr = '';
    let txnStr = '';
    let validMonths = [];

    multipleMonths.forEach(m => {
        if(fees[m] && fees[m][studentId] && fees[m][studentId].status === 'paid') {
            totalAmt += parseFloat(fees[m][studentId].amount);
            if(!paymentDateStr) paymentDateStr = new Date(fees[m][studentId].date).toLocaleDateString('en-IN');
            if(!modeStr) modeStr = fees[m][studentId].mode || 'Cash';
            if(!txnStr && fees[m][studentId].transactionId) txnStr = fees[m][studentId].transactionId;
            validMonths.push(formatMonthYear(m));
        }
    });

    if(validMonths.length === 0) {
        Swal.fire('Error', 'Payment record not found.', 'error'); return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a5');
    
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(1);
    doc.rect(5, 5, 138, 195);
    
    if(instituteLogo) doc.addImage(instituteLogo, 'JPEG', 10, 10, 20, 20);
    
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(79, 70, 229);
    doc.text(INSTITUTE_NAME, 35, 18, {maxWidth: 100});
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
    doc.text(`Instructor: ${MY_NAME} | Ph: 7001471235`, 35, 26);
    
    doc.setLineWidth(0.5); doc.line(10, 32, 138, 32);
    
    doc.setFillColor(79, 70, 229); doc.rect(45, 36, 55, 8, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("PAYMENT RECEIPT", 72.5, 41.5, {align: "center"});
    
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(`Date: ${paymentDateStr}`, 100, 52);
    doc.text(`Receipt No: RCT-${Date.now().toString().slice(-6)}`, 10, 52);
    
    doc.text(`Received with thanks from:`, 10, 65);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(student.name, 58, 65);
    
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(`Student ID: #${student.serial_no}  |  Class: ${student.class || 'Music'}`, 10, 72);
    
    const displayMonthsText = validMonths.join(', ');
    const splitMonths = doc.splitTextToSize(`For the month(s) of: ${displayMonthsText}`, 120);
    doc.text(splitMonths, 10, 82);
    
    let currentY = 82 + (splitMonths.length * 5) + 5;
    
    doc.text(`Payment Mode: ${modeStr}`, 10, currentY);
    if(txnStr) doc.text(`Transaction ID: ${txnStr}`, 60, currentY);
    
    doc.setFillColor(240, 240, 240);
    doc.rect(10, currentY + 10, 128, 15, 'F');
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(`Total Amount: Rs. ${totalAmt}/-`, 74, currentY + 20, {align: "center"});
    
    doc.setFont("helvetica", "italic"); doc.setFontSize(9);
    doc.text("* This is a computer-generated receipt.", 10, 185);
    
    if(authorizedSignature) {
        doc.addImage(authorizedSignature, 'PNG', 100, 160, 30, 15);
    }
    doc.setFont("helvetica", "normal"); doc.text("Authorized Sign", 103, 180);

    doc.save(`Receipt_${student.name.replace(/\s+/g,'_')}_${validMonths[0]}.pdf`);
}

async function resetApp() { 
    Swal.fire({ title: 'Factory Reset?', text: "ALL DATA WILL BE ERASED FOREVER! (Including Cloud Data)", icon: 'error', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'YES, ERASE EVERYTHING' }).then(async (result) => { 
        if (result.isConfirmed) { 
            try {
                const user = firebase.auth().currentUser;
                if(user) {
                    const snapshot = await db.collection(COLLECTION_NAME).doc(user.uid).collection('students').get();
                    const batch = db.batch();
                    snapshot.docs.forEach(doc => { batch.delete(doc.ref); });
                    await batch.commit();
                    await dbClear();
                }

                localStorage.clear(); 
                Swal.fire({title: 'Reset Complete', text: 'App will now restart.', icon: 'success', allowOutsideClick: false}).then(() => {
                    window.location.reload(); 
                });
            } catch(e) {
                console.error(e);
                Swal.fire('Error', 'Failed to completely clear cloud data. Local data cleared.', 'error').then(()=>window.location.reload());
            }
        } 
    }); 
}

// 🟢 NEW: Portal Practice Log Submit
window.submitPracticeLog = async function(studentId) {
    const minsStr = document.getElementById('practiceMinutes').value;
    const topic = document.getElementById('practiceTopic').value.trim() || 'Regular Practice';
    let pTime = document.getElementById('practiceTimeInput').value;

    if (!minsStr || isNaN(minsStr) || parseInt(minsStr) <= 0) {
        Swal.fire('Error', 'Please enter valid practice minutes.', 'error');
        return;
    }

    if (!pTime) {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const mins = now.getMinutes().toString().padStart(2, '0');
        pTime = `${hours}:${mins}`;
    }

    const mins = parseInt(minsStr);
    const dateStr = new Date().toLocaleDateString('en-IN');
    
    const urlParams = new URLSearchParams(window.location.search);
    const mUid = urlParams.get('manager');

    try {
        const docRef = db.collection('music_classes').doc(mUid).collection('students').doc(String(studentId));
        const sDoc = await docRef.get();
        if(sDoc.exists) {
            let sData = sDoc.data();
            if(!sData.practice_log) sData.practice_log = [];
            
            sData.practice_log.unshift({
                date: dateStr,
                time: pTime,
                minutes: mins,
                topic: topic
            });

            await docRef.update({ practice_log: sData.practice_log });
            
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Practice Logged! 🎸', showConfirmButton: false, timer: 2000 });
            
            document.getElementById('practiceMinutes').value = '';
            document.getElementById('practiceTopic').value = '';
            document.getElementById('practiceTimeInput').value = '';

            renderPracticeHistoryPortal(sData);
        }
    } catch(e) {
        console.error(e);
        Swal.fire('Error', 'Could not save log. Try again.', 'error');
    }
};

function renderPracticeHistoryPortal(studentData) {
    const listDiv = document.getElementById('practiceHistoryPortal');
    if(!listDiv) return;

    if(!studentData.practice_log || studentData.practice_log.length === 0) {
        listDiv.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:12px; margin:0;">No practice logged yet. Start today!</p>';
        return;
    }

    const displayLogs = studentData.practice_log.slice(0, 5);
    
    let html = '';
    displayLogs.forEach(log => {
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #e2e8f0;">
                <div>
                    <div style="font-size:11px; color:#64748b; font-weight:600;"><i class="fas fa-calendar-alt"></i> ${log.date} ${log.time ? `<span style="font-weight:normal; margin-left:5px;">(${formatTime12H(log.time)})</span>` : ''}</div>
                    <div style="font-size:13px; color:#1e293b; margin-top:2px; font-weight:500;">${log.topic}</div>
                </div>
                <div style="background:#dcfce7; color:#166534; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:bold;">
                    ${log.minutes} mins
                </div>
            </div>
        `;
    });

    listDiv.innerHTML = html;
}
