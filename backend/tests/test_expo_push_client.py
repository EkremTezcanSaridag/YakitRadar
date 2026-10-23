"""Tests for Expo push receipt parsing."""

from expo_push_client import (
    extract_ticket_ids,
    is_device_not_registered_error,
    parse_receipt_outcomes,
)


def test_extract_ticket_ids_from_chunk():
    responses = [{"data": [{"status": "ok", "id": "ticket-1"}, {"status": "error", "message": "x"}]}]
    assert extract_ticket_ids(responses) == ["ticket-1"]


def test_parse_receipt_device_not_registered():
    messages = [{"to": "ExponentPushToken[abc]"}]
    send_responses = [{"data": [{"status": "ok", "id": "ticket-1"}]}]
    receipt_payload = {
        "data": {
            "ticket-1": {
                "status": "error",
                "message": "The recipient device is not registered.",
                "details": {"error": "DeviceNotRegistered"},
            }
        }
    }

    parsed = parse_receipt_outcomes(send_responses, receipt_payload, messages)
    assert parsed["receipt_errors"][0]["error"] == "DeviceNotRegistered"
    assert parsed["receipt_errors"][0]["expo_push_token"] == "ExponentPushToken[abc]"


def test_is_device_not_registered_error():
    assert is_device_not_registered_error("DeviceNotRegistered")
    assert is_device_not_registered_error("device not registered")
