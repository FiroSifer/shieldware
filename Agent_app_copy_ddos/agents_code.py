from metrics import get_metrics

import json
import os
import re
import socket
import sys
import time
import tkinter as tk
from tkinter import messagebox

import requests as rq


# ============================================================
# CONFIG
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

CONFIG_FILE = os.path.join(
    BASE_DIR,
    "device_config.json"
)

LOGO_FILE = os.path.join(
    BASE_DIR,
    "architeo_logo.png"
)

SERVER_PORT = 8000

REQUEST_TIMEOUT = 5

STREAM_INTERVAL = 0.1


# ============================================================
# NETWORK
# ============================================================

def get_local_ip():

    try:

        s = socket.socket(
            socket.AF_INET,
            socket.SOCK_DGRAM
        )

        s.connect(
            ("8.8.8.8", 80)
        )

        ip = s.getsockname()[0]

        s.close()

        return ip

    except Exception:

        return "127.0.0.1"


def build_server_url(server_ip):

    server_ip = (
        server_ip
        .strip()
        .rstrip("/")
    )

    if not server_ip:

        raise ValueError(
            "Server IP address cannot be empty."
        )

    if (
        server_ip.startswith("http://")
        or
        server_ip.startswith("https://")
    ):

        return server_ip

    return (
        f"http://{server_ip}:{SERVER_PORT}"
    )


# ============================================================
# CONFIGURATION
# ============================================================

def load_config():

    if not os.path.exists(CONFIG_FILE):
        return {}

    try:

        with open(
            CONFIG_FILE,
            "r",
            encoding="utf-8"
        ) as f:

            config = json.load(f)

        if not isinstance(config, dict):
            return {}

        return config

    except (
        json.JSONDecodeError,
        OSError
    ):

        return {}


def save_config(config):

    with open(
        CONFIG_FILE,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            config,
            f,
            indent=4
        )


# ============================================================
# SETUP WINDOW
# ============================================================

