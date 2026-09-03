from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, Image
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
OUT.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#08275B")
TEAL = colors.HexColor("#008EA6")
PALE = colors.HexColor("#EAF6F7")
LIGHT = colors.HexColor("#F4F7FA")
MID = colors.HexColor("#D4E1E8")
TEXT = colors.HexColor("#142B45")
GREY = colors.HexColor("#5F7182")
WHITE = colors.white

font_regular = "/System/Library/Fonts/Supplemental/Arial.ttf"
font_bold = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
if Path(font_regular).exists():
    pdfmetrics.registerFont(TTFont("SO", font_regular))
    pdfmetrics.registerFont(TTFont("SO-Bold", font_bold))
else:
    font_regular, font_bold = "Helvetica", "Helvetica-Bold"

REG = "SO" if font_regular.endswith(".ttf") else font_regular
BOLD = "SO-Bold" if font_bold.endswith(".ttf") else font_bold

styles = {
    "body": ParagraphStyle("body", fontName=REG, fontSize=7.3, leading=9.2, textColor=TEXT),
    "small": ParagraphStyle("small", fontName=REG, fontSize=6.3, leading=7.8, textColor=GREY),
    "label": ParagraphStyle("label", fontName=BOLD, fontSize=6.6, leading=8.2, textColor=NAVY),
    "section": ParagraphStyle("section", fontName=BOLD, fontSize=9.4, leading=11, textColor=WHITE),
    "title": ParagraphStyle("title", fontName=BOLD, fontSize=18, leading=20, textColor=NAVY),
    "subtitle": ParagraphStyle("subtitle", fontName=REG, fontSize=8, leading=10, textColor=GREY),
    "center": ParagraphStyle("center", fontName=REG, fontSize=7, leading=8.5, alignment=TA_CENTER, textColor=TEXT),
    "warn": ParagraphStyle("warn", fontName=BOLD, fontSize=7.2, leading=9, textColor=NAVY),
}

def P(text, style="body"):
    return Paragraph(text, styles[style])

def line_field(label, width=1, note=""):
    body = f"<b>{label}</b><br/><br/>"
    if note:
        body += f"<font color='#5F7182' size='6'>{note}</font>"
    return P(body)

def checks(items, cols=2, total_width=176*mm):
    cells = [P(f"&#9633; {x}") for x in items]
    rows = [cells[i:i+cols] for i in range(0, len(cells), cols)]
    while len(rows[-1]) < cols:
        rows[-1].append("")
    t = Table(rows, colWidths=[total_width/cols]*cols, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 3),
        ("RIGHTPADDING", (0,0), (-1,-1), 3), ("TOPPADDING", (0,0), (-1,-1), 2),
        ("BOTTOMPADDING", (0,0), (-1,-1), 2),
    ]))
    return t

def section(title, content, pad=4, bg=WHITE):
    head = Table([[P(title, "section")]], colWidths=[176*mm])
    head.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),TEAL), ("LEFTPADDING",(0,0),(-1,-1),6),
                              ("TOPPADDING",(0,0),(-1,-1),4), ("BOTTOMPADDING",(0,0),(-1,-1),4)]))
    body = Table([[content]], colWidths=[176*mm])
    body.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),bg), ("BOX",(0,0),(-1,-1),0.55,MID),
                              ("LEFTPADDING",(0,0),(-1,-1),pad), ("RIGHTPADDING",(0,0),(-1,-1),pad),
                              ("TOPPADDING",(0,0),(-1,-1),pad), ("BOTTOMPADDING",(0,0),(-1,-1),pad)]))
    return KeepTogether([head, body, Spacer(1, 1.6*mm)])

def grid(fields, widths=None, heights=None):
    rows = []
    for row in fields:
        rows.append([line_field(x) if isinstance(x, str) else x for x in row])
    if widths is None:
        widths = [176*mm/len(rows[0])] * len(rows[0])
    t = Table(rows, colWidths=widths, rowHeights=heights)
    t.setStyle(TableStyle([
        ("GRID",(0,0),(-1,-1),0.45,MID), ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),4), ("RIGHTPADDING",(0,0),(-1,-1),4),
        ("TOPPADDING",(0,0),(-1,-1),4), ("BOTTOMPADDING",(0,0),(-1,-1),4),
    ]))
    return t

