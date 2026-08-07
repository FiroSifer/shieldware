const socket = new WebSocket("ws://127.0.0.1:8000/ws");
console.log("connected");

const cpu = document.getElementById("cpu_usage");

const gpu = document.getElementById("gpu_usage");

const ram = document.getElementById("ram_usage");

const Temp = document.getElementById("sys_temp");

const net_sent = document.getElementById("net_sent");
const net_rec = document.getElementById("net_rec");

const disk = document.getElementById("disk_usage");
const disk_sent = document.getElementById("disk_sent");
const disk_rec = document.getElementById("disk_rec");

const pids = document.getElementById("pids");

socket.onmessage = function (event) {
  console.log("WEBSOCKET DATA:", event.data);

  let latest_data = JSON.parse(event.data);

  console.log("PARSED DATA:", latest_data);
  console.log("PREDICTION:", latest_data.predicted);


  let m = latest_data.metrics || {};
  let predict = latest_data.predicted || {};

  // Fallback to '--' if key is missing or undefined
  if (cpu) cpu.textContent = m.cpu_usage ?? "--";
  if (gpu) gpu.textContent = m.gpu_usage ?? "--";
  if (ram) ram.textContent = m.ram_usage ?? "--";
  if (Temp) Temp.textContent = m.cpu_temp ?? "--";

  if (net_sent) net_sent.textContent = m.network_sent_bytes ?? "--";
  if (net_rec) net_rec.textContent = m.network_received_bytes ?? "--";

  if (disk) disk.textContent = m.disk_space ?? "--";
  if (disk_sent) disk_sent.textContent = m.disk_write_bytes ?? "--";
  if (disk_rec) disk_rec.textContent = m.disk_read_bytes ?? "--";
  if (pids) pids.textContent = predict?.pred ?? "wait";
};