# -*- coding: utf-8 -*-
"""SAMAR Portal: Assessor Handbook (public, standalone).

Part 1 is the general information common to all users; Part 2 covers the
assessor role in full, on both the web portal and the offline mobile
application. Screenshot filenames are shared with the full User Manual.
"""

import os
from samar_common import (Manual, SHOTS_DIR, OUT_DIR, GREY,
                          part_general_information, appendix_stages, appendix_glossary)

OUT = os.path.join(OUT_DIR, "SAMAR Portal - Assessor Handbook.docx")
VERSION = "Version 1 / 23-09-2026"

m = Manual("Assessor Handbook", VERSION)

# ================= COVER =================
m.cover("Assessor Handbook")

# ================= FOREWORD =================
m.page_break()
m.banner("Foreword", toc=0)
m.body("This handbook is the official operating guide for assessors empanelled under SAMAR, the System for "
       "Advanced Maturity Assessment and Rating. SAMAR is administered jointly by the Quality Council of India "
       "(QCI) and the Defence Research and Development Organisation (DRDO), Ministry of Defence.")
m.body("It sets out, step by step, how an assessor conducts a site assessment through the SAMAR web portal and "
       "the offline mobile application, from allotment of the visit to submission for quality check. The "
       "handbook is published for the reference of assessors and other authorised users, and may be circulated "
       "freely for that purpose.")
m.body("For any assistance, contact the SAMAR Operations team through the channels listed in Appendix C.")

m.contents()

# ================= PART 1 =================
part_general_information(
    m,
    roles_intro="The screens and functions available to a user are determined by the role assigned to that user. Eight roles are "
                "provided. The assessor is one of them, and the table below indicates the office with which the assessor deals at "
                "each stage.",
    support_para="The assessor is not provided a Support option in the left menu; that facility is reserved for the applicant "
                 "roles. Any difficulty encountered, whether in the web portal or in the mobile application, is to be reported to "
                 "the SAMAR Operations team. The SAMAR ID and the assessment or application number are to be quoted in all "
                 "correspondence. A matter concerning the date of an assessment or the composition of the assessor team is to be "
                 "taken up with the Operations Manager.",
    unavailability_note="Assessors are provided one additional option, Set Unavailability, which is detailed in paragraph 2.3.")

# ================= PART 2: ASSESSOR =================
m.divider("Part 2", "The Assessor", "Web portal and the offline mobile application")

m.banner("2.1  Scope of the role")
m.role_card("The empanelled expert who conducts the on-site assessment, using both the web portal and the SAMAR assessor mobile "
            "application.",
            ["View only the assessments allotted to the assessor",
             "Record dates on which the assessor is not available for deputation",
             "Conduct the assessment at the site, offline, through the mobile application",
             "Submit the assessment for quality check (lead assessor only)",
             "Respond to quality-check and rating committee observations"],
            ["View assessments to which the assessor is not deputed",
             "Select assignments or alter the assessment date",
             "View applicant payment records or fee particulars"])

m.banner("2.2  Menu structure")
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
m.placeholder("shot-13.png", "Assessor web portal: Scheduled list")

m.banner("2.3  Set Unavailability")
m.body("Select the user name at the top-right and choose Set Unavailability in order to record the dates on which deputation is not "
       "possible. This record is referred to by the Operations Manager prior to allotment and is therefore to be kept current.")
m.placeholder("shot-14.png", "Set Unavailability calendar")

m.banner("2.4  The mobile application: installation and login")
m.step("Install the SAMAR assessor application on the mobile device.")
m.step("Grant the camera and location permissions. These are required in order to capture site photographs and to record the "
       "location at which they were taken.")
m.step("Log in using the SAMAR ID and password, and the six-digit email OTP if prompted. Access to this application is restricted to "
       "assessors.")
m.note("Logging in to the mobile application on a device terminates any existing session of the application on another device. The "
       "web portal session is maintained separately.")
m.placeholder("shot-15.png", "Mobile application: login and permissions")

m.banner("2.5  Downloading an assessment")
m.body("The home screen is organised into two sections by scheme: Manufacturing and Service. Each section lists your assessments as "
       "cards; there are no tabs. Each card carries a status badge: Scheduled, In Progress, Completed or Completed on Mobile. "
       "Completed assessments are not shown on the home screen.")
m.step("Open the assessment allotted to the assessor.")
m.step("While an internet connection is available, permit the assessment to download in full.")
m.step("Verify that the assessment is listed under In Progress before proceeding to the site, as an internet connection may not be "
       "available at many locations.")
m.placeholder("shot-16.png", "Mobile application: home screen with Manufacturing and Service sections")

m.banner("2.6  The on-site steps")
m.body("The on-site steps depend on your role. A lead assessor completes all of the steps set out below. A co-assessor completes "
       "only Site Pictures, the Site Tour and the Assessment Parameters apportioned to them, in addition to Punch In and Punch Out. "
       "Entries may be amended until you tap Complete on Mobile: the final cut-over that follows Punch Out.")
