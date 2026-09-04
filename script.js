/* =====================================================
   DAIRY MANAGEMENT
===================================================== */

/* =====================================================
   CLIENT LOGIN + LOCAL DATA
===================================================== */

let customers = [];
let milkRecords = [];
let fatRecords = [];
let saleRecords = [];
let mainDairySales = [];
let expenseRecords = [];
let settlementRecords = [];
let customerTypes = {};
let customerSerials = {};
let profileComments = [];
let fatRate = 0;
let milkSaleRate = 0;
let mainDairyFatRate = 0;
let globalSession = "morning";
let selectedMilkPerson = null;
let selectedSalePerson = null;
let salePayment = "cash";
const today = new Date().toISOString().split("T")[0];

function storeKey(key) { return `dairy_${activeUser}_${key}`; }
function storeGet(key, fallback) {
    try { const v = localStorage.getItem(storeKey(key)); return v === null ? fallback : JSON.parse(v); }
    catch(e) { return fallback; }
}
function storeSet(key, value) { localStorage.setItem(storeKey(key), JSON.stringify(value)); }
function loadUserData() {
    customers = storeGet("customers", []);
    milkRecords = storeGet("milkRecords", []);
    fatRecords = storeGet("fatRecords", []);
    saleRecords = storeGet("saleRecords", []);
    mainDairySales = storeGet("mainDairySales", []);
    expenseRecords = storeGet("expenseRecords", []);
    settlementRecords = storeGet("settlementRecords", []);
    customerTypes = storeGet("customerTypes", {});
    customerSerials = storeGet("customerSerials", {});
    profileComments = storeGet("profileComments", []);
    fatRate = Number(storeGet("fatRate", 0)) || 0;
    milkSaleRate = Number(storeGet("milkSaleRate", 0)) || 0;
    mainDairyFatRate = Number(storeGet("mainDairyFatRate", 0)) || 0;
    globalSession = storeGet("globalSession", "morning") || "morning";
    // Backward compatibility: all old names are treated as milk suppliers.
    customers.forEach(name => {
        if (!customerTypes[name]) customerTypes[name] = "buyer";
        ensureCustomerSerials(name);
    });
    saveCustomerSerialsIfNeeded();
    [milkRecords, fatRecords, saleRecords, mainDairySales, expenseRecords].forEach(list => list.forEach(r => { if (!r.session) r.session = "morning"; }));
}
function migrateOldData(username) {
    const keys = ["customers","milkRecords","fatRecords","saleRecords","mainDairySales","expenseRecords","settlementRecords","fatRate","milkSaleRate","mainDairyFatRate","globalSession"];
    const hasNew = keys.some(k => localStorage.getItem(`dairy_${username}_${k}`) !== null);
    if (hasNew) return;
    keys.forEach(k => { const old = localStorage.getItem(k); if (old !== null) localStorage.setItem(`dairy_${username}_${k}`, old); });
}

// =====================================================
// FIXED CLIENT LOGIN (OWNER CONTROLLED)
// =====================================================
// IMPORTANT: Client signup/change-password is disabled.
// Set the username below. Password is verified using SHA-256 hash.
// Current demo password is: 12345678  (CHANGE BEFORE DELIVERY)
const APP_LOGIN = {
    username: "client",
    passwordHash: "ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f"
};
const ACTIVE_USER_KEY = "dairy_active_user_v1";
let activeUser = localStorage.getItem(ACTIVE_USER_KEY) || "";

async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Owner helper: run from browser console only when you need a new password hash.
// Example: makePasswordHash("MY_NEW_PASSWORD")
async function makePasswordHash(password) {
    const hash = await sha256(password);
    console.log("PASSWORD HASH:", hash);
    return hash;
}

function setLoginMessage(msg, ok=false) {
    const el=document.getElementById("loginMessage");
    if(el){ el.textContent=msg; el.style.color=ok?"#16803c":"#c0392b"; }
}

function prepareLogin() {
    document.getElementById("loginSubtitle").textContent = "आपको दिए गए यूज़रनेम और पासवर्ड से लॉगिन करें";
    document.getElementById("loginSubmitBtn").textContent = "लॉगिन करें";
    document.getElementById("loginPassword").autocomplete = "current-password";
}

async function handleLogin() {
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;
    if (!username || !password) return setLoginMessage("यूज़रनेम और पासवर्ड डालें");
    if (username !== APP_LOGIN.username) return setLoginMessage("यूज़रनेम या पासवर्ड गलत है");
    try {
        const enteredHash = await sha256(password);
        if (enteredHash !== APP_LOGIN.passwordHash) return setLoginMessage("यूज़रनेम या पासवर्ड गलत है");
        activeUser = APP_LOGIN.username;
        localStorage.setItem(ACTIVE_USER_KEY, activeUser);
        migrateOldData(activeUser);
        startApp();
    } catch (e) {
        console.error(e);
        setLoginMessage("लॉगिन में समस्या हुई, कृपया दोबारा कोशिश करें");
    }
}

function logoutUser() {
    saveAll();
    activeUser = "";
    localStorage.removeItem(ACTIVE_USER_KEY);
    document.getElementById("loginUsername").value = "";
    document.getElementById("loginPassword").value = "";
    document.getElementById("loginMessage").textContent = "";
    document.getElementById("loginScreen").classList.remove("hidden");
    prepareLogin();
}

