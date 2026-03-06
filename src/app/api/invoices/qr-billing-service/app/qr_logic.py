import os
import uuid
import logging
from app.qrbill.bill import QRBill
import cairosvg
from stdnum.ch import esr
from app.zoho.apiManager import ZohoApiManager  # for type hints only

def matchCountryCodes(country_name):
    mapping = {
        "Schweiz": "CH",
        "Österreich": "AT",
        "Deutschland": "DE",
        "Slowenien": "SI",
        "Kroatien": "HR",
        "Tschechische Republik": "CZ",
        "Switzerland": "CH",
    }
    return mapping.get(country_name, country_name)

def customerMapping(customer_name):
    if customer_name == "PKRück Lebensversicherungsgesellschaft für die betriebliche Vorsorge AG":
        return "PKRück AG"
    return customer_name

def is_qr_iban(account):
    """Check if the IBAN is a QR-IBAN (IID in range 30000-31999)."""
    clean = account.replace(" ", "")
    iid = int(clean[4:9])
    return 30000 <= iid <= 31999

def generate_qrr_reference(invoice_number):
    """Generate a valid 27-digit QRR reference from an invoice number.

    Extracts digits, pads to 26 digits with leading zeros,
    and appends a modulo 10 recursive check digit.
    """
    digits = ''.join(c for c in str(invoice_number) if c.isdigit())
    if not digits:
        raise ValueError(f"Invoice number '{invoice_number}' contains no digits")
    if len(digits) > 26:
        digits = digits[:26]
    digits = digits.zfill(26)
    reference = digits + esr.calc_check_digit(digits)
    logging.info(f"Generated QRR reference '{reference}' from invoice number '{invoice_number}'")
    return reference

def generateQRBill(invoice, path, env_config, request_id):
    """Generate QR bill SVG and PDF. Uses request_id in filenames to avoid collisions."""
    debtor_name = customerMapping(invoice.get("customer_name", ""))
    billing = invoice.get("billing_address", {}) or {}
    debtor_pcode = billing.get("zip", "")
    debtor_city = billing.get("city", "")
    debtor_country = matchCountryCodes(billing.get("country", "Switzerland"))
    debtor_street = billing.get("address", "")
    debtor_house_num = ""

    amount = invoice.get("total", 0)
    currency = str(invoice.get("currency_symbol", "CHF"))
    invoice_number = invoice.get("invoice_number", "UNKNOWN")

    # QR-IBANs require a QRR reference number; regular IBANs use no reference
    reference_number = None
    if is_qr_iban(env_config["account"]):
        reference_number = generate_qrr_reference(invoice_number)

    bill = QRBill(
        account=env_config["account"],
        creditor=env_config["creditor"],
        amount=str(amount),
        currency=currency,
        debtor={
            'name': str(debtor_name),
            'street': str(debtor_street),
            'house_num': str(debtor_house_num),
            'pcode': str(debtor_pcode),
            'city': str(debtor_city),
            'country': str(debtor_country),
        },
        reference_number=reference_number,
        additional_information=str(invoice_number),
        language='de',
        top_line=True,
        payment_line=True,
        font_factor=1
    )

    os.makedirs(path, exist_ok=True)
    # Use request_id in filename to prevent concurrent requests from overwriting each other
    file_path = os.path.join(path, f"{invoice_number}_{request_id}")
    bill.as_svg(file_out=file_path + ".svg", full_page=True)
    cairosvg.svg2pdf(url=file_path + ".svg", write_to=file_path + ".pdf")

