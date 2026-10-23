"""Expo push send + receipt polling helpers."""

from __future__ import annotations

import time
from typing import Any

import requests

from http_client import SCRAPER_REQUEST_TIMEOUT

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts"
EXPO_RECEIPT_POLL_DELAY_SECONDS = 2.0
EXPO_RECEIPT_MAX_POLLS = 3

EXPO_HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
}


def extract_ticket_ids(send_responses: list[Any]) -> list[str]:
    ticket_ids: list[str] = []

    for chunk in send_responses or []:
        if isinstance(chunk, dict) and "data" in chunk:
            items = chunk["data"]
        elif isinstance(chunk, list):
            items = chunk
        else:
            continue

        if not isinstance(items, list):
            continue

        for item in items:
            if not isinstance(item, dict):
                continue
            if item.get("status") == "ok" and item.get("id"):
                ticket_ids.append(str(item["id"]))

    return ticket_ids


def collect_immediate_push_errors(send_responses: list[Any]) -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []

    for chunk in send_responses or []:
        if isinstance(chunk, dict) and "data" in chunk:
            items = chunk["data"]
        elif isinstance(chunk, list):
            items = chunk
        else:
            continue

        if not isinstance(items, list):
            continue

        for item in items:
            if not isinstance(item, dict):
                continue
            if item.get("status") != "error":
                continue
            message = str(item.get("message") or item.get("details", {}).get("error") or "unknown")
            errors.append(
                {
                    "expo_push_token": str(item.get("details", {}).get("expoPushToken") or ""),
                    "error": message,
                    "phase": "send",
                }
            )

    return errors


def fetch_push_receipts(ticket_ids: list[str]) -> dict[str, Any]:
    if not ticket_ids:
        return {}

    last_payload: dict[str, Any] = {}
    remaining = list(dict.fromkeys(ticket_ids))

    for _ in range(EXPO_RECEIPT_MAX_POLLS):
        if not remaining:
            break

        response = requests.post(
            EXPO_RECEIPTS_URL,
            headers=EXPO_HEADERS,
            json={"ids": remaining},
            timeout=SCRAPER_REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        last_payload = response.json()
        data = last_payload.get("data") or {}

        if not isinstance(data, dict):
            break

        still_pending = [
            ticket_id
            for ticket_id in remaining
            if isinstance(data.get(ticket_id), dict) and data[ticket_id].get("status") == "pending"
        ]

        if not still_pending:
            break

        remaining = still_pending
        time.sleep(EXPO_RECEIPT_POLL_DELAY_SECONDS)

    return last_payload


def parse_receipt_outcomes(
    send_responses: list[Any],
    receipt_payload: dict[str, Any],
    messages: list[dict[str, Any]],
) -> dict[str, Any]:
    ticket_ids = extract_ticket_ids(send_responses)
    token_by_ticket: dict[str, str] = {}

    flat_send_items: list[dict[str, Any]] = []
    for chunk in send_responses or []:
        items = chunk.get("data") if isinstance(chunk, dict) else chunk
        if isinstance(items, list):
            flat_send_items.extend([item for item in items if isinstance(item, dict)])

    for index, item in enumerate(flat_send_items):
        ticket_id = item.get("id")
        if ticket_id and index < len(messages):
            token_by_ticket[str(ticket_id)] = str(messages[index].get("to") or "")

    receipts = receipt_payload.get("data") if isinstance(receipt_payload, dict) else {}
    if not isinstance(receipts, dict):
        receipts = {}

    receipt_errors: list[dict[str, str]] = []
    receipt_ok_count = 0

    for ticket_id, receipt in receipts.items():
        if not isinstance(receipt, dict):
            continue
        status = receipt.get("status")
        if status == "ok":
            receipt_ok_count += 1
            continue
        if status != "error":
            continue

        details = receipt.get("details") if isinstance(receipt.get("details"), dict) else {}
        message = str(details.get("error") or receipt.get("message") or "unknown")
        token = token_by_ticket.get(str(ticket_id), "")
        receipt_errors.append(
            {
                "ticket_id": str(ticket_id),
                "expo_push_token": token,
                "error": message,
                "phase": "receipt",
            }
        )

    return {
        "ticket_ids": ticket_ids,
        "receipt_ok_count": receipt_ok_count,
        "receipt_errors": receipt_errors,
        "immediate_errors": collect_immediate_push_errors(send_responses),
        "receipt_payload": receipt_payload,
    }


def send_expo_messages(messages: list[dict[str, Any]], chunk_size: int = 100) -> tuple[int, list[Any]]:
    sent = 0
    responses: list[Any] = []

    for start in range(0, len(messages), chunk_size):
        chunk = messages[start : start + chunk_size]
        response = requests.post(
            EXPO_PUSH_URL,
            headers=EXPO_HEADERS,
            json=chunk,
            timeout=SCRAPER_REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        responses.append(response.json())
        sent += len(chunk)

    return sent, responses


def is_device_not_registered_error(message: str) -> bool:
    normalized = str(message or "").strip().lower()
    return "devicenotregistered" in normalized.replace(" ", "") or normalized == "device not registered"
