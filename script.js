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

// 🟢 Past Inactive Periods Calculation & Beautiful UI Function
function getPastInactivePeriodsHtml(student) {
    if (!student.status || !student.status.history || student.status.history.length === 0) return '';

    const historyAsc = [...student.status.history].sort((a, b) => new Date(a.date) - new Date(b.date));
    let currentInactiveStart = null;
    let pastInactiveHtml = '';

    for (let i = 0; i < historyAsc.length; i++) {
        if (historyAsc[i].status === 'Inactive' && !currentInactiveStart) {
            currentInactiveStart = historyAsc[i].date;
        } else if (historyAsc[i].status === 'Active' && currentInactiveStart) {
            
            const startDate = new Date(currentInactiveStart);
            const endDate = new Date(historyAsc[i].date);

            let y = endDate.getFullYear() - startDate.getFullYear();
            let m = endDate.getMonth() - startDate.getMonth();
            let d = endDate.getDate() - startDate.getDate();

            if (d < 0) { m--; const lm = new Date(endDate.getFullYear(), endDate.getMonth(), 0); d += lm.getDate(); }
            if (m < 0) { y--; m += 12; }

            let dur = [];
            if (y > 0) dur.push(y + ' Yrs');
            if (m > 0) dur.push(m + ' Mths');
            if (d > 0) dur.push(d + ' Days');
            if (dur.length === 0) dur.push('0 Days');

            const startStr = startDate.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'2-digit'});
            const endStr = endDate.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'2-digit'});

            // 🟢 থিম অনুযায়ী ডাইনামিক কালার এবং সুন্দর ফুল-উইথ (Full-width) ডিজাইন
            pastInactiveHtml += `
                <div style="margin-top: 12px; font-size: 13px; color: var(--text-main); background: var(--bg-card); border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 8px; border-left: 4px solid var(--danger); box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; flex-wrap: wrap; gap: 5px; align-items: center;">
                    <span style="color: var(--danger); font-weight: 700;"><i class="fas fa-history"></i> Past Inactive:</span> 
                    <span style="font-weight: 500;">${startStr} to ${endStr}</span> 
                    <span style="color: var(--text-muted); font-size: 11px; font-weight: 600;">(${dur.join(', ')})</span>
                </div>`;

            currentInactiveStart = null; 
        }
    }
    return pastInactiveHtml;
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

// 🟢 নতুন ফাংশন: স্টুডেন্ট পোর্টাল থেকে সঠিকভাবে লগআউট করার জন্য
window.studentPortalLogout = function(sId) {
    localStorage.removeItem('verified_student_' + sId);
    // saved_student_id এবং saved_manager_id মুছব না, যাতে শর্টকাট মনে রাখে এটি স্টুডেন্ট পোর্টাল
    window.location.reload(); // পেজটি রিলোড করবে, ফলে স্টুডেন্ট লগইন পপআপ আসবে
};

