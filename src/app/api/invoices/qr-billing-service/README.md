# Build the container
docker build -t zoho-qr-service .
docker run -d -p 8080:8080 -e ENVIRONMENT=2 --name qr-service zoho-qr-service

# If you need to rebuild remove the old
docker remove qr-service

# Expose it locally
curl -X POST http://localhost:8080/generate_qr -H "Content-Type: application/json" -d '{"invoice_id": "392845000001248035","application": "ZohoBooks", "environment": "testing"}'

# If you need to bash into the container
docker exec -it qr-service /bin/sh

# If you need to expose it to the web
ngrok http 8080
