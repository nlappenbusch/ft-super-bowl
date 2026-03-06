import os
import sys
import logging
from datetime import datetime
from fastapi import FastAPI, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from app.zoho.apiManager import ZohoApiManager
from app.qr_logic import processInvoice

# === Logging: stdout + file ===
os.makedirs("app/logs", exist_ok=True)
now = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
logfile_path = f"app/logs/qr_service_{now}.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(logfile_path, encoding="utf-8"),
    ],
)

# === API key auth ===
API_KEY = os.environ.get("QR_SERVICE_API_KEY", "")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str = Security(api_key_header)):
    if not API_KEY:
        logging.warning("QR_SERVICE_API_KEY not set — authentication disabled!")
        return api_key
    if api_key != API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing API key")
    return api_key

# === App init ===
# Disable Swagger/docs in production (set ENABLE_DOCS=true to enable)
enable_docs = os.environ.get("ENABLE_DOCS", "false").lower() == "true"
app = FastAPI(
    docs_url="/docs" if enable_docs else None,
    redoc_url="/redoc" if enable_docs else None,
    openapi_url="/openapi.json" if enable_docs else None,
)
zoho_api_manager = ZohoApiManager("app/zoho/credentials.json")

ENV_CONFIG = {
    "igeeks": {
        "organization_id": "20066825785",
        "creditor": {"name": "igeeks AG","street": "Räffelstrasse","house_num": "24","pcode": "8045","city": "Zürich","country": "CH"},
        "account": "CH5000700110000762034",
        "customfield_id": 74316000011062011,
    },
    "rcs": {
        "organization_id": "20102420397",
        "creditor": {"name": "igeeks GmbH Schaffhausen","street": "Zur Stahlgiesserei","house_num": "16a","pcode": "8200","city": "Schaffhausen","country": "CH"},
        "account": "CH8730050016026462108",
        "customfield_id": 651847000000052247,
    },
    "testing": {
        "organization_id": "20087461261",
        "creditor": {"name": "igeeks AG","street": "Räffelstrasse","house_num": "24","pcode": "8045","city": "Zürich","country": "CH"},
        "account": "CH5000700110000762034",
        "customfield_id": 392845000000287001,
    },
}

class InvoiceRequest(BaseModel):
    invoice_id: str
    application: str = "ZohoBooks"
    environment: str = "testing"

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/generate_qr", dependencies=[Security(verify_api_key)])
def generate_qr_invoice(request: InvoiceRequest):
    try:
        env_config = ENV_CONFIG.get(request.environment)
        if not env_config:
            raise HTTPException(status_code=400, detail=f"Unknown environment: {request.environment}")

        organization_id = env_config["organization_id"]
        invoice_id = request.invoice_id
        application = request.application
        logging.info(f"Received request to generate QR for invoice {invoice_id} in {application}")

        # Build read URL + token type
        if application == "ZohoSubscriptions":
            url = f"https://www.zohoapis.eu/subscriptions/v1/invoices/{invoice_id}"
            token_type = "ZohoSubscriptions.invoices.ALL"  # scope needed: READ
        elif application == "ZohoBooks":
            url = f"https://www.zohoapis.eu/books/v3/invoices/{invoice_id}?organization_id={organization_id}"
            token_type = "ZohoBooks.invoices.ALL"  # scope needed: READ
        else:
            raise HTTPException(status_code=400, detail="Unsupported application")

        response = zoho_api_manager.call_api(url=url, token_type=token_type)
        logging.debug(f"Zoho GET raw: {response}")

        # Check for internal call_api errors (e.g. network failure, token refresh failure)
        if isinstance(response, dict) and "error" in response:
            logging.error(f"API call failed: {response}")
            raise HTTPException(status_code=502, detail="Failed to fetch invoice from Zoho")

        # Zoho success wrapper is { code: 0, message: "success", invoice: {...} }
        if isinstance(response, dict) and 'code' in response:
            if response.get('code') != 0:
                logging.error(f"Zoho error on invoice GET: {response}")
                raise HTTPException(status_code=502, detail="Zoho returned an error")

        invoice = (response.get("invoice") if isinstance(response, dict) else None) or response
        if not isinstance(invoice, dict) or not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        # Pass the request invoice_id explicitly to avoid KeyError even if Zoho payload omits it
        result = processInvoice(invoice, application, zoho_api_manager, env_config, invoice_id)

        return {"status": "success", "result": result}

    except HTTPException:
        raise
    except Exception as e:
        logging.exception(f"Failed to process invoice {request.invoice_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
