<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Per-financial-year counter backing InvoiceReferenceGenerator. Business
        // Central does not de-duplicate submissions (verified against the
        // sandbox: the same Reference_No posted twice created two entries), so
        // the portal-side reference must be collision-free at the source.
        Schema::create('invoice_sequences', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('financial_year', 7);
            $table->unsignedBigInteger('last_number')->default(0);
            $table->timestamps();

            $table->unique('financial_year');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoice_sequences');
    }
};