document.addEventListener('DOMContentLoaded', async () => {
    loadTheme();

    const urlParams = new URLSearchParams(window.location.search);
    let studentViewId = urlParams.get('student');
    let managerUid = urlParams.get('manager');

    // --- 🟢 Chrome Shortcut Fix শুরু ---
    if (!studentViewId || !managerUid) {
        const savedStudent = localStorage.getItem('saved_student_id');
        const savedManager = localStorage.getItem('saved_manager_id');
        // ব্রাউজারের মেমোরিতে স্টুডেন্ট আইডি থাকলে রিলোড না করে সরাসরি ভেরিয়েবলে সেট করা হলো
        if (savedStudent && savedManager) {
            studentViewId = savedStudent;
            managerUid = savedManager;
            // URL-টি সাইলেন্টলি আপডেট করা হলো যাতে পেজ রিলোড না নেয়
            window.history.replaceState(null, '', `?student=${studentViewId}&manager=${managerUid}`);
        }
    } else {
        // প্রথমবার লিংকে ক্লিক করলে ডেটা সেভ করে রাখবে
        localStorage.setItem('saved_student_id', studentViewId);
        localStorage.setItem('saved_manager_id', managerUid);
    }
    // --- 🟢 Chrome Shortcut Fix শেষ ---

    if (studentViewId && managerUid) {
    // 🟢 Manager-এর সবকিছু সাথে সাথে রিমুভ করে দেওয়া হচ্ছে যাতে ব্যাকগ্রাউন্ডে কিছু না দেখায়
    document.body.innerHTML = ''; 
    document.body.style.background = '#f8fafc';

                async function renderStudentPortal() {
                    document.body.innerHTML = '<div style="display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column; background:#f8fafc;"><i class="fas fa-spinner fa-spin fa-3x" style="color:#6366f1; margin-bottom:15px;"></i><h3 style="color:#1e293b; font-family:Poppins;">Loading Portal...</h3></div>';
                    
                    try {
                        const docRef = db.collection('music_classes').doc(managerUid);
                        const currentYear = new Date().getFullYear();
                        const [studentDoc, mainDoc, pLogDoc] = await Promise.all([
                            docRef.collection('students').doc(studentViewId).get(),
                            docRef.get(),
                            docRef.collection('practice_logs').doc(String(currentYear)).get()
                        ]);

                        if(studentDoc.exists && mainDoc.exists) {
                            const s = studentDoc.data();
                            
                            const pLogs = pLogDoc.exists ? pLogDoc.data().records : [];
const legacyLogs = s.practice_log || [];
s.combined_practice_logs = [...legacyLogs, ...pLogs.filter(l => l.studentId == s.id)];
s.combined_practice_logs = s.combined_practice_logs.filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i).sort((a,b)=>b.id-a.id);

// 🟢 UI রেন্ডারিং ফিক্স করার জন্য ডাটা মেইন অবজেক্টে সেট করা হলো
s.practice_log = s.combined_practice_logs;
                            
                            // 🟢 Calculate Accessory Dues HTML
                            let accessoryDuesHtml = '';
                            if (s.unpaid_accessories && s.unpaid_accessories.length > 0) {
                                const totalAccDue = s.unpaid_accessories.reduce((sum, item) => sum + item.due, 0);
                                const itemsList = s.unpaid_accessories.map(item => item.item).join(', ');
                                
                                accessoryDuesHtml = `
                                <style>@keyframes pulseAccWarning { 0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(245, 158, 11, 0); } 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); } }</style>
                                <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border-radius:16px; padding:20px; margin-bottom:25px; border: 2px solid #f59e0b; text-align: center; animation: pulseAccWarning 2s infinite;">
                                    <div style="background: #f59e0b; color: white; width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 10px auto;">
                                        <i class="fas fa-shopping-bag"></i>
                                    </div>
                                    <h4 style="margin:0; color:#b45309; font-size:16px; font-weight: 800; text-transform:uppercase; letter-spacing: 1px;">Accessories Due</h4>
                                    <p style="margin:8px 0; font-size:32px; font-weight:900; color:#d97706;">₹${totalAccDue}</p>
                                    <p style="margin:0; font-size:13px; color:#92400e; font-weight: 600;">Pending for: ${itemsList}</p>
                                </div>`;
                            }
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
                                    let inst = typeof rec.data === 'object' && rec.data !== null && rec.data.instrument ? rec.data.instrument : ''; 

                                    let clr = status === 'present' ? '#16a34a' : (status === 'absent' ? '#dc2626' : '#f59e0b');

                                    const d = new Date(rec.date);
                                    const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' });
                                    const formattedDate = d.toLocaleDateString('en-IN');

                                    let timeDisplay = time ? formatTime12H(time) : '';
                                    let timeBadge = timeDisplay ? `<span style="font-size:11px; color:#3b82f6; background:#eff6ff; padding:2px 6px; border-radius:4px; margin-left:5px;">🕒 ${timeDisplay}</span>` : '';
                                    
                                    let instBadge = inst ? `<span style="font-size:10px; color:#0ea5e9; background:#e0f2fe; padding:2px 6px; border-radius:4px; margin-left:5px; border:1px solid #bae6fd; font-weight:bold;">${inst}</span>` : '';
                                    
                                    let noteDisplay = note ? `<br><span style="font-size:11px; color:#64748b;">📝 ${note}</span>` : '';

                                    return `<div style="margin-bottom:10px; padding:12px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                                        <div>
                                            <strong style="color:#1e293b;">${formattedDate} (${dayName})</strong>${timeBadge}${instBadge}
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

// ৪. Due Data (Fixed for Standalone Portal View)
                                let dueHtml = '';
                                let dueMonthsList = [];
                                const portalNow = new Date();
                                const portalToday = portalNow.getDate();
                                const portalDUE_DATE = 10; // মাসের ১০ তারিখের পর ডিউ দেখাবে
                                
                                let iterDate = new Date(s.joining_date);
                                if (!isNaN(iterDate.getTime())) {
                                    iterDate.setDate(1);
                                    while (iterDate <= portalNow) {
                                        const y = iterDate.getFullYear();
                                        const m = iterDate.getMonth() + 1;
                                        const monthStr = `${y}-${m.toString().padStart(2, '0')}`;
                                        
                                        // ১. চেক করা হচ্ছে মাসটি ডিউ হয়েছে কিনা
                                        let isPastDue = false;
                                        if (y < portalNow.getFullYear()) isPastDue = true;
                                        else if (y === portalNow.getFullYear() && m - 1 < portalNow.getMonth()) isPastDue = true;
                                        else if (y === portalNow.getFullYear() && m - 1 === portalNow.getMonth() && portalToday > portalDUE_DATE) isPastDue = true;

                                        // ২. চেক করা হচ্ছে স্টুডেন্ট ওই মাসে অ্যাক্টিভ ছিল কিনা
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

                                        // ৩. যদি ডিউ হয় এবং পেমেন্ট না করা থাকে
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

// 🟢 NEW: Active/Inactive Status Check for Portal
const isStudentActive = isStudentCurrentlyActive(s);
let badgeHtml = '';
let inactiveDetailsHtml = '';
let practiceLogFormHtml = '';

if (isStudentActive) {
    // 🟢 অ্যাক্টিভ ব্যাজ (মাঝে থাকবে)
    badgeHtml = `<div style="margin-top: 8px;"><span style="background:#dcfce7; color:#166534; padding:6px 16px; border-radius:20px; font-size:13px; font-weight:700; border: 1px solid #bbf7d0; display:inline-block;">Active Student</span></div>`;
    
    // 🟢 NEW: Beautiful Class/Instrument Dropdown Logic (Guitar, Keyboard, Bass Guitar, Mandolin)
    let classList = s.class ? s.class.split(/[\/,]+/).map(c => c.trim()).filter(c => c.length > 0) : ['Music'];
    
    // নামের সাথে ডায়নামিক ইমোজি বসানোর লজিক
    const getInstrumentIcon = (name) => {
        const n = name.toLowerCase();
        if (n.includes('bass guitar') || n.includes('bass')) return '🎸';
        if (n.includes('guitar')) return '🎸';
        if (n.includes('keyboard') || n.includes('piano')) return '🎹';
        if (n.includes('mandolin')) return '🪕';
        return '🎵';
    };

    let classOptionsHtml = classList.map(c => `<option value="${c}">${getInstrumentIcon(c)} ${c}</option>`).join('');
    
    // যদি ক্লাস ১টি থাকে তাহলে লকড ডিজাইন, আর একাধিক থাকলে প্রিমিয়াম সিলেক্ট ডিজাইন
    let classSelectDisabled = classList.length === 1 
        ? 'disabled style="background: #f1f5f9; color: #64748b; font-weight: 600; border: 1px solid #e2e8f0; cursor: not-allowed;"' 
        : 'style="background: #ffffff; color: #4f46e5; font-weight: 700; border: 2px solid #a5b4fc; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.15); cursor: pointer;"';

    practiceLogFormHtml = `
    <div style="margin-bottom: 15px; position: relative;">
        <label style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 5px; display: block; text-align: left; text-transform: uppercase; letter-spacing: 0.5px;">
            <i class="fas fa-music" style="color: #8b5cf6;"></i> Select Subject
        </label>
        
        <select id="practiceClassSelect" ${classSelectDisabled} style="width: 100%; padding: 12px 15px; border-radius: 10px; font-size: 15px; outline: none; box-sizing: border-box; appearance: none; -webkit-appearance: none; transition: all 0.3s;">
            ${classOptionsHtml}
        </select>

    </div>

    <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px dashed #cbd5e1;">
        <span style="font-size: 13px; color: #64748b; font-weight: 600;"><i class="fas fa-clock"></i> Time:</span>
        <input type="time" id="practiceTimeInput" style="flex: 1; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; outline: none; color: #1e293b; background: white;">
        <span style="font-size: 10px; color: #94a3b8;">(Optional)</span>
    </div>

    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
        <input type="number" id="practiceMinutes" placeholder="Mins (e.g. 45)" style="width: 35%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; outline: none; box-sizing: border-box;">
        <input type="text" id="practiceTopic" placeholder="Topic (Optional)" style="width: 65%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; outline: none; box-sizing: border-box;">
    </div>
    
    <button onclick="submitPracticeLog(${studentViewId})" style="width: 100%; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 12px; border-radius: 10px; font-weight: 700; font-size: 15px; cursor: pointer; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: transform 0.2s;">
        <i class="fas fa-check-circle" style="margin-right: 5px;"></i> Log Practice
    </button>`;
} else {
    // 🟢 ইনঅ্যাক্টিভ ব্যাজ (ঠিক নামের নিচে মাঝে থাকবে) - এখানে display:block দিয়েছি যাতে এটা পুরো লাইন নিয়ে নেয়
    badgeHtml = `<div style="margin-top: 8px; display: block;"><span style="background:#fee2e2; color:#991b1b; padding:6px 16px; border-radius:20px; font-size:13px; font-weight:700; border: 1px solid #fecaca; display:inline-block;">Inactive Student</span></div>`;
    
    let inactiveDateText = 'N/A';
    let durationText = '';
    if (s.status && s.status.history && s.status.history.length > 0) {
        const sortedHistory = [...s.status.history].sort((a, b) => new Date(b.date) - new Date(a.date));
        if (sortedHistory[0].status === 'Inactive') {
            const inactiveDate = new Date(sortedHistory[0].date);
            inactiveDateText = inactiveDate.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});
            
            const today = new Date();
            let y = today.getFullYear() - inactiveDate.getFullYear();
            let m = today.getMonth() - inactiveDate.getMonth();
            let d = today.getDate() - inactiveDate.getDate();
            
            if (d < 0) { m--; const lm = new Date(today.getFullYear(), today.getMonth(), 0); d += lm.getDate(); }
            if (m < 0) { y--; m += 12; }
            
            let dur = [];
            if (y > 0) dur.push(y + ' Yrs');
            if (m > 0) dur.push(m + ' Mths');
            if (d > 0) dur.push(d + ' Days');
            if (dur.length === 0) dur.push('Today');
            durationText = `(Duration: ${dur.join(', ')})`;
        }
    }
    // 🟢 ইনঅ্যাক্টিভ ডেট কলাম (ব্যাজের ঠিক নিচে মাঝে থাকবে) - এখানেও display:block দিয়েছি
    inactiveDetailsHtml = `<div style="margin-top: 12px; font-size: 13px; color: #ef4444; font-weight: 600; background: #fef2f2; padding: 10px 20px; border-radius: 12px; display: inline-block; border: 1px dashed #fca5a5;">Inactive Since: ${inactiveDateText} <br> <span style="font-size:12px; color:#b91c1c;">${durationText}</span></div>`;
    
    practiceLogFormHtml = `
    <div style="background: #fef2f2; padding: 15px; border-radius: 8px; border: 1px dashed #fca5a5; text-align: center; color: #dc2626;">
        <i class="fas fa-lock" style="font-size: 24px; margin-bottom: 8px;"></i>
        <div style="font-size: 13px; font-weight: 600;">Practice Logging is Disabled</div>
        <div style="font-size: 11px; margin-top: 4px;">You cannot log practice while your status is Inactive. Please contact your teacher to reactivate your profile.</div>
    </div>`;
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
                ${badgeHtml}
                ${inactiveDetailsHtml}
            </div>

            ${noticeHtml}
            <div style="margin-top: 25px; background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.04); border-top: 4px solid #10b981;">
                <h4 style="margin:0 0 15px 0; color:#334155; font-size:16px;">
                    <i class="fas fa-stopwatch" style="color:#10b981; margin-right:5px;"></i> Daily Practice Log
                </h4>
                
                ${practiceLogFormHtml}
                
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
            ${accessoryDuesHtml}

            <div style="margin-top: 10px;">
                <h4 style="margin:0 0 15px 5px; color:#334155; font-size:16px;"><i class="fas fa-book-open" style="color:#6366f1; margin-right:5px;"></i> My Study Materials</h4>
                <div class="scroller-box" style="background:#fff; border-radius:16px; padding:15px; box-shadow:0 4px 15px rgba(0,0,0,0.04);">${materialsHtml}</div>
            </div>
        </div>

        <div id="m-teacher" class="modal-portal"><div class="modal-content-portal">
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
        </div></div>                   
        
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
            
            <div style="margin-bottom: 15px;">
                ${getPastInactivePeriodsHtml(s)}
            </div>
            
            <div class="scroller-box">${attHtml}</div>
        </div></div>

        <div id="m-pay" class="modal-portal"><div class="modal-content-portal">
            <div class="close-btn" onclick="document.getElementById('m-pay').style.display='none'">&times;</div>
            <h3 style="margin-top:5px; color:#334155; font-size:18px; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">Payment History</h3>
            <div class="scroller-box">${paidHtml}</div>
        </div></div>

        <div style="position:fixed; bottom:0; left:0; width:100%; background:#fff; padding:12px 15px; display:flex; justify-content: space-between; gap:8px; box-shadow:0 -10px 30px rgba(0,0,0,0.06); border-radius:24px 24px 0 0; box-sizing:border-box;">
            
            <button onclick="document.getElementById('m-teacher').style.display='flex'" style="flex:1; height: 45px; background: #f1f5f9; border: none; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                <i class="fas fa-user-tie" style="font-size: 24px; color: #000000;"></i>
            </button>
            
            <button onclick="showStudentPortalQR('${studentViewId}')" style="flex: 1.2; height: 45px; background: #3b82f6; color: #fff; border: none; display: flex; align-items: center; justify-content: center; border-radius: 12px; font-weight: 700; font-size: 13px; box-shadow: 0 4px 10px rgba(59,130,246,0.3); cursor: pointer;">
                QR Code
            </button>
            
            <button onclick="showHelpOptions()" style="flex: 1.2; height: 45px; background: #6366f1; color: #fff; border: none; display: flex; align-items: center; justify-content: center; border-radius: 12px; font-weight: 700; font-size: 13px; box-shadow: 0 4px 10px rgba(99,102,241,0.3); cursor: pointer;">
                Help
            </button>
            
            <button onclick="studentPortalLogout('${studentViewId}')" style="flex:1; height: 45px; background: #fff; color: #ef4444; border: 2px solid #fecaca; display: flex; align-items: center; justify-content: center; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer;">
                Log Out
            </button>

        </div>
    </div>
</div>
`;

setTimeout(() => { renderPracticeHistoryPortal(s); }, 500);

        // 🟢 NEW: Security - Disable Copy, Selection, and Right-Click in Student Portal
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
        document.body.style.webkitTouchCallout = 'none'; // মোবাইলে লং-প্রেস মেনু বন্ধ করবে
        
        // রাইট-ক্লিক মেনু বন্ধ করা
        document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });
        
        // কীবোর্ড বা শর্টকাট দিয়ে কপি করা বন্ধ করা
        document.addEventListener('copy', function(e) {
            e.preventDefault();
        });
        
        // পোর্টালে থাকা সমস্ত ছবিতে ক্লিক বা লং-প্রেস বন্ধ করা
        const allImages = document.querySelectorAll('img');
        allImages.forEach(img => {
            img.style.pointerEvents = 'none';
        });
                            } else {
                                document.body.innerHTML = `<div style="display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column; background:#f8fafc;"><h2 style="color:#ef4444;">Profile Hidden</h2><p>Contact manager to enable access.</p><button onclick="studentPortalLogout('${studentViewId}')" style="padding:10px 20px; background:#1e293b; color:#fff; border:none; border-radius:8px;">Go Back</button></div>`;
                            }
                        } else {
                            document.body.innerHTML = `<div style="display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column; background:#f8fafc;"><h2 style="color:#ef4444;">Student not found.</h2><button onclick="studentPortalLogout('${studentViewId}')" style="padding:10px 20px; background:#1e293b; color:#fff; border:none; border-radius:8px;">Go Back</button></div>`;
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

            // 🟢 NEW: চেক করা হচ্ছে এটি স্টুডেন্ট পোর্টাল কিনা (URL বা LocalStorage থেকে)
            const urlParams = new URLSearchParams(window.location.search);
            const isStudentPortal = urlParams.get('student') && urlParams.get('manager');
            const savedStudent = localStorage.getItem('saved_student_id');
            const savedManager = localStorage.getItem('saved_manager_id');

            // যদি স্টুডেন্ট পোর্টাল হয় (বা ব্রাউজারে স্টুডেন্ট সেভ থাকে), তবে ম্যানেজার লগইন স্ক্রিন লুকিয়ে ফেলবে
            if (isStudentPortal || (savedStudent && savedManager)) {
                if(loginOverlay) loginOverlay.style.display = 'none';
                return; 
            }

            // ম্যানেজার লগইন চেক
            if (user) {
                console.log("Logged in:", user.email);
                if(userDisplay) userDisplay.textContent = `User: ${user.email}`;
                
                loginOverlay.style.display = 'none';
                if(document.getElementById('initialLoader')) document.getElementById('initialLoader').style.display = 'none';
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
                if(document.getElementById('initialLoader')) document.getElementById('initialLoader').style.display = 'none';
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

        window.globalPracticeLogs = [];
window.fetchPracticeLogs = async function() {
    const year = new Date().getFullYear();
    const user = firebase.auth().currentUser;
    if(user) {
        try {
            const doc = await db.collection(COLLECTION_NAME).doc(user.uid).collection('practice_logs').doc(String(year)).get();
            window.globalPracticeLogs = doc.exists ? (doc.data().records || []) : [];
        } catch(e) { console.error(e); }
    }
};

async function initApp() { 
    await window.fetchPracticeLogs();
    await window.fetchSalesData();
    const now = new Date();
            document.getElementById('attendanceDate').valueAsDate = now;
            document.getElementById('attendanceTime').value = now.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'});
            
// বর্তমান মাস 
            const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`; 
            
            // আগের মাস (বাগ ফিক্সড লজিক)
            const prevDate = new Date(now.getFullYear(), now.getMonth(), 1); // প্রথমে মাসের ১ তারিখ ধরা হলো
            prevDate.setMonth(prevDate.getMonth() - 1); // এরপর ১ মাস পেছানো হলো
            const prevMonthStr = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;

            // বিভিন্ন ইনপুটে ডেটা সেট করা
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

                const [aData, fData, rData, scData, gmData, sData] = await Promise.all([
                    dbGet('attendance'),
                    dbGet('fees'),
                    dbGet('reminders'),
                    dbGet('studentSerialCounter'),
                    dbGet('globalMaterials'),
                    dbGet('stockData') // 🟢 এটি নতুন যোগ হলো
                ]);

                students = loadedStudents || []; 
                // 🟢 Manager-এর জন্য গ্লোবাল প্র্যাকটিস লগগুলো স্টুডেন্টদের ডেটায় মার্জ করা হচ্ছে
if (window.globalPracticeLogs && window.globalPracticeLogs.length > 0) {
    window.globalPracticeLogs.forEach(log => {
        let s = students.find(st => st.id == log.studentId);
        if (s) {
            if (!s.practice_log) s.practice_log = [];
            if (!s.practice_log.some(l => l.id === log.id)) {
                s.practice_log.push(log);
            }
        }
    });
    students.forEach(s => {
        if (s.practice_log) s.practice_log.sort((a,b) => b.id - a.id);
    });
}
                attendance = aData || {}; 
                fees = fData || {}; 
                reminders = rData || []; 
                window.stockInventory = sData || [];
                window.renderInventoryDropdown();
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
// 🟢 SUPER FAST: Future Date Inactive Logic (Time Machine)
window.isStudentCurrentlyActive = function(student, targetDateStr = null) {
    if (!student) return false;
    if (!student.status || !student.status.history || student.status.history.length === 0) {
        return student.status?.isActive !== false;
    }
    
    let targetTime = targetDateStr ? new Date(targetDateStr).getTime() : Date.now();
    let joinTime = new Date(student.joining_date).getTime();
    if (targetTime < joinTime) return false;
    
    let currentStatus = 'Active'; 
    let latestHistoryTime = 0;
    
    // 🚀 কোনো sort() ব্যবহার না করে সবচেয়ে ফাস্ট লুপ
    for (let i = 0; i < student.status.history.length; i++) {
        let hTime = new Date(student.status.history[i].date).getTime();
        
        // টার্গেট ডেটের আগে সর্বশেষ যে স্ট্যাটাস ছিল, সেটাই ধরবে
        if (hTime <= targetTime && hTime >= latestHistoryTime) {
            latestHistoryTime = hTime;
            currentStatus = student.status.history[i].status; 
        }
    }
    return currentStatus === 'Active';
};
        
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
        
        // 🟢 NEW: নির্দিষ্ট তারিখে স্টুডেন্ট অ্যাক্টিভ ছিল কিনা তা চেক করার ফাংশন
function isStudentActiveOnDate(student, targetDateStr) {
    if (!targetDateStr) return isStudentCurrentlyActive(student) !== false;
    
    const targetDate = new Date(targetDateStr);
    targetDate.setHours(23, 59, 59, 999); // দিনের শেষ সময় পর্যন্ত চেক
    
    const joinDate = new Date(student.joining_date);
    joinDate.setHours(0, 0, 0, 0);

    if (targetDate < joinDate) return false; // জয়েন করার আগের ডেট হলে দেখাবে না

    if (!student.status || !student.status.history || student.status.history.length === 0) {
        return isStudentCurrentlyActive(student) !== false;
    }

    // ইতিহাস (History) ডেট অনুযায়ী সাজিয়ে চেক করা
    const history = [...student.status.history].sort((a, b) => new Date(a.date) - new Date(b.date));
    let currentStatus = 'Active'; 

    for (let i = 0; i < history.length; i++) {
        const hDate = new Date(history[i].date);
        hDate.setHours(0, 0, 0, 0);
        if (hDate <= targetDate) {
            currentStatus = history[i].status; // টার্গেট ডেটের আগে কোনো পরিবর্তন হলে স্ট্যাটাস আপডেট হবে
        } else {
            break; // ভবিষ্যতের ইভেন্ট বাদ দেওয়া হলো
        }
    }
    return currentStatus === 'Active';
}
        // 🟢 SUPER FAST: Month Active Checker
function wasStudentActiveDuringMonth(student, monthStr) {
    const [year, month] = monthStr.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1).getTime();
    const monthEnd = new Date(year, month, 0, 23, 59, 59).getTime();
    const joinDate = new Date(student.joining_date).getTime();
    
    if (joinDate > monthEnd) return false;
    if (!student.status || !student.status.history || student.status.history.length === 0) {
        return student.status?.isActive !== false;
    }

    let statusAtStart = 'Active'; 
    let latestBeforeStart = 0;
    let changesInMonth = [];

    // 🚀 কোনো sort() ছাড়াই এক লুপে সব চেক করা হচ্ছে
    for (let i = 0; i < student.status.history.length; i++) { 
        let hTime = new Date(student.status.history[i].date).getTime();
        
        if (hTime < monthStart && hTime >= latestBeforeStart) { 
            latestBeforeStart = hTime;
            statusAtStart = student.status.history[i].status; 
        } else if (hTime >= monthStart && hTime <= monthEnd) {
            changesInMonth.push({ time: hTime, status: student.status.history[i].status, dateObj: student.status.history[i].date });
        }
    }
    
    if (changesInMonth.length === 0) { 
        return statusAtStart === 'Active'; 
    }
    
    // ওই মাসে সর্বশেষ পরিবর্তনটা খোঁজা
    let lastChange = changesInMonth[0];
    for(let i = 1; i < changesInMonth.length; i++){
        if(changesInMonth[i].time > lastChange.time) {
            lastChange = changesInMonth[i];
        }
    }
    
    if (lastChange.status === 'Inactive') { 
        return new Date(lastChange.dateObj).getDate() > 10; 
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
        
        // 🟢 FIX: PDF স্ক্যান করার ঠিক আগে পেজটিকে দৃশ্যমান করা হলো
        element.style.display = 'block';  // <--- এটি যোগ করুন
        element.style.opacity = '1';
        
        try {
            const canvas = await html2canvas(element, { 
                scale: 1.5, 
                useCORS: true, 
                logging: false,
                backgroundColor: '#ffffff',
                windowWidth: 800 // মোবাইল থেকে সাদা পেজ আসা বন্ধ করতে সাহায্য করবে
            });
            
            // 🟢 FIX: PDF তৈরি হয়ে গেলে পেজটিকে আবার লুকিয়ে ফেলা হলো
            element.style.opacity = '0';
            element.style.display = 'none'; // <--- এটি যোগ করুন';
            
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

// Date of Birth একটু সুন্দর করে দেখানোর জন্য (DD/MM/YYYY)
    const dobDisplay = dob ? new Date(dob).toLocaleDateString('en-IN') : '-';

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
            <div><strong>Email:</strong> ${email || '-'}</div> <div><strong>DOB:</strong> ${dobDisplay}</div> <div><strong>Signature:</strong> ${sigDisplay}</div>
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
        
        // 🟢 ম্যাজিক: 'await' সরিয়ে দিয়ে সরাসরি UI আপডেট করা হলো
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

        // 🟢 ব্যাকগ্রাউন্ডে নীরবে ডেটাবেসে আপলোড হবে
        db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(newStudent.id)).set(newStudent).catch(e => console.log(e));
        dbSet('studentSerialCounter', studentSerialCounter).catch(e => console.log(e));
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
        globalMaterials: globalMaterials || [], 
        salesDataArray: salesDataArray || [], // 🟢 Sales Data যুক্ত করা হলো
        stockInventory: window.stockInventory || [], // 🟢 Stock Data যুক্ত করা হলো
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
            text: 'All data (Students, Fees, Sales, Stock, Signature & PIN) saved offline.', 
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
            salesDataArray = importedData.salesDataArray || []; // 🟢 Sales রিস্টোর
            window.stockInventory = importedData.stockInventory || []; // 🟢 Stock রিস্টোর
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
                dbSet('stockData', window.stockInventory).catch(console.error); // 🟢 Stock ফায়ারবেসে সেভ
                
                const currentYear = document.getElementById('salesYearFilter')?.value || new Date().getFullYear();
                window.syncSalesToFirebase(currentYear); // 🟢 Sales ফায়ারবেসে সেভ
                
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
            window.renderSalesUI(); // 🟢 Sales UI আপডেট
            window.renderStockTable(); // 🟢 Stock UI আপডেট
            window.renderInventoryDropdown(); // 🟢 Dropdown আপডেট
            
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
                html: `Successfully restored <b>${loadedCount}</b> students.<br>All Fees, Sales, and Stocks are recovered.`,
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
if(tabName === 'sales') {
        window.renderSalesUI(); // 🟢 এখানে UI কথাটি যুক্ত করতে হবে
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
    
    // এখানে s.class.trim() যোগ করা হয়েছে যাতে স্পেস থাকলেও সব স্টুডেন্টকে খুঁজে পায়
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

    // 🟢 NEW: লেটেস্ট লগ (Latest Update) সবার উপরে দেখানোর লজিক
    todaysLogs.sort((a, b) => {
        const parseTime = (t) => {
            if (!t) return 0;
            const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!match) return 0;
            let h = parseInt(match[1]);
            let m = parseInt(match[2]);
            let ampm = match[3].toUpperCase();
            if (h === 12) h = 0;
            if (ampm === 'PM') h += 12;
            return h * 60 + m;
        };
        // b.time থেকে a.time বিয়োগ করা হচ্ছে, যাতে নতুন সময় সবার উপরে থাকে
        return parseTime(b.time) - parseTime(a.time); 
    });

    // কতজন ইউনিক স্টুডেন্ট আজ প্র্যাকটিস করেছে তা গোনা
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
    // 🟢 END: Practice Logs Logic
    
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
    
    const defaulters = students.filter(s => isStudentCurrentlyActive(s)).map(s => { return { student: s, months: getDueMonthsList(s.id) }; }).filter(item => item.months.length > 0); 
    
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
    
    // 🟢 PDF Inactive Details Logic Start
    if (student.status && student.status.history && student.status.history.length > 0) {
        const sortedHistory = [...student.status.history].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // ১. যদি বর্তমানে Inactive থাকে
        if (sortedHistory[0].status === 'Inactive') {
            const inactiveDate = new Date(sortedHistory[0].date);
            const today = new Date();
            
            let yr = today.getFullYear() - inactiveDate.getFullYear();
            let mn = today.getMonth() - inactiveDate.getMonth();
            let d = today.getDate() - inactiveDate.getDate();
            if (d < 0) { mn--; const lm = new Date(today.getFullYear(), today.getMonth(), 0); d += lm.getDate(); }
            if (mn < 0) { yr--; mn += 12; }
            
            let dur = [];
            if (yr > 0) dur.push(yr + ' Yrs');
            if (mn > 0) dur.push(mn + ' Mths');
            if (d > 0) dur.push(d + ' Days');
            if (dur.length === 0) dur.push('Today');
            
            doc.setTextColor(220, 38, 38); 
            doc.setFont("helvetica", "bold");
            doc.text("Status:", leftMargin, y);
            doc.setFont("helvetica", "normal");
            doc.text(`Inactive From ${inactiveDate.toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'2-digit'})} (Duration: ${dur.join(', ')})`, leftMargin + 35, y);
            doc.setTextColor(0); 
            y += lineHeight;
        } 
        // ২. যদি অতীতে Inactive ছিল কিন্তু এখন Active
        else if (sortedHistory[0].status === 'Active' && sortedHistory.length > 1 && sortedHistory[1].status === 'Inactive') {
            const reactivatedDate = new Date(sortedHistory[0].date);
            const inactiveDate = new Date(sortedHistory[1].date);
            
            let yr = reactivatedDate.getFullYear() - inactiveDate.getFullYear();
            let mn = reactivatedDate.getMonth() - inactiveDate.getMonth();
            let d = reactivatedDate.getDate() - inactiveDate.getDate();
            if (d < 0) { mn--; const lm = new Date(reactivatedDate.getFullYear(), reactivatedDate.getMonth(), 0); d += lm.getDate(); }
            if (mn < 0) { yr--; mn += 12; }
            
            let dur = [];
            if (yr > 0) dur.push(yr + ' Yrs');
            if (mn > 0) dur.push(mn + ' Mths');
            if (d > 0) dur.push(d + ' Days');
            if (dur.length === 0) dur.push('0 Days');
            
            const startStr = inactiveDate.toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'2-digit'});
            const endStr = reactivatedDate.toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'2-digit'});

            doc.setTextColor(180, 83, 9); 
            doc.setFont("helvetica", "bold");
            doc.text("Past Inactive:", leftMargin, y);
            doc.setFont("helvetica", "normal");
            doc.text(`${startStr} to ${endStr} (${dur.join(', ')})`, leftMargin + 35, y);
            doc.setTextColor(0); 
            y += lineHeight;
        }
    }
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
        y += 10;
    } else {
        y += 10; 
    }

    // --- 🟢 NEW: Practice Statistics (Grid & Class-wise) Section Start ---
    if (student.practice_log && student.practice_log.length > 0) {
        if (y > 230) { addPageFooter(doc, currentDate); doc.addPage(); y = 20; }

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("Practice History Statistics", leftMargin, y);
        y += 8;

        let classesToReport = ['All'];
        let classList = student.class ? student.class.split(/[\/,]+/).map(c => c.trim()).filter(c => c.length > 0) : [];
        
        // একের বেশি সাবজেক্ট থাকলে 'All' এর পর বাকিগুলো লিস্টে ঢুকবে
        if (classList.length > 1) {
            classesToReport = ['All', ...classList];
        }

        classesToReport.forEach(subject => {
            if (y > 240) { addPageFooter(doc, currentDate); doc.addPage(); y = 20; }

            const stats = getPracticeStats(student, subject);
            const title = subject === 'All' ? (classList.length > 1 ? "Overall Practice (All Subjects)" : "Practice Stats") : `Subject: ${subject}`;

            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 102, 204); 
            doc.text(title, leftMargin, y);
            y += 6;

            const boxW = 55;
            const boxH = 15;
            const gap = 5;
            let startX = leftMargin;

            const statBoxes = [
                { label: "TODAY", val: formatPracticeTime(stats.today), color: [99, 102, 241] },
                { label: "THIS WEEK", val: formatPracticeTime(stats.week), color: [217, 119, 6] },
                { label: "THIS MONTH", val: formatPracticeTime(stats.month), color: [225, 29, 72] },
                { label: "THIS YEAR", val: formatPracticeTime(stats.year), color: [37, 99, 235] },
                { label: "LIFETIME", val: formatPracticeTime(stats.lifetime), color: [16, 185, 129] },
                { label: "DAILY AVG", val: formatPracticeTime(stats.avg), color: [219, 39, 119] }
            ];

            statBoxes.forEach((box, i) => {
                const row = Math.floor(i / 3);
                const col = i % 3;
                const bx = startX + (col * (boxW + gap));
                const by = y + (row * (boxH + gap));

                doc.setFillColor(245, 247, 250);
                doc.setDrawColor(220, 220, 220);
                doc.rect(bx, by, boxW, boxH, 'FD');

                doc.setFontSize(8);
                doc.setTextColor(100, 116, 139);
                doc.setFont("helvetica", "bold");
                doc.text(box.label, bx + (boxW / 2), by + 5, { align: 'center' });

                doc.setFontSize(12);
                doc.setTextColor(box.color[0], box.color[1], box.color[2]);
                doc.text(box.val, bx + (boxW / 2), by + 12, { align: 'center' });
            });

            y += (2 * boxH) + gap + 8; 
        });

        doc.setDrawColor(200);
        doc.setLineWidth(0.5);
        doc.line(leftMargin, y, pageWidth - leftMargin, y);
        y += 8;

        // --- Practice Log Table (Recent) ---
        if (y > 250) { addPageFooter(doc, currentDate); doc.addPage(); y = 20; }

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("Practice Log Details (Recent 20)", leftMargin, y);
        y += 8;

        doc.setFillColor(230);
        doc.rect(leftMargin, y, pageWidth - (leftMargin * 2), 8, 'F');
        doc.setFontSize(10);
        
        doc.text("Date & Time", leftMargin + 5, y + 5);
        doc.text("Subject", leftMargin + 45, y + 5);
        doc.text("Topic", leftMargin + 85, y + 5);
        doc.text("Duration", leftMargin + 150, y + 5);
        y += 12;

        doc.setFont("helvetica", "normal");
        
        // লেটেস্ট ২০টি লগ দেখানো
        const recentLogs = [...student.practice_log].sort((a, b) => b.id - a.id).slice(0, 20);

        recentLogs.forEach(log => {
            doc.setTextColor(0);
            const dateTimeText = `${log.date} ${log.time}`;
            doc.text(dateTimeText, leftMargin + 5, y);

            let displayInst = log.instrument || (student.class ? student.class.split(',')[0].trim() : 'Music');
            doc.setTextColor(0, 102, 204); 
            const instLines = doc.splitTextToSize(displayInst, 35);
            doc.text(instLines, leftMargin + 45, y);

            doc.setTextColor(80);
            const topicText = log.topic || 'Regular Practice';
            const topicLines = doc.splitTextToSize(topicText, 60);
            doc.text(topicLines, leftMargin + 85, y);

            doc.setTextColor(0, 128, 0); 
            doc.setFont("helvetica", "bold");
            doc.text(`${log.minutes} mins`, leftMargin + 150, y);
            doc.setFont("helvetica", "normal");

            const rowHeight = Math.max(7, Math.max(topicLines.length, instLines.length) * 5);
            y += rowHeight;

            if (y > 270) { addPageFooter(doc, currentDate); doc.addPage(); y = 20; }
        });
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
    const activeStudents = students.filter(s => isStudentCurrentlyActive(s)); 
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
let studentDisplayLimit = 20; // একবারে ২০ জন দেখাবে

function loadStudentsList(showAll = false) { 
    const activeList = document.getElementById('activeStudentsList');
    const inactiveList = document.getElementById('inactiveStudentsList');
    
    // 🟢 নতুন: স্ট্রিং ভেরিয়েবল তৈরি করা হলো, যেখানে আমরা পুরো HTML জমিয়ে রাখব
    let activeHtml = ''; 
    let inactiveHtml = ''; 
    
    let activeCount = 0;
    let inactiveCount = 0;

    students.forEach(student => { 
        const isActive = isStudentCurrentlyActive(student);
        
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
            const [h, m] = student.class_time.split(':'); 
            const ampm = h >= 12 ? 'PM' : 'AM'; 
            const h12 = h % 12 || 12; 
            timeDisplay = `${h12}:${m} ${ampm}`; 
        } 
        const dayTimeStr = (student.class_day || student.class_time) ? `<br><span class="student-time-sub">${student.class_day || ''} ${timeDisplay}</span>` : ''; 
        
        // 🟢 নতুন: সরাসরি DOM এ append না করে String-এ row তৈরি করা হচ্ছে
        const rowString = `
            <tr class="${rowClass}">
                <td>${getStudentHtml(student)}</td>
                <td>${student.class || 'N/A'}${dayTimeStr}</td>
                <td>₹${student.fee_amount || DEFAULT_FEE}</td>
                <td style="min-width: 160px;">${getAllContactButtons(student)}</td>
                <td>${isActive ? 'Active' : 'Inactive'}</td>
                <td class="action-buttons">
                    <button class="${isActive ? 'btn-info' : 'btn-success'}" onclick="openStatusChangeModal(${student.id}, ${!isActive})">${statusBtnText}</button> 
                    <button class="btn-warning" onclick="openEditStudentModal(${student.id})">Edit</button>
                    <button class="btn-danger" onclick="initiateDeleteStudent(${student.id})" title="Delete Permanently"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        
        if(isActive) { 
            activeHtml += rowString; // 🟢 String-এ জমিয়ে রাখা হচ্ছে
            activeCount++;
        } else { 
            inactiveHtml += rowString; // 🟢 String-এ জমিয়ে রাখা হচ্ছে
            inactiveCount++;
        }
    }); 

    // 🟢 নতুন: লুপ শেষ হওয়ার পর একবারে DOM-এ পুশ করা হচ্ছে (এটি সুপার ফাস্ট!)
    activeList.innerHTML = activeHtml;
    inactiveList.innerHTML = inactiveHtml;

    // Load More বাটন যুক্ত করা (আপনার আগের লজিক)
    if (!showAll) {
        const activeTotal = students.filter(s => isStudentCurrentlyActive(s)).length;
        const inactiveTotal = students.filter(s => !isStudentCurrentlyActive(s)).length;

        if (activeTotal > studentDisplayLimit) {
            activeList.innerHTML += `<tr><td colspan="7" style="text-align:center; padding:15px;"><button class="btn-secondary" onclick="loadMoreStudents()" style="width:100%; border-radius:8px;"><i class="fas fa-chevron-down"></i> Load More Students</button></td></tr>`;
        }
        if (inactiveTotal > studentDisplayLimit) {
            inactiveList.innerHTML += `<tr><td colspan="7" style="text-align:center; padding:15px;"><button class="btn-secondary" onclick="loadMoreStudents()" style="width:100%; border-radius:8px;"><i class="fas fa-chevron-down"></i> Load More Students</button></td></tr>`;
        }
    }
}

function loadMoreStudents() {
    studentDisplayLimit += 20; // ক্লিকে আরও ২০ জন বাড়বে
    loadStudentsList(false);
}

function filterStudentLists() {
    const input = document.getElementById('searchStudents');
    const filter = input.value.toUpperCase();
    
    // সার্চ বক্সে কিছু লিখলে সবাইকে একসাথে লোড করবে, নাহলে লিমিটে ফিরে যাবে
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

    // ১. লোকাল মেমরিতে আপডেট করা হলো
    monthsToPay.forEach(m => {
        if (!fees[m]) fees[m] = {}; 
        fees[m][studentId] = { status: 'paid', amount: amountPerMonth, date, mode: mode, transactionId: txnId, receiptNo: receiptNo }; 
    });

    // 🟢 ২. ম্যাজিক শুরু: সাথে সাথে স্ক্রিন আপডেট করে দেওয়া হচ্ছে (কোনো Wait নেই)
    closeModal('feeModal'); 
    renderFees(); // ফিস টেবিল চোখের পলকে আপডেট হবে
    renderDashboard(); // ড্যাশবোর্ডের হিসাব সাথে সাথে মিলে যাবে
    
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

    // 🟢 ৩. ব্যাকগ্রাউন্ডে ডেটাবেসে সেভ হবে (কোনো 'await' নেই, তাই অ্যাপ স্লো হবে না)
    saveData().catch(e => console.log("Background sync error:", e)); 
}

// ৩ নম্বর রিপ্লেসমেন্ট: ফিস ট্যাব ফাস্ট করার জন্য
function renderFees() { 
    const selectedMonth = document.getElementById('feeMonth').value;
    const tableBody = document.querySelector('#feeTable tbody'); 
    if (!selectedMonth) { tableBody.innerHTML = ''; return; } 
    
    let totalCollected = 0, totalDueAmount = 0, dueCount = 0, collectedCount = 0; 
    const monthIsDue = isMonthDue(selectedMonth); 
    
    // 🟢 নতুন লজিক: Table Row গুলো String-এ জমানো হচ্ছে
    let tableHtml = '';

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
        
        let actionButtons = isPaid ? 
            `<button class="btn-receipt" onclick="generatePaymentReceipt(${student.id}, '${selectedMonth}')">Receipt</button> <button class="btn-warning" onclick="openFeeModal(${student.id}, '${selectedMonth}', true)">Edit</button><button class="btn-danger" onclick="unmarkFee(${student.id}, '${selectedMonth}')">Unmark</button>` 
            : `<button class="btn-success" onclick="openFeeModal(${student.id}, '${selectedMonth}')">Record Payment</button>` + (monthIsDue ? getContactButtons(student.id, selectedMonth) : ''); 
        
        tableHtml += `<tr class="${rowClass}"><td>${getStudentHtml(student)}</td><td>${statusText}</td><td class="action-buttons">${actionButtons}</td></tr>`; 
    }); 
    
    // 🟢 লুপ শেষ, এবার একবারে স্ক্রিনে দেখানো হলো
    tableBody.innerHTML = tableHtml;
    
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
    
    // বাঁ দিকের নীল অংশ
    doc.setFillColor(24, 75, 115); // আপনার ছবির মত গাড় নীল কালার
    doc.rect(0, 0, 30, 54, 'F'); 
    
    // স্টুডেন্টের ছবি (বাঁ দিকে, নীল অংশের ওপর)
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

