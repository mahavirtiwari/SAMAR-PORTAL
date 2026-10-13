<?php

namespace App\Traits;

use Illuminate\Support\Facades\Auth;

trait TracksUserActions
{
    /**
     * Boot the trait to track created_by, updated_by, deleted_by.
     */
    protected static function bootTracksUserActions(): void
    {
        // Set created_by on creation
        static::creating(function ($model) {
            if (Auth::check() && ! $model->created_by) {
                $model->created_by = Auth::id();
            }
        });

        // Set updated_by on update
        static::updating(function ($model) {
            if (Auth::check()) {
                $model->updated_by = Auth::id();
            }
        });

        // Set deleted_by on soft delete
        if (method_exists(static::class, 'bootSoftDeletes')) {
            static::deleting(function ($model) {
                if (Auth::check() && method_exists($model, 'isForceDeleting') && ! $model->isForceDeleting()) {
                    $model->deleted_by = Auth::id();
                    $model->save();
                }
            });
        }
    }
}