def processInvoice(invoice: dict, application: str, zoho_api_manager: ZohoApiManager, env_config: dict, invoice_id: str):
    """
    Attach a QR PDF to the invoice and uncheck the custom field.
    Raises on failure so the API returns 500 with logs.
    """
    inv_id = invoice.get("invoice_id", invoice_id)  # fallback to request id
    if not inv_id:
        raise ValueError("invoice_id missing (both in payload and request)")

    # Token for write ops (used for both custom field update and attachment upload below)
    token_type = "ZohoBooks.invoices.ALL" if application == "ZohoBooks" else "ZohoSubscriptions.invoices.ALL"
    organization_id = env_config["organization_id"]

    if application == "ZohoSubscriptions":
        url_attachment   = f"https://www.zohoapis.eu/subscriptions/v1/invoices/{inv_id}/attachment"
        url_customfields = f"https://www.zohoapis.eu/subscriptions/v1/invoices/{inv_id}/customfields"
    elif application == "ZohoBooks":
        url_attachment   = f"https://www.zohoapis.eu/books/v3/invoices/{inv_id}/attachment?organization_id={organization_id}"
        url_customfields = f"https://www.zohoapis.eu/books/v3/invoices/{inv_id}?organization_id={organization_id}"
    else:
        raise ValueError("Invalid application name")

    logging.info(f"Processing invoice {inv_id}")

    # Delete existing QR attachments before uploading the new one
    existing_attachments = invoice.get("documents") or []
    qr_attachments = [doc for doc in existing_attachments if doc.get("file_name", "").startswith("QR_")]
    for doc in qr_attachments:
        doc_id = doc.get("document_id")
        if not doc_id:
            logging.warning(f"QR attachment without document_id, skipping delete: {doc}")
            continue
        if application == "ZohoSubscriptions":
            url_delete = f"https://www.zohoapis.eu/subscriptions/v1/invoices/{inv_id}/documents/{doc_id}"
        else:
            url_delete = f"https://www.zohoapis.eu/books/v3/invoices/{inv_id}/documents/{doc_id}?organization_id={organization_id}"
        logging.info(f"Deleting existing QR attachment {doc_id} ({doc.get('file_name')})")
        del_response = zoho_api_manager.call_api(url=url_delete, token_type=token_type, method="DELETE")
        logging.info(f"Delete attachment response: {del_response}")
        if isinstance(del_response, dict) and "error" in del_response:
            logging.error(f"Failed to delete attachment {doc_id}: {del_response}")
        elif isinstance(del_response, dict) and del_response.get("code") not in [0, None]:
            logging.error(f"Failed to delete attachment {doc_id}: {del_response}")

    # Unique ID per request to avoid file collisions on concurrent requests
    request_id = uuid.uuid4().hex[:8]
    invoice_number = invoice.get("invoice_number", inv_id)

    # Generate QR PDF/SVG
    out_dir = "app/invoices"
    generateQRBill(invoice, out_dir, env_config, request_id)
    pdf_path = os.path.join(out_dir, f"{invoice_number}_{request_id}.pdf")
    svg_path = os.path.join(out_dir, f"{invoice_number}_{request_id}.svg")

    try:
        # Uncheck custom field — scope needed: UPDATE
        logging.info("Updating custom field (uncheck)")
        payload_cf = {
            "custom_fields": [{
                "customfield_id": env_config["customfield_id"],
                "value": False
            }]
        }
        cf_response = zoho_api_manager.call_api(url=url_customfields, token_type=token_type, method="PUT", payload=payload_cf)

        logging.info(f"Custom field update response: {cf_response}")
        if isinstance(cf_response, dict) and "error" in cf_response:
            raise RuntimeError(f"Custom field update failed: {cf_response}")
        if isinstance(cf_response, dict) and cf_response.get("code") not in [0, None]:
            raise RuntimeError(f"Custom field update failed: {cf_response}")

        # Upload attachment (multipart/form-data) — scope needed: CREATE
        logging.info("Uploading QR PDF as attachment")
        with open(pdf_path, "rb") as f:
            files = [('attachment', (f"QR_{invoice_number}.pdf", f, 'application/pdf'))]
            payload_att = {"can_send_in_mail": "true"}
            upload_response = zoho_api_manager.call_api(url=url_attachment, token_type=token_type, method="POST", payload=payload_att, files=files)

        logging.info(f"Attachment upload response: {upload_response}")
        if isinstance(upload_response, dict) and "error" in upload_response:
            raise RuntimeError(f"Attachment upload failed: {upload_response}")
        if isinstance(upload_response, dict) and upload_response.get("code") not in [0, None]:
            raise RuntimeError(f"Attachment upload failed: {upload_response}")

        logging.info("QR attachment uploaded successfully")
        return {"status": "attached", "invoice_id": inv_id}

    except Exception as error:
        logging.exception(f"Failed to attach QR for invoice {inv_id}: {error}")
        raise
    finally:
        # Cleanup temp files
        try:
            if os.path.exists(pdf_path): os.remove(pdf_path)
            if os.path.exists(svg_path): os.remove(svg_path)
            logging.info("Temporary files deleted")
        except Exception as cleanup_err:
            logging.warning(f"Cleanup warning for {invoice_number}: {cleanup_err}")