// --- QR Code ছবির ঠিক নিচে ---
    try {
        const baseUrl = window.location.origin + window.location.pathname;
        const qrText = `${baseUrl}?student=${student.id}&manager=${DOC_ID}`;
        const qr = new QRious({ value: qrText, size: 250, level: 'M' });
        doc.addImage(qr.toDataURL('image/jpeg'), 'JPEG', 6, 28, 18, 18);
    } catch(e) { console.error("QR Code generation failed for ID Card", e); }
    // ------------------------------
    // ডান দিকের জলছাপ লোগো
    if (instituteLogo) { 
        doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: 0.1 })); 
        doc.addImage(instituteLogo, 'JPEG', 40, 9, 36, 36); doc.restoreGraphicsState(); 
    } 
    
    // হেডারের লেখা
    doc.setTextColor(0, 0, 0); doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); 
    const headerLines = doc.splitTextToSize(INSTITUTE_NAME, 52); 
    doc.text(headerLines, 58, 6, {align: "center"}); 
    doc.setDrawColor(24, 75, 115); doc.setLineWidth(0.5); doc.line(33, 12, 83, 12); 
    
    // ডান দিকের টেক্সট ডিটেইলস (X শুরু 33 থেকে)
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
    
    
    // Issue and Valid Date
    doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); 
    let validText = `Issued: ${issueDateStr}`; if (endDateStr) validText += ` | Valid: ${endDateStr}`; 
    doc.text(validText, 33, yText); 

    // সিগনেচার
    if (authorizedSignature) { doc.addImage(authorizedSignature, 'PNG', 65, 36, 18, 6); } 
    doc.setFontSize(6); doc.setFont("helvetica", "bold"); doc.text("Auth. Signature:", 83, 43, {align: "right"}); 
    doc.setFont("helvetica", "italic"); doc.text("Srikanta Banerjee", 83, 46, {align: "right"}); 
    
    // নিচের দিকের সবুজ স্ট্রিপ
    doc.setFillColor(67, 160, 130); doc.rect(30, 49, 56, 5, 'F'); 
    doc.setTextColor(255, 255, 255); doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.text("AUTHORIZED STUDENT CARD", 58, 52.5, {align: "center"}); 

    // PDF সেভ করা বা শেয়ার করা
    const fileName = `ID_Card_${student.name}.pdf`; 
    if (navigator.canShare && navigator.share) { 
        const pdfBlob = doc.output('blob'); const file = new File([pdfBlob], fileName, { type: 'application/pdf' }); 
        if (navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Student ID Card', text: `ID Card for ${student.name}` }); } catch (err) { doc.save(fileName); } } else { doc.save(fileName); } 
    } else { doc.save(fileName); } 
}

// ২ নম্বর রিপ্লেসমেন্ট: অ্যাটেন্ডেন্স ট্যাব ফাস্ট করার জন্য
function renderAttendance() { 
    const dateInput = document.getElementById('attendanceDate').value;
    const tableBody = document.querySelector('#attendanceTable tbody'); 
    if (!dateInput) { tableBody.innerHTML = ''; return; } 

    const selectedDate = new Date(dateInput);
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = days[selectedDate.getDay()];

    const timeInput = document.getElementById('attendanceTime');
    if(!timeInput.value) {
       const now = new Date(); 
       timeInput.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }

    let totalActive = 0, presentCount = 0, absentCount = 0;
    const activeStudents = students.filter(s => isStudentCurrentlyActive(s, dateInput));

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

    let tableHtml = '';

    activeStudents.forEach(student => { 
        totalActive++; 

        const entry = attendance[dateInput]?.[student.id];
        const status = (typeof entry === 'object' && entry !== null) ? entry.status : entry; 
        const note = (typeof entry === 'object' && entry?.note) ? entry.note : '';
        
        if (status === 'present') presentCount++;
        else if (status === 'absent') absentCount++;

        const statusText = status === 'present' ? 'Present' : (status === 'absent' ? 'Absent' : 'Not Marked');
        const statusClass = status === 'present' ? 'status-present' : (status === 'absent' ? 'status-absent' : ''); 
        
        const inst = (typeof entry === 'object' && entry !== null && entry.instrument) ? entry.instrument : '';
        const instBadge = inst ? `<br><span style="font-size:10px; color:var(--info); background:rgba(59, 130, 246, 0.1); padding:2px 6px; border-radius:4px; border:1px solid rgba(59, 130, 246, 0.2); display:inline-block; margin-top:3px;">${inst}</span>` : '';

        const isToday = student.class_day === currentDayName;
        const highlightStyle = isToday ? 'border: 1px solid var(--primary); background: rgba(79, 70, 229, 0.05);' : '';

        const noteBtnColor = note ? 'btn-warning' : 'btn-secondary';
        let rowClass = checkGlobalDues(student.id) ? 'has-dues-alert' : '';
        
        tableHtml += `
            <tr style="${highlightStyle}" class="${rowClass}">
                <td>
                    ${getStudentHtml(student)}
                    <div style="font-size:11px; color:#d97706; margin-top:2px; margin-left:55px;">
                        ${note ? '📝 ' + note : ''}
                    </div>
                </td>
                <td class="${statusClass}">${statusText}${instBadge}</td>
                <td class="action-buttons">
                    <button class="btn-success" onclick="markAttendance(${student.id}, 'present')">P</button>
                    <button class="btn-danger" onclick="markAttendance(${student.id}, 'absent')">A</button>
                    <button class="${noteBtnColor}" onclick="addAttendanceNote(${student.id})" title="Edit Note"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-secondary" onclick="markAttendance(${student.id}, 'clear')">X</button>
                </td>
            </tr>`;
    }); 

    tableBody.innerHTML = tableHtml;

    if(document.getElementById('attTotalCount')) document.getElementById('attTotalCount').textContent = totalActive;
    if(document.getElementById('attPresentCount')) document.getElementById('attPresentCount').textContent = presentCount;
    if(document.getElementById('attAbsentCount')) document.getElementById('attAbsentCount').textContent = absentCount;

    searchTable('searchAttendance', 'attendanceTable'); 
}

