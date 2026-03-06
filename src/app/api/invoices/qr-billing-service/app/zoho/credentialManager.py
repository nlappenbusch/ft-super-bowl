# This file handles Zoho Credentials

import json
import threading
import logging
import requests


class ZohoCredentialManager:
    def __init__(self, credential_file_path):
        self.credential_file_path = credential_file_path
        self._lock = threading.Lock()
        with open(self.credential_file_path) as f:
            self.credentials = json.load(f)

    def generate_access_token_from_refresh_token(self, token_type):
        """
        Generates a new access token and writes it to credentials file.
        Thread-safe: only one refresh per token_type at a time.
        Returns True on success, False on failure.
        """
        with self._lock:
            url = "https://accounts.zoho.eu/oauth/v2/token"

            payload = {
                'refresh_token': self.credentials[token_type]['refresh_token'],
                'client_id': self.credentials['client_id'],
                'client_secret': self.credentials['client_secret'],
                'grant_type': 'refresh_token',
            }

            response = requests.post(url, data=payload).json()

            if "error" in response:
                logging.error(f"Token refresh failed for {token_type}: {response}")
                return False

            self.credentials[token_type]['access_token'] = response['access_token']

            # Only persist to disk if the file system is writable (not the case in K8s Secret mounts).
            # The in-memory token is sufficient — on restart, the refresh token is used to get a new one.
            try:
                with open(self.credential_file_path, "w") as outfile:
                    json.dump(self.credentials, outfile, indent=4)
            except OSError:
                logging.debug("Credentials file is read-only, skipping disk write (tokens kept in memory)")

            return True

    def get_access_token(self, token_type):
        return self.credentials[token_type]["access_token"]

    def get_refresh_token(self, token_type):
        return self.credentials[token_type]["refresh_token"]
