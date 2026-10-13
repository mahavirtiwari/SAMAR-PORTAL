# -*- coding: utf-8 -*-
"""SAMAR Portal: User Manual (internal, all nine roles).

Part 1 is the general information common to every document in the family; Parts 2
to 9 cover one role each, and each is complete in itself. Screenshot filenames are
shared with the Assessor and Applicant Handbooks.
"""

import os
from samar_common import (Manual, SHOTS_DIR, OUT_DIR,
                          part_general_information, appendix_glossary)

OUT = os.path.join(OUT_DIR, "SAMAR Portal - User Manual.docx")
VERSION = "Version 1 / 23-09-2026"

m = Manual("User Manual", VERSION)

# ================= COVER =================
m.cover("User Manual")

# ================= HOW TO USE THIS MANUAL =================
m.page_break()
m.banner("How to use this manual", toc=0)
m.body("This manual is organised by user role. Part 1 is applicable to all users and should be read first. Thereafter, users "
       "may refer to the Part corresponding to their own role. Each role-specific Part is complete in itself and may therefore "
       "be printed and circulated independently.")
m.simple_table(["Category of user", "Parts to be referred"], [
    ["Organisation applying for certification (principal account)", "Part 1 and Part 2 - Enterprise Admin"],
    ["Officer-in-charge of a unit or site", "Part 1 and Part 3 - Unit Admin"],
    ["Assessor conducting on-site assessments", "Part 1 and Part 4 - Assessor"],
    ["QCI Operations - allocation and quality check", "Part 1 and Part 5 - Operations Manager"],
    ["QCI Operations - rating committee and certification", "Part 1 and Part 6 - Operations Admin"],
    ["DRDO officer approving applications", "Part 1 and Part 7 - DRDO Admin"],
    ["DRDO laboratory referring to the certified vendor register", "Part 1 and Part 8 - DRDO Lab"],
    ["System administrator", "Part 1 and Part 9 - System Admin"],
], sizes=[8.6, 8.6])

m.contents()

# ================= PART 1 =================
part_general_information(
    m,
    roles_intro="The screens and functions available to a user are determined by the role assigned to that user. Eight roles are "
                "provided:",
    support_para="Applicant roles, namely the Enterprise Admin and the Unit Admin, are provided a Support option in the left menu "
                 "through which a request may be raised and its progress monitored. All other roles are to approach the SAMAR "
                 "Operations team. In all correspondence, the SAMAR ID and the application number are to be quoted.",
    unavailability_note="Assessors are provided one additional option, Set Unavailability, which is detailed in Part 4.")

# ================= PART 2: ENTERPRISE ADMIN =================
m.divider("Part 2", "Enterprise Admin", "Principal account of the applicant organisation")
m.role_card("The holder of the principal account of an organisation applying for SAMAR certification. One such account is "
            "maintained for each organisation.",
            ["Register the organisation and add its units or sites",
             "Add applications, from which Unit Admin accounts are created automatically",
             "Create, submit and renew applications in respect of any unit",
             "Remit the assessment fee and view the complete payment history",
             "Download all certificates and assessment reports of the organisation",
             "Submit the post-assessment feedback"],
            ["Approve the organisation's own application",
             "Select or communicate directly with the assessor",
             "View the records of any other organisation"])

m.banner("2.1  Menu structure")
m.menu_table([
    ["Dashboard", "", "Summary counts of units, active applications, drafts and certificates."],
    ["My Applications", "", "Create a new application, resume a draft, monitor progress and view details."],
    ["Payment History", "", "All fee payments and receipts of the organisation."],
    ["Unit Users", "", "View the Unit Admin accounts of the enterprise, with each account’s assigned unit and last login. This "
                       "screen is a read-only list; accounts are not created or edited here."],
    ["Feedback", "", "Submit the post-assessment feedback."],
    ["Certificates & Reports", "", "Download certificates and assessment reports of all units."],
    ["Enterprise Profile", "", "View and amend the particulars of the organisation."],
    ["Support", "", "Raise a support request and monitor its status."],
])
m.placeholder("shot-04.png", "Enterprise Admin dashboard and left menu")

m.banner("2.2  Registration and first login")
m.step("Open the SAMAR portal and select Sign up.")
m.step("Enter the particulars of the enterprise as per the form displayed, followed by the captcha characters, and select "
       "Sign Up.")
m.validation("Validation: The email address and mobile number must be valid, as all one-time passwords and system notices are sent "
             "to them.")
m.step("Enter the OTP received at the registered email address in order to verify it.")
m.step("Set a password and complete the registration. The account so created is the Enterprise Admin account.")
m.placeholder("shot-05.png", "Sign-up form")
m.body("The sign-up form accepts the following, and validates them as shown.")
m.simple_table(["Field", "Requirement"], [
    ["Enterprise Name", "Required. Entered as per the organisation's PAN. Up to 150 characters."],
    ["First Name", "Required. Up to 50 characters."],
    ["Last Name", "Required. Up to 50 characters."],
    ["Email", "Required. Must be a valid email address (up to 320 characters). All OTPs, approvals and notices are sent to this "
              "address."],
    ["Mobile Number", "Required. Exactly 10 digits, numbers only."],
    ["Captcha", "Required. The five characters shown in the image; not case-sensitive."],
    ["OTP", "Required. 6 digits, numbers only. Sent to the registered email address; valid for a limited period and may be resent "
            "after 120 seconds."],
], sizes=[4.0, 13.2], fs=10)

m.banner("2.3  Units and unit users")
m.body("A unit denotes a single factory or site, and each unit is certified separately. Units are not added from a separate "
       "screen: a unit is created automatically when an application is first created for it (paragraph 2.4), from the unit "
       "particulars entered in that application.")
m.body("The Unit Admin account for the unit is also created automatically, from the contact person entered in that first "
       "application, and the login credentials are sent to the contact person’s email address.")