function startApp() {
    loadUserData();
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("currentUserBtn").textContent = `👤 ${activeUser}`;
    document.getElementById("accountUsername").textContent = activeUser;
    initApp();
}
function downloadBackup() {
    if (!activeUser) return;
    const backup = { version: 3, app: "Dairy Management", username: activeUser, createdAt: new Date().toISOString(), data: { customers, milkRecords, fatRecords, saleRecords, mainDairySales, expenseRecords, settlementRecords, customerTypes, customerSerials, profileComments, fatRate, milkSaleRate, mainDairyFatRate, globalSession } };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {type:"application/json"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `dairy-backup-${activeUser}-${today}.json`; a.click(); URL.revokeObjectURL(a.href);
}
function restoreBackup(event) {
    const file = event.target.files && event.target.files[0]; if (!file) return;
    if (!confirm("बैकअप वापस डालने पर वर्तमान डेटा बदल जाएगा। जारी रखें?")) { event.target.value=""; return; }
    const reader = new FileReader();
    reader.onload = () => { try {
        const backup = JSON.parse(reader.result); if (!backup || !backup.data) throw new Error();
        const d = backup.data;
        customers = Array.isArray(d.customers)?d.customers:[]; milkRecords = Array.isArray(d.milkRecords)?d.milkRecords:[]; fatRecords = Array.isArray(d.fatRecords)?d.fatRecords:[]; saleRecords = Array.isArray(d.saleRecords)?d.saleRecords:[]; mainDairySales = Array.isArray(d.mainDairySales)?d.mainDairySales:[]; expenseRecords = Array.isArray(d.expenseRecords)?d.expenseRecords:[]; settlementRecords = Array.isArray(d.settlementRecords)?d.settlementRecords:[]; customerTypes = (d.customerTypes && typeof d.customerTypes === "object") ? d.customerTypes : {}; customerSerials = (d.customerSerials && typeof d.customerSerials === "object") ? d.customerSerials : {}; profileComments = Array.isArray(d.profileComments)?d.profileComments:[]; customers.forEach(n => { if (!customerTypes[n]) customerTypes[n] = "buyer"; ensureCustomerSerials(n); }); saveCustomerSerialsIfNeeded(); fatRate=Number(d.fatRate)||0; milkSaleRate=Number(d.milkSaleRate)||0; mainDairyFatRate=Number(d.mainDairyFatRate)||0; globalSession=d.globalSession||"morning";
        saveAll(); updateSessionUI(); updateHome(); alert("बैकअप सफलतापूर्वक वापस डाल दिया गया"); goHome();
    } catch(e) { alert("यह सही डेयरी बैकअप फाइल नहीं है"); } event.target.value=""; }; reader.readAsText(file);
}

/* =====================================================
   OLD DATA COMPATIBILITY
===================================================== */

milkRecords.forEach(r => {
    if (!r.session) r.session = "morning";
});

fatRecords.forEach(r => {
    if (!r.session) r.session = "morning";
});

saleRecords.forEach(r => {
    if (!r.session) r.session = "morning";
});

mainDairySales.forEach(r => {
    if (!r.session) r.session = "morning";
});

expenseRecords.forEach(r => {
    if (!r.session) r.session = "morning";
});


/* =====================================================
   START
===================================================== */

document.addEventListener("DOMContentLoaded", () => {
    prepareLogin();
    if (activeUser === APP_LOGIN.username) startApp();
});

function initApp() {
    document.getElementById("milkDate").value = today;
    document.getElementById("fatDate").value = today;
    document.getElementById("saleDate").value = today;
    document.getElementById("mainDairyDate").value = today;
    document.getElementById("expenseDate").value = today;
    document.getElementById("reportDate").value = today;
    document.getElementById("reportMonth").value = today.slice(0, 7);
    const reportSession = document.getElementById("reportSession");
    if (reportSession) reportSession.value = "all";
    document.getElementById("profileMonth").value = today.slice(0, 7);
    document.getElementById("todayDisplay").innerText = new Date().toLocaleDateString("hi-IN", { day:"numeric", month:"long", year:"numeric" });
    saveAll(); updateSessionUI(); updateHome(); fillYears("profileYear"); fillYears("reportYear");
}

/* =====================================================
   BASIC
===================================================== */

function saveAll() {
    if (!activeUser) return;
    storeSet("customers", customers);
    storeSet("milkRecords", milkRecords);
    storeSet("fatRecords", fatRecords);
    storeSet("saleRecords", saleRecords);
    storeSet("mainDairySales", mainDairySales);
    storeSet("expenseRecords", expenseRecords);
    storeSet("settlementRecords", settlementRecords);
    storeSet("customerTypes", customerTypes);
    storeSet("customerSerials", customerSerials);
    storeSet("profileComments", profileComments);
    storeSet("fatRate", String(fatRate));
    storeSet("milkSaleRate", String(milkSaleRate));
    storeSet("mainDairyFatRate", String(mainDairyFatRate));
    storeSet("globalSession", String(globalSession));
}

function money(value) {

    return `₹${Number(value || 0).toFixed(2)}`;
}


function sessionName(
    session = globalSession
) {

    return session === "morning"
        ? "🌅 सुबह"
        : "🌙 शाम";
}


function formatDate(date) {

    if (!date) return "-";

    return new Date(
        date + "T00:00:00"
    ).toLocaleDateString("hi-IN");
}


/* =====================================================
   NAVIGATION
===================================================== */

function openPage(id) {

    document
        .querySelectorAll(".page")
        .forEach(page =>
            page.classList.remove("active")
        );

    const page =
        document.getElementById(id);

    if (page) {
        page.classList.add("active");
    }

    closeMenu();

    /* PAGE DATA */

    if (id === "customersPage") {
        renderCustomers();
    }

    if (id === "fatRatePage") {

        document.getElementById(
            "currentRate"
        ).innerText = fatRate;

        document.getElementById(
            "newRate"
        ).value = "";
    }

    if (id === "milkRatePage") {

        document.getElementById(
            "currentMilkRate"
        ).innerText = milkSaleRate;

        document.getElementById(
            "newMilkRate"
        ).value = "";
    }

    if (id === "mainDairyRatePage") {

        document.getElementById(
            "currentMainDairyRate"
        ).innerText = mainDairyFatRate;

        document.getElementById(
            "newMainDairyRate"
        ).value = "";
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


function goHome() {

    openPage("homePage");

    updateHome();
}


/* =====================================================
   MENU
===================================================== */

function toggleMenu() {

    document
        .getElementById("sideMenu")
        .classList.toggle("show");

    document
        .getElementById("menuOverlay")
        .classList.toggle("show");
}


function closeMenu() {

    document
        .getElementById("sideMenu")
        .classList.remove("show");

    document
        .getElementById("menuOverlay")
        .classList.remove("show");
}


/* =====================================================
   GLOBAL SESSION
===================================================== */

function setGlobalSession(session) {

    globalSession = session;

    saveAll();

    updateSessionUI();

    updateHome();
}


function updateSessionUI() {

    const morning =
        document.getElementById("morningBtn");

    const evening =
        document.getElementById("eveningBtn");

    morning.classList.toggle(
        "active-session",
        globalSession === "morning"
    );

    evening.classList.toggle(
        "active-session",
        globalSession === "evening"
    );

    const milkText =
        document.getElementById("milkSessionText");

    const fatText =
        document.getElementById("fatSessionText");

    const saleText =
        document.getElementById("saleSessionText");

    const mainText =
        document.getElementById(
            "mainDairySessionText"
        );

    const expenseText =
        document.getElementById(
            "expenseSessionText"
        );

    if (milkText) {
        milkText.innerText =
            sessionName();
    }

    if (fatText) {
        fatText.innerText =
            sessionName();
    }

    if (saleText) {
        saleText.innerText =
            sessionName();
    }

    if (mainText) {
        mainText.innerText =
            sessionName();
    }

    if (expenseText) {
        expenseText.innerText =
            sessionName();
    }
}


/* =====================================================
   HOME
===================================================== */

function updateHome() {

    const records =
        milkRecords.filter(r =>
            r.date === today &&
            r.session === globalSession
        );

    const totalMilk =
        records.reduce(
            (sum, r) =>
                sum + Number(r.milk),
            0
        );

    let amount = 0;

    records.slice().sort(recordSort).forEach(r => {

        const fat =
            fatRecords.find(f =>
                f.name === r.name &&
                f.date === r.date &&
                f.session === r.session
            );

        amount += fat
            ? Number(fat.amount)
            : 0;
    });

    document.getElementById(
        "homeMilk"
    ).innerText =
        `${totalMilk.toFixed(2)} L`;

    document.getElementById(
        "homeAmount"
    ).innerText =
        money(amount);
}



/* =====================================================
   SHARED HELPERS FOR UPDATED LEDGER
===================================================== */
function sessionOrder(session) {
    return session === "morning" ? 0 : 1;
}
function getSerialNumber(serial) {
    const m = String(serial || "").match(/\d+/);
    return m ? Number(m[0]) : 999999;
}
function getPersonSerial(name, side = "buyer") {
    const entry = customerSerials[name] || {};
    return side === "seller" ? (entry.seller || "") : (entry.buyer || "");
}
function getBuyerSerial(name) {
    const s = getPersonSerial(name, "buyer");
    return s ? `K${getSerialNumber(s)}` : "K-";
}
function getSellerSerial(name) {
    const s = getPersonSerial(name, "seller");
    return s ? `B${getSerialNumber(s)}` : "B-";
}
function getRecordSerial(name, record) {
    if (!name) return 999999;
    if (record && (record.type === "sale" || record.quantity != null || saleRecords.some(x => x === record))) return getSerialNumber(getSellerSerial(name));
    return getSerialNumber(getBuyerSerial(name));
}
function recordSort(a, b) {
    const dateCmp = (b.date || "").localeCompare(a.date || "");
    if (dateCmp) return dateCmp;
    const sessionCmp = sessionOrder(a.session) - sessionOrder(b.session);
    if (sessionCmp) return sessionCmp;
    const serialCmp = getRecordSerial(a.name, a) - getRecordSerial(b.name, b);
    if (serialCmp) return serialCmp;
    return Number(a.id || 0) - Number(b.id || 0);
}
function customerTypeLabel(type) {
    if (type === "both") return "दोनों (खरीद + बिक्री)";
    return type === "seller" ? "जिन्हें डेयरी दूध बेचती है" : "जिनसे डेयरी दूध खरीदती है";
}
function isBuyer(name) {
    const t = getCustomerType(name);
    return t === "buyer" || t === "both";
}
function isSeller(name) {
    const t = getCustomerType(name);
    return t === "seller" || t === "both";
}
function ensureCustomerSerials(name) {
    if (!customerSerials[name]) customerSerials[name] = {};
    const entry = customerSerials[name];
    if (isBuyer(name) && !entry.buyer) {
        const used = customers.map(n => getSerialNumber(customerSerials[n]?.buyer)).filter(n => Number.isFinite(n) && n < 999999);
        entry.buyer = `K${used.length ? Math.max(...used) + 1 : 1}`;
    }
    if (isSeller(name) && !entry.seller) {
        const used = customers.map(n => getSerialNumber(customerSerials[n]?.seller)).filter(n => Number.isFinite(n) && n < 999999);
        entry.seller = `B${used.length ? Math.max(...used) + 1 : 1}`;
    }
}
function saveCustomerSerialsIfNeeded() {
    try { storeSet("customerSerials", customerSerials); } catch(e) {}
}
function sortedCustomerNames(side = "all") {
    return customers.filter(name => side === "all" ? true : side === "buyer" ? isBuyer(name) : isSeller(name))
        .slice().sort((a,b) => {
            const sa = side === "seller" ? getSerialNumber(getSellerSerial(a)) : side === "buyer" ? getSerialNumber(getBuyerSerial(a)) : Math.min(getSerialNumber(getBuyerSerial(a)), getSerialNumber(getSellerSerial(a)));
            const sb = side === "seller" ? getSerialNumber(getSellerSerial(b)) : side === "buyer" ? getSerialNumber(getBuyerSerial(b)) : Math.min(getSerialNumber(getBuyerSerial(b)), getSerialNumber(getSellerSerial(b)));
            return sa - sb || a.localeCompare(b, "hi");
        });
}
function getCustomerType(name) {
    return customerTypes[name] || "buyer";
}
function normalizeMoneyNumber(v) {
    return Number(v || 0);
}
function formatSignedMoney(v) {
    const n = Number(v || 0);
    if (n === 0) return "₹0";
    return n > 0 ? `+${money(n)}` : `-${money(Math.abs(n))}`;
}
function getPersonTransactions(name) {
    const list = [];
    combinedRecords().filter(r => r.name === name).forEach(r => {
        list.push({
            id: `milk-${r.id || `${r.name}-${r.date}-${r.session}`}`,
            date: r.date, session: r.session,
            type: "milk_purchase",
            label: "दूध खरीद",
            amount: Number(r.amount || 0),
            note: `${Number(r.milk || 0)} L${r.fat != null ? ` • FAT ${r.fat}` : ""}`
        });
    });
    saleRecords.filter(r => r.name === name).forEach(r => {
        const credit = r.status === "credit" || r.status === "udhar";
        list.push({
            id: `sale-${r.id}`, date: r.date, session: r.session,
            type: credit ? "sale_credit" : "sale_cash",
            label: credit ? "दूध बिक्री (उधार)" : "दूध बिक्री (नगद)",
            amount: Number(r.amount || 0),
            note: `${Number(r.quantity || 0)} L • ₹${Number(r.rate || 0)}/L`
        });
    });
    settlementRecords.filter(r => r.name === name).forEach(r => {
        list.push({
            id: `settle-${r.id}`, date: r.date, session: r.session,
            type: r.type === "received" ? "payment_received" : "payment_paid",
            label: r.type === "received" ? "पैसे जमा हुए" : "पैसे दिए",
            amount: r.type === "received" ? Number(r.amount || 0) : -Number(r.amount || 0),
            note: r.note || "हिसाब भुगतान"
        });
    });
    return list.sort(recordSort);
}
function getPersonBalance(name) {
    const purchases = combinedRecords().filter(r => r.name === name)
        .reduce((s,r) => s + Number(r.amount || 0), 0);
    const creditSales = saleRecords.filter(r => r.name === name && (r.status === "credit" || r.status === "udhar"))
        .reduce((s,r) => s + Number(r.amount || 0), 0);
    const received = settlementRecords.filter(r => r.name === name && r.type === "received")
        .reduce((s,r) => s + Number(r.amount || 0), 0);
    const paid = settlementRecords.filter(r => r.name === name && r.type === "paid")
        .reduce((s,r) => s + Number(r.amount || 0), 0);
    return {
        payable: purchases - paid,
        receivable: creditSales - received
    };
}

/* =====================================================
   CUSTOMERS
===================================================== */

function saveCustomer() {

    const input =
        document.getElementById(
            "customerName"
        );

    const name =
        input.value.trim();

    const editIndex =
        document.getElementById(
            "editCustomerIndex"
        ).value;

    if (!name) {

        alert("नाम लिखें");

        return;
    }


    if (editIndex !== "") {

        const oldName =
            customers[editIndex];

        customers[editIndex] = name;
        const editedType = document.getElementById("customerType")?.value || customerTypes[oldName] || "buyer";
        customerTypes[name] = editedType;
        customerSerials[name] = customerSerials[oldName] || {};
        delete customerTypes[oldName];
        delete customerSerials[oldName];
        ensureCustomerSerials(name);

        milkRecords.forEach(r => {
            if (r.name === oldName) {
                r.name = name;
            }
        });


        fatRecords.forEach(r => {
            if (r.name === oldName) {
                r.name = name;
            }
        });


        saleRecords.forEach(r => {
            if (r.name === oldName) {
                r.name = name;
            }
        });


        document.getElementById(
            "editCustomerIndex"
        ).value = "";

    } else {

        const typeEl = document.getElementById("customerType");
        const type = typeEl ? typeEl.value : "buyer";

        // One person = one profile. If the same person is also used on
        // the other side of the dairy, upgrade the same profile to BOTH.
        if (customers.includes(name)) {
            const oldType = getCustomerType(name);
            if (oldType === type || oldType === "both" || type === "both") {
                alert("यह नाम पहले से इसी सूची में मौजूद है");
                return;
            }
            customerTypes[name] = "both";
            ensureCustomerSerials(name);
        } else {
            customers.push(name);
            customerTypes[name] = type;
            ensureCustomerSerials(name);
        }
    }


    input.value = "";

    saveAll();

    renderCustomers();
}


function renderCustomers() {
    const box = document.getElementById("customerList");
    if (!box) return;
    box.innerHTML = "";
    const filter = document.getElementById("customerListFilter")?.value || "all";
    sortedCustomerNames(filter).forEach(name => {
        const index = customers.indexOf(name);
        const serials = [];
        if (isBuyer(name)) serials.push(`${getBuyerSerial(name)} — जिनसे डेयरी दूध खरीदती है`);
        if (isSeller(name)) serials.push(`${getSellerSerial(name)} — जिन्हें डेयरी दूध बेचती है`);
        box.innerHTML += `
        <div class="customer-row">
            <div>
                <strong>${escapeHtml(name)}</strong>
                <small class="customer-type-badge">${serials.join("<br>")}</small>
            </div>
            <div class="customer-actions">
                ${isBuyer(name) ? `<button class="edit-btn" onclick="changeCustomerSerial('${escapeHtml(name).replace(/'/g, "\\'")}','buyer')">🔢 ${getBuyerSerial(name)}</button>` : ""}
                ${isSeller(name) ? `<button class="edit-btn" onclick="changeCustomerSerial('${escapeHtml(name).replace(/'/g, "\\'")}','seller')">🔢 ${getSellerSerial(name)}</button>` : ""}
                <button class="edit-btn" onclick="editCustomer(${index})">✏️</button>
                <button class="delete-btn" onclick="deleteCustomer(${index})">🗑️</button>
            </div>
        </div>`;
    });
}

function changeCustomerSerial(name, side) {
    ensureCustomerSerials(name);
    const prefix = side === "seller" ? "B" : "K";
    const oldSerial = side === "seller" ? getSellerSerial(name) : getBuyerSerial(name);
    const answer = prompt(`${name} का ${prefix} क्रमांक दर्ज करें (जैसे ${prefix}12 या 12):`, oldSerial);
    if (answer === null) return;
    const digits = String(answer).trim().replace(new RegExp(`^${prefix}`, "i"), "");
    const num = Number(digits);
    if (!Number.isInteger(num) || num < 1) return alert("सही क्रमांक डालें, जैसे K12 या 12");
    const duplicate = customers.find(n => n !== name && ((side === "seller" ? getSellerSerial(n) : getBuyerSerial(n)) === `${prefix}${num}`));
    if (duplicate) return alert(`${prefix}${num} पहले से ${duplicate} को दिया गया है।`);
    customerSerials[name][side] = `${prefix}${num}`;
    saveAll();
    renderCustomers();
}

function editCustomer(index) {

    document.getElementById(
        "customerName"
    ).value =
        customers[index];

    document.getElementById(
        "editCustomerIndex"
    ).value =
        index;
    const typeEl = document.getElementById("customerType");
    if (typeEl) typeEl.value = getCustomerType(customers[index]);
}


function deleteCustomer(index) {

    const name =
        customers[index];

    if (
        !confirm(
            `${name} को हटाना चाहते हैं?`
        )
    ) {
        return;
    }

    customers.splice(index, 1);

    milkRecords =
        milkRecords.filter(
            r => r.name !== name
        );

    fatRecords =
        fatRecords.filter(
            r => r.name !== name
        );

    saleRecords =
        saleRecords.filter(
            r => r.name !== name
        );

    delete customerTypes[name];
    delete customerSerials[name];
    profileComments = profileComments.filter(c => c.name !== name);
    settlementRecords = settlementRecords.filter(r => r.name !== name);

    saveAll();

    renderCustomers();
}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


/* =====================================================
   MILK FAST ENTRY
===================================================== */

function openMilkNames() {

    openPage("milkNamesPage");

    document.getElementById(
        "milkSessionText"
    ).innerText =
        sessionName();

    renderMilkNames();
}


function renderMilkNames() {

    const date =
        document.getElementById(
            "milkDate"
        ).value;

    const box =
        document.getElementById(
            "milkNameList"
        );

    box.innerHTML = "";

    sortedCustomerNames("buyer").forEach((name) => {
        if (!isBuyer(name)) return;

        const record =
            milkRecords.find(r =>
                r.name === name &&
                r.date === date &&
                r.session === globalSession
            );

        const item =
            document.createElement("div");

        item.className =
            `name-item ${
                record ? "done" : ""
            }`;

        const info =
            document.createElement("span");

        info.innerHTML = `
            <strong>
                ${getBuyerSerial(name)}. ${escapeHtml(name)}
            </strong>

            ${
                record
                    ? `<br><small>✓ ${record.milk} L दर्ज</small>`
                    : ""
            }
        `;

        const actions = document.createElement("div");
        actions.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;";

        const button = document.createElement("button");
        button.innerText = record ? "✏️ बदलें" : "चुनें →";
        button.onclick = () => selectMilkPerson(name);
        actions.appendChild(button);

        if (record) {
            const del = document.createElement("button");
            del.className = "delete-btn";
            del.innerText = "🗑️ हटाएँ";
            del.onclick = () => deleteMilkRecord(record.id);
            actions.appendChild(del);
        }

        item.appendChild(info);
        item.appendChild(actions);
        box.appendChild(item);
    });
}


function filterNameList(id, search) {

    const items =
        document.querySelectorAll(
            `#${id} .name-item`
        );

    items.forEach(item => {

        item.style.display =
            item.innerText
                .toLowerCase()
                .includes(
                    search.toLowerCase()
                )
                ? ""
                : "none";
    });
}


function selectMilkPerson(name) {

    selectedMilkPerson = name;

    const date =
        document.getElementById(
            "milkDate"
        ).value;

    const existing =
        milkRecords.find(r =>
            r.name === name &&
            r.date === date &&
            r.session === globalSession
        );

    document.getElementById(
        "milkPersonName"
    ).innerText =
        name;

    document.getElementById(
        "milkEntryInfo"
    ).innerText =
        `${formatDate(date)} • ${sessionName()}`;

    document.getElementById(
        "milkQuantity"
    ).value =
        existing ? existing.milk : "";

    openPage("milkEntryPage");

    setTimeout(() => {

        document
            .getElementById("milkQuantity")
            .focus();

    }, 200);
}


function deleteMilkRecord(id) {
    const record = milkRecords.find(r => String(r.id) === String(id));
    if (!record) return;
    if (!confirm(`${record.name} की ${formatDate(record.date)} ${sessionName(record.session)} की ${record.milk} L napti हटानी है?`)) return;

    milkRecords = milkRecords.filter(r => String(r.id) !== String(id));
    // A FAT entry cannot stand without its milk napti, so remove the linked FAT too.
    fatRecords = fatRecords.filter(f => !(f.name === record.name && f.date === record.date && f.session === record.session));
    saveAll();
    updateHome();
    renderMilkNames();
    renderRecords();
}


function saveMilkFast() {

    const date =
        document.getElementById(
            "milkDate"
        ).value;

    const milk =
        Number(
            document.getElementById(
                "milkQuantity"
            ).value
        );

    if (
        !selectedMilkPerson ||
        milk <= 0
    ) {

        alert("सही दूध की मात्रा लिखें");

        return;
    }


    const existing =
        milkRecords.find(r =>
            r.name === selectedMilkPerson &&
            r.date === date &&
            r.session === globalSession
        );


    if (existing) {

        existing.milk = milk;

        const fat =
            fatRecords.find(f =>
                f.name === selectedMilkPerson &&
                f.date === date &&
                f.session === globalSession
            );

        if (fat) {

            fat.amount =
                fat.fat *
                fat.fatRate *
                milk;
        }

    } else {

        milkRecords.push({

            id: Date.now(),

            name:
                selectedMilkPerson,

            date,

            session:
                globalSession,

            milk

        });
    }


    saveAll();

    selectedMilkPerson = null;

    openMilkNames();

    updateHome();
}


/* =====================================================
   FAT ENTRY
===================================================== */

function openFatEntry() {

    openPage("fatPage");

    document.getElementById(
        "fatSessionText"
    ).innerText =
        sessionName();

    document.getElementById(
        "fatRateDisplay"
    ).innerText =
        fatRate;

    loadFatQueue();
}


function loadFatQueue() {

    const date =
        document.getElementById(
            "fatDate"
        ).value;


    const queue =
        milkRecords
            .filter(r =>
                r.date === date &&
                r.session === globalSession
            )
            .sort((a, b) => getSerialNumber(getBuyerSerial(a.name)) - getSerialNumber(getBuyerSerial(b.name)));


    const done =
        queue.filter(person =>
            fatRecords.some(f =>
                f.name === person.name &&
                f.date === date &&
                f.session === globalSession
            )
        ).length;


    document.getElementById(
        "fatProgressText"
    ).innerText =
        `${done} / ${queue.length}`;

    renderFatRecordedList(queue, date);


    document.getElementById(
        "progressFill"
    ).style.width =
        queue.length
            ? `${(done / queue.length) * 100}%`
            : "0%";


    const person =
        queue.find(p =>
            !fatRecords.some(f =>
                f.name === p.name &&
                f.date === date &&
                f.session === globalSession
            )
        );


    if (!person) {

        const recordedValue = document.getElementById("fatRecordedValue");
        const editCurrentBtn = document.getElementById("fatEditCurrentBtn");
        if (recordedValue) recordedValue.innerText = "सभी का FAT दर्ज हो चुका है";
        if (editCurrentBtn) editCurrentBtn.style.display = "none";

        document.getElementById(
            "fatPersonName"
        ).innerText =
            queue.length
                ? "✓ सभी का फैट पूरा"
                : "कोई नापती नहीं";


        document.getElementById(
            "fatSaveBtn"
        ).style.display =
            "none";


        document.getElementById(
            "fatValue"
        ).value = "";

        document.getElementById(
            "fatAmountPreview"
        ).innerText = "0";

        return;
    }


    document.getElementById(
        "fatSaveBtn"
    ).style.display =
        "block";


    document.getElementById(
        "fatPersonName"
    ).innerText =
        person.name;


    document.getElementById(
        "fatSerial"
    ).innerText =
        getSerialNumber(getBuyerSerial(person.name));


    document.getElementById(
        "fatPersonMilk"
    ).innerText =
        `${person.milk} L`;

    const existingCurrent = fatRecords.find(f =>
        f.name === person.name && f.date === date && f.session === globalSession
    );
    const recordedValue = document.getElementById("fatRecordedValue");
    const editCurrentBtn = document.getElementById("fatEditCurrentBtn");
    if (recordedValue) recordedValue.innerText = existingCurrent ? `FAT ${existingCurrent.fat}` : "अभी दर्ज नहीं";
    if (editCurrentBtn) {
        editCurrentBtn.style.display = existingCurrent ? "inline-block" : "none";
        editCurrentBtn.dataset.id = existingCurrent ? existingCurrent.id : "";
    }

    document.getElementById(
        "fatValue"
    ).value = "";


    document.getElementById(
        "fatAmountPreview"
    ).innerText =
        "0";


    const button =
        document.getElementById(
            "fatSaveBtn"
        );

    button.dataset.name =
        person.name;

    button.dataset.milk =
        person.milk;


    setTimeout(() => {

        document
            .getElementById("fatValue")
            .focus();

    }, 200);
}


function previewFat() {

    const fat =
        Number(
            document.getElementById(
                "fatValue"
            ).value
        ) || 0;

    const milk =
        Number(
            document.getElementById(
                "fatSaveBtn"
            ).dataset.milk
        ) || 0;


    const amount =
        fat *
        fatRate *
        milk;


    document.getElementById(
        "fatAmountPreview"
    ).innerText =
        amount.toFixed(2);
}


function saveFat() {
    if (fatRate <= 0) {
        alert("पहले मेन्यू से फैट का भाव सेट करें");
        return;
    }
    const button = document.getElementById("fatSaveBtn");
    const name = button.dataset.name;
    const milk = Number(button.dataset.milk);
    const date = document.getElementById("fatDate").value;
    const fat = Number(document.getElementById("fatValue").value);

    if (!name || fat <= 0) {
        alert("फैट लिखें");
        return;
    }

    const existing = fatRecords.find(f =>
        f.name === name && f.date === date && f.session === globalSession
    );
    if (existing) {
        existing.fat = fat;
        existing.fatRate = Number(existing.fatRate || fatRate);
        existing.amount = fat * existing.fatRate * milk;
        existing.updatedAt = Date.now();
    } else {
        fatRecords.push({
            id: Date.now(), name, date, session: globalSession,
            fat, fatRate, amount: fat * fatRate * milk
        });
    }
    saveAll();
    const recordedValue = document.getElementById("fatRecordedValue");
    if (recordedValue) recordedValue.innerText = `FAT ${fat}`;
    const buttonAfter = document.getElementById("fatSaveBtn");
    if (buttonAfter) { buttonAfter.innerText = "✓ फैट सेव करें"; delete buttonAfter.dataset.editId; }
    loadFatQueue();
    updateHome();
}

function editFatRecord(id) {
    const record = fatRecords.find(f => String(f.id) === String(id));
    if (!record) return;

    globalSession = record.session || globalSession;
    storeSet("globalSession", globalSession);
    openFatEntry();

    const dateEl = document.getElementById("fatDate");
    if (dateEl) dateEl.value = record.date;

    const milk = Number(milkRecords.find(m =>
        m.name === record.name && m.date === record.date && m.session === record.session
    )?.milk || 0);

    document.getElementById("fatPersonName").innerText = record.name;
    document.getElementById("fatSerial").innerText = getSerialNumber(getBuyerSerial(record.name));
    document.getElementById("fatPersonMilk").innerText = `${milk} L`;
    document.getElementById("fatValue").value = record.fat;

    const button = document.getElementById("fatSaveBtn");
    button.dataset.name = record.name;
    button.dataset.milk = milk;
    button.dataset.editId = record.id;
    button.innerText = "✓ FAT अपडेट करें";

    const recordedValue = document.getElementById("fatRecordedValue");
    const editCurrentBtn = document.getElementById("fatEditCurrentBtn");
    if (recordedValue) recordedValue.innerText = `FAT ${record.fat}`;
    if (editCurrentBtn) { editCurrentBtn.style.display = "inline-block"; editCurrentBtn.dataset.id = record.id; }

    previewFat();
}

function editCurrentFat() {
    const id = document.getElementById("fatEditCurrentBtn")?.dataset.id;
    if (id) editFatRecord(id);
}

function renderFatRecordedList(queue, date) {
    const box = document.getElementById("fatRecordedList");
    if (!box) return;
    const records = queue.map(p => fatRecords.find(f =>
        f.name === p.name && f.date === date && f.session === globalSession
    )).filter(Boolean);
    box.innerHTML = records.length ? `<h3 style="margin:0 0 8px;">आज दर्ज किया हुआ FAT</h3>` : "";
    records.forEach(r => {
        box.innerHTML += `<div class="record-card" style="margin-bottom:8px;">
            <h3>${escapeHtml(r.name)}</h3>
            <div class="record-info"><span>🥛 ${Number(milkRecords.find(m=>m.name===r.name&&m.date===r.date&&m.session===r.session)?.milk||0)} L</span><span>🧪 FAT ${r.fat}</span><span>💰 ${money(r.amount||0)}</span>
            <button class="edit-btn" onclick="editFatRecord('${r.id}')">✏️ FAT Edit</button></div>
        </div>`;
    });
}


/* =====================================================
   CUSTOMER SALE
===================================================== */

function openSaleNames() {

    openPage("saleNamesPage");

    document.getElementById(
        "saleSessionText"
    ).innerText =
        sessionName();

    renderSaleNames();
}


function renderSaleNames() {

    const box =
        document.getElementById(
            "saleNameList"
        );

    box.innerHTML = "";

    sortedCustomerNames("seller").forEach((name) => {
        if (!isSeller(name)) return;

        const item = document.createElement("div");
        item.className = "name-item";

        const info = document.createElement("span");
        info.innerHTML = `<strong>${getSellerSerial(name)}. ${escapeHtml(name)}</strong>
            <br><small>दूध बेचने वाला</small>`;

        const button = document.createElement("button");
        button.innerText = "चुनें →";
        button.onclick = () => selectSalePerson(name);

        item.appendChild(info);
        item.appendChild(button);
        box.appendChild(item);
    });
}


function selectSalePerson(name) {

    selectedSalePerson = name;

    const date =
        document.getElementById(
            "saleDate"
        ).value;


    document.getElementById(
        "salePersonName"
    ).innerText =
        name;


    document.getElementById(
        "saleEntryInfo"
    ).innerText =
        `${formatDate(date)} • ${sessionName()}`;


    document.getElementById(
        "saleQuantity"
    ).value =
        "";


    document.getElementById(
        "saleRateDisplay"
    ).innerText =
        milkSaleRate;


    document.getElementById(
        "saleAmountPreview"
    ).innerText =
        "0";


    setPayment("cash");


    openPage("saleEntryPage");


    setTimeout(() => {

        document
            .getElementById("saleQuantity")
            .focus();

    }, 200);
}


function setPayment(type) {

    salePayment = type;


    document
        .getElementById("cashBtn")
        .classList.toggle(
            "active-payment",
            type === "cash"
        );


    document
        .getElementById("creditBtn")
        .classList.toggle(
            "active-payment",
            type === "credit"
        );
}


function previewSaleAmount() {

    const quantity =
        Number(
            document.getElementById(
                "saleQuantity"
            ).value
        ) || 0;


    document.getElementById(
        "saleAmountPreview"
    ).innerText =
        (
            quantity *
            milkSaleRate
        ).toFixed(2);
}


function saveSaleFast() {

    if (milkSaleRate <= 0) {

        alert(
            "पहले मेन्यू से दूध का भाव सेट करें"
        );

        return;
    }


    const quantity =
        Number(
            document.getElementById(
                "saleQuantity"
            ).value
        );

    const date =
        document.getElementById(
            "saleDate"
        ).value;


    if (
        !selectedSalePerson ||
        quantity <= 0
    ) {

        alert("दूध की मात्रा लिखें");

        return;
    }


    saleRecords.push({

        id:
            Date.now(),

        name:
            selectedSalePerson,

        date,

        session:
            globalSession,

        quantity,

        rate:
            milkSaleRate,

        amount:
            quantity *
            milkSaleRate,

        status:
            salePayment

    });


    saveAll();

    selectedSalePerson = null;

    openSaleNames();
}


/* =====================================================
   RATES
===================================================== */

function saveRate() {

    const rate =
        Number(
            document.getElementById(
                "newRate"
            ).value
        );

    if (rate <= 0) {

        alert("सही भाव लिखें");

        return;
    }

    fatRate = rate;

    saveAll();

    document.getElementById(
        "currentRate"
    ).innerText =
        fatRate;

    document.getElementById(
        "newRate"
    ).value =
        "";
}


function saveMilkRate() {

    const rate =
        Number(
            document.getElementById(
                "newMilkRate"
            ).value
        );

    if (rate <= 0) {

        alert("सही भाव लिखें");

        return;
    }

    milkSaleRate = rate;

    saveAll();

    document.getElementById(
        "currentMilkRate"
    ).innerText =
        milkSaleRate;

    document.getElementById(
        "newMilkRate"
    ).value =
        "";
}


/* =====================================================
   MAIN DAIRY RATE
===================================================== */

function saveMainDairyRate() {

    const rate =
        Number(
            document.getElementById(
                "newMainDairyRate"
            ).value
        );

    if (rate <= 0) {

        alert("सही मुख्य डेयरी भाव लिखें");

        return;
    }


    mainDairyFatRate =
        rate;


    saveAll();


    document.getElementById(
        "currentMainDairyRate"
    ).innerText =
        mainDairyFatRate;


    document.getElementById(
        "newMainDairyRate"
    ).value =
        "";
}


/* =====================================================
   MAIN DAIRY SALE
===================================================== */

function openMainDairySale() {

    openPage(
        "mainDairySalePage"
    );


    document.getElementById(
        "mainDairySessionText"
    ).innerText =
        sessionName();


    document.getElementById(
        "mainDairySessionDisplay"
    ).innerText =
        sessionName();


    document.getElementById(
        "mainDairyRateDisplay"
    ).innerText =
        mainDairyFatRate;


    document.getElementById(
        "mainDairyDate"
    ).value =
        today;


    document.getElementById(
        "mainDairyMilk"
    ).value =
        "";

    document.getElementById(
        "mainDairyFat"
    ).value =
        "";


    document.getElementById(
        "mainDairyAmountPreview"
    ).innerText =
        "0";


    renderMainDairyRecords();
}


function previewMainDairyAmount() {

    const milk =
        Number(
            document.getElementById(
                "mainDairyMilk"
            ).value
        ) || 0;

    const fat =
        Number(
            document.getElementById(
                "mainDairyFat"
            ).value
        ) || 0;


    const amount =
        milk *
        fat *
        mainDairyFatRate;


    document.getElementById(
        "mainDairyAmountPreview"
    ).innerText =
        amount.toFixed(2);
}


function saveMainDairySale() {

    if (mainDairyFatRate <= 0) {

        alert(
            "पहले मुख्य डेयरी FAT भाव सेट करें"
        );

        return;
    }


    const date =
        document.getElementById(
            "mainDairyDate"
        ).value;

    const milk =
        Number(
            document.getElementById(
                "mainDairyMilk"
            ).value
        );

    const fat =
        Number(
            document.getElementById(
                "mainDairyFat"
            ).value
        );


    if (
        !date ||
        milk <= 0 ||
        fat <= 0
    ) {

        alert(
            "तारीख, दूध और फैट सही लिखें"
        );

        return;
    }


    const amount =
        milk *
        fat *
        mainDairyFatRate;


    mainDairySales.push({

        id:
            Date.now(),

        date,

        session:
            globalSession,

        milk,

        fat,

        rate:
            mainDairyFatRate,

        amount

    });


    saveAll();


    document.getElementById(
        "mainDairyMilk"
    ).value =
        "";

    document.getElementById(
        "mainDairyFat"
    ).value =
        "";


    document.getElementById(
        "mainDairyAmountPreview"
    ).innerText =
        "0";


    renderMainDairyRecords();
}


function renderMainDairyRecords() {

    const box =
        document.getElementById(
            "mainDairyRecords"
        );

    if (!box) return;

    box.innerHTML = "";


    [...mainDairySales]
        .sort(
            (a, b) =>
                b.date.localeCompare(a.date)
        )
        .slice(0, 20)
        .forEach(r => {

            box.innerHTML += `

            <div class="record-card">

                <h3>
                    🏭 ${formatDate(r.date)}
                </h3>

                <div class="record-info">

                    <span>
                        ${sessionName(r.session)}
                    </span>

                    <span>
                        🥛 ${r.milk} L
                    </span>

                    <span>
                        🧪 FAT ${r.fat}
                    </span>

                    <span>
                        💰 ${money(r.amount)}
                    </span>

                </div>

            </div>`;
        });
}


/* =====================================================
   EXPENSE
===================================================== */

function openExpensePage() {

    openPage("expensePage");

    document.getElementById(
        "expenseSessionText"
    ).innerText =
        sessionName();

    document.getElementById(
        "expenseDate"
    ).value =
        today;

    renderExpenses();
}


function expenseName(type) {

    const names = {

        petrol:
            "⛽ पेट्रोल",

        transport:
            "🚚 ट्रांसपोर्ट",

        other:
            "📦 अन्य खर्च"

    };

    return names[type] || type;
}


function saveExpense() {

    const date =
        document.getElementById(
            "expenseDate"
        ).value;

    const type =
        document.getElementById(
            "expenseType"
        ).value;

    const amount =
        Number(
            document.getElementById(
                "expenseAmount"
            ).value
        );

    const note =
        document.getElementById(
            "expenseNote"
        ).value.trim();


    if (!date || amount <= 0) {

        alert(
            "तारीख और सही राशि लिखें"
        );

        return;
    }


    expenseRecords.push({

        id:
            Date.now(),

        date,

        session:
            globalSession,

        type,

        amount,

        note

    });


    saveAll();


    document.getElementById(
        "expenseAmount"
    ).value =
        "";

    document.getElementById(
        "expenseNote"
    ).value =
        "";


    renderExpenses();
}


function renderExpenses() {

    const box =
        document.getElementById(
            "expenseRecords"
        );

    if (!box) return;

    box.innerHTML = "";


    [...expenseRecords]
        .sort(
            (a, b) =>
                b.date.localeCompare(a.date)
        )
        .slice(0, 30)
        .forEach(r => {

            box.innerHTML += `

            <div class="record-card">

                <h3>
                    ${expenseName(r.type)}
                </h3>

                <div class="record-info">

                    <span>
                        📅 ${formatDate(r.date)}
                    </span>

                    <span>
                        ${sessionName(r.session)}
                    </span>

                    <span>
                        💰 ${money(r.amount)}
                    </span>

                    <span>
                        ${r.note || "-"}
                    </span>

                </div>

                <div class="record-actions">
                    ${recordActionButtons("expense", r.id)}
                </div>

            </div>`;
        });
}


/* =====================================================
   COMBINED PURCHASE RECORDS
===================================================== */

function combinedRecords() {

    return milkRecords.map(m => {

        const fat =
            fatRecords.find(f =>
                f.name === m.name &&
                f.date === m.date &&
                f.session === m.session
            );

        return {

            id: m.id,
            name:
                m.name,

            date:
                m.date,

            session:
                m.session,

            milk:
                m.milk,

            fatId: fat?.id ?? null,
            fat:
                fat?.fat ?? null,

            fatRate:
                fat?.fatRate ?? null,

            amount:
                fat?.amount ?? null

        };
    });
}


/* =====================================================
   ALL RECORDS
===================================================== */

function getRecordFilters() {
    return {
        date: document.getElementById("recordsDate")?.value || "",
        session: document.getElementById("recordsSession")?.value || "all"
    };
}

function filterByRecordControls(records) {
    const {date, session} = getRecordFilters();
    return records.filter(r => (!date || r.date === date) && (session === "all" || r.session === session));
}

function clearRecordFilters() {
    const d = document.getElementById("recordsDate");
    const ss = document.getElementById("recordsSession");
    if (d) d.value = "";
    if (ss) ss.value = "all";
    renderRecords();
}

function renderRecords() {
    const records = filterByRecordControls(combinedRecords()).slice().sort(recordSort);
    const localSales = filterByRecordControls(saleRecords).slice().sort(recordSort);
    const mainSales = filterByRecordControls(mainDairySales).slice().sort(recordSort);

    const milk = records.reduce((sum, r) => sum + Number(r.milk || 0), 0);
    const amount = records.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    document.getElementById("totalMilk").innerText = `${milk.toFixed(2)} L`;
    document.getElementById("totalAmount").innerText = money(amount);
    document.getElementById("totalDays").innerText = records.length;

    const box = document.getElementById("recordsCards");
    if (!box) return;
    box.innerHTML = records.length ? "" : `<div class="record-card">चुने हुए फिल्टर के अनुसार कोई रिकॉर्ड नहीं</div>`;

    records.forEach(r => {
        const isSale = r.type === "sale" || r.quantity != null;
        const serialLabel = isSale ? getSellerSerial(r.name) : getBuyerSerial(r.name);
        box.innerHTML += `<div class="record-card">
            <h3>${serialLabel}. ${escapeHtml(r.name)}</h3>
            <div class="record-info">
                <span>📅 ${formatDate(r.date)}</span>
                <span>${sessionName(r.session)}</span>
                <span>🥛 ${Number(r.milk || 0).toFixed(2)} L</span>
                <span>🧪 FAT ${r.fat != null ? Number(r.fat).toFixed(2) : "बाकी"}</span>
                <span>💰 ${r.amount !== null && r.amount !== undefined ? money(r.amount) : "-"}</span>
            </div>
            ${!isSale && r.id != null ? `<div class="record-actions">${recordActionButtons("milk", r.id)}</div>` : ""}
        </div>`;
    });

    renderAllLocalSales(localSales);
    renderAllMainDairySales(mainSales);
}

function renderAllLocalSales(records) {
    const box = document.getElementById("allLocalSaleCards"); if (!box) return;
    box.innerHTML = records.length ? "" : `<div class="record-card">कोई स्थानीय बिक्री रिकॉर्ड नहीं</div>`;
    records.slice().sort(recordSort).forEach(r=>{ box.innerHTML += `<div class="record-card">
        <h3>${getSellerSerial(r.name||"")}. ${escapeHtml(r.name||"ग्राहक")}</h3>
        <div class="record-info">
            <span>📅 ${formatDate(r.date)}</span><span>${sessionName(r.session)}</span>
            <span>🥛 ${Number(r.quantity||0).toFixed(2)} L</span>
            <span>₹ ${Number(r.rate||0).toFixed(2)}/L</span>
            <span>💰 ${money(r.amount||0)}</span>
            <span>${(r.status==="credit"||r.status==="udhar")?"उधार":"नगद"}</span>
        </div>
        <div class="record-actions">${recordActionButtons("sale", r.id)}</div>
    </div>`; });
}
function renderAllMainDairySales(records) {
    const box = document.getElementById("allMainDairySaleCards"); if (!box) return;
    box.innerHTML = records.length ? "" : `<div class="record-card">कोई मुख्य डेयरी बिक्री रिकॉर्ड नहीं</div>`;
    records.slice().sort(recordSort).forEach(r=>{ box.innerHTML += `<div class="record-card">
        <h3>🏭 मुख्य डेयरी बिक्री</h3>
        <div class="record-info">
            <span>📅 ${formatDate(r.date)}</span><span>${sessionName(r.session)}</span>
            <span>🥛 ${Number(r.milk||0).toFixed(2)} L</span>
            <span>🧪 ${Number(r.fat||0).toFixed(2)} FAT</span>
            <span>₹ ${Number(r.rate||0).toFixed(2)}/FAT</span>
            <span>💰 ${money(r.amount||0)}</span>
        </div>
        <div class="record-actions">${recordActionButtons("main", r.id)}</div>
    </div>`; });
}
function downloadAllLocalSalesExcel() {
 const rows=filterByRecordControls(saleRecords).slice().sort(recordSort).map(r=>({क्रमांक:getSellerSerial(r.name||""),नाम:r.name||"",तारीख:formatDate(r.date),समय:sessionName(r.session),दूध_लीटर:Number(r.quantity||0),भाव_प्रति_लीटर:Number(r.rate||0),कुल_राशि:Number(r.amount||0),भुगतान:(r.status==="credit"||r.status==="udhar")?"उधार":"नगद"})); if(!rows.length)return alert("कोई स्थानीय बिक्री रिकॉर्ड नहीं है"); createExcel(rows,"स्थानीय_दूध_बिक्री.xlsx","स्थानीय बिक्री");

    renderAllLocalSales(saleRecords);
    renderAllMainDairySales(mainDairySales);
}

/* =====================================================
   PROFILE
===================================================== */

function fillProfile() {

    const select =
        document.getElementById(
            "profileCustomer"
        );


    select.innerHTML =
        `<option value="">
            व्यक्ति चुनें
        </option>`;


    sortedCustomerNames("all").forEach((name) => {

        const option =
            document.createElement("option");

        option.value =
            name;

        option.textContent =
            `${isBuyer(name) ? getBuyerSerial(name) : getSellerSerial(name)}. ${name} • ${customerTypeLabel(getCustomerType(name))}`;

        select.appendChild(option);
    });


    fillYears("profileYear");
}


function fillYears(id) {

    const years =
        new Set();


    [
        ...milkRecords,
        ...saleRecords,
        ...mainDairySales,
        ...expenseRecords
    ].forEach(r => {

        if (r.date) {

            years.add(
                r.date.slice(0, 4)
            );
        }
    });


    years.add(
        new Date()
            .getFullYear()
            .toString()
    );


    const select =
        document.getElementById(id);

    if (!select) return;

    select.innerHTML = "";


    [...years]
        .sort()
        .reverse()
        .forEach(year => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                year;

            option.textContent =
                year;

            select.appendChild(option);
        });
}


function changeProfileType() {

    const type =
        document.getElementById(
            "profileType"
        ).value;


    document.getElementById(
        "profileMonth"
    ).classList.toggle(
        "hidden",
        type !== "monthly"
    );


    document.getElementById(
        "profileYear"
    ).classList.toggle(
        "hidden",
        type !== "yearly"
    );


    showProfile();
}


function showProfile() {

    const name =
        document.getElementById(
            "profileCustomer"
        ).value;

    if (!name) {

        document
            .getElementById("profileData")
            .classList.add("hidden");

        return;
    }


    const type =
        document.getElementById(
            "profileType"
        ).value;


    let records =
        combinedRecords()
            .filter(
                r => r.name === name
            );


    if (type === "monthly") {

        const month =
            document.getElementById(
                "profileMonth"
            ).value;

        if (month) {

            records =
                records.filter(r =>
                    r.date.startsWith(month)
                );
        }
    }


    if (type === "yearly") {

        const year =
            document.getElementById(
                "profileYear"
            ).value;

        records =
            records.filter(r =>
                r.date.startsWith(year)
            );
    }


    const totalMilk =
        records.reduce(
            (sum, r) =>
                sum + Number(r.milk),
            0
        );


    const payable =
        records.reduce(
            (sum, r) =>
                sum +
                Number(r.amount || 0),
            0
        );


    let sales =
        saleRecords.filter(
            r => r.name === name
        );


    if (type === "monthly") {

        const month =
            document.getElementById(
                "profileMonth"
            ).value;

        if (month) {

            sales =
                sales.filter(r =>
                    r.date.startsWith(month)
                );
        }
    }


    if (type === "yearly") {

        const year =
            document.getElementById(
                "profileYear"
            ).value;

        sales =
            sales.filter(r =>
                r.date.startsWith(year)
            );
    }


    let settlements = settlementRecords.filter(r => r.name === name);
    if (type === "monthly") {
        const month = document.getElementById("profileMonth").value;
        if (month) settlements = settlements.filter(r => r.date.startsWith(month));
    }
    if (type === "yearly") {
        const year = document.getElementById("profileYear").value;
        if (year) settlements = settlements.filter(r => r.date.startsWith(year));
    }

    const creditSales = sales.filter(r => r.status === "credit" || r.status === "udhar").reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const received = settlements.filter(r => r.type === "received").reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const paid = settlements.filter(r => r.type === "paid").reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const receivable = creditSales - received;
    const balancePayable = payable - paid;


    document.getElementById(
        "profileMilk"
    ).innerText =
        `${totalMilk.toFixed(2)} L`;


    document.getElementById(
        "profileAmount"
    ).innerText =
        money(balancePayable);


    document.getElementById(
        "profileReceivable"
    ).innerText =
        money(receivable);


    const box =
        document.getElementById(
            "profileCards"
        );

    box.innerHTML = "";


    records.slice().sort(recordSort).forEach(r => {

        box.innerHTML += `

        <div class="record-card">

            <h3>
                ${formatDate(r.date)}
                •
                ${sessionName(r.session)}
            </h3>

            <div class="record-info">

                <span>
                    🥛 ${r.milk} L
                </span>

                <span>
                    🧪 ${r.fat != null ? Number(r.fat).toFixed(2) : "बाकी"}
                </span>

                <span>
                    ${
                        r.amount !== null
                            ? money(r.amount)
                            : "-"
                    }
                </span>

                ${r.fat !== null && r.fat !== undefined
                    ? `<button class="edit-btn inline-edit" onclick="editFatRecord('${r.fatId}')">✏️ FAT Edit</button>`
                    : ""}

            </div>

        </div>`;
    });


    if (sales.length) {
        box.innerHTML += `<h3 class="section-heading">🏪 इस व्यक्ति की दूध बिक्री</h3>`;
        sales.slice().sort(recordSort).forEach(r=>{ const status=(r.status==="credit"||r.status==="udhar")?"उधार":"नगद"; box.innerHTML += `<div class="record-card"><h3>🏪 ${formatDate(r.date)} • ${sessionName(r.session)}</h3><div class="record-info"><span>🥛 ${Number(r.quantity||0)} L</span><span>₹ ${Number(r.rate||0)}/L</span><span>💰 ${money(r.amount||0)}</span><span>💳 ${status}</span></div></div>`; });
    }


    const comments = profileComments.filter(c => c.name === name).sort(recordSort);
    box.innerHTML += `<h3 class="section-heading">📝 तारीख के अनुसार टिप्पणियाँ</h3>
        <div class="comment-add-box">
            <textarea id="profileCommentInput" placeholder="आज क्या हुआ, advance दिया, कोई बात याद रखनी हो..."></textarea>
            <button class="save-btn" onclick="addProfileComment()">📝 टिप्पणी सेव करें</button>
        </div>`;
    if (comments.length) {
        comments.forEach(c => {
            box.innerHTML += `<div class="record-card">
                <h3>📅 ${formatDate(c.date)} • ${sessionName(c.session)}</h3>
                <p>${escapeHtml(c.text)}</p>
                <button class="edit-btn" onclick="editProfileComment('${c.id}')">✏️ Edit</button>
                <button class="delete-btn" onclick="deleteProfileComment('${c.id}')">🗑️</button>
            </div>`;
        });
    } else {
        box.innerHTML += `<div class="record-card muted">अभी कोई टिप्पणी नहीं</div>`;
    }

    const tx = getPersonTransactions(name);
    box.innerHTML += `<h3 class="section-heading">💳 Transaction History</h3>`;
    if (tx.length) {
        let running = 0;
        tx.forEach(t => {
            running += Number(t.amount || 0);
            box.innerHTML += `<div class="record-card transaction-card">
                <h3>${escapeHtml(t.label)}</h3>
                <div class="record-info">
                    <span>📅 ${formatDate(t.date)}</span>
                    <span>${sessionName(t.session)}</span>
                    <span class="${t.amount < 0 ? "negative" : "positive"}">${formatSignedMoney(t.amount)}</span>
                    <span>📝 ${escapeHtml(t.note || "-")}</span>
                </div>
            </div>`;
        });
    } else {
        box.innerHTML += `<div class="record-card muted">कोई transaction नहीं</div>`;
    }

    document
        .getElementById("profileData")
        .classList.remove("hidden");
}


/* =====================================================
   PROFILE FILTER RECORDS
===================================================== */

function getProfileFilteredRecords() {

    const name =
        document.getElementById(
            "profileCustomer"
        ).value;

    if (!name) return [];


    let records =
        combinedRecords()
            .filter(
                r => r.name === name
            );


    const type =
        document.getElementById(
            "profileType"
        ).value;


    if (type === "monthly") {

        const month =
            document.getElementById(
                "profileMonth"
            ).value;

        if (month) {

            records =
                records.filter(r =>
                    r.date.startsWith(month)
                );
        }
    }


    if (type === "yearly") {

        const year =
            document.getElementById(
                "profileYear"
            ).value;

        records =
            records.filter(r =>
                r.date.startsWith(year)
            );
    }

    return records;
}



function fillTransactionPage() {
    const select = document.getElementById("transactionCustomer");
    if (!select) return;
    const previous = select.value;
    select.innerHTML = `<option value="">व्यक्ति चुनें</option>`;
    sortedCustomerNames("all").forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = `${isBuyer(name) ? getBuyerSerial(name) : getSellerSerial(name)}. ${name} • ${customerTypeLabel(getCustomerType(name))}`;
        select.appendChild(option);
    });
    if (customers.includes(previous)) select.value = previous;
    renderTransactionPage();
}
function renderTransactionPage() {
    const name = document.getElementById("transactionCustomer")?.value;
    const box = document.getElementById("transactionPageCards");
    if (!box) return;
    if (!name) {
        box.innerHTML = `<div class="record-card muted">व्यक्ति चुनें</div>`;
        const p = document.getElementById("transactionPayable");
        const r = document.getElementById("transactionReceivable");
        if (p) p.innerText = "₹0";
        if (r) r.innerText = "₹0";
        return;
    }
    const balance = getPersonBalance(name);
    document.getElementById("transactionPayable").innerText = money(balance.payable);
    document.getElementById("transactionReceivable").innerText = money(balance.receivable);

    const tx = getPersonTransactions(name);
    box.innerHTML = tx.length ? "" : `<div class="record-card muted">कोई transaction नहीं</div>`;
    tx.forEach(t => {
        box.innerHTML += `<div class="record-card transaction-card">
            <h3>${escapeHtml(t.label)}</h3>
            <div class="record-info">
                <span>📅 ${formatDate(t.date)}</span>
                <span>${sessionName(t.session)}</span>
                <span class="${t.amount < 0 ? "negative" : "positive"}">${formatSignedMoney(t.amount)}</span>
                <span>📝 ${escapeHtml(t.note || "-")}</span>
            </div>
        </div>`;
    });
}

