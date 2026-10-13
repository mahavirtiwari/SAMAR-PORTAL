# -*- coding: utf-8 -*-
"""Role reference data for the SAMAR User Manual: derived from the qci-samar-web
frontend (navigation role maps in UserNavigator.jsx, the per-role sidebar menus
in utils/sidebarMenu, and the actions each screen actually exposes). The frontend
is authoritative for what a user can do in the portal; the backend permits some
functions the portal never surfaces, and those are deliberately not listed here.
Consumed by build_docx.py."""

# (Role name, designation in plain terms, scope of visibility)
ROLE_MATRIX = [
    ("System Admin", "Technical custodian of the SAMAR system at QCI/DRDO", "Complete access, including system settings and maintenance mode"),
    ("DRDO Admin", "DRDO officer responsible for approving applications", "All applications, framework authoring and certificate approval"),
    ("DRDO Lab", "DRDO laboratory referring to the certified vendor register", "Read-only access to certified units and the organisation register"),
    ("Operations Manager", "QCI officer responsible for allocation, scheduling and quality check", "Records within the States assigned to the officer"),
    ("Operations Admin", "QCI officer responsible for the rating committee and certification", "Committee proceedings, ratings and certification"),
    ("Assessor", "Empanelled expert who conducts the on-site assessment", "Only the assessments allotted to the assessor"),
    ("Enterprise Admin", "Principal account of the applicant organisation", "The organisation and all of its units"),
    ("Unit Admin", "Officer-in-charge of a single unit or site", "Only the unit(s) assigned to the officer"),
]

# Consolidated authorisation matrix. Y = permitted, "-" = not permitted, "◐" = permitted within scope.
CAP_HEADERS = ["Function", "SA", "DRDO\nAdmin", "DRDO\nLab", "Ops\nMgr", "Ops\nAdmin", "Asr", "Ent\nAdmin", "Unit\nAdmin"]
CAP_ROWS = [
    ["Register organisation and units",           "-", "-", "-", "-", "-", "-", "Y", "-"],
    ["Create and submit an application",          "-", "-", "-", "-", "-", "-", "Y", "Y"],
    ["Remit the assessment fee",                  "-", "-", "-", "-", "-", "-", "Y", "-"],
    ["Approve or reject an application",          "-", "Y", "-", "-", "-", "-", "-", "-"],
    ["Allocate assessors and fix the date",       "-", "-", "-", "Y", "-", "-", "-", "-"],
    ["Conduct the on-site assessment",            "-", "-", "-", "-", "-", "Y", "-", "-"],
    ["Quality-check a submitted assessment",      "-", "-", "-", "Y", "Y", "-", "-", "-"],
    ["Conduct the rating committee meeting",      "-", "-", "-", "-", "Y", "-", "-", "-"],
    ["Record the rating and certify",             "-", "-", "-", "-", "Y", "-", "-", "-"],
    ["View certified units",                      "Y", "Y", "Y", "Y", "Y", "Y", "◐", "◐"],
    ["Administer user accounts",                  "Y", "-", "-", "-", "-", "-", "◐", "-"],
    ["Author parameters and questions",           "Y", "-", "-", "-", "-", "-", "-", "-"],
    ["Configure the fee structure",               "Y", "-", "-", "-", "-", "-", "-", "-"],
    ["Enable or disable maintenance mode",        "Y", "-", "-", "-", "-", "-", "-", "-"],
]

CAP_LEGEND = ("Y = permitted   ·   ◐ = permitted, restricted to the user's own scope "
              "(own organisation, own unit, assigned States, or assessor records only)   ·  : = not permitted")