m.step("Open Unit Users to view the Unit Admin accounts of the enterprise, together with each one’s assigned unit. This is a "
       "read-only list; accounts are not created or edited on this screen.")
m.step("In the event of a change of incumbent, the Enterprise Admin may reassign the unit to a different Unit Admin. Fresh login "
       "credentials are then emailed to the new incumbent, while the unit’s SAMAR ID, records and history are retained.")
m.placeholder("shot-06.png", "Unit Users - read-only list of Unit Admin accounts")

m.banner("2.4  Creating an application")
m.body("The certification process comprises the following six stages:")
m.process_flow()
m.step("Open My Applications and initiate a new application for either the manufacturing or the service sector.")
m.step("Enter the particulars of the unit for which certification is sought; the unit, and its Unit Admin account, are created "
       "from these particulars. The application may be saved and resumed later; until submitted it remains in Draft status.")
m.step("Submit the application. If DRDO approval is enabled in System Settings, the status changes to DRDO Approval Pending, "
       "pending DRDO’s decision; if it is disabled, the application proceeds directly to Payment Pending. Whether this approval "
       "step applies is configured by the System Admin.")
m.validation("Validation: An application once submitted cannot be edited.")
m.placeholder("shot-07.png", "My Applications - new application and list of drafts")
m.body("Before you begin: keep the following documents ready before beginning. They are uploaded within the application, and the "
       "ones required depend on the enterprise's classification and its registrations.")
m.simple_table(["Document", "When it is required"], [
    ["Site exterior photograph", "Always. JPG, JPEG or PNG only."],
    ["GST certificate", "If the enterprise is GST-registered."],
    ["Government registration certificate", "If the enterprise is government-registered."],
    ["DRDO certificate", "If the enterprise is an existing DRDO vendor."],
    ["DPIIT certificate", "If the enterprise is classified as a Startup."],
    ["Udyam certificate", "If the enterprise is classified as Micro, Small or Medium (MSME)."],
    ["Certificate of Incorporation", "If the enterprise is classified as Large."],
], sizes=[6.4, 10.8], fs=10)
m.body("Exactly one of the DPIIT, Udyam or Incorporation certificates applies, according to the enterprise classification that is "
       "selected.")
m.body("The application is completed in five guided steps: Enterprise details, Operations, Products (or Services), Declarations "
       "and Review. It may be saved and resumed at any step, and remains in Draft status until submitted.")
m.body("The principal fields and their formats are set out below.")
m.simple_table(["Field", "Requirement"], [
    ["Email addresses", "Valid email address, up to 320 characters. An alternate email, if provided, must differ from the primary "
                        "email."],
    ["Mobile number", "Up to 10 digits."],
    ["Landline (optional)", "Up to 12 digits; where a unit landline is given it must be exactly 12 digits."],
    ["PIN code", "Exactly 6 digits."],
    ["GST number", "Required if the enterprise is GST-registered. Format like 22AAAAA0000A1Z5."],
    ["Udyam registration number", "Required for Micro, Small or Medium enterprises. Format like UDYAM-XX-00-0000000."],
    ["DPIIT registration number", "Required for Startups. Up to 20 characters. Format like DPIIT2022AB1234."],
    ["CIN", "Required for Large enterprises. Up to 21 characters. Format like L01631KA2010PTC096843."],
    ["DRDO registration number", "Required if the enterprise is an existing DRDO vendor."],
    ["Employee counts", "Numbers only, up to 5 digits each. The total number of employees must be greater than zero."],
    ["Capacity figures", "Numbers only, up to 12 digits. Utilised capacity cannot exceed the total capacity."],
    ["Uploaded files", "PDF, JPG, JPEG or PNG, up to 5 MB each. The site exterior photograph accepts JPG, JPEG or PNG only."],
], sizes=[5.0, 12.2], fs=10)
m.body("The following are applied automatically by the system.")
m.bullets(["An application, once submitted, cannot be edited. The particulars are to be verified beforehand.",
           "Product names, service names, customer names and process names must each be unique within the application.",
           "Export or international-supply percentages across all products or services cannot together exceed 100 per cent.",
           "Import percentages across all raw materials, bought-out parts or service resources cannot together exceed 100 per "
           "cent.",
           "For a manufacturing unit, at least one key raw material or one bought-out part is to be added.",
           "Both declarations on the final step are to be agreed before the application can be submitted."])

m.banner("2.5  Remitting the fee")
m.body("Upon approval of the application by DRDO, the fee is to be remitted online through ICICI EazyPay. The fee is determined by "
       "the sector and the size of the enterprise. Goods and Services Tax at 18 per cent is applicable in addition.")
m.simple_table(["Size of enterprise", "Total fee (inclusive of 18% GST)"],
               [["Startup", "₹37,760"], ["Micro", "₹43,660"], ["Small", "₹49,560"],
                ["Medium", "₹55,460"], ["Large", "₹61,360"]], sizes=[6.0, 6.0])
m.step("Open the application, select the payment option and verify the amount displayed.")
m.step("Proceed to the secure banking page and remit the amount by card, net banking or UPI.")
m.step("Await redirection to the SAMAR portal. The payment is confirmed automatically and a receipt is recorded under Payment History.")
m.note("Important: The browser must not be closed and the back button must not be used while the transaction is in progress. If an "
       "amount is debited but the status is not updated, a second payment must not be made. The matter is to be reported to the "
       "SAMAR Operations team along with the application number.")
m.placeholder("shot-08.png", "Payment page and payment confirmation screen")

m.banner("2.6  Preferred assessment date")
m.body("Following remittance of the fee, a preferred date for the assessment may be indicated and the contact person for the visit "
       "confirmed. The QCI Operations team thereafter allots the assessors and confirms the final date. A preference indicated by "
       "the applicant does not constitute a confirmed booking.")
m.placeholder("shot-09.png", "Preferred date and contact person")