function addProfileComment() {
    const name = document.getElementById("profileCustomer")?.value;
    const input = document.getElementById("profileCommentInput");
    const text = input?.value.trim();
    if (!name) return;
    if (!text) { alert("टिप्पणी लिखें"); return; }
    profileComments.push({
        id: Date.now(), name, date: new Date().toISOString().split("T")[0],
        session: globalSession, text
    });
    saveAll();
    showProfile();
}
function editProfileComment(id) {
    const c = profileComments.find(x => String(x.id) === String(id));
    if (!c) return;
    const text = prompt("टिप्पणी बदलें", c.text);
    if (text === null) return;
    if (!text.trim()) return;
    c.text = text.trim();
    c.updatedAt = Date.now();
    saveAll();
    showProfile();
}
function deleteProfileComment(id) {
    if (!confirm("यह टिप्पणी हटानी है?")) return;
    profileComments = profileComments.filter(x => String(x.id) !== String(id));
    saveAll();
    showProfile();
}

/* =====================================================
   BUSINESS REPORT
===================================================== */

function prepareBusinessReport() {

    fillYears("reportYear");

    document.getElementById(
        "reportType"
    ).value =
        "daily";
    const reportSession = document.getElementById("reportSession");
    if (reportSession) reportSession.value = "all";

    changeReportType();

    generateReport();
}


