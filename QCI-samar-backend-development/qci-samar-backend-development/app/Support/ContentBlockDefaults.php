<?php

namespace App\Support;

/**
 * Default text of every admin-editable content block.
 *
 * These are the texts that were hardcoded in the web app and the assessment
 * report before they moved to Settings → Content & Disclaimers. They seed the
 * content_blocks table and are what "Reset to default" restores.
 */
class ContentBlockDefaults
{
    /**
     * @return array<int, array{key: string, group: string, title: string, description: string, format: string, body: string}>
     */
    public static function all(): array
    {
        return [
            [
                'key' => 'registration_instructions',
                'group' => 'registration',
                'title' => 'Registration Instructions',
                'description' => 'Shown in the "Instructions" dialog on the login page before a user registers.',
                'format' => 'html',
                'body' => '<p>By creating an account on the SAMAR portal, you acknowledge and agree to the following:</p>'
                    .'<ol>'
                    .'<li>The information provided during registration must be accurate, complete, and up to date.</li>'
                    .'<li>You are responsible for maintaining the confidentiality of your login credentials and for all activities performed under your account.</li>'
                    .'<li>The SAMAR portal and its administrators are not liable for any loss, misuse, or unauthorised access to your account.</li>'
                    .'<li>All submitted applications, documents, and data will be used solely for the purpose of processing assessments, certifications, and related activities within the SAMAR system.</li>'
                    .'<li>By using this portal, you consent to the collection, storage, and processing of your data in accordance with applicable laws and the portal’s privacy policies.</li>'
                    .'</ol>',
            ],
            [
                'key' => 'payment_undertaking',
                'group' => 'payment',
                'title' => 'Payment Undertaking',
                'description' => 'The undertaking the applicant accepts in the "Undertaking" dialog before paying.',
                'format' => 'html',
                'body' => '<p><strong>I/We (the applicant enterprise) undertake that:</strong></p>'
                    .'<ol>'
                    .'<li>By agreeing to proceed and make relevant payment, I/We undertake that I/we have read and understood the requirements of the Certification for which the payment is being made and I/We take full responsibility for this payment.</li>'
                    .'<li>I/we undertake that our enterprise/unit fulfills all the relevant statutory and regulatory requirements and non-fulfillment of these requirements may lead to the withdrawal of certification.</li>'
                    .'<li>I/we understand that in case our enterprise/unit gets blacklisted by any government authority, it may also lead to the withdrawal of certification.</li>'
                    .'<li>I/we understand that the amount once remitted is non-refundable, non-adjustable &amp; non-transferable irrespective of the outcome of the Certification process.</li>'
                    .'<li>I/we understand that mere submission of relevant payment does not guarantee Certification. The Certification will only be accorded after completion of due process.</li>'
                    .'</ol>',
            ],
            [
                'key' => 'payment_undertaking_agreement',
                'group' => 'payment',
                'title' => 'Payment Undertaking – Agreement Checkbox',
                'description' => 'Label of the checkbox the applicant ticks to accept the undertaking.',
                'format' => 'text',
                'body' => 'I have read and agree to the above disclaimer and terms.',
            ],
            [
                'key' => 'application_declaration_accuracy',
                'group' => 'application',
                'title' => 'Application Declaration – Accuracy',
                'description' => 'First final declaration in the "Documents & Declarations" step of the application form.',
                'format' => 'html',
                'body' => '<p>I declare that all information provided in this application is true and accurate to the best of my knowledge. I understand that if any information is found to be false or misleading:</p>'
                    .'<ul>'
                    .'<li>My application may be rejected</li>'
                    .'<li>Any rating or certification granted may be cancelled</li>'
                    .'<li>Appropriate action may be taken by DRDO or QCI</li>'
                    .'</ul>',
            ],
            [
                'key' => 'application_declaration_discretion',
                'group' => 'application',
                'title' => 'Application Declaration – Discretion',
                'description' => 'Second final declaration in the "Documents & Declarations" step of the application form.',
                'format' => 'text',
                'body' => 'I understand that the acceptance of my application is at the sole discretion of DRDO and QCI.',
            ],
            [
                'key' => 'website_policy',
                'group' => 'policies',
                'title' => 'Terms & Conditions and Website Policy',
                'description' => 'The public Terms & Conditions / Privacy Policy page linked from login, registration and the mobile store listings.',
                'format' => 'html',
                'body' => self::websitePolicy(),
            ],
            [
                'key' => 'assessment_report_disclaimer',
                'group' => 'policies',
                'title' => 'Assessment Report Disclaimer',
                'description' => 'The DISCLAIMER page of the generated assessment report PDF.',
                'format' => 'html',
                'body' => '<p>This disclaimer governs the use of this report. By using this report, the organisation accepts this disclaimer in full.</p>'
                    .'<ol>'
                    .'<li><p>This is an electronically generated report/transcript and is authenticated by the Quality Council of India (QCI). It does not require any signature.</p></li>'
                    .'<li><p>The rating and certification provided, pertains only to the processes and systems of the unit for which assessment is conducted.</p></li>'
                    .'<li><p>The applicant enterprise has understood fully that it needs to ensure compliance to all legal, statutory and regulatory requirements. Any deviation or non-fulfilment of compliances may result in withdrawal of the rating and certification.</p></li>'
                    .'<li><p>The rating &amp; certification provided is valid only for a period of 2 years from the date of issue as mentioned on the Certificate.</p></li>'
                    .'<li><p>This report contains a summary of critically evaluated assessment findings as observed during the assessment and represents the final rating and certification, validated by the Rating Committee, based on the relevant SAMAR Maturity Assessment model.</p></li>'
                    .'<li><p>This report is meant for the use and benefit of the applicant enterprise and DRDO/QCI shall not accept any liability that may arise if this report is used for any alternative purpose.</p></li>'
                    .'<li><p>Information not disclosed by the applicant enterprise may alter the findings outlined in this report. In such situations, QCI reserves the right to withdraw or amend its rating and conclusions.</p></li>'
                    .'</ol>',
            ],
            [
                'key' => 'assessment_schedule_note',
                'group' => 'assessment',
                'title' => 'Assessment Scheduling Note',
                'description' => 'The "Note" shown when an applicant picks a preferred assessment date.',
                'format' => 'text',
                'body' => 'Once you select your preferred assessment date, QCI reserves the right to propose an alternative date or reschedule the assessment if necessary. You will receive timely notification if any changes are made to your selected date.',
            ],
            [
                'key' => 'password_reset_notice',
                'group' => 'account',
                'title' => 'Password Reset Notice',
                'description' => 'Shown after a user requests a password reset.',
                'format' => 'text',
                'body' => 'If this is a registered account, reset instructions will be sent to your email address. Please check your junk folder if you do not see it in your inbox. If you still do not receive it, try resending the reset instructions. If you do not know your registered email, please contact our Support Team.',
            ],
            [
                'key' => 'maintenance_message',
                'group' => 'system',
                'title' => 'Maintenance Message',
                'description' => 'Shown to users while the portal is in maintenance mode.',
                'format' => 'text',
                'body' => 'We are currently performing scheduled maintenance to improve our services. The system will be back online shortly.',
            ],
        ];
    }

