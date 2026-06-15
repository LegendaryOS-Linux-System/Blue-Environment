#!/usr/bin/hl
# BEDM — Blue Environment Display Manager
# One-command installer script
# Usage: sudo bash install.sh [--autologin username]
set -euo pipefail

##############################################################################
# Config
##############################################################################

BEDM_VERSION="1.0.0"
BEDM_BINDIR="/usr/bin"
BEDM_SYSCONFDIR="/etc/bedm"
BEDM_SYSTEMD="/usr/lib/systemd/system"
BEDM_PAMDIR="/etc/pam.d"
BEDM_VARDIR="/var/lib/bedm"
BEDM_LOGDIR="/var/log/bedm"
BEDM_RUNDIR="/run/bedm"

# Colors
R='\033[0;31m'  G='\033[0;32m'  Y='\033[1;33m'
C='\033[0;36m'  B='\033[1;34m'  N='\033[0m'

##############################################################################
# Helpers
##############################################################################

info()    { echo -e "${C}  →${N} $*"; }
ok()      { echo -e "${G}  ✓${N} $*"; }
warn()    { echo -e "${Y}  !${N} $*"; }
err()     { echo -e "${R}  ✗${N} $*" >&2; }
die()     { err "$*"; exit 1; }
section() { echo -e "\n${B}══ $* ══${N}"; }

require_root() {
    [[ $EUID -eq 0 ]] || die "This script must be run as root"
}

detect_package_manager() {
    if command -v apt-get &>/dev/null; then echo "apt"
    elif command -v dnf &>/dev/null; then echo "dnf"
    elif command -v pacman &>/dev/null; then echo "pacman"
    elif command -v zypper &>/dev/null; then echo "zypper"
    else echo "unknown"
    fi
}

##############################################################################
# Main
##############################################################################

require_root

AUTOLOGIN_USER=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --autologin) AUTOLOGIN_USER="${2:-}"; shift 2 ;;
        --help|-h)
            echo "Usage: sudo bash install.sh [--autologin USERNAME]"
            exit 0 ;;
        *) warn "Unknown argument: $1"; shift ;;
    esac
done

echo -e ""
echo -e "${B}  ██████╗ ███████╗██████╗ ███╗   ███╗${N}"
echo -e "${B}  ██╔══██╗██╔════╝██╔══██╗████╗ ████║${N}"
echo -e "${B}  ██████╔╝█████╗  ██║  ██║██╔████╔██║${N}"
echo -e "${B}  ██╔══██╗██╔══╝  ██║  ██║██║╚██╔╝██║${N}"
echo -e "${B}  ██████╔╝███████╗██████╔╝██║ ╚═╝ ██║${N}"
echo -e "${B}  ╚═════╝ ╚══════╝╚═════╝ ╚═╝     ╚═╝${N}"
echo -e "${C}  Blue Environment Display Manager v${BEDM_VERSION}${N}"
echo -e ""

##############################################################################
section "Pre-flight checks"
##############################################################################

# Check we're not replacing a running session wrongly
if systemctl is-active --quiet bedm 2>/dev/null; then
    warn "BEDM is already running — will reinstall"
fi

# Detect existing display managers
EXISTING_DMS=()
for dm in gdm gdm3 sddm lightdm lxdm xdm slim; do
    if systemctl is-enabled --quiet "$dm" 2>/dev/null; then
        EXISTING_DMS+=("$dm")
    fi
done