def doc_header(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, A4[1]-11*mm, A4[0], 11*mm, fill=1, stroke=0)
    canvas.setFont(BOLD, 6.5)
    canvas.setFillColor(WHITE)
    canvas.drawRightString(A4[0]-17*mm, A4[1]-7*mm, f"SecureObs  |  Page {doc.page}")
    canvas.setStrokeColor(MID)
    canvas.line(17*mm, 12*mm, A4[0]-17*mm, 12*mm)
    canvas.setFont(REG, 6.2)
    canvas.setFillColor(GREY)
    canvas.drawString(17*mm, 8*mm, "secure-obs.com  |  secure.observations@gmail.com")
    canvas.drawRightString(A4[0]-17*mm, 8*mm, "Please do not record patient-identifiable or special-category data on this form.")
    canvas.restoreState()

def make_doc(path):
    doc = BaseDocTemplate(str(path), pagesize=A4, leftMargin=17*mm, rightMargin=17*mm,
                          topMargin=15*mm, bottomMargin=14*mm, title=path.stem,
                          author="SecureObs")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates(PageTemplate(id="all", frames=frame, onPage=doc_header))
    return doc

def title_block(kicker, title, subtitle):
    logo = ROOT / "website" / "assets" / "secureobs-logo-new.png"
    if logo.exists():
        img = Image(str(logo), width=48*mm, height=14*mm, kind="proportional")
    else:
        img = P("<b>SecureObs</b>", "title")
    right = [P(kicker.upper(), "label"), P(title, "title"), P(subtitle, "subtitle")]
    t = Table([[img, right]], colWidths=[55*mm, 121*mm])
    t.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"), ("LEFTPADDING",(0,0),(-1,-1),0),
                           ("RIGHTPADDING",(0,0),(-1,-1),0), ("TOPPADDING",(0,0),(-1,-1),0),
                           ("BOTTOMPADDING",(0,0),(-1,-1),0)]))
    return [t, Spacer(1, 2*mm)]

