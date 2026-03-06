import json
import requests
import time
from app.zoho.credentialManager import ZohoCredentialManager
import logging


class ZohoApiManager:
    def __init__(self, credentials_file_path):
        self.credential_manager = ZohoCredentialManager(credentials_file_path)

    def call_api(self, url, token_type, method="GET", payload=None, files=None, _retried=False):
        headers = {
            'Authorization': 'Bearer ' + self.credential_manager.get_access_token(token_type),
        }

        # Sleep to avoid rate-limiting
        time.sleep(0.5)

        logging.info(f"Calling Zoho API: {method} {url}")
        logging.debug(f"Payload: {payload}")

        try:
            timeout = 30  # seconds — prevent hanging threads if Zoho is unresponsive
            if files:
                response = requests.request(method=method, url=url, headers=headers, data=payload, files=files, timeout=timeout)
            elif payload is not None:
                response = requests.request(method=method, url=url, headers=headers, data=json.dumps(payload), timeout=timeout)
            else:
                response = requests.request(method=method, url=url, headers=headers, timeout=timeout)

            response_json = response.json()

            if response_json.get("code") not in [0, 107222]:
                if response_json.get("code") == 57 and not _retried:
                    logging.info("Access token expired, refreshing...")
                    success = self.credential_manager.generate_access_token_from_refresh_token(token_type)
                    if not success:
                        return {"error": "Could not refresh token"}
                    # Reset file handles so they can be re-read on retry
                    if files:
                        for _, file_tuple in files:
                            file_obj = file_tuple[1] if isinstance(file_tuple, tuple) else file_tuple
                            if hasattr(file_obj, 'seek'):
                                file_obj.seek(0)
                    return self.call_api(url, token_type, method, payload, files, _retried=True)
                else:
                    logging.error(f"API error: {response_json}")
            return response_json

        except Exception as e:
            logging.error(f"Exception in call_api(): {e}")
            return {"error": str(e)}