function changeReportType() {

    const type =
        document.getElementById(
            "reportType"
        ).value;


    document.getElementById(
        "reportDate"
    ).classList.toggle(
        "hidden",
        type !== "daily"
    );


    document.getElementById(
        "reportMonth"
    ).classList.toggle(
        "hidden",
        type !== "monthly"
    );


    document.getElementById(
        "reportYear"
    ).classList.toggle(
        "hidden",
        type !== "yearly"
    );


    generateReport();
}


function matchesReportPeriod(record) {

    const type =
        document.getElementById(
            "reportType"
        ).value;

    const sessionFilter = document.getElementById("reportSession")?.value || "all";
    if (sessionFilter !== "all" && record.session && record.session !== sessionFilter) return false;

    if (type === "all") {
        return true;
    }


    if (type === "daily") {

        const date =
            document.getElementById(
                "reportDate"
            ).value;

        return record.date === date;
    }


    if (type === "monthly") {

        const month =
            document.getElementById(
                "reportMonth"
            ).value;

        return record.date.startsWith(
            month
        );
    }


    if (type === "yearly") {

        const year =
            document.getElementById(
                "reportYear"
            ).value;

        return record.date.startsWith(
            year
        );
    }

    return true;
}


function getBusinessData() {

    const purchaseRecords =
        combinedRecords()
            .filter(
                matchesReportPeriod
            );


    const dairySales =
        mainDairySales.filter(
            matchesReportPeriod
        );


    const expenses =
        expenseRecords.filter(
            matchesReportPeriod
        );


    return {

        purchaseRecords,

        dairySales,

        localSales: saleRecords.filter(matchesReportPeriod),

        expenses

    };
}



