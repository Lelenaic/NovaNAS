<?php

namespace App\Http\Controllers;

use App\Services\Support\SupportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controller for managing support tickets via the NovaNAS cloud API.
 */
class SupportController extends Controller
{
    public function __construct(
        protected SupportService $supportService
    ) {}

    /**
     * Get auto-collected system information for the support form preview.
     */
    public function systemInfo(Request $request): JsonResponse
    {
        $info = $this->supportService->collectSystemInfo($request->user()?->email);

        return response()->json($info);
    }

    /**
     * Create a new support ticket.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email|max:255',
            'nas_uuid' => 'required|string|max:255',
            'subject' => 'required|string|max:255',
            'body' => 'required|string',
            'debian_version' => 'nullable|string|max:100',
            'novanas_version' => 'nullable|string|max:100',
            'storage_info' => 'nullable|array',
            'storage_info.*' => 'string',
            'installed_software' => 'nullable|array',
            'installed_software.*' => 'string',
            'apt_updates_count' => 'nullable|integer|min:0',
            'attachments' => 'nullable|array|max:10',
            'attachments.*' => 'file|max:10240|mimes:jpg,jpeg,png,log,txt',
        ]);

        $result = $this->supportService->createTicket($validated);

        if ($result['success']) {
            return response()->json([
                'message' => 'Support ticket created successfully.',
                'data' => $result['data'],
            ], 201);
        }

        $status = $result['status'] ?? 500;

        return response()->json([
            'message' => $result['error'],
        ], $status);
    }

    /**
     * Get messages for a support ticket.
     */
    public function messages(int $ticketId, Request $request): JsonResponse
    {
        $securityKey = $request->header('X-Support-Key');

        if (! $securityKey) {
            return response()->json(['error' => 'X-Support-Key header is required.'], 422);
        }

        $result = $this->supportService->getMessages($ticketId, $securityKey);

        if ($result['success']) {
            return response()->json([
                'message' => 'Messages retrieved successfully.',
                'data' => $result['data'],
            ]);
        }

        return response()->json([
            'error' => $result['error'],
        ], 404);
    }

    /**
     * Send a new message to a support ticket.
     */
    public function sendMessage(int $ticketId, Request $request): JsonResponse
    {
        $securityKey = $request->header('X-Support-Key');

        if (! $securityKey) {
            return response()->json(['error' => 'X-Support-Key header is required.'], 422);
        }

        $validated = $request->validate([
            'body' => 'required|string',
            'attachments' => 'nullable|array|max:10',
            'attachments.*' => 'file|max:10240|mimes:jpg,jpeg,png,log,txt',
        ]);

        $result = $this->supportService->sendMessage($ticketId, $securityKey, $validated);

        if ($result['success']) {
            return response()->json([
                'message' => 'Message sent successfully.',
                'data' => $result['data'],
            ], 201);
        }

        $status = $result['status'] ?? 500;

        return response()->json([
            'message' => $result['error'],
        ], $status);
    }

    /**
     * Edit an existing message in a support ticket.
     */
    public function editMessage(int $ticketId, int $messageId, Request $request): JsonResponse
    {
        $securityKey = $request->header('X-Support-Key');

        if (! $securityKey) {
            return response()->json(['error' => 'X-Support-Key header is required.'], 422);
        }

        $validated = $request->validate([
            'body' => 'required|string',
        ]);

        $result = $this->supportService->editMessage(
            $ticketId,
            $messageId,
            $securityKey,
            $validated['body']
        );

        if ($result['success']) {
            return response()->json([
                'message' => 'Message updated successfully.',
                'data' => $result['data'],
            ]);
        }

        $status = $result['status'] ?? 500;

        return response()->json([
            'message' => $result['error'],
        ], $status);
    }
}
