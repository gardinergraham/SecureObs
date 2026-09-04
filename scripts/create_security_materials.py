from pathlib import Path
from math import cos, sin, pi

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, A2, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
OUT.mkdir(parents=True, exist_ok=True)
LOGO = ROOT / "website" / "assets" / "secureobs-logo-new.png"

NAVY = colors.HexColor("#08275B")
TEAL = colors.HexColor("#008EA6")
CYAN = colors.HexColor("#46C3D1")
PALE = colors.HexColor("#EAF6F7")
LIGHT = colors.HexColor("#F5F8FA")
MID = colors.HexColor("#CADCE4")
TEXT = colors.HexColor("#142B45")
GREY = colors.HexColor("#596E7F")
GREEN = colors.HexColor("#DDEFE5")
AMBER = colors.HexColor("#FFF4D4")
WHITE = colors.white

regular_path = "/System/Library/Fonts/Supplemental/Arial.ttf"
bold_path = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
if Path(regular_path).exists():
    pdfmetrics.registerFont(TTFont("SO", regular_path))
    pdfmetrics.registerFont(TTFont("SO-Bold", bold_path))
    REG, BOLD = "SO", "SO-Bold"
else:
    REG, BOLD = "Helvetica", "Helvetica-Bold"

styles = {
    "title": ParagraphStyle("title", fontName=BOLD, fontSize=23, leading=25, textColor=NAVY),
    "subtitle": ParagraphStyle("subtitle", fontName=REG, fontSize=9, leading=12, textColor=GREY),
    "section": ParagraphStyle("section", fontName=BOLD, fontSize=10.5, leading=12, textColor=WHITE),
    "q": ParagraphStyle("q", fontName=BOLD, fontSize=9, leading=11, textColor=NAVY),
    "body": ParagraphStyle("body", fontName=REG, fontSize=7.5, leading=10, textColor=TEXT),
    "small": ParagraphStyle("small", fontName=REG, fontSize=6.4, leading=8, textColor=GREY),
    "callout": ParagraphStyle("callout", fontName=BOLD, fontSize=8.3, leading=11, textColor=NAVY),
    "center": ParagraphStyle("center", fontName=REG, fontSize=7.4, leading=9.5, alignment=TA_CENTER, textColor=TEXT),
}

def P(text, style="body"):
    return Paragraph(text, styles[style])

def header_footer(c, doc):
    c.saveState()
    c.setFillColor(NAVY)
    c.rect(0, A4[1] - 11*mm, A4[0], 11*mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(BOLD, 6.5)
    c.drawRightString(A4[0] - 15*mm, A4[1] - 7*mm, f"SECUREOBS SECURITY & RESILIENCE | {doc.page}")
    c.setStrokeColor(MID)
    c.line(15*mm, 12*mm, A4[0] - 15*mm, 12*mm)
    c.setFillColor(GREY)
    c.setFont(REG, 6.3)
    c.drawString(15*mm, 8*mm, "secure-obs.com | demo@secure-obs.com")
    c.drawRightString(A4[0] - 15*mm, 8*mm, "Product overview - confirm customer-specific assurance requirements during procurement.")
    c.restoreState()

def section(title, content, background=WHITE, padding=5):
    head = Table([[P(title, "section")]], colWidths=[180*mm])
    head.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), TEAL),
        ("LEFTPADDING", (0,0), (-1,-1), 7), ("RIGHTPADDING", (0,0), (-1,-1), 7),
        ("TOPPADDING", (0,0), (-1,-1), 4), ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ]))
    body = Table([[content]], colWidths=[180*mm])
    body.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), background), ("BOX", (0,0), (-1,-1), 0.6, MID),
        ("LEFTPADDING", (0,0), (-1,-1), padding), ("RIGHTPADDING", (0,0), (-1,-1), padding),
        ("TOPPADDING", (0,0), (-1,-1), padding), ("BOTTOMPADDING", (0,0), (-1,-1), padding),
    ]))
    return KeepTogether([head, body, Spacer(1, 2.4*mm)])

def qa(question, answer):
    return [P(question, "q"), Spacer(1, 1*mm), P(answer), Spacer(1, 3*mm)]

def two_col(left, right, widths=(88*mm, 88*mm)):
    t = Table([[left, right]], colWidths=list(widths), hAlign="LEFT")
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 4), ("RIGHTPADDING", (0,0), (-1,-1), 4),
        ("TOPPADDING", (0,0), (-1,-1), 2), ("BOTTOMPADDING", (0,0), (-1,-1), 2),
    ]))
    return t