m.banner("2.7  During the assessment")
m.body("The assessment is conducted by the assessor. The Enterprise Admin may extend the following assistance:")
m.bullets(["Upload site photographs and site-tour photographs in respect of the organisation's own unit.",
           "View the assessment summary recorded against the application.",
           "Furnish, through the SAMAR Operations team, any clarification sought by the assessor or the rating committee."])

m.banner("2.8  Certificates and reports")
m.body("Upon certification of a unit by the rating committee, the certificate and the assessment report may be downloaded from "
       "Certificates & Reports. A certificate is valid for three years from the date of issue. Records of every unit of the "
       "enterprise are available at this location.")
m.placeholder("shot-10.png", "Certificates and Reports list with download option")

m.banner("2.9  Feedback")
m.body("On completion of an assessment, the application is listed under Feedback. The brief questionnaire regarding the applicant's "
       "experience is to be completed. The responses received are used for improvement of the scheme.")

m.banner("2.10  Renewal")
m.body("Within the renewal window before a certificate expires (90 days by default, as configured by the System Admin), the "
       "certified application may be renewed and an intimation is sent by email. On initiation of renewal, the certified "
       "application is copied into a fresh, pre-filled draft. The particulars are to be verified, any changes incorporated, and "
       "the application submitted afresh.")
m.note("Renewal may be initiated only by the Enterprise Admin. The renewal application is processed through the same six stages, "
       "including remittance of a fresh fee and a fresh site assessment.")

# ================= PART 3: UNIT ADMIN =================
m.divider("Part 3", "Unit Admin", "Officer-in-charge of a single unit or site")
m.role_card("The officer responsible for a single factory or site. The account is created by the system from the contact "
            "person entered in the unit's first application, and the credentials are emailed to that person.",
            ["View and process applications in respect of the assigned unit only",
             "Create and submit an application for the assigned unit",
             "Upload site photographs and site-tour photographs",
             "Download the certificates and reports of the assigned unit",
             "Raise support requests"],
            ["Remit the assessment fee; this is done by the Enterprise Admin of the organisation",
             "View other units of the organisation",
             "Create or administer any user account",
             "Initiate a renewal; this is to be requested from the Enterprise Admin"])

m.banner("3.1  Menu structure")
m.menu_table([
    ["My Applications", "", "Applications of the assigned unit - initiate a new application, resume a draft or view details."],
    ["Certificates & Reports", "", "Download the certificate and assessment report of the assigned unit."],
    ["Support", "", "Raise a support request and monitor its status."],
])
m.body("A dashboard is not provided to this role. On successful login, the My Applications screen is displayed.")
m.placeholder("shot-11.png", "Unit Admin - My Applications landing screen")

m.banner("3.2  My Applications")
m.step("Select the option to create a new application and indicate whether it pertains to the manufacturing or the service sector.")
m.step("Furnish the particulars called for. The application may be saved as often as required and remains in Draft status until "
       "submitted.")
m.step("Submit the application. The status will change to Approval pending while it is under review by DRDO only if the step is "
       "enabled by the system admin.")
m.body("Any application may be opened to view its tabs, namely Basic Info, Evidences, Site Tour and Payment.")
m.placeholder("shot-12.png", "Application details - Basic Info, Evidences, Site Tour and Payment tabs")

m.banner("3.3  Remittance of the fee")
m.body("The assessment fee is remitted by the Enterprise Admin of the organisation, and not by the Unit Admin. Upon approval of the "
       "application by DRDO, the Unit Admin is to intimate the Enterprise Admin in order that the fee may be remitted. The procedure "
       "and the fee table are set out in paragraph 2.5. The status of the application, including remittance of the fee, may be "
       "followed from My Applications.")

m.banner("3.4  During the assessment")
m.body("The site photographs and site-tour photographs called for in respect of the unit are to be uploaded, and the officer-in-charge "
       "is to remain available to the assessor on the date of the visit.")

m.banner("3.5  Certificates and Reports")
m.body("Following certification, the certificate and the assessment report of the unit may be downloaded from this screen.")

m.banner("3.6  Support")
m.body("A support request may be raised from this screen and the responses monitored. The SAMAR ID and the application number are to "
       "be quoted in every request.")

# ================= PART 4: ASSESSOR =================
m.divider("Part 4", "Assessor", "Web portal and the offline mobile application")
m.role_card("The empanelled expert who conducts the on-site assessment, using both the web portal and the SAMAR assessor mobile "
            "application.",
            ["View only the assessments allotted to the assessor",
             "Record dates on which the assessor is not available for deputation",
             "Conduct the assessment at the site, offline, through the mobile application",
             "Submit the assessment for quality check",
             "Respond to quality-check and rating committee observations"],
            ["View assessments to which the assessor is not deputed",
             "Select assignments or alter the assessment date",
             "View applicant payment records or fee particulars"])

m.banner("4.1  Menu structure")
m.body("The left menu corresponds to the assessment stages, in sequence. On successful login, the Scheduled screen is displayed. A "
       "dashboard is not provided to this role.")
m.menu_table([
    ["Scheduled", "", "Assessments allotted to the assessor for which a date has been confirmed."],
    ["In Progress", "", "Assessments presently being recorded by the assessor."],
    ["Quality Check", "", "Assessments submitted and under review by the Operations Manager."],
    ["Quality Check Feedback", "", "Assessments returned with observations for rectification and resubmission."],
    ["Ready for Committee Review", "", "Assessments awaiting consideration by the rating committee."],
    ["Committee Review Scheduled", "", "Assessments listed for a committee meeting."],
    ["Committee Review Feedback", "", "Assessments on which the committee has sought clarification."],
    ["Certified", "", "Assessments completed and certified."],
])
m.placeholder("shot-13.png", "Assessor web portal - Scheduled list")

m.banner("4.2  Set Unavailability")
m.body("Select the user name at the top-right and choose Set Unavailability in order to record the dates on which deputation is not "
       "possible. This record is referred to by the Operations Manager prior to allotment and is therefore to be kept current.")
