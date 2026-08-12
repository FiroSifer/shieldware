import psutil as p
import wmi
import time

def get_metrics():
    metrics={}

    #to avoid calling psutil many time
    cpu_time = p.cpu_times()
    cpu_stats = p.cpu_stats()
    virtual = p.virtual_memory()
    disk = p.disk_io_counters()
    net = p.net_io_counters()

    current_interrupts_per_sec=cpu_stats.interrupts
    current_cpu_contx_switch=cpu_stats.ctx_switches

    current_disk_read_bytes=disk.read_bytes
    current_disk_write_bytes=disk.write_bytes
    current_disk_read_ops=disk.read_count
    current_disk_write_ops=disk.write_count

    current_network_sent_bytes=net.bytes_sent
    current_network_rec_bytes=net.bytes_recv
    current_network_sent_packet=net.packets_sent
    current_network_rec_packet=net.packets_recv

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
    

    metrics["cpu_usage"]=p.cpu_percent(interval=None)   #
    metrics["cpu_freq"]=p.cpu_freq().current
    metrics["cpu_user_time"]=cpu_time.user        #
    metrics["cpu_system_time"]=cpu_time.system    #
    metrics["cpu_idle_time"]=cpu_time.idle        #
    metrics["interrupts_per_sec"]=(current_interrupts_per_sec-get_metrics.last_interrupts_per_sec)/dt    #
    metrics["cpu_contx_switch"]=(current_cpu_contx_switch-get_metrics.last_cpu_contx_switch)/dt
    metrics["cpu_temp"]=get_system_temperature_celsius()

    #RAM Metrics
    

    metrics["ram_usage"]=virtual.percent    #
    metrics["ram_total"]=virtual.total
    metrics["ram_used"]=virtual.used
    metrics["ram_available"]=virtual.available
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





    