def capture_pdf():
    path = OUT / "SecureObs_Reusable_Event_Customer_Capture_Form.pdf"
    story = []
    story += title_block("Reusable event form • side 1", "Customer discovery", "For exhibitions, conferences and sales meetings. Complete in block capitals.")
    story.append(section("EVENT & LEAD CONTROL", grid([
        ["Event / show name", "Event date", "Lead reference"],
        ["SecureObs representative", "Conversation time", "Follow-up owner"]
    ], [78*mm, 45*mm, 53*mm], [12*mm, 12*mm]), pad=0))
    story.append(section("1  CONTACT & ORGANISATION", grid([
        ["Contact name", "Job title / role"],
        ["Legal organisation name", "Trading name (if different)"],
        ["Work email", "Telephone / mobile"],
        ["Registered or main address", "Town / city and postcode"],
        [P("<b>Organisation type</b><br/>"), P("<b>Preferred contact</b><br/>")],
        [checks(["Limited company", "Charity", "NHS / public body", "Partnership", "Sole trader", "Other"],2, 88*mm), checks(["Email", "Telephone", "Video meeting"],2, 88*mm)]
    ], [88*mm, 88*mm], [9*mm,9*mm,9*mm,11*mm,6*mm,16*mm]), pad=0))
    profile = grid([
        ["Number of sites", "Total wards / units", "Approx. beds / people supported"],
        ["Service type", "Current records / care system", "Contract renewal date (if known)"],
        [P("<b>Service setting</b>"), checks(["Care home", "Mental health", "Secure hospital", "Supported living", "Hospital / NHS", "Other"],3, 133*mm), ""]
    ], [43*mm, 71*mm, 62*mm], [9*mm,10*mm,13*mm])
    profile.setStyle(TableStyle([("SPAN",(1,2),(2,2))]))
    story.append(section("2  ORGANISATION PROFILE", profile, pad=0))
    story.append(section("3  WHAT WOULD HELP MOST?", checks([
        "Timed observations & NEWS2", "Care notes and care plans", "Medication / eMAR", "Incidents and safeguarding",
        "Risk assessments", "Staff rota and attendance", "Security checks", "Dashboards and reporting",
        "CQC reporting and governance", "Family / designated-person portal", "Desktop clinical documentation", "Offline working",
        "NFC / QR patient and room checks", "Multi-site management", "Data migration", "Integration / API"
    ], 2)))
    story.append(section("4  BUYING CONTEXT & NEXT STEP", grid([
        ["Main problem to solve", "Desired outcome"],
        ["Decision maker(s)", "Other stakeholders: IT / IG / finance / clinical"],
        ["Target start date", "Budget / procurement route", "Purchase order required?"],
        [P("<b>Requested next step</b>"), checks(["Guided demo", "Private trial", "Quotation", "Technical call", "Follow-up email", "No follow-up"],3, 118*mm), ""]
    ], [58*mm, 59*mm, 59*mm], [12*mm,10*mm,9*mm,12*mm]), pad=0))

    story.append(PageBreak())
    story += title_block("Reusable event form • side 2", "Recommendation & follow-up", "Use this side to record the proposed fit. It is not an order or contract.")
    package_data = [
        [P("Package", "label"), P("Indicative price", "label"), P("Recommended", "label"), P("Notes", "label")],
        [P("Essential"), P("From £149 per ward / month + VAT"), P("&#9633;"), ""],
        [P("Professional"), P("From £299 per ward / month + VAT"), P("&#9633;"), ""],
        [P("Enterprise"), P("From £1,499 per organisation / month + VAT"), P("&#9633;"), ""],
        [P("Hospital"), P("Custom quotation"), P("&#9633;"), ""],
    ]
    pt = Table(package_data, colWidths=[35*mm, 65*mm, 24*mm, 52*mm], rowHeights=[8*mm]+[10*mm]*4)
    pt.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),PALE), ("GRID",(0,0),(-1,-1),0.45,MID),
                            ("VALIGN",(0,0),(-1,-1),"MIDDLE"), ("ALIGN",(2,1),(2,-1),"CENTER"),
                            ("LEFTPADDING",(0,0),(-1,-1),4), ("RIGHTPADDING",(0,0),(-1,-1),4)]))
    story.append(section("5  PACKAGE RECOMMENDATION", pt, pad=0))
    offer = [
        P("<b>EVENT TABLET OFFER</b>", "warn"), Spacer(1,1.5*mm),
        P("Eligible new customers receive rental of <b>two tablets per subscribed ward at no charge for the first six months</b>. From month seven, retained tablets are charged at <b>£37.99 per tablet per month, inclusive of VAT</b>. For two retained tablets this is £75.98 per ward per month, inclusive of VAT."),
        Spacer(1,1.5*mm),
        P("The offer is subject to eligibility, availability and the formal quotation, service agreement and equipment-rental terms. Ownership, delivery, setup, loss or damage responsibility, returns and cancellation arrangements will be confirmed in those documents.", "small"),
        Spacer(1,2*mm),
        grid([["Offer code", "Offer expiry date", "Eligible / confirmed by"]], [58.7*mm]*3, [11*mm])
    ]
    story.append(section("6  EVENT OFFER", offer, bg=PALE))
    story.append(section("7  OPTIONAL MODULES / SERVICES", checks([
        "Medication / eMAR", "Rostering & attendance", "Security checks", "CQC reporting & governance",
        "Analytics dashboard", "Desktop notes & care plans", "Family / designated-person portal", "NFC / QR cards and tags",
        "Additional wards", "Data migration", "Training", "Custom reports / integration"
    ], 2)))
    story.append(section("8  FOLLOW-UP RECORD", grid([
        ["Proposed package / configuration", "Indicative monthly value"],
        ["Action agreed", "Owner and due date"],
        ["Demo / meeting date and time", "Quotation reference when issued"],
        ["Internal notes", "Risks / objections / dependencies"]
    ], [88*mm,88*mm], [10*mm,9*mm,9*mm,15*mm]), pad=0))
    consent = [
        P("<b>Enquiry follow-up:</b> SecureObs may use the contact details above to respond to this enquiry and provide the requested demonstration, trial or quotation."),
        Spacer(1,1.5*mm),
        P("&#9633; <b>Optional product news:</b> I would also like to receive occasional SecureObs product and event updates by email. I understand I can unsubscribe at any time."),
        Spacer(1,1.5*mm),
        P("Privacy information: secure-obs.com/privacy &nbsp;&nbsp; | &nbsp;&nbsp; Do not enter patient names, clinical details or other special-category data on this form.", "small")
    ]
    story.append(section("9  CONTACT PERMISSION & PRIVACY", consent))
    story.append(section("IMPORTANT", P("This customer-capture form records an enquiry and an indicative recommendation only. It is <b>not an order, quotation or binding contract</b>. Prices and eligibility must be confirmed in formal SecureObs documentation."), bg=LIGHT))
    make_doc(path).build(story)
    return path