m.placeholder("shot-14.png", "Set Unavailability calendar")

m.banner("4.3  The mobile application - installation and login")
m.step("Install the SAMAR assessor application on the mobile device.")
m.step("Grant the camera and location permissions. These are required in order to capture site photographs and to record the "
       "location at which they were taken.")
m.step("Log in using the SAMAR ID and password. Access to this application is restricted to assessors.")
m.note("Logging in to the mobile application on a device terminates any existing session of the application on another device. The "
       "web portal session is maintained separately.")
m.placeholder("shot-15.png", "Mobile application - login and permissions")

m.banner("4.4  Starting an assessment")
m.body("The home screen is organised into two sections by scheme: Manufacturing and Service. Each section lists your assessments "
       "as cards; there are no tabs. Each card carries a status badge: Scheduled, In Progress, Completed. Completed assessments are "
       "not shown on the home screen.")
m.step("Open the assessment allotted to the assessor.")
m.step("While an internet connection is available, allocate the parameters to the lead/co assessors.")
m.step("Punch in before starting the assessment.")
m.placeholder("shot-16.png", "Mobile application - home screen with Manufacturing and Service sections")

m.banner("4.5  The nine on-site steps")
m.body("The on-site steps depend on your role. A lead assessor completes all of the steps set out below. A co-assessor completes "
       "only Site Pictures, the Site Tour and the Assessment Parameters apportioned to them, in addition to Punch In and Punch Out. "
       "Entries may be amended until you tap Complete on Mobile - the final cut-over that follows Punch Out.")
m.simple_table(["#", "Step", "Action to be taken"], [
    ["1", "Allocate Parameter", "The lead assessor apportions the parameters between the lead assessor and the co-assessors."],
    ["2", "Punch In", "Capture a selfie and record your GPS location (both are required) to mark arrival at the site."],
    ["3", "Opening Meeting", "Record the opening meeting with a photograph, the list of participants and any observations."],
    ["4", "Site Pictures", "Capture the specific site photographs called for in respect of this assessment."],
    ["5", "Site Tour", "Capture the site-tour photographs. The date, time and location are recorded against each photograph."],
    ["6", "Basic Information", "Record the unit's products, raw materials, bought-out parts, customers, key resources and "
                               "processes."],
    ["7", "Assessment Parameters", "Record the responses to the questions under each parameter and attach the supporting "
                                   "evidence. A photograph already captured during the site tour may be selected."],
    ["8", "Closing Meeting", "Record the closing meeting, the participants and any observations."],
    ["9", "Punch Out", "Conclude the on-site session. Punch Out becomes available only after the Closing Meeting and all of your "
                       "steps are complete."],
], sizes=[1.0, 4.4, 11.8], fs=10)
m.placeholder("shot-17.png", "Mobile application - Punch In, Site Tour, Assessment Parameters and Closing Meeting")
m.note("Apportionment of parameters may be carried out only by the lead assessor. Co-assessors are able to view and respond to the "
       "parameters apportioned to them.")

m.banner("4.6  Synchronising recorded data")
m.note("Important: Responses recorded through the mobile application are stored on the device until they are synchronised. "
       "Synchronisation is to be carried out whenever an internet connection is available, and no items are to remain unsynced "
       "before logging out, as logging out clears the data held on the device.")
m.body("In the event of a synchronisation failure, a list of the items that could not be synchronised is displayed, with a Retry all "
       "option. The assessor is to remain logged in, obtain a better connection and attempt synchronisation again. The application "
       "must not be uninstalled while items remain pending.")

m.banner("4.7  Submission for quality check")
m.step("On the mobile application, each team member taps Complete on Mobile to finalise the data captured on their device.")
m.step("On the web portal, each co-assessor then submits their apportioned portion.")
m.step("Once all co-assessors have submitted and every member has completed on mobile, the lead assessor submits the assessment for "
       "quality check from the web portal.")
m.body("The assessment is thereafter listed under Quality Check and is taken up for review by the Operations Manager.")
m.placeholder("shot-18.png", "Lead assessor web portal - final submission")

m.banner("4.8  Responding to quality-check observations")
m.body("Where an assessment is returned by the Operations Manager, it is listed under Quality Check Feedback together with the "
       "observations recorded. The observations are to be complied with and the assessment resubmitted.")

m.banner("4.9  Responding to committee observations")
m.body("Where the rating committee seeks clarification, the assessment is listed under Committee Review Feedback. The clarification "
       "is to be furnished against the specific question, with supporting files attached where necessary.")

m.banner("4.10  Deleting locally stored data")
m.note("On the mobile application, the data stored on the device for an assessment may be deleted (Delete Data), which removes the "
       "local copy from that device only. This does not reset the assessment on the server; it can be downloaded again while a "
       "connection is available. There is no facility to reset or restart a submitted assessment.")

# ================= PART 5: OPERATIONS MANAGER =================
m.divider("Part 5", "Operations Manager", "QCI - allocation, scheduling and quality check")
m.role_card("The QCI officer responsible for allotting assessors, fixing assessment dates and quality-checking the assessments "
            "received.",
            ["Allot the assessor team and fix the date of assessment",
             "Quality-check a submitted assessment and either approve it or return it",
             "Refer an approved assessment to the rating committee",
             "View the assessor pool, their technical domains and recorded unavailability"],
            ["Record the final rating or effect certification",
             "View records outside the States assigned to the officer"])