class SetupWindow:

    def __init__(self, existing_config=None):

        self.result = None

        self.existing_config = (
            existing_config or {}
        )

        # ----------------------------------------------------
        # Colors
        # ----------------------------------------------------

        self.bg = "#e8eef3"

        self.card = "#e8eef3"

        self.input_bg = "#dfe6ec"

        self.input_highlight = "#edf2f6"

        self.shadow = "#d0d9e2"

        self.text = "#182b49"

        self.secondary = "#8da5c0"

        self.teal = "#08a99c"

        self.orange = "#f5a400"

        # ----------------------------------------------------
        # Window
        # ----------------------------------------------------

        self.root = tk.Tk()

        self.root.title(
            "Architeo Agent"
        )

        self.root.geometry(
            "520x560"
        )

        self.root.resizable(
            False,
            False
        )

        self.root.configure(
            bg=self.bg
        )

        self.root.protocol(
            "WM_DELETE_WINDOW",
            self.cancel
        )

        # Center window
        self.center_window()

        # Build UI
        self.build_ui()

        self.root.mainloop()

    # ========================================================
    # CENTER WINDOW
    # ========================================================

    def center_window(self):

        self.root.update_idletasks()

        width = 520
        height = 560

        x = (
            self.root.winfo_screenwidth()
            - width
        ) // 2

        y = (
            self.root.winfo_screenheight()
            - height
        ) // 2

        self.root.geometry(
            f"{width}x{height}+{x}+{y}"
        )

    # ========================================================
    # BUILD UI
    # ========================================================

    def build_ui(self):

        # ----------------------------------------------------
        # Card shadow
        # ----------------------------------------------------

        shadow = tk.Frame(
            self.root,
            bg=self.shadow,
            width=420,
            height=470
        )

        shadow.place(
            relx=0.5,
            rely=0.505,
            anchor="center"
        )

        # ----------------------------------------------------
        # Main card
        # ----------------------------------------------------

        card = tk.Frame(
            self.root,
            bg=self.card,
            width=420,
            height=470
        )

        card.place(
            relx=0.5,
            rely=0.5,
            anchor="center"
        )

        # ----------------------------------------------------
        # Logo
        # ----------------------------------------------------

        self.create_logo(card)

        # ----------------------------------------------------
        # Title
        # ----------------------------------------------------

        title = tk.Label(
            card,
            text="Agent Setup",
            font=(
                "Segoe UI",
                22,
                "bold"
            ),
            fg=self.text,
            bg=self.card
        )

        title.place(
            relx=0.5,
            y=145,
            anchor="center"
        )

        # ----------------------------------------------------
        # DEVICE NAME LABEL
        # ----------------------------------------------------

        name_label = tk.Label(
            card,
            text="Device name",
            font=(
                "Segoe UI",
                10,
                "bold"
            ),
            fg=self.text,
            bg=self.card,
            anchor="w"
        )

        name_label.place(
            x=55,
            y=180,
            width=310,
            height=20
        )

        # ----------------------------------------------------
        # DEVICE NAME FIELD
        # ----------------------------------------------------

        self.name_frame, self.name_entry = (
            self.create_entry(
                card,
                placeholder="e.g. Gaming-PC",
                value=self.existing_config.get(
                    "name",
                    ""
                )
            )
        )

        self.name_frame.place(
            x=55,
            y=207,
            width=310,
            height=45
        )

        # ----------------------------------------------------
        # SERVER IP LABEL
        # ----------------------------------------------------

        server_label = tk.Label(
            card,
            text="Server IP address",
            font=(
                "Segoe UI",
                10,
                "bold"
            ),
            fg=self.text,
            bg=self.card,
            anchor="w"
        )

        server_label.place(
            x=55,
            y=270,
            width=310,
            height=20
        )

        # ----------------------------------------------------
        # SERVER IP FIELD
        # ----------------------------------------------------

        existing_server = (
            self.get_existing_server_ip()
        )

        self.server_frame, self.server_entry = (
            self.create_entry(
                card,
                placeholder="e.g. 192.168.1.50",
                value=existing_server
            )
        )

        self.server_frame.place(
            x=55,
            y=297,
            width=310,
            height=45
        )

        # ----------------------------------------------------
        # CONNECT BUTTON
        # ----------------------------------------------------

        self.start_button = tk.Button(
            card,
            text="Connect  →",
            font=(
                "Segoe UI",
                12,
                "bold"
            ),
            fg=self.teal,
            bg=self.card,
            activeforeground=self.teal,
            activebackground="#dfe6ec",
            relief="flat",
            bd=0,
            cursor="hand2",
            command=self.submit
        )

        self.start_button.place(
            x=55,
            y=370,
            width=310,
            height=50
        )

        # ----------------------------------------------------
        # LOCAL IP
        # ----------------------------------------------------

        local_ip = tk.Label(
            card,
            text=f"Local address: {get_local_ip()}",
            font=(
                "Segoe UI",
                9
            ),
            fg=self.secondary,
            bg=self.card
        )

        local_ip.place(
            relx=0.5,
            y=440,
            anchor="center"
        )

        # ----------------------------------------------------
        # ENTER KEY
        # ----------------------------------------------------

        self.root.bind(
            "<Return>",
            lambda event: self.submit()
        )

        self.name_entry.focus_set()

    # ========================================================
    # LOGO
    # ========================================================

    def create_logo(self, parent):

        # ----------------------------------------------------
        # Use real logo if available
        # ----------------------------------------------------

        if os.path.exists(LOGO_FILE):

            try:

                self.logo_image = tk.PhotoImage(
                    file=LOGO_FILE
                )

                width = (
                    self.logo_image.width()
                )

                height = (
                    self.logo_image.height()
                )

                if (
                    width > 300
                    or
                    height > 100
                ):

                    factor = max(
                        (width + 299) // 300,
                        (height + 99) // 100
                    )

                    self.logo_image = (
                        self.logo_image.subsample(
                            factor
                        )
                    )

                logo = tk.Label(
                    parent,
                    image=self.logo_image,
                    bg=self.card,
                    bd=0
                )

                logo.place(
                    relx=0.5,
                    y=55,
                    anchor="center"
                )

                return

            except tk.TclError:

                pass

        # ----------------------------------------------------
        # Fallback Architeo logo
        # ----------------------------------------------------

        logo_frame = tk.Frame(
            parent,
            bg=self.card
        )

        logo_frame.place(
            relx=0.5,
            y=55,
            anchor="center"
        )

        tk.Label(
            logo_frame,
            text="<",
            font=(
                "Segoe UI",
                30,
                "bold"
            ),
            fg=self.orange,
            bg=self.card
        ).pack(
            side="left"
        )

        tk.Label(
            logo_frame,
            text="/",
            font=(
                "Segoe UI",
                30,
                "bold"
            ),
            fg=self.teal,
            bg=self.card
        ).pack(
            side="left"
        )

        tk.Label(
            logo_frame,
            text="architeo",
            font=(
                "Segoe UI",
                28,
                "bold"
            ),
            fg=self.text,
            bg=self.card
        ).pack(
            side="left"
        )

    # ========================================================
    # INPUT FIELD
    # ========================================================

    def create_entry(
        self,
        parent,
        placeholder,
        value=""
    ):

        # ----------------------------------------------------
        # Outer field
        #
        # This is the visible gray rectangle.
        # ----------------------------------------------------

        frame = tk.Frame(
            parent,
            bg=self.input_bg,
            bd=0,
            highlightthickness=0
        )

        # ----------------------------------------------------
        # Actual typing area
        # ----------------------------------------------------

        entry = tk.Entry(
            frame,
            font=(
                "Segoe UI",
                11
            ),
            fg=self.text,
            bg=self.input_bg,
            relief="flat",
            bd=0,
            highlightthickness=0,
            insertbackground=self.text
        )

        # ----------------------------------------------------
        # Existing value
        # ----------------------------------------------------

        if value:

            entry.insert(
                0,
                value
            )

        # ----------------------------------------------------
        # Placeholder
        # ----------------------------------------------------

        else:

            entry.insert(
                0,
                placeholder
            )

            entry.config(
                fg=self.secondary
            )

            def clear_placeholder(event):

                if (
                    entry.get()
                    == placeholder
                ):

                    entry.delete(
                        0,
                        tk.END
                    )

                    entry.config(
                        fg=self.text
                    )

            def restore_placeholder(event):

                if not entry.get().strip():

                    entry.insert(
                        0,
                        placeholder
                    )

                    entry.config(
                        fg=self.secondary
                    )

            entry.bind(
                "<FocusIn>",
                clear_placeholder
            )

            entry.bind(
                "<FocusOut>",
                restore_placeholder
            )

        # ----------------------------------------------------
        # Put Entry INSIDE rectangle
        # ----------------------------------------------------

        entry.place(
            x=12,
            y=2,
            width=286,
            height=40
        )

        return frame, entry

    # ========================================================
    # EXISTING SERVER
    # ========================================================

    def get_existing_server_ip(self):

        server_url = (
            self.existing_config.get(
                "server_url",
                ""
            )
        )

        if not server_url:
            return ""

        server_url = re.sub(
            r"^https?://",
            "",
            server_url
        )

        port = f":{SERVER_PORT}"

        if server_url.endswith(port):

            server_url = server_url[
                :-len(port)
            ]

        return server_url

    # ========================================================
    # SUBMIT
    # ========================================================

    def submit(self):

        name = (
            self.name_entry
            .get()
            .strip()
        )

        server_ip = (
            self.server_entry
            .get()
            .strip()
        )

        # ----------------------------------------------------
        # Ignore placeholders
        # ----------------------------------------------------

        if name == "e.g. Gaming-PC":
            name = ""

        if server_ip == "e.g. 192.168.1.50":
            server_ip = ""

        # ----------------------------------------------------
        # Validate name
        # ----------------------------------------------------

        if not name:

            messagebox.showerror(
                "Missing information",
                "Please enter a device name.",
                parent=self.root
            )

            self.name_entry.focus_set()

            return

        # ----------------------------------------------------
        # Validate server
        # ----------------------------------------------------

        if not server_ip:

            messagebox.showerror(
                "Missing information",
                "Please enter the server IP address.",
                parent=self.root
            )

            self.server_entry.focus_set()

            return

        # ----------------------------------------------------
        # Build URL
        # ----------------------------------------------------

        try:

            server_url = build_server_url(
                server_ip
            )

        except ValueError as e:

            messagebox.showerror(
                "Invalid server address",
                str(e),
                parent=self.root
            )

            self.server_entry.focus_set()

            return

        # ----------------------------------------------------
        # Save result
        # ----------------------------------------------------

        self.result = {
            "name": name,
            "server_ip": server_ip,
            "server_url": server_url
        }

        self.root.destroy()

    # ========================================================
    # CANCEL
    # ========================================================

    def cancel(self):

        self.result = None

        self.root.destroy()


