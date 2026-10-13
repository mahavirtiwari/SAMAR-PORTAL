# -*- coding: utf-8 -*-
"""SAMAR Portal: Applicant Handbook (public, standalone).

Covers both accounts held on the applicant side: the Enterprise Admin, being
the principal account of the organisation, and the Unit Admin, being the
officer-in-charge of a single site. Kept short in the spirit of the client's
Applicant Manual: it carries only what an applicant needs to register, apply,
pay and obtain the certificate, so its Part 1 is its own rather than the shared
block. Screenshot filenames are shared with the full User Manual.
"""

import os
from samar_common import Manual, SHOTS_DIR, OUT_DIR, about_samar, appendix_stages

OUT = os.path.join(OUT_DIR, "SAMAR Portal - Applicant Handbook.docx")
VERSION = "Version 1 / 23-09-2026"

m = Manual("Applicant Handbook", VERSION)

# ================= COVER =================
m.cover("Applicant Handbook")

# ================= INTRODUCTION =================
m.page_break()
m.banner("Introduction", toc=0)
m.body("This handbook is the official guide for applicant organisations using SAMAR, the System for Advanced Maturity Assessment "
       "and Rating. SAMAR is administered jointly by the Quality Council of India (QCI) and the Defence Research and Development "
       "Organisation (DRDO), Ministry of Defence.")
m.body("It explains, step by step, how an enterprise registers, submits an application, remits the fee and obtains a certificate "
       "through the SAMAR web portal. Two accounts are held on the applicant side. The Enterprise Admin is the principal account of "
       "the organisation. The Unit Admin is the officer-in-charge of a single factory or site.")
m.simple_table(["Account held", "Parts to be referred"], [
    ["Principal account of the organisation", "Part 1 and Part 2: Enterprise Admin"],
    ["Officer-in-charge of a single unit or site", "Part 1 and Part 3: Unit Admin"],
], sizes=[8.6, 8.6])
m.note("Each unit is certified separately. A separate application is accordingly to be made in respect of every site for which "
       "certification is sought.")

m.contents()

# ================= PART 1 =================
m.divider("Part 1", "General Information", "Applicable to both applicant accounts")

m.banner("1.1  About SAMAR")
about_samar(m)
m.body("SAMAR is accessed through a web portal on a desktop or laptop computer. No mobile application is required of an applicant, "
       "except for a unit applying under the service sector (paragraph 2.7).")

m.banner("1.2  Who does what")
m.body("The applicant deals with the following offices in the course of an application.")
m.simple_table(["Office", "Responsibility"], [
    ["Enterprise Admin", "The organisation's principal account: registers, applies, remits the fee, downloads certificates."],
    ["Unit Admin", "The officer-in-charge of one unit: applies for that unit and supports the assessment."],
    ["DRDO Admin", "Approves or rejects an application."],
    ["QCI Operations team", "Allots the assessors, confirms the assessment date and reviews the submitted assessment."],
    ["Assessor", "Conducts the on-site assessment. Allotted by QCI; not chosen by the applicant."],
    ["Rating committee", "Determines the rating, upon which the certificate is issued."],
], sizes=[4.6, 12.6], fs=10)

m.banner("1.3  Logging in")
m.step("Open the SAMAR portal in a web browser.")
m.step("Enter the SAMAR ID together with the password.")
m.validation("Validation: Both fields are mandatory. The SAMAR ID is the login identifier issued to the user, in the form "
             "SAMAR-DDMMYY-N (for example SAMAR-080125-123). Passwords are 7 to 20 characters and case-sensitive.")
m.step("Enter the characters shown in the captcha image. Select the refresh icon beside it for a new image.")
m.validation("Validation: The captcha is not case-sensitive and is valid for five minutes. After an unsuccessful attempt a new "
             "image is shown and is to be entered afresh.")
m.step("Select Login.")
m.step("If two-factor authentication is enabled for the account, enter the six-digit one-time password (OTP) sent to the registered "
       "email address and select Verify.")
m.validation("Validation: The OTP is valid for a limited period. Select Resend if it has lapsed.")
m.body("Each account is restricted to one active web session. Logging in again terminates the previous session. If a user is "
       "notified of a login that was not initiated by them, the password is to be changed immediately.")
m.placeholder("shot-01.png", "Login screen: SAMAR ID, password, captcha, Login button")

m.banner("1.4  Password reset")
m.step("On the login screen, select Forgot Password.")
m.step("Enter the SAMAR ID and the captcha characters, and select Send OTP. A six-digit OTP is sent to the registered email "
       "address. It may be resent after 120 seconds.")
m.step("Enter the OTP, then enter and confirm a new password of 7 to 20 characters, and log in again.")
m.placeholder("shot-02.png", "Forgot Password and Set New Password screens")

m.banner("1.5  The profile menu")
m.body("Select the user name displayed at the top-right of any screen. The following options are available:")
m.bullets(["View Profile: displays the user's registered particulars.",
           "Change Password: permits a new password to be set while logged in.",
           "Logout: terminates the session. Confirmation is sought before the session is closed."])
