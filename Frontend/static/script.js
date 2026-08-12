// === STATE & DOM ===
const API_BASE = "http://127.0.0.1:8000";
let adminToken = sessionStorage.getItem("adminToken");

const splashScreen = document.getElementById("splash-screen");
const loginView = document.getElementById("login-view");
const appLayout = document.getElementById("app-layout");
const devicesGrid = document.getElementById("devices-grid");
const emptyState = document.getElementById("empty-state");
const pendingModal = document.getElementById("pending-modal");
const pendingList = document.getElementById("pending-list");
const detailModal = document.getElementById("device-detail-overlay");

let activeDevice = null;
let activeTab = 'cpu'; 
let metricChart = null; 
let backendData = {}; 

// === 1. INITIALIZATION & SPLASH ===
window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        splashScreen.classList.add("hidden");
        
        // Auto-login if token exists
        if (adminToken) {
            showDashboard();
        } else {
            loginView.classList.remove("hidden");
        }
    }, 3200);
});

// === 2. AUTHENTICATION API ===
const loginError = document.getElementById("login-error");

document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = document.getElementById("username").value;
    const pass = document.getElementById("password").value;
    
    // Hide error when trying again
    loginError.classList.add("hidden");
    
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: user, password: pass })
        });

        if (!res.ok) {
            // Wrong username or password
            loginError.textContent = "Invalid username or password.";
            loginError.classList.remove("hidden");
            return; // Stop here, don't login
        }
        
        const data = await res.json();
        adminToken = data.access_token;
        sessionStorage.setItem("adminToken", adminToken);
        
        showDashboard();
    } catch (err) {
        // Server is offline or CORS is still blocking
        loginError.textContent = "Could not connect to the server.";
        loginError.classList.remove("hidden");
    }
});

function showDashboard() {
    loginView.classList.add("hidden");
    appLayout.classList.remove("hidden");
    initWebSocket();
}

// Custom Fetch Wrapper for JWT
async function authFetch(endpoint, options = {}) {
    if (!options.headers) options.headers = {};
    options.headers["Authorization"] = `Bearer ${adminToken}`;
    
    if (options.body && typeof options.body === 'object') {
        options.body = JSON.stringify(options.body);
        options.headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${API_BASE}${endpoint}`, options);
    
    // Auto-logout if token expires
    if (res.status === 401) {
        sessionStorage.removeItem("adminToken");
        location.reload();
    }
    
    return res;
}

document.getElementById("btn-logout").addEventListener("click", () => {
    sessionStorage.removeItem("adminToken");
    location.reload();
});

// === 3. DEVICE MANAGEMENT API ===

document.getElementById("btn-add-initial").addEventListener("click", openPendingModal);
document.getElementById("btn-show-pending").addEventListener("click", openPendingModal);

async function openPendingModal() {
    pendingModal.classList.remove("hidden");
    pendingList.innerHTML = `<div style="text-align:center; padding:20px; color:var(--arch-gray)">Loading...</div>`;
    
    try {
        // Your backend returns: [{"enrollment_code": "...", "name": "...", ...}]
        const res = await authFetch("/device/pending");
        const pendingDevices = await res.json(); 
        
        pendingList.innerHTML = "";
        
        if (pendingDevices.length === 0) {
            pendingList.innerHTML = `<div style="text-align:center; padding:20px; color:var(--arch-gray)">No devices waiting to connect.</div>`;
            return;
        }

        pendingDevices.forEach(device => {
            const div = document.createElement("div");
            div.className = "pending-item neu-inset-panel";
            div.innerHTML = `
                <div class="device-info">
                    <strong>${device.name || "Unknown Device"}</strong>
                    <br><span style="font-size:0.8rem; color:var(--arch-gray)">IP: ${device.ip} | OS: ${device.type}</span>
                </div>
                <div class="action-buttons">
                    <button class="neu-btn-action accept" onclick="approveDevice('${device.enrollment_code}')"><i class="fa-solid fa-check"></i></button>
                    <button class="neu-btn-action reject" onclick="rejectDevice('${device.enrollment_code}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            pendingList.appendChild(div);
        });
    } catch (err) {
        pendingList.innerHTML = `<div style="text-align:center; color:var(--arch-red)">Failed to load pending devices.</div>`;
    }
}

