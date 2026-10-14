<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lets a System Admin override an email's heading and body from Settings.
 * While both are null the template keeps rendering its Blade view.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notification_templates', function (Blueprint $table) {
            $table->string('title', 500)->nullable()->after('subject');
            $table->longText('body')->nullable()->after('title');
            $table->timestamp('customized_at')->nullable()->after('body');
        });
    }

    public function down(): void
    {
        Schema::table('notification_templates', function (Blueprint $table) {
            $table->dropColumn(['title', 'body', 'customized_at']);
        });
    }
};
