import psutil as p
import wmi
import time

def get_metrics():
    metrics={}

    current_interrupts_per_sec=p.cpu_stats().interrupts
    current_cpu_contx_switch=p.cpu_stats().ctx_switches

    current_disk_read_bytes=p.disk_io_counters().read_bytes
    current_disk_write_bytes=p.disk_io_counters().write_bytes
    current_disk_read_ops=p.disk_io_counters().read_count
    current_disk_write_ops=p.disk_io_counters().write_count

    current_network_sent_bytes=p.net_io_counters().bytes_sent
    current_network_rec_bytes=p.net_io_counters().bytes_recv
    current_network_sent_packet=p.net_io_counters().packets_sent
    current_network_rec_packet=p.net_io_counters().packets_recv

    current_time=time.time()
    
    if not hasattr(get_metrics,"last_time"):
        get_metrics.last_interrupts_per_sec=current_interrupts_per_sec
        get_metrics.last_cpu_contx_switch=current_cpu_contx_switch
        get_metrics.last_disk_read_bytes=current_disk_read_bytes
        get_metrics.last_disk_write_bytes=current_disk_write_bytes
        get_metrics.last_disk_read_ops=current_disk_read_ops
        get_metrics.last_disk_write_ops=current_disk_write_ops
        get_metrics.last_network_sent_bytes=current_network_sent_bytes
        get_metrics.last_network_rec_bytes=current_network_rec_bytes
        get_metrics.last_network_sent_packet=current_network_sent_packet
        get_metrics.last_network_rec_packet=current_network_rec_packet
        get_metrics.last_time=current_time
        return 0.0

    dt=current_time-get_metrics.last_time
    if dt<0:
        return 0.0

    def get_intel_gpu_usage_percent():
        try:
            w = wmi.WMI()
            # Fetches performance counters for all processes using the GPU
            engines = w.Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine()
            
            total_usage = 0.0
            for engine in engines:
                if engine.UtilizationPercentage is not None:
                    total_usage += float(engine.UtilizationPercentage)
                    
            # Cap at 100.0, as summing multiple engines (3D, Video Decode) can sometimes exceed 100
            return min(total_usage, 100.0)
        except Exception:
            # Returns 0.0 if the performance counter is unavailable or access is denied
            return 0.0

    def get_system_temperature_celsius():
        try:
            w = wmi.WMI(namespace="root\\wmi")
            temp_info = w.MSAcpi_ThermalZoneTemperature()
            if temp_info:
                # WMI returns temperature in deci-Kelvins. Formula: (dK / 10) - 273.15
                deci_kelvin = temp_info[0].CurrentTemperature
                return round((deci_kelvin / 10.0) - 273.15, 2)
            return 0.0
        except Exception as e:
            print(e)
            # Returns 0.0 if access is denied or hardware doesn't support it
            return 0.0
    #CPU Metrics
    metrics["cpu_usage"]=p.cpu_percent(interval=0.1)   #
    metrics["cpu_freq"]=p.cpu_freq().current
    metrics["cpu_user_time"]=p.cpu_times().user        #
    metrics["cpu_system_time"]=p.cpu_times().system    #
    metrics["cpu_idle_time"]=p.cpu_times().idle        #
    metrics["interrupts_per_sec"]=(current_interrupts_per_sec-get_metrics.last_interrupts_per_sec)/dt    #
    metrics["cpu_contx_switch"]=(current_cpu_contx_switch-get_metrics.last_cpu_contx_switch)/dt
    metrics["cpu_temp"]=get_system_temperature_celsius()

    #RAM Metrics
    metrics["ram_usage"]=p.virtual_memory().percent    #
    metrics["ram_total"]=p.virtual_memory().total
    metrics["ram_used"]=p.virtual_memory().used
    metrics["ram_available"]=p.virtual_memory().available
    metrics["page_faults_per_sec"]=p.Process().memory_info().num_page_faults    #

    #GPU Metrics
    metrics["gpu_usage"]=get_intel_gpu_usage_percent()
    metrics["gpu_temp"]=get_system_temperature_celsius()

    #DISK Metrics
    metrics["disk_space"]=p.disk_usage("C:\\").percent
    metrics["disk_read_bytes"]=(current_disk_read_bytes-get_metrics.last_disk_read_bytes)/dt   #
    metrics["disk_write_bytes"]=(current_disk_write_bytes-get_metrics.last_disk_write_bytes)/dt  #
    metrics["disk_read_ops"]=(current_disk_read_ops-get_metrics.last_disk_read_ops)/dt           #
    metrics["disk_write_ops"]=(current_disk_write_ops-get_metrics.last_disk_write_ops)/dt       #
    
    #NETWORK Metrics
    metrics["network_sent_bytes"]=(current_network_sent_bytes-get_metrics.last_network_sent_bytes)/dt   #
    metrics["network_received_bytes"]=(current_network_rec_bytes-get_metrics.last_network_rec_bytes)/dt  #
    metrics["Network_Bytes_Total_sec"]=metrics["network_sent_bytes"]+metrics["network_received_bytes"]   #
    metrics["network_sent_packet"]=(current_network_sent_packet-get_metrics.last_network_sent_packet)/dt  #
    metrics["network_received_packet"]=(current_network_rec_packet-get_metrics.last_network_rec_packet)/dt   #
    metrics["Tcp_connections"]=len(p.net_connections(kind="tcp"))

    #PROCESS Metrics
    metrics["active_process"]=len(p.pids())


    get_metrics.last_interrupts_per_sec = current_interrupts_per_sec
    get_metrics.last_cpu_contx_switch = current_cpu_contx_switch
    get_metrics.last_disk_read_bytes = current_disk_read_bytes
    get_metrics.last_disk_write_bytes = current_disk_write_bytes
    get_metrics.last_disk_read_ops = current_disk_read_ops
    get_metrics.last_disk_write_ops = current_disk_write_ops
    get_metrics.last_network_sent_bytes = current_network_sent_bytes
    get_metrics.last_network_rec_bytes = current_network_rec_bytes
    get_metrics.last_network_sent_packet = current_network_sent_packet
    get_metrics.last_network_rec_packet = current_network_rec_packet
    get_metrics.last_time = current_time
    get_metrics.last_time=current_time

    return metrics

print(get_metrics())





    