m.banner("5.1  Menu structure")
m.menu_table([
    ["Dashboard", "", "Counts of total and active applications, payments pending, approvals pending, allocations pending and "
                      "assessments under quality check."],
    ["Applications", "", "The complete list of applications, with access to the details of each."],
    ["Payment History", "", "Fee payments recorded against applications."],
    ["Manage Assessments", "Allocation Pending", "Assessments for which the fee has been received, awaiting allotment of an "
                                                 "assessor team and a date. This is the primary work queue of this role."],
    ["", "Scheduled", "Assessments for which the team and date have been confirmed."],
    ["", "In Progress", "Assessments presently being conducted."],
    ["", "Quality Check", "Submitted assessments awaiting review."],
    ["", "Quality Check Feedback", "Assessments returned to the assessor with observations."],
    ["", "Ready for Committee Review", "Assessments that have cleared quality check and await the rating committee."],
    ["", "Committee Review Scheduled", "Assessments listed for a committee meeting."],
    ["", "Committee Review Feedback", "Assessments returned by the committee for clarification."],
    ["", "Certified", "Assessments completed and certified."],
    ["Certified", "", "The certified vendor register."],
    ["Assessors", "", "The assessor pool - particulars, technical domains and availability."],
])
m.placeholder("shot-19.png", "Operations Manager dashboard and Manage Assessments menu")

m.banner("5.2  Allocation Pending - allotment of assessors")
m.step("Open Manage Assessments → Allocation Pending and select an assessment.")
m.step("Select the assessor team and designate one member as the lead assessor.")
m.validation("Validation: The Assessors screen is to be referred to for domain suitability and recorded unavailability prior to "
             "allotment.")
m.step("Fix the date of assessment and confirm.")
m.body("The assessment is thereupon listed under Scheduled and becomes visible in the assessors' mobile application.")
m.placeholder("shot-20.png", "Allotment of assessors and fixing of the date")

m.banner("5.3  Scheduled and In Progress")
m.body("The Scheduled list displays confirmed visits and permits rescheduling where a change of date becomes necessary. The In "
       "Progress list permits an ongoing assessment to be monitored, including the parameter scoring as it is recorded by the "
       "assessors.")

m.banner("5.4  Quality Check")
m.step("Open Manage Assessments → Quality Check and select a submitted assessment.")
m.step("Examine the parameters, the evidence, the meeting records and the site photographs.")
m.step("Either approve the assessment, whereupon it moves to Ready for Committee Review, or return it with observations.")
m.body("An assessment returned in this manner is listed under Quality Check Feedback, both for the Operations Manager and for the "
       "assessor, until it is resubmitted.")
m.placeholder("shot-21.png", "Quality check review and decision")

m.banner("5.5  Referral to the rating committee")
m.body("An assessment that has cleared quality check is listed under Ready for Committee Review. The meeting is thereafter "
       "conducted, and the rating recorded, by the Operations Admin.")

m.banner("5.6  Assessors")
m.body("The Assessors screen displays the assessor pool, comprising the particulars of each assessor, the technical domains against "
       "which they are empanelled and the dates recorded as unavailable. It is referred to prior to allotment so that an assessor of "
       "a suitable domain, who is available on the intended date, may be selected. Assessor accounts are created and administered by "
       "the System Admin.")
m.placeholder("shot-22.png", "Assessors list and assessor particulars")

m.banner("5.7  State-wise jurisdiction")
m.note("Where States have been assigned to a user account, only the organisations, applications, assessments and assessors "
       "pertaining to those States are visible.")

# ================= PART 6: OPERATIONS ADMIN =================
m.divider("Part 6", "Operations Admin", "QCI - rating committee and certification")
m.role_card("The QCI officer responsible for conducting the rating committee and for effecting certification on the basis of an "
            "approved assessment.",
            ["View every application and assessment stage, and check a submitted assessment",
             "Maintain the list of rating committee members",
             "Create, commence, conclude and cancel rating committee meetings",
             "Record the decision of the committee and the rating scores",
             "Certify the application, whereupon the certificate is generated"],
            ["Allot assessors or fix assessment dates; this rests with the Operations Manager",
             "Dispense with the assessor's on-site assessment",
             "Alter system settings or fee slabs beyond the options provided"])

m.banner("6.1  Menu structure")
m.body("The menu comprises the items available to the Operations Manager, together with an additional Rating Committee group.")
m.menu_table([
    ["Dashboard", "", "Counts of total and active applications, payments pending, approvals pending, assessments in progress and "
                      "assessments ready for committee review."],
    ["Applications", "", "Day-to-day processing of applications, with access to the details of each."],
    ["Payment History", "", "Fee payments and receipts."],
    ["Manage Assessments", "Allocation Pending to Certified", "The same nine stage-wise lists as are available to the Operations "
                                                              "Manager. Reference may be made to paragraph 5.1."],
    ["Rating Committee", "Committee Meetings", "Create and conduct committee meetings, and examine the parameters placed before a "
                                               "meeting."],
    ["", "Committee Members", "Maintain the composition of the rating committee."],
    ["Certified", "", "The certified vendor register."],
    ["Assessors", "", "Particulars of assessors."],
])
m.placeholder("shot-23.png", "Operations Admin - Rating Committee menu")

m.banner("6.2  Committee Members")
m.step("Open Rating Committee → Committee Members.")
m.step("Add a member together with the name, organisation and email address.")
m.validation("Validation: Meeting invitations are despatched to the email address recorded. It is to be verified carefully.")
m.step("Update or remove members as the composition of the committee changes.")
m.note("Committee members receive meeting invitations by email but do not log in to SAMAR. The email address recorded is the sole "
       "means of communication with them.")
m.placeholder("shot-24.png", "Committee Members list and add member form")

m.banner("6.3  Committee Meetings")
m.step("Open Rating Committee → Committee Meetings and create a meeting, specifying the title, date, time, application in question "
       "and venue or meeting link.")
m.step("Add the members who are to attend and the assessments that are to be placed before the meeting.")
m.step("Save the meeting. An invitation, with the summary sheet enclosed, is despatched by email to every member.")
m.step("On the appointed day, open the meeting and select Start.")
m.step("Take up each assessment placed before the meeting and record the view of the committee.")
m.step("Select Complete on conclusion of the meeting. The minutes are thereupon despatched to the members by email.")
m.body("A meeting that is not to be held may be cancelled. This action is available only to this role, and the members are intimated "
       "accordingly.")
