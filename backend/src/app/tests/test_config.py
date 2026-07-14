"""Tests for the Settings configuration model.

These tests pin the behavior of the SECRET_KEY dev-placeholder validator
that runs at startup. The validator must:

  - Tolerate the standard ``change-me-in-production-...`` placeholder
    when ``environment`` is development/test/dev, so a fresh checkout
    can run with the default ``.env`` for local dev.
  - Reject that same placeholder in production, so a careless copy-paste
    from docs/Slack doesn't end up serving real users with a known key.

Note on env var names: this project does NOT set ``env_prefix`` on
``SettingsConfigDict``, so pydantic-settings reads the raw field names
(``SECRET_KEY``, ``ENVIRONMENT``, etc.) — NOT the ``TOOLSHARING_*``
prefix that the description strings in config.py claim. The tests below
use the actual names. (The descriptions are a separate doc bug — not
fixed here.)

The second test would have caught the regression in the second review
where the check was tied to ``debug`` and rejected the user's ``.env``
even though they had set ``ENVIRONMENT=development``.
"""

import pytest
from pydantic import ValidationError

from app.config import Settings

PLACEHOLDER_KEY = "change-me-in-production-please-use-a-long-random-string"
# Length >= 32 so the length check is satisfied; contains "change-me"
# so the placeholder check fires in production environments.


def test_dev_placeholder_accepted_in_development(monkeypatch: pytest.MonkeyPatch) -> None:
    """Placeholder SECRET_KEY is tolerated when environment=development."""
    monkeypatch.setenv("SECRET_KEY", PLACEHOLDER_KEY)
    monkeypatch.setenv("ENVIRONMENT", "development")
    # Should not raise.
    s = Settings()
    assert s.environment == "development"
    assert s.secret_key.get_secret_value() == PLACEHOLDER_KEY


def test_dev_placeholder_accepted_in_test(monkeypatch: pytest.MonkeyPatch) -> None:
    """Placeholder SECRET_KEY is tolerated when environment=test."""
    monkeypatch.setenv("SECRET_KEY", PLACEHOLDER_KEY)
    monkeypatch.setenv("ENVIRONMENT", "test")
    s = Settings()
    assert s.environment == "test"


def test_dev_placeholder_accepted_in_dev(monkeypatch: pytest.MonkeyPatch) -> None:
    """Placeholder SECRET_KEY is tolerated when environment=dev (short form)."""
    monkeypatch.setenv("SECRET_KEY", PLACEHOLDER_KEY)
    monkeypatch.setenv("ENVIRONMENT", "dev")
    s = Settings()
    assert s.environment == "dev"


def test_dev_placeholder_rejected_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    """Placeholder SECRET_KEY is rejected when environment=production (the default)."""
    monkeypatch.setenv("SECRET_KEY", PLACEHOLDER_KEY)
    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(ValidationError) as excinfo:
        Settings()
    # The validator's error message identifies the rejected value as a
    # "dev placeholder" — that's the contract callers see.
    assert "dev placeholder" in str(excinfo.value).lower()


def test_replace_with_placeholder_also_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The ``replace-with-...`` placeholder is rejected in production too."""
    monkeypatch.setenv(
        "SECRET_KEY",
        "replace-with-a-long-random-string-of-32-or-more-chars",
    )
    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(ValidationError):
        Settings()


def test_real_key_accepted_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    """A 48-char random key (no placeholders) is accepted in production."""
    real_key = "x" * 48
    monkeypatch.setenv("SECRET_KEY", real_key)
    monkeypatch.setenv("ENVIRONMENT", "production")
    s = Settings()
    assert s.secret_key.get_secret_value() == real_key


def test_short_key_rejected_anywhere(monkeypatch: pytest.MonkeyPatch) -> None:
    """A key shorter than 32 chars is rejected in every environment."""
    monkeypatch.setenv("SECRET_KEY", "too-short")
    monkeypatch.setenv("ENVIRONMENT", "development")
    with pytest.raises(ValidationError):
        Settings()
