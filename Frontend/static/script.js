const API_BASE = "http://127.0.0.1:8000";
let adminToken = sessionStorage.getItem("adminToken");

const splashScreen = document.getElementById("splash-screen");
const loginView = document.getElementById("login-view");
const appLayout = document.getElementById("app-layout");
const devicesGrid = document.getElementById("devices-grid");
const pendingModal = document.getElementById("pending-modal");
const detailModal = document.getElementById("device-detail-overlay");
const deleteModal = document.getElementById("delete-modal");
const loginError = document.getElementById("login-error");

let activeDevice = null;
let activeTab = 'cpu'; 
let metricChart = null; 
let backendData = {}; 
const localDeviceTimestamps = {}; 

// === 1. INITIALIZATION ===
window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        splashScreen.classList.add("hidden");
        if (adminToken) showDashboard();
        else loginView.classList.remove("hidden");
    }, 2000);
});

// === 2. AUTHENTICATION ===
document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.add("hidden");
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: document.getElementById("username").value, password: document.getElementById("password").value })
        });
        if (!res.ok) { loginError.textContent = "Invalid username or password."; loginError.classList.remove("hidden"); return; }
        const data = await res.json();
        adminToken = data.access_token; sessionStorage.setItem("adminToken", adminToken);
        showDashboard();
    } catch (err) { loginError.textContent = "Server connection failed."; loginError.classList.remove("hidden"); }
});

function showDashboard() { loginView.classList.add("hidden"); appLayout.classList.remove("hidden"); initWebSocket(); }
document.getElementById("btn-logout").addEventListener("click", () => { sessionStorage.removeItem("adminToken"); location.reload(); });

async function authFetch(endpoint, options = {}) {
    if (!options.headers) options.headers = {};
    options.headers["Authorization"] = `Bearer ${adminToken}`;
    if (options.body && typeof options.body === 'object') { options.body = JSON.stringify(options.body); options.headers["Content-Type"] = "application/json"; }
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    if (res.status === 401) { sessionStorage.removeItem("adminToken"); location.reload(); }
    return res;
}