def faq_pdf():
    path = OUT / "SecureObs_Security_and_Resilience_FAQ.pdf"
    doc = BaseDocTemplate(str(path), pagesize=A4, leftMargin=15*mm, rightMargin=15*mm,
                          topMargin=17*mm, bottomMargin=16*mm, title="SecureObs Security and Resilience FAQ",
                          author="SecureObs")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates(PageTemplate(id="all", frames=frame, onPage=header_footer))
    story = []
    logo = Image(str(LOGO), width=48*mm, height=14*mm, kind="proportional") if LOGO.exists() else P("SecureObs", "title")
    heading = [P("Security & Resilience", "title"), P("Clear answers for care leaders, IT teams and information-governance professionals", "subtitle")]
    title = Table([[logo, heading]], colWidths=[56*mm, 124*mm])
    title.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("LEFTPADDING", (0,0), (-1,-1), 0),
                               ("RIGHTPADDING", (0,0), (-1,-1), 0), ("TOPPADDING", (0,0), (-1,-1), 0),
                               ("BOTTOMPADDING", (0,0), (-1,-1), 0)]))
    story.extend([title, Spacer(1, 4*mm)])
    story.append(section("THE SHORT ANSWER", P(
        "SecureObs uses layered access controls, individual staff authentication, scoped permissions, expiring sessions, "
        "time-stamped records and secure network communication. If connectivity is interrupted, supported essential records "
        "can be queued on the authorised tablet and synchronised when connectivity and an authorised session return.", "callout"), PALE, 7))

    left = []
    left += qa("How is access controlled?", "Each worker signs in using an individual NFC staff card or staff code and PIN. Access is restricted by organisation, site, ward, role and enabled module. Temporary staff access has a defined start and expiry time.")
    left += qa("Are staff PINs visible in the database?", "No. Current PINs are stored as salted PBKDF2-SHA256 hashes rather than readable PIN values. Repeated failed attempts trigger a temporary access lock.")
    left += qa("What is stored on NFC and QR tags?", "Staff cards identify a staff code. Patient and room verification tags use a random SecureObs token; patient names, dates of birth, hospital numbers and photographs are not written to the chip or QR payload.")
    right = []
    right += qa("Can every user see everything?", "No. Role-based permissions and ward assignments limit what staff can view or change. Manager, clinical, security, temporary and super-admin functions are separated.")
    right += qa("What happens to inactive sessions?", "Sessions expire and the tablet applies the ward's configured inactivity lock. Temporary sessions also end when the worker's allocation expires.")
    right += qa("Is activity attributable?", "Important actions are recorded with staff identity, time, organisation and relevant record context, supporting audit review and accountability.")
    story.append(section("IDENTITY, ACCESS & ACCOUNTABILITY", two_col(left, right)))

    left = []
    left += qa("How is information protected in transit?", "The production application communicates with the SecureObs service using HTTPS. Backend sessions are cryptographically signed and checked against the current active staff record.")
    left += qa("Can Android back up the app's clinical data?", "Android application backup is disabled in the SecureObs build. Organisations should also apply device encryption, a strong device passcode, supported Android updates and controlled device administration.")
    right = []
    right += qa("Does a card alone grant unlimited access?", "No. NFC identifies the staff record; role, ward assignment, account status, session rules and temporary access windows are still enforced.")
    right += qa("How is family access controlled?", "Family or designated-person access is patient-consent based, linked to an approved contact and subject to account activation, expiry and access controls.")
    story.append(section("PROTECTING INFORMATION", two_col(left, right)))

    story.append(section("A SHARED RESPONSIBILITY", P(
        "Secure software is one layer of safe operation. Customers remain responsible for authorised devices, staff training, prompt removal of leavers, device passcodes, physical security, local information-governance policies and reporting lost equipment or suspected incidents.", "callout"), AMBER, 7))

    story.append(PageBreak())
    story.extend([title, Spacer(1, 4*mm)])
    story.append(section("WHAT IF CONNECTIVITY OR THE ONLINE SERVICE IS UNAVAILABLE?", P(
        "SecureObs is designed so that a temporary loss of Wi-Fi does not automatically stop essential ward recording. "
        "Supported records that cannot reach the backend are placed in a visible local queue. Staff can see what is waiting, "
        "why an upload failed and whether an item needs review. Authentication details are not stored inside queued records.", "callout"), PALE, 7))

    steps = [
        ("1", "KEEP RECORDING", "Continue supported observations and essential checks using the authorised tablet."),
        ("2", "SEE WHAT IS WAITING", "The sync status shows the number and human-readable details of pending records."),
        ("3", "RECONNECT SAFELY", "When service returns, sign in with an authorised account and retry synchronisation."),
        ("4", "CONFIRM UPLOAD", "Do not treat a queued item as uploaded until SecureObs reports that synchronisation succeeded."),
    ]
    cells = []
    for number, heading_text, body in steps:
        cells.append([P(f"<font color='#008EA6'><b>{number}</b></font><br/><b>{heading_text}</b><br/>{body}", "center")])
    flow = Table([cells], colWidths=[45*mm]*4)
    flow.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), LIGHT), ("BOX", (0,0), (-1,-1), 0.6, MID),
        ("INNERGRID", (0,0), (-1,-1), 0.5, MID), ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 5), ("RIGHTPADDING", (0,0), (-1,-1), 5),
        ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
    ]))
    story.extend([flow, Spacer(1, 4*mm)])

    left = []
    left += qa("Does offline mean every function remains available?", "No. Offline continuity applies to supported cached workflows and queued records. Functions requiring current server data, administration, billing or external integration may need connectivity.")
    left += qa("Could a queued record be lost with the tablet?", "A record waiting only on one tablet depends on that device until it synchronises. Tablets should be protected, charged, checked for outstanding items and synchronised promptly after connectivity returns.")
    right = []
    right += qa("What happens during a longer outage?", "Staff follow the provider's local business-continuity procedure while SecureObs service recovery is managed. Once service returns, outstanding records are reviewed and synchronised.")
    right += qa("Does offline working replace backups?", "No. Offline continuity and database disaster recovery solve different problems. The production PostgreSQL service is configured for a full backup every 24 hours, retained for six days, together with continuous write-based point-in-time recovery. Restore procedures should still be tested and documented regularly.")
    story.append(section("OFFLINE CONTINUITY - IMPORTANT LIMITS", two_col(left, right)))

    evidence_rows = [
        [P("Product evidence", "q"), P("Operational evidence", "q"), P("Customer assurance", "q")],
        [P("Role and permission matrix<br/>Authentication and session controls<br/>Audit-event design<br/>Signed Android release hashes"),
         P("24-hour full-backup schedule<br/>Six-day backup retention<br/>Point-in-time recovery<br/>Documented restore tests"),
         P("Data Processing Agreement<br/>Subprocessor list<br/>Retention and deletion terms<br/>Business-continuity responsibilities")]
    ]
    evidence = Table(evidence_rows, colWidths=[60*mm]*3)
    evidence.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), PALE), ("GRID", (0,0), (-1,-1), 0.5, MID),
        ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6), ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(section("HOW SHOULD SECURITY BE PROVED?", [P("Security assurance should be supported by documented and independently testable evidence, not absolute promises."), Spacer(1,2*mm), evidence]))
    story.append(section("QUESTIONS WE WELCOME", P(
        "Where is data hosted? What backup and restore testing is in place? What is the incident-notification process? "
        "Which subprocessors are used? How are vulnerabilities managed? What independent testing has been completed? "
        "SecureObs will answer customer-specific due-diligence questions during procurement.", "callout"), GREEN, 7))
    story.append(section("IMPORTANT", P(
        "This document describes product controls and recommended operational safeguards. It is not a certification, uptime guarantee or substitute for a customer-specific security assessment, contract, Data Processing Agreement or business-continuity plan.", "small"), LIGHT, 6))
    doc.build(story)
    return path

