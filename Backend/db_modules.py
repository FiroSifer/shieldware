import sqlite3

DataBase = "devices.db"

def get_connection():
    return sqlite3.connect(DataBase)

def init_database():

    conn = get_connection()

    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS devices (
        device_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        ip TEXT NOT NULL,
        token TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()

def save_device(device_id,device_name,device_type,device_ip,token):
    conn = get_connection()

    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO devices (device_id,name,type,ip,token)
        VALUES (?,?,?,?,?)
    """, (
        device_id,
        device_name,
        device_type,
        device_ip,
        token
    ))

    conn.commit()
    conn.close()

def load_devices():

    conn = get_connection()

    cursor = conn.cursor()

    cursor.execute("""
    SELECT device_id,name,type,ip,token 
    FROM devices
    """)

    rows = cursor.fetchall()

    conn.close()

    return rows


def delect_device(device_id):
    conn = get_connection()

    cursor = conn.cursor()

    cursor.execute("""
    DELETE FROM devices
    WHERE device_id = ?
    """ , (device_id,) )

    conn.commit()

    deleted = cursor.rowcount >0

    conn.close()

    return deleted