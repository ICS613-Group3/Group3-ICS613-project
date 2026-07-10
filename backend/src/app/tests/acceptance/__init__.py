"""QA acceptance tests mapped 1:1 to scenarios in the team's User Stories doc.

Each test module corresponds to one user story; each test method corresponds
to one Given/When/Then scenario from that story, named after its scenario
number so a test name can be traced straight back to the doc.

This layer is intentionally separate from ``app.tests`` (the backend lead's
endpoint unit/integration tests): those verify implementation correctness,
this verifies the product still satisfies the agreed acceptance criteria.
Overlap between the two layers is expected and fine.

Scenarios describing behavior that does not exist yet are marked
``@pytest.mark.skip(reason="not implemented: ...")``. Scenarios describing
behavior that exists but violates the spec are marked
``@pytest.mark.xfail(strict=True, reason="known gap: ...")`` so they fail
loudly (XPASS) the moment someone "fixes" the code without removing the
marker — a nudge to update this suite in the same PR.
"""