# ============================================================
# DEVICE ENROLLMENT
# ============================================================

def enroll_device(config):

    server_url = config[
        "server_url"
    ]

    payload = {
        "name": config.get(
            "name",
            "Test"
        ),

        "type": config.get(
            "type",
            "windows"
        ),

        "ip": get_local_ip(),
    }

    print(
        "Initiating handshake with "
        "the main server..."
    )

    # --------------------------------------------------------
    # Enrollment request
    # --------------------------------------------------------

    try:

        res = rq.post(
            url=(
                f"{server_url}"
                f"/device/enrollment_code"
            ),
            json=payload,
            timeout=REQUEST_TIMEOUT
        )

        res.raise_for_status()

        data = res.json()

        enrollment_code = data[
            "enrollment_code"
        ]

        print(
            f"Enrolled. Code: "
            f"[{enrollment_code}]. "
            "Waiting for admin approval..."
        )

    except rq.RequestException as e:

        print(
            f"Connection failed during "
            f"enrollment: {e}"
        )

        sys.exit(1)

    except (
        ValueError,
        KeyError
    ):

        print(
            "Server returned an invalid "
            "enrollment response."
        )

        sys.exit(1)

    # --------------------------------------------------------
    # Approval loop
    # --------------------------------------------------------

    while True:

        time.sleep(3)

        try:

            verification = rq.post(
                url=(
                    f"{server_url}"
                    f"/device/check_approval"
                ),
                json={
                    "enrollment_code":
                        enrollment_code
                },
                timeout=REQUEST_TIMEOUT
            )

        except rq.RequestException as e:

            print(
                f"Server unavailable: {e}"
            )

            continue

        # ----------------------------------------------------
        # Rejected
        # ----------------------------------------------------

        if verification.status_code == 404:

            print(
                "Enrollment rejected. "
                "Exiting."
            )

            sys.exit(1)

        # ----------------------------------------------------
        # Unexpected response
        # ----------------------------------------------------

        if verification.status_code != 200:

            print(
                f"Approval check returned "
                f"HTTP "
                f"{verification.status_code}."
            )

            continue

        # ----------------------------------------------------
        # Parse response
        # ----------------------------------------------------

        try:

            data = verification.json()

        except ValueError:

            print(
                "Server returned an invalid "
                "approval response."
            )

            continue

        # ----------------------------------------------------
        # Approved
        # ----------------------------------------------------

        if (
            "token" in data
            and
            "device_id" in data
        ):

            print(
                "Device approved by admin!"
            )

            config["device_id"] = (
                data["device_id"]
            )

            config["token"] = (
                data["token"]
            )

            save_config(config)

            return config

        # ----------------------------------------------------
        # Pending
        # ----------------------------------------------------

        print(
            "Pending admin approval..."
        )