    /**
     * @return array{key: string, group: string, title: string, description: string, format: string, body: string}|null
     */
    public static function find(string $key): ?array
    {
        foreach (self::all() as $block) {
            if ($block['key'] === $key) {
                return $block;
            }
        }

        return null;
    }

    private static function websitePolicy(): string
    {
        $p = fn (string $text) => '<p>'.$text.'</p>';

        return '<h2>Disclaimer</h2>'
            .$p('The terms &amp; conditions and website policies of SAMAR are same as that of DRDO. May also refer to DRDO website for terms &amp; conditions and policies. For the benefit and convenience of the viewer, the terms and policies available on the DRDO website are replicated below.')
            .'<h2>Terms &amp; Conditions</h2>'
            .$p('This website is designed, developed and maintained by Defence R&amp;D Organisation (DRDO), Ministry of Defence, Government of India. DESIDOC, a constituent of DRDO, is the nodal agency for this activity.')
            .$p('These terms and conditions shall be governed by and construed in accordance with the Indian Laws. Any dispute arising under these terms and conditions shall be subject to the jurisdiction of the courts of India, New Delhi.')
            .$p('The information posted on this website could include hypertext links or pointers to information created and maintained by non-Government/private organisations. DRDO is providing these links and pointers solely for your information and convenience. When you select a link to an outside website, you are leaving the \'Guidelines for Indian Government Websites\' site and are subject to the privacy and security policies of the owners/sponsors of the outside website.')
            .'<h2>Privacy Policy</h2>'
            .$p('This website does not automatically capture any specific personal information from you, (like name, phone number or e-mail address), that allows us to identify you individually.')
            .$p('Wherever the Website requests you to provide personal information, you will be informed for the particular purposes for which the information is gathered and adequate security measures will be taken to protect your personal information.')
            .$p('We do not sell or share any personally identifiable information volunteered on the website site to any third party (public/private). Any information provided to this Website will be protected from loss, misuse, unauthorized access or disclosure, alteration, or destruction.')
            .$p('We gather certain information about the User, such as Internet protocol (IP) addresses, domain name, browser type, operating system, the date and time of the visit and the pages visited. We make no attempt to link these addresses with the identity of individuals visiting our site unless an attempt to damage the site has been detected.')
            .'<h2>Copyright Policy</h2>'
            .$p('Material featured on this Portal may be reproduced free of charge after taking proper permission by sending a mail to us. However, the material has to be reproduced accurately and not to be used in a derogatory manner or in a misleading context.')
            .$p('Wherever the material is being published or issued to others, the source must be prominently acknowledged. However, the permission to reproduce this material shall not extend to any material which is identified as being copyright of a third party. Authorisation to reproduce such material must be obtained from the departments/copyright holders concerned.')
            .'<h2>Hyperlinking Policy</h2>'
            .'<h3>Links to external websites / portals:</h3>'
            .$p('At many places in this website, you shall find links to other websites/portals. The links have been placed for your convenience. DRDO is not responsible for the contents and reliability of the linked websites and does not necessarily endorse the views expressed in them.')
            .$p('Mere presence of the link or its listing on this Portal should not be assumed as endorsement of any kind. We cannot guarantee that these links will work all the time and we have no control over availability of linked pages.')
            .'<h3>Links to SAMAR website by other websites:</h3>'
            .$p('We do not object to you linking directly to the information that is hosted on this site and no prior permission is required for the same. However, we would like you to inform us about any links provided to this Portal so that you can be informed of any changes or updations therein.')
            .$p('Also, we do not permit our pages to be loaded into frames on your site. The pages belonging to this site must load into a newly opened browser window of the User.')
            .'<h2>Website Monitoring Policy</h2>'
            .$p('DRDO has a Website Monitoring Policy in place and the website is monitored periodically to address and fix the quality and compatibility issues around the following parameters:')
            .'<h3>Performance:</h3>'
            .$p('Site download time is optimized for a variety of network connections as well as devices. All- important pages of the website are tested for this.')
            .'<h3>Functionality:</h3>'
            .$p('All modules of the website are tested for their functionality. The interactive components of the site such as, feedback forms are working smoothly.')
            .'<h3>Broken Links:</h3>'
            .$p('The website is thoroughly reviewed to rule out the presence of any broken links or errors.')
            .'<h3>Traffic Analysis:</h3>'
            .$p('The site traffic is regularly monitored to analyse the usage patterns.')
            .'<h2>Feedback</h2>'
            .$p('Feedback from the visitors is the best way to judge a website\'s performance and make necessary improvements. For any suggestions / queries, please mail to <a href="mailto:samar@qcin.org">samar@qcin.org</a>');
    }
}