m.placeholder("shot-03.png", "Profile menu in the page header")

m.banner("1.6  Assistance and support")
m.body("Both applicant accounts are provided a Support option in the left menu through which a request may be raised and its "
       "progress monitored. This is the ordinary means by which assistance is to be sought. The SAMAR ID and the application number "
       "are to be quoted in every request, as this enables the earliest resolution.")
m.note("Should a maintenance notice be displayed, the system is temporarily unavailable on account of planned maintenance. "
       "Users are requested to attempt access subsequently. No saved data is lost during maintenance.")

# ================= PART 2: ENTERPRISE ADMIN =================
m.divider("Part 2", "Enterprise Admin", "Principal account of the applicant organisation")

m.banner("2.1  Menu structure")
m.menu_table([
    ["Dashboard", "", "Summary counts of units, active applications, drafts and certificates."],
    ["My Applications", "", "Create a new application, resume a draft, monitor progress and view details."],
    ["Payment History", "", "All fee payments and receipts of the organisation."],
    ["Unit Users", "", "Read-only list of the Unit Admin accounts of the enterprise, with each account's unit and last login."],
    ["Feedback", "", "Submit the post-assessment feedback."],
    ["Certificates & Reports", "", "Download certificates and assessment reports of all units."],
    ["Enterprise Profile", "", "View and amend the particulars of the organisation."],
    ["Support", "", "Raise a support request and monitor its status."],
])
m.placeholder("shot-04.png", "Enterprise Admin dashboard and left menu")

m.banner("2.2  Registration and first login")
m.step("Open the SAMAR portal and select Sign up.")
m.step("Enter the enterprise name as per the organisation's PAN, the name of the contact person, the email address and the "
       "ten-digit mobile number, followed by the captcha characters, and select Sign Up.")
m.validation("Validation: All one-time passwords, approvals and notices are sent to the email address entered here. It is to be "
             "kept current and accessible.")
m.step("Enter the OTP received at that email address in order to verify it.")
m.step("Set a password and complete the registration. The account so created is the Enterprise Admin account.")
m.placeholder("shot-05.png", "Sign-up form")

m.banner("2.3  Units and unit users")
m.body("A unit denotes a single factory or site, and each unit is certified separately. Units are not added from a separate "
       "screen: a unit is created automatically when an application is first created for it (paragraph 2.4), from the unit "
       "particulars entered in that application.")
m.body("The Unit Admin account for the unit is likewise created automatically, from the contact person entered in that first "
       "application, and the login credentials are sent to the contact person's email address. Unit Users lists these accounts; "
       "they are not created or edited there. In the event of a change of incumbent, the unit may be reassigned to a different "
       "Unit Admin, and fresh credentials are emailed to the new incumbent.")
m.placeholder("shot-06.png", "Unit Users: read-only list of Unit Admin accounts")

m.banner("2.4  Creating an application")
m.body("The certification process comprises the following six stages:")
m.process_flow()
m.body("The following documents are uploaded within the application and are to be kept ready. Files are PDF, JPG, JPEG or PNG, "
       "up to 5 MB each.")
m.simple_table(["Document", "When it is required"], [
    ["Site exterior photograph", "Always. JPG, JPEG or PNG only."],
    ["GST certificate", "If the enterprise is GST-registered."],
    ["Government registration certificate", "If the enterprise is government-registered."],
    ["DRDO certificate", "If the enterprise is an existing DRDO vendor."],
    ["DPIIT, Udyam or Incorporation certificate",
     "Exactly one, according to the classification selected: DPIIT for a Startup, Udyam for a Micro, Small or Medium "
     "enterprise, Certificate of Incorporation for a Large enterprise."],
], sizes=[6.4, 10.8], fs=10)
m.step("Open My Applications and initiate a new application for either the manufacturing or the service sector.")
m.step("Complete the five guided steps: Enterprise details, Operations, Products (or Services), Declarations and Review. The "
       "application may be saved and resumed at any step and remains in Draft status until submitted.")
m.step("Submit the application. The status changes to Approval Pending while it is under review by DRDO.")
m.validation("Validation: An application once submitted cannot be edited. The unit and the contact person are to be verified "
             "prior to submission. Product, service, customer and process names must each be unique; export and import "
             "percentages cannot together exceed 100 per cent; a manufacturing unit lists at least one key raw material or "
             "bought-out part; both declarations on the final step are to be agreed.")
m.placeholder("shot-07.png", "My Applications: new application and list of drafts")

m.banner("2.5  Remitting the fee")
m.body("Upon approval of the application by DRDO, the fee is to be remitted online through ICICI EazyPay. The fee is determined by "
       "the size of the enterprise. Goods and Services Tax at 18 per cent is included in the amounts below.")
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
m.body("The assessment is conducted by the assessor allotted by QCI. The applicant is to keep the officer-in-charge available at "
       "the site on the confirmed date, upload the site photographs and site-tour photographs called for in respect of the unit, "
       "and furnish, through the SAMAR Operations team, any clarification sought by the assessor or the rating committee. The "
       "assessment summary may be viewed against the application.")
