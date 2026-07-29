import pandas as pd

df=pd.read_csv("./AI/windows10_dataset(in).csv")

data = [
    # Processor
    "Processor_pct_ Processor_Time",
    "Processor_pct_ User_Time",
    "Processor_pct_ Privileged_Time",
    "Processor_pct_ Idle_Time",
    "Processor_Interrupts_sec",
    # Memory
    "Memory pct_ Committed Bytes In Use",
    "Memory Commit Limit",
    "Memory Committed Bytes",
    "Memory Available Bytes",
    "Memory Page Faults sec",
    # LogicalDisk
    "LogicalDisk(_Total) pct_ Free Space",
    "LogicalDisk(_Total) Disk Read Bytes sec",
    "LogicalDisk(_Total) Disk Write Bytes sec",
    "LogicalDisk(_Total) Disk Reads sec",
    "LogicalDisk(_Total) Disk Writes sec",
    # Network
    "Network_I(Intel R _82574L_GNC) Bytes Sent sec",
    "Network_I(Intel R _82574L_GNC) Bytes Received sec",
    "Network_I(Intel R _82574L_GNC) Bytes Total sec",
    "Network_I(Intel R _82574L_GNC) Packets Sent sec",
    "Network_I(Intel R _82574L_GNC) Packets Received sec",
    # Process
    "Process_ID Process"
]


# Select columns from DataFrame
database = df[data]