function renderReportPurchase(records) {
    const box = document.getElementById("reportPurchaseCards");
    if (!box) return;
    box.innerHTML = records.length ? "" : `<div class="record-card muted">कोई खरीद रिकॉर्ड नहीं</div>`;
    records.slice().sort(recordSort).forEach((r) => {
        box.innerHTML += `<div class="record-card">
            <h3>${getBuyerSerial(r.name)}. ${escapeHtml(r.name)}</h3>
            <div class="record-info">
                <span>📅 ${formatDate(r.date)}</span>
                <span>${sessionName(r.session)}</span>
                <span>🥛 ${Number(r.milk || 0).toFixed(2)} L</span>
                <span>🧪 FAT ${r.fat != null ? Number(r.fat).toFixed(2) : "बाकी"}</span>
                <span>💰 ${r.amount != null ? money(r.amount) : "-"}</span>
            </div>
            ${r.id != null ? `<div class="record-actions">${recordActionButtons("milk", r.id)}</div>` : ""}
        </div>`;
    });
}
function renderReportMainDairy(records) {
    const box = document.getElementById("reportMainDairyCards");
    if (!box) return;
    box.innerHTML = records.length ? "" : `<div class="record-card muted">कोई मुख्य डेयरी बिक्री रिकॉर्ड नहीं</div>`;
    records.slice().sort(recordSort).forEach((r,i) => {
        box.innerHTML += `<div class="record-card"><h3>🏭 मुख्य डेयरी बिक्री</h3>
            <div class="record-info"><span>📅 ${formatDate(r.date)}</span><span>${sessionName(r.session)}</span>
            <span>🥛 ${Number(r.milk||0).toFixed(2)} L</span><span>🧪 FAT ${Number(r.fat||0).toFixed(2)}</span><span>💰 ${money(r.amount||0)}</span></div><div class="record-actions">${recordActionButtons("main", r.id)}</div></div>`;
    });
}
function generateReport() {

    const data =
        getBusinessData();

    renderReportPurchase(data.purchaseRecords);
    renderReportLocalSales(data.localSales);
    renderReportMainDairy(data.dairySales);


    const purchaseMilk =
        data.purchaseRecords.reduce(
            (sum, r) =>
                sum + Number(r.milk),
            0
        );


    const purchaseCost =
        data.purchaseRecords.reduce(
            (sum, r) =>
                sum +
                Number(r.amount || 0),
            0
        );


    const mainDairyIncome =
        data.dairySales.reduce(
            (sum, r) => sum + Number(r.amount || 0),
            0
        );

    // Liters sold through each channel
    const mainDairyMilk =
        data.dairySales.reduce(
            (sum, r) => sum + Number(r.milk || 0),
            0
        );

    const localMilk =
        data.localSales.reduce(
            (sum, r) => sum + Number(r.quantity || 0),
            0
        );

    const localIncome =
        data.localSales.reduce(
            (sum, r) => sum + Number(r.amount || 0),
            0
        );

    // Average FAT of the milk sold to the main dairy.
    // Uses the FAT values actually entered in Main Dairy sale records.
    const fatMilkTotal =
        data.dairySales.reduce(
            (sum, r) => sum + (r.fat != null ? Number(r.milk || 0) * Number(r.fat || 0) : 0),
            0
        );

    const fatMilkLitres =
        data.dairySales.reduce(
            (sum, r) => sum + (r.fat != null ? Number(r.milk || 0) : 0),
            0
        );

    const averageFat =
        fatMilkLitres > 0 ? fatMilkTotal / fatMilkLitres : 0;

    const income = mainDairyIncome + localIncome;


    const petrol =
        data.expenses
            .filter(
                r =>
                    r.type === "petrol"
            )
            .reduce(
                (sum, r) =>
                    sum +
                    Number(r.amount),
                0
            );


    const transport =
        data.expenses
            .filter(
                r =>
                    r.type === "transport"
            )
            .reduce(
                (sum, r) =>
                    sum +
                    Number(r.amount),
                0
            );


    const other =
        data.expenses
            .filter(
                r =>
                    r.type === "other"
            )
            .reduce(
                (sum, r) =>
                    sum +
                    Number(r.amount),
                0
            );


    const expenses =
        petrol +
        transport +
        other;


    const profit =
        income -
        purchaseCost -
        expenses;


    document.getElementById(
        "reportMilk"
    ).innerText =
        `${purchaseMilk.toFixed(2)} L`;


    document.getElementById(
        "reportPurchase"
    ).innerText =
        money(purchaseCost);


    const mainMilkEl = document.getElementById("reportMainDairyMilk");
    if (mainMilkEl) mainMilkEl.innerText = `${mainDairyMilk.toFixed(2)} L`;

    const mainIncomeEl = document.getElementById("reportMainDairyIncome");
    if (mainIncomeEl) mainIncomeEl.innerText = money(mainDairyIncome);

    const localMilkEl = document.getElementById("reportLocalMilk");
    if (localMilkEl) localMilkEl.innerText = `${localMilk.toFixed(2)} L`;

    const localIncomeEl = document.getElementById("reportLocalIncome");
    if (localIncomeEl) localIncomeEl.innerText = money(localIncome);

    const averageFatEl = document.getElementById("reportAverageFat");
    if (averageFatEl) averageFatEl.innerText = averageFat.toFixed(2);

    document.getElementById(
        "reportIncome"
    ).innerText =
        money(income);


    document.getElementById(
        "reportPetrol"
    ).innerText =
        money(petrol);


    document.getElementById(
        "reportTransport"
    ).innerText =
        money(transport);


    document.getElementById(
        "reportOtherExpense"
    ).innerText =
        money(other);


    document.getElementById(
        "reportExpense"
    ).innerText =
        money(expenses);


    const profitCard =
        document.getElementById(
            "profitCard"
        );


    const profitLabel =
        document.getElementById(
            "profitLabel"
        );


    profitCard.classList.remove(
        "profit",
        "loss"
    );


    if (profit >= 0) {

        profitCard.classList.add(
            "profit"
        );

        profitLabel.innerText =
            "🟢 लाभ";

    } else {

        profitCard.classList.add(
            "loss"
        );

        profitLabel.innerText =
            "🔴 नुकसान";
    }


    document.getElementById(
        "reportProfit"
    ).innerText =
        money(Math.abs(profit));


    renderReportExpenses(
        data.expenses
    );


    document
        .getElementById("reportResult")
        .classList.remove("hidden");
}


