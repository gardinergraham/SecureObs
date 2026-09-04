from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.acroform import AcroForm

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
OUT.mkdir(parents=True, exist_ok=True)
LOGO = ROOT / "website" / "assets" / "secureobs-logo-new.png"

NAVY = HexColor("#082D67")
TEAL = HexColor("#008FA5")
INK = HexColor("#17324D")
MUTED = HexColor("#607489")
LINE = HexColor("#B8D2DF")
PALE = HexColor("#EAF6F8")
LIGHT = HexColor("#F5F8FA")
AMBER = HexColor("#FFF3D4")
GREEN = HexColor("#E5F5ED")
W, H = A4
MM = 72 / 25.4


def wrap(c, text, x, y, width, font="Helvetica", size=8.5, leading=11, color=INK):
    c.setFont(font, size)
    c.setFillColor(color)
    words, lines, current = text.split(), [], ""
    for word in words:
        trial = (current + " " + word).strip()
        if c.stringWidth(trial, font, size) <= width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def header(c, title, subtitle, page, total):
    c.setFillColor(NAVY)
    c.rect(0, H - 16 * MM, W, 16 * MM, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    c.drawRightString(W - 15 * MM, H - 10 * MM, f"SECUREOBS SECURITY ASSURANCE | {page} OF {total}")
    if LOGO.exists():
        c.drawImage(ImageReader(str(LOGO)), 15 * MM, H - 38 * MM, 18 * MM, 18 * MM, preserveAspectRatio=True, mask="auto")
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(38 * MM, H - 28 * MM, title)
    c.setFont("Helvetica", 9)
    c.setFillColor(MUTED)
    c.drawString(38 * MM, H - 34 * MM, subtitle)


def footer(c):
    c.setStrokeColor(LINE)
    c.line(15 * MM, 15 * MM, W - 15 * MM, 15 * MM)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 6.8)
    c.drawString(15 * MM, 10 * MM, "secure-obs.com | demo@secure-obs.com")
    c.drawRightString(W - 15 * MM, 10 * MM, "Confidential when completed - share only with authorised recipients")


def section(c, title, y, colour=TEAL):
    c.setFillColor(colour)
    c.roundRect(15 * MM, y - 8 * MM, W - 30 * MM, 8 * MM, 2 * MM, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(18 * MM, y - 5.4 * MM, title.upper())
    return y - 12 * MM


def text_field(c, name, label, x, y, width, height=11 * MM, help_text=None, value=""):
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 8.2)
    c.drawString(x, y, label)
    if help_text:
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6.8)
        c.drawRightString(x + width, y, help_text)
    c.acroForm.textfield(
        name=name, value=value, x=x, y=y - height - 2 * MM, width=width, height=height,
        borderColor=LINE, fillColor=LIGHT, textColor=INK, borderWidth=0.7,
        fontName="Helvetica", fontSize=8, fieldFlags=4096,
    )
    return y - height - 6 * MM


def info_box(c, title, body, y, fill=PALE):
    h = 25 * MM
    c.setFillColor(fill)
    c.setStrokeColor(LINE)
    c.roundRect(15 * MM, y - h, W - 30 * MM, h, 2 * MM, fill=1, stroke=1)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(19 * MM, y - 6 * MM, title)
    wrap(c, body, 19 * MM, y - 11 * MM, W - 38 * MM, size=8, leading=10)
    return y - h - 4 * MM