// === 3. MODALS & API ===
window.openPendingModal = async function() {
    pendingModal.classList.remove("hidden");
    const list = document.getElementById("pending-list");
    list.innerHTML = `<div class="text-center" style="color:var(--arch-gray)">Loading...</div>`;
    try {
        const res = await authFetch("/device/pending");
        const pendingDevices = await res.json();
        list.innerHTML = "";
        if (pendingDevices.length === 0) { list.innerHTML = `<div class="text-center" style="color:var(--arch-gray)">No devices pending.</div>`; return; }
        pendingDevices.forEach(d => {
            list.innerHTML += `
                <div class="pending-item neu-inset-panel mb-3" style="padding: 15px; display:flex; justify-content:space-between;">
                    <div><strong>${d.name}</strong><br><small>${d.ip} | ${d.type}</small></div>
                    <div>
                        <button class="neu-btn-icon small-btn" style="color:#10B981; display:inline-flex;" onclick="approveDevice('${d.enrollment_code}')"><i class="fa-solid fa-check"></i></button>
                        <button class="neu-btn-icon small-btn text-danger" style="display:inline-flex; margin-left:10px;" onclick="rejectDevice('${d.enrollment_code}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
        });
    } catch { list.innerHTML = `<div class="text-center text-danger">Error loading pending devices.</div>`; }
}

window.approveDevice = async function(code) { await authFetch("/device/approved", { method: "POST", body: { enrollment_code: code } }); openPendingModal(); }
window.rejectDevice = async function(code) { await authFetch("/device/rejected", { method: "POST", body: { enrollment_code: code } }); openPendingModal(); }

// --- CUSTOM DELETE FLOW ---
document.getElementById("btn-delete-device").addEventListener("click", () => { deleteModal.classList.remove("hidden"); });
document.getElementById("btn-cancel-del").addEventListener("click", () => { deleteModal.classList.add("hidden"); });
document.getElementById("btn-confirm-del").addEventListener("click", async () => {
    if (!activeDevice) return;
    try {
        const res = await authFetch(`/device/${activeDevice.id}`, { method: "DELETE" });
        if(!res.ok) throw new Error("Failed");
        deleteModal.classList.add("hidden"); detailModal.classList.add("hidden"); activeDevice = null;
    } catch { alert("Failed to delete device! Ensure your python backend `db.delete_device` function is working correctly."); deleteModal.classList.add("hidden"); }
});

document.querySelectorAll(".close-modal").forEach(b => b.addEventListener("click", () => pendingModal.classList.add("hidden")));
document.querySelector(".close-detail").addEventListener("click", () => { detailModal.classList.add("hidden"); activeDevice = null; });

// === 4. WEBSOCKET ===
function initWebSocket() {
    const socket = new WebSocket("ws://127.0.0.1:8000/ws");
    socket.onopen = () => console.log("🟢 Connected");
    socket.onclose = () => setTimeout(initWebSocket, 3000);
    socket.onmessage = (event) => {
        backendData = JSON.parse(event.data);
        renderGrid();
        if (activeDevice && backendData[activeDevice.id]) updateDetailView(backendData[activeDevice.id]);
        else if (activeDevice) { detailModal.classList.add("hidden"); activeDevice = null; }
    };
}

// === 5. GRID RENDERING & AI FIX ===

// NEW PARSER for dictionary AI results: {"prediction": "...", "confidence": 0.9}
function parseAIState(predObj) {
    if (!predObj) return { text: "NO DATA", isNormal: false, conf: 0 };
    
    let predStr = "";
    let conf = 1;
    
    // Check if python sent a dictionary
    if (typeof predObj === 'object') {
        predStr = String(predObj.prediction || "UNKNOWN").toUpperCase();
        if (predObj.confidence !== undefined) conf = parseFloat(predObj.confidence);
    } else {
        predStr = String(predObj).toUpperCase();
    }

    let isNormal = predStr === "0" || predStr.includes("NORM");
    let displayStr = isNormal ? "NORMAL" : predStr; // Keep specific attacks as is (e.g. DOS, XSS)
    
    // Append Confidence if available
    if (typeof predObj === 'object' && predObj.confidence !== undefined) {
        displayStr += ` (${(conf * 100).toFixed(0)}%)`;
    }

    return { text: displayStr, isNormal: isNormal, conf: conf };
}

function checkOffline(id, dev) {
    if (!dev.metrics || !dev.metrics.timestamp) return true;
    let now = Date.now();
    if (!localDeviceTimestamps[id] || localDeviceTimestamps[id].py_ts !== dev.metrics.timestamp) {
        localDeviceTimestamps[id] = { py_ts: dev.metrics.timestamp, local_ts: now };
    }
    return (now - localDeviceTimestamps[id].local_ts) > 8000;
}

function renderGrid() {
    devicesGrid.innerHTML = "";
    Object.keys(backendData).forEach(id => {
        const dev = backendData[id];
        const isOffline = checkOffline(id, dev);
        
        let ai = isOffline ? { text: "NO DATA", isNormal: false, conf: 0 } : parseAIState(dev.prediction);
        let cpu = isOffline || !dev.metrics ? 0 : Math.round(dev.metrics.cpu_usage || 0);
        let ram = isOffline || !dev.metrics ? 0 : Math.round(dev.metrics.ram_usage || 0);
        
        let borderClass = "status-gray";
        if (!isOffline && dev.metrics) {
            // If normal but confidence is under 60%, yellow outline. Otherwise green.
            if (ai.isNormal) borderClass = ai.conf < 0.6 ? "status-yellow" : "status-green";
            else borderClass = "status-red";
        }
        
        const osIcon = dev.type === 'windows' ? 'fa-windows' : 'fa-linux';
        
        devicesGrid.innerHTML += `
            <div class="device-card ${borderClass}" onclick="openDetail('${id}')">
                <div class="card-header">
                    <div><div class="card-title">${dev.name}</div><div class="card-ip">${dev.ip}</div></div>
                    <div class="os-icon-wrapper"><i class="fa-solid fa-desktop"></i><i class="fa-brands ${osIcon} inner-os"></i></div>
                </div>
                <div class="card-metrics">
                    <div class="mini-stat"><div class="mini-val" style="color: ${isOffline ? 'var(--arch-gray)' : getStatColor(cpu)}">${cpu}%</div><div class="mini-lbl">CPU</div></div>
                    <div class="mini-stat"><div class="mini-val" style="color: ${isOffline ? 'var(--arch-gray)' : getStatColor(ram)}">${ram}%</div><div class="mini-lbl">RAM</div></div>
                    <div class="mini-stat"><div class="mini-val" style="font-size:1.1rem; color: ${isOffline ? 'var(--arch-gray)' : (ai.isNormal ? 'var(--arch-green)' : 'var(--arch-red)')}">${ai.text === 'NO DATA' ? '--' : ai.text}</div><div class="mini-lbl">AI STATE</div></div>
                </div>
            </div>`;
    });

    devicesGrid.innerHTML += `
        <div class="device-card add-device-card" onclick="openPendingModal()">
            <div style="text-align: center;"><i class="fa-solid fa-plus fa-3x mb-2"></i><br><strong>Add Device</strong></div>
        </div>`;
}

function getStatColor(val) { return val > 85 ? "var(--arch-red)" : (val > 65 ? "var(--arch-yellow)" : "var(--arch-green)"); }

// === 6. TASK MANAGER VIEW ===
function openDetail(id) {
    activeDevice = { id: id };
    detailModal.classList.remove("hidden");
    document.querySelectorAll(".skeleton-text").forEach(el => { el.classList.remove("data-loaded", "text-success", "text-danger", "text-warning"); el.textContent = "--"; });
    if (!metricChart) initChart();
    setTimeout(() => { if(activeDevice && activeDevice.id === id) updateDetailView(backendData[id]); }, 500);
}

document.querySelectorAll(".tm-tab").forEach(tab => {
    tab.addEventListener("click", (e) => {
        document.querySelectorAll(".tm-tab").forEach(t => t.classList.remove("active"));
        e.currentTarget.classList.add("active");
        activeTab = e.currentTarget.dataset.metric;
        
        document.querySelectorAll(".tm-stats-grid .skeleton-text").forEach(el => { el.classList.remove("data-loaded"); el.textContent = "--"; });
        if(activeDevice && backendData[activeDevice.id]) updateDetailView(backendData[activeDevice.id]);
    });
});

function formatUptime(seconds) {
    if(!seconds) return "0:00:00:00";
    let d = Math.floor(seconds / 86400); let h = Math.floor((seconds % 86400) / 3600); let m = Math.floor((seconds % 3600) / 60); let s = Math.floor(seconds % 60);
    return `${d}:${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function setText(id, text, colorClass = null) {
    const el = document.getElementById(id); if (!el) return;
    el.textContent = text; el.classList.add("data-loaded");
    if(colorClass) el.classList.add(colorClass);
}
function setLabel(id, text) { const el = document.getElementById(id); if(el) el.textContent = text; }

function updateDetailView(dev) {
    if(!activeDevice || activeDevice.id !== dev.device_id && activeDevice.id !== Object.keys(backendData).find(k => backendData[k] === dev)) return;
    
    const isOffline = checkOffline(activeDevice.id, dev);
    setText("det-name", dev.name);
    
    let ai = isOffline ? { text: "NO DATA", isNormal: false } : parseAIState(dev.prediction);
    setText("tm-ai-status", ai.text, ai.isNormal ? 'text-success' : (ai.text === 'NO DATA' ? '' : 'text-danger'));

    let m = dev.metrics || {};
    let cpu = isOffline ? 0 : (m.cpu_usage || 0); 
    let ram = isOffline ? 0 : (m.ram_usage || 0);
    let totalRam = (m.ram_total || 0) / 1073741824; 
    let disk = isOffline ? 0 : (m.disk_space || 0);
    let netSent = isOffline ? 0 : (m.network_sent_bytes || 0) / 1024; // Kbps
    let netRecv = isOffline ? 0 : (m.network_received_bytes || 0) / 1024; // Kbps
    let netTotal = netSent + netRecv;
    let gpu = isOffline ? 0 : (m.gpu_usage || 0);

    setText("tm-cpu-val", `${cpu.toFixed(0)}% ${(m.cpu_freq || 0)/1000} GHz`); 
    setText("tm-ram-val", `${((ram/100)*totalRam).toFixed(1)}/${totalRam.toFixed(1)} GB`);
    setText("tm-disk-val", `${disk.toFixed(0)}%`); 
    setText("tm-net-val", `${netTotal.toFixed(0)} Kbps`); 
    setText("tm-gpu-val", `${gpu.toFixed(0)}%`);

    const now = new Date().toLocaleTimeString();
    const staticBox = document.getElementById("tm-static-box");

    if (activeTab === 'cpu') {
        setLabel("tm-main-title", "CPU"); setText("tm-processor-name", "Intel Processor (Detected)");
        setLabel("tm-chart-lbl", "% Utilization"); staticBox.style.display = "block";
        
        setLabel("lbl-util", "Utilization"); setText("tm-s-util", `${cpu.toFixed(0)}%`); 
        setLabel("lbl-speed", "Speed"); setText("tm-s-speed", `${((m.cpu_freq || 0)/1000).toFixed(2)} GHz`);
        setLabel("lbl-procs", "Processes"); setText("tm-s-procs", m.active_process || 0); 
        setLabel("lbl-threads", "Threads"); setText("tm-s-threads", m.threads || "--"); 
        setLabel("lbl-handles", "Handles"); setText("tm-s-handles", m.handles || "--");
        setLabel("lbl-uptime", "Up time"); setText("tm-s-uptime", formatUptime(m.uptime)); 
        
        setText("tm-s-base", "2.40 GHz"); setText("tm-s-cores", m.cores || "--"); setText("tm-s-log", m.logical_processors || "--");
        updateChart(now, cpu, "CPU", "rgba(59, 130, 246, 1)", "rgba(59, 130, 246, 0.1)");
        
    } else if (activeTab === 'ram') {
        setLabel("tm-main-title", "Memory"); setText("tm-processor-name", `${totalRam.toFixed(1)} GB`);
        setLabel("tm-chart-lbl", "Memory usage"); staticBox.style.display = "none";
        
        setLabel("lbl-util", "In use"); setText("tm-s-util", `${((ram/100)*totalRam).toFixed(1)} GB`); 
        setLabel("lbl-speed", "Available"); setText("tm-s-speed", `${(totalRam - ((ram/100)*totalRam)).toFixed(1)} GB`);
        setLabel("lbl-procs", "Committed"); setText("tm-s-procs", `${ram.toFixed(0)}%`); 
        setLabel("lbl-threads", "Paged pool"); setText("tm-s-threads", "-- MB"); 
        setLabel("lbl-handles", "Non-paged"); setText("tm-s-handles", "-- MB");
        setLabel("lbl-uptime", "Page Faults/s"); setText("tm-s-uptime", m.page_faults_per_sec || 0);
        updateChart(now, ram, "RAM", "rgba(139, 92, 246, 1)", "rgba(139, 92, 246, 0.1)");

    } else if (activeTab === 'disk') {
        setLabel("tm-main-title", "Disk (C:)"); setText("tm-processor-name", "System Drive");
        setLabel("tm-chart-lbl", "Active time"); staticBox.style.display = "none";
        
        setLabel("lbl-util", "Active time"); setText("tm-s-util", `${disk.toFixed(0)}%`); 
        setLabel("lbl-speed", "Average response"); setText("tm-s-speed", "1.2 ms");
        setLabel("lbl-procs", "Read speed"); setText("tm-s-procs", `${((m.disk_read_bytes || 0) / 1024).toFixed(1)} KB/s`); 
        setLabel("lbl-threads", "Write speed"); setText("tm-s-threads", `${((m.disk_write_bytes || 0) / 1024).toFixed(1)} KB/s`); 
        setLabel("lbl-handles", "Capacity"); setText("tm-s-handles", "-- GB");
        setLabel("lbl-uptime", "IOPS"); setText("tm-s-uptime", ((m.disk_read_ops || 0) + (m.disk_write_ops || 0)).toFixed(0));
        updateChart(now, disk, "DISK", "rgba(16, 185, 129, 1)", "rgba(16, 185, 129, 0.1)");

    } else if (activeTab === 'net') {
        setLabel("tm-main-title", "Network"); setText("tm-processor-name", "Ethernet / Wi-Fi");
        setLabel("tm-chart-lbl", "Throughput"); staticBox.style.display = "none";
        
        setLabel("lbl-util", "Send"); setText("tm-s-util", `${netSent.toFixed(1)} Kbps`); 
        setLabel("lbl-speed", "Receive"); setText("tm-s-speed", `${netRecv.toFixed(1)} Kbps`);
        setLabel("lbl-procs", "TCP Conns"); setText("tm-s-procs", m.Tcp_connections || 0); 
        setLabel("lbl-threads", "Packets Sent/s"); setText("tm-s-threads", (m.network_sent_packet || 0).toFixed(0)); 
        setLabel("lbl-handles", "Packets Recv/s"); setText("tm-s-handles", (m.network_received_packet || 0).toFixed(0));
        setLabel("lbl-uptime", "Total Pkts/s"); setText("tm-s-uptime", ((m.network_sent_packet || 0) + (m.network_received_packet || 0)).toFixed(0));
        updateChart(now, netTotal > 100 ? 100 : netTotal, "NET", "rgba(245, 158, 11, 1)", "rgba(245, 158, 11, 0.1)");

    } else if (activeTab === 'gpu') {
        setLabel("tm-main-title", "GPU 0"); setText("tm-processor-name", "Intel Graphics");
        setLabel("tm-chart-lbl", "3D"); staticBox.style.display = "none";
        
        setLabel("lbl-util", "Utilization"); setText("tm-s-util", `${gpu.toFixed(0)}%`); 
        setLabel("lbl-speed", "Temperature"); setText("tm-s-speed", `${(m.gpu_temp || 0).toFixed(1)}°C`);
        setLabel("lbl-procs", "GPU Memory"); setText("tm-s-procs", "-- GB"); 
        setLabel("lbl-threads", "Shared Memory"); setText("tm-s-threads", "-- GB"); 
        setLabel("lbl-handles", "Video Decode"); setText("tm-s-handles", "--%");
        setLabel("lbl-uptime", "Driver Version"); setText("tm-s-uptime", "--");
        updateChart(now, gpu, "GPU", "rgba(239, 68, 68, 1)", "rgba(239, 68, 68, 0.1)");
    }
}

function initChart() {
    const ctx = document.getElementById('metricChart').getContext('2d'); Chart.defaults.color = "#94A3B8";
    metricChart = new Chart(ctx, { type: 'line', data: { labels: [], datasets: [{ label: '', data: [], borderColor: '#3B82F6', borderWidth: 1.5, tension: 0, fill: true, backgroundColor: 'rgba(59,130,246,0.1)' }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { display: false, min: 0, max: 100 }, x: { display: false } }, plugins: { legend: { display: false } }, elements: { point: { radius: 0 } }, animation: { duration: 0 } }
    });
}
function updateChart(time, value, label, borderColor, bgColor) {
    let ds = metricChart.data.datasets[0];
    if(ds.label !== label) { metricChart.data.labels = []; ds.data = []; ds.label = label; ds.borderColor = borderColor; ds.backgroundColor = bgColor; }
    metricChart.data.labels.push(time); ds.data.push(value);
    if(metricChart.data.labels.length > 30) { metricChart.data.labels.shift(); ds.data.shift(); }
    metricChart.update();
}