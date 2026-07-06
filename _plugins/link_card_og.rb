# link_cards front matter의 description을 대상 URL의 Open Graph 메타태그에서
# 자동으로 가져와 채워준다 (Notion의 링크 미리보기 카드와 같은 방식).
#
# - 캐시: _data/link_cards_cache.yml (커밋 대상 — GitHub Actions 빌드 시 네트워크
#   요청 없이 재사용되도록). 이미 캐시된 URL은 재요청하지 않는다.
# - front matter에 desc를 직접 쓰면 그 값을 우선한다(자동 fetch로 덮어쓰지 않음).
# - 네트워크 실패 시 조용히 무시하고 빌드는 계속 진행한다.

require "net/http"
require "uri"
require "yaml"
require "fileutils"

module LinkCardOg
  CACHE_PATH = File.expand_path("../_data/link_cards_cache.yml", __dir__)

  class Generator < Jekyll::Generator
    priority :high

    def generate(site)
      @cache = load_cache
      @dirty = false

      site.collections.each_value do |collection|
        collection.docs.each { |doc| process(doc.data) }
      end
      site.pages.each { |page| process(page.data) }

      save_cache if @dirty
    end

    private

    def process(data)
      return unless data["link_cards"].is_a?(Array)

      data["link_cards"].each do |card|
        url = card["url"]
        next if !url || url.empty?

        og = @cache[url] || fetch_og(url)
        next unless og

        unless @cache.key?(url)
          @cache[url] = og
          @dirty = true
        end

        card["desc"] ||= og["desc"]
        card["og_image"] ||= og["image"]
      end
    end

    def fetch_og(url)
      uri = URI.parse(url)
      res = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 5, read_timeout: 5) do |http|
        http.get(uri.request_uri.empty? ? "/" : uri.request_uri, { "User-Agent" => "Mozilla/5.0 (compatible; skamo3-portfolio-bot)" })
      end
      return nil unless res.is_a?(Net::HTTPSuccess)

      html = res.body
      {
        "desc" => extract_meta(html, "og:description") || extract_meta(html, "description", attr: "name"),
        "image" => extract_meta(html, "og:image"),
      }
    rescue StandardError => e
      Jekyll.logger.warn "link_card_og:", "#{url} 가져오기 실패 (#{e.class}: #{e.message}) — 무시하고 진행"
      nil
    end

    def extract_meta(html, prop, attr: "property")
      pattern = Regexp.escape(prop)
      m = html.match(/<meta[^>]+#{attr}=["']#{pattern}["'][^>]*content=["']([^"']*)["']/i)
      return m[1] if m

      m = html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*#{attr}=["']#{pattern}["']/i)
      m && m[1]
    end

    def load_cache
      File.exist?(CACHE_PATH) ? (YAML.load_file(CACHE_PATH) || {}) : {}
    end

    def save_cache
      FileUtils.mkdir_p(File.dirname(CACHE_PATH))
      File.write(CACHE_PATH, @cache.to_yaml)
    end
  end
end