def request_form(path):
    c = canvas.Canvas(str(path), pagesize=A4)
    total = 4
    # Page 1
    header(c, "Security Information Request", "For customer IT, information-governance and procurement teams", 1, total)
    y = H - 44 * MM
    y = info_box(c, "Purpose", "Use this form to tell SecureObs which security, privacy and resilience information your organisation requires. Do not include patient data, passwords or other operational secrets.", y)
    y = section(c, "1. Organisation and request owner", y)
    y = text_field(c, "req_org_name", "Organisation name", 18 * MM, y, 82 * MM)
    y2 = text_field(c, "req_service_type", "Service type / care setting", 108 * MM, H - 83 * MM, 84 * MM)
    y = text_field(c, "req_contact_name", "Request owner name and role", 18 * MM, y, 82 * MM)
    y2 = text_field(c, "req_contact_details", "Email and telephone", 108 * MM, y2, 84 * MM)
    y = min(y, y2)
    y = text_field(c, "req_scope", "Proposed SecureObs scope", 18 * MM, y, 174 * MM, 17 * MM, "Sites, wards, users, modules and integrations")
    y = text_field(c, "req_deadline", "Required response date and procurement stage", 18 * MM, y, 174 * MM)
    y = section(c, "2. Information classification and governance", y)
    y = text_field(c, "req_data_types", "Expected data types and sensitivity", 18 * MM, y, 174 * MM, 18 * MM)
    y = text_field(c, "req_frameworks", "Applicable standards, policies or assurance frameworks", 18 * MM, y, 174 * MM, 16 * MM)
    footer(c); c.showPage()

    # Page 2
    header(c, "Security Information Request", "Hosting, encryption, access and privacy requirements", 2, total)
    y = H - 44 * MM
    y = section(c, "3. Hosting and data protection", y)
    for name, label in [
        ("req_hosting", "Required hosting location, residency or tenancy information"),
        ("req_encryption", "Encryption and key-management questions"),
        ("req_devices", "Device security, MDM and local-storage requirements"),
        ("req_retention", "Retention, deletion, export and end-of-contract requirements"),
    ]:
        y = text_field(c, name, label, 18 * MM, y, 174 * MM, 18 * MM)
    y = section(c, "4. Identity, access and accountability", y)
    y = text_field(c, "req_access", "Authentication, role permissions and account lifecycle questions", 18 * MM, y, 174 * MM, 18 * MM)
    y = text_field(c, "req_audit", "Audit trail, monitoring and evidence requirements", 18 * MM, y, 174 * MM, 18 * MM)
    footer(c); c.showPage()

    # Page 3
    header(c, "Security Information Request", "Continuity, incidents and supplier assurance", 3, total)
    y = H - 44 * MM
    y = section(c, "5. Backup, recovery and availability", y)
    for name, label in [
        ("req_backup", "Backup schedule, retention and recovery questions"),
        ("req_restore", "Restore testing, recovery objectives and evidence required"),
        ("req_outage", "Offline operation, outage communication and continuity questions"),
    ]:
        y = text_field(c, name, label, 18 * MM, y, 174 * MM, 20 * MM)
    y = section(c, "6. Incidents and vulnerability management", y)
    y = text_field(c, "req_incident", "Incident detection, escalation and customer-notification requirements", 18 * MM, y, 174 * MM, 20 * MM)
    y = text_field(c, "req_vulnerability", "Vulnerability management, patching and testing questions", 18 * MM, y, 174 * MM, 20 * MM)
    footer(c); c.showPage()

    # Page 4
    header(c, "Security Information Request", "Third parties, evidence and submission", 4, total)
    y = H - 44 * MM
    y = section(c, "7. Subprocessors and integrations", y)
    y = text_field(c, "req_subprocessors", "Subprocessor and supply-chain information required", 18 * MM, y, 174 * MM, 22 * MM)
    y = text_field(c, "req_integrations", "Proposed APIs, SSO, SQL, HL7/FHIR or other integrations", 18 * MM, y, 174 * MM, 22 * MM)
    y = section(c, "8. Evidence and additional questions", y)
    y = text_field(c, "req_evidence", "Documents or evidence requested", 18 * MM, y, 174 * MM, 22 * MM)
    y = text_field(c, "req_questions", "Additional customer-specific questions", 18 * MM, y, 174 * MM, 28 * MM)
    y = section(c, "Submission", y)
    y = info_box(c, "Send securely", "Return the completed form to your SecureObs contact. Evidence that contains confidential architectural, contractual or security information may be shared under appropriate confidentiality arrangements.", y, GREEN)
    y = text_field(c, "req_signoff", "Completed by / role / date", 18 * MM, y, 174 * MM)
    footer(c); c.save()