function renderReportLocalSales(records) {
    const box = document.getElementById("reportLocalSaleCards");
    if (!box) return;
    box.innerHTML = "";
    if (!records.length) {
        box.innerHTML = `<div class="record-card">कोई स्थानीय बिक्री रिकॉर्ड नहीं</div>`;
        return;
    }
    records.slice().sort(recordSort).forEach(r => {
        const status = r.status === "credit" || r.status === "udhar" ? "उधार" : "नगद";
        box.innerHTML += `<div class="record-card"><h3>${getSellerSerial(r.name)}. ${r.name || "ग्राहक"}</h3><div class="record-info"><span>📅 ${formatDate(r.date)}</span><span>${sessionName(r.session)}</span><span>🥛 ${Number(r.quantity || 0).toFixed(2)} L</span><span>₹ ${Number(r.rate || 0).toFixed(2)}/L</span><span>💰 ${money(r.amount || 0)}</span><span>💳 ${status}</span></div><div class="record-actions">${recordActionButtons("sale", r.id)}</div></div>`;
    });
}

function downloadLocalSalesExcel() {
    const records = saleRecords.filter(matchesReportPeriod).slice().sort(recordSort);
    if (!records.length) { alert("चुनी हुई रिपोर्ट अवधि में स्थानीय बिक्री का कोई डेटा नहीं है"); return; }
    const rows = records.map(r => ({
        क्रमांक: getSellerSerial(r.name),
        नाम: r.name || "",
        तारीख: formatDate(r.date),
        समय: sessionName(r.session),
        दूध_लीटर: Number(r.quantity || 0),
        भाव_प्रति_लीटर: Number(r.rate || 0),
        कुल_राशि: Number(r.amount || 0),
        भुगतान: (r.status === "credit" || r.status === "udhar") ? "उधार" : "नगद"
    }));
    createExcel(rows, "स्थानीय_दूध_बिक्री.xlsx", "स्थानीय बिक्री");
}

function renderReportSales(records) {

    const box =
        document.getElementById(
            "reportSaleCards"
        );

    box.innerHTML = "";


    if (!records.length) {

        box.innerHTML =
            `<div class="record-card">
                कोई बिक्री रिकॉर्ड नहीं
            </div>`;

        return;
    }


    records.forEach(r => {

        box.innerHTML += `

        <div class="record-card">

            <h3>
                ${formatDate(r.date)}
            </h3>

            <div class="record-info">

                <span>
                    ${sessionName(r.session)}
                </span>

                <span>
                    🥛 ${r.milk} L
                </span>

                <span>
                    🧪 FAT ${r.fat}
                </span>

                <span>
                    💰 ${money(r.amount)}
                </span>

            </div>

        </div>`;
    });
}


function renderReportExpenses(records) {

    const box =
        document.getElementById(
            "reportExpenseCards"
        );

    box.innerHTML = "";


    if (!records.length) {

        box.innerHTML =
            `<div class="record-card">
                कोई खर्च रिकॉर्ड नहीं
            </div>`;

        return;
    }


    records.forEach(r => {

        box.innerHTML += `

        <div class="record-card">

            <h3>
                ${expenseName(r.type)}
            </h3>

            <div class="record-info">

                <span>
                    📅 ${formatDate(r.date)}
                </span>

                <span>
                    ${sessionName(r.session)}
                </span>

                <span>
                    💰 ${money(r.amount)}
                </span>

                <span>
                    ${r.note || "-"}
                </span>

            </div>

        </div>`;
    });
}


/* =====================================================
   EXCEL
===================================================== */

function formatExcelSheet(ws) {
    if (!ws || !ws["!ref"]) return;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let c = range.s.c; c <= range.e.c; c++) {
        const headerCell = ws[XLSX.utils.encode_cell({ r: 0, c })];
        const header = headerCell ? String(headerCell.v || "") : "";
        const numericColumn = /दूध|लीटर|FAT|फैट|भाव|राशि|₹|मात्रा|rate|amount|quantity/i.test(header);
        for (let r = range.s.r; r <= range.e.r; r++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = ws[addr];
            if (!cell) continue;
            cell.s = cell.s || {};
            cell.s.alignment = { horizontal: "left", vertical: "center" };
            if (r > range.s.r && typeof cell.v === "number" && numericColumn) {
                cell.z = "0.00";
            }
        }
    }
    ws["!cols"] = Array.from({ length: range.e.c + 1 }, (_, c) => {
        const header = ws[XLSX.utils.encode_cell({ r: 0, c })];
        const h = header ? String(header.v || "") : "";
        return { wch: Math.max(12, Math.min(24, h.length + 5)) };
    });
}

function createExcel(
    data,
    fileName,
    sheetName
) {

    if (!data.length) {

        alert(
            "डाउनलोड करने के लिए कोई डेटा नहीं है"
        );

        return;
    }


    const wb =
        XLSX.utils.book_new();


    const ws =
        XLSX.utils.json_to_sheet(
            data
        );

    formatExcelSheet(ws);

    XLSX.utils.book_append_sheet(
        wb,
        ws,
        sheetName
    );

    XLSX.writeFile(
        wb,
        fileName
    );
}


/* =====================================================
   ALL RECORDS EXCEL
===================================================== */

function downloadAllRecordsExcel() {

    const data =
        filterByRecordControls(combinedRecords()).slice().sort(recordSort).map(r => ({

            नाम:
                r.name,

            तारीख:
                formatDate(r.date),

            समय:
                sessionName(r.session),

            "दूध (लीटर)":
                r.milk,

            फैट:
                r.fat ?? "बाकी",

            "फैट भाव":
                r.fatRate ?? "",

            राशि:
                r.amount ?? ""

        }));


    createExcel(
        data,
        "सभी_डेयरी_रिकॉर्ड.xlsx",
        "रिकॉर्ड"
    );
}


/* =====================================================
   PROFILE EXCEL
===================================================== */

function downloadProfileExcel() {

    const name =
        document.getElementById(
            "profileCustomer"
        ).value;

    if (!name) {

        alert("पहले व्यक्ति चुनें");

        return;
    }


    const data =
        getProfileFilteredRecords()
            .map(r => ({

                नाम:
                    r.name,

                तारीख:
                    formatDate(r.date),

                समय:
                    sessionName(r.session),

                दूध:
                    r.milk,

                फैट:
                    r.fat ?? "बाकी",

                राशि:
                    r.amount ?? ""

            }));


    createExcel(
        data,
        `${name}_प्रोफाइल.xlsx`,
        "प्रोफाइल"
    );
}


/* =====================================================
   MAIN DAIRY EXCEL
===================================================== */

function downloadMainDairyExcel() {

    const data =
        mainDairySales.map(r => ({

            तारीख:
                formatDate(r.date),

            समय:
                sessionName(r.session),

            "दूध (लीटर)":
                r.milk,

            फैट:
                r.fat,

            "FAT भाव":
                r.rate,

            राशि:
                r.amount

        }));


    createExcel(
        data,
        "मुख्य_डेयरी_बिक्री.xlsx",
        "मुख्य डेयरी बिक्री"
    );
}


/* =====================================================
   EXPENSE EXCEL
===================================================== */

function downloadExpenseExcel() {

    const data =
        expenseRecords.map(r => ({

            तारीख:
                formatDate(r.date),

            समय:
                sessionName(r.session),

            प्रकार:
                expenseName(r.type),

            राशि:
                r.amount,

            विवरण:
                r.note || ""

        }));


    createExcel(
        data,
        "डेयरी_खर्च.xlsx",
        "खर्च"
    );
}


/* =====================================================
   BUSINESS REPORT EXCEL
===================================================== */

function downloadBusinessReportExcel() {

    const data =
        getBusinessData();


    const purchaseCost =
        data.purchaseRecords.reduce(
            (sum, r) =>
                sum +
                Number(r.amount || 0),
            0
        );


    const mainDairyIncome =
        data.dairySales.reduce(
            (sum, r) => sum + Number(r.amount || 0), 0
        );
    const localIncome =
        data.localSales.reduce(
            (sum, r) => sum + Number(r.amount || 0), 0
        );
    const income = mainDairyIncome + localIncome;


    const petrol =
        data.expenses
            .filter(
                r =>
                    r.type === "petrol"
            )
            .reduce(
                (sum, r) =>
                    sum +
                    Number(r.amount),
                0
            );


    const transport =
        data.expenses
            .filter(
                r =>
                    r.type === "transport"
            )
            .reduce(
                (sum, r) =>
                    sum +
                    Number(r.amount),
                0
            );


    const other =
        data.expenses
            .filter(
                r =>
                    r.type === "other"
            )
            .reduce(
                (sum, r) =>
                    sum +
                    Number(r.amount),
                0
            );


    const totalExpense =
        petrol +
        transport +
        other;


    const profit =
        income -
        purchaseCost -
        totalExpense;


    const summary = [

        {
            विवरण:
                "कुल खरीदा दूध",

            राशि:
                data.purchaseRecords
                    .reduce(
                        (sum, r) =>
                            sum +
                            Number(r.milk),
                        0
                    )
        },

        {
            विवरण:
                "दूध खरीद लागत",

            राशि:
                purchaseCost
        },

        {
            विवरण:
                "कुल बिक्री आय",

            राशि:
                income
        },

        {
            विवरण:
                "स्थानीय दूध बिक्री आय",

            राशि:
                localIncome
        },

        {
            विवरण:
                "पेट्रोल",

            राशि:
                petrol
        },

        {
            विवरण:
                "ट्रांसपोर्ट",

            राशि:
                transport
        },

        {
            विवरण:
                "अन्य खर्च",

            राशि:
                other
        },

        {
            विवरण:
                "कुल खर्च",

            राशि:
                totalExpense
        },

        {
            विवरण:
                profit >= 0
                    ? "लाभ"
                    : "नुकसान",

            राशि:
                Math.abs(profit)
        }

    ];


    const wb =
        XLSX.utils.book_new();


    const summarySheet =
        XLSX.utils.json_to_sheet(
            summary
        );
    formatExcelSheet(summarySheet);


    XLSX.utils.book_append_sheet(
        wb,
        summarySheet,
        "सारांश"
    );


    const saleSheet =
        XLSX.utils.json_to_sheet(
            data.dairySales.map(r => ({

                तारीख:
                    formatDate(r.date),

                समय:
                    sessionName(r.session),

                दूध:
                    r.milk,

                फैट:
                    r.fat,

                भाव:
                    r.rate,

                राशि:
                    r.amount

            }))
        );
    formatExcelSheet(saleSheet);


    XLSX.utils.book_append_sheet(
        wb,
        saleSheet,
        "मुख्य डेयरी बिक्री"
    );

    const localSaleSheet = XLSX.utils.json_to_sheet(
        data.localSales.map(r => ({
            नाम: r.name || "",
            तारीख: formatDate(r.date),
            समय: sessionName(r.session),
            दूध_लीटर: Number(r.quantity || 0),
            भाव_प्रति_लीटर: Number(r.rate || 0),
            राशि: Number(r.amount || 0),
            भुगतान: (r.status === "credit" || r.status === "udhar") ? "उधार" : "नगद"
        }))
    );
    formatExcelSheet(localSaleSheet);
    XLSX.utils.book_append_sheet(wb, localSaleSheet, "स्थानीय बिक्री");

    const expenseSheet =
        XLSX.utils.json_to_sheet(
            data.expenses.map(r => ({

                तारीख:
                    formatDate(r.date),

                समय:
                    sessionName(r.session),

                प्रकार:
                    expenseName(r.type),

                राशि:
                    r.amount,

                विवरण:
                    r.note || ""

            }))
        );


    formatExcelSheet(expenseSheet);
    XLSX.utils.book_append_sheet(
        wb,
        expenseSheet,
        "खर्च"
    );


    XLSX.writeFile(
        wb,
        "डेयरी_लाभ_हानि_रिपोर्ट.xlsx"
    );
}

