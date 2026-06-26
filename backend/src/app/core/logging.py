"""Application logging configuration."""

import logging
import sys


def configure_logging(level: int = logging.INFO) -> None:
    """Configure structured-ish logging for the application."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        stream=sys.stdout,
    )


def get_logger(name: str) -> logging.Logger:
    """Return a logger with the given name."""
    return logging.getLogger(name)
