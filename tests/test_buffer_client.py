import logging
import requests
import pytest
from x_auto_poster.clients.buffer_client import BufferClient
from x_auto_poster.exceptions import (ProviderAuthenticationError, ProviderMutationError,
                                      ProviderRateLimitError, ProviderRequestError,
                                      ProviderResultUnknownError)


class Response:
    def __init__(self, status=200, body=None, headers=None):
        self.status_code=status; self.body=body or {}; self.headers=headers or {}
    def json(self): return self.body


class Session:
    def __init__(self, response=None, error=None): self.response=response; self.error=error; self.args=None
    def post(self, *args, **kwargs):
        self.args=(args,kwargs)
        if self.error: raise self.error
        return self.response


def success():
    return Response(200,{"data":{"createPost":{"__typename":"PostActionSuccess",
                                                     "post":{"id":"post-1","text":"hello","status":"sent"}}}})


def test_success_returns_id_and_sends_share_now_input():
    session=Session(success()); client=BufferClient("secret-key","channel-1",session)
    assert client.publish("hello") == "post-1"
    args,kwargs=session.args
    assert args[0] == "https://api.buffer.com" and kwargs["timeout"] == (5,15)
    assert kwargs["headers"]["Authorization"] == "Bearer secret-key"
    assert kwargs["json"]["variables"]["input"] == {"text":"hello","channelId":"channel-1",
                                                        "schedulingType":"automatic","mode":"shareNow"}


def test_mutation_error_is_failed():
    response=Response(body={"data":{"createPost":{"__typename":"MutationError","message":"Bad channel"}}})
    with pytest.raises(ProviderMutationError): BufferClient("key","channel",Session(response)).publish("hi")


def test_graphql_errors_are_failed():
    response=Response(body={"errors":[{"message":"Invalid query"}]})
    with pytest.raises(ProviderRequestError): BufferClient("key","channel",Session(response)).publish("hi")


def test_missing_post_id_is_unknown():
    response=Response(body={"data":{"createPost":{"__typename":"PostActionSuccess","post":{}}}})
    with pytest.raises(ProviderResultUnknownError): BufferClient("key","channel",Session(response)).publish("hi")


@pytest.mark.parametrize("status", [401,403])
def test_auth_status(status):
    with pytest.raises(ProviderAuthenticationError): BufferClient("key","channel",Session(Response(status))).publish("hi")


def test_429_retry_after():
    with pytest.raises(ProviderRateLimitError) as caught:
        BufferClient("key","channel",Session(Response(429,headers={"Retry-After":"47"}))).publish("hi")
    assert caught.value.retry_after_seconds == 47


def test_429_invalid_retry_after_defaults_to_next_tick():
    with pytest.raises(ProviderRateLimitError) as caught:
        BufferClient("key","channel",Session(Response(429,headers={"Retry-After":"bad"}))).publish("hi")
    assert caught.value.retry_after_seconds == 900


def test_timeout_and_connection_error_are_unknown():
    for error in (requests.Timeout(), requests.ConnectionError()):
        with pytest.raises(ProviderResultUnknownError): BufferClient("key","channel",Session(error=error)).publish("hi")


def test_invalid_json_is_unknown():
    class InvalidJson(Response):
        def json(self): raise ValueError("bad")
    with pytest.raises(ProviderResultUnknownError): BufferClient("key","channel",Session(InvalidJson())).publish("hi")


def test_rate_limit_headers_are_dynamic_and_warning_threshold_is_provider_relative(caplog):
    headers={"RateLimit": '"241-in-1day";r=20;t=300',
             "RateLimit-Policy": '"241-in-1day";q=241;w=86400;pk=:sample:'}
    session=Session(success()); session.response.headers=headers
    client=BufferClient("key","channel",session,logging.getLogger("buffer-test"))
    with caplog.at_level(logging.WARNING, logger="buffer-test"):
        client.publish("hello")
    assert any("20 request(s) remaining" in item.message for item in caplog.records)
    assert any(item.levelno == logging.WARNING for item in caplog.records)


def test_secrets_are_not_in_error_message():
    response=Response(body={"data":{"createPost":{"__typename":"MutationError","message":"key"}}})
    with pytest.raises(ProviderMutationError) as caught:
        BufferClient("key","channel",Session(response)).publish("hi")
    assert "key" not in str(caught.value)


def test_provider_error_does_not_echo_unpublished_content():
    unpublished = "unpublished post text"
    for body in (
        {"errors": [{"message": unpublished}]},
        {"data": {"createPost": {"__typename": "MutationError", "message": unpublished}}},
    ):
        with pytest.raises((ProviderRequestError, ProviderMutationError)) as caught:
            BufferClient("key", "channel", Session(Response(body=body))).publish(unpublished)
        assert unpublished not in str(caught.value)
