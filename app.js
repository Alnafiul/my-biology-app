import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, setDoc, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCBXZwXKgN7aJglLxJaKPE4l7ehLTJO_jM",
    authDomain: "microbilogy-hub.firebaseapp.com",
    projectId: "microbilogy-hub",
    storageBucket: "microbilogy-hub.firebasestorage.app",
    messagingSenderId: "97322008506",
    appId: "1:97322008506:web:e1ef46ddf6ecbc2095a783"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
window.db = db; // 👈 এই লাইনটি ম্যাজিকের মতো কাজ করবে!

let currentUserName = "";
let currentUserRole = "Student";
let currentUserAvatar = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
let currentUserBalance = 0;
let currentUserFullData = {};
let mainNavigationMode = "all-feed";
let currentSubFilter = "All";
let dbPostsCache = [];
let allUsersGlobalList = [];
let base64PostImage = "";
let base64ProfileImage = "";
let selectedPlanType = "";

function timeAgo(timestamp) {
    if (!timestamp) return "Just now";
    const now = new Date();
    let postDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((now - postDate) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

// Theme Config
const themeSwitch = document.getElementById('themeSwitch');
if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeSwitch.checked = true;
}
themeSwitch.addEventListener('change', function() {
    document.documentElement.setAttribute('data-theme', this.checked ? 'dark' : 'light');
    localStorage.setItem('theme', this.checked ? 'dark' : 'light');
});

// Logout Action
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => {
        localStorage.removeItem('isLoggedIn');
        window.location.href = 'auth.html';
    });
});

// Auth Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserName = user.displayName || "Anonymous";
        onSnapshot(doc(db, "users", user.uid), (userDoc) => {
            if (userDoc.exists()) {
                currentUserFullData = userDoc.data();
                currentUserRole = currentUserFullData.role || "Student";
                currentUserAvatar = currentUserFullData.avatarUrl || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
                currentUserBalance = currentUserFullData.balance || 0;
                renderEngine();
            }
        });
    }
});

// Post Image Attachment Reader
document.getElementById('postFileSelect').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = function() {
            base64PostImage = reader.result;
            document.getElementById('filePreviewText').style.display = 'block';
        }
        reader.readAsDataURL(file);
    }
});

// Load Users Database
onSnapshot(collection(db, "users"), (snapshot) => {
    let teachersList = [];
    let studentsList = [];
    allUsersGlobalList = [];

    snapshot.forEach(doc => {
        const data = doc.data();
        const userObj = { 
            uid: doc.id,
            name: data.name || "Anonymous", 
            rating: data.totalRating || 0, 
            avatar: data.avatarUrl || "https://cdn-icons-png.flaticon.com/512/149/149071.png", 
            role: data.role || "Student",
            institution: data.institution || data.school || "N/A",
            department: data.department || "N/A",
            designation: data.designation || "N/A",
            bio: data.bio || "No bio added."
        };
        allUsersGlobalList.push(userObj);
        if (userObj.role === 'Teacher') teachersList.push(userObj);
        else studentsList.push(userObj);
    });

    teachersList.sort((a, b) => b.rating - a.rating);
    studentsList.sort((a, b) => b.rating - a.rating);

    // Leaderboards Render
    const tContainer = document.getElementById('teachersLeaderboard');
    if(tContainer) {
        tContainer.innerHTML = '';
        teachersList.slice(0, 3).forEach((user, index) => {
            tContainer.innerHTML += `
                <div class="leaderboard-item">
                    <div class="leaderboard-rank">#${index + 1}</div>
                    <div class="leaderboard-info">
                        <img src="${user.avatar}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;">
                        <div class="leaderboard-name" title="${user.name}">${user.name}</div>
                    </div>
                    <div class="leaderboard-score">🔺${user.rating}</div>
                </div>`;
        });
    }

    const sContainer = document.getElementById('studentsLeaderboard');
    if(sContainer) {
        sContainer.innerHTML = '';
        studentsList.slice(0, 3).forEach((user, index) => {
            sContainer.innerHTML += `
                <div class="leaderboard-item">
                    <div class="leaderboard-rank">#${index + 1}</div>
                    <div class="leaderboard-info">
                        <img src="${user.avatar}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;">
                        <div class="leaderboard-name" title="${user.name}">${user.name}</div>
                    </div>
                    <div class="leaderboard-score">🔺${user.rating}</div>
                </div>`;
        });
    }
});

