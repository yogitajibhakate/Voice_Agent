from unittest.mock import AsyncMock, patch
from types import SimpleNamespace
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routes.workflow import router
from api.services.auth.depends import get_user


def _make_test_app() -> FastAPI:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_user] = lambda: SimpleNamespace(
        id=1,
        selected_organization_id=11,
    )
    return app


def test_delete_workflow_success():
    app = _make_test_app()
    client = TestClient(app)

    with patch("api.routes.workflow.db_client") as mock_db:
        mock_db.delete_workflow = AsyncMock(return_value=True)

        response = client.delete("/workflow/123")

    assert response.status_code == 200
    assert response.json() == {"status": "deleted", "workflow_id": 123}
    mock_db.delete_workflow.assert_awaited_once_with(
        workflow_id=123,
        organization_id=11,
    )


def test_delete_workflow_not_found():
    app = _make_test_app()
    client = TestClient(app)

    with patch("api.routes.workflow.db_client") as mock_db:
        mock_db.delete_workflow = AsyncMock(return_value=False)

        response = client.delete("/workflow/123")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]
    mock_db.delete_workflow.assert_awaited_once_with(
        workflow_id=123,
        organization_id=11,
    )
