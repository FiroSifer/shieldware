import psutil as p
#import wmi
def get_metrics():
    metrics={}
    """"
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
    """        
    """""
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
    """
    metrics["cpu_usage"]=p.cpu_percent(interval=0.1)
    metrics["ram_usage"]=p.virtual_memory().percent
    metrics["gpu_usage"]=1
    metrics["active_process"]=len(p.pids())
    metrics["disk_space"]=1     #   p.disk_usage("C:\\").percent
    metrics["disk_read"]=p.disk_io_counters().read_bytes
    metrics["disk_write"]=p.disk_io_counters().write_bytes
    metrics["network_sent"]=p.net_io_counters().bytes_sent
    metrics["network_received"]=p.net_io_counters().bytes_recv
    metrics["system_temp"]=1

    return metrics





    
