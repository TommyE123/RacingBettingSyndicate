"""Audit trail helper."""

import json
from typing import TYPE_CHECKING

from app.models import AuditLog, User

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def record(
    db: Session,
    actor: User | None,
    action: str,
    entity_type: str,
    entity_id: int | None,
    **detail: object,
) -> None:
    """Add an audit row to the current transaction. Never pass secrets in ``detail``."""
    db.add(
        AuditLog(
            actor_user_id=actor.id if actor else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            detail=json.dumps(detail, sort_keys=True, default=str),
        )
    )