// 🟢 আপডেটেড অ্যাটেন্ডেন্স মার্কিং লজিক (With Multi-Class Selection Checkboxes)
window.markAttendance = async function(studentId, status) {
    const date = document.getElementById('attendanceDate').value; 
    if (!date) { Swal.fire('Alert','Please select a date.', 'warning'); return; } 
    
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    if (!attendance[date]) attendance[date] = {}; 
    
    const currentEntry = attendance[date][studentId];
    let existingNote = '';
    let existingInst = '';
    
    if (typeof currentEntry === 'object' && currentEntry !== null) {
        existingNote = currentEntry.note || '';
        existingInst = currentEntry.instrument || '';
    }

    if (status === 'clear') { 
        if (existingNote) {
            attendance[date][studentId] = { status: null, time: '', note: existingNote, instrument: existingInst };
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

        let selectedInstrument = existingInst;

        // 🟢 NEW: একাধিক ক্লাস থাকলে Checkbox এর মাধ্যমে সিলেক্ট করার অপশন
        if (status === 'present' || status === 'absent') {
            let classList = student.class ? student.class.split(/[\/,]+/).map(c => c.trim()).filter(c => c.length > 0) : ['Music'];

            if (classList.length > 1) {
                let checkboxesHtml = '<div style="display:flex; flex-direction:column; gap:8px; text-align:left; margin-top:15px;">';
                classList.forEach(c => {
                    // আগে থেকে সেভ করা থাকলে অটোমেটিক টিক (✓) দেওয়া থাকবে
                    let isChecked = existingInst.includes(c) ? 'checked' : '';
                    checkboxesHtml += `
                        <label style="display:flex; align-items:center; background:var(--bg-input); padding:10px 15px; border-radius:8px; border:1px solid var(--border-color); cursor:pointer; transition:0.2s;">
                            <input type="checkbox" class="swal-att-inst-cb" value="${c}" ${isChecked} style="width:18px; height:18px; margin:0 12px 0 0; accent-color:var(--primary); cursor:pointer;">
                            <span style="font-size:14px; font-weight:600; color:var(--text-main);">${c}</span>
                        </label>
                    `;
                });
                checkboxesHtml += '</div>';

                const { value: formValues, isConfirmed } = await Swal.fire({
                    title: 'Select Classes',
                    html: `
                        <p style="font-size:13px; color:var(--text-muted); margin:0;">Which classes is <b>${student.name.split(' ')[0]}</b> attending today?</p>
                        ${checkboxesHtml}
                    `,
                    showCancelButton: true,
                    confirmButtonText: 'Save Attendance',
                    confirmButtonColor: 'var(--success)',
                    preConfirm: () => {
                        const cbs = document.querySelectorAll('.swal-att-inst-cb:checked');
                        let selected = [];
                        cbs.forEach(cb => selected.push(cb.value));
                        
                        if(selected.length === 0) {
                            Swal.showValidationMessage('Please select at least one class!');
                            return false;
                        }
                        // একাধিক ক্লাস কমা (,) দিয়ে যুক্ত করা হচ্ছে
                        return selected.join(', '); 
                    }
                });

                if (isConfirmed && formValues) {
                    selectedInstrument = formValues;
                } else {
                    return; // User cancelled
                }
            } else if (classList.length === 1) {
                selectedInstrument = classList[0];
            }
        }
        
        attendance[date][studentId] = { 
            status: status, 
            time: timeToSave,
            note: existingNote,
            instrument: selectedInstrument
        }; 
    }
    
    renderAttendance(); 
    saveData().catch(err => console.log("Background Sync Pending...")); 
};

// 🟢 রিয়েল-টাইম ডুপ্লিকেট নোট চেকার
window.checkNoteRealtime = function(studentId, inputVal, currentDate) {
    const warningDiv = document.getElementById('note-duplicate-warning');
    if(!inputVal.trim()) { warningDiv.style.display = 'none'; return; }
    
    let isDuplicate = false;
    let duplicateDate = '';
    
    for (const pastDate in attendance) {
        if (pastDate !== currentDate && attendance[pastDate] && attendance[pastDate][studentId]) {
            const pastEntry = attendance[pastDate][studentId];
            const pastNote = (typeof pastEntry === 'object' && pastEntry.note) ? pastEntry.note.trim() : '';
            if (pastNote !== "" && pastNote.toLowerCase() === inputVal.trim().toLowerCase()) {
                isDuplicate = true;
                duplicateDate = pastDate;
                break;
            }
        }
    }
    
    if(isDuplicate) {
        const formattedDate = new Date(duplicateDate).toLocaleDateString('en-IN');
        warningDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <b>Warning:</b> এই নোটটি আগে <b>${formattedDate}</b> তারিখে দেওয়া হয়েছে!`;
        warningDiv.style.display = 'block';
    } else {
        warningDiv.style.display = 'none';
    }
};
// 🟢 ক্লাস নোটের সিমিলার সাজেশন দেখানোর ফাংশন
window.showNoteSuggestions = function(studentId, inputVal) {
    const suggestionBox = document.getElementById('note-suggestions-container');
    const val = inputVal.trim().toLowerCase();
    
    if (!val) {
        suggestionBox.style.display = 'none';
        return;
    }

    // ওই স্টুডেন্টের আগের সব নোট বের করা
    let pastNotes = [];
    for (const d in attendance) {
        const entry = attendance[d]?.[studentId];
        if (entry && entry.note) {
            const n = entry.note.trim();
            if (n && !pastNotes.includes(n)) {
                pastNotes.push(n);
            }
        }
    }

    // টাইপ করা লেখার সাথে মিলে যায় এমন নোট খোঁজা
    const matchedNotes = pastNotes.filter(n => n.toLowerCase().includes(val) && n.toLowerCase() !== val);

    if (matchedNotes.length > 0) {
        let html = '';
        matchedNotes.forEach(note => {
            const safeNote = note.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            html += `<div style="padding: 10px; border-bottom: 1px solid var(--border-color); font-size: 13px; cursor: pointer; color: var(--text-main); background: var(--bg-card);" 
                          onclick="document.getElementById('swal-custom-note').value = '${safeNote}'; document.getElementById('note-suggestions-container').style.display='none'; checkNoteRealtime(${studentId}, '${safeNote}', document.getElementById('attendanceDate').value);">
                          <i class="fas fa-history" style="color:var(--text-muted); margin-right:5px;"></i> ${note}
                     </div>`;
        });
        suggestionBox.innerHTML = html;
        suggestionBox.style.display = 'block';
    } else {
        suggestionBox.style.display = 'none';
    }
};

// 🟢 আপডেটেড addAttendanceNote ফাংশন (Duplicate Popup Removed)
async function addAttendanceNote(studentId) {
    const date = document.getElementById('attendanceDate').value;
    if (!date) { Swal.fire('Alert', 'Please select a date first.', 'warning'); return; }
    
    const currentEntry = attendance[date]?.[studentId] || {};
    const existingNote = currentEntry.note || '';

    const { value: text, isConfirmed } = await Swal.fire({
        title: 'Class Progress Note',
        html: `
            <label style="font-size:13px; color:var(--text-main); margin-bottom:8px; display:block; text-align:left;">আজ ক্লাসে কি শেখানো হলো?</label>
            <textarea id="swal-custom-note" class="swal2-textarea" placeholder="যেমন: C Major Scale শেখানো হয়েছে..." style="margin:0; width:100%; box-sizing:border-box; font-size: 14px; padding: 12px;" oninput="checkNoteRealtime(${studentId}, this.value, '${date}'); showNoteSuggestions(${studentId}, this.value);">${existingNote}</textarea>
            
            <div id="note-suggestions-container" style="display:none; max-height:120px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; margin-top:5px; text-align:left; box-shadow:0 4px 6px rgba(0,0,0,0.1);"></div>
            
            <div id="note-duplicate-warning" style="display:none; color:#b45309; background:#fef3c7; border:1px solid #fcd34d; padding:8px 10px; border-radius:6px; font-size:12px; margin-top:8px; text-align:left;"></div>
            
            <button type="button" class="btn-info" onclick="saveTempNoteAndOpenMaterial(${studentId}, '${date}')" style="width:100%; margin-top:15px; background-color: #0ea5e9; border-radius: 8px; padding: 10px; font-size: 14px; border: none; color: white; cursor: pointer;">
                <i class="fas fa-book-open"></i> Send Study Material
            </button>
        `,
        showCancelButton: true,
        confirmButtonText: 'Save Note',
        confirmButtonColor: 'var(--primary)',
        cancelButtonColor: '#ef4444',
        allowOutsideClick: false,
        didOpen: () => {
            if(existingNote) checkNoteRealtime(studentId, existingNote, date);
        },
        preConfirm: () => {
            return document.getElementById('swal-custom-note').value;
        }
    });

    if (isConfirmed && text !== undefined) {
        const newNoteTrimmed = text.trim();

        if (!attendance[date]) attendance[date] = {};
        attendance[date][studentId] = {
            ...currentEntry, 
            note: newNoteTrimmed
        };
        
        renderAttendance();
        saveData().catch(e => console.log("Note saved locally."));

        if (newNoteTrimmed !== "") {
            const student = students.find(s => s.id === studentId);
            const safeNote = newNoteTrimmed.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            
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

// 🟢 নির্দিষ্ট স্টুডেন্টকে Material পাঠানোর ফাংশন
// 🟢 NEW: Material ওপেন করার আগে নোট সেভ করে রাখার ফাংশন
window.saveTempNoteAndOpenMaterial = function(studentId, date) {
    const noteElement = document.getElementById('swal-custom-note');
    if (noteElement) {
        const typedNote = noteElement.value; // টাইপ করা লেখাটা ধরে নিলাম
        
        // লোকাল মেমরিতে সাথে সাথে সেভ করে দিলাম
        if (!attendance[date]) attendance[date] = {};
        const currentEntry = attendance[date][studentId] || {};
        
        attendance[date][studentId] = {
            ...currentEntry,
            note: typedNote
        };
        
        // ব্যাকগ্রাউন্ডে ডাটাবেসে সেভ করার কমান্ড দিয়ে রাখলাম
        saveData().catch(e => console.log("Temp note saved locally."));
    }
    
    // এবার Material সিলেক্ট করার পপআপটা খুলবে
    openMaterialSelectorForStudent(studentId);
};
window.openMaterialSelectorForStudent = async function(studentId) {
    const student = students.find(s => s.id === studentId);
    if(!student) return;

    let matHtml = globalMaterials.map(m => {
        let icon = m.type === 'video' ? '🎬' : (m.type === 'pdf' ? '📄' : '🎵');
        return `
            <div onclick="sendSpecificMaterialToStudent(${studentId}, ${m.id})" style="padding:12px; border-bottom:1px solid var(--border-color); cursor:pointer; text-align:left; background:var(--bg-input); margin-bottom:8px; border-radius:8px; border-left:4px solid var(--primary); transition:0.2s;">
                <div style="font-weight:600; font-size:14px; color:var(--text-main); margin-bottom:4px;">${icon} ${m.title}</div>
                <span style="font-size:11px; background:var(--bg-card); padding:2px 6px; border-radius:4px; color:var(--text-muted); border:1px solid var(--border-color);">${m.category}</span>
            </div>`;
    }).join('');

    if(globalMaterials.length === 0) matHtml = '<p style="font-size:13px; color:gray;">No materials in library yet.</p>';

    Swal.fire({
        title: `Send to ${student.name.split(' ')[0]}`,
        html: `
            <input type="text" id="search-mat-for-student" placeholder="🔍 Search material..." class="swal2-input" onkeyup="filterMatForStudent()" style="width:95%; max-width:100%; display:block; box-sizing:border-box; margin: 0 auto 15px auto; font-size:14px;">
            <div id="mat-list-for-student" style="max-height: 250px; overflow-y: auto; padding-right:5px;">
                ${matHtml}
            </div>
            <button class="btn-danger" onclick="addAttendanceNote(${studentId})" style="width:100%; margin-top:15px;"><i class="fas fa-arrow-left"></i> Back to Note</button>
        `,
        showConfirmButton: false,
        showCancelButton: false,
        allowOutsideClick: false
    });
};

// 🟢 Search Material Function
window.filterMatForStudent = function() {
    const filter = document.getElementById('search-mat-for-student').value.toLowerCase();
    const container = document.getElementById('mat-list-for-student');
    const divs = container.children;
    for(let i=0; i<divs.length; i++) {
        if(divs[i].textContent.toLowerCase().indexOf(filter) > -1) {
            divs[i].style.display = "";
        } else {
            divs[i].style.display = "none";
        }
    }
};

// 🟢 Portal বা WhatsApp-এ Material পাঠানো
window.sendSpecificMaterialToStudent = async function(studentId, matId) {
    const material = globalMaterials.find(m => m.id === matId);
    if(!material) return;
    
    Swal.fire({
        title: 'Send Material',
        text: material.title,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '<i class="fas fa-paper-plane"></i> To Portal',
        denyButtonText: '<i class="fab fa-whatsapp"></i> WhatsApp',
        cancelButtonText: 'Back',
        confirmButtonColor: 'var(--primary)',
        denyButtonColor: '#25D366',
        cancelButtonColor: '#ef4444', // 🟢 Back button made Red
        allowOutsideClick: false
    }).then((res) => {
        if (res.isConfirmed) {
            assignMaterialToStudent(studentId, material);
            setTimeout(() => addAttendanceNote(studentId), 1500);
        } else if (res.isDenied) {
            sendMaterialViaWhatsApp(studentId, material);
            addAttendanceNote(studentId); 
        } else {
            openMaterialSelectorForStudent(studentId); 
        }
    });
};

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

window.changeMonthCount = function(delta) {
        let input = document.getElementById('feeMonthCount');
        let current = parseInt(input.value) || 1;
        current += delta;
        if(current < 1) current = 1;
        if(current > 12) current = 12; // একসাথে সর্বোচ্চ ১২ মাস
        input.value = current;
        updateMultiFeeAmount();
    };

    window.updateMultiFeeAmount = function() {
        const studentId = parseInt(document.getElementById('feeStudentId').value);
        const student = students.find(s => s.id === studentId);
        if(!student) return;
        
        let count = parseInt(document.getElementById('feeMonthCount').value) || 1;
        document.getElementById('feeAmount').value = count * (student.fee_amount || DEFAULT_FEE);
        
        const startMonth = document.getElementById('feeRecordMonth').value; 
        const displaySpan = document.getElementById('multiMonthDisplay');
        
        let monthsArr = [];
        let [y, m] = startMonth.split('-').map(Number);
        for(let i=0; i<count; i++) {
            let iterM = m + i;
            let iterY = y;
            if(iterM > 12) {
                iterY += Math.floor((iterM - 1) / 12);
                iterM = ((iterM - 1) % 12) + 1;
            }
            monthsArr.push(`${iterY}-${iterM.toString().padStart(2,'0')}`);
        }
        
        if(count === 1) {
            displaySpan.innerHTML = `Paying for: <b>${formatMonthYear(monthsArr[0])}</b>`;
        } else {
            displaySpan.innerHTML = `Paying for <b>${count} Months</b>:<br> <span style="color:var(--primary);">${formatMonthYear(monthsArr[0])} to ${formatMonthYear(monthsArr[monthsArr.length-1])}</span>`;
        }
        
        document.getElementById('feeRecordMonth').dataset.bulkMonths = JSON.stringify(monthsArr);
    };

let currentAdvanceCount = 0;

    function openFeeModal(studentId, currentMonth, isEdit = false) { 
        const modal = document.getElementById('feeModal');
        const student = students.find(s => s.id === studentId); 
        if(!student) return;

        document.getElementById('feeStudentId').value = studentId; 
        document.getElementById('feeDate').valueAsDate = new Date();
        document.getElementById('transactionId').value = '';

        const listContainer = document.getElementById('dueMonthsCheckboxList');
        listContainer.innerHTML = '';

        // বর্তমান মাসের স্ট্রিং বের করা
        const now = new Date();
        const realCurrentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        const targetMonthStr = currentMonth;

        if (isEdit) {
            document.getElementById('feeModalTitle').textContent = `Edit Fee`;
            document.getElementById('monthSelectionGroup').style.display = 'none';
            const record = fees[currentMonth]?.[studentId];
            document.getElementById('feeAmount').value = record ? record.amount : student.fee_amount;
            document.getElementById('feeAmount').readOnly = false;
            document.getElementById('paymentSummaryDisplay').innerHTML = `Editing for: <b>${formatMonthYear(currentMonth)}</b>`;
            document.getElementById('feeModal').dataset.finalMonths = JSON.stringify([currentMonth]);
        } else {
            document.getElementById('feeModalTitle').textContent = `Record Payment`;
            document.getElementById('monthSelectionGroup').style.display = 'block';
            document.getElementById('feeAmount').readOnly = true;

            let iterDate = new Date(student.joining_date);
            iterDate.setDate(1);
            
            let targetDate = new Date(targetMonthStr + '-01');
            let realCurrentDate = new Date(realCurrentMonthStr + '-01');
            let upperLimitDate = targetDate > realCurrentDate ? targetDate : realCurrentDate;
            
            let foundDuesOrAdvance = false;
            
            while (iterDate <= upperLimitDate) {
                const mStr = `${iterDate.getFullYear()}-${(iterDate.getMonth() + 1).toString().padStart(2, '0')}`;
                
                if (wasStudentActiveDuringMonth(student, mStr) && fees[mStr]?.[studentId]?.status !== 'paid') {
                    foundDuesOrAdvance = true;
                    
                    const isDue = isMonthDue(mStr);
                    const isCurrent = mStr === realCurrentMonthStr;
                    const isAdvance = new Date(mStr + '-01') > realCurrentDate;
                    
                    // 🟢 থিম সাপোর্টেড কালার লজিক (ডার্ক মোড ফিক্সড)
                    let badgeLabel = '';
                    let textColor = 'var(--text-main)';
                    let rowBgColor = 'var(--bg-input)';
                    let borderColor = 'var(--border-color)';
                    
                    // Due বা Current Month হলে শুধু টেক্সট এবং ব্যাজ লাল হবে, ব্যাকগ্রাউন্ড থিমের কালারেই থাকবে
                    if(isDue && !isCurrent) {
                        badgeLabel = '<span style="font-size:10px; color:#fff; background:var(--danger); padding:2px 6px; border-radius:4px; margin-left:5px;">DUE</span>';
                        textColor = 'var(--danger)'; 
                    } else if(isCurrent) {
                        badgeLabel = '<span style="font-size:10px; color:#fff; background:var(--danger); padding:2px 6px; border-radius:4px; margin-left:5px;">CURRENT</span>';
                        textColor = 'var(--danger)';
                    } else if(isAdvance) {
                        badgeLabel = '<span style="font-size:10px; color:var(--info); background:rgba(59, 130, 246, 0.1); padding:2px 6px; border-radius:4px; margin-left:5px;">ADVANCE</span>';
                        textColor = 'var(--info)';
                    }

                    listContainer.innerHTML += `
                        <label style="display:flex; align-items:center; justify-content:space-between; background:${rowBgColor}; padding:8px 10px; border-radius:6px; cursor:pointer; border:1px solid ${borderColor}; margin-bottom: 4px;">
                            <div style="font-size:13px; font-weight:700; color:${textColor}; display:flex; align-items:center;">
                                ${formatMonthYear(mStr)} ${badgeLabel}
                            </div>
                            <input type="checkbox" class="fee-month-checkbox" value="${mStr}" 
                                onchange="updateFeeCalculations()" 
                                style="width:16px; height:16px; cursor:pointer; accent-color: #10b981;" 
                                checked>
                        </label>
                    `;
                }
                iterDate.setMonth(iterDate.getMonth() + 1);
            }

            if(!foundDuesOrAdvance) {
                listContainer.innerHTML = '<p style="font-size:12px; color:gray; text-align:center; margin:10px 0;">No pending dues or advance available.</p>';
            }
            updateFeeCalculations();
        }
        modal.style.display = 'flex'; 
    }

    window.updateFeeCalculations = function() {
        const studentId = parseInt(document.getElementById('feeStudentId').value);
        const student = students.find(s => s.id === studentId);
        if(!student) return;

        const monthlyFee = student.fee_amount || DEFAULT_FEE;
        
        let selectedMonths = [];
        const checkboxes = document.querySelectorAll('.fee-month-checkbox:checked');
        checkboxes.forEach(cb => selectedMonths.push(cb.value));

        selectedMonths.sort((a, b) => new Date(a + '-01') - new Date(b + '-01'));

        document.getElementById('feeAmount').value = selectedMonths.length * monthlyFee;
        document.getElementById('feeModal').dataset.finalMonths = JSON.stringify(selectedMonths);

        const summary = document.getElementById('paymentSummaryDisplay');
        if(selectedMonths.length > 0) {
            summary.innerHTML = `Paying for <b>${selectedMonths.length} Months</b>:<br><span style="color:var(--text-main); font-weight:500;">${selectedMonths.map(m => formatMonthYear(m)).join(', ')}</span>`;
        } else {
            summary.innerHTML = "<span style='color:var(--danger);'>Please select at least one month.</span>";
        }
    };

    async function saveFee() { 
        const studentId = parseInt(document.getElementById('feeStudentId').value); 
        const amount = parseFloat(document.getElementById('feeAmount').value); 
        const date = document.getElementById('feeDate').value; 
        const mode = document.getElementById('paymentMode').value; 
        const txnId = document.getElementById('transactionId').value.trim(); 
        const finalMonths = JSON.parse(document.getElementById('feeModal').dataset.finalMonths || '[]');

        if (finalMonths.length === 0) { Swal.fire('Alert','Select at least one month.', 'warning'); return; }
        if (isNaN(amount) || amount <= 0) { Swal.fire('Error','Amount required.', 'error'); return; } 
        if (!date) { Swal.fire('Error','Payment date required.', 'error'); return; } 
        
        let receiptNo = Date.now().toString().slice(-6); 
        const amountPerMonth = amount / finalMonths.length;

        finalMonths.forEach(m => {
            if (!fees[m]) fees[m] = {}; 
            fees[m][studentId] = { status: 'paid', amount: amountPerMonth, date, mode, transactionId: txnId, receiptNo }; 
        });

        closeModal('feeModal'); 
        renderFees(); 
        renderDashboard(); 
        
        const joinedMonths = finalMonths.join(',');
        
        // 🟢 NEW: Payment Success Popup with WhatsApp, SMS, and Receipt sharing options
        Swal.fire({ 
            title: 'Payment Saved!', 
            html: `<p style="font-size:14px; margin-bottom:15px;">Payment of ₹${amount} recorded successfully.</p>
                   <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
                       <button class="btn-like btn-receipt" onclick="generatePaymentReceipt(${studentId}, '${joinedMonths}')"><i class="fas fa-file-pdf"></i> Receipt</button>
                       <button class="btn-like btn-whatsapp" onclick="sendMsg('wa', ${studentId}, '${joinedMonths}', ${amount}, false)"><i class="fab fa-whatsapp"></i> WhatsApp</button>
                       <button class="btn-like btn-sms" onclick="sendMsg('sms', ${studentId}, '${joinedMonths}', ${amount}, false)"><i class="fas fa-sms"></i> SMS</button>
                   </div>
                   <p style="font-size:11px; color:var(--text-muted); margin-top:12px;">* Click Receipt to generate PDF & share directly to WhatsApp.</p>`, 
            icon: 'success',
            confirmButtonText: 'Done / Close',
            confirmButtonColor: '#d33',
            allowOutsideClick: false
        }); 

        saveData().catch(e => console.log("Offline sync pending")); 
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
    // 🟢 Load Personal Notice in Modal
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

    // 🟢 Inactive Calculation Logic শুরু
    const inactiveBox = document.getElementById('modalInactiveStatusBox');
    if (student.status && student.status.history && student.status.history.length > 0) {
        const sortedHistory = [...student.status.history].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // যদি স্টুডেন্ট বর্তমানে Inactive থাকে
        if (sortedHistory[0].status === 'Inactive') {
            const inactiveDate = new Date(sortedHistory[0].date);
            const today = new Date();
            
            let y = today.getFullYear() - inactiveDate.getFullYear();
            let m = today.getMonth() - inactiveDate.getMonth();
            let d = today.getDate() - inactiveDate.getDate();
            
            if (d < 0) { 
                m--; 
                const lm = new Date(today.getFullYear(), today.getMonth(), 0); 
                d += lm.getDate(); 
            }
            if (m < 0) { 
                y--; 
                m += 12; 
            }
            
            let dur = [];
            if (y > 0) dur.push(y + ' Yrs');
            if (m > 0) dur.push(m + ' Mths');
            if (d > 0) dur.push(d + ' Days');
            if (dur.length === 0) dur.push('Today');
            
            const formattedInactiveDate = inactiveDate.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});
            
            // বক্সে লেখাগুলো সেট করা
            inactiveBox.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:600; color:#e11d48;"><i class="fas fa-user-slash"></i> Inactive From:</span> 
                    <div style="text-align:right;">
                        <span style="color:#be123c; font-weight:700;">${formattedInactiveDate}</span><br>
                        <span style="font-size:11px; color:#f43f5e; font-weight:600;">(Duration: ${dur.join(', ')})</span>
                    </div>
                </div>`;
            inactiveBox.style.display = 'block'; // বক্সটি দৃশ্যমান করা
        } else {
            inactiveBox.style.display = 'none'; // Active হলে বক্সটি লুকিয়ে ফেলা
        }
    } else {
        inactiveBox.style.display = 'none'; // কোনো রেকর্ড না থাকলে লুকিয়ে ফেলা
    }
    // 🟢 Inactive Calculation Logic শেষ
    
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
    
    const historyList = document.getElementById('modalStatusHistory'); 

    // 🟢 NEW: Past Inactive Box (Status History হেডিং এবং লিস্টের ঠিক মাঝখানে)
    let pastInactiveContainer = document.getElementById('modalPastInactiveBox');
    if (!pastInactiveContainer) {
        pastInactiveContainer = document.createElement('div');
        pastInactiveContainer.id = 'modalPastInactiveBox';
        historyList.parentNode.insertBefore(pastInactiveContainer, historyList);
    }
    pastInactiveContainer.innerHTML = getPastInactivePeriodsHtml(student);
    pastInactiveContainer.style.marginBottom = "12px"; // একটু গ্যাপ দেওয়ার জন্য

    historyList.innerHTML = ''; 
    historyList.innerHTML = ''; 
    if (student.status.history && student.status.history.length > 0) { 
        student.status.history.forEach((entry, index) => { 
            const color = entry.status === 'Active' ? 'green' : 'red'; 
            historyList.innerHTML += `
                <li style="display:flex; justify-content:space-between; align-items:center; padding: 5px 0;">
                    <div>
                        <strong style="color:${color};">${entry.status}</strong> on ${new Date(entry.date).toLocaleDateString('en-IN')}<br>
                        <em style="font-size:0.9em;color:var(--text-muted);">Note: ${entry.note || 'No note'}</em>
                    </div>
                    <div style="display:flex; gap: 8px;">
                        <button onclick="editStatusHistory(${student.id}, ${index})" style="background:none; border:none; color:var(--warning); cursor:pointer; font-size:14px;" title="Edit"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteStatusHistory(${student.id}, ${index})" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:14px;" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </li>`; 
        }); 
    } else { 
        historyList.innerHTML = '<li style="padding: 5px 0;">No history found.</li>'; 
    } 
    
    const yearSelect = document.getElementById('detailsFilterYear'); const monthSelect = document.getElementById('detailsFilterMonth'); yearSelect.innerHTML = ''; monthSelect.innerHTML = '';
    const currentYear = new Date().getFullYear(); const joinYear = new Date(student.joining_date).getFullYear();
    for(let y = currentYear; y >= joinYear; y--) { const opt = document.createElement('option'); opt.value = y; opt.text = y; yearSelect.appendChild(opt); }
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthNames.forEach((m, idx) => { const opt = document.createElement('option'); opt.value = idx + 1; opt.text = m; if(idx === new Date().getMonth()) opt.selected = true; monthSelect.appendChild(opt); });
    renderStudentDetailsHistory();
    document.getElementById('exportPdfBtn').onclick = () => exportStudentDetailsAsPDF(studentId); 
    renderStudentNotes(studentId);
    renderStudyMaterials(studentId);

    // 🟢 ঠিক এই জায়গাটিতে নতুন কোডটি বসিয়ে দিন:
    if (document.getElementById('teacherPracticeFilter')) {
        document.getElementById('teacherPracticeFilter').innerHTML = '<option value="All">All Subjects</option>';
    }

    renderPracticeLogTeacher(studentId); 
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
                let timeStr = ''; let status = entry; let instStr = '';
                if(typeof entry === 'object' && entry !== null) {
                    status = entry.status;
                    if(entry.time) { timeStr = ` <span style="color:var(--text-muted);">(${formatTime12H(entry.time)})</span>`; }
                    if(entry.instrument) { instStr = ` <span style="font-size:10px; color:#0ea5e9; font-weight:600;">[${entry.instrument}]</span>`; }
                }
                const formattedDate = `${d.toLocaleDateString('en-IN')} (${dayName})${timeStr}${instStr}`;
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
        Status: isStudentCurrentlyActive(s) ? 'Active' : 'Inactive',
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
    // 🟢 FIX: এখানেও হিস্ট্রি স্ট্যাটাস চেক বসানো হলো
    const activeStudents = students.filter(s => isStudentCurrentlyActive(s, date));

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

// ==========================================
// NEW FEATURES FOR INDEX 17 (BULK MSG & QR)
// ==========================================

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

    let targetStudents = students.filter(s => isStudentCurrentlyActive(s));
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
    
    // Generate Web Link
    const baseUrl = window.location.origin + window.location.pathname;
    const qrText = `${baseUrl}?student=${student.id}&manager=${DOC_ID}`;
    
    // Generate QR Image
    const qr = new QRious({ value: qrText, size: 250, level: 'H' });
    const qrImg = qr.toDataURL();
    
    // WhatsApp Logic
    let cleanPhone = student.phone ? student.phone.replace(/[^0-9]/g, '') : '';
    if (cleanPhone && cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
    
    // 🟢 🔗 ইমোজি সরিয়ে লিংকটি একদম পরিষ্কার লাইনে দেওয়া হয়েছে
    const waMsg = `Hello ${student.name},\n\nHere is your Digital ID Card link for Music Classes. Click the link below to view your profile, attendance, and fees:\n\n${qrText}\n\nRegards,\nSrikanta Banerjee`;
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}`;

    // Global helper functions for buttons
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
        cancelButtonColor: '#ef4444'
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

async function onScanSuccess(decodedText, decodedResult) {
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
            
            await markAttendance(studentId, 'present');
            
            Swal.fire({
                toast: true, position: 'top-end',
                icon: 'success', title: `${student.name} Marked Present!`,
                showConfirmButton: false, timer: 2500
            });
        } else {
            Swal.fire({ toast: true, position: 'top', icon: 'error', title: 'Student not found.', showConfirmButton: false, timer: 2000 });
        }
    } else {
         Swal.fire({ toast: true, position: 'bottom', icon: 'warning', title: 'Invalid QR Code.', showConfirmButton: false, timer: 1500 });
    }
}

function onScanError(errorMessage) {
    // Ignore minor scan errors
}
 // --- এখান থেকে Study Material এর JavaScript শুরু ---

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
        cancelButtonColor: '#ef4444',
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

        // ১. ডেটাবেসের জন্য অপেক্ষা না করে সাথে সাথে UI আপডেট করে দিন (সুপার ফাস্ট হবে)
        renderStudyMaterials(studentId);
        
        // ২. চট করে একটি সাকসেস মেসেজ (Toast) দেখিয়ে দিন
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
        Toast.fire({ icon: 'success', title: 'Material added instantly!' });

        // ৩. ব্যাকগ্রাউন্ডে নীরবে ফায়ারবেসে সেভ হতে দিন (await সরিয়ে দেওয়া হলো)
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
// --- Study Material এর JavaScript শেষ ---
// 🟢 Save Personal Notice
async function savePersonalNotice() {
    const text = document.getElementById('personalNoticeInput').value.trim();
    if (!text) { Swal.fire('Error', 'Write a notice first!', 'error'); return; }

    const studentIndex = students.findIndex(s => s.id === currentlyViewingStudentId);
    if(studentIndex !== -1) {
        students[studentIndex].personal_notice = text; // নোটিশ স্টুডেন্টের ডেটায় সেভ করা হলো
        
        await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(currentlyViewingStudentId)).update({ 
            personal_notice: text 
        });
        
        Swal.fire('Saved', 'Notice added successfully', 'success');
        showStudentDetails(currentlyViewingStudentId); // পেজ রিফ্রেশ
    }
}

// 🟢 Delete Personal Notice
async function deletePersonalNotice() {
    const studentIndex = students.findIndex(s => s.id === currentlyViewingStudentId);
    if(studentIndex !== -1) {
        students[studentIndex].personal_notice = ""; // নোটিশ ক্লিয়ার করা হলো
        
        await db.collection(COLLECTION_NAME).doc(DOC_ID).collection('students').doc(String(currentlyViewingStudentId)).update({ 
            personal_notice: "" 
        });
        
        document.getElementById('personalNoticeInput').value = '';
        Swal.fire('Deleted', 'Notice removed', 'success');
        showStudentDetails(currentlyViewingStudentId);
    }
}

// ==========================================
// GLOBAL MATERIAL LIBRARY LOGIC
// ==========================================

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
    
    // UI সাথে সাথে আপডেট হবে
    document.getElementById('libMatTitle').value = '';
    document.getElementById('libMatLink').value = '';
    renderGlobalMaterials();
    
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
    Toast.fire({ icon: 'success', title: 'Saved to Library' });

    // ব্যাকগ্রাউন্ডে সেভ হবে
    saveData().catch(e => console.log("Background sync pending"));
}

// 🟢 Global Material Library - Lazy Loading Variables
let currentFilteredMaterials = [];
let currentLibDisplayCount = 0;
const LIB_ITEMS_PER_PAGE = 10; // একবারে ১০টি করে মেটেরিয়াল লোড হবে

function renderGlobalMaterials() {
    // ট্যাব ওপেন হলে বাই-ডিফল্ট সব ফিল্টার রিসেট করে সব ডাটা দেখাবে
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
    currentLibDisplayCount = 0; // স্ক্রল কাউন্ট রিসেট

    // Search এবং Filter অনুযায়ী ডাটা ফিল্টার করা
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

    // লেটেস্ট অ্যাড করা মেটেরিয়াল ওপরে দেখাবে
    currentFilteredMaterials.sort((a, b) => b.id - a.id);

    // প্রথম ১০টি মেটেরিয়াল লোড করা
    loadMoreLibraryItems();
}

function loadMoreLibraryItems() {
    const container = document.getElementById('globalLibraryList');
    
    // লিস্ট থেকে পরের ১০টি মেটেরিয়াল বের করা
    const nextBatch = currentFilteredMaterials.slice(currentLibDisplayCount, currentLibDisplayCount + LIB_ITEMS_PER_PAGE);
    
    if (nextBatch.length === 0) return; // আর কিছু লোড করার নেই

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

    // স্ক্রল কাউন্ট আপডেট করা
    currentLibDisplayCount += nextBatch.length;
}

// 🟢 Lazy Loading (Infinite Scroll) Scroll Detector
function handleLibraryScroll() {
    const container = document.getElementById('globalLibraryList');
    
    // ইউজার লিস্টের একদম নিচে পৌঁছালে নতুন ব্যাচ লোড হবে
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
let tempActiveStudents = []; // সার্চিং এর জন্য ডাটা স্টোর করতে

// Helper function to generate custom HTML list with photos
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

// Function to handle selection highlighting
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

async function openSendToStudentModal(matId) {
    const material = globalMaterials.find(m => m.id === matId);
    if (!material) return;

    tempActiveStudents = students.filter(s => isStudentCurrentlyActive(s)).sort((a,b) => a.name.localeCompare(b.name));
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
        cancelButtonColor: '#ef4444',
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

// 🟢 WhatsApp-এ সরাসরি মেসেজ পাঠানোর ফাংশন
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

// 🔍 Search Box Filter Function
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
// ==========================================
// 🟢 PRACTICE TRACKER LOGIC (Instant Save & Optional Topic)
// ==========================================
// --- 🟢 NEW: Practice Stats Calculator Logic ---
function parseINDate(dateStr) {
    if (!dateStr) return new Date();
    const parts = dateStr.split('/');
    if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
    return new Date(dateStr);
}

function formatPracticeTime(totalMins) {
    if (!totalMins || totalMins === 0) return "0m";
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

function getPracticeStats(student, filter = 'All') {
    let rawLogs = student.practice_log || [];
    let logs = [];
    
    // 🟢 ফিল্টার অনুযায়ী লগ আলাদা করা হচ্ছে
    if (filter !== 'All') {
        logs = rawLogs.filter(log => {
            let logInst = log.instrument;
            if (!logInst) {
                let cList = student.class ? student.class.split(/[\/,]+/).map(c => c.trim()).filter(c => c.length > 0) : ['Music'];
                logInst = cList.length > 0 ? cList[0] : 'Music';
            }
            return logInst.trim().toLowerCase() === filter.trim().toLowerCase();
        });
    } else {
        logs = rawLogs;
    }

    let stats = { today: 0, week: 0, month: 0, year: 0, lifetime: 0, avg: 0 };
    if (logs.length === 0) return stats;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); 
    const weekStart = new Date(now);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    logs.forEach(log => {
        const mins = parseInt(log.minutes) || 0;
        stats.lifetime += mins;
        
        const logDate = parseINDate(log.date);
        logDate.setHours(0, 0, 0, 0);

        if (logDate.getTime() === now.getTime()) stats.today += mins;
        if (logDate >= weekStart && logDate <= now) stats.week += mins;
        if (logDate >= monthStart && logDate <= now) stats.month += mins;
        if (logDate >= yearStart && logDate <= now) stats.year += mins;
    });

    let firstPracticeDate = new Date(now);
    let earliestTime = now.getTime();
    logs.forEach(log => {
        const logDateObj = parseINDate(log.date);
        logDateObj.setHours(0, 0, 0, 0);
        if (logDateObj.getTime() < earliestTime) {
            earliestTime = logDateObj.getTime();
        }
    });
    firstPracticeDate = new Date(earliestTime);
    firstPracticeDate.setHours(0, 0, 0, 0);

    let totalDaysSinceStart = Math.floor((now - firstPracticeDate) / (1000 * 60 * 60 * 24)) + 1;

    let totalInactiveDays = 0;
    if (student.status && student.status.history && student.status.history.length > 0) {
        const historyAsc = [...student.status.history].sort((a, b) => new Date(a.date) - new Date(b.date));
        let inactiveStart = null;
        
        for (let i = 0; i < historyAsc.length; i++) {
            const hDate = new Date(historyAsc[i].date);
            hDate.setHours(0, 0, 0, 0);
            
            if (historyAsc[i].status === 'Inactive' && !inactiveStart) {
                inactiveStart = hDate;
            } else if (historyAsc[i].status === 'Active' && inactiveStart) {
                let start = inactiveStart > firstPracticeDate ? inactiveStart : firstPracticeDate;
                let end = hDate > now ? now : hDate;
                
                if (start < end) {
                    totalInactiveDays += Math.floor((end - start) / (1000 * 60 * 60 * 24));
                }
                inactiveStart = null; 
            }
        }
        
        if (inactiveStart) {
            let start = inactiveStart > firstPracticeDate ? inactiveStart : firstPracticeDate;
            let end = now;
            if (start < end) {
                totalInactiveDays += Math.floor((end - start) / (1000 * 60 * 60 * 24));
            }
        }
    }

    let activeDaysSinceStart = totalDaysSinceStart - totalInactiveDays;
    if (activeDaysSinceStart < 1) activeDaysSinceStart = 1;
    
    stats.avg = Math.round(stats.lifetime / activeDaysSinceStart);
    return stats;
}
// --- End of New Logic ---

window.submitPracticeLog = function(studentId) {
    const timeInputEl = document.getElementById('practiceTimeInput');
    const timeInputVal = timeInputEl ? timeInputEl.value : '';

    if (timeInputVal) {
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const [inputHours, inputMinutes] = timeInputVal.split(':').map(Number);
        if (inputHours > currentHours || (inputHours === currentHours && inputMinutes > currentMinutes)) {
            Swal.fire('Error', 'Future time cannot be selected!', 'error');
            return; 
        }
    }
    
    const minutes = document.getElementById('practiceMinutes').value;
    let topic = document.getElementById('practiceTopic').value.trim();
    if (!topic) topic = "Regular Practice"; 

    const classSelectEl = document.getElementById('practiceClassSelect');
    const selectedInstrument = classSelectEl ? classSelectEl.value : 'Music';

    if (!minutes || minutes <= 0) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Enter valid minutes!', showConfirmButton: false, timer: 2000 });
        return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN'); 
    const dayStr = now.toLocaleDateString('en-IN', { weekday: 'short' }); 
    let timeStr = timeInputVal ? formatTime12H(timeInputVal) : now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); 

    const urlParams = new URLSearchParams(window.location.search);
    const managerUid = urlParams.get('manager');
    const isStudentPortal = !!managerUid;
    const targetUid = managerUid ? managerUid : DOC_ID;

    let studentIndex = students.findIndex(s => String(s.id) === String(studentId));
    if (studentIndex === -1) return;
    let studentData = students[studentIndex];

    const currentYear = new Date().getFullYear();
    const newLog = {
        id: Date.now(),
        studentId: studentId,
        studentName: studentData.name,
        studentPhoto: studentData.photo || '',
        minutes: parseInt(minutes),
        topic: topic,
        instrument: selectedInstrument,
        date: dateStr,
        day: dayStr,
        time: timeStr
    };

    // 🟢 Firebase ArrayUnion into Yearly Subcollection
    db.collection(COLLECTION_NAME).doc(targetUid).collection('practice_logs').doc(String(currentYear)).set({
        records: firebase.firestore.FieldValue.arrayUnion(newLog)
    }, { merge: true }).catch(e => console.log("Background sync", e));

    // 🟢 Local Array update for Instant UI
if (typeof window.globalPracticeLogs !== 'undefined') window.globalPracticeLogs.unshift(newLog);
if (!studentData.practice_log) studentData.practice_log = [];
studentData.practice_log.unshift(newLog);

// 🟢 Manager side-এ থাকলে মেইন স্টুডেন্ট ডকুমেন্টে সেভ করবে
if (!isStudentPortal) {
    db.collection(COLLECTION_NAME).doc(targetUid).collection('students').doc(String(studentId)).update({
        practice_log: studentData.practice_log
    }).catch(e => console.log(e));
}

    document.getElementById('practiceMinutes').value = '';
    document.getElementById('practiceTopic').value = '';
    if(timeInputEl) timeInputEl.value = '';
    
    Swal.fire({ title: 'Great Job! 🌟', text: `Logged ${minutes} minutes!`, icon: 'success', timer: 2000, showConfirmButton: false });
    
    if (isStudentPortal) {
        window.renderPracticeHistoryPortal(studentData); 
    } else {
        window.renderPracticeLogTeacher(studentId);
        window.renderDashboard();
    }
};

window.showTodaysPracticingStudentsModal = function() {
    const todayDateStr = new Date().toLocaleDateString('en-IN');
    let practicedStudentIds = new Set();
    
    students.forEach(s => {
        if(s.practice_log && s.practice_log.length > 0) {
            if(s.practice_log.some(log => log.date === todayDateStr)) {
                practicedStudentIds.add(s.id);
            }
        }
    });

    if (practicedStudentIds.size === 0) return;

    document.getElementById('classStudentsTitle').textContent = `Today's Practice (${practicedStudentIds.size} Students)`; 
    const tableBody = document.querySelector('#classStudentsTable tbody'); 
    const tableHead = document.querySelector('#classStudentsTable thead tr');
    
    tableHead.innerHTML = '<th>ID</th><th>Student</th><th>Contact</th>'; 
    tableBody.innerHTML = ''; 
    
    practicedStudentIds.forEach(id => { 
        const s = students.find(student => student.id === id);
        if (s) {
            tableBody.innerHTML += `<tr><td>${s.serial_no}</td><td>${getStudentHtml(s)}</td><td>${getAllContactButtons(s)}</td></tr>`; 
        }
    }); 
    
    document.getElementById('classStudentsModal').style.display = 'flex'; 
};
window.renderPracticeHistoryPortal = function(student) {
    const existingIdx = students.findIndex(s => String(s.id) === String(student.id));
    if(existingIdx === -1) students.push(student);
    else students[existingIdx] = student;

    const container = document.getElementById('practiceHistoryPortal');
    if (!container) return;

    // 🟢 NEW: Class List for Dropdown Filter
    let classList = student.class ? student.class.split(/[\/,]+/).map(c => c.trim()).filter(c => c.length > 0) : [];
    const filterSelect = document.getElementById('studentPortalPracticeFilter');
    const selectedFilter = filterSelect ? filterSelect.value : 'All';

    let filterDropdownHtml = '';
    if (classList.length > 1) {
        let options = '<option value="All">All Subjects</option>';
        classList.forEach(c => {
            options += `<option value="${c}" ${selectedFilter === c ? 'selected' : ''}>${c}</option>`;
        });
        filterDropdownHtml = `
            <div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
                <select id="studentPortalPracticeFilter" onchange="renderPracticeHistoryPortal(students.find(s => String(s.id) === String(${student.id})))" style="padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; outline: none; cursor:pointer;">
                    ${options}
                </select>
            </div>
        `;
    }

    const stats = getPracticeStats(student, selectedFilter);

    let statsHtml = filterDropdownHtml + `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 15px;">
            <div style="background: #e0f2fe; padding: 10px; border-radius: 8px; text-align: center; border: 1px solid #bae6fd;">
                <div style="font-size: 10px; color: #0369a1; font-weight: 600; text-transform: uppercase;">Today</div>
                <div style="font-size: 14px; font-weight: 700; color: #0c4a6e;">${formatPracticeTime(stats.today)}</div>
            </div>
            <div style="background: #fef9c3; padding: 10px; border-radius: 8px; text-align: center; border: 1px solid #fef08a;">
                <div style="font-size: 10px; color: #a16207; font-weight: 600; text-transform: uppercase;">This Week</div>
                <div style="font-size: 14px; font-weight: 700; color: #713f12;">${formatPracticeTime(stats.week)}</div>
            </div>
            <div style="background: #ffedd5; padding: 10px; border-radius: 8px; text-align: center; border: 1px solid #fed7aa;">
                <div style="font-size: 10px; color: #c2410c; font-weight: 600; text-transform: uppercase;">This Month</div>
                <div style="font-size: 14px; font-weight: 700; color: #7c2d12;">${formatPracticeTime(stats.month)}</div>
            </div>
            <div style="background: #f3e8ff; padding: 10px; border-radius: 8px; text-align: center; border: 1px solid #e9d5ff;">
                <div style="font-size: 10px; color: #7e22ce; font-weight: 600; text-transform: uppercase;">This Year</div>
                <div style="font-size: 14px; font-weight: 700; color: #581c87;">${formatPracticeTime(stats.year)}</div>
            </div>
            <div style="background: #dcfce7; padding: 10px; border-radius: 8px; text-align: center; border: 1px solid #bbf7d0;">
                <div style="font-size: 10px; color: #15803d; font-weight: 600; text-transform: uppercase;">Lifetime</div>
                <div style="font-size: 14px; font-weight: 700; color: #14532d;">${formatPracticeTime(stats.lifetime)}</div>
            </div>
            <div style="background: #f1f5f9; padding: 10px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0;">
                <div style="font-size: 10px; color: #475569; font-weight: 600; text-transform: uppercase;">Daily Avg</div>
                <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${formatPracticeTime(stats.avg)}</div>
            </div>
        </div>
    `;

    let filteredLogs = student.practice_log || [];
    if (selectedFilter !== 'All') {
        filteredLogs = filteredLogs.filter(log => {
            let logInst = log.instrument;
            if (!logInst) {
                let cList = student.class ? student.class.split(/[\/,]+/).map(c => c.trim()).filter(c => c.length > 0) : ['Music'];
                logInst = cList.length > 0 ? cList[0] : 'Music';
            }
            return logInst.trim().toLowerCase() === selectedFilter.trim().toLowerCase();
        });
    }

    if (filteredLogs.length === 0) {
        container.innerHTML = statsHtml + '<div style="text-align:center; color:#94a3b8; font-size:12px; padding-top: 10px;">No practice logged for this selection.</div>';
        return;
    }

    // 🟢 স্ক্রল করার জন্য max-height 250px করে দিলাম এবং .slice(0, 10) সরিয়ে দিলাম
    let listHtml = '<div style="max-height: 250px; overflow-y: auto; padding-right: 5px;">';
    filteredLogs.forEach(log => { 
        let displayInst = log.instrument;
        if (!displayInst) {
            let cList = student.class ? student.class.split(/[\/,]+/).map(c => c.trim()).filter(c => c.length > 0) : [];
            displayInst = cList.length > 0 ? cList[0] : '';
        }
        let instrumentBadge = displayInst && classList.length > 1 ? `<span style="background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 5px;">${displayInst}</span>` : '';
        
        listHtml += `
            <div style="background: #f0fdf4; padding: 10px; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid #10b981; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <div>
                    <strong style="color: #065f46; font-size: 13px;">${log.topic}</strong> ${instrumentBadge}<br>
                    <span style="font-size: 11px; color: #166534;">📅 ${log.date} (${log.day}) 🕒 ${log.time}</span>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="background: #10b981; color: white; padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 12px;">${log.minutes} mins</div>
                    <button onclick="deletePracticeLog(${student.id}, ${log.id}, 'student')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:14px; padding:4px;" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
    });
    listHtml += '</div>';

    container.innerHTML = statsHtml + listHtml;
};

window.renderPracticeLogTeacher = function(studentId) {
    const student = students.find(s => s.id === studentId);
    const container = document.getElementById('modalPracticeList');
    const filterSelect = document.getElementById('teacherPracticeFilter');
    if (!container || !student) return;

    let classList = student.class ? student.class.split(/[\/,]+/).map(c => c.trim()).filter(c => c.length > 0) : [];

    if (filterSelect) {
        if (classList.length <= 1) {
            filterSelect.style.display = 'none'; 
        } else {
            filterSelect.style.display = 'block'; 
            if (filterSelect.options.length <= 1) { 
                let filterHtml = '<option value="All">All Subjects</option>';
                classList.forEach(c => {
                    filterHtml += `<option value="${c}">${c}</option>`;
                });
                filterSelect.innerHTML = filterHtml;
            }
        }
    }

    const selectedFilter = (filterSelect && filterSelect.style.display !== 'none') ? filterSelect.value : 'All';

    let statsContainer = document.getElementById('teacherPracticeStatsObj');
    if (!statsContainer) {
        statsContainer = document.createElement('div');
        statsContainer.id = 'teacherPracticeStatsObj';
        container.parentElement.parentElement.insertBefore(statsContainer, container.parentElement);
    }

    const stats = getPracticeStats(student, selectedFilter);
    
    statsContainer.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px;">
            <div style="background: var(--bg-card); padding: 10px; border-radius: 8px; text-align: center; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                <div style="font-size: 10px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Today</div>
                <div style="font-size: 14px; font-weight: 700; color: var(--primary);">${formatPracticeTime(stats.today)}</div>
            </div>
            <div style="background: var(--bg-card); padding: 10px; border-radius: 8px; text-align: center; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                <div style="font-size: 10px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">This Week</div>
                <div style="font-size: 14px; font-weight: 700; color: var(--warning);">${formatPracticeTime(stats.week)}</div>
            </div>
            <div style="background: var(--bg-card); padding: 10px; border-radius: 8px; text-align: center; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                <div style="font-size: 10px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">This Month</div>
                <div style="font-size: 14px; font-weight: 700; color: var(--danger);">${formatPracticeTime(stats.month)}</div>
            </div>
            <div style="background: var(--bg-card); padding: 10px; border-radius: 8px; text-align: center; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                <div style="font-size: 10px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">This Year</div>
                <div style="font-size: 14px; font-weight: 700; color: var(--info);">${formatPracticeTime(stats.year)}</div>
            </div>
            <div style="background: var(--bg-card); padding: 10px; border-radius: 8px; text-align: center; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                <div style="font-size: 10px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Lifetime</div>
                <div style="font-size: 14px; font-weight: 700; color: var(--success);">${formatPracticeTime(stats.lifetime)}</div>
            </div>
            <div style="background: var(--bg-card); padding: 10px; border-radius: 8px; text-align: center; border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                <div style="font-size: 10px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Daily Avg</div>
                <div style="font-size: 14px; font-weight: 700; color: var(--pink);">${formatPracticeTime(stats.avg)}</div>
            </div>
        </div>
    `;

    container.innerHTML = '';
    
    // 🟢 HTML কন্টেইনারের হাইট বাড়িয়ে দেওয়া হলো যাতে সহজে স্ক্রল করা যায়
    if (container.parentElement) {
        container.parentElement.style.maxHeight = '250px';
        container.parentElement.style.paddingRight = '5px';
    }

    let filteredLogs = student.practice_log || [];
    
    if (selectedFilter !== 'All') {
        filteredLogs = filteredLogs.filter(log => {
            let logInstrument = log.instrument;
            if (!logInstrument) {
                let cList = student.class ? student.class.split(/[\/,]+/).map(c => c.trim()).filter(c => c.length > 0) : ['Music'];
                logInstrument = cList.length > 0 ? cList[0] : 'Music';
            }
            return logInstrument.trim().toLowerCase() === selectedFilter.trim().toLowerCase();
        });
    }

    if (filteredLogs.length > 0) {
        // 🟢 .slice(0, 10) সরিয়ে দিলাম, এখন সবগুলো লগই লোড হবে এবং স্ক্রল করা যাবে
        filteredLogs.forEach(log => {
            let displayInstrument = log.instrument;
            if (!displayInstrument) {
                let cList = student.class ? student.class.split(/[\/,]+/).map(c => c.trim()).filter(c => c.length > 0) : [];
                displayInstrument = cList.length > 0 ? cList[0] : '';
            }

            let instrumentBadge = displayInstrument && classList.length > 1 ? `<span style="font-size: 9px; background: rgba(59, 130, 246, 0.1); color: var(--info); padding: 2px 5px; border-radius: 4px; border: 1px solid rgba(59, 130, 246, 0.2); margin-left: 5px;">${displayInstrument}</span>` : '';
            
            container.innerHTML += `
                <li style="padding: 10px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;">
                    <div>
                        <strong style="color: var(--success); font-size: 13px;">${log.topic}</strong> ${instrumentBadge}<br>
                        <span style="font-size: 11px; color: var(--text-muted);"><i class="fas fa-clock"></i> ${log.date} | ${log.day} | ${log.time}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="font-size: 12px; font-weight: bold; color: var(--text-main); background: var(--bg-body); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border-color);">${log.minutes} mins</div>
                        <button onclick="editPracticeLogTeacher(${student.id}, ${log.id})" style="background:none; border:none; color:var(--warning); cursor:pointer; font-size:14px; padding:4px;" title="Edit"><i class="fas fa-edit"></i></button>
                        <button onclick="deletePracticeLog(${student.id}, ${log.id}, 'teacher')" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:14px; padding:4px;" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </li>`;
        });
    } else {
        container.innerHTML = '<li style="padding: 15px; text-align: center; color: var(--text-muted); font-size: 12px;">No practice records found for this selection.</li>';
    }
};

window.deletePracticeLog = async function(studentId, logId, context) {
    const result = await Swal.fire({
        title: 'Delete Practice Log?',
        text: "Are you sure?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Yes, Delete'
    });

    if (result.isConfirmed) {
        const urlParams = new URLSearchParams(window.location.search);
        const managerUid = urlParams.get('manager');
        const targetUid = managerUid ? managerUid : DOC_ID;

        let studentIndex = students.findIndex(s => String(s.id) === String(studentId));
        if (studentIndex === -1) return;
        let studentData = students[studentIndex];

        // ১. যে লগটি মুছতে হবে সেটি বের করা
        const logToDelete = studentData.practice_log.find(log => String(log.id) === String(logId));
        if (!logToDelete) return;

        // ২. Local Array থেকে মুছে ফেলা (যাতে সাথে সাথে UI থেকে গায়েব হয়ে যায়)
        studentData.practice_log = studentData.practice_log.filter(log => String(log.id) !== String(logId));
        if (typeof window.globalPracticeLogs !== 'undefined') {
            window.globalPracticeLogs = window.globalPracticeLogs.filter(log => String(log.id) !== String(logId));
        }

        // ৩. Instant UI Update
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Deleted successfully!', showConfirmButton: false, timer: 1500 });
        
        if (context === 'student') {
            renderPracticeHistoryPortal(studentData);
        } else {
            renderPracticeLogTeacher(studentId);
            if(typeof renderDashboard === 'function') renderDashboard(); // ড্যাশবোর্ড কাউন্ট আপডেট
        }

        // ৪. Firebase Update (Main Student Doc)
        db.collection(COLLECTION_NAME).doc(targetUid).collection('students').doc(String(studentId)).update({
            practice_log: studentData.practice_log
        }).catch(e => console.log(e));

        // ৫. Firebase Update (Yearly Subcollection) - 🟢 100% Reliable Deletion
        let logYear = new Date().getFullYear(); 
        if(logToDelete.date) {
            const parts = logToDelete.date.split('/');
            if (parts.length === 3) logYear = parts[2];
        }

        const yearRef = db.collection(COLLECTION_NAME).doc(targetUid).collection('practice_logs').doc(String(logYear));
        
        try {
            const yearDoc = await yearRef.get();
            if (yearDoc.exists) {
                let records = yearDoc.data().records || [];
                // ফায়ারবেসের ডেটা থেকে লগটি ফিল্টার করে বাদ দেওয়া হচ্ছে
                records = records.filter(r => String(r.id) !== String(logId));
                await yearRef.update({ records: records });
            }
        } catch (error) {
            console.log("Background delete sync failed", error);
        }
    }
};

window.editPracticeLogTeacher = async function(studentId, logId) {
    const student = students.find(s => String(s.id) === String(studentId));
    if (!student) return;

    const logIndex = student.practice_log.findIndex(l => String(l.id) === String(logId));
    if (logIndex === -1) return;
    
    const oldLog = student.practice_log[logIndex]; 

    const { value: formValues } = await Swal.fire({
        title: 'Edit Practice Log',
        html: `
            <input id="edit-prac-mins" type="number" class="swal2-input" value="${oldLog.minutes}" placeholder="Minutes" style="width: 85%;">
            <input id="edit-prac-topic" type="text" class="swal2-input" value="${oldLog.topic}" placeholder="Topic (Optional)" style="width: 85%; margin-top: 10px;">
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
        const newLog = { ...oldLog, minutes: formValues.minutes, topic: formValues.topic };
        student.practice_log[logIndex] = newLog;

        if (typeof window.globalPracticeLogs !== 'undefined') {
            const gIndex = window.globalPracticeLogs.findIndex(l => String(l.id) === String(logId));
            if (gIndex > -1) window.globalPracticeLogs[gIndex] = newLog;
        }

        // ১. Instant UI Update
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Updated successfully!', showConfirmButton: false, timer: 1500 });
        renderPracticeLogTeacher(studentId);
        if(typeof renderDashboard === 'function') renderDashboard();

        // ২. Firebase Update
        const urlParams = new URLSearchParams(window.location.search);
        const targetUid = urlParams.get('manager') || DOC_ID;

        db.collection(COLLECTION_NAME).doc(targetUid).collection('students').doc(String(studentId)).update({
            practice_log: student.practice_log
        }).catch(e => console.log(e));

        // ৩. Firebase Yearly Subcollection Edit - 🟢 100% Reliable Edit
        let logYear = new Date().getFullYear(); 
        if(oldLog.date) {
            const parts = oldLog.date.split('/');
            if (parts.length === 3) logYear = parts[2];
        }

        const yearRef = db.collection(COLLECTION_NAME).doc(targetUid).collection('practice_logs').doc(String(logYear));
        try {
            const yearDoc = await yearRef.get();
            if (yearDoc.exists) {
                let records = yearDoc.data().records || [];
                const recIndex = records.findIndex(r => String(r.id) === String(logId));
                if (recIndex > -1) {
                    records[recIndex] = newLog;
                    await yearRef.update({ records: records });
                }
            }
        } catch (error) {
            console.log("Background edit sync failed", error);
        }
    }
};
// ==========================================
// 🟢 STATUS HISTORY EDIT & DELETE LOGIC
// ==========================================

window.editStatusHistory = async function(studentId, index) {
    const student = students.find(s => s.id === studentId);
    if (!student || !student.status.history || !student.status.history[index]) return;

    const entry = student.status.history[index];

    const { value: formValues } = await Swal.fire({
        title: 'Edit Status History',
        html: `
            <label style="font-size:12px; text-align:left; display:block; width:85%; margin: 0 auto;">Status</label>
            <select id="edit-status-type" class="swal2-select" style="width: 85%; margin-top: 0; margin-bottom: 10px;">
                <option value="Active" ${entry.status === 'Active' ? 'selected' : ''}>Active</option>
                <option value="Inactive" ${entry.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
            </select>
            
            <label style="font-size:12px; text-align:left; display:block; width:85%; margin: 0 auto;">Date</label>
            <input id="edit-status-date" type="date" class="swal2-input" value="${entry.date}" style="width: 85%; margin-top: 0; margin-bottom: 10px;">
            
            <label style="font-size:12px; text-align:left; display:block; width:85%; margin: 0 auto;">Note</label>
            <input id="edit-status-note" type="text" class="swal2-input" value="${entry.note || ''}" placeholder="Reason/Note" style="width: 85%; margin-top: 0;">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Save Changes',
        confirmButtonColor: 'var(--success)',
        preConfirm: () => {
            const status = document.getElementById('edit-status-type').value;
            const date = document.getElementById('edit-status-date').value;
            const note = document.getElementById('edit-status-note').value.trim();
            if (!date) {
                Swal.showValidationMessage('Please select a date');
            }
            return { status, date, note };
        }
    });

    if (formValues) {
        student.status.history[index] = {
            status: formValues.status,
            date: formValues.date,
            note: formValues.note
        };

        // Date অনুযায়ী হিস্ট্রি সর্ট করা এবং লেটেস্ট স্ট্যাটাস অনুযায়ী মেইন স্ট্যাটাস আপডেট করা
        student.status.history.sort((a, b) => new Date(b.date) - new Date(a.date));
        student.status.isActive = student.status.history.length > 0 ? (student.status.history[0].status === 'Active') : true;

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const managerUid = urlParams.get('manager');
            const targetUid = managerUid ? managerUid : DOC_ID;
            
            await db.collection(COLLECTION_NAME).doc(targetUid).collection('students').doc(String(studentId)).update({
                status: student.status
            });
        } catch(e) { console.log("Will sync later", e); }

        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Status updated!', showConfirmButton: false, timer: 1500 });
        showStudentDetails(studentId); // Modal রিফ্রেশ
        loadAllData(); // Dashboard ও List রিফ্রেশ
    }
};

window.deleteStatusHistory = async function(studentId, index) {
    const student = students.find(s => s.id === studentId);
    if (!student || !student.status.history || !student.status.history[index]) return;

    Swal.fire({
        title: 'Delete History?',
        text: "Are you sure you want to remove this record?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Yes, Delete'
    }).then(async (result) => {
        if (result.isConfirmed) {
            student.status.history.splice(index, 1);

            // Date অনুযায়ী হিস্ট্রি সর্ট করা এবং লেটেস্ট স্ট্যাটাস অনুযায়ী মেইন স্ট্যাটাস আপডেট করা
            student.status.history.sort((a, b) => new Date(b.date) - new Date(a.date));
            student.status.isActive = student.status.history.length > 0 ? (student.status.history[0].status === 'Active') : true;

            try {
                const urlParams = new URLSearchParams(window.location.search);
                const managerUid = urlParams.get('manager');
                const targetUid = managerUid ? managerUid : DOC_ID;
                
                await db.collection(COLLECTION_NAME).doc(targetUid).collection('students').doc(String(studentId)).update({
                    status: student.status
                });
            } catch(e) { console.log("Will sync later", e); }

            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Deleted successfully!', showConfirmButton: false, timer: 1500 });
            showStudentDetails(studentId); // Modal রিফ্রেশ
            loadAllData(); // Dashboard ও List রিফ্রেশ
        }
    });
};
// ==========================================
// 🟢 SECURE PERMANENT DELETE LOGIC
// ==========================================

window.initiateDeleteStudent = function(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    // প্রথম কনফার্মেশন
    Swal.fire({
        title: `Delete ${student.name}?`,
        text: "This will remove all profile, attendance, and fee records.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, proceed',
        cancelButtonText: 'Cancel'
    }).then((result) => {
        if (result.isConfirmed) {
            
            // দ্বিতীয় কনফার্মেশন (ফাইনাল ওয়ার্নিং)
            Swal.fire({
                title: 'Are you ABSOLUTELY sure?',
                html: `<span style="color:red; font-weight:bold;">This action CANNOT be undone!</span><br>All data will be lost forever.`,
                icon: 'error',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'I am sure, DELETE',
                cancelButtonText: 'Cancel'
            }).then((result2) => {
                if (result2.isConfirmed) {
                    
                    // পিন কোড চাওয়ার জন্য আপনার তৈরি করা secureAction কল করা হলো
                    secureAction(() => executePermanentDelete(studentId));
                    
                }
            });
        }
    });
};

window.executePermanentDelete = async function(studentId) {
    Swal.fire({ 
        title: 'Deleting...', 
        text: 'Removing student data from database.',
        allowOutsideClick: false, 
        didOpen: () => { Swal.showLoading(); } 
    });

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const managerUid = urlParams.get('manager');
        const targetUid = managerUid ? managerUid : DOC_ID;

        // ১. লোকাল স্টুডেন্ট লিস্ট (Array) থেকে মুছে ফেলা
        const studentIndex = students.findIndex(s => s.id === studentId);
        if(studentIndex > -1) {
            students.splice(studentIndex, 1);
        }

        // ২. ফায়ারবেস ডেটাবেস থেকে স্টুডেন্ট ডকুমেন্ট ডিলিট করা
        await db.collection(COLLECTION_NAME).doc(targetUid).collection('students').doc(String(studentId)).delete();

        // ৩. লোকাল Attendance এবং Fees থেকে ডেটা মুছে ফেলা এবং ফায়ারবেস আপডেট রেডি করা
        const updates = {};
        
        for (let date in attendance) {
            if (attendance[date][studentId]) {
                delete attendance[date][studentId];
                updates[`attendance.${date}.${studentId}`] = firebase.firestore.FieldValue.delete();
            }
        }

        for (let month in fees) {
            if (fees[month][studentId]) {
                delete fees[month][studentId];
                updates[`fees.${month}.${studentId}`] = firebase.firestore.FieldValue.delete();
            }
        }

        // ফায়ারবেসের মেইন ডকুমেন্ট আপডেট করা (Attendance & Fees মুছতে)
        if (Object.keys(updates).length > 0) {
            await db.collection(COLLECTION_NAME).doc(targetUid).update(updates);
        }

        // ৪. ডেটাবেস রিফ্রেশ করা এবং UI আপডেট করা
        loadAllData(); // এটি টেবিল, ড্যাশবোর্ড সবকিছু রিফ্রেশ করে দেবে

        Swal.fire('Deleted!', 'Student data has been completely removed.', 'success');

    } catch (error) {
        console.error("Error deleting student:", error);
        Swal.fire('Error', 'Failed to delete student data. Check your internet connection.', 'error');
    }
};

// ==========================================================
// 🟢 RESTORE SINGLE STUDENT FROM FULL BACKUP LOGIC
// ==========================================================

window.importSingleStudentFromFullBackup = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = ''; // ইনপুট রিসেট করা

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const json = e.target.result;
            const backupData = JSON.parse(json);

            // চেক করা হচ্ছে এটি ফুল ব্যাকআপ ফাইল কিনা
            if (!backupData || !backupData.students || !Array.isArray(backupData.students)) {
                Swal.fire('Error', 'Invalid Full Backup file.', 'error');
                return;
            }

            // স্টুডেন্টদের নাম অ্যালফাবেটিক্যালি সাজানো
            const sortedStudents = backupData.students.sort((a,b) => a.name.localeCompare(b.name));
            
            // ড্রপডাউন লিস্ট তৈরি
            let optionsHtml = '<select id="single-restore-select" class="swal2-select" style="width: 90%; font-size: 14px;">';
            optionsHtml += '<option value="">-- Select a student to restore --</option>';
            
            sortedStudents.forEach(s => {
                optionsHtml += `<option value="${s.id}">${s.name} (ID: ${s.serial_no})</option>`;
            });
            optionsHtml += '</select>';

            // স্টুডেন্ট সিলেক্ট করার পপআপ
            const { value: selectedId, isConfirmed } = await Swal.fire({
                title: 'Select Student',
                html: `<p style="font-size:13px; color:var(--text-muted);">Choose which student's data you want to extract from this Full Backup:</p>${optionsHtml}`,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Restore Student',
                confirmButtonColor: 'var(--success)',
                preConfirm: () => {
                    const val = document.getElementById('single-restore-select').value;
                    if (!val) Swal.showValidationMessage('Please select a student from the list');
                    return val;
                }
            });

            if (isConfirmed && selectedId) {
                executeSingleRestoreFromFullBackup(backupData, parseInt(selectedId));
            }
        } catch (err) {
            console.error("Single Restore Error:", err);
            Swal.fire('Error', 'Failed to read or parse the backup file.', 'error');
        }
    };
    reader.readAsText(file);
};

