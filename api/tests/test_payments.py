from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
import razorpay

from api.routes.payments import router
from api.services.auth.depends import get_user

def _make_test_app() -> FastAPI:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_user] = lambda: SimpleNamespace(
        id=1,
        provider_id="provider-1",
        selected_organization_id=11,
    )
    return app

@patch("api.routes.payments.RAZORPAY_KEY_ID", "test_key_id")
@patch("api.routes.payments.RAZORPAY_KEY_SECRET", "test_key_secret")
def test_create_order_under_100_paise():
    app = _make_test_app()
    client = TestClient(app)

    response = client.post(
        "/create-order",
        json={"amount": 50, "currency": "INR"}
    )
    assert response.status_code == 422

@patch("api.routes.payments.RAZORPAY_KEY_ID", "test_key_id")
@patch("api.routes.payments.RAZORPAY_KEY_SECRET", "test_key_secret")
@patch("razorpay.Client")
def test_create_order_success(mock_razorpay_client):
    app = _make_test_app()
    client = TestClient(app)

    mock_client_instance = MagicMock()
    mock_razorpay_client.return_value = mock_client_instance
    mock_client_instance.order.create.return_value = {
        "id": "order_test_123",
        "amount": 500,
        "currency": "INR"
    }

    response = client.post(
        "/create-order",
        json={"amount": 500, "currency": "INR"}
    )
    assert response.status_code == 200
    assert response.json() == {
        "order_id": "order_test_123",
        "amount": 500,
        "currency": "INR"
    }
    mock_client_instance.order.create.assert_called_once()

@patch("api.routes.payments.RAZORPAY_KEY_ID", "test_key_id")
@patch("api.routes.payments.RAZORPAY_KEY_SECRET", "test_key_secret")
@patch("razorpay.Client")
def test_verify_payment_success(mock_razorpay_client):
    app = _make_test_app()
    client = TestClient(app)

    mock_client_instance = MagicMock()
    mock_razorpay_client.return_value = mock_client_instance
    mock_client_instance.utility.verify_payment_signature.return_value = None

    response = client.post(
        "/verify-payment",
        json={
            "razorpay_order_id": "order_test_123",
            "razorpay_payment_id": "pay_test_456",
            "razorpay_signature": "valid_signature"
        }
    )
    assert response.status_code == 200
    assert response.json() == {"success": True, "message": "Payment verified successfully."}

@patch("api.routes.payments.RAZORPAY_KEY_ID", "test_key_id")
@patch("api.routes.payments.RAZORPAY_KEY_SECRET", "test_key_secret")
@patch("razorpay.Client")
def test_verify_payment_signature_failure(mock_razorpay_client):
    app = _make_test_app()
    client = TestClient(app)

    mock_client_instance = MagicMock()
    mock_razorpay_client.return_value = mock_client_instance
    mock_client_instance.utility.verify_payment_signature.side_effect = razorpay.errors.SignatureVerificationError("Signature mismatch")

    response = client.post(
        "/verify-payment",
        json={
            "razorpay_order_id": "order_test_123",
            "razorpay_payment_id": "pay_test_456",
            "razorpay_signature": "invalid_signature"
        }
    )
    assert response.status_code == 400
    assert "Signature verification failed" in response.json()["detail"]


def test_admin_auto_grant_credits():
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_user] = lambda: SimpleNamespace(
        id=1,
        provider_id="admin-provider-1",
        selected_organization_id=11,
        is_superuser=True,
    )
    client = TestClient(app)

    # 1. Create order as Admin
    create_res = client.post("/create-order", json={"amount": 50000, "currency": "INR"})
    assert create_res.status_code == 200
    order_id = create_res.json()["order_id"]
    assert order_id.startswith("admin_auto_grant_")

    # 2. Verify payment as Admin
    verify_res = client.post(
        "/verify-payment",
        json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": "admin_auto_payment",
            "razorpay_signature": "admin_auto_signature",
        },
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["success"] is True