# ============================================================
# METRIC STREAMING
# ============================================================

def start_streaming(config):

    server_url = config[
        "server_url"
    ]

    headers = {
        "Authorization":
            f"Bearer {config['token']}"
    }

    print(
        f"Streaming metrics for "
        f"{config['name']} "
        f"(ID: {config['device_id']})"
    )

    while True:

        # ----------------------------------------------------
        # Collect
        # ----------------------------------------------------

        current_metrics = get_metrics()

        # ----------------------------------------------------
        # Payload
        # ----------------------------------------------------

        payload = {
            "device_id":
                config["device_id"],

            "metrics":
                current_metrics,
        }

        # ----------------------------------------------------
        # Send
        # ----------------------------------------------------

        try:

            res = rq.post(
                f"{server_url}/metrics",
                json=payload,
                headers=headers,
                timeout=REQUEST_TIMEOUT
            )

            # ------------------------------------------------
            # Credentials invalid
            # ------------------------------------------------

            if res.status_code in (
                401,
                403
            ):

                print(
                    "Token revoked or device "
                    "deleted. "
                    "Deleting local credentials..."
                )

                try:

                    os.remove(
                        CONFIG_FILE
                    )

                except OSError:
                    pass

                sys.exit(1)

        except rq.RequestException as e:

            print(
                f"Temporary server "
                f"disconnection: {e}"
            )

        except Exception as e:

            print(
                f"Unexpected error while "
                f"sending metrics: {e}"
            )

        time.sleep(
            STREAM_INTERVAL
        )


# ============================================================
# MAIN
# ============================================================

def main():

    config = load_config()

    # --------------------------------------------------------
    # FIRST RUN / CONFIGURATION
    # --------------------------------------------------------

    if (
        "name" not in config
        or
        "server_url" not in config
    ):

        setup = SetupWindow(
            config
        )

        if setup.result is None:

            sys.exit(0)

        config["name"] = (
            setup.result["name"]
        )

        config["server_url"] = (
            setup.result["server_url"]
        )

        save_config(config)

    # --------------------------------------------------------
    # ENROLLMENT
    # --------------------------------------------------------

    if (
        "device_id" not in config
        or
        "token" not in config
    ):

        config = enroll_device(
            config
        )

    # --------------------------------------------------------
    # STREAMING
    # --------------------------------------------------------

    start_streaming(
        config
    )


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    main()