window.executeSingleRestoreFromFullBackup = async function(backupData, studentId) {
    Swal.fire({ 
        title: 'Restoring...', 
        text: 'Extracting student data from full backup...',
        allowOutsideClick: false, 
        didOpen: () => { Swal.showLoading(); } 
    });

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const targetUid = urlParams.get('manager') || DOC_ID;

        // ১. ব্যাকআপ থেকে স্টুডেন্ট প্রোফাইল বের করা
        const studentToRestore = backupData.students.find(s => s.id === studentId);
        if (!studentToRestore) throw new Error("Student not found in backup");

        // ২. লোকাল অ্যারেতে আপডেট করা
        const existingIndex = students.findIndex(s => s.id === studentId);
        if (existingIndex > -1) {
            students[existingIndex] = studentToRestore;
        } else {
            students.push(studentToRestore);
        }

        // ৩. ফায়ারবেসে স্টুডেন্ট প্রোফাইল সেভ করা
        await db.collection(COLLECTION_NAME).doc(targetUid).collection('students').doc(String(studentId)).set(studentToRestore);

        // ৪. ফুল ব্যাকআপের Attendance থেকে শুধু এই স্টুডেন্টের ডেটা ফিল্টার করা
        let needsDbSync = false;
        if (backupData.attendance) {
            Object.keys(backupData.attendance).forEach(date => {
                if (backupData.attendance[date][studentId]) {
                    if (!attendance[date]) attendance[date] = {};
                    attendance[date][studentId] = backupData.attendance[date][studentId];
                    needsDbSync = true;
                }
            });
        }

        // ৫. ফুল ব্যাকআপের Fees থেকে শুধু এই স্টুডেন্টের ডেটা ফিল্টার করা
        if (backupData.fees) {
            Object.keys(backupData.fees).forEach(month => {
                if (backupData.fees[month][studentId]) {
                    if (!fees[month]) fees[month] = {};
                    fees[month][studentId] = backupData.fees[month][studentId];
                    needsDbSync = true;
                }
            });
        }

        // ৬. মেইন ডেটাবেসে Attendance ও Fees সিঙ্ক করা
        if (needsDbSync) {
            const updates = {};
            if (backupData.attendance) updates.attendance = attendance;
            if (backupData.fees) updates.fees = fees;
            await db.collection(COLLECTION_NAME).doc(targetUid).update(updates);
        }

        // ৭. UI রিফ্রেশ
        loadAllData(); 
        
        Swal.fire({
            title: 'Welcome Back!',
            text: `${studentToRestore.name}'s profile, fees, and attendance have been perfectly restored from the full backup.`,
            icon: 'success',
            confirmButtonColor: 'var(--primary)'
        });

    } catch(e) {
        console.error(e);
        Swal.fire('Error', 'Failed to restore student. Check your connection.', 'error');
    }
};
// ==========================================
// 🟢 SINGLE STUDENT BACKUP & RESTORE LOGIC
// ==========================================

