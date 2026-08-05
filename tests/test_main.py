from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "database" in data


def test_create_order():
    response = client.post("/orders", json={"customer": "Maria"})
    assert response.status_code == 201
    data = response.json()
    assert data["customer"] == "Maria"
    assert data["status"] == "open"
    assert "id" in data


def test_list_orders():
    client.post("/orders", json={"customer": "João"})
    response = client.get("/orders")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_order_not_found():
    response = client.get("/orders/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


def test_add_and_list_items():
    order = client.post("/orders", json={"customer": "Ana"}).json()
    order_id = order["id"]

    item_response = client.post(
        f"/orders/{order_id}/items",
        json={"sku": "SKU-001", "description": "Camiseta", "quantity": 2},
    )
    assert item_response.status_code == 201

    items_response = client.get(f"/orders/{order_id}/items")
    assert items_response.status_code == 200
    assert len(items_response.json()) == 1
