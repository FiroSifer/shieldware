import psutil as p
import wmi
import time
import pandas as pd


# ============================================================
# DDoS DATASET
# ============================================================

DATASET_FILE = "AI/dataset.csv"

try:
    dataset = pd.read_csv(DATASET_FILE)

    # Keep only DDoS samples
    ddos_data = dataset[
        dataset["type"].astype(str).str.lower().str.strip() == "ddos"
    ].reset_index(drop=True)

    if ddos_data.empty:
        raise ValueError("No DDoS rows found in dataset.csv")

    print(f"[AI TEST MODE] Loaded {len(ddos_data)} DDoS samples.")

except Exception as e:
    print(f"[AI TEST MODE] Failed to load DDoS dataset: {e}")
    ddos_data = None


ddos_index = 0


# ============================================================
# METRICS
# ============================================================

def get_metrics():

    global ddos_index

    metrics = {}

    cpu_time = p.cpu_times()
    cpu_stats = p.cpu_stats()
    virtual = p.virtual_memory()
    disk = p.disk_io_counters()
    net = p.net_io_counters()

    current_time = time.time()

    # --------------------------------------------------------
    # FIRST RUN
    # --------------------------------------------------------

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

        return None


    dt = current_time - get_metrics.last_time

    if dt <= 0:
        dt = 1


    # ========================================================
    # GPU
    # ========================================================

    def get_intel_gpu_usage_percent():

        try:
            w = wmi.WMI()

            engines = (
                w.Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine()
            )

            total_usage = sum(
                float(e.UtilizationPercentage)
                for e in engines
                if e.UtilizationPercentage
            )

            return min(total_usage, 100.0)

        except Exception:
            return 0.0


    # ========================================================
    # TEMPERATURE
    # ========================================================

    def get_system_temperature_celsius():

        try:

            w = wmi.WMI(namespace="root\\wmi")

            temp_info = w.MSAcpi_ThermalZoneTemperature()

            if temp_info:

                return round(
                    (temp_info[0].CurrentTemperature / 10.0) - 273.15,
                    2
                )

            return 0.0

        except Exception:

            return 0.0


    # ========================================================
    # CPU METRICS
    # ========================================================

    metrics["cpu_usage"] = p.cpu_percent(interval=None)

    metrics["cpu_freq"] = p.cpu_freq().current

    metrics["cpu_user_time"] = cpu_time.user

    metrics["cpu_system_time"] = cpu_time.system

    metrics["cpu_idle_time"] = cpu_time.idle

    metrics["interrupts_per_sec"] = (
        cpu_stats.interrupts
        - get_metrics.last_interrupts_per_sec
    ) / dt

    metrics["cpu_contx_switch"] = (
        cpu_stats.ctx_switches
        - get_metrics.last_cpu_contx_switch
    ) / dt

    metrics["cpu_temp"] = get_system_temperature_celsius()


    # ========================================================
    # TASK MANAGER METRICS
    # ========================================================

    metrics["uptime"] = current_time - p.boot_time()

    metrics["logical_processors"] = p.cpu_count(logical=True)

    metrics["cores"] = p.cpu_count(logical=False)


    processes = list(
        p.process_iter(
            [
                "num_threads",
                "num_handles"
            ]
        )
    )

    metrics["threads"] = sum(
        proc.info["num_threads"]
        for proc in processes
        if proc.info["num_threads"] is not None
    )

    metrics["handles"] = sum(
        proc.info["num_handles"]
        for proc in processes
        if proc.info["num_handles"] is not None
    )


    # ========================================================
    # RAM METRICS
    # ========================================================

    metrics["ram_usage"] = virtual.percent

    metrics["ram_total"] = virtual.total

    metrics["ram_used"] = virtual.used

    metrics["ram_available"] = virtual.available

    metrics["page_faults_per_sec"] = (
        p.Process().memory_info().num_page_faults
    )


    # ========================================================
    # GPU METRICS
    # ========================================================

    metrics["gpu_usage"] = get_intel_gpu_usage_percent()

    metrics["gpu_temp"] = get_system_temperature_celsius()


    # ========================================================
    # DISK METRICS
    # ========================================================

    metrics["disk_space"] = p.disk_usage("C:\\").percent

    metrics["disk_read_bytes"] = (
        disk.read_bytes
        - get_metrics.last_disk_read_bytes
    ) / dt

    metrics["disk_write_bytes"] = (
        disk.write_bytes
        - get_metrics.last_disk_write_bytes
    ) / dt

    metrics["disk_read_ops"] = (
        disk.read_count
        - get_metrics.last_disk_read_ops
    ) / dt

    metrics["disk_write_ops"] = (
        disk.write_count
        - get_metrics.last_disk_write_ops
    ) / dt


    # ========================================================
    # NETWORK METRICS
    # ========================================================

    metrics["network_sent_bytes"] = (
        net.bytes_sent
        - get_metrics.last_network_sent_bytes
    ) / dt

    metrics["network_received_bytes"] = (
        net.bytes_recv
        - get_metrics.last_network_rec_bytes
    ) / dt

    metrics["Network_Bytes_Total_sec"] = (
        metrics["network_sent_bytes"]
        + metrics["network_received_bytes"]
    )

    metrics["network_sent_packet"] = (
        net.packets_sent
        - get_metrics.last_network_sent_packet
    ) / dt

    metrics["network_received_packet"] = (
        net.packets_recv
        - get_metrics.last_network_rec_packet
    ) / dt

    metrics["Tcp_connections"] = len(
        p.net_connections(kind="tcp")
    )


    # ========================================================
    # PROCESS METRICS
    # ========================================================

    metrics["active_process"] = len(p.pids())


    # ========================================================
    # TIMESTAMP
    # ========================================================

    metrics["timestamp"] = current_time


    # ========================================================
    # AI TEST MODE
    #
    # Replace ONLY the features used by the MLP with values
    # from a DDoS sample.
    #
    # Everything else above remains REAL PC data.
    # ========================================================

    if ddos_data is not None:

        ddos_row = ddos_data.iloc[ddos_index]

        # Move to the next DDoS sample
        ddos_index += 1

        if ddos_index >= len(ddos_data):
            ddos_index = 0


        # ----------------------------------------------------
        # CPU
        # ----------------------------------------------------

        metrics["cpu_usage"] = ddos_row["cpu_usage"]

        metrics["cpu_user_time"] = ddos_row["cpu_user_time"]

        metrics["cpu_system_time"] = ddos_row["cpu_system_time"]

        metrics["cpu_idle_time"] = ddos_row["cpu_idle_time"]

        metrics["interrupts_per_sec"] = ddos_row["interrupts_per_sec"]


        # ----------------------------------------------------
        # RAM
        # ----------------------------------------------------

        metrics["ram_usage"] = ddos_row["ram_usage"]

        metrics["page_faults_per_sec"] = ddos_row["page_faults_per_sec"]

        # ----------------------------------------------------
        # DISK
        # ----------------------------------------------------

        metrics["disk_read_bytes"] = ddos_row["disk_read_bytes"]

        metrics["disk_write_bytes"] = ddos_row["disk_write_bytes"]

        metrics["disk_read_ops"] = ddos_row["disk_read_ops"]

        metrics["disk_write_ops"] = ddos_row["disk_write_ops"]

        # ----------------------------------------------------
        # NETWORK
        # ----------------------------------------------------

        metrics["network_sent_bytes"] = ddos_row["network_sent_bytes"]

        metrics["network_received_bytes"] = ddos_row["network_received_bytes"]

        metrics["Network_Bytes_Total_sec"] = ddos_row["Network_Bytes_Total_sec"]

        metrics["network_sent_packet"] = ddos_row["network_sent_packet"] 

        metrics["network_received_packet"] = ddos_row["network_received_packet"]


    # ========================================================
    # UPDATE BASELINES
    # ========================================================

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


    # ========================================================
    # RETURN COMPLETE METRICS
    # ========================================================

    return metrics