// --- ১. ব্যাকআপ নেওয়ার ফাংশন ---
window.exportSingleStudent = async function(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    Swal.fire({
        title: 'Preparing Backup...',
        text: `Gathering ALL data for ${student.name}`,
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const singleBackup = {
            isSingleStudentBackup: true,
            student: student,
            attendance: {},
            fees: {}
        };

        // এই স্টুডেন্টের সমস্ত অ্যাটেন্ডেন্স খুঁজে বের করা
        Object.keys(attendance).forEach(date => {
            if (attendance[date] && attendance[date][studentId]) {
                if (!singleBackup.attendance[date]) singleBackup.attendance[date] = {};
                singleBackup.attendance[date][studentId] = attendance[date][studentId];
            }
        });

        // এই স্টুডেন্টের সমস্ত ফিস পেমেন্ট খুঁজে বের করা
        Object.keys(fees).forEach(month => {
            if (fees[month] && fees[month][studentId]) {
                if (!singleBackup.fees[month]) singleBackup.fees[month] = {};
                singleBackup.fees[month][studentId] = fees[month][studentId];
            }
        });

        // ফাইল তৈরি ও ডাউনলোড
        const jsonStr = JSON.stringify(singleBackup, null, 2);
        const safeName = student.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `StudentBackup_${safeName}_${new Date().toISOString().split('T')[0]}.json`;

        if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{ description: 'JSON Backup File', accept: { 'application/json': ['.json'] } }],
            });
            const writable = await handle.createWritable();
            await writable.write(jsonStr);
            await writable.close();
        } else {
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        Swal.fire('Success!', `${student.name}'s complete data has been backed up.`, 'success');
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error(err);
            Swal.fire('Error', 'Failed to save backup.', 'error');
        }
    }
};

// --- ২. রিস্টোর করার ফাংশন ---
window.importSingleStudentData = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = ''; // Input রিসেট করা

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const json = e.target.result;
            const backupData = JSON.parse(json);

            // চেক করা হচ্ছে ফাইলটি সঠিক সিঙ্গেল স্টুডেন্ট ব্যাকআপ কিনা
            if (!backupData || !backupData.isSingleStudentBackup || !backupData.student) {
                Swal.fire('Error', 'Invalid Single Student Backup file.', 'error');
                return;
            }

            const studentToRestore = backupData.student;

            Swal.fire({
                title: `Restore ${studentToRestore.name}?`,
                text: "This will restore the student's profile, attendance, and fee history completely.",
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#ef4444',
                confirmButtonText: 'Yes, Restore Now'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    executeSingleRestore(backupData);
                }
            });

        } catch (err) {
            console.error("Restore Error:", err);
            Swal.fire('Error', 'Failed to read the backup file.', 'error');
        }
    };
    reader.readAsText(file);
};

// --- ৩. রিস্টোর এক্সিকিউট করা ---
window.executeSingleRestore = async function(backupData) {
    Swal.fire({ 
        title: 'Restoring Data...', 
        text: 'Please wait...',
        allowOutsideClick: false, 
        didOpen: () => { Swal.showLoading(); } 
    });

    try {
        const studentToRestore = backupData.student;
        const studentId = studentToRestore.id;
        
        const urlParams = new URLSearchParams(window.location.search);
        const targetUid = urlParams.get('manager') || DOC_ID;

        // ১. লোকাল স্টুডেন্ট লিস্টে আপডেট বা অ্যাড করা
        const existingIndex = students.findIndex(s => s.id === studentId);
        if (existingIndex > -1) {
            students[existingIndex] = studentToRestore;
        } else {
            students.push(studentToRestore);
        }

        // ফায়ারবেসে স্টুডেন্ট প্রোফাইল সেভ করা
        await db.collection(COLLECTION_NAME).doc(targetUid).collection('students').doc(String(studentId)).set(studentToRestore);

        // ২. অ্যাটেন্ডেন্স লোকাল ডেটায় মার্জ করা
        let needsDbSync = false;
        if (backupData.attendance) {
            Object.keys(backupData.attendance).forEach(date => {
                if (backupData.attendance[date][studentId]) {
                    if (!attendance[date]) attendance[date] = {};
                    attendance[date][studentId] = backupData.attendance[date][studentId];
                    needsDbSync = true;
                }
            });
        }

        // ৩. ফিস (Fees) লোকাল ডেটায় মার্জ করা
        if (backupData.fees) {
            Object.keys(backupData.fees).forEach(month => {
                if (backupData.fees[month][studentId]) {
                    if (!fees[month]) fees[month] = {};
                    fees[month][studentId] = backupData.fees[month][studentId];
                    needsDbSync = true;
                }
            });
        }

        // ৪. ফায়ারবেসের মূল ডকুমেন্টে অ্যাটেন্ডেন্স ও ফিস সেভ করা
        if (needsDbSync) {
            const updates = {};
            if (backupData.attendance) updates.attendance = attendance;
            if (backupData.fees) updates.fees = fees;
            await db.collection(COLLECTION_NAME).doc(targetUid).update(updates);
        }

        // ৫. পুরো অ্যাপ রিফ্রেশ করা যাতে ডেটাগুলো টেবিলে চলে আসে
        loadAllData(); 

        Swal.fire('Restored!', `${studentToRestore.name}'s total data has been successfully restored.`, 'success');

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'Failed to restore student completely. Check internet connection.', 'error');
    }
};
// --- 🟢 MISSING FUNCTIONS RECOVERED ---
function sendGeneralMsg(type, studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    // স্টুডেন্টের নিজস্ব পোর্টাল লিঙ্ক তৈরি করা হচ্ছে
    const baseUrl = window.location.origin + window.location.pathname;
    const portalLink = `${baseUrl}?student=${student.id}&manager=${DOC_ID}`;

    // 🟢 সুন্দর এবং প্রফেশনাল মেসেজ টেমপ্লেট (ইমোজি সহ)
    let msgBody = `Hello ${student.name},\n\nHope you are doing well and enjoying your ${student.class || 'Music'} classes! 🎵\n\nYou can check your Attendance, Fees, and Study Materials anytime from your Student Portal here:\n${portalLink}\n\nKeep practicing regularly!\n\nRegards,\nSrikanta Banerjee\n(Guitar, Bass Guitar, Piano, Keyboard, Mandolin Classes)`;
    
    if(type === 'wa') {
        let cleanPhone = student.phone.replace(/[^0-9]/g, '');
        if(cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgBody)}`, '_blank');
    } else if (type === 'sms') {
        window.open(`sms:${student.phone}?body=${encodeURIComponent(msgBody)}`, '_self');
    } else if (type === 'mail') {
        window.open(`mailto:${student.email}?subject=${encodeURIComponent("Update from Music Class")}&body=${encodeURIComponent(msgBody)}`, '_self');
    }
}

function openEditStudentModal(id) {
    const student = students.find(s => s.id === id);
    if (!student) return;
    
    document.getElementById('editStudentId').value = student.id;
    document.getElementById('editStudentName').value = student.name;
    document.getElementById('editStudentClass').value = student.class || '';
    document.getElementById('editStudentDay').value = student.class_day || '';
    document.getElementById('editStudentTime').value = student.class_time || '';
    document.getElementById('editStudentFee').value = student.fee_amount || DEFAULT_FEE;
    document.getElementById('editPhone').value = student.phone || '';
    document.getElementById('editGuardianName').value = student.guardian || '';
    document.getElementById('editStudentEmail').value = student.email || '';
    document.getElementById('editAddress').value = student.address || '';
    document.getElementById('editStudentDOB').value = student.dob || '';
    document.getElementById('editAllowProfile').checked = student.allow_profile_view !== false; // Default true
    
    const photoPreview = document.getElementById('editPhotoPreview');
    if (student.photo) {
        photoPreview.src = student.photo;
        currentEditPhotoBase64 = student.photo;
    } else {
        photoPreview.src = 'https://via.placeholder.com/100?text=No+Photo';
        currentEditPhotoBase64 = null;
    }
    isPhotoDeletedInEdit = false;

    document.getElementById('editStudentModal').style.display = 'flex';
}

async function saveStudentChanges() {
    const id = parseInt(document.getElementById('editStudentId').value);
    const studentIndex = students.findIndex(s => s.id === id);
    if (studentIndex === -1) return;

    const name = document.getElementById('editStudentName').value;
    const className = document.getElementById('editStudentClass').value;
    const day = document.getElementById('editStudentDay').value;
    const time = document.getElementById('editStudentTime').value;
    const fee = parseFloat(document.getElementById('editStudentFee').value) || DEFAULT_FEE;
    const phone = document.getElementById('editPhone').value;
    const guardian = document.getElementById('editGuardianName').value;
    const email = document.getElementById('editStudentEmail').value;
    const address = document.getElementById('editAddress').value;
    const dob = document.getElementById('editStudentDOB').value;
    const allowProfile = document.getElementById('editAllowProfile').checked;

    if (name.trim() === '') {
        Swal.fire('Error', 'Name is required.', 'error');
        return;
    }

    let finalPhoto = students[studentIndex].photo;
    if (isPhotoDeletedInEdit) {
        finalPhoto = null;
    } else if (currentEditPhotoBase64) {
        finalPhoto = currentEditPhotoBase64;
    }

    students[studentIndex] = {
        ...students[studentIndex],
        name, class: className, class_day: day, class_time: time,
        fee_amount: fee, phone, guardian, email, address, dob,
        photo: finalPhoto,
        allow_profile_view: allowProfile
    };

    closeModal('editStudentModal');
    loadAllData();
    Swal.fire('Success', 'Student updated successfully!', 'success');

    const user = firebase.auth().currentUser;
    if (user) {
        db.collection(COLLECTION_NAME).doc(user.uid).collection('students').doc(String(id)).set(students[studentIndex], { merge: true })
        .catch(e => console.log("Offline sync pending"));
    }
}
// ------------------------------------------
// 🟢 NEW: Student Portal QR Code Viewer Function
window.showStudentPortalQR = function(studentId) {
    const urlParams = new URLSearchParams(window.location.search);
    const managerUid = urlParams.get('manager');
    const baseUrl = window.location.origin + window.location.pathname;
    
    // QR কোডের ভেতরে থাকা টেক্সট/লিঙ্ক
    const qrText = `${baseUrl}?student=${studentId}&manager=${managerUid}`;
    
    // QR ছবি তৈরি করা
    const qr = new QRious({ value: qrText, size: 250, level: 'H' });
    const qrImg = qr.toDataURL();
    
    Swal.fire({
        title: 'My QR Code',
        html: `
            <p style="font-size:13px; color:gray; margin-bottom: 15px;">Show this to your teacher for quick attendance.</p>
            <div style="background: #f8fafc; padding: 15px; display: inline-block; border-radius: 16px; border: 2px dashed #cbd5e1;">
                <img src="${qrImg}" style="width: 200px; height: 200px; border-radius: 8px; pointer-events: none;">
            </div>
        `,
        showCloseButton: true,
        showConfirmButton: true,
        confirmButtonText: 'Close',
        confirmButtonColor: '#ef4444' // 🟢 Fixed Syntax Error Here
    });
};
// ==========================================
// 🟢 ACCESSORIES SALES FINAL LOGIC
// ==========================================

let salesDataArray = [];
let tempSalesActiveStudents = [];

window.fetchSalesData = async function() {
    const yearInput = document.getElementById('salesYearFilter');
    if (!yearInput.value) yearInput.value = new Date().getFullYear();
    const year = yearInput.value;

    const user = firebase.auth().currentUser;
    if (user) {
        try {
            const doc = await db.collection(COLLECTION_NAME).doc(user.uid).collection('accessory_sales').doc(String(year)).get();
            if (doc.exists) {
                salesDataArray = doc.data().records || [];
            } else {
                salesDataArray = [];
            }
        } catch(e) { console.error("Error fetching sales:", e); }
    }
    window.renderSalesUI();
};

window.syncSalesToFirebase = function(year) {
    const user = firebase.auth().currentUser;
    if (user) {
        db.collection(COLLECTION_NAME).doc(user.uid).collection('accessory_sales').doc(String(year)).set({
            records: salesDataArray
        }).catch(e => console.error("Sales Sync failed", e));
    }
};

window.openSaleStudentSelector = function() {
    tempSalesActiveStudents = students.filter(s => window.isStudentCurrentlyActive(s)).sort((a,b) => a.name.localeCompare(b.name));
    let listHtml = window.generateSaleStudentListHtml(tempSalesActiveStudents);

    Swal.fire({
        title: 'Select Student',
        html: `
            <input type="text" id="swal-search-sale-student" class="swal2-input" placeholder="🔍 Search by name or ID..." style="width: 100%; margin: 0 0 10px 0; font-size: 14px; box-sizing: border-box;" onkeyup="window.filterSaleStudentList()">
            <div id="sale-student-list" style="width:100%; max-height: 280px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); text-align:left;">
                ${listHtml}
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Close',
        cancelButtonColor: '#ef4444'
    });
};

