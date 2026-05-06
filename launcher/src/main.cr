require "http/client"
require "json"
require "file_utils"
require "compress/gzip"

# ── Constants ─────────────────────────────────────────────────────────────

VERSION      = "0.4"
GITHUB_RAW   = "https://raw.githubusercontent.com/HackerOS-Linux-System/Blue-Environment/main"
GITHUB_REL   = "https://github.com/HackerOS-Linux-System/Blue-Environment/releases/download"

def blue_home : String
  File.join(ENV.fetch("HOME", "/root"), ".hackeros", "Blue-Environment")
end

def apps_dir : String
  File.join(blue_home, "apps")
end

def libs_dir : String
  File.join(blue_home, "libs")
end

def compositor_bin : String
  File.join(libs_dir, "blue-compositor")
end

def shell_bin : String
  File.join(libs_dir, "blue-environment")
end

def version_file : String
  File.join(blue_home, "version.hacker")
end

def tmp_dir : String
  dir = File.join(ENV.fetch("XDG_RUNTIME_DIR", "/tmp"), ".blue-tmp")
  FileUtils.mkdir_p(dir)
  dir
end

# ── Colours ───────────────────────────────────────────────────────────────

def bold(s)    ; "\e[1m#{s}\e[0m" ; end
def green(s)   ; "\e[32m#{s}\e[0m" ; end
def yellow(s)  ; "\e[33m#{s}\e[0m" ; end
def red(s)     ; "\e[31m#{s}\e[0m" ; end
def cyan(s)    ; "\e[36m#{s}\e[0m" ; end
def dim(s)     ; "\e[2m#{s}\e[0m" ; end

def ok(msg)    ; puts "  #{green("✓")} #{msg}" ; end
def err(msg)   ; puts "  #{red("✗")} #{msg}" ; end
def info(msg)  ; puts "  #{cyan("→")} #{msg}" ; end
def warn(msg)  ; puts "  #{yellow("!")} #{msg}" ; end

# ── HTTP helpers ──────────────────────────────────────────────────────────

def http_get(url : String) : String?
  uri = URI.parse(url)
  HTTP::Client.get(url) do |resp|
    if resp.status.success?
      resp.body_io.gets_to_end
    else
      nil
    end
  end
rescue ex
  nil
end

def download_file(url : String, dest : String) : Bool
  info "Downloading #{File.basename(dest)}..."
  response = HTTP::Client.get(url)
  if response.status.success?
    File.write(dest, response.body)
    ok "Downloaded to #{dest}"
    true
  else
    err "HTTP #{response.status_code}: #{url}"
    false
  end
rescue ex
  err "Download failed: #{ex.message}"
  false
end

def make_executable(path : String)
  File.chmod(path, 0o755)
end

# ── Version helpers ───────────────────────────────────────────────────────

def parse_version(content : String) : String
  # format: [\n 0.1\n]
  content.lines
    .map(&.strip)
    .reject { |l| l.empty? || l == "[" || l == "]" }
    .first? || "0.0"
end

def local_version : String
  return "0.0" unless File.exists?(version_file)
  parse_version(File.read(version_file))
rescue
  "0.0"
end

def remote_version : String?
  body = http_get("#{GITHUB_RAW}/launcher/version.hacker")
  return nil unless body
  parse_version(body)
end

def version_newer?(remote : String, local : String) : Bool
  r = remote.split(".").map(&.to_i)
  l = local.split(".").map(&.to_i)
  max_len = [r.size, l.size].max
  r.concat(Array.new(max_len - r.size, 0))
  l.concat(Array.new(max_len - l.size, 0))
  r.zip(l).each do |rv, lv|
    return true if rv > lv
    return false if rv < lv
  end
  false
end

# ── App list parser ───────────────────────────────────────────────────────

alias AppList = Hash(String, String)

def parse_app_list(content : String) : AppList
  result = AppList.new
  current_name = nil
  content.each_line do |line|
    line = line.strip
    next if line.empty? || line == "[" || line == "]"
    next if line.starts_with?("Blue Environment")
    if line.ends_with?(":")
      current_name = line.chomp(":")
    elsif line.starts_with?("= ") && current_name
      result[current_name] = line[2..]
      current_name = nil
    end
  end
  result
end

def fetch_app_list : AppList?
  body = http_get("#{GITHUB_RAW}/apps/list.hacker")
  return nil unless body
  parse_app_list(body)
