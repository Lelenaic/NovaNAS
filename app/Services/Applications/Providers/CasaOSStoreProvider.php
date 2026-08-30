<?php

namespace App\Services\Applications\Providers;

use App\Contracts\StoreProviderInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Yaml\Yaml;

/**
 * CasaOS/ZimaOS App Store Provider
 *
 * Fetches application data from a CasaOS v2 protocol app store.
 * The store serves static JSON files (index.json, meta.json) and
 * docker-compose.yml files over HTTPS.
 */
class CasaOSStoreProvider implements StoreProviderInterface
{
    private ?array $storeConfig = null;

    private ?array $index = null;

    public function __construct(
        private readonly string $baseUrl,
    ) {}

    public function getProviderId(): string
    {
        return 'casaos';
    }

    public function getName(): string
    {
        return $this->getStoreConfig()['name']['en_US'] ?? 'CasaOS Store';
    }

    public function getDescription(): ?string
    {
        return $this->getStoreConfig()['description']['en_US'] ?? null;
    }

    public function getMaintainer(): ?string
    {
        return $this->getStoreConfig()['maintainer'];
    }

    public function getUrl(): ?string
    {
        return $this->getStoreConfig()['url'] ?? null;
    }

    /**
     * @return array<int, array{id: string, name: string, icon: string|null, description: string|null}>
     */
    public function getCategories(): array
    {
        $index = $this->getIndex();
        $seen = [];
        $categories = [];

        foreach ($index as $entry) {
            $cat = $entry['category'];

            if (! isset($seen[$cat])) {
                $seen[$cat] = true;
                $categories[] = [
                    'id' => $cat,
                    'name' => $cat,
                    'icon' => null,
                    'description' => null,
                ];
            }
        }

        return $categories;
    }

    /**
     * @return array<int, array{id: string, title: string, tagline: string|null, category: string, version: string|null, author: string|null, developer: string|null, icon: string|null, thumbnail: string|null, architectures: list<string>}>
     */
    public function getApps(?string $category = null, ?string $search = null): array
    {
        $index = $this->getIndex();
        $apps = [];

        foreach ($index as $entry) {
            if ($category !== null && ($entry['category']) !== $category) {
                continue;
            }

            $title = $entry['title'];
            $tagline = $entry['tagline'] ?? null;

            if ($search !== null) {
                $searchLower = strtolower($search);
                if (str_contains(strtolower($title), $searchLower) === false
                    && str_contains(strtolower($tagline ?? ''), $searchLower) === false) {
                    continue;
                }
            }

            $apps[] = [
                'id' => $entry['id'],
                'title' => $title,
                'tagline' => $tagline,
                'category' => $entry['category'],
                'version' => $entry['version'] ?? '',
                'author' => $entry['author'] ?? null,
                'developer' => $entry['developer'] ?? null,
                'icon' => $this->resolveAssetUrl($entry['icon'] ?? null),
                'thumbnail' => $this->resolveAssetUrl($entry['thumbnail'] ?? null),
                'architectures' => $entry['architectures'],
            ];
        }

        return $apps;
    }

    /**
     * @return array{id: string, title: string, tagline: string|null, description: string|null, category: string, version: string|null, author: string|null, developer: string|null, icon: string|null, thumbnail: string|null, screenshot_link: list<string>, architectures: list<string>, website: string|null, repo: string|null, support: string|null, docs: string|null, release_notes: string|null}|null
     */
    public function getAppDetails(string $appId): ?array
    {
        $meta = $this->fetchJson("apps/{$appId}/meta.json");

        if (! is_array($meta)) {
            return null;
        }

        // Icon and thumbnail are in the index, not in meta.json
        $indexEntry = null;
        foreach ($this->getIndex() as $entry) {
            if (($entry['id']) === $appId) {
                $indexEntry = $entry;
                break;
            }
        }

        $screenshots = [];
        if (isset($meta['screenshot_link']) && is_array($meta['screenshot_link'])) {
            $screenshots = array_map(
                fn (string $url) => $this->resolveAssetUrl($url),
                $meta['screenshot_link']
            );
        }

        return [
            'id' => $appId,
            'title' => $meta['title']['en_US'] ?? $meta['title'] ?? '',
            'tagline' => $meta['tagline']['en_US'] ?? $meta['tagline'] ?? null,
            'description' => $meta['description']['en_US'] ?? $meta['description'] ?? null,
            'category' => $meta['category'] ?? '',
            'version' => $meta['version'] ?? '',
            'author' => $meta['author'] ?? null,
            'developer' => $meta['developer'] ?? null,
            'icon' => $this->resolveAssetUrl($indexEntry['icon'] ?? $meta['icon'] ?? null),
            'thumbnail' => $this->resolveAssetUrl($indexEntry['thumbnail'] ?? $meta['thumbnail'] ?? null),
            'screenshot_link' => $screenshots,
            'architectures' => $meta['architectures'] ?? [],
            'website' => $meta['website'] ?? null,
            'repo' => $meta['repo'] ?? null,
            'support' => $meta['support'] ?? null,
            'docs' => $meta['docs'] ?? null,
            'release_notes' => $meta['release_notes']['en_US'] ?? $meta['release_note']['en_US'] ?? null,
        ];
    }