window.generateSaleStudentListHtml = function(studentsList) {
    let html = '';
    studentsList.forEach(s => {
        const photoSrc = s.photo ? s.photo : 'https://via.placeholder.com/40?text=S';
        const safeName = s.name.replace(/'/g, "\\'");
        html += `
            <div onclick="window.selectStudentForSale(${s.id}, '${safeName}', '${photoSrc}')" style="display:flex; align-items:center; padding: 12px; border-bottom: 1px solid var(--border-color); cursor:pointer; transition: background 0.2s; background: var(--bg-card);">
                <img src="${photoSrc}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0; margin-right: 15px; flex-shrink: 0;">
                <div style="flex-grow: 1;">
                    <div style="font-weight: 700; font-size: 14px; color: var(--text-main);">${s.name}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${s.class || 'N/A'} | ID: ${s.serial_no}</div>
                </div>
            </div>
        `;
    });
    if(studentsList.length === 0) html = `<div style="padding: 15px; text-align: center; color: var(--text-muted); font-size: 13px;">No student found</div>`;
    return html;
};

window.filterSaleStudentList = function() {
    const input = document.getElementById('swal-search-sale-student');
    if(!input) return;
    const filter = input.value.toUpperCase();
    const listContainer = document.getElementById('sale-student-list');
    
    const filtered = tempSalesActiveStudents.filter(s => {
        const text = `${s.name} ${s.serial_no} ${s.class || ''}`.toUpperCase();
        return text.indexOf(filter) > -1;
    });
    listContainer.innerHTML = window.generateSaleStudentListHtml(filtered);
};

window.selectStudentForSale = function(id, name, photoUrl) {
    document.getElementById('saleStudentId').value = id;
    
    const nameEl = document.getElementById('saleSelectedName');
    nameEl.textContent = name;
    nameEl.style.color = "var(--text-main)";
    
    const imgEl = document.getElementById('saleSelectedPhoto');
    imgEl.src = photoUrl;
    imgEl.style.display = 'block';

    Swal.close();
};

window.calculateSaleDue = function() {
    let cartTotal = 0;
    window.saleCart.forEach(item => cartTotal += item.price);
    
    const paid = parseFloat(document.getElementById('amountPaid').value) || 0;
    const due = cartTotal - paid;
    
    const display = document.getElementById('saleDueDisplay');
    if(display) {
        if (due > 0) {
            display.innerHTML = `Current Due: <span style="color:var(--danger);">₹${due}</span>`;
            display.style.background = 'rgba(239, 68, 68, 0.1)';
        } else {
            display.innerHTML = `Current Due: <span style="color:var(--success);">₹0 (Fully Paid)</span>`;
            display.style.background = 'rgba(16, 185, 129, 0.1)';
        }
    }
};

window.addAccessoryDueToStudent = function(studentId, saleId, item, due) {
    let student = students.find(s => s.id == studentId);
    if(!student) return;
    if(!student.unpaid_accessories) student.unpaid_accessories = [];
    student.unpaid_accessories = student.unpaid_accessories.filter(a => a.saleId !== saleId);
    if (due > 0) student.unpaid_accessories.push({ saleId, item, due });
    const user = firebase.auth().currentUser;
    if(user) {
        db.collection(COLLECTION_NAME).doc(user.uid).collection('students').doc(String(studentId)).update({
            unpaid_accessories: student.unpaid_accessories
        }).catch(e=>{});
    }
};

window.removeAccessoryDueFromStudent = function(studentId, saleId) {
    let student = students.find(s => s.id == studentId);
    if(!student || !student.unpaid_accessories) return;
    student.unpaid_accessories = student.unpaid_accessories.filter(a => a.saleId !== saleId);
    const user = firebase.auth().currentUser;
    if(user) {
        db.collection(COLLECTION_NAME).doc(user.uid).collection('students').doc(String(studentId)).update({
            unpaid_accessories: student.unpaid_accessories
        }).catch(e=>{});
    }
};

window.deleteSaleRecord = function(saleId) {
    Swal.fire({
        title: 'Delete Record?',
        text: "This will permanently remove the sales and due record.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
        if (result.isConfirmed) {
            const sale = salesDataArray.find(s => s.id === saleId);
            if (sale) window.removeAccessoryDueFromStudent(sale.studentId, saleId); 
            
            salesDataArray = salesDataArray.filter(s => s.id !== saleId);
            window.renderSalesUI();
            const currentYear = document.getElementById('salesYearFilter').value;
            window.syncSalesToFirebase(currentYear);
            Swal.fire({toast: true, position: 'top-end', icon: 'success', title: 'Deleted!', showConfirmButton: false, timer: 1500});
        }
    });
};

window.renderSalesUI = function() {
    const list = document.getElementById('salesList');
    if(!list) return;
    list.innerHTML = '';
    
    const searchInput = document.getElementById('searchSalesHistoryInput');
    const filterText = searchInput ? searchInput.value.toLowerCase().trim() : '';

    // --- 🟢 NEW: মোট Due এবং Due থাকা রেকর্ডগুলো গোনা হচ্ছে ---
    let totalDueAmount = 0;
    let dueRecords = [];
    
    salesDataArray.forEach(s => {
        if (s.due > 0) {
            totalDueAmount += s.due;
            dueRecords.push(s);
        }
    });

    // 🟢 NEW: Sales ট্যাবের ঠিক উপরে লাল বাটনটি (Due Button) তৈরি করা হচ্ছে
    let dueAlertContainer = document.getElementById('salesDueAlertContainer');
    if (!dueAlertContainer) {
        const searchBar = document.querySelector('.search-bar input#searchSalesHistoryInput').parentElement;
        dueAlertContainer = document.createElement('div');
        dueAlertContainer.id = 'salesDueAlertContainer';
        dueAlertContainer.style.marginBottom = '15px';
        searchBar.parentNode.insertBefore(dueAlertContainer, searchBar);
    }

    if (dueRecords.length > 0) {
        dueAlertContainer.innerHTML = `
            <button onclick="window.showSalesDuesPopup()" style="width: 100%; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: bold; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; box-shadow: 0 4px 10px rgba(239,68,68,0.3); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                <span style="display:flex; align-items:center; gap:8px;"><i class="fas fa-exclamation-triangle" style="font-size:18px;"></i> Unpaid Accessories</span>
                <span style="background: white; color: #ef4444; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 900; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
                    ${dueRecords.length} Dues (₹${totalDueAmount})
                </span>
            </button>
        `;
        dueAlertContainer.style.display = 'block';
    } else {
        dueAlertContainer.style.display = 'none';
    }
    // -------------------------------------

    const filteredSales = salesDataArray.filter(s => {
        if (!filterText) return true;
        const searchContent = `${s.studentName} ${s.item}`.toLowerCase();
        return searchContent.includes(filterText);
    });

    if (filteredSales.length === 0) {
        list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">No sales found.</td></tr>';
        return;
    }
    
    filteredSales.forEach(s => {
        const statusClr = s.due > 0 ? 'var(--danger)' : 'var(--success)';
        const dateStr = new Date(s.date).toLocaleDateString('en-IN');
        
        // 🟢 বাটনগুলোর সাইজ (width, height, font-size) বড় করা হয়েছে
        list.innerHTML += `
            <tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-card);">
                <td style="padding:12px 6px; font-size:13px; vertical-align: middle;"><strong>${s.studentName}</strong><br><span style="font-size:11px; color:var(--text-muted); line-height:1.4; display:block; margin-top:3px;">${s.item} <br>📅 ${dateStr}</span></td>
                <td style="font-weight:bold; padding:12px 6px; font-size:13px; vertical-align: middle;">₹${s.price}</td>
                <td style="padding:12px 6px; font-size:12px; vertical-align: middle;">
                    <span style="color:var(--success);">Paid: ₹${s.paid}</span><br>
                    <span style="color:${statusClr}; font-weight:bold; margin-top:2px; display:inline-block;">Due: ₹${s.due}</span>
                </td>
                <td class="action-buttons" style="padding:12px 6px; vertical-align: middle;">
                    <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
                       <button class="btn-info" onclick="window.resendSaleReceipt(${s.id})" title="Receipt" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; background:#8b5cf6; color:#fff; border:none; border-radius:6px; font-size:14px;"><i class="fas fa-file-pdf"></i></button>
                       <button class="btn-warning" onclick="window.editSaleRecord(${s.id})" title="Edit" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; background:#f59e0b; color:#fff; border:none; border-radius:6px; font-size:14px;"><i class="fas fa-edit"></i></button>
                       <button class="btn-danger" onclick="window.deleteSaleRecord(${s.id})" title="Delete" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; background:#ef4444; color:#fff; border:none; border-radius:6px; font-size:14px;"><i class="fas fa-trash"></i></button>
                       <button class="btn-whatsapp" onclick="window.sendSaleWhatsApp(${s.id})" title="WA" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; background:#25D366; color:#fff; border:none; border-radius:6px; font-size:16px;"><i class="fab fa-whatsapp"></i></button>
                       <button class="btn-sms" onclick="window.sendSaleSMS(${s.id})" title="SMS" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; background:#f59e0b; color:#fff; border:none; border-radius:6px; font-size:14px;"><i class="fas fa-sms"></i></button>
                    </div>
                </td>
            </tr>`;
    });
};

window.backupSalesData = async function() {
    if(salesDataArray.length === 0) {
        Swal.fire('Info', 'No sales data to backup for this year.', 'info');
        return;
    }
    
    const year = document.getElementById('salesYearFilter').value;
    const jsonStr = JSON.stringify({ year: year, records: salesDataArray }, null, 2);
    const fileName = `MusicClass_Sales_Backup_${year}.json`;

    try {
        if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{ description: 'JSON Backup File', accept: { 'application/json': ['.json'] } }],
            });
            const writable = await handle.createWritable();
            await writable.write(jsonStr);
            await writable.close();
            Swal.fire({toast: true, position: 'top-end', icon: 'success', title: 'Backup Saved Successfully!', showConfirmButton: false, timer: 2000});
        } else {
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            Swal.fire({toast: true, position: 'top-end', icon: 'success', title: 'Backup Downloaded!', showConfirmButton: false, timer: 2000});
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error(err);
            Swal.fire('Error', 'Failed to save backup file.', 'error');
        }
    }
};

window.exportSalesBackup = window.backupSalesData;

window.restoreSalesData = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = ''; 

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const json = e.target.result;
            const importedData = JSON.parse(json);

            let salesRecordsToRestore = [];
            let restoreYear = document.getElementById('salesYearFilter').value || new Date().getFullYear();

            if (importedData.salesDataArray !== undefined) {
                salesRecordsToRestore = importedData.salesDataArray; 
                Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Extracting Sales from Full Backup...', showConfirmButton: false, timer: 1500 });
            } 
            else if (importedData.records && Array.isArray(importedData.records)) {
                salesRecordsToRestore = importedData.records;
                if (importedData.year) restoreYear = importedData.year;
            } 
            else {
                Swal.fire('Error', 'এই ফাইলে কোনো সেলস রেকর্ড পাওয়া যায়নি!', 'error');
                return;
            }

            Swal.fire({
                title: `Restore Sales Data?`,
                text: `This will replace your current sales records with the backup data.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#ef4444',
                confirmButtonText: 'Yes, Restore Only Sales'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    Swal.fire({ title: 'Restoring...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

                    const yearInput = document.getElementById('salesYearFilter');
                    if(yearInput) yearInput.value = restoreYear;
                    
                    salesDataArray = salesRecordsToRestore;
                    window.syncSalesToFirebase(restoreYear);
                    window.renderSalesUI();

                    Swal.close();
                    setTimeout(() => {
                        Swal.fire({
                            title: 'Restored!',
                            text: `Sales data has been restored successfully.`,
                            icon: 'success',
                            showConfirmButton: true,
                            confirmButtonText: 'Close',
                            confirmButtonColor: '#ef4444', 
                            allowOutsideClick: false
                        });
                    }, 300);
                }
            });

        } catch (err) {
            console.error("Sales Restore Error:", err);
            Swal.fire('Error', 'Failed to read the backup file. File might be corrupted.', 'error');
        }
    };
    reader.readAsText(file);
};

// ==========================================
// 🟢 BOTTOM NAV SCROLL ARROW LOGIC
// ==========================================

window.scrollBottomNav = function(direction) {
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    
    const scrollAmount = nav.clientWidth * 0.5; 
    if (direction === 'left') {
        nav.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
        nav.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
    
    window.flashNavArrows(); 
};

window.arrowTimeout = null;

window.flashNavArrows = function() {
    const nav = document.querySelector('.bottom-nav');
    const leftArrow = document.getElementById('scrollArrowLeft');
    const rightArrow = document.getElementById('scrollArrowRight');
    
    if (!nav || !leftArrow || !rightArrow) return;

    if (nav.scrollLeft > 5) {
        leftArrow.style.display = 'flex';
        leftArrow.style.opacity = '0.9';
    } else {
        leftArrow.style.display = 'none';
    }

    if (Math.ceil(nav.scrollLeft + nav.clientWidth) < nav.scrollWidth - 5) {
        rightArrow.style.display = 'flex';
        rightArrow.style.opacity = '0.9';
    } else {
        rightArrow.style.display = 'none';
    }

    clearTimeout(window.arrowTimeout);
    window.arrowTimeout = setTimeout(() => {
        if(leftArrow) leftArrow.style.display = 'none';
        if(rightArrow) rightArrow.style.display = 'none';
    }, 2000); 
};

setTimeout(() => {
    const nav = document.querySelector('.bottom-nav');
    if (nav) {
        nav.addEventListener('click', window.flashNavArrows);
        nav.addEventListener('touchstart', window.flashNavArrows, {passive: true});
        nav.addEventListener('scroll', window.flashNavArrows, {passive: true}); 
    }
}, 500);

// ==========================================
// 🟢 STOCK MANAGEMENT LOGIC (ADD, EDIT, DELETE)
// ==========================================

window.stockInventory = [];

window.openStockModal = function() {
    window.renderStockTable();
    document.getElementById('stockModal').style.display = 'flex';
};

window.addStockItem = async function() {
    const name = document.getElementById('newStockName').value.trim();
    const price = parseFloat(document.getElementById('newStockPrice').value) || 0;
    const qty = parseInt(document.getElementById('newStockQty').value) || 0;
    
    const editIdInput = document.getElementById('editStockId');
    const editId = editIdInput ? editIdInput.value : '';

    if (!name) { Swal.fire('Error', 'Item name is required', 'error'); return; }

    if (editId) {
        const index = window.stockInventory.findIndex(i => i.id == editId);
        if (index > -1) {
            window.stockInventory[index] = { ...window.stockInventory[index], name, price, qty };
        }
    } else {
        const existingIndex = window.stockInventory.findIndex(i => i.name.toLowerCase() === name.toLowerCase());
        if (existingIndex > -1) {
            window.stockInventory[existingIndex].price = price;
            window.stockInventory[existingIndex].qty += qty;
        } else {
            window.stockInventory.push({ id: Date.now(), name, price, qty });
        }
    }

    document.getElementById('newStockName').value = '';
    document.getElementById('newStockPrice').value = '';
    document.getElementById('newStockQty').value = '';
    if(editIdInput) editIdInput.value = '';
    
    const btn = document.querySelector('#stockModal .btn-primary');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-plus"></i> Add / Update Stock';
        btn.style.background = ''; 
    }

    window.renderStockTable();
    window.renderInventoryDropdown();
    
    await dbSet('stockData', window.stockInventory);
    Swal.fire({toast: true, position: 'top-end', icon: 'success', title: editId ? 'Stock Updated!' : 'Stock Added!', showConfirmButton: false, timer: 1500});
};

window.editStockItem = function(id) {
    const item = window.stockInventory.find(i => i.id === id);
    if (!item) return;

    document.getElementById('newStockName').value = item.name;
    document.getElementById('newStockPrice').value = item.price;
    document.getElementById('newStockQty').value = item.qty;
    
    let editIdInput = document.getElementById('editStockId');
    if(!editIdInput) {
        editIdInput = document.createElement('input');
        editIdInput.type = 'hidden';
        editIdInput.id = 'editStockId';
        document.querySelector('#stockModal .form-grid').appendChild(editIdInput);
    }
    editIdInput.value = item.id;

    const btn = document.querySelector('#stockModal .btn-primary');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-save"></i> Update Stock Item';
        btn.style.background = '#f59e0b'; 
    }
};

window.deleteStockItem = async function(id) {
    Swal.fire({
        title: 'Delete Item?',
        text: "Are you sure you want to remove this item from stock?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Yes, delete it'
    }).then(async (result) => {
        if (result.isConfirmed) {
            window.stockInventory = window.stockInventory.filter(i => i.id !== id);
            window.renderStockTable();
            window.renderInventoryDropdown();
            await dbSet('stockData', window.stockInventory);
            Swal.fire({toast: true, position: 'top-end', icon: 'success', title: 'Deleted!', showConfirmButton: false, timer: 1500});
        }
    });
};

window.renderStockTable = function() {
    const tbody = document.getElementById('stockTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    // 🟢 সার্চ বারের টেক্সট নেওয়া হচ্ছে
    const searchInput = document.getElementById('searchStockInput');
    const filterText = searchInput ? searchInput.value.toLowerCase().trim() : '';

    // 🟢 সার্চ অনুযায়ী লিস্ট ফিল্টার করা হচ্ছে
    const filteredStock = window.stockInventory.filter(item => {
        if (!filterText) return true;
        return item.name.toLowerCase().includes(filterText);
    });

    if (filteredStock.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:15px; color:gray; font-size:12px;">No items found.</td></tr>';
        return;
    }

    filteredStock.forEach(item => {
        const stockColor = item.qty <= 2 ? 'color: var(--danger); font-weight: bold;' : 'color: var(--success); font-weight: bold;';
        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 6px 4px; color: var(--text-main); font-weight: 500; font-size: 11px;">${item.name}</td>
                <td style="padding: 6px 4px; color: var(--text-main); font-size: 11px;">₹${item.price}</td>
                <td style="padding: 6px 4px; font-size: 11px; ${stockColor}">${item.qty} pcs</td>
                <td style="padding: 6px 4px; text-align: center; white-space: nowrap;">
                    <button onclick="window.editStockItem(${item.id})" style="background:none; border:none; color:var(--warning); cursor:pointer; margin-right:8px; font-size:12px;" title="Edit"><i class="fas fa-edit"></i></button>
                    <button onclick="window.deleteStockItem(${item.id})" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:12px;" title="Delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
};

window.renderInventoryDropdown = function() {
    const datalist = document.getElementById('stockDataList');
    if(!datalist) return;
    datalist.innerHTML = '';
    window.stockInventory.forEach(item => {
        const option = document.createElement('option');
        option.value = item.name;
        datalist.appendChild(option);
    });
};

window.currentUnitPrice = 0; 
window.saleCart = []; 

window.autoFillItemPrice = function() {
    const inputName = document.getElementById('itemName').value.trim();
    const item = window.stockInventory.find(i => i.name.toLowerCase() === inputName.toLowerCase());
    
    if (item) {
        window.currentUnitPrice = item.price; 
        window.updateSalePriceCalc(); 
        if (item.qty <= 0) Swal.fire({toast: true, position: 'top-end', icon: 'error', title: 'Out of Stock!', showConfirmButton: false, timer: 2000});
    }
};

window.updateSalePriceCalc = function() {
    const qty = parseInt(document.getElementById('saleQty').value) || 1;
    if (window.currentUnitPrice > 0) {
        document.getElementById('itemPrice').value = window.currentUnitPrice * qty;
    }
};

window.addToCart = function() {
    const name = document.getElementById('itemName').value.trim();
    const qty = parseInt(document.getElementById('saleQty').value) || 1;
    const totalItemPrice = parseFloat(document.getElementById('itemPrice').value);

    if (!name || isNaN(totalItemPrice) || qty < 1) {
        Swal.fire({toast: true, position: 'top', icon: 'error', title: 'Enter item name and price!', showConfirmButton: false, timer: 2000});
        return;
    }

    const stockItemCheck = window.stockInventory.find(i => i.name.toLowerCase() === name.toLowerCase());
    if (stockItemCheck && stockItemCheck.qty < qty) {
        Swal.fire('Low Stock!', `You only have ${stockItemCheck.qty} pcs of "${stockItemCheck.name}" left.`, 'warning');
    }

    window.saleCart.push({ name: name, qty: qty, price: totalItemPrice });
    
    document.getElementById('itemName').value = '';
    document.getElementById('saleQty').value = '1';
    document.getElementById('itemPrice').value = '';
    window.currentUnitPrice = 0;

    window.renderCart();
};

window.renderCart = function() {
    const container = document.getElementById('saleCartContainer');
    const list = document.getElementById('saleCartList');
    const totalSpan = document.getElementById('cartTotalPrice');

    if (window.saleCart.length === 0) {
        container.style.display = 'none';
        totalSpan.textContent = '0';
        window.calculateSaleDue();
        return;
    }

    list.innerHTML = '';
    let grandTotal = 0;

    window.saleCart.forEach((item, index) => {
        grandTotal += item.price;
        list.innerHTML += `
            <li style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px dashed var(--border-color);">
                <span><b>${item.name}</b> (x${item.qty})</span>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: 600;">₹${item.price}</span>
                    <button onclick="window.removeFromCart(${index})" style="background: none; border: none; color: var(--danger); cursor: pointer;"><i class="fas fa-times"></i></button>
                </div>
            </li>
        `;
    });

    totalSpan.textContent = grandTotal;
    container.style.display = 'block';
    window.calculateSaleDue();
};

window.removeFromCart = function(index) {
    window.saleCart.splice(index, 1);
    window.renderCart();
};

window.processSale = function() {
    const sId = document.getElementById('saleStudentId').value;
    const editId = document.getElementById('editSaleId').value;
    const paid = parseFloat(document.getElementById('amountPaid').value) || 0;

    if (!sId) { Swal.fire({toast: true, position: 'top', icon: 'error', title: 'Select a student!', showConfirmButton: false, timer: 2000}); return; }
    if (window.saleCart.length === 0) { Swal.fire({toast: true, position: 'top', icon: 'error', title: 'Cart is empty!', showConfirmButton: false, timer: 2000}); return; }

    let cartTotal = 0;
    let combinedNamesArray = [];
    window.saleCart.forEach(item => {
        cartTotal += item.price;
        combinedNamesArray.push(`${item.name} (x${item.qty})`);
    });

    const finalItemName = combinedNamesArray.join(', '); 
    const due = cartTotal - paid;
    const currentYear = document.getElementById('salesYearFilter').value;
    const student = students.find(s => s.id == sId);

    if (editId) {
        const index = salesDataArray.findIndex(s => s.id == editId);
        if(index > -1) {
            salesDataArray[index] = { ...salesDataArray[index], studentId: student.id, studentName: student.name, item: finalItemName, cart: [...window.saleCart], price: cartTotal, paid: paid, due: due };
        }
        window.addAccessoryDueToStudent(student.id, parseInt(editId), finalItemName, due); 
        Swal.fire({toast: true, position: 'top-end', icon: 'success', title: 'Sale Updated!', showConfirmButton: false, timer: 1500});
    } else {
        const newSaleId = Date.now();
        const saleData = {
            id: newSaleId, studentId: student.id, studentName: student.name, item: finalItemName, cart: [...window.saleCart], price: cartTotal, paid: paid, due: due, date: new Date().toISOString().split('T')[0]
        };
        salesDataArray.unshift(saleData);
        window.addAccessoryDueToStudent(student.id, newSaleId, finalItemName, due); 
        
        // 🟢 NEW: স্টক আপডেট এবং ০ হলে ডিলিট করার লজিক
        let stockUpdated = false;
        window.saleCart.forEach(cartItem => {
            const stockItem = window.stockInventory.find(i => i.name.toLowerCase() === cartItem.name.toLowerCase());
            if (stockItem && stockItem.qty >= cartItem.qty) {
                stockItem.qty -= cartItem.qty; 
                stockUpdated = true;
            }
        });
        
        if (stockUpdated) {
            // 🟢 যে আইটেমগুলোর স্টক ০ হয়ে গেছে, সেগুলোকে রিমুভ করা হচ্ছে
            window.stockInventory = window.stockInventory.filter(i => i.qty > 0);
            
            dbSet('stockData', window.stockInventory).catch(e=>console.log(e)); 
            window.renderStockTable(); 
            window.renderInventoryDropdown();
        }

        Swal.fire({toast: true, position: 'top-end', icon: 'success', title: 'Sale Completed!', showConfirmButton: false, timer: 1500});
        setTimeout(() => window.generateSalePDF(saleData, student), 500);
    }

    window.renderSalesUI();
    window.cancelSaleEdit();
    window.syncSalesToFirebase(currentYear);
};

window.cancelSaleEdit = function() {
    document.getElementById('saleStudentId').value = '';
    document.getElementById('saleSelectedName').textContent = '🔍 Click here to search student...';
    document.getElementById('saleSelectedName').style.color = 'var(--text-muted)';
    document.getElementById('saleSelectedPhoto').style.display = 'none';
    document.getElementById('itemName').value = '';
    document.getElementById('saleQty').value = '1'; 
    document.getElementById('itemPrice').value = '';
    document.getElementById('amountPaid').value = '';
    document.getElementById('editSaleId').value = '';
    window.currentUnitPrice = 0;
    window.saleCart = []; 
    window.renderCart();
    
    document.getElementById('saleProcessBtn').innerHTML = '<i class="fas fa-check-circle"></i> Checkout & Send Receipt';
    document.getElementById('saleProcessBtn').className = 'btn-primary';
    document.getElementById('saleCancelEditBtn').style.display = 'none';
};

window.editSaleRecord = function(saleId) {
    const sale = salesDataArray.find(s => s.id === saleId);
    if(!sale) return;
    
    const student = students.find(st => st.id == sale.studentId);
    if(student) window.selectStudentForSale(student.id, student.name, student.photo || 'https://via.placeholder.com/35?text=S');

    if (sale.cart && Array.isArray(sale.cart)) {
        window.saleCart = [...sale.cart];
    } else {
        let extractedName = sale.item; let extractedQty = 1;
        const match = sale.item.match(/(.*)\s+\(x(\d+)\)$/);
        if (match) { extractedName = match[1]; extractedQty = parseInt(match[2]); }
        window.saleCart = [{ name: extractedName, qty: extractedQty, price: sale.price }];
    }
    
    window.renderCart();
    document.getElementById('amountPaid').value = sale.paid;
    document.getElementById('editSaleId').value = sale.id;

    document.getElementById('saleProcessBtn').innerHTML = '<i class="fas fa-save"></i> Update Sale';
    document.getElementById('saleProcessBtn').className = 'btn-warning';
    document.getElementById('saleCancelEditBtn').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.generateSalePDF = async function(sale, student) {
    Swal.fire({ title: 'Generating Receipt...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    const { jsPDF } = window.jspdf;
    
    let estLines = 0;
    if (sale.cart && Array.isArray(sale.cart)) {
        sale.cart.forEach(item => { estLines += Math.ceil(item.name.length / 25); });
    } else {
        estLines = Math.ceil(sale.item.length / 25);
    }
    const pageHeight = Math.max(148, 120 + (estLines * 6)); 
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [105, pageHeight] });

    if (typeof instituteLogo !== 'undefined' && instituteLogo) {
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({ opacity: 0.08 }));
        doc.addImage(instituteLogo, 'JPEG', 12.5, (pageHeight/2)-40, 80, 80);
        doc.restoreGraphicsState();
    }

    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.rect(5, 5, 95, pageHeight - 10);
    let y = 15;

    if (typeof instituteLogo !== 'undefined' && instituteLogo) { doc.addImage(instituteLogo, 'JPEG', 42.5, 8, 20, 20); y = 32; }

    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    const titleLines = doc.splitTextToSize(typeof INSTITUTE_NAME !== 'undefined' ? INSTITUTE_NAME : 'Music Classes', 90);
    doc.text(titleLines, 52.5, y, {align: "center"});
    y += (titleLines.length * 5) + 2;

    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    // 🟢 এখানে CASH MEMO পরিবর্তন করে MONEY RECEIPT করা হয়েছে
    doc.text("ACCESSORIES MONEY RECEIPT", 52.5, y, {align: "center"});
    doc.setLineWidth(0.2); doc.line(25, y+1, 80, y+1); y += 8; 

    doc.setFontSize(9);
    doc.text(`Date:`, 12, y); doc.setFont("helvetica", "bold"); doc.text(`${new Date(sale.date).toLocaleDateString('en-IN')}`, 32, y); doc.setFont("helvetica", "normal"); y += 6;
    
    doc.text(`Student:`, 12, y); doc.setFont("helvetica", "bold"); 
    const nameLines = doc.splitTextToSize(student.name, 60);
    doc.text(nameLines, 32, y); 
    doc.setFont("helvetica", "normal"); 
    y += (nameLines.length * 4) + 4;

    doc.setFillColor(240, 240, 240);
    doc.rect(10, y, 85, 6, 'F');
    doc.setFont("helvetica", "bold");
    doc.text(`Item Name`, 12, y+4); doc.text(`Qty`, 65, y+4); doc.text(`Price`, 80, y+4);
    doc.setFont("helvetica", "normal");
    y += 10;

    if (sale.cart && Array.isArray(sale.cart)) {
        sale.cart.forEach(item => {
            const itemLines = doc.splitTextToSize(item.name, 50); 
            doc.text(itemLines, 12, y); 
            doc.text(`x${item.qty}`, 65, y); 
            doc.text(`Rs.${item.price}`, 80, y); 
            y += (itemLines.length * 4) + 3; 
        });
    } else {
        const itemLines = doc.splitTextToSize(sale.item, 50);
        doc.text(itemLines, 12, y); 
        doc.text(`Rs.${sale.price}`, 80, y); 
        y += (itemLines.length * 4) + 3;
    }
    
    doc.line(10, y, 95, y); y += 6;

    doc.setFont("helvetica", "bold");
    doc.text(`Grand Total:`, 48, y); doc.text(`Rs. ${sale.price}/-`, 75, y); y += 6;
    doc.setTextColor(0, 128, 0); 
    doc.text(`Paid Amount:`, 48, y); doc.text(`Rs. ${sale.paid}/-`, 75, y); doc.setTextColor(0); y += 6;

    if(sale.due > 0) {
        doc.setTextColor(200, 0, 0); doc.text(`Current Due:`, 48, y); doc.text(`Rs. ${sale.due}/-`, 75, y); doc.setTextColor(0);
        y += 6; 
    }
    y += 6;

    // Signature
    let sigBaseY = pageHeight - 10; // 🟢 'Authorized Signature' লেখাটির Y পজিশন
    if (typeof authorizedSignature !== 'undefined' && authorizedSignature) { 
        // 🟢 সিগনেচারের ছবিটি 'Authorized Signature' লেখাটির ঠিক উপরে (y পজিশন কমিয়ে) বসানো হলো
        doc.addImage(authorizedSignature, 'PNG', 55, sigBaseY - 12, 35, 10); 
    }
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text(`Authorized Signature`, 72, sigBaseY, {align:"center"});

    const safeItemName = sale.cart && sale.cart.length > 0 ? "Multiple_Items" : sale.item.replace(/\s+/g, '_');
    const fileName = `Money_Receipt_${safeItemName}.pdf`;
    
    window.tempSaleDoc = doc; window.tempSaleFileName = fileName;
    let cleanPhone = student.phone ? student.phone.replace(/[^0-9]/g, '') : '';
    if(cleanPhone.length === 10) cleanPhone = '91' + cleanPhone; window.tempSalePhone = cleanPhone;
    
    let itemsNamesWA = sale.cart ? sale.cart.map(i => `${i.name} (x${i.qty})`).join(', ') : sale.item;
    
    let dueMsg = sale.due > 0 ? `\nDue: ₹${sale.due}\n*Please clear your due amount of ₹${sale.due} as soon as possible.*` : '';
    // 🟢 মেসেজে "Money Receipt" লেখা যোগ করা হয়েছে
    window.tempSaleMsg = `Hello ${student.name},\nHere is your Money Receipt for *${itemsNamesWA}*.\nTotal: ₹${sale.price}\nPaid: ₹${sale.paid}${dueMsg}\n\nThank You!`;

    Swal.close();
    setTimeout(() => {
        Swal.fire({
            title: 'Receipt Generated!', icon: 'success',
            html: `
                <div style="display:flex; flex-direction:column; gap:12px; margin-top: 10px;">
                    <button onclick="window.shareSaleReceiptWA()" style="background:#25D366; color:white; border:none; padding:16px; border-radius:12px; font-size:16px; font-weight:bold; cursor:pointer; width:100%; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow: 0 4px 6px rgba(37,211,102,0.2);">
                        <i class="fab fa-whatsapp" style="font-size:20px;"></i> Share to WhatsApp
                    </button>
                    <button onclick="window.sendSaleReceiptSMS()" style="background:#f59e0b; color:white; border:none; padding:16px; border-radius:12px; font-size:16px; font-weight:bold; cursor:pointer; width:100%; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow: 0 4px 6px rgba(245,158,11,0.2);">
                        <i class="fas fa-sms" style="font-size:18px;"></i> Send SMS
                    </button>
                    <button onclick="window.downloadSaleReceiptOnly()" style="background:#64748b; color:white; border:none; padding:16px; border-radius:12px; font-size:16px; font-weight:bold; cursor:pointer; width:100%; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow: 0 4px 6px rgba(100,116,139,0.2);">
                        <i class="fas fa-download" style="font-size:18px;"></i> Download Only
                    </button>
                </div>
            `,
            showCloseButton: true, showConfirmButton: false, allowOutsideClick: false
        });
    }, 100);
};

window.sendSaleWhatsApp = async function(saleId) {
    const sale = salesDataArray.find(s => s.id === saleId);
    if(!sale) return;
    const student = students.find(st => st.id == sale.studentId);
    
    if(sale && student) {
        let cleanPhone = student.phone ? student.phone.replace(/[^0-9]/g, '') : '';
        if(cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
        let dueMsg = sale.due > 0 ? `\n*Current Due:* ₹${sale.due}\n*Please clear your due amount of ₹${sale.due} as soon as possible.*` : '';
        
        // 🟢 Srikanta Banerjee এর জায়গায় INSTITUTE_NAME বসানো হয়েছে
        const msg = `Hello ${student.name},\n\nThis is your Money Receipt for *${sale.item}*.\n\n*Total Price:* ₹${sale.price}\n*Amount Paid:* ₹${sale.paid}${dueMsg}\n\nRegards,\n*${INSTITUTE_NAME}*`;
        
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
};

window.sendSaleSMS = async function(saleId) {
    const sale = salesDataArray.find(s => s.id === saleId);
    if(!sale) return;
    const student = students.find(st => st.id == sale.studentId);
    
    if(sale && student) {
        let cleanPhone = student.phone ? student.phone.replace(/[^0-9]/g, '') : '';
        if (!cleanPhone) {
            Swal.fire('Error', 'Student phone number is missing!', 'error');
            return;
        }
        let dueMsg = sale.due > 0 ? `\nCurrent Due: Rs.${sale.due}\nPlease clear your due amount of Rs.${sale.due} as soon as possible.` : '';
        
        // 🟢 Srikanta Banerjee এর জায়গায় INSTITUTE_NAME বসানো হয়েছে
        const msg = `Hello ${student.name},\n\nThis is your Money Receipt for ${sale.item}.\n\nTotal Price: Rs.${sale.price}\nAmount Paid: Rs.${sale.paid}${dueMsg}\n\nRegards,\n${INSTITUTE_NAME}`;
        
        window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(msg)}`;
    }
};