def response_pack(path):
    c = canvas.Canvas(str(path), pagesize=A4)
    total = 5
    # Page 1
    header(c, "Security Assurance Response Pack", "Customer-specific due-diligence response template", 1, total)
    y = H - 44 * MM
    y = info_box(c, "Document status", "This pack records product controls, operational safeguards, evidence references and customer-specific actions. It is not a certification or an unconditional service guarantee.", y, AMBER)
    y = section(c, "1. Response details", y)
    y = text_field(c, "rsp_customer", "Customer organisation", 18 * MM, y, 174 * MM)
    y = text_field(c, "rsp_scope", "Proposed deployment scope", 18 * MM, y, 174 * MM, 18 * MM)
    y = text_field(c, "rsp_owner", "SecureObs response owner", 18 * MM, y, 84 * MM)
    y2 = text_field(c, "rsp_date", "Response date / version", 108 * MM, H - 131 * MM, 84 * MM)
    y = min(y, y2)
    y = section(c, "2. Executive assurance summary", y)
    y = info_box(c, "Implemented product controls", "Individual NFC or staff-code sign-in with PIN; scoped organisation, site, ward and role permissions; expiring sessions; failed-attempt lockout; cryptographically hashed staff PINs; HTTPS communication; time-stamped records; visible offline queueing for supported workflows; and Android application backup disabled.", y, PALE)
    y = info_box(c, "Verified resilience arrangement", "The production PostgreSQL service is configured for a full backup every 24 hours, retained for six days, together with continuous write-based point-in-time recovery. Restore testing and documented continuity procedures remain essential operational evidence.", y, GREEN)
    y = text_field(c, "rsp_exec_notes", "Customer-specific qualifications or actions", 18 * MM, y, 174 * MM, 24 * MM)
    footer(c); c.showPage()

    # Page 2
    header(c, "Security Assurance Response Pack", "Hosting, data protection and privacy", 2, total)
    y = H - 44 * MM
    y = section(c, "3. Hosting and technical architecture", y)
    y = text_field(c, "rsp_hosting", "Hosting provider, region and production environment", 18 * MM, y, 174 * MM, 22 * MM, "Confirm before issue")
    y = text_field(c, "rsp_architecture", "Architecture, tenancy and network-boundary response", 18 * MM, y, 174 * MM, 22 * MM)
    y = section(c, "4. Data protection", y)
    y = info_box(c, "Current controls", "Production communication uses HTTPS. Staff PINs are stored as salted PBKDF2-SHA256 hashes rather than readable values. Patient and room verification tags use random SecureObs tokens and do not write patient names, dates of birth or hospital numbers into the tag payload.", y)
    y = text_field(c, "rsp_at_rest", "Encryption at rest, key management and evidence reference", 18 * MM, y, 174 * MM, 22 * MM, "Confirm platform configuration")
    y = text_field(c, "rsp_privacy", "Retention, deletion, data subject rights and DPA response", 18 * MM, y, 174 * MM, 26 * MM)
    footer(c); c.showPage()

    # Page 3
    header(c, "Security Assurance Response Pack", "Identity, access, audit and device safeguards", 3, total)
    y = H - 44 * MM
    y = section(c, "5. Identity and access", y)
    y = info_box(c, "Current controls", "Access is restricted by organisation, site, ward, role, enabled module and active account. Temporary staff access can have defined start and expiry times. NFC identifies a staff record but does not bypass PIN, role, assignment, session or account-status controls.", y)
    y = text_field(c, "rsp_access_matrix", "Role and permission matrix / customer-specific configuration", 18 * MM, y, 174 * MM, 25 * MM)
    y = section(c, "6. Accountability and session control", y)
    y = info_box(c, "Current controls", "Important actions record staff identity, time, organisation and relevant record context. Sessions expire and tablet inactivity lock is configurable. Temporary sessions end when their allocation expires.", y)
    y = text_field(c, "rsp_audit", "Audit retention, review process and evidence reference", 18 * MM, y, 174 * MM, 25 * MM)
    y = section(c, "7. Customer device responsibilities", y)
    y = text_field(c, "rsp_device", "Agreed MDM, passcode, update, loss and disposal controls", 18 * MM, y, 174 * MM, 23 * MM)
    footer(c); c.showPage()

    # Page 4
    header(c, "Security Assurance Response Pack", "Backup, outage response and incident management", 4, total)
    y = H - 44 * MM
    y = section(c, "8. Backup and recovery", y)
    y = info_box(c, "Verified configuration", "Full PostgreSQL backup every 24 hours; each full backup retained for six days; continuous write-based point-in-time recovery. This database recovery arrangement is separate from the tablet's offline queue.", y, GREEN)
    y = text_field(c, "rsp_restore_test", "Most recent restore test, result and evidence reference", 18 * MM, y, 174 * MM, 24 * MM, "Complete before customer issue")
    y = text_field(c, "rsp_recovery_objectives", "Contracted or proposed recovery objectives and responsibilities", 18 * MM, y, 174 * MM, 23 * MM)
    y = section(c, "9. Offline continuity", y)
    y = info_box(c, "Current behaviour", "Supported records that cannot reach the service are held in a visible local queue. Staff can see pending items and human-readable failure details. An authorised user must re-authenticate before upload when required, and upload is only complete after successful synchronisation.", y)
    y = text_field(c, "rsp_continuity", "Customer continuity procedure and longer-outage arrangements", 18 * MM, y, 174 * MM, 23 * MM)
    y = section(c, "10. Incident notification", y)
    y = text_field(c, "rsp_incident", "Detection, escalation, notification timescale and named contacts", 18 * MM, y, 174 * MM, 25 * MM, "Agree contractually")
    footer(c); c.showPage()

    # Page 5
    header(c, "Security Assurance Response Pack", "Supplier assurance, evidence and approval", 5, total)
    y = H - 44 * MM
    y = section(c, "11. Subprocessors and supplier management", y)
    y = text_field(c, "rsp_subprocessors", "Current subprocessors, purpose, location and assurance reference", 18 * MM, y, 174 * MM, 27 * MM, "Verify current production list")
    y = section(c, "12. Vulnerabilities and independent testing", y)
    y = text_field(c, "rsp_vulnerability", "Patch, dependency review, disclosure and remediation process", 18 * MM, y, 174 * MM, 25 * MM)
    y = text_field(c, "rsp_independent", "Independent testing, certifications and report availability", 18 * MM, y, 174 * MM, 25 * MM, "Do not claim unless evidenced")
    y = section(c, "13. Evidence and actions", y)
    y = text_field(c, "rsp_evidence", "Evidence supplied or available under confidentiality", 18 * MM, y, 174 * MM, 25 * MM)
    y = text_field(c, "rsp_actions", "Open actions, owner and due date", 18 * MM, y, 174 * MM, 25 * MM)
    y = section(c, "Approval", y)
    y = text_field(c, "rsp_approval", "Prepared by / reviewed by / date / version", 18 * MM, y, 174 * MM, 15 * MM)
    footer(c); c.save()


if __name__ == "__main__":
    request = OUT / "SecureObs_Security_Information_Request_Form.pdf"
    response = OUT / "SecureObs_Security_Assurance_Response_Pack.pdf"
    request_form(request)
    response_pack(response)
    print(request)
    print(response)