/* =====================================================
   PAYMENT / SETTLEMENT FIX
===================================================== */
function addSettlement(type) {
    const nameEl = document.getElementById('profileCustomer');
    const name = nameEl ? nameEl.value : '';
    if (!name) { alert('पहले व्यक्ति चुनें'); return; }

    const label = type === 'received' ? 'जमा हुए पैसे' : 'दिए गए पैसे';
    const currentText = type === 'received'
        ? (document.getElementById('profileReceivable')?.innerText || '₹0')
        : (document.getElementById('profileAmount')?.innerText || '₹0');

    const amountText = prompt(`${label} की राशि लिखें\nवर्तमान बाकी: ${currentText}`);
    if (amountText === null) return;
    const amount = Number(String(amountText).replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
        alert('सही राशि लिखें');
        return;
    }

    const dateText = prompt('तारीख लिखें (YYYY-MM-DD)', new Date().toISOString().split('T')[0]);
    if (dateText === null) return;
    const date = String(dateText).trim() || new Date().toISOString().split('T')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        alert('तारीख YYYY-MM-DD format में लिखें');
        return;
    }

    settlementRecords.push({
        id: Date.now(),
        name,
        type: type === 'received' ? 'received' : 'paid',
        amount,
        date,
        session: globalSession,
        note: label
    });
    saveAll();
    showProfile();
    alert(`${money(amount)} सफलतापूर्वक दर्ज हो गए`);
}

function getSettlementRecordsForProfile() {
    const name = document.getElementById('profileCustomer')?.value;
    if (!name) return [];
    let records = settlementRecords.filter(r => r.name === name);
    const type = document.getElementById('profileType')?.value || 'all';
    if (type === 'monthly') {
        const month = document.getElementById('profileMonth')?.value;
        if (month) records = records.filter(r => (r.date || '').startsWith(month));
    } else if (type === 'yearly') {
        const year = document.getElementById('profileYear')?.value;
        if (year) records = records.filter(r => (r.date || '').startsWith(year));
    }
    return records;
}


/* =====================================================
   FINAL RECORD EDIT/DELETE + CLEAR DISPLAY PATCH
   ===================================================== */

let selectedSaleRecordId = null;
let selectedMainDairyRecordId = null;
let selectedExpenseRecordId = null;