m.placeholder("shot-25.png", "Meeting creation, member list and start / complete actions")

m.banner("6.4  Recording the rating and certification")
m.step("Open the assessment from Manage Assessments → Committee Review Scheduled.")
m.step("Enter the rating committee scores.")
m.step("Record the decision of the committee, namely certification, or return the assessment to the assessor with observations.")
m.step("On certification, the certificate is generated and becomes available to the applicant for download.")
m.validation("Validation: Certification cannot be reversed through the portal. The scores are to be verified before the decision "
             "is recorded.")
m.placeholder("shot-26.png", "Rating committee scores and committee decision")

m.banner("6.5  Amending a recorded response during review")
m.note("During committee review, a response recorded by an assessor against a question may be amended. This facility is available "
       "only to this role and every amendment is recorded in the system. It is to be exercised only for the purpose of effecting "
       "corrections arising in the meeting, and not as a substitute for reassessment.")

m.banner("6.6  Certified")
m.body("Certified assessments are listed together with the grade awarded and the certificate issued. The certified vendor register "
       "is the record referred to by DRDO laboratories, and the accuracy of the entries made at this stage is therefore of "
       "particular importance.")

# ================= PART 7: DRDO ADMIN =================
m.divider("Part 7", "DRDO Admin", "Approval authority and oversight")
m.role_card("The DRDO officer who determines which applications may proceed based on the permission enabled by the system admin, "
            "and who exercises oversight over the process throughout.",
            ["Approve or reject a submitted application; this is the stage preceding remittance of the fee only if the system "
             "admin has enabled the feature.",
             "View every application and assessment under the scheme",
             "Monitor each assessment stage, including the evidence and the meeting records",
             "Examine the certified vendor register and the certificates issued"],
            ["Allot assessors or fix assessment dates",
             "Conduct quality check or record the rating",
             "Author the assessment framework or activate parameters; this rests with the System Admin"])

m.banner("7.1  Menu structure")
m.menu_table([
    ["Dashboard", "", "Counts of active applications, approvals pending, assessments in progress, certified vendors and "
                      "committee reviews scheduled."],
    ["Applications", "", "All applications visible to DRDO. Drafts are not displayed."],
    ["Pending Approval", "", "Applications awaiting a decision. This is the primary work queue of this role."],
    ["View Assessments", "Allocation Pending to Certified", "Read-only view of every assessment stage."],
    ["Certified", "", "The certified vendor register and the certificates issued."],
])
m.placeholder("shot-27.png", "DRDO Admin dashboard and menu")

m.banner("7.2  Pending Approval - approval of applications")
m.step("Open Pending Approval and select an application.")
m.step("Examine the particulars of the enterprise, the unit and the declarations furnished.")
m.step("Accord approval, whereupon the applicant may remit the fee, or reject the application recording the reasons therefor.")
m.validation("Validation: A rejection is communicated to the applicant. Clear reasons are therefore to be recorded.")
m.note("This is the sole stage between submission and remittance of the fee. No application proceeds until a decision is recorded, "
       "and this queue is accordingly to be cleared promptly. This stage applies only if the System Admin has enabled DRDO "
       "approval.")
m.placeholder("shot-28.png", "Pending Approval list with approve and reject actions")

m.banner("7.3  Applications")
m.body("This screen lists all applications under the scheme together with the stage at which each presently stands. Drafts are not "
       "displayed, an applicant's unsubmitted work being accessible only to the applicant.")

m.banner("7.4  View Assessments - oversight")
m.body("View Assessments reproduces the stage-wise lists available to the Operations roles, on a read-only basis. An assessment may "
       "be opened and the evidence examined, including attendance and punch-in photographs, the opening and closing meeting records "
       "and photographs, site photographs, site-tour photographs and the complete history of observations recorded against each "
       "question.")
m.note("These screens are provided for oversight only and no action may be taken from them.")

m.banner("7.5  Certified")
m.body("The certified vendor register may be examined from this screen, and any certified application opened in order to view the "
       "rating awarded and the certificate issued.")

# ================= PART 8: DRDO LAB =================
m.divider("Part 8", "DRDO Lab", "Reference to the certified vendor register")
m.role_card("A DRDO laboratory required to ascertain whether a supplier holds SAMAR certification.",
            ["Search and examine the certified vendor register",
             "View the application particulars of a certified vendor",
             "View the site-tour photographs of a certified assessment"],
            ["View applications or assessments that have not been certified",
             "View certificates, payments or fee particulars",
             "Effect any change; the role is read-only"])

m.banner("8.1  Menu structure")
m.body("A single menu item is provided to this role. On successful login, that screen is displayed.")
m.menu_table([
    ["Certified", "", "Search the certified vendor register and view the particulars of a vendor."],
])
m.body("The profile menu at the top-right additionally provides View Profile, Change Password and Logout.")
m.placeholder("shot-29.png", "DRDO Lab - certified vendors list")

m.banner("8.2  Searching the certified vendor register")
m.step("Open Certified. This is the landing screen for this role.")
m.step("Search or apply filters in order to locate the supplier concerned.")
m.step("Select the vendor in order to view the particulars of the certified application.")
m.placeholder("shot-30.png", "Certified vendor search and filters")

m.banner("8.3  Viewing a vendor's details")
m.body("The particulars displayed comprise the certified unit, its sector, the rating awarded and the assessment on the basis of "
       "which certification was granted, including the site-tour photographs captured during the visit.")

m.banner("8.4  Information not available to this role")
m.note("Only assessments that have attained the Certified stage are visible to this role. Applications in progress, payments, fee "
       "configuration and certificate documents are, by design, not made available.")