window.resendSaleReceipt = async function(saleId) {
    const sale = salesDataArray.find(s => s.id === saleId);
    if(!sale) return;
    const student = students.find(st => st.id == sale.studentId);
    if(sale && student) window.generateSalePDF(sale, student);
};



window.shareSaleReceiptWA = async function() {
    const doc = window.tempSaleDoc;
    const fileName = window.tempSaleFileName;
    const msg = window.tempSaleMsg;
    const phone = window.tempSalePhone;

    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

    Swal.close();

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: 'Item Receipt', text: msg });
        } catch(e) {
            doc.save(fileName);
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
        }
    } else {
        doc.save(fileName);
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
};

window.downloadSaleReceiptOnly = function() {
    window.tempSaleDoc.save(window.tempSaleFileName);
    Swal.close();
};

// 🟢 NEW: Accessory Due Popup Function (Mobile Responsive & Fixed)
window.showSalesDuesPopup = function() {
    let dueRecords = salesDataArray.filter(s => s.due > 0);
    
    if (dueRecords.length === 0) {
        Swal.fire('No Dues', 'All accessory sales are fully paid!', 'success');
        return;
    }

    // 🟢 Container style আপডেট করা হয়েছে যাতে overflow ঠিক থাকে
    let listHtml = '<div style="max-height: 60vh; overflow-y: auto; text-align: left; padding: 5px;">';
    
    dueRecords.forEach(sale => {
        const student = students.find(st => st.id == sale.studentId);
        const photoSrc = student && student.photo ? student.photo : 'https://via.placeholder.com/50?text=S';
        const dateStr = new Date(sale.date).toLocaleDateString('en-IN');
        
        // 🟢 Mobile view ঠিক করার জন্য flex-direction এবং padding আপডেট করা হয়েছে
        listHtml += `
            <div style="background: var(--bg-input); padding: 15px; border-radius: 12px; margin-bottom: 12px; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                
                <div style="display: flex; align-items: center; gap: 15px;">
                    <img src="${photoSrc}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid #cbd5e1; flex-shrink: 0;">
                    <div style="flex-grow: 1; word-break: break-word;">
                        <div style="font-weight: 700; font-size: 15px; color: var(--text-main);">${sale.studentName}</div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                            <strong>Date:</strong> ${dateStr}
                        </div>
                    </div>
                </div>

                <div style="font-size: 13px; color: var(--text-main); line-height: 1.5; background: var(--bg-body); padding: 8px; border-radius: 8px;">
                    <strong>Item:</strong> <span style="color:#0284c7;">${sale.item}</span>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; background: #fff1f2; padding: 12px; border-radius: 8px; border: 1px dashed #fecaca;">
                    <div>
                        <div style="font-size: 11px; color: #be123c; font-weight: bold; text-transform: uppercase;">Total Due</div>
                        <div style="font-weight: 900; font-size: 18px; color: #e11d48;">₹${sale.due}</div>
                    </div>
                    <button onclick="Swal.close(); window.editSaleRecord(${sale.id});" style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(16,185,129,0.2);">
                        Pay Now
                    </button>
                </div>
            </div>
        `;
    });
    listHtml += '</div>';

    Swal.fire({
        title: 'Pending Accessory Dues',
        html: listHtml,
        showConfirmButton: true,
        confirmButtonText: 'Close',
        // 🟢 Close বাটনটি লাল করা হয়েছে
        confirmButtonColor: '#ef4444', 
        width: '95%',
        padding: '15px'
    });
};
window.processSale = processSale;
// 🟢 NEW: Smart Autocomplete for Cart Item Input
document.addEventListener('DOMContentLoaded', () => {
    const itemNameInput = document.getElementById('itemName');
    if (itemNameInput && !document.getElementById('itemSuggestions')) {
        itemNameInput.removeAttribute('list'); // আগের ডাটালিস্ট রিমুভ করা হলো
        
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.width = '100%';
        
        itemNameInput.parentNode.insertBefore(wrapper, itemNameInput);
        wrapper.appendChild(itemNameInput);
        
        const suggDiv = document.createElement('div');
        suggDiv.id = 'itemSuggestions';
        suggDiv.style.cssText = 'display:none; position:absolute; top:100%; left:0; width:100%; max-height:180px; overflow-y:auto; background:var(--bg-card); border:1px solid var(--border-color); border-radius:8px; z-index:1000; box-shadow:0 4px 10px rgba(0,0,0,0.15); margin-top:5px; text-align:left;';
        wrapper.appendChild(suggDiv);
        
        itemNameInput.addEventListener('input', function() {
            window.showItemSuggestions();
            window.autoFillItemPrice();
        });
        itemNameInput.addEventListener('focus', window.showItemSuggestions);
        
        document.addEventListener('click', (e) => {
            if(e.target !== itemNameInput) suggDiv.style.display = 'none';
        });
    }
});

window.showItemSuggestions = function() {
    const input = document.getElementById('itemName');
    const suggDiv = document.getElementById('itemSuggestions');
    if(!input || !suggDiv) return;
    
    const val = input.value.toLowerCase().trim();
    suggDiv.innerHTML = '';
    
    let matches = window.stockInventory;
    if (val) {
        matches = window.stockInventory.filter(i => i.name.toLowerCase().includes(val));
    }
    
    if (matches.length === 0) {
        suggDiv.style.display = 'none';
        return;
    }
    
    matches.forEach(item => {
        const div = document.createElement('div');
        const stockClr = item.qty <= 0 ? 'var(--danger)' : 'var(--text-muted)';
        div.style.cssText = 'padding: 12px; border-bottom: 1px solid var(--border-color); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: 0.2s;';
        div.innerHTML = `
            <span style="font-size: 13px; font-weight: 600; color: var(--text-main);">${item.name}</span> 
            <span style="color: ${stockClr}; font-size: 11px; font-weight: bold; background: var(--bg-body); padding: 2px 6px; border-radius: 4px;">Stock: ${item.qty}</span>
        `;
        div.onclick = function() {
            input.value = item.name;
            suggDiv.style.display = 'none';
            window.autoFillItemPrice(); // ক্লিক করার সাথে সাথে দাম বসে যাবে
        };
        suggDiv.appendChild(div);
    });
    suggDiv.style.display = 'block';
};

window.autoFillItemPrice = function() {
    const inputName = document.getElementById('itemName').value.trim();
    const item = window.stockInventory.find(i => i.name.toLowerCase() === inputName.toLowerCase());
    
    if (item) {
        window.currentUnitPrice = item.price; 
        window.updateSalePriceCalc(); 
    } else {
        window.currentUnitPrice = 0;
        document.getElementById('itemPrice').value = '';
    }
};
window.exportAllStudentsPDF = async function() {
    if (!students || students.length === 0) {
        Swal.fire('Info', 'No students available to export.', 'info');
        return;
    }

    Swal.fire({ title: 'Generating PDF...', text: 'Please wait...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let y = 20;

        // 🟢 PDF Header
        if (typeof instituteLogo !== 'undefined' && instituteLogo) {
            doc.addImage(instituteLogo, 'JPEG', 15, 10, 15, 15);
        }
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text(typeof INSTITUTE_NAME !== 'undefined' ? INSTITUTE_NAME : 'Music Classes', pageWidth/2, 18, {align: "center"});
        
        doc.setFontSize(12);
        doc.setTextColor(80);
        doc.text("Complete Student Directory", pageWidth/2, 25, {align: "center"});
        
        doc.setDrawColor(200);
        doc.setLineWidth(0.5);
        doc.line(15, 30, pageWidth-15, 30);
        y = 40;

        // 🟢 Student Row Drawing Function (Updated with Address)
        const drawStudentRow = (s, isActive) => {
            if (y > pageHeight - 35) { // পেজ শেষ হলে নতুন পেজ নেবে
                doc.addPage();
                y = 20;
            }
            
            // Student Photo
            if (s.photo) {
                try {
                    doc.addImage(s.photo, 'JPEG', 15, y, 18, 18);
                    doc.setDrawColor(0);
                    doc.setLineWidth(0.3);
                    doc.rect(15, y, 18, 18);
                } catch(e) {
                    doc.setDrawColor(200); doc.setFillColor(240); doc.rect(15, y, 18, 18, 'FD');
                }
            } else {
                doc.setDrawColor(200); doc.setFillColor(240); doc.rect(15, y, 18, 18, 'FD');
                doc.setFontSize(8); doc.setTextColor(150); doc.text("No Pic", 24, y + 10, {align:'center'});
            }

            // Student Details
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0);
            doc.text(`${s.name} (ID: ${s.serial_no})`, 38, y + 4);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(80);
            doc.text(`Class: ${s.class || 'N/A'}  |  Phone: ${s.phone || 'N/A'}`, 38, y + 9);
            
            let joinDate = s.joining_date ? new Date(s.joining_date).toLocaleDateString('en-IN') : 'N/A';
            doc.text(`Joined: ${joinDate}  |  Fee: Rs. ${s.fee_amount || 0}`, 38, y + 14);

            // 🟢 NEW: Address Added Here
            let addressText = s.address ? s.address : 'N/A';
            // ঠিকানা খুব বড় হলে কেটে ছোট করে দেবে যাতে ডিজাইন নষ্ট না হয়
            if (addressText.length > 60) addressText = addressText.substring(0, 60) + '...'; 
            doc.text(`Address: ${addressText}`, 38, y + 19);

            // Active/Inactive Badge
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            if (isActive) {
                doc.setTextColor(16, 185, 129); // Green
                doc.text("ACTIVE", pageWidth - 15, y + 9, {align: "right"});
            } else {
                doc.setTextColor(239, 68, 68); // Red
                doc.text("INACTIVE", pageWidth - 15, y + 9, {align: "right"});
            }
            
            // Bottom line for row
            doc.setDrawColor(230);
            doc.setLineWidth(0.2);
            doc.line(15, y + 24, pageWidth-15, y + 24);
            
            y += 29; // পরের স্টুডেন্টের জন্য গ্যাপ বাড়ানো হলো
        };

        // 🟢 Separate Active and Inactive Students
        const activeStudents = students.filter(s => window.isStudentCurrentlyActive(s)).sort((a,b) => a.name.localeCompare(b.name));
        const inactiveStudents = students.filter(s => !window.isStudentCurrentlyActive(s)).sort((a,b) => a.name.localeCompare(b.name));

        // 🟢 Draw Active Students
        if (activeStudents.length > 0) {
            doc.setFontSize(13);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(16, 185, 129);
            doc.text(`Active Students (${activeStudents.length})`, 15, y);
            y += 8;
            activeStudents.forEach(s => drawStudentRow(s, true));
        }

        // 🟢 Draw Inactive Students
        if (inactiveStudents.length > 0) {
            y += 5;
            if (y > pageHeight - 30) { doc.addPage(); y = 20; }
            doc.setFontSize(13);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(239, 68, 68);
            doc.text(`Inactive Students (${inactiveStudents.length})`, 15, y);
            y += 8;
            inactiveStudents.forEach(s => drawStudentRow(s, false));
        }

        // 🟢 Page Footer
        const pageCount = doc.getNumberOfPages();
        for(let i=1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.setFont("helvetica", "normal");
            doc.text(`Page ${i} of ${pageCount}  |  Generated on: ${new Date().toLocaleDateString('en-IN')}`, pageWidth/2, pageHeight - 10, {align: 'center'});
        }

        doc.save(`Student_Directory_${new Date().toISOString().split('T')[0]}.pdf`);
        Swal.close();

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'Failed to generate PDF. Check console for details.', 'error');
    }
};