end

# ── Commands ──────────────────────────────────────────────────────────────

def cmd_info
  puts ""
  puts "  #{bold("Blue Environment")} — Launcher v#{VERSION}"
  puts "  #{dim("─────────────────────────────────────────")}"
  puts "  Local version  : #{cyan(local_version)}"
  puts "  Compositor     : #{File.exists?(compositor_bin) ? green("installed") : red("missing")}"
  puts "  Shell binary   : #{File.exists?(shell_bin) ? green("installed") : red("missing")}"
  puts "  Apps dir       : #{cyan(apps_dir)}"
  puts ""
  if Dir.exists?(apps_dir)
    apps = Dir.children(apps_dir).select { |d| File.directory?(File.join(apps_dir, d)) }
    if apps.empty?
      puts "  Installed apps : #{dim("none")}"
    else
      puts "  Installed apps :"
      apps.each { |a| puts "    #{green("•")} #{a}" }
    end
  end
  puts ""
end

def cmd_start(bigpicture = false)
  if bigpicture
    puts yellow("Big Picture mode is a placeholder — coming soon!")
    exit 0
  end

  has_wayland = ENV.has_key?("WAYLAND_DISPLAY")
  has_x11     = ENV.has_key?("DISPLAY")

  # If already inside a compositor/DE, just launch the shell
  if has_wayland || has_x11
    cmd_dev
    return
  end

  # Bare metal: start compositor which will spawn everything
  unless File.exists?(compositor_bin)
    err "blue-compositor not found at #{compositor_bin}"
    info "Run: blue update   or   npm run build:compositor"
    exit 1
  end

  info "Starting Blue Compositor (TTY/DRM mode)..."
  exec(compositor_bin)
end

def cmd_dev
  unless File.exists?(shell_bin)
    err "blue-environment not found at #{shell_bin}"
    info "Run: blue update"
    exit 1
  end
  info "Starting Blue Environment (nested/dev mode)..."
  exec(shell_bin)
end

def cmd_update
  puts ""
  info "Checking for updates..."

  lv = local_version
  rv = remote_version

  if rv.nil?
    err "Could not reach GitHub. Check your internet connection."
    exit 1
  end

  puts "  Local  version : #{cyan(lv)}"
  puts "  Remote version : #{cyan(rv)}"
  puts ""

  unless version_newer?(rv, lv)
    ok "Already up to date (#{lv})"
    return
  end

  puts yellow("  Update available: #{lv} → #{rv}")
  puts ""

  FileUtils.mkdir_p(libs_dir)

  # Download binaries
  [
    { url: "#{GITHUB_REL}/v#{rv}/blue-environment", dest: shell_bin },
    { url: "#{GITHUB_REL}/v#{rv}/blue-compositor",  dest: compositor_bin },
  ].each do |pair|
    # Remove old binary
    File.delete(pair[:dest]) if File.exists?(pair[:dest])
    unless download_file(pair[:url], pair[:dest])
      err "Failed to download #{File.basename(pair[:dest])}"
      exit 1
    end
    make_executable(pair[:dest])
    ok "#{File.basename(pair[:dest])} updated and made executable"
  end

  # Update local version file
  File.write(version_file, "[\n #{rv}\n]\n")
  ok "Version file updated to #{rv}"
  puts ""
  ok "Blue Environment updated to v#{rv}!"
end