// Approve API
window.approveDevice = async function(code) {
    try {
        await authFetch("/device/approved", { method: "POST", body: { enrollment_code: code } });
        openPendingModal(); // refresh list
    } catch (err) { alert("Error approving device."); }
}

// Reject API
window.rejectDevice = async function(code) {
    try {
        await authFetch("/device/rejected", { method: "POST", body: { enrollment_code: code } });
        openPendingModal(); // refresh list
    } catch (err) { alert("Error rejecting device."); }
}

// Delete Active Device API
document.getElementById("btn-delete-device").addEventListener("click", async () => {
    if (!activeDevice || !confirm("Are you sure you want to revoke this device?")) return;
    
    try {
        await authFetch(`/device/${activeDevice.id}`, { method: "DELETE" });
        detailModal.classList.add("hidden");
        activeDevice = null;
    } catch (err) {
        alert("Failed to delete device.");
    }
});

// Close modals
document.querySelectorAll(".close-modal").forEach(btn => {
    btn.addEventListener("click", () => pendingModal.classList.add("hidden"));
});
document.querySelector(".close-detail").addEventListener("click", () => {
    detailModal.classList.add("hidden");
    activeDevice = null;
});

// === 4. WEBSOCKET (Live Metrics) ===
function initWebSocket() {
    const socket = new WebSocket("ws://127.0.0.1:8000/ws");
    
    socket.onopen = () => console.log("🟢 WebSocket Connected");
    socket.onclose = () => {
        console.log("🔴 WebSocket Disconnected. Reconnecting in 3s...");
        setTimeout(initWebSocket, 3000);
    };
    
    socket.onmessage = (event) => {
        backendData = JSON.parse(event.data);
        renderGrid();
        
        if (activeDevice && backendData[activeDevice.id]) {
            updateDetailView(backendData[activeDevice.id]);
        } else if (activeDevice && !backendData[activeDevice.id]) {
            detailModal.classList.add("hidden");
            activeDevice = null;
        }
    };
}

// === 5. RENDER GRID ===
function renderGrid() {
    const ids = Object.keys(backendData);
    
    if (ids.length === 0) {
        emptyState.classList.remove("hidden");
        devicesGrid.classList.add("hidden");
        return;
    }
    
    emptyState.classList.add("hidden");
    devicesGrid.classList.remove("hidden");
    devicesGrid.innerHTML = ""; 
    
    ids.forEach(id => {
        const dev = backendData[id];
        
        // Ensure AI Prediction is readable
        let ai = dev.prediction ? String(dev.prediction).toUpperCase() : "NO DATA";
        if (ai === "0" || ai === "NORMAL") ai = "NORMAL";
        else if (ai !== "NO DATA") ai = "ATTACK";

        let borderClass = "status-gray"; 
        let cpu = dev.metrics ? Math.round(dev.metrics.cpu_usage || 0) : 0;
        let ram = dev.metrics ? Math.round(dev.metrics.ram_usage || 0) : 0;
        
        if (dev.metrics) {
            if (ai === "NORMAL") {
                if (cpu > 80) borderClass = "status-yellow"; 
                else borderClass = "status-green";
            } else {
                borderClass = "status-red"; 
            }
        }
        
        const card = document.createElement("div");
        card.className = `device-card ${borderClass}`;
        
        card.innerHTML = `
            <i class="fa-solid fa-shield-halved card-watermark"></i>
            <div class="card-header">
                <div>
                    <div class="card-title">${dev.name}</div>
                    <div class="card-ip">${dev.ip} | ${dev.type}</div>
                </div>
                <div><i class="fa-solid ${dev.type === 'windows' ? 'fa-windows' : 'fa-linux'} fa-2x" style="color:var(--arch-gray)"></i></div>
            </div>
            <div class="card-metrics">
                <div class="mini-stat">
                    <div class="mini-val" style="color: ${getStatColor(cpu)}">${cpu}%</div>
                    <div class="mini-lbl">CPU</div>
                </div>
                <div class="mini-stat">
                    <div class="mini-val" style="color: ${getStatColor(ram)}">${ram}%</div>
                    <div class="mini-lbl">RAM</div>
                </div>
                <div class="mini-stat">
                    <div class="mini-val" style="color: var(--text-dark)">${ai === 'NO DATA' ? '--' : (ai === 'NORMAL' ? 'OK' : 'ERR')}</div>
                    <div class="mini-lbl">AI STATE</div>
                </div>
            </div>
        `;
        
        card.addEventListener("click", () => openDetail(id, dev));
        devicesGrid.appendChild(card);
    });
}