if [[ ${#EXISTING_DMS[@]} -gt 0 ]]; then
    warn "Found existing display manager(s): ${EXISTING_DMS[*]}"
    warn "These will be disabled in favor of BEDM"
    read -rp "  Continue? [y/N] " ans
    [[ "${ans,,}" == "y" ]] || { info "Aborted"; exit 0; }
fi

# Build check — either pre-built binaries or source
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DAEMON_BIN="$SCRIPT_DIR/bedm-daemon/target/release/bedm"
GREETER_BIN="$SCRIPT_DIR/bedm-greeter/target/release/bedm-greeter"

if [[ ! -f "$DAEMON_BIN" ]]; then
    info "Binary not found — attempting source build"

    # Check build deps
    command -v cargo &>/dev/null || die "Rust/cargo not found — install from https://rustup.rs"
    command -v npm   &>/dev/null || die "Node.js/npm not found — install Node.js first"

    info "Building BEDM (this may take a few minutes)..."
    make -C "$SCRIPT_DIR" build || die "Build failed — check error output above"
fi

[[ -f "$DAEMON_BIN" ]]   || die "Daemon binary missing after build"
[[ -f "$GREETER_BIN" ]]  || die "Greeter binary missing after build"
ok "Binaries ready"

##############################################################################
section "Creating directories"
##############################################################################

for dir in "$BEDM_SYSCONFDIR" "$BEDM_VARDIR" "$BEDM_LOGDIR" "$BEDM_RUNDIR" \
           "$BEDM_RUNDIR/sessions" "$BEDM_VARDIR/users"; do
    install -dm755 "$dir"
    ok "Created $dir"
done

##############################################################################
section "Installing binaries"
##############################################################################

install -Dm755 "$DAEMON_BIN"   "$BEDM_BINDIR/bedm"
install -Dm755 "$GREETER_BIN"  "$BEDM_BINDIR/bedm-greeter"
ok "Installed /usr/bin/bedm"
ok "Installed /usr/bin/bedm-greeter"

##############################################################################
section "Installing PAM configuration"
##############################################################################

install -Dm644 "$SCRIPT_DIR/config/pam-bedm" "$BEDM_PAMDIR/bedm"
ok "PAM service: /etc/pam.d/bedm"

##############################################################################
section "Installing systemd service"
##############################################################################

install -Dm644 "$SCRIPT_DIR/systemd/bedm.service" "$BEDM_SYSTEMD/bedm.service"
systemctl daemon-reload
ok "systemd service installed"

##############################################################################
section "Installing configuration"
##############################################################################

if [[ ! -f "$BEDM_SYSCONFDIR/bedm.toml" ]]; then
    install -Dm644 "$SCRIPT_DIR/config/bedm.toml" "$BEDM_SYSCONFDIR/bedm.toml"
    ok "Default config: /etc/bedm/bedm.toml"
else
    warn "Config exists — preserved: /etc/bedm/bedm.toml"
fi

# Handle autologin
if [[ -n "$AUTOLOGIN_USER" ]]; then
    if id "$AUTOLOGIN_USER" &>/dev/null; then
        # Patch config
        sed -i "s/^# autologin_user.*/autologin_user = \"$AUTOLOGIN_USER\"/" \
            "$BEDM_SYSCONFDIR/bedm.toml"
        # If line still commented, append
        grep -q "^autologin_user" "$BEDM_SYSCONFDIR/bedm.toml" || \
            echo "autologin_user = \"$AUTOLOGIN_USER\"" >> "$BEDM_SYSCONFDIR/bedm.toml"
        ok "Autologin configured for: $AUTOLOGIN_USER"
    else
        warn "User '$AUTOLOGIN_USER' not found — autologin not configured"
    fi
fi

##############################################################################
section "Disabling conflicting display managers"
##############################################################################

for dm in "${EXISTING_DMS[@]}"; do
    systemctl disable --now "$dm" 2>/dev/null && ok "Disabled: $dm" || warn "Could not disable: $dm"
done

##############################################################################
section "Enabling BEDM"
##############################################################################

# Link as display-manager.service
ln -sf "$BEDM_SYSTEMD/bedm.service" "$BEDM_SYSTEMD/display-manager.service" 2>/dev/null || true

systemctl enable bedm
ok "BEDM enabled as display manager"

##############################################################################
# Summary
##############################################################################

echo -e ""
echo -e "${G}══════════════════════════════════════════════════${N}"
echo -e "${G}  BEDM v${BEDM_VERSION} installed successfully!${N}"
echo -e "${G}══════════════════════════════════════════════════${N}"
echo -e ""
echo -e "  Daemon:    ${C}${BEDM_BINDIR}/bedm${N}"
echo -e "  Greeter:   ${C}${BEDM_BINDIR}/bedm-greeter${N}"
echo -e "  Config:    ${C}${BEDM_SYSCONFDIR}/bedm.toml${N}"
echo -e "  Logs:      ${C}journalctl -u bedm${N}"
echo -e ""
echo -e "${Y}  Start now:  ${N}systemctl start bedm"
echo -e "${Y}  Or reboot:  ${N}reboot"
echo -e ""

# Offer to start immediately
read -rp "  Start BEDM now? [Y/n] " ans
if [[ "${ans,,}" != "n" ]]; then
    info "Starting BEDM..."
    systemctl start bedm &
    ok "BEDM started — switching to display manager"
fi