# ================= PART 9: SYSTEM ADMIN =================
m.divider("Part 9", "System Admin", "Technical custodianship of the platform")
m.role_card("The technical custodian of SAMAR at QCI/DRDO. This role carries the highest level of access in the system.",
            ["View every organisation, application, assessment and payment",
             "Create and administer users in any role, and reset passwords",
             "Maintain all master data and the assessment framework, including activation",
             "Configure the fee structure and the feedback questionnaire",
             "Enable and disable maintenance mode, and access SAMAR while it is in force"],
            ["Create or conduct rating committee meetings; this is withheld from the role by design",
             "Function as an assessor at a site"])

m.banner("9.1  Menu structure")
m.menu_table([
    ["Dashboard", "", "System-wide application and payment counts."],
    ["Operations", "Enterprises", "All registered enterprises, with access to each enterprise profile."],
    ["", "Applications", "All applications across the platform."],
    ["", "Payment History", "All fee payments and transactions."],
    ["", "Certified", "The complete certified vendor register."],
    ["User Management", "Assessors", "Create and administer assessor accounts."],
    ["", "DRDO Labs", "Administer DRDO Lab accounts."],
    ["", "DRDO Admins", "Administer DRDO Admin accounts."],
    ["", "Operations Managers", "Administer Operations Manager accounts."],
    ["", "Operations Admins", "Administer Operations Admin accounts."],
    ["Master (Manufacturing)", "Categories · Stores · Key Raw Materials · Bought-Out Parts · Key Processes",
     "The manufacturing master lists from which assessors make their selections."],
    ["Master (Service)", "Categories · Services · Key Service Resources · Outsourced Service Components · Key Services",
     "The service master lists."],
    ["Master (Common)", "Assessor Domains · Third Party Certificates",
     "The domains against which assessors are empanelled, and the third-party certificates that applicants may declare."],
    ["Assessment (Manufacturing)", "Assessment Disciplines · Assessment Parameters · Fee Configuration",
     "The manufacturing framework and the applicable fee slabs."],
    ["Assessment (Service)", "Assessment Disciplines · Assessment Parameters · Fee Configuration",
     "The service framework and the applicable fee slabs."],
    ["Settings", "Feedback Configuration", "The post-assessment feedback questionnaire."],
    ["", "System Settings", "Global settings, including maintenance mode."],
    ["", "User Guides", "Upload and administer the downloadable user manuals."],
])
m.placeholder("shot-31.png", "System Admin dashboard and complete menu")

m.banner("9.2  Operations")
m.body("The Operations group provides read-only visibility across the entire platform - every enterprise, every application, every "
       "payment and the certified vendor register - together with two administrative actions over organisations:")
m.bullets(["Organisation register - the full list of enterprises, with search and filters (status, verification, State and "
           "certification status). The register may be exported to a CSV file.",
           "Activate or deactivate an organisation - deactivation blocks the enterprise’s own users (its Enterprise Admin and Unit "
           "Admins) from signing in. It does not revoke or hide a certificate the organisation already holds: an existing "
           "certificate remains publicly verifiable until it expires or is itself withdrawn.",
           "Applications, Payments and the certified register - viewed here for oversight only; this is not the point at which "
           "applications are approved or fees are collected."])

m.banner("9.3  User Management")
m.step("Open User Management and select the category of account to be created. This role provisions the QCI and DRDO back-office "
       "accounts - Assessor, Operations Manager, Operations Admin, DRDO Admin and DRDO Lab. (Enterprise Admins register themselves, "
       "and Unit Admins are created automatically from applications.)")
m.step("Enter the officer’s name, official email address and mobile number, together with the particulars specific to the role - "
       "for an Assessor, the technical domains and the districts of operation; for an Operations Manager, the States of "
       "jurisdiction.")
m.step("Save the record. A SAMAR ID and a temporary password are generated and emailed to the officer, who signs in with the SAMAR "
       "ID and is required to set a new password on first login.")
m.placeholder("shot-32.png", "User Management - create user")

m.banner("9.4  Master data")
m.body("Master data comprises the reference lists from which applicants and assessors make selections while completing an "
       "application or an assessment. Every list behaves in the same way: an item may be added, amended, or deactivated so that it "
       "no longer appears in fresh records. Items are not deleted outright, and there is no bulk import at this screen. The lists "
       "are maintained under three heads:")
m.bullets(["Master (Manufacturing) - five lists: DRDO Vendor Categories, Stores, Key Raw Materials, Bought-Out Parts and Key "
           "Processes.",
           "Master (Service) - five lists: Vendor Categories, Services (Vendor Labs), Key Service Resources, Outsourced Service "
           "Components and Key Services. Each service item is additionally classified by service-provider type - Annual "
           "Maintenance Contract, Critical Service Provider or Civil Works Contractor.",
           "Master (Common) - two lists shared by both sectors: Assessor Domains (the technical domains against which assessors "
           "are empanelled) and Third-Party Certificates."])
m.body("Geographic reference data - countries, States, districts and PIN codes, used to populate address fields - is maintained "
       "separately and is not edited from these screens.")
m.note("Items are to be deactivated rather than deleted. Existing applications and assessments continue to refer to earlier items, "
       "and deletion would render historical records incomplete.")

m.banner("9.5  Assessment framework and fee configuration")
m.body("The assessment framework defines everything that is placed before an assessor at the site. It is organised as a four-level "
       "structure, maintained separately for the manufacturing and the service sectors:")
m.bullets(["Discipline - a broad area of assessment, tagged to its sector.",
           "Assessment Parameter - belongs to a discipline and is scoped to a vendor category and an enterprise-size band (startup, "
           "micro, small, medium or large). Each parameter is given an automatic code (MFG-### for manufacturing, SVC-### for "
           "service) and may be marked mandatory.",
           "Question - each parameter carries one or more questions, each with a category (planning, deployment or monitoring) and "
           "a weightage expressed as a percentage.",
           "Answer Option - each question offers up to five options, each carrying a score from 1 (lowest) to 5 (highest)."])
