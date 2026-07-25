const socket = new WebSocket("ws://" + window.location.host + "/ws");
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
socket.onmessage = function(event){
console.log("recieved data from backend");   
let m = JSON.parse(event.data);
cpu.textContent = m.cpu_usage;
gpu.textContent = m.gpu_usage;
ram.textContent = m.ram_usage;
Temp.textContent = m.system_temp;
net_sent.textContent = m.network_sent;
net_rec.textContent = m.network_received;
disk.textContent = m.disk_space;
disk_sent.textContent = m.disk_write;
disk_rec.textContent = m.disk_read;
pids.textContent = m.active_process;}