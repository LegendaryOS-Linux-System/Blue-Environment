#!/usr/bin/env ruby
# frozen_string_literal: true
#
# Blue Environment Launcher — main entry point.
#
# When installed to the system this file lives at:
#   /usr/share/Blue-Environment/lib/blue/main.rb
# and is invoked by the wrapper script `blue` (in /usr/local/bin/):
#   /usr/share/Blue-Environment/lib/blue/blue  (wrapper)
#
# During development it lives at launcher/main.rb and can be run directly:
#   ruby launcher/main.rb [command] [args...]
#
# Module layout:
#   src/config.rb   — version constant, paths, GitHub URLs
#   src/ui.rb       — ANSI colour helpers (ok/err/info/warn/die)
#   src/network.rb  — HTTP fetch, fetch_app_list, remote_version
#   src/commands.rb — cmd_* implementations + print_help

HERE = __dir__
$LOAD_PATH.unshift(File.join(HERE, 'src'))

require_relative 'src/config'
require_relative 'src/ui'
require_relative 'src/network'
require_relative 'src/commands'

# ── Argument dispatch ──────────────────────────────────────────────────────

action = ARGV[0]
args   = ARGV[1..]

case action
when nil, '', 'help', '-h', '--help'
  print_help

when 'start'
  bigpicture = args.include?('bigpicture') || args.include?('--bigpicture')
  cmd_start(bigpicture)

when 'dev'
  cmd_dev

when 'info'
  cmd_info

when 'update'
  cmd_update

when 'install'
  die "Usage: blue install <app-name>" if args.empty?
  cmd_install(args[0])

when 'remove'
  die "Usage: blue remove <app-name>" if args.empty?
  cmd_remove(args[0])

when 'search'
  die "Usage: blue search <query>" if args.empty?
  cmd_search(args[0])

when 'wallpaper'
  sub = args[0]
  arg = args[1] || ''
  die "Usage: blue wallpaper set <path>|list|reset" unless sub
  cmd_wallpaper(sub, arg)

when 'compositor'
  sub = args[0] || 'start'
  cmd_compositor(sub)

else
  err "Unknown command: #{action}"
  puts yellow("Run: blue help")
  exit 1
end