def rounded_box(c, x, y, w, h, title, body, accent=TEAL):
    title_number, title_text = title
    c.setFillColor(WHITE)
    c.setStrokeColor(MID)
    c.setLineWidth(1.2)
    c.roundRect(x, y, w, h, 6*mm, fill=1, stroke=1)
    c.setFillColor(accent)
    c.circle(x + 13*mm, y + h - 13*mm, 7*mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(BOLD, 15)
    c.drawCentredString(x + 13*mm, y + h - 15*mm, title_number)
    text = c.beginText(x + 24*mm, y + h - 10*mm)
    text.setFillColor(NAVY)
    text.setFont(BOLD, 12)
    for line in title_text.split("\n"):
        text.textLine(line)
    text.setFillColor(TEXT)
    text.setFont(REG, 8.3)
    text.setLeading(11)
    for line in body.split("\n"):
        text.textLine(line)
    c.drawText(text)

def poster_pdf():
    path = OUT / "SecureObs_Security_and_Resilience_Mind_Map_Poster.pdf"
    page = A2
    c = canvas.Canvas(str(path), pagesize=page)
    W, H = page
    c.setTitle("SecureObs Security and Resilience Mind Map")
    c.setAuthor("SecureObs")
    c.setFillColor(LIGHT)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(0, H-30*mm, W, 30*mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(BOLD, 25)
    c.drawCentredString(W/2, H-13*mm, "SECUREOBS: SECURITY & RESILIENCE BY DESIGN")
    c.setFont(REG, 11)
    c.drawCentredString(W/2, H-21*mm, "Layered controls that protect access, support accountability and keep essential care moving")

    cx, cy = W/2, H/2 + 5*mm
    center_r = 47*mm
    c.setFillColor(WHITE)
    c.setStrokeColor(TEAL)
    c.setLineWidth(3)
    c.circle(cx, cy, center_r, fill=1, stroke=1)
    if LOGO.exists():
        c.drawImage(str(LOGO), cx-35*mm, cy+5*mm, 70*mm, 24*mm, preserveAspectRatio=True, anchor='c', mask='auto')
    c.setFillColor(NAVY)
    c.setFont(BOLD, 18)
    c.drawCentredString(cx, cy-4*mm, "ONE CONNECTED")
    c.drawCentredString(cx, cy-12*mm, "SECURE WORKFLOW")
    c.setFillColor(GREY)
    c.setFont(REG, 9)
    c.drawCentredString(cx, cy-23*mm, "People | information | evidence | continuity")

    box_w, box_h = 100*mm, 45*mm
    positions = [
        (18*mm, H-95*mm), (W-118*mm, H-95*mm),
        (10*mm, H/2-18*mm), (W-110*mm, H/2-18*mm),
        (25*mm, 42*mm), (W-125*mm, 42*mm),
    ]
    nodes = [
        (("1", "IDENTITY & ACCESS"), "Individual NFC or PIN sign-in\nRole, site and ward permissions\nTemporary access windows\nFailed-attempt lockouts"),
        (("2", "DATA PROTECTION"), "HTTPS communication\nHashed staff PINs\nAndroid backup disabled\nRandom patient/room tag tokens"),
        (("3", "ACCOUNTABILITY"), "Time-stamped records\nNamed staff attribution\nAudit events and record context\nControlled administrative actions"),
        (("4", "OFFLINE CONTINUITY"), "Supported records queue locally\nWaiting items remain visible\nHuman-readable sync status\nAuthorised re-login before upload"),
        (("5", "SESSION CONTROL"), "Configurable inactivity lock\nCryptographically signed sessions\nActive-account checks\nAgency access ends with allocation"),
        (("6", "RECOVERY & GOVERNANCE"), "Daily full database backup\nSix-day retention and point-in-time recovery\nIncident and continuity procedures\nCustomer security assessment"),
    ]
    for (x, y), (title, body) in zip(positions, nodes):
        bx = x + box_w/2
        by = y + box_h/2
        dx, dy = bx-cx, by-cy
        length = max((dx*dx+dy*dy)**0.5, 1)
        start_x = cx + dx/length * center_r
        start_y = cy + dy/length * center_r
        end_x = bx - dx/length * min(box_w/2, box_h/2)
        end_y = by - dy/length * min(box_w/2, box_h/2)
        c.setStrokeColor(colors.HexColor("#79BFD0"))
        c.setLineWidth(2)
        c.line(start_x, start_y, end_x, end_y)
        c.setFillColor(TEAL)
        c.circle(start_x, start_y, 2.2*mm, fill=1, stroke=0)
        rounded_box(c, x, y, box_w, box_h, title, body)

    outcomes_y = 17*mm
    c.setFillColor(NAVY)
    c.roundRect(18*mm, outcomes_y, W-36*mm, 18*mm, 4*mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(BOLD, 12)
    c.drawCentredString(W/2, outcomes_y+10.5*mm, "CLEAR ACCESS  |  VISIBLE ACCOUNTABILITY  |  CONTINUITY OF CARE  |  EVIDENCE FOR GOVERNANCE")
    c.setFont(REG, 7.2)
    c.setFillColor(GREY)
    c.drawCentredString(W/2, 8*mm, "Security is shared: use managed devices, strong device passcodes, current software, trained staff and tested continuity procedures.")
    c.save()
    return path

if __name__ == "__main__":
    print(faq_pdf())
    print(poster_pdf())
