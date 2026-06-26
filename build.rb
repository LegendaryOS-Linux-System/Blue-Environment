#!/usr/bin/ruby
# frozen_string_literal: true

require 'fileutils'

# ============================================
# KOLORY I FORMATOWANIE ANSI
# ============================================
COLOR_RESET   = "\e[0m"
COLOR_BOLD    = "\e[1m"
COLOR_RED     = "\e[31m"
COLOR_GREEN   = "\e[32m"
COLOR_YELLOW  = "\e[33m"
COLOR_CYAN    = "\e[36m"

# ============================================
# KONFIGURACJA
# ============================================
BLUE_SHARE = "/usr/share/Blue-Environment"
BLUE_LIBS  = "#{BLUE_SHARE}/lib"
BLUE_APPS  = "#{BLUE_SHARE}/apps"
BLUE_WALLS = "#{BLUE_SHARE}/wallpapers"
VERSION    = "0.7.0"

SHELL_MANIFEST       = "src-tauri/Cargo.toml"
COMPOSITOR_MANIFEST  = "compositor/Cargo.toml"
SHELL_BIN_PATH       = "src-tauri/target/release/blue-environment"
COMPOSITOR_BIN_PATH  = "compositor/target/release/blue-compositor"

# ============================================
# FUNKCJE POMOCNICZE
# ============================================
def check_root
  uid = `id -u`.strip.to_i
  if uid != 0
    puts "#{COLOR_RED}✗ This command requires root privileges#{COLOR_RESET}"
    exit 1
  end
end

def echo_info(msg)
  puts "#{COLOR_CYAN}#{msg}#{COLOR_RESET}"
end

def echo_success(msg)
  puts "#{COLOR_GREEN}  ✓ #{msg}#{COLOR_RESET}"
end

def echo_error(msg)
  puts "#{COLOR_RED}  ✗ #{msg}#{COLOR_RESET}"
end

def echo_warn(msg)
  puts "#{COLOR_YELLOW}  ! #{msg}#{COLOR_RESET}"
end

def echo_build(msg)
  puts "#{COLOR_BOLD}  → #{msg}#{COLOR_RESET}"
end

def print_hr(length = 56)
  puts "—" * length
end

def run_cmd(cmd)
  system(cmd)
  $?.success?
end

def command_exists?(cmd)
  system("which #{cmd} > /dev/null 2>&1")
end

# ============================================
# HELP — wyświetla dostępne komendy
# ============================================
def cmd_help
  print_hr
  puts "#{COLOR_BOLD}Blue Environment v#{VERSION} — Build System#{COLOR_RESET}"
  print_hr
  puts "  #{COLOR_BOLD}ruby build.rb#{COLOR_RESET}              Show this list"
  puts "  #{COLOR_BOLD}ruby build.rb desktop#{COLOR_RESET}      Build shell + compositor, package .rpm"
  puts "                            (Fedora + LegendaryOS)"
  puts "  #{COLOR_BOLD}ruby build.rb android#{COLOR_RESET}      Build the Android target"
  puts "                            (alternative to the stock Android launcher — BETA, not yet working)"
  puts "  #{COLOR_BOLD}ruby build.rb tv#{COLOR_RESET}            Build like 'desktop', with the"
  puts "                            Big Picture (Plasma Big Picture-like) interface"
  puts "  #{COLOR_BOLD}ruby build.rb BEDM#{COLOR_RESET}          Build BEDM (Blue Environment Display Manager)"
  puts "  #{COLOR_BOLD}ruby build.rb compositor#{COLOR_RESET}    Build only the compositor"
  puts "  #{COLOR_BOLD}ruby build.rb all#{COLOR_RESET}           Build both the compositor and the desktop shell"
  puts "                            (no .rpm packaging)"
  print_hr
  puts "  #{COLOR_BOLD}Maintenance#{COLOR_RESET} (not part of the spec above, kept for convenience):"
  puts "    install                Install the desktop build to the system (sudo)"
  puts "    uninstall              Remove it from the system (sudo)"
  puts "    clean                  Remove build artifacts"
  print_hr
end

# ============================================
# WSPÓLNE KROKI BUDOWANIA
# ============================================

