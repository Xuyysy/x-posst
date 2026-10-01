from datetime import datetime, timedelta
import logging
from zoneinfo import ZoneInfo
import pytest
from x_auto_poster.domain.post import Post, PostConfig
from x_auto_poster.exceptions import (ProviderAuthenticationError, ProviderMutationError,
                                      ProviderRateLimitError, ProviderResultUnknownError)
from x_auto_poster.services.publish_service import PublishService

TZ = ZoneInfo("Asia/Shanghai")
NOW = datetime(2026, 10, 2, 10, 40, tzinfo=TZ)


class MemoryRepository:
    def __init__(self, posts, records=None, lateness=90):
        self.posts = posts
        self.state = {"posts": dict(records or {})}
        self.config = PostConfig(TZ, lateness)
        self.saved = 0

    def get_config(self): return self.config
    def list_posts(self): return list(self.posts)
    def get_state(self): return self.state
    def get_post_state(self, post_id): return self.state["posts"].get(post_id)
    def set_post_state(self, state, post_id, value): state["posts"][post_id] = value
    def save_state(self, state): self.state = state; self.saved += 1


class FakeClient:
    provider_name = "fake"
    def __init__(self, outcomes=None): self.calls = []; self.outcomes = outcomes or {}
    def publish(self, text):
        self.calls.append(text)
        result = self.outcomes.get(text, f"buffer-{len(self.calls)}")
        if isinstance(result, Exception): raise result
        return result


def make_post(post_id, minutes_ago=0, enabled=True):
    return Post(post_id, NOW - timedelta(minutes=minutes_ago), post_id, enabled)


def run(repo, client, now=NOW, sleeps=None):
    PublishService(repo, client, logging.getLogger("test"),
                   sleep_fn=(sleeps.append if sleeps is not None else lambda _: None)).run(now)


def test_future_post_is_not_submitted():
    client = FakeClient(); run(MemoryRepository([make_post("later", -1)]), client)
    assert client.calls == []


def test_exact_schedule_time_is_due():
    exact_now = NOW - timedelta(minutes=5); post = Post("exact", exact_now, "exact", True)
    client = FakeClient(); run(MemoryRepository([post]), client, exact_now)
    assert client.calls == ["exact"]


def test_submitted_unknown_failed_expired_and_disabled_are_skipped():
    posts = [make_post(f"p{i}", enabled=(i != 4)) for i in range(5)]
    records = {"p0": {"status":"submitted"}, "p1": {"status":"unknown"},
               "p2": {"status":"failed"}, "p3": {"status":"expired"}}
    client=FakeClient(); run(MemoryRepository(posts, records), client)
    assert client.calls == []


def test_post_past_lateness_is_expired():
    repo=MemoryRepository([make_post("old", minutes_ago=91)], lateness=90)
    run(repo, FakeClient())
    assert repo.state["posts"]["old"]["status"] == "expired"


def test_posts_publish_in_schedule_order_with_interval():
    posts=[make_post("second", 2), make_post("first", 3), make_post("third", 1)]
    repo=MemoryRepository(posts); client=FakeClient(); waits=[]
    run(repo, client, sleeps=waits)
    assert client.calls == ["first", "second", "third"]
    assert waits == [2, 2]


def test_success_records_provider_id_and_timestamp():
    repo=MemoryRepository([make_post("p")]); run(repo, FakeClient({"p":"abc"}))
    record=repo.state["posts"]["p"]
    assert record["status"] == "submitted" and record["provider"] == "fake"
    assert record["provider_post_id"] == "abc" and "submitted_at" in record


def test_timeout_becomes_unknown_and_is_not_retried():
    repo=MemoryRepository([make_post("p")]); client=FakeClient({"p":ProviderResultUnknownError("timeout")})
    run(repo, client); run(repo, client)
    assert client.calls == ["p"] and repo.state["posts"]["p"]["status"] == "unknown"


def test_connection_error_becomes_unknown():
    repo=MemoryRepository([make_post("p")]); run(repo, FakeClient({"p":ProviderResultUnknownError("disconnect")}) )
    assert repo.state["posts"]["p"]["status"] == "unknown"


def test_mutation_failure_is_failed_and_not_retried():
    repo=MemoryRepository([make_post("p")]); client=FakeClient({"p":ProviderMutationError("invalid")})
    run(repo, client); run(repo, client)
    assert client.calls == ["p"] and repo.state["posts"]["p"]["status"] == "failed"


def test_rate_limit_records_retry_and_stops_rest_of_run():
    repo=MemoryRepository([make_post("first", 2), make_post("second", 1)])
    client=FakeClient({"first":ProviderRateLimitError("limited", 300)})
    run(repo, client)
    assert client.calls == ["first"]
    assert repo.state["posts"]["first"]["status"] == "rate_limited"
    assert "second" not in repo.state["posts"]


def test_rate_limited_waits_until_retry_time():
    retry = (NOW + timedelta(minutes=10)).isoformat()
    repo=MemoryRepository([make_post("p")], {"p":{"status":"rate_limited", "retry_after_at":retry}})
    client=FakeClient(); run(repo, client)
    assert not client.calls


def test_rate_limited_retries_after_retry_time_if_still_fresh():
    repo=MemoryRepository([make_post("p")], {"p":{"status":"rate_limited", "retry_after_at":(NOW-timedelta(seconds=1)).isoformat()}})
    client=FakeClient(); run(repo, client)
    assert client.calls == ["p"] and repo.state["posts"]["p"]["status"] == "submitted"


def test_auth_error_stops_and_does_not_fail_later_posts():
    repo=MemoryRepository([make_post("first", 2), make_post("second", 1)])
    client=FakeClient({"first":ProviderAuthenticationError("unauthorized")})
    with pytest.raises(ProviderAuthenticationError): run(repo, client)
    assert client.calls == ["first"] and "second" not in repo.state["posts"]


def test_one_hundred_due_posts_are_all_processed():
    posts=[make_post(f"p{i:03}", 10-i//10) for i in range(100)]
    client=FakeClient(); repo=MemoryRepository(posts); run(repo, client)
    assert len(client.calls) == 100 and len(repo.state["posts"]) == 100