m.simple_table(["#", "Step", "Action to be taken"], [
    ["1", "Punch In", "Capture a selfie and record your GPS location (both are required) to mark arrival at the site."],
    ["2", "Parameter Allocation", "Lead assessor only, online: apportion the assessment parameters between the lead assessor and "
                                  "the co-assessors."],
    ["3", "Site Pictures", "Capture the specific site photographs called for in respect of this assessment."],
    ["4", "Opening Meeting", "Record the opening meeting with a photograph, the list of participants and any observations."],
    ["5", "Site Tour", "Capture the site-tour photographs. The date, time and location are recorded against each photograph."],
    ["6", "Basic Information", "Record the unit's products, raw materials, bought-out parts, customers, key resources and "
                                "processes."],
    ["7", "Assessment Parameters", "Record the responses to the questions under each apportioned parameter and attach the "
                                   "supporting evidence. A photograph captured during the site tour may be selected."],
    ["8", "Closing Meeting", "Record the closing meeting, the participants and any observations."],
    ["9", "Punch Out", "Conclude the on-site session. Punch Out becomes available only after the Closing Meeting and all of your "
                       "steps are complete."],
], sizes=[1.0, 4.4, 11.8], fs=10)
m.placeholder("shot-17.png", "Mobile application: Punch In, Site Tour, Assessment Parameters and Closing Meeting")
m.note("Apportionment of parameters may be carried out only by the lead assessor. Co-assessors are able to view and respond to the "
       "parameters apportioned to them.")

m.banner("2.7  Synchronising recorded data")
m.note("Important: Responses recorded through the mobile application are stored on the device until they are synchronised. "
       "Synchronisation is to be carried out whenever an internet connection is available, and no items are to remain unsynced "
       "before logging out, as logging out clears the data held on the device.")
m.body("In the event of a synchronisation failure, a list of the items that could not be synchronised is displayed, with a Retry all "
       "option. The assessor is to remain logged in, obtain a better connection and attempt synchronisation again. The application "
       "must not be uninstalled while items remain pending.")

m.banner("2.8  Submission for quality check")
m.step("On the mobile application, each team member taps Complete on Mobile to finalise the data captured on their device.")
m.step("On the web portal, each co-assessor then submits their apportioned portion. Once all co-assessors have submitted and every "
       "member has completed on mobile, the lead assessor submits the assessment for quality check from the web portal.")
m.body("The assessment is thereafter listed under Quality Check and is taken up for review by the Operations Manager.")
m.placeholder("shot-18.png", "Lead assessor web portal: final submission")

m.banner("2.9  Responding to quality-check observations")
m.body("Where an assessment is returned by the Operations Manager, it is listed under Quality Check Feedback together with the "
       "observations recorded. The observations are to be complied with and the assessment resubmitted.")

m.banner("2.10  Responding to committee observations")
m.body("Where the rating committee seeks clarification, the assessment is listed under Committee Review Feedback. The clarification "
       "is to be furnished against the specific question, with supporting files attached where necessary.")

m.banner("2.11  Deleting locally stored data")
m.note("On the mobile application, the data stored on the device for an assessment may be deleted (Delete Data), which removes the "
       "local copy from that device only. This does not reset the assessment on the server; it can be downloaded again while a "
       "connection is available. There is no facility to reset or restart a submitted assessment.")

# ================= PART 3: POINTS TO BE OBSERVED =================
m.divider("Part 3", "Points to be observed", "Matters that most commonly give rise to difficulty at the site")

m.banner("3.1  Matters commonly giving rise to difficulty")
m.body("The following are set out together for ready reference. They apply to every assessor, whether deputed as the lead assessor "
       "or as a co-assessor.")
m.simple_table(["Matter", "Requirement"], [
    ["Before departure for the site",
     "The assessment is to be downloaded in full while a connection is available, and verified as listed under In Progress."],
    ["Permissions",
     "Camera and location permissions are to be granted, failing which photographs cannot be captured or located."],
    ["Sequence of steps",
     "The on-site steps, which depend on the assessor's role, are to be completed in order. Entries may be amended until Complete "
     "on Mobile is tapped."],
    ["Apportionment",
     "Only the lead assessor may apportion parameters. Co-assessors respond only to the portion apportioned to them."],
    ["Evidence",
     "Every response is to carry the supporting evidence. A photograph captured during the site tour may be selected."],
    ["Before logging out",
     "No items are to remain unsynced. Logging out clears the data held on the device."],
    ["Final submission",
     "Only the lead assessor submits, and only after all co-assessors have submitted their portions."],
    ["Change of date or team",
     "Neither may be altered by the assessor. The Operations Manager is to be approached."],
], sizes=[5.0, 12.2], fs=10)

# ================= APPENDICES =================
appendix_stages(m)
appendix_glossary(m)

m.page_break()
m.banner("Appendix C: Points of contact", toc=0)
m.simple_table(["Matter", "To be referred to"], [
    ["Correction of an incorrect role, or a login that cannot be recovered", "SAMAR Operations team"],
    ["Change of an assessment date, or of the composition of the assessor team", "Operations Manager"],
    ["An allotment that is not visible in the portal or in the mobile application", "Operations Manager"],
    ["Observations recorded at quality check", "Operations Manager"],
    ["Clarification sought by the rating committee", "Operations Admin, through the SAMAR Operations team"],
    ["Failure of synchronisation, or a fault in the mobile application",
     "SAMAR Operations team, quoting the assessment number. The application must not be uninstalled while items remain pending."],
], sizes=[8.6, 8.6])
m.note("The SAMAR ID and the assessment or application number are to be quoted in every communication, as this enables the earliest "
       "resolution.")

m.save(OUT,
       checklist_path=os.path.join(SHOTS_DIR, "SCREENSHOT-CHECKLIST-ASSESSOR.md"),
       checklist_title="SAMAR Assessor Handbook")