# npm install + tsc + vite build (the React/Tauri shell frontend)
def build_frontend
  echo_build "npm install"
  unless run_cmd("npm install")
    echo_error "npm install failed"
    return false
  end
  echo_build "npm run build (tsc + vite)"
  if run_cmd("npm run build")
    echo_success "frontend build complete"
    true
  else
    echo_error "frontend build failed"
    false
  end
end

def build_shell_binary
  echo_build "cargo build — blue-environment (shell)"
  if run_cmd("cargo build --release --manifest-path #{SHELL_MANIFEST}")
    echo_success "blue-environment compiled"
    true
  else
    echo_error "shell build failed"
    false
  end
end

def build_compositor_binary
  echo_build "cargo build — blue-compositor"
  if run_cmd("cargo build --release --manifest-path #{COMPOSITOR_MANIFEST}")
    echo_success "blue-compositor compiled"
    true
  else
    echo_error "compositor build failed"
    false
  end
end

# The 'blue' CLI launcher is a self-contained Ruby script (launcher/main.rb)
# — there is no compiled launcher binary to build, it just needs to be
# staged as an executable named 'blue'.
def build_launcher_cli
  echo_build "staging blue CLI launcher (main.rb + src/)"
  unless File.exist?("launcher/main.rb")
    echo_error "launcher/main.rb missing — skipping CLI"
    return false
  end

  # The launcher is a Ruby source tree, not a compiled binary. We stage
  # it to BLUE_LIBS/blue/ where the wrapper script (launcher/blue →
  # /usr/local/bin/blue) will find it.
  FileUtils.mkdir_p("staging/blue")
  FileUtils.cp("launcher/main.rb", "staging/blue/main.rb")
  FileUtils.cp_r("launcher/src", "staging/blue/src")
  FileUtils.cp("launcher/blue", "blue")
  FileUtils.chmod(0755, "blue")
  echo_success "blue CLI staged (staging/blue/ + blue wrapper)"
  true
end

def stage_rpm_sources(topdir)
  FileUtils.mkdir_p("#{topdir}/SOURCES")
  FileUtils.cp(SHELL_BIN_PATH, "#{topdir}/SOURCES/blue-environment")
  FileUtils.cp(COMPOSITOR_BIN_PATH, "#{topdir}/SOURCES/blue-compositor")
  FileUtils.cp("blue", "#{topdir}/SOURCES/blue")
end

def build_rpm(spec_path, topdir, label)
  FileUtils.mkdir_p(["#{topdir}/BUILD", "#{topdir}/RPMS", "#{topdir}/SOURCES", "#{topdir}/SPECS", "#{topdir}/SRPMS"])
  stage_rpm_sources(topdir)

  spec_out = "#{topdir}/SPECS/blue-environment.spec"
  run_cmd("sed 's/@VERSION@/#{VERSION}/g' #{spec_path} > #{spec_out}")

  pwd = Dir.pwd
  if run_cmd("rpmbuild -bb #{spec_out} --define \"_topdir #{pwd}/#{topdir}\"")
    echo_success "#{label} RPM → #{topdir}/RPMS/"
    true
  else
    echo_error "#{label} RPM build failed"
    false
  end
end

# ============================================
# DESKTOP — shell + compositor, paczki .rpm (Fedora + LegendaryOS)
# ============================================
def cmd_build_desktop
  echo_info "Building Blue Environment v#{VERSION} — Desktop (.rpm: Fedora + LegendaryOS)"

  exit 1 unless build_frontend
  exit 1 unless build_shell_binary
  exit 1 unless build_compositor_binary
  build_launcher_cli

  unless command_exists?("rpmbuild")
    echo_error "rpmbuild not found — install the 'rpm-build' package to produce .rpm files"
    exit 1
  end

  echo_build "packaging Fedora .rpm"
  fedora_ok = build_rpm("packaging/blue-environment-fedora.spec", "rpmbuild/fedora", "Fedora")

  echo_build "packaging LegendaryOS .rpm"
  legendary_ok = build_rpm("packaging/blue-environment-legendaryos.spec", "rpmbuild/legendaryos", "LegendaryOS")

  if fedora_ok && legendary_ok
    puts "#{COLOR_GREEN}✓ Desktop build complete.#{COLOR_RESET}"
  else
    echo_warn "Desktop build finished with errors — see above"
    exit 1
  end
end