// Post Submit Event
document.getElementById('postForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const type = document.getElementById('postType').value;
        await addDoc(collection(db, "posts"), {
            type: type,
            author: currentUserName,
            authorUid: auth.currentUser.uid,
            authorAvatar: currentUserAvatar,
            role: currentUserRole,
            title: document.getElementById('postTitle').value,
            content: document.getElementById('postContent').value,
            imageUrl: base64PostImage, 
            rating: 0,
            price: type === "Note" ? 50 : 0, 
            upvotedBy: [],
            buyers: [],
            answers: [],
            timestamp: new Date()
        });
        
        document.getElementById('postTitle').value = '';
        document.getElementById('postContent').value = '';
        document.getElementById('postFileSelect').value = '';
        base64PostImage = "";
        document.getElementById('filePreviewText').style.display = 'none';
        alert("Published successfully!");
    } catch (err) { alert(err.message); }
});

// Posts Loader Stream
onSnapshot(query(collection(db, "posts"), orderBy("timestamp", "desc")), (snapshot) => {
    dbPostsCache = [];
    snapshot.forEach(doc => dbPostsCache.push({ id: doc.id, ...doc.data() }));
    renderEngine();
});

// Payment Modal Popups
window.openPaymentModal = function(plan) {
    selectedPlanType = plan;
    document.getElementById('paymentModalTitle').innerText = `Activate ${plan} Premium Plan`;
    document.getElementById('paymentModalOverlay').style.display = 'flex';
}
window.closePaymentModal = function() {
    document.getElementById('paymentModalOverlay').style.display = 'none';
    document.getElementById('trxIdInput').value = '';
}

document.getElementById('confirmPaymentBtn').addEventListener('click', async () => {
    const trxId = document.getElementById('trxIdInput').value.trim();
    if (!trxId) return alert("Please enter the Transaction ID (TrxID).");
    if (!auth.currentUser) return;

    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            membershipStatus: "Waiting",
            requestedPlan: selectedPlanType
        });
        await setDoc(doc(db, "membership_requests", auth.currentUser.uid), {
            uid: auth.currentUser.uid,
            name: currentUserName,
            plan: selectedPlanType,
            price: selectedPlanType === "Monthly" ? 150 : 1200,
            trxId: trxId,
            status: "Pending",
            timestamp: new Date()
        });
        alert("পেমেন্ট তথ্য এডমিন প্যানেলে পাঠানো হয়েছে। ধন্যবাদ!");
        closePaymentModal();
    } catch(err) { alert(err.message); }
});

function checkStudentAccess() {
    if (currentUserRole !== 'Student') return { hasAccess: true, isPremium: false };
    const currentStatus = currentUserFullData.membershipStatus || "Free";
    if (currentStatus === "Active") return { hasAccess: true, isPremium: true, planType: currentUserFullData.activePlan || "Premium" };
    if (currentStatus === "Waiting") return { hasAccess: true, isWaiting: true, planType: currentUserFullData.requestedPlan || "Premium" };

    const regDate = currentUserFullData.createdAt ? new Date(currentUserFullData.createdAt.seconds * 1000) : new Date();
    const diffDays = Math.ceil(Math.abs(new Date() - regDate) / (1000 * 60 * 60 * 24));
    if (diffDays > 90) return { hasAccess: false, isPremium: false };
    return { hasAccess: true, daysLeft: Math.max(0, 90 - diffDays), isPremium: false };
}

