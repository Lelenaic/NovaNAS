<?php

namespace App\Contracts;

/**
 * Interface for application store provider implementations.
 *
 * Each store format (CasaOS, TrueNAS, etc.) has its own implementation
 * that translates between the store's native format and this normalized interface.
 */
interface StoreProviderInterface
{
    /**
     * Get the unique identifier for this store provider.
     */
    public function getProviderId(): string;

    /**
     * Get the display name of this store.
     */
    public function getName(): string;

    /**
     * Get the store description.
     */
    public function getDescription(): ?string;

    /**
     * Get the maintainer of this store.
     */
    public function getMaintainer(): ?string;

    /**
     * Get the store homepage URL.
     */
    public function getUrl(): ?string;

    /**
     * Get all available categories from this store.
     *
     * @return array<int, array{id: string, name: string, icon: string|null, description: string|null}>
     */
    public function getCategories(): array;

    /**
     * Get all available applications from this store.
     *
     * @param  string|null  $category  Filter by category ID
     * @param  string|null  $search  Search term to filter by title/tagline
     * @return array<int, array{
     *     id: string,
     *     title: string,
     *     tagline: string|null,
     *     category: string,
     *     version: string,
     *     author: string|null,
     *     developer: string|null,
     *     icon: string|null,
     *     thumbnail: string|null,
     *     architectures: list<string>,
     * }>
     */
    public function getApps(?string $category = null, ?string $search = null): array;

    /**
     * Get detailed information about a specific application.
     *
     * @param  string  $appId  The application ID (normalized, lowercase)
     * @return array{
     *     id: string,
     *     title: string,
     *     tagline: string|null,
     *     description: string|null,
     *     category: string,
     *     version: string,
     *     author: string|null,
     *     developer: string|null,
     *     icon: string|null,
     *     thumbnail: string|null,
     *     screenshot_link: list<string>,
     *     architectures: list<string>,
     *     website: string|null,
     *     repo: string|null,
     *     support: string|null,
     *     docs: string|null,
     *     release_notes: string|null,
     * }|null
     */
    public function getAppDetails(string $appId): ?array;

    /**
     * Get the Docker Compose content for an application.
     *
     * @param  string  $appId  The application ID
     * @return string|null The docker-compose.yml content, or null if not found
     */
    public function getAppCompose(string $appId): ?string;

    /**
     * Parse store-specific metadata from a Docker Compose file content.
     *
     * @param  string  $composeContent  The docker-compose.yml content
     * @return array{port_map: string|null, index: string|null}|null
     */
    public function parseComposeMetadata(string $composeContent): ?array;

    /**
     * Check if the store is reachable and healthy.
     */
    public function isHealthy(): bool;
}