# ============================================
# TV — jak 'desktop', ale z interfejsem Big Picture
# ============================================
def cmd_build_tv
  echo_info "Building Blue Environment v#{VERSION} — TV / Big Picture"
  ENV['VITE_BLUE_UI_MODE'] = 'bigpicture'
  echo_build "UI mode flag set: VITE_BLUE_UI_MODE=bigpicture"
  cmd_build_desktop
  echo_warn "Big Picture is currently a UI-mode flag only — the dedicated " \
            "Big Picture interface itself is still on the shell TODO list."
end

# ============================================
# ANDROID — wariant alternatywny dla pulpitu Android (BETA, niedziałający)
# ============================================
def cmd_build_android
  echo_info "Building Blue Environment v#{VERSION} — Android"
  echo_warn "This target is BETA and known not to produce a working build yet."

  unless command_exists?("npx")
    echo_error "npx not found — install Node.js + npm first"
    exit 1
  end
  unless ENV['ANDROID_HOME'] || ENV['ANDROID_SDK_ROOT']
    echo_error "ANDROID_HOME / ANDROID_SDK_ROOT not set — install the Android SDK first"
    exit 1
  end

  exit 1 unless build_frontend

  unless File.directory?("src-tauri/gen/android")
    echo_build "tauri android init"
    run_cmd("npx tauri android init")
  end

  echo_build "tauri android build"
  if run_cmd("npx tauri android build")
    echo_success "Android build finished — verify the .apk manually (beta target)"
  else
    echo_error "Android build failed (expected on this beta target — see warning above)"
    exit 1
  end
end

# ============================================
# BEDM — Blue Environment Display Manager
# ============================================
def cmd_build_bedm
  echo_info "Building BEDM — Blue Environment Display Manager"

  echo_build "cargo build — bedm-daemon"
  daemon_ok = Dir.chdir("BEDM/bedm-daemon") { run_cmd("cargo build --release") }
  daemon_ok ? echo_success("bedm-daemon compiled") : echo_error("bedm-daemon build failed")

  echo_build "npm build — bedm-ui"
  ui_ok = Dir.chdir("BEDM/bedm-ui") { run_cmd("npm install") && run_cmd("npm run build") }
  ui_ok ? echo_success("bedm-ui compiled") : echo_error("bedm-ui build failed")

  echo_build "tauri build — bedm-greeter"
  greeter_ok = Dir.chdir("BEDM/bedm-greeter") { run_cmd("npm install") && run_cmd("npx tauri build") }
  greeter_ok ? echo_success("bedm-greeter compiled") : echo_error("bedm-greeter build failed")

  if daemon_ok && ui_ok && greeter_ok
    puts "#{COLOR_GREEN}✓ BEDM build complete.#{COLOR_RESET}"
  else
    echo_warn "BEDM build finished with errors — see above"
    exit 1
  end
end

# ============================================
# COMPOSITOR — sam kompozytor
# ============================================
def cmd_build_compositor
  echo_info "Building Blue Compositor (standalone)"
  if build_compositor_binary
    puts "#{COLOR_GREEN}✓ Compositor build complete → #{COMPOSITOR_BIN_PATH}#{COLOR_RESET}"
  else
    exit 1
  end
end

# ============================================
# ALL — kompozytor + powłoka (bez pakowania .rpm)
# ============================================
def cmd_build_all
  echo_info "Building Blue Environment v#{VERSION} — compositor + desktop shell"
  exit 1 unless build_compositor_binary
  exit 1 unless build_frontend
  exit 1 unless build_shell_binary
  build_launcher_cli
  puts "#{COLOR_GREEN}✓ Compositor + shell build complete.#{COLOR_RESET}"
end