window.switchNavMode = function(mode, element) {
    mainNavigationMode = mode;
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
    if(element) element.classList.add('active');
    
    const titleMap = {
        'all-feed': 'Home Feed', 'membership-page': 'Premium Membership', 'teacher-list': 'Our Verified Teachers',
        'my-overview': 'My Q&A Overview', 'my-profile-page': 'My Profile Setup', 'wallet-page': 'Wallet & Withdraw Panel'
    };
    document.getElementById('feedTitle').innerText = titleMap[mode] || 'BioHub';
    document.getElementById('topFilterTabs').style.display = (mode === 'all-feed') ? 'flex' : 'none';
    renderEngine();
}

window.filterCategory = function(cat) {
    currentSubFilter = cat;
    document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    renderEngine();
}

// Profile Save Engine Logic
async function handleProfileSave(e) {
    e.preventDefault();
    if(!auth.currentUser) return;
    const updatePayload = {
        name: document.getElementById('pFormName').value,
        bio: document.getElementById('pFormBio').value,
        department: document.getElementById('pFormDept').value,
    };
    if (base64ProfileImage) updatePayload.avatarUrl = base64ProfileImage;

    if (currentUserRole === 'Teacher') {
        updatePayload.designation = document.getElementById('pFormDesig').value;
        updatePayload.institution = document.getElementById('pFormInst').value;
    } else {
        updatePayload.school = document.getElementById('pFormSchool').value;
    }

    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), updatePayload);
        alert("Profile updated successfully!");
    } catch(err) { alert(err.message); }
}

// Withdraw Request Submission
async function handleWithdrawSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('wAmountInput').value);
    const method = document.getElementById('wMethodSelect').value;
    const number = document.getElementById('wNumberInput').value.trim();

    if (amount < 200) return alert("সর্বনিম্ন ২০০ টাকা না হলে উইথড্র করা সম্ভব নয়।");
    if (amount > currentUserBalance) return alert("আপনার ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই।");

    const adminFee = amount * 0.30;
    const userPayout = amount - adminFee;

    try {
        // ১. ব্যালেন্স হোল্ড করে দেওয়া ও স্ট্যাটাস ওয়েটিং করা
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            balance: currentUserBalance - amount,
            withdrawStatus: "Waiting"
        });

        // ২. রিকোয়েস্ট তৈরি করা
        await addDoc(collection(db, "withdraw_requests"), {
            uid: auth.currentUser.uid,
            name: currentUserName,
            role: currentUserRole,
            totalRequested: amount,
            adminFee30: adminFee,
            payableAmount: userPayout,
            paymentMethod: method,
            targetNumber: number,
            status: "Pending",
            timestamp: new Date()
        });

        alert("আপনার উইথড্র রিকোয়েস্টটি সফলভাবে পাঠানো হয়েছে। অ্যাডমিন অ্যাপ্রুভ করলে টাকা পেয়ে যাবেন।");
        renderEngine();
    } catch(err) { alert(err.message); }
}