function recordActionButtons(type, id) {
    const safe = String(id).replace(/'/g, "\\'");
    if (type === "milk") return `<button class="edit-btn" onclick="editMilkRecord('${safe}')">✏️ Edit</button><button class="delete-btn" onclick="deleteMilkRecord('${safe}')">🗑️ Delete</button>`;
    if (type === "fat") return `<button class="edit-btn" onclick="editFatRecord('${safe}')">✏️ Edit</button><button class="delete-btn" onclick="deleteFatRecord('${safe}')">🗑️ Delete</button>`;
    if (type === "sale") return `<button class="edit-btn" onclick="editSaleRecord('${safe}')">✏️ Edit</button><button class="delete-btn" onclick="deleteSaleRecord('${safe}')">🗑️ Delete</button>`;
    if (type === "main") return `<button class="edit-btn" onclick="editMainDairyRecord('${safe}')">✏️ Edit</button><button class="delete-btn" onclick="deleteMainDairyRecord('${safe}')">🗑️ Delete</button>`;
    if (type === "expense") return `<button class="edit-btn" onclick="editExpenseRecord('${safe}')">✏️ Edit</button><button class="delete-btn" onclick="deleteExpenseRecord('${safe}')">🗑️ Delete</button>`;
    return "";
}

function editMilkRecord(id) {
    const r = milkRecords.find(x => String(x.id) === String(id));
    if (!r) return;
    globalSession = r.session || globalSession;
    storeSet("globalSession", globalSession);
    const d = document.getElementById("milkDate"); if (d) d.value = r.date;
    selectMilkPerson(r.name);
}

function deleteFatRecord(id) {
    const r = fatRecords.find(x => String(x.id) === String(id));
    if (!r) return;
    if (!confirm(`${r.name} का ${formatDate(r.date)} ${sessionName(r.session)} FAT ${r.fat} हटाना है?`)) return;
    fatRecords = fatRecords.filter(x => String(x.id) !== String(id));
    saveAll();
    loadFatQueue();
    updateHome();
    if (typeof renderRecords === 'function') renderRecords();
}

function renderFatRecordedList(queue, date) {
    const box = document.getElementById("fatRecordedList");
    if (!box) return;
    const records = queue.map(p => fatRecords.find(f => f.name === p.name && f.date === date && f.session === globalSession)).filter(Boolean).sort(recordSort);
    box.innerHTML = records.length ? `<h3 style="margin:0 0 8px;">आज दर्ज किया हुआ FAT</h3>` : "";
    records.forEach(r => {
        const milk = Number(milkRecords.find(m=>m.name===r.name&&m.date===r.date&&m.session===r.session)?.milk||0);
        box.innerHTML += `<div class="record-card" style="margin-bottom:8px;">
            <h3>${getBuyerSerial(r.name)}. ${escapeHtml(r.name)}</h3>
            <div class="record-info">
              <span>🥛 दूध: <strong>${milk.toFixed(2)} L</strong></span>
              <span>🧪 FAT: <strong>${Number(r.fat).toFixed(2)}</strong></span>
              <span>💰 राशि: <strong>${money(r.amount||0)}</strong></span>
            </div>
            <div class="record-actions">${recordActionButtons('fat', r.id)}</div>
        </div>`;
    });
}

function saveFat() {
    if (fatRate <= 0) return alert("पहले मेन्यू से फैट का भाव सेट करें");
    const button = document.getElementById("fatSaveBtn");
    const name = button?.dataset.name;
    const milk = Number(button?.dataset.milk || 0);
    const date = document.getElementById("fatDate")?.value;
    const fat = Number(document.getElementById("fatValue")?.value);
    if (!name || !date || milk <= 0 || fat <= 0) return alert("फैट लिखें");
    const editId = button.dataset.editId;
    let existing = editId ? fatRecords.find(f => String(f.id) === String(editId)) : null;
    if (!existing) existing = fatRecords.find(f => f.name===name && f.date===date && f.session===globalSession);
    if (existing) {
        existing.fat = fat;
        existing.fatRate = Number(existing.fatRate || fatRate);
        existing.amount = fat * existing.fatRate * milk;
        existing.updatedAt = Date.now();
    } else {
        fatRecords.push({ id: Date.now(), name, date, session: globalSession, fat, fatRate, amount: fat * fatRate * milk });
    }
    saveAll();
    button.innerText = "✓ फैट सेव करें";
    delete button.dataset.editId;
    const recorded = document.getElementById("fatRecordedValue"); if (recorded) recorded.innerText = `FAT ${fat}`;
    loadFatQueue();
    updateHome();
    if (typeof renderRecords === 'function') renderRecords();
}

function editFatRecord(id) {
    const record = fatRecords.find(f => String(f.id) === String(id));
    if (!record) return;
    globalSession = record.session || globalSession;
    storeSet("globalSession", globalSession);
    openPage("fatPage");
    const dateEl = document.getElementById("fatDate"); if (dateEl) dateEl.value = record.date;
    const milk = Number(milkRecords.find(m => m.name===record.name && m.date===record.date && m.session===record.session)?.milk || 0);
    const nameEl=document.getElementById("fatPersonName"); if(nameEl) nameEl.innerText=record.name;
    const serialEl=document.getElementById("fatSerial"); if(serialEl) serialEl.innerText=getBuyerSerial(record.name);
    const milkEl=document.getElementById("fatPersonMilk"); if(milkEl) milkEl.innerText=`${milk.toFixed(2)} L`;
    const valueEl=document.getElementById("fatValue"); if(valueEl) valueEl.value=record.fat;
    const btn=document.getElementById("fatSaveBtn");
    if(btn){ btn.dataset.name=record.name; btn.dataset.milk=milk; btn.dataset.editId=record.id; btn.innerText="✓ FAT अपडेट करें"; btn.style.display="block"; }
    const rec=document.getElementById("fatRecordedValue"); if(rec) rec.innerText=`FAT ${record.fat}`;
    const edit=document.getElementById("fatEditCurrentBtn"); if(edit){ edit.style.display="inline-block"; edit.dataset.id=record.id; }
    previewFat();
}

function renderSaleNames() {
    const box=document.getElementById("saleNameList"); if(!box) return;
    const date=document.getElementById("saleDate")?.value || today;
    box.innerHTML="";
    sortedCustomerNames("seller").forEach(name=>{
        if(!isSeller(name)) return;
        const records=saleRecords.filter(r=>r.name===name && r.date===date && r.session===globalSession).sort(recordSort);
        const total=records.reduce((s,r)=>s+Number(r.quantity||0),0);
        const amount=records.reduce((s,r)=>s+Number(r.amount||0),0);
        const item=document.createElement("div"); item.className=`name-item ${records.length?"done":""}`;
        const info=document.createElement("span");
        info.innerHTML=`<strong>${getSellerSerial(name)}. ${escapeHtml(name)}</strong><br><small>${records.length ? `✓ आज ${total.toFixed(2)} L • ${money(amount)}` : "आज बिक्री दर्ज नहीं"}</small>`;
        const actions=document.createElement("div"); actions.style.cssText="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;";
        const add=document.createElement("button"); add.innerText=records.length?"➕ और जोड़ें":"चुनें →"; add.onclick=()=>selectSalePerson(name); actions.appendChild(add);
        if(records.length){ records.forEach(r=>{ const e=document.createElement('button'); e.className='edit-btn'; e.innerText='✏️'; e.title=`${r.quantity} L Edit`; e.onclick=()=>editSaleRecord(r.id); actions.appendChild(e); const d=document.createElement('button'); d.className='delete-btn'; d.innerText='🗑️'; d.title='यह बिक्री हटाएँ'; d.onclick=()=>deleteSaleRecord(r.id); actions.appendChild(d); }); }
        item.appendChild(info); item.appendChild(actions); box.appendChild(item);
    });
}

function editSaleRecord(id){
    const r=saleRecords.find(x=>String(x.id)===String(id)); if(!r) return;
    selectedSaleRecordId=r.id; selectedSalePerson=r.name;
    globalSession=r.session||globalSession; storeSet("globalSession",globalSession);
    const d=document.getElementById("saleDate"); if(d)d.value=r.date;
    document.getElementById("salePersonName").innerText=r.name;
    document.getElementById("saleEntryInfo").innerText=`${formatDate(r.date)} • ${sessionName(r.session)} • बिक्री Edit`;
    document.getElementById("saleQuantity").value=r.quantity;
    document.getElementById("saleRateDisplay").innerText=milkSaleRate;
    setPayment(r.status||"cash");
    const btn=document.querySelector('#saleEntryPage .big-save'); if(btn)btn.innerText="✓ बिक्री अपडेट करें";
    previewSaleAmount(); openPage("saleEntryPage");
}

function deleteSaleRecord(id){
    const r=saleRecords.find(x=>String(x.id)===String(id)); if(!r)return;
    if(!confirm(`${r.name} की ${formatDate(r.date)} ${sessionName(r.session)} की ${r.quantity} L बिक्री हटानी है?`))return;
    saleRecords=saleRecords.filter(x=>String(x.id)!==String(id)); saveAll(); renderSaleNames(); renderRecords(); updateHome();
}

function saveSaleFast(){
    if(milkSaleRate<=0)return alert("पहले मेन्यू से दूध का भाव सेट करें");
    const quantity=Number(document.getElementById("saleQuantity")?.value); const date=document.getElementById("saleDate")?.value;
    if(!selectedSalePerson||!date||quantity<=0)return alert("दूध की मात्रा लिखें");
    let r=selectedSaleRecordId ? saleRecords.find(x=>String(x.id)===String(selectedSaleRecordId)) : null;
    if(!r){ r={id:Date.now()}; saleRecords.push(r); }
    r.name=selectedSalePerson; r.date=date; r.session=globalSession; r.quantity=quantity; r.rate=milkSaleRate; r.amount=quantity*milkSaleRate; r.status=salePayment; r.updatedAt=Date.now();
    saveAll(); selectedSaleRecordId=null; selectedSalePerson=null;
    const btn=document.querySelector('#saleEntryPage .big-save'); if(btn)btn.innerText="✓ बिक्री सेव करें";
    openSaleNames(); renderSaleNames(); updateHome(); renderRecords();
}

function editMainDairyRecord(id){
    const r=mainDairySales.find(x=>String(x.id)===String(id)); if(!r)return;
    selectedMainDairyRecordId=r.id; globalSession=r.session||globalSession; storeSet("globalSession",globalSession);
    openPage("mainDairySalePage");
    document.getElementById("mainDairyDate").value=r.date; document.getElementById("mainDairyMilk").value=r.milk; document.getElementById("mainDairyFat").value=r.fat; previewMainDairyAmount();
    const btn=document.querySelector('#mainDairySalePage .big-save'); if(btn)btn.innerText="✓ बिक्री अपडेट करें";
}
function deleteMainDairyRecord(id){
    const r=mainDairySales.find(x=>String(x.id)===String(id)); if(!r)return;
    if(!confirm(`${formatDate(r.date)} ${sessionName(r.session)} की मुख्य डेयरी बिक्री ${r.milk} L हटानी है?`))return;
    mainDairySales=mainDairySales.filter(x=>String(x.id)!==String(id)); saveAll(); renderMainDairyRecords(); renderRecords(); generateReport();
}
function saveMainDairySale(){
    if(mainDairyFatRate<=0)return alert("पहले मुख्य डेयरी FAT भाव सेट करें");
    const date=document.getElementById("mainDairyDate")?.value; const milk=Number(document.getElementById("mainDairyMilk")?.value); const fat=Number(document.getElementById("mainDairyFat")?.value);
    if(!date||milk<=0||fat<=0)return alert("तारीख, दूध और फैट सही लिखें");
    let r=selectedMainDairyRecordId?mainDairySales.find(x=>String(x.id)===String(selectedMainDairyRecordId)):null;
    if(!r){r={id:Date.now()};mainDairySales.push(r);}
    r.date=date;r.session=globalSession;r.milk=milk;r.fat=fat;r.rate=mainDairyFatRate;r.amount=milk*fat*mainDairyFatRate;r.updatedAt=Date.now();
    saveAll();selectedMainDairyRecordId=null;
    document.getElementById("mainDairyMilk").value="";document.getElementById("mainDairyFat").value="";document.getElementById("mainDairyAmountPreview").innerText="0";
    const btn=document.querySelector('#mainDairySalePage .big-save');if(btn)btn.innerText="✓ बिक्री सेव करें";
    renderMainDairyRecords();renderRecords();generateReport();
}
function renderMainDairyRecords(){
    const box=document.getElementById("mainDairyRecords");if(!box)return;box.innerHTML="";
    mainDairySales.slice().sort(recordSort).slice(0,50).forEach(r=>{
        box.innerHTML+=`<div class="record-card"><h3>🏭 मुख्य डेयरी</h3><div class="record-info"><span>📅 तारीख: <strong>${formatDate(r.date)}</strong></span><span>🕒 समय: <strong>${sessionName(r.session)}</strong></span><span>🥛 दूध: <strong>${Number(r.milk).toFixed(2)} L</strong></span><span>🧪 FAT: <strong>${Number(r.fat).toFixed(2)}</strong></span><span>💰 राशि: <strong>${money(r.amount||0)}</strong></span></div><div class="record-actions">${recordActionButtons('main',r.id)}</div></div>`;
    });
}

function editExpenseRecord(id){
    const r=expenseRecords.find(x=>String(x.id)===String(id));if(!r)return;selectedExpenseRecordId=r.id;globalSession=r.session||globalSession;storeSet("globalSession",globalSession);openPage("expensePage");document.getElementById("expenseDate").value=r.date;document.getElementById("expenseType").value=r.type;document.getElementById("expenseAmount").value=r.amount;document.getElementById("expenseNote").value=r.note||"";const b=document.querySelector('#expensePage .big-save');if(b)b.innerText="✓ खर्च अपडेट करें";
}
function deleteExpenseRecord(id){const r=expenseRecords.find(x=>String(x.id)===String(id));if(!r)return;if(!confirm(`${expenseName(r.type)} ${money(r.amount)} का खर्च हटाना है?`))return;expenseRecords=expenseRecords.filter(x=>String(x.id)!==String(id));saveAll();renderExpenses();generateReport();}
function saveExpense(){
    const date=document.getElementById("expenseDate")?.value,type=document.getElementById("expenseType")?.value,amount=Number(document.getElementById("expenseAmount")?.value),note=document.getElementById("expenseNote")?.value.trim()||"";
    if(!date||amount<=0)return alert("तारीख और सही राशि लिखें");
    let r=selectedExpenseRecordId?expenseRecords.find(x=>String(x.id)===String(selectedExpenseRecordId)):null;if(!r){r={id:Date.now()};expenseRecords.push(r);}
    r.date=date;r.session=globalSession;r.type=type;r.amount=amount;r.note=note;r.updatedAt=Date.now();saveAll();selectedExpenseRecordId=null;document.getElementById("expenseAmount").value="";document.getElementById("expenseNote").value="";const b=document.querySelector('#expensePage .big-save');if(b)b.innerText="✓ खर्च सेव करें";renderExpenses();generateReport();
}
function renderExpenses(){const box=document.getElementById("expenseRecords");if(!box)return;box.innerHTML="";expenseRecords.slice().sort(recordSort).slice(0,50).forEach(r=>{box.innerHTML+=`<div class="record-card"><h3>${expenseName(r.type)}</h3><div class="record-info"><span>📅 तारीख: <strong>${formatDate(r.date)}</strong></span><span>🕒 समय: <strong>${sessionName(r.session)}</strong></span><span>💰 राशि: <strong>${money(r.amount)}</strong></span><span>📝 विवरण: <strong>${escapeHtml(r.note||"-")}</strong></span></div><div class="record-actions">${recordActionButtons('expense',r.id)}</div></div>`;});}

function renderAllLocalSales(records){const box=document.getElementById("allLocalSaleCards");if(!box)return;records=records.slice().sort(recordSort);box.innerHTML=records.length?"":"<div class=\"record-card\">कोई स्थानीय बिक्री रिकॉर्ड नहीं</div>";records.forEach(r=>{box.innerHTML+=`<div class="record-card"><h3>${getSellerSerial(r.name)}. ${escapeHtml(r.name||"ग्राहक")}</h3><div class="record-info"><span>📅 तारीख: <strong>${formatDate(r.date)}</strong></span><span>🕒 समय: <strong>${sessionName(r.session)}</strong></span><span>🥛 दूध: <strong>${Number(r.quantity||0).toFixed(2)} L</strong></span><span>💵 भाव: <strong>${money(r.rate||0)}/L</strong></span><span>💰 राशि: <strong>${money(r.amount||0)}</strong></span><span>💳 भुगतान: <strong>${(r.status==='credit'||r.status==='udhar')?'उधार':'नगद'}</strong></span></div><div class="record-actions">${recordActionButtons('sale',r.id)}</div></div>`;});}

function renderRecords(){
    const records=filterByRecordControls(combinedRecords()).slice().sort(recordSort), localSales=filterByRecordControls(saleRecords).slice().sort(recordSort), mainSales=filterByRecordControls(mainDairySales).slice().sort(recordSort);
    const milk=records.reduce((s,r)=>s+Number(r.milk||0),0), amount=records.reduce((s,r)=>s+Number(r.amount||0),0);
    document.getElementById("totalMilk").innerText=`${milk.toFixed(2)} L`;document.getElementById("totalAmount").innerText=money(amount);document.getElementById("totalDays").innerText=records.length;
    const box=document.getElementById("recordsCards");if(box){box.innerHTML=records.length?"":"<div class=\"record-card\">चुने हुए फिल्टर के अनुसार कोई रिकॉर्ड नहीं</div>";records.forEach(r=>{box.innerHTML+=`<div class="record-card"><h3>${getBuyerSerial(r.name)}. ${escapeHtml(r.name)}</h3><div class="record-info"><span>📅 तारीख: <strong>${formatDate(r.date)}</strong></span><span>🕒 समय: <strong>${sessionName(r.session)}</strong></span><span>🥛 दूध: <strong>${Number(r.milk||0).toFixed(2)} L</strong></span><span>🧪 FAT: <strong>${r.fat??"बाकी"}</strong></span><span>💰 राशि: <strong>${r.amount!=null?money(r.amount):"-"}</strong></span></div><div class="record-actions">${recordActionButtons('milk',r.id)}</div></div>`;});}
    renderAllLocalSales(localSales);renderAllMainDairySales(mainSales);
}
function renderAllMainDairySales(records){const box=document.getElementById("allMainDairySaleCards");if(!box)return;records=records.slice().sort(recordSort);box.innerHTML=records.length?"":"<div class=\"record-card\">कोई मुख्य डेयरी बिक्री रिकॉर्ड नहीं</div>";records.forEach(r=>{box.innerHTML+=`<div class="record-card"><h3>🏭 मुख्य डेयरी</h3><div class="record-info"><span>📅 तारीख: <strong>${formatDate(r.date)}</strong></span><span>🕒 समय: <strong>${sessionName(r.session)}</strong></span><span>🥛 दूध: <strong>${Number(r.milk||0).toFixed(2)} L</strong></span><span>🧪 FAT: <strong>${Number(r.fat||0).toFixed(2)}</strong></span><span>💰 राशि: <strong>${money(r.amount||0)}</strong></span></div><div class="record-actions">${recordActionButtons('main',r.id)}</div></div>`;});}

function downloadAllRecordsExcel(){
    const rows=filterByRecordControls(combinedRecords()).slice().sort(recordSort).map(r=>({क्रमांक:getBuyerSerial(r.name),नाम:r.name||"",तारीख:formatDate(r.date),समय:sessionName(r.session),"दूध (लीटर)":Number(r.milk||0),FAT:r.fat??"बाकी","FAT भाव":r.fatRate??"",राशि:r.amount??""}));
    createExcel(rows,"सभी_डेयरी_रिकॉर्ड.xlsx","रिकॉर्ड");
}
function downloadProfileExcel(){
    const name=document.getElementById("profileCustomer")?.value;if(!name)return alert("पहले व्यक्ति चुनें");
    const rows=getProfileFilteredRecords().slice().sort(recordSort).map(r=>({क्रमांक:getBuyerSerial(r.name),नाम:r.name||"",तारीख:formatDate(r.date),समय:sessionName(r.session),"दूध (लीटर)":Number(r.milk||0),FAT:r.fat??"बाकी",राशि:r.amount??""}));createExcel(rows,`${name}_प्रोफाइल.xlsx`,`प्रोफाइल`);
}
function downloadAllLocalSalesExcel(){const rows=filterByRecordControls(saleRecords).slice().sort(recordSort).map(r=>({क्रमांक:getSellerSerial(r.name||""),नाम:r.name||"",तारीख:formatDate(r.date),समय:sessionName(r.session),"दूध (लीटर)":Number(r.quantity||0),"भाव (₹/L)":Number(r.rate||0),"कुल राशि (₹)":Number(r.amount||0),भुगतान:(r.status==='credit'||r.status==='udhar')?'उधार':'नगद'}));if(!rows.length)return alert("कोई स्थानीय बिक्री रिकॉर्ड नहीं है");createExcel(rows,"स्थानीय_दूध_बिक्री.xlsx","स्थानीय बिक्री");}
function downloadMainDairyExcel(){const rows=mainDairySales.slice().sort(recordSort).map(r=>({क्रमांक:"",नाम:"मुख्य डेयरी",तारीख:formatDate(r.date),समय:sessionName(r.session),"दूध (लीटर)":Number(r.milk||0),FAT:Number(r.fat||0),"FAT भाव":Number(r.rate||0),"कुल राशि (₹)":Number(r.amount||0)}));createExcel(rows,"मुख्य_डेयरी_बिक्री.xlsx","मुख्य डेयरी बिक्री");}
function downloadExpenseExcel(){const rows=expenseRecords.slice().sort(recordSort).map(r=>({तारीख:formatDate(r.date),समय:sessionName(r.session),प्रकार:expenseName(r.type),"राशि (₹)":Number(r.amount||0),विवरण:r.note||""}));createExcel(rows,"डेयरी_खर्च.xlsx","खर्च");}

/* FINAL REPORT ACTIONS */
function renderReportPurchase(records) {
    const box=document.getElementById("reportPurchaseCards"); if(!box)return;
    records=records.slice().sort(recordSort); box.innerHTML=records.length?"":"<div class='record-card muted'>कोई खरीद रिकॉर्ड नहीं</div>";
    records.forEach(r=>{box.innerHTML+=`<div class="record-card"><h3>${getBuyerSerial(r.name)}. ${escapeHtml(r.name)}</h3><div class="record-info"><span>📅 तारीख: <strong>${formatDate(r.date)}</strong></span><span>🕒 समय: <strong>${sessionName(r.session)}</strong></span><span>🥛 दूध: <strong>${Number(r.milk||0).toFixed(2)} L</strong></span><span>🧪 FAT: <strong>${r.fat??"बाकी"}</strong></span><span>💰 राशि: <strong>${r.amount!=null?money(r.amount):"-"}</strong></span></div><div class="record-actions">${recordActionButtons('milk',r.id)}</div></div>`;});
}
function renderReportLocalSales(records) {
    const box=document.getElementById("reportLocalSaleCards"); if(!box)return;
    records=records.slice().sort(recordSort); box.innerHTML=records.length?"":"<div class='record-card muted'>कोई स्थानीय बिक्री रिकॉर्ड नहीं</div>";
    records.forEach(r=>{box.innerHTML+=`<div class="record-card"><h3>${getSellerSerial(r.name)}. ${escapeHtml(r.name||"ग्राहक")}</h3><div class="record-info"><span>📅 तारीख: <strong>${formatDate(r.date)}</strong></span><span>🕒 समय: <strong>${sessionName(r.session)}</strong></span><span>🥛 दूध: <strong>${Number(r.quantity||0).toFixed(2)} L</strong></span><span>💵 भाव: <strong>${money(r.rate||0)}/L</strong></span><span>💰 राशि: <strong>${money(r.amount||0)}</strong></span><span>💳 भुगतान: <strong>${(r.status==='credit'||r.status==='udhar')?'उधार':'नगद'}</strong></span></div><div class="record-actions">${recordActionButtons('sale',r.id)}</div></div>`;});
}
function renderReportMainDairy(records) {
    const box=document.getElementById("reportMainDairyCards"); if(!box)return;
    records=records.slice().sort(recordSort); box.innerHTML=records.length?"":"<div class='record-card muted'>कोई मुख्य डेयरी बिक्री रिकॉर्ड नहीं</div>";
    records.forEach(r=>{box.innerHTML+=`<div class="record-card"><h3>🏭 मुख्य डेयरी बिक्री</h3><div class="record-info"><span>📅 तारीख: <strong>${formatDate(r.date)}</strong></span><span>🕒 समय: <strong>${sessionName(r.session)}</strong></span><span>🥛 दूध: <strong>${Number(r.milk||0).toFixed(2)} L</strong></span><span>🧪 FAT: <strong>${Number(r.fat||0).toFixed(2)}</strong></span><span>💰 राशि: <strong>${money(r.amount||0)}</strong></span></div><div class="record-actions">${recordActionButtons('main',r.id)}</div></div>`;});
}
function downloadMainDairyExcel(){
    const rows=filterByRecordControls(mainDairySales).slice().sort(recordSort).map(r=>({क्रमांक:"",नाम:"मुख्य डेयरी",तारीख:formatDate(r.date),समय:sessionName(r.session),"दूध (लीटर)":Number(r.milk||0),FAT:Number(r.fat||0),"FAT भाव":Number(r.rate||0),"कुल राशि (₹)":Number(r.amount||0)}));
    if(!rows.length)return alert("चुने हुए फिल्टर के अनुसार कोई मुख्य डेयरी रिकॉर्ड नहीं है");
    createExcel(rows,"मुख्य_डेयरी_बिक्री.xlsx","मुख्य डेयरी बिक्री");
}