# ============================================
# INSTALL — instalacja systemowa (build desktop)
# ============================================
def cmd_install
  check_root

  echo_info "Installing Blue Environment v#{VERSION}..."

  FileUtils.mkdir_p([BLUE_LIBS, BLUE_APPS, BLUE_WALLS])
  FileUtils.mkdir_p(["/usr/share/wayland-sessions", "/usr/share/applications"])

  if File.exist?(SHELL_BIN_PATH)
    FileUtils.cp(SHELL_BIN_PATH, "#{BLUE_SHARE}/blue-environment")
    FileUtils.chmod(0755, "#{BLUE_SHARE}/blue-environment")
    echo_success "blue-environment"
  else
    echo_error "binary missing — run 'ruby build.rb desktop' (or 'all') first"
  end

  if File.exist?(COMPOSITOR_BIN_PATH)
    FileUtils.cp(COMPOSITOR_BIN_PATH, "#{BLUE_LIBS}/blue-compositor")
    FileUtils.chmod(0755, "#{BLUE_LIBS}/blue-compositor")
    echo_success "blue-compositor"
  else
    echo_error "compositor missing — run 'ruby build.rb compositor' (or 'all') first"
  end

  if File.exist?("launcher/blue")
    # Install the wrapper to PATH
    FileUtils.cp("launcher/blue", "/usr/local/bin/blue")
    FileUtils.chmod(0755, "/usr/local/bin/blue")
    # Install the full launcher source tree
    launcher_dest = "#{BLUE_LIBS}/blue"
    FileUtils.mkdir_p(launcher_dest)
    FileUtils.cp("launcher/main.rb", "#{launcher_dest}/main.rb")
    FileUtils.cp_r("launcher/src", "#{launcher_dest}/src")
    echo_success "blue CLI"
  end

  if File.directory?("wallpapers")
    FileUtils.cp_r(Dir.glob("wallpapers/*"), "#{BLUE_WALLS}/")
    echo_success "wallpapers"
  end

  wayland_desktop = <<~TEXT
    [Desktop Entry]
    Name=Blue Environment
    Exec=#{BLUE_LIBS}/blue-compositor
    Type=Application
    DesktopNames=Blue
    Version=#{VERSION}
  TEXT
  File.write("/usr/share/wayland-sessions/blue-environment.desktop", wayland_desktop)

  app_desktop = <<~TEXT
    [Desktop Entry]
    Name=Blue Environment
    Exec=#{BLUE_SHARE}/blue-environment
    Icon=#{BLUE_SHARE}/icon.png
    Type=Application
    Categories=System;
  TEXT
  File.write("/usr/share/applications/blue-environment.desktop", app_desktop)

  File.write("#{BLUE_SHARE}/.version", VERSION)

  puts "#{COLOR_GREEN}✓ Installation complete! Run: blue start#{COLOR_RESET}"
end

# ============================================
# UNINSTALL — odinstalacja
# ============================================
def cmd_uninstall
  check_root

  echo_info "Uninstalling Blue Environment..."

  FileUtils.rm_rf(BLUE_SHARE)
  FileUtils.rm_f("/usr/share/wayland-sessions/blue-environment.desktop")
  FileUtils.rm_f("/usr/share/applications/blue-environment.desktop")
  FileUtils.rm_f("/usr/local/bin/blue")

  puts "#{COLOR_YELLOW}✓ Uninstalled. User configs in ~/.config/Blue-Environment kept.#{COLOR_RESET}"
end

# ============================================
# CLEAN — czyszczenie artefaktów
# ============================================
def cmd_clean
  echo_info "Cleaning build artifacts..."

  FileUtils.rm_rf([
    "src-tauri/target", "compositor/target", "dist", "blue", "rpmbuild", "staging",
    "BEDM/bedm-daemon/target", "BEDM/bedm-ui/dist", "BEDM/bedm-greeter/target",
    "BEDM/bedm-greeter/dist", "src-tauri/gen",
  ])

  puts "#{COLOR_GREEN}✓ Clean complete.#{COLOR_RESET}"
end

# ============================================
# MAIN — parsowanie argumentów
# ============================================
action = ARGV[0]

case action
when nil, ""
  cmd_help
when "desktop"
  cmd_build_desktop
when "android"
  cmd_build_android
when "tv"
  cmd_build_tv
when "BEDM", "bedm"
  cmd_build_bedm
when "compositor"
  cmd_build_compositor
when "all"
  cmd_build_all
when "install"
  cmd_install
when "uninstall"
  cmd_uninstall
when "clean"
  cmd_clean
when "help", "-h", "--help"
  cmd_help
else
  puts "#{COLOR_RED}✗ Unknown command: #{action}#{COLOR_RESET}"
  puts "#{COLOR_YELLOW}Run: ruby #{$PROGRAM_NAME}#{COLOR_RESET}"
  exit 1
end
