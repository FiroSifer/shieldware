const API_BASE = "http://127.0.0.1:8000";

let adminToken = sessionStorage.getItem("adminToken");
let socket = null;
let reconnectTimer = null;
let metricChart = null;
let audioContext = null;

let fleetStructureKey = "";

let anomalyAlertTimer = null;
let anomalyAlertActive = false;
let anomalyAlertMetric = null;
let anomalyAlertDevice = null;

const anomalyAcknowledged = {};
const lastAIStates = {};
const backendData = {};
const deviceHistory = {};

const views = {};
const panes = {};
const navs = {};

const appState = {
    view: "fleet",
    activeId: null,
    activeTab: "cpu",
    socketConnected: false,
    offlineOverlayDismissed: false
};

const METRICS = {
    cpu: {
        title: "CPU Utilization",
        subtitle: "System Processor",
        label: "% Usage",
        unit: "%"
    },

    ram: {
        title: "Memory Allocation",
        subtitle: "System Memory",
        label: "% Used",
        unit: "%"
    },

    disk: {
        title: "Disk Usage",
        subtitle: "System Storage",
        label: "% Used",
        unit: "%"
    },

    net: {
        title: "Network Throughput",
        subtitle: "Live transfer rate",
        label: "Kbps",
        unit: " Kbps"
    },

    gpu: {
        title: "GPU Utilization",
        subtitle: "Graphics Processor",
        label: "% Usage",
        unit: "%"
    }
};


/* =========================================================
   HELPERS
========================================================= */

function $(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const element = $(id);

    if (element) {
        element.textContent = String(value);
    }
}

function safeNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const escapeAttr = escapeHtml;

function getLatest(array) {
    return array && array.length
        ? array[array.length - 1]
        : null;
}

function formatPercent(value) {
    return `${safeNumber(value).toFixed(1)}%`;
}

function formatMaybeNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number.toLocaleString()
        : "—";
}


/*
 * The agent already sends network_sent_bytes and
 * network_received_bytes as BYTES PER SECOND.
 */
function formatRate(bytesPerSecond) {
    const bytes = safeNumber(bytesPerSecond);

    const kbps = (bytes * 8) / 1024;

    if (kbps < 1000) {
        return `${kbps.toFixed(1)} Kbps`;
    }

    return `${(kbps / 1000).toFixed(2)} Mbps`;
}


