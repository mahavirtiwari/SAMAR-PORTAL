<?php

namespace App\Policies;

use App\Models\Document;
use App\Models\Role;
use App\Models\User;

class DocumentPolicy
{
    /**
     * Determine if the user can view any documents.
     */
    public function viewAny(User $user): bool
    {
        // All authenticated users can view documents (filtered by their access)
        return true;
    }

    /**
     * Determine if the user can view the document.
     */
    public function view(User $user, Document $document): bool
    {
        // Admins can view all documents
        if ($user->hasAnyRole([
            Role::SYSTEM_ADMIN,
            Role::OPERATIONS_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::DRDO_ADMIN,
        ])) {
            return true;
        }

        // Document uploader can view their own documents
        if ($document->uploaded_by === $user->id) {
            return true;
        }

        // The table is the User Guides library, listed to every role; only admins upload.
        return $document->is_active;
    }

    /**
     * Determine if the user can create documents.
     */
    public function create(User $user): bool
    {
        // Only admin roles may add documents (the User Guides library). Leaving
        // this open let any authenticated user inject rows into the shared list.
        return $user->hasAnyRole([
            Role::SYSTEM_ADMIN,
            Role::OPERATIONS_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::DRDO_ADMIN,
        ]);
    }

    /**
     * Determine if the user can update the document.
     */
    public function update(User $user, Document $document): bool
    {
        // Admins can update any document
        if ($user->hasAnyRole([
            Role::SYSTEM_ADMIN,
            Role::OPERATIONS_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::DRDO_ADMIN,
        ])) {
            return true;
        }

        // Document uploader can update their own documents
        if ($document->uploaded_by === $user->id) {
            return true;
        }

        return false;
    }

    /**
     * Determine if the user can delete the document.
     */
    public function delete(User $user, Document $document): bool
    {
        // Admins can delete any document
        if ($user->hasAnyRole([
            Role::SYSTEM_ADMIN,
            Role::OPERATIONS_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::DRDO_ADMIN,
        ])) {
            return true;
        }

        // Document uploader can delete their own documents
        if ($document->uploaded_by === $user->id) {
            return true;
        }

        return false;
    }

    /**
     * Determine if the user can download the document.
     */
    public function download(User $user, Document $document): bool
    {
        // Same permissions as viewing
        return $this->view($user, $document);
    }

    /**
     * Determine if the user can change the document active/inactive status.
     */
    public function changeStatus(User $user, Document $document): bool
    {
        // Admins can change status for any document
        if ($user->hasAnyRole([
            Role::SYSTEM_ADMIN,
            Role::OPERATIONS_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::DRDO_ADMIN,
        ])) {
            return true;
        }

        // Document uploader can change their own document status
        if ($document->uploaded_by === $user->id) {
            return true;
        }

        return false;
    }
}