// ==========================================
// CORE SYSTEM APP RENDER CONTROLLER
// ==========================================
function renderEngine() {
    const container = document.getElementById('posts-container');
    if(!container) return;
    container.innerHTML = '';

    const accessStatus = checkStudentAccess();

    // 1. Profile Page Interface Screen
    if (mainNavigationMode === "my-profile-page") {
        const pBox = document.createElement('div');
        pBox.classList.add('inner-page-box');
        
        let dynamicInputs = "";
        if (currentUserRole === 'Teacher') {
            dynamicInputs = `
                <div class="form-control"><label>Designation</label><input type="text" id="pFormDesig" value="${currentUserFullData.designation || ''}" placeholder="e.g. Lecturer"></div>
                <div class="form-control"><label>Institution / University Name</label><input type="text" id="pFormInst" value="${currentUserFullData.institution || ''}" placeholder="e.g. Dhaka University"></div>`;
        } else {
            dynamicInputs = `
                <div class="form-control"><label>School / College Name</label><input type="text" id="pFormSchool" value="${currentUserFullData.school || ''}" placeholder="e.g. Notre Dame College"></div>`;
        }

        pBox.innerHTML = `
            <form id="profileFormSetup">
                <div class="p-page-avatar-wrap">
                    <img src="${currentUserAvatar}" id="profilePageAvatar" class="p-page-avatar">
                    <label for="pAvatarSelector" class="p-page-upload-btn">📷</label>
                    <input type="file" id="pAvatarSelector" accept="image/*" style="display:none;">
                </div>
                <div style="text-align:center; margin-bottom: 20px; font-weight:bold; color:var(--accent-color);">🔺 Total Rating: ${currentUserFullData.totalRating || 0}</div>
                <div class="form-control"><label>Full Name</label><input type="text" id="pFormName" value="${currentUserFullData.name || ''}" required></div>
                <div class="form-control"><label>Department</label><input type="text" id="pFormDept" value="${currentUserFullData.department || ''}" placeholder="e.g. Microbiology"></div>
                ${dynamicInputs}
                <div class="form-control"><label>Short Bio</label><textarea id="pFormBio" rows="3">${currentUserFullData.bio || ''}</textarea></div>
                <button type="submit" class="submit-btn" style="margin-top:10px;">Save Profile Updates</button>
            </form>`;
        
        container.appendChild(pBox);
        
        document.getElementById('profileFormSetup').addEventListener('submit', handleProfileSave);
        document.getElementById('pAvatarSelector').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onloadend = function() {
                    base64ProfileImage = reader.result;
                    document.getElementById('profilePageAvatar').src = reader.result;
                }
                reader.readAsDataURL(file);
            }
        });
        return;
    }

    // 2. Wallet & Withdraw Panel System Screen
    if (mainNavigationMode === "wallet-page") {
        const walletBox = document.createElement('div');
        walletBox.classList.add('inner-page-box');
        
        const currentWStatus = currentUserFullData.withdrawStatus || "None";
        let buttonStateText = "Submit Payout Request";
        let isButtonDisabled = false;

        if (currentWStatus === "Waiting") {
            buttonStateText = "⏳ Waiting for Admin Approval";
            isButtonDisabled = true;
        }

        walletBox.innerHTML = `
            <div class="wallet-banner">
                <div style="font-size:14px; opacity:0.9;">Total Unpaid Earnings Balance</div>
                <div class="wallet-banner-bal">৳${currentUserBalance.toFixed(2)}</div>
                <div style="font-size:11px; opacity:0.8;">Minimum Withdrawal: ৳২০০ | Admin Charge Fee: ৩০%</div>
            </div>

            <div class="p-numbers" style="background: rgba(0, 128, 128, 0.05); border-left-color: var(--accent-color);">
                <p>🏦 <strong>Admin bKash Number:</strong> 01829167126 (Personal)</p>
                <p>🏦 <strong>Admin Nagad Number:</strong> 01708711771 (Personal)</p>
                <p style="font-size:12px; margin-top:8px; color:var(--secondary-text); font-weight:normal;">নোট: উইথড্র রিকোয়েস্ট সাবমিট করার পর এডমিন ভেরিফিকেশন সাপেক্ষে আপনার প্রদত্ত নাম্বারে ৩০% ফি কেটে বাকি টাকা পাঠিয়ে দেওয়া হবে।</p>
            </div>

            <form id="withdrawRequestForm" style="margin-top:20px;">
                <div class="form-control">
                    <label>Withdraw Amount (TK)</label>
                    <input type="number" id="wAmountInput" min="200" placeholder="e.g. 250" required ${isButtonDisabled ? 'disabled' : ''}>
                </div>
                <div class="w-calc-box">
                    <div class="w-calc-row"><span>Admin Charge Fee (30%):</span><span id="calcFee">৳0.00</span></div>
                    <div class="w-calc-row" style="font-weight:bold; color:#2e7d32;"><span>Net Payable Amount:</span><span id="calcNet">৳0.00</span></div>
                </div>
                <div class="form-control">
                    <label>Select Payment Gateway</label>
                    <select id="wMethodSelect" required ${isButtonDisabled ? 'disabled' : ''}>
                        <option value="bKash">bKash Personal</option>
                        <option value="Nagad">Nagad Personal</option>
                    </select>
                </div>
                <div class="form-control">
                    <label>Your Account Mobile Number</label>
                    <input type="text" id="wNumberInput" placeholder="01XXXXXXXXX" required ${isButtonDisabled ? 'disabled' : ''}>
                </div>
                <button type="submit" class="submit-btn" style="border-radius:8px; background:#2e7d32;" ${isButtonDisabled ? 'disabled' : ''}>${buttonStateText}</button>
            </form>`;
        
        container.appendChild(walletBox);

        if(!isButtonDisabled) {
            document.getElementById('withdrawRequestForm').addEventListener('submit', handleWithdrawSubmit);
            document.getElementById('wAmountInput').addEventListener('input', function() {
                const val = parseFloat(this.value) || 0;
                const fee = val * 0.30;
                const net = val - fee;
                document.getElementById('calcFee').innerText = `৳${fee.toFixed(2)}`;
                document.getElementById('calcNet').innerText = `৳${net > 0 ? net.toFixed(2) : '0.00'}`;
            });
        }
        return;
    }

    // 3. Premium Membership View Plan Page
    if (mainNavigationMode === "membership-page") {
        if (currentUserRole === "Teacher") {
            container.innerHTML = `
                <div class="inner-page-box" style="text-align:center; border-color:#d32f2f;">
                    <h3 style="color:#d32f2f;">🚫 অ্যাক্সেস নেই</h3>
                    <p style="margin-top:10px; color:var(--secondary-text);">মেম্বারশিপ প্ল্যানগুলো শুধুমাত্র স্টুডেন্টদের জন্য। শিক্ষকরা আজীবন সম্পূর্ণ ফ্রিতে BioHub ব্যবহার করতে পারবেন।</p>
                </div>`;
            return;
        }

        const membershipPage = document.createElement('div');
        membershipPage.classList.add('membership-container');
        
        let statusNotice = "";
        if (accessStatus.isPremium) {
            statusNotice = `<div class="w-notice-box" style="border-left-color:#2e7d32; background:rgba(46,125,50,0.05); color:#2e7d32; text-align:center; font-weight:bold;">🎉 আপনার ${accessStatus.planType} Premium Plan-টি সফলভাবে সচল রয়েছে!</div>`;
        } else if (accessStatus.isWaiting) {
            statusNotice = `<div class="w-notice-box" style="border-left-color:#ff9800; background:rgba(255,152,0,0.05); color:#ff9800; text-align:center; font-weight:bold;">⏳ আপনার পেমেন্ট তথ্য এডমিন ভেরিফিকেশনের অপেক্ষায় আছে (${accessStatus.planType} Plan)। কিছুক্ষণের মধ্যেই চালু হবে।</div>`;
        } else if (accessStatus.hasAccess) {
            statusNotice = `<div class="w-notice-box" style="border-left-color:#0288d1; background:rgba(2,136,209,0.05); color:#0288d1;">⏳ আপনি এখন ৩ মাসের ফ্রি স্টুডেন্ট ট্রায়ালে আছেন। (আর ${accessStatus.daysLeft} দিন বাকি আছে)। ফিচার আনলিমিটেড করতে যেকোনো প্ল্যান বেছে নিন!</div>`;
        } else {
            statusNotice = `<div class="w-notice-box" style="border-left-color:#d32f2f; background:rgba(211,47,47,0.05); color:#d32f2f;">🚨 আপনার ফ্রি ট্রায়াল শেষ হয়েছে! BioHub ব্যবহার চালিয়ে যেতে নিচে থেকে একটি প্রিমিয়াম প্ল্যান অ্যাক্টিভ করুন।</div>`;
        }

        let monthlyBtnHtml = `<button class="member-btn" onclick="openPaymentModal('Monthly')">Subscribe Now</button>`;
        let yearlyBtnHtml = `<button class="member-btn premium-btn" onclick="openPaymentModal('Yearly')">Subscribe Now</button>`;

        if (accessStatus.isWaiting) {
            if (accessStatus.planType === "Monthly") monthlyBtnHtml = `<button class="member-btn" style="background:#ff9800;" disabled>Waiting for Approval</button>`;
            if (accessStatus.planType === "Yearly") yearlyBtnHtml = `<button class="member-btn" style="background:#ff9800;" disabled>Waiting for Approval</button>`;
        } else if (accessStatus.isPremium) {
            if (accessStatus.planType === "Monthly") monthlyBtnHtml = `<button class="member-btn" style="background:#2e7d32;" disabled>Premium Active</button>`;
            if (accessStatus.planType === "Yearly") yearlyBtnHtml = `<button class="member-btn" style="background:#2e7d32;" disabled>Premium Active</button>`;
        }

        membershipPage.innerHTML = `
            ${statusNotice}
            <div style="display:flex; gap:20px; flex-wrap:wrap; margin-top:20px; justify-content:center;">
                <div class="member-card ${accessStatus.planType === 'Monthly' ? 'active-plan' : ''}">
                    <div>
                        <div class="member-title">Monthly Plan</div>
                        <div class="member-price">৳১৫০ <span style="font-size:14px; font-weight:normal;">/ মাস</span></div>
                        <ul class="member-features">
                            <li>✅ ৩টি প্রিমিয়াম নোট একদম ফ্রিতে দেখতে/কিনতে পারবেন।</li>
                            <li>✅ যেকোনো নির্দিষ্ট শিক্ষক (Specific Teacher) থেকে পুরো মাসজুড়ে উত্তর নিতে পারবেন।</li>
                            <li>✅ সকল সাধারণ প্রশ্নোত্তর ও ফিডে ফুল অ্যাক্সেস।</li>
                        </ul>
                    </div>
                    ${monthlyBtnHtml}
                </div>

                <div class="member-card premium ${accessStatus.planType === 'Yearly' ? 'active-plan' : ''}">
                    <div class="member-badge">BEST VALUE</div>
                    <div>
                        <div class="member-title">Yearly Plan</div>
                        <div class="member-price">৳১২০০ <span style="font-size:14px; font-weight:normal;">/ বছর</span></div>
                        <ul class="member-features">
                            <li>✅ <b>আনলিমিটেড:</b> পুরো বছর যেকোনো প্রিমিয়াম নোট ফ্রিতে দেখতে পারবেন।</li>
                            <li>✅ <b>ফুল সাপোর্ট:</b> নির্দিষ্ট শিক্ষকদের থেকে পুরো বছরজুড়ে আনলিমিটেড উত্তর নিতে পারবেন।</li>
                            <li>✅ ২৪/৭ হেল্পডেস্ক ও প্রায়োরিটি মেম্বারশিপ সুবিধা।</li>
                        </ul>
                    </div>
                    ${yearlyBtnHtml}
                </div>
            </div>`;
        container.appendChild(membershipPage);
        return;
    }

    // 4. Teachers Grid View List Page
    if (mainNavigationMode === "teacher-list") {
        const grid = document.createElement('div');
        grid.classList.add('teacher-grid');
        const teachersOnly = allUsersGlobalList.filter(u => u.role === 'Teacher');
        
        if(teachersOnly.length === 0) {
            grid.innerHTML = `<p style="text-align:center; color:var(--secondary-text); width:100%;">No teachers registered yet.</p>`;
        }
        teachersOnly.forEach(t => {
            grid.innerHTML += `
                <div class="t-card" onclick="openTeacherModal('${t.uid}')">
                    <img src="${t.avatar}" class="t-card-img">
                    <div class="t-card-name">${t.name}</div>
                    <div class="t-card-sub">${t.designation}</div>
                    <div style="font-size:11px; color:var(--accent-color); font-weight:bold;">🔺 Rating: ${t.rating}</div>
                </div>`;
        });
        container.appendChild(grid);
        return;
    }

    // Trial or Sub Expiry Block Protect Control
    if (!accessStatus.hasAccess && !accessStatus.isPremium) {
        container.innerHTML = `
            <div class="inner-page-box" style="text-align:center; border-color:#d32f2f; margin-top:30px;">
                <h3 style="color:#d32f2f;">🔒 অ্যাক্সেস ব্লকড!</h3>
                <p style="margin-top:10px; color:var(--secondary-text); font-size:14px; line-height:1.5;">আপনার ৩ মাসের ফ্রি ট্রায়াল শেষ হয়ে গেছে। পোস্ট দেখতে বা নোট পড়তে মেম্বারশিপ প্ল্যান সক্রিয় করুন।</p>
                <button class="submit-btn" style="width:180px; margin-top:15px;" onclick="switchNavMode('membership-page')">💎 Upgrade to Premium</button>
            </div>`;
        return;
    }

    // 5. Main Home Feed Post Controller
    if (mainNavigationMode === "all-feed") {
        let filteredPosts = dbPostsCache;
        if (currentSubFilter !== 'All') filteredPosts = dbPostsCache.filter(p => p.type === currentSubFilter);

        if (filteredPosts.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: var(--secondary-text); margin-top: 40px;">No posts found in this category.</p>`;
            return;
        }

        filteredPosts.forEach(post => {
            let mediaHtml = post.imageUrl ? `<div class="post-media-box"><img src="${post.imageUrl}" class="post-media-img"></div>` : "";
            let badgeColor = post.type === 'Question' ? '#e1f5fe' : post.type === 'Note' ? '#fff3e0' : '#e8f5e9';
            let badgeTextCol = post.type === 'Question' ? '#0288d1' : post.type === 'Note' ? '#e65100' : '#2e7d32';

            container.innerHTML += `
                <div class="post-card">
                    <span class="post-tag" style="background:${badgeColor}; color:${badgeTextCol};">${post.type}</span>
                    <div class="user-meta-block">
                        <img src="${post.authorAvatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="user-meta-avatar" onclick="openTeacherModal('${post.authorUid}')">
                        <div class="user-meta-info">
                            <div class="user-meta-top">
                                <span class="user-meta-name" onclick="openTeacherModal('${post.authorUid}')">${post.author}</span>
                                <span style="font-size:10px; background:var(--hover-bg); padding:1px 5px; border-radius:3px;">${post.role}</span>
                            </div>
                            <span class="user-meta-sub">BioHub Verified Contributor</span>
                        </div>
                        <div class="time-badge">${timeAgo(post.timestamp)}</div>
                    </div>
                    <div class="post-title">${post.title}</div>
                    <div class="post-desc">${post.content}</div>
                    ${mediaHtml}
                </div>`;
        });
        return;
    }
}