m.body("Where the unit has applied under the service sector, the applicant is additionally required to install the SAMAR "
       "Applicant mobile application and, through it, to capture and upload the pictures called for as evidence. In the "
       "manufacturing sector the assessor records the photographs on site and no such application is required.")

m.banner("2.8  Certificates and reports")
m.body("Upon certification of a unit by the rating committee, the certificate and the assessment report may be downloaded from "
       "Certificates & Reports. Records of every unit of the enterprise are available at this location.")
m.placeholder("shot-10.png", "Certificates and Reports list with download option")

m.banner("2.9  Feedback")
m.body("On completion of an assessment, the application is listed under Feedback. The brief questionnaire regarding the applicant's "
       "experience is to be completed.")

m.banner("2.10  Renewal")
m.body("Within the renewal window before a certificate expires (90 days by default), the certified application may be renewed, "
       "and an intimation is sent by email. On initiation of renewal, the certified application is copied into a fresh, "
       "pre-filled draft. The particulars are to be verified, any changes incorporated, and the application submitted afresh.")
m.note("Renewal may be initiated only by the Enterprise Admin. The renewal application is processed through the same six stages, "
       "including remittance of a fresh fee and a fresh site assessment.")

# ================= PART 3: UNIT ADMIN =================
m.divider("Part 3", "Unit Admin", "Officer-in-charge of a single unit or site")

m.banner("3.1  Menu structure")
m.body("The Unit Admin account is created by the system from the contact person entered in the unit's first application, and the "
       "credentials are emailed to that person. It covers the assigned unit only.")
m.menu_table([
    ["My Applications", "", "Applications of the assigned unit: initiate a new application, resume a draft or view details."],
    ["Certificates & Reports", "", "Download the certificate and assessment report of the assigned unit."],
    ["Support", "", "Raise a support request and monitor its status."],
])
m.body("A dashboard is not provided to this role. On successful login, the My Applications screen is displayed.")
m.placeholder("shot-11.png", "Unit Admin: My Applications landing screen")

m.banner("3.2  My Applications")
m.step("Select the option to create a new application and indicate whether it pertains to the manufacturing or the service sector.")
m.step("Furnish the particulars called for, as set out in paragraph 2.4. The application may be saved as often as required and "
       "remains in Draft status until submitted.")
m.step("Submit the application. The status changes to Approval Pending while it is under review by DRDO.")
m.body("Any application may be opened to view its tabs, namely Basic Info, Evidences, Site Tour and Payment.")
m.placeholder("shot-12.png", "Application details: Basic Info, Evidences, Site Tour and Payment tabs")

m.banner("3.3  Fee, assessment and certificate")
m.body("The assessment fee is remitted by the Enterprise Admin of the organisation, and not by the Unit Admin. Upon approval of the "
       "application by DRDO, the Unit Admin is to intimate the Enterprise Admin in order that the fee may be remitted (paragraph 2.5). "
       "The status of the application, including remittance of the fee, may be followed from My Applications.")
m.body("During the assessment, the site photographs and site-tour photographs called for in respect of the unit are to be "
       "uploaded, and the officer-in-charge is to remain available to the assessor on the date of the visit. A unit applying under "
       "the service sector additionally uploads its evidence pictures through the SAMAR Applicant mobile application (paragraph 2.7).")
m.body("Following certification, the certificate and the assessment report of the unit may be downloaded from Certificates & "
       "Reports. Renewal is initiated by the Enterprise Admin, and is to be requested from that account.")

# ================= APPENDICES =================
appendix_stages(m)

m.banner("Appendix B: Points of contact", toc=0)
m.simple_table(["Matter", "To be referred to"], [
    ["Correction of an incorrect role, or a login that cannot be recovered", "Support request, or the SAMAR Operations team"],
    ["Status of an application awaiting approval", "DRDO Admin, through the SAMAR Operations team"],
    ["Change of an assessment date", "Operations Manager, through a support request"],
    ["Representation regarding a rating or a decision of the committee", "Operations Admin, through the SAMAR Operations team"],
    ["Report of a fault or an error message", "Support request from the left menu"],
    ["Amount debited but not recorded against the application",
     "SAMAR Operations team, quoting the application number. A second payment must not be made."],
], sizes=[8.6, 8.6])
m.note("A support request may be raised from the Support option in the left menu. The SAMAR ID and the application number are to be "
       "quoted in every request, as this enables the earliest resolution.")

m.save(OUT,
       checklist_path=os.path.join(SHOTS_DIR, "SCREENSHOT-CHECKLIST-APPLICANT.md"),
       checklist_title="SAMAR Applicant Handbook")