def order_pdf():
    path = OUT / "SecureObs_Customer_Order_and_Agreement_Preparation_Form.pdf"
    story = []
    story += title_block("Pre-contract form • page 1", "Order & agreement preparation", "Use after a customer asks to proceed. NOT A BINDING CONTRACT.")
    story.append(section("EVENT / SALES CONTROL", grid([
        ["Event / source", "Date", "Lead / quote reference"],
        ["SecureObs representative", "Target start date", "Offer code / expiry"]
    ], [70*mm,45*mm,61*mm], [9*mm,9*mm]), pad=0))
    story.append(section("1  CUSTOMER LEGAL & BILLING DETAILS", grid([
        ["Full legal organisation name", "Trading name"],
        ["Company / charity number", "Organisation type"],
        ["Registered address", "Postcode"],
        ["Authorised contact name", "Job title / authority"],
        ["Work email", "Telephone"],
        ["Billing contact name and email", "Purchase order required? / PO reference"],
        ["Invoice address (if different)", "Finance telephone"]
    ], [105*mm,71*mm], [7*mm,7*mm,8*mm,7*mm,7*mm,8*mm,8*mm]), pad=0))
    order = [
        [P("Selection", "label"), P("Package", "label"), P("Billing", "label"), P("Sites", "label"), P("Wards", "label")],
        [P("&#9633;"), P("Essential — from £149 per ward/month + VAT"), P("&#9633; Monthly  &#9633; Annual"), "", ""],
        [P("&#9633;"), P("Professional — from £299 per ward/month + VAT"), P("&#9633; Monthly  &#9633; Annual"), "", ""],
        [P("&#9633;"), P("Enterprise — from £1,499 per organisation/month + VAT"), P("&#9633; Monthly  &#9633; Annual"), "", ""],
        [P("&#9633;"), P("Hospital — custom quotation"), P("&#9633; Monthly  &#9633; Annual"), "", ""],
    ]
    ot = Table(order, colWidths=[18*mm, 74*mm, 48*mm, 18*mm, 18*mm], rowHeights=[6*mm]+[8*mm]*4)
    ot.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),PALE), ("GRID",(0,0),(-1,-1),0.45,MID),
                            ("VALIGN",(0,0),(-1,-1),"MIDDLE"), ("ALIGN",(0,0),(0,-1),"CENTER"),
                            ("LEFTPADDING",(0,0),(-1,-1),3), ("RIGHTPADDING",(0,0),(-1,-1),3)]))
    story.append(section("2  PROPOSED SUBSCRIPTION", ot, pad=0))
    story.append(section("3  SELECTED MODULES / SERVICES", checks([
        "Medication / eMAR", "Rostering & attendance", "Security checks", "CQC reporting & governance",
        "Analytics dashboard", "Desktop notes & care plans", "Family / designated-person portal", "NFC / QR patient and room checks",
        "Data migration", "Training / onboarding", "Custom reports", "API / integration"
    ], 2)))
    pricing = grid([
        ["Base subscription (ex VAT)", "Add-ons (ex VAT)", "One-off services (ex VAT)"],
        ["Tablet rental months 1–6", "Tablets retained from month 7", "Month 7 onward tablet total (inc VAT)"],
        ["Estimated recurring total", "Formal quote reference", "Requested billing date"]
    ], [58.7*mm]*3, [9*mm,10*mm,9*mm])
    story.append(section("4  INDICATIVE PRICING SUMMARY", pricing, pad=0))
    story.append(section("PRICING NOTE", P("Formal quotation and signed agreements govern all prices. Tablet rental is <b>£0 for the first six months</b> for eligible devices, then <b>£37.99 per retained tablet per month inclusive of VAT</b> from month seven."), bg=PALE))

    story.append(PageBreak())
    story += title_block("Pre-contract form • page 2", "Implementation & acknowledgement", "Information needed to prepare the quotation, service agreement and associated schedules.")
    story.append(section("5  INITIAL ROLLOUT", grid([
        ["Primary site name", "Site address / delivery address"],
        ["Number / names of wards", "Beds / people supported"],
        ["Requested tablets", "NFC cards / tags", "Preferred go-live date"],
        ["Implementation lead", "Training contact", "Device / returns contact"]
    ], [58.7*mm]*3, [10*mm,9*mm,8*mm,9*mm]), pad=0))
    story.append(section("6  INFORMATION GOVERNANCE & TECHNICAL CONTACTS", grid([
        ["Data Protection Officer / IG lead", "Email / telephone"],
        ["IT / security contact", "Email / telephone"],
        ["Current system and migration need", "Integration / API requirement"],
        [P("<b>Customer requirements</b>"), checks(["Data processing agreement", "DPIA support", "Security questionnaire", "Supplier onboarding", "NHS DSPT / standards review", "Other"],2, 88*mm)]
    ], [88*mm,88*mm], [8*mm,8*mm,9*mm,15*mm]), pad=0))
    tablet_terms = [
        P("&#9633; The proposed offer is two eligible rental tablets per subscribed ward at no charge for months 1–6."),
        P("&#9633; From month 7, each retained tablet is £37.99 per month inclusive of VAT."),
        P("&#9633; The customer may request return before paid rental begins, subject to the return process and dates in the equipment schedule."),
        P("&#9633; Device ownership, delivery, setup, acceptable use, loss or damage, insurance, replacement, returns and cancellation will be defined in the formal equipment-rental schedule."),
        P("&#9633; Offer eligibility and device availability remain subject to written confirmation."),
    ]
    story.append(section("7  TABLET OFFER — POINTS TO CONFIRM IN FORMAL TERMS", tablet_terms, bg=PALE))
    story.append(section("8  DOCUMENTS TO PREPARE", checks([
        "Formal quotation", "Service agreement / terms", "Data processing agreement", "Equipment-rental schedule",
        "Implementation plan", "Support / SLA schedule", "Information-security pack", "Direct Debit / payment instructions"
    ], 2)))
    ack = [
        P("I confirm that the information supplied on this form is accurate to the best of my knowledge and ask SecureObs to prepare the formal documents indicated above. I understand that this form records our proposed requirements only and <b>does not create a binding order, subscription, equipment rental or obligation to purchase</b>. No service begins and no payment is due unless and until the relevant formal documents are accepted by authorised parties."),
        Spacer(1,2*mm),
        grid([
            ["Customer name", "Job title", "Date"],
            ["Customer signature (acknowledgement only)", "SecureObs representative", "Date"]
        ], [70*mm,65*mm,41*mm], [9*mm,11*mm])
    ]
    story.append(section("9  CUSTOMER ACKNOWLEDGEMENT", ack))
    consent = [
        P("SecureObs may use the details on this form to prepare and discuss the requested quotation and agreements."),
        Spacer(1,1.5*mm),
        P("&#9633; Optional: I would also like occasional SecureObs product and event updates by email. I can unsubscribe at any time."),
        P("Privacy information: secure-obs.com/privacy", "small")
    ]
    story.append(section("10  CONTACT & PRIVACY", consent))
    story.append(section("SECUREOBS INTERNAL CHECK", checks([
        "Legal entity verified", "Pricing approved", "Offer eligibility approved", "Credit / payment setup checked",
        "DPA prepared", "Equipment terms prepared", "Implementation owner assigned", "Final documents issued"
    ], 2), bg=LIGHT))
    make_doc(path).build(story)
    return path

if __name__ == "__main__":
    for result in (capture_pdf(), order_pdf()):
        print(result)