m.body("Scoring rule. The weightages of the active questions within a parameter must total exactly 100 per cent. The system will not "
       "activate a parameter whose questions do not total 100, and will automatically deactivate a parameter if a later edit "
       "disturbs the total. At the site the assessor selects one option per question; the option’s score, weighted, contributes to "
       "the parameter’s score, and the result across parameters yields a maturity rating from Level 1 to Level 5. This same rating "
       "determines the grade recorded on the certificate.")
m.step("Create or amend disciplines, parameters, questions and options directly, or import parameters in bulk. For a bulk import, "
       "download the template, complete it (columns: Discipline, Parameter Name, Type, Question Category, Question Text, Weightage "
       "%, and Option 1 to Option 5) and upload it, selecting the sector, the enterprise-size bands and the vendor categories to "
       "which the parameters are to apply. A single import is replicated across every selected combination.")
m.step("The import is validated as a whole - every weightage set must total 100 - and is accepted only if the entire file is "
       "valid. A separate bulk-update template, keyed by parameter code, allows existing parameters to be revised in the same "
       "manner.")
m.step("Activate the parameters that are to be brought into use, and deactivate any that are being withdrawn. Amendments to the "
       "master framework do not affect assessments already in progress, which retain the parameters as they stood when the "
       "assessment began.")
m.note("Activation takes effect in respect of fresh assessments. Assessments already in progress continue with the framework under "
       "which they were commenced.")
m.body("Fee Configuration determines the fee levied upon applicants, held as a table of ten slabs - the two sectors against the five "
       "enterprise-size bands. Each slab records a base certification fee, a food-and-accommodation charge, the GST percentage (18 "
       "per cent) and whether TDS is deducted (off by default; 2 or 10 per cent where enabled). The amount payable is the base and "
       "food-and-accommodation charges, plus GST, less any TDS.")
m.placeholder("shot-33.png", "Assessment Parameters - bulk import and activation")

m.banner("9.6  Settings, User Guides and maintenance mode")
m.body("Three configuration areas are grouped here:")
m.bullets(["System Settings - the global switches that govern the scheme: whether DRDO approval is required before payment; the "
           "certificate validity period (three years by default); the recertification window, being the number of days before "
           "expiry from which renewal may be initiated (90 by default); whether new applications may be submitted; and "
           "maintenance mode, together with the message shown while it is in force.",
           "Feedback Configuration - the post-assessment questionnaire put to applicants. Each question is of one of two kinds, a "
           "five-star rating or a yes/no answer, and questions may be reordered and activated or deactivated.",
           "User Guides - the location at which this manual and the other guides are uploaded, for downloading by users."])
m.body("Maintenance mode displays a maintenance message and restricts ordinary portal operations; it does not by itself prevent "
       "administrators from signing in.")
m.note("Maintenance mode restricts access to SAMAR for every other role. Planned maintenance is therefore to be intimated in "
       "advance, the window kept to the minimum necessary, and normal access verified for an ordinary user on completion.")
m.placeholder("shot-34.png", "System Settings - maintenance mode")

# ================= APPENDICES =================
# Appendix A is inline: the master's stage table names "DRDO Approval pending" and
# shortens the Rejected row, so it no longer matches samar_common.appendix_stages.
m.page_break()
m.banner("Appendix A: Application and assessment stages", toc=0)
m.body("Every application and assessment proceeds through the stages set out below. The nomenclature is uniform across all roles.")
m.simple_table(["Stage displayed", "Meaning", "Action rests with"], [
    ["Draft", "Under preparation; not yet submitted.", "Enterprise / Unit Admin"],
    ["DRDO Approval pending", "Submitted and awaiting the decision of DRDO.", "DRDO Admin"],
    ["Payment pending", "Approved and awaiting remittance of the fee.", "Enterprise / Unit Admin"],
    ["Payment completed", "Fee received; the assessment record has been created.", "Operations Manager"],
    ["Allocation pending", "Awaiting allotment of an assessor team and a date.", "Operations Manager"],
    ["Scheduled", "Assessor team and date confirmed.", "Assessor"],
    ["In progress", "The assessment is being conducted.", "Assessor"],
    ["Quality check", "Submitted and under review by QCI.", "Operations Manager"],
    ["Quality check feedback", "Returned to the assessor with observations.", "Assessor"],
    ["Ready for committee review", "Cleared quality check; awaiting the rating committee.", "Operations Admin"],
    ["Committee review scheduled", "Listed for a committee meeting.", "Operations Admin"],
    ["Committee review feedback", "Clarification sought by the committee.", "Assessor"],
    ["Certified", "Successfully concluded; the certificate has been issued.", "-"],
    ["Rejected", "Not proceeded with.", "-"],
], sizes=[4.6, 8.2, 4.4], fs=10)

appendix_glossary(m)

m.page_break()
m.banner("Appendix C: Points of contact", toc=0)
m.simple_table(["Matter", "To be referred to"], [
    ["Correction of an incorrect role, or a login that cannot be recovered", "SAMAR Operations team"],
    ["Status of an application awaiting approval", "DRDO Admin, through the SAMAR Operations team"],
    ["Change of an assessment date or of an assessor", "Operations Manager"],
    ["Representation regarding a rating or a decision of the committee", "Operations Admin"],
    ["Report of a fault or an error message", "Support request (applicant roles) or the SAMAR Operations team"],
    ["Amount debited but not recorded against the application",
     "SAMAR Operations team, quoting the application number. A second payment must not be made."],
], sizes=[8.6, 8.6])
m.note("Applicant roles may raise a support request from the Support option in the left menu. The SAMAR ID and the application "
       "number are to be quoted in every request, as this enables the earliest resolution.")

m.save(OUT,
       checklist_path=os.path.join(SHOTS_DIR, "SCREENSHOT-CHECKLIST.md"),
       checklist_title="SAMAR User Manual")
