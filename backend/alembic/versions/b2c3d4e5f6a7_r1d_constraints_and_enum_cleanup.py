"""r1d_constraints_and_enum_cleanup

Revision ID: b2c3d4e5f6a7
Revises: aff003b1ca5a
Create Date: 2026-06-25 12:00:00.000000

Adds CHECK constraints for free-form string columns whose allowed values are
now enumerated at the application layer:

  * ``reservations.cancelled_by_type`` → must be one of
    ``borrower / owner / system / admin`` (or NULL).

The values themselves are still stored as a free-form string; this is
deliberate so that adding a new ``CancellerType`` in the Python enum does
not require a corresponding migration.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'aff003b1ca5a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_reservations_cancelled_by_type",
        "reservations",
        "cancelled_by_type IS NULL OR cancelled_by_type IN "
        "('borrower', 'owner', 'system', 'admin')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_reservations_cancelled_by_type",
        "reservations",
        type_="check",
    )