function getStatColor(val) {
    if(val > 85) return "var(--arch-red)";
    if(val > 65) return "var(--arch-yellow)";
    return "var(--arch-green)";
}

// === 6. DEVICE DETAIL & CHARTS ===
function openDetail(id, dev) {
    activeDevice = { id: id };
    detailModal.classList.remove("hidden");
    if (!metricChart) initChart();
    updateDetailView(dev);
}

document.querySelectorAll(".neu-tab").forEach(tab => {
    tab.addEventListener("click", (e) => {
        document.querySelectorAll(".neu-tab").forEach(t => t.classList.remove("active"));
        e.target.classList.add("active");
        activeTab = e.target.dataset.metric;
        if(activeDevice && backendData[activeDevice.id]) {
            updateDetailView(backendData[activeDevice.id]);
        }
    });
});

function updateDetailView(dev) {
    document.getElementById("det-name").textContent = dev.name;
    
    let ai = dev.prediction ? String(dev.prediction).toUpperCase() : "AWAITING DATA";
    if (ai === "0") ai = "NORMAL";
    
    const badge = document.getElementById("det-ai-status");
    badge.textContent = "AI: " + ai;
    badge.style.color = (ai === 'NORMAL') ? "var(--arch-green)" : "var(--arch-red)";

    if (!dev.metrics) return; 
    
    const dialVal = document.getElementById("det-main-val");
    const statsList = document.getElementById("det-extra-stats");
    const now = new Date().toLocaleTimeString();
    
    if (activeTab === 'cpu') {
        let cpu = dev.metrics.cpu_usage || 0;
        dialVal.textContent = cpu.toFixed(1) + "%";
        document.querySelector(".dial-label").textContent = "Usage";
        statsList.innerHTML = `
            <div class="stat-item"><div class="mini-lbl">Temp</div><div class="mini-val text-dark">${(dev.metrics.cpu_temp || 0).toFixed(1)}°C</div></div>
            <div class="stat-item"><div class="mini-lbl">Freq</div><div class="mini-val text-dark">${(dev.metrics.cpu_freq || 0).toFixed(0)} MHz</div></div>
            <div class="stat-item"><div class="mini-lbl">Procs</div><div class="mini-val text-dark">${dev.metrics.active_process || 0}</div></div>
        `;
        updateChart(now, cpu, "CPU Usage %", "var(--arch-green)");
        
    } else if (activeTab === 'ram') {
        let ram = dev.metrics.ram_usage || 0;
        dialVal.textContent = ram.toFixed(1) + "%";
        document.querySelector(".dial-label").textContent = "Usage";
        let total = (dev.metrics.ram_total || 0) / 1073741824;
        statsList.innerHTML = `
            <div class="stat-item"><div class="mini-lbl">Total</div><div class="mini-val text-dark">${total.toFixed(1)} GB</div></div>
            <div class="stat-item"><div class="mini-lbl">Faults/s</div><div class="mini-val text-dark">${(dev.metrics.page_faults_per_sec || 0).toFixed(0)}</div></div>
        `;
        updateChart(now, ram, "RAM Usage %", "var(--arch-yellow)");
        
    } else if (activeTab === 'net') {
        let sent = (dev.metrics.network_sent_bytes || 0) / 1024; // KB/s
        dialVal.textContent = sent.toFixed(1);
        document.querySelector(".dial-label").textContent = "KB/s Sent";
        statsList.innerHTML = `
            <div class="stat-item"><div class="mini-lbl">Recv KB/s</div><div class="mini-val text-dark">${((dev.metrics.network_received_bytes || 0) / 1024).toFixed(1)}</div></div>
            <div class="stat-item"><div class="mini-lbl">TCP Conns</div><div class="mini-val text-dark">${dev.metrics.Tcp_connections || 0}</div></div>
            <div class="stat-item"><div class="mini-lbl">Pkts/s</div><div class="mini-val text-dark">${((dev.metrics.network_sent_packet || 0) + (dev.metrics.network_received_packet || 0)).toFixed(0)}</div></div>
        `;
        updateChart(now, sent, "Network Sent (KB/s)", "#3B82F6"); 
        
    } else if (activeTab === 'disk') {
        let space = dev.metrics.disk_space || 0;
        dialVal.textContent = space.toFixed(1) + "%";
        document.querySelector(".dial-label").textContent = "Space Used";
        
        let readMb = (dev.metrics.disk_read_bytes || 0) / (1024 * 1024);
        let writeMb = (dev.metrics.disk_write_bytes || 0) / (1024 * 1024);
        statsList.innerHTML = `
            <div class="stat-item"><div class="mini-lbl">Read MB/s</div><div class="mini-val text-dark">${readMb.toFixed(2)}</div></div>
            <div class="stat-item"><div class="mini-lbl">Write MB/s</div><div class="mini-val text-dark">${writeMb.toFixed(2)}</div></div>
            <div class="stat-item"><div class="mini-lbl">IOPS (R/W)</div><div class="mini-val text-dark">${(dev.metrics.disk_read_ops || 0).toFixed(0)} / ${(dev.metrics.disk_write_ops || 0).toFixed(0)}</div></div>
        `;
        updateChart(now, space, "Disk Used %", "#8B5CF6"); // Purple
        
    } else if (activeTab === 'gpu') {
        let gpu = dev.metrics.gpu_usage || 0;
        dialVal.textContent = gpu.toFixed(1) + "%";
        document.querySelector(".dial-label").textContent = "Usage";
        statsList.innerHTML = `
            <div class="stat-item"><div class="mini-lbl">Temp</div><div class="mini-val text-dark">${(dev.metrics.gpu_temp || 0).toFixed(1)}°C</div></div>
        `;
        updateChart(now, gpu, "GPU Usage %", "#F97316"); // Orange
    }
}

