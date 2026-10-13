<?php

namespace App\Providers;

use App\Models\Application;
use App\Models\ApplicationFeedback;
use App\Models\Assessment;
use App\Models\AssessorDomain;
use App\Models\Certificate;
use App\Models\Discipline;
use App\Models\Document;
use App\Models\ManufacturingBoughtOutPart;
use App\Models\ManufacturingKeyProcess;
use App\Models\ManufacturingRawMaterial;
use App\Models\ManufacturingStore;
use App\Models\ManufacturingVendorCategory;
use App\Models\Organization;
use App\Models\Unit;
use App\Models\User;
use App\Policies\ApplicationFeedbackPolicy;
use App\Policies\ApplicationPolicy;
use App\Policies\AssessmentPolicy;
use App\Policies\AssessorDomainPolicy;
use App\Policies\CertificatePolicy;
use App\Policies\DisciplinePolicy;
use App\Policies\DocumentPolicy;
use App\Policies\ManufacturingBoughtOutPartPolicy;
use App\Policies\ManufacturingKeyProcessPolicy;
use App\Policies\ManufacturingRawMaterialPolicy;
use App\Policies\ManufacturingStorePolicy;
use App\Policies\ManufacturingVendorCategoryPolicy;
use App\Policies\OrganizationPolicy;
use App\Policies\UnitPolicy;
use App\Policies\UserPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * The policy mappings for the application.
     *
     * @var array<class-string, class-string>
     */
    protected $policies = [
        Organization::class => OrganizationPolicy::class,
        Unit::class => UnitPolicy::class,
        User::class => UserPolicy::class,
        Application::class => ApplicationPolicy::class,
        ApplicationFeedback::class => ApplicationFeedbackPolicy::class,
        Assessment::class => AssessmentPolicy::class,
        Certificate::class => CertificatePolicy::class,
        Document::class => DocumentPolicy::class,
        ManufacturingBoughtOutPart::class => ManufacturingBoughtOutPartPolicy::class,
        ManufacturingKeyProcess::class => ManufacturingKeyProcessPolicy::class,
        ManufacturingStore::class => ManufacturingStorePolicy::class,
        ManufacturingVendorCategory::class => ManufacturingVendorCategoryPolicy::class,
        ManufacturingRawMaterial::class => ManufacturingRawMaterialPolicy::class,
        Discipline::class => DisciplinePolicy::class,
        AssessorDomain::class => AssessorDomainPolicy::class,
    ];

    /**
     * Register any authentication / authorization services.
     */
    public function boot(): void
    {
        //
    }
}