window.openTeacherModal = function(uid) {
    const user = allUsersGlobalList.find(u => u.uid === uid);
    if(user) {
        document.getElementById('mAvatar').src = user.avatar;
        document.getElementById('mName').innerText = user.name;
        document.getElementById('mRole').innerText = user.role;
        document.getElementById('mRating').innerText = user.rating;
        document.getElementById('mBio').innerText = user.bio;

        const dynFields = document.getElementById('modalDynamicFields');
        if(user.role === 'Teacher') {
            dynFields.innerHTML = `
                <div class="modal-info-row"><b>📌 Institution:</b> <span>${user.institution}</span></div>
                <div class="modal-info-row"><b>🧬 Department:</b> <span>${user.department}</span></div>
                <div class="modal-info-row"><b>🎓 Designation:</b> <span>${user.designation}</span></div>`;
        } else {
            dynFields.innerHTML = `
                <div class="modal-info-row"><b>🏫 School/College:</b> <span>${user.institution}</span></div>
                <div class="modal-info-row"><b>🧬 Department:</b> <span>${user.department}</span></div>`;
        }

        document.getElementById('profileModal').style.display = 'flex';
    }
}

window.closeProfileModal = function(e) {
    if(e.target === document.getElementById('profileModal')) {
        document.getElementById('profileModal').style.display = 'none';
    }
}
// --- 🔍 আলটিমেট সার্চ ফাংশন (১০০% সলভড) ---
window.searchNotes = async function() {
    // ১. ইনপুট ফিল্ড থেকে লেখাটি নিয়ে ছোট হাতের অক্ষরে কনভার্ট করা হলো
    const searchText = document.getElementById('homeSearchInput').value.trim().toLowerCase();
    const postsContainer = document.getElementById('posts-container');
    
    if (searchText === "") {
        alert("অনুগ্রহ করে কিছু লিখে সার্চ করুন!");
        return;
    }

    postsContainer.innerHTML = `<p style="text-align: center; color: var(--secondary-text); margin-top: 30px;">🔍 Searching...</p>`;

    try {
        // ২. মডিউল স্কোপের ঝামেলা এড়াতে সরাসরি ফায়ারস্টোর মেথড ইমপোর্ট করা হলো
        const { getFirestore, collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const currentDb = getFirestore();
        const postsRef = collection(currentDb, "posts");
        
        // ৩. ফায়ারবেস থেকে সব পোস্ট রিড করা
        const querySnapshot = await getDocs(postsRef);
        postsContainer.innerHTML = ""; 
        let hasResults = false;

        querySnapshot.forEach((doc) => {
            const post = doc.data();
            const postTitle = (post.title || "").toLowerCase();
            const postContent = (post.content || "").toLowerCase();

            // ৪. ছোট-বড় অক্ষর মিলিয়ে টাইটেল বা কন্টেন্টে মিল থাকলে রেজাল্ট শো করবে
            if (postTitle.includes(searchText) || postContent.includes(searchText)) {
                hasResults = true;
                
                // ৫. ডাইনামিক পোস্ট রেন্ডারিং কার্ড (ডার্ক/লাইট মোড সাপোর্টেড)
                postsContainer.innerHTML += `
                    <div class="post-card" style="background: var(--card-bg, #1e293b); padding: 20px; margin-bottom: 15px; border-radius: 12px; border: 1px solid var(--border-color, #334155); text-align: left;">
                        <div style="display:flex; align-items:center; margin-bottom:12px;">
                            <span style="background: var(--primary-color, #007bff); color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; text-transform: uppercase;">${post.type || 'Post'}</span>
                        </div>
                        <h3 style="margin-top: 5px; color: var(--text-color, #f8fafc); font-size: 18px; font-weight: 600;">${post.title}</h3>
                        <p style="color: var(--secondary-text, #94a3b8); font-size: 14px; margin-top: 10px; line-height: 1.5; white-space: pre-wrap;">${post.content}</p>
                    </div>
                `;
            }
        });

        // যদি কোনো পোস্ট ম্যাচ না করে
        if (!hasResults) {
            postsContainer.innerHTML = `
                <div style="text-align:center; padding: 50px 20px; color: var(--secondary-text);">
                    <p style="font-size: 16px; font-weight: 500;">❌ "${searchText}" নামে কোনো পোস্ট খুঁজে পাওয়া যায়নি!</p>
                    <button onclick="location.reload()" style="background:var(--primary-color, #007bff); color:white; border:none; padding:10px 20px; border-radius:30px; margin-top:15px; font-weight: bold; cursor:pointer;">Show All Posts</button>
                </div>`;
        }

    } catch (error) {
        console.error("Search Error: ", error);
        postsContainer.innerHTML = `<p style="text-align: center; color: red; margin-top: 20px;">Something went wrong!</p>`;
    }
}