function initChart() {
    const ctx = document.getElementById('metricChart').getContext('2d');
    Chart.defaults.color = "#94A3B8";
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    metricChart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Metric', data: [], borderColor: '#13A08E', tension: 0.4, fill: true, backgroundColor: 'rgba(19,160,142,0.1)' }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { grid: { color: 'rgba(0,0,0,0.05)' }, beginAtZero: true }, x: { grid: { display: false } } },
            plugins: { legend: { display: false } },
            elements: { point: { radius: 0 } },
            animation: { duration: 0 }
        }
    });
}

function updateChart(time, value, label, color) {
    if(metricChart.data.datasets[0].label !== label) {
        metricChart.data.labels = [];
        metricChart.data.datasets[0].data = [];
        metricChart.data.datasets[0].label = label;
        metricChart.data.datasets[0].borderColor = color;
        metricChart.data.datasets[0].backgroundColor = color.replace(')', ', 0.1)').replace('var', '').replace('--arch-green', 'rgba(19,160,142,0.1)').replace('--arch-yellow', 'rgba(242,161,4,0.1)'); 
    }
    
    metricChart.data.labels.push(time);
    metricChart.data.datasets[0].data.push(value);
    
    if(metricChart.data.labels.length > 20) {
        metricChart.data.labels.shift();
        metricChart.data.datasets[0].data.shift();
    }
    metricChart.update();
}