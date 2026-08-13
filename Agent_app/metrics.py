import psutil as p
import wmi
import time

def get_metrics():
    metrics = {}

    cpu_time = p.cpu_times()
    cpu_stats = p.cpu_stats()
    virtual = p.virtual_memory()
    disk = p.disk_io_counters()
    net = p.net_io_counters()

    current_time = time.time()
    
    if not hasattr(get_metrics, "last_time"):
        get_metrics.last_interrupts_per_sec = cpu_stats.interrupts
        get_metrics.last_cpu_contx_switch = cpu_stats.ctx_switches
        get_metrics.last_disk_read_bytes = disk.read_bytes
        get_metrics.last_disk_write_bytes = disk.write_bytes
        get_metrics.last_disk_read_ops = disk.read_count
        get_metrics.last_disk_write_ops = disk.write_count
        get_metrics.last_network_sent_bytes = net.bytes_sent
        get_metrics.last_network_rec_bytes = net.bytes_recv
        get_metrics.last_network_sent_packet = net.packets_sent
        get_metrics.last_network_rec_packet = net.packets_recv
        get_metrics.last_time = current_time
        return None # Return None on first run to establish baseline

    dt = current_time - get_metrics.last_time
    if dt <= 0: dt = 1 # Prevent division by zero

    def get_intel_gpu_usage_percent():
        try:
            w = wmi.WMI()
            engines = w.Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine()
            total_usage = sum(float(e.UtilizationPercentage) for e in engines if e.UtilizationPercentage)
            return min(total_usage, 100.0)
        except Exception:
            return 0.0

    def get_system_temperature_celsius():
        try:
            w = wmi.WMI(namespace="root\\wmi")
            temp_info = w.MSAcpi_ThermalZoneTemperature()
            if temp_info:
                return round((temp_info[0].CurrentTemperature / 10.0) - 273.15, 2)
            return 0.0
        except:
            return 0.0

    # CPU Metrics
    metrics["cpu_usage"] = p.cpu_percent(interval=None)
    metrics["cpu_freq"] = p.cpu_freq().current
    metrics["cpu_user_time"] = cpu_time.user
    metrics["cpu_system_time"] = cpu_time.system
    metrics["cpu_idle_time"] = cpu_time.idle
    metrics["interrupts_per_sec"] = (cpu_stats.interrupts - get_metrics.last_interrupts_per_sec) / dt
    metrics["cpu_contx_switch"] = (cpu_stats.ctx_switches - get_metrics.last_cpu_contx_switch) / dt
    metrics["cpu_temp"] = get_system_temperature_celsius()

    # Task Manager Specific Metrics
    metrics["uptime"] = current_time - p.boot_time()
    metrics["logical_processors"] = p.cpu_count(logical=True)
    metrics["cores"] = p.cpu_count(logical=False)
    
    # Fast thread/handle approximation
    processes = list(p.process_iter(['num_threads', 'num_handles']))
    metrics["threads"] = sum(proc.info['num_threads'] for proc in processes if proc.info['num_threads'] is not None)
    metrics["handles"] = sum(proc.info['num_handles'] for proc in processes if proc.info['num_handles'] is not None)

    # RAM Metrics
    metrics["ram_usage"] = virtual.percent
    metrics["ram_total"] = virtual.total
    metrics["ram_used"] = virtual.used
    metrics["ram_available"] = virtual.available
    metrics["page_faults_per_sec"] = p.Process().memory_info().num_page_faults

    # GPU Metrics
    metrics["gpu_usage"] = get_intel_gpu_usage_percent()
    metrics["gpu_temp"] = get_system_temperature_celsius()

    # DISK Metrics
    metrics["disk_space"] = p.disk_usage("C:\\").percent
    metrics["disk_read_bytes"] = (disk.read_bytes - get_metrics.last_disk_read_bytes) / dt
    metrics["disk_write_bytes"] = (disk.write_bytes - get_metrics.last_disk_write_bytes) / dt
    metrics["disk_read_ops"] = (disk.read_count - get_metrics.last_disk_read_ops) / dt
    metrics["disk_write_ops"] = (disk.write_count - get_metrics.last_disk_write_ops) / dt
    
    # NETWORK Metrics
    metrics["network_sent_bytes"] = (net.bytes_sent - get_metrics.last_network_sent_bytes) / dt
    metrics["network_received_bytes"] = (net.bytes_recv - get_metrics.last_network_rec_bytes) / dt
    metrics["Network_Bytes_Total_sec"] = metrics["network_sent_bytes"] + metrics["network_received_bytes"]
    metrics["network_sent_packet"] = (net.packets_sent - get_metrics.last_network_sent_packet) / dt
    metrics["network_received_packet"] = (net.packets_recv - get_metrics.last_network_rec_packet) / dt
    metrics["Tcp_connections"] = len(p.net_connections(kind="tcp"))

    # PROCESS Metrics
    metrics["active_process"] = len(p.pids())
    
    # TIMESTAMP FOR OFFLINE DETECTION
    metrics["timestamp"] = current_time

    # Update states
    get_metrics.last_interrupts_per_sec = cpu_stats.interrupts
    get_metrics.last_cpu_contx_switch = cpu_stats.ctx_switches
    get_metrics.last_disk_read_bytes = disk.read_bytes
    get_metrics.last_disk_write_bytes = disk.write_bytes
    get_metrics.last_disk_read_ops = disk.read_count
    get_metrics.last_disk_write_ops = disk.write_count
    get_metrics.last_network_sent_bytes = net.bytes_sent
    get_metrics.last_network_rec_bytes = net.bytes_recv
    get_metrics.last_network_sent_packet = net.packets_sent
    get_metrics.last_network_rec_packet = net.packets_recv
    get_metrics.last_time = current_time

    return metrics