    public function getAppCompose(string $appId): ?string
    {
        $url = rtrim($this->baseUrl, '/').'/apps/'.$appId.'/docker-compose.yml';

        try {
            $response = Http::timeout(15)->get($url);

            if ($response->successful()) {
                return $response->body();
            }
        } catch (\Exception $e) {
            Log::warning("Failed to fetch compose for app {$appId}: {$e->getMessage()}");
        }

        return null;
    }

    /**
     * Parse the top-level x-casaos metadata from a docker-compose.yml content.
     *
     * @return array{port_map: string|null, index: string|null}|null
     */
    public function parseComposeMetadata(string $composeContent): ?array
    {
        try {
            $parsed = Yaml::parse($composeContent);

            if (! is_array($parsed) || ! isset($parsed['x-casaos'])) {
                return null;
            }

            $x = $parsed['x-casaos'];

            return [
                'port_map' => isset($x['port_map']) ? (string) $x['port_map'] : null,
                'index' => $x['index'] ?? null,
            ];
        } catch (\Exception $e) {
            Log::warning("Failed to parse x-casaos from compose: {$e->getMessage()}");

            return null;
        }
    }

    public function isHealthy(): bool
    {
        try {
            $response = Http::timeout(10)->get(rtrim($this->baseUrl, '/').'/store.json');

            return $response->successful();
        } catch (\Exception $e) {
            Log::warning("Store health check failed: {$e->getMessage()}");

            return false;
        }
    }

    /**
     * Get the store index (cached for the request lifecycle).
     *
     * @return list<array{id: string, title: string, tagline: string|null, category: string, version: string|null, author: string|null, developer: string|null, icon: string|null, thumbnail: string|null, architectures: list<string>}>
     */
    private function getIndex(): array
    {
        if ($this->index !== null) {
            return $this->index;
        }

        $data = $this->fetchJson('index.json');

        $this->index = $data['apps'] ?? [];

        return $this->index;
    }

    /**
     * Get the store configuration (cached for the request lifecycle).
     *
     * @return array{version: int, store_id: string, name: array<string, string>, description: array<string, string>|null, maintainer: string, url: string|null}
     */
    private function getStoreConfig(): array
    {
        if ($this->storeConfig !== null) {
            return $this->storeConfig;
        }

        $this->storeConfig = $this->fetchJson('store.json') ?? [];

        return $this->storeConfig;
    }

    /**
     * Fetch and decode a JSON file from the store.
     */
    private function fetchJson(string $path): ?array
    {
        $url = rtrim($this->baseUrl, '/').'/'.$path;

        try {
            $response = Http::timeout(15)->get($url);

            if ($response->successful()) {
                $data = json_decode($response->body(), true);

                return is_array($data) ? $data : null;
            }
        } catch (\Exception $e) {
            Log::warning("Failed to fetch {$path} from store: {$e->getMessage()}");
        }

        return null;
    }

    /**
     * Resolve an asset URL relative to the store base URL.
     */
    private function resolveAssetUrl(?string $url): ?string
    {
        if ($url === null || $url === '') {
            return null;
        }

        if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
            return $url;
        }

        return rtrim($this->baseUrl, '/').'/'.ltrim($url, '/');
    }
}