function formatBytesPerSecond(value) {
    const bytes = safeNumber(value);

    if (bytes <= 0) {
        return "—";
    }

    const units = [
        "B/s",
        "KB/s",
        "MB/s",
        "GB/s"
    ];

    let size = bytes;
    let index = 0;

    while (
        size >= 1024 &&
        index < units.length - 1
    ) {
        size /= 1024;
        index++;
    }

    return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[index]}`;
}


function formatUptime(value) {
    const seconds = safeNumber(value);

    if (seconds <= 0) {
        return "—";
    }

    const days = Math.floor(seconds / 86400);

    const hours = Math.floor(
        (seconds % 86400) / 3600
    );

    const minutes = Math.floor(
        (seconds % 3600) / 60
    );

    return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}


function formatConfidence(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return number <= 1
        ? number.toFixed(2)
        : `${number.toFixed(0)}%`;
}


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    cacheDom();

    prepareInitialView();

    initDarkMode();

    try {
        bindEvents();
    } catch (error) {
        console.error(
            "Event binding error:",
            error
        );
    }

    try {
        initChart();
    } catch (error) {
        console.warn(
            "Chart initialization error:",
            error
        );
    }

    if (adminToken) {

        try {
            enterApp();
        } catch (error) {

            console.error(
                "Application startup error:",
                error
            );

            showLogin();
        }
    }

    runIntroAnimation()
        .catch(() => finishIntroImmediately());
});


function cacheDom() {

    views.login = $("login-view");

    views.app = $("app-layout");

    panes.fleet = $("view-fleet");

    panes.monitor = $("view-monitor");

    navs.monitor = $("nav-monitor-section");
}


function prepareInitialView() {

    views.login?.classList.remove("hidden");

    views.app?.classList.toggle(
        "hidden",
        !adminToken
    );
}


function showLogin() {

    views.app?.classList.add("hidden");

    views.login?.classList.remove("hidden");
}


/* =========================================================
   DARK MODE
========================================================= */

function initDarkMode() {

    const toggle = $("theme-toggle");

    const dark =
        localStorage.getItem("theme") === "dark";

    if (dark) {
        document.body.classList.add("dark-mode");
    }

    if (toggle) {

        toggle.innerHTML = dark
            ? '<i class="fa-solid fa-sun"></i>'
            : '<i class="fa-solid fa-moon"></i>';
    }

    toggle?.addEventListener("click", () => {

        document.body.classList.toggle(
            "dark-mode"
        );

        const isDark =
            document.body.classList.contains(
                "dark-mode"
            );

        localStorage.setItem(
            "theme",
            isDark ? "dark" : "light"
        );

        toggle.innerHTML = isDark
            ? '<i class="fa-solid fa-sun"></i>'
            : '<i class="fa-solid fa-moon"></i>';

        if (metricChart) {
            metricChart.update();
        }
    });
}


/* =========================================================
   INTRO
========================================================= */

function wait(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}


async function runIntroAnimation() {

    const splash = $("intro-splash");

    if (!splash) {
        return;
    }

    splash.classList.remove("finish");

    splash.classList.add("play");

    await wait(2050);

    splash.classList.add("finish");

    await wait(450);

    splash.remove();
}


function finishIntroImmediately() {

    $("intro-splash")?.remove();
}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {

    const on = (
        id,
        event,
        handler
    ) => {

        $(id)?.addEventListener(
            event,
            handler
        );
    };


    /* LOGIN */

    on(
        "login-form",
        "submit",
        handleLogin
    );


    /* LOGOUT */

    on(
        "btn-logout",
        "click",
        () => {

            stopAnomalyAlert();

            sessionStorage.removeItem(
                "adminToken"
            );

            try {
                socket?.close();
            } catch {}

            location.reload();
        }
    );


    /* NAVIGATION */

    on(
        "nav-fleet",
        "click",
        () => switchView("fleet")
    );

    on(
        "btn-back-fleet",
        "click",
        () => switchView("fleet")
    );

    on(
        "btn-back-offline",
        "click",
        () => switchView("fleet")
    );


    /* OFFLINE CLOSE */

    on(
        "btn-close-offline",
        "click",
        () => {

            appState.offlineOverlayDismissed = true;

            $("device-offline-overlay")
                ?.classList.add("hidden");
        }
    );


    /* PENDING DEVICES */

    on(
        "nav-pending",
        "click",
        openPendingModal
    );

    on(
        "btn-close-pending",
        "click",
        closePendingModal
    );

    on(
        "pending-modal",
        "click",
        event => {

            if (
                event.target.id ===
                "pending-modal"
            ) {
                closePendingModal();
            }
        }
    );


    /* DELETE */

    on(
        "btn-delete-device",
        "click",
        openDeleteModal
    );

    on(
        "btn-cancel-delete",
        "click",
        closeDeleteModal
    );

    on(
        "btn-confirm-delete",
        "click",
        confirmDeleteDevice
    );

    on(
        "delete-modal",
        "click",
        event => {

            if (
                event.target.id ===
                "delete-modal"
            ) {
                closeDeleteModal();
            }
        }
    );


    /* ESCAPE */

    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {

                closePendingModal();

                closeDeleteModal();
            }
        }
    );


    /* METRIC NAVIGATION */

    document
        .querySelectorAll(".tab-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const metric =
                        button.dataset.metric;

                    stopAnomalyAlertIfMatching(
                        metric
                    );

                    activateMetric(metric);
                }
            );
        });


    /* SUMMARY METRIC CARDS */

    document
        .querySelectorAll(".metric-jump")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const metric =
                        button.dataset.metric;

                    stopAnomalyAlertIfMatching(
                        metric
                    );

                    activateMetric(metric);

                    $("live-telemetry-detail")
                        ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start"
                        });
                }
            );
        });


    /* RANGE BUTTONS */

    document
        .querySelectorAll(".range-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(
                            ".range-btn"
                        )
                        .forEach(
                            b =>
                                b.classList.remove(
                                    "active"
                                )
                        );

                    button.classList.add(
                        "active"
                    );

                    refreshMonitor();
                }
            );
        });


    /*
     * Clicking AI Monitor also acknowledges
     * the current anomaly.
     */

    $("ai-panel")?.addEventListener(
        "click",
        () => {

            if (anomalyAlertActive) {

                anomalyAcknowledged[
                    appState.activeId
                ] = true;

                stopAnomalyAlert();
            }
        }
    );
}


/* =========================================================
   PENDING DEVICES
========================================================= */

async function openPendingModal() {

    $("pending-modal")
        ?.classList.remove("hidden");

    await fetchPendingDevices();
}


function closePendingModal() {

    $("pending-modal")
        ?.classList.add("hidden");
}


async function fetchPendingDevices() {

    const list = $("pending-list");

    if (!list) {
        return;
    }

    list.innerHTML =
        '<div class="flex-center w-100" style="min-height:150px"><div class="spinner"></div></div>';

    try {

        const response =
            await authFetch(
                "/device/pending"
            );

        if (!response.ok) {
            throw new Error(
                "Failed to fetch pending devices"
            );
        }

        const devices =
            await response.json();

        renderPendingDevices(devices);

    } catch {

        list.innerHTML =
            '<div class="empty-panel"><strong class="text-danger">Error</strong><span>Unable to load pending devices</span></div>';
    }
}


function renderPendingDevices(devices) {

    const list = $("pending-list");

    if (!devices?.length) {

        list.innerHTML =
            '<div class="empty-panel"><div class="empty-icon"><i class="fa-solid fa-satellite-dish"></i></div><strong>No devices pending</strong><span>New devices waiting for approval will appear here.</span></div>';

        return;
    }


    list.innerHTML = devices
        .map(device => `

        <div
            class="neu-raised flex-between mb-16"
            style="
                padding:16px;
                border:1px solid rgba(19,160,142,.2)
            "
        >

            <div>

                <strong
                    style="
                        font-size:1.1rem;
                        display:block;
                        margin-bottom:4px
                    "
                >
                    ${escapeHtml(device.name)}
                </strong>

                <span
                    class="text-muted"
                    style="font-size:.85rem"
                >

                    <i
                        class="fa-brands fa-${
                            device.type === "windows"
                                ? "windows"
                                : "linux"
                        }"
                    ></i>

                    ${escapeHtml(device.ip)}

                </span>

            </div>


            <div
                class="flex-align-center gap-12"
            >

                <button
                    class="neu-btn text-danger"
                    style="min-height:36px"
                    onclick="handleRejectDevice('${escapeAttr(device.enrollment_code)}')"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>


                <button
                    class="neu-btn text-success"
                    style="
                        min-height:36px;
                        border:
                            1px solid
                            rgba(20,168,120,.3)
                    "
                    onclick="handleApproveDevice('${escapeAttr(device.enrollment_code)}')"
                >
                    <i class="fa-solid fa-check"></i>
                </button>

            </div>

        </div>

    `)
    .join("");
}


window.handleApproveDevice =
    async code => {

        try {

            await authFetch(
                "/device/approved",
                {
                    method: "POST",
                    body: {
                        enrollment_code: code
                    }
                }
            );

            await fetchPendingDevices();

        } catch (error) {

            console.error(
                "Error approving device:",
                error
            );
        }
    };


window.handleRejectDevice =
    async code => {

        try {

            await authFetch(
                "/device/rejected",
                {
                    method: "POST",
                    body: {
                        enrollment_code: code
                    }
                }
            );

            await fetchPendingDevices();

        } catch (error) {

            console.error(
                "Error rejecting device:",
                error
            );
        }
    };


/* =========================================================
   DELETE DEVICE
========================================================= */

function openDeleteModal() {

    if (!appState.activeId) {
        return;
    }

    $("delete-modal")
        ?.classList.remove("hidden");
}


function closeDeleteModal() {

    $("delete-modal")
        ?.classList.add("hidden");
}


async function confirmDeleteDevice() {

    if (!appState.activeId) {
        return;
    }

    const id =
        appState.activeId;

    const button =
        $("btn-confirm-delete");


    if (button) {

        button.disabled = true;

        button.innerHTML =
            '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    }


    try {

        const response =
            await authFetch(
                `/device/${id}`,
                {
                    method: "DELETE"
                }
            );

        if (!response.ok) {
            throw new Error(
                "Delete failed"
            );
        }


        delete backendData[id];

        delete deviceHistory[id];

        delete anomalyAcknowledged[id];

        delete lastAIStates[id];


        if (anomalyAlertDevice === id) {
            stopAnomalyAlert();
        }


        closeDeleteModal();

        switchView("fleet");

    } catch (error) {

        console.error(
            "Deletion error:",
            error
        );

        alert(
            "Failed to delete device."
        );

    } finally {

        if (button) {

            button.disabled = false;

            button.innerHTML =
                "Delete";
        }
    }
}


/* =========================================================
   LOGIN / AUTH
========================================================= */

async function handleLogin(event) {

    event.preventDefault();


    const error =
        $("login-error");

    const button =
        document.querySelector(
            "#login-form button[type='submit']"
        );

    const username =
        $("username")
            ?.value
            .trim() || "";

    const password =
        $("password")
            ?.value || "";


    error?.classList.add("hidden");


    if (!username || !password) {

        if (error) {

            error.textContent =
                "Enter your username and password.";

            error.classList.remove(
                "hidden"
            );
        }

        return;
    }


    if (button) {

        button.disabled = true;

        button.innerHTML =
            '<span>Logging in…</span><i class="fa-solid fa-circle-notch fa-spin"></i>';
    }


    try {

        /*
         * Unlock audio immediately from the login click.
         * This is important because browsers block
         * programmatic audio before user interaction.
         */
        unlockAudio();


        const response =
            await fetch(
                `${API_BASE}/login`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body: JSON.stringify({
                        username,
                        password
                    })
                }
            );


        if (!response.ok) {

            throw new Error(
                "Invalid username or password."
            );
        }


        const data =
            await response.json();


        if (!data?.access_token) {

            throw new Error(
                "Missing access token"
            );
        }


        adminToken =
            data.access_token;


        sessionStorage.setItem(
            "adminToken",
            adminToken
        );


        enterApp();

    } catch (errorObject) {

        if (error) {

            error.textContent =
                errorObject.message ===
                "Invalid username or password."

                    ? errorObject.message

                    : "Unable to reach the login server.";

            error.classList.remove(
                "hidden"
            );
        }

    } finally {

        if (button) {

            button.disabled = false;

            button.innerHTML =
                '<span>Login</span><i class="fa-solid fa-arrow-right"></i>';
        }
    }
}


function enterApp() {

    cacheDom();

    views.login?.classList.add(
        "hidden"
    );

    views.app?.classList.remove(
        "hidden"
    );

    switchView("fleet");

    initWebSocket();
}


async function authFetch(
    endpoint,
    options = {}
) {

    const headers =
        new Headers(
            options.headers || {}
        );


    headers.set(
        "Authorization",
        `Bearer ${adminToken}`
    );


    const config = {
        ...options,
        headers
    };


    if (
        config.body &&
        typeof config.body === "object" &&
        !(config.body instanceof FormData)
    ) {

        config.body =
            JSON.stringify(
                config.body
            );

        headers.set(
            "Content-Type",
            "application/json"
        );
    }


    const response =
        await fetch(
            `${API_BASE}${endpoint}`,
            config
        );


    if (response.status === 401) {

        sessionStorage.removeItem(
            "adminToken"
        );

        location.reload();
    }


    return response;
}


/* =========================================================
   NAVIGATION
========================================================= */

window.switchView = switchView;


function switchView(
    targetView,
    devId = null
) {

    appState.view =
        targetView;


    document
        .querySelectorAll(".nav-btn")
        .forEach(button =>
            button.classList.remove(
                "active"
            )
        );


    if (targetView === "fleet") {

        /*
         * Do not automatically acknowledge
         * an anomaly when returning to fleet.
         *
         * The alert can continue here.
         */
        if (
            anomalyAlertDevice &&
            !backendData[anomalyAlertDevice]
        ) {
            stopAnomalyAlert();
        }


        panes.monitor
            ?.classList.add("hidden");

        panes.fleet
            ?.classList.remove("hidden");

        navs.monitor
            ?.classList.add("hidden");


        $("nav-fleet")
            ?.classList.add("active");


        appState.activeId =
            null;


        renderFleet();

        return;
    }


    if (targetView === "monitor") {

        const id =
            devId ?? appState.activeId;


        if (
            !id ||
            !backendData[id]
        ) {

            switchView("fleet");

            return;
        }


        appState.activeId =
            id;

        appState.offlineOverlayDismissed =
            false;


        panes.fleet
            ?.classList.add("hidden");

        panes.monitor
            ?.classList.remove("hidden");

        navs.monitor
            ?.classList.remove("hidden");


        if (!deviceHistory[id]) {

            deviceHistory[id] =
                createHistory();
        }


        /*
         * If this device is the device currently
         * producing the alarm, entering its monitor
         * acknowledges/stops that alarm.
         */
        if (anomalyAlertDevice === id) {

            anomalyAcknowledged[id] = true;

            stopAnomalyAlert();
        }


        activateMetric(
            appState.activeTab,
            false
        );


        refreshMonitor();
    }
}


function activateMetric(
    metric,
    render = true
) {

    if (!METRICS[metric]) {
        return;
    }


    appState.activeTab =
        metric;


    document
        .querySelectorAll(".tab-btn")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.metric ===
                    metric
            );
        });


    if (!metricChart) {
        initChart();
    }


    if (render) {
        refreshMonitor();
    }
}


/* =========================================================
   WEBSOCKET
========================================================= */

function initWebSocket() {

    if (
        socket &&
        (
            socket.readyState ===
                WebSocket.OPEN ||

            socket.readyState ===
                WebSocket.CONNECTING
        )
    ) {

        return;
    }


    clearTimeout(
        reconnectTimer
    );


    $("sys-connection-overlay")
        ?.classList.remove(
            "hidden"
        );


    socket =
        new WebSocket(
            "ws://127.0.0.1:8000/ws"
        );


    socket.onopen = () => {

        appState.socketConnected =
            true;


        $("sys-connection-overlay")
            ?.classList.add(
                "hidden"
            );


        setSidebarConnection(
            "Connected",
            true
        );
    };


    socket.onmessage = event => {

        try {

            const incoming =
                JSON.parse(
                    event.data
                ) || {};


            /*
             * Keep frontend data synchronized
             * with the backend's device dictionary.
             */
            Object.keys(backendData)
                .forEach(id => {

                    if (!(id in incoming)) {
                        delete backendData[id];
                    }
                });


            Object.assign(
                backendData,
                incoming
            );


            ingestTelemetry(
                incoming
            );


            /*
             * IMPORTANT:
             *
             * Check anomalies BEFORE rendering
             * the fleet or monitor.
             *
             * This makes the alert start as soon
             * as the backend reports the anomaly.
             */
            updateFleetAnomalyAlerts();


            if (
                appState.view ===
                "fleet"
            ) {

                renderFleet();

            } else if (
                backendData[
                    appState.activeId
                ]
            ) {

                refreshMonitor();

            } else {

                switchView(
                    "fleet"
                );
            }

        } catch (error) {

            console.error(
                "Telemetry parse error:",
                error
            );
        }
    };


    socket.onerror = () => {

        appState.socketConnected =
            false;

        setSidebarConnection(
            "Connection error",
            false
        );
    };


    socket.onclose = () => {

        appState.socketConnected =
            false;


        $("sys-connection-overlay")
            ?.classList.remove(
                "hidden"
            );


        setSidebarConnection(
            "Reconnecting…",
            false
        );


        clearTimeout(
            reconnectTimer
        );


        reconnectTimer =
            setTimeout(
                initWebSocket,
                2500
            );
    };
}


function setSidebarConnection(
    text,
    connected
) {

    setText(
        "sidebar-connection-text",
        text
    );


    const dot =
        document.querySelector(
            "#sidebar-connection .live-dot"
        );


    if (dot) {

        dot.style.background =
            connected
                ? "var(--success)"
                : "var(--warning)";
    }
}


/* =========================================================
   TELEMETRY HISTORY
========================================================= */

function createHistory() {

    return {
        cpu: [],
        ram: [],
        disk: [],
        net: [],
        gpu: [],

        lastTs: 0,

        pyTs: null,

        lastSampleTs: 0
    };
}


function ingestTelemetry(data) {

    const now =
        Date.now();


    Object.keys(
        data || {}
    ).forEach(id => {

        const device =
            data[id];


        if (!deviceHistory[id]) {

            deviceHistory[id] =
                createHistory();
        }


        const history =
            deviceHistory[id];


        if (!device?.metrics) {
            return;
        }


        history.lastTs =
            now;


        const timestamp =
            device.metrics.timestamp ??
            now;


        /*
         * Prevent adding the exact same
         * Python telemetry sample twice.
         */
        if (
            timestamp ===
            history.pyTs
        ) {

            return;
        }


        history.pyTs =
            timestamp;


        if (
            !history.lastSampleTs ||
            now -
                history.lastSampleTs >=
                1000
        ) {

            history.lastSampleTs =
                now;


            pushHistory(
                id,
                "cpu",
                device.metrics.cpu_usage
            );


            pushHistory(
                id,
                "ram",
                device.metrics.ram_usage
            );


            pushHistory(
                id,
                "disk",
                device.metrics.disk_space
            );


            pushHistory(
                id,
                "gpu",
                device.metrics.gpu_usage
            );


            /*
             * The agent already calculates:
             *
             * network_sent_bytes
             * network_received_bytes
             *
             * as BYTES PER SECOND.
             */

            const networkKbps =
                (
                    safeNumber(
                        device.metrics
                            .network_sent_bytes
                    ) +

                    safeNumber(
                        device.metrics
                            .network_received_bytes
                    )
                ) * 8 / 1024;


            pushHistory(
                id,
                "net",
                networkKbps
            );
        }
    });
}


function pushHistory(
    id,
    metric,
    value
) {

    if (!deviceHistory[id]) {

        deviceHistory[id] =
            createHistory();
    }


    if (
        !Array.isArray(
            deviceHistory[id][metric]
        )
    ) {

        deviceHistory[id][metric] =
            [];
    }


    deviceHistory[id][metric]
        .push(
            safeNumber(value)
        );


    /*
     * Keep history bounded.
     */
    if (
        deviceHistory[id][metric]
            .length > 1800
    ) {

        deviceHistory[id][metric]
            .shift();
    }
}


/* =========================================================
   AI STATE
========================================================= */

function normalizeMetricName(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return null;
    }


    const text =
        String(value)
            .toLowerCase();


    if (text.includes("cpu")) {
        return "cpu";
    }


    if (
        text.includes("ram") ||
        text.includes("memory")
    ) {

        return "ram";
    }


    if (text.includes("disk")) {
        return "disk";
    }


    if (
        text.includes("network") ||
        text.includes("net")
    ) {

        return "net";
    }


    if (text.includes("gpu")) {
        return "gpu";
    }


    return null;
}


function parseAI(prediction) {

    if (
        prediction === null ||
        prediction === undefined ||
        prediction === ""
    ) {

        return {
            text: "NORMAL",
            isNormal: true,
            conf: 1,
            metric: null,
            interpretation:
                "Behavior is within the expected range."
        };
    }


    let rawText = "";

    let confidence = 1;

    let metric = null;


    if (
        typeof prediction ===
        "object"
    ) {

        /*
         * Backend may send:
         *
         * {
         *     pred: "ddos",
         *     confidence: 0.99
         * }
         */

        rawText =
            String(
                prediction.pred ??
                prediction.prediction ??
                prediction.label ??
                prediction.state ??
                prediction.result ??
                ""
            )
            .trim()
            .toLowerCase();


        if (
            prediction.confidence !==
                undefined &&
            prediction.confidence !==
                null
        ) {

            confidence =
                safeNumber(
                    prediction.confidence
                );
        }


        metric =
            normalizeMetricName(
                prediction.metric ??
                prediction.metric_name ??
                prediction.anomaly_metric ??
                prediction.feature ??
                prediction.feature_name ??
                prediction.component
            );

    } else {

        rawText =
            String(prediction)
                .trim()
                .toLowerCase();
    }


    const isNormal =
        rawText === "" ||
        rawText === "normal" ||
        rawText === "0" ||
        rawText === "ok" ||
        rawText === "healthy";


    const displayNames = {

        normal: "NORMAL",
        ddos: "DDOS",
        dos: "DOS",
        injection: "INJECTION",
        password: "PASSWORD",
        scanning: "SCANNING",
        xss: "XSS"
    };


    const text =
        isNormal

            ? "NORMAL"

            : (
                displayNames[rawText] ||
                rawText
                    .replace(/_/g, " ")
                    .toUpperCase() ||
                "ANOMALY"
            );


    let interpretation;


    if (isNormal) {

        interpretation =
            confidence < 0.90

                ? "Behavior appears normal, but the model has lower confidence in this classification."

                : "Behavior is within the expected range.";

    } else if (text === "DDOS") {

        interpretation =
            "Distributed denial-of-service behavior detected. The system may be receiving an unusually large volume of traffic.";

    } else if (text === "DOS") {

        interpretation =
            "Denial-of-service behavior detected. Network activity suggests an attempt to overwhelm a service or resource.";

    } else if (text === "INJECTION") {

        interpretation =
            "Injection behavior detected. Input patterns may indicate an attempt to introduce malicious commands or data.";

    } else if (text === "PASSWORD") {

        interpretation =
            "Suspicious password-related activity detected.";

    } else if (text === "SCANNING") {

        interpretation =
            "Network scanning behavior detected.";

    } else if (text === "XSS") {

        interpretation =
            "Cross-site scripting behavior detected.";

    } else {

        interpretation =
            "Anomalous behavior detected by the telemetry engine.";
    }


    return {

        text,

        isNormal,

        conf: confidence,

        metric,

        interpretation
    };
}


function getDeviceState(
    id,
    device
) {

    const history =
        deviceHistory[id] ||
        createHistory();


    if (!device?.metrics) {

        return {

            status: "CONNECTING",

            isOffline: true,

            theme: "offline",

            ai: {
                text: "NO DATA",
                isNormal: false,
                conf: null,
                metric: null,
                interpretation:
                    "No live telemetry is available for analysis."
            }
        };
    }


    const offline =
        !history.lastTs ||
        Date.now() -
            history.lastTs >
            8000;


    if (offline) {

        return {

            status: "OFFLINE",

            isOffline: true,

            theme: "offline",

            ai: {
                text: "OFFLINE",
                isNormal: false,
                conf: null,
                metric: null,
                interpretation:
                    "No live telemetry is available for analysis."
            }
        };
    }


    const ai =
        parseAI(
            device.prediction
        );


    let theme;


    if (ai.isNormal) {

        theme =
            ai.conf >= 0.90
                ? "normal"
                : "warning";

    } else {

        theme = "danger";
    }


    return {

        status:
            theme === "normal"
                ? "ONLINE"
                : theme === "warning"
                    ? "WARNING"
                    : "DANGER",

        isOffline: false,

        theme,

        ai
    };
}


function applyMonitorTheme(state) {

    const monitor =
        $("view-monitor");


    if (!monitor) {
        return;
    }


    monitor.classList.remove(
        "monitor-normal",
        "monitor-warning",
        "monitor-danger",
        "monitor-offline"
    );


    monitor.classList.add(
        `monitor-${state.theme}`
    );
}


/* =========================================================
   FLEET STATE COLORS
========================================================= */

/*
 * This function is deliberately kept separate from
 * buildDeviceCard() so live telemetry can change the
 * card's appearance WITHOUT rebuilding the card.
 */

function applyFleetCardTheme(card, state) {

    if (!card) {
        return;
    }


    card.classList.remove(
        "fleet-normal",
        "fleet-warning",
        "fleet-danger",
        "fleet-offline",

        "state-normal",
        "state-warning",
        "state-danger",
        "state-offline"
    );


    card.classList.add(
        `fleet-${state.theme}`,
        `state-${state.theme}`
    );


    /*
     * Set a data attribute as well.
     * This gives the existing CSS another reliable
     * selector without changing the HTML structure.
     */
    card.dataset.state =
        state.theme;


    const aiElement =
        card.querySelector(
            '[data-fleet-value="ai"]'
        );


    const statusElement =
        card.querySelector(
            '[data-fleet-value="status"]'
        );


    const dot =
        card.querySelector(
            ".status-dot"
        );


    const colors = {

        normal: {
            main: "var(--success, #14a878)",
            soft: "rgba(20,168,120,.12)",
            border: "rgba(20,168,120,.35)"
        },

        warning: {
            main: "var(--warning, #e0a11a)",
            soft: "rgba(224,161,26,.12)",
            border: "rgba(224,161,26,.35)"
        },

        danger: {
            main: "var(--danger, #e05252)",
            soft: "rgba(224,82,82,.12)",
            border: "rgba(224,82,82,.35)"
        },

        offline: {
            main: "var(--text-soft, #7c8795)",
            soft: "rgba(124,135,149,.10)",
            border: "rgba(124,135,149,.25)"
        }
    };


    const color =
        colors[state.theme] ||
        colors.offline;


    /*
     * These variables allow the existing CSS to
     * pick up the correct state color.
     */
    card.style.setProperty(
        "--fleet-state-color",
        color.main
    );

    card.style.setProperty(
        "--fleet-state-soft",
        color.soft
    );

    card.style.setProperty(
        "--fleet-state-border",
        color.border
    );


    /*
     * Also apply the live state directly to the
     * visible elements. This guarantees the color
     * changes even if the old CSS is not targeting
     * the new state class.
     */
    if (aiElement) {

        aiElement.style.color =
            color.main;
    }


    if (statusElement) {

        statusElement.style.color =
            color.main;
    }


    if (dot) {

        dot.style.background =
            color.main;

        dot.style.boxShadow =
            `0 0 0 4px ${color.soft}`;
    }


    /*
     * A subtle state border/background while
     * preserving the neumorphic card.
     */
    card.style.borderColor =
        color.border;
}


/* =========================================================
   FLEET ANOMALY DETECTION
========================================================= */

/*
 * This is the important fix for the alert.
 *
 * Previously the alert was only checked by
 * updateMonitorHeader(), which means it could not
 * start until the user entered the monitor page.
 *
 * Now every WebSocket packet is checked from the
 * fleet page as soon as telemetry arrives.
 */

function updateFleetAnomalyAlerts() {

    const ids =
        Object.keys(backendData);


    let detectedDevice = null;
    let detectedMetric = null;


    for (const id of ids) {

        const device =
            backendData[id];

        const state =
            getDeviceState(
                id,
                device
            );


        if (
            state.isOffline ||
            state.ai.isNormal
        ) {

            if (
                lastAIStates[id] ===
                "ALERT"
            ) {

                lastAIStates[id] =
                    "NORMAL";
            }

            continue;
        }


        /*
         * New anomaly.
         */
        if (
            lastAIStates[id] !==
            "ALERT"
        ) {

            anomalyAcknowledged[id] =
                false;
        }


        lastAIStates[id] =
            "ALERT";


        /*
         * If the user has not acknowledged
         * this device's anomaly, it can sound.
         */
        if (
            !anomalyAcknowledged[id] &&
            !detectedDevice
        ) {

            detectedDevice =
                id;

            detectedMetric =
                state.ai.metric ||
                appState.activeTab;
        }
    }


    /*
     * If an anomaly is currently active,
     * check whether that device still exists.
     */
    if (
        anomalyAlertActive &&
        anomalyAlertDevice &&
        !backendData[anomalyAlertDevice]
    ) {

        stopAnomalyAlert();

        return;
    }


    /*
     * Start alert immediately.
     */
    if (
        detectedDevice &&
        !anomalyAlertActive
    ) {

        startAnomalyAlert(
            detectedMetric,
            detectedDevice
        );

        return;
    }


    /*
     * If the current alert device has been
     * acknowledged, stop it.
     */
    if (
        anomalyAlertActive &&
        anomalyAlertDevice
    ) {

        const currentDevice =
            backendData[
                anomalyAlertDevice
            ];

        const currentState =
            getDeviceState(
                anomalyAlertDevice,
                currentDevice
            );


        if (
            !currentDevice ||
            currentState.isOffline ||
            currentState.ai.isNormal ||
            anomalyAcknowledged[
                anomalyAlertDevice
            ]
        ) {

            stopAnomalyAlert();
        }
    }
}


/* =========================================================
   FLEET
========================================================= */

function renderFleet() {

    const grid =
        $("fleet-grid");


    if (!grid) {
        return;
    }


    const ids =
        Object.keys(
            backendData
        );


    setText(
        "device-count",
        ids.length
    );


    /*
     * Only rebuild cards when the actual
     * device list changes.
     */
    const structure =
        ids.join("|");


    if (
        structure !==
            fleetStructureKey ||
        !$("register-device-btn")
    ) {

        fleetStructureKey =
            structure;


        grid.innerHTML =
            ids
                .map(
                    id =>
                        buildDeviceCard(
                            id,
                            backendData[id]
                        )
                )
                .join("") +

            `

            <button
                class="register-card"
                type="button"
                id="register-device-btn"
            >

                <i class="fa-solid fa-plus"></i>

                <strong>
                    Register Device
                </strong>

                <span>
                    Open device intake
                </span>

            </button>
            `;


        /*
         * Device click.
         */

        grid
            .querySelectorAll(
                ".fleet-card"
            )
            .forEach(card => {

                card.addEventListener(
                    "click",
                    () => {

                        switchView(
                            "monitor",
                            card.dataset.deviceId
                        );
                    }
                );
            });


        /*
         * Register button.
         */

        $("register-device-btn")
            ?.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    openPendingModal();
                }
            );
    }


    /*
     * Update live values WITHOUT rebuilding cards.
     */
    ids.forEach(id => {

        const card =
            grid.querySelector(
                `.fleet-card[data-device-id="${CSS.escape(id)}"]`
            );


        if (!card) {
            return;
        }


        const device =
            backendData[id];


        const state =
            getDeviceState(
                id,
                device
            );


        /*
         * APPLY THE STATE COLORS HERE.
         *
         * This happens on every telemetry update,
         * so NORMAL -> DANGER -> NORMAL changes
         * immediately on the front page.
         */
        applyFleetCardTheme(
            card,
            state
        );


        const metrics =
            device.metrics || {};


        const cpu =
            card.querySelector(
                '[data-fleet-value="cpu"]'
            );


        const ram =
            card.querySelector(
                '[data-fleet-value="ram"]'
            );


        const ai =
            card.querySelector(
                '[data-fleet-value="ai"]'
            );


        const status =
            card.querySelector(
                '[data-fleet-value="status"]'
            );


        if (cpu) {

            cpu.textContent =
                state.isOffline

                    ? "—"

                    : formatPercent(
                        metrics.cpu_usage
                    );
        }


        if (ram) {

            ram.textContent =
                state.isOffline

                    ? "—"

                    : formatPercent(
                        metrics.ram_usage
                    );
        }


        if (ai) {

            ai.textContent =
                state.isOffline

                    ? "AI • OFFLINE"

                    : `AI • ${state.ai.text}`;
        }


        if (status) {

            status.textContent =
                state.status;
        }
    });
}


function buildDeviceCard(
    id,
    device
) {

    const state =
        getDeviceState(
            id,
            device
        );


    return `

        <button
            class="neu-raised fleet-card fleet-${state.theme} state-${state.theme}"
            type="button"
            data-device-id="${escapeAttr(id)}"
            data-state="${escapeAttr(state.theme)}"
        >

            <div class="fc-header">

                <div>

                    <h3>
                        ${escapeHtml(
                            device?.name ||
                            "Unnamed device"
                        )}
                    </h3>

                    <span class="text-muted">

                        ${escapeHtml(
                            device?.ip ||
                            "IP unavailable"
                        )}

                    </span>

                </div>


                <div
                    class="fc-os"
                    aria-hidden="true"
                >

                    <i
                        class="${
                            device?.type === "windows"

                                ? "fa-brands fa-windows"

                                : "fa-brands fa-linux"
                        }"
                    ></i>

                </div>

            </div>


            <div class="fc-metrics">

                <div class="fc-stat">

                    <span
                        class="fc-val"
                        data-fleet-value="cpu"
                    >
                        —
                    </span>

                    <span class="fc-lbl">
                        CPU
                    </span>

                </div>


                <div class="fc-stat">

                    <span
                        class="fc-val"
                        data-fleet-value="ram"
                    >
                        —
                    </span>

                    <span class="fc-lbl">
                        Memory
                    </span>

                </div>

            </div>


            <div class="fc-footer">

                <div class="fc-ai">

                    <span
                        class="status-dot"
                    ></span>

                    <span
                        data-fleet-value="ai"
                    >
                        AI • NORMAL
                    </span>

                </div>


                <span
                    class="fc-status"
                    data-fleet-value="status"
                >
                    ONLINE
                </span>

            </div>

        </button>
    `;
}


/* =========================================================
   MONITOR
========================================================= */

function refreshMonitor() {

    if (
        appState.view !== "monitor" ||
        !appState.activeId
    ) {
        return;
    }


    const device =
        backendData[
            appState.activeId
        ];


    if (!device) {

        switchView("fleet");

        return;
    }


    const state =
        getDeviceState(
            appState.activeId,
            device
        );


    applyMonitorTheme(state);


    if (state.isOffline) {

        stopAnomalyAlert();


        if (
            !appState.offlineOverlayDismissed
        ) {

            $("device-offline-overlay")
                ?.classList.remove(
                    "hidden"
                );
        }


        setText(
            "dev-status-text",
            "OFFLINE"
        );


        const badge =
            $("dev-status-badge");


        if (badge) {

            badge.className =
                "status-badge status-offline";
        }


        setText(
            "last-update-text",
            "Offline"
        );


        return;
    }


    appState.offlineOverlayDismissed =
        false;


    $("device-offline-overlay")
        ?.classList.add(
            "hidden"
        );


    updateMonitorHeader(
        device,
        state
    );


    updateSummary(
        device
    );


    updateDetail(
        device
    );
}


function updateMonitorHeader(
    device,
    state
) {

    setText(
        "dev-name",
        device.name ||
            "Unknown"
    );


    setText(
        "dev-meta",
        `${device.ip || "IP unavailable"} • ${device.type || "System"}`
    );


    setText(
        "last-update-text",
        new Date()
            .toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                }
            )
    );


    setText(
        "dev-status-text",
        state.status
    );


    const badge =
        $("dev-status-badge");


    if (badge) {

        badge.className =
            "status-badge " +

            (
                state.theme === "normal"

                    ? "status-online"

                    : state.theme ===
                        "warning"

                        ? "status-warning"

                        : "status-offline"
            );
    }


    setText(
        "ai-state-val",
        state.ai.text
    );


    const aiState =
        $("ai-state-val");


    if (aiState) {

        aiState.className =
            state.ai.isNormal

                ? "text-success"

                : "text-danger";
    }


    setText(
        "ai-conf-val",
        state.ai.conf == null

            ? "—"

            : formatConfidence(
                state.ai.conf
            )
    );


    setText(
        "ai-message",
        state.ai.interpretation
    );


    setText(
        "ai-active-state",
        state.ai.isNormal
            ? "Monitoring"
            : "Alert"
    );


    const aiBadge =
        $("ai-status-badge");


    if (aiBadge) {

        aiBadge.className =
            `status-badge ${
                state.ai.isNormal
                    ? "status-online"
                    : "status-warning"
            }`;
    }


    /*
     * Keep monitor-side anomaly handling.
     *
     * The fleet-side handler already starts the
     * alert before entering this page.
     */
    updateAnomalyAlert(state);
}


/* =========================================================
   SUMMARY
========================================================= */

function updateSummary(device) {

    const metrics =
        device.metrics || {};


    const history =
        deviceHistory[
            appState.activeId
        ] ||
        createHistory();


    const network =
        history.net.length

            ? getLatest(
                history.net
            )

            : (
                (
                    safeNumber(
                        metrics.network_sent_bytes
                    ) +

                    safeNumber(
                        metrics.network_received_bytes
                    )
                ) * 8 / 1024
            );


    setText(
        "sum-cpu",
        formatPercent(
            metrics.cpu_usage
        )
    );


    setText(
        "sum-ram",
        formatPercent(
            metrics.ram_usage
        )
    );


    setText(
        "sum-disk",
        formatPercent(
            metrics.disk_space
        )
    );


    setText(
        "sum-net",
        `${safeNumber(network).toFixed(1)} Kbps`
    );


    setText(
        "sum-cpu-sub",
        safeNumber(
            metrics.cpu_freq
        ) > 0

            ? `${(
                safeNumber(
                    metrics.cpu_freq
                ) / 1000
            ).toFixed(2)} GHz`

            : "CPU data"
    );


    const totalGB =
        safeNumber(
            metrics.ram_total
        ) / 1073741824;


    const usedGB =
        safeNumber(
            metrics.ram_used
        ) / 1073741824;


    setText(
        "sum-ram-sub",
        totalGB > 0

            ? `${usedGB.toFixed(1)} / ${totalGB.toFixed(1)} GB`

            : "Memory data"
    );


    setText(
        "sum-disk-sub",
        "Current utilization"
    );


    setText(
        "sum-net-sub",
        `↑ ${formatRate(
            metrics.network_sent_bytes
        )} / ↓ ${formatRate(
            metrics.network_received_bytes
        )}`
    );


    setText(
        "nav-cpu-value",
        formatPercent(
            metrics.cpu_usage
        )
    );


    setText(
        "nav-ram-value",
        formatPercent(
            metrics.ram_usage
        )
    );


    setText(
        "nav-disk-value",
        formatPercent(
            metrics.disk_space
        )
    );


    setText(
        "nav-net-value",
        `${safeNumber(network).toFixed(1)} Kbps`
    );


    setText(
        "nav-gpu-value",
        formatPercent(
            metrics.gpu_usage
        )
    );
}


/* =========================================================
   DETAIL PAGE
========================================================= */

function updateDetail(device) {

    const tab =
        appState.activeTab;


    const config =
        METRICS[tab];


    const metrics =
        device.metrics || {};


    const history =
        deviceHistory[
            appState.activeId
        ] ||
        createHistory();


    if (!config) {
        return;
    }


    setText(
        "detail-page-title",
        config.title
    );


    setText(
        "chart-title",
        config.title
    );


    setText(
        "chart-sub",
        config.subtitle
    );


    setText(
        "chart-unit",
        config.label
    );


    let points =
        [
            ...(history[tab] || [])
        ];


    /*
     * If history hasn't received a point yet,
     * immediately display the current metric.
     */

    if (!points.length) {

        const live =
            getLiveMetricValue(
                tab,
                metrics
            );


        if (live !== null) {

            points = [live];
        }
    }


    const range =
        Number(
            document.querySelector(
                ".range-btn.active"
            )?.dataset.range || 60
        );


    if (
        range > 0 &&
        points.length > range
    ) {

        points =
            points.slice(
                -range
            );
    }


    if (!points.length) {

        $("chart-empty")
            ?.classList.remove(
                "hidden"
            );


        [
            "chart-now-value",
            "stat-current",
            "stat-avg",
            "stat-peak"
        ]
        .forEach(
            id => setText(id, "—")
        );

    } else {

        $("chart-empty")
            ?.classList.add(
                "hidden"
            );


        const current =
            getLatest(points);


        const average =
            points.reduce(
                (sum, value) =>
                    sum + value,
                0
            ) / points.length;


        const peak =
            Math.max(
                ...points
            );


        setText(
            "chart-now-value",
            `${current.toFixed(1)}${config.unit}`
        );


        setText(
            "stat-current",
            `${current.toFixed(1)}${config.unit}`
        );


        setText(
            "stat-avg",
            `${average.toFixed(1)}${config.unit}`
        );


        setText(
            "stat-peak",
            `${peak.toFixed(1)}${config.unit}`
        );


        updateChartVisuals(
            points,
            config
        );
    }


    /*
     * System data changes according to the
     * currently selected metric.
     */

    populateSystemInfo(
        tab,
        metrics
    );
}


function getLiveMetricValue(
    tab,
    metrics
) {

    if (tab === "cpu") {

        return safeNumber(
            metrics.cpu_usage
        );
    }


    if (tab === "ram") {

        return safeNumber(
            metrics.ram_usage
        );
    }


    if (tab === "disk") {

        return safeNumber(
            metrics.disk_space
        );
    }


    if (tab === "gpu") {

        return safeNumber(
            metrics.gpu_usage
        );
    }


    if (tab === "net") {

        return (
            (
                safeNumber(
                    metrics.network_sent_bytes
                ) +

                safeNumber(
                    metrics.network_received_bytes
                )
            ) * 8 / 1024
        );
    }


    return null;
}


/* =========================================================
   METRIC-SPECIFIC SYSTEM DATA
========================================================= */

function populateSystemInfo(
    tab,
    metrics
) {

    /* CPU */

    if (tab === "cpu") {

        setText(
            "sys-lbl-1",
            "Clock Speed"
        );


        setText(
            "sys-val-1",
            safeNumber(
                metrics.cpu_freq
            ) > 0

                ? `${(
                    safeNumber(
                        metrics.cpu_freq
                    ) / 1000
                ).toFixed(2)} GHz`

                : "—"
        );


        setText(
            "sys-lbl-2",
            "Processes"
        );


        setText(
            "sys-val-2",
            formatMaybeNumber(
                metrics.active_process
            )
        );


        setText(
            "sys-lbl-3",
            "Uptime"
        );


        setText(
            "sys-val-3",
            formatUptime(
                metrics.uptime
            )
        );


        return;
    }


    /* RAM */

    if (tab === "ram") {

        const total =
            safeNumber(
                metrics.ram_total
            ) / 1073741824;


        const used =
            safeNumber(
                metrics.ram_used
            ) / 1073741824;


        const available =
            safeNumber(
                metrics.ram_available
            ) / 1073741824;


        setText(
            "sys-lbl-1",
            "Used"
        );


        setText(
            "sys-val-1",
            total > 0
                ? `${used.toFixed(1)} GB`
                : "—"
        );


        setText(
            "sys-lbl-2",
            "Available"
        );


        setText(
            "sys-val-2",
            total > 0
                ? `${available.toFixed(1)} GB`
                : "—"
        );


        setText(
            "sys-lbl-3",
            "Total"
        );


        setText(
            "sys-val-3",
            total > 0
                ? `${total.toFixed(1)} GB`
                : "—"
        );


        return;
    }


    /* DISK */

    if (tab === "disk") {

        setText(
            "sys-lbl-1",
            "Read"
        );


        setText(
            "sys-val-1",
            formatBytesPerSecond(
                metrics.disk_read_bytes
            )
        );


        setText(
            "sys-lbl-2",
            "Write"
        );


        setText(
            "sys-val-2",
            formatBytesPerSecond(
                metrics.disk_write_bytes
            )
        );


        setText(
            "sys-lbl-3",
            "IOPS"
        );


        const readOps =
            safeNumber(
                metrics.disk_read_ops
            );


        const writeOps =
            safeNumber(
                metrics.disk_write_ops
            );


        setText(
            "sys-val-3",
            formatMaybeNumber(
                readOps + writeOps
            )
        );


        return;
    }


    /* NETWORK */

    if (tab === "net") {

        setText(
            "sys-lbl-1",
            "Sent"
        );


        setText(
            "sys-val-1",
            formatRate(
                metrics.network_sent_bytes
            )
        );


        setText(
            "sys-lbl-2",
            "Received"
        );


        setText(
            "sys-val-2",
            formatRate(
                metrics.network_received_bytes
            )
        );


        setText(
            "sys-lbl-3",
            "TCP connections"
        );


        setText(
            "sys-val-3",
            formatMaybeNumber(
                metrics.Tcp_connections
            )
        );


        return;
    }


    /* GPU */

    if (tab === "gpu") {

        setText(
            "sys-lbl-1",
            "Temperature"
        );


        setText(
            "sys-val-1",
            safeNumber(
                metrics.gpu_temp
            ) > 0

                ? `${safeNumber(
                    metrics.gpu_temp
                ).toFixed(1)} °C`

                : "—"
        );


        setText(
            "sys-lbl-2",
            "GPU Usage"
        );


        setText(
            "sys-val-2",
            formatPercent(
                metrics.gpu_usage
            )
        );


        setText(
            "sys-lbl-3",
            "CPU Temperature"
        );


        setText(
            "sys-val-3",
            safeNumber(
                metrics.cpu_temp
            ) > 0

                ? `${safeNumber(
                    metrics.cpu_temp
                ).toFixed(1)} °C`

                : "—"
        );
    }
}


/* =========================================================
   CHART
========================================================= */

function initChart() {

    const canvas =
        $("telemetryChart");


    if (
        !canvas ||
        typeof Chart === "undefined"
    ) {

        return;
    }


    if (metricChart) {

        metricChart.destroy();
    }


    metricChart =
        new Chart(
            canvas.getContext("2d"),
            {

                type: "line",

                data: {

                    labels: [],

                    datasets: [

                        {

                            label: "Value",

                            data: [],

                            borderColor:
                                "#13a08e",

                            backgroundColor:
                                "rgba(19,160,142,.08)",

                            borderWidth: 2,

                            fill: true,

                            tension: 0.4,

                            pointRadius: 0
                        }
                    ]
                },


                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    /*
                     * SMOOTH LIVE ANIMATION
                     *
                     * The previous code used:
                     *
                     * metricChart.update("none")
                     *
                     * which explicitly disables animation.
                     *
                     * We now let Chart.js animate normally.
                     */
                    animation: {

                        duration: 450,

                        easing: "easeOutQuart"
                    },

                    transitions: {

                        active: {

                            animation: {

                                duration: 350
                            }
                        }
                    },

                    interaction: {
                        intersect: false,
                        mode: "index"
                    },


                    scales: {

                        y: {

                            beginAtZero: true,

                            grid: {
                                color:
                                    "rgba(78,101,124,.08)"
                            },

                            ticks: {
                                color:
                                    "var(--text-soft)"
                            }
                        },


                        x: {
                            display: false
                        }
                    },


                    plugins: {

                        legend: {
                            display: false
                        }
                    }
                }
            }
        );
}


function updateChartVisuals(
    points,
    config
) {

    if (!metricChart) {
        return;
    }


    metricChart.data.labels =
        points.map(
            (_, index) =>
                index
        );


    metricChart
        .data
        .datasets[0]
        .data = points;


    metricChart
        .data
        .datasets[0]
        .label =
            config.label;


    metricChart
        .options
        .scales
        .y
        .suggestedMax =
        appState.activeTab === "net"
            ? undefined
            : 100;


    /*
     * IMPORTANT:
     *
     * DO NOT use:
     *
     * update("none")
     *
     * because that disables the smooth animation.
     */
    metricChart.update();
}


/* =========================================================
   ANOMALY ALERT SOUND
========================================================= */

function updateAnomalyAlert(
    state
) {

    const id =
        appState.activeId;


    if (
        !id ||
        state.isOffline ||
        state.ai.isNormal
    ) {

        /*
         * Do not reset acknowledgement here.
         *
         * Resetting it on every monitor refresh
         * could cause the same anomaly to start
         * sounding again unexpectedly.
         */

        if (id) {

            lastAIStates[id] =
                "NORMAL";
        }


        if (
            anomalyAlertDevice === id
        ) {

            stopAnomalyAlert();
        }


        return;
    }


    if (
        lastAIStates[id] !==
        "ALERT"
    ) {

        anomalyAcknowledged[id] =
            false;
    }


    lastAIStates[id] =
        "ALERT";


    if (
        !anomalyAcknowledged[id]
    ) {

        /*
         * Normally this has already been started
         * by updateFleetAnomalyAlerts().
         *
         * This remains as a safety fallback if
         * the monitor receives the anomaly first.
         */
        startAnomalyAlert(
            state.ai.metric ||
            appState.activeTab,
            id
        );
    }
}


function startAnomalyAlert(
    metric = null,
    deviceId = null
) {

    if (metric) {

        anomalyAlertMetric =
            metric;
    }


    if (deviceId) {

        anomalyAlertDevice =
            deviceId;
    }


    if (anomalyAlertActive) {
        return;
    }


    anomalyAlertActive =
        true;


    /*
     * BEEP BEEP BEEP
     */
    sounds.alert();


    /*
     * Repeat every 2.6 seconds.
     */
    anomalyAlertTimer =
        setInterval(
            () => {

                if (
                    anomalyAlertActive
                ) {

                    sounds.alert();
                }

            },
            2600
        );
}


function stopAnomalyAlert() {

    anomalyAlertActive =
        false;


    anomalyAlertMetric =
        null;


    anomalyAlertDevice =
        null;


    if (
        anomalyAlertTimer !==
        null
    ) {

        clearInterval(
            anomalyAlertTimer
        );

        anomalyAlertTimer =
            null;
    }
}


function stopAnomalyAlertIfMatching(
    metric
) {

    if (!anomalyAlertActive) {
        return;
    }


    /*
     * Stop only when the user clicks
     * the metric responsible for the alert.
     *
     * If backend did not identify a metric,
     * the active metric is used.
     */

    if (
        !anomalyAlertMetric ||
        anomalyAlertMetric === metric
    ) {

        if (anomalyAlertDevice) {

            anomalyAcknowledged[
                anomalyAlertDevice
            ] = true;
        }

        if (appState.activeId) {

            anomalyAcknowledged[
                appState.activeId
            ] = true;
        }


        stopAnomalyAlert();
    }
}


/* =========================================================
   SOUND ENGINE
========================================================= */

const sounds = {

    alert() {

        /*
         * BEEP
         * BEEP
         * BEEP
         */

        tone(
            880,
            0.11,
            0.045,
            "square",
            880
        );


        setTimeout(
            () =>
                tone(
                    880,
                    0.11,
                    0.045,
                    "square",
                    880
                ),
            180
        );


        setTimeout(
            () =>
                tone(
                    880,
                    0.11,
                    0.045,
                    "square",
                    880
                ),
            360
        );
    }
};


function unlockAudio() {

    try {

        if (!audioContext) {

            const AudioContextClass =
                window.AudioContext ||
                window.webkitAudioContext;


            if (!AudioContextClass) {
                return;
            }


            audioContext =
                new AudioContextClass();
        }


        if (
            audioContext.state ===
            "suspended"
        ) {

            audioContext
                .resume()
                .catch(() => {});
        }

    } catch {}
}


function tone(
    frequency,
    duration,
    volume = 0.02,
    type = "sine",
    endFrequency = frequency
) {

    unlockAudio();


    if (!audioContext) {
        return;
    }


    const now =
        audioContext.currentTime;


    const oscillator =
        audioContext.createOscillator();


    const gain =
        audioContext.createGain();


    oscillator.type =
        type;


    oscillator.frequency
        .setValueAtTime(
            frequency,
            now
        );


    oscillator.frequency
        .exponentialRampToValueAtTime(
            Math.max(
                20,
                endFrequency
            ),
            now + duration
        );


    gain.gain
        .setValueAtTime(
            0.0001,
            now
        );


    gain.gain
        .exponentialRampToValueAtTime(
            volume,
            now + 0.008
        );


    gain.gain
        .exponentialRampToValueAtTime(
            0.0001,
            now + duration
        );


    oscillator.connect(gain);

    gain.connect(
        audioContext.destination
    );


    oscillator.start(now);

    oscillator.stop(
        now + duration + 0.02
    );
}


/*
 * Unlock browser audio after the first
 * user interaction.
 */

window.addEventListener(
    "pointerdown",
    unlockAudio,
    {
        once: true,
        passive: true
    }
);


window.addEventListener(
    "keydown",
    unlockAudio,
    {
        once: true
    }
);


/* =========================================================
   PUBLIC FUNCTIONS
========================================================= */

window.openPendingModal =
    openPendingModal;

window.closePendingModal =
    closePendingModal;