def cmd_install(name : String)
  puts ""
  info "Fetching package list..."
  list = fetch_app_list
  if list.nil?
    err "Could not fetch package list from GitHub."
    exit 1
  end

  unless list.has_key?(name)
    err "Package '#{name}' not found."
    puts ""
    puts "  Available packages:"
    list.keys.each { |k| puts "    #{green("•")} #{k}" }
    puts ""
    exit 1
  end

  url  = list[name]
  dest_dir = File.join(apps_dir, name)

  if Dir.exists?(dest_dir)
    warn "#{name} is already installed at #{dest_dir}"
    print "  Reinstall? [y/N] "
    ans = gets
    unless ans && ans.strip.downcase == "y"
      info "Aborted."
      exit 0
    end
    FileUtils.rm_rf(dest_dir)
  end

  # Download to tmp
  tmp_file = File.join(tmp_dir, "#{name}.tar.gz")
  unless download_file(url, tmp_file)
    err "Download failed for #{name}"
    exit 1
  end

  # Extract
  FileUtils.mkdir_p(dest_dir)
  info "Extracting #{name}..."
  result = Process.run(
    "tar", args: ["-xzf", tmp_file, "-C", dest_dir, "--strip-components=0"],
    output: Process::Redirect::Inherit,
    error: Process::Redirect::Inherit
  )

  if result.success?
    # Make any executables in the dir executable
    Dir.glob(File.join(dest_dir, "**", "*")) do |f|
      next unless File.file?(f)
      ext = File.extname(f)
      if ext.empty? || ext == ".sh"
        make_executable(f) rescue nil
      end
    end
    ok "#{name} installed to #{dest_dir}"
  else
    err "Extraction failed"
    FileUtils.rm_rf(dest_dir)
    exit 1
  end

  # Cleanup tmp
  File.delete(tmp_file) rescue nil
  puts ""
  ok "#{name} installed successfully!"
end

def cmd_remove(name : String)
  dest_dir = File.join(apps_dir, name)
  unless Dir.exists?(dest_dir)
    err "Package '#{name}' is not installed (#{dest_dir} not found)"
    exit 1
  end
  print "  Remove #{bold(name)}? [y/N] "
  ans = gets
  unless ans && ans.strip.downcase == "y"
    info "Aborted."
    exit 0
  end
  FileUtils.rm_rf(dest_dir)
  ok "#{name} removed."
end

def cmd_search(query : String)
  puts ""
  info "Fetching package list..."
  list = fetch_app_list
  if list.nil?
    err "Could not fetch package list."
    exit 1
  end

  matches = list.select { |k, _| k.downcase.includes?(query.downcase) }
  if matches.empty?
    warn "No packages matching '#{query}'"
  else
    puts "  Packages matching #{cyan(query)}:"
    matches.each do |name, url|
      installed = Dir.exists?(File.join(apps_dir, name))
      status = installed ? green("[installed]") : dim("[available]")
      puts "    #{green("•")} #{bold(name)} #{status}"
      puts "      #{dim(url)}"
    end
  end
  puts ""
end

# ── Help ──────────────────────────────────────────────────────────────────

def print_help
  puts ""
  puts "  #{bold("blue")} — Blue Environment launcher v#{VERSION}"
  puts "  #{dim("─────────────────────────────────────────────────────")}"
  puts ""
  puts "  #{bold("Commands:")}"
  puts "    #{cyan("blue start")}                 Start Blue Environment"
  puts "    #{cyan("blue start --bigpicture")}    Big Picture (TV) mode (placeholder)"
  puts "    #{cyan("blue dev")}                   Launch shell inside existing compositor"
  puts "    #{cyan("blue update")}                Check and download updates from GitHub"
  puts "    #{cyan("blue install")} #{dim("<name>")}        Install an addon application"
  puts "    #{cyan("blue remove")}  #{dim("<name>")}        Remove an installed application"
  puts "    #{cyan("blue search")}  #{dim("<query>")}       Search available packages"
  puts "    #{cyan("blue info")}                  Show version and installed apps"
  puts "    #{cyan("blue help")}                  Show this help"
  puts ""
  puts "  #{bold("Examples:")}"
  puts "    blue install blue-virt"
  puts "    blue remove  blue-music"
  puts "    blue search  blue"
  puts ""
end

# ── Entry point ───────────────────────────────────────────────────────────

args = ARGV.to_a
cmd  = args.shift? || "help"

case cmd
when "start"
  bigpicture = args.includes?("--bigpicture")
  cmd_start(bigpicture)
when "dev"
  cmd_dev
when "update"
  cmd_update
when "install"
  name = args.shift?
  if name.nil? || name.empty?
    err "Usage: blue install <package-name>"
    exit 1
  end
  cmd_install(name)
when "remove"
  name = args.shift?
  if name.nil? || name.empty?
    err "Usage: blue remove <package-name>"
    exit 1
  end
  cmd_remove(name)
when "search"
  query = args.shift? || ""
  if query.empty?
    err "Usage: blue search <query>"
    exit 1
  end
  cmd_search(query)
when "info"
  cmd_info
when "help", "--help", "-h"
  print_help
else
  err "Unknown command: #{cmd}"
  print_help
  exit 1
end
