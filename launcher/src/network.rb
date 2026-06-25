# frozen_string_literal: true
# Blue Launcher — network helpers

require 'net/http'
require 'uri'
require 'json'
require 'fileutils'
require 'open-uri'

def http_get(url, redirect_limit = 5)
  raise 'Too many redirects' if redirect_limit == 0
  uri = URI.parse(url)
  response = Net::HTTP.get_response(uri)
  case response
  when Net::HTTPSuccess
    response.body
  when Net::HTTPRedirection
    http_get(response['location'], redirect_limit - 1)
  else
    nil
  end
rescue => e
  warn "Network error fetching #{url}: #{e.message}"
  nil
end

def download_file(url, dest)
  FileUtils.mkdir_p(File.dirname(dest))
  info "Downloading #{File.basename(dest)}..."
  uri = URI.parse(url)
  Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https') do |http|
    request = Net::HTTP::Get.new(uri.request_uri)
    http.request(request) do |response|
      File.open(dest, 'wb') { |f| response.read_body { |chunk| f.write(chunk) } }
    end
  end
  true
rescue => e
  err "Download failed: #{e.message}"
  false
end

# Pobiera listę aplikacji z config/list.json na GitHubie LegendaryOS.
# Format JSON:
#   { "environment": "...", "apps": { "app-id": "https://...tar.gz" } }
def fetch_app_list
  body = http_get(APPS_LIST_URL)
  return {} unless body

  begin
    data = JSON.parse(body)
  rescue JSON::ParserError => e
    warn "Malformed apps list.json: #{e.message}"
    return {}
  end

  apps = data['apps']
  apps.is_a?(Hash) ? apps : {}
end

# Pobiera bieżącą wersję z config/version.json na GitHubie LegendaryOS.
# Format JSON: [0.6]
def remote_version
  body = http_get(VERSION_JSON_URL)
  return nil unless body

  begin
    arr = JSON.parse(body)
    arr.is_a?(Array) ? arr.first&.to_s : arr.to_s
  rescue JSON::ParserError
    nil
  end
end

def local_version
  File.exist?(VERSION_FILE) ? File.read(VERSION_FILE).strip : VERSION
end

def newer?(remote, local)
  return false if remote.nil?
  remote_parts = remote.to_s.split('.').map(&:to_i)
  local_parts  = local.to_s.split('.').map(&:to_i)
  max_len = [remote_parts.length, local_parts.length].max
  max_len.times do |i|
    r = remote_parts[i] || 0
    l = local_parts[i]  || 0
    return true  if r > l
    return false if r < l
  end
  false
end
