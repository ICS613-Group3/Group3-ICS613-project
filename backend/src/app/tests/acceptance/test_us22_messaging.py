"""User Story 22 — Send and Receive Messages in a Reservation Thread.

Section 5 (Messaging) has no backend implementation at all: there is no
`Message` model, no message/thread router, and no schema anywhere in
`backend/src/app` (confirmed via `grep -rli "class Message"` over
`src/app/models/` and a scan of `src/app/api/v1/` for a messaging router --
neither exists). Every scenario below is a skip, not an xfail, since there
is no endpoint to call at all.
"""

import pytest

pytestmark = pytest.mark.acceptance

_NOT_IMPLEMENTED_REASON = (
    "not implemented: Section 5 (Messaging) has no backend at all -- no Message "
    "model, no message/thread router or schema exists anywhere in the codebase."
)


class TestScenario1SendMessageInActiveThread:
    @pytest.mark.skip(reason=_NOT_IMPLEMENTED_REASON)
    async def test_message_saved_and_other_party_notified(self) -> None:
        raise NotImplementedError


class TestScenario2CannotSendInClosedThread:
    @pytest.mark.skip(reason=_NOT_IMPLEMENTED_REASON)
    async def test_returned_or_cancelled_thread_is_read_only(self) -> None:
        raise NotImplementedError


class TestScenario3BothPartiesViewFullMessageHistory:
    @pytest.mark.skip(reason=_NOT_IMPLEMENTED_REASON)
    async def test_messages_shown_chronologically_with_sender_and_timestamp(self) -> None:
        raise NotImplementedError


class TestScenario4NonPartyCannotSendMessage:
    @pytest.mark.skip(reason=_NOT_IMPLEMENTED_REASON)
    async def test_third_party_returns_403(self) -> None:
        raise NotImplementedError
